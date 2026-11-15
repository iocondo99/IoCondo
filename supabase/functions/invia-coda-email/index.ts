// POST /functions/v1/invia-coda-email
// Worker batch per l'invio delle email accodate in `public.coda_email` tramite Resend.
// Protetto con service_role (cron / webhook / accoda-email) oppure admin del condominio (azioni manuali UI).
import { HttpError, isUuid, json, serve } from '../_shared/http.ts';
import { adminClient, isServiceCaller, requireUser } from '../_shared/auth.ts';
import { calcolaProssimoTentativoIso } from '../_shared/email.ts';

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

const RESEND_API_URL = 'https://api.resend.com/emails';
const RATE_LIMIT_DELAY_MS = 550;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  const payload = ((await req.json().catch(() => ({}))) ?? {}) as InviaCodaPayload;

  if (!isServiceCaller(req)) {
    if (!isUuid(payload.condominio_id)) {
      throw new HttpError(401, 'Chiamante non autorizzato');
    }
    const { db: userDb } = await requireUser(req);
    const { data: isAdmin } = await userDb.rpc('is_admin_of', { p_cond: payload.condominio_id });
    if (isAdmin !== true) {
      throw new HttpError(403, 'Permesso negato: richiesto ruolo Amministratore');
    }
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    throw new HttpError(500, 'Configurazione Resend incompleta lato server');
  }

  const db = adminClient();

  if (payload.action === 'retry_failed') {
    if (!isUuid(payload.condominio_id)) {
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
      .eq('condominio_id', payload.condominio_id)
      .eq('stato', 'FAILED');

    if (resetErr) {
      throw new HttpError(500, 'Errore ripristino email fallite', resetErr.message);
    }
  }

  const requestedLimit = typeof payload.limit === 'number' ? payload.limit : 25;
  const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 25);

  const { data: claimedRows, error: claimErr } = await db.rpc('claim_coda_email_batch', {
    p_limit: limit,
  });

  if (claimErr) {
    throw new HttpError(500, 'Errore prelievo batch coda email', claimErr.message);
  }

  const rows = (claimedRows ?? []) as RigaCodaRow[];
  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);

    try {
      const resendBody: Record<string, unknown> = {
        from: row.from_email,
        to: [row.destinatario_email],
        subject: row.oggetto,
        html: row.html_body,
        text: row.text_body,
      };
      if (row.reply_to_email) {
        resendBody.reply_to = row.reply_to_email;
      }

      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': row.idempotency_key,
        },
        body: JSON.stringify(resendBody),
      });

      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        await db
          .from('coda_email')
          .update({
            stato: 'SENT',
            provider_message_id: body.id ?? null,
            inviata_at: new Date().toISOString(),
            ultimo_errore: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        sent++;
        continue;
      }

      const errText = (await res.text().catch(() => '')).slice(0, 500);
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
          ultimo_errore: `HTTP ${res.status}${errText ? `: ${errText}` : ''}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (exhausted) failed++;
      else retried++;
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
