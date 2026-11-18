// POST /functions/v1/elimina-account
// L'utente collegato elimina il PROPRIO account (diritto alla cancellazione, GDPR art. 17).
// Si cancellano accesso e profilo personale; i dati del condominio restano senza collegamento
// all'account (vedi supabase/da-applicare/18_elimina_account.sql).
//
// Sicurezza:
//   - l'utente e' preso dal JWT, mai dal corpo della richiesta: nessuno puo' eliminare un altro account;
//   - chi puo' farlo lo decide il database (puo_eliminare_account): super amministratori e
//     amministratori sono esclusi;
//   - serve la conferma esplicita "ELIMINA" nel corpo della richiesta;
//   - nessun dato personale nei log.
import { HttpError, json, serve } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';

const MESSAGGI: Record<string, string> = {
  SUPERADMIN: 'Il super amministratore non può eliminare il proprio account da qui.',
  AMMINISTRATORE: 'Gli amministratori non possono eliminare il proprio account dall’app. Contatta il supporto.',
  NON_AUTENTICATO: 'Sessione non valida. Accedi di nuovo.',
};

serve(async (req) => {
  const corpo = (await req.json().catch(() => ({}))) as { conferma?: unknown };
  if (corpo?.conferma !== 'ELIMINA') {
    throw new HttpError(400, 'Conferma mancante: scrivi ELIMINA per procedere.');
  }

  const { user } = await requireUser(req);
  const admin = adminClient();

  // 1. Controlli e preparazione nel database (storico unita', email in coda, inviti, audit).
  const { data: stato, error: erroreDb } = await admin.rpc('prepara_eliminazione_account', { p_uid: user.id });
  if (erroreDb) {
    console.error('prepara_eliminazione_account non riuscita', erroreDb.code ?? 'sconosciuto');
    throw new HttpError(500, 'Non è stato possibile eliminare l’account. Riprova più tardi.');
  }
  if (stato !== 'OK') {
    throw new HttpError(403, MESSAGGI[String(stato)] ?? 'Questo account non può essere eliminato da qui.');
  }

  // 2. Avatar: tutti i file nella cartella dell'utente (best effort, non blocca l'eliminazione).
  try {
    const { data: files } = await admin.storage.from('avatar-utenti').list(user.id, { limit: 100 });
    const percorsi = (files ?? []).map((f) => `${user.id}/${f.name}`);
    if (percorsi.length > 0) await admin.storage.from('avatar-utenti').remove(percorsi);
  } catch {
    console.error('rimozione avatar non riuscita');
  }

  // 3. Account: la rimozione da auth.users cancella il profilo e applica le regole del database
  //    (dati personali cancellati, dati del condominio conservati senza collegamento).
  const { error: erroreAuth } = await admin.auth.admin.deleteUser(user.id);
  if (erroreAuth) {
    console.error('deleteUser non riuscita', (erroreAuth as { status?: number }).status ?? 'sconosciuto');
    throw new HttpError(500, 'Non è stato possibile eliminare l’account. Riprova più tardi.');
  }

  return json({ ok: true });
});
