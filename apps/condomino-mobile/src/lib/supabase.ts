import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@iocondo/supabase-client';

/**
 * Client Supabase dell'app mobile. Creato SOLO tramite @iocondo/supabase-client.
 * Importato esclusivamente da `src/services/` (le schermate non devono usarlo).
 */
export const supabase = createSupabaseClient(
  {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-placeholder-key',
  },
  { auth: { storage: AsyncStorage } },
);
