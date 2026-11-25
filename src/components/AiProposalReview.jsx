import React, {useEffect, useState} from 'react';
import {supabase, friendlyError} from '../lib/supabase';
import {aiProposalToChallenge, normalizeAiProposal} from '../lib/aiDrafts';

const labels = {'multiple-choice':'Opción múltiple', numeric:'Respuesta numérica', 'multi-select':'Seleccionar varias', order:'Ordenar pasos'};

export default function AiProposalReview({proposals, groups, teacherId, onEmpty}) {
  const [items, setItems] = useState([]), [message, setMessage] = useState(''), [saving, setSaving] = useState('');
  useEffect(() => setItems(proposals.map((proposal, index) => ({...normalizeAiProposal(proposal), id:`proposal-${index}`, groupId:groups[0]?.id || '', saved:false}))), [proposals, groups]);
  const update = (id, key, value) => setItems(current => current.map(item => item.id === id ? {...item, [key]:value} : item));
  const discard = id => { const next = items.filter(item => item.id !== id); setItems(next); if (!next.length) onEmpty(); };
  const saveDraft = async item => {
    setSaving(item.id); setMessage('');
    try {
      const prepared = aiProposalToChallenge({...item, options:Array.isArray(item.options) ? item.options : String(item.options).split('\n'), answer:Array.isArray(item.answer) ? item.answer : String(item.answer).split('\n')}, teacherId, item.groupId);
      const {error} = await supabase.from('teacher_challenges').insert(prepared);
      if (error) throw error;
      setItems(current => current.map(candidate => candidate.id === item.id ? {...candidate, saved:true} : candidate));
      window.dispatchEvent(new Event('skye-challenges-updated'));
      setMessage('Borrador guardado. Revísalo en Mis retos antes de publicarlo.');
    } catch (error) { setMessage(error.message || friendlyError(error)); } finally { setSaving(''); }
  };

  return <section className="ai-proposals"><p className="eyebrow">PROPUESTAS DE IA · REVISIÓN DOCENTE</p><h4>Revisa y decide qué conservar</h4><p>Estos son borradores; no se publicarán automáticamente. Ajusta cualquier campo antes de guardar.</p>{items.map(item => <article key={item.id}><div className="proposal-heading"><b>{item.title || 'Borrador sin título'}</b><span>{labels[item.interaction_type]}</span></div><div className="proposal-grid"><label>Grupo<select value={item.groupId} onChange={event => update(item.id, 'groupId', event.target.value)}>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label>Módulo<input value={item.module_id} onChange={event => update(item.id, 'module_id', event.target.value)} /></label><label>Habilidad<input value={item.skill} onChange={event => update(item.id, 'skill', event.target.value)} /></label><label>Dificultad<select value={item.difficulty} onChange={event => update(item.id, 'difficulty', event.target.value)}><option value="inicio">Inicio</option><option value="práctica">Práctica</option><option value="desafío">Desafío</option></select></label><label className="wide">Título<input value={item.title} onChange={event => update(item.id, 'title', event.target.value)} /></label><label className="wide">Consigna<textarea value={item.prompt} onChange={event => update(item.id, 'prompt', event.target.value)} /></label>{item.interaction_type !== 'numeric' && <label className="wide">{item.interaction_type === 'order' ? 'Pasos en orden correcto' : 'Opciones, una por línea'}<textarea value={item.options.join('\n')} onChange={event => update(item.id, 'options', event.target.value.split('\n').map(value => value.trim()).filter(Boolean))} /></label>}<label className="wide">{item.interaction_type === 'order' ? 'Pasos correctos, uno por línea' : 'Respuesta correcta'}<textarea value={item.answer.join('\n')} onChange={event => update(item.id, 'answer', event.target.value.split('\n').map(value => value.trim()).filter(Boolean))} /></label><label className="wide">Pista<textarea value={item.hint} onChange={event => update(item.id, 'hint', event.target.value)} /></label><label className="wide">Explicación<textarea value={item.explanation} onChange={event => update(item.id, 'explanation', event.target.value)} /></label></div><div className="proposal-actions"><button type="button" className="hint-button" onClick={() => discard(item.id)} disabled={item.saved}>Descartar</button><button type="button" className="primary" onClick={() => saveDraft(item)} disabled={Boolean(saving) || item.saved}>{item.saved ? 'Guardado como borrador ✓' : saving === item.id ? 'Guardando…' : 'Guardar como borrador'}</button></div></article>)}{message && <p className="auth-message" role="status">{message}</p>}</section>;
}

