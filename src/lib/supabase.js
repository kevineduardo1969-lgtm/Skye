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
  if (/invalid|not found|código/i.test(message)) return 'Revisa tu código e inténtalo de nuevo.';
  if (/already registered|already exists/i.test(message)) return 'Ese dato ya está registrado. Prueba con otro.';
  if (/password/i.test(message)) return 'La contraseña debe tener al menos 8 caracteres.';
  return 'No pudimos completar la acción. Revisa tus datos e inténtalo de nuevo.';
};
