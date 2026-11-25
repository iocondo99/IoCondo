// POST /functions/v1/fornitore-intervento (UC-08 Magic link fornitore frictionless)
// Accesso senza login con Magic Link (token ad alta entropia, verificato tramite digest SHA-256).
// verify_jwt = false in config.toml
import { HttpError, json, serve } from '../_shared/http.ts';
import { adminClient } from '../_shared/auth.ts';

interface ActionInput {
  token: string;
  azione: 'get' | 'chiudi';
  importo_consuntivo?: number;
  note_fornitore?: string;
  fattura_url?: string;
  foto_lavoro_url?: string;
}

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{24,128}$/;
const MAX_NOTE_LEN = 2000;
const MAX_IMPORTO = 10_000_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQ = 20;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  const fwd = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  return fwd || 'anon';
}

function checkRateLimit(req: Request): void {
  const key = clientKey(req);
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_REQ) {
    throw new HttpError(429, 'Troppe richieste. Riprova tra qualche istante.');
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizzaAllegatoUrl(raw: unknown, condominioId: string, label: string): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new HttpError(400, `${label} non valido`);
  const v = raw.trim();
  if (!v) return null;
  if (v.length > 500 || /[\r\n\0<>`"']/.test(v) || v.includes('..') || v.includes('\\')) {
    throw new HttpError(400, `${label} contiene caratteri non consentiti`);
  }
  if (/^https:\/\//i.test(v)) {
    let parsed: URL;
    try {
      parsed = new URL(v);
    } catch {
      throw new HttpError(400, `${label} non è un URL valido`);
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new HttpError(400, `${label} non consentito`);
    }
    return parsed.toString();
  }
  if (/^[a-z]+:/i.test(v)) {
    throw new HttpError(400, `${label}: schema URL non consentito`);
  }
  // Percorso Storage relativo: deve restare confinato sotto `<condominioId>/...`
  const prefixOk = new RegExp(`^${condominioId}/[A-Za-z0-9._/-]+$`).test(v);
  if (!prefixOk) {
    throw new HttpError(400, `${label}: percorso storage non valido o fuori condominio`);
  }
  return v;
}

serve(async (req) => {
  checkRateLimit(req);

  const body = (await req.json().catch(() => null)) as ActionInput | null;
  if (!body || !body.token || typeof body.token !== 'string') {
    throw new HttpError(400, 'Token obbligatorio');
  }
  const rawToken = body.token.trim();
  if (!TOKEN_FORMAT.test(rawToken)) {
    throw new HttpError(400, 'Formato token non valido');
  }

  const db = adminClient();
  const tokenHash = await sha256Hex(rawToken);

  // 1. Valida token tramite digest SHA-256 (supporta colonna token_hash, token SHA-256 o token legacy)
  let { data: tokenRow, error: tErr } = await db
    .from('fornitori_tokens')
    .select('token, ticket_intervento_id, data_scadenza, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!tokenRow) {
    const byHashedPk = await db
      .from('fornitori_tokens')
      .select('token, ticket_intervento_id, data_scadenza, used_at')
      .eq('token', tokenHash)
      .maybeSingle();
    tokenRow = byHashedPk.data;
    tErr = byHashedPk.error;
  }

  if (!tokenRow && !tErr) {
    const legacy = await db
      .from('fornitori_tokens')
      .select('token, ticket_intervento_id, data_scadenza, used_at')
      .eq('token', rawToken)
      .maybeSingle();
    tokenRow = legacy.data;
    tErr = legacy.error;
  }

  if (tErr || !tokenRow) throw new HttpError(404, 'Magic link non trovato o non valido');
  if (tokenRow.used_at) throw new HttpError(410, 'Questo link e\' gia\' stato utilizzato');
  if (new Date(tokenRow.data_scadenza) < new Date()) throw new HttpError(410, 'Questo link e\' scaduto');

  // 2. Recupera l'intervento collegato
  const { data: intervento, error: iErr } = await db
    .from('ticket_interventi')
    .select('id, ticket_id, data_prevista, importo_consuntivo, note_fornitore')
    .eq('id', tokenRow.ticket_intervento_id)
    .single();

  if (iErr || !intervento) throw new HttpError(404, 'Intervento non trovato');

  // 3. Recupera info ticket
  const { data: ticket, error: tkErr } = await db
    .from('ticket_testata')
    .select('id, titolo, descrizione, is_area_comune, priorita, stato, condominio_id')
    .eq('id', intervento.ticket_id)
    .single();

  if (tkErr || !ticket) throw new HttpError(404, 'Ticket non trovato');

  const { data: cond } = await db
    .from('condomini')
    .select('nome, indirizzo, citta, attivo')
    .eq('id', ticket.condominio_id)
    .single();

  if (cond?.attivo === false) {
    throw new HttpError(403, 'Servizio condominio temporaneamente sospeso');
  }

  if (body.azione === 'get' || !body.azione) {
    return json({
      ticket: {
        id: ticket.id,
        titolo: ticket.titolo,
        descrizione: ticket.descrizione,
        stato: ticket.stato,
        priorita: ticket.priorita,
        is_area_comune: ticket.is_area_comune,
        condominio: cond ? `${cond.nome} - ${cond.indirizzo}, ${cond.citta}` : '',
      },
      intervento: {
        id: intervento.id,
        data_prevista: intervento.data_prevista,
      },
    });
  }

  if (body.azione === 'chiudi') {
    let importo: number | null = null;
    if (body.importo_consuntivo !== undefined && body.importo_consuntivo !== null) {
      if (
        typeof body.importo_consuntivo !== 'number' ||
        !Number.isFinite(body.importo_consuntivo) ||
        body.importo_consuntivo < 0 ||
        body.importo_consuntivo > MAX_IMPORTO
      ) {
        throw new HttpError(400, 'importo_consuntivo non valido');
      }
      importo = Math.round(body.importo_consuntivo * 100) / 100;
    }

    let note: string | null = null;
    if (body.note_fornitore !== undefined && body.note_fornitore !== null) {
      if (typeof body.note_fornitore !== 'string') throw new HttpError(400, 'note_fornitore non valida');
      const trimmed = body.note_fornitore.trim();
      if (trimmed.length > MAX_NOTE_LEN) {
        throw new HttpError(400, `note_fornitore oltre il limite di ${MAX_NOTE_LEN} caratteri`);
      }
      note = trimmed || null;
    }

    const fatturaUrl = sanitizzaAllegatoUrl(body.fattura_url, ticket.condominio_id, 'fattura_url');
    const fotoLavoroUrl = sanitizzaAllegatoUrl(body.foto_lavoro_url, ticket.condominio_id, 'foto_lavoro_url');

    // Consumo atomico anti-TOCTOU PRIMA delle scritture operative
    let consumato = false;
    const { data: rpcConsumo, error: rpcConsumoErr } = await db.rpc('consuma_fornitore_token', {
      p_token_hash: tokenHash,
      p_legacy_token: rawToken,
    });

    if (!rpcConsumoErr) {
      consumato = Array.isArray(rpcConsumo) ? rpcConsumo.length > 0 : Boolean(rpcConsumo);
    } else {
      const { data: updTok } = await db
        .from('fornitori_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', tokenRow.token)
        .is('used_at', null)
        .select('token')
        .maybeSingle();
      consumato = Boolean(updTok?.token);
    }

    if (!consumato) {
      throw new HttpError(410, 'Questo link e\' gia\' stato utilizzato o e\' scaduto');
    }

    // Aggiorna l'intervento con consuntivo, note e URL documenti validati (UC-08)
    const { error: updIErr } = await db
      .from('ticket_interventi')
      .update({
        importo_consuntivo: importo,
        note_fornitore: note,
        fattura_url: fatturaUrl,
        foto_lavoro_url: fotoLavoroUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intervento.id);

    if (updIErr) {
      console.error('Errore aggiornamento intervento:', updIErr.message);
      throw new HttpError(500, 'Errore aggiornamento intervento');
    }

    const allegatiToInsert: Array<{ ticket_id: string; url_storage: string; tipo_file: 'FOTO' | 'FATTURA' }> = [];
    if (fotoLavoroUrl) {
      allegatiToInsert.push({ ticket_id: ticket.id, url_storage: fotoLavoroUrl, tipo_file: 'FOTO' });
    }
    if (fatturaUrl) {
      allegatiToInsert.push({ ticket_id: ticket.id, url_storage: fatturaUrl, tipo_file: 'FATTURA' });
    }
    if (allegatiToInsert.length > 0) {
      await db.from('ticket_allegati').insert(allegatiToInsert);
    }

    // Marca il ticket come RISOLTO
    const { error: updTkErr } = await db
      .from('ticket_testata')
      .update({
        stato: 'RISOLTO',
        closed_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (updTkErr) {
      console.error('Errore chiusura ticket:', updTkErr.message);
      throw new HttpError(500, 'Errore chiusura ticket');
    }

    return json({
      ok: true,
      messaggio: 'Intervento completato e ticket chiuso con successo',
    });
  }

  throw new HttpError(400, 'Azione non supportata');
});
