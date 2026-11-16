// POST /functions/v1/invia-email
// Invio di una email applicativa (transazionale) tramite SMTP di Gmail (smtp.gmail.com).
//
// Sicurezza (coerente con AGENTS.md):
// - verify_jwt = true in config.toml: serve il token di un utente collegato.
// - requireUser valida il JWT: solo un utente autenticato puo' invocare la funzione.
// - Le credenziali Gmail vivono SOLO come secret della funzione, mai nel client ne' in git:
//     GMAIL_USER      -> indirizzo dell'account Gmail dedicato (es. iocondo.noreply@gmail.com)
//     GMAIL_APP_PASSWORD -> App Password (16 caratteri) generata da Google con 2FA attiva
//     EMAIL_FROM      -> (opzionale) mittente mostrato, es. "IoCondo <iocondo.noreply@gmail.com>".
//                        Se assente, si usa GMAIL_USER.
// - Nessun dato personale nei log (ne' destinatario ne' corpo) e nessun dettaglio tecnico nelle risposte.
//
// L'invio SMTP vero e proprio e' centralizzato in `_shared/email.ts` (`inviaViaGmail`),
// lo stesso canale usato dal worker della coda email: un solo punto che parla con Gmail.
import { HttpError, json, serve } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { inviaViaGmail, leggiCredenzialiGmail } from '../_shared/email.ts';

interface InviaEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parse(body: unknown): InviaEmailInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const to = typeof b.to === 'string' ? b.to.trim().toLowerCase() : '';
  if (to.length > 254 || !EMAIL.test(to)) throw new HttpError(400, 'L\'indirizzo email del destinatario non e\' valido.');
  const subject = typeof b.subject === 'string' ? b.subject.trim() : '';
  if (!subject || subject.length > 200) throw new HttpError(400, 'L\'oggetto dell\'email non e\' valido.');
  const html = typeof b.html === 'string' ? b.html : undefined;
  const text = typeof b.text === 'string' ? b.text : undefined;
  if (!html && !text) throw new HttpError(400, 'Il contenuto dell\'email e\' obbligatorio.');
  return { to, subject, html, text };
}

serve(async (req) => {
  const input = parse(await req.json().catch(() => null));

  // Autorizzazione: deve esserci un utente autenticato (la RLS resta attiva sul suo client).
  await requireUser(req);

  // Credenziali Gmail dai secret (helper condiviso con la coda email).
  let gmail: ReturnType<typeof leggiCredenzialiGmail>;
  try {
    gmail = leggiCredenzialiGmail();
  } catch {
    throw new HttpError(500, 'Servizio email non configurato. Riprova piu\' tardi.');
  }

  try {
    await inviaViaGmail(
      { to: input.to, subject: input.subject, html: input.html, text: input.text },
      gmail,
    );
  } catch (e) {
    // Non propaghiamo dettagli tecnici (ne' credenziali ne' SMTP) al client.
    console.error('Invio SMTP Gmail non riuscito:', e instanceof Error ? e.message : 'errore sconosciuto');
    throw new HttpError(502, 'Non e\' stato possibile inviare l\'email. Riprova.');
  }

  return json({ ok: true });
});
