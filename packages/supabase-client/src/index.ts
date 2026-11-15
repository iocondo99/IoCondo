import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import type { Database } from '@iocondo/shared-types';
import { createTelemetryFetch, TelemetryCollector } from './telemetry.ts';

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

export interface TelemetryOptions {
  enabled?: boolean;
  flushIntervalMs?: number;
}

/** Client generico (React Native / script). Su mobile passare `auth.storage` (AsyncStorage). */
export function createSupabaseClient(
  config: SupabaseConfig,
  options?: { auth?: Record<string, unknown>; telemetry?: boolean | TelemetryOptions },
): TypedSupabaseClient {
  assertConfig(config);

  const telemetryCfg =
    options?.telemetry === true
      ? { enabled: true }
      : typeof options?.telemetry === 'object'
        ? options.telemetry
        : undefined;

  let collector: TelemetryCollector | null = null;
  let customFetch: typeof fetch | undefined;

  if (telemetryCfg?.enabled && typeof globalThis.fetch === 'function') {
    collector = new TelemetryCollector({
      flushIntervalMs: telemetryCfg.flushIntervalMs,
      autoStart: true,
    });
    customFetch = createTelemetryFetch(collector, globalThis.fetch.bind(globalThis));
  }

  const client = createSupabaseJsClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      ...(options?.auth ?? {}),
    },
    ...(customFetch ? { global: { fetch: customFetch } } : {}),
  });

  if (collector) {
    collector.setFlushHandler(async (batch) => {
      const { data } = await client.auth.getSession();
      if (!data.session?.user?.id) return;
      const rpcClient = client as unknown as {
        rpc: (fn: string, params: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
      await rpcClient.rpc('registra_telemetria_batch', {
        p_get: batch.get,
        p_insert: batch.insert,
        p_put: batch.put_patch,
        p_delete: batch.delete,
        p_edge: batch.edge_fn,
        p_errori: batch.errori,
      });
    });
  }

  return client;
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

export * from './errors.ts';
export type { Database } from '@iocondo/shared-types';
export * from './helpers.ts';
export * from './telemetry.ts';
