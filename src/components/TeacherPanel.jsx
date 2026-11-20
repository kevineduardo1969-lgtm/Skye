import React, {useEffect, useMemo, useState} from 'react';
import {friendlyError, supabase} from '../lib/supabase';

const makeCode = () => `SKY-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const normalizeCode = value => value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0,12);

export default function TeacherPanel({user}) {
  const [groups, setGroups] = useState([]);
  const [codes, setCodes] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [code, setCode] = useState(makeCode());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const {data:groupData, error:groupError} = await supabase.from('groups').select('id,name,created_at').order('created_at', {ascending:false});
    if (groupError) throw groupError;
    const {data:codeData, error:codeError} = await supabase.from('student_codes').select('id,code,group_id,claimed_at,created_at').order('created_at', {ascending:false});
    if (codeError) throw codeError;
    setGroups(groupData || []); setCodes(codeData || []);
    setSelectedGroup(current => current || groupData?.[0]?.id || '');
  };

  useEffect(() => { load().catch(error=>setMessage(friendlyError(error))); }, []);
  const groupNames = useMemo(() => Object.fromEntries(groups.map(group=>[group.id,group.name])), [groups]);

  const createGroup = async event => {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      const {error} = await supabase.from('groups').insert({name:groupName.trim(), teacher_id:user.id});
      if (error) throw error;
      setGroupName(''); await load(); setMessage('Grupo creado. Ahora puedes generar códigos para estudiantes.');
    } catch (error) { setMessage(friendlyError(error)); } finally { setBusy(false); }
  };
  const createCode = async event => {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      const {error} = await supabase.from('student_codes').insert({group_id:selectedGroup, code:normalizeCode(code)});
      if (error) throw error;
      setCode(makeCode()); await load(); setMessage('Código creado. Compártelo solo con el estudiante correspondiente.');
    } catch (error) { setMessage(friendlyError(error)); } finally { setBusy(false); }
  };

  return <main className="content teacher-panel"><p className="eyebrow">ESPACIO DOCENTE</p><h2>Mis grupos</h2><p className="sub">Crea grupos y códigos sin registrar nombres ni datos personales del alumnado.</p>
    <div className="teacher-grid"><section className="task"><h3>Crear grupo</h3><form className="auth-form" onSubmit={createGroup}><label>Nombre del grupo<input value={groupName} onChange={event=>setGroupName(event.target.value.slice(0,60))} placeholder="Ejemplo: 5°A" required /></label><button className="primary" disabled={busy}>Crear grupo</button></form></section>
      <section className="task"><h3>Crear código de estudiante</h3>{groups.length ? <form className="auth-form" onSubmit={createCode}><label>Grupo<select value={selectedGroup} onChange={event=>setSelectedGroup(event.target.value)}>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label>Código<input value={code} onChange={event=>setCode(normalizeCode(event.target.value))} required /></label><button className="primary" disabled={busy}>Generar código</button></form> : <p className="empty-report">Primero crea un grupo.</p>}</section></div>
    {message && <p className="auth-message" role="status">{message}</p>}
    <section className="report-section"><p className="eyebrow">CÓDIGOS ACTIVOS</p><h3>Accesos de estudiantes</h3>{codes.length ? <div className="attempt-list">{codes.map(item=><div key={item.id}><span>🔑</span><div><b>{item.code}</b><small>{groupNames[item.group_id]} · {item.claimed_at?'Código utilizado':'Disponible para asignar'}</small></div><em>{item.claimed_at?'Activo':'Nuevo'}</em></div>)}</div> : <p className="empty-report">Aquí aparecerán los códigos que generes.</p>}</section>
  </main>;
}
