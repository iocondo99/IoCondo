// POST /functions/v1/invita-utente (UC-07: invito di una persona a un condominio)
// verify_jwt = true in config.toml: serve il token di un utente collegato.
//
// Chi puo' invitare, quali ruoli e quali unita' lo decide il DATABASE (RPC crea_invito, con il JWT di chi
// chiama e quindi auth.uid()): qui non ci si fida dei dati dell'app. La service_role serve solo per spedire
// l'email di invito (Auth Admin API) ed e' quella iniettata da Supabase nella funzione: mai nel codice.
// Nessun dato personale nei log (ne' email ne' token) e nessun dettaglio tecnico nelle risposte.
//
// Se l'indirizzo ha gia' un account confermato, crea_invito assegna subito il ruolo e crea la notifica;
// l'email non parte e all'amministratore la risposta e' identica ("Invito registrato").
import { HttpError, isUuid, json, serve } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/auth.ts';

interface InvitoInput {
  email: string;
  /** Nome e cognome del destinatario. Opzionale: assente nei re-inviti (sollecito/rinnovo). */
  nome_cognome: string | null;
  ruolo: 'CONDOMINO' | 'PORTIERE' | 'ADMIN';
  condominio_id: string;
  unita_id?: string | null;
  flag_portiere?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RUOLI = ['CONDOMINO', 'PORTIERE', 'ADMIN'];

/** Indirizzo base dell'app (segreto APP_URL), senza barra finale. Serve a costruire il redirectTo. */
function appUrl(): string {
  const raw = Deno.env.get('APP_URL') ?? '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocollo');
    return url.origin;
  } catch {
    console.error('APP_URL mancante o non valido');
    throw new HttpError(500, 'Servizio non configurato. Riprova più tardi.');
  }
}

function parse(body: unknown): InvitoInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, 'L’indirizzo email non è valido.');
  // Nome e cognome: facoltativo. Se fornito (nuovo invito) lo validiamo; se assente
  // (re-invito: sollecito/rinnovo) si prosegue senza toccarlo.
  const nomeRaw = typeof b.nome_cognome === 'string' ? b.nome_cognome.trim() : '';
  if (nomeRaw.length > 120) throw new HttpError(400, 'Il nome è troppo lungo.');
  const nomeCognome = nomeRaw.length >= 2 ? nomeRaw : null;
  if (typeof b.ruolo !== 'string' || !RUOLI.includes(b.ruolo)) throw new HttpError(400, 'Il ruolo non è valido.');
  if (!isUuid(b.condominio_id)) throw new HttpError(400, 'Scegli il condominio.');
  if (b.unita_id != null && !isUuid(b.unita_id)) throw new HttpError(400, 'L’unità non è valida.');
  return {
    email,
    nome_cognome: nomeCognome,
    ruolo: b.ruolo as InvitoInput['ruolo'],
    condominio_id: b.condominio_id,
    unita_id: (b.unita_id as string | null | undefined) ?? null,
    flag_portiere: b.flag_portiere === true,
  };
}

serve(async (req) => {
  const input = parse(await req.json().catch(() => null));
  const redirectTo = `${appUrl()}/imposta-password`;
  const { user, db } = await requireUser(req);

  // 1. Controlli e scrittura nel database, come l'utente che chiama.
  const { error: rpcError } = await db.rpc('crea_invito', {
    p_email: input.email,
    p_ruolo: input.ruolo,
    p_condominio: input.condominio_id,
    p_unita: input.unita_id,
    p_flag_portiere: input.flag_portiere,
  });
  if (rpcError) {
    console.error('crea_invito rifiutato', rpcError.code ?? 'sconosciuto');
    if (rpcError.code === '42501') throw new HttpError(403, 'Non puoi invitare persone in questo condominio.');
    if (rpcError.code === '22023') throw new HttpError(400, 'I dati dell’invito non sono validi.');
    if (rpcError.code === '54000') throw new HttpError(429, 'Hai mandato molti inviti. Riprova tra un po’.');
    throw new HttpError(500, 'Non è stato possibile registrare l’invito. Riprova.');
  }

  // 2. Email di invito (solo per chi non ha ancora un account confermato).
  const admin = adminClient();
  await admin
    .rpc('registra_evento_sicurezza', {
      p_evento: 'INVITO_INVIATO',
      p_utente: user.id,
      p_condominio: input.condominio_id,
      p_email: input.email,
      p_dettagli: { ruolo: input.ruolo },
    })
    .then(() => undefined, () => undefined);
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo,
    // Il trigger handle_new_user legge nome_cognome da raw_user_meta_data e pre-popola public.utenti.
    // Nei re-inviti nome_cognome è null: non lo includiamo nei metadata.
    ...(input.nome_cognome ? { data: { nome_cognome: input.nome_cognome } } : {}),
  });
  if (inviteError) {
    const code = (inviteError as { code?: string }).code ?? '';
    const status = (inviteError as { status?: number }).status;
    if (code === 'email_exists' || code === 'user_already_exists') {
      // Risposta uniforme anti-enumerazione: `crea_invito` ha gia' associato il ruolo/invito su DB
      // sia per account confermati sia per account pendenti; evitare oracoli `200` vs `502`.
      const { data: confermata } = await admin.rpc('email_confermata', { p_email: input.email });
      if (confermata !== true) {
        console.info('invita-utente: account esistente non ancora confermato, ruolo registrato senza nuova email auth');
      }
      return json({ ok: true });
    }
    console.error('invio invito non riuscito', code || status || 'sconosciuto');
    if (code === 'over_email_send_rate_limit' || status === 429) {
      throw new HttpError(429, 'Troppe email inviate in poco tempo. Riprova tra qualche minuto.');
    }
    throw new HttpError(502, 'L’invito è stato registrato ma non siamo riusciti a spedire l’email. Riprova.');
  }

  return json({ ok: true });
});
