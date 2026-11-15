import { invokeFunction, type TypedSupabaseClient } from '@iocondo/supabase-client';

export interface InviaEmailInput {
  /** Indirizzo del destinatario. */
  to: string;
  /** Oggetto dell'email. */
  subject: string;
  /** Corpo HTML (opzionale se e' presente `text`). */
  html?: string;
  /** Corpo testo semplice (opzionale se e' presente `html`). */
  text?: string;
}

/**
 * Invio di email applicative (transazionali) tramite la Edge Function `invia-email`,
 * che a sua volta invia via SMTP Gmail. Le credenziali Gmail e il mittente vivono solo
 * lato server (secret della funzione): qui si passano solo destinatario, oggetto e contenuto.
 */
export function createEmailService(db: TypedSupabaseClient) {
  return {
    /** Invia una singola email tramite la Edge Function `invia-email`. */
    async invia(input: InviaEmailInput): Promise<{ ok: true }> {
      return invokeFunction<{ ok: true }>(db, 'invia-email', {
        to: input.to.trim().toLowerCase(),
        subject: input.subject.trim(),
        ...(input.html ? { html: input.html } : {}),
        ...(input.text ? { text: input.text } : {}),
      });
    },
  };
}

export type EmailService = ReturnType<typeof createEmailService>;
