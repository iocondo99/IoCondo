// Autenticazione condivisa: validazione JWT utente e client Supabase (utente vs service_role).
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

// deno-lint-ignore no-explicit-any
export type Db = SupabaseClient<any, 'public', any>;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function bearer(req: Request): string {
  const h = req.headers.get('Authorization') ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new HttpError(401, 'Token mancante');
  return m[1]!;
}

/** Client con privilegi totali (bypassa la RLS). Usare solo dopo aver autorizzato il chiamante. */
export function adminClient(): Db {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/**
 * Valida il JWT dell'utente e restituisce un client che agisce COME l'utente:
 * la RLS resta attiva, quindi le scritture sono limitate ai suoi permessi.
 */
export async function requireUser(req: Request): Promise<{ user: User; db: Db }> {
  const token = bearer(req);
  const db: Db = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Token non valido o scaduto');
  return { user: data.user, db };
}

/** Confronto a tempo costante. */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i]! ^ eb[i]!;
  return diff === 0;
}

/** Per chiamate server-to-server (Database Webhooks, cron): il bearer deve essere la service_role key. */
export function requireServiceCaller(req: Request): void {
  if (!safeEqual(bearer(req), SERVICE_ROLE_KEY)) throw new HttpError(401, 'Chiamante non autorizzato');
}
