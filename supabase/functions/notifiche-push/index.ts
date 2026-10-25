// POST /functions/v1/notifiche-push
// Pensata come Database Webhook su INSERT di public.bacheca_post
// (Dashboard -> Database -> Webhooks -> Supabase Edge Functions; il bearer e' la service_role key).
// Per ogni destinatario: riga in `notifiche` (inbox in-app) + push Expo ai dispositivi registrati.
import { chunk, HttpError, json, serve } from '../_shared/http.ts';
import { adminClient, requireServiceCaller } from '../_shared/auth.ts';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema?: string;
  record: {
    id: string;
    condominio_id: string;
    palazzo_id: string | null;
    autore_id: string | null;
    titolo: string;
    corpo: string | null;
  } | null;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  requireServiceCaller(req);
  const payload = (await req.json().catch(() => null)) as WebhookPayload | null;
  if (!payload) throw new HttpError(400, 'Payload non valido');
  if (payload.type !== 'INSERT' || payload.table !== 'bacheca_post' || !payload.record) {
    return json({ ignored: true });
  }
  const post = payload.record;
  const db = adminClient();

  // Feature toggle (UC-05): override del palazzo, altrimenti default del condominio
  const { data: cfgs } = await db
    .from('configurazioni_condominio')
    .select('palazzo_id, abilita_bacheca')
    .eq('condominio_id', post.condominio_id);
  const cfg =
    (cfgs ?? []).find((c) => post.palazzo_id && c.palazzo_id === post.palazzo_id) ??
    (cfgs ?? []).find((c) => c.palazzo_id === null);
  if (cfg && cfg.abilita_bacheca === false) return json({ skipped: 'bacheca disabilitata' });

  // --- Destinatari: ruoli sul condominio + ruoli/anagrafiche sulle unita' (eventualmente del solo palazzo) ---
  const recipients = new Set<string>();

  const { data: condRoles } = await db
    .from('utente_entita_ruolo').select('utente_id').eq('condominio_id', post.condominio_id);
  (condRoles ?? []).forEach((r) => recipients.add(r.utente_id));

  let palQuery = db.from('palazzi').select('id').eq('condominio_id', post.condominio_id);
  if (post.palazzo_id) palQuery = palQuery.eq('id', post.palazzo_id);
  const { data: palazzi } = await palQuery;
  const palazziIds = (palazzi ?? []).map((p) => p.id);

  if (palazziIds.length) {
    const { data: unita } = await db.from('unita_immobiliari').select('id').in('palazzo_id', palazziIds);
    const unitaIds = (unita ?? []).map((u) => u.id);
    const oggi = new Date().toISOString().slice(0, 10);
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
  if (post.autore_id) recipients.delete(post.autore_id);
  const userIds = [...recipients];
  if (userIds.length === 0) return json({ destinatari: 0, push_inviate: 0 });

  // --- Inbox in-app ---
  const corpo = (post.corpo ?? '').slice(0, 200);
  for (const rows of chunk(
    userIds.map((utente_id) => ({
      utente_id,
      condominio_id: post.condominio_id,
      titolo: post.titolo,
      corpo,
      tipo: 'BACHECA',
      riferimento_tabella: 'bacheca_post',
      riferimento_id: post.id,
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
          title: post.titolo,
          body: corpo || 'Nuovo avviso in bacheca',
          sound: 'default',
          data: { tipo: 'BACHECA', post_id: post.id, condominio_id: post.condominio_id },
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
  if (invalidi.length) await db.from('dispositivi_push').delete().in('token', invalidi); // pulizia token morti

  return json({ destinatari: userIds.length, push_inviate: inviate, token_rimossi: invalidi.length });
});
