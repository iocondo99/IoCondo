/**
 * Collector di telemetria leggero lato client per Supabase.
 * - Classifica le richieste REST e Edge Functions in memoria.
 * - Esclude le chiamate alla RPC `registra_telemetria_batch` per evitare loop infiniti.
 * - Esegue il flush aggregato ogni 60 secondi o quando la pagina va in background.
 * - Non rallenta né blocca mai le richieste applicative.
 */

export type TelemetryOperation = 'get' | 'insert' | 'put_patch' | 'delete' | 'edge_fn';

export interface TelemetryCounters {
  get: number;
  insert: number;
  put_patch: number;
  delete: number;
  edge_fn: number;
  errori: number;
}

export type TelemetryFlushHandler = (batch: TelemetryCounters) => Promise<void>;

export interface TelemetryCollectorOptions {
  flushIntervalMs?: number;
  onFlush?: TelemetryFlushHandler;
  autoStart?: boolean;
}

const DEFAULT_FLUSH_INTERVAL_MS = 60_000;
const TELEMETRY_RPC_PATH = '/rest/v1/rpc/registra_telemetria_batch';

function emptyCounters(): TelemetryCounters {
  return {
    get: 0,
    insert: 0,
    put_patch: 0,
    delete: 0,
    edge_fn: 0,
    errori: 0,
  };
}

/**
 * Classifica una chiamata HTTP verso Supabase in base a URL e metodo.
 * Restituisce `null` per richieste non rilevanti (auth, storage o la RPC stessa di telemetria).
 */
export function classificaRichiestaSupabase(
  url: string,
  method = 'GET',
): TelemetryOperation | null {
  if (!url) return null;
  const normalizedUrl = url.toLowerCase();

  // Esclusione anti-loop sulla RPC di telemetria
  if (normalizedUrl.includes(TELEMETRY_RPC_PATH)) {
    return null;
  }

  const normalizedMethod = method.toUpperCase();

  if (normalizedUrl.includes('/functions/v1/')) {
    return 'edge_fn';
  }

  if (normalizedUrl.includes('/rest/v1/')) {
    if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return 'get';
    if (normalizedMethod === 'POST') return 'insert';
    if (normalizedMethod === 'PATCH' || normalizedMethod === 'PUT') return 'put_patch';
    if (normalizedMethod === 'DELETE') return 'delete';
  }

  return null;
}

export class TelemetryCollector {
  private counters: TelemetryCounters = emptyCounters();
  private readonly flushIntervalMs: number;
  private onFlush?: TelemetryFlushHandler;
  private timer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private flushing = false;

  constructor(options?: TelemetryCollectorOptions) {
    this.flushIntervalMs = options?.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.onFlush = options?.onFlush;
    if (options?.autoStart !== false) {
      this.start();
    }
  }

  setFlushHandler(handler: TelemetryFlushHandler): void {
    this.onFlush = handler;
  }

  record(op: TelemetryOperation, isError = false): void {
    this.counters[op] += 1;
    if (isError) {
      this.counters.errori += 1;
    }
  }

  recordErrorOnly(): void {
    this.counters.errori += 1;
  }

  getSnapshot(): TelemetryCounters {
    return { ...this.counters };
  }

  hasPending(): boolean {
    const c = this.counters;
    return (
      c.get > 0 ||
      c.insert > 0 ||
      c.put_patch > 0 ||
      c.delete > 0 ||
      c.edge_fn > 0 ||
      c.errori > 0
    );
  }

  snapshotAndReset(): TelemetryCounters | null {
    if (!this.hasPending()) return null;
    const snap = { ...this.counters };
    this.counters = emptyCounters();
    return snap;
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.onFlush) return;
    const batch = this.snapshotAndReset();
    if (!batch) return;

    this.flushing = true;
    try {
      await this.onFlush(batch);
    } catch {
      // Telemetria best-effort: non deve mai propagare errori all'app.
    } finally {
      this.flushing = false;
    }
  }

  start(): void {
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.flushIntervalMs);
      // Evita che il timer mantenga vivo un processo Node durante script/test.
      const maybeTimer = this.timer as unknown as { unref?: () => void };
      maybeTimer.unref?.();
    }

    if (
      !this.visibilityHandler &&
      typeof document !== 'undefined' &&
      typeof document.addEventListener === 'function'
    ) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
          void this.flush();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (
      this.visibilityHandler &&
      typeof document !== 'undefined' &&
      typeof document.removeEventListener === 'function'
    ) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}

function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.toString();
  if (typeof input === 'object' && input !== null && 'url' in input) {
    return String((input as Request).url);
  }
  return '';
}

function extractMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method;
  if (typeof input === 'object' && input !== null && 'method' in input) {
    return String((input as Request).method || 'GET');
  }
  return 'GET';
}

/**
 * Crea un wrapper `fetch` leggero che intercetta le chiamate verso Supabase
 * senza alterarne la latenza o il risultato.
 */
export function createTelemetryFetch(
  collector: TelemetryCollector,
  baseFetch: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = extractUrl(input);
    const method = extractMethod(input, init);
    const op = classificaRichiestaSupabase(url, method);

    try {
      const response = await baseFetch(input, init);
      if (op) {
        collector.record(op, response.status >= 400);
      }
      return response;
    } catch (error) {
      if (op) {
        collector.record(op, true);
      }
      throw error;
    }
  };
}
