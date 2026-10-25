// POST /functions/v1/ripartizione-spese
// Body: { importo, tabella_millesimale_id, esercizio_id, data_scadenza, descrizione, pubblica? }
// Calcola le quote su una tabella millesimale (anche limitata a Scala/Colonna: UC-03, UC-06) e crea
// rate_testata + rate_dettaglio. Agisce con il JWT dell'utente -> la RLS verifica che sia admin.
import { HttpError, isUuid, json, serve } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';

interface Input {
  importo: number;
  tabella_millesimale_id: string;
  esercizio_id: string;
  data_scadenza: string;
  descrizione: string;
  pubblica?: boolean;
}

function parse(body: unknown): Input {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.importo !== 'number' || !Number.isFinite(b.importo) || b.importo <= 0) {
    throw new HttpError(400, 'importo deve essere un numero > 0');
  }
  if (!isUuid(b.tabella_millesimale_id)) throw new HttpError(400, 'tabella_millesimale_id non valido');
  if (!isUuid(b.esercizio_id)) throw new HttpError(400, 'esercizio_id non valido');
  if (typeof b.data_scadenza !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.data_scadenza)) {
    throw new HttpError(400, 'data_scadenza deve essere YYYY-MM-DD');
  }
  if (typeof b.descrizione !== 'string' || !b.descrizione.trim()) throw new HttpError(400, 'descrizione obbligatoria');
  return {
    importo: b.importo,
    tabella_millesimale_id: b.tabella_millesimale_id,
    esercizio_id: b.esercizio_id,
    data_scadenza: b.data_scadenza,
    descrizione: b.descrizione.trim(),
    pubblica: b.pubblica === true,
  };
}

/** Metodo del resto piu' alto: la somma delle quote in centesimi e' SEMPRE uguale al totale. */
export function ripartisciCentesimi(totaleCents: number, valori: number[]): number[] {
  const somma = valori.reduce((a, b) => a + b, 0);
  const raw = valori.map((v) => (totaleCents * v) / somma);
  const base = raw.map(Math.floor);
  let resto = totaleCents - base.reduce((a, b) => a + b, 0);
  const ordine = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of ordine) {
    if (resto <= 0) break;
    base[i]! += 1;
    resto--;
  }
  return base;
}

serve(async (req) => {
  const input = parse(await req.json().catch(() => null));
  const { db } = await requireUser(req);

  // 1) Tabella ed esercizio (la RLS filtra: se non li vedo, non ho accesso)
  const { data: tabella } = await db
    .from('tabelle_millesimali')
    .select('id, condominio_id, totale')
    .eq('id', input.tabella_millesimale_id)
    .maybeSingle();
  if (!tabella) throw new HttpError(404, 'Tabella millesimale non trovata');

  const { data: esercizio } = await db
    .from('esercizi_contabili')
    .select('id, condominio_id, stato')
    .eq('id', input.esercizio_id)
    .maybeSingle();
  if (!esercizio) throw new HttpError(404, 'Esercizio non trovato');
  if (esercizio.condominio_id !== tabella.condominio_id) {
    throw new HttpError(422, 'Tabella ed esercizio appartengono a condomini diversi');
  }
  if (esercizio.stato === 'CHIUSO') throw new HttpError(422, 'Esercizio chiuso');

  // 2) Solo l'amministratore del condominio
  const { data: isAdmin } = await db.rpc('is_admin_of', { p_cond: tabella.condominio_id });
  if (isAdmin !== true) throw new HttpError(403, 'Permesso negato: serve il ruolo amministratore');

  // 3) Quote millesimali (solo valori > 0)
  const { data: quoteRows, error: qErr } = await db
    .from('quote_millesimali')
    .select('unita_id, valore_millesimale')
    .eq('tabella_id', tabella.id)
    .gt('valore_millesimale', 0);
  if (qErr) throw new HttpError(500, 'Errore lettura quote', qErr.message);
  const quote = (quoteRows ?? []) as { unita_id: string; valore_millesimale: number }[];
  if (quote.length === 0) throw new HttpError(422, 'La tabella non ha quote millesimali');

  const somma = quote.reduce((a, q) => a + Number(q.valore_millesimale), 0);
  if (Math.abs(somma - Number(tabella.totale)) > 0.001) {
    throw new HttpError(422, `La somma dei millesimi (${somma}) non coincide con il totale tabella (${tabella.totale})`);
  }

  // 4) Calcolo quote in centesimi
  const totaleCents = Math.round(input.importo * 100);
  const cents = ripartisciCentesimi(totaleCents, quote.map((q) => Number(q.valore_millesimale)));

  // 5) Debitore = proprietario attivo (se assente, qualsiasi anagrafica attiva): il debito segue la persona
  const unitaIds = quote.map((q) => q.unita_id);
  const oggi = new Date().toISOString().slice(0, 10);
  const { data: anag } = await db
    .from('anagrafiche_unita')
    .select('unita_id, utente_id, tipo_possesso, quota_possesso')
    .in('unita_id', unitaIds)
    .lte('data_inizio', oggi)
    .or(`data_fine.is.null,data_fine.gte.${oggi}`);
  const debitore = new Map<string, string>();
  const ordinate = [...(anag ?? [])].sort((a, b) => {
    const pa = a.tipo_possesso === 'PROPRIETARIO' ? 0 : 1;
    const pb = b.tipo_possesso === 'PROPRIETARIO' ? 0 : 1;
    return pa - pb || Number(b.quota_possesso) - Number(a.quota_possesso);
  });
  for (const a of ordinate) if (!debitore.has(a.unita_id)) debitore.set(a.unita_id, a.utente_id);

  // 6) Inserimento testata + dettagli (compensazione manuale in caso di errore)
  const { data: testata, error: tErr } = await db
    .from('rate_testata')
    .insert({
      esercizio_id: input.esercizio_id,
      tabella_millesimale_id: tabella.id,
      data_scadenza: input.data_scadenza,
      descrizione: input.descrizione,
      pubblicata: input.pubblica ?? false,
    })
    .select('id')
    .single();
  if (tErr || !testata) {
    if (tErr?.code === '42501') throw new HttpError(403, 'Permesso negato');
    throw new HttpError(500, 'Errore creazione rata', tErr?.message);
  }

  const righe = quote.map((q, i) => ({
    rata_testata_id: testata.id,
    unita_id: q.unita_id,
    utente_id: debitore.get(q.unita_id) ?? null,
    importo_dovuto: cents[i]! / 100,
    stato: 'DA_PAGARE',
  }));
  const { error: dErr } = await db.from('rate_dettaglio').insert(righe);
  if (dErr) {
    await db.from('rate_testata').delete().eq('id', testata.id); // rollback (cascade sui dettagli)
    throw new HttpError(500, 'Errore inserimento quote', dErr.message);
  }

  return json(
    {
      rata_testata_id: testata.id,
      totale: totaleCents / 100,
      numero_quote: righe.length,
      righe: righe.map((r) => ({ unita_id: r.unita_id, utente_id: r.utente_id, importo_dovuto: r.importo_dovuto })),
    },
    201,
  );
});
