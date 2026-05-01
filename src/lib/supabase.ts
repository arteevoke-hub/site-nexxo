import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Credenciais do Supabase não encontradas no arquivo .env');
}

export const supabase = createClient(
  supabaseUrl || 'https://sua-url.supabase.co',
  supabaseAnonKey || 'sua-anon-key'
);
