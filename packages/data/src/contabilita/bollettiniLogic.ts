/**
 * Logica pura per il Ciclo di Vita del Preventivo, la Generazione del Piano Rate
 * e il Ciclo di Vita Immutabile dei Bollettini (Sezione 6: RC-D1..D5, RC-E1..E6;
 * Sezione 8: RC-J2; Sezione 9: RC-M1, RC-N2..N5; Sezione 10: T7, T11, T13, T14, T16).
 *
 * Principi fondamentali:
 * - Nessun decimale in virgola mobile per gli importi: tutti i valori monetari sono in centesimi interi (`Centesimi`).
 * - Stati preventivo: `BOZZA -> APPROVATO (con data assemblea e delibera) -> SUPERATO` da una nuova versione approvata (RC-D2, RC-D5).
 * - Blocco emissione rate da preventivo non approvato salvo override esplicito con motivo e delibera tracciato in audit (RC-D4, T16).
 * - Blocco emissione rate straordinarie per lavori se manca il fondo speciale deliberato (RC-J2, T7).
 * - Raggruppamento delle rate di un proprietario con più unità in un unico bollettino multi-riga (RC-D3, RC-E1, T13).
 * - Ciclo di vita immutabile del bollettino: `BOZZA -> VERIFICATO -> EMESSO -> PARZIALMENTE_PAGATO / PAGATO` (RC-E2).
 * - Rettifica di un bollettino emesso: annullamento dell'originale, creazione del nuovo bollettino collegato (`sostituisce_id`),
 *   trascinamento degli incassi parziali già registrati e ricalcolo del saldo residuo (RC-E4, T11).
 * - Controlli pre-emissione bloccanti (RC-E3, RC-N2, T14) e warning non bloccanti (RC-N3).
 * - Nessuna dipendenza da React, Expo, `Intl` o Supabase.
 */

import {
  centsToEuro,
  dividiEArrotondaHalfUp,
  formattaCentsItaliano,
  normalizzaCentesimi,
  ripartisciSpesa,
  validaQuadraturaMillesimi,
  VERSIONE_MOTORE_CALCOLO,
  type Centesimi,
  type CentesimiInput,
  type QuotaMillesimiInput,
} from './contabilitaLogic.ts';
import {
  rilevaRitardoRegistrazione,
  validaGiustificativoAllegato,
  type CriterioChiPaga,
  type StatoApprovazioneTabella,
} from './registroContabileLogic.ts';

// ============================================================================
// COSTANTI E TIPI DI DOMINIO (SEZIONE 6: PREVENTIVO, RATE E BOLLETTINI)
// ============================================================================

export const STATI_PREVENTIVO = ['BOZZA', 'APPROVATO', 'SUPERATO'] as const;
export type StatoPreventivo = (typeof STATI_PREVENTIVO)[number];

export const TIPI_GESTIONE_ESERCIZIO = ['ORDINARIA', 'STRAORDINARIA', 'RISCALDAMENTO'] as const;
export type TipoGestioneEsercizio = (typeof TIPI_GESTIONE_ESERCIZIO)[number];

export const STATI_RATA_MODELLO = [
  'PIANIFICATA',
  'EMESSA',
  'PARZIALMENTE_PAGATA',
  'PAGATA',
] as const;
export type StatoRataModello = (typeof STATI_RATA_MODELLO)[number];

export const STATI_BOLLETTINO = [
  'BOZZA',
  'VERIFICATO',
  'EMESSO',
  'PARZIALMENTE_PAGATO',
  'PAGATO',
  'RETTIFICATO',
  'ANNULLATO',
] as const;
export type StatoBollettino = (typeof STATI_BOLLETTINO)[number];

export const RUOLI_TITOLARITA = [
  'PROPRIETARIO',
  'COMPROPRIETARIO',
  'USUFRUTTUARIO',
  'NUDO_PROPRIETARIO',
  'CONDUTTORE',
] as const;
export type RuoloTitolarita = (typeof RUOLI_TITOLARITA)[number];

export const CODICI_ANOMALIA_BLOCCANTE = [
  'SOMMA_QUOTE_DIVERSA_DA_SPESA',
  'SQUADRATURA_TOTALE_GESTIONE',
  'SQUADRATURA_TOTALE_BOLLETTINO',
  'TABELLA_MILLESIMALE_NON_QUADRA',
  'UNITA_SENZA_TITOLARE',
  'TITOLARITA_SOVRAPPOSIZIONE',
  'QUOTE_PROPRIETARI_NON_100',
  'UNITA_DUPLICATA_NEL_BOLLETTINO',
  'QUOTA_NEGATIVA',
  'BOLLETTINO_SENZA_RIGHE',
  'PREVENTIVO_NON_APPROVATO_SENZA_OVERRIDE',
  'FONDO_SPECIALE_MANCANTE',
] as const;
export type CodiceAnomaliaBloccante = (typeof CODICI_ANOMALIA_BLOCCANTE)[number];

export const CODICI_WARNING_NON_BLOCCANTE = [
  'TABELLA_NON_APPROVATA',
  'CRITERIO_PERSONALIZZATO_SENZA_ATTO',
  'SPESA_SENZA_GIUSTIFICATIVO',
  'REGISTRAZIONE_OLTRE_30_GIORNI',
  'RATE_EMESSE_CON_OVERRIDE_PREVENTIVO',
] as const;
export type CodiceWarningNonBloccante = (typeof CODICI_WARNING_NON_BLOCCANTE)[number];

export type CodiceAnomaliaPreEmissione = CodiceAnomaliaBloccante | CodiceWarningNonBloccante;

export interface EventoAuditContabile {
  azione: string;
  tabella: string;
  recordId: string | null;
  condominioId: string | null;
  autoreId: string | null;
  timestampIso: string;
  motivo: string | null;
  valorePrima: Record<string, unknown> | null;
  valoreDopo: Record<string, unknown> | null;
}

// ============================================================================
// ERRORI DI DOMINIO
// ============================================================================

export class ErroreTransizionePreventivoNonValida extends Error {
  readonly codice = 'TRANSIZIONE_PREVENTIVO_NON_VALIDA' as const;
  readonly statoCorrente: string;
  readonly statoRichiesto: string;

  constructor(messaggio: string, statoCorrente: string, statoRichiesto: string) {
    super(messaggio);
    this.name = 'ErroreTransizionePreventivoNonValida';
    this.statoCorrente = statoCorrente;
    this.statoRichiesto = statoRichiesto;
  }
}

export class ErrorePreventivoImmutabile extends Error {
  readonly codice = 'PREVENTIVO_IMMUTABILE' as const;
  readonly statoPreventivo: StatoPreventivo;

  constructor(statoPreventivo: StatoPreventivo) {
    super(
      `Il preventivo in stato "${statoPreventivo}" non può essere modificato direttamente. Creare una nuova versione (RC-D5).`,
    );
    this.name = 'ErrorePreventivoImmutabile';
    this.statoPreventivo = statoPreventivo;
  }
}

export class ErrorePreventivoNonApprovato extends Error {
  readonly codice = 'PREVENTIVO_NON_APPROVATO' as const;
  readonly emissioneBloccata = true as const;
  readonly statoPreventivo: StatoPreventivo;

  constructor(messaggio: string, statoPreventivo: StatoPreventivo) {
    super(messaggio);
    this.name = 'ErrorePreventivoNonApprovato';
    this.statoPreventivo = statoPreventivo;
  }
}

export class ErroreFondoSpecialeMancante extends Error {
  readonly codice = 'FONDO_SPECIALE_MANCANTE' as const;
  readonly emissioneBloccata = true as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreFondoSpecialeMancante';
  }
}

export class ErroreControlliEmissioneBollettino extends Error {
  readonly codice = 'CONTROLLI_EMISSIONE_FALLITI' as const;
  readonly anomalieBloccanti: readonly AnomaliaPreEmissione[];

  constructor(messaggio: string, anomalieBloccanti: readonly AnomaliaPreEmissione[]) {
    super(messaggio);
    this.name = 'ErroreControlliEmissioneBollettino';
    this.anomalieBloccanti = anomalieBloccanti;
  }
}

export class ErroreBollettinoEmessoImmutabile extends Error {
  readonly codice = 'BOLLETTINO_EMESSO_IMMUTABILE' as const;
  readonly bollettinoId: string | null;
  readonly statoBollettino: StatoBollettino;
  readonly campiToccati: readonly string[];

  constructor(
    bollettinoId: string | null,
    statoBollettino: StatoBollettino,
    campiToccati: readonly string[],
  ) {
    super(
      `Un bollettino in stato "${statoBollettino}" non può essere modificato (campi: ${campiToccati.join(', ')}). Utilizzare la procedura di rettifica per sostituzione o annullamento (RC-E2, RC-E4).`,
    );
    this.name = 'ErroreBollettinoEmessoImmutabile';
    this.bollettinoId = bollettinoId;
    this.statoBollettino = statoBollettino;
    this.campiToccati = campiToccati;
  }
}

export class ErroreTransizioneBollettinoNonValida extends Error {
  readonly codice = 'TRANSIZIONE_BOLLETTINO_NON_VALIDA' as const;
  readonly statoCorrente: StatoBollettino;
  readonly statoRichiesto: StatoBollettino;

  constructor(messaggio: string, statoCorrente: StatoBollettino, statoRichiesto: StatoBollettino) {
    super(messaggio);
    this.name = 'ErroreTransizioneBollettinoNonValida';
    this.statoCorrente = statoCorrente;
    this.statoRichiesto = statoRichiesto;
  }
}

// ============================================================================
// UTILITA' INTERNE DATE E NORMALIZZAZIONE STATI
// ============================================================================

function validaDataIso(dataIso: string | null | undefined, nomeCampo: string): string {
  if (typeof dataIso !== 'string' || !dataIso.trim()) {
    throw new TypeError(`Data obbligatoria mancante per ${nomeCampo} (atteso formato YYYY-MM-DD).`);
  }
  const pulita = dataIso.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pulita);
  if (!match) {
    throw new TypeError(`Data non valida per ${nomeCampo} (atteso formato YYYY-MM-DD): "${dataIso}"`);
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

/**
 * Normalizza lo stato del preventivo accettando sia maiuscolo (`BOZZA`, `APPROVATO`, `SUPERATO`)
 * sia minuscolo (`bozza`, `approvato`, `superato`).
 */
export function normalizzaStatoPreventivo(stato: string | null | undefined): StatoPreventivo {
  const s = (stato ?? '').trim().toUpperCase();
  if (s === 'BOZZA' || s === 'APPROVATO' || s === 'SUPERATO') {
    return s;
  }
  throw new TypeError(
    `Stato preventivo non valido: "${String(stato)}". Stati ammessi: BOZZA, APPROVATO, SUPERATO.`,
  );
}

/**
 * Normalizza lo stato del bollettino accettando sia maiuscolo sia minuscolo/spaziato
 * (es. `'parzialmente pagato'` -> `'PARZIALMENTE_PAGATO'`).
 */
export function normalizzaStatoBollettino(stato: string | null | undefined): StatoBollettino {
  const s = (stato ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if ((STATI_BOLLETTINO as readonly string[]).includes(s)) {
    return s as StatoBollettino;
  }
  throw new TypeError(
    `Stato bollettino non valido: "${String(stato)}". Stati ammessi: ${STATI_BOLLETTINO.join(', ')}.`,
  );
}

// ============================================================================
// 1. CICLO DI VITA DEL PREVENTIVO (RC-D1, RC-D2, RC-D5)
// ============================================================================

export interface VocePreventivoInput {
  id?: string;
  voceSpesaId?: string | null;
  sottocontoId?: string | null;
  tabellaMillesimaleId?: string | null;
  versioneTabella?: number;
  criterioRipartizione?: CriterioChiPaga;
  descrizione: string;
  importoPrevistoCent: CentesimiInput;
  /** Quote millesimali specifiche per questa voce (opzionali; se omesse si usa la tabella generale). */
  quoteMillesimi?: readonly QuotaMillesimiInput[];
}

export interface PreventivoRecordInput {
  id: string;
  condominio_id: string;
  esercizio_id: string;
  gestione_id?: string | null;
  versione?: number;
  stato: StatoPreventivo | Lowercase<StatoPreventivo>;
  totale_previsto_centesimi: CentesimiInput;
  data_approvazione?: string | null;
  delibera_approvazione?: string | null;
  precedente_id?: string | null;
  note?: string | null;
  autore_id?: string | null;
}

export interface RisultatoTransizionePreventivo {
  valido: boolean;
  statoPartenza: StatoPreventivo;
  statoArrivo: StatoPreventivo;
  errore: string | null;
}

/**
 * Verifica se la transizione di stato di un preventivo è consentita dal modello obiettivo (Sezione 3, RC-D2, RC-D5):
 * - `BOZZA -> APPROVATO` (con data assemblea e riferimento delibera)
 * - `APPROVATO -> SUPERATO` (quando sostituito da una nuova versione approvata)
 * Nessun'altra transizione è consentita.
 */
export function validaTransizioneStatoPreventivo(
  statoPartenzaInput: string,
  statoArrivoInput: string,
): RisultatoTransizionePreventivo {
  const statoPartenza = normalizzaStatoPreventivo(statoPartenzaInput);
  const statoArrivo = normalizzaStatoPreventivo(statoArrivoInput);

  if (statoPartenza === 'BOZZA' && statoArrivo === 'APPROVATO') {
    return { valido: true, statoPartenza, statoArrivo, errore: null };
  }
  if (statoPartenza === 'APPROVATO' && statoArrivo === 'SUPERATO') {
    return { valido: true, statoPartenza, statoArrivo, errore: null };
  }

  return {
    valido: false,
    statoPartenza,
    statoArrivo,
    errore: `Transizione di stato preventivo non consentita: da "${statoPartenza}" a "${statoArrivo}". Transizioni ammesse: BOZZA -> APPROVATO -> SUPERATO (RC-D2, RC-D5).`,
  };
}

/**
 * Calcola il totale del preventivo in centesimi interi a partire dalle singole voci (RC-D2).
 */
export function calcolaTotalePreventivoDaVoci(
  voci: ReadonlyArray<{
    descrizione?: string;
    importoPrevistoCent?: CentesimiInput;
    importo_previsto_centesimi?: CentesimiInput;
  }>,
): Centesimi {
  let totale = 0;
  for (let i = 0; i < voci.length; i++) {
    const v = voci[i]!;
    const raw = v.importoPrevistoCent ?? v.importo_previsto_centesimi ?? 0;
    const cent = normalizzaCentesimi(raw);
    if (cent < 0) {
      throw new RangeError(
        `L'importo previsto della voce "${v.descrizione ?? `#${i + 1}`}" non può essere negativo: ${cent}`,
      );
    }
    totale = normalizzaCentesimi(totale + cent);
  }
  return totale;
}

export interface ApprovaPreventivoInput {
  preventivo: PreventivoRecordInput;
  /** Data dell'assemblea che ha approvato il preventivo (`YYYY-MM-DD`, obbligatoria per RC-D2). */
  dataAssemblea?: string | null;
  /** Alias di `dataAssemblea`. */
  dataApprovazione?: string | null;
  /** Riferimento testuale alla delibera assembleare (obbligatorio per RC-D2). */
  deliberaRiferimento?: string | null;
  /** Alias di `deliberaRiferimento`. */
  deliberaApprovazione?: string | null;
  /** Eventuale versione precedente approvata della stessa gestione, che passa automaticamente a `SUPERATO` (RC-D5). */
  preventivoPrecedenteApprovato?: PreventivoRecordInput | null;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface ApprovaPreventivoOutput {
  preventivoApprovato: {
    id: string;
    condominio_id: string;
    esercizio_id: string;
    gestione_id: string | null;
    versione: number;
    stato: 'APPROVATO';
    totale_previsto_centesimi: Centesimi;
    data_approvazione: string;
    delibera_approvazione: string;
    precedente_id: string | null;
    note: string | null;
    autore_id: string | null;
  };
  /** Se era presente una versione precedente in stato `APPROVATO`, viene restituita marcata `SUPERATO` senza alterarne gli importi (RC-D5). */
  preventivoSuperato: {
    id: string;
    condominio_id: string;
    esercizio_id: string;
    gestione_id: string | null;
    versione: number;
    stato: 'SUPERATO';
    totale_previsto_centesimi: Centesimi;
    data_approvazione: string | null;
    delibera_approvazione: string | null;
    precedente_id: string | null;
    note: string | null;
    autore_id: string | null;
  } | null;
  eventoAudit: EventoAuditContabile;
}

/**
 * Approva un preventivo in stato `BOZZA` richiedendo obbligatoriamente la data dell'assemblea
 * e il riferimento alla delibera (RC-D2).
 * Se esiste una versione precedente approvata per la stessa gestione, la transita in stato `SUPERATO`
 * mantenendo intatti i suoi dati storici (RC-D5).
 */
export function approvaPreventivo(input: ApprovaPreventivoInput): ApprovaPreventivoOutput {
  const statoCorrente = normalizzaStatoPreventivo(input.preventivo.stato);
  const transizione = validaTransizioneStatoPreventivo(statoCorrente, 'APPROVATO');
  if (!transizione.valido) {
    throw new ErroreTransizionePreventivoNonValida(
      transizione.errore ?? 'Impossibile approvare il preventivo.',
      statoCorrente,
      'APPROVATO',
    );
  }

  const rawData = input.dataAssemblea ?? input.dataApprovazione ?? '';
  if (!rawData || !rawData.trim()) {
    throw new Error(
      "L'approvazione del preventivo richiede obbligatoriamente la data dell'assemblea (RC-D2).",
    );
  }
  const dataApprovazione = validaDataIso(rawData, 'dataAssemblea');

  const delibera = (input.deliberaRiferimento ?? input.deliberaApprovazione ?? '').trim();
  if (delibera.length < 3) {
    throw new Error(
      "L'approvazione del preventivo richiede obbligatoriamente il riferimento alla delibera assembleare (RC-D2).",
    );
  }

  const totaleCent = normalizzaCentesimi(input.preventivo.totale_previsto_centesimi);
  if (totaleCent < 0) {
    throw new RangeError(`Il totale del preventivo non può essere negativo: ${totaleCent}`);
  }

  let preventivoSuperato: ApprovaPreventivoOutput['preventivoSuperato'] = null;
  if (input.preventivoPrecedenteApprovato) {
    const prev = input.preventivoPrecedenteApprovato;
    const statoPrev = normalizzaStatoPreventivo(prev.stato);
    const transPrev = validaTransizioneStatoPreventivo(statoPrev, 'SUPERATO');
    if (!transPrev.valido) {
      throw new ErroreTransizionePreventivoNonValida(
        `Il preventivo precedente "${prev.id}" è in stato "${statoPrev}" e non può passare a SUPERATO.`,
        statoPrev,
        'SUPERATO',
      );
    }
    preventivoSuperato = {
      id: prev.id,
      condominio_id: prev.condominio_id,
      esercizio_id: prev.esercizio_id,
      gestione_id: prev.gestione_id ?? null,
      versione: prev.versione ?? 1,
      stato: 'SUPERATO',
      totale_previsto_centesimi: normalizzaCentesimi(prev.totale_previsto_centesimi),
      data_approvazione: prev.data_approvazione ?? null,
      delibera_approvazione: prev.delibera_approvazione ?? null,
      precedente_id: prev.precedente_id ?? null,
      note: prev.note ?? null,
      autore_id: prev.autore_id ?? null,
    };
  }

  const autoreId = input.autoreId ?? input.preventivo.autore_id ?? null;
  const versione =
    input.preventivo.versione ??
    (preventivoSuperato ? preventivoSuperato.versione + 1 : 1);
  const precedenteId =
    input.preventivo.precedente_id ?? (preventivoSuperato ? preventivoSuperato.id : null);

  const preventivoApprovato: ApprovaPreventivoOutput['preventivoApprovato'] = {
    id: input.preventivo.id,
    condominio_id: input.preventivo.condominio_id,
    esercizio_id: input.preventivo.esercizio_id,
    gestione_id: input.preventivo.gestione_id ?? null,
    versione,
    stato: 'APPROVATO',
    totale_previsto_centesimi: totaleCent,
    data_approvazione: dataApprovazione,
    delibera_approvazione: delibera,
    precedente_id: precedenteId,
    note: input.preventivo.note ?? null,
    autore_id: autoreId,
  };

  const eventoAudit: EventoAuditContabile = {
    azione: 'APPROVAZIONE_PREVENTIVO',
    tabella: 'preventivi',
    recordId: preventivoApprovato.id,
    condominioId: preventivoApprovato.condominio_id,
    autoreId,
    timestampIso: input.timestampIso ?? new Date().toISOString(),
    motivo: `Approvazione preventivo v${versione} con delibera ${delibera} del ${dataApprovazione}`,
    valorePrima: {
      stato: statoCorrente,
      data_approvazione: input.preventivo.data_approvazione ?? null,
      delibera_approvazione: input.preventivo.delibera_approvazione ?? null,
      precedente_superato_id: null,
    },
    valoreDopo: {
      stato: 'APPROVATO',
      versione,
      totale_previsto_centesimi: totaleCent,
      data_approvazione: dataApprovazione,
      delibera_approvazione: delibera,
      precedente_superato_id: preventivoSuperato?.id ?? null,
    },
  };

  return {
    preventivoApprovato,
    preventivoSuperato,
    eventoAudit,
  };
}

export interface CreaNuovaVersionePreventivoInput {
  preventivoPrecedente: PreventivoRecordInput;
  nuovoId: string;
  voci?: readonly VocePreventivoInput[];
  nuovoTotalePrevistoCent?: CentesimiInput;
  note?: string | null;
  /** Se `true`, la nuova versione nasce già `APPROVATO` (richiede `dataAssemblea` e `deliberaRiferimento`) e marca il precedente come `SUPERATO` (RC-D5). */
  approvaSubito?: boolean;
  dataAssemblea?: string | null;
  deliberaRiferimento?: string | null;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface CreaNuovaVersionePreventivoOutput {
  nuovoPreventivo: {
    id: string;
    condominio_id: string;
    esercizio_id: string;
    gestione_id: string | null;
    versione: number;
    stato: StatoPreventivo;
    totale_previsto_centesimi: Centesimi;
    data_approvazione: string | null;
    delibera_approvazione: string | null;
    precedente_id: string;
    note: string | null;
    autore_id: string | null;
  };
  /** Copia invariata negli importi del preventivo precedente (con `stato: 'SUPERATO'` se la nuova versione è stata approvata, RC-D5). */
  preventivoPrecedenteAggiornato: {
    id: string;
    condominio_id: string;
    esercizio_id: string;
    gestione_id: string | null;
    versione: number;
    stato: StatoPreventivo;
    totale_previsto_centesimi: Centesimi;
    data_approvazione: string | null;
    delibera_approvazione: string | null;
    precedente_id: string | null;
    note: string | null;
    autore_id: string | null;
  };
  eventoAudit: EventoAuditContabile;
}

/**
 * Crea una nuova versione di un preventivo esistente per una variazione in corso d'esercizio (RC-D5).
 * Non modifica mai gli importi o la delibera della versione precedente.
 */
export function creaNuovaVersionePreventivo(
  input: CreaNuovaVersionePreventivoInput,
): CreaNuovaVersionePreventivoOutput {
  const prev = input.preventivoPrecedente;
  const statoPrev = normalizzaStatoPreventivo(prev.stato);
  const versionePrecedente = prev.versione ?? 1;
  const nuovaVersione = versionePrecedente + 1;

  const totaleNuovoCent =
    input.nuovoTotalePrevistoCent !== undefined
      ? normalizzaCentesimi(input.nuovoTotalePrevistoCent)
      : input.voci
        ? calcolaTotalePreventivoDaVoci(input.voci)
        : normalizzaCentesimi(prev.totale_previsto_centesimi);

  if (totaleNuovoCent < 0) {
    throw new RangeError(`Il totale della nuova versione del preventivo non può essere negativo: ${totaleNuovoCent}`);
  }

  const autoreId = input.autoreId ?? prev.autore_id ?? null;

  const bozzaNuova: PreventivoRecordInput = {
    id: input.nuovoId,
    condominio_id: prev.condominio_id,
    esercizio_id: prev.esercizio_id,
    gestione_id: prev.gestione_id ?? null,
    versione: nuovaVersione,
    stato: 'BOZZA',
    totale_previsto_centesimi: totaleNuovoCent,
    data_approvazione: null,
    delibera_approvazione: null,
    precedente_id: prev.id,
    note: input.note ?? prev.note ?? null,
    autore_id: autoreId,
  };

  if (input.approvaSubito) {
    if (statoPrev !== 'APPROVATO') {
      throw new ErroreTransizionePreventivoNonValida(
        `Per approvare direttamente una variazione sostitutiva, la versione precedente deve essere in stato "APPROVATO" (trovato "${statoPrev}").`,
        statoPrev,
        'SUPERATO',
      );
    }
    const esitoApprovazione = approvaPreventivo({
      preventivo: bozzaNuova,
      dataAssemblea: input.dataAssemblea,
      deliberaRiferimento: input.deliberaRiferimento,
      preventivoPrecedenteApprovato: prev,
      autoreId,
      timestampIso: input.timestampIso,
    });

    return {
      nuovoPreventivo: {
        ...esitoApprovazione.preventivoApprovato,
        precedente_id: prev.id,
      },
      preventivoPrecedenteAggiornato: esitoApprovazione.preventivoSuperato!,
      eventoAudit: esitoApprovazione.eventoAudit,
    };
  }

  const preventivoPrecedenteInvariato = {
    id: prev.id,
    condominio_id: prev.condominio_id,
    esercizio_id: prev.esercizio_id,
    gestione_id: prev.gestione_id ?? null,
    versione: versionePrecedente,
    stato: statoPrev,
    totale_previsto_centesimi: normalizzaCentesimi(prev.totale_previsto_centesimi),
    data_approvazione: prev.data_approvazione ?? null,
    delibera_approvazione: prev.delibera_approvazione ?? null,
    precedente_id: prev.precedente_id ?? null,
    note: prev.note ?? null,
    autore_id: prev.autore_id ?? null,
  };

  const nuovoPreventivo = {
    id: input.nuovoId,
    condominio_id: prev.condominio_id,
    esercizio_id: prev.esercizio_id,
    gestione_id: prev.gestione_id ?? null,
    versione: nuovaVersione,
    stato: 'BOZZA' as const,
    totale_previsto_centesimi: totaleNuovoCent,
    data_approvazione: null,
    delibera_approvazione: null,
    precedente_id: prev.id,
    note: input.note ?? null,
    autore_id: autoreId,
  };

  return {
    nuovoPreventivo,
    preventivoPrecedenteAggiornato: preventivoPrecedenteInvariato,
    eventoAudit: {
      azione: 'CREAZIONE_NUOVA_VERSIONE_PREVENTIVO',
      tabella: 'preventivi',
      recordId: nuovoPreventivo.id,
      condominioId: prev.condominio_id,
      autoreId,
      timestampIso: input.timestampIso ?? new Date().toISOString(),
      motivo: input.note ?? `Creata versione v${nuovaVersione} in bozza a partire da v${versionePrecedente}`,
      valorePrima: {
        preventivo_precedente_id: prev.id,
        versione_precedente: versionePrecedente,
        totale_precedente_centesimi: preventivoPrecedenteInvariato.totale_previsto_centesimi,
      },
      valoreDopo: {
        nuovo_preventivo_id: nuovoPreventivo.id,
        nuova_versione: nuovaVersione,
        nuovo_totale_centesimi: totaleNuovoCent,
        stato: 'BOZZA',
      },
    },
  };
}

/**
 * Blocca qualsiasi modifica diretta a un preventivo già `APPROVATO` o `SUPERATO` (RC-D5).
 */
export function assertPreventivoModificabile(
  preventivo: Pick<PreventivoRecordInput, 'stato'>,
): void {
  const stato = normalizzaStatoPreventivo(preventivo.stato);
  if (stato !== 'BOZZA') {
    throw new ErrorePreventivoImmutabile(stato);
  }
}

// ============================================================================
// 2. BLOCCO EMISSIONE RATE DA PREVENTIVO NON APPROVATO E OVERRIDE (RC-D4, RC-J2, T7, T16)
// ============================================================================

export interface OverridePreventivoNonApprovatoInput {
  forzaEmissione?: boolean;
  motivoOverride?: string | null;
  deliberaOverride?: string | null;
  autoreId?: string | null;
}

export interface ValidaEmissioneRatePreventivoInput {
  statoPreventivo: StatoPreventivo | Lowercase<StatoPreventivo> | string;
  preventivoId?: string | null;
  condominioId?: string | null;
  esercizioId?: string | null;
  gestioneId?: string | null;
  tipoGestione?: TipoGestioneEsercizio;
  /** Importo lavori straordinari deliberati (per verifica fondo speciale ex art. 1135 c. 1 n. 4 c.c., RC-J2, T7). */
  importoLavoriStraordinariCent?: CentesimiInput | null;
  /** Indica se il fondo speciale per i lavori straordinari è stato costituito (RC-J2, T7). */
  fondoSpecialeCostituito?: boolean;
  /** Importo del fondo speciale deliberato/costituito in centesimi (RC-J2, T7). */
  importoFondoSpecialeCent?: CentesimiInput | null;
  /** Parametri di override per forzare l'emissione da preventivo non approvato (RC-D4, T16). */
  override?: OverridePreventivoNonApprovatoInput | null;
  /** Alias top-level di `override.forzaEmissione`. */
  emessaConOverride?: boolean;
  /** Alias top-level di `override.motivoOverride`. */
  motivoOverride?: string | null;
  /** Alias top-level di `override.deliberaOverride`. */
  deliberaOverride?: string | null;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface RisultatoValidazioneEmissioneRate {
  consentita: boolean;
  emissioneBloccata: boolean;
  statoPreventivo: StatoPreventivo;
  emessaConOverride: boolean;
  motivoOverride: string | null;
  deliberaOverride: string | null;
  codiceBlocco:
    | 'PREVENTIVO_NON_APPROVATO'
    | 'PREVENTIVO_SUPERATO'
    | 'OVERRIDE_INCOMPLETO'
    | 'FONDO_SPECIALE_MANCANTE'
    | null;
  /** Warning non bloccante quando si emette con override (RC-N3, T16). */
  avviso: string | null;
  errore: string | null;
  /** Evento di audit generato obbligatoriamente quando si emette con override (RC-D4, RC-M1, T16). */
  eventoAudit: EventoAuditContabile | null;
}

/**
 * Verifica se è possibile emettere rate a partire da un preventivo (RC-D4, RC-J2, T7, T16):
 * - Per gestioni `STRAORDINARIA` con lavori deliberati, blocca l'emissione se manca l'importo dei lavori
 *   o se non è stato costituito il fondo speciale di importo pari ai lavori (art. 1135 c. 1 n. 4 c.c., RC-J2, T7).
 * - Se il preventivo è `SUPERATO`, l'emissione è sempre bloccata.
 * - Se il preventivo è `APPROVATO`, l'emissione è consentita normalmente (`emessaConOverride = false`).
 * - Se il preventivo è `BOZZA` (non approvato), l'emissione è **vietata** salvo override esplicito
 *   che registri `motivoOverride` e `deliberaOverride` con tracciamento in audit (`eventoAudit`, RC-D4, T16)
 *   e generazione di warning non bloccante (RC-N3).
 */
export function validaEmissioneRateDaPreventivo(
  input: ValidaEmissioneRatePreventivoInput,
): RisultatoValidazioneEmissioneRate {
  const statoPreventivo = normalizzaStatoPreventivo(input.statoPreventivo);

  // 1. Controllo Fondo Speciale obbligatorio per lavori straordinari (RC-J2, T7)
  if (
    input.tipoGestione === 'STRAORDINARIA' &&
    (input.fondoSpecialeCostituito !== undefined ||
      input.importoLavoriStraordinariCent !== undefined ||
      input.importoFondoSpecialeCent !== undefined)
  ) {
    const importoLavori =
      input.importoLavoriStraordinariCent !== undefined &&
      input.importoLavoriStraordinariCent !== null
        ? normalizzaCentesimi(input.importoLavoriStraordinariCent)
        : 0;
    const importoFondo =
      input.importoFondoSpecialeCent !== undefined && input.importoFondoSpecialeCent !== null
        ? normalizzaCentesimi(input.importoFondoSpecialeCent)
        : input.fondoSpecialeCostituito
          ? importoLavori
          : 0;
    const fondoOk =
      input.fondoSpecialeCostituito !== false &&
      importoLavori > 0 &&
      importoFondo >= importoLavori;

    if (!fondoOk) {
      return {
        consentita: false,
        emissioneBloccata: true,
        statoPreventivo,
        emessaConOverride: false,
        motivoOverride: null,
        deliberaOverride: null,
        codiceBlocco: 'FONDO_SPECIALE_MANCANTE',
        avviso: null,
        errore:
          "Emissione rate straordinarie vietata: per lavori straordinari o innovazioni è obbligatorio indicare l'importo dei lavori e costituire un fondo speciale di pari importo (art. 1135 c. 1 n. 4 c.c., RC-J2, T7).",
        eventoAudit: null,
      };
    }
  }

  // 2. Preventivo SUPERATO: mai emettibile
  if (statoPreventivo === 'SUPERATO') {
    return {
      consentita: false,
      emissioneBloccata: true,
      statoPreventivo,
      emessaConOverride: false,
      motivoOverride: null,
      deliberaOverride: null,
      codiceBlocco: 'PREVENTIVO_SUPERATO',
      avviso: null,
      errore:
        'Emissione rate vietata: il preventivo selezionato è in stato "SUPERATO" da una versione successiva (RC-D5).',
      eventoAudit: null,
    };
  }

  // 3. Preventivo APPROVATO: emissione ordinaria consentita
  if (statoPreventivo === 'APPROVATO') {
    return {
      consentita: true,
      emissioneBloccata: false,
      statoPreventivo,
      emessaConOverride: false,
      motivoOverride: null,
      deliberaOverride: null,
      codiceBlocco: null,
      avviso: null,
      errore: null,
      eventoAudit: null,
    };
  }

  // 4. Preventivo in BOZZA (non approvato): vietato salvo override completo (RC-D4, T16)
  const motivoRaw = (input.override?.motivoOverride ?? input.motivoOverride ?? '').trim();
  const deliberaRaw = (input.override?.deliberaOverride ?? input.deliberaOverride ?? '').trim();
  const forzaRichiesta =
    input.override?.forzaEmissione !== undefined
      ? Boolean(input.override.forzaEmissione)
      : input.emessaConOverride !== undefined
        ? Boolean(input.emessaConOverride)
        : Boolean(motivoRaw || deliberaRaw);

  if (!forzaRichiesta) {
    return {
      consentita: false,
      emissioneBloccata: true,
      statoPreventivo,
      emessaConOverride: false,
      motivoOverride: null,
      deliberaOverride: null,
      codiceBlocco: 'PREVENTIVO_NON_APPROVATO',
      avviso: null,
      errore:
        'Emissione rate vietata: il preventivo è in stato "BOZZA" (non approvato). È possibile forzare l’emissione solo tramite override esplicito con motivo e delibera di riferimento (RC-D4, T16).',
      eventoAudit: null,
    };
  }

  if (motivoRaw.length < 3 || deliberaRaw.length < 2) {
    return {
      consentita: false,
      emissioneBloccata: true,
      statoPreventivo,
      emessaConOverride: false,
      motivoOverride: motivoRaw || null,
      deliberaOverride: deliberaRaw || null,
      codiceBlocco: 'OVERRIDE_INCOMPLETO',
      avviso: null,
      errore:
        'Override preventivo non approvato incompleto: sono obbligatori sia il motivo dell’override sia la delibera di riferimento (RC-D4, T16).',
      eventoAudit: null,
    };
  }

  const autoreId = input.override?.autoreId ?? input.autoreId ?? null;
  const avviso = `Attenzione: rate emesse con override da preventivo non approvato (motivo: "${motivoRaw}", delibera: "${deliberaRaw}", RC-D4, RC-N3).`;

  const eventoAudit: EventoAuditContabile = {
    azione: 'OVERRIDE_EMISSIONE_RATE_PREVENTIVO_BOZZA',
    tabella: 'rate_testata',
    recordId: input.preventivoId ?? null,
    condominioId: input.condominioId ?? null,
    autoreId,
    timestampIso: input.timestampIso ?? new Date().toISOString(),
    motivo: motivoRaw,
    valorePrima: {
      preventivo_id: input.preventivoId ?? null,
      stato_preventivo: 'BOZZA',
      emessa_con_override: false,
    },
    valoreDopo: {
      preventivo_id: input.preventivoId ?? null,
      stato_preventivo: 'BOZZA',
      emessa_con_override: true,
      motivo_override: motivoRaw,
      delibera_override: deliberaRaw,
    },
  };

  return {
    consentita: true,
    emissioneBloccata: false,
    statoPreventivo,
    emessaConOverride: true,
    motivoOverride: motivoRaw,
    deliberaOverride: deliberaRaw,
    codiceBlocco: null,
    avviso,
    errore: null,
    eventoAudit,
  };
}

/**
 * Versione assertiva di `validaEmissioneRateDaPreventivo`: solleva `ErrorePreventivoNonApprovato`
 * o `ErroreFondoSpecialeMancante` se l'emissione non è consentita (RC-D4, RC-J2, T7, T16).
 */
export function assertEmissioneRateConsentita(
  input: ValidaEmissioneRatePreventivoInput,
): RisultatoValidazioneEmissioneRate {
  const esito = validaEmissioneRateDaPreventivo(input);
  if (!esito.consentita) {
    if (esito.codiceBlocco === 'FONDO_SPECIALE_MANCANTE') {
      throw new ErroreFondoSpecialeMancante(
        esito.errore ?? 'Fondo speciale mancante per lavori straordinari (RC-J2, T7).',
      );
    }
    throw new ErrorePreventivoNonApprovato(
      esito.errore ?? 'Emissione rate vietata da preventivo non approvato (RC-D4, T16).',
      esito.statoPreventivo,
    );
  }
  return esito;
}

// ============================================================================
// 3. RISOLUZIONE SOGGETTO PAGANTE, GENERAZIONE PIANO RATE E RAGGRUPPAMENTO MULTI-UNITA' (RC-D3, T13)
// ============================================================================

export interface TitolaritaUnitaInput {
  id?: string;
  soggettoId?: string | null;
  utenteId?: string | null;
  intestazione?: string | null;
  ruoloTitolarita?: RuoloTitolarita;
  tipoPossesso?: 'PROPRIETARIO' | 'INQUILINO';
  quotaPossesso?: number;
  isReferenteBollettino?: boolean;
  dataInizio: string;
  dataFine?: string | null;
  dataAttoSubentro?: string | null;
  danteCausaUtenteId?: string | null;
}

export interface UnitaPerPianoRateInput {
  unitaId: string;
  interno?: string;
  unitaInterno?: string;
  palazzoId?: string | null;
  scalaColonnaId?: string | null;
  /** Valore millesimale dell'unità nella tabella di ripartizione (es. 50 o 30 in T13). */
  millesimi: number;
  /** Soggetto pagante diretto (se non si passa lo storico `titolarita`). */
  soggettoId?: string | null;
  utenteId?: string | null;
  intestazione?: string | null;
  intestazioneDestinatario?: string | null;
  /** Storico delle titolarità dell'unità per gestire subentri, usufrutto e comproprietà (RC-D3, RC-H4). */
  titolarita?: readonly TitolaritaUnitaInput[];
}

export type UnitaPianoRateInput = UnitaPerPianoRateInput;

export interface SoggettoPaganteRisolto {
  soggettoId: string | null;
  utenteId: string | null;
  obbligatoInSolidoUtenteId: string | null;
  chiaveDestinatario: string;
  intestazione: string;
  ruoloTitolarita: RuoloTitolarita;
  haTitolareValido: boolean;
}

/**
 * Risolve il soggetto pagante di un'unità immobiliare a una determinata data di scadenza (RC-D3, RC-H4, RC-I1, RC-I5):
 * - Il condominio si rivolge sempre al condòmino proprietario/titolare di diritto reale e mai direttamente all'inquilino (RC-I1).
 * - In caso di usufrutto, le spese/rate ordinarie vanno all'usufruttuario e le straordinarie al nudo proprietario/proprietario (RC-I5).
 * - In caso di comproprietà, il bollettino è intestato al referente scelto (`isReferenteBollettino`) o al primo comproprietario (RC-A12).
 * - Dopo un subentro per vendita (`dataInizio` / `dataFine`), le rate non ancora emesse con scadenza successiva all'atto
 *   vanno automaticamente al nuovo soggetto acquirente (RC-D3, RC-H4).
 */
export function risolviSoggettoPaganteUnita(
  unita: UnitaPerPianoRateInput,
  dataRiferimento?: string | null,
  tipoGestione: TipoGestioneEsercizio = 'ORDINARIA',
): SoggettoPaganteRisolto {
  if (unita.titolarita && unita.titolarita.length > 0) {
    const dataRef = dataRiferimento ? dataRiferimento.trim().slice(0, 10) : '9999-12-31';

    const attiveAllaData = unita.titolarita.filter((t) => {
      const inizio = t.dataInizio.trim().slice(0, 10);
      const fine = t.dataFine ? t.dataFine.trim().slice(0, 10) : null;
      return inizio <= dataRef && (fine === null || fine >= dataRef);
    });

    // Esclude i conduttori/inquilini come intestatari del bollettino condominiale (RC-I1)
    const titolariReali = attiveAllaData.filter((t) => {
      const ruolo =
        t.ruoloTitolarita ?? (t.tipoPossesso === 'INQUILINO' ? 'CONDUTTORE' : 'PROPRIETARIO');
      return ruolo !== 'CONDUTTORE';
    });

    if (titolariReali.length > 0) {
      let scelto: TitolaritaUnitaInput | undefined;

      if (tipoGestione === 'ORDINARIA' || tipoGestione === 'RISCALDAMENTO') {
        scelto =
          titolariReali.find((t) => t.ruoloTitolarita === 'USUFRUTTUARIO') ??
          titolariReali.find((t) => t.isReferenteBollettino) ??
          titolariReali.find((t) => (t.ruoloTitolarita ?? 'PROPRIETARIO') === 'PROPRIETARIO') ??
          titolariReali[0];
      } else {
        // Gestione STRAORDINARIA: nudo proprietario / proprietario
        scelto =
          titolariReali.find((t) => t.ruoloTitolarita === 'NUDO_PROPRIETARIO') ??
          titolariReali.find((t) => (t.ruoloTitolarita ?? 'PROPRIETARIO') === 'PROPRIETARIO') ??
          titolariReali.find((t) => t.isReferenteBollettino) ??
          titolariReali[0];
      }

      if (scelto) {
        const soggettoId = scelto.soggettoId ?? null;
        const utenteId = scelto.utenteId ?? null;
        const haTitolareValido = Boolean(soggettoId || utenteId);
        const chiaveDestinatario =
          soggettoId ?? utenteId ?? `SENZA_TITOLARE:${unita.unitaId}`;
        const ruolo =
          scelto.ruoloTitolarita ??
          (scelto.tipoPossesso === 'INQUILINO' ? 'CONDUTTORE' : 'PROPRIETARIO');

        return {
          soggettoId,
          utenteId,
          obbligatoInSolidoUtenteId: scelto.danteCausaUtenteId ?? null,
          chiaveDestinatario,
          intestazione:
            scelto.intestazione?.trim() ||
            (soggettoId ? `Soggetto ${soggettoId}` : utenteId ? `Condòmino ${utenteId}` : 'Titolare non assegnato'),
          ruoloTitolarita: ruolo,
          haTitolareValido,
        };
      }
    }

    return {
      soggettoId: null,
      utenteId: null,
      obbligatoInSolidoUtenteId: null,
      chiaveDestinatario: `SENZA_TITOLARE:${unita.unitaId}`,
      intestazione: 'Titolare non assegnato',
      ruoloTitolarita: 'PROPRIETARIO',
      haTitolareValido: false,
    };
  }

  const soggettoId = unita.soggettoId ?? null;
  const utenteId = unita.utenteId ?? null;
  const haTitolareValido = Boolean(soggettoId || utenteId);
  const chiaveDestinatario =
    soggettoId ?? utenteId ?? `SENZA_TITOLARE:${unita.unitaId}`;
  const rawIntestazione = unita.intestazione ?? unita.intestazioneDestinatario;

  return {
    soggettoId,
    utenteId,
    obbligatoInSolidoUtenteId: null,
    chiaveDestinatario,
    intestazione:
      rawIntestazione?.trim() ||
      (soggettoId
        ? `Soggetto ${soggettoId}`
        : utenteId
          ? `Condòmino ${utenteId}`
          : 'Titolare non assegnato'),
    ruoloTitolarita: 'PROPRIETARIO',
    haTitolareValido,
  };
}

export interface ScadenzaPianoRateInput {
  numeroRata?: number;
  dataScadenza: string;
  descrizione?: string;
  /** Percentuale del preventivo per questa rata (es. 25 per 4 rate trimestrali, 50 per 2 rate semestrali, 100 per rata unica). */
  percentuale?: number;
  /** Alias di `percentuale`. */
  percentualePreventivo?: number;
  /** Importo fisso della rata in centesimi (alternativo a `percentuale`). */
  importoRataCent?: CentesimiInput;
}

export type ScadenzaRataInput = ScadenzaPianoRateInput;

export interface RataEmessaStoricaInput {
  numeroRata: number;
  unitaId: string;
  soggettoId: string | null;
  utenteId: string | null;
  intestazione?: string;
  importoDovutoCent: CentesimiInput;
  bollettinoId?: string | null;
}

export interface RigaBollettinoProposta {
  unitaId: string;
  interno: string;
  rataTestataIndex: number;
  numeroRata: number;
  gestioneId: string | null;
  descrizione: string;
  importoCent: Centesimi;
  importoEuro: number;
  dataScadenza: string;
  millesimiUnita: number;
}

export interface BollettinoProposto {
  numeroProgressivo: number;
  anno: number;
  destinatarioSoggettoId: string | null;
  destinatarioUtenteId: string | null;
  chiaveDestinatario: string;
  intestazioneDestinatario: string;
  dataScadenza: string;
  stato: 'BOZZA';
  totaleCent: Centesimi;
  totaleEuro: number;
  importoPagatoCent: 0;
  saldoResiduoCent: Centesimi;
  righe: RigaBollettinoProposta[];
  unitaIds: string[];
  isMultiUnita: boolean;
  versione: 1;
  versioneMotoreCalcolo: string;
}

export interface RataDettaglioGenerata {
  numeroRata: number;
  unitaId: string;
  interno: string;
  soggettoId: string | null;
  utenteId: string | null;
  chiaveDestinatario: string;
  intestazioneDestinatario: string;
  millesimi: number;
  quotaCalcolataCent: Centesimi;
  restoArrotondamentoCent: Centesimi;
  importoDovutoCent: Centesimi;
  importoDovutoEuro: number;
  importoPagatoCent: 0;
  dataScadenza: string;
  dataEsigibilita: string;
  statoRataModello: 'PIANIFICATA' | 'EMESSA';
  giaEmessaAlVenditore: boolean;
  versioneMotoreCalcolo: string;
}

export interface RataTestataGenerata {
  numeroRata: number;
  descrizione: string;
  dataScadenza: string;
  percentualePreventivo: number;
  importoTotaleRataCent: Centesimi;
  importoTotaleRataEuro: number;
  sommaQuoteUnitaCent: Centesimi;
  restoArrotondamentoCent: Centesimi;
  unitaArrotondamentoId: string | null;
  emessaConOverride: boolean;
  motivoOverride: string | null;
  deliberaOverride: string | null;
  dettagli: RataDettaglioGenerata[];
}

export interface GeneraPianoRateInput {
  condominioId?: string | null;
  esercizioId?: string | null;
  gestioneId?: string | null;
  preventivoId?: string | null;
  versionePreventivo?: number;
  statoPreventivo?: StatoPreventivo | Lowercase<StatoPreventivo> | string;
  tipoGestione?: TipoGestioneEsercizio;
  /** Importo complessivo del preventivo in centesimi (oppure calcolato da `vociPreventivo`). */
  importoPreventivoCent?: CentesimiInput;
  vociPreventivo?: readonly VocePreventivoInput[];
  /** Unità partecipanti con millesimi e titolari. */
  unita: readonly UnitaPerPianoRateInput[];
  /** Totale nominale della tabella millesimale (default 1000). */
  totaleMillesimi?: number;
  /** Se `true`, richiede che la somma dei millesimi delle unità coincida con `totaleMillesimi` (T14). */
  richiediQuadraturaMillesimi?: boolean;
  /** Scadenze del piano rate (se omesse, genera 1 rata unica al 100%). */
  scadenze?: readonly ScadenzaPianoRateInput[];
  /** Data di scadenza di default se `scadenze` non è specificato. */
  dataScadenzaDefault?: string;
  /** Rate già emesse prima di un eventuale subentro: restano intestate al soggetto originario (RC-H4). */
  rateGiaEmesse?: readonly RataEmessaStoricaInput[];
  /** Parametri fondo speciale per gestioni straordinarie (RC-J2, T7). */
  importoLavoriStraordinariCent?: CentesimiInput | null;
  fondoSpecialeCostituito?: boolean;
  importoFondoSpecialeCent?: CentesimiInput | null;
  /** Override per preventivo non approvato (RC-D4, T16). */
  override?: OverridePreventivoNonApprovatoInput | null;
  emessaConOverride?: boolean;
  motivoOverride?: string | null;
  deliberaOverride?: string | null;
  numeroProgressivoInizialeBollettini?: number;
  annoBollettini?: number;
  autoreId?: string | null;
}

export interface GeneraPianoRateOutput {
  importoPreventivoCent: Centesimi;
  importoPreventivoEuro: number;
  statoPreventivo: StatoPreventivo;
  emessaConOverride: boolean;
  motivoOverride: string | null;
  deliberaOverride: string | null;
  validazionePreventivo: RisultatoValidazioneEmissioneRate;
  rateTestata: RataTestataGenerata[];
  tutteRateDettaglio: RataDettaglioGenerata[];
  /** Bollettini raggruppati per soggetto pagante e scadenza (un unico bollettino multi-riga per proprietario con più unità, T13). */
  bollettiniProposti: BollettinoProposto[];
  avvisi: string[];
  eventoAuditOverride: EventoAuditContabile | null;
  versioneMotoreCalcolo: string;
}

/**
 * Raggruppa un insieme di quote/rate unità per soggetto pagante e data di scadenza,
 * generando un unico bollettino multi-riga per i proprietari con più unità immobiliari (RC-D3, RC-E1, T13).
 */
export function raggruppaRateInBollettini(input: {
  rateDettaglio: readonly RataDettaglioGenerata[];
  gestioneId?: string | null;
  descrizioneBase?: string;
  numeroProgressivoIniziale?: number;
  anno?: number;
}): BollettinoProposto[] {
  const progressivoStart = input.numeroProgressivoIniziale ?? 1;
  if (!Number.isSafeInteger(progressivoStart) || progressivoStart < 1) {
    throw new RangeError(`Il numero progressivo iniziale deve essere >= 1: ${progressivoStart}`);
  }

  const gruppi = new Map<
    string,
    {
      destinatarioSoggettoId: string | null;
      destinatarioUtenteId: string | null;
      chiaveDestinatario: string;
      intestazioneDestinatario: string;
      dataScadenza: string;
      righe: RigaBollettinoProposta[];
    }
  >();

  for (const det of input.rateDettaglio) {
    // Le rate già emesse in precedenza (es. al venditore prima del subentro, RC-H4) non generano nuovi bollettini
    if (det.giaEmessaAlVenditore) {
      continue;
    }

    const groupKey = `${det.chiaveDestinatario}__${det.dataScadenza}`;
    let gruppo = gruppi.get(groupKey);
    if (!gruppo) {
      gruppo = {
        destinatarioSoggettoId: det.soggettoId,
        destinatarioUtenteId: det.utenteId,
        chiaveDestinatario: det.chiaveDestinatario,
        intestazioneDestinatario: det.intestazioneDestinatario,
        dataScadenza: det.dataScadenza,
        righe: [],
      };
      gruppi.set(groupKey, gruppo);
    }

    const labelUnita = det.interno ? `Unità ${det.interno}` : `Unità ${det.unitaId}`;
    const descBase = input.descrizioneBase ?? `Rata n. ${det.numeroRata}`;
    gruppo.righe.push({
      unitaId: det.unitaId,
      interno: det.interno,
      rataTestataIndex: det.numeroRata - 1,
      numeroRata: det.numeroRata,
      gestioneId: input.gestioneId ?? null,
      descrizione: `${descBase} — ${labelUnita}`,
      importoCent: det.importoDovutoCent,
      importoEuro: centsToEuro(det.importoDovutoCent),
      dataScadenza: det.dataScadenza,
      millesimiUnita: det.millesimi,
    });
  }

  const bollettini: BollettinoProposto[] = [];
  let progressivoCorrente = progressivoStart;

  for (const g of gruppi.values()) {
    const totaleCent = g.righe.reduce(
      (acc, r) => normalizzaCentesimi(acc + r.importoCent),
      0,
    );
    const anno =
      input.anno ?? Number(g.dataScadenza.slice(0, 4));
    const unitaIds = g.righe.map((r) => r.unitaId);

    bollettini.push({
      numeroProgressivo: progressivoCorrente++,
      anno,
      destinatarioSoggettoId: g.destinatarioSoggettoId,
      destinatarioUtenteId: g.destinatarioUtenteId,
      chiaveDestinatario: g.chiaveDestinatario,
      intestazioneDestinatario: g.intestazioneDestinatario,
      dataScadenza: g.dataScadenza,
      stato: 'BOZZA',
      totaleCent,
      totaleEuro: centsToEuro(totaleCent),
      importoPagatoCent: 0,
      saldoResiduoCent: totaleCent,
      righe: g.righe,
      unitaIds,
      isMultiUnita: g.righe.length > 1,
      versione: 1,
      versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
    });
  }

  return bollettini;
}

/**
 * Calcola le rate per unità e soggetto pagante a partire da un preventivo e genera
 * i relativi bollettini raggruppando più unità dello stesso proprietario in un unico bollettino multi-riga (RC-D3, RC-D4, T13, T16).
 */
export function generaPianoRate(input: GeneraPianoRateInput): GeneraPianoRateOutput {
  if (!input.unita || input.unita.length === 0) {
    throw new RangeError('Impossibile generare il piano rate: nessuna unità immobiliare fornita.');
  }

  // 1. Verifica blocco preventivo non approvato / override tracciato e fondo speciale (RC-D4, RC-J2, T7, T16)
  const validazionePreventivo = assertEmissioneRateConsentita({
    statoPreventivo: input.statoPreventivo ?? 'APPROVATO',
    preventivoId: input.preventivoId,
    condominioId: input.condominioId,
    esercizioId: input.esercizioId,
    gestioneId: input.gestioneId,
    tipoGestione: input.tipoGestione,
    importoLavoriStraordinariCent: input.importoLavoriStraordinariCent,
    fondoSpecialeCostituito: input.fondoSpecialeCostituito,
    importoFondoSpecialeCent: input.importoFondoSpecialeCent,
    override: input.override,
    emessaConOverride: input.emessaConOverride,
    motivoOverride: input.motivoOverride,
    deliberaOverride: input.deliberaOverride,
    autoreId: input.autoreId,
  });

  // 2. Determina l'importo complessivo del preventivo
  const importoPreventivoCent =
    input.importoPreventivoCent !== undefined
      ? normalizzaCentesimi(input.importoPreventivoCent)
      : input.vociPreventivo
        ? calcolaTotalePreventivoDaVoci(input.vociPreventivo)
        : 0;

  if (importoPreventivoCent <= 0) {
    throw new RangeError(
      `L'importo totale del preventivo per generare le rate deve essere maggiore di zero: ${importoPreventivoCent}`,
    );
  }

  const totaleMillesimiAtteso = input.totaleMillesimi ?? 1000;
  const quoteMillesimiInput: QuotaMillesimiInput[] = input.unita.map((u) => ({
    unitaId: u.unitaId,
    millesimi: u.millesimi,
  }));

  if (input.richiediQuadraturaMillesimi) {
    const checkQuadratura = validaQuadraturaMillesimi(quoteMillesimiInput, totaleMillesimiAtteso);
    if (!checkQuadratura.valido) {
      throw new Error(checkQuadratura.errore ?? 'Tabella millesimale non quadrata (T14).');
    }
  }

  // Verifica se le unità passate sono un sottoinsieme su una tabella di base nota (es. T13: Unità 1 da 50 e Unità 2 da 30 su 1000)
  const sommaMillesimiUnita = input.unita.reduce((acc, u) => acc + u.millesimi, 0);
  const isSottoinsiemeSuTabellaTotale =
    input.totaleMillesimi !== undefined &&
    Math.abs(sommaMillesimiUnita - totaleMillesimiAtteso) > 0.0005 &&
    sommaMillesimiUnita < totaleMillesimiAtteso &&
    !input.richiediQuadraturaMillesimi;

  // 3. Normalizzazione scadenze piano rate
  const scadenzeInput: readonly ScadenzaPianoRateInput[] =
    input.scadenze && input.scadenze.length > 0
      ? input.scadenze
      : [
          {
            numeroRata: 1,
            dataScadenza: input.dataScadenzaDefault ?? '2026-03-31',
            descrizione: 'Rata 1',
            percentuale: 100,
          },
        ];

  const numeroRate = scadenzeInput.length;
  const importiTotaliPerRata: Centesimi[] = [];
  const percentualiPerRata: number[] = [];

  const usaImportiEspliciti = scadenzeInput.every((s) => s.importoRataCent !== undefined);
  if (usaImportiEspliciti) {
    let sommaRate = 0;
    for (const s of scadenzeInput) {
      const imp = normalizzaCentesimi(s.importoRataCent!);
      if (imp <= 0) {
        throw new RangeError(`L'importo della rata deve essere positivo: ${imp}`);
      }
      importiTotaliPerRata.push(imp);
      sommaRate = normalizzaCentesimi(sommaRate + imp);
      percentualiPerRata.push(Number(((imp * 100) / importoPreventivoCent).toFixed(2)));
    }
    if (sommaRate !== importoPreventivoCent) {
      throw new Error(
        `La somma degli importi delle rate (${formattaCentsItaliano(sommaRate, true)}) non coincide con il totale del preventivo (${formattaCentsItaliano(importoPreventivoCent, true)}).`,
      );
    }
  } else {
    const haPercentuali = scadenzeInput.every((s) => typeof s.percentuale === 'number');
    let sommaPerc = 0;
    for (let i = 0; i < numeroRate; i++) {
      const perc = haPercentuali ? scadenzeInput[i]!.percentuale! : 100 / numeroRate;
      if (perc <= 0 || perc > 100) {
        throw new RangeError(`Percentuale rata non valida: ${perc}%`);
      }
      percentualiPerRata.push(Number(perc.toFixed(2)));
      sommaPerc += perc;
    }
    if (haPercentuali && Math.abs(sommaPerc - 100) > 0.01) {
      throw new Error(
        `La somma delle percentuali del piano rate deve essere 100% (trovato ${sommaPerc.toFixed(2)}%).`,
      );
    }

    let sommaAssegnata = 0;
    for (let i = 0; i < numeroRate; i++) {
      if (i === numeroRate - 1) {
        importiTotaliPerRata.push(normalizzaCentesimi(importoPreventivoCent - sommaAssegnata));
      } else {
        const pesoInt = BigInt(Math.round(percentualiPerRata[i]! * 100));
        const quotaRata = dividiEArrotondaHalfUp(
          BigInt(importoPreventivoCent) * pesoInt,
          10_000n,
        );
        importiTotaliPerRata.push(quotaRata);
        sommaAssegnata = normalizzaCentesimi(sommaAssegnata + quotaRata);
      }
    }
  }

  // Mappa delle rate già emesse per preservare l'intestazione originaria in caso di subentro (RC-H4)
  const mappaRateGiaEmesse = new Map<string, RataEmessaStoricaInput>();
  if (input.rateGiaEmesse) {
    for (const re of input.rateGiaEmesse) {
      mappaRateGiaEmesse.set(`${re.numeroRata}__${re.unitaId}`, re);
    }
  }

  const rateTestata: RataTestataGenerata[] = [];
  const tutteRateDettaglio: RataDettaglioGenerata[] = [];

  for (let idx = 0; idx < numeroRate; idx++) {
    const scad = scadenzeInput[idx]!;
    const numeroRata = scad.numeroRata ?? idx + 1;
    const dataScadenza = validaDataIso(scad.dataScadenza, `scadenze[${idx}].dataScadenza`);
    const descrizioneRata = scad.descrizione?.trim() || `Rata ${numeroRata}/${numeroRate}`;
    const importoTotaleRataCent = importiTotaliPerRata[idx]!;

    const dettagliRata: RataDettaglioGenerata[] = [];
    let sommaQuoteUnitaCent = 0;
    let restoArrotondamentoCent = 0;
    let unitaArrotondamentoId: string | null = null;

    if (isSottoinsiemeSuTabellaTotale) {
      // Calcolo diretto su base totaleMillesimiAtteso (es. T13: Unità 1 da 50 e Unità 2 da 30 su 1000)
      const denomInt = BigInt(Math.round(totaleMillesimiAtteso * 1000));
      for (const u of input.unita) {
        const numInt = BigInt(importoTotaleRataCent) * BigInt(Math.round(u.millesimi * 1000));
        const quotaCent = dividiEArrotondaHalfUp(numInt, denomInt);
        sommaQuoteUnitaCent = normalizzaCentesimi(sommaQuoteUnitaCent + quotaCent);

        const storica = mappaRateGiaEmesse.get(`${numeroRata}__${u.unitaId}`);
        const soggettoRisolto = storica
          ? {
              soggettoId: storica.soggettoId,
              utenteId: storica.utenteId,
              chiaveDestinatario:
                storica.soggettoId ?? storica.utenteId ?? `SENZA_TITOLARE:${u.unitaId}`,
              intestazione:
                storica.intestazione ??
                `Soggetto ${storica.soggettoId ?? storica.utenteId ?? u.unitaId}`,
            }
          : risolviSoggettoPaganteUnita(u, dataScadenza, input.tipoGestione ?? 'ORDINARIA');

        const det: RataDettaglioGenerata = {
          numeroRata,
          unitaId: u.unitaId,
          interno: u.interno ?? u.unitaId,
          soggettoId: soggettoRisolto.soggettoId,
          utenteId: soggettoRisolto.utenteId,
          chiaveDestinatario: soggettoRisolto.chiaveDestinatario,
          intestazioneDestinatario: soggettoRisolto.intestazione,
          millesimi: u.millesimi,
          quotaCalcolataCent: quotaCent,
          restoArrotondamentoCent: 0,
          importoDovutoCent: storica ? normalizzaCentesimi(storica.importoDovutoCent) : quotaCent,
          importoDovutoEuro: centsToEuro(
            storica ? normalizzaCentesimi(storica.importoDovutoCent) : quotaCent,
          ),
          importoPagatoCent: 0,
          dataScadenza,
          dataEsigibilita: dataScadenza,
          statoRataModello: storica ? 'EMESSA' : 'PIANIFICATA',
          giaEmessaAlVenditore: Boolean(storica),
          versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
        };
        dettagliRata.push(det);
        tutteRateDettaglio.push(det);
      }
    } else {
      const esitoRiparto = ripartisciSpesa({
        importoCent: importoTotaleRataCent,
        quoteMillesimi: quoteMillesimiInput,
      });

      sommaQuoteUnitaCent = esitoRiparto.sommaQuoteFinaliCent;
      restoArrotondamentoCent = esitoRiparto.restoCent;
      unitaArrotondamentoId = esitoRiparto.unitaArrotondamentoId;

      for (let i = 0; i < input.unita.length; i++) {
        const u = input.unita[i]!;
        const quotaUnita = esitoRiparto.quote[i]!;
        const storica = mappaRateGiaEmesse.get(`${numeroRata}__${u.unitaId}`);
        const soggettoRisolto = storica
          ? {
              soggettoId: storica.soggettoId,
              utenteId: storica.utenteId,
              chiaveDestinatario:
                storica.soggettoId ?? storica.utenteId ?? `SENZA_TITOLARE:${u.unitaId}`,
              intestazione:
                storica.intestazione ??
                `Soggetto ${storica.soggettoId ?? storica.utenteId ?? u.unitaId}`,
            }
          : risolviSoggettoPaganteUnita(u, dataScadenza, input.tipoGestione ?? 'ORDINARIA');

        const importoDovutoCent = storica
          ? normalizzaCentesimi(storica.importoDovutoCent)
          : quotaUnita.quotaFinaleCent;

        const det: RataDettaglioGenerata = {
          numeroRata,
          unitaId: u.unitaId,
          interno: u.interno ?? u.unitaId,
          soggettoId: soggettoRisolto.soggettoId,
          utenteId: soggettoRisolto.utenteId,
          chiaveDestinatario: soggettoRisolto.chiaveDestinatario,
          intestazioneDestinatario: soggettoRisolto.intestazione,
          millesimi: u.millesimi,
          quotaCalcolataCent: quotaUnita.quotaCalcolataCent,
          restoArrotondamentoCent: quotaUnita.restoArrotondamentoCent,
          importoDovutoCent,
          importoDovutoEuro: centsToEuro(importoDovutoCent),
          importoPagatoCent: 0,
          dataScadenza,
          dataEsigibilita: dataScadenza,
          statoRataModello: storica ? 'EMESSA' : 'PIANIFICATA',
          giaEmessaAlVenditore: Boolean(storica),
          versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
        };
        dettagliRata.push(det);
        tutteRateDettaglio.push(det);
      }
    }

    rateTestata.push({
      numeroRata,
      descrizione: descrizioneRata,
      dataScadenza,
      percentualePreventivo: percentualiPerRata[idx]!,
      importoTotaleRataCent,
      importoTotaleRataEuro: centsToEuro(importoTotaleRataCent),
      sommaQuoteUnitaCent,
      restoArrotondamentoCent,
      unitaArrotondamentoId,
      emessaConOverride: validazionePreventivo.emessaConOverride,
      motivoOverride: validazionePreventivo.motivoOverride,
      deliberaOverride: validazionePreventivo.deliberaOverride,
      dettagli: dettagliRata,
    });
  }

  const bollettiniProposti = raggruppaRateInBollettini({
    rateDettaglio: tutteRateDettaglio,
    gestioneId: input.gestioneId ?? null,
    numeroProgressivoIniziale: input.numeroProgressivoInizialeBollettini ?? 1,
    anno: input.annoBollettini,
  });

  const avvisi: string[] = [];
  if (validazionePreventivo.avviso) {
    avvisi.push(validazionePreventivo.avviso);
  }

  return {
    importoPreventivoCent,
    importoPreventivoEuro: centsToEuro(importoPreventivoCent),
    statoPreventivo: validazionePreventivo.statoPreventivo,
    emessaConOverride: validazionePreventivo.emessaConOverride,
    motivoOverride: validazionePreventivo.motivoOverride,
    deliberaOverride: validazionePreventivo.deliberaOverride,
    validazionePreventivo,
    rateTestata,
    tutteRateDettaglio,
    bollettiniProposti,
    avvisi,
    eventoAuditOverride: validazionePreventivo.eventoAudit,
    versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 4. CONTROLLI PRE-EMISSIONE BLOCCANTI (RC-E3, RC-N2, T14) E WARNING (RC-N3)
// ============================================================================

export interface AnomaliaPreEmissione {
  codice: CodiceAnomaliaPreEmissione;
  livello: 'BLOCCANTE' | 'WARNING';
  bloccante: boolean;
  messaggio: string;
  unitaId?: string | null;
  bollettinoId?: string | null;
  gestioneId?: string | null;
}

export interface RigaControlloBollettinoInput {
  id?: string;
  unitaId: string;
  rataDettaglioId?: string | null;
  gestioneId?: string | null;
  descrizione?: string;
  importoCent: CentesimiInput;
  dataScadenza?: string;
}

export interface BollettinoPerControlloInput {
  id?: string;
  destinatarioUtenteId?: string | null;
  destinatarioSoggettoId?: string | null;
  intestazioneDestinatario?: string | null;
  totaleCent: CentesimiInput;
  dataScadenza?: string;
  righe: readonly RigaControlloBollettinoInput[];
}

export interface ControlliPreEmissioneInput {
  bollettino?: BollettinoPerControlloInput | null;
  bollettini?: readonly BollettinoPerControlloInput[];
  /** Totali attesi per gestione o per spesa/rata (`{ [gestioneId]: importoAttesoCent }`) per controllare la quadratura (RC-E3, RC-N2). */
  totaliAttesiPerGestione?: Readonly<Record<string, CentesimiInput>>;
  /** Importo totale atteso complessivo (se non diviso per gestione). */
  totaleAttesoComplessivoCent?: CentesimiInput;
  /** Somma delle quote calcolate (per verifica diretta `sommaQuote !== importoSpesa`, RC-N2). */
  sommaQuoteCalcolateCent?: CentesimiInput;
  /** Tabella millesimale utilizzata per verificare quadratura (T14, RC-N2) e stato approvazione (RC-A5, RC-E3, RC-N3). */
  tabellaMillesimale?: {
    id?: string;
    nome?: string;
    totaleAtteso?: number;
    statoApprovazione?: StatoApprovazioneTabella | Lowercase<StatoApprovazioneTabella> | string;
    quote?: readonly (number | QuotaMillesimiInput)[];
  } | null;
  /** Elenco di unità e relative titolarità alla data di riferimento per rilevare unità senza titolare o sovrapposizioni (RC-A9, RC-E3, RC-N2). */
  unitaConTitolarita?: ReadonlyArray<{
    unitaId: string;
    haTitolareAttivo?: boolean;
    titolarita?: readonly TitolaritaUnitaInput[];
  }>;
  dataRiferimentoTitolarita?: string;
  /** Stato del preventivo e relativo override (RC-D4, RC-N2, RC-N3, T16). */
  statoPreventivo?: StatoPreventivo | Lowercase<StatoPreventivo> | string;
  emessaConOverride?: boolean;
  motivoOverride?: string | null;
  deliberaOverride?: string | null;
  /** Verifica fondo speciale per gestione straordinaria (RC-J2, T7). */
  tipoGestione?: TipoGestioneEsercizio;
  importoLavoriStraordinariCent?: CentesimiInput | null;
  fondoSpecialeCostituito?: boolean;
  importoFondoSpecialeCent?: CentesimiInput | null;
  /** Controlli di warning non bloccanti su spese/movimenti collegati (RC-N3). */
  criterioPersonalizzatoSenzaAtto?: boolean;
  speseCollegate?: ReadonlyArray<{
    id: string;
    descrizione?: string;
    chiPaga?: CriterioChiPaga | string;
    attoDerogaTipo?: string | null;
    attoDerogaData?: string | null;
    docAllegatoId?: string | null;
    improntaFileGiustificativo?: string | null;
    dataMovimento?: string;
    dataRegistrazione?: string;
  }>;
}

export interface TotaleControlloGestione {
  gestioneId: string;
  sommaQuoteCent: Centesimi;
  totaleAttesoCent: Centesimi;
  differenzaCent: Centesimi;
  inQuadratura: boolean;
}

export interface RisultatoControlliPreEmissione {
  valido: boolean;
  controlliSuperati: boolean;
  emissioneConsentita: boolean;
  emissioneBloccata: boolean;
  statoConsigliato: 'VERIFICATO' | 'BOZZA';
  anomalieBloccanti: AnomaliaPreEmissione[];
  avvisiNonBloccanti: AnomaliaPreEmissione[];
  tutteAnomalie: AnomaliaPreEmissione[];
  totaliPerGestione: TotaleControlloGestione[];
}

/**
 * Esegue tutti i controlli pre-emissione bloccanti (RC-E3, RC-N2, T14) e i warning non bloccanti (RC-N3).
 *
 * Controlli che **bloccano** l'emissione (RC-E3, RC-N2):
 * 1. Somma delle quote diversa dalla spesa / dalla somma delle rate per gestione (`SOMMA_QUOTE_DIVERSA_DA_SPESA`, `SQUADRATURA_TOTALE_GESTIONE`, `SQUADRATURA_TOTALE_BOLLETTINO`);
 * 2. Tabella millesimale che non somma al totale atteso (`TABELLA_MILLESIMALE_NON_QUADRA`, T14);
 * 3. Unità senza titolare alla data di riferimento (`UNITA_SENZA_TITOLARE`);
 * 4. Titolarità sovrapposte o quote proprietari != 100% (`TITOLARITA_SOVRAPPOSIZIONE`, `QUOTE_PROPRIETARI_NON_100`);
 * 5. Unità duplicata in un bollettino per la stessa rata/scadenza (`UNITA_DUPLICATA_NEL_BOLLETTINO`);
 * 6. Quota negativa (`QUOTA_NEGATIVA`);
 * 7. Preventivo non approvato privo di override valido (`PREVENTIVO_NON_APPROVATO_SENZA_OVERRIDE`, T16);
 * 8. Lavori straordinari privi di fondo speciale deliberato (`FONDO_SPECIALE_MANCANTE`, T7).
 *
 * Controlli che **avvisano senza bloccare** (RC-N3):
 * 1. Tabella millesimale non approvata (`TABELLA_NON_APPROVATA`, RC-A5);
 * 2. Criterio personalizzato senza atto di riferimento (`CRITERIO_PERSONALIZZATO_SENZA_ATTO`);
 * 3. Spesa senza giustificativo (`SPESA_SENZA_GIUSTIFICATIVO`, RC-B3);
 * 4. Registrazione movimento oltre 30 giorni (`REGISTRAZIONE_OLTRE_30_GIORNI`, RC-B2);
 * 5. Rate emesse con override del preventivo non approvato (`RATE_EMESSE_CON_OVERRIDE_PREVENTIVO`, RC-D4, T16).
 */
export function eseguiControlliPreEmissione(
  input: ControlliPreEmissioneInput,
): RisultatoControlliPreEmissione {
  const anomalieBloccanti: AnomaliaPreEmissione[] = [];
  const avvisiNonBloccanti: AnomaliaPreEmissione[] = [];
  const totaliPerGestione: TotaleControlloGestione[] = [];

  const listaBollettini: BollettinoPerControlloInput[] = [];
  if (input.bollettino) {
    listaBollettini.push(input.bollettino);
  }
  if (input.bollettini) {
    listaBollettini.push(...input.bollettini);
  }

  // 1. Controllo Tabella Millesimale: quadratura (bloccante, RC-N2, T14) e stato approvazione (warning, RC-A5, RC-E3, RC-N3)
  if (input.tabellaMillesimale) {
    const tab = input.tabellaMillesimale;
    if (tab.quote && tab.quote.length > 0) {
      const esitoQuad = validaQuadraturaMillesimi(tab.quote, tab.totaleAtteso ?? 1000);
      if (!esitoQuad.valido) {
        anomalieBloccanti.push({
          codice: 'TABELLA_MILLESIMALE_NON_QUADRA',
          livello: 'BLOCCANTE',
          bloccante: true,
          messaggio:
            esitoQuad.errore ??
            `La tabella millesimale "${tab.nome ?? tab.id ?? ''}" non quadra (${esitoQuad.sommaMillesimi} su ${esitoQuad.totaleAtteso}).`,
        });
      }
    }
    const statoTab = (tab.statoApprovazione ?? 'APPROVATA').trim().toUpperCase();
    if (statoTab === 'BOZZA') {
      avvisiNonBloccanti.push({
        codice: 'TABELLA_NON_APPROVATA',
        livello: 'WARNING',
        bloccante: false,
        messaggio: `Attenzione: la tabella millesimale "${tab.nome ?? tab.id ?? 'selezionata'}" è in stato BOZZA (non ancora approvata in assemblea, RC-A5, RC-N3).`,
      });
    }
  }

  // 2. Controllo Preventivo e Override / Fondo speciale (RC-D4, RC-J2, RC-N3, T7, T16)
  if (
    input.statoPreventivo !== undefined ||
    input.tipoGestione !== undefined ||
    input.emessaConOverride !== undefined
  ) {
    const esitoPrev = validaEmissioneRateDaPreventivo({
      statoPreventivo: input.statoPreventivo ?? 'APPROVATO',
      tipoGestione: input.tipoGestione,
      importoLavoriStraordinariCent: input.importoLavoriStraordinariCent,
      fondoSpecialeCostituito: input.fondoSpecialeCostituito,
      importoFondoSpecialeCent: input.importoFondoSpecialeCent,
      emessaConOverride: input.emessaConOverride,
      motivoOverride: input.motivoOverride,
      deliberaOverride: input.deliberaOverride,
    });

    if (!esitoPrev.consentita) {
      anomalieBloccanti.push({
        codice:
          esitoPrev.codiceBlocco === 'FONDO_SPECIALE_MANCANTE'
            ? 'FONDO_SPECIALE_MANCANTE'
            : 'PREVENTIVO_NON_APPROVATO_SENZA_OVERRIDE',
        livello: 'BLOCCANTE',
        bloccante: true,
        messaggio:
          esitoPrev.errore ?? 'Emissione bloccata: preventivo non approvato senza override valido.',
      });
    } else if (esitoPrev.emessaConOverride && esitoPrev.avviso) {
      avvisiNonBloccanti.push({
        codice: 'RATE_EMESSE_CON_OVERRIDE_PREVENTIVO',
        livello: 'WARNING',
        bloccante: false,
        messaggio: esitoPrev.avviso,
      });
    }
  }

  // 3. Controllo dei singoli bollettini: righe vuote, quote negative, destinatario assente, unità duplicate e quadratura righe
  const sommeRighePerGestione = new Map<string, Centesimi>();
  let sommaRigheComplessivaCent = 0;

  for (const boll of listaBollettini) {
    const bollId = boll.id ?? null;
    const totaleBollCent = normalizzaCentesimi(boll.totaleCent);

    if (totaleBollCent < 0) {
      anomalieBloccanti.push({
        codice: 'QUOTA_NEGATIVA',
        livello: 'BLOCCANTE',
        bloccante: true,
        messaggio: `Il bollettino ${bollId ?? ''} presenta un totale negativo (${formattaCentsItaliano(totaleBollCent, true)}).`,
        bollettinoId: bollId,
      });
    }

    if (!boll.righe || boll.righe.length === 0) {
      anomalieBloccanti.push({
        codice: 'BOLLETTINO_SENZA_RIGHE',
        livello: 'BLOCCANTE',
        bloccante: true,
        messaggio: `Il bollettino ${bollId ?? ''} non contiene alcuna riga di addebito.`,
        bollettinoId: bollId,
      });
      continue;
    }

    const haDestinatario = Boolean(
      (boll.destinatarioUtenteId && boll.destinatarioUtenteId.trim()) ||
        (boll.destinatarioSoggettoId && boll.destinatarioSoggettoId.trim()),
    );

    if (!haDestinatario) {
      for (const r of boll.righe) {
        anomalieBloccanti.push({
          codice: 'UNITA_SENZA_TITOLARE',
          livello: 'BLOCCANTE',
          bloccante: true,
          messaggio: `L'unità "${r.unitaId}" non ha un soggetto/titolare pagante valido alla data di emissione (RC-E3, RC-N2).`,
          unitaId: r.unitaId,
          bollettinoId: bollId,
        });
      }
    }

    let sommaRigheBoll = 0;
    const chiaviUnitaViste = new Set<string>();

    for (const r of boll.righe) {
      const impRiga = normalizzaCentesimi(r.importoCent);
      if (impRiga < 0) {
        anomalieBloccanti.push({
          codice: 'QUOTA_NEGATIVA',
          livello: 'BLOCCANTE',
          bloccante: true,
          messaggio: `Quota negativa (${formattaCentsItaliano(impRiga, true)}) rilevata per l'unità "${r.unitaId}" nel bollettino ${bollId ?? ''} (RC-E3, RC-N2).`,
          unitaId: r.unitaId,
          bollettinoId: bollId,
          gestioneId: r.gestioneId ?? null,
        });
      }

      // Verifica unità duplicata nello stesso bollettino (stessa unità per stessa rata/gestione/scadenza, RC-E3, RC-N2)
      const chiaveDup = `${r.unitaId}__${r.rataDettaglioId ?? r.gestioneId ?? ''}__${r.dataScadenza ?? boll.dataScadenza ?? ''}`;
      if (chiaviUnitaViste.has(chiaveDup)) {
        anomalieBloccanti.push({
          codice: 'UNITA_DUPLICATA_NEL_BOLLETTINO',
          livello: 'BLOCCANTE',
          bloccante: true,
          messaggio: `L'unità "${r.unitaId}" compare duplicata nel bollettino ${bollId ?? ''} (RC-E3, RC-N2).`,
          unitaId: r.unitaId,
          bollettinoId: bollId,
          gestioneId: r.gestioneId ?? null,
        });
      }
      chiaviUnitaViste.add(chiaveDup);

      sommaRigheBoll = normalizzaCentesimi(sommaRigheBoll + impRiga);
      sommaRigheComplessivaCent = normalizzaCentesimi(sommaRigheComplessivaCent + impRiga);

      const gestKey = r.gestioneId ?? 'ORDINARIA';
      sommeRighePerGestione.set(
        gestKey,
        normalizzaCentesimi((sommeRighePerGestione.get(gestKey) ?? 0) + impRiga),
      );
    }

    if (sommaRigheBoll !== totaleBollCent) {
      anomalieBloccanti.push({
        codice: 'SQUADRATURA_TOTALE_BOLLETTINO',
        livello: 'BLOCCANTE',
        bloccante: true,
        messaggio: `La somma delle righe del bollettino (${formattaCentsItaliano(sommaRigheBoll, true)}) non coincide con il totale del bollettino (${formattaCentsItaliano(totaleBollCent, true)}).`,
        bollettinoId: bollId,
      });
    }
  }

  // 4. Controllo totali per gestione e somma quote vs spesa (RC-E3, RC-N2)
  if (input.totaliAttesiPerGestione) {
    for (const [gestioneId, attesoRaw] of Object.entries(input.totaliAttesiPerGestione)) {
      const totaleAttesoCent = normalizzaCentesimi(attesoRaw);
      const sommaQuoteCent = sommeRighePerGestione.get(gestioneId) ?? 0;
      const differenzaCent = normalizzaCentesimi(sommaQuoteCent - totaleAttesoCent);
      const inQuadratura = differenzaCent === 0;

      totaliPerGestione.push({
        gestioneId,
        sommaQuoteCent,
        totaleAttesoCent,
        differenzaCent,
        inQuadratura,
      });

      if (!inQuadratura) {
        anomalieBloccanti.push({
          codice: 'SQUADRATURA_TOTALE_GESTIONE',
          livello: 'BLOCCANTE',
          bloccante: true,
          messaggio: `La somma delle quote dei bollettini per la gestione "${gestioneId}" (${formattaCentsItaliano(sommaQuoteCent, true)}) non coincide con il totale delle rate (${formattaCentsItaliano(totaleAttesoCent, true)}, RC-E3, RC-N2).`,
          gestioneId,
        });
      }
    }
  }

  if (input.totaleAttesoComplessivoCent !== undefined) {
    const attesoTot = normalizzaCentesimi(input.totaleAttesoComplessivoCent);
    const calcolatoTot =
      input.sommaQuoteCalcolateCent !== undefined
        ? normalizzaCentesimi(input.sommaQuoteCalcolateCent)
        : sommaRigheComplessivaCent;

    if (calcolatoTot !== attesoTot) {
      anomalieBloccanti.push({
        codice: 'SOMMA_QUOTE_DIVERSA_DA_SPESA',
        livello: 'BLOCCANTE',
        bloccante: true,
        messaggio: `La somma delle quote (${formattaCentsItaliano(calcolatoTot, true)}) è diversa dall'importo atteso della spesa/rata (${formattaCentsItaliano(attesoTot, true)}, RC-N2).`,
      });
    }
  }

  // 5. Controllo titolarità unità: assenza titolare, sovrapposizione date o somma quote proprietari != 100% (RC-A9, RC-E3, RC-N2)
  if (input.unitaConTitolarita) {
    const dataRef = (input.dataRiferimentoTitolarita ?? '2026-01-01').trim().slice(0, 10);

    for (const u of input.unitaConTitolarita) {
      if (u.haTitolareAttivo === false) {
        anomalieBloccanti.push({
          codice: 'UNITA_SENZA_TITOLARE',
          livello: 'BLOCCANTE',
          bloccante: true,
          messaggio: `L'unità "${u.unitaId}" è priva di titolare attivo alla data ${dataRef} (RC-E3, RC-N2).`,
          unitaId: u.unitaId,
        });
        continue;
      }

      if (u.titolarita) {
        const attive = u.titolarita.filter((t) => {
          const inizio = t.dataInizio.trim().slice(0, 10);
          const fine = t.dataFine ? t.dataFine.trim().slice(0, 10) : null;
          return inizio <= dataRef && (fine === null || fine >= dataRef);
        });

        const proprietariAttivi = attive.filter((t) => {
          const ruolo =
            t.ruoloTitolarita ?? (t.tipoPossesso === 'INQUILINO' ? 'CONDUTTORE' : 'PROPRIETARIO');
          return (
            ruolo === 'PROPRIETARIO' ||
            ruolo === 'COMPROPRIETARIO' ||
            ruolo === 'NUDO_PROPRIETARIO'
          );
        });

        if (proprietariAttivi.length === 0) {
          anomalieBloccanti.push({
            codice: 'UNITA_SENZA_TITOLARE',
            livello: 'BLOCCANTE',
            bloccante: true,
            messaggio: `L'unità "${u.unitaId}" non ha alcun proprietario attivo alla data ${dataRef} (RC-E3, RC-N2).`,
            unitaId: u.unitaId,
          });
        } else {
          // Rileva sovrapposizione di più titolari con ruolo PROPRIETARIO a quota piena (100%)
          const proprietariQuotaPiena = proprietariAttivi.filter(
            (p) => (p.ruoloTitolarita ?? 'PROPRIETARIO') === 'PROPRIETARIO' && (p.quotaPossesso ?? 100) >= 100,
          );
          if (proprietariQuotaPiena.length > 1) {
            anomalieBloccanti.push({
              codice: 'TITOLARITA_SOVRAPPOSIZIONE',
              livello: 'BLOCCANTE',
              bloccante: true,
              messaggio: `Rilevate ${proprietariQuotaPiena.length} titolarità con quota piena sovrapposte sull'unità "${u.unitaId}" alla data ${dataRef} (RC-A9, RC-N2).`,
              unitaId: u.unitaId,
            });
          } else {
            const sommaQuoteProp = proprietariAttivi.reduce(
              (acc, p) => acc + (p.quotaPossesso ?? 100),
              0,
            );
            if (Math.abs(sommaQuoteProp - 100) > 0.01) {
              anomalieBloccanti.push({
                codice: 'QUOTE_PROPRIETARI_NON_100',
                livello: 'BLOCCANTE',
                bloccante: true,
                messaggio: `La somma delle quote di proprietà dell'unità "${u.unitaId}" alla data ${dataRef} è ${sommaQuoteProp.toFixed(2)}% anziché 100% (RC-A9, RC-N2).`,
                unitaId: u.unitaId,
              });
            }
          }
        }
      }
    }
  }

  // 6. Controlli di warning non bloccanti su spese/movimenti (RC-N3)
  if (input.criterioPersonalizzatoSenzaAtto) {
    avvisiNonBloccanti.push({
      codice: 'CRITERIO_PERSONALIZZATO_SENZA_ATTO',
      livello: 'WARNING',
      bloccante: false,
      messaggio:
        'Attenzione: ripartizione con criterio personalizzato priva di riferimento all’atto di deroga (regolamento contrattuale o delibera, RC-C6, RC-N3).',
    });
  }

  if (input.speseCollegate) {
    for (const sp of input.speseCollegate) {
      if (
        sp.chiPaga === 'PERSONALIZZATO' &&
        (!sp.attoDerogaTipo || !sp.attoDerogaData)
      ) {
        avvisiNonBloccanti.push({
          codice: 'CRITERIO_PERSONALIZZATO_SENZA_ATTO',
          livello: 'WARNING',
          bloccante: false,
          messaggio: `Attenzione: la spesa "${sp.descrizione ?? sp.id}" usa un criterio personalizzato senza atto e data di riferimento (RC-N3).`,
        });
      }

      if (sp.docAllegatoId !== undefined || sp.improntaFileGiustificativo !== undefined) {
        const esitoGiust = validaGiustificativoAllegato({
          docAllegatoId: sp.docAllegatoId,
          improntaFile: sp.improntaFileGiustificativo,
        });
        if (!esitoGiust.spesaCompleta) {
          avvisiNonBloccanti.push({
            codice: 'SPESA_SENZA_GIUSTIFICATIVO',
            livello: 'WARNING',
            bloccante: false,
            messaggio: `Attenzione: la spesa "${sp.descrizione ?? sp.id}" è priva di giustificativo allegato con impronta (RC-B3, RC-N3).`,
          });
        }
      }

      if (sp.dataMovimento && sp.dataRegistrazione) {
        const esitoRit = rilevaRitardoRegistrazione(sp.dataMovimento, sp.dataRegistrazione);
        if (esitoRit.inRitardo && esitoRit.messaggioAlert) {
          avvisiNonBloccanti.push({
            codice: 'REGISTRAZIONE_OLTRE_30_GIORNI',
            livello: 'WARNING',
            bloccante: false,
            messaggio: esitoRit.messaggioAlert,
          });
        }
      }
    }
  }

  const emissioneBloccata = anomalieBloccanti.length > 0;
  const emissioneConsentita = !emissioneBloccata;

  return {
    valido: emissioneConsentita,
    controlliSuperati: emissioneConsentita,
    emissioneConsentita,
    emissioneBloccata,
    statoConsigliato: emissioneConsentita ? 'VERIFICATO' : 'BOZZA',
    anomalieBloccanti,
    avvisiNonBloccanti,
    tutteAnomalie: [...anomalieBloccanti, ...avvisiNonBloccanti],
    totaliPerGestione,
  };
}

/** Alias di `eseguiControlliPreEmissione`. */
export const verificaAnomalieBollettino = eseguiControlliPreEmissione;

// ============================================================================
// 5. CICLO DI VITA IMMUTABILE DEL BOLLETTINO E RETTIFICA (RC-E2, RC-E3, RC-E4, T11)
// ============================================================================

export interface BollettinoRecordInput {
  id: string;
  condominio_id: string;
  esercizio_id: string;
  anno: number;
  numero_progressivo: number;
  destinatario_utente_id?: string | null;
  destinatario_soggetto_id?: string | null;
  intestazione_destinatario: string;
  totale_centesimi: CentesimiInput;
  importo_pagato_centesimi?: CentesimiInput;
  data_emissione?: string | null;
  data_scadenza: string;
  stato: StatoBollettino | string;
  sostituisce_id?: string | null;
  sostituito_da_id?: string | null;
  motivo_rettifica_annullamento?: string | null;
  anomalie_rilevate?: unknown;
  confermato_da?: string | null;
  confermato_at?: string | null;
  url_pdf?: string | null;
  iban_accredito?: string | null;
  causale_versamento?: string | null;
  versione?: number;
  versione_lock?: number;
  versione_motore_calcolo?: string;
  autore_id?: string | null;
}

const TRANSAZIONI_BOLLETTINO_AMMESSE: Readonly<Record<StatoBollettino, readonly StatoBollettino[]>> = {
  BOZZA: ['VERIFICATO', 'ANNULLATO'],
  VERIFICATO: ['BOZZA', 'EMESSO', 'ANNULLATO'],
  EMESSO: ['PARZIALMENTE_PAGATO', 'PAGATO', 'RETTIFICATO', 'ANNULLATO'],
  PARZIALMENTE_PAGATO: ['PAGATO', 'RETTIFICATO', 'ANNULLATO'],
  PAGATO: ['RETTIFICATO', 'ANNULLATO'],
  RETTIFICATO: [],
  ANNULLATO: [],
};

/**
 * Verifica se il passaggio di stato di un bollettino è ammesso dal ciclo di vita (RC-E2):
 * `BOZZA -> VERIFICATO -> EMESSO -> PARZIALMENTE_PAGATO / PAGATO`
 * e da `EMESSO` (o `PARZIALMENTE_PAGATO`/`PAGATO`) a `RETTIFICATO` o `ANNULLATO`.
 */
export function validaTransizioneStatoBollettino(
  statoCorrenteInput: string,
  statoNuovoInput: string,
): {
  valido: boolean;
  statoCorrente: StatoBollettino;
  statoNuovo: StatoBollettino;
  errore: string | null;
} {
  const statoCorrente = normalizzaStatoBollettino(statoCorrenteInput);
  const statoNuovo = normalizzaStatoBollettino(statoNuovoInput);
  const ammessi = TRANSAZIONI_BOLLETTINO_AMMESSE[statoCorrente] ?? [];

  if (ammessi.includes(statoNuovo)) {
    return { valido: true, statoCorrente, statoNuovo, errore: null };
  }

  return {
    valido: false,
    statoCorrente,
    statoNuovo,
    errore: `Transizione di stato bollettino non consentita: da "${statoCorrente}" a "${statoNuovo}" (RC-E2).`,
  };
}

const CAMPI_ECONOMICI_IMMUTABILI_BOLLETTINO = [
  'totale_centesimi',
  'totaleCent',
  'destinatario_utente_id',
  'destinatarioUtenteId',
  'destinatario_soggetto_id',
  'destinatarioSoggettoId',
  'intestazione_destinatario',
  'intestazioneDestinatario',
  'data_scadenza',
  'dataScadenza',
  'numero_progressivo',
  'numeroProgressivo',
  'anno',
  'righe',
] as const;

/**
 * Verifica la regola di immutabilità del bollettino emesso (RC-E2: "Un bollettino emesso non si modifica").
 * Qualsiasi tentativo di alterare importo, righe, destinatario o scadenza di un bollettino già emesso
 * solleva `ErroreBollettinoEmessoImmutabile`.
 */
export function validaModificaBollettino(
  bollettino: Pick<BollettinoRecordInput, 'id' | 'stato'> & Partial<BollettinoRecordInput>,
  patch: Record<string, unknown>,
): { ammessa: boolean; campiVietatiToccati: string[] } {
  const stato = normalizzaStatoBollettino(bollettino.stato);
  if (stato === 'BOZZA' || stato === 'VERIFICATO') {
    return { ammessa: true, campiVietatiToccati: [] };
  }

  const recordOrig = bollettino as Record<string, unknown>;
  const campiVietatiToccati: string[] = [];
  for (const campo of CAMPI_ECONOMICI_IMMUTABILI_BOLLETTINO) {
    if (campo in patch && patch[campo] !== undefined && patch[campo] !== recordOrig[campo]) {
      campiVietatiToccati.push(campo);
    }
  }

  return {
    ammessa: campiVietatiToccati.length === 0,
    campiVietatiToccati,
  };
}

/**
 * Solleva `ErroreBollettinoEmessoImmutabile` se si tenta di modificare un bollettino già emesso (RC-E2).
 */
export function assertModificaBollettinoConsentita(
  bollettino: Pick<BollettinoRecordInput, 'id' | 'stato'> & Partial<BollettinoRecordInput>,
  patch: Record<string, unknown>,
): void {
  const esito = validaModificaBollettino(bollettino, patch);
  if (!esito.ammessa) {
    throw new ErroreBollettinoEmessoImmutabile(
      bollettino.id ?? null,
      normalizzaStatoBollettino(bollettino.stato),
      esito.campiVietatiToccati,
    );
  }
}

export interface VerificaBollettinoInput {
  bollettino: BollettinoRecordInput;
  righe: readonly RigaControlloBollettinoInput[];
  contestoControlli?: Omit<ControlliPreEmissioneInput, 'bollettino'>;
}

export interface VerificaBollettinoOutput {
  bollettinoVerificato: BollettinoRecordInput & {
    stato: 'VERIFICATO';
    totale_centesimi: Centesimi;
    anomalie_rilevate: AnomaliaPreEmissione[];
  };
  esitoControlli: RisultatoControlliPreEmissione;
}

/**
 * Esegue i controlli pre-emissione sul bollettino in `BOZZA` e, se non ci sono anomalie bloccanti,
 * lo porta nello stato `VERIFICATO` (RC-E2, RC-E3).
 */
export function verificaBollettino(input: VerificaBollettinoInput): VerificaBollettinoOutput {
  const statoAttuale = normalizzaStatoBollettino(input.bollettino.stato);
  const trans = validaTransizioneStatoBollettino(statoAttuale, 'VERIFICATO');
  if (!trans.valido) {
    throw new ErroreTransizioneBollettinoNonValida(
      trans.errore ?? 'Il bollettino non può passare a VERIFICATO.',
      statoAttuale,
      'VERIFICATO',
    );
  }

  const esitoControlli = eseguiControlliPreEmissione({
    ...input.contestoControlli,
    bollettino: {
      id: input.bollettino.id,
      destinatarioUtenteId: input.bollettino.destinatario_utente_id,
      destinatarioSoggettoId: input.bollettino.destinatario_soggetto_id,
      intestazioneDestinatario: input.bollettino.intestazione_destinatario,
      totaleCent: input.bollettino.totale_centesimi,
      dataScadenza: input.bollettino.data_scadenza,
      righe: input.righe,
    },
  });

  if (!esitoControlli.controlliSuperati) {
    const dettagliErr = esitoControlli.anomalieBloccanti.map((a) => a.messaggio).join(' ');
    throw new ErroreControlliEmissioneBollettino(
      `Controlli pre-emissione non superati per il bollettino #${input.bollettino.numero_progressivo}: ${dettagliErr}`,
      esitoControlli.anomalieBloccanti,
    );
  }

  const totaleCent = normalizzaCentesimi(input.bollettino.totale_centesimi);

  return {
    bollettinoVerificato: {
      ...input.bollettino,
      totale_centesimi: totaleCent,
      stato: 'VERIFICATO',
      anomalie_rilevate: esitoControlli.avvisiNonBloccanti,
      versione_lock: (input.bollettino.versione_lock ?? 1) + 1,
    },
    esitoControlli,
  };
}

export interface EmettiBollettinoInput {
  bollettino: BollettinoRecordInput;
  /** L'emissione richiede una conferma esplicita dell'amministratore (RC-E3). */
  confermaEsplicitaAdmin: boolean;
  confermatoDa: string;
  dataEmissione?: string;
  confermatoAtIso?: string;
}

export interface EmettiBollettinoOutput {
  bollettinoEmesso: BollettinoRecordInput & {
    stato: 'EMESSO';
    totale_centesimi: Centesimi;
    importo_pagato_centesimi: Centesimi;
    data_emissione: string;
    confermato_da: string;
    confermato_at: string;
    versione_motore_calcolo: string;
  };
  statoRateCollegate: 'EMESSA';
  eventoAudit: EventoAuditContabile;
}

/**
 * Emette formalmente un bollettino già `VERIFICATO`, richiedendo la conferma esplicita dell'amministratore (RC-E2, RC-E3).
 * Le rate collegate passano da `PIANIFICATA` a `EMESSA` (Sezione 3).
 */
export function emettiBollettino(input: EmettiBollettinoInput): EmettiBollettinoOutput {
  const statoAttuale = normalizzaStatoBollettino(input.bollettino.stato);
  if (statoAttuale !== 'VERIFICATO') {
    throw new ErroreTransizioneBollettinoNonValida(
      `Il bollettino deve essere nello stato "VERIFICATO" prima dell'emissione (stato attuale: "${statoAttuale}", RC-E2).`,
      statoAttuale,
      'EMESSO',
    );
  }

  if (!input.confermaEsplicitaAdmin) {
    throw new Error(
      "L'emissione del bollettino richiede obbligatoriamente la conferma esplicita dell'amministratore (RC-E3).",
    );
  }

  const confermatoDa = input.confermatoDa?.trim() ?? '';
  if (!confermatoDa) {
    throw new Error(
      "L'emissione del bollettino richiede l'identificativo dell'amministratore che conferma (RC-E3, RC-M1).",
    );
  }

  const dataEmissione = validaDataIso(
    input.dataEmissione ?? new Date().toISOString().slice(0, 10),
    'dataEmissione',
  );
  const confermatoAt = input.confermatoAtIso ?? new Date().toISOString();
  const totaleCent = normalizzaCentesimi(input.bollettino.totale_centesimi);
  const pagatoCent = normalizzaCentesimi(input.bollettino.importo_pagato_centesimi ?? 0);

  const bollettinoEmesso: EmettiBollettinoOutput['bollettinoEmesso'] = {
    ...input.bollettino,
    totale_centesimi: totaleCent,
    importo_pagato_centesimi: pagatoCent,
    stato: 'EMESSO',
    data_emissione: dataEmissione,
    confermato_da: confermatoDa,
    confermato_at: confermatoAt,
    versione_lock: (input.bollettino.versione_lock ?? 1) + 1,
    versione_motore_calcolo:
      input.bollettino.versione_motore_calcolo ?? VERSIONE_MOTORE_CALCOLO,
  };

  const eventoAudit: EventoAuditContabile = {
    azione: 'EMISSIONE_BOLLETTINO',
    tabella: 'bollettini',
    recordId: bollettinoEmesso.id,
    condominioId: bollettinoEmesso.condominio_id,
    autoreId: confermatoDa,
    timestampIso: confermatoAt,
    motivo: `Emissione bollettino n. ${bollettinoEmesso.numero_progressivo}/${bollettinoEmesso.anno}`,
    valorePrima: {
      stato: statoAttuale,
      data_emissione: null,
      confermato_da: null,
    },
    valoreDopo: {
      stato: 'EMESSO',
      numero_progressivo: bollettinoEmesso.numero_progressivo,
      totale_centesimi: totaleCent,
      data_emissione: dataEmissione,
      confermato_da: confermatoDa,
    },
  };

  return {
    bollettinoEmesso,
    statoRateCollegate: 'EMESSA',
    eventoAudit,
  };
}

export interface RegistraIncassoSuBollettinoInput {
  bollettino: BollettinoRecordInput;
  importoIncassoCent: CentesimiInput;
}

export interface RegistraIncassoSuBollettinoOutput {
  bollettinoAggiornato: BollettinoRecordInput & {
    totale_centesimi: Centesimi;
    importo_pagato_centesimi: Centesimi;
    stato: 'PARZIALMENTE_PAGATO' | 'PAGATO';
  };
  importoPagatoPrecedenteCent: Centesimi;
  nuovoImportoPagatoCent: Centesimi;
  saldoResiduoCent: Centesimi;
  saldoResiduoEuro: number;
  creditoEccedenteCent: Centesimi;
  statoRataModello: 'PARZIALMENTE_PAGATA' | 'PAGATA';
}

/**
 * Applica un incasso (parziale, a saldo o eccedente) a un bollettino `EMESSO` o `PARZIALMENTE_PAGATO`,
 * aggiornandone lo stato in `PARZIALMENTE_PAGATO` o `PAGATO` e ricalcolando il saldo residuo (RC-E2, RC-F3).
 */
export function registraIncassoSuBollettino(
  input: RegistraIncassoSuBollettinoInput,
): RegistraIncassoSuBollettinoOutput {
  const statoAttuale = normalizzaStatoBollettino(input.bollettino.stato);
  if (statoAttuale !== 'EMESSO' && statoAttuale !== 'PARZIALMENTE_PAGATO') {
    throw new ErroreTransizioneBollettinoNonValida(
      `Impossibile registrare un incasso su un bollettino in stato "${statoAttuale}". Stati ammessi: EMESSO, PARZIALMENTE_PAGATO.`,
      statoAttuale,
      'PAGATO',
    );
  }

  const importoIncassoCent = normalizzaCentesimi(input.importoIncassoCent);
  if (importoIncassoCent <= 0) {
    throw new RangeError(
      `L'importo dell'incasso da imputare al bollettino deve essere positivo: ${importoIncassoCent}`,
    );
  }

  const totaleCent = normalizzaCentesimi(input.bollettino.totale_centesimi);
  const pagatoPrecCent = normalizzaCentesimi(input.bollettino.importo_pagato_centesimi ?? 0);
  const nuovoImportoPagatoCent = normalizzaCentesimi(pagatoPrecCent + importoIncassoCent);

  const saldoResiduoCent = Math.max(0, normalizzaCentesimi(totaleCent - nuovoImportoPagatoCent));
  const creditoEccedenteCent = Math.max(0, normalizzaCentesimi(nuovoImportoPagatoCent - totaleCent));

  const nuovoStato: 'PARZIALMENTE_PAGATO' | 'PAGATO' =
    nuovoImportoPagatoCent >= totaleCent ? 'PAGATO' : 'PARZIALMENTE_PAGATO';

  return {
    bollettinoAggiornato: {
      ...input.bollettino,
      totale_centesimi: totaleCent,
      importo_pagato_centesimi: nuovoImportoPagatoCent,
      stato: nuovoStato,
      versione_lock: (input.bollettino.versione_lock ?? 1) + 1,
    },
    importoPagatoPrecedenteCent: pagatoPrecCent,
    nuovoImportoPagatoCent,
    saldoResiduoCent,
    saldoResiduoEuro: centsToEuro(saldoResiduoCent),
    creditoEccedenteCent,
    statoRataModello: nuovoStato === 'PAGATO' ? 'PAGATA' : 'PARZIALMENTE_PAGATA',
  };
}

// ============================================================================
// 6. RETTIFICA DI BOLLETTINO EMESSO PER SOSTITUZIONE E TRASCINAMENTO INCASSI (RC-E4, T11)
// ============================================================================

export interface IncassoBollettinoInput {
  id: string;
  importoCent: CentesimiInput;
  dataValuta?: string;
  pagatoreNome?: string | null;
  riferimentoCro?: string | null;
  bollettinoId?: string | null;
}

export interface IncassoBollettinoTrasferito {
  id: string;
  importoCent: Centesimi;
  importoEuro: number;
  dataValuta: string | null;
  pagatoreNome: string | null;
  riferimentoCro: string | null;
  bollettinoPrecedenteId: string;
  bollettinoId: string;
}

export interface VoceStoricoVersioneBollettino {
  bollettinoId: string;
  numeroProgressivo: number;
  anno: number;
  versione: number;
  totaleCent: Centesimi;
  totaleEuro: number;
  importoPagatoCent: Centesimi;
  saldoResiduoCent: Centesimi;
  stato: StatoBollettino;
  sostituisceId: string | null;
  sostituitoDaId: string | null;
  emessoDa: string | null;
  dataEmissione: string | null;
  motivoRettificaAnnullamento: string | null;
}

export interface RettificaBollettinoEmessoInput {
  bollettinoOriginale: BollettinoRecordInput;
  /** ID del nuovo bollettino sostitutivo (se omesso viene generato deterministicamente). */
  nuovoBollettinoId?: string;
  /** Numero progressivo del nuovo bollettino (default: `bollettinoOriginale.numero_progressivo + 1`, es. da n. 12 a n. 13 in T11). */
  nuovoNumeroProgressivo?: number;
  /** Nuovo importo totale rettificato in centesimi (es. 23.000 cent = 230,00 € in T11). */
  nuovoTotaleCent?: CentesimiInput;
  /** Nuove righe del bollettino rettificato (se passate e `nuovoTotaleCent` è omesso, il totale è calcolato dalla somma delle righe). */
  nuoveRighe?: readonly RigaControlloBollettinoInput[];
  /** Motivo obbligatorio della rettifica/annullamento (RC-E4, RC-N5). */
  motivoRettifica: string;
  /** Elenco opzionale degli incassi già registrati sul bollettino originale da trasferire sul nuovo (RC-E4, T11). */
  incassiGiaRegistrati?: readonly IncassoBollettinoInput[];
  /** Importo già incassato sul bollettino originale (se non passato in `incassiGiaRegistrati`, usa `bollettinoOriginale.importo_pagato_centesimi`). */
  importoGiaIncassatoCent?: CentesimiInput;
  /** Stato da assegnare al bollettino originale sostituito (default `'ANNULLATO'` come richiesto da T11: "N. 12 annullato; n. 13 lo sostituisce", oppure `'RETTIFICATO'`). */
  statoOriginalePostRettifica?: 'ANNULLATO' | 'RETTIFICATO';
  nuovaDataScadenza?: string;
  dataEmissioneNuovo?: string;
  autoreId?: string | null;
  storicoPrecedente?: readonly VoceStoricoVersioneBollettino[];
  timestampIso?: string;
}

export interface RettificaBollettinoEmessoOutput {
  /** Il bollettino originale (es. N. 12 in T11), ora annullato e collegato in avanti a `nuovoBollettino.id`. */
  bollettinoOriginaleAnnullato: BollettinoRecordInput & {
    totale_centesimi: Centesimi;
    importo_pagato_centesimi: Centesimi;
    stato: 'ANNULLATO' | 'RETTIFICATO';
    sostituito_da_id: string;
    motivo_rettifica_annullamento: string;
  };
  /** Il nuovo bollettino sostitutivo (es. N. 13 in T11), collegato all'originale tramite `sostituisce_id` (`sostituisce`). */
  nuovoBollettino: BollettinoRecordInput & {
    totale_centesimi: Centesimi;
    importo_pagato_centesimi: Centesimi;
    saldo_residuo_centesimi: Centesimi;
    stato: 'EMESSO' | 'PARZIALMENTE_PAGATO' | 'PAGATO';
    sostituisce_id: string;
    /** Alias diretto del campo `sostituisce` previsto da RC-E4. */
    sostituisce: string;
    /** Numero progressivo del bollettino sostituito (es. 12 in T11). */
    sostituisceNumeroProgressivo: number;
    versione: number;
    versione_motore_calcolo: string;
  };
  nuoveRighe: RigaControlloBollettinoInput[];
  /** Importo complessivo degli incassi trascinati sul nuovo bollettino (es. 10.000 cent = 100,00 € in T11). */
  incassiTrascinatiCent: Centesimi;
  incassiTrascinatiEuro: number;
  /** Nuovo saldo residuo da pagare sul nuovo bollettino (es. 230,00 - 100,00 = 130,00 € = 13.000 cent in T11). */
  saldoResiduoCent: Centesimi;
  saldoResiduoEuro: number;
  /** Eventuale eccedenza a credito del soggetto se gli incassi pregressi superavano il nuovo importo rettificato. */
  creditoEccedenteCent: Centesimi;
  incassiTrasferiti: IncassoBollettinoTrasferito[];
  /** Storico completo di tutte le versioni del bollettino e di chi le ha emesse (RC-E4). */
  storicoVersioni: VoceStoricoVersioneBollettino[];
  eventoAudit: EventoAuditContabile;
}

/**
 * Esegue la rettifica immutabile di un bollettino già emesso (RC-E4, RC-N5, T11):
 * 1. Annulla il bollettino originale (es. N. 12 da 250,00 € -> `stato: 'ANNULLATO'`, `sostituito_da_id`);
 * 2. Crea un nuovo bollettino collegato (es. N. 13 da 230,00 € -> `sostituisce_id = N. 12`);
 * 3. Trascina automaticamente sul nuovo bollettino tutti gli incassi parziali già registrati (es. 100,00 €);
 * 4. Ricalcola il saldo residuo sul nuovo bollettino (es. 230,00 € - 100,00 € = 130,00 €) e il relativo stato;
 * 5. Preserva lo storico completo delle versioni e degli autori che le hanno emesse (RC-E4).
 */
export function rettificaBollettinoEmesso(
  input: RettificaBollettinoEmessoInput,
): RettificaBollettinoEmessoOutput {
  const orig = input.bollettinoOriginale;
  const statoOrig = normalizzaStatoBollettino(orig.stato);

  if (
    statoOrig !== 'EMESSO' &&
    statoOrig !== 'PARZIALMENTE_PAGATO' &&
    statoOrig !== 'PAGATO'
  ) {
    throw new ErroreTransizioneBollettinoNonValida(
      `Solo un bollettino già emesso può essere rettificato per sostituzione (stato attuale: "${statoOrig}", RC-E4).`,
      statoOrig,
      'RETTIFICATO',
    );
  }

  const motivo = input.motivoRettifica?.trim() ?? '';
  if (motivo.length < 3) {
    throw new Error(
      'La rettifica di un bollettino emesso richiede obbligatoriamente il motivo della rettifica (RC-E4, RC-N5).',
    );
  }

  const nuoveRighe: RigaControlloBollettinoInput[] = input.nuoveRighe
    ? input.nuoveRighe.map((r) => ({
        ...r,
        importoCent: normalizzaCentesimi(r.importoCent),
      }))
    : [];

  const sommaNuoveRigheCent = nuoveRighe.reduce(
    (acc, r) => normalizzaCentesimi(acc + normalizzaCentesimi(r.importoCent)),
    0,
  );

  const nuovoTotaleCent =
    input.nuovoTotaleCent !== undefined
      ? normalizzaCentesimi(input.nuovoTotaleCent)
      : sommaNuoveRigheCent;

  if (nuovoTotaleCent <= 0) {
    throw new RangeError(
      `Il nuovo importo totale del bollettino rettificato deve essere maggiore di zero: ${nuovoTotaleCent}`,
    );
  }

  if (nuoveRighe.length > 0 && sommaNuoveRigheCent !== nuovoTotaleCent) {
    throw new Error(
      `La somma delle nuove righe (${formattaCentsItaliano(sommaNuoveRigheCent, true)}) non coincide con il nuovo totale del bollettino (${formattaCentsItaliano(nuovoTotaleCent, true)}).`,
    );
  }

  const nuovoNumeroProgressivo =
    input.nuovoNumeroProgressivo ?? orig.numero_progressivo + 1;
  if (!Number.isSafeInteger(nuovoNumeroProgressivo) || nuovoNumeroProgressivo < 1) {
    throw new RangeError(
      `Numero progressivo del nuovo bollettino non valido: ${nuovoNumeroProgressivo}`,
    );
  }

  const nuovoBollettinoId =
    input.nuovoBollettinoId?.trim() || `${orig.id}-rett-${nuovoNumeroProgressivo}`;

  // Calcolo degli incassi trascinati sul nuovo bollettino (RC-E4, T11)
  let incassiTrascinatiCent: Centesimi;
  const incassiTrasferiti: IncassoBollettinoTrasferito[] = [];

  if (input.incassiGiaRegistrati && input.incassiGiaRegistrati.length > 0) {
    incassiTrascinatiCent = 0;
    for (const inc of input.incassiGiaRegistrati) {
      const impInc = normalizzaCentesimi(inc.importoCent);
      if (impInc < 0) {
        throw new RangeError(`Importo incasso negativo non valido: ${impInc}`);
      }
      incassiTrascinatiCent = normalizzaCentesimi(incassiTrascinatiCent + impInc);
      incassiTrasferiti.push({
        id: inc.id,
        importoCent: impInc,
        importoEuro: centsToEuro(impInc),
        dataValuta: inc.dataValuta ?? null,
        pagatoreNome: inc.pagatoreNome ?? null,
        riferimentoCro: inc.riferimentoCro ?? null,
        bollettinoPrecedenteId: orig.id,
        bollettinoId: nuovoBollettinoId,
      });
    }
  } else if (input.importoGiaIncassatoCent !== undefined) {
    incassiTrascinatiCent = normalizzaCentesimi(input.importoGiaIncassatoCent);
    if (incassiTrascinatiCent > 0) {
      incassiTrasferiti.push({
        id: `incasso-trascinato-${orig.id}`,
        importoCent: incassiTrascinatiCent,
        importoEuro: centsToEuro(incassiTrascinatiCent),
        dataValuta: orig.data_emissione ?? null,
        pagatoreNome: orig.intestazione_destinatario,
        riferimentoCro: null,
        bollettinoPrecedenteId: orig.id,
        bollettinoId: nuovoBollettinoId,
      });
    }
  } else {
    incassiTrascinatiCent = normalizzaCentesimi(orig.importo_pagato_centesimi ?? 0);
    if (incassiTrascinatiCent > 0) {
      incassiTrasferiti.push({
        id: `incasso-trascinato-${orig.id}`,
        importoCent: incassiTrascinatiCent,
        importoEuro: centsToEuro(incassiTrascinatiCent),
        dataValuta: orig.data_emissione ?? null,
        pagatoreNome: orig.intestazione_destinatario,
        riferimentoCro: null,
        bollettinoPrecedenteId: orig.id,
        bollettinoId: nuovoBollettinoId,
      });
    }
  }

  const saldoResiduoCent = Math.max(
    0,
    normalizzaCentesimi(nuovoTotaleCent - incassiTrascinatiCent),
  );
  const creditoEccedenteCent = Math.max(
    0,
    normalizzaCentesimi(incassiTrascinatiCent - nuovoTotaleCent),
  );

  const statoNuovoBollettino: 'EMESSO' | 'PARZIALMENTE_PAGATO' | 'PAGATO' =
    incassiTrascinatiCent <= 0
      ? 'EMESSO'
      : incassiTrascinatiCent >= nuovoTotaleCent
        ? 'PAGATO'
        : 'PARZIALMENTE_PAGATO';

  const statoOriginalePost = input.statoOriginalePostRettifica ?? 'ANNULLATO';
  const totaleOrigCent = normalizzaCentesimi(orig.totale_centesimi);
  const versioneOrig = orig.versione ?? 1;
  const nuovaVersione = versioneOrig + 1;
  const autoreNuovo = input.autoreId ?? orig.autore_id ?? orig.confermato_da ?? null;
  const dataEmissioneNuovo =
    input.dataEmissioneNuovo ?? orig.data_emissione ?? new Date().toISOString().slice(0, 10);
  const timestampIso = input.timestampIso ?? new Date().toISOString();

  // Il bollettino originale viene annullato e gli incassi passano sul nuovo (importo_pagato_centesimi su originale azzerato/trasferito o mantenuto come storico pre-rettifica)
  const bollettinoOriginaleAnnullato: RettificaBollettinoEmessoOutput['bollettinoOriginaleAnnullato'] = {
    ...orig,
    totale_centesimi: totaleOrigCent,
    importo_pagato_centesimi: 0,
    stato: statoOriginalePost,
    sostituito_da_id: nuovoBollettinoId,
    motivo_rettifica_annullamento: motivo,
    versione_lock: (orig.versione_lock ?? 1) + 1,
  };

  const nuovoBollettino: RettificaBollettinoEmessoOutput['nuovoBollettino'] = {
    id: nuovoBollettinoId,
    condominio_id: orig.condominio_id,
    esercizio_id: orig.esercizio_id,
    anno: orig.anno,
    numero_progressivo: nuovoNumeroProgressivo,
    destinatario_utente_id: orig.destinatario_utente_id ?? null,
    destinatario_soggetto_id: orig.destinatario_soggetto_id ?? null,
    intestazione_destinatario: orig.intestazione_destinatario,
    totale_centesimi: nuovoTotaleCent,
    importo_pagato_centesimi: incassiTrascinatiCent,
    saldo_residuo_centesimi: saldoResiduoCent,
    data_emissione: dataEmissioneNuovo,
    data_scadenza: input.nuovaDataScadenza ?? orig.data_scadenza,
    stato: statoNuovoBollettino,
    sostituisce_id: orig.id,
    sostituisce: orig.id,
    sostituisceNumeroProgressivo: orig.numero_progressivo,
    sostituito_da_id: null,
    motivo_rettifica_annullamento: motivo,
    anomalie_rilevate: [],
    confermato_da: autoreNuovo,
    confermato_at: timestampIso,
    url_pdf: null,
    iban_accredito: orig.iban_accredito ?? null,
    causale_versamento:
      orig.causale_versamento ??
      `Bollettino n. ${nuovoNumeroProgressivo}/${orig.anno} (sostituisce n. ${orig.numero_progressivo}/${orig.anno})`,
    versione: nuovaVersione,
    versione_lock: 1,
    versione_motore_calcolo: VERSIONE_MOTORE_CALCOLO,
    autore_id: autoreNuovo,
  };

  const voceOriginaleStorico: VoceStoricoVersioneBollettino = {
    bollettinoId: orig.id,
    numeroProgressivo: orig.numero_progressivo,
    anno: orig.anno,
    versione: versioneOrig,
    totaleCent: totaleOrigCent,
    totaleEuro: centsToEuro(totaleOrigCent),
    importoPagatoCent: 0,
    saldoResiduoCent: 0,
    stato: statoOriginalePost,
    sostituisceId: orig.sostituisce_id ?? null,
    sostituitoDaId: nuovoBollettinoId,
    emessoDa: orig.confermato_da ?? orig.autore_id ?? null,
    dataEmissione: orig.data_emissione ?? null,
    motivoRettificaAnnullamento: motivo,
  };

  const voceNuovaStorico: VoceStoricoVersioneBollettino = {
    bollettinoId: nuovoBollettinoId,
    numeroProgressivo: nuovoNumeroProgressivo,
    anno: orig.anno,
    versione: nuovaVersione,
    totaleCent: nuovoTotaleCent,
    totaleEuro: centsToEuro(nuovoTotaleCent),
    importoPagatoCent: incassiTrascinatiCent,
    saldoResiduoCent,
    stato: statoNuovoBollettino,
    sostituisceId: orig.id,
    sostituitoDaId: null,
    emessoDa: autoreNuovo,
    dataEmissione: dataEmissioneNuovo,
    motivoRettificaAnnullamento: motivo,
  };

  const storicoVersioni: VoceStoricoVersioneBollettino[] = [
    ...(input.storicoPrecedente ?? []),
    voceOriginaleStorico,
    voceNuovaStorico,
  ];

  const eventoAudit: EventoAuditContabile = {
    azione: 'RETTIFICA_BOLLETTINO_PER_SOSTITUZIONE',
    tabella: 'bollettini',
    recordId: nuovoBollettinoId,
    condominioId: orig.condominio_id,
    autoreId: autoreNuovo,
    timestampIso,
    motivo,
    valorePrima: {
      bollettino_originale_id: orig.id,
      numero_progressivo_originale: orig.numero_progressivo,
      totale_originale_centesimi: totaleOrigCent,
      importo_pagato_originale_centesimi: incassiTrascinatiCent,
      stato_originale: statoOrig,
    },
    valoreDopo: {
      bollettino_originale_stato: statoOriginalePost,
      nuovo_bollettino_id: nuovoBollettinoId,
      nuovo_numero_progressivo: nuovoNumeroProgressivo,
      sostituisce_id: orig.id,
      nuovo_totale_centesimi: nuovoTotaleCent,
      incassi_trascinati_centesimi: incassiTrascinatiCent,
      saldo_residuo_centesimi: saldoResiduoCent,
      nuovo_stato: statoNuovoBollettino,
    },
  };

  return {
    bollettinoOriginaleAnnullato,
    nuovoBollettino,
    nuoveRighe,
    incassiTrascinatiCent,
    incassiTrascinatiEuro: centsToEuro(incassiTrascinatiCent),
    saldoResiduoCent,
    saldoResiduoEuro: centsToEuro(saldoResiduoCent),
    creditoEccedenteCent,
    incassiTrasferiti,
    storicoVersioni,
    eventoAudit,
  };
}

/**
 * Individua i bollettini impattati da una variazione di importo o dalla correzione di un errore di calcolo
 * scoperto dopo l'emissione, restituendo l'elenco dei destinatari da avvisare (RC-N4, RC-N5).
 */
export function individuaBollettiniImpattatiDaRicalcolo(
  bollettiniEmessi: ReadonlyArray<{
    id: string;
    numero_progressivo: number;
    destinatario_utente_id?: string | null;
    destinatario_soggetto_id?: string | null;
    intestazione_destinatario: string;
    totale_centesimi: CentesimiInput;
    versione_motore_calcolo?: string;
    nuovoTotaleRicalcolatoCent: CentesimiInput;
  }>,
): Array<{
  bollettinoId: string;
  numeroProgressivo: number;
  destinatarioUtenteId: string | null;
  destinatarioSoggettoId: string | null;
  intestazioneDestinatario: string;
  totaleEmessoCent: Centesimi;
  nuovoTotaleRicalcolatoCent: Centesimi;
  differenzaCent: Centesimi;
  richiedeRettifica: boolean;
  richiedeRettificaSostitutiva: boolean;
}> {
  const impattati = [];
  for (const b of bollettiniEmessi) {
    const emessoCent = normalizzaCentesimi(b.totale_centesimi);
    const ricalcolatoCent = normalizzaCentesimi(b.nuovoTotaleRicalcolatoCent);
    const differenzaCent = normalizzaCentesimi(ricalcolatoCent - emessoCent);
    if (differenzaCent !== 0) {
      impattati.push({
        bollettinoId: b.id,
        numeroProgressivo: b.numero_progressivo,
        destinatarioUtenteId: b.destinatario_utente_id ?? null,
        destinatarioSoggettoId: b.destinatario_soggetto_id ?? null,
        intestazioneDestinatario: b.intestazione_destinatario,
        totaleEmessoCent: emessoCent,
        nuovoTotaleRicalcolatoCent: ricalcolatoCent,
        differenzaCent,
        richiedeRettifica: true,
        richiedeRettificaSostitutiva: true,
      });
    }
  }
  return impattati;
}
