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

/** Wrapper comune: gestisce OPTIONS, solo POST, e trasforma le eccezioni in JSON. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    const pre = handleOptions(req);
    if (pre) return pre;
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Metodo non consentito');
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, details: e.details ?? null }, e.status);
      console.error('Errore non gestito:', e);
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
