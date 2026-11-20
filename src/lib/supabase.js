import {createClient} from '@supabase/supabase-js';

const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);
export const supabase = supabaseConfigured ? createClient(url, anonKey, {
  auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}
}) : null;

export const friendlyError = error => {
  const message = error?.message || '';
  if (/email not confirmed|not confirmed/i.test(message)) return 'Confirma el enlace que llegó a tu correo y luego inicia sesión.';
  if (/rate limit|too many requests/i.test(message)) return 'Hiciste varios intentos seguidos. Espera unos minutos y prueba de nuevo.';
  if (/already registered|already exists/i.test(message)) return 'Esa cuenta ya existe. Elige “Iniciar sesión” en lugar de “Crear cuenta”.';
  if (/invalid login credentials/i.test(message)) return 'Revisa el correo y la contraseña, o confirma primero el enlace de tu correo.';
  if (/invalid|not found|código/i.test(message)) return 'Revisa tus datos de acceso e inténtalo de nuevo.';
  if (/password/i.test(message)) return 'La contraseña debe tener al menos 8 caracteres.';
  return 'No pudimos completar la acción. Revisa tus datos e inténtalo de nuevo.';
};
