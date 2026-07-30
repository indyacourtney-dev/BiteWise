
 
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
 
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
 
// The auth screen shows a "backend isn't configured" banner off this flag,
// so a missing .env fails loudly and helpfully instead of as a network error.
export const configured = Boolean(supabaseUrl && supabaseAnonKey);
 
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-have thekey',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
 
