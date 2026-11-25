// POST /functions/v1/invia-coda-email
// Worker batch per l'invio delle email accodate in `public.coda_email` tramite SMTP Gmail.
// Protetto con service_role (cron / webhook / accoda-email) oppure admin del condominio (azioni manuali UI).
import { HttpError, isUuid, json, serve } from '../_shared/http.ts';
import { adminClient, isServiceCaller, requireUser } from '../_shared/auth.ts';
import { calcolaProssimoTentativoIso, inviaViaGmail, leggiCredenzialiGmail } from '../_shared/email.ts';

interface InviaCodaPayload {
  condominio_id?: string;
  limit?: number;
  action?: 'process' | 'retry_failed';
}

interface RigaCodaRow {
  id: string;
  condominio_id: string;
  destinatario_email: string;
  idempotency_key: string;
  from_email: string;
  reply_to_email: string | null;
  oggetto: string;
  html_body: string;
  text_body: string;
  tentativi: number;
  max_tentativi: number;
}

const RATE_LIMIT_DELAY_MS = 550;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  const payload = ((await req.json().catch(() => ({}))) ?? {}) as InviaCodaPayload;

  const db = adminClient();
  const callerService = isServiceCaller(req);
  const scopedCondominioId = isUuid(payload.condominio_id) ? payload.condominio_id : null;

  if (!callerService) {
    if (!scopedCondominioId) {
      throw new HttpError(401, 'Chiamante non autorizzato');
    }
    const { db: userDb } = await requireUser(req);
    const { data: isAdmin } = await userDb.rpc('is_admin_of', { p_cond: scopedCondominioId });
    if (isAdmin !== true) {
      throw new HttpError(403, 'Permesso negato: richiesto ruolo Amministratore');
    }
  }

  // Verifica anticipata delle credenziali Gmail: se mancano, niente batch.
  let gmail: ReturnType<typeof leggiCredenzialiGmail>;
  try {
    gmail = leggiCredenzialiGmail();
  } catch {
    throw new HttpError(500, 'Configurazione email (Gmail) incompleta lato server');
  }

  if (payload.action === 'retry_failed') {
    if (!scopedCondominioId) {
      throw new HttpError(400, 'condominio_id obbligatorio per riprova fallite');
    }
    const { error: resetErr } = await db
      .from('coda_email')
      .update({
        stato: 'PENDING',
        tentativi: 0,
        prossimo_tentativo_at: new Date().toISOString(),
        ultimo_errore: null,
        updated_at: new Date().toISOString(),
      })
      .eq('condominio_id', scopedCondominioId)
      .eq('stato', 'FAILED');

    if (resetErr) {
      console.error('Errore ripristino email fallite:', resetErr.message);
      throw new HttpError(500, 'Errore ripristino email fallite');
    }
  }

  const requestedLimit = typeof payload.limit === 'number' && Number.isFinite(payload.limit) ? payload.limit : 25;
  const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 25);

  let { data: claimedRows, error: claimErr } = await db.rpc('claim_coda_email_batch', {
    p_limit: limit,
    p_condominio_id: scopedCondominioId,
  });

  // Fallback solo prima dell'applicazione SQL della firma a 2 argomenti su Postgres remoto.
  if (claimErr && /claim_coda_email_batch/i.test(claimErr.message ?? '') && !callerService) {
    throw new HttpError(503, 'Aggiornamento schema coda email richiesto sul database');
  }

  if (claimErr) {
    console.error('Errore prelievo batch coda email:', claimErr.message);
    throw new HttpError(500, 'Errore prelievo batch coda email');
  }

  const rows = ((claimedRows ?? []) as RigaCodaRow[]).filter(
    (r) => !scopedCondominioId || r.condominio_id === scopedCondominioId,
  );
  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);

    try {
      // Invio tramite SMTP Gmail (stesso canale della email di prova).
      await inviaViaGmail(
        {
          from: row.from_email,
          to: row.destinatario_email,
          subject: row.oggetto,
          html: row.html_body,
          text: row.text_body,
          replyTo: row.reply_to_email,
        },
        gmail,
      );

      await db
        .from('coda_email')
        .update({
          stato: 'SENT',
          // SMTP non restituisce un id messaggio del provider.
          provider_message_id: null,
          inviata_at: new Date().toISOString(),
          ultimo_errore: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      sent++;
      continue;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 500) : 'Errore di rete';
      const nextAttempt = (row.tentativi ?? 0) + 1;
      const exhausted = nextAttempt >= (row.max_tentativi ?? 5);

      await db
        .from('coda_email')
        .update({
          stato: exhausted ? 'FAILED' : 'PENDING',
          tentativi: nextAttempt,
          prossimo_tentativo_at: exhausted
            ? new Date().toISOString()
            : calcolaProssimoTentativoIso(nextAttempt),
          ultimo_errore: msg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (exhausted) failed++;
      else retried++;
    }
  }

  return json({
    claimed: rows.length,
    sent,
    retried,
    failed,
  });
});
