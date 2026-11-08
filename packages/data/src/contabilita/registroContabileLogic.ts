/**
 * Logica pura per il Registro Cronologico di Contabilità, il Catalogo Voci e la Gestione Spese
 * (Sezione 4: RC-A1, RC-A3..A5 e Sezione 5: RC-B1..B5, RC-C1..C8 dei requisiti contabili).
 *
 * Principi fondamentali:
 * - Nessuna cancellazione contabile (RC-B4): ogni correzione su movimenti registrati avviene
 *   tramite scrittura contraria di storno collegata all'originale (`storno_di_id`).
 * - Rilevazione ritardo di registrazione > 30 giorni rispetto alla data del movimento con alert non bloccante (RC-B2, RC-N3).
 * - Validazione dell'allegato giustificativo con impronta crittografica/hash (RC-B3, RC-K1).
 * - Transito obbligatorio dal conto corrente condominiale o marcatura esplicita d'eccezione con motivo (RC-B1).
 * - Fatture fornitori con imponibile, IVA, ritenuta d'acconto come solo dato analitico (senza F24/CU/770), totale e competenza (RC-B5).
 * - Menu "Chi paga" (Tutti, Palazzo/scala, Tabella specifica, Personalizzato con atto e data, Consumi) con quadratura al centesimo (RC-C3, RC-C4, RC-C6).
 * - Nessuna dipendenza da React, Expo, `Intl` o Supabase.
 */

import {
  calcolaGiorniInclusivi,
  centsToEuro,
  dividiEArrotondaHalfUp,
  normalizzaCentesimi,
  ripartisciConsumi,
  ripartisciSpesa,
  ripartisciSpesaPeriodo,
  validaQuadraturaMillesimi,
  VERSIONE_MOTORE_CALCOLO,
  type Centesimi,
  type CentesimiInput,
  type ConsumoUnitaInput,
  type PeriodoTitolaritaInput,
  type QuotaMillesimiInput,
  type RigaProspettoRiparto,
  type StimeMancantiMapOrArray,
} from './contabilitaLogic.ts';

// ============================================================================
// COSTANTI E TIPI DI DOMINIO (SEZIONI 4 E 5)
// ============================================================================

/** Soglia di legge/prassi oltre cui la registrazione nel registro cronologico genera un avviso (art. 1130 n. 7 c.c., RC-B2). */
export const SOGLIA_RITARDO_REGISTRAZIONE_GIORNI = 30;

/** Tipi MIME ammessi per il giustificativo di spesa (PDF o immagine, RC-B3). */
export const TIPI_MIME_GIUSTIFICATIVO_AMMESSI = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export type TipoMimeGiustificativo = (typeof TIPI_MIME_GIUSTIFICATIVO_AMMESSI)[number];

export const TAGS_SPESA = ['ORDINARIA', 'STRAORDINARIA'] as const;
export type TagSpesa = (typeof TAGS_SPESA)[number];

export const STATI_SPESA = ['BOZZA', 'REGISTRATA', 'STORNATA'] as const;
export type StatoSpesa = (typeof STATI_SPESA)[number];

export const CRITERI_CHI_PAGA = [
  'TUTTI',
  'PALAZZO_SCALA',
  'TABELLA_SPECIFICA',
  'PERSONALIZZATO',
  'CONSUMI',
] as const;
export type CriterioChiPaga = (typeof CRITERI_CHI_PAGA)[number];

export const TIPI_ATTO_DEROGA = [
  'REGOLAMENTO_CONTRATTUALE',
  'DELIBERA_UNANIME',
  'DELIBERA_ASSEMBLEA',
] as const;
export type AttoDerogaTipo = (typeof TIPI_ATTO_DEROGA)[number];

export const TIPI_TABELLA_MILLESIMALE = [
  'PROPRIETA',
  'SCALA',
  'ASCENSORE',
  'RISCALDAMENTO',
  'ACQUA',
  'USO',
  'ALTRA',
] as const;
export type TipoTabellaMillesimale = (typeof TIPI_TABELLA_MILLESIMALE)[number];

export const STATI_APPROVAZIONE_TABELLA = ['BOZZA', 'APPROVATA'] as const;
export type StatoApprovazioneTabella = (typeof STATI_APPROVAZIONE_TABELLA)[number];

export interface VoceCatalogoDefault {
  codice: string;
  nome: string;
  tagDefault: TagSpesa;
  criterioDefault: CriterioChiPaga;
  quotaInquilinoDefaultPerc: number;
  isAPeriodo: boolean;
  isCompensoAdmin: boolean;
}

/**
 * Le 10 voci iniziali del catalogo spese con criterio, tag e percentuale inquilino di default (RC-C2, RC-I2, RC-I4).
 */
export const VOCI_SPESA_CATALOGO_DEFAULT: readonly VoceCatalogoDefault[] = [
  {
    codice: 'ASCENSORE',
    nome: 'Ascensore',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'TABELLA_SPECIFICA',
    quotaInquilinoDefaultPerc: 100,
    isAPeriodo: false,
    isCompensoAdmin: false,
  },
  {
    codice: 'PULIZIA_SCALE',
    nome: 'Pulizia scale',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'PALAZZO_SCALA',
    quotaInquilinoDefaultPerc: 100,
    isAPeriodo: false,
    isCompensoAdmin: false,
  },
  {
    codice: 'ACQUA',
    nome: 'Acqua',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'CONSUMI',
    quotaInquilinoDefaultPerc: 100,
    isAPeriodo: false,
    isCompensoAdmin: false,
  },
  {
    codice: 'RISCALDAMENTO',
    nome: 'Riscaldamento',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'CONSUMI',
    quotaInquilinoDefaultPerc: 100,
    isAPeriodo: false,
    isCompensoAdmin: false,
  },
  {
    codice: 'LUCE_COMUNE',
    nome: 'Energia elettrica parti comuni',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'TUTTI',
    quotaInquilinoDefaultPerc: 100,
    isAPeriodo: false,
    isCompensoAdmin: false,
  },
  {
    codice: 'ASSICURAZIONE',
    nome: 'Assicurazione fabbricato',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'TUTTI',
    quotaInquilinoDefaultPerc: 0,
    isAPeriodo: true,
    isCompensoAdmin: false,
  },
  {
    codice: 'COMPENSO_ADMIN',
    nome: 'Compenso amministratore',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'TUTTI',
    quotaInquilinoDefaultPerc: 0,
    isAPeriodo: true,
    isCompensoAdmin: true,
  },
  {
    codice: 'MANUT_ORDINARIA',
    nome: 'Manutenzione ordinaria',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'TUTTI',
    quotaInquilinoDefaultPerc: 100,
    isAPeriodo: false,
    isCompensoAdmin: false,
  },
  {
    codice: 'MANUT_STRAORD',
    nome: 'Manutenzione straordinaria',
    tagDefault: 'STRAORDINARIA',
    criterioDefault: 'TUTTI',
    quotaInquilinoDefaultPerc: 0,
    isAPeriodo: false,
    isCompensoAdmin: false,
  },
  {
    codice: 'SPESE_LEGALI',
    nome: 'Spese legali',
    tagDefault: 'ORDINARIA',
    criterioDefault: 'TUTTI',
    quotaInquilinoDefaultPerc: 0,
    isAPeriodo: false,
    isCompensoAdmin: false,
  },
];

// ============================================================================
// UTILITA' DATE ISO E HASH SHA-256 PURO
// ============================================================================

function parseDataIsoUtcMs(dataIso: string, nomeCampo: string): number {
  if (typeof dataIso !== 'string') {
    throw new TypeError(`Data non valida per ${nomeCampo}: atteso formato YYYY-MM-DD.`);
  }
  const pulita = dataIso.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pulita);
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

const K_SHA256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function utf8ToBytes(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Calcola l'impronta SHA-256 esadecimale (64 caratteri minuscoli) di un contenuto testuale o binario.
 * Implementazione pura deterministica senza dipendenze da `node:crypto` o Web Crypto, compatibile con Hermes/Web/Node.
 */
export function calcolaImprontaSha256(contenuto: string | Uint8Array): string {
  const msg = typeof contenuto === 'string' ? utf8ToBytes(contenuto) : contenuto;
  const bitLen = msg.length * 8;
  const padLen = ((msg.length + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(msg);
  padded[msg.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(w[i - 15]!, 7) ^ rotr32(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr32(w[i - 2]!, 17) ^ rotr32(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K_SHA256[i]! + w[i]!) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

// ============================================================================
// 1. ANAGRAFICA CONDOMINIO E TABELLE MILLESIMALI VERSIONATE (SEZIONE 4: RC-A1, RC-A3..A5)
// ============================================================================

export interface RisultatoValidazioneIban {
  valido: boolean;
  ibanNormalizzato: string | null;
  errore: string | null;
}

/**
 * Valida l'IBAN del conto corrente condominiale (RC-A1: "non si crea un condominio senza IBAN").
 */
export function validaIbanCondominio(iban: string | null | undefined): RisultatoValidazioneIban {
  if (!iban || !iban.trim()) {
    return {
      valido: false,
      ibanNormalizzato: null,
      errore: 'IBAN del conto corrente condominiale obbligatorio (RC-A1).',
    };
  }
  const normalizzato = iban.replace(/\s+/g, '').toUpperCase();
  // Formato standard IBAN (IT = 27 caratteri, SEPA 15..34 caratteri alfanumerici)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(normalizzato)) {
    return {
      valido: false,
      ibanNormalizzato: null,
      errore: `Formato IBAN non valido: "${iban}".`,
    };
  }
  if (normalizzato.startsWith('IT') && normalizzato.length !== 27) {
    return {
      valido: false,
      ibanNormalizzato: null,
      errore: `Un IBAN italiano deve avere esattamente 27 caratteri (trovati ${normalizzato.length}).`,
    };
  }
  return {
    valido: true,
    ibanNormalizzato: normalizzato,
    errore: null,
  };
}

/**
 * Maschera l'IBAN per la visualizzazione predefinita nell'interfaccia (RC-M5).
 */
export function mascheraIban(iban: string | null | undefined): string {
  if (!iban) return '—';
  const pulito = iban.replace(/\s+/g, '').toUpperCase();
  if (pulito.length <= 8) return '****';
  return `${pulito.slice(0, 4)} **** **** ${pulito.slice(-4)}`;
}

// ============================================================================
// 2. CONTO CORRENTE ED ECCEZIONE FUORI CONTO (RC-B1)
// ============================================================================

export interface ValidazioneEccezioneCcInput {
  eccezioneContoCorrente?: boolean | null;
  motivoEccezioneCc?: string | null;
}

export interface RisultatoValidazioneEccezioneCc {
  valido: boolean;
  eccezioneContoCorrente: boolean;
  motivoEccezioneCc: string | null;
  inElencoControllo: boolean;
  avviso: string | null;
  errore: string | null;
}

/**
 * Verifica il rispetto dell'obbligo di transito sul conto corrente condominiale (art. 1129 c. 7 c.c., RC-B1).
 * Un movimento fuori conto è ammesso solo con flag `eccezioneContoCorrente = true` e `motivoEccezioneCc` valorizzato,
 * e compare nell'elenco di controllo.
 */
export function validaEccezioneContoCorrente(
  input: ValidazioneEccezioneCcInput,
): RisultatoValidazioneEccezioneCc {
  const isEccezione = Boolean(input.eccezioneContoCorrente);
  const motivo = input.motivoEccezioneCc?.trim() ?? '';

  if (!isEccezione) {
    return {
      valido: true,
      eccezioneContoCorrente: false,
      motivoEccezioneCc: null,
      inElencoControllo: false,
      avviso: null,
      errore: null,
    };
  }

  if (motivo.length < 3) {
    return {
      valido: false,
      eccezioneContoCorrente: true,
      motivoEccezioneCc: null,
      inElencoControllo: true,
      avviso: null,
      errore:
        'Un movimento fuori conto corrente richiede obbligatoriamente il motivo dell’eccezione (art. 1129 c. 7 c.c., RC-B1).',
    };
  }

  return {
    valido: true,
    eccezioneContoCorrente: true,
    motivoEccezioneCc: motivo,
    inElencoControllo: true,
    avviso: `Movimento registrato come eccezione fuori conto corrente: "${motivo}". Inserito nell'elenco di controllo (RC-B1).`,
    errore: null,
  };
}

/**
 * Filtra i movimenti registrati con eccezione fuori conto corrente per l'elenco di controllo (RC-B1).
 */
export function filtraMovimentiFuoriConto<
  T extends { eccezione_conto_corrente?: boolean | null; eccezioneContoCorrente?: boolean | null },
>(movimenti: readonly T[]): T[] {
  return movimenti.filter((m) => Boolean(m.eccezione_conto_corrente ?? m.eccezioneContoCorrente));
}

// ============================================================================
// 3. RILEVAZIONE RITARDO DI REGISTRAZIONE > 30 GIORNI (RC-B2, RC-N3)
// ============================================================================

export interface RilevaRitardoRegistrazioneInput {
  /** Data in cui è avvenuto il movimento finanziario (`YYYY-MM-DD`). */
  dataMovimento: string;
  /** Data in cui il movimento viene annotato nel registro di contabilità (`YYYY-MM-DD`). */
  dataRegistrazione: string;
  /** Soglia massima di giorni senza avviso (default 30 giorni ex art. 1130 n. 7 c.c.). */
  sogliaGiorni?: number;
}

export interface RisultatoRitardoRegistrazione {
  dataMovimento: string;
  dataRegistrazione: string;
  giorniRitardo: number;
  sogliaGiorni: number;
  /** `true` se `giorniRitardo > sogliaGiorni` (default > 30 giorni). */
  inRitardo: boolean;
  /** Alias di `inRitardo`. */
  superaSoglia: boolean;
  /** `true` se la data di registrazione precede la data del movimento. */
  registrazioneAntecedenteMovimento: boolean;
  /** Il ritardo genera un avviso ma non blocca la registrazione (RC-B2, RC-N3). */
  bloccante: false;
  codiceAlert: 'RITARDO_REGISTRAZIONE_OLTRE_30GG' | 'DATA_REGISTRAZIONE_ANTECEDENTE' | null;
  livelloAlert: 'warning' | null;
  messaggioAlert: string | null;
  /** Alias di `messaggioAlert`. */
  avviso: string | null;
}

/**
 * Rileva se la registrazione di un movimento nel registro cronologico supera i 30 giorni
 * rispetto alla data del movimento (art. 1130 n. 7 c.c., RC-B2, RC-N3).
 *
 * Accetta sia un oggetto `{ dataMovimento, dataRegistrazione, sogliaGiorni }` sia argomenti posizionali.
 */
export function rilevaRitardoRegistrazione(
  inputOrDataMovimento: RilevaRitardoRegistrazioneInput | string,
  dataRegistrazioneArg?: string,
  sogliaGiorniArg: number = SOGLIA_RITARDO_REGISTRAZIONE_GIORNI,
): RisultatoRitardoRegistrazione {
  const dataMovimento =
    typeof inputOrDataMovimento === 'string'
      ? inputOrDataMovimento
      : inputOrDataMovimento.dataMovimento;
  const dataRegistrazione =
    typeof inputOrDataMovimento === 'string'
      ? (dataRegistrazioneArg ?? inputOrDataMovimento)
      : inputOrDataMovimento.dataRegistrazione;
  const sogliaGiorni =
    typeof inputOrDataMovimento === 'string'
      ? sogliaGiorniArg
      : (inputOrDataMovimento.sogliaGiorni ?? SOGLIA_RITARDO_REGISTRAZIONE_GIORNI);

  if (!Number.isFinite(sogliaGiorni) || sogliaGiorni < 0) {
    throw new RangeError(`La soglia giorni deve essere non negativa: ${String(sogliaGiorni)}`);
  }

  const movMs = parseDataIsoUtcMs(dataMovimento, 'dataMovimento');
  const regMs = parseDataIsoUtcMs(dataRegistrazione, 'dataRegistrazione');
  const giorniRitardo = Math.round((regMs - movMs) / 86_400_000);

  const dataMovIso = dataMovimento.trim().slice(0, 10);
  const dataRegIso = dataRegistrazione.trim().slice(0, 10);

  if (giorniRitardo < 0) {
    const msg = `Attenzione: la data di registrazione (${dataRegIso}) precede la data del movimento (${dataMovIso}).`;
    return {
      dataMovimento: dataMovIso,
      dataRegistrazione: dataRegIso,
      giorniRitardo,
      sogliaGiorni,
      inRitardo: false,
      superaSoglia: false,
      registrazioneAntecedenteMovimento: true,
      bloccante: false,
      codiceAlert: 'DATA_REGISTRAZIONE_ANTECEDENTE',
      livelloAlert: 'warning',
      messaggioAlert: msg,
      avviso: msg,
    };
  }

  const inRitardo = giorniRitardo > sogliaGiorni;
  const messaggioAlert = inRitardo
    ? `Attenzione: registrazione effettuata con ${giorniRitardo} giorni di ritardo rispetto alla data del movimento (${dataMovIso} -> ${dataRegIso}), oltre il termine di ${sogliaGiorni} giorni previsto dall'art. 1130 n. 7 c.c. (RC-B2).`
    : null;

  return {
    dataMovimento: dataMovIso,
    dataRegistrazione: dataRegIso,
    giorniRitardo,
    sogliaGiorni,
    inRitardo,
    superaSoglia: inRitardo,
    registrazioneAntecedenteMovimento: false,
    bloccante: false,
    codiceAlert: inRitardo ? 'RITARDO_REGISTRAZIONE_OLTRE_30GG' : null,
    livelloAlert: inRitardo ? 'warning' : null,
    messaggioAlert,
    avviso: messaggioAlert,
  };
}

/** Alias di `rilevaRitardoRegistrazione`. */
export const verificaRitardoRegistrazione = rilevaRitardoRegistrazione;

/**
 * Ordina i movimenti del registro di contabilità in ordine cronologico (RC-B2, RC-K2):
 * per data movimento crescente, numero progressivo crescente, data registrazione crescente e id.
 */
export function ordinaRegistroCronologico<
  T extends {
    id: string;
    data: string;
    numero_progressivo?: number | null;
    data_registrazione?: string | null;
  },
>(movimenti: readonly T[], direzione: 'asc' | 'desc' = 'asc'): T[] {
  const fattore = direzione === 'asc' ? 1 : -1;
  return [...movimenti].sort((a, b) => {
    if (a.data !== b.data) {
      return (a.data < b.data ? -1 : 1) * fattore;
    }
    const progA = a.numero_progressivo ?? Number.MAX_SAFE_INTEGER;
    const progB = b.numero_progressivo ?? Number.MAX_SAFE_INTEGER;
    if (progA !== progB) {
      return (progA - progB) * fattore;
    }
    const regA = a.data_registrazione ?? a.data;
    const regB = b.data_registrazione ?? b.data;
    if (regA !== regB) {
      return (regA < regB ? -1 : 1) * fattore;
    }
    return (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) * fattore;
  });
}

// ============================================================================
// 4. VALIDAZIONE ALLEGATO GIUSTIFICATIVO CON HASH/IMPRONTA (RC-B3, RC-K1)
// ============================================================================

export interface ValidazioneGiustificativoInput {
  docAllegatoId?: string | null;
  improntaFile?: string | null;
  /** Contenuto opzionale del file per calcolare o verificare l'impronta SHA-256. */
  contenutoFile?: string | Uint8Array | null;
  tipoMime?: string | null;
  nomeFile?: string | null;
}

export interface RisultatoValidazioneGiustificativo {
  /** `true` se non ci sono errori formali (es. MIME non supportato o hash corrotto). */
  valido: boolean;
  haDocumentoAllegato: boolean;
  haImprontaValida: boolean;
  /** `true` solo se sono presenti sia il documento allegato sia l'impronta valida (RC-B3). */
  spesaCompleta: boolean;
  statoCompletezza: 'COMPLETA' | 'INCOMPLETA';
  /** Stato consigliato per la spesa (`REGISTRATA` se completa, `BOZZA` se incompleta). */
  statoSpesaConsigliato: 'REGISTRATA' | 'BOZZA';
  /** Una spesa senza giustificativo e impronta impedisce di segnare il rendiconto come completo (RC-B3, RC-K1). */
  impedisceRendicontoCompleto: boolean;
  improntaNormalizzata: string | null;
  avviso: string | null;
  errore: string | null;
}

/**
 * Verifica che una stringa sia un'impronta di file valida:
 * accetta SHA-256 hex (64 caratteri esadecimali, con o senza prefisso `sha256:`),
 * oppure un digest esadecimale/alfanumerico strutturato di almeno 16 caratteri.
 */
export function validaImprontaGiustificativo(impronta: string | null | undefined): {
  valida: boolean;
  improntaNormalizzata: string | null;
  errore: string | null;
} {
  if (!impronta || !impronta.trim()) {
    return {
      valida: false,
      improntaNormalizzata: null,
      errore: 'Impronta del file giustificativo assente.',
    };
  }

  const pulita = impronta.trim();
  const senzaPrefisso = pulita.toLowerCase().startsWith('sha256:')
    ? pulita.slice(7).trim()
    : pulita;

  // SHA-256 esadecimale standard (64 hex) o digest esadecimale (32..128 hex)
  if (/^[a-fA-F0-9]{32,128}$/.test(senzaPrefisso)) {
    return {
      valida: true,
      improntaNormalizzata: `sha256:${senzaPrefisso.toLowerCase()}`,
      errore: null,
    };
  }

  return {
    valida: false,
    improntaNormalizzata: null,
    errore: `Formato impronta file non valido ("${impronta}"): atteso hash esadecimale (es. SHA-256 a 64 caratteri).`,
  };
}

/**
 * Valida l'allegato giustificativo di un movimento o di una spesa e la relativa impronta del file (RC-B3).
 *
 * Regola RC-B3:
 * - Ogni movimento ha un giustificativo allegato (PDF o immagine) con impronta del file.
 * - Una spesa senza giustificativo resta "incompleta" e impedisce di segnare il rendiconto come completo.
 */
export function validaGiustificativoAllegato(
  input: ValidazioneGiustificativoInput,
): RisultatoValidazioneGiustificativo {
  const docId = input.docAllegatoId?.trim() || null;
  const haDocumentoAllegato = docId !== null;

  // Controllo tipo MIME se specificato (PDF o immagine)
  if (input.tipoMime && input.tipoMime.trim()) {
    const mime = input.tipoMime.trim().toLowerCase();
    if (!(TIPI_MIME_GIUSTIFICATIVO_AMMESSI as readonly string[]).includes(mime)) {
      return {
        valido: false,
        haDocumentoAllegato,
        haImprontaValida: false,
        spesaCompleta: false,
        statoCompletezza: 'INCOMPLETA',
        statoSpesaConsigliato: 'BOZZA',
        impedisceRendicontoCompleto: true,
        improntaNormalizzata: null,
        avviso: null,
        errore: `Tipo file giustificativo non ammesso ("${input.tipoMime}"). Sono ammessi solo PDF o immagini (RC-B3).`,
      };
    }
  }

  // Calcolo automatico dell'impronta dal contenuto se fornito
  const improntaCalcolata =
    input.contenutoFile !== undefined && input.contenutoFile !== null
      ? `sha256:${calcolaImprontaSha256(input.contenutoFile)}`
      : null;

  let improntaNormalizzata: string | null = null;
  let haImprontaValida = false;

  if (input.improntaFile && input.improntaFile.trim()) {
    const esitoImp = validaImprontaGiustificativo(input.improntaFile);
    if (!esitoImp.valida) {
      return {
        valido: false,
        haDocumentoAllegato,
        haImprontaValida: false,
        spesaCompleta: false,
        statoCompletezza: 'INCOMPLETA',
        statoSpesaConsigliato: 'BOZZA',
        impedisceRendicontoCompleto: true,
        improntaNormalizzata: null,
        avviso: null,
        errore: esitoImp.errore,
      };
    }

    // Se sono passati sia impronta dichiarata sia contenuto file, verifica che corrispondano
    if (improntaCalcolata && esitoImp.improntaNormalizzata !== improntaCalcolata) {
      return {
        valido: false,
        haDocumentoAllegato,
        haImprontaValida: false,
        spesaCompleta: false,
        statoCompletezza: 'INCOMPLETA',
        statoSpesaConsigliato: 'BOZZA',
        impedisceRendicontoCompleto: true,
        improntaNormalizzata: null,
        avviso: null,
        errore: `L'impronta dichiarata (${esitoImp.improntaNormalizzata}) non corrisponde al contenuto del file (${improntaCalcolata}).`,
      };
    }

    improntaNormalizzata = esitoImp.improntaNormalizzata;
    haImprontaValida = true;
  } else if (improntaCalcolata) {
    improntaNormalizzata = improntaCalcolata;
    haImprontaValida = true;
  }

  const spesaCompleta = haDocumentoAllegato && haImprontaValida;

  let avviso: string | null = null;
  if (!haDocumentoAllegato && !haImprontaValida) {
    avviso =
      'Spesa priva di giustificativo allegato e di impronta file: la spesa resta incompleta e impedisce di segnare il rendiconto come completo (RC-B3).';
  } else if (!haDocumentoAllegato) {
    avviso =
      'Manca il riferimento al documento giustificativo allegato: la spesa resta incompleta (RC-B3).';
  } else if (!haImprontaValida) {
    avviso =
      'Documento allegato privo di impronta crittografica del file: la spesa resta incompleta (RC-B3).';
  }

  return {
    valido: true,
    haDocumentoAllegato,
    haImprontaValida,
    spesaCompleta,
    statoCompletezza: spesaCompleta ? 'COMPLETA' : 'INCOMPLETA',
    statoSpesaConsigliato: spesaCompleta ? 'REGISTRATA' : 'BOZZA',
    impedisceRendicontoCompleto: !spesaCompleta,
    improntaNormalizzata,
    avviso,
    errore: null,
  };
}

/**
 * Verifica se tutti i movimenti non stornati di un esercizio possiedono un giustificativo valido con impronta,
 * condizione necessaria per marcare il registro e il rendiconto come completi (RC-B3, RC-K1, T15).
 */
export function verificaCompletezzaGiustificativiEsercizio(
  movimenti: ReadonlyArray<{
    id: string;
    descrizione?: string | null;
    stato_spesa?: string | null;
    storno_di_id?: string | null;
    doc_allegato_id?: string | null;
    impronta_file_giustificativo?: string | null;
  }>,
): {
  registroCompleto: boolean;
  totaleMovimentiAttivi: number;
  movimentiIncompletiIds: string[];
  avviso: string | null;
} {
  const attivi = movimenti.filter(
    (m) => m.stato_spesa !== 'STORNATA' && !m.storno_di_id,
  );
  const incompleti: string[] = [];

  for (const m of attivi) {
    const esito = validaGiustificativoAllegato({
      docAllegatoId: m.doc_allegato_id,
      improntaFile: m.impronta_file_giustificativo,
    });
    if (!esito.spesaCompleta) {
      incompleti.push(m.id);
    }
  }

  const registroCompleto = incompleti.length === 0;
  return {
    registroCompleto,
    totaleMovimentiAttivi: attivi.length,
    movimentiIncompletiIds: incompleti,
    avviso: registroCompleto
      ? null
      : `Presenti ${incompleti.length} movimenti privi di giustificativo o impronta valida: il rendiconto non può essere segnato come completo (RC-B3).`,
  };
}

// ============================================================================
// 5. REGOLA DI NON CANCELLAZIONE CONTABILE E STORNO (RC-B4)
// ============================================================================

export class ErroreCancellazioneContabileVietata extends Error {
  readonly codice = 'CANCELLAZIONE_CONTABILE_VIETATA';
  readonly movimentoId: string | null;

  constructor(movimentoId?: string | null, messaggio?: string) {
    super(
      messaggio ??
        `Cancellazione contabile vietata${movimentoId ? ` per il movimento "${movimentoId}"` : ''}: un errore si corregge esclusivamente con una scrittura contraria di storno collegata all'originale (RC-B4).`,
    );
    this.name = 'ErroreCancellazioneContabileVietata';
    this.movimentoId = movimentoId ?? null;
  }
}

export class ErroreModificaEconomicaVietata extends Error {
  readonly codice = 'MODIFICA_ECONOMICA_VIETATA';
  readonly campiEconomiciModificati: string[];

  constructor(campiEconomiciModificati: string[]) {
    super(
      `Modifica diretta di campi economici vietata su un movimento registrato (${campiEconomiciModificati.join(', ')}). Eseguire uno storno e inserire una nuova scrittura (RC-B4).`,
    );
    this.name = 'ErroreModificaEconomicaVietata';
    this.campiEconomiciModificati = campiEconomiciModificati;
  }
}

export class ErroreStornoNonConsentito extends Error {
  readonly codice = 'STORNO_NON_CONSENTITO';

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreStornoNonConsentito';
  }
}

/**
 * Impedisce qualsiasi tentativo di cancellazione fisica (`DELETE`) di un movimento contabile (RC-B4).
 */
export function bloccaCancellazioneMovimento(movimentoId?: string | null): never {
  throw new ErroreCancellazioneContabileVietata(movimentoId);
}

export interface MovimentoOriginalePerStorno {
  id: string;
  condominio_id?: string | null;
  esercizio_id: string;
  gestione_id?: string | null;
  voce_spesa_id?: string | null;
  sottoconto_id?: string | null;
  fornitore_id?: string | null;
  data: string;
  data_registrazione?: string | null;
  importo?: number;
  importo_centesimi?: CentesimiInput;
  segno: '+' | '-';
  descrizione?: string | null;
  doc_allegato_id?: string | null;
  impronta_file_giustificativo?: string | null;
  tag_spesa?: TagSpesa | null;
  competenza_da?: string | null;
  competenza_a?: string | null;
  chi_paga?: CriterioChiPaga | null;
  tabella_millesimale_id?: string | null;
  versione_tabella?: number | null;
  palazzo_id?: string | null;
  scala_colonna_id?: string | null;
  stato_spesa?: StatoSpesa | null;
  storno_di_id?: string | null;
  eccezione_conto_corrente?: boolean | null;
  motivo_eccezione_cc?: string | null;
  imponibile_centesimi?: number | null;
  iva_centesimi?: number | null;
  ritenuta_acconto_centesimi?: number | null;
  ritenuta_aliquota_perc?: number | null;
  numero_fattura?: string | null;
  data_scadenza_fattura?: string | null;
  fondo_id?: string | null;
}

export interface CreaScritturaStornoInput {
  movimentoOriginale: MovimentoOriginalePerStorno;
  motivoStorno: string;
  /** Data del movimento di storno (`YYYY-MM-DD`). Default: data odierna o data del movimento originale. */
  dataStorno?: string;
  /** Data di registrazione dello storno (`YYYY-MM-DD`). Default: `dataStorno`. */
  dataRegistrazioneStorno?: string;
  numeroProgressivoStorno?: number | null;
  autoreId?: string | null;
}

export interface ScritturaStornoGenerata {
  /** Payload pronto per l'inserimento della scrittura contraria in `movimenti_contabili`. */
  scritturaContraria: {
    condominio_id: string | null;
    esercizio_id: string;
    gestione_id: string | null;
    voce_spesa_id: string | null;
    sottoconto_id: string | null;
    fornitore_id: string | null;
    numero_progressivo: number | null;
    data: string;
    data_registrazione: string;
    importo: number;
    importo_centesimi: Centesimi;
    segno: '+' | '-';
    descrizione: string;
    doc_allegato_id: string | null;
    impronta_file_giustificativo: string | null;
    tag_spesa: TagSpesa;
    competenza_da: string | null;
    competenza_a: string | null;
    chi_paga: CriterioChiPaga;
    tabella_millesimale_id: string | null;
    versione_tabella: number;
    palazzo_id: string | null;
    scala_colonna_id: string | null;
    stato_spesa: 'STORNATA';
    storno_di_id: string;
    eccezione_conto_corrente: boolean;
    motivo_eccezione_cc: string | null;
    imponibile_centesimi: number | null;
    iva_centesimi: number | null;
    ritenuta_acconto_centesimi: number | null;
    ritenuta_aliquota_perc: number | null;
    numero_fattura: string | null;
    data_scadenza_fattura: string | null;
    fondo_id: string | null;
    versione_motore_calcolo: string;
    autore_id: string | null;
  };
  /** Patch da applicare al movimento originale per marcarlo come `STORNATA`. */
  patchMovimentoOriginale: {
    stato_spesa: 'STORNATA';
  };
  /** Somma algebrica netta tra movimento originale e scrittura di storno (sempre `0` centesimi). */
  saldoNettoCent: 0;
  motivoStorno: string;
}

/**
 * Genera la scrittura contraria di storno collegata al movimento originale (RC-B4).
 *
 * Regole:
 * - Inverte il segno (`'-'` -> `'+'`, `'+'` -> `'-'`).
 * - Mantiene lo stesso importo in centesimi interi (`importo_centesimi`).
 * - Imposta `storno_di_id = movimentoOriginale.id` e marca entrambi con `stato_spesa = 'STORNATA'`.
 * - Rifiuta lo storno se il movimento originale è già stornato o è esso stesso uno storno.
 */
export function creaScritturaStorno(input: CreaScritturaStornoInput): ScritturaStornoGenerata {
  const { movimentoOriginale, motivoStorno } = input;
  if (!movimentoOriginale || !movimentoOriginale.id) {
    throw new ErroreStornoNonConsentito('Movimento originale mancante o privo di ID.');
  }

  const motivoPulito = motivoStorno?.trim() ?? '';
  if (motivoPulito.length < 3) {
    throw new ErroreStornoNonConsentito(
      'Specificare una motivazione valida (almeno 3 caratteri) per la scrittura di storno (RC-B4).',
    );
  }

  if (movimentoOriginale.stato_spesa === 'STORNATA') {
    throw new ErroreStornoNonConsentito(
      `Il movimento "${movimentoOriginale.id}" risulta già stornato e non può essere stornato una seconda volta.`,
    );
  }

  if (movimentoOriginale.storno_di_id) {
    throw new ErroreStornoNonConsentito(
      `Il movimento "${movimentoOriginale.id}" è già una scrittura di storno (riferita a "${movimentoOriginale.storno_di_id}").`,
    );
  }

  const importoCent =
    movimentoOriginale.importo_centesimi !== undefined && movimentoOriginale.importo_centesimi !== null
      ? normalizzaCentesimi(movimentoOriginale.importo_centesimi)
      : Math.round((movimentoOriginale.importo ?? 0) * 100);

  if (importoCent <= 0) {
    throw new ErroreStornoNonConsentito(
      `Importo del movimento originale non valido per lo storno: ${importoCent} centesimi.`,
    );
  }

  const segnoContrario: '+' | '-' = movimentoOriginale.segno === '-' ? '+' : '-';
  const dataStorno = (input.dataStorno ?? movimentoOriginale.data).trim().slice(0, 10);
  const dataRegStorno = (input.dataRegistrazioneStorno ?? dataStorno).trim().slice(0, 10);
  parseDataIsoUtcMs(dataStorno, 'dataStorno');
  parseDataIsoUtcMs(dataRegStorno, 'dataRegistrazioneStorno');

  const causaleOriginale = movimentoOriginale.descrizione?.trim() || 'Movimento contabile';
  const descrizioneStorno = `[STORNO] ${causaleOriginale} — Motivo: ${motivoPulito}`;

  return {
    scritturaContraria: {
      condominio_id: movimentoOriginale.condominio_id ?? null,
      esercizio_id: movimentoOriginale.esercizio_id,
      gestione_id: movimentoOriginale.gestione_id ?? null,
      voce_spesa_id: movimentoOriginale.voce_spesa_id ?? null,
      sottoconto_id: movimentoOriginale.sottoconto_id ?? null,
      fornitore_id: movimentoOriginale.fornitore_id ?? null,
      numero_progressivo: input.numeroProgressivoStorno ?? null,
      data: dataStorno,
      data_registrazione: dataRegStorno,
      importo: centsToEuro(importoCent),
      importo_centesimi: importoCent,
      segno: segnoContrario,
      descrizione: descrizioneStorno,
      doc_allegato_id: movimentoOriginale.doc_allegato_id ?? null,
      impronta_file_giustificativo: movimentoOriginale.impronta_file_giustificativo ?? null,
      tag_spesa: movimentoOriginale.tag_spesa ?? 'ORDINARIA',
      competenza_da: movimentoOriginale.competenza_da ?? movimentoOriginale.data,
      competenza_a: movimentoOriginale.competenza_a ?? movimentoOriginale.data,
      chi_paga: movimentoOriginale.chi_paga ?? 'TUTTI',
      tabella_millesimale_id: movimentoOriginale.tabella_millesimale_id ?? null,
      versione_tabella: movimentoOriginale.versione_tabella ?? 1,
      palazzo_id: movimentoOriginale.palazzo_id ?? null,
      scala_colonna_id: movimentoOriginale.scala_colonna_id ?? null,
      stato_spesa: 'STORNATA',
      storno_di_id: movimentoOriginale.id,
      eccezione_conto_corrente: Boolean(movimentoOriginale.eccezione_conto_corrente),
      motivo_eccezione_cc: movimentoOriginale.motivo_eccezione_cc ?? null,
      imponibile_centesimi: movimentoOriginale.imponibile_centesimi ?? null,
      iva_centesimi: movimentoOriginale.iva_centesimi ?? null,
      ritenuta_acconto_centesimi: movimentoOriginale.ritenuta_acconto_centesimi ?? null,
      ritenuta_aliquota_perc: movimentoOriginale.ritenuta_aliquota_perc ?? null,
      numero_fattura: movimentoOriginale.numero_fattura ?? null,
      data_scadenza_fattura: movimentoOriginale.data_scadenza_fattura ?? null,
      fondo_id: movimentoOriginale.fondo_id ?? null,
      versione_motore_calcolo: VERSIONE_MOTORE_CALCOLO,
      autore_id: input.autoreId ?? null,
    },
    patchMovimentoOriginale: {
      stato_spesa: 'STORNATA',
    },
    saldoNettoCent: 0,
    motivoStorno: motivoPulito,
  };
}

const CAMPI_ECONOMICI_MOVIMENTO = [
  'importo',
  'importo_centesimi',
  'segno',
  'imponibile_centesimi',
  'iva_centesimi',
  'ritenuta_acconto_centesimi',
  'ritenuta_aliquota_perc',
  'chi_paga',
  'tabella_millesimale_id',
  'versione_tabella',
  'palazzo_id',
  'scala_colonna_id',
  'esercizio_id',
  'gestione_id',
  'fondo_id',
] as const;

/**
 * Valida la modifica di un movimento contabile esistente (RC-B4):
 * - Su un movimento `REGISTRATA` o `STORNATA`, è ammessa solo la modifica di campi non economici (es. `descrizione`/causale, allegato);
 *   qualsiasi modifica a importi, segno o criteri di riparto è bloccata e richiede uno storno.
 * - Su un movimento in `BOZZA`, tutti i campi sono modificabili.
 */
export function validaModificaMovimento(
  originale: Partial<MovimentoOriginalePerStorno> & { stato_spesa?: StatoSpesa | null },
  patch: Record<string, unknown>,
): {
  ammessa: boolean;
  richiedeStorno: boolean;
  campiEconomiciToccati: string[];
  campiNonEconomiciModificati: string[];
  errore: string | null;
} {
  const stato = originale.stato_spesa ?? 'REGISTRATA';
  const campiEconomiciToccati: string[] = [];
  const campiNonEconomiciModificati: string[] = [];

  for (const [chiave, nuovoValore] of Object.entries(patch)) {
    if (nuovoValore === undefined) continue;
    const vecchioValore = (originale as Record<string, unknown>)[chiave];
    if (nuovoValore === vecchioValore) continue;

    if ((CAMPI_ECONOMICI_MOVIMENTO as readonly string[]).includes(chiave)) {
      campiEconomiciToccati.push(chiave);
    } else {
      campiNonEconomiciModificati.push(chiave);
    }
  }

  if (stato !== 'BOZZA' && campiEconomiciToccati.length > 0) {
    return {
      ammessa: false,
      richiedeStorno: true,
      campiEconomiciToccati,
      campiNonEconomiciModificati,
      errore: `Impossibile modificare campi economici (${campiEconomiciToccati.join(', ')}) su un movimento in stato ${stato}. Eseguire uno storno (RC-B4).`,
    };
  }

  return {
    ammessa: true,
    richiedeStorno: false,
    campiEconomiciToccati: [],
    campiNonEconomiciModificati,
    errore: null,
  };
}

// ============================================================================
// 6. FATTURE FORNITORI (IMPONIBILE, IVA, RITENUTA ANALITICA SENZA F24, COMPETENZA — RC-B5)
// ============================================================================

export interface FatturaFornitoreInput {
  fornitoreId: string;
  /** Codice fiscale o Partita IVA del fornitore (almeno uno obbligatorio per RC-B5). */
  codiceFiscaleFornitore?: string | null;
  partitaIvaFornitore?: string | null;
  numeroFattura: string;
  dataFattura: string;
  dataScadenzaFattura?: string | null;
  competenzaDa: string;
  competenzaA: string;
  imponibileCent: CentesimiInput;
  /** Importo IVA in centesimi (oppure calcolato da `aliquotaIvaPerc` se omesso). */
  ivaCent?: CentesimiInput;
  aliquotaIvaPerc?: number;
  /** Importo ritenuta d'acconto in centesimi (oppure calcolato da `ritenutaAliquotaPerc` su `imponibileCent`). */
  ritenutaAccontoCent?: CentesimiInput;
  ritenutaAliquotaPerc?: number | null;
  /** Totale lordo fattura (`imponibile + IVA`). Se specificato, viene verificata la quadratura con `imponibileCent + ivaCent`. */
  totaleFatturaCent?: CentesimiInput;
}

export interface RisultatoFatturaFornitore {
  valido: boolean;
  imponibileCent: Centesimi;
  ivaCent: Centesimi;
  ritenutaAccontoCent: Centesimi;
  ritenutaAliquotaPerc: number | null;
  /** Totale lordo della fattura (`imponibileCent + ivaCent`), pari al costo di competenza del condominio. */
  totaleFatturaCent: Centesimi;
  /** Netto a pagare al fornitore (`totaleFatturaCent - ritenutaAccontoCent`). */
  nettoAPagareFornitoreCent: Centesimi;
  competenzaDa: string;
  competenzaA: string;
  dataScadenzaFattura: string | null;
  numeroFattura: string;
  /** RC-B5: la ritenuta è registrata solo come dato analitico della fattura, senza generare F24, CU o 770. */
  soloDatoAnaliticoRitenuta: true;
  generaF24: false;
  generaCu: false;
  genera770: false;
  errore: string | null;
}

/**
 * Calcola e valida gli importi analitici di una fattura fornitore (RC-B5):
 * imponibile, IVA, ritenuta d'acconto (solo dato: importo e aliquota, senza F24/CU/770), totale, scadenza e competenza.
 */
export function calcolaEValidaFatturaFornitore(
  input: FatturaFornitoreInput,
): RisultatoFatturaFornitore {
  const imponibileCent = normalizzaCentesimi(input.imponibileCent);
  if (imponibileCent <= 0) {
    throw new RangeError(`L'imponibile della fattura deve essere positivo: ${imponibileCent}`);
  }

  let ivaCent: Centesimi = 0;
  if (input.ivaCent !== undefined) {
    ivaCent = normalizzaCentesimi(input.ivaCent);
  } else if (input.aliquotaIvaPerc !== undefined) {
    if (!Number.isFinite(input.aliquotaIvaPerc) || input.aliquotaIvaPerc < 0) {
      throw new RangeError(`Aliquota IVA non valida: ${String(input.aliquotaIvaPerc)}`);
    }
    const aliqMillesimi = BigInt(Math.round(input.aliquotaIvaPerc * 100));
    ivaCent = dividiEArrotondaHalfUp(BigInt(imponibileCent) * aliqMillesimi, 10_000n);
  }

  if (ivaCent < 0) {
    throw new RangeError(`L'IVA della fattura non può essere negativa: ${ivaCent}`);
  }

  let ritenutaAliquotaPerc: number | null =
    input.ritenutaAliquotaPerc !== undefined && input.ritenutaAliquotaPerc !== null
      ? input.ritenutaAliquotaPerc
      : null;

  if (
    ritenutaAliquotaPerc !== null &&
    (!Number.isFinite(ritenutaAliquotaPerc) || ritenutaAliquotaPerc < 0 || ritenutaAliquotaPerc > 100)
  ) {
    throw new RangeError(`Aliquota ritenuta d'acconto fuori range (0..100): ${ritenutaAliquotaPerc}`);
  }

  let ritenutaAccontoCent: Centesimi = 0;
  if (input.ritenutaAccontoCent !== undefined) {
    ritenutaAccontoCent = normalizzaCentesimi(input.ritenutaAccontoCent);
  } else if (ritenutaAliquotaPerc !== null && ritenutaAliquotaPerc > 0) {
    const aliqRitInt = BigInt(Math.round(ritenutaAliquotaPerc * 100));
    ritenutaAccontoCent = dividiEArrotondaHalfUp(BigInt(imponibileCent) * aliqRitInt, 10_000n);
  }

  if (ritenutaAccontoCent < 0) {
    throw new RangeError(`La ritenuta d'acconto non può essere negativa: ${ritenutaAccontoCent}`);
  }

  const totaleCalcolatoCent = normalizzaCentesimi(imponibileCent + ivaCent);
  if (input.totaleFatturaCent !== undefined) {
    const totaleDichiaratoCent = normalizzaCentesimi(input.totaleFatturaCent);
    if (totaleDichiaratoCent !== totaleCalcolatoCent) {
      return {
        valido: false,
        imponibileCent,
        ivaCent,
        ritenutaAccontoCent,
        ritenutaAliquotaPerc,
        totaleFatturaCent: totaleDichiaratoCent,
        nettoAPagareFornitoreCent: normalizzaCentesimi(totaleDichiaratoCent - ritenutaAccontoCent),
        competenzaDa: input.competenzaDa,
        competenzaA: input.competenzaA,
        dataScadenzaFattura: input.dataScadenzaFattura ?? null,
        numeroFattura: input.numeroFattura,
        soloDatoAnaliticoRitenuta: true,
        generaF24: false,
        generaCu: false,
        genera770: false,
        errore: `Il totale fattura (${centsToEuro(totaleDichiaratoCent, true, true)}) non coincide con Imponibile + IVA (${centsToEuro(totaleCalcolatoCent, true, true)}).`,
      };
    }
  }

  if (ritenutaAccontoCent > totaleCalcolatoCent) {
    return {
      valido: false,
      imponibileCent,
      ivaCent,
      ritenutaAccontoCent,
      ritenutaAliquotaPerc,
      totaleFatturaCent: totaleCalcolatoCent,
      nettoAPagareFornitoreCent: 0,
      competenzaDa: input.competenzaDa,
      competenzaA: input.competenzaA,
      dataScadenzaFattura: input.dataScadenzaFattura ?? null,
      numeroFattura: input.numeroFattura,
      soloDatoAnaliticoRitenuta: true,
      generaF24: false,
      generaCu: false,
      genera770: false,
      errore: `La ritenuta d'acconto (${centsToEuro(ritenutaAccontoCent, true, true)}) non può superare il totale della fattura.`,
    };
  }

  const numeroFattura = input.numeroFattura?.trim() ?? '';
  if (!numeroFattura) {
    return {
      valido: false,
      imponibileCent,
      ivaCent,
      ritenutaAccontoCent,
      ritenutaAliquotaPerc,
      totaleFatturaCent: totaleCalcolatoCent,
      nettoAPagareFornitoreCent: normalizzaCentesimi(totaleCalcolatoCent - ritenutaAccontoCent),
      competenzaDa: input.competenzaDa,
      competenzaA: input.competenzaA,
      dataScadenzaFattura: input.dataScadenzaFattura ?? null,
      numeroFattura: '',
      soloDatoAnaliticoRitenuta: true,
      generaF24: false,
      generaCu: false,
      genera770: false,
      errore: 'Il numero della fattura fornitore è obbligatorio (RC-B5).',
    };
  }

  // Verifica CF o P.IVA se passati
  if (
    input.codiceFiscaleFornitore !== undefined ||
    input.partitaIvaFornitore !== undefined
  ) {
    const cf = input.codiceFiscaleFornitore?.trim() ?? '';
    const piva = input.partitaIvaFornitore?.trim() ?? '';
    if (!cf && !piva) {
      return {
        valido: false,
        imponibileCent,
        ivaCent,
        ritenutaAccontoCent,
        ritenutaAliquotaPerc,
        totaleFatturaCent: totaleCalcolatoCent,
        nettoAPagareFornitoreCent: normalizzaCentesimi(totaleCalcolatoCent - ritenutaAccontoCent),
        competenzaDa: input.competenzaDa,
        competenzaA: input.competenzaA,
        dataScadenzaFattura: input.dataScadenzaFattura ?? null,
        numeroFattura,
        soloDatoAnaliticoRitenuta: true,
        generaF24: false,
        generaCu: false,
        genera770: false,
        errore: 'Il fornitore deve avere almeno il Codice Fiscale o la Partita IVA registrati (RC-B5).',
      };
    }
  }

  // Verifica date competenza
  parseDataIsoUtcMs(input.dataFattura, 'dataFattura');
  calcolaGiorniInclusivi(input.competenzaDa, input.competenzaA);
  if (input.dataScadenzaFattura) {
    parseDataIsoUtcMs(input.dataScadenzaFattura, 'dataScadenzaFattura');
  }

  return {
    valido: true,
    imponibileCent,
    ivaCent,
    ritenutaAccontoCent,
    ritenutaAliquotaPerc,
    totaleFatturaCent: totaleCalcolatoCent,
    nettoAPagareFornitoreCent: normalizzaCentesimi(totaleCalcolatoCent - ritenutaAccontoCent),
    competenzaDa: input.competenzaDa.trim().slice(0, 10),
    competenzaA: input.competenzaA.trim().slice(0, 10),
    dataScadenzaFattura: input.dataScadenzaFattura ? input.dataScadenzaFattura.trim().slice(0, 10) : null,
    numeroFattura,
    soloDatoAnaliticoRitenuta: true,
    generaF24: false,
    generaCu: false,
    genera770: false,
    errore: null,
  };
}

export const validaFatturaFornitore = calcolaEValidaFatturaFornitore;

// ============================================================================
// 7. MENU "CHI PAGA" E GENERAZIONE RIGHE DI RIPARTO (RC-C1..C6, RC-A4, RC-A5, RC-I2)
// ============================================================================

export interface UnitaCondominioRiparto {
  id: string;
  palazzoId: string;
  scalaColonnaId?: string | null;
  interno?: string;
  /** Utente proprietario referente attivo dell'unità. */
  utenteId?: string | null;
  /** Soggetto contabile referente dell'unità. */
  soggettoId?: string | null;
  /** Presenza di conduttore (inquilino) attivo sull'unità per il calcolo del prospetto RC-I2. */
  haConduttoreAttivo?: boolean;
  /** Presenza di usufruttuario attivo sull'unità (RC-I5). */
  haUsufruttuarioAttivo?: boolean;
}

export interface TabellaMillesimalePerRiparto {
  id: string;
  nome?: string;
  tipo?: TipoTabellaMillesimale;
  versione?: number;
  statoApprovazione?: StatoApprovazioneTabella;
  palazzoId?: string | null;
  scalaColonnaId?: string | null;
  totale?: number;
  quote: readonly QuotaMillesimiInput[];
}

export interface QuotaPersonalizzataInput {
  unitaId: string;
  /** Peso in millesimi o proporzione (usato quando la modalità è `'MILLESIMI'`). */
  millesimi?: number;
  /** Importo esatto in centesimi (usato quando la modalità è `'IMPORTI'`). */
  importoCent?: CentesimiInput;
}

export interface DerogaPersonalizzataInput {
  attoDerogaTipo: AttoDerogaTipo;
  attoDerogaData: string;
  attoDerogaNumero?: string | null;
  motivazioneDeroga: string;
  quote: readonly QuotaPersonalizzataInput[];
  modalita?: 'MILLESIMI' | 'IMPORTI';
}

export interface CalcolaMenuChiPagaInput {
  importoCent: CentesimiInput;
  chiPaga: CriterioChiPaga;
  unitaCondominio?: readonly UnitaCondominioRiparto[];
  /** Tabella di proprietà o tabella selezionata per `TUTTI`, `PALAZZO_SCALA`, `TABELLA_SPECIFICA`. */
  tabellaMillesimale?: TabellaMillesimalePerRiparto | null;
  /** Richiesto quando `chiPaga === 'PALAZZO_SCALA'` (almeno uno tra `palazzoId` e `scalaColonnaId`). */
  palazzoId?: string | null;
  scalaColonnaId?: string | null;
  /** Richiesto quando `chiPaga === 'PERSONALIZZATO'` (RC-C3, RC-C6). */
  personalizzato?: DerogaPersonalizzataInput | null;
  /** Richiesto quando `chiPaga === 'CONSUMI'` (RC-C5). */
  consumi?: {
    consumiUnita: readonly ConsumoUnitaInput[];
    stimeMancanti?: StimeMancantiMapOrArray;
  } | null;
  /** Tag obbligatorio della spesa (`ORDINARIA` o `STRAORDINARIA`, RC-C1). */
  tagSpesa?: TagSpesa;
  /** Percentuale a carico dell'inquilino (0..100, default 0 per straordinaria, configurabile per ordinaria, RC-I2). */
  quotaInquilinoPerc?: number;
  /** Periodi di titolarità per unità per spese a periodo (es. assicurazione, compenso admin, RC-H5, T8). */
  isAPeriodo?: boolean;
  competenzaDa?: string;
  competenzaA?: string;
  periodiTitolaritaPerUnita?: Readonly<Record<string, readonly PeriodoTitolaritaInput[]>>;
}

export interface RigaRipartoSpesaGenerata {
  unitaId: string;
  utenteId: string | null;
  soggettoId: string | null;
  tabellaMillesimaleId: string | null;
  versioneTabella: number;
  valoreUnitario: number;
  sommaValoriPartecipanti: number;
  giorniTitolarita: number | null;
  giorniPeriodo: number | null;
  quotaCalcolataCent: Centesimi;
  restoArrotondamentoCent: Centesimi;
  importoQuotaCent: Centesimi;
  quotaProprietarioCent: Centesimi;
  quotaConduttoreCent: Centesimi;
  quotaUsufruttuarioCent: Centesimi;
  daConguagliare: boolean;
  versioneMotoreCalcolo: string;
}

export interface RisultatoMenuChiPaga {
  chiPaga: CriterioChiPaga;
  importoTotaleCent: Centesimi;
  sommaQuoteFinaliCent: Centesimi;
  restoCent: Centesimi;
  unitaArrotondamentoId: string | null;
  tabellaMillesimaleId: string | null;
  versioneTabella: number;
  attoDeroga: {
    tipo: AttoDerogaTipo;
    data: string;
    numero: string | null;
    motivazione: string;
  } | null;
  righeRiparto: RigaRipartoSpesaGenerata[];
  righeProspetto: RigaProspettoRiparto[];
  avvisi: string[];
  versioneMotore: string;
}

function calcolaQuoteProprietarioInquilinoUsufrutto(
  importoQuotaCent: Centesimi,
  tagSpesa: TagSpesa,
  quotaInquilinoPerc: number,
  unitaInfo?: UnitaCondominioRiparto,
): {
  quotaProprietarioCent: Centesimi;
  quotaConduttoreCent: Centesimi;
  quotaUsufruttuarioCent: Centesimi;
} {
  // Se straordinaria, 100% al proprietario (o nudo proprietario), 0% a conduttore/usufruttuario salvo patto
  if (tagSpesa === 'STRAORDINARIA') {
    return {
      quotaProprietarioCent: importoQuotaCent,
      quotaConduttoreCent: 0,
      quotaUsufruttuarioCent: 0,
    };
  }

  // Se c'è un usufruttuario attivo e spesa ordinaria (art. 1004 c.c., RC-I5)
  if (unitaInfo?.haUsufruttuarioAttivo && !unitaInfo?.haConduttoreAttivo) {
    return {
      quotaProprietarioCent: 0,
      quotaConduttoreCent: 0,
      quotaUsufruttuarioCent: importoQuotaCent,
    };
  }

  // Se c'è una percentuale conduttore (es. 100% su ascensore ordinario o pulizia scale, T10)
  const percClamped = Math.max(0, Math.min(100, quotaInquilinoPerc));
  if (percClamped > 0 && (unitaInfo === undefined || unitaInfo.haConduttoreAttivo !== false)) {
    const percInt = BigInt(Math.round(percClamped * 100));
    const quotaConduttoreCent = dividiEArrotondaHalfUp(BigInt(importoQuotaCent) * percInt, 10_000n);
    const quotaProprietarioCent = normalizzaCentesimi(importoQuotaCent - quotaConduttoreCent);
    return {
      quotaProprietarioCent,
      quotaConduttoreCent,
      quotaUsufruttuarioCent: 0,
    };
  }

  return {
    quotaProprietarioCent: importoQuotaCent,
    quotaConduttoreCent: 0,
    quotaUsufruttuarioCent: 0,
  };
}

/**
 * Calcola la ripartizione di una spesa secondo la scelta del menu "Chi paga" (RC-C3, RC-C4, RC-C5, RC-C6):
 * - `TUTTI`: tutte le unità del condominio con la tabella di proprietà.
 * - `PALAZZO_SCALA`: solo le unità del palazzo o della scala/colonna selezionata, riproporzionate sulla somma dei millesimi del gruppo.
 * - `TABELLA_SPECIFICA`: tutte le unità con valore > 0 nella tabella selezionata (ascensore, riscaldamento, acqua, uso).
 * - `PERSONALIZZATO`: unità scelte a mano con quote in millesimi o importi esatti; richiede motivazione, tipo di atto (delibera o regolamento) e data (RC-C3, RC-C6).
 * - `CONSUMI`: ripartizione in base ai consumi rilevati o stimati (RC-C5).
 */
export function calcolaMenuChiPaga(input: CalcolaMenuChiPagaInput): RisultatoMenuChiPaga {
  const importoTotaleCent = normalizzaCentesimi(input.importoCent);
  if (importoTotaleCent <= 0) {
    throw new RangeError(`L'importo della spesa da ripartire deve essere maggiore di zero: ${importoTotaleCent}`);
  }

  const {
    chiPaga,
    unitaCondominio = [],
    tabellaMillesimale,
    palazzoId,
    scalaColonnaId,
    personalizzato,
    consumi,
    tagSpesa = 'ORDINARIA',
    quotaInquilinoPerc = 0,
  } = input;

  const mappaUnita = new Map<string, UnitaCondominioRiparto>();
  for (const u of unitaCondominio) {
    mappaUnita.set(u.id, u);
  }

  const avvisi: string[] = [];

  // Avviso non bloccante se la tabella millesimale utilizzata è in stato BOZZA (RC-A5, RC-N3)
  if (tabellaMillesimale && tabellaMillesimale.statoApprovazione === 'BOZZA') {
    avvisi.push(
      `Attenzione: la tabella millesimale "${tabellaMillesimale.nome ?? tabellaMillesimale.id}" è in stato BOZZA (non ancora approvata in assemblea, RC-A5).`,
    );
  }

  const tabellaId = tabellaMillesimale?.id ?? null;
  const versioneTabella = tabellaMillesimale?.versione ?? 1;

  // ---- CASO 1: CONSUMI (RC-C5) ---------------------------------------------------------------
  if (chiPaga === 'CONSUMI') {
    if (!consumi || !consumi.consumiUnita || consumi.consumiUnita.length === 0) {
      throw new RangeError('Per il criterio "CONSUMI" è obbligatorio fornire le letture o stime dei contatori (RC-C5).');
    }

    const esitoConsumi = ripartisciConsumi({
      importoTotaleCent,
      consumiUnita: consumi.consumiUnita,
      stimeMancanti: consumi.stimeMancanti,
    });

    if (esitoConsumi.haQuoteDaConguagliare) {
      avvisi.push(
        'Una o più unità presentano letture stimate dallo storico: le relative quote sono marcate "da conguagliare" (RC-C5).',
      );
    }

    const righeRiparto: RigaRipartoSpesaGenerata[] = esitoConsumi.quote.map((q) => {
      const uInfo = mappaUnita.get(q.unitaId);
      const rip = calcolaQuoteProprietarioInquilinoUsufrutto(
        q.quotaFinaleCent,
        tagSpesa,
        quotaInquilinoPerc,
        uInfo,
      );
      return {
        unitaId: q.unitaId,
        utenteId: uInfo?.utenteId ?? null,
        soggettoId: uInfo?.soggettoId ?? null,
        tabellaMillesimaleId: null,
        versioneTabella: 1,
        valoreUnitario: q.consumo,
        sommaValoriPartecipanti: esitoConsumi.consumoTotale,
        giorniTitolarita: null,
        giorniPeriodo: null,
        quotaCalcolataCent: q.quotaCalcolataCent,
        restoArrotondamentoCent: q.restoArrotondamentoCent,
        importoQuotaCent: q.quotaFinaleCent,
        ...rip,
        daConguagliare: q.daConguagliare,
        versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
      };
    });

    const righeProspetto: RigaProspettoRiparto[] = esitoConsumi.quote.map((q) => ({
      tipo: 'quota_unita',
      descrizione: `Quota consumo unità ${q.unitaId}`,
      unitaId: q.unitaId,
      importoCent: q.quotaCalcolataCent,
      importoEuro: centsToEuro(q.quotaCalcolataCent),
    }));
    if (esitoConsumi.rigaArrotondamento) {
      righeProspetto.push(esitoConsumi.rigaArrotondamento);
    }

    return {
      chiPaga,
      importoTotaleCent,
      sommaQuoteFinaliCent: esitoConsumi.sommaQuoteFinaliCent,
      restoCent: esitoConsumi.restoCent,
      unitaArrotondamentoId: esitoConsumi.unitaArrotondamentoId,
      tabellaMillesimaleId: null,
      versioneTabella: 1,
      attoDeroga: null,
      righeRiparto,
      righeProspetto,
      avvisi,
      versioneMotore: VERSIONE_MOTORE_CALCOLO,
    };
  }

  // ---- CASO 2: PERSONALIZZATO CON ATTO E DATA (RC-C3, RC-C6) ---------------------------------
  if (chiPaga === 'PERSONALIZZATO') {
    if (!personalizzato) {
      throw new Error(
        'Il criterio "PERSONALIZZATO" richiede i dati della deroga (motivazione, atto di riferimento e data, RC-C3).',
      );
    }

    const motivazione = personalizzato.motivazioneDeroga?.trim() ?? '';
    if (motivazione.length < 3) {
      throw new Error(
        'Il criterio "PERSONALIZZATO" richiede obbligatoriamente una motivazione della deroga (RC-C3, RC-C6).',
      );
    }

    if (
      !personalizzato.attoDerogaTipo ||
      !(TIPI_ATTO_DEROGA as readonly string[]).includes(personalizzato.attoDerogaTipo)
    ) {
      throw new Error(
        'Il criterio "PERSONALIZZATO" richiede un tipo di atto valido (REGOLAMENTO_CONTRATTUALE, DELIBERA_UNANIME o DELIBERA_ASSEMBLEA, RC-C3, RC-C6).',
      );
    }

    if (!personalizzato.attoDerogaData || !personalizzato.attoDerogaData.trim()) {
      throw new Error(
        'Il criterio "PERSONALIZZATO" richiede obbligatoriamente la data dell\'atto di riferimento (RC-C3, RC-C6).',
      );
    }
    const dataAttoIso = personalizzato.attoDerogaData.trim().slice(0, 10);
    parseDataIsoUtcMs(dataAttoIso, 'attoDerogaData');

    if (!personalizzato.quote || personalizzato.quote.length === 0) {
      throw new RangeError('Il criterio "PERSONALIZZATO" richiede almeno un\'unità partecipante.');
    }

    const modalita =
      personalizzato.modalita ??
      (personalizzato.quote.every((q) => q.importoCent !== undefined) ? 'IMPORTI' : 'MILLESIMI');

    const attoDeroga = {
      tipo: personalizzato.attoDerogaTipo,
      data: dataAttoIso,
      numero: personalizzato.attoDerogaNumero?.trim() || null,
      motivazione,
    };

    if (modalita === 'IMPORTI') {
      let sommaImportiCent = 0;
      const righeRiparto: RigaRipartoSpesaGenerata[] = [];
      const righeProspetto: RigaProspettoRiparto[] = [];

      for (const q of personalizzato.quote) {
        if (q.importoCent === undefined) {
          throw new TypeError(`Importo in centesimi mancante per l'unità "${q.unitaId}" in modalità IMPORTI.`);
        }
        const impCent = normalizzaCentesimi(q.importoCent);
        if (impCent < 0) {
          throw new RangeError(`Importo negativo non ammesso per l'unità "${q.unitaId}": ${impCent}`);
        }
        sommaImportiCent = normalizzaCentesimi(sommaImportiCent + impCent);
        const uInfo = mappaUnita.get(q.unitaId);
        const rip = calcolaQuoteProprietarioInquilinoUsufrutto(
          impCent,
          tagSpesa,
          quotaInquilinoPerc,
          uInfo,
        );

        righeRiparto.push({
          unitaId: q.unitaId,
          utenteId: uInfo?.utenteId ?? null,
          soggettoId: uInfo?.soggettoId ?? null,
          tabellaMillesimaleId: null,
          versioneTabella: 1,
          valoreUnitario: impCent,
          sommaValoriPartecipanti: importoTotaleCent,
          giorniTitolarita: null,
          giorniPeriodo: null,
          quotaCalcolataCent: impCent,
          restoArrotondamentoCent: 0,
          importoQuotaCent: impCent,
          ...rip,
          daConguagliare: false,
          versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
        });

        righeProspetto.push({
          tipo: 'quota_unita',
          descrizione: `Quota personalizzata unità ${q.unitaId}`,
          unitaId: q.unitaId,
          importoCent: impCent,
          importoEuro: centsToEuro(impCent),
        });
      }

      if (sommaImportiCent !== importoTotaleCent) {
        throw new RangeError(
          `La somma degli importi personalizzati (${centsToEuro(sommaImportiCent, true, true)}) non coincide con l'importo della spesa (${centsToEuro(importoTotaleCent, true, true)}) (RC-N2).`,
        );
      }

      return {
        chiPaga,
        importoTotaleCent,
        sommaQuoteFinaliCent: sommaImportiCent,
        restoCent: 0,
        unitaArrotondamentoId: null,
        tabellaMillesimaleId: null,
        versioneTabella: 1,
        attoDeroga,
        righeRiparto,
        righeProspetto,
        avvisi,
        versioneMotore: VERSIONE_MOTORE_CALCOLO,
      };
    }

    // Modalità MILLESIMI personalizzati
    const quoteMillesimiPers: QuotaMillesimiInput[] = personalizzato.quote.map((q) => {
      if (typeof q.millesimi !== 'number' || !Number.isFinite(q.millesimi) || q.millesimi <= 0) {
        throw new RangeError(`Millesimi personalizzati non validi per l'unità "${q.unitaId}".`);
      }
      return { unitaId: q.unitaId, millesimi: q.millesimi };
    });

    const esitoPers = ripartisciSpesa({
      importoCent: importoTotaleCent,
      quoteMillesimi: quoteMillesimiPers,
    });

    const righeRiparto: RigaRipartoSpesaGenerata[] = esitoPers.quote.map((q) => {
      const uInfo = mappaUnita.get(q.unitaId);
      const rip = calcolaQuoteProprietarioInquilinoUsufrutto(
        q.quotaFinaleCent,
        tagSpesa,
        quotaInquilinoPerc,
        uInfo,
      );
      return {
        unitaId: q.unitaId,
        utenteId: uInfo?.utenteId ?? null,
        soggettoId: uInfo?.soggettoId ?? null,
        tabellaMillesimaleId: null,
        versioneTabella: 1,
        valoreUnitario: q.millesimi,
        sommaValoriPartecipanti: esitoPers.sommaMillesimi,
        giorniTitolarita: null,
        giorniPeriodo: null,
        quotaCalcolataCent: q.quotaCalcolataCent,
        restoArrotondamentoCent: q.restoArrotondamentoCent,
        importoQuotaCent: q.quotaFinaleCent,
        ...rip,
        daConguagliare: false,
        versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
      };
    });

    return {
      chiPaga,
      importoTotaleCent,
      sommaQuoteFinaliCent: esitoPers.sommaQuoteFinaliCent,
      restoCent: esitoPers.restoCent,
      unitaArrotondamentoId: esitoPers.unitaArrotondamentoId,
      tabellaMillesimaleId: null,
      versioneTabella: 1,
      attoDeroga,
      righeRiparto,
      righeProspetto: esitoPers.righeProspetto,
      avvisi,
      versioneMotore: VERSIONE_MOTORE_CALCOLO,
    };
  }

  // ---- CASI 3, 4, 5: TUTTI, PALAZZO_SCALA, TABELLA_SPECIFICA --------------------------------
  if (!tabellaMillesimale || !tabellaMillesimale.quote || tabellaMillesimale.quote.length === 0) {
    throw new Error(`Tabella millesimale obbligatoria e con quote valorizzate per il criterio "${chiPaga}".`);
  }

  let quoteFiltrate: QuotaMillesimiInput[] = [...tabellaMillesimale.quote];

  if (chiPaga === 'TUTTI') {
    // Verifica quadratura della tabella di proprietà (RC-A3, T14)
    const totaleAtteso = tabellaMillesimale.totale ?? 1000;
    const validazioneQuad = validaQuadraturaMillesimi(quoteFiltrate, totaleAtteso);
    if (!validazioneQuad.valido) {
      throw new Error(validazioneQuad.errore ?? 'La tabella millesimale non quadra.');
    }
  } else if (chiPaga === 'PALAZZO_SCALA') {
    const targetPalazzoId = palazzoId ?? tabellaMillesimale.palazzoId ?? null;
    const targetScalaId = scalaColonnaId ?? tabellaMillesimale.scalaColonnaId ?? null;
    if (!targetPalazzoId && !targetScalaId) {
      throw new Error(
        'Per il criterio "PALAZZO_SCALA" è obbligatorio specificare il palazzo o la scala/colonna (RC-C3, RC-C8).',
      );
    }

    if (mappaUnita.size > 0) {
      quoteFiltrate = quoteFiltrate.filter((q) => {
        const u = mappaUnita.get(q.unitaId);
        if (!u) return false;
        if (targetScalaId && u.scalaColonnaId !== targetScalaId) return false;
        if (targetPalazzoId && u.palazzoId !== targetPalazzoId) return false;
        return true;
      });
    }

    if (quoteFiltrate.length === 0) {
      throw new RangeError('Nessuna unità appartiene al palazzo o alla scala selezionata per il riparto.');
    }
  } else if (chiPaga === 'TABELLA_SPECIFICA') {
    // Partecipa chi ha un valore strettamente positivo nella tabella specifica (RC-C3)
    quoteFiltrate = quoteFiltrate.filter((q) => {
      const val = q.millesimi ?? q.valoreMillesimale ?? q.valore ?? 0;
      return val > 0;
    });
    if (quoteFiltrate.length === 0) {
      throw new RangeError('Nessuna unità ha un valore millesimale positivo nella tabella specifica selezionata.');
    }
  }

  const esitoRiparto = ripartisciSpesa({
    importoCent: importoTotaleCent,
    quoteMillesimi: quoteFiltrate,
  });

  const righeRiparto: RigaRipartoSpesaGenerata[] = [];

  for (const q of esitoRiparto.quote) {
    const uInfo = mappaUnita.get(q.unitaId);
    const periodiUnita = input.periodiTitolaritaPerUnita?.[q.unitaId];

    // Se è una spesa a periodo e sull'unità si sono succeduti più titolari nel periodo di competenza (RC-H5, T8)
    if (
      input.isAPeriodo &&
      input.competenzaDa &&
      input.competenzaA &&
      periodiUnita &&
      periodiUnita.length > 1
    ) {
      const esitoPeriodo = ripartisciSpesaPeriodo({
        importoCent: q.quotaFinaleCent,
        dataInizio: input.competenzaDa,
        dataFine: input.competenzaA,
        periodiTitolarita: periodiUnita,
      });

      for (const qt of esitoPeriodo.quoteTitolari) {
        const rip = calcolaQuoteProprietarioInquilinoUsufrutto(
          qt.quotaFinaleCent,
          tagSpesa,
          quotaInquilinoPerc,
          uInfo,
        );
        righeRiparto.push({
          unitaId: q.unitaId,
          utenteId: qt.titolareId,
          soggettoId: null,
          tabellaMillesimaleId: tabellaId,
          versioneTabella,
          valoreUnitario: q.millesimi,
          sommaValoriPartecipanti: esitoRiparto.sommaMillesimi,
          giorniTitolarita: qt.giorni,
          giorniPeriodo: esitoPeriodo.giorniPeriodoTotale,
          quotaCalcolataCent: qt.quotaCalcolataCent,
          restoArrotondamentoCent: qt.restoArrotondamentoCent,
          importoQuotaCent: qt.quotaFinaleCent,
          ...rip,
          daConguagliare: false,
          versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
        });
      }
    } else {
      const rip = calcolaQuoteProprietarioInquilinoUsufrutto(
        q.quotaFinaleCent,
        tagSpesa,
        quotaInquilinoPerc,
        uInfo,
      );
      righeRiparto.push({
        unitaId: q.unitaId,
        utenteId: uInfo?.utenteId ?? null,
        soggettoId: uInfo?.soggettoId ?? null,
        tabellaMillesimaleId: tabellaId,
        versioneTabella,
        valoreUnitario: q.millesimi,
        sommaValoriPartecipanti: esitoRiparto.sommaMillesimi,
        giorniTitolarita: null,
        giorniPeriodo: null,
        quotaCalcolataCent: q.quotaCalcolataCent,
        restoArrotondamentoCent: q.restoArrotondamentoCent,
        importoQuotaCent: q.quotaFinaleCent,
        ...rip,
        daConguagliare: false,
        versioneMotoreCalcolo: VERSIONE_MOTORE_CALCOLO,
      });
    }
  }

  return {
    chiPaga,
    importoTotaleCent,
    sommaQuoteFinaliCent: esitoRiparto.sommaQuoteFinaliCent,
    restoCent: esitoRiparto.restoCent,
    unitaArrotondamentoId: esitoRiparto.unitaArrotondamentoId,
    tabellaMillesimaleId: tabellaId,
    versioneTabella,
    attoDeroga: null,
    righeRiparto,
    righeProspetto: esitoRiparto.righeProspetto,
    avvisi,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

/** Alias di `calcolaMenuChiPaga`. */
export const calcolaChiPaga = calcolaMenuChiPaga;

/**
 * Risolve e valida il tag obbligatorio della spesa (`ORDINARIA` o `STRAORDINARIA`, RC-C1):
 * - Usa il default della voce di catalogo se non passato esplicitamente;
 * - Se il tag scelto differisce dal default della voce, richiede/registra la traccia del cambio (`tagModificatoRispettoDefault: true`).
 */
export function risolviTagSpesaConTraccia(input: {
  tagSpesa?: TagSpesa | null;
  tagDefaultVoce?: TagSpesa | null;
  motivoCambioTag?: string | null;
}): {
  tagSpesa: TagSpesa;
  tagModificatoRispettoDefault: boolean;
  tracciaCambioTag: string | null;
} {
  const tagFinale = input.tagSpesa ?? input.tagDefaultVoce ?? null;
  if (!tagFinale || !(TAGS_SPESA as readonly string[]).includes(tagFinale)) {
    throw new Error('Il tag della spesa (ORDINARIA o STRAORDINARIA) è obbligatorio (RC-C1).');
  }

  const haCambio =
    Boolean(input.tagDefaultVoce) && input.tagDefaultVoce !== tagFinale;

  if (haCambio) {
    const motivo = input.motivoCambioTag?.trim() || 'Variazione manuale rispetto al default della voce di catalogo';
    return {
      tagSpesa: tagFinale,
      tagModificatoRispettoDefault: true,
      tracciaCambioTag: `Tag spesa variato da ${input.tagDefaultVoce} a ${tagFinale}: ${motivo}`,
    };
  }

  return {
    tagSpesa: tagFinale,
    tagModificatoRispettoDefault: false,
    tracciaCambioTag: null,
  };
}
