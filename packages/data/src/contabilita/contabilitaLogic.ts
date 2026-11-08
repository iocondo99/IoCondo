/**
 * Motore di calcolo contabile puro a zero dipendenze esterne (Sezione 10 dei requisiti contabili).
 *
 * Principi fondamentali:
 * - Nessun decimale in virgola mobile per gli importi: ogni valore monetario è rappresentato in centesimi interi (`Centesimi`).
 * - Calcolo razionale esatto tramite aritmetica intera (`BigInt`) senza arrotondamenti intermedi.
 * - Arrotondamento unico al centesimo per eccesso da 0,5 (half-up).
 * - Gestione deterministica del resto: assegnato all'unità/periodo con peso maggiore (a parità, al primo per ordine di inserimento)
 *   ed esposto come riga esplicita `"arrotondamento"` nel prospetto (T1, T2, T3, T8, T9).
 * - Nessuna dipendenza da React, Expo, `Intl` o Supabase: identico comportamento su Web, Android, iOS e Node.js.
 */

export const VERSIONE_MOTORE_CALCOLO = '1.0.0';

/**
 * Rappresentazione monetaria in centesimi interi sicuri (es. 1000000 = 10.000,00 €).
 */
export type Centesimi = number;

/** Input monetario accettato dalle funzioni del motore (numero intero sicuro o `bigint`). */
export type CentesimiInput = Centesimi | bigint;

/** Fattore di scala per i millesimi (fino a 3 cifre decimali: 1000,000 ‰ = 1_000_000 millesimi-interi). */
const SCALA_MILLESIMI = 1_000n;
const SCALA_MILLESIMI_NUM = 1_000;

// ============================================================================
// 1. RAPPRESENTAZIONE MONETARIA, CONVERSIONE E FORMATTAZIONE ITALIANA
// ============================================================================

/**
 * Verifica e normalizza un valore in centesimi interi (`Centesimi`).
 * Solleva un errore se il valore non è un intero sicuro o contiene decimali.
 */
export function normalizzaCentesimi(valore: CentesimiInput): Centesimi {
  if (typeof valore === 'bigint') {
    const num = Number(valore);
    if (!Number.isSafeInteger(num)) {
      throw new RangeError(`Importo in centesimi fuori dal range degli interi sicuri: ${valore.toString()}`);
    }
    return num;
  }
  if (typeof valore !== 'number' || !Number.isFinite(valore) || !Number.isSafeInteger(valore)) {
    throw new TypeError(`Importo in centesimi non valido (atteso intero sicuro): ${String(valore)}`);
  }
  return Object.is(valore, -0) ? 0 : valore;
}

/**
 * Converte un importo in Euro (numero o stringa anche in formato italiano, es. `"10.000,00 €"`, `"100,01"`, `100.01`)
 * in centesimi interi (`Centesimi`) senza errori di virgola mobile.
 */
export function euroToCents(euro: number | string | bigint): Centesimi {
  if (typeof euro === 'bigint') {
    return normalizzaCentesimi(euro * 100n);
  }

  if (typeof euro === 'number') {
    if (!Number.isFinite(euro)) {
      throw new TypeError(`Importo in euro non valido: ${String(euro)}`);
    }
    const cents = Math.round(euro * 100);
    return normalizzaCentesimi(cents);
  }

  if (typeof euro !== 'string') {
    throw new TypeError(`Tipo importo non supportato: ${typeof euro}`);
  }

  const pulito = euro.replace(/[€\s\u00A0]/g, '').trim();
  if (!pulito) {
    throw new TypeError('Stringa importo in euro vuota.');
  }

  const negativo = pulito.startsWith('-');
  const senzaSegno = pulito.replace(/^[+-]/, '');
  if (!senzaSegno) {
    throw new TypeError(`Formato importo in euro non valido: "${euro}"`);
  }

  let normalizzato = senzaSegno;
  if (senzaSegno.includes('.') && senzaSegno.includes(',')) {
    if (senzaSegno.lastIndexOf('.') < senzaSegno.lastIndexOf(',')) {
      // Formato italiano: 10.000,01 -> 10000.01
      normalizzato = senzaSegno.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosassone: 10,000.01 -> 10000.01
      normalizzato = senzaSegno.replace(/,/g, '');
    }
  } else if (senzaSegno.includes(',')) {
    // Virgola come separatore decimale: 100,01 -> 100.01
    normalizzato = senzaSegno.replace(',', '.');
  } else if (senzaSegno.includes('.')) {
    // Se ci sono più punti (es. 1.000.000), sono separatori delle migliaia
    const partiPunto = senzaSegno.split('.');
    if (partiPunto.length > 2) {
      normalizzato = partiPunto.join('');
    }
  }

  if (!/^\d+(\.\d+)?$/.test(normalizzato)) {
    throw new TypeError(`Formato importo in euro non valido: "${euro}"`);
  }

  const [parteInteraStr = '0', parteDecimaleStr = ''] = normalizzato.split('.');
  const euroInteri = BigInt(parteInteraStr) * 100n;

  // Gestione esatta dei decimali con arrotondamento half-up alla seconda cifra decimale
  const decPadded = (parteDecimaleStr + '000').slice(0, 3);
  const primiDueDecimali = BigInt(decPadded.slice(0, 2));
  const terzoDecimale = Number(decPadded[2] ?? '0');
  const centesimiDecimali = primiDueDecimali + (terzoDecimale >= 5 ? 1n : 0n);

  const totaleBig = euroInteri + centesimiDecimali;
  const firmatoBig = negativo ? -totaleBig : totaleBig;
  return normalizzaCentesimi(firmatoBig);
}

/**
 * Formatta un importo in centesimi secondo lo standard italiano (es. `"10.000,00 €"` o `"10.000,00"`),
 * senza dipendere da `Intl` per garantire determinismo su ogni runtime.
 */
export function formattaCentsItaliano(cents: CentesimiInput, conSimbolo: boolean = false): string {
  const valore = normalizzaCentesimi(cents);
  const negativo = valore < 0;
  const ass = Math.abs(valore);
  const euroInteri = Math.floor(ass / 100);
  const centesimi = ass % 100;

  const interoFormattato = String(euroInteri).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decFormattati = String(centesimi).padStart(2, '0');
  const base = `${negativo ? '-' : ''}${interoFormattato},${decFormattati}`;
  return conSimbolo ? `${base} €` : base;
}

/**
 * Converte i centesimi in Euro.
 * - `centsToEuro(85000)` -> `850` (valore numerico in Euro)
 * - `centsToEuro(85000, true)` -> `"850,00"` (stringa formattata in italiano)
 * - `centsToEuro(85000, { formatoItaliano: true, conSimbolo: true })` -> `"850,00 €"`
 */
export function centsToEuro(cents: CentesimiInput): number;
export function centsToEuro(cents: CentesimiInput, formatoItaliano: true, conSimbolo?: boolean): string;
export function centsToEuro(cents: CentesimiInput, formatoItaliano: false): number;
export function centsToEuro(
  cents: CentesimiInput,
  opzioni: { formatoItaliano: true; conSimbolo?: boolean },
): string;
export function centsToEuro(
  cents: CentesimiInput,
  opzioni?: boolean | { formatoItaliano?: boolean; conSimbolo?: boolean },
  conSimbolo: boolean = false,
): number | string {
  const valore = normalizzaCentesimi(cents);
  if (opzioni === true) {
    return formattaCentsItaliano(valore, conSimbolo);
  }
  if (typeof opzioni === 'object' && opzioni !== null && opzioni.formatoItaliano) {
    return formattaCentsItaliano(valore, opzioni.conSimbolo ?? false);
  }
  return valore / 100;
}

// ============================================================================
// FUNZIONI RAZIONALI INTERNE (ARITMETICA ESATTA E ARROTONDAMENTO HALF-UP)
// ============================================================================

/**
 * Converte un numero decimale (fino a 3 decimali, es. millesimi o metri cubi)
 * in intero scalato per 1000 (`BigInt`) senza errori di virgola mobile.
 */
function toMillesimiInt(valore: number, nomeCampo: string): bigint {
  if (typeof valore !== 'number' || !Number.isFinite(valore) || valore < 0) {
    throw new RangeError(`Valore non valido per ${nomeCampo}: ${String(valore)}`);
  }
  const scalato = Math.round(valore * SCALA_MILLESIMI_NUM);
  return BigInt(scalato);
}

/**
 * Divisione razionale esatta `numeratore / denominatore` con arrotondamento al centesimo
 * per eccesso da 0,5 (half-up).
 *
 * Per valori non negativi: `floor((2 * N + D) / (2 * D))`.
 */
export function dividiEArrotondaHalfUp(numeratore: bigint, denominatore: bigint): Centesimi {
  if (denominatore <= 0n) {
    throw new RangeError('Il denominatore deve essere strettamente positivo.');
  }
  if (numeratore === 0n) {
    return 0;
  }
  const negativo = numeratore < 0n;
  const numAss = negativo ? -numeratore : numeratore;
  const quozienteArrotondato = (2n * numAss + denominatore) / (2n * denominatore);
  return normalizzaCentesimi(negativo ? -quozienteArrotondato : quozienteArrotondato);
}

/**
 * Trova l'indice dell'elemento a cui assegnare il resto dell'arrotondamento:
 * - Unità/periodo con il peso (millesimi, giorni o consumo) maggiore;
 * - A parità di peso massimo, il primo elemento per ordine di inserimento.
 */
function trovaIndiceDestinatarioResto(pesi: readonly bigint[]): number {
  let indiceMax = 0;
  let pesoMax = pesi[0] ?? 0n;

  for (let i = 1; i < pesi.length; i++) {
    const pesoCorrente = pesi[i] ?? 0n;
    // Uso `>` stretto: a parità di valore vince il primo per ordine di inserimento
    if (pesoCorrente > pesoMax) {
      pesoMax = pesoCorrente;
      indiceMax = i;
    }
  }
  return indiceMax;
}

// ============================================================================
// 2. VALIDAZIONE QUADRATURA MILLESIMI (T14)
// ============================================================================

export interface QuotaMillesimiInput {
  unitaId: string;
  /** Valore millesimale dell'unità (fino a 3 decimali, es. 85 o 333.333). */
  millesimi?: number;
  /** Alias opzionale per compatibilità con i servizi struttura/DB. */
  valoreMillesimale?: number;
  /** Alias opzionale per valore tabella. */
  valore?: number;
}

export interface RisultatoQuadraturaMillesimi {
  valido: boolean;
  isQuadrata: boolean;
  emissioneBloccata: boolean;
  sommaMillesimi: number;
  totaleAtteso: number;
  differenza: number;
  errore: string | null;
}

export class ErroreQuadraturaMillesimi extends Error {
  readonly sommaMillesimi: number;
  readonly totaleAtteso: number;
  readonly differenza: number;
  readonly emissioneBloccata = true;

  constructor(messaggio: string, sommaMillesimi: number, totaleAtteso: number, differenza: number) {
    super(messaggio);
    this.name = 'ErroreQuadraturaMillesimi';
    this.sommaMillesimi = sommaMillesimi;
    this.totaleAtteso = totaleAtteso;
    this.differenza = differenza;
  }
}

function estraiValoreMillesimi(item: number | QuotaMillesimiInput): number {
  if (typeof item === 'number') {
    return item;
  }
  const val = item.millesimi ?? item.valoreMillesimale ?? item.valore;
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new TypeError(`Valore millesimale mancante o non valido per l'unità "${item.unitaId}".`);
  }
  return val;
}

/**
 * Verifica che la somma delle quote di una tabella millesimale coincida con il totale atteso (default 1000).
 * Blocca l'emissione e segnala l'errore se la somma non quadra (es. somma 998 su 1000 -> T14).
 */
export function validaQuadraturaMillesimi(
  quote: ReadonlyArray<number | QuotaMillesimiInput>,
  totaleAtteso: number = 1000,
): RisultatoQuadraturaMillesimi {
  if (!Number.isFinite(totaleAtteso) || totaleAtteso <= 0) {
    throw new RangeError(`Il totale atteso della tabella millesimale deve essere positivo: ${String(totaleAtteso)}`);
  }

  if (!quote || quote.length === 0) {
    return {
      valido: false,
      isQuadrata: false,
      emissioneBloccata: true,
      sommaMillesimi: 0,
      totaleAtteso,
      differenza: -totaleAtteso,
      errore: `Tabella millesimale vuota: somma 0 su ${totaleAtteso} attesi. Emissione bloccata.`,
    };
  }

  let sommaInt = 0n;
  for (let i = 0; i < quote.length; i++) {
    const val = estraiValoreMillesimi(quote[i]!);
    if (val < 0) {
      return {
        valido: false,
        isQuadrata: false,
        emissioneBloccata: true,
        sommaMillesimi: Number(sommaInt) / SCALA_MILLESIMI_NUM,
        totaleAtteso,
        differenza: 0,
        errore: `Valore millesimale negativo non consentito (${val}). Emissione bloccata.`,
      };
    }
    sommaInt += toMillesimiInt(val, `quote[${i}]`);
  }

  const attesoInt = toMillesimiInt(totaleAtteso, 'totaleAtteso');
  const diffInt = sommaInt - attesoInt;
  const sommaMillesimi = Number(sommaInt) / SCALA_MILLESIMI_NUM;
  const differenza = Number(diffInt) / SCALA_MILLESIMI_NUM;
  const isQuadrata = diffInt === 0n;

  if (!isQuadrata) {
    return {
      valido: false,
      isQuadrata: false,
      emissioneBloccata: true,
      sommaMillesimi,
      totaleAtteso,
      differenza,
      errore: `La tabella millesimale non quadra: somma ${sommaMillesimi} su ${totaleAtteso} attesi (differenza ${differenza > 0 ? `+${differenza}` : differenza}). Emissione bloccata.`,
    };
  }

  return {
    valido: true,
    isQuadrata: true,
    emissioneBloccata: false,
    sommaMillesimi,
    totaleAtteso,
    differenza: 0,
    errore: null,
  };
}

/**
 * Versione assertiva di `validaQuadraturaMillesimi`: solleva `ErroreQuadraturaMillesimi` se la tabella non quadra.
 */
export function assertQuadraturaMillesimi(
  quote: ReadonlyArray<number | QuotaMillesimiInput>,
  totaleAtteso: number = 1000,
): RisultatoQuadraturaMillesimi {
  const esito = validaQuadraturaMillesimi(quote, totaleAtteso);
  if (!esito.valido) {
    throw new ErroreQuadraturaMillesimi(
      esito.errore ?? 'Tabella millesimale non quadrata.',
      esito.sommaMillesimi,
      esito.totaleAtteso,
      esito.differenza,
    );
  }
  return esito;
}

// ============================================================================
// 3. RIPARTIZIONE SPESA PER MILLESIMI (T1, T2, T3)
// ============================================================================

export interface RigaArrotondamentoProspetto {
  tipo: 'arrotondamento';
  descrizione: 'arrotondamento';
  unitaId: string;
  importoCent: Centesimi;
  importoEuro: number;
}

export interface QuotaRipartizioneUnita {
  unitaId: string;
  millesimi: number;
  /** Quota arrotondata al centesimo prima dell'applicazione del resto. */
  quotaCalcolataCent: Centesimi;
  /** Resto di arrotondamento assegnato a questa unità (diverso da 0 solo per l'unità destinataria del resto). */
  restoArrotondamentoCent: Centesimi;
  /** Quota finale dovuta dall'unità (`quotaCalcolataCent + restoArrotondamentoCent`). */
  quotaFinaleCent: Centesimi;
  /** Alias di `quotaFinaleCent`. */
  importoCent: Centesimi;
  /** Valore in Euro della quota finale (`centsToEuro(quotaFinaleCent)`). */
  quotaFinaleEuro: number;
}

export interface RigaProspettoRiparto {
  tipo: 'quota_unita' | 'arrotondamento';
  descrizione: string;
  unitaId: string;
  importoCent: Centesimi;
  importoEuro: number;
}

export interface RipartisciSpesaInput {
  importoCent: CentesimiInput;
  quoteMillesimi: readonly QuotaMillesimiInput[];
  /** Se `true`, verifica preventivamente che la somma dei millesimi coincida con `totaleAttesoMillesimi`. */
  richiediQuadratura?: boolean;
  totaleAttesoMillesimi?: number;
}

export interface RisultatoRipartizioneSpesa {
  importoTotaleCent: Centesimi;
  sommaMillesimi: number;
  quote: QuotaRipartizioneUnita[];
  sommaQuoteCalcolateCent: Centesimi;
  sommaQuoteFinaliCent: Centesimi;
  /** Resto complessivo (`importoTotaleCent - sommaQuoteCalcolateCent`). Può essere positivo, negativo o 0. */
  restoCent: Centesimi;
  /** ID dell'unità a cui è stato attribuito il resto (o `null` se `restoCent === 0`). */
  unitaArrotondamentoId: string | null;
  /** Riga esplicita `"arrotondamento"` per il prospetto contabile (presente quando `restoCent !== 0`). */
  rigaArrotondamento: RigaArrotondamentoProspetto | null;
  /** Prospetto completo comprensivo delle quote calcolate e dell'eventuale riga `"arrotondamento"`. */
  righeProspetto: RigaProspettoRiparto[];
  versioneMotore: string;
}

/**
 * Ripartisce una spesa in centesimi tra le unità partecipanti in proporzione ai rispettivi millesimi (T1, T2, T3).
 *
 * Regole applicate (Sezione 10):
 * 1. `Quota = importo * valore_unita / somma_valori_partecipanti`, arrotondata una sola volta al centesimo (per eccesso da 0,5).
 * 2. `Resto = importo - somma(quote_arrotondate)`.
 * 3. Il resto (positivo o negativo) va all'unità con il valore millesimale maggiore; a parità, alla prima per ordine di inserimento,
 *    e compare nel prospetto come riga `"arrotondamento"`.
 */
export function ripartisciSpesa(input: RipartisciSpesaInput): RisultatoRipartizioneSpesa {
  const importoTotaleCent = normalizzaCentesimi(input.importoCent);
  if (importoTotaleCent < 0) {
    throw new RangeError(`L'importo della spesa non può essere negativo: ${importoTotaleCent}`);
  }

  const { quoteMillesimi, richiediQuadratura = false, totaleAttesoMillesimi = 1000 } = input;
  if (!quoteMillesimi || quoteMillesimi.length === 0) {
    throw new RangeError('Impossibile ripartire la spesa: nessuna unità partecipante fornita.');
  }

  if (richiediQuadratura) {
    assertQuadraturaMillesimi(quoteMillesimi, totaleAttesoMillesimi);
  }

  const pesiMillesimiInt: bigint[] = [];
  const valoriMillesimiNum: number[] = [];
  let sommaMillesimiInt = 0n;

  for (let i = 0; i < quoteMillesimi.length; i++) {
    const q = quoteMillesimi[i]!;
    const val = estraiValoreMillesimi(q);
    const pesoInt = toMillesimiInt(val, `quoteMillesimi[${i}].millesimi`);
    pesiMillesimiInt.push(pesoInt);
    valoriMillesimiNum.push(Number(pesoInt) / SCALA_MILLESIMI_NUM);
    sommaMillesimiInt += pesoInt;
  }

  if (sommaMillesimiInt <= 0n) {
    throw new RangeError('La somma dei millesimi delle unità partecipanti deve essere maggiore di zero.');
  }

  const importoBig = BigInt(importoTotaleCent);
  const quoteCalcolate: Centesimi[] = [];
  let sommaQuoteCalcolateCent = 0;

  for (let i = 0; i < quoteMillesimi.length; i++) {
    const numeratore = importoBig * pesiMillesimiInt[i]!;
    const quotaArrotondata = dividiEArrotondaHalfUp(numeratore, sommaMillesimiInt);
    quoteCalcolate.push(quotaArrotondata);
    sommaQuoteCalcolateCent += quotaArrotondata;
  }

  const restoCent = normalizzaCentesimi(importoTotaleCent - sommaQuoteCalcolateCent);
  const indiceResto = trovaIndiceDestinatarioResto(pesiMillesimiInt);
  const unitaArrotondamentoId = restoCent !== 0 ? quoteMillesimi[indiceResto]!.unitaId : null;

  const quote: QuotaRipartizioneUnita[] = [];
  const righeProspetto: RigaProspettoRiparto[] = [];
  let sommaQuoteFinaliCent = 0;

  for (let i = 0; i < quoteMillesimi.length; i++) {
    const unitaId = quoteMillesimi[i]!.unitaId;
    const millesimi = valoriMillesimiNum[i]!;
    const quotaCalcolataCent = quoteCalcolate[i]!;
    const restoUnita = i === indiceResto ? restoCent : 0;
    const quotaFinaleCent = normalizzaCentesimi(quotaCalcolataCent + restoUnita);
    sommaQuoteFinaliCent += quotaFinaleCent;

    quote.push({
      unitaId,
      millesimi,
      quotaCalcolataCent,
      restoArrotondamentoCent: restoUnita,
      quotaFinaleCent,
      importoCent: quotaFinaleCent,
      quotaFinaleEuro: centsToEuro(quotaFinaleCent),
    });

    righeProspetto.push({
      tipo: 'quota_unita',
      descrizione: `Quota unità ${unitaId}`,
      unitaId,
      importoCent: quotaCalcolataCent,
      importoEuro: centsToEuro(quotaCalcolataCent),
    });
  }

  let rigaArrotondamento: RigaArrotondamentoProspetto | null = null;
  if (restoCent !== 0 && unitaArrotondamentoId !== null) {
    rigaArrotondamento = {
      tipo: 'arrotondamento',
      descrizione: 'arrotondamento',
      unitaId: unitaArrotondamentoId,
      importoCent: restoCent,
      importoEuro: centsToEuro(restoCent),
    };
    righeProspetto.push(rigaArrotondamento);
  }

  return {
    importoTotaleCent,
    sommaMillesimi: Number(sommaMillesimiInt) / SCALA_MILLESIMI_NUM,
    quote,
    sommaQuoteCalcolateCent,
    sommaQuoteFinaliCent,
    restoCent,
    unitaArrotondamentoId,
    rigaArrotondamento,
    righeProspetto,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 4. RIPARTIZIONE SPESA A PERIODO PER GIORNI DI TITOLARITÀ (T8)
// ============================================================================

export interface PeriodoTitolaritaInput {
  /** Identificativo del titolare o soggetto (es. `'A'`, `'B'` o UUID soggetto). */
  titolareId?: string;
  soggettoId?: string;
  /** Data inizio titolarità in formato ISO `YYYY-MM-DD` (inclusa). */
  dataInizio: string;
  /** Data fine titolarità in formato ISO `YYYY-MM-DD` (inclusa). */
  dataFine: string;
}

export interface QuotaPeriodoTitolarita {
  titolareId: string;
  dataInizio: string;
  dataFine: string;
  giorni: number;
  quotaCalcolataCent: Centesimi;
  restoArrotondamentoCent: Centesimi;
  quotaFinaleCent: Centesimi;
  importoCent: Centesimi;
  quotaFinaleEuro: number;
}

export interface RipartisciSpesaPeriodoInput {
  /**
   * Importo in centesimi.
   * - Se `millesimiUnita` non è specificato, rappresenta direttamente la quota annua/periodo dell'unità (es. 73,00 € = 7300 cent).
   * - Se `millesimiUnita` è specificato, rappresenta la spesa complessiva del condominio (es. 730,00 € = 73000 cent),
   *   da cui viene prima ricavata la quota annua dell'unità (`importoCent * millesimiUnita / totaleMillesimi`).
   */
  importoCent: CentesimiInput;
  /** Data inizio del periodo di competenza della spesa (`YYYY-MM-DD`, inclusa). */
  dataInizio: string;
  /** Data fine del periodo di competenza della spesa (`YYYY-MM-DD`, inclusa). */
  dataFine: string;
  /** Elenco dei periodi di titolarità che si succedono nell'unità. */
  periodiTitolarita: readonly PeriodoTitolaritaInput[];
  /** Millesimi dell'unità (opzionale, es. 100 su 1000 in T8). */
  millesimiUnita?: number;
  /** Totale millesimi della tabella (default 1000). */
  totaleMillesimi?: number;
}

export interface RisultatoRipartizionePeriodo {
  /** Spesa complessiva passata in input. */
  importoSpesaOrigineCent: Centesimi;
  /** Quota dell'unità per l'intero periodo da dividere tra i titolari (es. 73,00 € = 7300 cent in T8). */
  quotaPeriodoUnitaCent: Centesimi;
  quotaPeriodoUnitaEuro: number;
  dataInizio: string;
  dataFine: string;
  giorniPeriodoTotale: number;
  sommaGiorniTitolarita: number;
  quoteTitolari: QuotaPeriodoTitolarita[];
  sommaQuoteCalcolateCent: Centesimi;
  sommaQuoteFinaliCent: Centesimi;
  restoCent: Centesimi;
  titolareArrotondamentoId: string | null;
  rigaArrotondamento: {
    tipo: 'arrotondamento';
    descrizione: 'arrotondamento';
    titolareId: string;
    importoCent: Centesimi;
    importoEuro: number;
  } | null;
  versioneMotore: string;
}

/**
 * Converte una data ISO `YYYY-MM-DD` nel timestamp UTC di mezzanotte (in millisecondi).
 * L'uso di `Date.UTC` evita qualsiasi distorsione dovuta al cambio ora legale/solare.
 */
function parseDataIsoUtcMs(dataIso: string, nomeCampo: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso.trim());
  if (!match) {
    throw new TypeError(`Data non valida per ${nomeCampo} (atteso formato YYYY-MM-DD): "${dataIso}"`);
  }
  const anno = Number(match[1]);
  const mese = Number(match[2]);
  const giorno = Number(match[3]);

  const dataUtc = new Date(Date.UTC(anno, mese - 1, giorno));
  if (
    dataUtc.getUTCFullYear() !== anno ||
    dataUtc.getUTCMonth() !== mese - 1 ||
    dataUtc.getUTCDate() !== giorno
  ) {
    throw new RangeError(`Data inesistente nel calendario per ${nomeCampo}: "${dataIso}"`);
  }
  return dataUtc.getTime();
}

/**
 * Calcola il numero di giorni inclusivi tra due date ISO `YYYY-MM-DD`:
 * `giorni = data_fine - data_inizio + 1` (entrambi gli estremi inclusi).
 */
export function calcolaGiorniInclusivi(dataInizio: string, dataFine: string): number {
  const inizioMs = parseDataIsoUtcMs(dataInizio, 'dataInizio');
  const fineMs = parseDataIsoUtcMs(dataFine, 'dataFine');
  if (fineMs < inizioMs) {
    throw new RangeError(`Intervallo date non valido: dataFine (${dataFine}) precede dataInizio (${dataInizio}).`);
  }
  return Math.round((fineMs - inizioMs) / 86_400_000) + 1;
}

/**
 * Ripartisce una spesa a periodo tra i titolari che si sono succeduti nell'unità (es. subentro in corso d'anno, T8).
 *
 * Formula (Sezione 10, Regola 4):
 * - `Giorni = data_fine - data_inizio + 1` (entrambi inclusi).
 * - `Quota del titolare = quota_annua * giorni_titolarita / giorni_periodo`, arrotondata al centesimo (half-up).
 * - Eventuale resto attribuito al periodo con più giorni (a parità, al primo per ordine di inserimento) secondo la Regola 3.
 */
export function ripartisciSpesaPeriodo(input: RipartisciSpesaPeriodoInput): RisultatoRipartizionePeriodo {
  const importoSpesaOrigineCent = normalizzaCentesimi(input.importoCent);
  if (importoSpesaOrigineCent < 0) {
    throw new RangeError(`L'importo della spesa non può essere negativo: ${importoSpesaOrigineCent}`);
  }

  const { dataInizio, dataFine, periodiTitolarita, millesimiUnita, totaleMillesimi = 1000 } = input;
  if (!periodiTitolarita || periodiTitolarita.length === 0) {
    throw new RangeError('Specificare almeno un periodo di titolarità.');
  }

  const giorniPeriodoTotale = calcolaGiorniInclusivi(dataInizio, dataFine);

  // Se vengono passati i millesimi dell'unità (es. 100 su 1000 su premio da 730,00 €), calcola prima la quota annua dell'unità
  let quotaPeriodoUnitaCent = importoSpesaOrigineCent;
  if (millesimiUnita !== undefined) {
    const pesoUnitaInt = toMillesimiInt(millesimiUnita, 'millesimiUnita');
    const totaleMillesimiInt = toMillesimiInt(totaleMillesimi, 'totaleMillesimi');
    if (totaleMillesimiInt <= 0n) {
      throw new RangeError('Il totale millesimi deve essere maggiore di zero.');
    }
    quotaPeriodoUnitaCent = dividiEArrotondaHalfUp(BigInt(importoSpesaOrigineCent) * pesoUnitaInt, totaleMillesimiInt);
  }

  const pesiGiorniBig: bigint[] = [];
  const giorniPerTitolare: number[] = [];
  const dateClamped: Array<{ titolareId: string; dataInizio: string; dataFine: string }> = [];
  let sommaGiorniTitolarita = 0;

  for (let i = 0; i < periodiTitolarita.length; i++) {
    const p = periodiTitolarita[i]!;
    const titolareId = (p.titolareId ?? p.soggettoId ?? `titolare_${i + 1}`).trim();
    // Interseca il periodo del titolare con il periodo di competenza della spesa
    const inizioEffettivo = p.dataInizio < dataInizio ? dataInizio : p.dataInizio;
    const fineEffettiva = p.dataFine > dataFine ? dataFine : p.dataFine;
    const giorni = calcolaGiorniInclusivi(inizioEffettivo, fineEffettiva);

    giorniPerTitolare.push(giorni);
    pesiGiorniBig.push(BigInt(giorni));
    sommaGiorniTitolarita += giorni;
    dateClamped.push({ titolareId, dataInizio: inizioEffettivo, dataFine: fineEffettiva });
  }

  const denominatoreGiorniBig = BigInt(giorniPeriodoTotale);
  const quotaUnitaBig = BigInt(quotaPeriodoUnitaCent);

  const quoteCalcolate: Centesimi[] = [];
  let sommaQuoteCalcolateCent = 0;

  for (let i = 0; i < periodiTitolarita.length; i++) {
    const numeratore = quotaUnitaBig * pesiGiorniBig[i]!;
    const quotaArrotondata = dividiEArrotondaHalfUp(numeratore, denominatoreGiorniBig);
    quoteCalcolate.push(quotaArrotondata);
    sommaQuoteCalcolateCent += quotaArrotondata;
  }

  const restoCent = normalizzaCentesimi(quotaPeriodoUnitaCent - sommaQuoteCalcolateCent);
  const indiceResto = trovaIndiceDestinatarioResto(pesiGiorniBig);
  const titolareArrotondamentoId = restoCent !== 0 ? dateClamped[indiceResto]!.titolareId : null;

  const quoteTitolari: QuotaPeriodoTitolarita[] = [];
  let sommaQuoteFinaliCent = 0;

  for (let i = 0; i < periodiTitolarita.length; i++) {
    const info = dateClamped[i]!;
    const giorni = giorniPerTitolare[i]!;
    const quotaCalcolataCent = quoteCalcolate[i]!;
    const restoTitolare = i === indiceResto ? restoCent : 0;
    const quotaFinaleCent = normalizzaCentesimi(quotaCalcolataCent + restoTitolare);
    sommaQuoteFinaliCent += quotaFinaleCent;

    quoteTitolari.push({
      titolareId: info.titolareId,
      dataInizio: info.dataInizio,
      dataFine: info.dataFine,
      giorni,
      quotaCalcolataCent,
      restoArrotondamentoCent: restoTitolare,
      quotaFinaleCent,
      importoCent: quotaFinaleCent,
      quotaFinaleEuro: centsToEuro(quotaFinaleCent),
    });
  }

  const rigaArrotondamento =
    restoCent !== 0 && titolareArrotondamentoId !== null
      ? {
          tipo: 'arrotondamento' as const,
          descrizione: 'arrotondamento' as const,
          titolareId: titolareArrotondamentoId,
          importoCent: restoCent,
          importoEuro: centsToEuro(restoCent),
        }
      : null;

  return {
    importoSpesaOrigineCent,
    quotaPeriodoUnitaCent,
    quotaPeriodoUnitaEuro: centsToEuro(quotaPeriodoUnitaCent),
    dataInizio,
    dataFine,
    giorniPeriodoTotale,
    sommaGiorniTitolarita,
    quoteTitolari,
    sommaQuoteCalcolateCent,
    sommaQuoteFinaliCent,
    restoCent,
    titolareArrotondamentoId,
    rigaArrotondamento,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 5. RIPARTIZIONE CONSUMI CON MARCATURA "DA CONGUAGLIARE" (T9)
// ============================================================================

export interface ConsumoUnitaInput {
  unitaId: string;
  /** Consumo rilevato dal contatore (es. m³ di acqua). Se `null` o `undefined`, viene usata la stima storica. */
  consumo?: number | null;
  /** Flag esplicito che indica che il consumo inserito è una stima. */
  isStimato?: boolean;
  /** Stima storica opzionale direttamente sull'unità se `consumo` è assente. */
  consumoStimato?: number;
}

export interface StimaMancanteInput {
  unitaId: string;
  consumoStimato: number;
}

export type StimeMancantiMapOrArray =
  | Readonly<Record<string, number>>
  | readonly StimaMancanteInput[]
  | ReadonlySet<string>
  | readonly string[];

export interface QuotaConsumoUnita {
  unitaId: string;
  consumo: number;
  isStimato: boolean;
  /** `true` se la lettura era mancante/stimata dallo storico e quindi la quota resta "da conguagliare" (RC-C5, T9). */
  daConguagliare: boolean;
  statoQuota: 'DEFINITIVA' | 'DA_CONGUAGLIARE';
  quotaCalcolataCent: Centesimi;
  restoArrotondamentoCent: Centesimi;
  quotaFinaleCent: Centesimi;
  importoCent: Centesimi;
  quotaFinaleEuro: number;
}

export interface RipartisciConsumiInput {
  importoTotaleCent: CentesimiInput;
  consumiUnita: readonly ConsumoUnitaInput[];
  /**
   * Stime storiche per le unità con lettura contatore mancante (mappa `{ [unitaId]: valore }`,
   * array `[{ unitaId, consumoStimato }]` oppure elenco di `unitaId` con lettura stimata).
   */
  stimeMancanti?: StimeMancantiMapOrArray;
  /**
   * Consumo totale complessivo opzionale (es. 1.200 m³ in T9 se si passa anche un sottoinsieme o se si vuole verificare il totale).
   * Di default è calcolato come somma dei consumi (reali + stimati) di tutte le unità in `consumiUnita`.
   */
  consumoTotale?: number;
}

export interface RisultatoRipartizioneConsumi {
  importoTotaleCent: Centesimi;
  consumoTotale: number;
  quote: QuotaConsumoUnita[];
  sommaQuoteCalcolateCent: Centesimi;
  sommaQuoteFinaliCent: Centesimi;
  restoCent: Centesimi;
  unitaArrotondamentoId: string | null;
  rigaArrotondamento: RigaArrotondamentoProspetto | null;
  haQuoteDaConguagliare: boolean;
  versioneMotore: string;
}

function normalizzaStimeMancanti(stime?: StimeMancantiMapOrArray): {
  valoriStimati: Map<string, number>;
  unitaMarcateStimate: Set<string>;
} {
  const valoriStimati = new Map<string, number>();
  const unitaMarcateStimate = new Set<string>();

  if (!stime) {
    return { valoriStimati, unitaMarcateStimate };
  }

  if (stime instanceof Set) {
    for (const id of stime) {
      unitaMarcateStimate.add(id);
    }
    return { valoriStimati, unitaMarcateStimate };
  }

  if (Array.isArray(stime)) {
    for (const item of stime) {
      if (typeof item === 'string') {
        unitaMarcateStimate.add(item);
      } else if (item && typeof item === 'object' && 'unitaId' in item) {
        unitaMarcateStimate.add(item.unitaId);
        valoriStimati.set(item.unitaId, item.consumoStimato);
      }
    }
    return { valoriStimati, unitaMarcateStimate };
  }

  for (const [unitaId, valore] of Object.entries(stime)) {
    if (typeof valore === 'number') {
      unitaMarcateStimate.add(unitaId);
      valoriStimati.set(unitaId, valore);
    }
  }

  return { valoriStimati, unitaMarcateStimate };
}

/**
 * Ripartisce una spesa a consumo (acqua, riscaldamento) in base alle letture dei contatori (RC-C5, Sezione 10 Regola 5, T9).
 *
 * - `Quota di consumo = importo_consumi * consumo_unita / consumo_totale`.
 * - Se per un'unità manca la lettura reale, il consumo viene prelevato da `stimeMancanti` (o `consumoStimato`)
 *   e la relativa quota viene marcata con `daConguagliare: true` (`statoQuota: 'DA_CONGUAGLIARE'`).
 */
export function ripartisciConsumi(input: RipartisciConsumiInput): RisultatoRipartizioneConsumi {
  const importoTotaleCent = normalizzaCentesimi(input.importoTotaleCent);
  if (importoTotaleCent < 0) {
    throw new RangeError(`L'importo totale dei consumi non può essere negativo: ${importoTotaleCent}`);
  }

  const { consumiUnita, stimeMancanti, consumoTotale: consumoTotaleEsplicito } = input;
  if (!consumiUnita || consumiUnita.length === 0) {
    throw new RangeError('Impossibile ripartire i consumi: nessuna unità fornita.');
  }

  const { valoriStimati, unitaMarcateStimate } = normalizzaStimeMancanti(stimeMancanti);

  const pesiConsumoInt: bigint[] = [];
  const consumiEffettiviNum: number[] = [];
  const flagsStimato: boolean[] = [];
  let sommaConsumiInt = 0n;

  for (let i = 0; i < consumiUnita.length; i++) {
    const u = consumiUnita[i]!;
    const haLetturaReale = u.consumo !== null && u.consumo !== undefined;
    const stimaDaMappa = valoriStimati.get(u.unitaId);
    const isMarcataStimata = Boolean(u.isStimato) || unitaMarcateStimate.has(u.unitaId) || !haLetturaReale;

    let valoreConsumo: number | undefined;
    if (haLetturaReale && (!valoriStimati.has(u.unitaId) || u.consumo !== undefined)) {
      valoreConsumo = u.consumo!;
    } else if (stimaDaMappa !== undefined) {
      valoreConsumo = stimaDaMappa;
    } else if (u.consumoStimato !== undefined) {
      valoreConsumo = u.consumoStimato;
    }

    if (valoreConsumo === undefined || !Number.isFinite(valoreConsumo) || valoreConsumo < 0) {
      throw new RangeError(
        `Lettura contatore mancante e nessuna stima storica disponibile per l'unità "${u.unitaId}".`,
      );
    }

    const pesoInt = toMillesimiInt(valoreConsumo, `consumiUnita[${i}].consumo`);
    pesiConsumoInt.push(pesoInt);
    consumiEffettiviNum.push(Number(pesoInt) / SCALA_MILLESIMI_NUM);
    flagsStimato.push(isMarcataStimata);
    sommaConsumiInt += pesoInt;
  }

  const denominatoreConsumiInt =
    consumoTotaleEsplicito !== undefined
      ? toMillesimiInt(consumoTotaleEsplicito, 'consumoTotale')
      : sommaConsumiInt;

  if (denominatoreConsumiInt <= 0n) {
    throw new RangeError('Il consumo totale deve essere strettamente maggiore di zero.');
  }

  const importoBig = BigInt(importoTotaleCent);
  const quoteCalcolate: Centesimi[] = [];
  let sommaQuoteCalcolateCent = 0;

  for (let i = 0; i < consumiUnita.length; i++) {
    const numeratore = importoBig * pesiConsumoInt[i]!;
    const quotaArrotondata = dividiEArrotondaHalfUp(numeratore, denominatoreConsumiInt);
    quoteCalcolate.push(quotaArrotondata);
    sommaQuoteCalcolateCent += quotaArrotondata;
  }

  // Applica il resto all'unità con consumo maggiore solo quando le unità in input rappresentano l'intero consumo totale
  const applicaResto = denominatoreConsumiInt === sommaConsumiInt;
  const restoCent = applicaResto ? normalizzaCentesimi(importoTotaleCent - sommaQuoteCalcolateCent) : 0;
  const indiceResto = trovaIndiceDestinatarioResto(pesiConsumoInt);
  const unitaArrotondamentoId = restoCent !== 0 ? consumiUnita[indiceResto]!.unitaId : null;

  const quote: QuotaConsumoUnita[] = [];
  let sommaQuoteFinaliCent = 0;
  let haQuoteDaConguagliare = false;

  for (let i = 0; i < consumiUnita.length; i++) {
    const unitaId = consumiUnita[i]!.unitaId;
    const consumo = consumiEffettiviNum[i]!;
    const isStimato = flagsStimato[i]!;
    const daConguagliare = isStimato;
    if (daConguagliare) {
      haQuoteDaConguagliare = true;
    }

    const quotaCalcolataCent = quoteCalcolate[i]!;
    const restoUnita = applicaResto && i === indiceResto ? restoCent : 0;
    const quotaFinaleCent = normalizzaCentesimi(quotaCalcolataCent + restoUnita);
    sommaQuoteFinaliCent += quotaFinaleCent;

    quote.push({
      unitaId,
      consumo,
      isStimato,
      daConguagliare,
      statoQuota: daConguagliare ? 'DA_CONGUAGLIARE' : 'DEFINITIVA',
      quotaCalcolataCent,
      restoArrotondamentoCent: restoUnita,
      quotaFinaleCent,
      importoCent: quotaFinaleCent,
      quotaFinaleEuro: centsToEuro(quotaFinaleCent),
    });
  }

  const rigaArrotondamento: RigaArrotondamentoProspetto | null =
    restoCent !== 0 && unitaArrotondamentoId !== null
      ? {
          tipo: 'arrotondamento',
          descrizione: 'arrotondamento',
          unitaId: unitaArrotondamentoId,
          importoCent: restoCent,
          importoEuro: centsToEuro(restoCent),
        }
      : null;

  return {
    importoTotaleCent,
    consumoTotale: Number(denominatoreConsumiInt) / SCALA_MILLESIMI_NUM,
    quote,
    sommaQuoteCalcolateCent,
    sommaQuoteFinaliCent,
    restoCent,
    unitaArrotondamentoId,
    rigaArrotondamento,
    haQuoteDaConguagliare,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 6. CALCOLO CONGUAGLIO PER GESTIONE (T5)
// ============================================================================

export type TipoSaldoConguaglio = 'DEBITO' | 'CREDITO' | 'PAREGGIO';

export interface CalcolaConguaglioInput {
  quotaConsuntivoCent: CentesimiInput;
  rateVersateCent: CentesimiInput;
  gestioneId?: string;
  unitaId?: string;
}

export interface RisultatoConguaglio {
  unitaId: string | null;
  gestioneId: string | null;
  quotaConsuntivoCent: Centesimi;
  rateVersateCent: Centesimi;
  /**
   * Differenza algebrica `quotaConsuntivoCent - rateVersateCent` (Sezione 10, Regola 6):
   * - Positivo (`> 0`) = debito dell'unità verso il condominio;
   * - Negativo (`< 0`) = credito dell'unità verso il condominio;
   * - Zero (`0`) = pareggio.
   */
  conguaglioCent: Centesimi;
  /** Alias di `conguaglioCent`. */
  differenzaCent: Centesimi;
  /** Valore assoluto del conguaglio in centesimi. */
  importoAssolutoCent: Centesimi;
  /** Importo a debito dell'unità (`conguaglioCent` se `> 0`, altrimenti `0`). */
  debitoCent: Centesimi;
  /** Importo a credito dell'unità (`Math.abs(conguaglioCent)` se `< 0`, altrimenti `0`). */
  creditoCent: Centesimi;
  tipo: TipoSaldoConguaglio;
  isDebito: boolean;
  isCredito: boolean;
  conguaglioEuro: number;
  versioneMotore: string;
}

/**
 * Calcola il conguaglio di un'unità per una specifica gestione (RC-L1, Sezione 10 Regola 6, T5):
 * `Conguaglio = quota di consuntivo - rate versate`.
 * - Positivo = debito dell'unità;
 * - Negativo = credito dell'unità.
 */
export function calcolaConguaglio(input: CalcolaConguaglioInput): RisultatoConguaglio {
  const quotaConsuntivoCent = normalizzaCentesimi(input.quotaConsuntivoCent);
  const rateVersateCent = normalizzaCentesimi(input.rateVersateCent);

  if (quotaConsuntivoCent < 0) {
    throw new RangeError(`La quota di consuntivo non può essere negativa: ${quotaConsuntivoCent}`);
  }
  if (rateVersateCent < 0) {
    throw new RangeError(`L'importo delle rate versate non può essere negativo: ${rateVersateCent}`);
  }

  const conguaglioCent = normalizzaCentesimi(quotaConsuntivoCent - rateVersateCent);
  const isDebito = conguaglioCent > 0;
  const isCredito = conguaglioCent < 0;
  const tipo: TipoSaldoConguaglio = isDebito ? 'DEBITO' : isCredito ? 'CREDITO' : 'PAREGGIO';
  const importoAssolutoCent = Math.abs(conguaglioCent);

  return {
    unitaId: input.unitaId ?? null,
    gestioneId: input.gestioneId ?? null,
    quotaConsuntivoCent,
    rateVersateCent,
    conguaglioCent,
    differenzaCent: conguaglioCent,
    importoAssolutoCent,
    debitoCent: isDebito ? conguaglioCent : 0,
    creditoCent: isCredito ? importoAssolutoCent : 0,
    tipo,
    isDebito,
    isCredito,
    conguaglioEuro: centsToEuro(conguaglioCent),
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}
