import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import type {
  IAuditLog,
  IBollettino,
  IBollettinoRiga,
  IMovimentoContabile,
  IPreventivo,
  IPreventivoVoce,
  IQuotaMillesimale,
  IRataDettaglio,
  IRataTestata,
  IRipartoSpesa,
  ITabellaMillesimale,
  IVoceSpesaCatalogo,
  Json,
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
import {
  approvaPreventivo as approvaPreventivoLogic,
  assertEmissioneRateConsentita,
  assertModificaBollettinoConsentita,
  assertPreventivoModificabile,
  calcolaTotalePreventivoDaVoci,
  creaNuovaVersionePreventivo as creaNuovaVersionePreventivoLogic,
  emettiBollettino as emettiBollettinoLogic,
  generaPianoRate,
  rettificaBollettinoEmesso as rettificaBollettinoEmessoLogic,
  verificaBollettino as verificaBollettinoLogic,
  type ControlliPreEmissioneInput,
  type EventoAuditContabile,
  type GeneraPianoRateOutput,
  type IncassoBollettinoInput,
  type OverridePreventivoNonApprovatoInput,
  type RettificaBollettinoEmessoOutput,
  type RigaControlloBollettinoInput,
  type RisultatoControlliPreEmissione,
  type ScadenzaRataInput,
  type StatoBollettino,
  type StatoPreventivo,
  type TipoGestioneEsercizio,
  type UnitaPianoRateInput,
  type VocePreventivoInput,
} from './bollettiniLogic.ts';

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

// ============================================================================
// INTERFACCE SEZIONE 6: PREVENTIVI, PIANO RATE, BOLLETTINI E AUDIT LOG
// ============================================================================

export interface CreaPreventivoServiceInput {
  condominioId: string;
  esercizioId: string;
  gestioneId?: string | null;
  versione?: number;
  precedenteId?: string | null;
  note?: string | null;
  voci: readonly VocePreventivoInput[];
  totalePrevistoCent?: CentesimiInput;
  autoreId?: string | null;
}

export interface CreaPreventivoServiceOutput {
  preventivo: IPreventivo;
  voci: IPreventivoVoce[];
}

export interface ApprovaPreventivoServiceInput {
  preventivoId: string;
  condominioId: string;
  /** Data dell'assemblea che approva il preventivo (`YYYY-MM-DD`, obbligatoria per RC-D2). */
  dataAssemblea: string;
  /** Riferimento testuale alla delibera assembleare (obbligatorio per RC-D2). */
  deliberaRiferimento: string;
  autoreId?: string | null;
}

export interface ApprovaPreventivoServiceOutput {
  preventivoApprovato: IPreventivo;
  preventivoSuperato: IPreventivo | null;
  auditLog: IAuditLog;
}

export interface CreaNuovaVersionePreventivoServiceInput {
  preventivoPrecedenteId: string;
  condominioId: string;
  voci?: readonly VocePreventivoInput[];
  nuovoTotalePrevistoCent?: CentesimiInput;
  note?: string | null;
  approvaSubito?: boolean;
  dataAssemblea?: string | null;
  deliberaRiferimento?: string | null;
  autoreId?: string | null;
}

export interface CreaNuovaVersionePreventivoServiceOutput {
  nuovoPreventivo: IPreventivo;
  voci: IPreventivoVoce[];
  preventivoPrecedente: IPreventivo;
  auditLog: IAuditLog;
}

export interface GeneraPianoRateServiceInput {
  condominioId: string;
  esercizioId: string;
  preventivoId: string;
  gestioneId?: string | null;
  gestioneNome?: string | null;
  tipoGestione?: TipoGestioneEsercizio;
  annoBollettini?: number;
  primoProgressivoBollettino?: number;
  tabellaMillesimaleId?: string | null;
  /** Scadenze e percentuali/importi delle rate (default: 4 rate trimestrali al 25%). */
  scadenzeRate: readonly ScadenzaRataInput[];
  /** Override esplicito per emettere rate da preventivo non ancora approvato (RC-D4, T16). */
  overridePreventivoNonApprovato?: OverridePreventivoNonApprovatoInput | null;
  emessaConOverride?: boolean;
  motivoOverride?: string | null;
  deliberaOverride?: string | null;
  /** Verifica fondo speciale obbligatorio per lavori straordinari (RC-J2, T7). */
  importoLavoriStraordinariCent?: CentesimiInput | null;
  fondoSpecialeCostituito?: boolean;
  importoFondoSpecialeCent?: CentesimiInput | null;
  /** Se fornite in memoria, evita una query alle tabelle anagrafiche/millesimali. */
  unita?: readonly UnitaPianoRateInput[];
  vociPreventivo?: readonly VocePreventivoInput[];
  ibanAccredito?: string | null;
  pubblicaSubitoRate?: boolean;
  autoreId?: string | null;
}

export interface GeneraPianoRateServiceOutput {
  pianoCalcolato: GeneraPianoRateOutput;
  rateTestata: IRataTestata[];
  rateDettaglio: IRataDettaglio[];
  bollettiniBozza: Array<{
    bollettino: IBollettino;
    righe: IBollettinoRiga[];
  }>;
  auditLogOverride: IAuditLog | null;
  avvisi: string[];
}

export interface CreaBollettinoBozzaServiceInput {
  condominioId: string;
  esercizioId: string;
  anno: number;
  numeroProgressivo?: number;
  destinatarioUtenteId?: string | null;
  destinatarioSoggettoId?: string | null;
  intestazioneDestinatario: string;
  dataScadenza: string;
  ibanAccredito?: string | null;
  causaleVersamento?: string | null;
  righe: ReadonlyArray<{
    rataDettaglioId?: string | null;
    unitaId: string;
    gestioneId?: string | null;
    descrizione: string;
    importoCent: CentesimiInput;
    dataScadenza?: string;
  }>;
  autoreId?: string | null;
}

export interface VerificaBollettinoServiceInput {
  bollettinoId: string;
  condominioId: string;
  contestoControlli?: Omit<ControlliPreEmissioneInput, 'bollettino'>;
}

export interface VerificaBollettinoServiceOutput {
  bollettino: IBollettino;
  righe: IBollettinoRiga[];
  esitoControlli: RisultatoControlliPreEmissione;
}

export interface EmettiBollettinoServiceInput {
  bollettinoId: string;
  condominioId: string;
  confermaEsplicitaAdmin: boolean;
  confermatoDa: string;
  dataEmissione?: string;
}

export interface EmettiBollettinoServiceOutput {
  bollettino: IBollettino;
  auditLog: IAuditLog;
}

export interface RettificaBollettinoEmessoServiceInput {
  bollettinoOriginaleId: string;
  condominioId: string;
  nuovoNumeroProgressivo?: number;
  nuovoTotaleCent?: CentesimiInput;
  nuoveRighe?: ReadonlyArray<{
    rataDettaglioId?: string | null;
    unitaId: string;
    gestioneId?: string | null;
    descrizione: string;
    importoCent: CentesimiInput;
    dataScadenza?: string;
  }>;
  motivoRettifica: string;
  incassiGiaRegistrati?: readonly IncassoBollettinoInput[];
  importoGiaIncassatoCent?: CentesimiInput;
  statoOriginalePostRettifica?: 'ANNULLATO' | 'RETTIFICATO';
  nuovaDataScadenza?: string;
  dataEmissioneNuovo?: string;
  autoreId?: string | null;
}

export interface RettificaBollettinoEmessoServiceOutput {
  bollettinoOriginaleAnnullato: IBollettino;
  nuovoBollettino: IBollettino;
  nuoveRighe: IBollettinoRiga[];
  esitoRettifica: RettificaBollettinoEmessoOutput;
  auditLog: IAuditLog;
}

const dataOggiIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * Servizio per il Registro Cronologico di Contabilità, il Catalogo Voci, la Gestione Spese,
 * il Ciclo di Vita del Preventivo, il Piano Rate e i Bollettini
 * (Sezioni 4, 5 e 6 dei requisiti contabili: RC-A1..A5, RC-B1..B5, RC-C1..C8, RC-D1..D5, RC-E1..E6).
 * Riceve `TypedSupabaseClient` tramite dependency injection (nessuna istanza singleton).
 */
export function createContabilitaService(db: TypedSupabaseClient) {
  /**
   * Registra un evento di audit su `audit_logs` per le operazioni contabili critiche
   * (approvazione preventivo, override emissione rate da bozza, emissione/rettifica bollettino, RC-M1).
   */
  async function registraEventoAudit(evento: EventoAuditContabile): Promise<IAuditLog> {
    const payload: TablesInsert<'audit_logs'> = {
      utente_id: evento.autoreId,
      condominio_id: evento.condominioId,
      azione: evento.azione,
      tabella: evento.tabella,
      record_id: evento.recordId,
      motivo: evento.motivo,
      valore_prima: (evento.valorePrima ?? null) as Json | null,
      valore_dopo: (evento.valoreDopo ?? null) as Json | null,
      timestamp: evento.timestampIso,
    };
    return unwrap(await db.from('audit_logs').insert(payload).select('*').single());
  }

  /**
   * Calcola il prossimo numero progressivo del bollettino per condominio e anno (RC-E1).
   */
  async function prossimoProgressivoBollettino(
    condominioId: string,
    anno: number,
  ): Promise<number> {
    const righe = unwrap(
      await db
        .from('bollettini')
        .select('numero_progressivo')
        .eq('condominio_id', condominioId)
        .eq('anno', anno),
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

    // =========================================================================
    // 5. CICLO DI VITA DEL PREVENTIVO (RC-D1, RC-D2, RC-D5)
    // =========================================================================

    /**
     * Elenca i preventivi del condominio per esercizio e/o gestione, ordinati per versione decrescente.
     */
    async listPreventivi(
      condominioId: string,
      filtri: {
        esercizioId?: string;
        gestioneId?: string;
        stato?: StatoPreventivo;
      } = {},
    ): Promise<IPreventivo[]> {
      let query = db
        .from('preventivi')
        .select('*')
        .eq('condominio_id', condominioId);

      if (filtri.esercizioId) query = query.eq('esercizio_id', filtri.esercizioId);
      if (filtri.gestioneId) query = query.eq('gestione_id', filtri.gestioneId);
      if (filtri.stato) query = query.eq('stato', filtri.stato);

      return unwrap(await query.order('versione', { ascending: false }));
    },

    /**
     * Carica un preventivo con tutte le sue voci previsionali (`preventivi_voci`).
     */
    async getPreventivoConVoci(
      preventivoId: string,
      condominioId: string,
    ): Promise<{ preventivo: IPreventivo; voci: IPreventivoVoce[] } | null> {
      const { data: preventivo, error } = await db
        .from('preventivi')
        .select('*')
        .eq('id', preventivoId)
        .eq('condominio_id', condominioId)
        .maybeSingle();
      if (error) throw error;
      if (!preventivo) return null;

      const voci = unwrap(
        await db
          .from('preventivi_voci')
          .select('*')
          .eq('preventivo_id', preventivoId)
          .eq('condominio_id', condominioId),
      );

      return { preventivo, voci };
    },

    /**
     * Crea un nuovo preventivo in stato `BOZZA` e le relative righe in `preventivi_voci` (RC-D2).
     */
    async creaPreventivo(
      input: CreaPreventivoServiceInput,
    ): Promise<CreaPreventivoServiceOutput> {
      const totaleDaVoci = calcolaTotalePreventivoDaVoci(input.voci);
      const totalePrevistoCent =
        input.totalePrevistoCent !== undefined
          ? normalizzaCentesimi(input.totalePrevistoCent)
          : totaleDaVoci;

      if (input.voci.length > 0 && totalePrevistoCent !== totaleDaVoci) {
        throw new Error(
          `Il totale del preventivo (${totalePrevistoCent} cent) non coincide con la somma delle voci (${totaleDaVoci} cent).`,
        );
      }

      const prevPayload: TablesInsert<'preventivi'> = {
        condominio_id: input.condominioId,
        esercizio_id: input.esercizioId,
        gestione_id: input.gestioneId ?? null,
        versione: input.versione ?? 1,
        stato: 'BOZZA',
        totale_previsto_centesimi: totalePrevistoCent,
        data_approvazione: null,
        delibera_approvazione: null,
        precedente_id: input.precedenteId ?? null,
        note: input.note ?? null,
        autore_id: input.autoreId ?? null,
      };

      const preventivo = unwrap(
        await db.from('preventivi').insert(prevPayload).select('*').single(),
      );

      let voci: IPreventivoVoce[] = [];
      if (input.voci.length > 0) {
        const vociPayload: TablesInsert<'preventivi_voci'>[] = input.voci.map((v) => ({
          condominio_id: input.condominioId,
          preventivo_id: preventivo.id,
          voce_spesa_id: v.voceSpesaId ?? null,
          sottoconto_id: v.sottocontoId ?? null,
          tabella_millesimale_id: v.tabellaMillesimaleId ?? null,
          versione_tabella: v.versioneTabella ?? 1,
          criterio_ripartizione: v.criterioRipartizione ?? 'TUTTI',
          descrizione: v.descrizione.trim(),
          importo_previsto_centesimi: normalizzaCentesimi(v.importoPrevistoCent),
        }));
        voci = unwrap(
          await db.from('preventivi_voci').insert(vociPayload).select('*'),
        );
      }

      return { preventivo, voci };
    },

    /**
     * Approva formalmente un preventivo in stato `BOZZA` registrando data assemblea e delibera (RC-D2).
     * Se esiste una versione precedente in stato `APPROVATO` per la stessa gestione/esercizio,
     * la transita automaticamente nello stato `SUPERATO` senza alterarne i dati storici (RC-D5)
     * e traccia l'operazione in `audit_logs` (RC-M1).
     */
    async approvaPreventivo(
      input: ApprovaPreventivoServiceInput,
    ): Promise<ApprovaPreventivoServiceOutput> {
      const bozza = unwrap(
        await db
          .from('preventivi')
          .select('*')
          .eq('id', input.preventivoId)
          .eq('condominio_id', input.condominioId)
          .single(),
      );

      // Cerca eventuale versione precedente attualmente APPROVATO per lo stesso esercizio e gestione
      let precedenteApprovato: IPreventivo | null = null;
      if (bozza.precedente_id) {
        const { data: prevById, error: errPrev } = await db
          .from('preventivi')
          .select('*')
          .eq('id', bozza.precedente_id)
          .eq('condominio_id', input.condominioId)
          .maybeSingle();
        if (errPrev) throw errPrev;
        if (prevById && prevById.stato === 'APPROVATO') {
          precedenteApprovato = prevById;
        }
      } else {
        let queryPrev = db
          .from('preventivi')
          .select('*')
          .eq('condominio_id', input.condominioId)
          .eq('esercizio_id', bozza.esercizio_id)
          .eq('stato', 'APPROVATO');
        if (bozza.gestione_id) {
          queryPrev = queryPrev.eq('gestione_id', bozza.gestione_id);
        } else {
          queryPrev = queryPrev.is('gestione_id', null);
        }
        const candidati = unwrap(await queryPrev);
        precedenteApprovato = candidati.find((c) => c.id !== bozza.id) ?? null;
      }

      const esito = approvaPreventivoLogic({
        preventivo: bozza,
        dataAssemblea: input.dataAssemblea,
        deliberaRiferimento: input.deliberaRiferimento,
        preventivoPrecedenteApprovato: precedenteApprovato,
        autoreId: input.autoreId ?? bozza.autore_id,
      });

      let preventivoSuperato: IPreventivo | null = null;
      if (esito.preventivoSuperato) {
        preventivoSuperato = unwrap(
          await db
            .from('preventivi')
            .update({ stato: 'SUPERATO' })
            .eq('id', esito.preventivoSuperato.id)
            .eq('condominio_id', input.condominioId)
            .select('*')
            .single(),
        );
      }

      const preventivoApprovato = unwrap(
        await db
          .from('preventivi')
          .update({
            stato: 'APPROVATO',
            versione: esito.preventivoApprovato.versione,
            data_approvazione: esito.preventivoApprovato.data_approvazione,
            delibera_approvazione: esito.preventivoApprovato.delibera_approvazione,
            precedente_id: esito.preventivoApprovato.precedente_id,
            autore_id: esito.preventivoApprovato.autore_id,
          })
          .eq('id', bozza.id)
          .eq('condominio_id', input.condominioId)
          .select('*')
          .single(),
      );

      const auditLog = await registraEventoAudit(esito.eventoAudit);

      return {
        preventivoApprovato,
        preventivoSuperato,
        auditLog,
      };
    },

    /**
     * Crea una nuova versione di un preventivo esistente per una variazione in corso d'esercizio (RC-D5),
     * lasciando intatti gli importi della versione precedente e registrando l'evento in `audit_logs`.
     */
    async creaNuovaVersionePreventivo(
      input: CreaNuovaVersionePreventivoServiceInput,
    ): Promise<CreaNuovaVersionePreventivoServiceOutput> {
      const precedente = unwrap(
        await db
          .from('preventivi')
          .select('*')
          .eq('id', input.preventivoPrecedenteId)
          .eq('condominio_id', input.condominioId)
          .single(),
      );

      const esito = creaNuovaVersionePreventivoLogic({
        preventivoPrecedente: precedente,
        nuovoId: `${precedente.id}-v${(precedente.versione ?? 1) + 1}`,
        voci: input.voci,
        nuovoTotalePrevistoCent: input.nuovoTotalePrevistoCent,
        note: input.note,
        approvaSubito: input.approvaSubito,
        dataAssemblea: input.dataAssemblea,
        deliberaRiferimento: input.deliberaRiferimento,
        autoreId: input.autoreId,
      });

      let preventivoPrecedente = precedente;
      if (esito.preventivoPrecedenteAggiornato.stato === 'SUPERATO' && precedente.stato !== 'SUPERATO') {
        preventivoPrecedente = unwrap(
          await db
            .from('preventivi')
            .update({ stato: 'SUPERATO' })
            .eq('id', precedente.id)
            .eq('condominio_id', input.condominioId)
            .select('*')
            .single(),
        );
      }

      const nuovoPreventivo = unwrap(
        await db
          .from('preventivi')
          .insert({
            condominio_id: esito.nuovoPreventivo.condominio_id,
            esercizio_id: esito.nuovoPreventivo.esercizio_id,
            gestione_id: esito.nuovoPreventivo.gestione_id,
            versione: esito.nuovoPreventivo.versione,
            stato: esito.nuovoPreventivo.stato,
            totale_previsto_centesimi: esito.nuovoPreventivo.totale_previsto_centesimi,
            data_approvazione: esito.nuovoPreventivo.data_approvazione,
            delibera_approvazione: esito.nuovoPreventivo.delibera_approvazione,
            precedente_id: precedente.id,
            note: esito.nuovoPreventivo.note,
            autore_id: esito.nuovoPreventivo.autore_id,
          })
          .select('*')
          .single(),
      );

      let voci: IPreventivoVoce[] = [];
      if (input.voci && input.voci.length > 0) {
        const vociPayload: TablesInsert<'preventivi_voci'>[] = input.voci.map((v) => ({
          condominio_id: input.condominioId,
          preventivo_id: nuovoPreventivo.id,
          voce_spesa_id: v.voceSpesaId ?? null,
          sottoconto_id: v.sottocontoId ?? null,
          tabella_millesimale_id: v.tabellaMillesimaleId ?? null,
          versione_tabella: v.versioneTabella ?? 1,
          criterio_ripartizione: v.criterioRipartizione ?? 'TUTTI',
          descrizione: v.descrizione.trim(),
          importo_previsto_centesimi: normalizzaCentesimi(v.importoPrevistoCent),
        }));
        voci = unwrap(
          await db.from('preventivi_voci').insert(vociPayload).select('*'),
        );
      }

      const auditLog = await registraEventoAudit({
        ...esito.eventoAudit,
        recordId: nuovoPreventivo.id,
      });

      return {
        nuovoPreventivo,
        voci,
        preventivoPrecedente,
        auditLog,
      };
    },

    /**
     * Aggiorna le note di un preventivo solo se ancora in stato `BOZZA`;
     * se è `APPROVATO` o `SUPERATO` solleva `ErrorePreventivoImmutabile` (RC-D5).
     */
    async aggiornaPreventivoBozza(
      preventivoId: string,
      condominioId: string,
      patch: { note?: string | null; totalePrevistoCent?: CentesimiInput },
    ): Promise<IPreventivo> {
      const esistente = unwrap(
        await db
          .from('preventivi')
          .select('*')
          .eq('id', preventivoId)
          .eq('condominio_id', condominioId)
          .single(),
      );

      assertPreventivoModificabile(esistente);

      const updatePayload: TablesUpdate<'preventivi'> = {};
      if (patch.note !== undefined) updatePayload.note = patch.note;
      if (patch.totalePrevistoCent !== undefined) {
        updatePayload.totale_previsto_centesimi = normalizzaCentesimi(patch.totalePrevistoCent);
      }

      return unwrap(
        await db
          .from('preventivi')
          .update(updatePayload)
          .eq('id', preventivoId)
          .eq('condominio_id', condominioId)
          .select('*')
          .single(),
      );
    },

    // =========================================================================
    // 6. CALCOLO QUOTE RATEALI E GENERAZIONE PIANO RATE + BOLLETTINI BOZZA (RC-D3, RC-D4, T13, T16)
    // =========================================================================

    /**
     * Calcola in pura logica le quote rateali per unità e soggetto pagante e i bollettini multi-riga
     * senza scrivere nel database (utile per l'anteprima prima della conferma dell'amministratore, RC-D3, RC-E3, T13).
     */
    async calcolaQuoteRateali(
      input: GeneraPianoRateServiceInput,
    ): Promise<GeneraPianoRateOutput> {
      const preventivo = unwrap(
        await db
          .from('preventivi')
          .select('*')
          .eq('id', input.preventivoId)
          .eq('condominio_id', input.condominioId)
          .single(),
      );

      let unita = input.unita ? [...input.unita] : undefined;
      if (!unita) {
        const unitaRiparto = await caricaUnitaCondominioPerRiparto(input.condominioId);
        const tab = await caricaTabellaMillesimalePerRiparto(
          input.condominioId,
          input.tabellaMillesimaleId,
        );
        const millesimiMap = new Map(tab.quote.map((q) => [q.unitaId, q.millesimi]));

        unita = unitaRiparto.map((u) => ({
          unitaId: u.id,
          unitaInterno: u.interno,
          millesimi: millesimiMap.get(u.id) ?? 0,
          utenteId: u.utenteId,
          soggettoId: u.soggettoId,
        }));
      }

      const annoBollettini =
        input.annoBollettini ?? Number(new Date().toISOString().slice(0, 4));
      const primoProgressivo =
        input.primoProgressivoBollettino ??
        (await prossimoProgressivoBollettino(input.condominioId, annoBollettini));

      return generaPianoRate({
        condominioId: input.condominioId,
        esercizioId: input.esercizioId,
        preventivoId: preventivo.id,
        versionePreventivo: preventivo.versione ?? 1,
        statoPreventivo: preventivo.stato,
        gestioneId: input.gestioneId ?? preventivo.gestione_id,
        tipoGestione: input.tipoGestione ?? 'ORDINARIA',
        importoPreventivoCent: preventivo.totale_previsto_centesimi,
        vociPreventivo: input.vociPreventivo,
        unita,
        scadenze: input.scadenzeRate,
        override: input.overridePreventivoNonApprovato,
        emessaConOverride: input.emessaConOverride,
        motivoOverride: input.motivoOverride,
        deliberaOverride: input.deliberaOverride,
        importoLavoriStraordinariCent: input.importoLavoriStraordinariCent,
        fondoSpecialeCostituito: input.fondoSpecialeCostituito,
        importoFondoSpecialeCent: input.importoFondoSpecialeCent,
        annoBollettini,
        numeroProgressivoInizialeBollettini: primoProgressivo,
        autoreId: input.autoreId ?? preventivo.autore_id,
      });
    },

    /**
     * Genera il piano rate (`rate_testata` e `rate_dettaglio`) e i relativi bollettini in stato `BOZZA`
     * (`bollettini` e `bollettini_righe`), raggruppando più unità dello stesso proprietario in un unico
     * bollettino multi-riga per scadenza (RC-D3, RC-E1, T13).
     * Blocca l'emissione se il preventivo non è approvato salvo override motivato e tracciato in `audit_logs` (RC-D4, T16).
     */
    async generaPianoRateEBozzeBollettini(
      input: GeneraPianoRateServiceInput,
    ): Promise<GeneraPianoRateServiceOutput> {
      const preventivo = unwrap(
        await db
          .from('preventivi')
          .select('*')
          .eq('id', input.preventivoId)
          .eq('condominio_id', input.condominioId)
          .single(),
      );

      const pianoCalcolato = await this.calcolaQuoteRateali(input);

      // Se le rate sono state generate da un preventivo BOZZA con override, registra subito l'evento in audit_logs (RC-D4, T16)
      let auditLogOverride: IAuditLog | null = null;
      if (pianoCalcolato.validazionePreventivo.eventoAudit) {
        auditLogOverride = await registraEventoAudit(
          pianoCalcolato.validazionePreventivo.eventoAudit,
        );
      }

      const rateTestataInserite: IRataTestata[] = [];
      const rateDettaglioInserite: IRataDettaglio[] = [];
      // Mappa `(numeroRata, unitaId)` -> `rata_dettaglio.id` per collegare le righe dei bollettini
      const mappaRataDettaglioId = new Map<string, string>();

      for (const rataGen of pianoCalcolato.rateTestata) {
        const testataPayload: TablesInsert<'rate_testata'> = {
          condominio_id: input.condominioId,
          esercizio_id: input.esercizioId,
          gestione_id: input.gestioneId ?? preventivo.gestione_id,
          preventivo_id: preventivo.id,
          versione_preventivo: preventivo.versione ?? 1,
          stato_preventivo: pianoCalcolato.statoPreventivo,
          data_approvazione_preventivo: preventivo.data_approvazione,
          delibera_approvazione: preventivo.delibera_approvazione,
          emessa_con_override: rataGen.emessaConOverride,
          motivo_override: rataGen.motivoOverride,
          delibera_override: rataGen.deliberaOverride,
          numero_rata: rataGen.numeroRata,
          percentuale_preventivo: rataGen.percentualePreventivo,
          tabella_millesimale_id: input.tabellaMillesimaleId ?? null,
          data_scadenza: rataGen.dataScadenza,
          descrizione: rataGen.descrizione,
          pubblicata: Boolean(input.pubblicaSubitoRate),
          autore_id: input.autoreId ?? null,
        };

        const testataRow = unwrap(
          await db.from('rate_testata').insert(testataPayload).select('*').single(),
        );
        rateTestataInserite.push(testataRow);

        const dettagliPayload: TablesInsert<'rate_dettaglio'>[] = rataGen.dettagli.map(
          (d) => ({
            condominio_id: input.condominioId,
            rata_testata_id: testataRow.id,
            unita_id: d.unitaId,
            utente_id: d.utenteId,
            soggetto_id: d.soggettoId,
            obbligato_in_solido_utente_id: null,
            importo_dovuto: d.importoDovutoEuro,
            importo_pagato: 0,
            importo_dovuto_centesimi: d.importoDovutoCent,
            importo_pagato_centesimi: 0,
            stato: 'DA_PAGARE',
            stato_rata_modello: d.statoRataModello,
            data_esigibilita: d.dataEsigibilita,
            versione_motore_calcolo: d.versioneMotoreCalcolo,
            autore_id: input.autoreId ?? null,
          }),
        );

        const dettagliRows = unwrap(
          await db.from('rate_dettaglio').insert(dettagliPayload).select('*'),
        );
        rateDettaglioInserite.push(...dettagliRows);

        for (const dRow of dettagliRows) {
          mappaRataDettaglioId.set(`${rataGen.numeroRata}::${dRow.unita_id}`, dRow.id);
        }
      }

      // Inserimento bollettini in stato BOZZA e relative righe (raggruppate per proprietario con più unità, T13)
      const bollettiniBozza: Array<{ bollettino: IBollettino; righe: IBollettinoRiga[] }> = [];

      for (const bollGen of pianoCalcolato.bollettiniProposti) {
        const bollPayload: TablesInsert<'bollettini'> = {
          condominio_id: input.condominioId,
          esercizio_id: input.esercizioId,
          anno: bollGen.anno,
          numero_progressivo: bollGen.numeroProgressivo,
          destinatario_utente_id: bollGen.destinatarioUtenteId,
          destinatario_soggetto_id: bollGen.destinatarioSoggettoId,
          intestazione_destinatario: bollGen.intestazioneDestinatario,
          totale_centesimi: bollGen.totaleCent,
          importo_pagato_centesimi: 0,
          data_emissione: null,
          data_scadenza: bollGen.dataScadenza,
          stato: 'BOZZA',
          iban_accredito: input.ibanAccredito ?? null,
          causale_versamento: `Bollettino n. ${bollGen.numeroProgressivo}/${bollGen.anno} — ${bollGen.intestazioneDestinatario}`,
          versione: 1,
          versione_lock: 1,
          versione_motore_calcolo: bollGen.versioneMotoreCalcolo,
          autore_id: input.autoreId ?? null,
        };

        const bollettinoRow = unwrap(
          await db.from('bollettini').insert(bollPayload).select('*').single(),
        );

        const righePayload: TablesInsert<'bollettini_righe'>[] = bollGen.righe.map((r) => {
          const rataDettId =
            mappaRataDettaglioId.get(`${r.numeroRata}::${r.unitaId}`) ?? null;
          return {
            condominio_id: input.condominioId,
            bollettino_id: bollettinoRow.id,
            rata_dettaglio_id: rataDettId,
            unita_id: r.unitaId,
            gestione_id: r.gestioneId,
            descrizione: r.descrizione,
            importo_centesimi: r.importoCent,
            data_scadenza: r.dataScadenza,
          };
        });

        const righeRows = unwrap(
          await db.from('bollettini_righe').insert(righePayload).select('*'),
        );

        bollettiniBozza.push({
          bollettino: bollettinoRow,
          righe: righeRows,
        });
      }

      return {
        pianoCalcolato,
        rateTestata: rateTestataInserite,
        rateDettaglio: rateDettaglioInserite,
        bollettiniBozza,
        auditLogOverride,
        avvisi: pianoCalcolato.avvisi,
      };
    },

    /** Alias di `generaPianoRateEBozzeBollettini`. */
    async calcolaECreaPianoRate(
      input: GeneraPianoRateServiceInput,
    ): Promise<GeneraPianoRateServiceOutput> {
      return this.generaPianoRateEBozzeBollettini(input);
    },

    // =========================================================================
    // 7. CICLO DI VITA DEI BOLLETTINI E RETTIFICA (RC-E1..E6, T11, T14)
    // =========================================================================

    /**
     * Elenca i bollettini del condominio filtrabili per esercizio, stato o destinatario.
     */
    async listBollettini(
      condominioId: string,
      filtri: {
        esercizioId?: string;
        stato?: StatoBollettino;
        destinatarioUtenteId?: string;
        destinatarioSoggettoId?: string;
        anno?: number;
      } = {},
    ): Promise<IBollettino[]> {
      let query = db
        .from('bollettini')
        .select('*')
        .eq('condominio_id', condominioId);

      if (filtri.esercizioId) query = query.eq('esercizio_id', filtri.esercizioId);
      if (filtri.stato) query = query.eq('stato', filtri.stato);
      if (filtri.destinatarioUtenteId) {
        query = query.eq('destinatario_utente_id', filtri.destinatarioUtenteId);
      }
      if (filtri.destinatarioSoggettoId) {
        query = query.eq('destinatario_soggetto_id', filtri.destinatarioSoggettoId);
      }
      if (filtri.anno !== undefined) query = query.eq('anno', filtri.anno);

      return unwrap(await query.order('numero_progressivo', { ascending: true }));
    },

    /**
     * Carica un bollettino con le relative righe analitiche (`bollettini_righe`).
     */
    async getBollettinoConRighe(
      bollettinoId: string,
      condominioId: string,
    ): Promise<{ bollettino: IBollettino; righe: IBollettinoRiga[] } | null> {
      const { data: bollettino, error } = await db
        .from('bollettini')
        .select('*')
        .eq('id', bollettinoId)
        .eq('condominio_id', condominioId)
        .maybeSingle();
      if (error) throw error;
      if (!bollettino) return null;

      const righe = unwrap(
        await db
          .from('bollettini_righe')
          .select('*')
          .eq('bollettino_id', bollettinoId)
          .eq('condominio_id', condominioId),
      );

      return { bollettino, righe };
    },

    /**
     * Crea un singolo bollettino in stato `BOZZA` con le sue righe analitiche (RC-E1, RC-E2).
     */
    async creaBollettinoBozza(
      input: CreaBollettinoBozzaServiceInput,
    ): Promise<{ bollettino: IBollettino; righe: IBollettinoRiga[] }> {
      if (input.righe.length === 0) {
        throw new Error('Un bollettino deve contenere almeno una riga di addebito.');
      }

      const numeroProgressivo =
        input.numeroProgressivo ??
        (await prossimoProgressivoBollettino(input.condominioId, input.anno));

      let totaleCent = 0;
      for (const r of input.righe) {
        const imp = normalizzaCentesimi(r.importoCent);
        if (imp < 0) {
          throw new RangeError(`L'importo della riga "${r.descrizione}" non può essere negativo: ${imp}`);
        }
        totaleCent = normalizzaCentesimi(totaleCent + imp);
      }

      const bollettino = unwrap(
        await db
          .from('bollettini')
          .insert({
            condominio_id: input.condominioId,
            esercizio_id: input.esercizioId,
            anno: input.anno,
            numero_progressivo: numeroProgressivo,
            destinatario_utente_id: input.destinatarioUtenteId ?? null,
            destinatario_soggetto_id: input.destinatarioSoggettoId ?? null,
            intestazione_destinatario: input.intestazioneDestinatario.trim(),
            totale_centesimi: totaleCent,
            importo_pagato_centesimi: 0,
            data_emissione: null,
            data_scadenza: input.dataScadenza,
            stato: 'BOZZA',
            iban_accredito: input.ibanAccredito ?? null,
            causale_versamento:
              input.causaleVersamento ??
              `Bollettino n. ${numeroProgressivo}/${input.anno} — ${input.intestazioneDestinatario.trim()}`,
            versione: 1,
            versione_lock: 1,
            versione_motore_calcolo: VERSIONE_MOTORE_CALCOLO,
            autore_id: input.autoreId ?? null,
          })
          .select('*')
          .single(),
      );

      const righePayload: TablesInsert<'bollettini_righe'>[] = input.righe.map((r) => ({
        condominio_id: input.condominioId,
        bollettino_id: bollettino.id,
        rata_dettaglio_id: r.rataDettaglioId ?? null,
        unita_id: r.unitaId,
        gestione_id: r.gestioneId ?? null,
        descrizione: r.descrizione.trim(),
        importo_centesimi: normalizzaCentesimi(r.importoCent),
        data_scadenza: r.dataScadenza ?? input.dataScadenza,
      }));

      const righe = unwrap(
        await db.from('bollettini_righe').insert(righePayload).select('*'),
      );

      return { bollettino, righe };
    },

    /**
     * Esegue i controlli bloccanti pre-emissione (RC-E3, RC-N2, T14) e i warning non bloccanti (RC-N3)
     * sul bollettino in `BOZZA`, transitandolo nello stato `VERIFICATO` se superati.
     */
    async verificaBollettino(
      input: VerificaBollettinoServiceInput,
    ): Promise<VerificaBollettinoServiceOutput> {
      const caricato = await this.getBollettinoConRighe(input.bollettinoId, input.condominioId);
      if (!caricato) {
        throw new Error(`Bollettino "${input.bollettinoId}" non trovato.`);
      }

      const righeControllo: RigaControlloBollettinoInput[] = caricato.righe.map((r) => ({
        unitaId: r.unita_id,
        rataDettaglioId: r.rata_dettaglio_id,
        gestioneId: r.gestione_id,
        descrizione: r.descrizione,
        importoCent: r.importo_centesimi,
        dataScadenza: r.data_scadenza,
      }));

      const esito = verificaBollettinoLogic({
        bollettino: caricato.bollettino,
        righe: righeControllo,
        contestoControlli: input.contestoControlli,
      });

      const bollettinoAggiornato = unwrap(
        await db
          .from('bollettini')
          .update({
            stato: 'VERIFICATO',
            anomalie_rilevate: esito.bollettinoVerificato.anomalie_rilevate as unknown as Json,
            versione_lock: esito.bollettinoVerificato.versione_lock,
          })
          .eq('id', caricato.bollettino.id)
          .eq('condominio_id', input.condominioId)
          .select('*')
          .single(),
      );

      return {
        bollettino: bollettinoAggiornato,
        righe: caricato.righe,
        esitoControlli: esito.esitoControlli,
      };
    },

    /**
     * Emette formalmente un bollettino già `VERIFICATO`, richiedendo conferma esplicita dell'amministratore (RC-E2, RC-E3),
     * aggiornando le rate collegate nello stato `EMESSA` e registrando l'evento in `audit_logs` (RC-M1).
     */
    async emettiBollettino(
      input: EmettiBollettinoServiceInput,
    ): Promise<EmettiBollettinoServiceOutput> {
      const caricato = await this.getBollettinoConRighe(input.bollettinoId, input.condominioId);
      if (!caricato) {
        throw new Error(`Bollettino "${input.bollettinoId}" non trovato.`);
      }

      const esito = emettiBollettinoLogic({
        bollettino: caricato.bollettino,
        confermaEsplicitaAdmin: input.confermaEsplicitaAdmin,
        confermatoDa: input.confermatoDa,
        dataEmissione: input.dataEmissione,
      });

      const bollettino = unwrap(
        await db
          .from('bollettini')
          .update({
            stato: 'EMESSO',
            data_emissione: esito.bollettinoEmesso.data_emissione,
            confermato_da: esito.bollettinoEmesso.confermato_da,
            confermato_at: esito.bollettinoEmesso.confermato_at,
            versione_lock: esito.bollettinoEmesso.versione_lock,
            versione_motore_calcolo: esito.bollettinoEmesso.versione_motore_calcolo,
          })
          .eq('id', caricato.bollettino.id)
          .eq('condominio_id', input.condominioId)
          .select('*')
          .single(),
      );

      // Aggiorna le rate collegate da PIANIFICATA a EMESSA
      const rataDettaglioIds = caricato.righe
        .map((r) => r.rata_dettaglio_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      if (rataDettaglioIds.length > 0) {
        assertOk(
          await db
            .from('rate_dettaglio')
            .update({
              stato_rata_modello: 'EMESSA',
              bollettino_id: bollettino.id,
            })
            .in('id', rataDettaglioIds)
            .eq('condominio_id', input.condominioId),
        );
      }

      const auditLog = await registraEventoAudit(esito.eventoAudit);

      return {
        bollettino,
        auditLog,
      };
    },

    /**
     * Aggiorna un bollettino solo se in stato `BOZZA` o `VERIFICATO`.
     * Se il bollettino è già stato emesso, solleva `ErroreBollettinoEmessoImmutabile` (RC-E2).
     */
    async aggiornaBollettino(
      bollettinoId: string,
      condominioId: string,
      patch: TablesUpdate<'bollettini'>,
    ): Promise<IBollettino> {
      const originale = unwrap(
        await db
          .from('bollettini')
          .select('*')
          .eq('id', bollettinoId)
          .eq('condominio_id', condominioId)
          .single(),
      );

      assertModificaBollettinoConsentita(
        originale as unknown as { id: string; stato: StatoBollettino } & Record<string, unknown>,
        patch as Record<string, unknown>,
      );

      return unwrap(
        await db
          .from('bollettini')
          .update(patch)
          .eq('id', bollettinoId)
          .eq('condominio_id', condominioId)
          .select('*')
          .single(),
      );
    },

    /**
     * Esegue la rettifica per sostituzione di un bollettino già emesso (RC-E4, T11):
     * 1. Annulla il bollettino originale (es. N. 12 da 250,00 €);
     * 2. Crea il nuovo bollettino collegato (`sostituisce_id` = ID originale, es. N. 13 da 230,00 €);
     * 3. Trascina automaticamente gli incassi parziali già registrati (es. 100,00 €) e ricalcola il saldo residuo (es. 130,00 €);
     * 4. Registra l'operazione in `audit_logs` mantenendo lo storico completo delle versioni.
     */
    async rettificaBollettinoEmesso(
      input: RettificaBollettinoEmessoServiceInput,
    ): Promise<RettificaBollettinoEmessoServiceOutput> {
      const caricato = await this.getBollettinoConRighe(
        input.bollettinoOriginaleId,
        input.condominioId,
      );
      if (!caricato) {
        throw new Error(`Bollettino originale "${input.bollettinoOriginaleId}" non trovato.`);
      }

      const nuovoNumeroProgressivo =
        input.nuovoNumeroProgressivo ??
        (await prossimoProgressivoBollettino(input.condominioId, caricato.bollettino.anno));

      const nuoveRigheControllo: RigaControlloBollettinoInput[] | undefined = input.nuoveRighe
        ? input.nuoveRighe.map((r) => ({
            unitaId: r.unitaId,
            rataDettaglioId: r.rataDettaglioId ?? null,
            gestioneId: r.gestioneId ?? null,
            descrizione: r.descrizione,
            importoCent: normalizzaCentesimi(r.importoCent),
            dataScadenza: r.dataScadenza ?? input.nuovaDataScadenza ?? caricato.bollettino.data_scadenza,
          }))
        : undefined;

      const esitoRettifica = rettificaBollettinoEmessoLogic({
        bollettinoOriginale: caricato.bollettino,
        nuovoNumeroProgressivo,
        nuovoTotaleCent: input.nuovoTotaleCent,
        nuoveRighe: nuoveRigheControllo,
        motivoRettifica: input.motivoRettifica,
        incassiGiaRegistrati: input.incassiGiaRegistrati,
        importoGiaIncassatoCent: input.importoGiaIncassatoCent,
        statoOriginalePostRettifica: input.statoOriginalePostRettifica,
        nuovaDataScadenza: input.nuovaDataScadenza,
        dataEmissioneNuovo: input.dataEmissioneNuovo,
        autoreId: input.autoreId,
      });

      // 1. Inserisce il nuovo bollettino sostitutivo con sostituisce_id e incassi trascinati
      const nuovoBollettino = unwrap(
        await db
          .from('bollettini')
          .insert({
            condominio_id: esitoRettifica.nuovoBollettino.condominio_id,
            esercizio_id: esitoRettifica.nuovoBollettino.esercizio_id,
            anno: esitoRettifica.nuovoBollettino.anno,
            numero_progressivo: esitoRettifica.nuovoBollettino.numero_progressivo,
            destinatario_utente_id: esitoRettifica.nuovoBollettino.destinatario_utente_id ?? null,
            destinatario_soggetto_id: esitoRettifica.nuovoBollettino.destinatario_soggetto_id ?? null,
            intestazione_destinatario: esitoRettifica.nuovoBollettino.intestazione_destinatario,
            totale_centesimi: esitoRettifica.nuovoBollettino.totale_centesimi,
            importo_pagato_centesimi: esitoRettifica.nuovoBollettino.importo_pagato_centesimi,
            data_emissione: esitoRettifica.nuovoBollettino.data_emissione,
            data_scadenza: esitoRettifica.nuovoBollettino.data_scadenza,
            stato: esitoRettifica.nuovoBollettino.stato,
            sostituisce_id: caricato.bollettino.id,
            sostituito_da_id: null,
            motivo_rettifica_annullamento: esitoRettifica.nuovoBollettino.motivo_rettifica_annullamento,
            anomalie_rilevate: [] as unknown as Json,
            confermato_da: esitoRettifica.nuovoBollettino.confermato_da,
            confermato_at: esitoRettifica.nuovoBollettino.confermato_at,
            iban_accredito: esitoRettifica.nuovoBollettino.iban_accredito ?? null,
            causale_versamento: esitoRettifica.nuovoBollettino.causale_versamento,
            versione: esitoRettifica.nuovoBollettino.versione,
            versione_lock: 1,
            versione_motore_calcolo: esitoRettifica.nuovoBollettino.versione_motore_calcolo,
            autore_id: esitoRettifica.nuovoBollettino.autore_id,
          })
          .select('*')
          .single(),
      );

      // 2. Inserisce le righe del nuovo bollettino
      const righeSorgente: RigaControlloBollettinoInput[] =
        esitoRettifica.nuoveRighe.length > 0
          ? esitoRettifica.nuoveRighe
          : caricato.righe.map((r, idx) => ({
              unitaId: r.unita_id,
              rataDettaglioId: r.rata_dettaglio_id,
              gestioneId: r.gestione_id,
              descrizione: r.descrizione,
              importoCent:
                idx === 0 && caricato.righe.length === 1
                  ? esitoRettifica.nuovoBollettino.totale_centesimi
                  : r.importo_centesimi,
              dataScadenza: esitoRettifica.nuovoBollettino.data_scadenza,
            }));

      let nuoveRigheInserite: IBollettinoRiga[] = [];
      if (righeSorgente.length > 0) {
        const righePayload: TablesInsert<'bollettini_righe'>[] = righeSorgente.map((r) => ({
          condominio_id: input.condominioId,
          bollettino_id: nuovoBollettino.id,
          rata_dettaglio_id: r.rataDettaglioId ?? null,
          unita_id: r.unitaId,
          gestione_id: r.gestioneId ?? null,
          descrizione: r.descrizione ?? 'Quota rata rettificata',
          importo_centesimi: normalizzaCentesimi(r.importoCent),
          data_scadenza: r.dataScadenza ?? nuovoBollettino.data_scadenza,
        }));
        nuoveRigheInserite = unwrap(
          await db.from('bollettini_righe').insert(righePayload).select('*'),
        );
      }

      // 3. Aggiorna il bollettino originale con stato ANNULLATO/RETTIFICATO e puntatore sostituito_da_id
      const bollettinoOriginaleAnnullato = unwrap(
        await db
          .from('bollettini')
          .update({
            stato: esitoRettifica.bollettinoOriginaleAnnullato.stato,
            sostituito_da_id: nuovoBollettino.id,
            motivo_rettifica_annullamento:
              esitoRettifica.bollettinoOriginaleAnnullato.motivo_rettifica_annullamento,
            importo_pagato_centesimi:
              esitoRettifica.bollettinoOriginaleAnnullato.importo_pagato_centesimi,
            versione_lock: esitoRettifica.bollettinoOriginaleAnnullato.versione_lock,
          })
          .eq('id', caricato.bollettino.id)
          .eq('condominio_id', input.condominioId)
          .select('*')
          .single(),
      );

      // 4. Registra l'evento di rettifica in audit_logs
      const auditLog = await registraEventoAudit({
        ...esitoRettifica.eventoAudit,
        recordId: nuovoBollettino.id,
        valoreDopo: {
          ...(esitoRettifica.eventoAudit.valoreDopo ?? {}),
          nuovo_bollettino_id: nuovoBollettino.id,
        },
      });

      return {
        bollettinoOriginaleAnnullato,
        nuovoBollettino,
        nuoveRighe: nuoveRigheInserite,
        esitoRettifica,
        auditLog,
      };
    },

    // =========================================================================
    // 8. AUDIT LOG DELLE AZIONI CONTABILI CRITICHE (RC-D4, RC-M1)
    // =========================================================================

    /**
     * Registra esplicitamente un evento nel registro di audit contabile (`audit_logs`).
     */
    async registraAuditLogContabile(evento: EventoAuditContabile): Promise<IAuditLog> {
      return registraEventoAudit(evento);
    },

    /**
     * Restituisce gli eventi di audit registrati per un condominio (filtrabili per tabella o azione).
     */
    async listAuditLogsContabilita(
      condominioId: string,
      filtri: { tabella?: string; azione?: string; recordId?: string } = {},
    ): Promise<IAuditLog[]> {
      let query = db
        .from('audit_logs')
        .select('*')
        .eq('condominio_id', condominioId);

      if (filtri.tabella) query = query.eq('tabella', filtri.tabella);
      if (filtri.azione) query = query.eq('azione', filtri.azione);
      if (filtri.recordId) query = query.eq('record_id', filtri.recordId);

      return unwrap(await query.order('timestamp', { ascending: false }));
    },

    /**
     * Verifica in pura logica (e registra in `audit_logs` se presente un override)
     * se l'emissione di rate per un preventivo è consentita (RC-D4, T16).
     */
    async verificaEAuditEmissioneRatePreventivo(input: {
      preventivo: IPreventivo;
      tipoGestione?: TipoGestioneEsercizio;
      override?: OverridePreventivoNonApprovatoInput | null;
      importoLavoriStraordinariCent?: CentesimiInput | null;
      fondoSpecialeCostituito?: boolean;
      importoFondoSpecialeCent?: CentesimiInput | null;
      autoreId?: string | null;
    }): Promise<{
      esito: ReturnType<typeof assertEmissioneRateConsentita>;
      auditLog: IAuditLog | null;
    }> {
      const esito = assertEmissioneRateConsentita({
        statoPreventivo: input.preventivo.stato,
        preventivoId: input.preventivo.id,
        condominioId: input.preventivo.condominio_id,
        esercizioId: input.preventivo.esercizio_id,
        gestioneId: input.preventivo.gestione_id,
        tipoGestione: input.tipoGestione,
        override: input.override,
        importoLavoriStraordinariCent: input.importoLavoriStraordinariCent,
        fondoSpecialeCostituito: input.fondoSpecialeCostituito,
        importoFondoSpecialeCent: input.importoFondoSpecialeCent,
        autoreId: input.autoreId ?? input.preventivo.autore_id,
      });

      let auditLog: IAuditLog | null = null;
      if (esito.eventoAudit) {
        auditLog = await registraEventoAudit(esito.eventoAudit);
      }

      return { esito, auditLog };
    },
  };
}

export type ContabilitaService = ReturnType<typeof createContabilitaService>;
