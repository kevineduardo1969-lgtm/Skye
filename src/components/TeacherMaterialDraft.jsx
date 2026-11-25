import React, {useMemo, useState} from 'react';
import {supabase, friendlyError} from '../lib/supabase';
import AiProposalReview from './AiProposalReview';

const accepted = ['txt', 'csv', 'docx', 'pdf'];
const maxBytes = 5 * 1024 * 1024;
const labels = {txt:'Texto', csv:'Tabla CSV', docx:'Documento Word', pdf:'Documento PDF'};
const size = bytes => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const extensionOf = file => file?.name.split('.').pop()?.toLowerCase() || '';
const safeName = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);

export default function TeacherMaterialDraft({teacherId, groups}) {
  const [file, setFile] = useState(null), [sample, setSample] = useState(''), [path, setPath] = useState('');
  const [status, setStatus] = useState('idle'), [message, setMessage] = useState(''), [proposals, setProposals] = useState([]);
  const extension = extensionOf(file);
  const canUpload = file && status !== 'uploading' && !path;
  const detected = useMemo(() => file ? {type:labels[extension] || 'Archivo', bytes:size(file.size)} : null, [file, extension]);
  const choose = async event => {
    const next = event.target.files?.[0] || null;
    setMessage(''); setPath(''); setSample(''); setProposals([]); setStatus('idle');
    if (!next) { setFile(null); return; }
    const ext = extensionOf(next);
    if (!accepted.includes(ext)) { setFile(null); setMessage('Elige un archivo .txt, .csv, .docx o .pdf.'); event.target.value = ''; return; }
    if (next.size > maxBytes) { setFile(null); setMessage('El archivo supera 5 MB. Elige una versión más ligera.'); event.target.value = ''; return; }
    setFile(next); setStatus('reviewing');
    if (ext === 'txt' || ext === 'csv') { try { setSample((await next.text()).slice(0, 3000).trim() || 'El archivo no contiene texto visible.'); } catch { setSample('No pudimos leer una muestra del texto, pero puedes revisar el archivo antes de subirlo.'); } } else setSample(`Detectamos un archivo ${labels[ext]}. El procesamiento seguro se realizará en el backend solo cuando solicites borradores.`);
  };
  const upload = async () => {
    if (!file || !supabase) return;
    setStatus('uploading'); setMessage('Subiendo material privado…');
    try { const nextPath = `${teacherId}/${Date.now()}-${safeName(file.name)}`; const {error} = await supabase.storage.from('teacher-materials').upload(nextPath, file, {contentType:file.type || undefined, upsert:false}); if (error) throw error; setPath(nextPath); setStatus('ready'); setMessage('Material privado listo. Puedes pedir borradores para revisarlos; no se publicará nada automáticamente.'); } catch (error) { setStatus('reviewing'); setMessage(friendlyError(error)); }
  };
  const generate = async () => {
    if (!path || !supabase) return;
    setStatus('generating'); setMessage('El backend está leyendo el material y preparando propuestas…');
    try { const {data, error} = await supabase.functions.invoke('generate-challenge-drafts', {body:{path, sourceName:file?.name || ''}}); if (error) throw error; if (!data?.proposals?.length) throw new Error(data?.error || 'No se generaron borradores revisables.'); setProposals(data.proposals); setStatus('ready'); setMessage('Las propuestas están listas para tu revisión. Ninguna se ha publicado.'); } catch (error) { setStatus('ready'); setMessage(error.message || friendlyError(error)); }
  };
  const remove = async () => {
    if (path && supabase) { if (!window.confirm('¿Eliminar este material privado? No se podrá recuperar desde Skye.')) return; setStatus('uploading'); try { const {error} = await supabase.storage.from('teacher-materials').remove([path]); if (error) throw error; } catch (error) { setStatus('ready'); setMessage(friendlyError(error)); return; } }
    setFile(null); setSample(''); setPath(''); setProposals([]); setStatus('idle'); setMessage('El material se eliminó de esta sesión y del almacenamiento privado.');
  };

  return <section className="material-draft"><div><p className="eyebrow">ASISTENTE DE RETOS · REVISIÓN DOCENTE</p><h4>Crear borrador desde archivo</h4><p>Sube material didáctico para revisarlo de forma privada. La IA propone borradores; tú los corriges y decides si guardarlos.</p></div><p className="privacy-notice" role="note">🔒 <b>No subas nombres, calificaciones ni datos personales de estudiantes.</b></p><label className="file-picker">Selecciona un archivo (.txt, .csv, .docx o .pdf, máximo 5 MB)<input type="file" accept=".txt,.csv,.docx,.pdf,text/plain,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={choose}/></label>{file && <section className="material-review" aria-live="polite"><div className="material-file"><span>📄</span><div><b>{file.name}</b><small>{detected?.type} · {detected?.bytes}</small></div><em>{status === 'uploading' || status === 'generating' ? 'Procesando…' : path ? 'Privado y listo' : 'Listo para revisar'}</em></div><div className="detected-content"><b>Contenido detectado</b><pre>{sample}</pre></div><div className="material-actions">{!path && <button type="button" className="primary" disabled={!canUpload} onClick={upload}>{status === 'uploading' ? 'Procesando…' : 'Subir material privado'}</button>}{path && <button type="button" className="primary" disabled={status === 'generating'} onClick={generate}>{status === 'generating' ? 'Generando borradores…' : 'Generar borradores con IA'}</button>}<button type="button" className="filter-reset" disabled={status === 'uploading' || status === 'generating'} onClick={remove}>{path ? 'Eliminar archivo' : 'Quitar archivo'}</button></div></section>}{message && <p className="auth-message" role="status">{message}</p>}{proposals.length > 0 && <AiProposalReview proposals={proposals} groups={groups} teacherId={teacherId} onEmpty={() => setProposals([])}/>}</section>;
}

