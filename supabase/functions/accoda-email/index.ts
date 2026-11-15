// POST /functions/v1/accoda-email
// Accoda email in `public.coda_email` per i flussi:
//   - BOLLETTINO_EMESSO
//   - CONVOCAZIONE_ASSEMBLEA
//   - COMUNICAZIONE_IMPORTANTE
// Ricava automaticamente mittente e Reply-To dall'account dell'amministratore del condominio.
import { chunk, HttpError, isUuid, json, serve } from '../_shared/http.ts';
import { adminClient, isServiceCaller, requireUser, type Db } from '../_shared/auth.ts';
import {
  costruisciIdempotencyKey,
  costruisciMittenteAmministratore,
  generaTemplateBollettinoEmesso,
  generaTemplateComunicazioneImportante,
  generaTemplateConvocazioneAssemblea,
  isEmailValida,
  type MittenteAmministratore,
  type TipoEventoEmail,
} from '../_shared/email.ts';

interface AccodaEmailPayload {
  condominio_id?: string;
  tipo_evento?: TipoEventoEmail;
  riferimento_id?: string;
  riferimento_ids?: string[];
  seconda_convocazione?: string | null;
}

interface DestinatarioRisolto {
  utenteId: string | null;
  email: string;
  nome: string | null;
}

interface RigaCodaInsert {
  condominio_id: string;
  amministratore_id: string | null;
  destinatario_utente_id: string | null;
  destinatario_email: string;
  destinatario_nome: string | null;
  tipo_evento: TipoEventoEmail;
  riferimento_tabella: string;
  riferimento_id: string;
  idempotency_key: string;
  from_email: string;
  reply_to_email: string | null;
  oggetto: string;
  html_body: string;
  text_body: string;
}

const TIPI_VALIDI = new Set<TipoEventoEmail>([
  'BOLLETTINO_EMESSO',
  'CONVOCAZIONE_ASSEMBLEA',
  'COMUNICAZIONE_IMPORTANTE',
]);

async function risolviDestinatariCondominio(
  db: Db,
  condominioId: string,
  palazzoId: string | null,
  escludiUtenteId: string | null,
): Promise<DestinatarioRisolto[]> {
  const userIds = new Set<string>();
  const oggi = new Date().toISOString().slice(0, 10);

  if (palazzoId) {
    const { data: unita } = await db
      .from('unita_immobiliari')
      .select('id')
      .eq('palazzo_id', palazzoId);
    const unitaIds = (unita ?? []).map((u) => u.id as string);
    for (const ids of chunk(unitaIds, 150)) {
      const [unitRoles, anag] = await Promise.all([
        db.from('utente_entita_ruolo').select('utente_id').in('unita_id', ids),
        db
          .from('anagrafiche_unita')
          .select('utente_id')
          .in('unita_id', ids)
          .or(`data_fine.is.null,data_fine.gte.${oggi}`),
      ]);
      for (const r of unitRoles.data ?? []) if (r.utente_id) userIds.add(r.utente_id);
      for (const a of anag.data ?? []) if (a.utente_id) userIds.add(a.utente_id);
    }
  } else {
    const [condRoles, palazzi] = await Promise.all([
      db.from('utente_entita_ruolo').select('utente_id').eq('condominio_id', condominioId),
      db.from('palazzi').select('id').eq('condominio_id', condominioId),
    ]);
    for (const r of condRoles.data ?? []) if (r.utente_id) userIds.add(r.utente_id);

    const palazziIds = (palazzi.data ?? []).map((p) => p.id as string);
    if (palazziIds.length > 0) {
      const { data: unita } = await db
        .from('unita_immobiliari')
        .select('id')
        .in('palazzo_id', palazziIds);
      const unitaIds = (unita ?? []).map((u) => u.id as string);
      for (const ids of chunk(unitaIds, 150)) {
        const [unitRoles, anag] = await Promise.all([
          db.from('utente_entita_ruolo').select('utente_id').in('unita_id', ids),
          db
            .from('anagrafiche_unita')
            .select('utente_id')
            .in('unita_id', ids)
            .or(`data_fine.is.null,data_fine.gte.${oggi}`),
        ]);
        for (const r of unitRoles.data ?? []) if (r.utente_id) userIds.add(r.utente_id);
        for (const a of anag.data ?? []) if (a.utente_id) userIds.add(a.utente_id);
      }
    }
  }

  if (escludiUtenteId) userIds.delete(escludiUtenteId);

  const idsList = [...userIds];
  if (idsList.length === 0) return [];

  const utentiMap = new Map<string, DestinatarioRisolto>();
  for (const ids of chunk(idsList, 150)) {
    const { data: utenti } = await db
      .from('utenti')
      .select('id, email, nome_cognome')
      .in('id', ids);
    for (const u of utenti ?? []) {
      if (isEmailValida(u.email)) {
        const emailNorm = u.email.trim().toLowerCase();
        if (!utentiMap.has(emailNorm)) {
          utentiMap.set(emailNorm, {
            utenteId: u.id,
            email: emailNorm,
            nome: u.nome_cognome ?? null,
          });
        }
      }
    }
  }

  return [...utentiMap.values()];
}

async function preparaRigheBollettini(params: {
  db: Db;
  condominioId: string;
  condominioNome: string;
  amministratoreId: string | null;
  mittente: MittenteAmministratore;
  riferimentoIds: string[];
}): Promise<{ righe: RigaCodaInsert[]; saltateSenzaEmail: number }> {
  const { db, condominioId, condominioNome, amministratoreId, mittente, riferimentoIds } = params;
  const righe: RigaCodaInsert[] = [];
  let saltateSenzaEmail = 0;

  for (const bollettinoId of riferimentoIds) {
    const { data: bollettino } = await db
      .from('bollettini')
      .select(
        'id, condominio_id, numero_progressivo, anno, destinatario_utente_id, destinatario_soggetto_id, intestazione_destinatario, totale_centesimi, data_scadenza, iban_accredito, causale_versamento',
      )
      .eq('id', bollettinoId)
      .eq('condominio_id', condominioId)
      .maybeSingle();

    if (!bollettino) continue;

    let emailDest: string | null = null;
    let nomeDest: string | null = bollettino.intestazione_destinatario ?? null;
    let utenteDestId: string | null = bollettino.destinatario_utente_id ?? null;

    if (utenteDestId) {
      const { data: u } = await db
        .from('utenti')
        .select('email, nome_cognome')
        .eq('id', utenteDestId)
        .maybeSingle();
      if (isEmailValida(u?.email)) {
        emailDest = u!.email.trim().toLowerCase();
        if (u?.nome_cognome) nomeDest = u.nome_cognome;
      }
    }

    if (!emailDest && bollettino.destinatario_soggetto_id) {
      const { data: sogg } = await db
        .from('soggetti_contabili')
        .select('email, ragione_sociale_o_nome')
        .eq('id', bollettino.destinatario_soggetto_id)
        .maybeSingle();
      if (isEmailValida(sogg?.email)) {
        emailDest = sogg!.email.trim().toLowerCase();
        if (!nomeDest && sogg?.ragione_sociale_o_nome) nomeDest = sogg.ragione_sociale_o_nome;
      }
    }

    if (!emailDest) {
      saltateSenzaEmail++;
      continue;
    }

    const { data: righeBoll } = await db
      .from('bollettini_righe')
      .select('descrizione, unita_immobiliari(interno, palazzi(nome_identificativo))')
      .eq('bollettino_id', bollettino.id);

    const unitaLabels = new Set<string>();
    const righeDescrizione: string[] = [];
    for (const rb of righeBoll ?? []) {
      if (rb.descrizione) righeDescrizione.push(rb.descrizione);
      const u = rb.unita_immobiliari as { interno?: string; palazzi?: { nome_identificativo?: string } | null } | null;
      if (u?.interno) {
        const pal = u.palazzi?.nome_identificativo ? `${u.palazzi.nome_identificativo} - ` : '';
        unitaLabels.add(`${pal}Int. ${u.interno}`);
      }
    }

    const rendered = generaTemplateBollettinoEmesso(
      {
        condominioNome,
        destinatarioNome: nomeDest,
        numeroProgressivo: bollettino.numero_progressivo,
        anno: bollettino.anno,
        totaleCentesimi: bollettino.totale_centesimi,
        dataScadenza: bollettino.data_scadenza,
        causale: bollettino.causale_versamento,
        ibanAccredito: bollettino.iban_accredito,
        unitaLabel: unitaLabels.size > 0 ? [...unitaLabels].join(', ') : null,
        righeDescrizione,
      },
      mittente,
    );

    righe.push({
      condominio_id: condominioId,
      amministratore_id: amministratoreId,
      destinatario_utente_id: utenteDestId,
      destinatario_email: emailDest,
      destinatario_nome: nomeDest,
      tipo_evento: 'BOLLETTINO_EMESSO',
      riferimento_tabella: 'bollettini',
      riferimento_id: bollettino.id,
      idempotency_key: costruisciIdempotencyKey('BOLLETTINO_EMESSO', bollettino.id, emailDest),
      from_email: mittente.fromEmail,
      reply_to_email: mittente.replyToEmail,
      oggetto: rendered.oggetto,
      html_body: rendered.htmlBody,
      text_body: rendered.textBody,
    });
  }

  return { righe, saltateSenzaEmail };
}

async function preparaRigheAssemblea(params: {
  db: Db;
  condominioId: string;
  condominioNome: string;
  amministratoreId: string | null;
  mittente: MittenteAmministratore;
  assembleaId: string;
  secondaConvocazione?: string | null;
}): Promise<{ righe: RigaCodaInsert[]; saltateSenzaEmail: number }> {
  const { db, condominioId, condominioNome, amministratoreId, mittente, assembleaId } = params;

  const { data: assemblea } = await db
    .from('assemblee_testata')
    .select('id, condominio_id, data, luogo, link_meet, tipo')
    .eq('id', assembleaId)
    .eq('condominio_id', condominioId)
    .maybeSingle();

  if (!assemblea) throw new HttpError(404, 'Assemblea non trovata');

  const { data: punti } = await db
    .from('assemblee_punti_odg')
    .select('ordine, titolo_punto, descrizione')
    .eq('assemblea_id', assembleaId)
    .order('ordine', { ascending: true });

  const destinatari = await risolviDestinatariCondominio(db, condominioId, null, amministratoreId);
  const puntiOdg = (punti ?? []).map((p) => ({
    ordine: p.ordine,
    titolo: p.titolo_punto,
    descrizione: p.descrizione,
  }));

  const righe: RigaCodaInsert[] = destinatari.map((dest) => {
    const rendered = generaTemplateConvocazioneAssemblea(
      {
        condominioNome,
        destinatarioNome: dest.nome,
        tipo: assemblea.tipo,
        dataPrincipale: assemblea.data,
        dataSecondaConvocazione: params.secondaConvocazione ?? null,
        luogo: assemblea.luogo,
        linkMeet: assemblea.link_meet,
        puntiOdg,
      },
      mittente,
    );

    return {
      condominio_id: condominioId,
      amministratore_id: amministratoreId,
      destinatario_utente_id: dest.utenteId,
      destinatario_email: dest.email,
      destinatario_nome: dest.nome,
      tipo_evento: 'CONVOCAZIONE_ASSEMBLEA',
      riferimento_tabella: 'assemblee_testata',
      riferimento_id: assemblea.id,
      idempotency_key: costruisciIdempotencyKey('CONVOCAZIONE_ASSEMBLEA', assemblea.id, dest.email),
      from_email: mittente.fromEmail,
      reply_to_email: mittente.replyToEmail,
      oggetto: rendered.oggetto,
      html_body: rendered.htmlBody,
      text_body: rendered.textBody,
    };
  });

  return { righe, saltateSenzaEmail: 0 };
}

async function preparaRigheComunicazione(params: {
  db: Db;
  condominioId: string;
  condominioNome: string;
  amministratoreId: string | null;
  mittente: MittenteAmministratore;
  postId: string;
}): Promise<{ righe: RigaCodaInsert[]; saltateSenzaEmail: number }> {
  const { db, condominioId, condominioNome, amministratoreId, mittente, postId } = params;

  const { data: post } = await db
    .from('bacheca_post')
    .select('id, condominio_id, palazzo_id, autore_id, titolo, corpo, palazzi(nome_identificativo)')
    .eq('id', postId)
    .eq('condominio_id', condominioId)
    .maybeSingle();

  if (!post) throw new HttpError(404, 'Comunicazione non trovata');

  const palazzoRel = post.palazzi as { nome_identificativo?: string } | null;
  const ambitoLabel = post.palazzo_id
    ? palazzoRel?.nome_identificativo || 'Palazzo selezionato'
    : 'Tutto il condominio';

  const destinatari = await risolviDestinatariCondominio(
    db,
    condominioId,
    post.palazzo_id ?? null,
    post.autore_id ?? amministratoreId,
  );

  const righe: RigaCodaInsert[] = destinatari.map((dest) => {
    const rendered = generaTemplateComunicazioneImportante(
      {
        condominioNome,
        destinatarioNome: dest.nome,
        titolo: post.titolo,
        corpo: post.corpo,
        ambitoLabel,
      },
      mittente,
    );

    return {
      condominio_id: condominioId,
      amministratore_id: amministratoreId,
      destinatario_utente_id: dest.utenteId,
      destinatario_email: dest.email,
      destinatario_nome: dest.nome,
      tipo_evento: 'COMUNICAZIONE_IMPORTANTE',
      riferimento_tabella: 'bacheca_post',
      riferimento_id: post.id,
      idempotency_key: costruisciIdempotencyKey('COMUNICAZIONE_IMPORTANTE', post.id, dest.email),
      from_email: mittente.fromEmail,
      reply_to_email: mittente.replyToEmail,
      oggetto: rendered.oggetto,
      html_body: rendered.htmlBody,
      text_body: rendered.textBody,
    };
  });

  return { righe, saltateSenzaEmail: 0 };
}

function avviaWorkerInBackground(condominioId: string): boolean {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return false;

  const task = fetch(`${supabaseUrl}/functions/v1/invia-coda-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ condominio_id: condominioId, limit: 25 }),
  }).catch(() => {
    // Elaborazione differita affidata al retry/cron in caso di errore transitorio
  });

  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
  }
  return true;
}

serve(async (req) => {
  const payload = (await req.json().catch(() => null)) as AccodaEmailPayload | null;
  if (!payload || !isUuid(payload.condominio_id)) {
    throw new HttpError(400, 'condominio_id non valido');
  }
  if (!payload.tipo_evento || !TIPI_VALIDI.has(payload.tipo_evento)) {
    throw new HttpError(400, 'tipo_evento non valido');
  }

  const riferimentoIds = [
    ...(isUuid(payload.riferimento_id) ? [payload.riferimento_id] : []),
    ...((payload.riferimento_ids ?? []).filter((id) => isUuid(id))),
  ];
  const uniqueIds = [...new Set(riferimentoIds)];
  if (uniqueIds.length === 0) {
    throw new HttpError(400, 'riferimento_id obbligatorio');
  }

  const senderDomain = Deno.env.get('RESEND_SENDER_DOMAIN');
  if (!senderDomain) {
    throw new HttpError(500, 'Configurazione email incompleta lato server');
  }

  let callerUserId: string | null = null;
  if (!isServiceCaller(req)) {
    const { user, db: userDb } = await requireUser(req);
    const { data: isAdmin } = await userDb.rpc('is_admin_of', { p_cond: payload.condominio_id });
    if (isAdmin !== true) {
      throw new HttpError(403, 'Permesso negato: richiesto ruolo Amministratore');
    }
    callerUserId = user.id;
  }

  const db = adminClient();

  const { data: condominio } = await db
    .from('condomini')
    .select('id, nome, admin_id')
    .eq('id', payload.condominio_id)
    .maybeSingle();

  if (!condominio) throw new HttpError(404, 'Condominio non trovato');

  const amministratoreId = callerUserId ?? condominio.admin_id ?? null;
  let nomeCognomeAdmin: string | null = null;
  let emailAdmin: string | null = null;

  if (amministratoreId) {
    const { data: adminUtente } = await db
      .from('utenti')
      .select('nome_cognome, email')
      .eq('id', amministratoreId)
      .maybeSingle();
    nomeCognomeAdmin = adminUtente?.nome_cognome ?? null;
    emailAdmin = adminUtente?.email ?? null;
  }

  const mittente = costruisciMittenteAmministratore({
    nomeCognome: nomeCognomeAdmin,
    email: emailAdmin,
    senderDomain,
  });

  let risultato: { righe: RigaCodaInsert[]; saltateSenzaEmail: number };
  if (payload.tipo_evento === 'BOLLETTINO_EMESSO') {
    risultato = await preparaRigheBollettini({
      db,
      condominioId: condominio.id,
      condominioNome: condominio.nome,
      amministratoreId,
      mittente,
      riferimentoIds: uniqueIds,
    });
  } else if (payload.tipo_evento === 'CONVOCAZIONE_ASSEMBLEA') {
    risultato = await preparaRigheAssemblea({
      db,
      condominioId: condominio.id,
      condominioNome: condominio.nome,
      amministratoreId,
      mittente,
      assembleaId: uniqueIds[0]!,
      secondaConvocazione: payload.seconda_convocazione ?? null,
    });
  } else {
    risultato = await preparaRigheComunicazione({
      db,
      condominioId: condominio.id,
      condominioNome: condominio.nome,
      amministratoreId,
      mittente,
      postId: uniqueIds[0]!,
    });
  }

  let accodate = 0;
  for (const batch of chunk(risultato.righe, 200)) {
    const { data: inserted, error } = await db
      .from('coda_email')
      .upsert(batch, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select('id');
    if (error) {
      throw new HttpError(500, 'Errore inserimento coda email', error.message);
    }
    accodate += (inserted ?? []).length;
  }

  const workerAvviato = accodate > 0 ? avviaWorkerInBackground(condominio.id) : false;

  return json({
    accodate,
    saltate_senza_email: risultato.saltateSenzaEmail,
    from_email: mittente.fromEmail,
    reply_to_email: mittente.replyToEmail,
    worker_avviato: workerAvviato,
  });
});
