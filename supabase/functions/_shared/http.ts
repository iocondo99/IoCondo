// Utility condivise da tutte le Edge Functions: CORS restrittivo per origin + risposte JSON + errori HTTP.

const DEFAULT_ALLOWED_ORIGINS = [
  'https://app.iocondo.it',
  'https://iocondo.it',
];

function allowedOrigins(): string[] {
  const configured = [
    Deno.env.get('APP_URL') ?? '',
    ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(','),
  ]
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
}

function isOriginConsentita(origin: string): boolean {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }
  const normalizzata = origin.replace(/\/$/, '');
  return allowedOrigins().includes(normalizzata);
}

export function corsHeadersFor(req?: Request): Record<string, string> {
  const reqOrigin = req?.headers.get('Origin')?.trim() ?? '';
  const originHeader = reqOrigin && isOriginConsentita(reqOrigin)
    ? reqOrigin
    : (Deno.env.get('APP_URL')?.trim().replace(/\/$/, '') || 'https://app.iocondo.it');

  return {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export const corsHeaders: Record<string, string> = corsHeadersFor();

/** Risposta al preflight CORS; ritorna null se la richiesta non e' OPTIONS. */
export function handleOptions(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeadersFor(req) }) : null;
}

export function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
  });
}

function withCors(res: Response, req: Request): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeadersFor(req);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Errore con status HTTP, convertito in risposta dal wrapper `serve`. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Nome della funzione dall'URL (es. /functions/v1/accoda-email -> accoda-email). */
function nomeFunzione(req: Request): string {
  try {
    const parti = new URL(req.url).pathname.split('/').filter(Boolean);
    return parti[parti.length - 1] ?? 'sconosciuta';
  } catch {
    return 'sconosciuta';
  }
}

/** Id dell'utente dal token, senza verificarlo: serve solo a collegare il log, non ad autorizzare. */
function utenteDalToken(req: Request): string | null {
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.sub === 'string' && /^[0-9a-f-]{36}$/i.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Prima parte dell'indirizzo del client (dietro il proxy di Supabase). */
function ipChiamante(req: Request): string | null {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  return ip || null;
}

/**
 * Registrazione nei log del database (errori tecnici e accessi negati). Mai bloccante:
 * se il log non riesce, la risposta all'utente non cambia. Import dinamico per non creare
 * dipendenze circolari con auth.ts.
 */
async function registraLog(req: Request, status: number, messaggio: string, codice?: string): Promise<void> {
  try {
    const { adminClient } = await import('./auth.ts');
    const db = adminClient();
    const funzione = nomeFunzione(req);
    const utente = utenteDalToken(req);
    if (status === 403) {
      await db.rpc('registra_evento_sicurezza', {
        p_evento: 'ACCESSO_NEGATO',
        p_esito: 'NEGATO',
        p_utente: utente,
        p_ip: ipChiamante(req),
        p_dettagli: { funzione, messaggio: messaggio.slice(0, 200) },
      });
    } else if (status >= 500) {
      await db.rpc('registra_errore_server', {
        p_contesto: funzione,
        p_messaggio: messaggio.slice(0, 1000),
        p_codice: codice ?? String(status),
        p_utente: utente,
      });
    }
  } catch {
    // Il log non deve mai interferire con la risposta.
  }
}

/** Wrapper comune: gestisce OPTIONS, solo POST, e trasforma le eccezioni in JSON. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    const pre = handleOptions(req);
    if (pre) return pre;
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Metodo non consentito');
      const res = await handler(req);
      return withCors(res, req);
    } catch (e) {
      if (e instanceof HttpError) {
        const dettaglioInterno = e.details ? `${e.message} [${String(e.details).slice(0, 300)}]` : e.message;
        if (e.status >= 500 && e.details) {
          console.error(`HttpError ${e.status}:`, dettaglioInterno);
        }
        if (e.status === 403 || e.status >= 500) await registraLog(req, e.status, dettaglioInterno);
        // Non esporre mai `details` tecnici Postgres/stack al client.
        return json({ error: e.message }, e.status, req);
      }
      const testo = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error('Errore non gestito:', testo);
      await registraLog(req, 500, testo, 'NON_GESTITO');
      return json({ error: 'Errore interno del server' }, 500, req);
    }
  });
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
