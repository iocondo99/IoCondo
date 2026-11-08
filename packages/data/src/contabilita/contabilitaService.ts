import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import type {
  IMovimentoContabile,
  IQuotaMillesimale,
  IRipartoSpesa,
  ITabellaMillesimale,
  IVoceSpesaCatalogo,
  TablesInsert,
  TablesUpdate,
} from '@iocondo/shared-types';

interface RisultatoSupabase<T> {
  data: T;
  error: { message: string; code?: string; details?: string } | null;
}

function unwrap<T>(res: RisultatoSupabase<T>): NonNullable<T> {
  if (res.error) {
    throw new Error(res.error.message || 'Errore query Supabase');
  }
  if (res.data === null || res.data === undefined) {
    throw new Error('Nessun dato restituito dalla query Supabase');
  }
  return res.data;
}

function assertOk(res: { error: { message: string } | null }): void {
  if (res.error) {
    throw new Error(res.error.message || 'Errore operazione Supabase');
  }
}
import {
  assertQuadraturaMillesimi,
  calcolaGiorniInclusivi,
  centsToEuro,
  normalizzaCentesimi,
  VERSIONE_MOTORE_CALCOLO,
  type Centesimi,
  type CentesimiInput,
  type ConsumoUnitaInput,
  type PeriodoTitolaritaInput,
  type StimeMancantiMapOrArray,
} from './contabilitaLogic.ts';
import {
  bloccaCancellazioneMovimento,
  calcolaEValidaFatturaFornitore,
  calcolaMenuChiPaga,
  creaScritturaStorno,
  ErroreModificaEconomicaVietata,
  ordinaRegistroCronologico,
  rilevaRitardoRegistrazione,
  risolviTagSpesaConTraccia,
  validaEccezioneContoCorrente,
  validaGiustificativoAllegato,
  validaModificaMovimento,
  verificaCompletezzaGiustificativiEsercizio,
  VOCI_SPESA_CATALOGO_DEFAULT,
  type AttoDerogaTipo,
  type CriterioChiPaga,
  type DerogaPersonalizzataInput,
  type RisultatoFatturaFornitore,
  type RisultatoMenuChiPaga,
  type RisultatoRitardoRegistrazione,
  type RisultatoValidazioneEccezioneCc,
  type RisultatoValidazioneGiustificativo,
  type StatoApprovazioneTabella,
  type StatoSpesa,
  type TabellaMillesimalePerRiparto,
  type TagSpesa,
  type TipoTabellaMillesimale,
  type UnitaCondominioRiparto,
} from './registroContabileLogic.ts';

export interface FiltriRegistroContabile {
  esercizioId?: string;
  gestioneId?: string;
  statoSpesa?: StatoSpesa;
  soloEccezioniFuoriConto?: boolean;
  soloIncompleti?: boolean;
  soloInRitardo?: boolean;
  direzione?: 'asc' | 'desc';
}

export interface RigaRegistroContabileView {
  movimento: IMovimentoContabile;
  ritardoRegistrazione: RisultatoRitardoRegistrazione;
  giustificativo: RisultatoValidazioneGiustificativo;
  inElencoControlloFuoriConto: boolean;
}

export interface RegistraMovimentoInput {
  condominioId: string;
  esercizioId: string;
  gestioneId?: string | null;
  voceSpesaId?: string | null;
  sottocontoId?: string | null;
  fornitoreId?: string | null;
  dataMovimento: string;
  dataRegistrazione?: string;
  importoCent: CentesimiInput;
  segno: '+' | '-';
  descrizione: string;
  docAllegatoId?: string | null;
  improntaFileGiustificativo?: string | null;
  contenutoFileGiustificativo?: string | Uint8Array | null;
  tipoMimeGiustificativo?: string | null;
  eccezioneContoCorrente?: boolean;
  motivoEccezioneCc?: string | null;
  tagSpesa?: TagSpesa;
  competenzaDa?: string | null;
  competenzaA?: string | null;
  numeroProgressivo?: number | null;
  fondoId?: string | null;
  deliberaRiferimento?: string | null;
  autoreId?: string | null;
}

export interface RegistraMovimentoOutput {
  movimento: IMovimentoContabile;
  ritardoRegistrazione: RisultatoRitardoRegistrazione;
  giustificativo: RisultatoValidazioneGiustificativo;
  eccezioneCc: RisultatoValidazioneEccezioneCc;
  avvisi: string[];
}

export interface AggiornaMovimentoInput {
  descrizione?: string;
  docAllegatoId?: string | null;
  improntaFileGiustificativo?: string | null;
  contenutoFileGiustificativo?: string | Uint8Array | null;
  tipoMimeGiustificativo?: string | null;
  numeroFattura?: string | null;
  dataScadenzaFattura?: string | null;
  deliberaRiferimento?: string | null;
  motivoEccezioneCc?: string | null;
  [chiave: string]: unknown;
}

export interface StornaMovimentoInput {
  movimentoId: string;
  condominioId: string;
  motivoStorno: string;
  dataStorno?: string;
  dataRegistrazioneStorno?: string;
  autoreId?: string | null;
}

export interface StornaMovimentoOutput {
  movimentoOriginaleAggiornato: IMovimentoContabile;
  scritturaStorno: IMovimentoContabile;
  saldoNettoCent: 0;
}

export interface RegistraFatturaFornitoreServiceInput {
  condominioId: string;
  esercizioId: string;
  gestioneId?: string | null;
  voceSpesaId?: string | null;
  sottocontoId?: string | null;
  fornitoreId: string;
  codiceFiscaleFornitore?: string | null;
  partitaIvaFornitore?: string | null;
  numeroFattura: string;
  dataFattura: string;
  dataRegistrazione?: string;
  dataScadenzaFattura?: string | null;
  competenzaDa: string;
  competenzaA: string;
  imponibileCent: CentesimiInput;
  ivaCent?: CentesimiInput;
  aliquotaIvaPerc?: number;
  ritenutaAccontoCent?: CentesimiInput;
  ritenutaAliquotaPerc?: number | null;
  totaleFatturaCent?: CentesimiInput;
  descrizione?: string;
  tagSpesa?: TagSpesa;
  docAllegatoId?: string | null;
  improntaFileGiustificativo?: string | null;
  contenutoFileGiustificativo?: string | Uint8Array | null;
  tipoMimeGiustificativo?: string | null;
  eccezioneContoCorrente?: boolean;
  motivoEccezioneCc?: string | null;
  numeroProgressivo?: number | null;
  autoreId?: string | null;
}

export interface RegistraFatturaFornitoreOutput {
  movimento: IMovimentoContabile;
  fattura: RisultatoFatturaFornitore;
  ritardoRegistrazione: RisultatoRitardoRegistrazione;
  giustificativo: RisultatoValidazioneGiustificativo;
  avvisi: string[];
}

export interface RegistraSpesaConRipartoInput {
  condominioId: string;
  esercizioId: string;
  gestioneId?: string | null;
  voceSpesaId?: string | null;
  sottocontoId?: string | null;
  fornitoreId?: string | null;
  dataMovimento: string;
  dataRegistrazione?: string;
  importoCent: CentesimiInput;
  descrizione: string;
  /** Tag obbligatorio `ORDINARIA` o `STRAORDINARIA` (o risolto dal default della voce di catalogo, RC-C1). */
  tagSpesa?: TagSpesa;
  motivoCambioTag?: string | null;
  competenzaDa: string;
  competenzaA: string;
  chiPaga?: CriterioChiPaga;
  tabellaMillesimaleId?: string | null;
  palazzoId?: string | null;
  scalaColonnaId?: string | null;
  personalizzato?: DerogaPersonalizzataInput | null;
  consumi?: {
    consumiUnita: readonly ConsumoUnitaInput[];
    stimeMancanti?: StimeMancantiMapOrArray;
  } | null;
  docAllegatoId?: string | null;
  improntaFileGiustificativo?: string | null;
  contenutoFileGiustificativo?: string | Uint8Array | null;
  tipoMimeGiustificativo?: string | null;
  eccezioneContoCorrente?: boolean;
  motivoEccezioneCc?: string | null;
  deliberaRiferimento?: string | null;
  fondoId?: string | null;
  imponibileCent?: CentesimiInput | null;
  ivaCent?: CentesimiInput | null;
  ritenutaAccontoCent?: CentesimiInput | null;
  ritenutaAliquotaPerc?: number | null;
  numeroFattura?: string | null;
  dataScadenzaFattura?: string | null;
  quotaInquilinoPerc?: number;
  isAPeriodo?: boolean;
  periodiTitolaritaPerUnita?: Readonly<Record<string, readonly PeriodoTitolaritaInput[]>>;
  /** Dati opzionali già in memoria (se omessi vengono caricati da Supabase). */
  unitaCondominio?: readonly UnitaCondominioRiparto[];
  tabellaMillesimale?: TabellaMillesimalePerRiparto | null;
  salvaComeBozza?: boolean;
  numeroProgressivo?: number | null;
  autoreId?: string | null;
}

export interface RegistraSpesaConRipartoOutput {
  movimento: IMovimentoContabile;
  riparti: IRipartoSpesa[];
  risultatoRiparto: RisultatoMenuChiPaga;
  ritardoRegistrazione: RisultatoRitardoRegistrazione;
  giustificativo: RisultatoValidazioneGiustificativo;
  eccezioneCc: RisultatoValidazioneEccezioneCc;
  avvisi: string[];
}

export interface CreaRevisioneTabellaInput {
  condominioId: string;
  tabellaPrecedenteId: string;
  validaDa: string;
  statoApprovazione?: StatoApprovazioneTabella;
  dataApprovazione?: string | null;
  deliberaRiferimento?: string | null;
  totaleAtteso?: number;
  quote: ReadonlyArray<{ unitaId: string; valoreMillesimale: number }>;
  autoreId?: string | null;
}

const dataOggiIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * Servizio per il Registro Cronologico di Contabilità, il Catalogo Voci e la Gestione Spese
 * (Sezioni 4 e 5 dei requisiti contabili: RC-A1..A5, RC-B1..B5, RC-C1..C8).
 * Riceve `TypedSupabaseClient` tramite dependency injection (nessuna istanza singleton).
 */
export function createContabilitaService(db: TypedSupabaseClient) {
  /**
   * Calcola il prossimo numero progressivo del movimento per il condominio e l'esercizio.
   */
  async function prossimoNumeroProgressivo(
    condominioId: string,
    esercizioId: string,
  ): Promise<number> {
    const righe = unwrap(
      await db
        .from('movimenti_contabili')
        .select('numero_progressivo')
        .eq('condominio_id', condominioId)
        .eq('esercizio_id', esercizioId),
    );
    let maxProg = 0;
    for (const r of righe) {
      if (typeof r.numero_progressivo === 'number' && r.numero_progressivo > maxProg) {
        maxProg = r.numero_progressivo;
      }
    }
    return maxProg + 1;
  }

  /**
   * Aggiorna il flag `registro_contabilita_completo` sull'esercizio contabile
   * verificando se tutti i movimenti attivi hanno giustificativo e impronta validi (RC-B3, RC-K1).
   */
  async function aggiornaStatoCompletezzaRegistroEsercizio(
    condominioId: string,
    esercizioId: string,
  ): Promise<boolean> {
    const movimenti = unwrap(
      await db
        .from('movimenti_contabili')
        .select('id, descrizione, stato_spesa, storno_di_id, doc_allegato_id, impronta_file_giustificativo')
        .eq('condominio_id', condominioId)
        .eq('esercizio_id', esercizioId),
    );
    const esito = verificaCompletezzaGiustificativiEsercizio(movimenti);
    await db
      .from('esercizi_contabili')
      .update({ registro_contabilita_completo: esito.registroCompleto })
      .eq('id', esercizioId)
      .eq('condominio_id', condominioId);
    return esito.registroCompleto;
  }

  /**
   * Carica le unità del condominio con i rispettivi titolari attivi per il riparto.
   */
  async function caricaUnitaCondominioPerRiparto(
    condominioId: string,
  ): Promise<UnitaCondominioRiparto[]> {
    const palazzi = unwrap(
      await db
        .from('palazzi')
        .select('id')
        .eq('condominio_id', condominioId),
    );
    if (palazzi.length === 0) return [];

    const palazzoIds = palazzi.map((p) => p.id);
    const unitaRows = unwrap(
      await db
        .from('unita_immobiliari')
        .select('id, palazzo_id, scala_colonna_id, interno')
        .in('palazzo_id', palazzoIds)
        .order('interno'),
    );
    if (unitaRows.length === 0) return [];

    const unitaIds = unitaRows.map((u) => u.id);
    const anagraficheRows = unwrap(
      await db
        .from('anagrafiche_unita')
        .select('unita_id, utente_id, soggetto_id, tipo_possesso, ruolo_titolarita, is_referente_bollettino, data_fine')
        .in('unita_id', unitaIds)
        .is('data_fine', null),
    );

    const perUnita = new Map<
      string,
      {
        utenteId: string | null;
        soggettoId: string | null;
        haConduttoreAttivo: boolean;
        haUsufruttuarioAttivo: boolean;
      }
    >();

    for (const a of anagraficheRows) {
      const curr = perUnita.get(a.unita_id) ?? {
        utenteId: null,
        soggettoId: null,
        haConduttoreAttivo: false,
        haUsufruttuarioAttivo: false,
      };
      const ruolo = a.ruolo_titolarita ?? (a.tipo_possesso === 'INQUILINO' ? 'CONDUTTORE' : 'PROPRIETARIO');
      if (ruolo === 'CONDUTTORE' || a.tipo_possesso === 'INQUILINO') {
        curr.haConduttoreAttivo = true;
      } else if (ruolo === 'USUFRUTTUARIO') {
        curr.haUsufruttuarioAttivo = true;
        if (!curr.utenteId) {
          curr.utenteId = a.utente_id;
          curr.soggettoId = a.soggetto_id ?? null;
        }
      } else {
        if (!curr.utenteId || a.is_referente_bollettino) {
          curr.utenteId = a.utente_id;
          curr.soggettoId = a.soggetto_id ?? null;
        }
      }
      perUnita.set(a.unita_id, curr);
    }

    return unitaRows.map((u) => {
      const info = perUnita.get(u.id);
      return {
        id: u.id,
        palazzoId: u.palazzo_id,
        scalaColonnaId: u.scala_colonna_id,
        interno: u.interno,
        utenteId: info?.utenteId ?? null,
        soggettoId: info?.soggettoId ?? null,
        haConduttoreAttivo: info?.haConduttoreAttivo ?? false,
        haUsufruttuarioAttivo: info?.haUsufruttuarioAttivo ?? false,
      };
    });
  }

  /**
   * Carica una tabella millesimale e le relative quote dal DB.
   */
  async function caricaTabellaMillesimalePerRiparto(
    condominioId: string,
    tabellaId?: string | null,
    chiPaga?: CriterioChiPaga,
    palazzoId?: string | null,
    scalaColonnaId?: string | null,
  ): Promise<TabellaMillesimalePerRiparto> {
    let tabRow: ITabellaMillesimale | null = null;

    if (tabellaId) {
      const { data, error } = await db
        .from('tabelle_millesimali')
        .select('*')
        .eq('id', tabellaId)
        .eq('condominio_id', condominioId)
        .maybeSingle();
      if (error) throw error;
      tabRow = data;
    } else {
      const tutteTabelle = unwrap(
        await db
          .from('tabelle_millesimali')
          .select('*')
          .eq('condominio_id', condominioId)
          .is('valida_a', null)
          .order('versione', { ascending: false }),
      );

      if (chiPaga === 'PALAZZO_SCALA') {
        tabRow =
          tutteTabelle.find(
            (t) =>
              (scalaColonnaId && t.scala_colonna_id === scalaColonnaId) ||
              (palazzoId && t.palazzo_id === palazzoId),
          ) ??
          tutteTabelle.find((t) => (t.tipo ?? 'PROPRIETA') === 'PROPRIETA') ??
          tutteTabelle[0] ??
          null;
      } else {
        tabRow =
          tutteTabelle.find((t) => (t.tipo ?? 'PROPRIETA') === 'PROPRIETA') ??
          tutteTabelle[0] ??
          null;
      }
    }

    if (!tabRow) {
      throw new Error(
        `Tabella millesimale non trovata per il condominio "${condominioId}". Configurare almeno una tabella millesimale.`,
      );
    }

    const quoteRows = unwrap(
      await db
        .from('quote_millesimali')
        .select('unita_id, valore_millesimale, valore_millesimi_int')
        .eq('tabella_id', tabRow.id),
    );

    return {
      id: tabRow.id,
      nome: tabRow.nome,
      tipo: (tabRow.tipo as TipoTabellaMillesimale | undefined) ?? 'PROPRIETA',
      versione: tabRow.versione ?? 1,
      statoApprovazione: (tabRow.stato_approvazione as StatoApprovazioneTabella | undefined) ?? 'APPROVATA',
      palazzoId: tabRow.palazzo_id,
      scalaColonnaId: tabRow.scala_colonna_id,
      totale: Number(tabRow.totale ?? 1000),
      quote: quoteRows.map((q) => ({
        unitaId: q.unita_id,
        millesimi:
          typeof q.valore_millesimi_int === 'number' && q.valore_millesimi_int > 0
            ? q.valore_millesimi_int / 1000
            : Number(q.valore_millesimale),
      })),
    };
  }

  return {
    // =========================================================================
    // 1. CATALOGO VOCI DI SPESA E TABELLE MILLESIMALI VERSIONATE (RC-A3..A5, RC-C2)
    // =========================================================================

    /**
     * Restituisce il catalogo delle voci di spesa configurate per il condominio (RC-C2).
     */
    async listVociCatalogo(
      condominioId: string,
      soloAttive: boolean = true,
    ): Promise<IVoceSpesaCatalogo[]> {
      let query = db
        .from('voci_spesa_catalogo')
        .select('*')
        .eq('condominio_id', condominioId)
        .order('nome');
      if (soloAttive) {
        query = query.eq('attiva', true);
      }
      return unwrap(await query);
    },

    /**
     * Inizializza le 10 voci di spesa standard per un condominio se assenti (RC-C2).
     */
    async inizializzaCatalogoDefault(
      condominioId: string,
      autoreId?: string | null,
    ): Promise<IVoceSpesaCatalogo[]> {
      const esistenti = await this.listVociCatalogo(condominioId, false);
      const codiciEsistenti = new Set(esistenti.map((v) => v.codice));

      const mancanti: TablesInsert<'voci_spesa_catalogo'>[] = VOCI_SPESA_CATALOGO_DEFAULT.filter(
        (v) => !codiciEsistenti.has(v.codice),
      ).map((v) => ({
        condominio_id: condominioId,
        codice: v.codice,
        nome: v.nome,
        tag_default: v.tagDefault,
        criterio_default: v.criterioDefault,
        quota_inquilino_default_perc: v.quotaInquilinoDefaultPerc,
        is_a_periodo: v.isAPeriodo,
        is_compenso_admin: v.isCompensoAdmin,
        attiva: true,
        autore_id: autoreId ?? null,
      }));

      if (mancanti.length > 0) {
        assertOk(await db.from('voci_spesa_catalogo').insert(mancanti));
      }

      return this.listVociCatalogo(condominioId, false);
    },

    /**
     * Crea una nuova voce nel catalogo delle spese del condominio (RC-C2).
     */
    async creaVoceCatalogo(
      input: TablesInsert<'voci_spesa_catalogo'>,
    ): Promise<IVoceSpesaCatalogo> {
      return unwrap(
        await db.from('voci_spesa_catalogo').insert(input).select('*').single(),
      );
    },

    /**
     * Aggiorna una voce esistente del catalogo delle spese (RC-C2).
     */
    async aggiornaVoceCatalogo(
      id: string,
      condominioId: string,
      patch: TablesUpdate<'voci_spesa_catalogo'>,
    ): Promise<IVoceSpesaCatalogo> {
      return unwrap(
        await db
          .from('voci_spesa_catalogo')
          .update(patch)
          .eq('id', id)
          .eq('condominio_id', condominioId)
          .select('*')
          .single(),
      );
    },

    /**
     * Crea una nuova versione di una tabella millesimale esistente con data di inizio validità (`valida_da`),
     * chiudendo la validità della versione precedente senza alterare i riparti o rendiconti storici (RC-A4).
     */
    async creaRevisioneTabellaMillesimale(
      input: CreaRevisioneTabellaInput,
    ): Promise<{ tabella: ITabellaMillesimale; quote: IQuotaMillesimale[] }> {
      const totaleAtteso = input.totaleAtteso ?? 1000;
      assertQuadraturaMillesimi(
        input.quote.map((q) => ({ unitaId: q.unitaId, millesimi: q.valoreMillesimale })),
        totaleAtteso,
      );

      const precedente = unwrap(
        await db
          .from('tabelle_millesimali')
          .select('*')
          .eq('id', input.tabellaPrecedenteId)
          .eq('condominio_id', input.condominioId)
          .single(),
      );

      const nuovaVersione = (precedente.versione ?? 1) + 1;

      // Chiude la validità della tabella precedente
      assertOk(
        await db
          .from('tabelle_millesimali')
          .update({ valida_a: input.validaDa })
          .eq('id', precedente.id)
          .eq('condominio_id', input.condominioId),
      );

      const nuovaTabella = unwrap(
        await db
          .from('tabelle_millesimali')
          .insert({
            condominio_id: input.condominioId,
            palazzo_id: precedente.palazzo_id,
            scala_colonna_id: precedente.scala_colonna_id,
            nome: precedente.nome,
            totale: totaleAtteso,
            tipo: precedente.tipo ?? 'PROPRIETA',
            origine: precedente.origine ?? 'INSERITA',
            tabella_sorgente_id: precedente.tabella_sorgente_id ?? null,
            stato_approvazione: input.statoApprovazione ?? 'APPROVATA',
            data_approvazione: input.dataApprovazione ?? null,
            delibera_riferimento: input.deliberaRiferimento ?? null,
            valida_da: input.validaDa,
            valida_a: null,
            versione: nuovaVersione,
            precedente_id: precedente.id,
            autore_id: input.autoreId ?? null,
          })
          .select('*')
          .single(),
      );

      const quotePayload: TablesInsert<'quote_millesimali'>[] = input.quote.map((q) => ({
        condominio_id: input.condominioId,
        tabella_id: nuovaTabella.id,
        unita_id: q.unitaId,
        valore_millesimale: q.valoreMillesimale,
        valore_millesimi_int: Math.round(q.valoreMillesimale * 1000),
        autore_id: input.autoreId ?? null,
      }));

      const quoteInserite = unwrap(
        await db.from('quote_millesimali').insert(quotePayload).select('*'),
      );

      return { tabella: nuovaTabella, quote: quoteInserite };
    },

    // =========================================================================
    // 2. CRUD REGISTRO CRONOLOGICO DI CONTABILITA' E MOVIMENTI (RC-B1..B4)
    // =========================================================================

    /**
     * Restituisce le righe del registro cronologico di contabilità per il condominio,
     * arricchite con la rilevazione del ritardo > 30gg (RC-B2), lo stato del giustificativo (RC-B3)
     * e la marcatura di eccezione fuori conto corrente (RC-B1).
     */
    async listRegistroContabile(
      condominioId: string,
      filtri: FiltriRegistroContabile = {},
    ): Promise<RigaRegistroContabileView[]> {
      let query = db
        .from('movimenti_contabili')
        .select('*')
        .eq('condominio_id', condominioId);

      if (filtri.esercizioId) {
        query = query.eq('esercizio_id', filtri.esercizioId);
      }
      if (filtri.gestioneId) {
        query = query.eq('gestione_id', filtri.gestioneId);
      }
      if (filtri.statoSpesa) {
        query = query.eq('stato_spesa', filtri.statoSpesa);
      }
      if (filtri.soloEccezioniFuoriConto) {
        query = query.eq('eccezione_conto_corrente', true);
      }

      const righe = unwrap(await query);
      const ordinate = ordinaRegistroCronologico(righe, filtri.direzione ?? 'asc');

      const arricchite: RigaRegistroContabileView[] = ordinate.map((m) => {
        const ritardoRegistrazione = rilevaRitardoRegistrazione({
          dataMovimento: m.data,
          dataRegistrazione: m.data_registrazione ?? m.data,
        });
        const giustificativo = validaGiustificativoAllegato({
          docAllegatoId: m.doc_allegato_id,
          improntaFile: m.impronta_file_giustificativo,
        });
        return {
          movimento: m,
          ritardoRegistrazione,
          giustificativo,
          inElencoControlloFuoriConto: Boolean(m.eccezione_conto_corrente),
        };
      });

      return arricchite.filter((item) => {
        if (filtri.soloIncompleti && item.giustificativo.spesaCompleta) {
          return false;
        }
        if (filtri.soloInRitardo && !item.ritardoRegistrazione.inRitardo) {
          return false;
        }
        return true;
      });
    },

    /**
     * Elenco di controllo dei movimenti registrati fuori dal conto corrente condominiale (RC-B1).
     */
    async listMovimentiFuoriConto(
      condominioId: string,
      esercizioId?: string,
    ): Promise<IMovimentoContabile[]> {
      const righe = await this.listRegistroContabile(condominioId, {
        esercizioId,
        soloEccezioniFuoriConto: true,
      });
      return righe.map((r) => r.movimento);
    },

    /**
     * Carica un singolo movimento contabile con le relative righe di riparto per unità.
     */
    async getMovimentoConRiparti(
      movimentoId: string,
      condominioId: string,
    ): Promise<{ movimento: IMovimentoContabile; riparti: IRipartoSpesa[] } | null> {
      const { data: movimento, error } = await db
        .from('movimenti_contabili')
        .select('*')
        .eq('id', movimentoId)
        .eq('condominio_id', condominioId)
        .maybeSingle();
      if (error) throw error;
      if (!movimento) return null;

      const riparti = unwrap(
        await db
          .from('riparti_spese')
          .select('*')
          .eq('movimento_id', movimentoId)
          .eq('condominio_id', condominioId),
      );

      return { movimento, riparti };
    },

    /**
     * Registra un movimento nel registro cronologico di contabilità (RC-B1, RC-B2, RC-B3).
     */
    async registraMovimento(input: RegistraMovimentoInput): Promise<RegistraMovimentoOutput> {
      const importoCent = normalizzaCentesimi(input.importoCent);
      if (importoCent <= 0) {
        throw new RangeError(`L'importo del movimento deve essere maggiore di zero: ${importoCent}`);
      }

      const descrizione = input.descrizione?.trim() ?? '';
      if (!descrizione) {
        throw new Error('La causale/descrizione del movimento è obbligatoria.');
      }

      const dataMovimento = input.dataMovimento.trim().slice(0, 10);
      const dataRegistrazione = (input.dataRegistrazione ?? dataOggiIso()).trim().slice(0, 10);

      // 1. Validazione eccezione fuori conto corrente (RC-B1)
      const eccezioneCc = validaEccezioneContoCorrente({
        eccezioneContoCorrente: input.eccezioneContoCorrente,
        motivoEccezioneCc: input.motivoEccezioneCc,
      });
      if (!eccezioneCc.valido) {
        throw new Error(eccezioneCc.errore ?? 'Eccezione conto corrente non valida.');
      }

      // 2. Rilevazione ritardo di registrazione > 30 giorni (RC-B2)
      const ritardoRegistrazione = rilevaRitardoRegistrazione({
        dataMovimento,
        dataRegistrazione,
      });

      // 3. Validazione giustificativo e impronta file (RC-B3)
      const giustificativo = validaGiustificativoAllegato({
        docAllegatoId: input.docAllegatoId,
        improntaFile: input.improntaFileGiustificativo,
        contenutoFile: input.contenutoFileGiustificativo,
        tipoMime: input.tipoMimeGiustificativo,
      });
      if (!giustificativo.valido) {
        throw new Error(giustificativo.errore ?? 'Giustificativo non valido.');
      }

      const avvisi: string[] = [];
      if (eccezioneCc.avviso) avvisi.push(eccezioneCc.avviso);
      if (ritardoRegistrazione.messaggioAlert) avvisi.push(ritardoRegistrazione.messaggioAlert);
      if (giustificativo.avviso) avvisi.push(giustificativo.avviso);

      const numeroProgressivo =
        input.numeroProgressivo ??
        (await prossimoNumeroProgressivo(input.condominioId, input.esercizioId));

      const statoSpesa: StatoSpesa = giustificativo.spesaCompleta ? 'REGISTRATA' : 'BOZZA';

      const payload: TablesInsert<'movimenti_contabili'> = {
        condominio_id: input.condominioId,
        esercizio_id: input.esercizioId,
        gestione_id: input.gestioneId ?? null,
        voce_spesa_id: input.voceSpesaId ?? null,
        sottoconto_id: input.sottocontoId ?? null,
        fornitore_id: input.fornitoreId ?? null,
        numero_progressivo: numeroProgressivo,
        data: dataMovimento,
        data_registrazione: dataRegistrazione,
        importo: centsToEuro(importoCent),
        importo_centesimi: importoCent,
        segno: input.segno,
        descrizione,
        doc_allegato_id: input.docAllegatoId ?? null,
        impronta_file_giustificativo: giustificativo.improntaNormalizzata,
        tag_spesa: input.tagSpesa ?? 'ORDINARIA',
        competenza_da: input.competenzaDa ?? dataMovimento,
        competenza_a: input.competenzaA ?? dataMovimento,
        stato_spesa: statoSpesa,
        eccezione_conto_corrente: eccezioneCc.eccezioneContoCorrente,
        motivo_eccezione_cc: eccezioneCc.motivoEccezioneCc,
        fondo_id: input.fondoId ?? null,
        delibera_riferimento: input.deliberaRiferimento ?? null,
        versione_motore_calcolo: VERSIONE_MOTORE_CALCOLO,
        autore_id: input.autoreId ?? null,
      };

      const movimento = unwrap(
        await db.from('movimenti_contabili').insert(payload).select('*').single(),
      );

      await aggiornaStatoCompletezzaRegistroEsercizio(input.condominioId, input.esercizioId);

      return {
        movimento,
        ritardoRegistrazione,
        giustificativo,
        eccezioneCc,
        avvisi,
      };
    },

    /**
     * Aggiorna i campi non economici (es. causale/descrizione, allegato e impronta) di un movimento (RC-B4).
     * Se il movimento è in stato `REGISTRATA` o `STORNATA`, qualsiasi tentativo di alterare importi o criteri
     * solleva `ErroreModificaEconomicaVietata`.
     */
    async aggiornaMovimento(
      movimentoId: string,
      condominioId: string,
      patch: AggiornaMovimentoInput,
    ): Promise<IMovimentoContabile> {
      const originale = unwrap(
        await db
          .from('movimenti_contabili')
          .select('*')
          .eq('id', movimentoId)
          .eq('condominio_id', condominioId)
          .single(),
      );

      // Mappa eventuali chiavi camelCase in snake_case per il controllo di RC-B4
      const patchDb: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        if (k === 'descrizione') patchDb.descrizione = typeof v === 'string' ? v.trim() : v;
        else if (k === 'docAllegatoId') patchDb.doc_allegato_id = v;
        else if (k === 'improntaFileGiustificativo') patchDb.impronta_file_giustificativo = v;
        else if (k === 'numeroFattura') patchDb.numero_fattura = v;
        else if (k === 'dataScadenzaFattura') patchDb.data_scadenza_fattura = v;
        else if (k === 'deliberaRiferimento') patchDb.delibera_riferimento = v;
        else if (k === 'motivoEccezioneCc') patchDb.motivo_eccezione_cc = v;
        else if (k === 'importoCent') patchDb.importo_centesimi = v;
        else if (k !== 'contenutoFileGiustificativo' && k !== 'tipoMimeGiustificativo') {
          patchDb[k] = v;
        }
      }

      const esitoModifica = validaModificaMovimento(originale, patchDb);
      if (!esitoModifica.ammessa) {
        throw new ErroreModificaEconomicaVietata(esitoModifica.campiEconomiciToccati);
      }

      if (
        patch.docAllegatoId !== undefined ||
        patch.improntaFileGiustificativo !== undefined ||
        patch.contenutoFileGiustificativo !== undefined
      ) {
        const docId =
          patch.docAllegatoId !== undefined ? patch.docAllegatoId : originale.doc_allegato_id;
        const imp =
          patch.improntaFileGiustificativo !== undefined
            ? patch.improntaFileGiustificativo
            : originale.impronta_file_giustificativo;

        const validazioneGiust = validaGiustificativoAllegato({
          docAllegatoId: docId,
          improntaFile: imp,
          contenutoFile: patch.contenutoFileGiustificativo,
          tipoMime: patch.tipoMimeGiustificativo,
        });
        if (!validazioneGiust.valido) {
          throw new Error(validazioneGiust.errore ?? 'Giustificativo non valido.');
        }
        patchDb.doc_allegato_id = docId ?? null;
        patchDb.impronta_file_giustificativo = validazioneGiust.improntaNormalizzata;
        if (originale.stato_spesa === 'BOZZA' && validazioneGiust.spesaCompleta) {
          patchDb.stato_spesa = 'REGISTRATA';
        }
      }

      const aggiornato = unwrap(
        await db
          .from('movimenti_contabili')
          .update(patchDb as TablesUpdate<'movimenti_contabili'>)
          .eq('id', movimentoId)
          .eq('condominio_id', condominioId)
          .select('*')
          .single(),
      );

      await aggiornaStatoCompletezzaRegistroEsercizio(condominioId, originale.esercizio_id);

      return aggiornato;
    },

    /**
     * Storna un movimento contabile registrando una scrittura contraria collegata all'originale (`storno_di_id`)
     * senza alcuna cancellazione fisica (RC-B4).
     */
    async stornaMovimento(input: StornaMovimentoInput): Promise<StornaMovimentoOutput> {
      const originale = unwrap(
        await db
          .from('movimenti_contabili')
          .select('*')
          .eq('id', input.movimentoId)
          .eq('condominio_id', input.condominioId)
          .single(),
      );

      const numeroProgressivoStorno = await prossimoNumeroProgressivo(
        input.condominioId,
        originale.esercizio_id,
      );

      const stornoGenerato = creaScritturaStorno({
        movimentoOriginale: originale,
        motivoStorno: input.motivoStorno,
        dataStorno: input.dataStorno ?? dataOggiIso(),
        dataRegistrazioneStorno: input.dataRegistrazioneStorno ?? dataOggiIso(),
        numeroProgressivoStorno,
        autoreId: input.autoreId,
      });

      const scritturaStorno = unwrap(
        await db
          .from('movimenti_contabili')
          .insert(stornoGenerato.scritturaContraria)
          .select('*')
          .single(),
      );

      const movimentoOriginaleAggiornato = unwrap(
        await db
          .from('movimenti_contabili')
          .update(stornoGenerato.patchMovimentoOriginale)
          .eq('id', originale.id)
          .eq('condominio_id', input.condominioId)
          .select('*')
          .single(),
      );

      await aggiornaStatoCompletezzaRegistroEsercizio(
        input.condominioId,
        originale.esercizio_id,
      );

      return {
        movimentoOriginaleAggiornato,
        scritturaStorno,
        saldoNettoCent: 0,
      };
    },

    /**
     * Vietato da RC-B4: i movimenti contabili non possono mai essere eliminati; usare `stornaMovimento`.
     */
    async eliminaMovimento(movimentoId?: string): Promise<never> {
      return bloccaCancellazioneMovimento(movimentoId);
    },

    // =========================================================================
    // 3. REGISTRAZIONE FATTURE FORNITORI (RC-B5)
    // =========================================================================

    /**
     * Registra una fattura fornitore nel registro di contabilità con imponibile, IVA,
     * ritenuta d'acconto (solo dato analitico: importo e aliquota, senza F24/CU/770),
     * totale, scadenza e periodo di competenza (RC-B5).
     */
    async registraFatturaFornitore(
      input: RegistraFatturaFornitoreServiceInput,
    ): Promise<RegistraFatturaFornitoreOutput> {
      let cfFornitore = input.codiceFiscaleFornitore;
      let pivaFornitore = input.partitaIvaFornitore;
      let ragioneSociale = 'Fornitore';

      if (cfFornitore === undefined && pivaFornitore === undefined) {
        const { data: fornitoreRow, error: errForn } = await db
          .from('fornitori')
          .select('id, ragione_sociale, p_iva, codice_fiscale')
          .eq('id', input.fornitoreId)
          .maybeSingle();
        if (errForn) throw errForn;
        if (!fornitoreRow) {
          throw new Error(`Fornitore "${input.fornitoreId}" non trovato in anagrafica.`);
        }
        ragioneSociale = fornitoreRow.ragione_sociale;
        cfFornitore = fornitoreRow.codice_fiscale ?? null;
        pivaFornitore = fornitoreRow.p_iva ?? null;
      }

      const fattura = calcolaEValidaFatturaFornitore({
        fornitoreId: input.fornitoreId,
        codiceFiscaleFornitore: cfFornitore,
        partitaIvaFornitore: pivaFornitore,
        numeroFattura: input.numeroFattura,
        dataFattura: input.dataFattura,
        dataScadenzaFattura: input.dataScadenzaFattura,
        competenzaDa: input.competenzaDa,
        competenzaA: input.competenzaA,
        imponibileCent: input.imponibileCent,
        ivaCent: input.ivaCent,
        aliquotaIvaPerc: input.aliquotaIvaPerc,
        ritenutaAccontoCent: input.ritenutaAccontoCent,
        ritenutaAliquotaPerc: input.ritenutaAliquotaPerc,
        totaleFatturaCent: input.totaleFatturaCent,
      });

      if (!fattura.valido) {
        throw new Error(fattura.errore ?? 'Dati fattura fornitore non validi (RC-B5).');
      }

      const dataMovimento = input.dataFattura.trim().slice(0, 10);
      const dataRegistrazione = (input.dataRegistrazione ?? dataOggiIso()).trim().slice(0, 10);

      const eccezioneCc = validaEccezioneContoCorrente({
        eccezioneContoCorrente: input.eccezioneContoCorrente,
        motivoEccezioneCc: input.motivoEccezioneCc,
      });
      if (!eccezioneCc.valido) {
        throw new Error(eccezioneCc.errore ?? 'Eccezione conto corrente non valida.');
      }

      const ritardoRegistrazione = rilevaRitardoRegistrazione({
        dataMovimento,
        dataRegistrazione,
      });

      const giustificativo = validaGiustificativoAllegato({
        docAllegatoId: input.docAllegatoId,
        improntaFile: input.improntaFileGiustificativo,
        contenutoFile: input.contenutoFileGiustificativo,
        tipoMime: input.tipoMimeGiustificativo,
      });
      if (!giustificativo.valido) {
        throw new Error(giustificativo.errore ?? 'Allegato fattura non valido.');
      }

      const avvisi: string[] = [];
      if (eccezioneCc.avviso) avvisi.push(eccezioneCc.avviso);
      if (ritardoRegistrazione.messaggioAlert) avvisi.push(ritardoRegistrazione.messaggioAlert);
      if (giustificativo.avviso) avvisi.push(giustificativo.avviso);

      const numeroProgressivo =
        input.numeroProgressivo ??
        (await prossimoNumeroProgressivo(input.condominioId, input.esercizioId));

      const descrizione =
        input.descrizione?.trim() ||
        `Fattura n. ${fattura.numeroFattura} — ${ragioneSociale}`;

      const statoSpesa: StatoSpesa = giustificativo.spesaCompleta ? 'REGISTRATA' : 'BOZZA';

      const payload: TablesInsert<'movimenti_contabili'> = {
        condominio_id: input.condominioId,
        esercizio_id: input.esercizioId,
        gestione_id: input.gestioneId ?? null,
        voce_spesa_id: input.voceSpesaId ?? null,
        sottoconto_id: input.sottocontoId ?? null,
        fornitore_id: input.fornitoreId,
        numero_progressivo: numeroProgressivo,
        data: dataMovimento,
        data_registrazione: dataRegistrazione,
        importo: centsToEuro(fattura.totaleFatturaCent),
        importo_centesimi: fattura.totaleFatturaCent,
        segno: '-',
        descrizione,
        doc_allegato_id: input.docAllegatoId ?? null,
        impronta_file_giustificativo: giustificativo.improntaNormalizzata,
        tag_spesa: input.tagSpesa ?? 'ORDINARIA',
        competenza_da: fattura.competenzaDa,
        competenza_a: fattura.competenzaA,
        stato_spesa: statoSpesa,
        eccezione_conto_corrente: eccezioneCc.eccezioneContoCorrente,
        motivo_eccezione_cc: eccezioneCc.motivoEccezioneCc,
        imponibile_centesimi: fattura.imponibileCent,
        iva_centesimi: fattura.ivaCent,
        ritenuta_acconto_centesimi: fattura.ritenutaAccontoCent,
        ritenuta_aliquota_perc: fattura.ritenutaAliquotaPerc,
        numero_fattura: fattura.numeroFattura,
        data_scadenza_fattura: fattura.dataScadenzaFattura,
        versione_motore_calcolo: VERSIONE_MOTORE_CALCOLO,
        autore_id: input.autoreId ?? null,
      };

      const movimento = unwrap(
        await db.from('movimenti_contabili').insert(payload).select('*').single(),
      );

      await aggiornaStatoCompletezzaRegistroEsercizio(input.condominioId, input.esercizioId);

      return {
        movimento,
        fattura,
        ritardoRegistrazione,
        giustificativo,
        avvisi,
      };
    },

    // =========================================================================
    // 4. REGISTRAZIONE SPESA E GENERAZIONE RIGHE DI RIPARTO (RC-C1, RC-C3, RC-C4)
    // =========================================================================

    /**
     * Registra una spesa condominiale con tag obbligatorio (`ORDINARIA`/`STRAORDINARIA`),
     * periodo di competenza, validazione giustificativo e generazione atomica delle righe di riparto
     * per unità in `riparti_spese` secondo il menu "Chi paga" (RC-C1, RC-C2, RC-C3, RC-C4).
     */
    async registraSpesaConRiparto(
      input: RegistraSpesaConRipartoInput,
    ): Promise<RegistraSpesaConRipartoOutput> {
      const importoCent = normalizzaCentesimi(input.importoCent);
      if (importoCent <= 0) {
        throw new RangeError(`L'importo della spesa deve essere maggiore di zero: ${importoCent}`);
      }

      const descrizione = input.descrizione?.trim() ?? '';
      if (!descrizione) {
        throw new Error('La descrizione della spesa è obbligatoria.');
      }

      // Verifica intervallo competenza (RC-C1)
      calcolaGiorniInclusivi(input.competenzaDa, input.competenzaA);
      const competenzaDa = input.competenzaDa.trim().slice(0, 10);
      const competenzaA = input.competenzaA.trim().slice(0, 10);
      const dataMovimento = input.dataMovimento.trim().slice(0, 10);
      const dataRegistrazione = (input.dataRegistrazione ?? dataOggiIso()).trim().slice(0, 10);

      // 1. Se è indicata una voce di spesa dal catalogo, carica i suoi default (RC-C1, RC-C2)
      let voceCatalogo: IVoceSpesaCatalogo | null = null;
      if (input.voceSpesaId) {
        const { data: voceRow, error: errVoce } = await db
          .from('voci_spesa_catalogo')
          .select('*')
          .eq('id', input.voceSpesaId)
          .eq('condominio_id', input.condominioId)
          .maybeSingle();
        if (errVoce) throw errVoce;
        voceCatalogo = voceRow;
      }

      // 2. Risolve e valida il tag obbligatorio ORDINARIA / STRAORDINARIA con traccia di eventuale cambio (RC-C1)
      const esitoTag = risolviTagSpesaConTraccia({
        tagSpesa: input.tagSpesa,
        tagDefaultVoce: voceCatalogo?.tag_default ?? null,
        motivoCambioTag: input.motivoCambioTag,
      });

      const criterioVoce =
        voceCatalogo?.criterio_default &&
        ['TUTTI', 'PALAZZO_SCALA', 'TABELLA_SPECIFICA', 'PERSONALIZZATO', 'CONSUMI'].includes(
          voceCatalogo.criterio_default,
        )
          ? (voceCatalogo.criterio_default as CriterioChiPaga)
          : undefined;

      const chiPaga: CriterioChiPaga = input.chiPaga ?? criterioVoce ?? 'TUTTI';
      const quotaInquilinoPerc =
        input.quotaInquilinoPerc ?? Number(voceCatalogo?.quota_inquilino_default_perc ?? 0);
      const isAPeriodo = input.isAPeriodo ?? Boolean(voceCatalogo?.is_a_periodo);

      // 3. Validazione eccezione conto corrente (RC-B1), ritardo > 30gg (RC-B2) e giustificativo (RC-B3)
      const eccezioneCc = validaEccezioneContoCorrente({
        eccezioneContoCorrente: input.eccezioneContoCorrente,
        motivoEccezioneCc: input.motivoEccezioneCc,
      });
      if (!eccezioneCc.valido) {
        throw new Error(eccezioneCc.errore ?? 'Eccezione conto corrente non valida.');
      }

      const ritardoRegistrazione = rilevaRitardoRegistrazione({
        dataMovimento,
        dataRegistrazione,
      });

      const giustificativo = validaGiustificativoAllegato({
        docAllegatoId: input.docAllegatoId,
        improntaFile: input.improntaFileGiustificativo,
        contenutoFile: input.contenutoFileGiustificativo,
        tipoMime: input.tipoMimeGiustificativo,
      });
      if (!giustificativo.valido) {
        throw new Error(giustificativo.errore ?? 'Giustificativo non valido.');
      }

      // 4. Carica unità e tabella millesimale dal DB se non fornite direttamente
      const unitaCondominio =
        input.unitaCondominio ?? (await caricaUnitaCondominioPerRiparto(input.condominioId));

      let tabellaMillesimale: TabellaMillesimalePerRiparto | null =
        input.tabellaMillesimale ?? null;

      if (
        !tabellaMillesimale &&
        (chiPaga === 'TUTTI' || chiPaga === 'PALAZZO_SCALA' || chiPaga === 'TABELLA_SPECIFICA')
      ) {
        const targetTabId = input.tabellaMillesimaleId ?? voceCatalogo?.tabella_default_id ?? null;
        tabellaMillesimale = await caricaTabellaMillesimalePerRiparto(
          input.condominioId,
          targetTabId,
          chiPaga,
          input.palazzoId,
          input.scalaColonnaId,
        );
      }

      // 5. Calcola le righe di riparto secondo il menu "Chi paga" (RC-C3, RC-C4)
      const risultatoRiparto = calcolaMenuChiPaga({
        importoCent,
        chiPaga,
        unitaCondominio,
        tabellaMillesimale,
        palazzoId: input.palazzoId,
        scalaColonnaId: input.scalaColonnaId,
        personalizzato: input.personalizzato,
        consumi: input.consumi,
        tagSpesa: esitoTag.tagSpesa,
        quotaInquilinoPerc,
        isAPeriodo,
        competenzaDa,
        competenzaA,
        periodiTitolaritaPerUnita: input.periodiTitolaritaPerUnita,
      });

      const avvisi: string[] = [];
      if (esitoTag.tracciaCambioTag) avvisi.push(esitoTag.tracciaCambioTag);
      if (eccezioneCc.avviso) avvisi.push(eccezioneCc.avviso);
      if (ritardoRegistrazione.messaggioAlert) avvisi.push(ritardoRegistrazione.messaggioAlert);
      if (giustificativo.avviso) avvisi.push(giustificativo.avviso);
      avvisi.push(...risultatoRiparto.avvisi);

      const numeroProgressivo =
        input.numeroProgressivo ??
        (await prossimoNumeroProgressivo(input.condominioId, input.esercizioId));

      // Una spesa senza giustificativo resta in BOZZA ("incompleta", RC-B3)
      const statoSpesa: StatoSpesa =
        input.salvaComeBozza || !giustificativo.spesaCompleta ? 'BOZZA' : 'REGISTRATA';

      const movPayload: TablesInsert<'movimenti_contabili'> = {
        condominio_id: input.condominioId,
        esercizio_id: input.esercizioId,
        gestione_id: input.gestioneId ?? null,
        voce_spesa_id: input.voceSpesaId ?? null,
        sottoconto_id: input.sottocontoId ?? voceCatalogo?.sottoconto_id ?? null,
        fornitore_id: input.fornitoreId ?? null,
        numero_progressivo: numeroProgressivo,
        data: dataMovimento,
        data_registrazione: dataRegistrazione,
        importo: centsToEuro(importoCent),
        importo_centesimi: importoCent,
        segno: '-',
        descrizione,
        doc_allegato_id: input.docAllegatoId ?? null,
        impronta_file_giustificativo: giustificativo.improntaNormalizzata,
        tag_spesa: esitoTag.tagSpesa,
        competenza_da: competenzaDa,
        competenza_a: competenzaA,
        chi_paga: chiPaga,
        tabella_millesimale_id: risultatoRiparto.tabellaMillesimaleId,
        versione_tabella: risultatoRiparto.versioneTabella,
        palazzo_id: input.palazzoId ?? null,
        scala_colonna_id: input.scalaColonnaId ?? null,
        atto_deroga_tipo: (risultatoRiparto.attoDeroga?.tipo as AttoDerogaTipo | undefined) ?? null,
        atto_deroga_data: risultatoRiparto.attoDeroga?.data ?? null,
        atto_deroga_numero: risultatoRiparto.attoDeroga?.numero ?? null,
        motivazione_deroga: risultatoRiparto.attoDeroga?.motivazione ?? null,
        delibera_riferimento: input.deliberaRiferimento ?? null,
        stato_spesa: statoSpesa,
        eccezione_conto_corrente: eccezioneCc.eccezioneContoCorrente,
        motivo_eccezione_cc: eccezioneCc.motivoEccezioneCc,
        imponibile_centesimi:
          input.imponibileCent !== undefined && input.imponibileCent !== null
            ? normalizzaCentesimi(input.imponibileCent)
            : null,
        iva_centesimi:
          input.ivaCent !== undefined && input.ivaCent !== null
            ? normalizzaCentesimi(input.ivaCent)
            : null,
        ritenuta_acconto_centesimi:
          input.ritenutaAccontoCent !== undefined && input.ritenutaAccontoCent !== null
            ? normalizzaCentesimi(input.ritenutaAccontoCent)
            : null,
        ritenuta_aliquota_perc: input.ritenutaAliquotaPerc ?? null,
        numero_fattura: input.numeroFattura ?? null,
        data_scadenza_fattura: input.dataScadenzaFattura ?? null,
        fondo_id: input.fondoId ?? null,
        versione_motore_calcolo: VERSIONE_MOTORE_CALCOLO,
        autore_id: input.autoreId ?? null,
      };

      const movimento = unwrap(
        await db.from('movimenti_contabili').insert(movPayload).select('*').single(),
      );

      const righeRipartoPayload: TablesInsert<'riparti_spese'>[] =
        risultatoRiparto.righeRiparto.map((r) => ({
          condominio_id: input.condominioId,
          movimento_id: movimento.id,
          unita_id: r.unitaId,
          utente_id: r.utenteId,
          soggetto_id: r.soggettoId,
          tabella_millesimale_id: r.tabellaMillesimaleId,
          versione_tabella: r.versioneTabella,
          valore_unitario: r.valoreUnitario,
          somma_valori_partecipanti: r.sommaValoriPartecipanti,
          giorni_titolarita: r.giorniTitolarita,
          giorni_periodo: r.giorniPeriodo,
          quota_calcolata_centesimi: r.quotaCalcolataCent,
          resto_arrotondamento_centesimi: r.restoArrotondamentoCent,
          importo_quota_centesimi: r.importoQuotaCent,
          quota_proprietario_centesimi: r.quotaProprietarioCent,
          quota_conduttore_centesimi: r.quotaConduttoreCent,
          quota_usufruttuario_centesimi: r.quotaUsufruttuarioCent,
          da_conguagliare: r.daConguagliare,
          versione_motore_calcolo: r.versioneMotoreCalcolo,
          autore_id: input.autoreId ?? null,
        }));

      const riparti = unwrap(
        await db.from('riparti_spese').insert(righeRipartoPayload).select('*'),
      );

      await aggiornaStatoCompletezzaRegistroEsercizio(input.condominioId, input.esercizioId);

      return {
        movimento,
        riparti,
        risultatoRiparto,
        ritardoRegistrazione,
        giustificativo,
        eccezioneCc,
        avvisi,
      };
    },

    /** Alias di `registraSpesaConRiparto`. */
    async registraSpesa(
      input: RegistraSpesaConRipartoInput,
    ): Promise<RegistraSpesaConRipartoOutput> {
      return this.registraSpesaConRiparto(input);
    },
  };
}

export type ContabilitaService = ReturnType<typeof createContabilitaService>;
