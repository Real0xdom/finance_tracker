import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = __FT_SUPABASE_URL__;
export const SUPABASE_ANON_KEY = __FT_SUPABASE_ANON_KEY__;

export const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL || 'https://unconfigured.invalid', SUPABASE_ANON_KEY || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
