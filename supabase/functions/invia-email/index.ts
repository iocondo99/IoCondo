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
// NOTA TECNICA: SMTP richiede una connessione TCP, che su Deno/Edge Functions puo' essere
// instabile. Se gli invii falliscono in modo sistematico, valutare il passaggio alla Gmail API
// (HTTP/OAuth2) o a un provider transazionale via HTTP.
//
// Nota funzionale: come primo passo la funzione invia a un singolo destinatario passato dal client.
// In seguito si potra' aggiungere la risoluzione destinatari per condominio/palazzo/unita'
// (stessa logica di notifiche-push) e un controllo di ruolo (is_admin_of / has_role_in).
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';

interface InviaEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Credenziali e mittente Gmail dai secret. Senza di essi la funzione non parte. */
function gmailConfig(): { user: string; password: string; from: string } {
  const user = (Deno.env.get('GMAIL_USER') ?? '').trim();
  const password = (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').trim();
  if (!user || !password) {
    console.error('GMAIL_USER o GMAIL_APP_PASSWORD mancanti');
    throw new HttpError(500, 'Servizio email non configurato. Riprova piu\' tardi.');
  }
  const from = (Deno.env.get('EMAIL_FROM') ?? '').trim() || user;
  return { user, password, from };
}

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

  const cfg = gmailConfig();

  // Connessione SMTP TLS a Gmail (porta 465). denomailer apre e chiude la connessione per invocazione.
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: cfg.user, password: cfg.password },
    },
  });

  try {
    await client.send({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      // denomailer: 'content' per il testo, 'html' per la versione HTML.
      content: input.text ?? 'Questa email richiede un client che supporti l\'HTML.',
      ...(input.html ? { html: input.html } : {}),
    });
  } catch (e) {
    // Non propaghiamo dettagli tecnici (ne' credenziali ne' SMTP) al client.
    console.error('Invio SMTP Gmail non riuscito:', e instanceof Error ? e.message : 'errore sconosciuto');
    throw new HttpError(502, 'Non e\' stato possibile inviare l\'email. Riprova.');
  } finally {
    try {
      await client.close();
    } catch {
      /* chiusura best-effort */
    }
  }

  return json({ ok: true });
});
