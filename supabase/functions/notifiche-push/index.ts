// POST /functions/v1/notifiche-push
// Supporta due modalità operative:
// 1) Database Webhook su INSERT di public.bacheca_post (autenticato con service_role key).
// 2) Chiamata diretta da Portiere o Amministratore (es. sollecito ritiro pacco su unità specifica o avviso urgente).
import { chunk, HttpError, isUuid, json, serve } from '../_shared/http.ts';
import { adminClient, requireServiceCaller, requireUser } from '../_shared/auth.ts';

interface WebhookPayload {
  type?: 'INSERT' | 'UPDATE' | 'DELETE';
  table?: string;
  schema?: string;
  record?: {
    id: string;
    condominio_id: string;
    palazzo_id: string | null;
    autore_id: string | null;
    titolo: string;
    corpo: string | null;
  } | null;
  // Campi per invocazione diretta da app (Portiere / Admin)
  condominio_id?: string;
  unita_id?: string | null;
  titolo?: string;
  corpo?: string | null;
  tipo?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  const payload = (await req.json().catch(() => null)) as WebhookPayload | null;
  if (!payload) throw new HttpError(400, 'Payload non valido');

  const db = adminClient();

  let condominioId: string;
  let palazzoId: string | null = null;
  let unitaTargetId: string | null = null;
  let autoreId: string | null = null;
  let titolo: string;
  let corpo: string;
  let tipoNotifica = 'BACHECA';
  let rifTabella = 'bacheca_post';
  let rifId: string | null = null;

  // Modalità 1: Webhook Database su bacheca_post
  if (payload.type && payload.table) {
    requireServiceCaller(req);
    if (payload.type !== 'INSERT' || payload.table !== 'bacheca_post' || !payload.record) {
      return json({ ignored: true });
    }
    const post = payload.record;
    condominioId = post.condominio_id;
    palazzoId = post.palazzo_id;
    autoreId = post.autore_id;
    titolo = post.titolo;
    corpo = (post.corpo ?? '').slice(0, 200);
    rifId = post.id;

    // Feature toggle (UC-05): override del palazzo, altrimenti default del condominio
    const { data: cfgs } = await db
      .from('configurazioni_condominio')
      .select('palazzo_id, abilita_bacheca')
      .eq('condominio_id', condominioId);
    const cfg =
      (cfgs ?? []).find((c) => palazzoId && c.palazzo_id === palazzoId) ??
      (cfgs ?? []).find((c) => c.palazzo_id === null);
    if (cfg && cfg.abilita_bacheca === false) return json({ skipped: 'bacheca disabilitata' });
  } else {
    // Modalità 2: Invocazione diretta autenticata (Portiere / Admin per sollecito pacco o avviso)
    if (!isUuid(payload.condominio_id)) throw new HttpError(400, 'condominio_id non valido');
    if (typeof payload.titolo !== 'string' || !payload.titolo.trim()) {
      throw new HttpError(400, 'titolo obbligatorio');
    }
    const { user, db: userDb } = await requireUser(req);
    const { data: isAdmin } = await userDb.rpc('is_admin_of', { p_cond: payload.condominio_id });
    const { data: isPortiere } = await userDb.rpc('has_role_in', {
      p_cond: payload.condominio_id,
      p_codice: 'PORTIERE',
    });
    if (isAdmin !== true && isPortiere !== true) {
      throw new HttpError(403, 'Permesso negato: richiesto ruolo Amministratore o Portiere');
    }

    condominioId = payload.condominio_id;
    unitaTargetId = isUuid(payload.unita_id) ? payload.unita_id : null;
    autoreId = user.id;
    titolo = payload.titolo.trim();
    corpo = (payload.corpo ?? '').slice(0, 200);
    tipoNotifica = payload.tipo ?? 'PORTINERIA_PACCO';
    rifTabella = 'registro_pacchi';
  }

  // --- Risoluzione destinatari ---
  const recipients = new Set<string>();
  const oggi = new Date().toISOString().slice(0, 10);

  if (unitaTargetId) {
    // Notifica mirata ai residenti di una singola unità (es. sollecito ritiro pacco)
    const { data: unitRoles } = await db
      .from('utente_entita_ruolo')
      .select('utente_id')
      .eq('unita_id', unitaTargetId);
    (unitRoles ?? []).forEach((r) => recipients.add(r.utente_id));

    const { data: anag } = await db
      .from('anagrafiche_unita')
      .select('utente_id')
      .eq('unita_id', unitaTargetId)
      .or(`data_fine.is.null,data_fine.gte.${oggi}`);
    (anag ?? []).forEach((a) => recipients.add(a.utente_id));
  } else {
    const { data: condRoles } = await db
      .from('utente_entita_ruolo')
      .select('utente_id')
      .eq('condominio_id', condominioId);
    (condRoles ?? []).forEach((r) => recipients.add(r.utente_id));

    let palQuery = db.from('palazzi').select('id').eq('condominio_id', condominioId);
    if (palazzoId) palQuery = palQuery.eq('id', palazzoId);
    const { data: palazzi } = await palQuery;
    const palazziIds = (palazzi ?? []).map((p) => p.id);

    if (palazziIds.length) {
      const { data: unita } = await db.from('unita_immobiliari').select('id').in('palazzo_id', palazziIds);
      const unitaIds = (unita ?? []).map((u) => u.id);
      for (const ids of chunk(unitaIds, 150)) {
        const { data: unitRoles } = await db.from('utente_entita_ruolo').select('utente_id').in('unita_id', ids);
        (unitRoles ?? []).forEach((r) => recipients.add(r.utente_id));
        const { data: anag } = await db
          .from('anagrafiche_unita')
          .select('utente_id')
          .in('unita_id', ids)
          .or(`data_fine.is.null,data_fine.gte.${oggi}`);
        (anag ?? []).forEach((a) => recipients.add(a.utente_id));
      }
    }
  }

  if (autoreId) recipients.delete(autoreId);
  const userIds = [...recipients];
  if (userIds.length === 0) return json({ destinatari: 0, push_inviate: 0 });

  // --- Inbox in-app ---
  for (const rows of chunk(
    userIds.map((utente_id) => ({
      utente_id,
      condominio_id: condominioId,
      titolo,
      corpo,
      tipo: tipoNotifica,
      riferimento_tabella: rifTabella,
      riferimento_id: rifId,
    })),
    500,
  )) {
    const { error } = await db.from('notifiche').insert(rows);
    if (error) throw new HttpError(500, 'Errore salvataggio notifiche', error.message);
  }

  // --- Push Expo ---
  const tokens: string[] = [];
  for (const ids of chunk(userIds, 150)) {
    const { data } = await db.from('dispositivi_push').select('token').in('utente_id', ids);
    (data ?? []).forEach((d) => {
      if (/^Expo(nent)?PushToken\[/.test(d.token)) tokens.push(d.token);
    });
  }

  let inviate = 0;
  const invalidi: string[] = [];
  for (const batch of chunk(tokens, 100)) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        batch.map((to) => ({
          to,
          title: titolo,
          body: corpo || 'Nuovo avviso dal condominio',
          sound: 'default',
          data: { tipo: tipoNotifica, post_id: rifId, condominio_id: condominioId },
        })),
      ),
    });
    if (!res.ok) {
      console.error('Expo push HTTP', res.status, await res.text());
      continue;
    }
    const body = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    (body.data ?? []).forEach((t, i) => {
      if (t.status === 'ok') inviate++;
      else if (t.details?.error === 'DeviceNotRegistered') invalidi.push(batch[i]!);
    });
  }
  if (invalidi.length) await db.from('dispositivi_push').delete().in('token', invalidi);

  return json({ destinatari: userIds.length, push_inviate: inviate, token_rimossi: invalidi.length });
});
