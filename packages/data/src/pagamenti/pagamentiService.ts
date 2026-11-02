/**
 * Servizio della pagina Pagamenti del condòmino: elenco, dettaglio e link firmato del bollettino.
 * Solo chiave pubblica + RLS: mai service_role.
 *
 * Le RLS lasciano leggere più righe a un amministratore (tutte le rate del condominio, anche quelle non
 * pubblicate). La pagina è "da residente": ogni query qui restringe a utente e condominio scelti, e il
 * dettaglio controlla di nuovo che la rata sia dell'utente (`rataAppartieneA`). Nell'URL c'è solo l'id.
 */
import { unwrap, unwrapMaybe, type TypedSupabaseClient } from '@iocondo/supabase-client';
import { oggiIso, residuo, type RataHome } from '../home/homeLogic';
import { filtroRateMie, percorsoBollettino, rataAppartieneA } from './pagamentiLogic';

/** Bucket privato dei bollettini (migrazioni 05/06): lettura solo con le policy `ricevute_rate_select`. */
const BUCKET = 'ricevute-rate';
/** Durata del link firmato per il bollettino: 10 minuti. */
const DURATA_LINK_SECONDI = 600;

/** Rata dell'elenco: i campi di RataHome più l'unità a cui si riferisce. */
export interface RataConDettagli extends RataHome {
  unitaId: string;
  unitaDescrizione: string;
}

/** Quota dell'unità nella tabella millesimale della rata: solo se esiste davvero. */
export interface RipartizioneMillesimale {
  tabellaNome: string;
  millesimi: number;
  totale: number;
}

/** Dettaglio di una rata. */
export interface DettaglioRata extends RataConDettagli {
  esercizioAnno: number;
  /** Importo ancora da pagare (0 se già pagata). */
  residuo: number;
  dataPagamento: string | null;
  ripartizione: RipartizioneMillesimale | null;
  /** Percorso del bollettino nel bucket, SOLO se il file esiste davvero e l'utente può leggerlo. */
  bollettino: string | null;
}

const descrizioneUnita = (interno: string | null | undefined) => (interno ? `Int. ${interno}` : '—');

export function createPagamentiService(db: TypedSupabaseClient) {
  /** Unità dell'utente (anagrafica attiva o ruolo legato a un'unità) dentro il condominio scelto. */
  async function unitaDelCondomino(userId: string, condominioId: string): Promise<string[]> {
    const oggi = oggiIso();
    const [anagrafiche, ruoli, palazzi] = await Promise.all([
      db
        .from('anagrafiche_unita')
        .select('unita_id')
        .eq('utente_id', userId)
        .or(`data_fine.is.null,data_fine.gte.${oggi}`),
      db.from('utente_entita_ruolo').select('unita_id').eq('utente_id', userId).not('unita_id', 'is', null),
      db.from('palazzi').select('id').eq('condominio_id', condominioId),
    ]);

    const candidate = new Set<string>();
    for (const r of unwrap(anagrafiche)) candidate.add(r.unita_id);
    for (const r of unwrap(ruoli)) if (r.unita_id) candidate.add(r.unita_id);
    const palazziIds = unwrap(palazzi).map((p) => p.id);
    if (candidate.size === 0 || palazziIds.length === 0) return [];

    const unita = unwrap(
      await db.from('unita_immobiliari').select('id').in('id', [...candidate]).in('palazzo_id', palazziIds),
    );
    return unita.map((u) => u.id);
  }

  const servizio = {
    /**
     * Rate pubblicate del condominio di cui l'utente è debitore (o senza debitore, su una sua unità).
     * Un amministratore che apre la pagina dalla vista residente vede solo le proprie.
     */
    async listMie(userId: string, condominioId: string): Promise<RataConDettagli[]> {
      const esercizi = unwrap(await db.from('esercizi_contabili').select('id').eq('condominio_id', condominioId));
      if (esercizi.length === 0) return [];

      const testate = unwrap(
        await db
          .from('rate_testata')
          .select('id, descrizione, data_scadenza')
          .in('esercizio_id', esercizi.map((e) => e.id))
          .eq('pubblicata', true),
      );
      if (testate.length === 0) return [];

      const unita = await unitaDelCondomino(userId, condominioId);
      const rate = unwrap(
        await db
          .from('rate_dettaglio')
          .select('id, rata_testata_id, unita_id, importo_dovuto, importo_pagato, stato')
          .in('rata_testata_id', testate.map((t) => t.id))
          .or(filtroRateMie(userId, unita)),
      );
      if (rate.length === 0) return [];

      const unitaIds = [...new Set(rate.map((r) => r.unita_id))];
      const righeUnita = unwrap(await db.from('unita_immobiliari').select('id, interno').in('id', unitaIds));
      const interni = new Map(righeUnita.map((u) => [u.id, descrizioneUnita(u.interno)]));
      const testataDi = new Map(testate.map((t) => [t.id, t]));

      return rate.flatMap((r) => {
        const testata = testataDi.get(r.rata_testata_id);
        if (!testata) return [];
        return [
          {
            id: r.id,
            descrizione: testata.descrizione,
            dataScadenza: testata.data_scadenza,
            importoDovuto: Number(r.importo_dovuto),
            importoPagato: Number(r.importo_pagato),
            stato: r.stato,
            unitaId: r.unita_id,
            unitaDescrizione: interni.get(r.unita_id) ?? '—',
          },
        ];
      });
    },

    /**
     * Dettaglio di una rata. `null` = "non autorizzato" in ogni caso (rata inesistente, non pubblicata,
     * di un altro condominio o di un'altra persona): la schermata non deve poter distinguere i casi.
     */
    async getDettaglio(rataId: string, userId: string, condominioId: string): Promise<DettaglioRata | null> {
      const rata = unwrapMaybe(
        await db
          .from('rate_dettaglio')
          .select(
            'id, rata_testata_id, unita_id, utente_id, importo_dovuto, importo_pagato, stato, data_pagamento, bollettino_url',
          )
          .eq('id', rataId)
          .maybeSingle(),
      );
      if (!rata) return null;

      const testata = unwrapMaybe(
        await db
          .from('rate_testata')
          .select('id, descrizione, data_scadenza, esercizio_id, tabella_millesimale_id')
          .eq('id', rata.rata_testata_id)
          .eq('pubblicata', true)
          .maybeSingle(),
      );
      if (!testata) return null;

      const esercizio = unwrapMaybe(
        await db
          .from('esercizi_contabili')
          .select('anno')
          .eq('id', testata.esercizio_id)
          .eq('condominio_id', condominioId)
          .maybeSingle(),
      );
      if (!esercizio) return null;

      const unitaMie = await unitaDelCondomino(userId, condominioId);
      if (!rataAppartieneA({ utenteId: rata.utente_id ?? null, unitaId: rata.unita_id }, userId, unitaMie)) {
        return null;
      }

      const [unita, ripartizione, bollettino] = await Promise.all([
        db.from('unita_immobiliari').select('interno').eq('id', rata.unita_id).maybeSingle(),
        servizio.ripartizione(testata.tabella_millesimale_id, rata.unita_id),
        servizio.bollettinoEsistente(rata.bollettino_url),
      ]);

      const base: RataHome = {
        id: rata.id,
        descrizione: testata.descrizione,
        dataScadenza: testata.data_scadenza,
        importoDovuto: Number(rata.importo_dovuto),
        importoPagato: Number(rata.importo_pagato),
        stato: rata.stato,
      };
      return {
        ...base,
        unitaId: rata.unita_id,
        unitaDescrizione: descrizioneUnita(unwrapMaybe(unita)?.interno),
        esercizioAnno: esercizio.anno,
        residuo: residuo(base),
        dataPagamento: rata.data_pagamento ?? null,
        ripartizione,
        bollettino,
      };
    },

    /** Quota dell'unità nella tabella millesimale della rata; null se la rata non ne ha o mancano i dati. */
    async ripartizione(tabellaId: string | null, unitaId: string): Promise<RipartizioneMillesimale | null> {
      if (!tabellaId) return null;
      const [tabella, quota] = await Promise.all([
        db.from('tabelle_millesimali').select('nome, totale').eq('id', tabellaId).maybeSingle(),
        db
          .from('quote_millesimali')
          .select('valore_millesimale')
          .eq('tabella_id', tabellaId)
          .eq('unita_id', unitaId)
          .maybeSingle(),
      ]);
      const t = unwrapMaybe(tabella);
      const q = unwrapMaybe(quota);
      if (!t || !q) return null;
      return { tabellaNome: t.nome, millesimi: Number(q.valore_millesimale), totale: Number(t.totale) };
    },

    /**
     * Il percorso del bollettino, se nel bucket privato c'è davvero un file con quel nome e l'utente può
     * leggerlo (la lista passa dalle policy di Storage). Percorso non valido, file mancante o errore: null.
     */
    async bollettinoEsistente(percorso: string | null | undefined): Promise<string | null> {
      const parti = percorsoBollettino(percorso);
      if (!parti || !percorso) return null;
      const { data, error } = await db.storage.from(BUCKET).list(parti.cartella, { limit: 100, search: parti.nome });
      if (error || !data) return null;
      return data.some((file) => file.name === parti.nome) ? percorso : null;
    },

    /**
     * Link firmato a tempo (10 minuti) per il bollettino. Mai un URL pubblico: il bucket è privato.
     * null se il percorso non è valido, il file non c'è più o l'utente non può leggerlo.
     */
    async urlBollettino(percorso: string): Promise<string | null> {
      if (!percorsoBollettino(percorso)) return null;
      const { data, error } = await db.storage.from(BUCKET).createSignedUrl(percorso, DURATA_LINK_SECONDI);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
  };
  return servizio;
}

export type PagamentiService = ReturnType<typeof createPagamentiService>;
