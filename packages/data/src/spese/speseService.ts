import { unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  calcolaTotaleSpese,
  esercizioVisibileA,
  MACRO_CATEGORIA_PREDEFINITA,
  ordinaEserciziSpese,
  ordinaMovimentiSpese,
  percorsoDocumentoAllegato,
  raccogliDocumentiAllegati,
  SOTTOCONTO_PREDEFINITO,
  STATI_ESERCIZIO_VISIBILI,
  statoEsercizioVisibile,
  totaliPerMacroCategoria,
  type DettaglioEsercizioSpese,
  type DocumentoAllegatoSpese,
  type EsercizioSpese,
  type MovimentoSpesa,
} from './speseLogic';

const BUCKET_DOCUMENTI = 'documenti-condominio';
/** Durata del link firmato per il documento allegato (10 minuti). */
const DURATA_LINK_SECONDI = 600;

/**
 * Letture in sola lettura per le pagine `/spese` e `/spese/[id]` del condòmino.
 * Usa esclusivamente la chiave pubblica e le policy RLS, restringendo sempre
 * al condominio selezionato e agli esercizi in stato pubblicato (`PREVENTIVO`, `CONSUNTIVO`, `CHIUSO`).
 */
export function createSpeseService(db: TypedSupabaseClient) {
  /**
   * Verifica che il file esista davvero nel bucket privato `documenti-condominio`
   * prima di mostrare l'allegato nell'interfaccia.
   */
  async function esisteNelloStorage(percorso: string): Promise<boolean> {
    const ultimoSlash = percorso.lastIndexOf('/');
    const cartella = ultimoSlash >= 0 ? percorso.slice(0, ultimoSlash) : '';
    const nomeFile = ultimoSlash >= 0 ? percorso.slice(ultimoSlash + 1) : percorso;
    if (!nomeFile) return false;
    const { data, error } = await db.storage
      .from(BUCKET_DOCUMENTI)
      .list(cartella, { limit: 100, search: nomeFile });
    if (error || !data) return false;
    return data.some((voce) => voce.name === nomeFile);
  }

  /**
   * Carica e verifica nello Storage i documenti allegati referenziati da `doc_allegato_id`.
   * Restituisce solo quelli leggibili secondo le RLS (`can_read_documento`) e presenti nello Storage.
   */
  async function risolviDocumentiAllegati(
    docIds: readonly string[],
    condominioId: string,
  ): Promise<Map<string, DocumentoAllegatoSpese>> {
    const mappa = new Map<string, DocumentoAllegatoSpese>();
    if (docIds.length === 0) return mappa;

    const righeDoc = unwrap(
      await db
        .from('documenti_metadata')
        .select('id, nome_file, tipo_mime, url_storage')
        .in('id', [...new Set(docIds)]),
    );

    await Promise.all(
      righeDoc.map(async (doc) => {
        const percorso = percorsoDocumentoAllegato(doc.url_storage, condominioId);
        if (!percorso) return;
        const presente = await esisteNelloStorage(percorso);
        if (!presente) return;
        mappa.set(doc.id, {
          id: doc.id,
          nomeFile: doc.nome_file,
          tipoMime: doc.tipo_mime ?? 'application/pdf',
          percorsoStorage: percorso,
        });
      }),
    );

    return mappa;
  }

  return {
    /**
     * Elenco degli esercizi contabili visibili del condominio selezionato,
     * completi di totale spese calcolato sui movimenti di uscita (`segno = '-'`).
     */
    async eserciziDelCondominio(condominioId: string): Promise<EsercizioSpese[]> {
      if (!condominioId) return [];

      const righeEsercizi = unwrap(
        await db
          .from('esercizi_contabili')
          .select('id, condominio_id, anno, data_inizio, data_fine, stato')
          .eq('condominio_id', condominioId)
          .in('stato', [...STATI_ESERCIZIO_VISIBILI])
          .order('anno', { ascending: false }),
      );

      const visibili = righeEsercizi.filter((e) =>
        esercizioVisibileA({ condominioId: e.condominio_id, stato: e.stato }, condominioId),
      );
      if (visibili.length === 0) return [];

      const movimenti = unwrap(
        await db
          .from('movimenti_contabili')
          .select('esercizio_id, importo, segno')
          .in(
            'esercizio_id',
            visibili.map((e) => e.id),
          )
          .eq('segno', '-'),
      );

      const movimentiPerEsercizio = new Map<string, { importo: number; segno: '-' | '+' }[]>();
      for (const m of movimenti) {
        const segno: '-' | '+' = m.segno === '+' ? '+' : '-';
        const lista = movimentiPerEsercizio.get(m.esercizio_id);
        const voce = { importo: Number(m.importo), segno };
        if (lista) {
          lista.push(voce);
        } else {
          movimentiPerEsercizio.set(m.esercizio_id, [voce]);
        }
      }

      const risultato: EsercizioSpese[] = visibili.flatMap((e) => {
        if (!statoEsercizioVisibile(e.stato)) return [];
        const movEsercizio = movimentiPerEsercizio.get(e.id) ?? [];
        return [
          {
            id: e.id,
            condominioId: e.condominio_id,
            anno: e.anno,
            dataInizio: e.data_inizio,
            dataFine: e.data_fine,
            stato: e.stato,
            totaleSpese: calcolaTotaleSpese(movEsercizio),
            numeroMovimenti: movEsercizio.length,
          },
        ];
      });

      return ordinaEserciziSpese(risultato);
    },

    /**
     * Dettaglio di un esercizio contabile con i movimenti di spesa, i sottoconti,
     * i totali per macro-categoria e gli allegati verificati nello Storage.
     * Restituisce `null` se l'id non esiste, appartiene a un altro condominio o non è pubblicato.
     */
    async dettaglioEsercizio(
      esercizioId: string,
      condominioId: string,
    ): Promise<DettaglioEsercizioSpese | null> {
      if (!esercizioId || !condominioId) return null;

      const { data: rigaEsercizio, error: erroreEsercizio } = await db
        .from('esercizi_contabili')
        .select('id, condominio_id, anno, data_inizio, data_fine, stato')
        .eq('id', esercizioId)
        .maybeSingle();

      if (erroreEsercizio) throw erroreEsercizio;
      if (
        !rigaEsercizio ||
        !esercizioVisibileA(
          { condominioId: rigaEsercizio.condominio_id, stato: rigaEsercizio.stato },
          condominioId,
        ) ||
        !statoEsercizioVisibile(rigaEsercizio.stato)
      ) {
        return null;
      }

      const [rispostaMovimenti, rispostaPianoConti] = await Promise.all([
        db
          .from('movimenti_contabili')
          .select('id, esercizio_id, data, importo, segno, sottoconto_id, descrizione, doc_allegato_id')
          .eq('esercizio_id', rigaEsercizio.id)
          .eq('segno', '-')
          .order('data', { ascending: false }),
        db
          .from('piano_dei_conti')
          .select('id, codice, descrizione_macro')
          .eq('condominio_id', condominioId),
      ]);

      const righeMovimenti = unwrap(rispostaMovimenti);
      const righePiano = unwrap(rispostaPianoConti);

      const mappaPiano = new Map(righePiano.map((p) => [p.id, p]));
      const sottocontiIds = [
        ...new Set(righeMovimenti.flatMap((m) => (m.sottoconto_id ? [m.sottoconto_id] : []))),
      ];

      const righeSottoconti =
        sottocontiIds.length > 0
          ? unwrap(
              await db
                .from('sottoconti')
                .select('id, piano_conto_id, descrizione_micro')
                .in('id', sottocontiIds),
            )
          : [];
      const mappaSottoconti = new Map(righeSottoconti.map((s) => [s.id, s]));

      const docIds = [
        ...new Set(righeMovimenti.flatMap((m) => (m.doc_allegato_id ? [m.doc_allegato_id] : []))),
      ];
      const mappaDocumenti = await risolviDocumentiAllegati(docIds, condominioId);

      const movimentiGrezzi: MovimentoSpesa[] = righeMovimenti.map((m) => {
        const sottoconto = m.sottoconto_id ? mappaSottoconti.get(m.sottoconto_id) : undefined;
        const macro = sottoconto ? mappaPiano.get(sottoconto.piano_conto_id) : undefined;
        const segno: '-' | '+' = m.segno === '+' ? '+' : '-';
        return {
          id: m.id,
          esercizioId: m.esercizio_id,
          data: m.data,
          descrizione: m.descrizione?.trim() || 'Spesa condominiale',
          importo: Number(m.importo),
          segno,
          sottocontoId: sottoconto?.id ?? m.sottoconto_id ?? null,
          sottocontoDescrizione: sottoconto?.descrizione_micro ?? SOTTOCONTO_PREDEFINITO,
          macroId: macro?.id ?? null,
          macroCodice: macro?.codice ?? null,
          macroDescrizione: macro?.descrizione_macro ?? MACRO_CATEGORIA_PREDEFINITA,
          documentoAllegato: m.doc_allegato_id ? (mappaDocumenti.get(m.doc_allegato_id) ?? null) : null,
        };
      });

      const movimenti = ordinaMovimentiSpese(movimentiGrezzi, 'data-desc');
      const totaleSpese = calcolaTotaleSpese(movimenti);
      const totaliMacro = totaliPerMacroCategoria(movimenti);
      const documentiAllegati = raccogliDocumentiAllegati(movimenti);

      return {
        esercizio: {
          id: rigaEsercizio.id,
          condominioId: rigaEsercizio.condominio_id,
          anno: rigaEsercizio.anno,
          dataInizio: rigaEsercizio.data_inizio,
          dataFine: rigaEsercizio.data_fine,
          stato: rigaEsercizio.stato,
          totaleSpese,
          numeroMovimenti: movimenti.length,
        },
        movimenti,
        totaliMacro,
        documentiAllegati,
      };
    },

    /**
     * Genera un link firmato a tempo (10 minuti, mai pubblico) per scaricare o aprire
     * il documento allegato verificato nel bucket privato `documenti-condominio`.
     */
    async urlDocumentoAllegato(percorsoStorage: string, condominioId?: string): Promise<string> {
      const valido = percorsoDocumentoAllegato(percorsoStorage, condominioId);
      if (!valido) {
        throw new Error('Percorso del documento allegato non valido.');
      }
      const { data, error } = await db.storage
        .from(BUCKET_DOCUMENTI)
        .createSignedUrl(valido, DURATA_LINK_SECONDI);
      if (error || !data?.signedUrl) {
        throw error ?? new Error('Impossibile generare il link al documento allegato.');
      }
      return data.signedUrl;
    },
  };
}

export type SpeseService = ReturnType<typeof createSpeseService>;
