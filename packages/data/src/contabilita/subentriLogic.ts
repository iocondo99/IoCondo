/**
 * Logica pura per la Disciplina Legale dei Subentri per Compravendita, il Vincolo di Solidarietà
 * Biennale ex art. 63 c. 4 disp. att. c.c., l'Instradamento delle Rate Successive all'Acquirente,
 * i Lavori Straordinari Deliberati Prima dell'Atto e il Riparto Temporale / Consumi al Subentro
 * (Sezione 7: RC-H1..H6; Sezione 6: RC-D3; Sezione 10: T6, T8).
 *
 * Principi fondamentali:
 * - Nessun decimale in virgola mobile per gli importi: tutti i valori monetari sono in centesimi interi (`Centesimi`).
 * - Subentro per vendita (RC-H1): registrazione di data atto, venditore e acquirente; chiusura
 *   della titolarità del venditore e apertura contestuale della titolarità dell'acquirente.
 * - Vincolo di solidarietà biennale ex art. 63 c. 4 disp. att. c.c. (RC-H2, T6): l'acquirente subentrante
 *   è obbligato in solido con il venditore per i contributi dell'anno in corso e di quello precedente
 *   (`annoCompetenza >= annoInCorso - 1`); i debiti pregressi oltre il biennio (`< annoInCorso - 1`)
 *   restano a carico esclusivo del solo venditore. Il sistema espone sempre sia il debitore principale
 *   sia l'obbligato in solido.
 * - Lavori straordinari deliberati prima dell'atto (RC-H3): registrazione di data delibera e note
 *   sul patto interno tra le parti, fermo restando che il patto interno non vincola il condominio.
 * - Instradamento rate (RC-H4, RC-D3): le rate già emesse al venditore restano a suo nome e non si
 *   riemettono (con coobbligazione biennale dell'acquirente se insolute); le rate successive non ancora
 *   emesse vengono instradate all'acquirente.
 * - Spese a periodo (RC-H5, T8) e cambio inquilino con letture contatori (RC-H6).
 * - Nessuna dipendenza da React, Expo, `Intl` o Supabase.
 */

import {
  calcolaGiorniInclusivi,
  centsToEuro,
  normalizzaCentesimi,
  ripartisciConsumi,
  ripartisciSpesaPeriodo,
  VERSIONE_MOTORE_CALCOLO,
  type Centesimi,
  type CentesimiInput,
  type QuotaMillesimiInput,
  type RisultatoRipartizionePeriodo,
} from './contabilitaLogic.ts';
import { aggiungiGiorniIso } from './morositaLogic.ts';
import type { EventoAuditContabile, RuoloTitolarita, StatoRataModello } from './bollettiniLogic.ts';

// ============================================================================
// COSTANTI E TIPI DI DOMINIO (SEZIONE 7: SUBENTRI E COMPETENZA TEMPORALE)
// ============================================================================

export const REGIMI_RESPONSABILITA_SUBENTRO = [
  'SOLIDARIETA_BIENNALE_ART_63_C4',
  'ESCLUSIVO_VENDITORE_OLTRE_BIENNIO',
  'ESCLUSIVO_ACQUIRENTE_POST_ATTO',
] as const;
export type RegimeResponsabilitaSubentro = (typeof REGIMI_RESPONSABILITA_SUBENTRO)[number];

export const AZIONI_INSTRADAMENTO_RATA_SUBENTRO = [
  'MANTIENI_A_VENDITORE',
  'INSTRADA_AD_ACQUIRENTE',
] as const;
export type AzioneInstradamentoRataSubentro =
  (typeof AZIONI_INSTRADAMENTO_RATA_SUBENTRO)[number];

export class ErroreSubentroNonValido extends Error {
  readonly codice = 'SUBENTRO_NON_VALIDO' as const;

  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreSubentroNonValido';
  }
}

// ============================================================================
// UTILITA' INTERNE DATE ISO (YYYY-MM-DD)
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

// ============================================================================
// 1. VINCOLO DI SOLIDARIETA' BIENNALE EX ART. 63 C. 4 DISP. ATT. C.C. (RC-H2, T6)
// ============================================================================

export interface SoggettoSubentroRef {
  utenteId: string | null;
  soggettoId?: string | null;
  nomeDenominazione: string;
}

export interface DebitoSubentroInput {
  id: string;
  tipoDebito?: 'SALDO_PREGRESSO' | 'RATA' | 'CONGUAGLIO';
  unitaId: string;
  esercizioId?: string | null;
  /** Anno di competenza del contributo condominiale (es. 2023, 2025, 2026 in T6). */
  annoCompetenza: number;
  descrizione?: string | null;
  dataScadenza?: string | null;
  dataEsigibilita?: string | null;
  importoDovutoCent: CentesimiInput;
  importoPagatoCent?: CentesimiInput;
  debitoreOriginarioUtenteId?: string | null;
  debitoreOriginarioSoggettoId?: string | null;
}

export interface DebitoValutatoArt63 {
  id: string;
  tipoDebito: 'SALDO_PREGRESSO' | 'RATA' | 'CONGUAGLIO';
  unitaId: string;
  esercizioId: string | null;
  annoCompetenza: number;
  descrizione: string | null;
  importoDovutoCent: Centesimi;
  importoPagatoCent: Centesimi;
  residuoCent: Centesimi;
  residuoEuro: number;
  /** `true` se l'anno rientra nel biennio (anno in corso dell'atto o anno precedente, art. 63 c. 4 disp. att., T6). */
  rientraNelBiennioArt63: boolean;
  /** `true` se l'acquirente risponde in solido col venditore per questo debito (RC-H2, T6). */
  inSolidoConAcquirente: boolean;
  /** `true` se il debito è anteriore al biennio e resta a carico esclusivo del solo venditore (T6). */
  esclusivoVenditoreOltreBiennio: boolean;
  regimeResponsabilita: RegimeResponsabilitaSubentro;
  debitorePrincipale: {
    utenteId: string | null;
    soggettoId: string | null;
    nomeDenominazione: string;
  };
  obbligatoInSolido: {
    utenteId: string | null;
    soggettoId: string | null;
    nomeDenominazione: string;
  } | null;
  /** Valore pronto per la colonna `obbligato_in_solido_utente_id` di `saldi_pregressi` / `rate_dettaglio`. */
  obbligato_in_solido_utente_id: string | null;
}

export interface ValutaSolidarietaBiennaleInput {
  /** Data dell'atto di compravendita (`YYYY-MM-DD`, es. `'2026-04-15'` in T6). */
  dataAtto: string;
  /**
   * Anno dell'esercizio in corso alla data dell'atto.
   * Se omesso viene ricavato dall'anno solare di `dataAtto` (es. `2026` per `'2026-04-15'`).
   */
  annoEsercizioInCorso?: number;
  venditore: SoggettoSubentroRef;
  acquirente: SoggettoSubentroRef;
  debiti: readonly DebitoSubentroInput[];
}

export interface RisultatoSolidarietaBiennaleSubentro {
  dataAtto: string;
  annoInCorso: number;
  annoPrecedente: number;
  anniBiennioSolidale: readonly [number, number];
  debitiValutati: DebitoValutatoArt63[];
  debitiInSolidoBiennio: DebitoValutatoArt63[];
  debitiEsclusiviVenditoreOltreBiennio: DebitoValutatoArt63[];
  totaleInSolidoBiennioCent: Centesimi;
  totaleInSolidoBiennioEuro: number;
  totaleEsclusivoVenditoreOltreBiennioCent: Centesimi;
  totaleEsclusivoVenditoreOltreBiennioEuro: number;
  totaleComplessivoResiduoCent: Centesimi;
  versioneMotore: string;
}

/**
 * Applica il vincolo legale di solidarietà biennale ex art. 63, c. 4, disp. att. c.c. (RC-H2, T6):
 * - Chi subentra nei diritti di un condomino è obbligato solidalmente con questo al pagamento
 *   dei contributi relativi all'**anno in corso** (`annoInCorso`) e a **quello precedente** (`annoInCorso - 1`).
 * - Oltre il biennio (`annoCompetenza < annoInCorso - 1`) il debito resta a carico esclusivo del **solo venditore**.
 * - Il sistema mostra sempre sia il debitore principale sia l'obbligato in solido.
 *
 * Caso T6:
 * - Atto `2026-04-15`; debiti del `2023`, `2025` e `2026`;
 * - Acquirente obbligato in solido per `2025` e `2026`;
 * - Il `2023` resta a carico esclusivo del solo venditore (`obbligatoInSolido = null`).
 */
export function valutaSolidarietaBiennaleSubentro(
  input: ValutaSolidarietaBiennaleInput,
): RisultatoSolidarietaBiennaleSubentro {
  const dataAtto = validaDataIso(input.dataAtto, 'dataAtto');
  const annoAtto = Number(dataAtto.slice(0, 4));
  const annoInCorso = input.annoEsercizioInCorso ?? annoAtto;
  const annoPrecedente = annoInCorso - 1;
  const anniBiennioSolidale: readonly [number, number] = [annoPrecedente, annoInCorso];

  const debitiValutati: DebitoValutatoArt63[] = [];
  const debitiInSolidoBiennio: DebitoValutatoArt63[] = [];
  const debitiEsclusiviVenditoreOltreBiennio: DebitoValutatoArt63[] = [];

  let totaleInSolidoBiennioCent = 0;
  let totaleEsclusivoVenditoreOltreBiennioCent = 0;
  let totaleComplessivoResiduoCent = 0;

  for (const d of input.debiti) {
    const importoDovutoCent = normalizzaCentesimi(d.importoDovutoCent);
    const importoPagatoCent = normalizzaCentesimi(d.importoPagatoCent ?? 0);
    const residuoCent = Math.max(0, normalizzaCentesimi(importoDovutoCent - importoPagatoCent));

    const rientraNelBiennioArt63 =
      d.annoCompetenza === annoInCorso || d.annoCompetenza === annoPrecedente;
    const inSolidoConAcquirente = rientraNelBiennioArt63 && residuoCent > 0;
    const esclusivoVenditoreOltreBiennio = d.annoCompetenza < annoPrecedente;

    const regimeResponsabilita: RegimeResponsabilitaSubentro = rientraNelBiennioArt63
      ? 'SOLIDARIETA_BIENNALE_ART_63_C4'
      : d.annoCompetenza < annoPrecedente
        ? 'ESCLUSIVO_VENDITORE_OLTRE_BIENNIO'
        : 'ESCLUSIVO_ACQUIRENTE_POST_ATTO';

    const debitorePrincipale = {
      utenteId: d.debitoreOriginarioUtenteId ?? input.venditore.utenteId,
      soggettoId: d.debitoreOriginarioSoggettoId ?? input.venditore.soggettoId ?? null,
      nomeDenominazione: input.venditore.nomeDenominazione,
    };

    const obbligatoInSolido = rientraNelBiennioArt63
      ? {
          utenteId: input.acquirente.utenteId,
          soggettoId: input.acquirente.soggettoId ?? null,
          nomeDenominazione: input.acquirente.nomeDenominazione,
        }
      : null;

    const valutato: DebitoValutatoArt63 = {
      id: d.id,
      tipoDebito: d.tipoDebito ?? 'SALDO_PREGRESSO',
      unitaId: d.unitaId,
      esercizioId: d.esercizioId ?? null,
      annoCompetenza: d.annoCompetenza,
      descrizione: d.descrizione ?? null,
      importoDovutoCent,
      importoPagatoCent,
      residuoCent,
      residuoEuro: centsToEuro(residuoCent),
      rientraNelBiennioArt63,
      inSolidoConAcquirente,
      esclusivoVenditoreOltreBiennio,
      regimeResponsabilita,
      debitorePrincipale,
      obbligatoInSolido,
      obbligato_in_solido_utente_id: obbligatoInSolido?.utenteId ?? null,
    };

    debitiValutati.push(valutato);
    totaleComplessivoResiduoCent = normalizzaCentesimi(
      totaleComplessivoResiduoCent + residuoCent,
    );

    if (rientraNelBiennioArt63) {
      debitiInSolidoBiennio.push(valutato);
      totaleInSolidoBiennioCent = normalizzaCentesimi(totaleInSolidoBiennioCent + residuoCent);
    } else if (esclusivoVenditoreOltreBiennio) {
      debitiEsclusiviVenditoreOltreBiennio.push(valutato);
      totaleEsclusivoVenditoreOltreBiennioCent = normalizzaCentesimi(
        totaleEsclusivoVenditoreOltreBiennioCent + residuoCent,
      );
    }
  }

  return {
    dataAtto,
    annoInCorso,
    annoPrecedente,
    anniBiennioSolidale,
    debitiValutati,
    debitiInSolidoBiennio,
    debitiEsclusiviVenditoreOltreBiennio,
    totaleInSolidoBiennioCent,
    totaleInSolidoBiennioEuro: centsToEuro(totaleInSolidoBiennioCent),
    totaleEsclusivoVenditoreOltreBiennioCent,
    totaleEsclusivoVenditoreOltreBiennioEuro: centsToEuro(
      totaleEsclusivoVenditoreOltreBiennioCent,
    ),
    totaleComplessivoResiduoCent,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 2. INSTRADAMENTO RATE GIA' EMESSE VS RATE SUCCESSIVE ALL'ACQUIRENTE (RC-H4, RC-D3)
// ============================================================================

export interface RataSubentroInput {
  id: string;
  rataTestataId: string;
  unitaId: string;
  annoCompetenza?: number;
  numeroRata?: number | null;
  descrizione?: string | null;
  dataScadenza: string;
  dataEmissioneBollettino?: string | null;
  bollettinoId?: string | null;
  statoRataModello: StatoRataModello;
  importoDovutoCent: CentesimiInput;
  importoPagatoCent?: CentesimiInput;
  utenteId: string | null;
  soggettoId?: string | null;
}

export interface RataInstradataPostSubentro {
  id: string;
  rataTestataId: string;
  unitaId: string;
  annoCompetenza: number;
  dataScadenza: string;
  statoRataModello: StatoRataModello;
  importoDovutoCent: Centesimi;
  importoPagatoCent: Centesimi;
  residuoCent: Centesimi;
  /** `true` se la rata era già stata emessa al venditore prima del subentro (RC-H4). */
  eraGiaEmessaAlVenditore: boolean;
  /** Per RC-H4 le rate già emesse al venditore NON si riemettono mai (`false`). */
  daRiemettere: false;
  azione: AzioneInstradamentoRataSubentro;
  /** Intestatario principale dopo l'elaborazione del subentro. */
  intestatarioUtenteId: string | null;
  intestatarioSoggettoId: string | null;
  intestatarioNome: string;
  /** Coobbligato in solido ex art. 63 c. 4 disp. att. c.c. (per rate emesse al venditore e non saldate nel biennio). */
  obbligatoInSolidoUtenteId: string | null;
  obbligatoInSolidoSoggettoId: string | null;
  obbligatoInSolidoNome: string | null;
}

export interface RisultatoInstradamentoRateSubentro {
  dataAtto: string;
  rateElaborate: RataInstradataPostSubentro[];
  /** Rate già emesse che restano a nome del venditore e non vengono riemesse (RC-H4). */
  rateMantenuteAlVenditore: RataInstradataPostSubentro[];
  /** Rate non ancora emesse (`PIANIFICATA`) che vengono instradate al nuovo acquirente (RC-H4, RC-D3). */
  rateInstradateAllAcquirente: RataInstradataPostSubentro[];
  versioneMotore: string;
}

/**
 * Applica la regola di instradamento delle rate in caso di subentro per compravendita (RC-H4, RC-D3):
 * - Le rate **già emesse** al venditore (`EMESSA`, `PARZIALMENTE_PAGATA`, `PAGATA` o con `bollettinoId`)
 *   **restano a suo nome e non si riemettono** (`daRiemettere: false`); se ancora insolute e nel biennio,
 *   registrano l'acquirente come `obbligatoInSolidoUtenteId` (RC-H2).
 * - Le rate **successive non ancora emesse** (`PIANIFICATA` senza bollettino emesso)
 *   vengono **instradate all'acquirente** (`intestatarioUtenteId = acquirente.utenteId`).
 */
export function instradaRateSuSubentro(input: {
  dataAtto: string;
  annoEsercizioInCorso?: number;
  venditore: SoggettoSubentroRef;
  acquirente: SoggettoSubentroRef;
  rateUnita: readonly RataSubentroInput[];
}): RisultatoInstradamentoRateSubentro {
  const dataAtto = validaDataIso(input.dataAtto, 'dataAtto');
  const annoInCorso = input.annoEsercizioInCorso ?? Number(dataAtto.slice(0, 4));
  const annoPrecedente = annoInCorso - 1;

  const rateElaborate: RataInstradataPostSubentro[] = [];
  const rateMantenuteAlVenditore: RataInstradataPostSubentro[] = [];
  const rateInstradateAllAcquirente: RataInstradataPostSubentro[] = [];

  for (const r of input.rateUnita) {
    const dataScadenza = validaDataIso(r.dataScadenza, 'rata.dataScadenza');
    const annoCompetenza = r.annoCompetenza ?? Number(dataScadenza.slice(0, 4));
    const importoDovutoCent = normalizzaCentesimi(r.importoDovutoCent);
    const importoPagatoCent = normalizzaCentesimi(r.importoPagatoCent ?? 0);
    const residuoCent = Math.max(0, normalizzaCentesimi(importoDovutoCent - importoPagatoCent));

    const eraGiaEmessaAlVenditore =
      r.statoRataModello !== 'PIANIFICATA' || Boolean(r.bollettinoId);

    if (eraGiaEmessaAlVenditore) {
      const nelBiennio = annoCompetenza === annoInCorso || annoCompetenza === annoPrecedente;
      const haResiduoSolidale = residuoCent > 0 && nelBiennio;

      const elaborata: RataInstradataPostSubentro = {
        id: r.id,
        rataTestataId: r.rataTestataId,
        unitaId: r.unitaId,
        annoCompetenza,
        dataScadenza,
        statoRataModello: r.statoRataModello,
        importoDovutoCent,
        importoPagatoCent,
        residuoCent,
        eraGiaEmessaAlVenditore: true,
        daRiemettere: false,
        azione: 'MANTIENI_A_VENDITORE',
        intestatarioUtenteId: r.utenteId ?? input.venditore.utenteId,
        intestatarioSoggettoId: r.soggettoId ?? input.venditore.soggettoId ?? null,
        intestatarioNome: input.venditore.nomeDenominazione,
        obbligatoInSolidoUtenteId: haResiduoSolidale ? input.acquirente.utenteId : null,
        obbligatoInSolidoSoggettoId: haResiduoSolidale
          ? (input.acquirente.soggettoId ?? null)
          : null,
        obbligatoInSolidoNome: haResiduoSolidale ? input.acquirente.nomeDenominazione : null,
      };
      rateElaborate.push(elaborata);
      rateMantenuteAlVenditore.push(elaborata);
    } else {
      const elaborata: RataInstradataPostSubentro = {
        id: r.id,
        rataTestataId: r.rataTestataId,
        unitaId: r.unitaId,
        annoCompetenza,
        dataScadenza,
        statoRataModello: 'PIANIFICATA',
        importoDovutoCent,
        importoPagatoCent,
        residuoCent,
        eraGiaEmessaAlVenditore: false,
        daRiemettere: false,
        azione: 'INSTRADA_AD_ACQUIRENTE',
        intestatarioUtenteId: input.acquirente.utenteId,
        intestatarioSoggettoId: input.acquirente.soggettoId ?? null,
        intestatarioNome: input.acquirente.nomeDenominazione,
        obbligatoInSolidoUtenteId: null,
        obbligatoInSolidoSoggettoId: null,
        obbligatoInSolidoNome: null,
      };
      rateElaborate.push(elaborata);
      rateInstradateAllAcquirente.push(elaborata);
    }
  }

  return {
    dataAtto,
    rateElaborate,
    rateMantenuteAlVenditore,
    rateInstradateAllAcquirente,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 3. LAVORI STRAORDINARI DELIBERATI PRIMA DELL'ATTO (RC-H3)
// ============================================================================

export interface ValutaLavoriStraordinariSubentroInput {
  /** Data della delibera assembleare che ha approvato i lavori straordinari (`YYYY-MM-DD`). */
  dataDelibera: string;
  deliberaRiferimento: string;
  /** Data dell'atto di compravendita (`YYYY-MM-DD`). */
  dataAtto: string;
  importoQuotaStraordinariaUnitaCent?: CentesimiInput;
  /** Note relative al patto interno stipulato nel rogito tra venditore e acquirente (RC-H3). */
  notePattoTraParti?: string | null;
  venditore: SoggettoSubentroRef;
  acquirente: SoggettoSubentroRef;
}

export interface RisultatoLavoriStraordinariSubentro {
  dataDelibera: string;
  deliberaRiferimento: string;
  dataAtto: string;
  deliberatiPrimaDellAtto: boolean;
  importoQuotaStraordinariaUnitaCent: Centesimi;
  notePattoTraParti: string | null;
  /**
   * Per RC-H3 il patto tra venditore e acquirente ha efficacia puramente interna (diritto di rivalsa)
   * e NON vincola mai il condominio (`false`).
   */
  pattoInternoVincolaCondominio: false;
  debitoreOriginarioInterno: SoggettoSubentroRef;
  obbligatoVersoCondominio: SoggettoSubentroRef;
  coobbligatoInSolidoVersoCondominio: SoggettoSubentroRef | null;
  avvisoLegaleCondominio: string;
}

/**
 * Gestisce i lavori straordinari deliberati prima dell'atto di compravendita (RC-H3):
 * registra la data della delibera e il campo note per il patto tra venditore e acquirente,
 * sancendo che il patto interno tra le parti non vincola il condominio.
 */
export function valutaLavoriStraordinariSubentro(
  input: ValutaLavoriStraordinariSubentroInput,
): RisultatoLavoriStraordinariSubentro {
  const dataDelibera = validaDataIso(input.dataDelibera, 'dataDelibera');
  const dataAtto = validaDataIso(input.dataAtto, 'dataAtto');
  const deliberaRiferimento = (input.deliberaRiferimento ?? '').trim();
  if (!deliberaRiferimento) {
    throw new ErroreSubentroNonValido(
      'Il riferimento alla delibera dei lavori straordinari è obbligatorio (RC-H3).',
    );
  }

  const deliberatiPrimaDellAtto = dataDelibera <= dataAtto;
  const importoQuotaStraordinariaUnitaCent = normalizzaCentesimi(
    input.importoQuotaStraordinariaUnitaCent ?? 0,
  );
  const notePattoTraParti = input.notePattoTraParti?.trim() || null;

  return {
    dataDelibera,
    deliberaRiferimento,
    dataAtto,
    deliberatiPrimaDellAtto,
    importoQuotaStraordinariaUnitaCent,
    notePattoTraParti,
    pattoInternoVincolaCondominio: false,
    debitoreOriginarioInterno: deliberatiPrimaDellAtto ? input.venditore : input.acquirente,
    obbligatoVersoCondominio: input.acquirente,
    coobbligatoInSolidoVersoCondominio: deliberatiPrimaDellAtto ? input.venditore : null,
    avvisoLegaleCondominio:
      'Il patto interno tra venditore e acquirente riportato in nota vale solo nei rapporti di rivalsa tra le parti e non vincola il condominio (RC-H3, art. 63 disp. att. c.c.).',
  };
}

// ============================================================================
// 4. PROCEDURA COMPLETA DI SUBENTRO PER COMPRAVENDITA (RC-H1, RC-H2, RC-H3, RC-H4, T6)
// ============================================================================

export interface RegistraSubentroCompravenditaInput {
  condominioId: string;
  unitaId: string;
  /** Data dell'atto notarile di compravendita (`YYYY-MM-DD`, RC-H1). */
  dataAtto: string;
  annoEsercizioInCorso?: number;
  venditore: SoggettoSubentroRef & {
    anagraficaUnitaId?: string | null;
    dataInizioTitolarita: string;
    quotaPossesso?: number;
    ruoloTitolarita?: RuoloTitolarita;
  };
  acquirente: SoggettoSubentroRef & {
    quotaPossesso?: number;
    ruoloTitolarita?: RuoloTitolarita;
    isReferenteBollettino?: boolean;
  };
  /**
   * Modalità di chiusura della data fine titolarità del venditore:
   * - `'GIORNO_PRECEDENTE_ATTO'` (default): chiude al giorno `dataAtto - 1` così che dal giorno `dataAtto`
   *   l'acquirente sia titolare esclusivo senza sovrapposizione nei calcoli per giorni (RC-A9, RC-H5, T8);
   * - `'DATA_ATTO'`: imposta `data_fine = dataAtto`.
   */
  modalitaChiusuraVenditore?: 'GIORNO_PRECEDENTE_ATTO' | 'DATA_ATTO';
  notePattoStraordinarie?: string | null;
  lavoriStraordinariPreAtto?: {
    dataDelibera: string;
    deliberaRiferimento: string;
    importoQuotaStraordinariaUnitaCent?: CentesimiInput;
    notePattoTraParti?: string | null;
  } | null;
  debitiPregressi?: readonly DebitoSubentroInput[];
  rateUnita?: readonly RataSubentroInput[];
  autoreId?: string | null;
  timestampIso?: string;
}

export interface RisultatoSubentroCompravendita {
  condominioId: string;
  unitaId: string;
  dataAtto: string;
  titolaritaVenditoreChiusa: {
    id: string | null;
    condominio_id: string;
    unita_id: string;
    utente_id: string | null;
    soggetto_id: string | null;
    data_inizio: string;
    data_fine: string;
    tipo_possesso: 'PROPRIETARIO';
    ruolo_titolarita: RuoloTitolarita;
    quota_possesso: number;
  };
  titolaritaAcquirenteAperta: {
    condominio_id: string;
    unita_id: string;
    utente_id: string | null;
    soggetto_id: string | null;
    data_inizio: string;
    data_fine: null;
    tipo_possesso: 'PROPRIETARIO';
    ruolo_titolarita: RuoloTitolarita;
    quota_possesso: number;
    is_referente_bollettino: boolean;
    data_atto_subentro: string;
    dante_causa_utente_id: string | null;
    note_patto_straordinarie: string | null;
    autore_id: string | null;
  };
  solidarietaBiennale: RisultatoSolidarietaBiennaleSubentro;
  instradamentoRate: RisultatoInstradamentoRateSubentro;
  lavoriStraordinari: RisultatoLavoriStraordinariSubentro | null;
  eventoAudit: EventoAuditContabile;
  versioneMotore: string;
}

/**
 * Esegue in modo atomico e deterministico la disciplina completa del subentro per compravendita
 * (RC-H1, RC-H2, RC-H3, RC-H4, T6):
 * 1. Chiude la titolarità del venditore e apre quella dell'acquirente alla `dataAtto` (RC-H1);
 * 2. Applica il vincolo di solidarietà biennale ex art. 63 c. 4 disp. att. c.c. sui debiti dell'anno in corso
 *    e di quello precedente, lasciando al solo venditore i debiti oltre il biennio (RC-H2, T6);
 * 3. Mantiene al venditore le rate già emesse senza riemetterle e instrada all'acquirente le rate successive (RC-H4);
 * 4. Registra eventuali patti su lavori straordinari deliberati prima dell'atto senza vincolare il condominio (RC-H3).
 */
export function registraSubentroCompravendita(
  input: RegistraSubentroCompravenditaInput,
): RisultatoSubentroCompravendita {
  if (!input.condominioId || !input.condominioId.trim()) {
    throw new ErroreSubentroNonValido('Il condominioId è obbligatorio per registrare un subentro.');
  }
  if (!input.unitaId || !input.unitaId.trim()) {
    throw new ErroreSubentroNonValido("L'unitaId è obbligatorio per registrare un subentro.");
  }

  const dataAtto = validaDataIso(input.dataAtto, 'dataAtto');
  const dataInizioVenditore = validaDataIso(
    input.venditore.dataInizioTitolarita,
    'venditore.dataInizioTitolarita',
  );

  if (dataAtto < dataInizioVenditore) {
    throw new ErroreSubentroNonValido(
      `La data dell'atto di compravendita (${dataAtto}) non può precedere l'inizio della titolarità del venditore (${dataInizioVenditore}).`,
    );
  }

  const stessoUtente =
    Boolean(input.venditore.utenteId) &&
    Boolean(input.acquirente.utenteId) &&
    input.venditore.utenteId === input.acquirente.utenteId;
  const stessoSoggetto =
    Boolean(input.venditore.soggettoId) &&
    Boolean(input.acquirente.soggettoId) &&
    input.venditore.soggettoId === input.acquirente.soggettoId;
  if (stessoUtente || stessoSoggetto) {
    throw new ErroreSubentroNonValido(
      'Il venditore e l\'acquirente devono essere due soggetti distinti (RC-H1).',
    );
  }

  const modalitaChiusura = input.modalitaChiusuraVenditore ?? 'GIORNO_PRECEDENTE_ATTO';
  const dataFineVenditore =
    modalitaChiusura === 'DATA_ATTO' || dataAtto === dataInizioVenditore
      ? dataAtto
      : aggiungiGiorniIso(dataAtto, -1);

  const notePatto =
    input.notePattoStraordinarie?.trim() ||
    input.lavoriStraordinariPreAtto?.notePattoTraParti?.trim() ||
    null;

  const titolaritaVenditoreChiusa = {
    id: input.venditore.anagraficaUnitaId ?? null,
    condominio_id: input.condominioId,
    unita_id: input.unitaId,
    utente_id: input.venditore.utenteId,
    soggetto_id: input.venditore.soggettoId ?? null,
    data_inizio: dataInizioVenditore,
    data_fine: dataFineVenditore,
    tipo_possesso: 'PROPRIETARIO' as const,
    ruolo_titolarita: input.venditore.ruoloTitolarita ?? ('PROPRIETARIO' as const),
    quota_possesso: input.venditore.quotaPossesso ?? 100,
  };

  const titolaritaAcquirenteAperta = {
    condominio_id: input.condominioId,
    unita_id: input.unitaId,
    utente_id: input.acquirente.utenteId,
    soggetto_id: input.acquirente.soggettoId ?? null,
    data_inizio: dataAtto,
    data_fine: null,
    tipo_possesso: 'PROPRIETARIO' as const,
    ruolo_titolarita: input.acquirente.ruoloTitolarita ?? ('PROPRIETARIO' as const),
    quota_possesso: input.acquirente.quotaPossesso ?? 100,
    is_referente_bollettino: input.acquirente.isReferenteBollettino ?? true,
    data_atto_subentro: dataAtto,
    dante_causa_utente_id: input.venditore.utenteId,
    note_patto_straordinarie: notePatto,
    autore_id: input.autoreId ?? null,
  };

  const solidarietaBiennale = valutaSolidarietaBiennaleSubentro({
    dataAtto,
    annoEsercizioInCorso: input.annoEsercizioInCorso,
    venditore: input.venditore,
    acquirente: input.acquirente,
    debiti: input.debitiPregressi ?? [],
  });

  const instradamentoRate = instradaRateSuSubentro({
    dataAtto,
    annoEsercizioInCorso: input.annoEsercizioInCorso,
    venditore: input.venditore,
    acquirente: input.acquirente,
    rateUnita: input.rateUnita ?? [],
  });

  const lavoriStraordinari = input.lavoriStraordinariPreAtto
    ? valutaLavoriStraordinariSubentro({
        dataDelibera: input.lavoriStraordinariPreAtto.dataDelibera,
        deliberaRiferimento: input.lavoriStraordinariPreAtto.deliberaRiferimento,
        dataAtto,
        importoQuotaStraordinariaUnitaCent:
          input.lavoriStraordinariPreAtto.importoQuotaStraordinariaUnitaCent,
        notePattoTraParti: notePatto,
        venditore: input.venditore,
        acquirente: input.acquirente,
      })
    : null;

  const eventoAudit: EventoAuditContabile = {
    azione: 'REGISTRAZIONE_SUBENTRO_COMPRAVENDITA',
    tabella: 'anagrafiche_unita',
    recordId: input.unitaId,
    condominioId: input.condominioId,
    autoreId: input.autoreId ?? null,
    timestampIso: input.timestampIso ?? new Date().toISOString(),
    motivo: `Subentro per compravendita del ${dataAtto}: da ${input.venditore.nomeDenominazione} a ${input.acquirente.nomeDenominazione}`,
    valorePrima: {
      venditore_utente_id: input.venditore.utenteId,
      venditore_soggetto_id: input.venditore.soggettoId ?? null,
      venditore_nome: input.venditore.nomeDenominazione,
      data_inizio_venditore: dataInizioVenditore,
    },
    valoreDopo: {
      data_atto: dataAtto,
      data_fine_venditore: dataFineVenditore,
      acquirente_utente_id: input.acquirente.utenteId,
      acquirente_soggetto_id: input.acquirente.soggettoId ?? null,
      acquirente_nome: input.acquirente.nomeDenominazione,
      anni_biennio_solidale: solidarietaBiennale.anniBiennioSolidale,
      debiti_in_solido_biennio_cents: solidarietaBiennale.totaleInSolidoBiennioCent,
      debiti_esclusivi_venditore_oltre_biennio_cents:
        solidarietaBiennale.totaleEsclusivoVenditoreOltreBiennioCent,
      rate_mantenute_al_venditore: instradamentoRate.rateMantenuteAlVenditore.length,
      rate_instradate_all_acquirente: instradamentoRate.rateInstradateAllAcquirente.length,
      note_patto_straordinarie: notePatto,
    },
  };

  return {
    condominioId: input.condominioId,
    unitaId: input.unitaId,
    dataAtto,
    titolaritaVenditoreChiusa,
    titolaritaAcquirenteAperta,
    solidarietaBiennale,
    instradamentoRate,
    lavoriStraordinari,
    eventoAudit,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}

// ============================================================================
// 5. SPESE A PERIODO (RC-H5, T8) E CAMBIO INQUILINO CON CONTATORI (RC-H6)
// ============================================================================

export interface CalcolaRipartoSpesaAPeriodoSubentroInput {
  /** Quota annua o di periodo già attribuita all'unità immobiliare (oppure calcolata da `importoSpesaTotaleCent` e `tabella`). */
  quotaPeriodoUnitaCent?: CentesimiInput;
  importoSpesaTotaleCent?: CentesimiInput;
  unitaId?: string;
  quoteMillesimali?: readonly QuotaMillesimiInput[];
  sommaMillesimiAttesa?: number;
  dataInizioPeriodo: string;
  dataFinePeriodo: string;
  /** Data di subentro: il titolare uscente risponde da `dataInizioPeriodo` a `dataFineTitolareUscente`, il subentrante da `dataInizioTitolareSubentrante` a `dataFinePeriodo`. */
  titolareUscenteId: string;
  dataFineTitolareUscente: string;
  titolareSubentranteId: string;
  dataInizioTitolareSubentrante: string;
}

/**
 * Ripartisce una spesa a periodo (es. premio assicurazione annuale o compenso amministratore)
 * tra il titolare uscente e il titolare subentrante in proporzione ai giorni di titolarità (RC-H5, T8).
 */
export function calcolaRipartoSpesaAPeriodoSubentro(
  input: CalcolaRipartoSpesaAPeriodoSubentroInput,
): RisultatoRipartizionePeriodo {
  let importoCent: CentesimiInput;
  let millesimiUnita: number | undefined;
  let totaleMillesimi: number | undefined = input.sommaMillesimiAttesa;

  if (input.quotaPeriodoUnitaCent !== undefined) {
    importoCent = input.quotaPeriodoUnitaCent;
  } else if (input.importoSpesaTotaleCent !== undefined) {
    importoCent = input.importoSpesaTotaleCent;
    if (input.quoteMillesimali && input.unitaId) {
      const voceUnita = input.quoteMillesimali.find((q) => q.unitaId === input.unitaId);
      millesimiUnita =
        voceUnita?.millesimi ?? voceUnita?.valoreMillesimale ?? voceUnita?.valore;
      if (totaleMillesimi === undefined) {
        totaleMillesimi = input.quoteMillesimali.reduce(
          (acc, q) => acc + (q.millesimi ?? q.valoreMillesimale ?? q.valore ?? 0),
          0,
        );
      }
    }
  } else {
    throw new ErroreSubentroNonValido(
      'Specificare quotaPeriodoUnitaCent oppure importoSpesaTotaleCent per il riparto della spesa a periodo (RC-H5).',
    );
  }

  return ripartisciSpesaPeriodo({
    importoCent,
    millesimiUnita,
    totaleMillesimi,
    dataInizio: input.dataInizioPeriodo,
    dataFine: input.dataFinePeriodo,
    periodiTitolarita: [
      {
        titolareId: input.titolareUscenteId,
        dataInizio: input.dataInizioPeriodo,
        dataFine: input.dataFineTitolareUscente,
      },
      {
        titolareId: input.titolareSubentranteId,
        dataInizio: input.dataInizioTitolareSubentrante,
        dataFine: input.dataFinePeriodo,
      },
    ],
  });
}

export interface CalcolaConsumiCambioTitolareInput {
  unitaId: string;
  importoTotaleConsumoUnitaCent: CentesimiInput;
  dataInizioPeriodo: string;
  dataFinePeriodo: string;
  /** Data del subentro / cambio inquilino (`YYYY-MM-DD`, RC-H6). */
  dataSubentro: string;
  titolareUscenteId: string;
  titolareSubentranteId: string;
  /** Lettura contatore a inizio periodo (es. `100` m³). */
  letturaInizioPeriodo?: number | null;
  /** Lettura contatore rilevata alla data di subentro (RC-H6). Se `null`/`undefined`, il sistema stima per giorni e marca `daConguagliare = true`. */
  letturaAlSubentro?: number | null;
  /** Lettura contatore a fine periodo (es. `150` m³). */
  letturaFinePeriodo?: number | null;
}

export interface QuotaConsumoPeriodoTitolare {
  titolareId: string;
  periodoDa: string;
  periodoA: string;
  giorniPeriodo: number;
  consumoCalcolato: number | null;
  quotaCent: Centesimi;
  quotaEuro: number;
  isStimataPerGiorni: boolean;
  daConguagliare: boolean;
}

export interface RisultatoConsumiCambioTitolare {
  unitaId: string;
  importoTotaleConsumoUnitaCent: Centesimi;
  metodoCalcolo: 'LETTURE_REALI_SUBENTRO' | 'STIMA_PER_GIORNI_DA_CONGUAGLIARE';
  daConguagliare: boolean;
  quotaUscente: QuotaConsumoPeriodoTitolare;
  quotaSubentrante: QuotaConsumoPeriodoTitolare;
  sommaQuoteCent: Centesimi;
  versioneMotore: string;
}

/**
 * Calcola la ripartizione dei consumi (acqua / riscaldamento) al cambio inquilino o proprietario (RC-H6):
 * - Se sono presenti le letture del contatore a inizio periodo, alla data di subentro e a fine periodo,
 *   attribuisce a ciascun titolare i consumi effettivi rilevati tra le due letture (`daConguagliare = false`);
 * - Se manca la lettura intermedia al subentro, stima la ripartizione in proporzione ai giorni di titolarità
 *   e marca entrambe le quote con `daConguagliare = true`.
 */
export function calcolaConsumiCambioTitolare(
  input: CalcolaConsumiCambioTitolareInput,
): RisultatoConsumiCambioTitolare {
  const importoTotaleCent = normalizzaCentesimi(input.importoTotaleConsumoUnitaCent);
  const dataInizio = validaDataIso(input.dataInizioPeriodo, 'dataInizioPeriodo');
  const dataFine = validaDataIso(input.dataFinePeriodo, 'dataFinePeriodo');
  const dataSubentro = validaDataIso(input.dataSubentro, 'dataSubentro');

  if (dataSubentro <= dataInizio || dataSubentro > dataFine) {
    throw new ErroreSubentroNonValido(
      `La data di subentro (${dataSubentro}) deve cadere all'interno del periodo (${dataInizio} .. ${dataFine}).`,
    );
  }

  const fineUscente = aggiungiGiorniIso(dataSubentro, -1);
  const giorniUscente = calcolaGiorniInclusivi(dataInizio, fineUscente);
  const giorniSubentrante = calcolaGiorniInclusivi(dataSubentro, dataFine);

  const haLettureComplete =
    input.letturaInizioPeriodo !== null &&
    input.letturaInizioPeriodo !== undefined &&
    input.letturaAlSubentro !== null &&
    input.letturaAlSubentro !== undefined &&
    input.letturaFinePeriodo !== null &&
    input.letturaFinePeriodo !== undefined;

  if (haLettureComplete) {
    const lInizio = input.letturaInizioPeriodo!;
    const lSub = input.letturaAlSubentro!;
    const lFine = input.letturaFinePeriodo!;

    if (lSub < lInizio || lFine < lSub) {
      throw new ErroreSubentroNonValido(
        `Letture contatore non monotone crescenti: inizio=${lInizio}, subentro=${lSub}, fine=${lFine}.`,
      );
    }

    const consumoUscente = Number((lSub - lInizio).toFixed(3));
    const consumoSubentrante = Number((lFine - lSub).toFixed(3));
    const consumoTotale = Number((consumoUscente + consumoSubentrante).toFixed(3));

    if (consumoTotale > 0) {
      const esitoConsumi = ripartisciConsumi({
        importoTotaleCent,
        consumiUnita: [
          { unitaId: input.titolareUscenteId, consumo: consumoUscente },
          { unitaId: input.titolareSubentranteId, consumo: consumoSubentrante },
        ],
      });

      const qUsc = esitoConsumi.quote[0]!;
      const qSub = esitoConsumi.quote[1]!;

      return {
        unitaId: input.unitaId,
        importoTotaleConsumoUnitaCent: importoTotaleCent,
        metodoCalcolo: 'LETTURE_REALI_SUBENTRO',
        daConguagliare: false,
        quotaUscente: {
          titolareId: input.titolareUscenteId,
          periodoDa: dataInizio,
          periodoA: fineUscente,
          giorniPeriodo: giorniUscente,
          consumoCalcolato: consumoUscente,
          quotaCent: qUsc.quotaFinaleCent,
          quotaEuro: qUsc.quotaFinaleEuro,
          isStimataPerGiorni: false,
          daConguagliare: false,
        },
        quotaSubentrante: {
          titolareId: input.titolareSubentranteId,
          periodoDa: dataSubentro,
          periodoA: dataFine,
          giorniPeriodo: giorniSubentrante,
          consumoCalcolato: consumoSubentrante,
          quotaCent: qSub.quotaFinaleCent,
          quotaEuro: qSub.quotaFinaleEuro,
          isStimataPerGiorni: false,
          daConguagliare: false,
        },
        sommaQuoteCent: esitoConsumi.sommaQuoteFinaliCent,
        versioneMotore: VERSIONE_MOTORE_CALCOLO,
      };
    }
  }

  // Fallback RC-H6: se manca la lettura al subentro, si stima per giorni e si marca "da conguagliare"
  const esitoGiorni = ripartisciSpesaPeriodo({
    importoCent: importoTotaleCent,
    dataInizio,
    dataFine,
    periodiTitolarita: [
      {
        titolareId: input.titolareUscenteId,
        dataInizio,
        dataFine: fineUscente,
      },
      {
        titolareId: input.titolareSubentranteId,
        dataInizio: dataSubentro,
        dataFine,
      },
    ],
  });

  const qUscG = esitoGiorni.quoteTitolari[0]!;
  const qSubG = esitoGiorni.quoteTitolari[1]!;

  return {
    unitaId: input.unitaId,
    importoTotaleConsumoUnitaCent: importoTotaleCent,
    metodoCalcolo: 'STIMA_PER_GIORNI_DA_CONGUAGLIARE',
    daConguagliare: true,
    quotaUscente: {
      titolareId: input.titolareUscenteId,
      periodoDa: dataInizio,
      periodoA: fineUscente,
      giorniPeriodo: qUscG.giorni,
      consumoCalcolato: null,
      quotaCent: qUscG.quotaFinaleCent,
      quotaEuro: qUscG.quotaFinaleEuro,
      isStimataPerGiorni: true,
      daConguagliare: true,
    },
    quotaSubentrante: {
      titolareId: input.titolareSubentranteId,
      periodoDa: dataSubentro,
      periodoA: dataFine,
      giorniPeriodo: qSubG.giorni,
      consumoCalcolato: null,
      quotaCent: qSubG.quotaFinaleCent,
      quotaEuro: qSubG.quotaFinaleEuro,
      isStimataPerGiorni: true,
      daConguagliare: true,
    },
    sommaQuoteCent: esitoGiorni.sommaQuoteFinaliCent,
    versioneMotore: VERSIONE_MOTORE_CALCOLO,
  };
}
