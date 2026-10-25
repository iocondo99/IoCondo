import { createBrowserSupabase } from '@iocondo/supabase-client';

/**
 * Client Supabase dell'app admin. Creato SOLO tramite @iocondo/supabase-client.
 * Importato esclusivamente da `src/services/` (le pagine non devono usarlo).
 */
export const supabase = createBrowserSupabase({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
});
