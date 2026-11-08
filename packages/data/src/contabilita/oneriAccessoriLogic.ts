/**
 * Logica pura per il Prospetto di Riparto Oneri Accessori Proprietario / Conduttore / Usufruttuario,
 * la Tabella ex art. 9 L. 392/1978 e DM 16/01/2017, il Patto Contrario con Verifica Art. 79 L. 392/1978,
 * l'Usufrutto ex artt. 1004-1005 c.c., il Subentro Inquilino a Metà Periodo (Giorni e Consumi)
 * e la Scadenza di Pagamento a 2 Mesi dalla Richiesta
 * (Sezione 7: RC-I1..I7, RC-H5, RC-H6; Sezione 4: RC-A10, RC-A11; Sezione 10: T10).
 *
 * Principi fondamentali:
 * - Il condominio si rivolge sempre al condomino proprietario (o usufruttuario per le ordinarie ex art. 1004 c.c.):
 *   il riparto con l'inquilino è un prospetto analitico di rivalsa, mai una fatturazione separata (RC-I1).
 * - Importi sempre in centesimi interi (`Centesimi`), nessun decimale in virgola mobile.
 * - Regola base art. 9 L. 392/1978 e DM 16/01/2017 (RC-I2, RC-I4, T10):
 *   * Spesa `ORDINARIA` -> a carico del conduttore secondo la percentuale della voce (100% per ascensore ordinario,
 *     pulizia scale, acqua, riscaldamento, energia elettrica parti comuni, manutenzione ordinaria; 90% portierato);
 *   * Compenso dell'amministratore (`COMPENSO_ADMIN`) e assicurazione del fabbricato (`ASSICURAZIONE`) ->
 *     `0%` conduttore (`100%` proprietario) per default, salvo patto contrario esplicito (RC-I4);
 *   * Spesa `STRAORDINARIA` (es. sostituzione ascensore in T10) -> `0%` conduttore, `100%` proprietario.
 * - Patto contrario e controllo art. 79 L. 392/1978 (RC-I3): ogni unità può avere una tabella personalizzata,
 *   valutata contro il divieto di clausole nulle che attribuiscano al locatore vantaggi in contrasto con la legge.
 * - Usufrutto ex artt. 1004 e 1005 c.c. (RC-I5): custodia, amministrazione (incluso compenso amministratore)
 *   e manutenzione ordinaria a carico dell'usufruttuario; riparazioni straordinarie a carico del nudo proprietario,
 *   con regola configurabile per unità.
 * - Subentro inquilino a metà periodo (RC-I7, RC-H5, RC-H6): divisione delle spese a periodo per giorni di
 *   conduzione (eventuali giorni di sfitto restano al locatore) e dei consumi per letture contatore (o stima
 *   per giorni marcata `"da conguagliare"` se manca la lettura intermedia).
 * - Scadenza di pagamento del prospetto inquilino: entro due mesi dalla richiesta (art. 9, c. 3, L. 392/1978, RC-I6).
 * - Nessuna dipendenza da React, Expo, `Intl` o Supabase.
 */

import {
  calcolaGiorniInclusivi,
  centsToEuro,
  dividiEArrotondaHalfUp,
  formattaCentsItaliano,
  normalizzaCentesimi,
  ripartisciSpesaPeriodo,
  VERSIONE_MOTORE_CALCOLO,
  type Centesimi,
  type CentesimiInput,
} from './contabilitaLogic.ts';
import { aggiungiGiorniIso, aggiungiMesiCalendarioIso } from './morositaLogic.ts';
import type { TagSpesa } from './registroContabileLogic.ts';
import { calcolaConsumiCambioTitolare } from './subentriLogic.ts';

// ============================================================================
// COSTANTI E TIPI DI DOMINIO (SEZIONE 7: RC-I1..I7, T10)
// ============================================================================

/** Termine legale entro cui il conduttore deve pagare gli oneri accessori dalla richiesta (art. 9 c. 3 L. 392/1978, RC-I6). */
export const TERMINE_PAGAMENTO_INQUILINO_MESI = 2;

export const FONTI_REGOLA_ONERI_ACCESSORI = [
  'DEFAULT_LEGGE_392_78',
  'TABELLA_DM_16_01_2017',
  'ESCLUSIONE_LEGALE_RC_I4',
  'STRAORDINARIA_PROPRIETARIO',
  'PATTO_CONTRARIO_UNITA',
  'RICONDOTTA_LIMITE_LEGALE_ART_79',
] as const;
export type FonteRegolaOneriAccessori = (typeof FONTI_REGOLA_ONERI_ACCESSORI)[number];

export const REGIMI_CONTRATTO_LOCAZIONE = [
  'CANONE_LIBERO_4_PIU_4',
  'CANONE_CONCORDATO_DM_2017',
  'USO_TRANSITORIO',
  'USO_FORESTERIA_O_COMMERCIALE',
] as const;
export type RegimeContrattoLocazione = (typeof REGIMI_CONTRATTO_LOCAZIONE)[number];

export const CRITERI_RIPARTO_USUFRUTTO = [
  'ART_1004_1005_CC_STANDARD',
  'STRAORDINARIA_DA_INADEMPIMENTO_ORDINARIA_ART_1005',
  'REGOLA_CUSTOM_UNITA',
] as const;
export type CriterioRipartoUsufrutto = (typeof CRITERI_RIPARTO_USUFRUTTO)[number];

export interface VoceTabellaOneriDm2017 {
  codice: string;
  nome: string;
  riferimentoNormativo: string;
  tagDefault: TagSpesa;
  quotaConduttoreDefaultPerc: number;
  quotaLocatoreDefaultPerc: number;
  isAPeriodo: boolean;
  isCompensoAdmin: boolean;
  isAssicurazioneFabbricato: boolean;
  ammettePattoContrarioCanoneLibero: boolean;
}

/**
 * Tabella di riferimento per la ripartizione degli oneri accessori tra locatore e conduttore
 * ai sensi dell'art. 9 L. 392/1978 e della Tabella Allegato D al DM 16/01/2017 (RC-I2, RC-I4, T10).
 */
export const TABELLA_ONERI_ACCESSORI_DM_2017: Readonly<Record<string, VoceTabellaOneriDm2017>> = {
  ASCENSORE: {
    codice: 'ASCENSORE',
    nome: 'Ascensore (manutenzione ordinaria, forza motrice, piccole riparazioni, ispezioni)',
    riferimentoNormativo: 'Art. 9 c. 1 L. 392/1978; All. D DM 16/01/2017',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 100,
    quotaLocatoreDefaultPerc: 0,
    isAPeriodo: false,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: true,
  },
  PULIZIA_SCALE: {
    codice: 'PULIZIA_SCALE',
    nome: 'Pulizia scale e parti comuni',
    riferimentoNormativo: 'Art. 9 c. 1 L. 392/1978; All. D DM 16/01/2017',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 100,
    quotaLocatoreDefaultPerc: 0,
    isAPeriodo: false,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: true,
  },
  ACQUA: {
    codice: 'ACQUA',
    nome: 'Fornitura acqua e forza motrice autoclave',
    riferimentoNormativo: 'Art. 9 c. 1 L. 392/1978; All. D DM 16/01/2017',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 100,
    quotaLocatoreDefaultPerc: 0,
    isAPeriodo: false,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: true,
  },
  RISCALDAMENTO: {
    codice: 'RISCALDAMENTO',
    nome: 'Riscaldamento e condizionamento (combustibile, energia, manutenzione ordinaria)',
    riferimentoNormativo: 'Art. 9 c. 1 L. 392/1978; All. D DM 16/01/2017',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 100,
    quotaLocatoreDefaultPerc: 0,
    isAPeriodo: false,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: true,
  },
  LUCE_COMUNE: {
    codice: 'LUCE_COMUNE',
    nome: 'Energia elettrica parti comuni',
    riferimentoNormativo: 'Art. 9 c. 1 L. 392/1978; All. D DM 16/01/2017',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 100,
    quotaLocatoreDefaultPerc: 0,
    isAPeriodo: false,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: true,
  },
  PORTIERATO: {
    codice: 'PORTIERATO',
    nome: 'Servizio di portierato (90% conduttore, 10% locatore ex art. 9 c. 1 L. 392/1978)',
    riferimentoNormativo: 'Art. 9 c. 1 L. 392/1978; All. D DM 16/01/2017',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 90,
    quotaLocatoreDefaultPerc: 10,
    isAPeriodo: true,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: true,
  },
  ASSICURAZIONE: {
    codice: 'ASSICURAZIONE',
    nome: 'Assicurazione fabbricato (a carico proprietario salvo patto contrario, RC-I4)',
    riferimentoNormativo: 'RC-I4; All. D DM 16/01/2017',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 0,
    quotaLocatoreDefaultPerc: 100,
    isAPeriodo: true,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: true,
    ammettePattoContrarioCanoneLibero: true,
  },
  COMPENSO_ADMIN: {
    codice: 'COMPENSO_ADMIN',
    nome: 'Compenso amministratore (a carico proprietario salvo patto contrario, RC-I4)',
    riferimentoNormativo: 'RC-I4; Cass. Civ. su art. 9 L. 392/1978',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 0,
    quotaLocatoreDefaultPerc: 100,
    isAPeriodo: true,
    isCompensoAdmin: true,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: true,
  },
  MANUT_ORDINARIA: {
    codice: 'MANUT_ORDINARIA',
    nome: 'Manutenzione ordinaria parti comuni e spurgo pozzi neri',
    riferimentoNormativo: 'Art. 9 c. 1 L. 392/1978; All. D DM 16/01/2017',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 100,
    quotaLocatoreDefaultPerc: 0,
    isAPeriodo: false,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: true,
  },
  MANUT_STRAORD: {
    codice: 'MANUT_STRAORD',
    nome: 'Manutenzione straordinaria e sostituzione impianti',
    riferimentoNormativo: 'Art. 1576 c.c.; All. D DM 16/01/2017; RC-I2; T10',
    tagDefault: 'STRAORDINARIA',
    quotaConduttoreDefaultPerc: 0,
    quotaLocatoreDefaultPerc: 100,
    isAPeriodo: false,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: false,
  },
  SPESE_LEGALI: {
    codice: 'SPESE_LEGALI',
    nome: 'Spese legali e giudiziarie condominiali',
    riferimentoNormativo: 'RC-C2; RC-I2',
    tagDefault: 'ORDINARIA',
    quotaConduttoreDefaultPerc: 0,
    quotaLocatoreDefaultPerc: 100,
    isAPeriodo: false,
    isCompensoAdmin: false,
    isAssicurazioneFabbricato: false,
    ammettePattoContrarioCanoneLibero: false,
  },
};

export class ErroreOneriAccessoriNonValidi extends Error {
  readonly codice = 'ONERI_ACCESSORI_NON_VALIDI' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreOneriAccessoriNonValidi';
  }
}

export class ErrorePattoContrarioNulloArt79 extends Error {
  readonly codice = 'PATTO_CONTRARIO_NULLO_ART_79' as const;
  readonly codiceVoce: string;
  readonly percentualeRichiesta: number;

  constructor(messaggio: string, codiceVoce: string, percentualeRichiesta: number) {
    super(messaggio);
    this.name = 'ErrorePattoContrarioNulloArt79';
    this.codiceVoce = codiceVoce;
    this.percentualeRichiesta = percentualeRichiesta;
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

function calcolaQuotaPercentualeCents(
  importoTotaleCent: Centesimi,
  percentuale: number,
): Centesimi {
  if (!Number.isFinite(percentuale) || percentuale < 0 || percentuale > 100) {
    throw new RangeError(`Percentuale non valida (atteso valore tra 0 e 100): ${String(percentuale)}`);
  }
  if (importoTotaleCent === 0 || percentuale === 0) {
    return 0;
  }
  if (percentuale === 100) {
    return importoTotaleCent;
  }
  // Scala a centesimi di punto percentuale (es. 90.00% -> 9000 su 10000)
  const percScalataBig = BigInt(Math.round(percentuale * 100));
  return dividiEArrotondaHalfUp(BigInt(importoTotaleCent) * percScalataBig, 10_000n);
}

// ============================================================================
// 1. VALIDAZIONE PATTO CONTRARIO EX ART. 79 L. 392/1978 E RISOLUZIONE PERCENTUALE
//    (RC-I2, RC-I3, RC-I4, T10)
// ============================================================================

export type TabellaOneriCustomMap = Readonly<Record<string, number>>;

export interface RisolviPercentualeConduttoreInput {
  codiceVoce?: string | null;
  nomeVoce?: string | null;
  tagSpesa: TagSpesa;
  /** Percentuale configurata sulla voce di catalogo del condominio (opzionale, RC-C2, RC-I2). */
  quotaInquilinoCatalogoPerc?: number | null;
  isCompensoAdmin?: boolean;
  isAssicurazioneFabbricato?: boolean;
  /** Flag "patto contrario sugli oneri accessori" registrato sulla titolarità del conduttore (RC-A10, RC-I3, RC-I4). */
  pattoContrarioOneri?: boolean;
  /** Tabella personalizzata degli oneri per l'unità (`{ [codiceVoce]: percentualeConduttore }`, RC-A10, RC-I3). */
  tabellaOneriCustom?: TabellaOneriCustomMap | null;
  /**Percentuale diretta passata in deroga per questa specifica voce (se `pattoContrarioOneri = true`). */
  percentualePattoContrarioVoce?: number | null;
  /** Regime contrattuale per la valutazione dell'inderogabilità ex art. 79 L. 392/1978 e DM 16/01/2017 (RC-I3). */
  regimeContratto?: RegimeContrattoLocazione;
  /**
   * Se `true`, solleva `ErrorePattoContrarioNulloArt79` quando una clausola custom viola l'art. 79 L. 392/1978
   * (es. addebito al conduttore di spese straordinarie / sostituzione impianti o deroga in peius su canone concordato).
   * Se `false` (default), riconduce automaticamente la percentuale al massimo legale consentito ed emette un avviso in `avvisoArt79`.
   */
  bloccaClausoleNulleArt79?: boolean;
}

export interface RisultatoRisoluzionePercentualeConduttore {
  codiceVoce: string;
  tagSpesa: TagSpesa;
  percentualeConduttoreApplicata: number;
  percentualeLocatoreApplicata: number;
  percentualeStandardLegge: number;
  fonteRegola: FonteRegolaOneriAccessori;
  pattoContrarioApplicato: boolean;
  violazioneArt79Rilevata: boolean;
  avvisoArt79: string | null;
}

/**
 * Determina la percentuale di una voce di spesa a carico del conduttore (da `0` a `100%`)
 * applicando le regole dell'art. 9 L. 392/1978, della tabella DM 16/01/2017, le esclusioni di default
 * per compenso amministratore e assicurazione fabbricato (RC-I4) e la verifica del patto contrario
 * rispetto all'art. 79 L. 392/1978 (RC-I2, RC-I3, RC-I4, T10).
 */
export function risolviPercentualeConduttoreVoce(
  input: RisolviPercentualeConduttoreInput,
): RisultatoRisoluzionePercentualeConduttore {
  const codiceNorm = (input.codiceVoce ?? 'GENERICA').trim().toUpperCase();
  const voceDm = TABELLA_ONERI_ACCESSORI_DM_2017[codiceNorm];

  const isCompensoAdmin =
    Boolean(input.isCompensoAdmin) ||
    Boolean(voceDm?.isCompensoAdmin) ||
    codiceNorm === 'COMPENSO_ADMIN';
  const isAssicurazione =
    Boolean(input.isAssicurazioneFabbricato) ||
    Boolean(voceDm?.isAssicurazioneFabbricato) ||
    codiceNorm === 'ASSICURAZIONE';

  // 1. Calcolo della percentuale standard di legge / tabella DM 16/01/2017 (senza patto contrario)
  let percentualeStandardLegge: number;
  let fonteBase: FonteRegolaOneriAccessori;

  if (input.tagSpesa === 'STRAORDINARIA') {
    // Regola base RC-I2, T10: straordinaria sempre 0% conduttore, 100% proprietario
    percentualeStandardLegge = 0;
    fonteBase = 'STRAORDINARIA_PROPRIETARIO';
  } else if (isCompensoAdmin || isAssicurazione) {
    // Regola RC-I4: compenso amministratore e assicurazione fabbricato non rientrano negli oneri
    // accessori dell'inquilino (0% conduttore), salvo patto contrario
    percentualeStandardLegge = 0;
    fonteBase = 'ESCLUSIONE_LEGALE_RC_I4';
  } else if (
    input.quotaInquilinoCatalogoPerc !== undefined &&
    input.quotaInquilinoCatalogoPerc !== null
  ) {
    percentualeStandardLegge = Math.max(0, Math.min(100, Number(input.quotaInquilinoCatalogoPerc)));
    fonteBase = voceDm ? 'TABELLA_DM_16_01_2017' : 'DEFAULT_LEGGE_392_78';
  } else if (voceDm) {
    percentualeStandardLegge = voceDm.quotaConduttoreDefaultPerc;
    fonteBase = 'TABELLA_DM_16_01_2017';
  } else {
    // Regola base RC-I2: ordinaria all'inquilino (100%)
    percentualeStandardLegge = 100;
    fonteBase = 'DEFAULT_LEGGE_392_78';
  }

  // 2. Verifica eventuale patto contrario registrato per l'unità (RC-I3, RC-I4)
  const percCustomDaTabella =
    input.tabellaOneriCustom && codiceNorm in input.tabellaOneriCustom
      ? input.tabellaOneriCustom[codiceNorm]
      : undefined;
  const percCustomRichiesta =
    input.percentualePattoContrarioVoce !== undefined &&
    input.percentualePattoContrarioVoce !== null
      ? input.percentualePattoContrarioVoce
      : percCustomDaTabella;

  if (!input.pattoContrarioOneri || percCustomRichiesta === undefined) {
    return {
      codiceVoce: codiceNorm,
      tagSpesa: input.tagSpesa,
      percentualeConduttoreApplicata: percentualeStandardLegge,
      percentualeLocatoreApplicata: Number((100 - percentualeStandardLegge).toFixed(2)),
      percentualeStandardLegge,
      fonteRegola: fonteBase,
      pattoContrarioApplicato: false,
      violazioneArt79Rilevata: false,
      avvisoArt79: null,
    };
  }

  if (
    typeof percCustomRichiesta !== 'number' ||
    !Number.isFinite(percCustomRichiesta) ||
    percCustomRichiesta < 0 ||
    percCustomRichiesta > 100
  ) {
    throw new ErroreOneriAccessoriNonValidi(
      `Percentuale patto contrario non valida per la voce "${codiceNorm}": ${String(percCustomRichiesta)} (atteso valore tra 0 e 100).`,
    );
  }

  const regime = input.regimeContratto ?? 'CANONE_LIBERO_4_PIU_4';

  // Controllo inderogabilità art. 79 L. 392/1978 (RC-I3):
  // a) Le spese di manutenzione straordinaria / sostituzione impianti (art. 1576 c.c., T10) non possono
  //    mai essere ribaltate sul conduttore perché altererebbero il sinallagma attribuendo al locatore
  //    un indebito vantaggio in contrasto con la legge (art. 79 L. 392/1978).
  if (input.tagSpesa === 'STRAORDINARIA' && percCustomRichiesta > 0) {
    const msg =
      `Clausola contrattuale nulla ex art. 79 L. 392/1978 sulla voce "${codiceNorm}": ` +
      `non è consentito porre a carico del conduttore spese di natura straordinaria (${percCustomRichiesta}% richiesto, RC-I2, RC-I3, T10).`;
    if (input.bloccaClausoleNulleArt79) {
      throw new ErrorePattoContrarioNulloArt79(msg, codiceNorm, percCustomRichiesta);
    }
    return {
      codiceVoce: codiceNorm,
      tagSpesa: input.tagSpesa,
      percentualeConduttoreApplicata: 0,
      percentualeLocatoreApplicata: 100,
      percentualeStandardLegge: 0,
      fonteRegola: 'RICONDOTTA_LIMITE_LEGALE_ART_79',
      pattoContrarioApplicato: false,
      violazioneArt79Rilevata: true,
      avvisoArt79: msg,
    };
  }

  // b) Nei contratti a canone concordato (DM 16/01/2017) la Tabella Allegato D è tassativa e non può
  //    essere derogata a sfavore del conduttore (percCustomRichiesta > percentualeStandardLegge)
  if (
    regime === 'CANONE_CONCORDATO_DM_2017' &&
    percCustomRichiesta > percentualeStandardLegge
  ) {
    const msg =
      `Clausola nulla ex art. 79 L. 392/1978 e DM 16/01/2017 sulla voce "${codiceNorm}": ` +
      `nei contratti a canone concordato la quota a carico del conduttore (${percCustomRichiesta}%) non può superare il limite della Tabella Allegato D (${percentualeStandardLegge}%, RC-I3).`;
    if (input.bloccaClausoleNulleArt79) {
      throw new ErrorePattoContrarioNulloArt79(msg, codiceNorm, percCustomRichiesta);
    }
    return {
      codiceVoce: codiceNorm,
      tagSpesa: input.tagSpesa,
      percentualeConduttoreApplicata: percentualeStandardLegge,
      percentualeLocatoreApplicata: Number((100 - percentualeStandardLegge).toFixed(2)),
      percentualeStandardLegge,
      fonteRegola: 'RICONDOTTA_LIMITE_LEGALE_ART_79',
      pattoContrarioApplicato: false,
      violazioneArt79Rilevata: true,
      avvisoArt79: msg,
    };
  }

  // Patto contrario legittimo (es. patto espresso su compenso amministratore o assicurazione fabbricato ex RC-I4,
  // oppure riduzione della quota conduttore a favore dell'inquilino)
  const avvisoPatto =
    (isCompensoAdmin || isAssicurazione) && percCustomRichiesta > 0
      ? `Applicato patto contrario espresso sulla voce "${codiceNorm}" (${percCustomRichiesta}% a carico del conduttore, RC-I3, RC-I4). Verificare la conformità della clausola contrattuale all'art. 79 L. 392/1978.`
      : null;

  return {
    codiceVoce: codiceNorm,
    tagSpesa: input.tagSpesa,
    percentualeConduttoreApplicata: percCustomRichiesta,
    percentualeLocatoreApplicata: Number((100 - percCustomRichiesta).toFixed(2)),
    percentualeStandardLegge,
    fonteRegola: 'PATTO_CONTRARIO_UNITA',
    pattoContrarioApplicato: true,
    violazioneArt79Rilevata: false,
    avvisoArt79: avvisoPatto,
  };
}

export interface CalcolaRipartoLocatoreConduttoreVoceInput
  extends RisolviPercentualeConduttoreInput {
  /** Importo totale della spesa condominiale (informativo per il prospetto, es. 1.000,00 € o 5.000,00 € in T10). */
  importoSpesaTotaleCondominioCent?: CentesimiInput;
  /** Quota della spesa imputata all'unità immobiliare (es. 80,00 € o 400,00 € in T10). */
  quotaUnitaCent: CentesimiInput;
  descrizione?: string | null;
}

export interface RisultatoRipartoLocatoreConduttoreVoce
  extends RisultatoRisoluzionePercentualeConduttore {
  descrizione: string;
  importoSpesaTotaleCondominioCent: Centesimi | null;
  quotaUnitaCent: Centesimi;
  quotaUnitaEuro: number;
  quotaConduttoreCent: Centesimi;
  quotaConduttoreEuro: number;
  quotaLocatoreCent: Centesimi;
  quotaLocatoreEuro: number;
  /** Per RC-I1 il condominio si rivolge sempre al proprietario: il riparto con l'inquilino è solo un prospetto interno. */
  debitoreVersoCondominio: 'PROPRIETARIO';
  isFatturazioneSeparataInquilino: false;
}

/**
 * Ripartisce la quota di una singola voce di spesa tra **locatore (proprietario)** e **conduttore (inquilino)**
 * in base all'art. 9 L. 392/1978, alla tabella DM 16/01/2017 e ad eventuali patti contrari validi (RC-I1..I4, T10).
 *
 * Caso di test T10:
 * - Ordinaria ascensore `1.000,00 €`, quota unità `80,00 €`, `100%` conduttore ->
 *   `quotaConduttoreCent = 8000` (`80,00 €`), `quotaLocatoreCent = 0` (`0,00 €`);
 * - Sostituzione ascensore (`STRAORDINARIA`) `5.000,00 €`, quota unità `400,00 €`, `0%` conduttore ->
 *   `quotaConduttoreCent = 0` (`0,00 €`), `quotaLocatoreCent = 40000` (`400,00 €`).
 */
export function calcolaRipartoLocatoreConduttoreVoce(
  input: CalcolaRipartoLocatoreConduttoreVoceInput,
): RisultatoRipartoLocatoreConduttoreVoce {
  const quotaUnitaCent = normalizzaCentesimi(input.quotaUnitaCent);
  if (quotaUnitaCent < 0) {
    throw new RangeError(`La quota dell'unità non può essere negativa: ${quotaUnitaCent}`);
  }

  const importoSpesaTotaleCondominioCent =
    input.importoSpesaTotaleCondominioCent !== undefined &&
    input.importoSpesaTotaleCondominioCent !== null
      ? normalizzaCentesimi(input.importoSpesaTotaleCondominioCent)
      : null;

  const risoluzione = risolviPercentualeConduttoreVoce(input);
  const quotaConduttoreCent = calcolaQuotaPercentualeCents(
    quotaUnitaCent,
    risoluzione.percentualeConduttoreApplicata,
  );
  const quotaLocatoreCent = normalizzaCentesimi(quotaUnitaCent - quotaConduttoreCent);

  const voceDm = TABELLA_ONERI_ACCESSORI_DM_2017[risoluzione.codiceVoce];
  const descrizione =
    input.descrizione?.trim() ||
    input.nomeVoce?.trim() ||
    voceDm?.nome ||
    `Voce ${risoluzione.codiceVoce}`;

  return {
    ...risoluzione,
    descrizione,
    importoSpesaTotaleCondominioCent,
    quotaUnitaCent,
    quotaUnitaEuro: centsToEuro(quotaUnitaCent),
    quotaConduttoreCent,
    quotaConduttoreEuro: centsToEuro(quotaConduttoreCent),
    quotaLocatoreCent,
    quotaLocatoreEuro: centsToEuro(quotaLocatoreCent),
    debitoreVersoCondominio: 'PROPRIETARIO',
    isFatturazioneSeparataInquilino: false,
  };
}

// ============================================================================
// 2. RIPARTIZIONE USUFRUTTUARIO / NUDO PROPRIETARIO EX ARTT. 1004 E 1005 C.C. (RC-I5)
// ============================================================================

export interface RegolaUsufruttoCustomUnita {
  /** Percentuale personalizzata a carico dell'usufruttuario per le spese ordinarie (default 100%). */
  ordinariaUsufruttuarioPerc?: number;
  /** Percentuale personalizzata a carico dell'usufruttuario per le spese straordinarie (default 0%). */
  straordinariaUsufruttuarioPerc?: number;
  /** Percentuali specifiche per codice voce (`{ [codiceVoce]: percentualeUsufruttuario }`). */
  perVoceUsufruttuarioPerc?: Readonly<Record<string, number>>;
  noteRegola?: string | null;
}

export interface CalcolaRipartoUsufruttoInput {
  quotaUnitaCent: CentesimiInput;
  codiceVoce?: string | null;
  descrizione?: string | null;
  tagSpesa: TagSpesa;
  /**
   * Ai sensi dell'art. 1005 c.c., se la riparazione straordinaria è stata resa necessaria
   * dall'inadempimento degli obblighi di ordinaria manutenzione, essa ricade sull'usufruttuario.
   */
  straordinariaDaInadempimentoOrdinaria?: boolean;
  /** Regola personalizzata configurabile per unità (RC-I5, `anagrafiche_unita.regola_usufrutto_custom`). */
  regolaUsufruttoCustom?: RegolaUsufruttoCustomUnita | null;
}

export interface RisultatoRipartoUsufrutto {
  codiceVoce: string;
  descrizione: string;
  tagSpesa: TagSpesa;
  quotaUnitaCent: Centesimi;
  quotaUsufruttuarioCent: Centesimi;
  quotaUsufruttuarioEuro: number;
  quotaNudoProprietarioCent: Centesimi;
  quotaNudoProprietarioEuro: number;
  percentualeUsufruttuario: number;
  percentualeNudoProprietario: number;
  criterioApplicato: CriterioRipartoUsufrutto;
  riferimentoNormativo: string;
}

/**
 * Calcola la ripartizione della quota di un'unità tra **usufruttuario** e **nudo proprietario**
 * ai sensi degli artt. 1004 e 1005 c.c. (RC-I5, RC-A11):
 * - Spese di custodia, amministrazione (incluso il compenso dell'amministratore e l'assicurazione ordinaria)
 *   e manutenzione ordinaria (`tagSpesa === 'ORDINARIA'`) -> `100%` a carico dell'**usufruttuario** (art. 1004 c.c.);
 * - Riparazioni straordinarie (`tagSpesa === 'STRAORDINARIA'`) -> `100%` a carico del **nudo proprietario** (art. 1005 c.c.),
 *   salvo che dipendano dall'inadempimento degli obblighi di ordinaria manutenzione (`straordinariaDaInadempimentoOrdinaria = true`)
 *   o salvo regola configurata per l'unità (`regolaUsufruttoCustom`, RC-I5).
 */
export function calcolaRipartoUsufruttuarioNudoProprietarioVoce(
  input: CalcolaRipartoUsufruttoInput,
): RisultatoRipartoUsufrutto {
  const quotaUnitaCent = normalizzaCentesimi(input.quotaUnitaCent);
  if (quotaUnitaCent < 0) {
    throw new RangeError(`La quota dell'unità non può essere negativa: ${quotaUnitaCent}`);
  }

  const codiceVoce = (input.codiceVoce ?? 'GENERICA').trim().toUpperCase();
  const descrizione = input.descrizione?.trim() || `Voce ${codiceVoce}`;
  const custom = input.regolaUsufruttoCustom;

  let percentualeUsufruttuario: number;
  let criterioApplicato: CriterioRipartoUsufrutto;
  let riferimentoNormativo: string;

  const customVocePerc = custom?.perVoceUsufruttuarioPerc?.[codiceVoce];

  if (customVocePerc !== undefined) {
    percentualeUsufruttuario = Math.max(0, Math.min(100, Number(customVocePerc)));
    criterioApplicato = 'REGOLA_CUSTOM_UNITA';
    riferimentoNormativo = 'Regola usufrutto configurata per unità (RC-I5)';
  } else if (
    input.tagSpesa === 'ORDINARIA' &&
    custom?.ordinariaUsufruttuarioPerc !== undefined
  ) {
    percentualeUsufruttuario = Math.max(0, Math.min(100, Number(custom.ordinariaUsufruttuarioPerc)));
    criterioApplicato = 'REGOLA_CUSTOM_UNITA';
    riferimentoNormativo = 'Regola usufrutto configurata per unità su spese ordinarie (RC-I5)';
  } else if (
    input.tagSpesa === 'STRAORDINARIA' &&
    custom?.straordinariaUsufruttuarioPerc !== undefined
  ) {
    percentualeUsufruttuario = Math.max(
      0,
      Math.min(100, Number(custom.straordinariaUsufruttuarioPerc)),
    );
    criterioApplicato = 'REGOLA_CUSTOM_UNITA';
    riferimentoNormativo = 'Regola usufrutto configurata per unità su spese straordinarie (RC-I5)';
  } else if (input.tagSpesa === 'STRAORDINARIA' && input.straordinariaDaInadempimentoOrdinaria) {
    percentualeUsufruttuario = 100;
    criterioApplicato = 'STRAORDINARIA_DA_INADEMPIMENTO_ORDINARIA_ART_1005';
    riferimentoNormativo =
      'Art. 1005 c. 2 c.c. (riparazione straordinaria causata da inadempimento di ordinaria manutenzione)';
  } else if (input.tagSpesa === 'ORDINARIA') {
    percentualeUsufruttuario = 100;
    criterioApplicato = 'ART_1004_1005_CC_STANDARD';
    riferimentoNormativo =
      'Art. 1004 c.c. (custodia, amministrazione e manutenzione ordinaria a carico dell’usufruttuario)';
  } else {
    percentualeUsufruttuario = 0;
    criterioApplicato = 'ART_1004_1005_CC_STANDARD';
    riferimentoNormativo =
      'Art. 1005 c.c. (riparazioni straordinarie a carico del nudo proprietario)';
  }

  const quotaUsufruttuarioCent = calcolaQuotaPercentualeCents(
    quotaUnitaCent,
    percentualeUsufruttuario,
  );
  const quotaNudoProprietarioCent = normalizzaCentesimi(quotaUnitaCent - quotaUsufruttuarioCent);

  return {
    codiceVoce,
    descrizione,
    tagSpesa: input.tagSpesa,
    quotaUnitaCent,
    quotaUsufruttuarioCent,
    quotaUsufruttuarioEuro: centsToEuro(quotaUsufruttuarioCent),
    quotaNudoProprietarioCent,
    quotaNudoProprietarioEuro: centsToEuro(quotaNudoProprietarioCent),
    percentualeUsufruttuario,
    percentualeNudoProprietario: Number((100 - percentualeUsufruttuario).toFixed(2)),
    criterioApplicato,
    riferimentoNormativo,
  };
}

/**
 * Calcola in modo combinato le 3 quote (`quota_proprietario_centesimi`, `quota_conduttore_centesimi`,
 * `quota_usufruttuario_centesimi`) pronte per la tabella `riparti_spese` su un'unità che può avere
 * proprietario/nudo proprietario, usufruttuario e/o conduttore attivi (RC-I2..I5, T10).
 */
export function calcolaRipartoTripartitoUnitaVoce(input: {
  quotaUnitaCent: CentesimiInput;
  codiceVoce?: string | null;
  tagSpesa: TagSpesa;
  quotaInquilinoCatalogoPerc?: number | null;
  isCompensoAdmin?: boolean;
  isAssicurazioneFabbricato?: boolean;
  haConduttoreAttivo?: boolean;
  haUsufruttuarioAttivo?: boolean;
  pattoContrarioOneri?: boolean;
  tabellaOneriCustom?: TabellaOneriCustomMap | null;
  percentualePattoContrarioVoce?: number | null;
  regimeContratto?: RegimeContrattoLocazione;
  straordinariaDaInadempimentoOrdinaria?: boolean;
  regolaUsufruttoCustom?: RegolaUsufruttoCustomUnita | null;
}): {
  quotaUnitaCent: Centesimi;
  quotaProprietarioCent: Centesimi;
  quotaConduttoreCent: Centesimi;
  quotaUsufruttuarioCent: Centesimi;
  sommaQuoteCent: Centesimi;
} {
  const quotaUnitaCent = normalizzaCentesimi(input.quotaUnitaCent);

  let quotaConduttoreCent = 0;
  if (input.haConduttoreAttivo) {
    const esitoInq = calcolaRipartoLocatoreConduttoreVoce({
      quotaUnitaCent,
      codiceVoce: input.codiceVoce,
      tagSpesa: input.tagSpesa,
      quotaInquilinoCatalogoPerc: input.quotaInquilinoCatalogoPerc,
      isCompensoAdmin: input.isCompensoAdmin,
      isAssicurazioneFabbricato: input.isAssicurazioneFabbricato,
      pattoContrarioOneri: input.pattoContrarioOneri,
      tabellaOneriCustom: input.tabellaOneriCustom,
      percentualePattoContrarioVoce: input.percentualePattoContrarioVoce,
      regimeContratto: input.regimeContratto,
    });
    quotaConduttoreCent = esitoInq.quotaConduttoreCent;
  }

  const residuoDopoConduttoreCent = normalizzaCentesimi(quotaUnitaCent - quotaConduttoreCent);

  if (input.haUsufruttuarioAttivo) {
    const esitoUsuf = calcolaRipartoUsufruttuarioNudoProprietarioVoce({
      quotaUnitaCent: residuoDopoConduttoreCent,
      codiceVoce: input.codiceVoce,
      tagSpesa: input.tagSpesa,
      straordinariaDaInadempimentoOrdinaria: input.straordinariaDaInadempimentoOrdinaria,
      regolaUsufruttoCustom: input.regolaUsufruttoCustom,
    });
    return {
      quotaUnitaCent,
      quotaProprietarioCent: esitoUsuf.quotaNudoProprietarioCent,
      quotaConduttoreCent,
      quotaUsufruttuarioCent: esitoUsuf.quotaUsufruttuarioCent,
      sommaQuoteCent: normalizzaCentesimi(
        esitoUsuf.quotaNudoProprietarioCent +
          quotaConduttoreCent +
          esitoUsuf.quotaUsufruttuarioCent,
      ),
    };
  }

  return {
    quotaUnitaCent,
    quotaProprietarioCent: residuoDopoConduttoreCent,
    quotaConduttoreCent,
    quotaUsufruttuarioCent: 0,
    sommaQuoteCent: normalizzaCentesimi(residuoDopoConduttoreCent + quotaConduttoreCent),
  };
}

// ============================================================================
// 3. SUBENTRO INQUILINO A META' PERIODO CON CONGUAGLIO GIORNI E CONSUMI (RC-I7, RC-H5, RC-H6)
// ============================================================================

export interface PeriodoConduttoreInput {
  conduttoreId: string;
  nomeConduttore?: string;
  contrattoInizio: string;
  contrattoFine?: string | null;
}

export interface SubentroInquilinoVoceInput extends CalcolaRipartoLocatoreConduttoreVoceInput {
  spesaId?: string;
  competenzaDa: string;
  competenzaA: string;
  /**
   * Se `true` (es. ACQUA o RISCALDAMENTO), ripartisce il subentro in base alle letture contatore
   * a inizio periodo, al subentro e a fine periodo; se manca la lettura intermedia al subentro,
   * stima per giorni e marca `daConguagliare = true` (RC-H6, RC-I7).
   */
  isAConsumo?: boolean;
  dataSubentroConsumo?: string | null;
  letturaInizioPeriodo?: number | null;
  letturaAlSubentro?: number | null;
  letturaFinePeriodo?: number | null;
}

export interface QuotaConduttoreSubentroVoce {
  conduttoreId: string;
  nomeConduttore: string;
  periodoDa: string;
  periodoA: string;
  giorniConduzione: number;
  consumoRilevato: number | null;
  quotaCent: Centesimi;
  quotaEuro: number;
  daConguagliare: boolean;
  metodoCalcolo: 'GIORNI_TITOLARITA' | 'LETTURE_REALI_SUBENTRO' | 'STIMA_PER_GIORNI_DA_CONGUAGLIARE';
}

export interface RisultatoSubentroInquilinoVoce {
  spesaId: string | null;
  codiceVoce: string;
  descrizione: string;
  tagSpesa: TagSpesa;
  competenzaDa: string;
  competenzaA: string;
  giorniPeriodoTotale: number;
  giorniLocatiTotali: number;
  giorniSfitto: number;
  quotaUnitaCent: Centesimi;
  percentualeConduttoreApplicata: number;
  /** Quota astratta a carico della conduzione sull'intero periodo (prima di eventuale sfitto). */
  quotaTeoricaConduzioneInteroPeriodoCent: Centesimi;
  /** Eventuale quota rimasta a carico del proprietario per giorni di immobile sfitto tra due contratti. */
  quotaProprietarioPerSfittoCent: Centesimi;
  /** Quota totale effettiva a carico del proprietario/locatore (`quotaBaseLocatore + quotaProprietarioPerSfitto`). */
  quotaTotaleLocatoreCent: Centesimi;
  /** Somma delle quote effettive addebitate ai conduttori succedutisi nel periodo. */
  quotaTotaleConduttoriCent: Centesimi;
  quoteConduttori: QuotaConduttoreSubentroVoce[];
  daConguagliare: boolean;
  versioneMotore: string;
}

/**
 * Gestisce il cambio/subentro inquilino a metà periodo per una singola spesa (RC-I7, RC-H5, RC-H6):
 * - Divide le spese a periodo / ordinarie in proporzione ai giorni effettivi di conduzione nel periodo;
 * - Se tra l'uscita del vecchio inquilino e l'ingresso del nuovo c'è un periodo di sfitto, i giorni di sfitto
 *   restano interamente a carico del locatore/proprietario;
 * - Per le spese a consumo (`ACQUA`, `RISCALDAMENTO`), divide in base alle letture del contatore alla data di subentro
 *   oppure, se manca la lettura intermedia, stima per giorni marcando le quote con `daConguagliare = true` (RC-H6).
 */
export function calcolaSubentroInquilinoVoce(
  voce: SubentroInquilinoVoceInput,
  conduttori: readonly PeriodoConduttoreInput[],
): RisultatoSubentroInquilinoVoce {
  const competenzaDa = validaDataIso(voce.competenzaDa, 'competenzaDa');
  const competenzaA = validaDataIso(voce.competenzaA, 'competenzaA');
  const giorniPeriodoTotale = calcolaGiorniInclusivi(competenzaDa, competenzaA);

  const ripartoBase = calcolaRipartoLocatoreConduttoreVoce(voce);
  const quotaTeoricaConduzione = ripartoBase.quotaConduttoreCent;
  const quotaBaseLocatore = ripartoBase.quotaLocatoreCent;

  // Filtra i conduttori il cui contratto interseca [competenzaDa, competenzaA]
  const conduttoriAttiviNelPeriodo: Array<{
    conduttoreId: string;
    nomeConduttore: string;
    effettivoDa: string;
    effettivoA: string;
    giorni: number;
  }> = [];

  for (const c of conduttori) {
    const cInizio = validaDataIso(c.contrattoInizio, `conduttore[${c.conduttoreId}].contrattoInizio`);
    const cFine = c.contrattoFine
      ? validaDataIso(c.contrattoFine, `conduttore[${c.conduttoreId}].contrattoFine`)
      : competenzaA;

    const effettivoDa = cInizio > competenzaDa ? cInizio : competenzaDa;
    const effettivoA = cFine < competenzaA ? cFine : competenzaA;
    if (effettivoDa <= effettivoA) {
      const giorni = calcolaGiorniInclusivi(effettivoDa, effettivoA);
      conduttoriAttiviNelPeriodo.push({
        conduttoreId: c.conduttoreId,
        nomeConduttore: c.nomeConduttore?.trim() || c.conduttoreId,
        effettivoDa,
        effettivoA,
        giorni,
      });
    }
  }

  // Se non c'è alcun conduttore attivo o la quota conduttore è 0, tutto resta al locatore
  if (conduttoriAttiviNelPeriodo.length === 0 || quotaTeoricaConduzione === 0) {
    const giorniLocatiTotali = conduttoriAttiviNelPeriodo.reduce((acc, c) => acc + c.giorni, 0);
    return {
      spesaId: voce.spesaId ?? null,
      codiceVoce: ripartoBase.codiceVoce,
      descrizione: ripartoBase.descrizione,
      tagSpesa: ripartoBase.tagSpesa,
      competenzaDa,
      competenzaA,
      giorniPeriodoTotale,
      giorniLocatiTotali,
      giorniSfitto: Math.max(0, giorniPeriodoTotale - giorniLocatiTotali),
      quotaUnitaCent: ripartoBase.quotaUnitaCent,
      percentualeConduttoreApplicata: ripartoBase.percentualeConduttoreApplicata,
      quotaTeoricaConduzioneInteroPeriodoCent: quotaTeoricaConduzione,
      quotaProprietarioPerSfittoCent: quotaTeoricaConduzione,
      quotaTotaleLocatoreCent: ripartoBase.quotaUnitaCent,
      quotaTotaleConduttoriCent: 0,
      quoteConduttori: conduttoriAttiviNelPeriodo.map((c) => ({
        conduttoreId: c.conduttoreId,
        nomeConduttore: c.nomeConduttore,
        periodoDa: c.effettivoDa,
        periodoA: c.effettivoA,
        giorniConduzione: c.giorni,
        consumoRilevato: null,
        quotaCent: 0,
        quotaEuro: 0,
        daConguagliare: false,
        metodoCalcolo: 'GIORNI_TITOLARITA',
      })),
      daConguagliare: false,
      versioneMotore: VERSIONE_MOTORE_CALCOLO,
    };
  }

  // CASO A: Spesa a consumo con subentro tra 2 conduttori (RC-H6, RC-I7)
  const isVoceConsumo =
    Boolean(voce.isAConsumo) ||
    ripartoBase.codiceVoce === 'ACQUA' ||
    ripartoBase.codiceVoce === 'RISCALDAMENTO';

  if (
    isVoceConsumo &&
    conduttoriAttiviNelPeriodo.length === 2 &&
    (voce.dataSubentroConsumo ||
      voce.letturaAlSubentro !== undefined ||
      Boolean(voce.isAConsumo))
  ) {
    const cUscente = conduttoriAttiviNelPeriodo[0]!;
    const cSubentrante = conduttoriAttiviNelPeriodo[1]!;
    const dataSubentro = voce.dataSubentroConsumo
      ? validaDataIso(voce.dataSubentroConsumo, 'dataSubentroConsumo')
      : cSubentrante.effettivoDa;

    const esitoConsumoSub = calcolaConsumiCambioTitolare({
      unitaId: 'unita-prospetto',
      importoTotaleConsumoUnitaCent: quotaTeoricaConduzione,
      dataInizioPeriodo: competenzaDa,
      dataFinePeriodo: competenzaA,
      dataSubentro,
      titolareUscenteId: cUscente.conduttoreId,
      titolareSubentranteId: cSubentrante.conduttoreId,
      letturaInizioPeriodo: voce.letturaInizioPeriodo,
      letturaAlSubentro: voce.letturaAlSubentro,
      letturaFinePeriodo: voce.letturaFinePeriodo,
    });

    const metodo = esitoConsumoSub.metodoCalcolo;
    const quoteConduttori: QuotaConduttoreSubentroVoce[] = [
      {
        conduttoreId: cUscente.conduttoreId,
        nomeConduttore: cUscente.nomeConduttore,
        periodoDa: esitoConsumoSub.quotaUscente.periodoDa,
        periodoA: esitoConsumoSub.quotaUscente.periodoA,
        giorniConduzione: esitoConsumoSub.quotaUscente.giorniPeriodo,
        consumoRilevato: esitoConsumoSub.quotaUscente.consumoCalcolato,
        quotaCent: esitoConsumoSub.quotaUscente.quotaCent,
        quotaEuro: esitoConsumoSub.quotaUscente.quotaEuro,
        daConguagliare: esitoConsumoSub.quotaUscente.daConguagliare,
        metodoCalcolo: metodo,
      },
      {
        conduttoreId: cSubentrante.conduttoreId,
        nomeConduttore: cSubentrante.nomeConduttore,
        periodoDa: esitoConsumoSub.quotaSubentrante.periodoDa,
        periodoA: esitoConsumoSub.quotaSubentrante.periodoA,
        giorniConduzione: esitoConsumoSub.quotaSubentrante.giorniPeriodo,
        consumoRilevato: esitoConsumoSub.quotaSubentrante.consumoCalcolato,
        quotaCent: esitoConsumoSub.quotaSubentrante.quotaCent,
        quotaEuro: esitoConsumoSub.quotaSubentrante.quotaEuro,
        daConguagliare: esitoConsumoSub.quotaSubentrante.daConguagliare,
        metodoCalcolo: metodo,
      },
    ];

    return {
      spesaId: voce.spesaId ?? null,
      codiceVoce: ripartoBase.codiceVoce,
      descrizione: ripartoBase.descrizione,
      tagSpesa: ripartoBase.tagSpesa,
      competenzaDa,
      competenzaA,
      giorniPeriodoTotale,
      giorniLocatiTotali:
        esitoConsumoSub.quotaUscente.giorniPeriodo +
        esitoConsumoSub.quotaSubentrante.giorniPeriodo,
      giorniSfitto: 0,
      quotaUnitaCent: ripartoBase.quotaUnitaCent,
      percentualeConduttoreApplicata: ripartoBase.percentualeConduttoreApplicata,
      quotaTeoricaConduzioneInteroPeriodoCent: quotaTeoricaConduzione,
      quotaProprietarioPerSfittoCent: 0,
      quotaTotaleLocatoreCent: quotaBaseLocatore,
      quotaTotaleConduttoriCent: esitoConsumoSub.sommaQuoteCent,
      quoteConduttori,
      daConguagliare: esitoConsumoSub.daConguagliare,
      versioneMotore: VERSIONE_MOTORE_CALCOLO,
    };
  }

  // CASO B: Divisione per giorni di conduzione (con eventuale gestione dei giorni di sfitto a carico del proprietario)
  const giorniLocatiTotali = Math.min(
    giorniPeriodoTotale,
    conduttoriAttiviNelPeriodo.reduce((acc, c) => acc + c.giorni, 0),
  );
  const giorniSfitto = Math.max(0, giorniPeriodoTotale - giorniLocatiTotali);

  const periodiPerMotore = conduttoriAttiviNelPeriodo.map((c) => ({
    titolareId: c.conduttoreId,
    dataInizio: c.effettivoDa,
    dataFine: c.effettivoA,
  }));

  if (giorniSfitto > 0) {
    // Aggiungiamo un periodo virtuale per i giorni di sfitto a carico del locatore
    const fineSfitto = aggiungiGiorniIso(competenzaDa, giorniSfitto - 1);
    periodiPerMotore.push({
      titolareId: '__LOCATORE_SFITTO__',
      dataInizio: competenzaDa,
      dataFine: fineSfitto,
    });
  }

  const esitoGiorni = ripartisciSpesaPeriodo({
    importoCent: quotaTeoricaConduzione,
    dataInizio: competenzaDa,
    dataFine: competenzaA,
    periodiTitolarita: periodiPerMotore,
  });

  let quotaProprietarioPerSfittoCent = 0;
  let quotaTotaleConduttoriCent = 0;
  const quoteConduttori: QuotaConduttoreSubentroVoce[] = [];

  for (let i = 0; i < conduttoriAttiviNelPeriodo.length; i++) {
    const infoCond = conduttoriAttiviNelPeriodo[i]!;
    const qMotore = esitoGiorni.quoteTitolari[i]!;
    quotaTotaleConduttoriCent = normalizzaCentesimi(
      quotaTotaleConduttoriCent + qMotore.quotaFinaleCent,
    );
    quoteConduttori.push({
      conduttoreId: infoCond.conduttoreId,
      nomeConduttore: infoCond.nomeConduttore,
      periodoDa: infoCond.effettivoDa,
      periodoA: infoCond.effettivoA,
      giorniConduzione: qMotore.giorni,
      consumoRilevato: null,
      quotaCent: qMotore.quotaFinaleCent,
      quotaEuro: qMotore.quotaFinaleEuro,
      daConguagliare: false,
      metodoCalcolo: 'GIORNI_TITOLARITA',
    });
  }

  if (giorniSfitto > 0) {
    const qSfitto = esitoGiorni.quoteTitolari[conduttoriAttiviNelPeriodo.length];
    quotaProprietarioPerSfittoCent = qSfitto ? qSfitto.quotaFinaleCent : 0;
  }

  const quotaTotaleLocatoreCent = normalizzaCentesimi(
    quotaBaseLocatore + quotaProprietarioPerSfittoCent,
  );

  return {
    spesaId: voce.spesaId ?? null,
    codiceVoce: ripartoBase.codiceVoce,
    descrizione: ripartoBase.descrizione,
    tagSpesa: ripartoBase.tagSpesa,
    competenzaDa,
    competenzaA,
    giorniPeriodoTotale,
    giorniLocatiTotali,
    giorniSfitto,
    quotaUnitaCent: ripartoBase.quotaUnitaCent,
    percentualeConduttoreApplicata: ripartoBase.percentualeConduttoreApplicata,
    quotaTeoricaConduzioneInteroPeriodoCent: quotaTeoricaConduzione,
    quotaProprietarioPerSfittoCent,
    quotaTotaleLocatoreCent,
    quotaTotaleConduttoriCent,
    quoteConduttori,
    daConguagliare: false,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 4. PROSPETTO INQUILINO CON SCADENZA A 2 MESI DALLA RICHIESTA (RC-I1, RC-I6, RC-I7, T10)
// ============================================================================

/**
 * Calcola la data limite di pagamento degli oneri accessori da parte del conduttore:
 * esattamente **2 mesi dalla data della richiesta** (art. 9, c. 3, L. 392/1978, RC-I6).
 */
export function calcolaScadenzaPagamentoInquilino(dataRichiesta: string): string {
  const dataRichiestaValida = validaDataIso(dataRichiesta, 'dataRichiesta');
  return aggiungiMesiCalendarioIso(dataRichiestaValida, TERMINE_PAGAMENTO_INQUILINO_MESI);
}

export interface VoceSpesaPerProspettoInquilinoInput extends SubentroInquilinoVoceInput {
  docAllegatoId?: string | null;
  numeroFattura?: string | null;
}

export interface GeneraProspettoInquilinoInput {
  condominioId: string;
  nomeCondominio?: string;
  unitaId: string;
  internoUnita?: string;
  esercizioId?: string | null;
  annoEsercizio?: number;
  periodoDa: string;
  periodoA: string;
  /** Data in cui il locatore/amministratore formula la richiesta di pagamento al conduttore (`YYYY-MM-DD`, RC-I6). */
  dataRichiesta: string;
  proprietario: {
    utenteId?: string | null;
    soggettoId?: string | null;
    nomeDenominazione: string;
  };
  /** Conduttore principale (oppure elenco di conduttori in caso di subentro a metà periodo, RC-I7). */
  conduttore?: PeriodoConduttoreInput;
  conduttori?: readonly PeriodoConduttoreInput[];
  usufruttuario?: {
    utenteId?: string | null;
    soggettoId?: string | null;
    nomeDenominazione: string;
    regolaUsufruttoCustom?: RegolaUsufruttoCustomUnita | null;
  } | null;
  pattoContrarioOneri?: boolean;
  tabellaOneriCustom?: TabellaOneriCustomMap | null;
  regimeContratto?: RegimeContrattoLocazione;
  bloccaClausoleNulleArt79?: boolean;
  /** Eventuali acconti sugli oneri accessori già versati dal conduttore nel periodo. */
  accontiVersatiConduttoreCent?: CentesimiInput;
  vociSpesa: readonly VoceSpesaPerProspettoInquilinoInput[];
}

export interface RigaProspettoInquilino {
  spesaId: string | null;
  codiceVoce: string;
  descrizione: string;
  tagSpesa: TagSpesa;
  competenzaDa: string;
  competenzaA: string;
  importoSpesaCondominioCent: Centesimi | null;
  quotaUnitaCent: Centesimi;
  quotaUnitaEuro: number;
  percentualeConduttoreApplicata: number;
  fonteRegola: FonteRegolaOneriAccessori;
  quotaLocatoreCent: Centesimi;
  quotaLocatoreEuro: number;
  quotaConduttoreCent: Centesimi;
  quotaConduttoreEuro: number;
  quotaUsufruttuarioCent: Centesimi;
  quotaUsufruttuarioEuro: number;
  quoteSubentroConduttori: QuotaConduttoreSubentroVoce[];
  daConguagliare: boolean;
  docAllegatoId: string | null;
  numeroFattura: string | null;
  avvisoArt79: string | null;
}

export interface RiepilogoPerConduttoreProspetto {
  conduttoreId: string;
  nomeConduttore: string;
  contrattoInizio: string;
  contrattoFine: string | null;
  totaleOneriCompetenzaCent: Centesimi;
  totaleOneriCompetenzaEuro: number;
  haQuoteDaConguagliare: boolean;
}

export interface ProspettoInquilinoOutput {
  condominioId: string;
  nomeCondominio: string;
  unitaId: string;
  internoUnita: string;
  esercizioId: string | null;
  periodoDa: string;
  periodoA: string;
  /** Per RC-I1 il condominio fattura sempre al proprietario: questo documento è un prospetto, non una fattura autonoma. */
  naturaDocumento: 'PROSPETTO_RIPARTO_ONERI_ACCESSORI';
  isFatturazioneSeparataCondominio: false;
  debitoreVersoCondominio: 'PROPRIETARIO';
  dataRichiesta: string;
  /** Scadenza legale a 2 mesi dalla data di richiesta ex art. 9, c. 3, L. 392/1978 (RC-I6). */
  dataScadenzaPagamentoInquilino: string;
  /** Termine entro cui il conduttore ha diritto di prendere visione dei giustificativi ex art. 9, c. 3, L. 392/1978. */
  termineDirittoVisioneDocumenti: string;
  riferimentoNormativoScadenza: 'Art. 9, c. 3, L. 27 luglio 1978, n. 392 (pagamento entro 2 mesi dalla richiesta)';
  proprietario: {
    utenteId: string | null;
    soggettoId: string | null;
    nomeDenominazione: string;
  };
  usufruttuario: {
    utenteId: string | null;
    soggettoId: string | null;
    nomeDenominazione: string;
  } | null;
  righe: RigaProspettoInquilino[];
  riepilogoConduttori: RiepilogoPerConduttoreProspetto[];
  totaleSpeseUnitaCent: Centesimi;
  totaleSpeseUnitaEuro: number;
  totaleQuotaLocatoreCent: Centesimi;
  totaleQuotaLocatoreEuro: number;
  totaleQuotaConduttoreCent: Centesimi;
  totaleQuotaConduttoreEuro: number;
  totaleQuotaUsufruttuarioCent: Centesimi;
  totaleQuotaUsufruttuarioEuro: number;
  accontiVersatiConduttoreCent: Centesimi;
  saldoNettoDaPagareConduttoreCent: Centesimi;
  saldoNettoDaPagareConduttoreEuro: number;
  haQuoteDaConguagliare: boolean;
  avvisiNormativi: string[];
  payloadPdf: {
    titolo: string;
    sottotitolo: string;
    dataRichiesta: string;
    scadenzaPagamento: string;
    totaleConduttoreFormattato: string;
    totaleLocatoreFormattato: string;
    saldoNettoConduttoreFormattato: string;
    notaLegaleArt9: string;
  };
  versioneMotore: string;
}

/**
 * Genera il prospetto completo di ripartizione degli oneri accessori tra proprietario/locatore,
 * conduttore (o più conduttori subentrati a metà periodo, RC-I7) ed eventuale usufruttuario (RC-I5),
 * calcolando la scadenza di pagamento entro 2 mesi dalla richiesta ex art. 9, c. 3, L. 392/1978 (RC-I1..I7, T10).
 */
export function generaProspettoInquilino(
  input: GeneraProspettoInquilinoInput,
): ProspettoInquilinoOutput {
  const periodoDa = validaDataIso(input.periodoDa, 'periodoDa');
  const periodoA = validaDataIso(input.periodoA, 'periodoA');
  const dataRichiesta = validaDataIso(input.dataRichiesta, 'dataRichiesta');
  calcolaGiorniInclusivi(periodoDa, periodoA);

  const dataScadenzaPagamentoInquilino = calcolaScadenzaPagamentoInquilino(dataRichiesta);

  const listaConduttori: PeriodoConduttoreInput[] = input.conduttori
    ? [...input.conduttori]
    : input.conduttore
      ? [input.conduttore]
      : [
          {
            conduttoreId: 'conduttore-default',
            nomeConduttore: 'Conduttore',
            contrattoInizio: periodoDa,
            contrattoFine: periodoA,
          },
        ];

  const righe: RigaProspettoInquilino[] = [];
  const avvisiNormativi: string[] = [];
  const totaliPerConduttore = new Map<
    string,
    { info: PeriodoConduttoreInput; totaleCent: Centesimi; haDaConguagliare: boolean }
  >();

  for (const c of listaConduttori) {
    totaliPerConduttore.set(c.conduttoreId, {
      info: c,
      totaleCent: 0,
      haDaConguagliare: false,
    });
  }

  let totaleSpeseUnitaCent = 0;
  let totaleQuotaLocatoreCent = 0;
  let totaleQuotaConduttoreCent = 0;
  let totaleQuotaUsufruttuarioCent = 0;
  let haQuoteDaConguagliare = false;

  for (const v of input.vociSpesa) {
    const voceArricchita: SubentroInquilinoVoceInput = {
      ...v,
      competenzaDa: v.competenzaDa || periodoDa,
      competenzaA: v.competenzaA || periodoA,
      pattoContrarioOneri: v.pattoContrarioOneri ?? input.pattoContrarioOneri,
      tabellaOneriCustom: v.tabellaOneriCustom ?? input.tabellaOneriCustom,
      regimeContratto: v.regimeContratto ?? input.regimeContratto,
      bloccaClausoleNulleArt79: v.bloccaClausoleNulleArt79 ?? input.bloccaClausoleNulleArt79,
    };

    const ripartoVoce = calcolaRipartoLocatoreConduttoreVoce(voceArricchita);
    if (ripartoVoce.avvisoArt79) {
      avvisiNormativi.push(ripartoVoce.avvisoArt79);
    }

    const subentroVoce = calcolaSubentroInquilinoVoce(voceArricchita, listaConduttori);

    let quotaLocatoreRigaCent = subentroVoce.quotaTotaleLocatoreCent;
    let quotaUsufruttuarioRigaCent = 0;

    if (input.usufruttuario && quotaLocatoreRigaCent > 0) {
      const esitoUsuf = calcolaRipartoUsufruttuarioNudoProprietarioVoce({
        quotaUnitaCent: quotaLocatoreRigaCent,
        codiceVoce: ripartoVoce.codiceVoce,
        descrizione: ripartoVoce.descrizione,
        tagSpesa: ripartoVoce.tagSpesa,
        regolaUsufruttoCustom: input.usufruttuario.regolaUsufruttoCustom,
      });
      quotaLocatoreRigaCent = esitoUsuf.quotaNudoProprietarioCent;
      quotaUsufruttuarioRigaCent = esitoUsuf.quotaUsufruttuarioCent;
    }

    const quotaConduttoreRigaCent = subentroVoce.quotaTotaleConduttoriCent;

    for (const qc of subentroVoce.quoteConduttori) {
      const entry = totaliPerConduttore.get(qc.conduttoreId);
      if (entry) {
        entry.totaleCent = normalizzaCentesimi(entry.totaleCent + qc.quotaCent);
        if (qc.daConguagliare) {
          entry.haDaConguagliare = true;
        }
      }
    }

    if (subentroVoce.daConguagliare) {
      haQuoteDaConguagliare = true;
    }

    totaleSpeseUnitaCent = normalizzaCentesimi(
      totaleSpeseUnitaCent + ripartoVoce.quotaUnitaCent,
    );
    totaleQuotaLocatoreCent = normalizzaCentesimi(
      totaleQuotaLocatoreCent + quotaLocatoreRigaCent,
    );
    totaleQuotaConduttoreCent = normalizzaCentesimi(
      totaleQuotaConduttoreCent + quotaConduttoreRigaCent,
    );
    totaleQuotaUsufruttuarioCent = normalizzaCentesimi(
      totaleQuotaUsufruttuarioCent + quotaUsufruttuarioRigaCent,
    );

    righe.push({
      spesaId: v.spesaId ?? null,
      codiceVoce: ripartoVoce.codiceVoce,
      descrizione: ripartoVoce.descrizione,
      tagSpesa: ripartoVoce.tagSpesa,
      competenzaDa: subentroVoce.competenzaDa,
      competenzaA: subentroVoce.competenzaA,
      importoSpesaCondominioCent: ripartoVoce.importoSpesaTotaleCondominioCent,
      quotaUnitaCent: ripartoVoce.quotaUnitaCent,
      quotaUnitaEuro: ripartoVoce.quotaUnitaEuro,
      percentualeConduttoreApplicata: ripartoVoce.percentualeConduttoreApplicata,
      fonteRegola: ripartoVoce.fonteRegola,
      quotaLocatoreCent: quotaLocatoreRigaCent,
      quotaLocatoreEuro: centsToEuro(quotaLocatoreRigaCent),
      quotaConduttoreCent: quotaConduttoreRigaCent,
      quotaConduttoreEuro: centsToEuro(quotaConduttoreRigaCent),
      quotaUsufruttuarioCent: quotaUsufruttuarioRigaCent,
      quotaUsufruttuarioEuro: centsToEuro(quotaUsufruttuarioRigaCent),
      quoteSubentroConduttori: subentroVoce.quoteConduttori,
      daConguagliare: subentroVoce.daConguagliare,
      docAllegatoId: v.docAllegatoId ?? null,
      numeroFattura: v.numeroFattura ?? null,
      avvisoArt79: ripartoVoce.avvisoArt79,
    });
  }

  const accontiVersatiConduttoreCent = normalizzaCentesimi(
    input.accontiVersatiConduttoreCent ?? 0,
  );
  const saldoNettoDaPagareConduttoreCent = normalizzaCentesimi(
    totaleQuotaConduttoreCent - accontiVersatiConduttoreCent,
  );

  const riepilogoConduttori: RiepilogoPerConduttoreProspetto[] = Array.from(
    totaliPerConduttore.values(),
  ).map((item) => ({
    conduttoreId: item.info.conduttoreId,
    nomeConduttore: item.info.nomeConduttore ?? item.info.conduttoreId,
    contrattoInizio: item.info.contrattoInizio,
    contrattoFine: item.info.contrattoFine ?? null,
    totaleOneriCompetenzaCent: item.totaleCent,
    totaleOneriCompetenzaEuro: centsToEuro(item.totaleCent),
    haQuoteDaConguagliare: item.haDaConguagliare,
  }));

  const nomeCondominio = input.nomeCondominio?.trim() || 'Condominio';
  const internoUnita = input.internoUnita?.trim() || input.unitaId;

  return {
    condominioId: input.condominioId,
    nomeCondominio,
    unitaId: input.unitaId,
    internoUnita,
    esercizioId: input.esercizioId ?? null,
    periodoDa,
    periodoA,
    naturaDocumento: 'PROSPETTO_RIPARTO_ONERI_ACCESSORI',
    isFatturazioneSeparataCondominio: false,
    debitoreVersoCondominio: 'PROPRIETARIO',
    dataRichiesta,
    dataScadenzaPagamentoInquilino,
    termineDirittoVisioneDocumenti: dataScadenzaPagamentoInquilino,
    riferimentoNormativoScadenza:
      'Art. 9, c. 3, L. 27 luglio 1978, n. 392 (pagamento entro 2 mesi dalla richiesta)',
    proprietario: {
      utenteId: input.proprietario.utenteId ?? null,
      soggettoId: input.proprietario.soggettoId ?? null,
      nomeDenominazione: input.proprietario.nomeDenominazione,
    },
    usufruttuario: input.usufruttuario
      ? {
          utenteId: input.usufruttuario.utenteId ?? null,
          soggettoId: input.usufruttuario.soggettoId ?? null,
          nomeDenominazione: input.usufruttuario.nomeDenominazione,
        }
      : null,
    righe,
    riepilogoConduttori,
    totaleSpeseUnitaCent,
    totaleSpeseUnitaEuro: centsToEuro(totaleSpeseUnitaCent),
    totaleQuotaLocatoreCent,
    totaleQuotaLocatoreEuro: centsToEuro(totaleQuotaLocatoreCent),
    totaleQuotaConduttoreCent,
    totaleQuotaConduttoreEuro: centsToEuro(totaleQuotaConduttoreCent),
    totaleQuotaUsufruttuarioCent,
    totaleQuotaUsufruttuarioEuro: centsToEuro(totaleQuotaUsufruttuarioCent),
    accontiVersatiConduttoreCent,
    saldoNettoDaPagareConduttoreCent,
    saldoNettoDaPagareConduttoreEuro: centsToEuro(saldoNettoDaPagareConduttoreCent),
    haQuoteDaConguagliare,
    avvisiNormativi,
    payloadPdf: {
      titolo: `Prospetto Oneri Accessori - ${nomeCondominio} (Int. ${internoUnita})`,
      sottotitolo: `Periodo ${periodoDa} / ${periodoA} - Rif. Art. 9 L. 392/1978 e DM 16/01/2017`,
      dataRichiesta,
      scadenzaPagamento: dataScadenzaPagamentoInquilino,
      totaleConduttoreFormattato: formattaCentsItaliano(totaleQuotaConduttoreCent, true),
      totaleLocatoreFormattato: formattaCentsItaliano(totaleQuotaLocatoreCent, true),
      saldoNettoConduttoreFormattato: formattaCentsItaliano(
        saldoNettoDaPagareConduttoreCent,
        true,
      ),
      notaLegaleArt9:
        `Il presente documento costituisce prospetto analitico di riparto tra locatore e conduttore (RC-I1, RC-I6). ` +
        `Ai sensi dell'art. 9, comma 3, L. 392/1978, il pagamento da parte del conduttore deve avvenire entro due mesi ` +
        `dalla richiesta (entro il ${dataScadenzaPagamentoInquilino}); prima di effettuare il pagamento il conduttore ha ` +
        `diritto di ottenere l'indicazione specifica delle spese e dei criteri di ripartizione e di prendere visione dei documenti giustificativi.`,
    },
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}
