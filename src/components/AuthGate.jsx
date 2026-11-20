import React, {useState} from 'react';
import {friendlyError, supabase} from '../lib/supabase';

const cleanCode = value => value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0,12);

export default function AuthGate({onReady}) {
  const [mode, setMode] = useState('student');
  const [teacherAction, setTeacherAction] = useState('login');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submitStudent = async event => {
    event.preventDefault();
    setMessage('');
    if (nickname.trim().length < 2) return setMessage('Escribe un apodo de al menos 2 letras.');
    setBusy(true);
    try {
      const {data:{session}, error:sessionError} = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        const {error} = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      const {error} = await supabase.rpc('claim_student_profile', {p_code:cleanCode(code), p_nickname:nickname.trim()});
      if (error) throw error;
      await onReady();
    } catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  };

  const submitTeacher = async event => {
    event.preventDefault();
    setMessage('');
    if (password.length < 8) return setMessage('Usa una contraseña de al menos 8 caracteres.');
    setBusy(true);
    try {
      const result = teacherAction === 'register'
        ? await supabase.auth.signUp({email:email.trim(), password})
        : await supabase.auth.signInWithPassword({email:email.trim(), password});
      if (result.error) throw result.error;
      if (!result.data.session) {
        setMessage('Revisa tu correo para confirmar la cuenta y después inicia sesión.');
        return;
      }
      const {error} = await supabase.rpc('bootstrap_teacher_profile');
      if (error) throw error;
      await onReady();
    } catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  };

  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow">BIENVENIDA A SKYE</p><h1>Tu aventura empieza aquí</h1>
    <p className="auth-copy">Los estudiantes usan un código y un apodo. No pedimos nombres completos ni correo.</p>
    <div className="auth-tabs" role="tablist" aria-label="Tipo de acceso">
      <button type="button" role="tab" aria-selected={mode==='student'} className={mode==='student'?'active':''} onClick={()=>{setMode('student');setMessage('')}}>Soy estudiante</button>
      <button type="button" role="tab" aria-selected={mode==='teacher'} className={mode==='teacher'?'active':''} onClick={()=>{setMode('teacher');setMessage('')}}>Soy docente</button>
    </div>
    {mode==='student' ? <form onSubmit={submitStudent} className="auth-form">
      <label>Mi código de aventura<input value={code} onChange={event=>setCode(cleanCode(event.target.value))} placeholder="Ejemplo: SKY-204" autoComplete="off" required /></label>
      <label>Mi apodo<input value={nickname} onChange={event=>setNickname(event.target.value.slice(0,18))} placeholder="Ejemplo: Astro" autoComplete="nickname" required /></label>
      <p className="auth-note">Tu apodo no debe incluir tu nombre completo.</p>
      <button className="primary" disabled={busy}>{busy?'Entrando…':'Comenzar aventura'}</button>
    </form> : <form onSubmit={submitTeacher} className="auth-form">
      <div className="teacher-switch"><button type="button" className={teacherAction==='login'?'selected':''} onClick={()=>setTeacherAction('login')}>Iniciar sesión</button><button type="button" className={teacherAction==='register'?'selected':''} onClick={()=>setTeacherAction('register')}>Crear cuenta</button></div>
      <label>Correo docente<input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="docente@escuela.mx" autoComplete="email" required /></label>
      <label>Contraseña<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete={teacherAction==='register'?'new-password':'current-password'} minLength="8" required /></label>
      <p className="auth-note">El correo solo se usa para proteger el acceso docente.</p>
      <button className="primary" disabled={busy}>{busy ? 'Verificando…' : teacherAction==='register' ? 'Crear acceso docente' : 'Entrar al panel'}</button>
    </form>}
    {message && <p className="auth-message" role="status">{message}</p>}
  </section></main>;
}
