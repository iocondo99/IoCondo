import { ServiceError } from './errors';
import type { TypedSupabaseClient } from './index';

/** Id dell'utente autenticato (lancia se non c'e' sessione). */
export async function getCurrentUserId(db: TypedSupabaseClient): Promise<string> {
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ServiceError('Utente non autenticato', '401');
  return data.user.id;
}

/** Invoca una Edge Function propagando il messaggio d'errore JSON restituito dalla funzione. */
export async function invokeFunction<TOut, TBody extends Record<string, unknown> = Record<string, unknown>>(
  db: TypedSupabaseClient,
  name: string,
  body: TBody,
): Promise<TOut> {
  const { data, error } = await db.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: unknown }).context;
    if (typeof Response !== 'undefined' && ctx instanceof Response) {
      try {
        const parsed = (await ctx.json()) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        /* corpo non JSON: si tiene il messaggio di default */
      }
    }
    throw new ServiceError(message, String((ctx as Response | undefined)?.status ?? ''));
  }
  return data as TOut;
}
