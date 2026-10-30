import 'react-native-url-polyfill/auto';
import { createSupabaseClient } from '@iocondo/supabase-client';
import { platformStorage } from '@iocondo/supabase-client/storage';

/**
 * Client Supabase dell'app. Creato SOLO tramite @iocondo/supabase-client;
 * la sessione usa localStorage su web e AsyncStorage su iOS/Android.
 * Importato esclusivamente da `src/services/` (le schermate non devono usarlo).
 */
export const supabase = createSupabaseClient(
  {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-placeholder-key',
  },
  { auth: { storage: platformStorage } },
);
