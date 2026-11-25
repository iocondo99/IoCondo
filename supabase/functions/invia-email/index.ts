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
import { HttpError, isUuid, json, serve } from '../_shared/http.ts';
import { adminClient, isServiceCaller, requireUser, type Db } from '../_shared/auth.ts';
import { inviaViaGmail, isEmailValida, leggiCredenzialiGmail, stripHeaderControl } from '../_shared/email.ts';

interface InviaEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  condominio_id?: string;
}

const MAX_HTML_LEN = 200_000;
const MAX_TEXT_LEN = 100_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQ = 10;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(chiave: string): void {
  const now = Date.now();
  const entry = rateBuckets.get(chiave);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(chiave, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_REQ) {
    throw new HttpError(429, 'Troppi invii ravvicinati. Riprova tra un minuto.');
  }
}

function parse(body: unknown): InviaEmailInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const rawTo = typeof b.to === 'string' ? b.to : '';
  if (/[\r\n\0]/.test(rawTo)) throw new HttpError(400, 'L\'indirizzo email del destinatario non e\' valido.');
  const to = rawTo.trim().toLowerCase();
  if (!isEmailValida(to)) throw new HttpError(400, 'L\'indirizzo email del destinatario non e\' valido.');

  const rawSubject = typeof b.subject === 'string' ? b.subject : '';
  if (/[\r\n\0]/.test(rawSubject)) {
    throw new HttpError(400, 'L\'oggetto dell\'email contiene caratteri non consentiti.');
  }
  const subject = stripHeaderControl(rawSubject);
  if (!subject || subject.length > 200) throw new HttpError(400, 'L\'oggetto dell\'email non e\' valido.');

  const html = typeof b.html === 'string' ? b.html : undefined;
  const text = typeof b.text === 'string' ? b.text : undefined;
  if (!html && !text) throw new HttpError(400, 'Il contenuto dell\'email e\' obbligatorio.');
  if (html && html.length > MAX_HTML_LEN) throw new HttpError(400, 'Contenuto HTML troppo esteso.');
  if (text && text.length > MAX_TEXT_LEN) throw new HttpError(400, 'Contenuto testo troppo esteso.');

  const condominio_id = typeof b.condominio_id === 'string' ? b.condominio_id.trim() : undefined;
  if (condominio_id !== undefined && !isUuid(condominio_id)) {
    throw new HttpError(400, 'condominio_id non valido.');
  }

  return { to, subject, html, text, condominio_id };
}

async function verificaPermessoAdminOSuperadmin(userDb: Db, userId: string, condominioId?: string): Promise<void> {
  if (condominioId) {
    const { data: isAdmin } = await userDb.rpc('is_admin_of', { p_cond: condominioId });
    if (isAdmin !== true) {
      throw new HttpError(403, 'Permesso negato: richiesto ruolo Amministratore sul condominio');
    }
    return;
  }

  const { data: isAnyAdmin, error: rpcErr } = await userDb.rpc('is_active_admin_any');
  if (!rpcErr) {
    if (isAnyAdmin === true) return;
    throw new HttpError(403, 'Permesso negato: invio riservato ad Amministratori attivi o Super Admin');
  }

  // Fallback prima che 21_fix_sicurezza.sql sia applicata: verifica solo tramite service_role
  const adminDb = adminClient();
  const [{ data: u }, { data: cond }, { data: ruoloAdmin }] = await Promise.all([
    adminDb.from('utenti').select('is_superadmin').eq('id', userId).maybeSingle(),
    adminDb.from('condomini').select('id').eq('admin_id', userId).eq('attivo', true).limit(1).maybeSingle(),
    adminDb
      .from('utente_entita_ruolo')
      .select('id, ruoli_piattaforma!inner(codice), condomini!inner(attivo)')
      .eq('utente_id', userId)
      .eq('ruoli_piattaforma.codice', 'ADMIN')
      .eq('condomini.attivo', true)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!u?.is_superadmin && !cond?.id && !ruoloAdmin?.id) {
    throw new HttpError(403, 'Permesso negato: invio riservato ad Amministratori o Super Admin');
  }
}

serve(async (req) => {
  const input = parse(await req.json().catch(() => null));

  // Autorizzazione rigorosa: solo service_role, Super Admin o Admin di almeno un condominio attivo.
  if (!isServiceCaller(req)) {
    const { user, db: userDb } = await requireUser(req);
    await verificaPermessoAdminOSuperadmin(userDb, user.id, input.condominio_id);
    checkRateLimit(user.id);
  }

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
