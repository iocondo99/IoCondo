// Utility condivise da tutte le Edge Functions: CORS standard Supabase + risposte JSON + errori HTTP.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Risposta al preflight CORS; ritorna null se la richiesta non e' OPTIONS. */
export function handleOptions(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.status === 403 || e.status >= 500) await registraLog(req, e.status, e.message);
        return json({ error: e.message, details: e.details ?? null }, e.status);
      }
      const testo = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error('Errore non gestito:', testo);
      await registraLog(req, 500, testo, 'NON_GESTITO');
      return json({ error: 'Errore interno del server' }, 500);
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
