import React, {useEffect, useMemo, useState} from 'react';
import {friendlyError, supabase} from '../lib/supabase';
import {exercises, modules} from '../data/exercises';

const makeCode = () => `SKY-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const normalizeCode = value => value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0,12);
const dateFormat = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
const shortDate = new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'short'});

function maxByExercise(rows, field) {
  return Object.values(rows.reduce((result, row) => {
    const current = result[row.exercise_id] || {...row, [field]:0};
    result[row.exercise_id] = {...current, [field]:Math.max(current[field] || 0, row[field] || 0)};
    return result;
  }, {}));
}

function buildSummary(student, rows) {
  const solved = new Set(rows.filter(row => row.status === 'resuelto').map(row => row.exercise_id));
  const byExercise = maxByExercise(rows, 'attempts');
  const hints = maxByExercise(rows, 'hints_used').reduce((total, row) => total + (row.hints_used || 0), 0);
  const stars = rows.reduce((total, row) => total + (row.stars_earned || 0), 0);
  const skills = [...new Set(rows.map(row => row.skill).filter(Boolean))];
  const last = rows[rows.length - 1];
  const mostAttempts = [...byExercise].sort((a, b) => (b.attempts || 0) - (a.attempts || 0)).slice(0, 2).map(row => ({...row, title:exercises.find(exercise => exercise.id === row.exercise_id)?.prompt || row.skill}));
  const moduleStats = modules.map(module => {
    const moduleRows = rows.filter(row => row.module_id === module.id);
    const moduleSolved = new Set(moduleRows.filter(row => row.status === 'resuelto').map(row => row.exercise_id)).size;
    const moduleAttempts = maxByExercise(moduleRows, 'attempts').reduce((total, row) => total + (row.attempts || 0), 0);
    const moduleHints = maxByExercise(moduleRows, 'hints_used').reduce((total, row) => total + (row.hints_used || 0), 0);
    return {module, moduleRows, moduleSolved, moduleAttempts, moduleHints};
  }).filter(item => item.moduleRows.length);
  const strength = [...moduleStats].sort((a, b) => (b.moduleSolved * 4 - b.moduleAttempts - b.moduleHints) - (a.moduleSolved * 4 - a.moduleAttempts - a.moduleHints))[0];
  const practicing = [...moduleStats].sort((a, b) => (b.moduleHints * 3 + b.moduleAttempts - b.moduleSolved) - (a.moduleHints * 3 + a.moduleAttempts - a.moduleSolved))[0];
  return {student, rows, solved, hints, stars, skills, last, mostAttempts, strength, practicing};
}

export default function TeacherPanel({user}) {
  const [groups, setGroups] = useState([]);
  const [codes, setCodes] = useState([]);
  const [roster, setRoster] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [code, setCode] = useState(makeCode());
  const [filters, setFilters] = useState({group:'all', module:'all', skill:'all', period:'all', activity:'all'});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [groupResult, codeResult, rosterResult, evidenceResult] = await Promise.all([
      supabase.from('groups').select('id,name,created_at').order('created_at', {ascending:false}),
      supabase.from('student_codes').select('id,code,group_id,claimed_at,created_at').order('created_at', {ascending:false}),
      supabase.rpc('get_teacher_student_roster'),
      supabase.from('learning_evidence').select('student_id,group_id,exercise_id,module_id,skill,status,attempts,hints_used,stars_earned,created_at').order('created_at', {ascending:true}),
    ]);
    const error = groupResult.error || codeResult.error || rosterResult.error || evidenceResult.error;
    if (error) throw error;
    setGroups(groupResult.data || []);
    setCodes(codeResult.data || []);
    setRoster(rosterResult.data || []);
    setEvidence(evidenceResult.data || []);
    setSelectedGroup(current => current || groupResult.data?.[0]?.id || '');
    setLoading(false);
  };

  useEffect(() => { load().catch(error => {setMessage(friendlyError(error)); setLoading(false);}); }, []);
  const groupNames = useMemo(() => Object.fromEntries(groups.map(group => [group.id, group.name])), [groups]);

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

  const setFilter = (key, value) => setFilters(current => ({...current, [key]:value}));
  const availableSkills = useMemo(() => [...new Set(evidence.map(item => item.skill).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es')), [evidence]);
  const filteredEvidence = useMemo(() => {
    const days = filters.period === '7' ? 7 : filters.period === '30' ? 30 : filters.period === '90' ? 90 : null;
    const earliest = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
    return evidence.filter(item =>
      (filters.group === 'all' || item.group_id === filters.group) &&
      (filters.module === 'all' || item.module_id === filters.module) &&
      (filters.skill === 'all' || item.skill === filters.skill) &&
      (!earliest || new Date(item.created_at) >= earliest)
    );
  }, [evidence, filters.group, filters.module, filters.skill, filters.period]);
  const evidenceByStudent = useMemo(() => filteredEvidence.reduce((result, item) => ({...result, [item.student_id]:[...(result[item.student_id] || []), item]}), {}), [filteredEvidence]);
  const studentSummaries = useMemo(() => roster
    .filter(student => filters.group === 'all' || student.group_id === filters.group)
    .map(student => buildSummary(student, evidenceByStudent[student.student_id] || []))
    .filter(summary => {
      if (filters.activity === 'all') return true;
      if (filters.activity === 'evidence') return summary.rows.length > 0;
      if (filters.activity === 'solved') return summary.solved.size > 0;
      if (filters.activity === 'practicing') return summary.rows.some(row => row.status === 'practicando');
      if (filters.activity === 'inactive') return summary.rows.length === 0;
      if (filters.activity === 'recent') return summary.last && (Date.now() - new Date(summary.last.created_at).getTime()) <= 7 * 24 * 60 * 60 * 1000;
      return true;
    }), [roster, evidenceByStudent, filters.group, filters.activity]);
  const selectedSummary = selectedStudent ? studentSummaries.find(item => item.student.student_id === selectedStudent) : null;

  return <main className="content teacher-panel"><p className="eyebrow">ESPACIO DOCENTE · EVIDENCIAS PROTEGIDAS</p><h2>Panel de aprendizaje</h2><p className="sub">Consulta el proceso de cada grupo usando únicamente apodos y códigos de aventura.</p>
    <section className="teacher-overview" aria-label="Resumen de grupos"><article><span>👥</span><b>Estudiantes activos</b><strong>{roster.length}</strong><small>Con código asignado en tus grupos.</small></article><article><span>🏫</span><b>Mis grupos</b><strong>{groups.length}</strong><small>Solo tú puedes consultar sus evidencias.</small></article><article><span>🧭</span><b>Evidencias visibles</b><strong>{filteredEvidence.length}</strong><small>Registros según los filtros elegidos.</small></article></section>

    <section className="teacher-filters" aria-label="Filtros de evidencias"><div><label>Grupo<select value={filters.group} onChange={event => setFilter('group', event.target.value)}><option value="all">Todos mis grupos</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label>Módulo<select value={filters.module} onChange={event => setFilter('module', event.target.value)}><option value="all">Todos los módulos</option>{modules.map(module => <option key={module.id} value={module.id}>{module.icon} {module.title}</option>)}</select></label><label>Habilidad<select value={filters.skill} onChange={event => setFilter('skill', event.target.value)}><option value="all">Todas las habilidades</option>{availableSkills.map(skill => <option key={skill} value={skill}>{skill}</option>)}</select></label><label>Periodo<select value={filters.period} onChange={event => setFilter('period', event.target.value)}><option value="all">Todo el historial</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option></select></label><label>Estado de actividad<select value={filters.activity} onChange={event => setFilter('activity', event.target.value)}><option value="all">Todos</option><option value="recent">Activos esta semana</option><option value="evidence">Con evidencia</option><option value="solved">Con retos resueltos</option><option value="practicing">Practicando</option><option value="inactive">Sin evidencia en este filtro</option></select></label></div><button type="button" className="filter-reset" onClick={() => setFilters({group:'all', module:'all', skill:'all', period:'all', activity:'all'})}>Limpiar filtros</button></section>

    <section className="report-section"><p className="eyebrow">VISTA POR ESTUDIANTE</p><h3>Proceso de aprendizaje por grupo</h3>{loading ? <p className="empty-report">Cargando evidencias protegidas…</p> : studentSummaries.length ? <div className="student-list">{studentSummaries.map(summary => <button type="button" key={summary.student.student_id} className="student-row" onClick={() => setSelectedStudent(summary.student.student_id)} aria-label={`Ver bitácora de ${summary.student.nickname}`}><span className="student-identity"><span className="student-avatar">✦</span><span><b>{summary.student.nickname}</b><small>Código: {summary.student.student_code} · {summary.student.group_name}</small></span></span><span><strong>{summary.solved.size}</strong><small>retos resueltos</small></span><span><strong>⭐ {summary.stars}</strong><small>{summary.hints} pista{summary.hints===1?'':'s'}</small></span><span><small>{summary.last ? `Última actividad: ${shortDate.format(new Date(summary.last.created_at))}` : 'Aún sin actividad'}</small></span><i>Ver bitácora →</i></button>)}</div> : <p className="empty-report">No hay estudiantes que coincidan con estos filtros todavía.</p>}</section>

    {selectedSummary && <StudentDetail summary={selectedSummary} onClose={() => setSelectedStudent(null)} />}

    <section className="teacher-grid"><section className="task"><h3>Crear grupo</h3><form className="auth-form" onSubmit={createGroup}><label>Nombre del grupo<input value={groupName} onChange={event => setGroupName(event.target.value.slice(0,60))} placeholder="Ejemplo: 5°A" required /></label><button className="primary" disabled={busy}>Crear grupo</button></form></section>
      <section className="task"><h3>Crear código de estudiante</h3>{groups.length ? <form className="auth-form" onSubmit={createCode}><label>Grupo<select value={selectedGroup} onChange={event => setSelectedGroup(event.target.value)}>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label>Código<input value={code} onChange={event => setCode(normalizeCode(event.target.value))} required /></label><button className="primary" disabled={busy}>Generar código</button></form> : <p className="empty-report">Primero crea un grupo.</p>}</section></section>
    {message && <p className="auth-message" role="status">{message}</p>}
    <section className="report-section"><p className="eyebrow">CÓDIGOS ACTIVOS</p><h3>Accesos de estudiantes</h3>{codes.length ? <div className="attempt-list">{codes.map(item => <div key={item.id}><span>🔑</span><div><b>{item.code}</b><small>{groupNames[item.group_id]} · {item.claimed_at?'Código utilizado':'Disponible para asignar'}</small></div><em>{item.claimed_at?'Activo':'Nuevo'}</em></div>)}</div> : <p className="empty-report">Aquí aparecerán los códigos que generes.</p>}</section>
  </main>;
}

function StudentDetail({summary, onClose}) {
  const {student, solved, stars, hints, skills, last, mostAttempts, strength, practicing, rows} = summary;
  return <section className="student-detail" aria-labelledby="student-detail-title"><div className="detail-heading"><div><p className="eyebrow">BITÁCORA INDIVIDUAL</p><h3 id="student-detail-title">{student.nickname}</h3><p>Código: <b>{student.student_code}</b> · {student.group_name}</p></div><button type="button" onClick={onClose} aria-label="Cerrar bitácora individual">× Cerrar</button></div><div className="detail-stats"><span><b>{solved.size}</b> retos resueltos</span><span><b>⭐ {stars}</b> estrellas</span><span><b>💡 {hints}</b> pistas</span><span><b>{last ? dateFormat.format(new Date(last.created_at)) : 'Sin actividad'}</b> última actividad</span></div><div className="summary-grid"><article><span>💪</span><b>Fortaleza</b><p>{strength ? `${strength.module.title}: ha construido evidencia al resolver ${strength.moduleSolved} reto${strength.moduleSolved===1?'':'s'}.` : 'Aún necesita explorar un reto para detectar una fortaleza.'}</p></article><article><span>🌱</span><b>Practicando</b><p>{practicing ? `${practicing.module.title}: los intentos y pistas muestran un proceso en construcción.` : 'Cuando haya evidencia, aquí aparecerá una habilidad para seguir practicando.'}</p></article><article className="recommended"><span>🧩</span><b>Habilidades trabajadas</b><p>{skills.length ? skills.slice(0,4).join(' · ') : 'Sin habilidades registradas todavía.'}</p></article></div><div className="detail-columns"><div><h4>Retos con más intentos</h4>{mostAttempts.length ? <ul>{mostAttempts.map(item => <li key={item.exercise_id}><b>{item.skill}</b><span>{item.attempts} intento{item.attempts===1?'':'s'}</span></li>)}</ul> : <p>Cuando pruebe un reto, aquí se reconocerá su perseverancia.</p>}</div><div><h4>Actividad reciente</h4>{rows.length ? <ul>{rows.slice(-4).reverse().map((row, index) => <li key={`${row.exercise_id}-${row.created_at}-${index}`}><b>{row.skill}</b><span>{row.status === 'resuelto' ? 'Reto resuelto' : row.status === 'practicando' ? 'Probando una estrategia' : 'Reto iniciado'} · {shortDate.format(new Date(row.created_at))}</span></li>)}</ul> : <p>Aún no hay evidencias registradas.</p>}</div></div></section>;
}
