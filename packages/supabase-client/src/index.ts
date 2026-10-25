import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import type { Database } from '@iocondo/shared-types';

/**
 * UNICO punto del monorepo in cui si crea un client Supabase.
 * Le UI NON devono importare `@supabase/supabase-js` ne' chiamare `createClient`:
 * usano i services (apps/*\/src/services), che ricevono il client creato da qui.
 */

/** Tipo del client tipizzato (derivato da createClient: robusto rispetto alle versioni di supabase-js). */
export type TypedSupabaseClient = ReturnType<typeof createSupabaseJsClient<Database>>;

export interface SupabaseConfig {
  url: string;
  /** anon key: la sicurezza e' garantita dalla RLS. MAI la service_role. */
  anonKey: string;
}

function assertConfig({ url, anonKey }: SupabaseConfig) {
  if (!url || !anonKey) {
    throw new Error('Configurazione Supabase mancante: impostare URL e ANON KEY nelle variabili d\'ambiente.');
  }
}

/** Client generico (React Native / script). Su mobile passare `auth.storage` (AsyncStorage). */
export function createSupabaseClient(
  config: SupabaseConfig,
  options?: { auth?: Record<string, unknown> },
): TypedSupabaseClient {
  assertConfig(config);
  return createSupabaseJsClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      ...(options?.auth ?? {}),
    },
  });
}

/** Client per il browser (Next.js client components): sessione in cookie. */
export function createBrowserSupabase(config: SupabaseConfig): TypedSupabaseClient {
  assertConfig(config);
  // cast: @supabase/ssr puo' dipendere da una versione diversa dei generics di supabase-js
  return createBrowserClient<Database>(config.url, config.anonKey) as unknown as TypedSupabaseClient;
}

export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

/** Client per il server (Next.js Server Components / Route Handlers / middleware). */
export function createServerSupabase(config: SupabaseConfig, cookies: CookieAdapter): TypedSupabaseClient {
  assertConfig(config);
  return createServerClient<Database>(config.url, config.anonKey, { cookies }) as unknown as TypedSupabaseClient;
}

export * from './errors';
export type { Database } from '@iocondo/shared-types';
export * from './helpers';
