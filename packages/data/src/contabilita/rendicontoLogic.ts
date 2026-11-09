/**
 * Logica pura per il Rendiconto Annuale tripartito e il motore di Conguaglio
 * (Sezione 8: RC-K1..K8, RC-L1..L6; Sezione 10: T5, T15).
 *
 * Principi fondamentali:
 * - Nessun decimale in virgola mobile: tutti gli importi sono in centesimi interi (`Centesimi`).
 * - RC-K1 & T15 (art. 1130-bis c.c., Cass. 25446/2025): il rendiconto è unitario e si compone di tre documenti
 *   inscindibili (registro di contabilità, riepilogo finanziario, nota sintetica esplicativa). Lo stato `COMPLETO`
 *   richiede tutti e tre: la mancanza di uno rende il rendiconto impugnabile.
 * - RC-K3: riepilogo finanziario con controllo `saldo finale = saldo iniziale + entrate - uscite`,
 *   crediti verso condomini, debiti verso fornitori e consistenza dei fondi.
 * - RC-K5: sistema misto cassa-competenza con riconciliazione automatica (crediti, debiti, ratei, risconti).
 * - RC-L1, RC-L2, T5: conguaglio individuale (`quota consuntivo - rate versate`) e aggregato per soggetto.
 * - RC-L5: credito di conguaglio compensato sulla prima rata dell'esercizio successivo oppure rimborsato (tracciato).
 * - RC-K8 (art. 1130 n. 10 c.c.): approvazione entro 180 giorni dalla chiusura, promemoria a 60, 30 e 7 giorni.
 * - RC-K7: un rendiconto `APPROVATO` non si modifica; si può solo rettificare con nuova approvazione (RC-L6).
 * - Nessuna dipendenza da React, Expo, `Intl` o Supabase.
 */

import {
  calcolaConguaglio,
  centsToEuro,
  dividiEArrotondaHalfUp,
  normalizzaCentesimi,
  VERSIONE_MOTORE_CALCOLO,
  type Centesimi,
  type CentesimiInput,
  type RisultatoConguaglio,
} from './contabilitaLogic.ts';
import type { EventoAuditContabile } from './bollettiniLogic.ts';
import { aggiungiGiorniIso, differenzaGiorniIso } from './morositaLogic.ts';

// ============================================================================
// COSTANTI E TIPI DI DOMINIO
// ============================================================================

export const STATI_RENDICONTO = ['IN_PREPARAZIONE', 'COMPLETO', 'APPROVATO', 'RETTIFICATO'] as const;
export type StatoRendiconto = (typeof STATI_RENDICONTO)[number];

export const DOCUMENTI_RENDICONTO = [
  'REGISTRO_CONTABILITA',
  'RIEPILOGO_FINANZIARIO',
  'NOTA_SINTETICA_ESPLICATIVA',
] as const;
export type DocumentoRendiconto = (typeof DOCUMENTI_RENDICONTO)[number];

/** Giorni massimi dalla chiusura dell'esercizio per convocare l'assemblea di approvazione (art. 1130 n. 10 c.c.). */
export const GIORNI_TERMINE_APPROVAZIONE_RENDICONTO = 180;

/** Soglie (in giorni residui alla scadenza) dei promemoria di approvazione (RC-K8). */
export const SOGLIE_PROMEMORIA_APPROVAZIONE = [60, 30, 7] as const;
export type SogliaPromemoriaApprovazione = (typeof SOGLIE_PROMEMORIA_APPROVAZIONE)[number];

export type SegnoMovimentoRendiconto = '+' | '-';
export type MezzoMovimentoRendiconto = 'CONTO' | 'CASSA';

// ============================================================================
// ERRORI DI DOMINIO
// ============================================================================

export class ErroreRendicontoIncompleto extends Error {
  readonly codice = 'RENDICONTO_INCOMPLETO_IMPUGNABILE' as const;
  readonly documentiMancanti: readonly DocumentoRendiconto[];

  constructor(documentiMancanti: readonly DocumentoRendiconto[]) {
    super(
      `Il rendiconto non può passare a "completo": mancano i documenti inscindibili ${documentiMancanti.join(', ')} (art. 1130-bis c.c., Cass. 25446/2025, RC-K1, T15). Un rendiconto privo di uno dei tre documenti è impugnabile.`,
    );
    this.name = 'ErroreRendicontoIncompleto';
    this.documentiMancanti = documentiMancanti;
  }
}

export class ErroreQuadraturaRiepilogoFinanziario extends Error {
  readonly codice = 'QUADRATURA_RIEPILOGO_FINANZIARIO' as const;
  readonly differenzaContoCent: Centesimi;
  readonly differenzaCassaCent: Centesimi;

  constructor(differenzaContoCent: Centesimi, differenzaCassaCent: Centesimi) {
    super(
      `Il riepilogo finanziario non quadra (RC-K3): scarto conto ${differenzaContoCent} cent, scarto cassa ${differenzaCassaCent} cent rispetto a saldo iniziale + entrate - uscite.`,
    );
    this.name = 'ErroreQuadraturaRiepilogoFinanziario';
    this.differenzaContoCent = differenzaContoCent;
    this.differenzaCassaCent = differenzaCassaCent;
  }
}

export class ErroreRendicontoApprovatoImmodificabile extends Error {
  readonly codice = 'RENDICONTO_APPROVATO_IMMODIFICABILE' as const;
  readonly modificaBloccata = true;

  constructor(operazione?: string) {
    super(
      `Il rendiconto è in stato "approvato" e non può essere modificato${operazione ? ` (${operazione})` : ''} (RC-K7). Per correggerlo occorre avviare una rettifica con nuova approvazione o una scrittura nell'esercizio successivo (RC-L6).`,
    );
    this.name = 'ErroreRendicontoApprovatoImmodificabile';
  }
}

export class ErroreTransizioneRendicontoNonValida extends Error {
  readonly codice = 'TRANSIZIONE_RENDICONTO_NON_VALIDA' as const;
  readonly da: StatoRendiconto;
  readonly a: StatoRendiconto;

  constructor(da: StatoRendiconto, a: StatoRendiconto) {
    super(`Transizione di stato del rendiconto non consentita: ${da} -> ${a} (RC-K7).`);
    this.name = 'ErroreTransizioneRendicontoNonValida';
    this.da = da;
    this.a = a;
  }
}

export class ErroreApprovazioneRendiconto extends Error {
  readonly codice = 'APPROVAZIONE_RENDICONTO_NON_VALIDA' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreApprovazioneRendiconto';
  }
}

export class ErroreChiusuraEsercizio extends Error {
  readonly codice = 'CHIUSURA_ESERCIZIO_NON_VALIDA' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreChiusuraEsercizio';
  }
}

export class ErroreRegolazioneConguaglio extends Error {
  readonly codice = 'REGOLAZIONE_CONGUAGLIO_NON_VALIDA' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreRegolazioneConguaglio';
  }
}

// ============================================================================
// UTILITÀ SU DATE ISO (YYYY-MM-DD, aritmetica UTC senza fusi orari)
// ============================================================================

/** Data ISO a mezzanotte UTC in millisecondi (aritmetica senza fusi orari). */
function parseDataIso(dataIso: string): number {
  const ms = Date.parse(`${dataIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Data non valida: "${dataIso}" (atteso formato YYYY-MM-DD).`);
  }
  return ms;
}

const giorniInclusivi = (da: string, a: string): number => differenzaGiorniIso(da, a) + 1;

// ============================================================================
// 1. INSCINDIBILITÀ DEI TRE DOCUMENTI (RC-K1, T15)
// ============================================================================

export interface ValidaCompletezzaRendicontoInput {
  /** Registro di contabilità completo: tutti i movimenti attivi hanno giustificativo (RC-K2, RC-B3). */
  registroContabilitaCompleto: boolean;
  /** Riepilogo finanziario generato; `null`/`undefined` se non redatto. */
  riepilogoFinanziario?: { quadra: boolean } | null;
  /** Nota sintetica esplicativa redatta dall'amministratore (RC-K4). */
  notaSintetica?: string | null;
}

export interface EsitoDocumentoRendiconto {
  documento: DocumentoRendiconto;
  presente: boolean;
  motivo: string | null;
}

export interface RisultatoCompletezzaRendiconto {
  completo: boolean;
  /** Un rendiconto con anche un solo documento mancante è impugnabile (RC-K1). */
  impugnabile: boolean;
  documenti: EsitoDocumentoRendiconto[];
  documentiMancanti: DocumentoRendiconto[];
  statoProposto: Extract<StatoRendiconto, 'IN_PREPARAZIONE' | 'COMPLETO'>;
}

/**
 * Verifica l'inscindibilità dei tre documenti (RC-K1, T15): lo stato "completo" richiede
 * registro, riepilogo finanziario (quadrato) e nota sintetica non vuota.
 */
export function validaCompletezzaRendiconto(
  input: ValidaCompletezzaRendicontoInput,
): RisultatoCompletezzaRendiconto {
  const nota = (input.notaSintetica ?? '').trim();
  const documenti: EsitoDocumentoRendiconto[] = [
    {
      documento: 'REGISTRO_CONTABILITA',
      presente: input.registroContabilitaCompleto === true,
      motivo: input.registroContabilitaCompleto
        ? null
        : 'Il registro di contabilità non è completo: movimenti privi di giustificativo.',
    },
    {
      documento: 'RIEPILOGO_FINANZIARIO',
      presente: !!input.riepilogoFinanziario && input.riepilogoFinanziario.quadra === true,
      motivo: !input.riepilogoFinanziario
        ? 'Il riepilogo finanziario non è stato redatto.'
        : input.riepilogoFinanziario.quadra
          ? null
          : 'Il riepilogo finanziario non quadra (saldo finale ≠ saldo iniziale + entrate − uscite).',
    },
    {
      documento: 'NOTA_SINTETICA_ESPLICATIVA',
      presente: nota.length > 0,
      motivo: nota.length > 0 ? null : 'La nota sintetica esplicativa è mancante.',
    },
  ];
  const documentiMancanti = documenti.filter((d) => !d.presente).map((d) => d.documento);
  const completo = documentiMancanti.length === 0;
  return {
    completo,
    impugnabile: !completo,
    documenti,
    documentiMancanti,
    statoProposto: completo ? 'COMPLETO' : 'IN_PREPARAZIONE',
  };
}

/** Come {@link validaCompletezzaRendiconto} ma solleva {@link ErroreRendicontoIncompleto} se manca un documento. */
export function assertRendicontoCompleto(
  input: ValidaCompletezzaRendicontoInput,
): RisultatoCompletezzaRendiconto {
  const esito = validaCompletezzaRendiconto(input);
  if (!esito.completo) {
    throw new ErroreRendicontoIncompleto(esito.documentiMancanti);
  }
  return esito;
}

// ============================================================================
// 2. RIEPILOGO FINANZIARIO E SITUAZIONE PATRIMONIALE (RC-K3)
// ============================================================================

export interface MovimentoRiepilogoInput {
  importoCent: CentesimiInput;
  segno: SegnoMovimentoRendiconto;
  /** Default `CONTO`; `CASSA` per i movimenti gestiti per contanti/eccezione conto corrente. */
  mezzo?: MezzoMovimentoRendiconto;
}

export interface CreditoVersoCondominoInput {
  unitaId?: string | null;
  soggettoId?: string | null;
  importoCent: CentesimiInput;
}

export interface DebitoVersoFornitoreInput {
  fornitoreId?: string | null;
  importoCent: CentesimiInput;
}

export interface FondoConsistenzaInput {
  id?: string;
  nome: string;
  tipo?: 'SPECIALE' | 'CASSA' | 'MOROSITA';
  saldoCent: CentesimiInput;
}

export interface CostruisciRiepilogoFinanziarioInput {
  saldoInizialeContoCent: CentesimiInput;
  saldoInizialeCassaCent?: CentesimiInput;
  movimenti: readonly MovimentoRiepilogoInput[];
  /** Saldi finali dichiarati (es. da estratto conto) da confrontare con il calcolato; se omessi coincidono col calcolato. */
  saldoFinaleContoDichiaratoCent?: CentesimiInput | null;
  saldoFinaleCassaDichiaratoCent?: CentesimiInput | null;
  creditiVersoCondomini?: readonly CreditoVersoCondominoInput[];
  debitiVersoFornitori?: readonly DebitoVersoFornitoreInput[];
  fondi?: readonly FondoConsistenzaInput[];
}

export interface RiepilogoFinanziario {
  saldoInizialeContoCent: Centesimi;
  saldoInizialeCassaCent: Centesimi;
  entrateContoCent: Centesimi;
  usciteContoCent: Centesimi;
  entrateCassaCent: Centesimi;
  usciteCassaCent: Centesimi;
  entrateTotaliCent: Centesimi;
  usciteTotaliCent: Centesimi;
  /** `saldo iniziale + entrate − uscite` calcolato. */
  saldoFinaleCalcolatoContoCent: Centesimi;
  saldoFinaleCalcolatoCassaCent: Centesimi;
  saldoFinaleContoCent: Centesimi;
  saldoFinaleCassaCent: Centesimi;
  differenzaQuadraturaContoCent: Centesimi;
  differenzaQuadraturaCassaCent: Centesimi;
  /** RC-K3: `saldo finale = saldo iniziale + entrate − uscite` per conto e per cassa. */
  quadra: boolean;
  creditiVersoCondominiCent: Centesimi;
  numeroCondominiDebitori: number;
  debitiVersoFornitoriCent: Centesimi;
  numeroFornitoriCreditori: number;
  fondi: Array<{ id: string | null; nome: string; tipo: string | null; saldoCent: Centesimi }>;
  consistenzaFondiCent: Centesimi;
  liquiditaTotaleCent: Centesimi;
  /** RC-J5: i fondi sono voci contabili, non conti: devono essere coperti dalla liquidità. */
  fondiCoperti: boolean;
  /** Situazione patrimoniale netta: liquidità + crediti − debiti. */
  patrimonioNettoCent: Centesimi;
  versioneMotore: string;
}

function importoPositivo(valore: CentesimiInput, contesto: string): Centesimi {
  const n = normalizzaCentesimi(valore);
  if (n < 0) {
    throw new RangeError(`${contesto}: l'importo non può essere negativo (${n}).`);
  }
  return n;
}

/**
 * Costruisce il riepilogo finanziario del rendiconto (RC-K3): saldi, quadratura, crediti verso condomini,
 * debiti verso fornitori e consistenza dei fondi.
 */
export function costruisciRiepilogoFinanziario(
  input: CostruisciRiepilogoFinanziarioInput,
): RiepilogoFinanziario {
  const saldoInizialeContoCent = normalizzaCentesimi(input.saldoInizialeContoCent);
  const saldoInizialeCassaCent = normalizzaCentesimi(input.saldoInizialeCassaCent ?? 0);

  let entrateContoCent = 0;
  let usciteContoCent = 0;
  let entrateCassaCent = 0;
  let usciteCassaCent = 0;
  for (const m of input.movimenti) {
    const imp = importoPositivo(m.importoCent, 'Movimento del riepilogo');
    const cassa = m.mezzo === 'CASSA';
    if (m.segno === '+') {
      if (cassa) entrateCassaCent += imp;
      else entrateContoCent += imp;
    } else if (m.segno === '-') {
      if (cassa) usciteCassaCent += imp;
      else usciteContoCent += imp;
    } else {
      throw new RangeError(`Segno movimento non valido: "${String(m.segno)}".`);
    }
  }

  const saldoFinaleCalcolatoContoCent = saldoInizialeContoCent + entrateContoCent - usciteContoCent;
  const saldoFinaleCalcolatoCassaCent = saldoInizialeCassaCent + entrateCassaCent - usciteCassaCent;
  const saldoFinaleContoCent =
    input.saldoFinaleContoDichiaratoCent === undefined || input.saldoFinaleContoDichiaratoCent === null
      ? saldoFinaleCalcolatoContoCent
      : normalizzaCentesimi(input.saldoFinaleContoDichiaratoCent);
  const saldoFinaleCassaCent =
    input.saldoFinaleCassaDichiaratoCent === undefined || input.saldoFinaleCassaDichiaratoCent === null
      ? saldoFinaleCalcolatoCassaCent
      : normalizzaCentesimi(input.saldoFinaleCassaDichiaratoCent);
  const differenzaQuadraturaContoCent = saldoFinaleContoCent - saldoFinaleCalcolatoContoCent;
  const differenzaQuadraturaCassaCent = saldoFinaleCassaCent - saldoFinaleCalcolatoCassaCent;

  const crediti = input.creditiVersoCondomini ?? [];
  let creditiVersoCondominiCent = 0;
  const debitoriDistinti = new Set<string>();
  crediti.forEach((c, i) => {
    const imp = importoPositivo(c.importoCent, 'Credito verso condomino');
    creditiVersoCondominiCent += imp;
    if (imp > 0) debitoriDistinti.add(c.soggettoId ?? c.unitaId ?? `riga:${i}`);
  });

  const debiti = input.debitiVersoFornitori ?? [];
  let debitiVersoFornitoriCent = 0;
  const fornitoriDistinti = new Set<string>();
  debiti.forEach((d, i) => {
    const imp = importoPositivo(d.importoCent, 'Debito verso fornitore');
    debitiVersoFornitoriCent += imp;
    if (imp > 0) fornitoriDistinti.add(d.fornitoreId ?? `riga:${i}`);
  });

  const fondi = (input.fondi ?? []).map((f) => ({
    id: f.id ?? null,
    nome: f.nome,
    tipo: f.tipo ?? null,
    saldoCent: normalizzaCentesimi(f.saldoCent),
  }));
  const consistenzaFondiCent = fondi.reduce((acc, f) => acc + f.saldoCent, 0);
  const liquiditaTotaleCent = saldoFinaleContoCent + saldoFinaleCassaCent;

  return {
    saldoInizialeContoCent,
    saldoInizialeCassaCent,
    entrateContoCent,
    usciteContoCent,
    entrateCassaCent,
    usciteCassaCent,
    entrateTotaliCent: entrateContoCent + entrateCassaCent,
    usciteTotaliCent: usciteContoCent + usciteCassaCent,
    saldoFinaleCalcolatoContoCent,
    saldoFinaleCalcolatoCassaCent,
    saldoFinaleContoCent,
    saldoFinaleCassaCent,
    differenzaQuadraturaContoCent,
    differenzaQuadraturaCassaCent,
    quadra: differenzaQuadraturaContoCent === 0 && differenzaQuadraturaCassaCent === 0,
    creditiVersoCondominiCent,
    numeroCondominiDebitori: debitoriDistinti.size,
    debitiVersoFornitoriCent,
    numeroFornitoriCreditori: fornitoriDistinti.size,
    fondi,
    consistenzaFondiCent,
    liquiditaTotaleCent,
    fondiCoperti: consistenzaFondiCent <= liquiditaTotaleCent,
    patrimonioNettoCent: liquiditaTotaleCent + creditiVersoCondominiCent - debitiVersoFornitoriCent,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

/** Solleva {@link ErroreQuadraturaRiepilogoFinanziario} se il riepilogo non quadra (RC-K3). */
export function assertQuadraturaRiepilogoFinanziario(riepilogo: RiepilogoFinanziario): void {
  if (!riepilogo.quadra) {
    throw new ErroreQuadraturaRiepilogoFinanziario(
      riepilogo.differenzaQuadraturaContoCent,
      riepilogo.differenzaQuadraturaCassaCent,
    );
  }
}

// ============================================================================
// 2-bis. NOTA SINTETICA PRECOMPILATA (RC-K4)
// ============================================================================

export interface PrecompilaNotaSinteticaInput {
  anno: number;
  riepilogo: Pick<
    RiepilogoFinanziario,
    | 'entrateTotaliCent'
    | 'usciteTotaliCent'
    | 'saldoFinaleContoCent'
    | 'creditiVersoCondominiCent'
    | 'debitiVersoFornitoriCent'
    | 'consistenzaFondiCent'
  >;
  numeroFornitori?: number;
  contenziosi?: readonly string[];
  anomalie?: readonly string[];
}

const eur = (c: Centesimi): string => centsToEuro(c, true, true);

/** Genera la bozza della nota sintetica con i dati principali precompilati (RC-K4); l'amministratore la completa. */
export function precompilaNotaSintetica(input: PrecompilaNotaSinteticaInput): string {
  const r = input.riepilogo;
  const righe = [
    `Nota sintetica esplicativa — esercizio ${input.anno}`,
    `Entrate dell'esercizio: ${eur(r.entrateTotaliCent)}; uscite: ${eur(r.usciteTotaliCent)}; saldo del conto a fine esercizio: ${eur(r.saldoFinaleContoCent)}.`,
    `Crediti verso condomini: ${eur(r.creditiVersoCondominiCent)}; debiti verso fornitori: ${eur(r.debitiVersoFornitoriCent)}; consistenza dei fondi: ${eur(r.consistenzaFondiCent)}.`,
    `Rapporti con i fornitori: ${input.numeroFornitori ?? 0} fornitori movimentati nell'esercizio.`,
    `Contenziosi: ${input.contenziosi && input.contenziosi.length > 0 ? input.contenziosi.join('; ') : 'nessun contenzioso segnalato'}.`,
    `Anomalie: ${input.anomalie && input.anomalie.length > 0 ? input.anomalie.join('; ') : 'nessuna anomalia rilevata'}.`,
  ];
  return righe.join('\n');
}

// ============================================================================
// 3. SISTEMA MISTO CASSA-COMPETENZA (RC-K5)
// ============================================================================

export const TIPI_VOCE_RICONCILIAZIONE = [
  'CREDITO',
  'DEBITO',
  'RATEO_ATTIVO',
  'RATEO_PASSIVO',
  'RISCONTO_ATTIVO',
  'RISCONTO_PASSIVO',
  'RISCONTO_PREGRESSO',
  'REGOLAZIONE_PREGRESSA',
] as const;
export type TipoVoceRiconciliazione = (typeof TIPI_VOCE_RICONCILIAZIONE)[number];

export interface MovimentoCassaCompetenzaInput {
  id: string;
  importoCent: CentesimiInput;
  segno: SegnoMovimentoRendiconto;
  /** Data di cassa (pagamento/incasso effettivo); `null` se non ancora regolato. */
  dataCassa?: string | null;
  /** Inizio competenza (default: `dataCompetenza`, altrimenti `dataCassa`). */
  competenzaDa?: string | null;
  /** Fine competenza (default: `competenzaDa`). */
  competenzaA?: string | null;
  /** Data di competenza puntuale, alternativa al periodo. */
  dataCompetenza?: string | null;
}

export interface VoceRiconciliazioneCassaCompetenza {
  movimentoId: string;
  tipo: TipoVoceRiconciliazione;
  segno: SegnoMovimentoRendiconto;
  importoCent: Centesimi;
  /**
   * Effetto algebrico sulla differenza `risultato di competenza − risultato di cassa`
   * (entrata `+`, uscita `−`).
   */
  effettoCent: Centesimi;
}

export interface RiconciliazioneCassaCompetenza {
  risultatoCassaCent: Centesimi;
  risultatoCompetenzaCent: Centesimi;
  /** `competenza − cassa`. */
  differenzaCent: Centesimi;
  voci: VoceRiconciliazioneCassaCompetenza[];
  creditiCent: Centesimi;
  debitiCent: Centesimi;
  rateiAttiviCent: Centesimi;
  rateiPassiviCent: Centesimi;
  riscontiAttiviCent: Centesimi;
  riscontiPassiviCent: Centesimi;
  riscontiPregressiCent: Centesimi;
  regolazioniPregresseCent: Centesimi;
  /** `Σ effetti delle voci = differenza competenza − cassa`. */
  quadra: boolean;
}

export interface RiconciliaCassaCompetenzaInput {
  inizioEsercizio: string;
  fineEsercizio: string;
  movimenti: readonly MovimentoCassaCompetenzaInput[];
}

/**
 * Riconcilia la vista di cassa con quella di competenza (RC-K5, Cass. 25446/2025): ogni movimento ha data di
 * cassa e data di competenza; la differenza tra i due risultati è interamente spiegata da crediti, debiti,
 * ratei, risconti e regolazioni di competenze di altri esercizi, rilevati automaticamente.
 */
export function riconciliaCassaCompetenza(
  input: RiconciliaCassaCompetenzaInput,
): RiconciliazioneCassaCompetenza {
  const { inizioEsercizio: inizio, fineEsercizio: fine } = input;
  if (parseDataIso(fine) < parseDataIso(inizio)) {
    throw new RangeError('La fine esercizio non può precedere l’inizio.');
  }

  let risultatoCassaCent = 0;
  let risultatoCompetenzaCent = 0;
  const voci: VoceRiconciliazioneCassaCompetenza[] = [];

  for (const m of input.movimenti) {
    const imp = importoPositivo(m.importoCent, `Movimento ${m.id}`);
    if (m.segno !== '+' && m.segno !== '-') {
      throw new RangeError(`Segno movimento non valido per ${m.id}: "${String(m.segno)}".`);
    }
    const s = m.segno === '+' ? 1 : -1;
    const da = (m.competenzaDa ?? m.dataCompetenza ?? m.dataCassa ?? inizio).slice(0, 10);
    const a = (m.competenzaA ?? m.dataCompetenza ?? da).slice(0, 10);
    if (parseDataIso(a) < parseDataIso(da)) {
      throw new RangeError(`Periodo di competenza non valido per ${m.id}: ${da} > ${a}.`);
    }
    const cassa = m.dataCassa ? m.dataCassa.slice(0, 10) : null;

    // Ripartizione pro-die della competenza: prima / dentro / dopo l'esercizio
    const giorniTot = giorniInclusivi(da, a);
    const giorniPrimaEff =
      da < inizio ? giorniInclusivi(da, aggiungiGiorniIso(inizio, -1) < a ? aggiungiGiorniIso(inizio, -1) : a) : 0;
    const ovDa = da > inizio ? da : inizio;
    const ovA = a < fine ? a : fine;
    const giorniIn = ovA >= ovDa ? giorniInclusivi(ovDa, ovA) : 0;
    const quotaPrimaCent = dividiEArrotondaHalfUp(BigInt(imp) * BigInt(giorniPrimaEff), BigInt(giorniTot));
    const quotaInCent = dividiEArrotondaHalfUp(BigInt(imp) * BigInt(giorniIn), BigInt(giorniTot));
    const quotaDopoCent = imp - quotaPrimaCent - quotaInCent;

    const cassaInEsercizio = cassa !== null && cassa >= inizio && cassa <= fine;
    const cassaPrima = cassa !== null && cassa < inizio;
    const entrata = m.segno === '+';

    if (cassaInEsercizio) risultatoCassaCent += s * imp;
    risultatoCompetenzaCent += s * quotaInCent;

    const aggiungi = (tipo: TipoVoceRiconciliazione, importoCent: Centesimi, effettoCent: Centesimi): void => {
      if (importoCent <= 0) return;
      voci.push({ movimentoId: m.id, tipo, segno: m.segno, importoCent, effettoCent });
    };

    if (cassaInEsercizio) {
      // Cassa nell'esercizio, parte della competenza fuori: regolazione pregressa o risconto
      aggiungi('REGOLAZIONE_PREGRESSA', quotaPrimaCent, -s * quotaPrimaCent);
      aggiungi(entrata ? 'RISCONTO_PASSIVO' : 'RISCONTO_ATTIVO', quotaDopoCent, -s * quotaDopoCent);
    } else if (cassaPrima) {
      // Regolato in un esercizio precedente per competenza (anche) di questo
      aggiungi('RISCONTO_PREGRESSO', quotaInCent, s * quotaInCent);
    } else if (quotaInCent > 0) {
      // Non ancora regolato a fine esercizio
      const periodoOltreFine = a > fine;
      const tipo: TipoVoceRiconciliazione = periodoOltreFine
        ? entrata
          ? 'RATEO_ATTIVO'
          : 'RATEO_PASSIVO'
        : entrata
          ? 'CREDITO'
          : 'DEBITO';
      aggiungi(tipo, quotaInCent, s * quotaInCent);
    }
  }

  const somma = (tipo: TipoVoceRiconciliazione): Centesimi =>
    voci.filter((v) => v.tipo === tipo).reduce((acc, v) => acc + v.importoCent, 0);
  const differenzaCent = risultatoCompetenzaCent - risultatoCassaCent;
  const sommaEffetti = voci.reduce((acc, v) => acc + v.effettoCent, 0);

  return {
    risultatoCassaCent,
    risultatoCompetenzaCent,
    differenzaCent,
    voci,
    creditiCent: somma('CREDITO'),
    debitiCent: somma('DEBITO'),
    rateiAttiviCent: somma('RATEO_ATTIVO'),
    rateiPassiviCent: somma('RATEO_PASSIVO'),
    riscontiAttiviCent: somma('RISCONTO_ATTIVO'),
    riscontiPassiviCent: somma('RISCONTO_PASSIVO'),
    riscontiPregressiCent: somma('RISCONTO_PREGRESSO'),
    regolazioniPregresseCent: somma('REGOLAZIONE_PREGRESSA'),
    quadra: sommaEffetti === differenzaCent,
  };
}

// ============================================================================
// 4. CONGUAGLIO INDIVIDUALE E AGGREGATO (RC-L1, RC-L2, T5)
// ============================================================================

export interface UnitaConguaglioInput {
  unitaId: string;
  soggettoId?: string | null;
  utenteId?: string | null;
  gestioneId?: string | null;
  periodoDa?: string;
  periodoA?: string;
  quotaConsuntivoCent: CentesimiInput;
  rateVersateCent: CentesimiInput;
}

export interface ConguaglioUnitaCalcolato extends RisultatoConguaglio {
  unitaId: string;
  soggettoId: string | null;
  utenteId: string | null;
  periodoDa: string | null;
  periodoA: string | null;
}

export interface ConguaglioAggregatoSoggetto {
  /** Chiave di aggregazione: `soggettoId` oppure `unita:<id>` se la titolarità non ha soggetto. */
  chiave: string;
  soggettoId: string | null;
  gestioneId: string | null;
  quotaConsuntivoCent: Centesimi;
  rateVersateCent: Centesimi;
  conguaglioCent: Centesimi;
  tipo: 'DEBITO' | 'CREDITO' | 'PAREGGIO';
  debitoCent: Centesimi;
  creditoCent: Centesimi;
  dettaglioUnita: ConguaglioUnitaCalcolato[];
}

export interface RisultatoConguagliEsercizio {
  perUnita: ConguaglioUnitaCalcolato[];
  aggregatiPerSoggetto: ConguaglioAggregatoSoggetto[];
  totaleQuotaConsuntivoCent: Centesimi;
  totaleRateVersateCent: Centesimi;
  totaleDebitiCent: Centesimi;
  totaleCreditiCent: Centesimi;
  saldoNettoCent: Centesimi;
}

/** Conguaglio individuale di un'unità: `quota di consuntivo − rate versate` (RC-L1, T5: 1.340 − 1.200 = debito 140). */
export function calcolaConguaglioUnita(input: UnitaConguaglioInput): ConguaglioUnitaCalcolato {
  const base = calcolaConguaglio({
    quotaConsuntivoCent: input.quotaConsuntivoCent,
    rateVersateCent: input.rateVersateCent,
    gestioneId: input.gestioneId ?? undefined,
    unitaId: input.unitaId,
  });
  return {
    ...base,
    unitaId: input.unitaId,
    soggettoId: input.soggettoId ?? null,
    utenteId: input.utenteId ?? null,
    periodoDa: input.periodoDa ?? null,
    periodoA: input.periodoA ?? null,
  };
}

/**
 * Calcola i conguagli di tutte le unità e li aggrega per soggetto e gestione (RC-L1: separato per gestione;
 * RC-L2: un soggetto con più unità riceve un conguaglio aggregato con dettaglio per unità).
 */
export function calcolaConguagliEsercizio(
  unita: readonly UnitaConguaglioInput[],
): RisultatoConguagliEsercizio {
  const perUnita = unita.map(calcolaConguaglioUnita);
  const gruppi = new Map<string, ConguaglioAggregatoSoggetto>();

  for (const c of perUnita) {
    const chiaveSoggetto = c.soggettoId ?? `unita:${c.unitaId}`;
    const chiave = `${chiaveSoggetto}|${c.gestioneId ?? ''}`;
    let g = gruppi.get(chiave);
    if (!g) {
      g = {
        chiave: chiaveSoggetto,
        soggettoId: c.soggettoId,
        gestioneId: c.gestioneId,
        quotaConsuntivoCent: 0,
        rateVersateCent: 0,
        conguaglioCent: 0,
        tipo: 'PAREGGIO',
        debitoCent: 0,
        creditoCent: 0,
        dettaglioUnita: [],
      };
      gruppi.set(chiave, g);
    }
    g.quotaConsuntivoCent += c.quotaConsuntivoCent;
    g.rateVersateCent += c.rateVersateCent;
    g.dettaglioUnita.push(c);
  }

  const aggregatiPerSoggetto = [...gruppi.values()].map((g) => {
    const conguaglioCent = g.quotaConsuntivoCent - g.rateVersateCent;
    return {
      ...g,
      conguaglioCent,
      tipo: conguaglioCent > 0 ? ('DEBITO' as const) : conguaglioCent < 0 ? ('CREDITO' as const) : ('PAREGGIO' as const),
      debitoCent: conguaglioCent > 0 ? conguaglioCent : 0,
      creditoCent: conguaglioCent < 0 ? -conguaglioCent : 0,
    };
  });

  const totaleQuotaConsuntivoCent = perUnita.reduce((a, c) => a + c.quotaConsuntivoCent, 0);
  const totaleRateVersateCent = perUnita.reduce((a, c) => a + c.rateVersateCent, 0);
  return {
    perUnita,
    aggregatiPerSoggetto,
    totaleQuotaConsuntivoCent,
    totaleRateVersateCent,
    totaleDebitiCent: perUnita.reduce((a, c) => a + c.debitoCent, 0),
    totaleCreditiCent: perUnita.reduce((a, c) => a + c.creditoCent, 0),
    saldoNettoCent: totaleQuotaConsuntivoCent - totaleRateVersateCent,
  };
}

// ============================================================================
// 4-bis. REGOLAZIONE DEL CREDITO DI CONGUAGLIO (RC-L5)
// ============================================================================

export type ScelteRegolazioneConguaglio = 'COMPENSAZIONE_PRIMA_RATA' | 'RIMBORSO';

export interface PianificaRegolazioneConguaglioInput {
  conguaglioCent: CentesimiInput;
  scelta: ScelteRegolazioneConguaglio;
  /** Prima rata dell'esercizio successivo (obbligatoria per la compensazione). */
  primaRataSuccessiva?: { id: string; importoDovutoCent: CentesimiInput } | null;
  conguaglioId?: string | null;
  condominioId?: string | null;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface RegolazioneConguaglioPianificata {
  modalitaRegolazione: 'COMPENSATO_RATA' | 'RIMBORSATO' | 'RIPORTATO_NUOVO_ESERCIZIO';
  creditoCent: Centesimi;
  importoCompensatoCent: Centesimi;
  importoRimborsatoCent: Centesimi;
  /** Credito non assorbito dalla prima rata, riportato sulle rate successive. */
  residuoRiportatoCent: Centesimi;
  rataCompensazioneId: string | null;
  nuovoImportoPrimaRataCent: Centesimi | null;
  eventoAudit: EventoAuditContabile;
}

/**
 * Pianifica la regolazione di un credito di conguaglio (RC-L5): compensazione sulla prima rata dell'esercizio
 * successivo oppure rimborso, a scelta dell'amministratore. L'operazione è tracciata con un evento di audit.
 */
export function pianificaRegolazioneConguaglio(
  input: PianificaRegolazioneConguaglioInput,
): RegolazioneConguaglioPianificata {
  const conguaglio = normalizzaCentesimi(input.conguaglioCent);
  if (conguaglio >= 0) {
    throw new ErroreRegolazioneConguaglio(
      'Solo un credito di conguaglio (saldo negativo) può essere compensato o rimborsato (RC-L5).',
    );
  }
  const creditoCent = -conguaglio;
  let modalitaRegolazione: RegolazioneConguaglioPianificata['modalitaRegolazione'];
  let importoCompensatoCent = 0;
  let importoRimborsatoCent = 0;
  let residuoRiportatoCent = 0;
  let rataCompensazioneId: string | null = null;
  let nuovoImportoPrimaRataCent: Centesimi | null = null;

  if (input.scelta === 'RIMBORSO') {
    modalitaRegolazione = 'RIMBORSATO';
    importoRimborsatoCent = creditoCent;
  } else if (input.scelta === 'COMPENSAZIONE_PRIMA_RATA') {
    if (!input.primaRataSuccessiva) {
      throw new ErroreRegolazioneConguaglio(
        "Compensazione impossibile: manca la prima rata dell'esercizio successivo (RC-L5). Scegliere il rimborso.",
      );
    }
    const rata = importoPositivo(input.primaRataSuccessiva.importoDovutoCent, 'Prima rata successiva');
    importoCompensatoCent = Math.min(creditoCent, rata);
    residuoRiportatoCent = creditoCent - importoCompensatoCent;
    rataCompensazioneId = input.primaRataSuccessiva.id;
    nuovoImportoPrimaRataCent = rata - importoCompensatoCent;
    modalitaRegolazione = residuoRiportatoCent > 0 ? 'RIPORTATO_NUOVO_ESERCIZIO' : 'COMPENSATO_RATA';
  } else {
    throw new ErroreRegolazioneConguaglio(`Scelta di regolazione non valida: "${String(input.scelta)}".`);
  }

  const timestampIso = input.timestampIso ?? new Date().toISOString();
  const eventoAudit: EventoAuditContabile = {
    azione: input.scelta === 'RIMBORSO' ? 'RIMBORSO_CREDITO_CONGUAGLIO' : 'COMPENSAZIONE_CREDITO_CONGUAGLIO',
    tabella: 'conguagli_unita',
    recordId: input.conguaglioId ?? null,
    condominioId: input.condominioId ?? null,
    autoreId: input.autoreId ?? null,
    timestampIso,
    motivo: `Regolazione credito di conguaglio di ${eur(creditoCent)} (RC-L5)`,
    valorePrima: { modalita_regolazione: 'DA_REGOLARE', saldo_conguaglio_centesimi: conguaglio },
    valoreDopo: {
      modalita_regolazione: modalitaRegolazione,
      importo_compensato_centesimi: importoCompensatoCent,
      importo_rimborsato_centesimi: importoRimborsatoCent,
      residuo_riportato_centesimi: residuoRiportatoCent,
      rata_compensazione_id: rataCompensazioneId,
    },
  };

  return {
    modalitaRegolazione,
    creditoCent,
    importoCompensatoCent,
    importoRimborsatoCent,
    residuoRiportatoCent,
    rataCompensazioneId,
    nuovoImportoPrimaRataCent,
    eventoAudit,
  };
}

// ============================================================================
// 5. SCADENZA E PROMEMORIA DI APPROVAZIONE ENTRO 180 GIORNI (RC-K8)
// ============================================================================

/** Scadenza per convocare l'assemblea di approvazione: chiusura esercizio + 180 giorni (art. 1130 n. 10 c.c.). */
export function calcolaScadenzaApprovazioneRendiconto(dataChiusuraEsercizio: string): string {
  return aggiungiGiorniIso(dataChiusuraEsercizio, GIORNI_TERMINE_APPROVAZIONE_RENDICONTO);
}

export interface ValutaPromemoriaApprovazioneInput {
  /** Data di chiusura dell'esercizio (di norma `data_fine`). */
  dataChiusuraEsercizio: string;
  /** Data odierna `YYYY-MM-DD`. */
  oggi: string;
  statoRendiconto?: StatoRendiconto | null;
}

export interface PromemoriaApprovazioneRendiconto {
  scadenza: string;
  giorniResidui: number;
  scaduto: boolean;
  /** Il promemoria non serve se il rendiconto è già approvato. */
  attivo: boolean;
  /** Soglia raggiunta (60, 30 o 7 giorni) o `null` se nessun alert è dovuto. */
  soglia: SogliaPromemoriaApprovazione | null;
  livello: 'NESSUNO' | 'INFO' | 'ATTENZIONE' | 'URGENTE' | 'SCADUTO';
  messaggio: string | null;
}

/**
 * Valuta il promemoria sull'obbligo di convocazione dell'assemblea entro 180 giorni dalla chiusura
 * (RC-K8, art. 1130 n. 10 c.c.): alert a 60, 30 e 7 giorni dalla scadenza.
 */
export function valutaPromemoriaApprovazioneRendiconto(
  input: ValutaPromemoriaApprovazioneInput,
): PromemoriaApprovazioneRendiconto {
  const scadenza = calcolaScadenzaApprovazioneRendiconto(input.dataChiusuraEsercizio);
  const giorniResidui = differenzaGiorniIso(input.oggi, scadenza);
  const approvato = input.statoRendiconto === 'APPROVATO';
  const scaduto = giorniResidui < 0;

  if (approvato) {
    return { scadenza, giorniResidui, scaduto: false, attivo: false, soglia: null, livello: 'NESSUNO', messaggio: null };
  }
  if (scaduto) {
    return {
      scadenza,
      giorniResidui,
      scaduto: true,
      attivo: true,
      soglia: null,
      livello: 'SCADUTO',
      messaggio: `Termine di 180 giorni per l'approvazione del rendiconto scaduto da ${-giorniResidui} giorni (scadenza ${scadenza}, art. 1130 n. 10 c.c.).`,
    };
  }
  // Soglia più stretta raggiunta (es. 25 giorni residui -> 30)
  const soglie = [...SOGLIE_PROMEMORIA_APPROVAZIONE].sort((x, y) => x - y);
  const soglia = soglie.find((s) => giorniResidui <= s) ?? null;
  if (soglia === null) {
    return { scadenza, giorniResidui, scaduto: false, attivo: true, soglia: null, livello: 'NESSUNO', messaggio: null };
  }
  const livello = soglia === 7 ? 'URGENTE' : soglia === 30 ? 'ATTENZIONE' : 'INFO';
  return {
    scadenza,
    giorniResidui,
    scaduto: false,
    attivo: true,
    soglia,
    livello,
    messaggio: `Mancano ${giorniResidui} giorni alla scadenza (${scadenza}) per convocare l'assemblea di approvazione del rendiconto (art. 1130 n. 10 c.c.).`,
  };
}

// ============================================================================
// 6. STATI, TRANSIZIONI E BLOCCO MODIFICHE (RC-K7, RC-L6)
// ============================================================================

const TRANSIZIONI_RENDICONTO: Record<StatoRendiconto, readonly StatoRendiconto[]> = {
  IN_PREPARAZIONE: ['COMPLETO'],
  COMPLETO: ['IN_PREPARAZIONE', 'APPROVATO'],
  APPROVATO: ['RETTIFICATO'],
  RETTIFICATO: ['APPROVATO'],
};

/** `true` se il rendiconto è modificabile: lo stato `APPROVATO` è immodificabile (RC-K7). */
export function isRendicontoModificabile(stato: StatoRendiconto | null | undefined): boolean {
  return stato !== 'APPROVATO';
}

/** Blocca ogni modifica a un rendiconto `APPROVATO` (RC-K7). */
export function assertRendicontoModificabile(
  stato: StatoRendiconto | null | undefined,
  operazione?: string,
): void {
  if (!isRendicontoModificabile(stato)) {
    throw new ErroreRendicontoApprovatoImmodificabile(operazione);
  }
}

export function isTransizioneRendicontoValida(da: StatoRendiconto, a: StatoRendiconto): boolean {
  return TRANSIZIONI_RENDICONTO[da].includes(a);
}

export function assertTransizioneRendicontoValida(da: StatoRendiconto, a: StatoRendiconto): void {
  if (!isTransizioneRendicontoValida(da, a)) {
    throw new ErroreTransizioneRendicontoNonValida(da, a);
  }
}

// ============================================================================
// 7. CHIUSURA ESERCIZIO E APPROVAZIONE DEL RENDICONTO
// ============================================================================

export interface PreparaChiusuraEsercizioInput {
  dataFineEsercizio: string;
  statoModello?: 'APERTO' | 'CHIUSO' | 'RENDICONTO_APPROVATO' | null;
  dataChiusuraEffettiva?: string;
}

export interface ChiusuraEsercizioPreparata {
  dataChiusuraEffettiva: string;
  scadenzaApprovazione180gg: string;
  statoModello: 'CHIUSO';
  statoRendiconto: 'IN_PREPARAZIONE';
}

/** Valida e prepara la chiusura dell'esercizio con calcolo della scadenza dei 180 giorni (RC-K8). */
export function preparaChiusuraEsercizio(input: PreparaChiusuraEsercizioInput): ChiusuraEsercizioPreparata {
  if (input.statoModello === 'CHIUSO' || input.statoModello === 'RENDICONTO_APPROVATO') {
    throw new ErroreChiusuraEsercizio("L'esercizio è già chiuso.");
  }
  const dataChiusuraEffettiva = (input.dataChiusuraEffettiva ?? input.dataFineEsercizio).slice(0, 10);
  if (parseDataIso(dataChiusuraEffettiva) < parseDataIso(input.dataFineEsercizio)) {
    throw new ErroreChiusuraEsercizio(
      `L'esercizio non può essere chiuso prima della sua fine (${input.dataFineEsercizio}).`,
    );
  }
  return {
    dataChiusuraEffettiva,
    scadenzaApprovazione180gg: calcolaScadenzaApprovazioneRendiconto(input.dataFineEsercizio),
    statoModello: 'CHIUSO',
    statoRendiconto: 'IN_PREPARAZIONE',
  };
}

export interface PreparaApprovazioneRendicontoInput {
  statoRendiconto: StatoRendiconto;
  completezza: ValidaCompletezzaRendicontoInput;
  dataAssemblea: string;
  deliberaApprovazione: string;
  dataChiusuraEsercizio: string;
  esercizioId?: string | null;
  condominioId?: string | null;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface ApprovazioneRendicontoPreparata {
  statoRendiconto: 'APPROVATO';
  statoModello: 'RENDICONTO_APPROVATO';
  dataApprovazione: string;
  deliberaApprovazione: string;
  /** `true` se l'assemblea si è tenuta oltre i 180 giorni dalla chiusura (RC-K8). */
  tardiva: boolean;
  giorniRitardo: number;
  eventoAudit: EventoAuditContabile;
}

/** Valida l'approvazione del rendiconto in assemblea (RC-K7): solo da `COMPLETO` o `RETTIFICATO`, con delibera e data. */
export function preparaApprovazioneRendiconto(
  input: PreparaApprovazioneRendicontoInput,
): ApprovazioneRendicontoPreparata {
  if (input.statoRendiconto === 'APPROVATO') {
    throw new ErroreRendicontoApprovatoImmodificabile('approvazione già avvenuta');
  }
  assertTransizioneRendicontoValida(input.statoRendiconto, 'APPROVATO');
  assertRendicontoCompleto(input.completezza);
  if (!input.deliberaApprovazione || input.deliberaApprovazione.trim().length === 0) {
    throw new ErroreApprovazioneRendiconto('La delibera di approvazione è obbligatoria (RC-K7).');
  }
  const dataApprovazione = input.dataAssemblea.slice(0, 10);
  if (parseDataIso(dataApprovazione) < parseDataIso(input.dataChiusuraEsercizio)) {
    throw new ErroreApprovazioneRendiconto(
      "La data dell'assemblea non può precedere la chiusura dell'esercizio (RC-K7).",
    );
  }
  const scadenza = calcolaScadenzaApprovazioneRendiconto(input.dataChiusuraEsercizio);
  const giorniRitardo = Math.max(0, differenzaGiorniIso(scadenza, dataApprovazione));
  return {
    statoRendiconto: 'APPROVATO',
    statoModello: 'RENDICONTO_APPROVATO',
    dataApprovazione,
    deliberaApprovazione: input.deliberaApprovazione.trim(),
    tardiva: giorniRitardo > 0,
    giorniRitardo,
    eventoAudit: {
      azione: 'APPROVAZIONE_RENDICONTO',
      tabella: 'esercizi_contabili',
      recordId: input.esercizioId ?? null,
      condominioId: input.condominioId ?? null,
      autoreId: input.autoreId ?? null,
      timestampIso: input.timestampIso ?? new Date().toISOString(),
      motivo: `Approvazione rendiconto in assemblea del ${dataApprovazione} (${input.deliberaApprovazione.trim()})`,
      valorePrima: { stato_rendiconto: input.statoRendiconto },
      valoreDopo: {
        stato_rendiconto: 'APPROVATO',
        data_approvazione_rendiconto: dataApprovazione,
        tardiva: giorniRitardo > 0,
        giorni_ritardo: giorniRitardo,
      },
    },
  };
}

export interface PreparaRettificaRendicontoInput {
  statoRendiconto: StatoRendiconto;
  motivo: string;
  esercizioId?: string | null;
  condominioId?: string | null;
  autoreId?: string | null;
  timestampIso?: string;
}

/** Avvia la rettifica di un rendiconto approvato (RC-K7, RC-L6): richiede motivo e nuova approvazione. */
export function preparaRettificaRendiconto(input: PreparaRettificaRendicontoInput): {
  statoRendiconto: 'RETTIFICATO';
  eventoAudit: EventoAuditContabile;
} {
  assertTransizioneRendicontoValida(input.statoRendiconto, 'RETTIFICATO');
  if (!input.motivo || input.motivo.trim().length === 0) {
    throw new ErroreApprovazioneRendiconto('Il motivo della rettifica è obbligatorio (RC-L6).');
  }
  return {
    statoRendiconto: 'RETTIFICATO',
    eventoAudit: {
      azione: 'RETTIFICA_RENDICONTO',
      tabella: 'esercizi_contabili',
      recordId: input.esercizioId ?? null,
      condominioId: input.condominioId ?? null,
      autoreId: input.autoreId ?? null,
      timestampIso: input.timestampIso ?? new Date().toISOString(),
      motivo: input.motivo.trim(),
      valorePrima: { stato_rendiconto: input.statoRendiconto },
      valoreDopo: { stato_rendiconto: 'RETTIFICATO' },
    },
  };
}
