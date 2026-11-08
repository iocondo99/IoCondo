/**
 * Logica pura per la Gestione degli Incassi con Imputazione Configurabile, Storno Incassi,
 * Esigibilità e Anzianità dei Crediti, Scadenziario di Recupero Forzoso ex art. 1129 c. 9 c.c.,
 * Elenco Morosi per i Creditori ex art. 63 c. 1 disp. att. c.c. e Principio di Non Redistribuzione
 * delle Quote Morosi sui Condomini Virtuosi
 * (Sezione 6: RC-F1..F4; Sezione 7: RC-G1..G5; Sezione 8: RC-L4; Sezione 10: T12).
 *
 * Principi fondamentali:
 * - Importi esclusivamente in centesimi interi (`Centesimi`), nessun decimale in virgola mobile.
 * - Imputazione incasso: di default FIFO sul debito più vecchio (`PIU_VECCHIO`), configurabile anche
 *   su `PIU_RECENTE` o `MANUALE`, con gestione di incasso parziale, incasso eccedente (credito del soggetto)
 *   e pagamento per conto terzi (es. inquilino che paga per il proprietario, RC-F1..F3).
 * - Storno di un incasso per assegno insoluto o bonifico respinto: scrittura contraria collegata
 *   (`storno_di_id`) senza cancellazione fisica e riapertura automatica del debito (RC-F4).
 * - Esigibilità configurabile e calcolo dell'anzianità del debito per soggetto, unità ed esercizio (RC-G1, RC-G2).
 * - Scadenziario recupero crediti ex art. 1129 c. 9 c.c.: termine perentorio di 6 mesi dalla chiusura
 *   dell'esercizio (o dall'approvazione del rendiconto se configurato), alert automatici a 90, 30 e 7 giorni,
 *   stati (`da avviare`, `avviata`, `dispensata` con delibera e data, `chiusa`) e disattivazione alert in caso
 *   di dispensa assembleare (RC-G3, T12).
 * - Elenco morosi per i creditori non soddisfatti ex art. 63 c. 1 disp. att. c.c. con tracciamento
 *   di richieste e risposte in audit (RC-G4).
 * - Divieto assoluto di redistribuzione delle quote dei morosi sui condomini in regola nei conguagli (RC-G5, RC-L4).
 * - Nessuna dipendenza da React, Expo, `Intl` o Supabase.
 */

import {
  calcolaConguaglio,
  centsToEuro,
  normalizzaCentesimi,
  VERSIONE_MOTORE_CALCOLO,
  type Centesimi,
  type CentesimiInput,
  type RisultatoConguaglio,
} from './contabilitaLogic.ts';
import type { EventoAuditContabile, StatoBollettino, StatoRataModello } from './bollettiniLogic.ts';

// ============================================================================
// COSTANTI E TIPI DI DOMINIO (SEZIONE 6 RC-F E SEZIONE 7 RC-G)
// ============================================================================

export const ORDINI_IMPUTAZIONE_INCASSO = ['PIU_VECCHIO', 'PIU_RECENTE', 'MANUALE'] as const;
export type OrdineImputazioneIncasso = (typeof ORDINI_IMPUTAZIONE_INCASSO)[number];
export type OrdineImputazioneIncassoInput = OrdineImputazioneIncasso | 'FIFO' | 'LIFO';

export const TIPI_CREDITO_CONDOMINIALE = [
  'RATA',
  'SALDO_PREGRESSO',
  'CONGUAGLIO',
  'BOLLETTINO',
] as const;
export type TipoCreditoCondominiale = (typeof TIPI_CREDITO_CONDOMINIALE)[number];

export const METODI_PAGAMENTO_INCASSO = ['BONIFICO', 'SDD', 'CARTA', 'PAY_BY_BANK'] as const;
export type MetodoPagamentoIncasso = (typeof METODI_PAGAMENTO_INCASSO)[number];

export const CRITERI_ESIGIBILITA_RATE_PREVENTIVO = [
  'SCADENZA_RATA',
  'APPROVAZIONE_CONSUNTIVO',
] as const;
export type CriterioEsigibilitaRatePreventivo =
  (typeof CRITERI_ESIGIBILITA_RATE_PREVENTIVO)[number];

export const CRITERI_DECORRENZA_RECUPERO_MESI = [
  'CHIUSURA_ESERCIZIO',
  'APPROVAZIONE_RENDICONTO',
] as const;
export type CriterioDecorrenzaRecuperoMesi = (typeof CRITERI_DECORRENZA_RECUPERO_MESI)[number];

export const STATI_RECUPERO_CREDITO_DB = [
  'DA_AVVIARE',
  'AVVIATO',
  'DISPENSATO',
  'CHIUSO',
] as const;
export type StatoRecuperoCreditoDb = (typeof STATI_RECUPERO_CREDITO_DB)[number];

export const STATI_RECUPERO_CREDITO_TESTO = [
  'da avviare',
  'avviata',
  'dispensata',
  'chiusa',
] as const;
export type StatoRecuperoCreditoTesto = (typeof STATI_RECUPERO_CREDITO_TESTO)[number];

export type StatoRecuperoCreditoInput =
  | StatoRecuperoCreditoDb
  | StatoRecuperoCreditoTesto
  | 'avviato'
  | 'dispensato'
  | 'chiuso';

export const FASCE_ANZIANITA_DEBITO = [
  'NON_SCADUTO',
  'SCADUTO_OGGI',
  '1_30_GG',
  '31_90_GG',
  '91_180_GG',
  'OLTRE_180_GG',
] as const;
export type FasciaAnzianitaDebito = (typeof FASCE_ANZIANITA_DEBITO)[number];

export const CODICI_ALERT_RECUPERO_CREDITI = [
  'ALERT_90_GG',
  'ALERT_30_GG',
  'ALERT_7_GG',
  'TERMINE_PERENTORIO_SCADUTO',
] as const;
export type CodiceAlertRecuperoCrediti = (typeof CODICI_ALERT_RECUPERO_CREDITI)[number];

// ============================================================================
// ERRORI DI DOMINIO
// ============================================================================

export class ErroreIncassoNonValido extends Error {
  readonly codice = 'INCASSO_NON_VALIDO' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreIncassoNonValido';
  }
}

export class ErroreImputazioneIncassoNonValida extends Error {
  readonly codice = 'IMPUTAZIONE_INCASSO_NON_VALIDA' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreImputazioneIncassoNonValida';
  }
}

export class ErroreStornoIncassoNonValido extends Error {
  readonly codice = 'STORNO_INCASSO_NON_VALIDO' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreStornoIncassoNonValido';
  }
}

export class ErroreTransizioneRecuperoCreditiNonValida extends Error {
  readonly codice = 'TRANSIZIONE_RECUPERO_CREDITI_NON_VALIDA' as const;
  readonly statoCorrente: StatoRecuperoCreditoDb;
  readonly statoRichiesto: StatoRecuperoCreditoDb;

  constructor(
    messaggio: string,
    statoCorrente: StatoRecuperoCreditoDb,
    statoRichiesto: StatoRecuperoCreditoDb,
  ) {
    super(messaggio);
    this.name = 'ErroreTransizioneRecuperoCreditiNonValida';
    this.statoCorrente = statoCorrente;
    this.statoRichiesto = statoRichiesto;
  }
}

export class ErroreDispensaRecuperoSenzaDelibera extends Error {
  readonly codice = 'DISPENSA_RECUPERO_SENZA_DELIBERA' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreDispensaRecuperoSenzaDelibera';
  }
}

export class ErroreRedistribuzioneMorositaVietata extends Error {
  readonly codice = 'REDISTRIBUZIONE_MOROSITA_VIETATA' as const;
  readonly importoMorositaTentatoCent: Centesimi;

  constructor(messaggio: string, importoMorositaTentatoCent: Centesimi) {
    super(messaggio);
    this.name = 'ErroreRedistribuzioneMorositaVietata';
    this.importoMorositaTentatoCent = importoMorositaTentatoCent;
  }
}

// ============================================================================
// UTILITA' INTERNE DATE ISO (YYYY-MM-DD) E NORMALIZZAZIONE
// ============================================================================

function validaDataIso(dataIso: string | null | undefined, nomeCampo: string): string {
  if (typeof dataIso !== 'string' || !dataIso.trim()) {
    throw new TypeError(`Data obbligatoria mancante per ${nomeCampo} (atteso formato YYYY-MM-DD).`);
  }
  const pulita = dataIso.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pulita);
  if (!match) {
    throw new TypeError(
      `Data non valida per ${nomeCampo} (atteso formato YYYY-MM-DD): "${dataIso}"`,
    );
  }
  const anno = Number(match[1]);
  const mese = Number(match[2]);
  const giorno = Number(match[3]);
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (
    d.getUTCFullYear() !== anno ||
    d.getUTCMonth() !== mese - 1 ||
    d.getUTCDate() !== giorno
  ) {
    throw new RangeError(`Data inesistente nel calendario per ${nomeCampo}: "${dataIso}"`);
  }
  return pulita;
}

function formattaUtcDateIso(d: Date): string {
  const anno = d.getUTCFullYear();
  const mese = String(d.getUTCMonth() + 1).padStart(2, '0');
  const giorno = String(d.getUTCDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

function ultimoGiornoDelMeseUtc(anno: number, mese1Based: number): number {
  return new Date(Date.UTC(anno, mese1Based, 0)).getUTCDate();
}

/**
 * Aggiunge `mesi` di calendario a una data ISO `YYYY-MM-DD`.
 * Se la data di partenza cade sull'ultimo giorno del mese (es. `2026-12-31`) o se il giorno eccede
 * la capienza del mese di arrivo, viene allineata all'ultimo giorno del mese di destinazione
 * (es. `2026-12-31` + 6 mesi -> `2027-06-30`, caso T12).
 */
export function aggiungiMesiCalendarioIso(dataIso: string, mesi: number): string {
  const pulita = validaDataIso(dataIso, 'dataIso');
  const annoIniziale = Number(pulita.slice(0, 4));
  const meseIniziale = Number(pulita.slice(5, 7)); // 1..12
  const giornoIniziale = Number(pulita.slice(8, 10));

  const eraFineMese =
    giornoIniziale === ultimoGiornoDelMeseUtc(annoIniziale, meseIniziale);

  const indiceMeseTotale = (annoIniziale * 12 + (meseIniziale - 1)) + Math.trunc(mesi);
  const annoArrivo = Math.floor(indiceMeseTotale / 12);
  const meseArrivo = (indiceMeseTotale % 12) + 1;
  const maxGiornoArrivo = ultimoGiornoDelMeseUtc(annoArrivo, meseArrivo);

  const giornoArrivo = eraFineMese
    ? maxGiornoArrivo
    : Math.min(giornoIniziale, maxGiornoArrivo);

  return formattaUtcDateIso(new Date(Date.UTC(annoArrivo, meseArrivo - 1, giornoArrivo)));
}

/**
 * Aggiunge (o sottrae se `giorni < 0`) un numero intero di giorni a una data ISO `YYYY-MM-DD`.
 */
export function aggiungiGiorniIso(dataIso: string, giorni: number): string {
  const pulita = validaDataIso(dataIso, 'dataIso');
  const anno = Number(pulita.slice(0, 4));
  const mese = Number(pulita.slice(5, 7));
  const giorno = Number(pulita.slice(8, 10));
  const ms = Date.UTC(anno, mese - 1, giorno) + Math.trunc(giorni) * 86_400_000;
  return formattaUtcDateIso(new Date(ms));
}

/**
 * Restituisce la differenza intera in giorni solari `(dataFineIso - dataInizioIso)` tra due date ISO `YYYY-MM-DD`.
 */
export function differenzaGiorniIso(dataInizioIso: string, dataFineIso: string): number {
  const inizio = validaDataIso(dataInizioIso, 'dataInizioIso');
  const fine = validaDataIso(dataFineIso, 'dataFineIso');
  const msInizio = Date.UTC(
    Number(inizio.slice(0, 4)),
    Number(inizio.slice(5, 7)) - 1,
    Number(inizio.slice(8, 10)),
  );
  const msFine = Date.UTC(
    Number(fine.slice(0, 4)),
    Number(fine.slice(5, 7)) - 1,
    Number(fine.slice(8, 10)),
  );
  return Math.round((msFine - msInizio) / 86_400_000);
}

/**
 * Normalizza l'ordine di imputazione incassi accettando sia i codici DB (`PIU_VECCHIO`, `PIU_RECENTE`, `MANUALE`)
 * sia gli alias standard (`FIFO`, `LIFO`).
 */
export function normalizzaOrdineImputazione(
  ordine?: OrdineImputazioneIncassoInput | string | null,
): OrdineImputazioneIncasso {
  if (!ordine) return 'PIU_VECCHIO';
  const pulito = ordine.trim().toUpperCase();
  if (pulito === 'PIU_VECCHIO' || pulito === 'FIFO') return 'PIU_VECCHIO';
  if (pulito === 'PIU_RECENTE' || pulito === 'LIFO') return 'PIU_RECENTE';
  if (pulito === 'MANUALE') return 'MANUALE';
  throw new TypeError(
    `Ordine di imputazione incassi non valido: "${String(ordine)}". Valori ammessi: PIU_VECCHIO (FIFO), PIU_RECENTE (LIFO), MANUALE.`,
  );
}

/**
 * Normalizza lo stato dello scadenziario di recupero crediti restituendo sia il codice DB (`DA_AVVIARE`, `AVVIATO`, `DISPENSATO`, `CHIUSO`)
 * sia la rappresentazione testuale richiesta da RC-G3 e T12 (`da avviare`, `avviata`, `dispensata`, `chiusa`).
 */
export function normalizzaStatoRecuperoCredito(stato: StatoRecuperoCreditoInput | string): {
  statoDb: StatoRecuperoCreditoDb;
  statoTesto: StatoRecuperoCreditoTesto;
} {
  const s = (stato ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'DA_AVVIARE') {
    return { statoDb: 'DA_AVVIARE', statoTesto: 'da avviare' };
  }
  if (s === 'AVVIATO' || s === 'AVVIATA') {
    return { statoDb: 'AVVIATO', statoTesto: 'avviata' };
  }
  if (s === 'DISPENSATO' || s === 'DISPENSATA') {
    return { statoDb: 'DISPENSATO', statoTesto: 'dispensata' };
  }
  if (s === 'CHIUSO' || s === 'CHIUSA') {
    return { statoDb: 'CHIUSO', statoTesto: 'chiusa' };
  }
  throw new TypeError(
    `Stato recupero crediti non valido: "${String(stato)}". Stati ammessi: da avviare, avviata, dispensata, chiusa.`,
  );
}

// ============================================================================
// 1. REGISTRAZIONE, IMPUTAZIONE CONFIGURABILE E STORNO INCASSI (RC-F1..F4)
// ============================================================================

export interface DebitoImputabileInput {
  id: string;
  tipoDebito?: TipoCreditoCondominiale;
  unitaId: string;
  esercizioId?: string | null;
  gestioneId?: string | null;
  annoCompetenza?: number | null;
  rataTestataId?: string | null;
  bollettinoId?: string | null;
  utenteId?: string | null;
  soggettoId?: string | null;
  obbligatoInSolidoUtenteId?: string | null;
  descrizione?: string | null;
  /** Data di scadenza o esigibilità del debito (`YYYY-MM-DD`). Usata per l'ordinamento FIFO/LIFO. */
  dataScadenza: string;
  dataEsigibilita?: string | null;
  importoDovutoCent: CentesimiInput;
  importoPagatoCent?: CentesimiInput;
  numeroRata?: number | null;
}

export interface ImputazioneManualeInput {
  debitoId: string;
  importoCent: CentesimiInput;
}

export interface RegistraEImputaIncassoInput {
  incassoId?: string;
  condominioId: string;
  /** Data valuta sul conto corrente condominiale (`YYYY-MM-DD`, obbligatoria per RC-F1). */
  dataValuta: string;
  /** Importo dell'incasso ricevuto in centesimi interi (`> 0`, RC-F1). */
  importoIncassoCent: CentesimiInput;
  /** Identificativo/IBAN del conto corrente condominiale di accredito (RC-F1). */
  contoAccredito?: string | null;
  /** Riferimento bancario dell'operazione (CRO / TRN / ID assegno, RC-F1). */
  riferimentoCro?: string | null;
  causale?: string | null;
  metodo?: MetodoPagamentoIncasso;
  /** Soggetto debitore a cui favore viene eseguito il versamento (es. proprietario). */
  debitoreUtenteId?: string | null;
  debitoreSoggettoId?: string | null;
  debitoreNome?: string | null;
  /**
   * Soggetto che esegue materialmente il pagamento (RC-F1, RC-F3).
   * Se diverso dal debitore (es. l'inquilino che paga per il proprietario), il sistema
   * registra il pagatore a parte e marca `isPagamentoDaTerzo = true`.
   */
  pagatoreNome: string;
  pagatoreUtenteId?: string | null;
  pagatoreSoggettoId?: string | null;
  pagatoreRelazione?: 'PROPRIETARIO' | 'CONDUTTORE' | 'FAMILIARE' | 'TERZO' | null;
  isPagamentoDaTerzo?: boolean;
  /** Ordine di imputazione: default `'PIU_VECCHIO'` (FIFO sul debito più vecchio, RC-F2). */
  ordineImputazione?: OrdineImputazioneIncassoInput;
  /** Elenco dei debiti del soggetto/unità su cui imputare l'incasso. */
  debiti: readonly DebitoImputabileInput[];
  /** Imputazioni esplicite scelte a mano dall'amministratore (RC-F2). */
  imputazioniManuali?: readonly ImputazioneManualeInput[];
  /**
   * Se `true` e in modalità manuale avanza una parte dell'incasso dopo le imputazioni manuali,
   * distribuisce l'eccedenza sui restanti debiti secondo FIFO. Default: `false` (l'eccedenza diventa credito del soggetto).
   */
  completaEccedenzaManualeConFifo?: boolean;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface SingolaImputazioneIncasso {
  debitoId: string;
  tipoDebito: TipoCreditoCondominiale;
  unitaId: string;
  esercizioId: string | null;
  gestioneId: string | null;
  annoCompetenza: number | null;
  bollettinoId: string | null;
  dataEsigibilita: string;
  importoDovutoCent: Centesimi;
  importoPagatoPrecedenteCent: Centesimi;
  residuoPrecedenteCent: Centesimi;
  importoImputatoCent: Centesimi;
  importoImputatoEuro: number;
  nuovoImportoPagatoCent: Centesimi;
  nuovoResiduoCent: Centesimi;
  nuovoResiduoEuro: number;
  saldatoIntegralmente: boolean;
  isParziale: boolean;
  nuovoStatoRataModello: StatoRataModello;
  nuovoStatoRataLegacy: 'DA_PAGARE' | 'PAGATO';
  nuovoStatoBollettino: StatoBollettino;
  metodoMatching: 'AUTO' | 'MANUALE';
}

export interface DebitoPostImputazione {
  id: string;
  tipoDebito: TipoCreditoCondominiale;
  unitaId: string;
  esercizioId: string | null;
  gestioneId: string | null;
  annoCompetenza: number | null;
  bollettinoId: string | null;
  utenteId: string | null;
  soggettoId: string | null;
  obbligatoInSolidoUtenteId: string | null;
  dataScadenza: string;
  dataEsigibilita: string;
  importoDovutoCent: Centesimi;
  importoPagatoPrecedenteCent: Centesimi;
  importoImputatoCent: Centesimi;
  importoPagatoCent: Centesimi;
  residuoCent: Centesimi;
  statoRataModello: StatoRataModello;
  statoRataLegacy: 'DA_PAGARE' | 'PAGATO';
}

export interface RisultatoImputazioneIncasso {
  incassoId: string | null;
  condominioId: string;
  dataValuta: string;
  importoIncassoCent: Centesimi;
  importoIncassoEuro: number;
  contoAccredito: string | null;
  riferimentoCro: string | null;
  causale: string | null;
  metodo: MetodoPagamentoIncasso;
  ordineImputazioneApplicato: OrdineImputazioneIncasso;
  debitore: {
    utenteId: string | null;
    soggettoId: string | null;
    nome: string | null;
  };
  pagatore: {
    nome: string;
    utenteId: string | null;
    soggettoId: string | null;
    relazione: 'PROPRIETARIO' | 'CONDUTTORE' | 'FAMILIARE' | 'TERZO';
    isPagamentoDaTerzo: boolean;
  };
  imputazioni: SingolaImputazioneIncasso[];
  debitiAggiornati: DebitoPostImputazione[];
  totaleImputatoCent: Centesimi;
  totaleImputatoEuro: number;
  /** Importo eventualmente eccedente tutti i debiti imputati, che costituisce un credito del soggetto (RC-F3). */
  creditoEccedenteSoggettoCent: Centesimi;
  creditoEccedenteSoggettoEuro: number;
  haEccedenza: boolean;
  haImputazioneParziale: boolean;
  statoRiconciliazioneTransazione: 'NON_RICONCILIATA' | 'PARZIALE' | 'RICONCILIATA';
  eventoAudit: EventoAuditContabile;
  versioneMotore: string;
}

function prioritaTipoDebito(tipo: TipoCreditoCondominiale): number {
  switch (tipo) {
    case 'SALDO_PREGRESSO':
      return 1;
    case 'CONGUAGLIO':
      return 2;
    case 'RATA':
      return 3;
    case 'BOLLETTINO':
      return 4;
  }
}

/**
 * Ordina i debiti secondo il criterio configurato (`PIU_VECCHIO` / FIFO o `PIU_RECENTE` / LIFO, RC-F2).
 */
export function ordinaDebitiPerImputazione<T extends DebitoImputabileInput>(
  debiti: readonly T[],
  ordine: OrdineImputazioneIncassoInput = 'PIU_VECCHIO',
): T[] {
  const ordNorm = normalizzaOrdineImputazione(ordine);
  const indicizzati = debiti.map((debito, idx) => ({
    debito,
    idx,
    dataChiave: validaDataIso(
      debito.dataEsigibilita ?? debito.dataScadenza,
      `debiti[${idx}].dataEsigibilita`,
    ),
    anno: debito.annoCompetenza ?? Number(debito.dataScadenza.slice(0, 4)),
    prioTipo: prioritaTipoDebito(debito.tipoDebito ?? 'RATA'),
    numRata: debito.numeroRata ?? 999,
  }));

  if (ordNorm === 'MANUALE') {
    return indicizzati.map((x) => x.debito);
  }

  const fattore = ordNorm === 'PIU_VECCHIO' ? 1 : -1;

  indicizzati.sort((a, b) => {
    if (a.dataChiave !== b.dataChiave) {
      return a.dataChiave < b.dataChiave ? -1 * fattore : 1 * fattore;
    }
    if (a.anno !== b.anno) {
      return (a.anno - b.anno) * fattore;
    }
    if (a.prioTipo !== b.prioTipo) {
      return (a.prioTipo - b.prioTipo) * fattore;
    }
    if (a.numRata !== b.numRata) {
      return (a.numRata - b.numRata) * fattore;
    }
    return a.idx - b.idx;
  });

  return indicizzati.map((x) => x.debito);
}

/**
 * Registra e imputa un incasso ricevuto sul conto corrente condominiale (RC-F1, RC-F2, RC-F3):
 * - Di default imputa in ordine FIFO sul debito più vecchio (`PIU_VECCHIO`);
 * - Supporta l'imputazione manuale dell'amministratore (`MANUALE` o `imputazioniManuali`);
 * - Gestisce incassi parziali, incassi multi-debito, incassi eccedenti (credito del soggetto)
 *   e pagamenti eseguiti da un terzo (es. inquilino che paga per il proprietario).
 */
export function imputaIncasso(input: RegistraEImputaIncassoInput): RisultatoImputazioneIncasso {
  if (!input.condominioId || !input.condominioId.trim()) {
    throw new ErroreIncassoNonValido('Il condominioId è obbligatorio per registrare un incasso (RC-F1).');
  }
  const dataValuta = validaDataIso(input.dataValuta, 'dataValuta');
  const importoIncassoCent = normalizzaCentesimi(input.importoIncassoCent);
  if (importoIncassoCent <= 0) {
    throw new ErroreIncassoNonValido(
      `L'importo dell'incasso deve essere strettamente positivo (ricevuto: ${importoIncassoCent} centesimi, RC-F1).`,
    );
  }

  const pagatoreNome = (input.pagatoreNome ?? '').trim();
  if (!pagatoreNome) {
    throw new ErroreIncassoNonValido(
      'Il nominativo del pagatore è obbligatorio per la registrazione dell\'incasso (RC-F1, RC-F3).',
    );
  }

  const ordineRichiesto =
    input.imputazioniManuali && input.imputazioniManuali.length > 0 && !input.ordineImputazione
      ? 'MANUALE'
      : normalizzaOrdineImputazione(input.ordineImputazione);

  // Validazione preliminare dei debiti e calcolo residui iniziali
  const mappaDebiti = new Map<
    string,
    {
      originale: DebitoImputabileInput;
      tipoDebito: TipoCreditoCondominiale;
      dataScadenza: string;
      dataEsigibilita: string;
      dovutoCent: Centesimi;
      pagatoInizialeCent: Centesimi;
      residuoInizialeCent: Centesimi;
    }
  >();

  for (let i = 0; i < input.debiti.length; i++) {
    const d = input.debiti[i]!;
    if (!d.id || !d.id.trim()) {
      throw new ErroreImputazioneIncassoNonValida(`Debito in posizione ${i} privo di id.`);
    }
    if (mappaDebiti.has(d.id)) {
      throw new ErroreImputazioneIncassoNonValida(`Debito duplicato nell'elenco di imputazione: "${d.id}".`);
    }
    const dataScadenza = validaDataIso(d.dataScadenza, `debiti[${i}].dataScadenza`);
    const dataEsigibilita = d.dataEsigibilita
      ? validaDataIso(d.dataEsigibilita, `debiti[${i}].dataEsigibilita`)
      : dataScadenza;
    const dovutoCent = normalizzaCentesimi(d.importoDovutoCent);
    const pagatoInizialeCent = normalizzaCentesimi(d.importoPagatoCent ?? 0);
    if (dovutoCent < 0 || pagatoInizialeCent < 0) {
      throw new ErroreImputazioneIncassoNonValida(
        `Importi negativi non ammessi sul debito "${d.id}".`,
      );
    }
    const residuoInizialeCent = Math.max(0, normalizzaCentesimi(dovutoCent - pagatoInizialeCent));
    mappaDebiti.set(d.id, {
      originale: d,
      tipoDebito: d.tipoDebito ?? 'RATA',
      dataScadenza,
      dataEsigibilita,
      dovutoCent,
      pagatoInizialeCent,
      residuoInizialeCent,
    });
  }

  const importoImputatoPerDebito = new Map<string, Centesimi>();
  const metodoPerDebito = new Map<string, 'AUTO' | 'MANUALE'>();
  let disponibilitaResiduoIncassoCent = importoIncassoCent;

  // 1. Gestione eventuali imputazioni manuali (RC-F2)
  if (ordineRichiesto === 'MANUALE' || (input.imputazioniManuali && input.imputazioniManuali.length > 0)) {
    if (!input.imputazioniManuali || input.imputazioniManuali.length === 0) {
      throw new ErroreImputazioneIncassoNonValida(
        'In modalità di imputazione MANUALE è obbligatorio specificare almeno una riga in imputazioniManuali (RC-F2).',
      );
    }

    for (const impMan of input.imputazioniManuali) {
      const infoDebito = mappaDebiti.get(impMan.debitoId);
      if (!infoDebito) {
        throw new ErroreImputazioneIncassoNonValida(
          `Debito "${impMan.debitoId}" indicato nell'imputazione manuale non trovato tra i debiti del soggetto.`,
        );
      }
      const importoManCent = normalizzaCentesimi(impMan.importoCent);
      if (importoManCent <= 0) {
        throw new ErroreImputazioneIncassoNonValida(
          `L'importo imputato manualmente al debito "${impMan.debitoId}" deve essere maggiore di zero.`,
        );
      }
      const giaImputato = importoImputatoPerDebito.get(impMan.debitoId) ?? 0;
      const totaleSuDebito = normalizzaCentesimi(giaImputato + importoManCent);
      if (totaleSuDebito > infoDebito.residuoInizialeCent) {
        throw new ErroreImputazioneIncassoNonValida(
          `L'importo imputato manualmente (${totaleSuDebito} cent) supera il residuo dovuto (${infoDebito.residuoInizialeCent} cent) sul debito "${impMan.debitoId}".`,
        );
      }
      if (importoManCent > disponibilitaResiduoIncassoCent) {
        throw new ErroreImputazioneIncassoNonValida(
          `La somma delle imputazioni manuali supera l'importo totale dell'incasso (${importoIncassoCent} cent).`,
        );
      }

      importoImputatoPerDebito.set(impMan.debitoId, totaleSuDebito);
      metodoPerDebito.set(impMan.debitoId, 'MANUALE');
      disponibilitaResiduoIncassoCent = normalizzaCentesimi(
        disponibilitaResiduoIncassoCent - importoManCent,
      );
    }
  }

  // 2. Distribuzione automatica (FIFO default sul più vecchio o LIFO sul più recente, RC-F2)
  const deveDistribuireAuto =
    ordineRichiesto !== 'MANUALE' || Boolean(input.completaEccedenzaManualeConFifo);

  if (deveDistribuireAuto && disponibilitaResiduoIncassoCent > 0) {
    const criterioOrdineAuto: OrdineImputazioneIncasso =
      ordineRichiesto === 'PIU_RECENTE' ? 'PIU_RECENTE' : 'PIU_VECCHIO';
    const debitiOrdinati = ordinaDebitiPerImputazione(input.debiti, criterioOrdineAuto);

    for (const d of debitiOrdinati) {
      if (disponibilitaResiduoIncassoCent <= 0) break;
      const info = mappaDebiti.get(d.id)!;
      const giaImputato = importoImputatoPerDebito.get(d.id) ?? 0;
      const capienzaDebitoCent = normalizzaCentesimi(info.residuoInizialeCent - giaImputato);
      if (capienzaDebitoCent <= 0) continue;

      const quotaDaImputareCent = Math.min(disponibilitaResiduoIncassoCent, capienzaDebitoCent);
      importoImputatoPerDebito.set(
        d.id,
        normalizzaCentesimi(giaImputato + quotaDaImputareCent),
      );
      if (!metodoPerDebito.has(d.id)) {
        metodoPerDebito.set(d.id, 'AUTO');
      }
      disponibilitaResiduoIncassoCent = normalizzaCentesimi(
        disponibilitaResiduoIncassoCent - quotaDaImputareCent,
      );
    }
  }

  // 3. Costruzione risultati analitici in ordine di imputazione
  const debitiPerOutput =
    ordineRichiesto === 'MANUALE'
      ? [...input.debiti]
      : ordinaDebitiPerImputazione(input.debiti, ordineRichiesto);

  const imputazioni: SingolaImputazioneIncasso[] = [];
  const debitiAggiornati: DebitoPostImputazione[] = [];
  let totaleImputatoCent = 0;
  let haImputazioneParziale = false;

  for (const d of debitiPerOutput) {
    const info = mappaDebiti.get(d.id)!;
    const importoImputatoCent = importoImputatoPerDebito.get(d.id) ?? 0;
    const nuovoImportoPagatoCent = normalizzaCentesimi(
      info.pagatoInizialeCent + importoImputatoCent,
    );
    const nuovoResiduoCent = Math.max(
      0,
      normalizzaCentesimi(info.dovutoCent - nuovoImportoPagatoCent),
    );
    const saldatoIntegralmente = info.dovutoCent > 0 && nuovoResiduoCent === 0;
    const isParziale = importoImputatoCent > 0 && nuovoResiduoCent > 0;
    if (isParziale) {
      haImputazioneParziale = true;
    }

    const nuovoStatoRataModello: StatoRataModello = saldatoIntegralmente
      ? 'PAGATA'
      : nuovoImportoPagatoCent > 0
        ? 'PARZIALMENTE_PAGATA'
        : 'EMESSA';
    const nuovoStatoRataLegacy: 'DA_PAGARE' | 'PAGATO' = saldatoIntegralmente
      ? 'PAGATO'
      : 'DA_PAGARE';
    const nuovoStatoBollettino: StatoBollettino = saldatoIntegralmente
      ? 'PAGATO'
      : nuovoImportoPagatoCent > 0
        ? 'PARZIALMENTE_PAGATO'
        : 'EMESSO';

    debitiAggiornati.push({
      id: d.id,
      tipoDebito: info.tipoDebito,
      unitaId: d.unitaId,
      esercizioId: d.esercizioId ?? null,
      gestioneId: d.gestioneId ?? null,
      annoCompetenza: d.annoCompetenza ?? null,
      bollettinoId: d.bollettinoId ?? null,
      utenteId: d.utenteId ?? null,
      soggettoId: d.soggettoId ?? null,
      obbligatoInSolidoUtenteId: d.obbligatoInSolidoUtenteId ?? null,
      dataScadenza: info.dataScadenza,
      dataEsigibilita: info.dataEsigibilita,
      importoDovutoCent: info.dovutoCent,
      importoPagatoPrecedenteCent: info.pagatoInizialeCent,
      importoImputatoCent,
      importoPagatoCent: nuovoImportoPagatoCent,
      residuoCent: nuovoResiduoCent,
      statoRataModello: nuovoStatoRataModello,
      statoRataLegacy: nuovoStatoRataLegacy,
    });

    if (importoImputatoCent > 0) {
      totaleImputatoCent = normalizzaCentesimi(totaleImputatoCent + importoImputatoCent);
      imputazioni.push({
        debitoId: d.id,
        tipoDebito: info.tipoDebito,
        unitaId: d.unitaId,
        esercizioId: d.esercizioId ?? null,
        gestioneId: d.gestioneId ?? null,
        annoCompetenza: d.annoCompetenza ?? null,
        bollettinoId: d.bollettinoId ?? null,
        dataEsigibilita: info.dataEsigibilita,
        importoDovutoCent: info.dovutoCent,
        importoPagatoPrecedenteCent: info.pagatoInizialeCent,
        residuoPrecedenteCent: info.residuoInizialeCent,
        importoImputatoCent,
        importoImputatoEuro: centsToEuro(importoImputatoCent),
        nuovoImportoPagatoCent,
        nuovoResiduoCent,
        nuovoResiduoEuro: centsToEuro(nuovoResiduoCent),
        saldatoIntegralmente,
        isParziale,
        nuovoStatoRataModello,
        nuovoStatoRataLegacy,
        nuovoStatoBollettino,
        metodoMatching: metodoPerDebito.get(d.id) ?? 'AUTO',
      });
    }
  }

  const creditoEccedenteSoggettoCent = normalizzaCentesimi(
    importoIncassoCent - totaleImputatoCent,
  );
  const haEccedenza = creditoEccedenteSoggettoCent > 0;

  // Rilevazione pagamento per conto terzi (RC-F3: es. inquilino che paga per il proprietario)
  const primoDebito = input.debiti[0];
  const debitoreUtenteId = input.debitoreUtenteId ?? primoDebito?.utenteId ?? null;
  const debitoreSoggettoId = input.debitoreSoggettoId ?? primoDebito?.soggettoId ?? null;
  const debitoreNome = input.debitoreNome ?? null;

  const diversoUtente =
    Boolean(input.pagatoreUtenteId) &&
    Boolean(debitoreUtenteId) &&
    input.pagatoreUtenteId !== debitoreUtenteId;
  const diversoSoggetto =
    Boolean(input.pagatoreSoggettoId) &&
    Boolean(debitoreSoggettoId) &&
    input.pagatoreSoggettoId !== debitoreSoggettoId;
  const diversoNome =
    Boolean(debitoreNome) &&
    pagatoreNome.toLowerCase() !== debitoreNome!.trim().toLowerCase();
  const relazioneTerzo =
    input.pagatoreRelazione === 'CONDUTTORE' ||
    input.pagatoreRelazione === 'FAMILIARE' ||
    input.pagatoreRelazione === 'TERZO';

  const isPagamentoDaTerzo =
    input.isPagamentoDaTerzo !== undefined
      ? Boolean(input.isPagamentoDaTerzo)
      : diversoUtente || diversoSoggetto || diversoNome || relazioneTerzo;

  const relazioneEffettiva: 'PROPRIETARIO' | 'CONDUTTORE' | 'FAMILIARE' | 'TERZO' =
    input.pagatoreRelazione ?? (isPagamentoDaTerzo ? 'TERZO' : 'PROPRIETARIO');

  const statoRiconciliazioneTransazione: 'NON_RICONCILIATA' | 'PARZIALE' | 'RICONCILIATA' =
    totaleImputatoCent === 0
      ? 'NON_RICONCILIATA'
      : creditoEccedenteSoggettoCent === 0
        ? 'RICONCILIATA'
        : 'PARZIALE';

  const eventoAudit: EventoAuditContabile = {
    azione: 'REGISTRAZIONE_E_IMPUTAZIONE_INCASSO',
    tabella: 'transazioni_bancarie',
    recordId: input.incassoId ?? null,
    condominioId: input.condominioId,
    autoreId: input.autoreId ?? null,
    timestampIso: input.timestampIso ?? new Date().toISOString(),
    motivo:
      input.causale ??
      `Incasso di ${centsToEuro(importoIncassoCent, true, true)} da ${pagatoreNome} (ordine: ${ordineRichiesto})`,
    valorePrima: null,
    valoreDopo: {
      data_valuta: dataValuta,
      importo_incasso_centesimi: importoIncassoCent,
      totale_imputato_centesimi: totaleImputatoCent,
      credito_eccedente_centesimi: creditoEccedenteSoggettoCent,
      ordine_imputazione: ordineRichiesto,
      pagatore_nome: pagatoreNome,
      pagatore_utente_id: input.pagatoreUtenteId ?? null,
      is_pagamento_da_terzo: isPagamentoDaTerzo,
      riferimento_cro: input.riferimentoCro ?? null,
      numero_debiti_imputati: imputazioni.length,
    },
  };

  return {
    incassoId: input.incassoId ?? null,
    condominioId: input.condominioId,
    dataValuta,
    importoIncassoCent,
    importoIncassoEuro: centsToEuro(importoIncassoCent),
    contoAccredito: input.contoAccredito ?? null,
    riferimentoCro: input.riferimentoCro ?? null,
    causale: input.causale ?? null,
    metodo: input.metodo ?? 'BONIFICO',
    ordineImputazioneApplicato: ordineRichiesto,
    debitore: {
      utenteId: debitoreUtenteId,
      soggettoId: debitoreSoggettoId,
      nome: debitoreNome,
    },
    pagatore: {
      nome: pagatoreNome,
      utenteId: input.pagatoreUtenteId ?? null,
      soggettoId: input.pagatoreSoggettoId ?? null,
      relazione: relazioneEffettiva,
      isPagamentoDaTerzo,
    },
    imputazioni,
    debitiAggiornati,
    totaleImputatoCent,
    totaleImputatoEuro: centsToEuro(totaleImputatoCent),
    creditoEccedenteSoggettoCent,
    creditoEccedenteSoggettoEuro: centsToEuro(creditoEccedenteSoggettoCent),
    haEccedenza,
    haImputazioneParziale,
    statoRiconciliazioneTransazione,
    eventoAudit,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 1.B STORNO DI UN INCASSO PER ASSEGNO/BONIFICO RESPINTO (RC-F4)
// ============================================================================

export interface ImputazionePrecedenteDaStornareInput {
  debitoId: string;
  tipoDebito?: TipoCreditoCondominiale;
  unitaId: string;
  bollettinoId?: string | null;
  importoDovutoCent: CentesimiInput;
  /** Importo attualmente risultante come pagato sul debito prima dello storno. */
  importoPagatoAttualeCent: CentesimiInput;
  /** Quota che era stata imputata da questo specifico incasso ora respinto. */
  importoImputatoDaIncassoCent: CentesimiInput;
}

export interface StornaIncassoRespintoInput {
  incassoOriginaleId: string;
  condominioId: string;
  importoOriginaleCent: CentesimiInput;
  dataValutaOriginale: string;
  /** Data di registrazione dello storno per insoluto/bonifico respinto (`YYYY-MM-DD`). */
  dataStorno: string;
  /** Motivo obbligatorio dello storno (es. `"Assegno insoluto"` o `"Bonifico respinto/revocato"`, RC-F4). */
  motivoStorno: string;
  pagatoreNome?: string | null;
  riferimentoCroOriginale?: string | null;
  giustificazioniImputazione: readonly ImputazionePrecedenteDaStornareInput[];
  autoreId?: string | null;
  timestampIso?: string;
}

export interface DebitoRiapertoPostStorno {
  debitoId: string;
  tipoDebito: TipoCreditoCondominiale;
  unitaId: string;
  bollettinoId: string | null;
  importoDovutoCent: Centesimi;
  importoPagatoPrimaDelloStornoCent: Centesimi;
  importoStornatoCent: Centesimi;
  nuovoImportoPagatoCent: Centesimi;
  nuovoResiduoCent: Centesimi;
  nuovoResiduoEuro: number;
  debitoRiaperto: boolean;
  nuovoStatoRataModello: StatoRataModello;
  nuovoStatoRataLegacy: 'DA_PAGARE' | 'PAGATO';
  nuovoStatoBollettino: StatoBollettino;
}

export interface RisultatoStornoIncassoRespinto {
  incassoOriginaleId: string;
  condominioId: string;
  dataStorno: string;
  motivoStorno: string;
  scritturaStornoTransazione: {
    condominio_id: string;
    data_valuta: string;
    importo_centesimi: Centesimi;
    importo: number;
    causale: string;
    origine: 'MANUALE';
    stato_riconciliazione: 'IGNORATA';
    pagatore_nome: string | null;
    riferimento_cro: string | null;
    storno_di_id: string;
    autore_id: string | null;
  };
  debitiRiaperti: DebitoRiapertoPostStorno[];
  totaleDebitoRiapertoCent: Centesimi;
  totaleDebitoRiapertoEuro: number;
  saldoNettoIncassoCent: 0;
  eventoAudit: EventoAuditContabile;
  versioneMotore: string;
}

/**
 * Storna un incasso precedentemente registrato (es. assegno scoperto o bonifico respinto, RC-F4):
 * - Crea la scrittura contraria collegata a `incassoOriginaleId` tramite `storno_di_id` (nessuna cancellazione fisica);
 * - Riapre automaticamente tutti i debiti su cui l'incasso era stato imputato, ripristinando il residuo dovuto;
 * - Registra l'operazione in audit.
 */
export function stornaIncassoRespinto(
  input: StornaIncassoRespintoInput,
): RisultatoStornoIncassoRespinto {
  if (!input.incassoOriginaleId || !input.incassoOriginaleId.trim()) {
    throw new ErroreStornoIncassoNonValido(
      'L\'ID dell\'incasso originale da stornare è obbligatorio (RC-F4).',
    );
  }
  if (!input.condominioId || !input.condominioId.trim()) {
    throw new ErroreStornoIncassoNonValido('Il condominioId è obbligatorio per lo storno (RC-F4).');
  }
  const motivoStorno = (input.motivoStorno ?? '').trim();
  if (motivoStorno.length < 3) {
    throw new ErroreStornoIncassoNonValido(
      'Il motivo dello storno (es. assegno insoluto o bonifico respinto) è obbligatorio (RC-F4).',
    );
  }

  validaDataIso(input.dataValutaOriginale, 'dataValutaOriginale');
  const dataStorno = validaDataIso(input.dataStorno, 'dataStorno');
  const importoOriginaleCent = normalizzaCentesimi(input.importoOriginaleCent);
  if (importoOriginaleCent <= 0) {
    throw new ErroreStornoIncassoNonValido(
      `L'importo originale dell'incasso da stornare deve essere positivo (ricevuto: ${importoOriginaleCent}).`,
    );
  }

  const debitiRiaperti: DebitoRiapertoPostStorno[] = [];
  let totaleDebitoRiapertoCent = 0;

  for (const item of input.giustificazioniImputazione) {
    const dovutoCent = normalizzaCentesimi(item.importoDovutoCent);
    const pagatoPrimaCent = normalizzaCentesimi(item.importoPagatoAttualeCent);
    const stornatoCent = normalizzaCentesimi(item.importoImputatoDaIncassoCent);

    if (stornatoCent <= 0) {
      throw new ErroreStornoIncassoNonValido(
        `L'importo da stornare sul debito "${item.debitoId}" deve essere positivo.`,
      );
    }
    if (stornatoCent > pagatoPrimaCent) {
      throw new ErroreStornoIncassoNonValido(
        `Impossibile stornare ${stornatoCent} cent dal debito "${item.debitoId}": l'importo pagato attuale è ${pagatoPrimaCent} cent.`,
      );
    }

    const nuovoImportoPagatoCent = normalizzaCentesimi(pagatoPrimaCent - stornatoCent);
    const nuovoResiduoCent = Math.max(0, normalizzaCentesimi(dovutoCent - nuovoImportoPagatoCent));
    totaleDebitoRiapertoCent = normalizzaCentesimi(totaleDebitoRiapertoCent + stornatoCent);

    const saldato = dovutoCent > 0 && nuovoResiduoCent === 0;
    const nuovoStatoRataModello: StatoRataModello = saldato
      ? 'PAGATA'
      : nuovoImportoPagatoCent > 0
        ? 'PARZIALMENTE_PAGATA'
        : 'EMESSA';
    const nuovoStatoRataLegacy: 'DA_PAGARE' | 'PAGATO' = saldato ? 'PAGATO' : 'DA_PAGARE';
    const nuovoStatoBollettino: StatoBollettino = saldato
      ? 'PAGATO'
      : nuovoImportoPagatoCent > 0
        ? 'PARZIALMENTE_PAGATO'
        : 'EMESSO';

    debitiRiaperti.push({
      debitoId: item.debitoId,
      tipoDebito: item.tipoDebito ?? 'RATA',
      unitaId: item.unitaId,
      bollettinoId: item.bollettinoId ?? null,
      importoDovutoCent: dovutoCent,
      importoPagatoPrimaDelloStornoCent: pagatoPrimaCent,
      importoStornatoCent: stornatoCent,
      nuovoImportoPagatoCent,
      nuovoResiduoCent,
      nuovoResiduoEuro: centsToEuro(nuovoResiduoCent),
      debitoRiaperto: nuovoResiduoCent > 0,
      nuovoStatoRataModello,
      nuovoStatoRataLegacy,
      nuovoStatoBollettino,
    });
  }

  if (totaleDebitoRiapertoCent > importoOriginaleCent) {
    throw new ErroreStornoIncassoNonValido(
      `La somma degli importi stornati sui debiti (${totaleDebitoRiapertoCent} cent) supera l'importo dell'incasso originale (${importoOriginaleCent} cent).`,
    );
  }

  const importoStornoNegativoCent = normalizzaCentesimi(-importoOriginaleCent);
  const scritturaStornoTransazione = {
    condominio_id: input.condominioId,
    data_valuta: dataStorno,
    importo_centesimi: importoStornoNegativoCent,
    importo: centsToEuro(importoStornoNegativoCent),
    causale: `STORNO INCASSO (${motivoStorno}) — Rif. incasso ${input.incassoOriginaleId}`,
    origine: 'MANUALE' as const,
    stato_riconciliazione: 'IGNORATA' as const,
    pagatore_nome: input.pagatoreNome ?? null,
    riferimento_cro: input.riferimentoCroOriginale ?? null,
    storno_di_id: input.incassoOriginaleId,
    autore_id: input.autoreId ?? null,
  };

  const eventoAudit: EventoAuditContabile = {
    azione: 'STORNO_INCASSO_RIAPERTURA_DEBITO',
    tabella: 'transazioni_bancarie',
    recordId: input.incassoOriginaleId,
    condominioId: input.condominioId,
    autoreId: input.autoreId ?? null,
    timestampIso: input.timestampIso ?? new Date().toISOString(),
    motivo: motivoStorno,
    valorePrima: {
      incasso_originale_id: input.incassoOriginaleId,
      importo_originale_centesimi: importoOriginaleCent,
      debiti_precedenti: debitiRiaperti.map((d) => ({
        debito_id: d.debitoId,
        importo_pagato_centesimi: d.importoPagatoPrimaDelloStornoCent,
      })),
    },
    valoreDopo: {
      storno_di_id: input.incassoOriginaleId,
      importo_storno_centesimi: importoStornoNegativoCent,
      totale_debito_riaperto_centesimi: totaleDebitoRiapertoCent,
      debiti_riaperti: debitiRiaperti.map((d) => ({
        debito_id: d.debitoId,
        nuovo_importo_pagato_centesimi: d.nuovoImportoPagatoCent,
        nuovo_residuo_centesimi: d.nuovoResiduoCent,
        nuovo_stato: d.nuovoStatoRataModello,
      })),
    },
  };

  return {
    incassoOriginaleId: input.incassoOriginaleId,
    condominioId: input.condominioId,
    dataStorno,
    motivoStorno,
    scritturaStornoTransazione,
    debitiRiaperti,
    totaleDebitoRiapertoCent,
    totaleDebitoRiapertoEuro: centsToEuro(totaleDebitoRiapertoCent),
    saldoNettoIncassoCent: 0,
    eventoAudit,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 2. ESIGIBILITA' CREDITI E ANZIANITA' DEL DEBITO (RC-G1, RC-G2)
// ============================================================================

export interface CalcolaEsigibilitaCreditoInput {
  tipoCredito: TipoCreditoCondominiale;
  /** Data di scadenza della rata o del bollettino (`YYYY-MM-DD`). */
  dataScadenza?: string | null;
  /** Data di esigibilità esplicita registrata sul credito (`YYYY-MM-DD`). */
  dataEsigibilitaEsplicita?: string | null;
  /** Data in cui l'assemblea ha approvato il consuntivo/rendiconto (`YYYY-MM-DD`). */
  dataApprovazioneConsuntivo?: string | null;
  /**
   * Parametro configurabile del condominio per le rate di preventivo (RC-G2):
   * - `'SCADENZA_RATA'` (default): le rate sono esigibili alla data di scadenza;
   * - `'APPROVAZIONE_CONSUNTIVO'`: esigibili solo dopo l'approvazione del consuntivo.
   */
  criterioEsigibilitaRatePreventivo?: CriterioEsigibilitaRatePreventivo;
}

/**
 * Determina la data di esigibilità di un credito condominiale secondo RC-G2:
 * - Le rate di preventivo sono esigibili alla scadenza (`SCADENZA_RATA`, default) oppure
 *   dopo l'approvazione del consuntivo se il condominio ha configurato `APPROVAZIONE_CONSUNTIVO`;
 * - Il conguaglio è esigibile dopo l'approvazione del consuntivo (`dataApprovazioneConsuntivo` o `dataEsigibilitaEsplicita`).
 */
export function calcolaDataEsigibilitaCredito(
  input: CalcolaEsigibilitaCreditoInput,
): string | null {
  const criterioRate = input.criterioEsigibilitaRatePreventivo ?? 'SCADENZA_RATA';

  if (input.tipoCredito === 'CONGUAGLIO') {
    if (input.dataEsigibilitaEsplicita) {
      return validaDataIso(input.dataEsigibilitaEsplicita, 'dataEsigibilitaEsplicita');
    }
    if (input.dataApprovazioneConsuntivo) {
      return validaDataIso(input.dataApprovazioneConsuntivo, 'dataApprovazioneConsuntivo');
    }
    return null;
  }

  if (input.tipoCredito === 'RATA' || input.tipoCredito === 'BOLLETTINO') {
    if (criterioRate === 'APPROVAZIONE_CONSUNTIVO') {
      if (input.dataApprovazioneConsuntivo) {
        return validaDataIso(input.dataApprovazioneConsuntivo, 'dataApprovazioneConsuntivo');
      }
      return null;
    }
    if (input.dataEsigibilitaEsplicita) {
      return validaDataIso(input.dataEsigibilitaEsplicita, 'dataEsigibilitaEsplicita');
    }
    if (input.dataScadenza) {
      return validaDataIso(input.dataScadenza, 'dataScadenza');
    }
    return null;
  }

  // SALDO_PREGRESSO
  if (input.dataEsigibilitaEsplicita) {
    return validaDataIso(input.dataEsigibilitaEsplicita, 'dataEsigibilitaEsplicita');
  }
  if (input.dataApprovazioneConsuntivo) {
    return validaDataIso(input.dataApprovazioneConsuntivo, 'dataApprovazioneConsuntivo');
  }
  if (input.dataScadenza) {
    return validaDataIso(input.dataScadenza, 'dataScadenza');
  }
  return null;
}

export interface CreditoMorositaInput {
  id: string;
  tipoCredito?: TipoCreditoCondominiale;
  unitaId: string;
  unitaInterno?: string | null;
  esercizioId: string;
  annoCompetenza: number;
  gestioneId?: string | null;
  utenteId?: string | null;
  soggettoId?: string | null;
  nomeSoggetto?: string | null;
  obbligatoInSolidoUtenteId?: string | null;
  obbligatoInSolidoSoggettoId?: string | null;
  nomeObbligatoInSolido?: string | null;
  importoDovutoCent: CentesimiInput;
  importoPagatoCent?: CentesimiInput;
  dataScadenza?: string | null;
  dataEsigibilita?: string | null;
  dataApprovazioneConsuntivo?: string | null;
  descrizione?: string | null;
}

export interface PosizioneCreditoAnalizzata {
  id: string;
  tipoCredito: TipoCreditoCondominiale;
  unitaId: string;
  unitaInterno: string | null;
  esercizioId: string;
  annoCompetenza: number;
  gestioneId: string | null;
  utenteId: string | null;
  soggettoId: string | null;
  nomeSoggetto: string | null;
  obbligatoInSolidoUtenteId: string | null;
  obbligatoInSolidoSoggettoId: string | null;
  nomeObbligatoInSolido: string | null;
  importoDovutoCent: Centesimi;
  importoPagatoCent: Centesimi;
  residuoCent: Centesimi;
  residuoEuro: number;
  dataEsigibilita: string | null;
  isEsigibile: boolean;
  /** Giorni trascorsi dalla data di esigibilità alla data di riferimento (`0` se non ancora scaduto). */
  giorniAnzianita: number;
  fasciaAnzianita: FasciaAnzianitaDebito;
}

export interface RiepilogoMorositaSoggetto {
  soggettoKey: string;
  utenteId: string | null;
  soggettoId: string | null;
  nomeSoggetto: string;
  unitaIds: string[];
  anniCompetenza: number[];
  totaleDovutoCent: Centesimi;
  totalePagatoCent: Centesimi;
  totaleResiduoCent: Centesimi;
  totaleEsigibileCent: Centesimi;
  totaleEsigibileEuro: number;
  totaleNonEsigibileCent: Centesimi;
  anzianitaMassimaGiorni: number;
  dataEsigibilitaPiuVecchia: string | null;
  fasciaMassima: FasciaAnzianitaDebito;
  numeroCreditiAperti: number;
}

export interface RiepilogoMorositaUnita {
  unitaId: string;
  unitaInterno: string | null;
  anniCompetenza: number[];
  totaleDovutoCent: Centesimi;
  totalePagatoCent: Centesimi;
  totaleResiduoCent: Centesimi;
  totaleEsigibileCent: Centesimi;
  totaleEsigibileEuro: number;
  totaleNonEsigibileCent: Centesimi;
  anzianitaMassimaGiorni: number;
  dataEsigibilitaPiuVecchia: string | null;
  creditiIds: string[];
}

export interface RiepilogoMorositaEsercizio {
  esercizioId: string;
  annoCompetenza: number;
  totaleDovutoCent: Centesimi;
  totalePagatoCent: Centesimi;
  totaleResiduoCent: Centesimi;
  totaleEsigibileCent: Centesimi;
  totaleEsigibileEuro: number;
  totaleNonEsigibileCent: Centesimi;
  anzianitaMassimaGiorni: number;
  numeroUnitaMorose: number;
  numeroSoggettiMorosi: number;
}

export interface AnalisiMorositaCondominioOutput {
  dataRiferimento: string;
  criterioEsigibilitaRatePreventivo: CriterioEsigibilitaRatePreventivo;
  posizioniDettaglio: PosizioneCreditoAnalizzata[];
  perSoggetto: RiepilogoMorositaSoggetto[];
  perUnita: RiepilogoMorositaUnita[];
  perAnnoEsercizio: RiepilogoMorositaEsercizio[];
  totaleResiduoComplessivoCent: Centesimi;
  totaleMorositaEsigibileCent: Centesimi;
  totaleMorositaEsigibileEuro: number;
  totaleNonAncoraEsigibileCent: Centesimi;
  anzianitaMassimaCondominioGiorni: number;
  versioneMotore: string;
}

export function determinaFasciaAnzianita(
  isEsigibile: boolean,
  giorniAnzianita: number,
): FasciaAnzianitaDebito {
  if (!isEsigibile) return 'NON_SCADUTO';
  if (giorniAnzianita <= 0) return 'SCADUTO_OGGI';
  if (giorniAnzianita <= 30) return '1_30_GG';
  if (giorniAnzianita <= 90) return '31_90_GG';
  if (giorniAnzianita <= 180) return '91_180_GG';
  return 'OLTRE_180_GG';
}

/**
 * Calcola l'esigibilità e l'anzianità in giorni di un singolo credito alla `dataRiferimento` (RC-G1, RC-G2).
 */
export function calcolaAnzianitaDebito(
  credito: CreditoMorositaInput,
  dataRiferimento: string,
  criterioEsigibilitaRatePreventivo: CriterioEsigibilitaRatePreventivo = 'SCADENZA_RATA',
): PosizioneCreditoAnalizzata {
  const dataRif = validaDataIso(dataRiferimento, 'dataRiferimento');
  const tipoCredito = credito.tipoCredito ?? 'RATA';
  const importoDovutoCent = normalizzaCentesimi(credito.importoDovutoCent);
  const importoPagatoCent = normalizzaCentesimi(credito.importoPagatoCent ?? 0);
  const residuoCent = Math.max(0, normalizzaCentesimi(importoDovutoCent - importoPagatoCent));

  const dataEsigibilita = calcolaDataEsigibilitaCredito({
    tipoCredito,
    dataScadenza: credito.dataScadenza,
    dataEsigibilitaEsplicita: credito.dataEsigibilita,
    dataApprovazioneConsuntivo: credito.dataApprovazioneConsuntivo,
    criterioEsigibilitaRatePreventivo,
  });

  const isEsigibile =
    residuoCent > 0 && dataEsigibilita !== null && dataRif >= dataEsigibilita;
  const giorniAnzianita =
    isEsigibile && dataEsigibilita !== null
      ? Math.max(0, differenzaGiorniIso(dataEsigibilita, dataRif))
      : 0;
  const fasciaAnzianita = determinaFasciaAnzianita(isEsigibile, giorniAnzianita);

  return {
    id: credito.id,
    tipoCredito,
    unitaId: credito.unitaId,
    unitaInterno: credito.unitaInterno ?? null,
    esercizioId: credito.esercizioId,
    annoCompetenza: credito.annoCompetenza,
    gestioneId: credito.gestioneId ?? null,
    utenteId: credito.utenteId ?? null,
    soggettoId: credito.soggettoId ?? null,
    nomeSoggetto: credito.nomeSoggetto ?? null,
    obbligatoInSolidoUtenteId: credito.obbligatoInSolidoUtenteId ?? null,
    obbligatoInSolidoSoggettoId: credito.obbligatoInSolidoSoggettoId ?? null,
    nomeObbligatoInSolido: credito.nomeObbligatoInSolido ?? null,
    importoDovutoCent,
    importoPagatoCent,
    residuoCent,
    residuoEuro: centsToEuro(residuoCent),
    dataEsigibilita,
    isEsigibile,
    giorniAnzianita,
    fasciaAnzianita,
  };
}

/**
 * Calcola lo stato complessivo del debito per soggetto, unità immobiliare e anno/esercizio,
 * con anzianità e importi esigibili separati da quelli non ancora esigibili (RC-G1, RC-G2).
 */
export function analizzaMorositaCondominio(input: {
  crediti: readonly CreditoMorositaInput[];
  dataRiferimento: string;
  criterioEsigibilitaRatePreventivo?: CriterioEsigibilitaRatePreventivo;
}): AnalisiMorositaCondominioOutput {
  const dataRiferimento = validaDataIso(input.dataRiferimento, 'dataRiferimento');
  const criterio = input.criterioEsigibilitaRatePreventivo ?? 'SCADENZA_RATA';

  const posizioniDettaglio: PosizioneCreditoAnalizzata[] = input.crediti.map((c) =>
    calcolaAnzianitaDebito(c, dataRiferimento, criterio),
  );

  const mappaSoggetti = new Map<
    string,
    {
      utenteId: string | null;
      soggettoId: string | null;
      nomeSoggetto: string;
      unitaSet: Set<string>;
      anniSet: Set<number>;
      totaleDovutoCent: Centesimi;
      totalePagatoCent: Centesimi;
      totaleResiduoCent: Centesimi;
      totaleEsigibileCent: Centesimi;
      totaleNonEsigibileCent: Centesimi;
      anzianitaMassimaGiorni: number;
      dataEsigibilitaPiuVecchia: string | null;
      numeroCreditiAperti: number;
    }
  >();

  const mappaUnita = new Map<
    string,
    {
      unitaId: string;
      unitaInterno: string | null;
      anniSet: Set<number>;
      totaleDovutoCent: Centesimi;
      totalePagatoCent: Centesimi;
      totaleResiduoCent: Centesimi;
      totaleEsigibileCent: Centesimi;
      totaleNonEsigibileCent: Centesimi;
      anzianitaMassimaGiorni: number;
      dataEsigibilitaPiuVecchia: string | null;
      creditiIds: string[];
    }
  >();

  const mappaEsercizi = new Map<
    string,
    {
      esercizioId: string;
      annoCompetenza: number;
      totaleDovutoCent: Centesimi;
      totalePagatoCent: Centesimi;
      totaleResiduoCent: Centesimi;
      totaleEsigibileCent: Centesimi;
      totaleNonEsigibileCent: Centesimi;
      anzianitaMassimaGiorni: number;
      unitaMorose: Set<string>;
      soggettiMorosi: Set<string>;
    }
  >();

  let totaleResiduoComplessivoCent = 0;
  let totaleMorositaEsigibileCent = 0;
  let totaleNonAncoraEsigibileCent = 0;
  let anzianitaMassimaCondominioGiorni = 0;

  for (const pos of posizioniDettaglio) {
    totaleResiduoComplessivoCent = normalizzaCentesimi(
      totaleResiduoComplessivoCent + pos.residuoCent,
    );
    if (pos.isEsigibile) {
      totaleMorositaEsigibileCent = normalizzaCentesimi(
        totaleMorositaEsigibileCent + pos.residuoCent,
      );
      if (pos.giorniAnzianita > anzianitaMassimaCondominioGiorni) {
        anzianitaMassimaCondominioGiorni = pos.giorniAnzianita;
      }
    } else if (pos.residuoCent > 0) {
      totaleNonAncoraEsigibileCent = normalizzaCentesimi(
        totaleNonAncoraEsigibileCent + pos.residuoCent,
      );
    }

    const soggettoKey = pos.soggettoId
      ? `SOGG:${pos.soggettoId}`
      : pos.utenteId
        ? `UTENTE:${pos.utenteId}`
        : `UNITA:${pos.unitaId}`;

    // 1. Aggregazione per Soggetto
    let soggAgg = mappaSoggetti.get(soggettoKey);
    if (!soggAgg) {
      soggAgg = {
        utenteId: pos.utenteId,
        soggettoId: pos.soggettoId,
        nomeSoggetto: pos.nomeSoggetto ?? `Soggetto (${soggettoKey})`,
        unitaSet: new Set(),
        anniSet: new Set(),
        totaleDovutoCent: 0,
        totalePagatoCent: 0,
        totaleResiduoCent: 0,
        totaleEsigibileCent: 0,
        totaleNonEsigibileCent: 0,
        anzianitaMassimaGiorni: 0,
        dataEsigibilitaPiuVecchia: null,
        numeroCreditiAperti: 0,
      };
      mappaSoggetti.set(soggettoKey, soggAgg);
    }
    soggAgg.unitaSet.add(pos.unitaId);
    soggAgg.anniSet.add(pos.annoCompetenza);
    soggAgg.totaleDovutoCent = normalizzaCentesimi(soggAgg.totaleDovutoCent + pos.importoDovutoCent);
    soggAgg.totalePagatoCent = normalizzaCentesimi(soggAgg.totalePagatoCent + pos.importoPagatoCent);
    soggAgg.totaleResiduoCent = normalizzaCentesimi(soggAgg.totaleResiduoCent + pos.residuoCent);
    if (pos.residuoCent > 0) {
      soggAgg.numeroCreditiAperti += 1;
    }
    if (pos.isEsigibile) {
      soggAgg.totaleEsigibileCent = normalizzaCentesimi(
        soggAgg.totaleEsigibileCent + pos.residuoCent,
      );
      if (pos.giorniAnzianita > soggAgg.anzianitaMassimaGiorni) {
        soggAgg.anzianitaMassimaGiorni = pos.giorniAnzianita;
      }
      if (
        pos.dataEsigibilita &&
        (!soggAgg.dataEsigibilitaPiuVecchia || pos.dataEsigibilita < soggAgg.dataEsigibilitaPiuVecchia)
      ) {
        soggAgg.dataEsigibilitaPiuVecchia = pos.dataEsigibilita;
      }
    } else if (pos.residuoCent > 0) {
      soggAgg.totaleNonEsigibileCent = normalizzaCentesimi(
        soggAgg.totaleNonEsigibileCent + pos.residuoCent,
      );
    }

    // 2. Aggregazione per Unità
    let unitaAgg = mappaUnita.get(pos.unitaId);
    if (!unitaAgg) {
      unitaAgg = {
        unitaId: pos.unitaId,
        unitaInterno: pos.unitaInterno,
        anniSet: new Set(),
        totaleDovutoCent: 0,
        totalePagatoCent: 0,
        totaleResiduoCent: 0,
        totaleEsigibileCent: 0,
        totaleNonEsigibileCent: 0,
        anzianitaMassimaGiorni: 0,
        dataEsigibilitaPiuVecchia: null,
        creditiIds: [],
      };
      mappaUnita.set(pos.unitaId, unitaAgg);
    }
    unitaAgg.anniSet.add(pos.annoCompetenza);
    unitaAgg.totaleDovutoCent = normalizzaCentesimi(
      unitaAgg.totaleDovutoCent + pos.importoDovutoCent,
    );
    unitaAgg.totalePagatoCent = normalizzaCentesimi(
      unitaAgg.totalePagatoCent + pos.importoPagatoCent,
    );
    unitaAgg.totaleResiduoCent = normalizzaCentesimi(unitaAgg.totaleResiduoCent + pos.residuoCent);
    if (pos.residuoCent > 0) {
      unitaAgg.creditiIds.push(pos.id);
    }
    if (pos.isEsigibile) {
      unitaAgg.totaleEsigibileCent = normalizzaCentesimi(
        unitaAgg.totaleEsigibileCent + pos.residuoCent,
      );
      if (pos.giorniAnzianita > unitaAgg.anzianitaMassimaGiorni) {
        unitaAgg.anzianitaMassimaGiorni = pos.giorniAnzianita;
      }
      if (
        pos.dataEsigibilita &&
        (!unitaAgg.dataEsigibilitaPiuVecchia ||
          pos.dataEsigibilita < unitaAgg.dataEsigibilitaPiuVecchia)
      ) {
        unitaAgg.dataEsigibilitaPiuVecchia = pos.dataEsigibilita;
      }
    } else if (pos.residuoCent > 0) {
      unitaAgg.totaleNonEsigibileCent = normalizzaCentesimi(
        unitaAgg.totaleNonEsigibileCent + pos.residuoCent,
      );
    }

    // 3. Aggregazione per Esercizio / Anno
    const esKey = `${pos.esercizioId}::${pos.annoCompetenza}`;
    let esAgg = mappaEsercizi.get(esKey);
    if (!esAgg) {
      esAgg = {
        esercizioId: pos.esercizioId,
        annoCompetenza: pos.annoCompetenza,
        totaleDovutoCent: 0,
        totalePagatoCent: 0,
        totaleResiduoCent: 0,
        totaleEsigibileCent: 0,
        totaleNonEsigibileCent: 0,
        anzianitaMassimaGiorni: 0,
        unitaMorose: new Set(),
        soggettiMorosi: new Set(),
      };
      mappaEsercizi.set(esKey, esAgg);
    }
    esAgg.totaleDovutoCent = normalizzaCentesimi(esAgg.totaleDovutoCent + pos.importoDovutoCent);
    esAgg.totalePagatoCent = normalizzaCentesimi(esAgg.totalePagatoCent + pos.importoPagatoCent);
    esAgg.totaleResiduoCent = normalizzaCentesimi(esAgg.totaleResiduoCent + pos.residuoCent);
    if (pos.isEsigibile) {
      esAgg.totaleEsigibileCent = normalizzaCentesimi(esAgg.totaleEsigibileCent + pos.residuoCent);
      esAgg.unitaMorose.add(pos.unitaId);
      esAgg.soggettiMorosi.add(soggettoKey);
      if (pos.giorniAnzianita > esAgg.anzianitaMassimaGiorni) {
        esAgg.anzianitaMassimaGiorni = pos.giorniAnzianita;
      }
    } else if (pos.residuoCent > 0) {
      esAgg.totaleNonEsigibileCent = normalizzaCentesimi(
        esAgg.totaleNonEsigibileCent + pos.residuoCent,
      );
    }
  }

  const perSoggetto: RiepilogoMorositaSoggetto[] = Array.from(mappaSoggetti.entries()).map(
    ([soggettoKey, s]) => ({
      soggettoKey,
      utenteId: s.utenteId,
      soggettoId: s.soggettoId,
      nomeSoggetto: s.nomeSoggetto,
      unitaIds: Array.from(s.unitaSet),
      anniCompetenza: Array.from(s.anniSet).sort((a, b) => a - b),
      totaleDovutoCent: s.totaleDovutoCent,
      totalePagatoCent: s.totalePagatoCent,
      totaleResiduoCent: s.totaleResiduoCent,
      totaleEsigibileCent: s.totaleEsigibileCent,
      totaleEsigibileEuro: centsToEuro(s.totaleEsigibileCent),
      totaleNonEsigibileCent: s.totaleNonEsigibileCent,
      anzianitaMassimaGiorni: s.anzianitaMassimaGiorni,
      dataEsigibilitaPiuVecchia: s.dataEsigibilitaPiuVecchia,
      fasciaMassima: determinaFasciaAnzianita(
        s.totaleEsigibileCent > 0,
        s.anzianitaMassimaGiorni,
      ),
      numeroCreditiAperti: s.numeroCreditiAperti,
    }),
  );

  const perUnita: RiepilogoMorositaUnita[] = Array.from(mappaUnita.values()).map((u) => ({
    unitaId: u.unitaId,
    unitaInterno: u.unitaInterno,
    anniCompetenza: Array.from(u.anniSet).sort((a, b) => a - b),
    totaleDovutoCent: u.totaleDovutoCent,
    totalePagatoCent: u.totalePagatoCent,
    totaleResiduoCent: u.totaleResiduoCent,
    totaleEsigibileCent: u.totaleEsigibileCent,
    totaleEsigibileEuro: centsToEuro(u.totaleEsigibileCent),
    totaleNonEsigibileCent: u.totaleNonEsigibileCent,
    anzianitaMassimaGiorni: u.anzianitaMassimaGiorni,
    dataEsigibilitaPiuVecchia: u.dataEsigibilitaPiuVecchia,
    creditiIds: u.creditiIds,
  }));

  const perAnnoEsercizio: RiepilogoMorositaEsercizio[] = Array.from(mappaEsercizi.values())
    .sort((a, b) => a.annoCompetenza - b.annoCompetenza)
    .map((e) => ({
      esercizioId: e.esercizioId,
      annoCompetenza: e.annoCompetenza,
      totaleDovutoCent: e.totaleDovutoCent,
      totalePagatoCent: e.totalePagatoCent,
      totaleResiduoCent: e.totaleResiduoCent,
      totaleEsigibileCent: e.totaleEsigibileCent,
      totaleEsigibileEuro: centsToEuro(e.totaleEsigibileCent),
      totaleNonEsigibileCent: e.totaleNonEsigibileCent,
      anzianitaMassimaGiorni: e.anzianitaMassimaGiorni,
      numeroUnitaMorose: e.unitaMorose.size,
      numeroSoggettiMorosi: e.soggettiMorosi.size,
    }));

  return {
    dataRiferimento,
    criterioEsigibilitaRatePreventivo: criterio,
    posizioniDettaglio,
    perSoggetto,
    perUnita,
    perAnnoEsercizio,
    totaleResiduoComplessivoCent,
    totaleMorositaEsigibileCent,
    totaleMorositaEsigibileEuro: centsToEuro(totaleMorositaEsigibileCent),
    totaleNonAncoraEsigibileCent,
    anzianitaMassimaCondominioGiorni,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 3. SCADENZIARIO RECUPERO CREDITI ART. 1129 C. 9 C.C. (RC-G3, T12)
// ============================================================================

export interface CalcolaScadenzeRecuperoInput {
  /** Data di chiusura dell'esercizio in cui il credito è esigibile (`YYYY-MM-DD`, es. `'2026-12-31'` in T12). */
  dataChiusuraEsercizio: string;
  /** Data di approvazione del rendiconto (usata se `decorrenza = 'APPROVAZIONE_RENDICONTO'`). */
  dataApprovazioneRendiconto?: string | null;
  /** Default: `'CHIUSURA_ESERCIZIO'` (RC-G3, T12). */
  decorrenza?: CriterioDecorrenzaRecuperoMesi;
}

export interface ScadenzeRecuperoCreditoCalcolate {
  decorrenzaApplicata: CriterioDecorrenzaRecuperoMesi;
  dataDecorrenzaSemestre: string;
  /** Termine perentorio di 6 mesi per l'azione di riscossione forzosa (es. `'2027-06-30'` in T12). */
  dataLimiteAzione: string;
  /** Alert a 90 giorni dalla data limite (es. `'2027-04-01'` in T12). */
  alert90ggAt: string;
  /** Alert a 30 giorni dalla data limite (es. `'2027-05-31'` in T12). */
  alert30ggAt: string;
  /** Alert a 7 giorni dalla data limite (es. `'2027-06-23'` in T12). */
  alert7ggAt: string;
}

/**
 * Calcola la data limite perentoria di 6 mesi ex art. 1129 c. 9 c.c. e le tre date di alert
 * a 90, 30 e 7 giorni prima della scadenza (RC-G3, T12).
 *
 * Caso T12:
 * - Chiusura esercizio `2026-12-31` -> Limite `2027-06-30`;
 * - Alert 90 gg -> `2027-04-01` (1/4/2027);
 * - Alert 30 gg -> `2027-05-31` (31/5/2027);
 * - Alert 7 gg  -> `2027-06-23` (23/6/2027).
 */
export function calcolaScadenzeRecuperoCredito(
  input: CalcolaScadenzeRecuperoInput,
): ScadenzeRecuperoCreditoCalcolate {
  const decorrenza = input.decorrenza ?? 'CHIUSURA_ESERCIZIO';
  const dataChiusura = validaDataIso(input.dataChiusuraEsercizio, 'dataChiusuraEsercizio');

  let dataDecorrenzaSemestre = dataChiusura;
  if (decorrenza === 'APPROVAZIONE_RENDICONTO') {
    if (!input.dataApprovazioneRendiconto) {
      throw new ErroreIncassoNonValido(
        'Con decorrenza APPROVAZIONE_RENDICONTO è obbligatoria la dataApprovazioneRendiconto.',
      );
    }
    dataDecorrenzaSemestre = validaDataIso(
      input.dataApprovazioneRendiconto,
      'dataApprovazioneRendiconto',
    );
  }

  const dataLimiteAzione = aggiungiMesiCalendarioIso(dataDecorrenzaSemestre, 6);
  const alert90ggAt = aggiungiGiorniIso(dataLimiteAzione, -90);
  const alert30ggAt = aggiungiGiorniIso(dataLimiteAzione, -30);
  const alert7ggAt = aggiungiGiorniIso(dataLimiteAzione, -7);

  return {
    decorrenzaApplicata: decorrenza,
    dataDecorrenzaSemestre,
    dataLimiteAzione,
    alert90ggAt,
    alert30ggAt,
    alert7ggAt,
  };
}

export interface CreaVoceScadenziarioRecuperoInput {
  id?: string;
  condominioId: string;
  esercizioId: string;
  unitaId: string;
  utenteId?: string | null;
  soggettoId?: string | null;
  rataDettaglioId?: string | null;
  saldoPregressoId?: string | null;
  importoEsigibileCent: CentesimiInput;
  dataEsigibilita: string;
  dataChiusuraEsercizio: string;
  dataApprovazioneRendiconto?: string | null;
  decorrenza?: CriterioDecorrenzaRecuperoMesi;
  statoIniziale?: StatoRecuperoCreditoInput;
  dataAvvioAzione?: string | null;
  dataDispensa?: string | null;
  deliberaDispensa?: string | null;
  dataChiusura?: string | null;
  note?: string | null;
  autoreId?: string | null;
}

export interface AlertRecuperoCreditoAttivo {
  codice: CodiceAlertRecuperoCrediti;
  giorniSoglia: 90 | 30 | 7 | 0;
  dataAlert: string;
  messaggio: string;
}

export interface VoceScadenziarioRecuperoValutata {
  id: string | null;
  condominio_id: string;
  esercizio_id: string;
  unita_id: string;
  utente_id: string | null;
  soggetto_id: string | null;
  rata_dettaglio_id: string | null;
  saldo_pregresso_id: string | null;
  importo_esigibile_centesimi: Centesimi;
  importoEsigibileEuro: number;
  data_esigibilita: string;
  data_decorrenza_semestre: string;
  data_limite_azione: string;
  alert_90gg_at: string;
  alert_30gg_at: string;
  alert_7gg_at: string;
  /** Stato in formato DB (`DA_AVVIARE`, `AVVIATO`, `DISPENSATO`, `CHIUSO`). */
  stato: StatoRecuperoCreditoDb;
  /** Stato in formato testuale RC-G3 / T12 (`da avviare`, `avviata`, `dispensata`, `chiusa`). */
  statoTesto: StatoRecuperoCreditoTesto;
  data_avvio_azione: string | null;
  data_dispensa: string | null;
  delibera_dispensa: string | null;
  data_chiusura: string | null;
  note: string | null;
  autore_id: string | null;
  /** `true` se gli alert automatici sono attivi (solo nello stato `da avviare`). Con dispensa: `false` (T12). */
  alertAbilitati: boolean;
  /** Elenco dei 3 alert programmati (`[]` se `dispensata` o `chiusa`, T12). */
  alertProgrammati: AlertRecuperoCreditoAttivo[];
  /** Alert già maturati alla data di valutazione (`[]` se `dispensata`, T12). */
  alertScattati: AlertRecuperoCreditoAttivo[];
  giorniMancantiAlLimite: number | null;
  isTermineScaduto: boolean;
}

/**
 * Crea e valuta una voce dello scadenziario di recupero crediti ex art. 1129 c. 9 c.c. (RC-G3, T12).
 * Se lo stato è `dispensata` (`DISPENSATO`), richiede obbligatoriamente data e delibera assembleare
 * e disattiva tutti gli alert (`alertProgrammati = []`, `alertScattati = []`, T12).
 */
export function creaVoceScadenziarioRecupero(
  input: CreaVoceScadenziarioRecuperoInput,
  dataValutazione?: string,
): VoceScadenziarioRecuperoValutata {
  const importoEsigibileCent = normalizzaCentesimi(input.importoEsigibileCent);
  if (importoEsigibileCent <= 0) {
    throw new RangeError(
      `L'importo esigibile per lo scadenziario recupero crediti deve essere strettamente positivo (ricevuto: ${importoEsigibileCent}).`,
    );
  }

  const dataEsigibilita = validaDataIso(input.dataEsigibilita, 'dataEsigibilita');
  const scadenze = calcolaScadenzeRecuperoCredito({
    dataChiusuraEsercizio: input.dataChiusuraEsercizio,
    dataApprovazioneRendiconto: input.dataApprovazioneRendiconto,
    decorrenza: input.decorrenza,
  });

  const { statoDb, statoTesto } = normalizzaStatoRecuperoCredito(
    input.statoIniziale ?? 'DA_AVVIARE',
  );

  let dataAvvio: string | null = null;
  let dataDispensa: string | null = null;
  let deliberaDispensa: string | null = null;
  let dataChiusura: string | null = null;

  if (statoDb === 'DISPENSATO') {
    const delib = (input.deliberaDispensa ?? '').trim();
    if (!delib || !input.dataDispensa) {
      throw new ErroreDispensaRecuperoSenzaDelibera(
        'La dispensa dall\'azione di recupero forzoso ex art. 1129 c. 9 c.c. richiede obbligatoriamente la data e il riferimento della delibera assembleare (RC-G3, T12).',
      );
    }
    dataDispensa = validaDataIso(input.dataDispensa, 'dataDispensa');
    deliberaDispensa = delib;
  } else if (statoDb === 'AVVIATO') {
    dataAvvio = input.dataAvvioAzione
      ? validaDataIso(input.dataAvvioAzione, 'dataAvvioAzione')
      : scadenze.dataDecorrenzaSemestre;
  } else if (statoDb === 'CHIUSO') {
    dataChiusura = input.dataChiusura
      ? validaDataIso(input.dataChiusura, 'dataChiusura')
      : scadenze.dataDecorrenzaSemestre;
    dataAvvio = input.dataAvvioAzione
      ? validaDataIso(input.dataAvvioAzione, 'dataAvvioAzione')
      : null;
  }

  const alertAbilitati = statoDb === 'DA_AVVIARE';

  const tuttiAlert: AlertRecuperoCreditoAttivo[] = alertAbilitati
    ? [
        {
          codice: 'ALERT_90_GG',
          giorniSoglia: 90,
          dataAlert: scadenze.alert90ggAt,
          messaggio: `Preavviso 90 giorni: il termine semestrale ex art. 1129 c. 9 c.c. scade il ${scadenze.dataLimiteAzione}.`,
        },
        {
          codice: 'ALERT_30_GG',
          giorniSoglia: 30,
          dataAlert: scadenze.alert30ggAt,
          messaggio: `Attenzione 30 giorni: il termine semestrale ex art. 1129 c. 9 c.c. scade il ${scadenze.dataLimiteAzione}.`,
        },
        {
          codice: 'ALERT_7_GG',
          giorniSoglia: 7,
          dataAlert: scadenze.alert7ggAt,
          messaggio: `Urgente 7 giorni: il termine perentorio ex art. 1129 c. 9 c.c. scade il ${scadenze.dataLimiteAzione}.`,
        },
      ]
    : [];

  let giorniMancantiAlLimite: number | null = null;
  let isTermineScaduto = false;
  const alertScattati: AlertRecuperoCreditoAttivo[] = [];

  if (dataValutazione) {
    const dataOggi = validaDataIso(dataValutazione, 'dataValutazione');
    giorniMancantiAlLimite = differenzaGiorniIso(dataOggi, scadenze.dataLimiteAzione);
    isTermineScaduto = alertAbilitati && dataOggi > scadenze.dataLimiteAzione;

    if (alertAbilitati) {
      for (const a of tuttiAlert) {
        if (dataOggi >= a.dataAlert) {
          alertScattati.push(a);
        }
      }
      if (isTermineScaduto) {
        alertScattati.push({
          codice: 'TERMINE_PERENTORIO_SCADUTO',
          giorniSoglia: 0,
          dataAlert: scadenze.dataLimiteAzione,
          messaggio: `VIOLAZIONE ART. 1129 C. 9 C.C.: decorso il termine di 6 mesi (${scadenze.dataLimiteAzione}) senza avvio riscossione forzosa né dispensa assembleare.`,
        });
      }
    }
  }

  return {
    id: input.id ?? null,
    condominio_id: input.condominioId,
    esercizio_id: input.esercizioId,
    unita_id: input.unitaId,
    utente_id: input.utenteId ?? null,
    soggetto_id: input.soggettoId ?? null,
    rata_dettaglio_id: input.rataDettaglioId ?? null,
    saldo_pregresso_id: input.saldoPregressoId ?? null,
    importo_esigibile_centesimi: importoEsigibileCent,
    importoEsigibileEuro: centsToEuro(importoEsigibileCent),
    data_esigibilita: dataEsigibilita,
    data_decorrenza_semestre: scadenze.dataDecorrenzaSemestre,
    data_limite_azione: scadenze.dataLimiteAzione,
    alert_90gg_at: scadenze.alert90ggAt,
    alert_30gg_at: scadenze.alert30ggAt,
    alert_7gg_at: scadenze.alert7ggAt,
    stato: statoDb,
    statoTesto,
    data_avvio_azione: dataAvvio,
    data_dispensa: dataDispensa,
    delibera_dispensa: deliberaDispensa,
    data_chiusura: dataChiusura,
    note: input.note ?? null,
    autore_id: input.autoreId ?? null,
    alertAbilitati,
    alertProgrammati: tuttiAlert,
    alertScattati,
    giorniMancantiAlLimite,
    isTermineScaduto,
  };
}

export interface TransitaStatoRecuperoCreditoInput {
  voceCorrente: VoceScadenziarioRecuperoValutata;
  nuovoStato: StatoRecuperoCreditoInput;
  dataAvvioAzione?: string | null;
  dataDispensa?: string | null;
  deliberaDispensa?: string | null;
  dataChiusura?: string | null;
  note?: string | null;
  dataValutazione?: string;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface RisultatoTransizioneRecuperoCredito {
  voceAggiornata: VoceScadenziarioRecuperoValutata;
  eventoAudit: EventoAuditContabile;
}

/**
 * Esegue e valida il cambio di stato di una pratica nello scadenziario di recupero crediti (RC-G3, T12):
 * - `da avviare -> avviata` (`DA_AVVIARE -> AVVIATO`);
 * - `da avviare -> dispensata` (`DA_AVVIARE -> DISPENSATO`, obbligatori `dataDispensa` e `deliberaDispensa`, disattiva ogni alert);
 * - `avviata -> chiusa` (`AVVIATO -> CHIUSO`) o `da avviare -> chiusa` (per saldo integrale).
 */
export function transitaStatoRecuperoCredito(
  input: TransitaStatoRecuperoCreditoInput,
): RisultatoTransizioneRecuperoCredito {
  const corrente = input.voceCorrente;
  const { statoDb: targetDb, statoTesto: targetTesto } = normalizzaStatoRecuperoCredito(
    input.nuovoStato,
  );

  const transizioniAmmesse: Record<StatoRecuperoCreditoDb, readonly StatoRecuperoCreditoDb[]> = {
    DA_AVVIARE: ['AVVIATO', 'DISPENSATO', 'CHIUSO'],
    AVVIATO: ['CHIUSO'],
    DISPENSATO: ['AVVIATO', 'CHIUSO'],
    CHIUSO: [],
  };

  if (!transizioniAmmesse[corrente.stato].includes(targetDb)) {
    throw new ErroreTransizioneRecuperoCreditiNonValida(
      `Transizione di stato recupero crediti non consentita da "${corrente.statoTesto}" a "${targetTesto}" (RC-G3).`,
      corrente.stato,
      targetDb,
    );
  }

  let dataAvvio = corrente.data_avvio_azione;
  let dataDispensa = corrente.data_dispensa;
  let deliberaDispensa = corrente.delibera_dispensa;
  let dataChiusura = corrente.data_chiusura;

  if (targetDb === 'AVVIATO') {
    if (!input.dataAvvioAzione) {
      throw new ErroreIncassoNonValido(
        'Per passare lo stato a "avviata" è obbligatorio specificare la dataAvvioAzione (RC-G3).',
      );
    }
    dataAvvio = validaDataIso(input.dataAvvioAzione, 'dataAvvioAzione');
  } else if (targetDb === 'DISPENSATO') {
    const delib = (input.deliberaDispensa ?? '').trim();
    if (!delib || !input.dataDispensa) {
      throw new ErroreDispensaRecuperoSenzaDelibera(
        'Per passare lo stato a "dispensata" sono obbligatori dataDispensa e deliberaDispensa (RC-G3, T12).',
      );
    }
    dataDispensa = validaDataIso(input.dataDispensa, 'dataDispensa');
    deliberaDispensa = delib;
  } else if (targetDb === 'CHIUSO') {
    if (!input.dataChiusura) {
      throw new ErroreIncassoNonValido(
        'Per passare lo stato a "chiusa" è obbligatorio specificare la dataChiusura (RC-G3).',
      );
    }
    dataChiusura = validaDataIso(input.dataChiusura, 'dataChiusura');
  }

  const voceAggiornata: VoceScadenziarioRecuperoValutata = {
    ...corrente,
    stato: targetDb,
    statoTesto: targetTesto,
    data_avvio_azione: dataAvvio,
    data_dispensa: dataDispensa,
    delibera_dispensa: deliberaDispensa,
    data_chiusura: dataChiusura,
    note: input.note !== undefined ? input.note : corrente.note,
    autore_id: input.autoreId ?? corrente.autore_id,
    alertAbilitati: false,
    alertProgrammati: [],
    alertScattati: [],
    isTermineScaduto: false,
  };

  const eventoAudit: EventoAuditContabile = {
    azione:
      targetDb === 'DISPENSATO'
        ? 'DISPENSA_ASSEMBLEARE_RECUPERO_CREDITI'
        : targetDb === 'AVVIATO'
          ? 'AVVIO_AZIONE_RECUPERO_CREDITI'
          : 'CHIUSURA_PRATICA_RECUPERO_CREDITI',
    tabella: 'scadenziario_recupero_crediti',
    recordId: corrente.id,
    condominioId: corrente.condominio_id,
    autoreId: input.autoreId ?? corrente.autore_id,
    timestampIso: input.timestampIso ?? new Date().toISOString(),
    motivo:
      targetDb === 'DISPENSATO'
        ? `Dispensa assembleare: ${deliberaDispensa} del ${dataDispensa}`
        : input.note ?? `Transizione stato recupero crediti a "${targetTesto}"`,
    valorePrima: {
      stato: corrente.stato,
      stato_testo: corrente.statoTesto,
    },
    valoreDopo: {
      stato: voceAggiornata.stato,
      stato_testo: voceAggiornata.statoTesto,
      data_avvio_azione: voceAggiornata.data_avvio_azione,
      data_dispensa: voceAggiornata.data_dispensa,
      delibera_dispensa: voceAggiornata.delibera_dispensa,
      data_chiusura: voceAggiornata.data_chiusura,
      alert_abilitati: voceAggiornata.alertAbilitati,
    },
  };

  return {
    voceAggiornata,
    eventoAudit,
  };
}

// ============================================================================
// 4. ELENCO MOROSI PER I CREDITORI NON SODDISFATTI EX ART. 63 C. 1 DISP. ATT. (RC-G4)
// ============================================================================

export interface AnagraficaMorosoArt63Input {
  soggettoId?: string | null;
  utenteId?: string | null;
  nome?: string | null;
  cognome?: string | null;
  nomeDenominazione: string;
  codiceFiscale: string | null;
  indirizzoAnagrafe: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  pec?: string | null;
  email?: string | null;
}

export interface RigaElencoMorosiArt63 {
  soggettoId: string | null;
  utenteId: string | null;
  nome: string | null;
  cognome: string | null;
  nomeCognomeDenominazione: string;
  codiceFiscale: string | null;
  indirizzoAnagrafeCompleto: string | null;
  unitaIds: string[];
  unitaInterni: string[];
  importoMorositaEsigibileCent: Centesimi;
  importoMorositaEsigibileEuro: number;
  dataEsigibilitaPiuVecchia: string;
  giorniAnzianitaMassima: number;
  obbligatiInSolidoUtenteIds: string[];
  datiAnagraficiCompletiArt63: boolean;
  campiMancanti: string[];
}

export interface GeneraElencoMorosiArt63Input {
  condominioId: string;
  dataRiferimento: string;
  crediti: readonly CreditoMorositaInput[];
  anagraficheSoggetti: readonly AnagraficaMorosoArt63Input[];
  creditoreRichiedente: {
    ragioneSociale: string;
    codiceFiscaleOPiva?: string | null;
    pecOEmail?: string | null;
    riferimentoFatturaOCredito: string;
    importoCreditoInsolutoCent?: CentesimiInput | null;
    dataRichiesta: string;
    dataRisposta?: string;
  };
  criterioEsigibilitaRatePreventivo?: CriterioEsigibilitaRatePreventivo;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface ElencoMorosiArt63Output {
  condominioId: string;
  dataRiferimento: string;
  richiestaCreditore: {
    ragioneSociale: string;
    codiceFiscaleOPiva: string | null;
    pecOEmail: string | null;
    riferimentoFatturaOCredito: string;
    importoCreditoInsolutoCent: Centesimi | null;
    dataRichiesta: string;
    dataRisposta: string;
  };
  morosi: RigaElencoMorosiArt63[];
  totaleMorositaEsigibileComunicataCent: Centesimi;
  totaleMorositaEsigibileComunicataEuro: number;
  numeroMorosi: number;
  tuttiDatiAnagraficiCompleti: boolean;
  eventoAudit: EventoAuditContabile;
}

/**
 * Produce l'elenco nominativo dei condòmini morosi per i creditori non soddisfatti che lo richiedano
 * ai sensi dell'art. 63, c. 1, disp. att. c.c. (RC-G4):
 * - Espone nome, cognome / denominazione, codice fiscale, indirizzo da anagrafe, unità e quota di morosità esigibile;
 * - Esclude rigorosamente i condòmini in regola e le quote non ancora esigibili;
 * - Registra la richiesta del creditore e la risposta prodotta in un evento di audit.
 */
export function generaElencoMorosiPerCreditori(
  input: GeneraElencoMorosiArt63Input,
): ElencoMorosiArt63Output {
  if (!input.creditoreRichiedente?.ragioneSociale?.trim()) {
    throw new ErroreIncassoNonValido(
      'La ragione sociale del creditore richiedente è obbligatoria per produrre l\'elenco ex art. 63 c. 1 disp. att. c.c. (RC-G4).',
    );
  }
  if (!input.creditoreRichiedente?.riferimentoFatturaOCredito?.trim()) {
    throw new ErroreIncassoNonValido(
      'Il riferimento alla fattura o al titolo di credito insoluto è obbligatorio (RC-G4).',
    );
  }

  const dataRiferimento = validaDataIso(input.dataRiferimento, 'dataRiferimento');
  const dataRichiesta = validaDataIso(
    input.creditoreRichiedente.dataRichiesta,
    'creditoreRichiedente.dataRichiesta',
  );
  const dataRisposta = input.creditoreRichiedente.dataRisposta
    ? validaDataIso(input.creditoreRichiedente.dataRisposta, 'creditoreRichiedente.dataRisposta')
    : dataRiferimento;

  const analisi = analizzaMorositaCondominio({
    crediti: input.crediti,
    dataRiferimento,
    criterioEsigibilitaRatePreventivo: input.criterioEsigibilitaRatePreventivo,
  });

  const mappaAnagPerSoggetto = new Map<string, AnagraficaMorosoArt63Input>();
  const mappaAnagPerUtente = new Map<string, AnagraficaMorosoArt63Input>();
  for (const a of input.anagraficheSoggetti) {
    if (a.soggettoId) mappaAnagPerSoggetto.set(a.soggettoId, a);
    if (a.utenteId) mappaAnagPerUtente.set(a.utenteId, a);
  }

  const morosi: RigaElencoMorosiArt63[] = [];
  let totaleMorositaEsigibileComunicataCent = 0;
  let tuttiDatiAnagraficiCompleti = true;

  for (const riepilogoSogg of analisi.perSoggetto) {
    if (riepilogoSogg.totaleEsigibileCent <= 0) {
      continue; // I condòmini in regola o con soli debiti non ancora scaduti non compaiono nell'elenco morosi
    }

    const anag =
      (riepilogoSogg.soggettoId ? mappaAnagPerSoggetto.get(riepilogoSogg.soggettoId) : undefined) ??
      (riepilogoSogg.utenteId ? mappaAnagPerUtente.get(riepilogoSogg.utenteId) : undefined);

    const nomeCognomeDenominazione = (
      anag?.nomeDenominazione ?? riepilogoSogg.nomeSoggetto
    ).trim();
    const partiNome = nomeCognomeDenominazione.split(/\s+/);
    const nome = anag?.nome ?? (partiNome.length > 1 ? partiNome[0]! : nomeCognomeDenominazione);
    const cognome =
      anag?.cognome ?? (partiNome.length > 1 ? partiNome.slice(1).join(' ') : null);
    const codiceFiscale = anag?.codiceFiscale?.trim() || null;

    const partiIndirizzo = [
      anag?.indirizzoAnagrafe?.trim(),
      [anag?.cap?.trim(), anag?.citta?.trim(), anag?.provincia?.trim()]
        .filter(Boolean)
        .join(' '),
    ].filter(Boolean);
    const indirizzoAnagrafeCompleto =
      partiIndirizzo.length > 0 ? partiIndirizzo.join(' — ') : null;

    const campiMancanti: string[] = [];
    if (!nomeCognomeDenominazione) campiMancanti.push('nome_cognome');
    if (!codiceFiscale) campiMancanti.push('codice_fiscale');
    if (!indirizzoAnagrafeCompleto) campiMancanti.push('indirizzo_anagrafe');

    const datiAnagraficiCompletiArt63 = campiMancanti.length === 0;
    if (!datiAnagraficiCompletiArt63) {
      tuttiDatiAnagraficiCompleti = false;
    }

    const posizioniEsigibiliSoggetto = analisi.posizioniDettaglio.filter(
      (p) =>
        p.isEsigibile &&
        ((riepilogoSogg.soggettoId && p.soggettoId === riepilogoSogg.soggettoId) ||
          (!riepilogoSogg.soggettoId &&
            riepilogoSogg.utenteId &&
            p.utenteId === riepilogoSogg.utenteId)),
    );

    const unitaInterni = Array.from(
      new Set(
        posizioniEsigibiliSoggetto
          .map((p) => p.unitaInterno)
          .filter((x): x is string => Boolean(x)),
      ),
    );
    const obbligatiInSolidoUtenteIds = Array.from(
      new Set(
        posizioniEsigibiliSoggetto
          .map((p) => p.obbligatoInSolidoUtenteId)
          .filter((x): x is string => Boolean(x)),
      ),
    );

    totaleMorositaEsigibileComunicataCent = normalizzaCentesimi(
      totaleMorositaEsigibileComunicataCent + riepilogoSogg.totaleEsigibileCent,
    );

    morosi.push({
      soggettoId: riepilogoSogg.soggettoId,
      utenteId: riepilogoSogg.utenteId,
      nome,
      cognome,
      nomeCognomeDenominazione,
      codiceFiscale,
      indirizzoAnagrafeCompleto,
      unitaIds: riepilogoSogg.unitaIds,
      unitaInterni,
      importoMorositaEsigibileCent: riepilogoSogg.totaleEsigibileCent,
      importoMorositaEsigibileEuro: centsToEuro(riepilogoSogg.totaleEsigibileCent),
      dataEsigibilitaPiuVecchia: riepilogoSogg.dataEsigibilitaPiuVecchia ?? dataRiferimento,
      giorniAnzianitaMassima: riepilogoSogg.anzianitaMassimaGiorni,
      obbligatiInSolidoUtenteIds,
      datiAnagraficiCompletiArt63,
      campiMancanti,
    });
  }

  const importoCreditoInsolutoCent =
    input.creditoreRichiedente.importoCreditoInsolutoCent !== undefined &&
    input.creditoreRichiedente.importoCreditoInsolutoCent !== null
      ? normalizzaCentesimi(input.creditoreRichiedente.importoCreditoInsolutoCent)
      : null;

  const eventoAudit: EventoAuditContabile = {
    azione: 'COMUNICAZIONE_ELENCO_MOROSI_ART_63',
    tabella: 'saldi_pregressi',
    recordId: null,
    condominioId: input.condominioId,
    autoreId: input.autoreId ?? null,
    timestampIso: input.timestampIso ?? new Date().toISOString(),
    motivo: `Comunicazione dati morosi ex art. 63 c. 1 disp. att. c.c. al creditore "${input.creditoreRichiedente.ragioneSociale.trim()}" (rif. ${input.creditoreRichiedente.riferimentoFatturaOCredito.trim()})`,
    valorePrima: {
      data_richiesta: dataRichiesta,
      creditore_ragione_sociale: input.creditoreRichiedente.ragioneSociale.trim(),
      riferimento_credito: input.creditoreRichiedente.riferimentoFatturaOCredito.trim(),
      importo_credito_fornitore_centesimi: importoCreditoInsolutoCent,
    },
    valoreDopo: {
      data_risposta: dataRisposta,
      numero_morosi_comunicati: morosi.length,
      totale_morosita_esigibile_centesimi: totaleMorositaEsigibileComunicataCent,
      soggetti_morosi_ids: morosi.map((m) => m.soggettoId ?? m.utenteId),
    },
  };

  return {
    condominioId: input.condominioId,
    dataRiferimento,
    richiestaCreditore: {
      ragioneSociale: input.creditoreRichiedente.ragioneSociale.trim(),
      codiceFiscaleOPiva: input.creditoreRichiedente.codiceFiscaleOPiva?.trim() ?? null,
      pecOEmail: input.creditoreRichiedente.pecOEmail?.trim() ?? null,
      riferimentoFatturaOCredito: input.creditoreRichiedente.riferimentoFatturaOCredito.trim(),
      importoCreditoInsolutoCent,
      dataRichiesta,
      dataRisposta,
    },
    morosi,
    totaleMorositaEsigibileComunicataCent,
    totaleMorositaEsigibileComunicataEuro: centsToEuro(totaleMorositaEsigibileComunicataCent),
    numeroMorosi: morosi.length,
    tuttiDatiAnagraficiCompleti,
    eventoAudit,
  };
}

// ============================================================================
// 5. PRINCIPIO DI NON REDISTRIBUZIONE DELLE QUOTE MOROSI SUI VIRTUOSI (RC-G5, RC-L4)
// ============================================================================

export interface PosizioneUnitaPerConguaglioNoMorositaInput {
  unitaId: string;
  utenteId?: string | null;
  soggettoId?: string | null;
  /** Quota di consuntivo effettivamente spettante all'unità per le spese dell'esercizio. */
  quotaConsuntivoPropriaCent: CentesimiInput;
  /** Rate di preventivo complessivamente richieste/dovute dall'unità nell'esercizio. */
  rateDovutePreventivoCent: CentesimiInput;
  /** Rate effettivamente versate dall'unità nell'esercizio. */
  rateVersateProprieCent: CentesimiInput;
  /**
   * Eventuale quota di spalmatura della morosità altrui che qualcuno tentasse di addebitare
   * all'unità nel conguaglio (VIETATO da RC-G5 e RC-L4: se `> 0` solleva `ErroreRedistribuzioneMorositaVietata`).
   */
  quotaMorositaAltruiAddebitataCent?: CentesimiInput;
}

export interface PosizioneConguaglioUnitaSenzaMorositaAltrui {
  unitaId: string;
  utenteId: string | null;
  soggettoId: string | null;
  quotaConsuntivoPropriaCent: Centesimi;
  rateDovutePreventivoCent: Centesimi;
  rateVersateProprieCent: Centesimi;
  /** Morosità sulle rate di preventivo propria di questa unità (`max(0, rateDovute - rateVersate)`). */
  morositaPropriaSuRateCent: Centesimi;
  isUnitaMorosa: boolean;
  /** Conguaglio complessivo dell'unità (`quotaConsuntivoPropriaCent - rateVersateProprieCent`), mai gravato da morosità altrui. */
  conguaglio: RisultatoConguaglio;
  quotaMorositaAltruiApplicataCent: 0;
}

export interface RisultatoConguaglioSenzaRedistribuzioneMorosi {
  posizioniUnita: PosizioneConguaglioUnitaSenzaMorositaAltrui[];
  totaleConsuntivoEsercizioCent: Centesimi;
  totaleRateVersateCent: Centesimi;
  /** Credito complessivo che il condominio vanta verso i condòmini morosi (RC-G5: resta credito e non si spalma). */
  totaleCreditiVersoMorosiCent: Centesimi;
  totaleCreditiVersoMorosiEuro: number;
  /** Eventuale fabbisogno di liquidità dovuto al mancato incasso delle quote dei morosi. */
  deficitLiquiditaDaMorositaCent: Centesimi;
  /** Copertura del deficit di liquidità attingendo al Fondo Cassa / Riserva senza toccare le quote dei virtuosi (RC-G5). */
  coperturaDaFondoCassaCent: Centesimi;
  saldoFondoCassaResiduoCent: Centesimi;
  fabbisognoCassaNonCopertoCent: Centesimi;
  nessunaRedistribuzioneSuVirtuosi: true;
  versioneMotore: string;
}

/**
 * Calcola i conguagli delle unità applicando il principio inderogabile di non redistribuzione
 * delle quote dei morosi sui condòmini in regola (RC-G5, RC-L4):
 * - Se viene rilevato un tentativo di addebitare quote di morosità altrui su condòmini virtuosi,
 *   solleva `ErroreRedistribuzioneMorositaVietata`;
 * - La quota del moroso resta credito esigibile verso il moroso stesso;
 * - Per l'eventuale fabbisogno di liquidità di cassa viene calcolato il prelievo dal Fondo Cassa disponibile.
 */
export function calcolaConguagliSenzaRedistribuzioneMorosi(input: {
  unita: readonly PosizioneUnitaPerConguaglioNoMorositaInput[];
  gestioneId?: string;
  saldoFondoCassaDisponibileCent?: CentesimiInput;
  tentativoSpalmaturaMorosiCent?: CentesimiInput;
}): RisultatoConguaglioSenzaRedistribuzioneMorosi {
  const tentativoGlobale = normalizzaCentesimi(input.tentativoSpalmaturaMorosiCent ?? 0);
  if (tentativoGlobale > 0) {
    throw new ErroreRedistribuzioneMorositaVietata(
      `Operazione bloccata (RC-G5, RC-L4): i condomini in regola non coprono i morosi nei conguagli. Tentativo di redistribuire ${centsToEuro(tentativoGlobale, true, true)} di morosità altrui.`,
      tentativoGlobale,
    );
  }

  const saldoFondoCassaInizialeCent = normalizzaCentesimi(
    input.saldoFondoCassaDisponibileCent ?? 0,
  );
  if (saldoFondoCassaInizialeCent < 0) {
    throw new RangeError('Il saldo disponibile del fondo cassa non può essere negativo.');
  }

  const posizioniUnita: PosizioneConguaglioUnitaSenzaMorositaAltrui[] = [];
  let totaleConsuntivoEsercizioCent = 0;
  let totaleRateVersateCent = 0;
  let totaleCreditiVersoMorosiCent = 0;

  for (const u of input.unita) {
    const addebitoMorositaAltrui = normalizzaCentesimi(u.quotaMorositaAltruiAddebitataCent ?? 0);
    if (addebitoMorositaAltrui > 0) {
      throw new ErroreRedistribuzioneMorositaVietata(
        `Operazione bloccata sull'unità "${u.unitaId}" (RC-G5, RC-L4): la quota del moroso resta credito e non può essere ridistribuita sugli altri condomini (${centsToEuro(addebitoMorositaAltrui, true, true)}).`,
        addebitoMorositaAltrui,
      );
    }

    const quotaConsuntivoPropriaCent = normalizzaCentesimi(u.quotaConsuntivoPropriaCent);
    const rateDovutePreventivoCent = normalizzaCentesimi(u.rateDovutePreventivoCent);
    const rateVersateProprieCent = normalizzaCentesimi(u.rateVersateProprieCent);

    const morositaPropriaSuRateCent = Math.max(
      0,
      normalizzaCentesimi(rateDovutePreventivoCent - rateVersateProprieCent),
    );
    const isUnitaMorosa = morositaPropriaSuRateCent > 0;

    const conguaglio = calcolaConguaglio({
      unitaId: u.unitaId,
      gestioneId: input.gestioneId,
      quotaConsuntivoCent: quotaConsuntivoPropriaCent,
      rateVersateCent: rateVersateProprieCent,
    });

    totaleConsuntivoEsercizioCent = normalizzaCentesimi(
      totaleConsuntivoEsercizioCent + quotaConsuntivoPropriaCent,
    );
    totaleRateVersateCent = normalizzaCentesimi(totaleRateVersateCent + rateVersateProprieCent);
    totaleCreditiVersoMorosiCent = normalizzaCentesimi(
      totaleCreditiVersoMorosiCent + morositaPropriaSuRateCent,
    );

    posizioniUnita.push({
      unitaId: u.unitaId,
      utenteId: u.utenteId ?? null,
      soggettoId: u.soggettoId ?? null,
      quotaConsuntivoPropriaCent,
      rateDovutePreventivoCent,
      rateVersateProprieCent,
      morositaPropriaSuRateCent,
      isUnitaMorosa,
      conguaglio,
      quotaMorositaAltruiApplicataCent: 0,
    });
  }

  const deficitLiquiditaDaMorositaCent = totaleCreditiVersoMorosiCent;
  const coperturaDaFondoCassaCent = Math.min(
    saldoFondoCassaInizialeCent,
    deficitLiquiditaDaMorositaCent,
  );
  const saldoFondoCassaResiduoCent = normalizzaCentesimi(
    saldoFondoCassaInizialeCent - coperturaDaFondoCassaCent,
  );
  const fabbisognoCassaNonCopertoCent = normalizzaCentesimi(
    deficitLiquiditaDaMorositaCent - coperturaDaFondoCassaCent,
  );

  return {
    posizioniUnita,
    totaleConsuntivoEsercizioCent,
    totaleRateVersateCent,
    totaleCreditiVersoMorosiCent,
    totaleCreditiVersoMorosiEuro: centsToEuro(totaleCreditiVersoMorosiCent),
    deficitLiquiditaDaMorositaCent,
    coperturaDaFondoCassaCent,
    saldoFondoCassaResiduoCent,
    fabbisognoCassaNonCopertoCent,
    nessunaRedistribuzioneSuVirtuosi: true,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}
