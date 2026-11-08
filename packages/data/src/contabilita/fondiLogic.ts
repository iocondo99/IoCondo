/**
 * Logica pura per la Gestione Contabile dei Fondi Condominiali (Fondo Speciale Lavori,
 * Fondo Cassa/Riserva, Fondo Morosità), il Blocco Legale all'Emissione di Rate Straordinarie
 * ex art. 1135 c. 1 n. 4 c.c., la Costituzione Progressiva per SAL, il Vincolo di Destinazione
 * con Override Tracciato e il Divieto Assoluto di Utilizzo per il Compenso dell'Amministratore
 * (Sezione 8: RC-J1..J5; Sezione 10: T7).
 *
 * Principi fondamentali:
 * - Nessun decimale in virgola mobile per gli importi: tutti i valori monetari sono in centesimi interi (`Centesimi`).
 * - RC-J1: Fondi con saldo e movimenti (`SPECIALE` per lavori straordinari deliberati, `CASSA` o riserva,
 *   `MOROSITA` opzionale).
 * - RC-J2 & T7: Per lavori straordinari o innovazioni l'assemblea deve costituire obbligatoriamente un
 *   fondo speciale di importo pari all'ammontare dei lavori (art. 1135, c. 1, n. 4 c.c.). Una delibera con
 *   fondo di importo parziale è nulla secondo la giurisprudenza. Il sistema impedisce di emettere rate
 *   straordinarie se mancano l'importo dei lavori deliberati o il fondo speciale costituito per l'intero importo.
 * - RC-J3: Se il contratto d'appalto prevede pagamenti graduali (SAL), il fondo si costituisce in modo
 *   progressivo in corrispondenza dei pagamenti previsti dal contratto.
 * - RC-J4: Le somme del fondo sono vincolate alla destinazione deliberata. Spostarle ad altra destinazione
 *   richiede un override esplicito con motivo e delibera assembleare, tracciato in audit (`audit_logs`).
 *   È **SEMPRE VIETATO** (anche con override) usare le somme di un fondo per pagare il compenso dell'amministratore.
 * - RC-J5: Il fondo è una voce contabile, non un conto corrente bancario aggiuntivo: resta un solo conto condominiale.
 * - Nessuna dipendenza da React, Expo, `Intl` o Supabase.
 */

import {
  centsToEuro,
  normalizzaCentesimi,
  VERSIONE_MOTORE_CALCOLO,
  type Centesimi,
  type CentesimiInput,
} from './contabilitaLogic.ts';
import type { EventoAuditContabile } from './bollettiniLogic.ts';

// ============================================================================
// COSTANTI E TIPI DI DOMINIO (SEZIONE 8: RC-J1..J5, T7)
// ============================================================================

export const TIPI_FONDO = ['SPECIALE', 'CASSA', 'MOROSITA'] as const;
export type TipoFondo = (typeof TIPI_FONDO)[number];

export const STATI_FONDO = ['ATTIVO', 'VINCOLATO', 'CHIUSO'] as const;
export type StatoFondo = (typeof STATI_FONDO)[number];

export const SEGNI_MOVIMENTO_FONDO = ['+', '-'] as const;
export type SegnoMovimentoFondo = (typeof SEGNI_MOVIMENTO_FONDO)[number];

export class ErroreFondoSpecialeNonCostituito extends Error {
  readonly codice = 'FONDO_SPECIALE_NON_COSTITUITO_ART_1135' as const;
  readonly emissioneBloccata = true;
  readonly importoLavoriRichiestoCent: Centesimi;
  readonly importoFondoCostituitoCent: Centesimi;

  constructor(
    messaggio: string,
    importoLavoriRichiestoCent: Centesimi = 0,
    importoFondoCostituitoCent: Centesimi = 0,
  ) {
    super(messaggio);
    this.name = 'ErroreFondoSpecialeNonCostituito';
    this.importoLavoriRichiestoCent = importoLavoriRichiestoCent;
    this.importoFondoCostituitoCent = importoFondoCostituitoCent;
  }
}

export class ErroreDivietoCompensoAdminFondo extends Error {
  readonly codice = 'DIVIETO_COMPENSO_ADMIN_FONDO_RC_J4' as const;
  readonly operazioneBloccata = true;

  constructor(
    messaggio: string = "Divieto assoluto ex RC-J4: le somme dei fondi condominiali non possono mai essere utilizzate per pagare il compenso dell'amministratore, nemmeno con override assembleare.",
  ) {
    super(messaggio);
    this.name = 'ErroreDivietoCompensoAdminFondo';
  }
}

export class ErroreVincoloDestinazioneFondo extends Error {
  readonly codice = 'VINCOLO_DESTINAZIONE_FONDO_RC_J4' as const;
  readonly operazioneBloccata = true;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreVincoloDestinazioneFondo';
  }
}

export class ErroreCapienzaFondoInsufficiente extends Error {
  readonly codice = 'CAPIENZA_FONDO_INSUFFICIENTE' as const;
  readonly saldoDisponibileCent: Centesimi;
  readonly importoRichiestoCent: Centesimi;

  constructor(
    messaggio: string,
    saldoDisponibileCent: Centesimi,
    importoRichiestoCent: Centesimi,
  ) {
    super(messaggio);
    this.name = 'ErroreCapienzaFondoInsufficiente';
    this.saldoDisponibileCent = saldoDisponibileCent;
    this.importoRichiestoCent = importoRichiestoCent;
  }
}

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

// ============================================================================
// 1. CREAZIONE E VALIDAZIONE FONDI CONDOMINIALI (RC-J1, RC-J2, RC-J3, RC-J5)
// ============================================================================

export interface FondoRecordInput {
  id: string;
  condominio_id: string;
  esercizio_id?: string | null;
  nome: string;
  tipo: TipoFondo;
  delibera_costituzione?: string | null;
  data_delibera?: string | null;
  importo_lavori_centesimi?: CentesimiInput | null;
  importo_obiettivo_centesimi: CentesimiInput;
  saldo_attuale_centesimi: CentesimiInput;
  is_progressivo_sal?: boolean;
  contratto_appalto_ref?: string | null;
  stato?: StatoFondo;
  autore_id?: string | null;
}

export interface CreaFondoInput {
  id?: string;
  condominioId: string;
  esercizioId?: string | null;
  nome: string;
  tipo: TipoFondo;
  deliberaCostituzione?: string | null;
  dataDelibera?: string | null;
  /** Importo complessivo dei lavori straordinari deliberati (obbligatorio per `tipo === 'SPECIALE'`, RC-J2, T7). */
  importoLavoriCent?: CentesimiInput | null;
  /** Importo obiettivo del fondo (per `SPECIALE` deve essere `>= importoLavoriCent`, art. 1135 c. 1 n. 4 c.c., RC-J2, T7). */
  importoObiettivoCent?: CentesimiInput;
  saldoInizialeCent?: CentesimiInput;
  /** Flag di costituzione progressiva per Stati Avanzamento Lavori (SAL) collegata al contratto d'appalto (RC-J3). */
  isProgressivoSal?: boolean;
  contrattoAppaltoRef?: string | null;
  stato?: StatoFondo;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface CreaFondoOutput {
  fondo: {
    condominio_id: string;
    esercizio_id: string | null;
    nome: string;
    tipo: TipoFondo;
    delibera_costituzione: string | null;
    data_delibera: string | null;
    importo_lavori_centesimi: Centesimi | null;
    importo_obiettivo_centesimi: Centesimi;
    saldo_attuale_centesimi: Centesimi;
    is_progressivo_sal: boolean;
    contratto_appalto_ref: string | null;
    stato: StatoFondo;
    autore_id: string | null;
  };
  /** Per RC-J5 il fondo è sempre una voce contabile e non apre un conto corrente bancario separato. */
  isVoceContabileNonContoBancario: true;
  eventoAudit: EventoAuditContabile;
}

/**
 * Valida e costruisce un nuovo fondo condominiale (`SPECIALE`, `CASSA`, `MOROSITA`, RC-J1..J5, T7).
 * - Per un fondo `SPECIALE` (art. 1135, c. 1, n. 4 c.c.) impone che siano presenti la delibera assembleare,
 *   l'importo dei lavori deliberati (`> 0`) e un importo obiettivo del fondo almeno pari all'intero importo
 *   dei lavori deliberati (RC-J2, T7).
 * - Se `isProgressivoSal === true`, impone il riferimento al contratto d'appalto (`contrattoAppaltoRef`, RC-J3).
 */
export function creaFondo(input: CreaFondoInput): CreaFondoOutput {
  if (!input.condominioId || !input.condominioId.trim()) {
    throw new Error('Il condominioId è obbligatorio per creare un fondo (RC-J1).');
  }
  const nome = (input.nome ?? '').trim();
  if (nome.length < 3) {
    throw new Error('Il nome del fondo deve contenere almeno 3 caratteri (RC-J1).');
  }
  if (!(TIPI_FONDO as readonly string[]).includes(input.tipo)) {
    throw new Error(`Tipo fondo non valido: "${String(input.tipo)}" (atteso SPECIALE, CASSA o MOROSITA).`);
  }

  const saldoInizialeCent = normalizzaCentesimi(input.saldoInizialeCent ?? 0);
  if (saldoInizialeCent < 0) {
    throw new RangeError(`Il saldo iniziale del fondo non può essere negativo: ${saldoInizialeCent}`);
  }

  const delibera = input.deliberaCostituzione?.trim() || null;
  const dataDelibera = input.dataDelibera ? validaDataIso(input.dataDelibera, 'dataDelibera') : null;
  const isProgressivoSal = Boolean(input.isProgressivoSal);
  const contrattoAppaltoRef = input.contrattoAppaltoRef?.trim() || null;

  let importoLavoriCent: Centesimi | null =
    input.importoLavoriCent !== undefined && input.importoLavoriCent !== null
      ? normalizzaCentesimi(input.importoLavoriCent)
      : null;

  let importoObiettivoCent: Centesimi =
    input.importoObiettivoCent !== undefined
      ? normalizzaCentesimi(input.importoObiettivoCent)
      : importoLavoriCent ?? 0;

  if (importoObiettivoCent < 0) {
    throw new RangeError(`L'importo obiettivo del fondo non può essere negativo: ${importoObiettivoCent}`);
  }

  if (input.tipo === 'SPECIALE') {
    if (!delibera || delibera.length < 3) {
      throw new ErroreFondoSpecialeNonCostituito(
        'La costituzione di un Fondo Speciale ex art. 1135 c. 1 n. 4 c.c. richiede obbligatoriamente il riferimento alla delibera assembleare (RC-J1, RC-J2).',
      );
    }
    if (importoLavoriCent === null || importoLavoriCent <= 0) {
      throw new ErroreFondoSpecialeNonCostituito(
        "Per costituire un Fondo Speciale è obbligatorio indicare l'importo dei lavori straordinari deliberati (> 0, art. 1135 c. 1 n. 4 c.c., RC-J2, T7).",
        0,
        importoObiettivoCent,
      );
    }
    if (importoObiettivoCent < importoLavoriCent) {
      throw new ErroreFondoSpecialeNonCostituito(
        `Fondo Speciale insufficiente: per legge (art. 1135 c. 1 n. 4 c.c., RC-J2, T7) il fondo speciale (${centsToEuro(importoObiettivoCent)} €) deve essere pari all'intero importo dei lavori deliberati (${centsToEuro(importoLavoriCent)} €). Una delibera con fondo parziale è nulla.`,
        importoLavoriCent,
        importoObiettivoCent,
      );
    }
    if (isProgressivoSal && !contrattoAppaltoRef) {
      throw new Error(
        "Per un Fondo Speciale a costituzione progressiva per SAL è obbligatorio indicare il riferimento al contratto d'appalto (RC-J3).",
      );
    }
  }

  const stato: StatoFondo =
    input.stato ?? (input.tipo === 'SPECIALE' ? 'VINCOLATO' : 'ATTIVO');

  const fondo = {
    condominio_id: input.condominioId,
    esercizio_id: input.esercizioId ?? null,
    nome,
    tipo: input.tipo,
    delibera_costituzione: delibera,
    data_delibera: dataDelibera,
    importo_lavori_centesimi: importoLavoriCent,
    importo_obiettivo_centesimi: importoObiettivoCent,
    saldo_attuale_centesimi: saldoInizialeCent,
    is_progressivo_sal: isProgressivoSal,
    contratto_appalto_ref: contrattoAppaltoRef,
    stato,
    autore_id: input.autoreId ?? null,
  };

  const eventoAudit: EventoAuditContabile = {
    azione: 'CREAZIONE_FONDO_CONDOMINIALE',
    tabella: 'fondi',
    recordId: input.id ?? null,
    condominioId: input.condominioId,
    autoreId: input.autoreId ?? null,
    timestampIso: input.timestampIso ?? new Date().toISOString(),
    motivo: `Costituzione fondo ${input.tipo} "${nome}"${delibera ? ` (${delibera})` : ''}`,
    valorePrima: null,
    valoreDopo: {
      nome,
      tipo: input.tipo,
      delibera_costituzione: delibera,
      importo_lavori_centesimi: importoLavoriCent,
      importo_obiettivo_centesimi: importoObiettivoCent,
      saldo_attuale_centesimi: saldoInizialeCent,
      is_progressivo_sal: isProgressivoSal,
      contratto_appalto_ref: contrattoAppaltoRef,
      stato,
    },
  };

  return {
    fondo,
    isVoceContabileNonContoBancario: true,
    eventoAudit,
  };
}

// ============================================================================
// 2. BLOCCO LEGALE EMISSIONE RATE STRAORDINARIE EX ART. 1135 C. 1 N. 4 C.C. (RC-J2, RC-J3, T7)
// ============================================================================

export interface ScaglioneSalFondoInput {
  numeroSal: number;
  descrizione?: string;
  importoSalCent: CentesimiInput;
  dataScadenzaPrevista?: string | null;
  costituito?: boolean;
}

export interface ValidaFondoSpecialePerRateStraordinarieInput {
  /** Tipo della gestione: il blocco legale ex art. 1135 c. 1 n. 4 c.c. si applica alle gestioni `STRAORDINARIA`. */
  tipoGestione?: 'ORDINARIA' | 'STRAORDINARIA' | 'RISCALDAMENTO';
  /** Importo totale dei lavori straordinari o innovazioni deliberati dall'assemblea (es. 60.000,00 € = 6_000_000 cent in T7). */
  importoLavoriDeliberatiCent?: CentesimiInput | null;
  /** Fondo speciale associato alla gestione straordinaria (se presente). */
  fondoSpeciale?: {
    id?: string | null;
    tipo?: TipoFondo;
    stato?: StatoFondo;
    deliberaCostituzione?: string | null;
    importoLavoriCent?: CentesimiInput | null;
    importoObiettivoCent?: CentesimiInput | null;
    saldoAttualeCent?: CentesimiInput | null;
    isProgressivoSal?: boolean;
    contrattoAppaltoRef?: string | null;
  } | null;
  /** Flag booleano diretto (per chiamate semplificate come in T7). */
  fondoSpecialeCostituito?: boolean;
  /** Importo del fondo speciale deliberato (per chiamate semplificate come in T7). */
  importoFondoSpecialeDeliberatoCent?: CentesimiInput | null;
  /** Eventuali scaglioni SAL previsti dal contratto d'appalto (RC-J3). */
  scaglioniSal?: readonly ScaglioneSalFondoInput[];
  /** Numero del SAL fino al quale si intendono emettere le rate straordinarie (RC-J3). */
  finoAlSalNumero?: number;
}

export interface RisultatoValidazioneFondoSpecialeRate {
  consentita: boolean;
  emissioneBloccata: boolean;
  codiceBlocco:
    | 'IMPORTO_LAVORI_MANCANTE'
    | 'FONDO_SPECIALE_NON_COSTITUITO'
    | 'FONDO_SPECIALE_PARZIALE_NULLO_ART_1135'
    | 'FONDO_SPECIALE_CHIUSO_O_TIPO_ERRATO'
    | 'CONTRATTO_APPALTO_SAL_MANCANTE'
    | 'COPERTURA_SAL_INSUFFICIENTE'
    | null;
  importoLavoriDeliberatiCent: Centesimi;
  importoFondoDeliberatoCent: Centesimi;
  differenzaMancanteCent: Centesimi;
  isProgressivoSal: boolean;
  riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)';
  errore: string | null;
}

/**
 * Applica il blocco legale all'emissione di rate straordinarie quando il Fondo Speciale
 * ex art. 1135, c. 1, n. 4 c.c. non è stato costituito per l'intero importo dei lavori deliberati (RC-J2, RC-J3, T7).
 *
 * Caso di test T7:
 * - Lavori deliberati `60.000,00 €` (`6_000_000` cent); fondo non costituito (o parziale) ->
 *   `consentita: false`, `emissioneBloccata: true`;
 * - Lavori deliberati `60.000,00 €` (`6_000_000` cent); fondo speciale costituito per `60.000,00 €` ->
 *   `consentita: true`, `emissioneBloccata: false`.
 */
export function validaFondoSpecialePerEmissioneRateStraordinarie(
  input: ValidaFondoSpecialePerRateStraordinarieInput,
): RisultatoValidazioneFondoSpecialeRate {
  const tipoGestione = input.tipoGestione ?? 'STRAORDINARIA';
  if (tipoGestione !== 'STRAORDINARIA') {
    return {
      consentita: true,
      emissioneBloccata: false,
      codiceBlocco: null,
      importoLavoriDeliberatiCent: 0,
      importoFondoDeliberatoCent: 0,
      differenzaMancanteCent: 0,
      isProgressivoSal: false,
      riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
      errore: null,
    };
  }

  const rawLavori =
    input.importoLavoriDeliberatiCent ?? input.fondoSpeciale?.importoLavoriCent ?? null;
  const importoLavoriCent =
    rawLavori !== null && rawLavori !== undefined ? normalizzaCentesimi(rawLavori) : 0;

  if (importoLavoriCent <= 0) {
    return {
      consentita: false,
      emissioneBloccata: true,
      codiceBlocco: 'IMPORTO_LAVORI_MANCANTE',
      importoLavoriDeliberatiCent: 0,
      importoFondoDeliberatoCent: 0,
      differenzaMancanteCent: 0,
      isProgressivoSal: false,
      riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
      errore:
        "Emissione rate straordinarie bloccata: manca l'importo dei lavori straordinari deliberati dall'assemblea (art. 1135 c. 1 n. 4 c.c., RC-J2, T7).",
    };
  }

  const haFondoOggetto = Boolean(input.fondoSpeciale);
  if (input.fondoSpeciale) {
    if (input.fondoSpeciale.tipo && input.fondoSpeciale.tipo !== 'SPECIALE') {
      return {
        consentita: false,
        emissioneBloccata: true,
        codiceBlocco: 'FONDO_SPECIALE_CHIUSO_O_TIPO_ERRATO',
        importoLavoriDeliberatiCent: importoLavoriCent,
        importoFondoDeliberatoCent: 0,
        differenzaMancanteCent: importoLavoriCent,
        isProgressivoSal: false,
        riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
        errore: `Emissione rate straordinarie bloccata: il fondo associato è di tipo "${input.fondoSpeciale.tipo}" anziché "SPECIALE" (RC-J2).`,
      };
    }
    if (input.fondoSpeciale.stato === 'CHIUSO') {
      return {
        consentita: false,
        emissioneBloccata: true,
        codiceBlocco: 'FONDO_SPECIALE_CHIUSO_O_TIPO_ERRATO',
        importoLavoriDeliberatiCent: importoLavoriCent,
        importoFondoDeliberatoCent: 0,
        differenzaMancanteCent: importoLavoriCent,
        isProgressivoSal: false,
        riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
        errore:
          'Emissione rate straordinarie bloccata: il Fondo Speciale associato risulta in stato "CHIUSO" (RC-J2).',
      };
    }
  }

  const rawFondoImporto =
    input.importoFondoSpecialeDeliberatoCent ??
    input.fondoSpeciale?.importoObiettivoCent ??
    (input.fondoSpecialeCostituito === true ? importoLavoriCent : null);

  const importoFondoDeliberatoCent =
    rawFondoImporto !== null && rawFondoImporto !== undefined
      ? normalizzaCentesimi(rawFondoImporto)
      : 0;

  const isCostituito =
    input.fondoSpecialeCostituito === false
      ? false
      : haFondoOggetto ||
        input.fondoSpecialeCostituito === true ||
        importoFondoDeliberatoCent > 0;

  if (!isCostituito || importoFondoDeliberatoCent <= 0) {
    return {
      consentita: false,
      emissioneBloccata: true,
      codiceBlocco: 'FONDO_SPECIALE_NON_COSTITUITO',
      importoLavoriDeliberatiCent: importoLavoriCent,
      importoFondoDeliberatoCent: 0,
      differenzaMancanteCent: importoLavoriCent,
      isProgressivoSal: false,
      riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
      errore:
        `Emissione rate straordinarie bloccata: per lavori straordinari di ${centsToEuro(importoLavoriCent)} € ` +
        `l'assemblea deve obbligatoriamente costituire un Fondo Speciale di pari importo ex art. 1135 c. 1 n. 4 c.c. (RC-J2, T7).`,
    };
  }

  if (importoFondoDeliberatoCent < importoLavoriCent) {
    const diff = normalizzaCentesimi(importoLavoriCent - importoFondoDeliberatoCent);
    return {
      consentita: false,
      emissioneBloccata: true,
      codiceBlocco: 'FONDO_SPECIALE_PARZIALE_NULLO_ART_1135',
      importoLavoriDeliberatiCent: importoLavoriCent,
      importoFondoDeliberatoCent,
      differenzaMancanteCent: diff,
      isProgressivoSal: Boolean(input.fondoSpeciale?.isProgressivoSal),
      riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
      errore:
        `Emissione rate straordinarie bloccata: il Fondo Speciale deliberato (${centsToEuro(importoFondoDeliberatoCent)} €) ` +
        `è inferiore all'importo complessivo dei lavori (${centsToEuro(importoLavoriCent)} €, mancano ${centsToEuro(diff)} €). ` +
        `Una delibera con fondo speciale di importo parziale è affetta da nullità ex art. 1135 c. 1 n. 4 c.c. (RC-J2, T7).`,
    };
  }

  // Controllo costituzione progressiva per SAL (RC-J3)
  const isProgressivoSal =
    Boolean(input.fondoSpeciale?.isProgressivoSal) || Boolean(input.scaglioniSal?.length);

  if (isProgressivoSal) {
    const contrattoRef = input.fondoSpeciale?.contrattoAppaltoRef?.trim() ?? '';
    if (input.fondoSpeciale?.isProgressivoSal && !contrattoRef) {
      return {
        consentita: false,
        emissioneBloccata: true,
        codiceBlocco: 'CONTRATTO_APPALTO_SAL_MANCANTE',
        importoLavoriDeliberatiCent: importoLavoriCent,
        importoFondoDeliberatoCent,
        differenzaMancanteCent: 0,
        isProgressivoSal: true,
        riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
        errore:
          "Emissione rate straordinarie per SAL bloccata: manca il riferimento al contratto d'appalto a cui è collegato il piano dei pagamenti (RC-J3).",
      };
    }

    if (input.scaglioniSal && input.scaglioniSal.length > 0) {
      let sommaTotaleSalCent = 0;
      let sommaCostituitaSalFinoAlGradinoCent = 0;
      let sommaRichiestaSalFinoAlGradinoCent = 0;
      const targetSal = input.finoAlSalNumero ?? Infinity;

      for (const s of input.scaglioniSal) {
        const impSal = normalizzaCentesimi(s.importoSalCent);
        sommaTotaleSalCent = normalizzaCentesimi(sommaTotaleSalCent + impSal);
        if (s.numeroSal <= targetSal) {
          sommaRichiestaSalFinoAlGradinoCent = normalizzaCentesimi(
            sommaRichiestaSalFinoAlGradinoCent + impSal,
          );
          if (s.costituito !== false) {
            sommaCostituitaSalFinoAlGradinoCent = normalizzaCentesimi(
              sommaCostituitaSalFinoAlGradinoCent + impSal,
            );
          }
        }
      }

      if (
        sommaTotaleSalCent !== importoLavoriCent ||
        sommaCostituitaSalFinoAlGradinoCent < sommaRichiestaSalFinoAlGradinoCent
      ) {
        const diffSal = Math.max(
          0,
          normalizzaCentesimi(
            sommaRichiestaSalFinoAlGradinoCent - sommaCostituitaSalFinoAlGradinoCent,
          ),
        );
        return {
          consentita: false,
          emissioneBloccata: true,
          codiceBlocco: 'COPERTURA_SAL_INSUFFICIENTE',
          importoLavoriDeliberatiCent: importoLavoriCent,
          importoFondoDeliberatoCent,
          differenzaMancanteCent: diffSal,
          isProgressivoSal: true,
          riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
          errore:
            'Emissione rate straordinarie per SAL bloccata: il piano di costituzione progressiva per SAL non copre gli stati di avanzamento lavori previsti dal contratto (RC-J3).',
        };
      }
    }
  }

  return {
    consentita: true,
    emissioneBloccata: false,
    codiceBlocco: null,
    importoLavoriDeliberatiCent: importoLavoriCent,
    importoFondoDeliberatoCent,
    differenzaMancanteCent: 0,
    isProgressivoSal,
    riferimentoNormativo: 'Art. 1135, comma 1, n. 4, c.c. (RC-J2, RC-J3, T7)',
    errore: null,
  };
}

/**
 * Versione assertiva di `validaFondoSpecialePerEmissioneRateStraordinarie`:
 * solleva `ErroreFondoSpecialeNonCostituito` se il fondo speciale per i lavori straordinari
 * non è stato costituito per l'intero importo deliberato (art. 1135 c. 1 n. 4 c.c., RC-J2, T7).
 */
export function assertFondoSpecialeCostituitoPerRateStraordinarie(
  input: ValidaFondoSpecialePerRateStraordinarieInput,
): RisultatoValidazioneFondoSpecialeRate {
  const esito = validaFondoSpecialePerEmissioneRateStraordinarie(input);
  if (!esito.consentita) {
    throw new ErroreFondoSpecialeNonCostituito(
      esito.errore ?? 'Fondo speciale lavori non costituito (art. 1135 c. 1 n. 4 c.c., RC-J2, T7).',
      esito.importoLavoriDeliberatiCent,
      esito.importoFondoDeliberatoCent,
    );
  }
  return esito;
}

// ============================================================================
// 3. SALDI, MOVIMENTI DEL FONDO, VINCOLO DI DESTINAZIONE E DIVIETO COMPENSO ADMIN (RC-J1, RC-J4)
// ============================================================================

export interface MovimentoFondoRecordInput {
  id?: string;
  condominio_id: string;
  fondo_id: string;
  movimento_contabile_id?: string | null;
  data: string;
  importo_centesimi: CentesimiInput;
  segno: SegnoMovimentoFondo;
  causale: string;
  is_override_vincolo?: boolean;
  motivo_override?: string | null;
  delibera_override?: string | null;
  autore_id?: string | null;
}

export interface RisultatoSaldoFondo {
  fondoId: string;
  nomeFondo: string;
  tipoFondo: TipoFondo;
  statoFondo: StatoFondo;
  importoLavoriCent: Centesimi | null;
  importoObiettivoCent: Centesimi;
  totaleAccantonatoCent: Centesimi;
  totaleUtilizzatoCent: Centesimi;
  saldoCalcolatoCent: Centesimi;
  saldoCalcolatoEuro: number;
  saldoRegistratoSulRecordCent: Centesimi;
  isSaldoAllineato: boolean;
  residuoDaAccantonareCent: Centesimi;
  percentualeCoperturaObiettivo: number;
  numeroMovimenti: number;
  movimentiConOverrideCount: number;
  versioneMotore: string;
}

/**
 * Calcola in modo analitico i totali accantonati (`+`), utilizzati (`-`), il saldo netto disponibile
 * e la copertura rispetto all'importo obiettivo di un fondo condominiale (RC-J1).
 */
export function calcolaSaldoEMovimentiFondo(
  fondo: FondoRecordInput,
  movimenti: readonly MovimentoFondoRecordInput[],
  saldoInizialeBaseCent: CentesimiInput = 0,
): RisultatoSaldoFondo {
  const baseInizialeCent = normalizzaCentesimi(saldoInizialeBaseCent);
  const importoObiettivoCent = normalizzaCentesimi(fondo.importo_obiettivo_centesimi);
  const importoLavoriCent =
    fondo.importo_lavori_centesimi !== undefined && fondo.importo_lavori_centesimi !== null
      ? normalizzaCentesimi(fondo.importo_lavori_centesimi)
      : null;
  const saldoRegistratoSulRecordCent = normalizzaCentesimi(fondo.saldo_attuale_centesimi);

  let totaleAccantonatoCent = baseInizialeCent;
  let totaleUtilizzatoCent = 0;
  let movimentiConOverrideCount = 0;

  for (const m of movimenti) {
    if (m.fondo_id !== fondo.id) continue;
    const imp = normalizzaCentesimi(m.importo_centesimi);
    if (imp <= 0) {
      throw new RangeError(`Importo movimento fondo non valido (deve essere > 0): ${imp}`);
    }
    if (m.segno === '+') {
      totaleAccantonatoCent = normalizzaCentesimi(totaleAccantonatoCent + imp);
    } else if (m.segno === '-') {
      totaleUtilizzatoCent = normalizzaCentesimi(totaleUtilizzatoCent + imp);
    } else {
      throw new Error(`Segno movimento fondo non valido: "${String(m.segno)}"`);
    }
    if (m.is_override_vincolo) {
      movimentiConOverrideCount += 1;
    }
  }

  const saldoCalcolatoCent = normalizzaCentesimi(totaleAccantonatoCent - totaleUtilizzatoCent);
  const residuoDaAccantonareCent = Math.max(
    0,
    normalizzaCentesimi(importoObiettivoCent - totaleAccantonatoCent),
  );
  const percentualeCoperturaObiettivo =
    importoObiettivoCent > 0
      ? Math.min(100, Number(((totaleAccantonatoCent / importoObiettivoCent) * 100).toFixed(2)))
      : 100;

  return {
    fondoId: fondo.id,
    nomeFondo: fondo.nome,
    tipoFondo: fondo.tipo,
    statoFondo: fondo.stato ?? 'ATTIVO',
    importoLavoriCent,
    importoObiettivoCent,
    totaleAccantonatoCent,
    totaleUtilizzatoCent,
    saldoCalcolatoCent,
    saldoCalcolatoEuro: centsToEuro(saldoCalcolatoCent),
    saldoRegistratoSulRecordCent,
    isSaldoAllineato: saldoCalcolatoCent === saldoRegistratoSulRecordCent,
    residuoDaAccantonareCent,
    percentualeCoperturaObiettivo,
    numeroMovimenti: movimenti.filter((m) => m.fondo_id === fondo.id).length,
    movimentiConOverrideCount,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

/**
 * Rileva se una voce di spesa o una causale di movimento riguarda il compenso dell'amministratore,
 * per cui vige il divieto assoluto e inderogabile di utilizzo delle somme dei fondi (RC-J4).
 */
export function isDestinazioneCompensoAmministratore(input: {
  isCompensoAdmin?: boolean | null;
  codiceVoceSpesa?: string | null;
  causale?: string | null;
  descrizioneSpesa?: string | null;
}): boolean {
  if (input.isCompensoAdmin === true) {
    return true;
  }
  const codice = (input.codiceVoceSpesa ?? '').trim().toUpperCase();
  if (codice === 'COMPENSO_ADMIN' || codice === 'ONORARIO_ADMIN') {
    return true;
  }
  const testo = `${input.causale ?? ''} ${input.descrizioneSpesa ?? ''}`.toLowerCase();
  return (
    /compenso\s+amministrator/.test(testo) ||
    /onorario\s+amministrator/.test(testo) ||
    /emolumento\s+amministrator/.test(testo)
  );
}

export interface RegistraMovimentoFondoInput {
  fondo: FondoRecordInput;
  movimentoContabileId?: string | null;
  data: string;
  importoCent: CentesimiInput;
  segno: SegnoMovimentoFondo;
  causale: string;
  /** Codice della voce di spesa eventualmente pagata col prelievo dal fondo (per verifica RC-J4). */
  codiceVoceSpesa?: string | null;
  descrizioneSpesa?: string | null;
  /** Flag esplicito se la spesa associata è il compenso dell'amministratore (SEMPRE VIETATO per RC-J4). */
  isCompensoAdmin?: boolean;
  /**
   * Indica se l'utilizzo (`segno === '-'`) rispetta la destinazione originaria deliberata per il fondo.
   * Se `false` (es. giroconto o utilizzo per altra finalità), è obbligatorio l'override con motivo e delibera (RC-J4).
   */
  destinazioneConformeAlVincolo?: boolean;
  isOverrideVincolo?: boolean;
  motivoOverride?: string | null;
  deliberaOverride?: string | null;
  autoreId?: string | null;
  timestampIso?: string;
}

export interface RegistraMovimentoFondoOutput {
  movimentoFondo: {
    condominio_id: string;
    fondo_id: string;
    movimento_contabile_id: string | null;
    data: string;
    importo_centesimi: Centesimi;
    segno: SegnoMovimentoFondo;
    causale: string;
    is_override_vincolo: boolean;
    motivo_override: string | null;
    delibera_override: string | null;
    autore_id: string | null;
  };
  saldoPrecedenteCent: Centesimi;
  nuovoSaldoFondoCent: Centesimi;
  nuovoSaldoFondoEuro: number;
  overrideApplicato: boolean;
  eventoAudit: EventoAuditContabile | null;
}

/**
 * Valida e prepara un movimento sul fondo (`+` accantonamento o `-` utilizzo/svincolo, RC-J1, RC-J4):
 * 1. **Divieto assoluto compenso amministratore (RC-J4)**: se il movimento riguarda il compenso
 *    dell'amministratore, solleva sempre `ErroreDivietoCompensoAdminFondo`, anche se viene passato un override.
 * 2. **Vincolo di destinazione delle somme (RC-J4)**: spostare o usare le somme del fondo per altra
 *    destinazione (`destinazioneConformeAlVincolo === false` o `isOverrideVincolo === true`) è bloccato
 *    salvo override esplicito con `motivoOverride` e `deliberaOverride`, tracciato con `EventoAuditContabile`.
 * 3. **Controllo capienza**: impedisce che un prelievo mandi in negativo il saldo del fondo.
 */
export function validaERegistraMovimentoFondo(
  input: RegistraMovimentoFondoInput,
): RegistraMovimentoFondoOutput {
  const data = validaDataIso(input.data, 'data');
  const importoCent = normalizzaCentesimi(input.importoCent);
  if (importoCent <= 0) {
    throw new RangeError(`L'importo del movimento sul fondo deve essere maggiore di zero: ${importoCent}`);
  }

  const causale = (input.causale ?? '').trim();
  if (causale.length < 3) {
    throw new Error('La causale del movimento sul fondo è obbligatoria (min 3 caratteri, RC-J1).');
  }

  if (input.fondo.stato === 'CHIUSO') {
    throw new ErroreVincoloDestinazioneFondo(
      `Operazione negata: il fondo "${input.fondo.nome}" è in stato "CHIUSO" e non ammette nuovi movimenti.`,
    );
  }

  // 1. DIVIETO ASSOLUTO E INDEROGABILE PER COMPENSO AMMINISTRATORE (RC-J4)
  if (
    isDestinazioneCompensoAmministratore({
      isCompensoAdmin: input.isCompensoAdmin,
      codiceVoceSpesa: input.codiceVoceSpesa,
      causale,
      descrizioneSpesa: input.descrizioneSpesa,
    })
  ) {
    throw new ErroreDivietoCompensoAdminFondo(
      `Operazione vietata ex RC-J4 sul fondo "${input.fondo.nome}": le somme accantonate nei fondi condominiali non possono MAI essere utilizzate per pagare il compenso dell'amministratore, nemmeno con override o delibera.`,
    );
  }

  const saldoPrecedenteCent = normalizzaCentesimi(input.fondo.saldo_attuale_centesimi);

  if (input.segno === '+') {
    const nuovoSaldoFondoCent = normalizzaCentesimi(saldoPrecedenteCent + importoCent);
    return {
      movimentoFondo: {
        condominio_id: input.fondo.condominio_id,
        fondo_id: input.fondo.id,
        movimento_contabile_id: input.movimentoContabileId ?? null,
        data,
        importo_centesimi: importoCent,
        segno: '+',
        causale,
        is_override_vincolo: false,
        motivo_override: null,
        delibera_override: null,
        autore_id: input.autoreId ?? null,
      },
      saldoPrecedenteCent,
      nuovoSaldoFondoCent,
      nuovoSaldoFondoEuro: centsToEuro(nuovoSaldoFondoCent),
      overrideApplicato: false,
      eventoAudit: null,
    };
  }

  // Prelievo / utilizzo / giroconto (segno === '-')
  if (importoCent > saldoPrecedenteCent) {
    throw new ErroreCapienzaFondoInsufficiente(
      `Capienza insufficiente sul fondo "${input.fondo.nome}": saldo disponibile ${centsToEuro(saldoPrecedenteCent)} €, richiesto prelievo di ${centsToEuro(importoCent)} €.`,
      saldoPrecedenteCent,
      importoCent,
    );
  }

  const richiedeOverride =
    input.destinazioneConformeAlVincolo === false || Boolean(input.isOverrideVincolo);

  let motivoOverride: string | null = null;
  let deliberaOverride: string | null = null;
  let eventoAudit: EventoAuditContabile | null = null;

  if (richiedeOverride) {
    if (!input.isOverrideVincolo) {
      throw new ErroreVincoloDestinazioneFondo(
        `Vincolo di destinazione sul fondo "${input.fondo.nome}" (RC-J4): le somme sono vincolate alla delibera "${input.fondo.delibera_costituzione ?? 'originaria'}". Per spostarle ad altra destinazione è obbligatorio un override esplicito con motivo e delibera assembleare.`,
      );
    }

    motivoOverride = (input.motivoOverride ?? '').trim();
    deliberaOverride = (input.deliberaOverride ?? '').trim();

    if (motivoOverride.length < 5 || deliberaOverride.length < 3) {
      throw new ErroreVincoloDestinazioneFondo(
        `Override del vincolo di destinazione sul fondo "${input.fondo.nome}" incompleto: sono obbligatori sia il motivo dell'override (min 5 caratteri) sia il riferimento alla delibera assembleare (RC-J4).`,
      );
    }

    const nuovoSaldoConOverride = normalizzaCentesimi(saldoPrecedenteCent - importoCent);
    eventoAudit = {
      azione: 'OVERRIDE_VINCOLO_DESTINAZIONE_FONDO',
      tabella: 'movimenti_fondo',
      recordId: input.fondo.id,
      condominioId: input.fondo.condominio_id,
      autoreId: input.autoreId ?? null,
      timestampIso: input.timestampIso ?? new Date().toISOString(),
      motivo: motivoOverride,
      valorePrima: {
        fondo_id: input.fondo.id,
        nome_fondo: input.fondo.nome,
        tipo_fondo: input.fondo.tipo,
        delibera_vincolo_originario: input.fondo.delibera_costituzione ?? null,
        saldo_precedente_centesimi: saldoPrecedenteCent,
      },
      valoreDopo: {
        fondo_id: input.fondo.id,
        importo_prelevato_centesimi: importoCent,
        nuovo_saldo_centesimi: nuovoSaldoConOverride,
        causale,
        is_override_vincolo: true,
        motivo_override: motivoOverride,
        delibera_override: deliberaOverride,
      },
    };
  }

  const nuovoSaldoFondoCent = normalizzaCentesimi(saldoPrecedenteCent - importoCent);

  return {
    movimentoFondo: {
      condominio_id: input.fondo.condominio_id,
      fondo_id: input.fondo.id,
      movimento_contabile_id: input.movimentoContabileId ?? null,
      data,
      importo_centesimi: importoCent,
      segno: '-',
      causale,
      is_override_vincolo: richiedeOverride,
      motivo_override: motivoOverride,
      delibera_override: deliberaOverride,
      autore_id: input.autoreId ?? null,
    },
    saldoPrecedenteCent,
    nuovoSaldoFondoCent,
    nuovoSaldoFondoEuro: centsToEuro(nuovoSaldoFondoCent),
    overrideApplicato: richiedeOverride,
    eventoAudit,
  };
}

// ============================================================================
// 4. RICONCILIAZIONE FONDI COME VOCI CONTABILI SULL'UNICO CONTO CORRENTE (RC-J5)
// ============================================================================

export interface RiconciliaFondiConContoUnicoInput {
  condominioId: string;
  ibanContoUnico: string;
  saldoContoCorrenteCent: CentesimiInput;
  fondi: readonly FondoRecordInput[];
}

export interface RisultatoRiconciliazioneFondiContoUnico {
  condominioId: string;
  ibanContoUnico: string;
  /** Per RC-J5 il fondo è una voce contabile, non un conto aggiuntivo: resta un solo conto condominiale. */
  isFondoVoceContabileNonContoAggiuntivo: true;
  numeroContiCorrentiCondominio: 1;
  saldoContoCorrenteCent: Centesimi;
  saldoContoCorrenteEuro: number;
  totaleFondoSpecialeCent: Centesimi;
  totaleFondoCassaCent: Centesimi;
  totaleFondoMorositaCent: Centesimi;
  totaleFondiAccantonatiCent: Centesimi;
  totaleFondiAccantonatiEuro: number;
  /** Liquidità sul conto corrente non vincolata ai fondi (`saldoContoCorrenteCent - totaleFondiAccantonatiCent`). */
  liquiditaLiberaNonVincolataCent: Centesimi;
  liquiditaLiberaNonVincolataEuro: number;
  /** `true` se il saldo fisico sul conto corrente copre interamente tutti i fondi contabili accantonati. */
  coperturaBancariaFondiValida: boolean;
  avvisoDisallineamentoLiquidita: string | null;
}

/**
 * Riconcilia i saldi dei fondi condominiali (`SPECIALE`, `CASSA`, `MOROSITA`) con il saldo
 * dell'unico conto corrente condominiale (RC-J5: *"Il fondo è una voce contabile, non un conto aggiuntivo:
 * resta un solo conto condominiale"*).
 */
export function riconciliaFondiConContoUnico(
  input: RiconciliaFondiConContoUnicoInput,
): RisultatoRiconciliazioneFondiContoUnico {
  const iban = (input.ibanContoUnico ?? '').trim();
  if (!iban) {
    throw new Error(
      "L'IBAN dell'unico conto corrente condominiale è obbligatorio per riconciliare i fondi contabili (RC-A1, RC-J5).",
    );
  }

  const saldoContoCorrenteCent = normalizzaCentesimi(input.saldoContoCorrenteCent);
  let totaleFondoSpecialeCent = 0;
  let totaleFondoCassaCent = 0;
  let totaleFondoMorositaCent = 0;

  for (const f of input.fondi) {
    if (f.stato === 'CHIUSO') continue;
    const saldo = normalizzaCentesimi(f.saldo_attuale_centesimi);
    if (f.tipo === 'SPECIALE') {
      totaleFondoSpecialeCent = normalizzaCentesimi(totaleFondoSpecialeCent + saldo);
    } else if (f.tipo === 'CASSA') {
      totaleFondoCassaCent = normalizzaCentesimi(totaleFondoCassaCent + saldo);
    } else if (f.tipo === 'MOROSITA') {
      totaleFondoMorositaCent = normalizzaCentesimi(totaleFondoMorositaCent + saldo);
    }
  }

  const totaleFondiAccantonatiCent = normalizzaCentesimi(
    totaleFondoSpecialeCent + totaleFondoCassaCent + totaleFondoMorositaCent,
  );
  const liquiditaLiberaNonVincolataCent = normalizzaCentesimi(
    saldoContoCorrenteCent - totaleFondiAccantonatiCent,
  );
  const coperturaBancariaFondiValida = saldoContoCorrenteCent >= totaleFondiAccantonatiCent;

  const avvisoDisallineamentoLiquidita = coperturaBancariaFondiValida
    ? null
    : `Attenzione: il saldo sul conto corrente unico (${centsToEuro(saldoContoCorrenteCent)} €) è inferiore al totale contabile dei fondi vincolati (${centsToEuro(totaleFondiAccantonatiCent)} €).`;

  return {
    condominioId: input.condominioId,
    ibanContoUnico: iban,
    isFondoVoceContabileNonContoAggiuntivo: true,
    numeroContiCorrentiCondominio: 1,
    saldoContoCorrenteCent,
    saldoContoCorrenteEuro: centsToEuro(saldoContoCorrenteCent),
    totaleFondoSpecialeCent,
    totaleFondoCassaCent,
    totaleFondoMorositaCent,
    totaleFondiAccantonatiCent,
    totaleFondiAccantonatiEuro: centsToEuro(totaleFondiAccantonatiCent),
    liquiditaLiberaNonVincolataCent,
    liquiditaLiberaNonVincolataEuro: centsToEuro(liquiditaLiberaNonVincolataCent),
    coperturaBancariaFondiValida,
    avvisoDisallineamentoLiquidita,
  };
}
