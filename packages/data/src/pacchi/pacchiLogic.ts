/**
 * Logica pura della sezione Registro pacchi (`/pacchi`, UC-07):
 * - Tipi e interfacce del pacco e delle opzioni unità per il portiere;
 * - Badge di stato ('GIACENZA' -> 'In giacenza', 'RITIRATO' -> 'Ritirato');
 * - Calcolo StatCard reali (Pacchi in giacenza, Ritirati di recente, Totale);
 * - Filtri per stato (`Tutti`, `In giacenza`, `Ritirati`), ricerca per mittente esterno o unità/interno,
 *   ordinamento (predefinito per data di arrivo decrescente) e paginazione;
 * - Validazione inserimento nuovo pacco (unità di destinazione obbligatoria, mittente opzionale max 100 caratteri);
 * - Validazione registrazione ritiro (firma o nome di chi ritira obbligatorio non vuoto, max 100 caratteri).
 *
 * File puro (nessuna dipendenza da React Native o Supabase): eseguibile con `node --test`.
 * Nessun uso di `Intl` o `localeCompare` (compatibilità Hermes).
 */

import type { BadgeStatus } from '@iocondo/ui';

export type StatoPacco = 'GIACENZA' | 'RITIRATO';

export interface Pacco {
  id: string;
  condominioId: string;
  unitaDestinazioneId: string;
  etichettaUnita: string;
  mittenteEsterno: string | null;
  stato: StatoPacco;
  dataArrivo: string;
  dataRitiro: string | null;
  firmaRitiro: string | null;
  registratoDa: string | null;
  registratoDaNome: string | null;
}

export interface UnitaCondominioOpzione {
  id: string;
  palazzoId: string;
  palazzoNome: string;
  interno: string;
  piano: number | null;
  scala: string | null;
  etichetta: string;
}

export type FiltroStatoPacchi = 'tutti' | 'GIACENZA' | 'RITIRATO';
export type ColonnaOrdinamentoPacchi = 'data_arrivo' | 'mittente' | 'unita' | 'stato';
export type DirezioneOrdinamentoPacchi = 'asc' | 'desc';

export const PER_PAGINA_PACCHI = 10;
export const MAX_LUNGHEZZA_MITTENTE = 100;
export const MAX_LUNGHEZZA_FIRMA = 100;

export const FILTRI_STATO_PACCHI: readonly { id: FiltroStatoPacchi; label: string }[] = [
  { id: 'tutti', label: 'Tutti' },
  { id: 'GIACENZA', label: 'In giacenza' },
  { id: 'RITIRATO', label: 'Ritirati' },
] as const;

export interface StatistichePacchi {
  inGiacenza: number;
  ritiratiRecenti: number;
  totale: number;
}

const MESI_ABBR = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
];

/**
 * Formatta timestamp ISO in formato leggibile "gg mmm aaaa, hh:mm"
 * senza dipendere da `Intl` (compatibilità con Hermes).
 */
export function formattaDataOraPacco(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const giorno = d.getDate();
  const mese = MESI_ABBR[d.getMonth()] ?? '';
  const anno = d.getFullYear();
  const ore = String(d.getHours()).padStart(2, '0');
  const minuti = String(d.getMinutes()).padStart(2, '0');

  return `${giorno} ${mese} ${anno}, ${ore}:${minuti}`;
}

/**
 * Formatta solo la data "gg mmm aaaa" senza orario.
 */
export function formattaDataPacco(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const giorno = d.getDate();
  const mese = MESI_ABBR[d.getMonth()] ?? '';
  const anno = d.getFullYear();

  return `${giorno} ${mese} ${anno}`;
}

/**
 * Restituisce lo status per il componente Badge (`in-giacenza` o `ritirato`).
 */
export function badgeStatoPacco(stato: StatoPacco): { status: BadgeStatus; label: string } {
  if (stato === 'GIACENZA') {
    return { status: 'in-giacenza', label: 'In giacenza' };
  }
  return { status: 'ritirato', label: 'Ritirato' };
}

/**
 * Formatta l'etichetta dell'unità per la visualizzazione uniforme (es. "Palazzina A — Int. 1").
 */
export function formattaEtichettaUnitaPacco(params: {
  palazzoNome?: string | null;
  interno: string;
  scala?: string | null;
}): string {
  const parti: string[] = [];
  if (params.palazzoNome && params.palazzoNome.trim().length > 0) {
    parti.push(params.palazzoNome.trim());
  }
  if (params.scala && params.scala.trim().length > 0) {
    parti.push(`Scala ${params.scala.trim()}`);
  }
  parti.push(`Int. ${params.interno.trim()}`);
  return parti.join(' — ');
}

/**
 * Calcola le 3 StatCard reali:
 * 1. Pacchi in giacenza
 * 2. Ritirati di recente (ritirati negli ultimi 30 giorni o con data_ritiro)
 * 3. Totale pacchi nel registro
 */
export function calcolaStatistichePacchi(
  pacchi: readonly Pacco[],
  adesso?: Date | string,
): StatistichePacchi {
  const oraRif = adesso ? new Date(adesso).getTime() : Date.now();
  const limiteRecentiMs = 30 * 24 * 60 * 60 * 1000; // 30 giorni

  let inGiacenza = 0;
  let ritiratiRecenti = 0;

  for (const p of pacchi) {
    if (p.stato === 'GIACENZA') {
      inGiacenza++;
    } else if (p.stato === 'RITIRATO') {
      if (p.dataRitiro) {
        const tempoRitiro = new Date(p.dataRitiro).getTime();
        if (!Number.isNaN(tempoRitiro) && oraRif - tempoRitiro <= limiteRecentiMs && tempoRitiro <= oraRif + 60000) {
          ritiratiRecenti++;
        } else if (Number.isNaN(tempoRitiro)) {
          ritiratiRecenti++;
        }
      } else {
        ritiratiRecenti++;
      }
    }
  }

  return {
    inGiacenza,
    ritiratiRecenti,
    totale: pacchi.length,
  };
}

/**
 * Filtra i pacchi per stato e per stringa di ricerca (su mittente esterno o etichetta unità).
 */
export function filtraPacchi(
  pacchi: readonly Pacco[],
  opzioni: { stato?: FiltroStatoPacchi; ricerca?: string },
): Pacco[] {
  const stato = opzioni.stato ?? 'tutti';
  const query = opzioni.ricerca ? opzioni.ricerca.trim().toLowerCase() : '';

  return pacchi.filter((p) => {
    if (stato !== 'tutti' && p.stato !== stato) {
      return false;
    }

    if (query.length > 0) {
      const matchMittente = p.mittenteEsterno ? p.mittenteEsterno.toLowerCase().includes(query) : false;
      const matchUnita = p.etichettaUnita.toLowerCase().includes(query);
      if (!matchMittente && !matchUnita) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Confronto lessicografico senza `localeCompare` (compatibile con Hermes).
 */
function compareStrings(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al < bl) return -1;
  if (al > bl) return 1;
  return 0;
}

/**
 * Ordina l'elenco dei pacchi. Di default ordina per data_arrivo decrescente (più recenti prima).
 */
export function ordinaPacchi(
  pacchi: readonly Pacco[],
  colonna: ColonnaOrdinamentoPacchi = 'data_arrivo',
  direzione: DirezioneOrdinamentoPacchi = 'desc',
): Pacco[] {
  const copia = [...pacchi];
  const segno = direzione === 'asc' ? 1 : -1;

  copia.sort((a, b) => {
    if (colonna === 'data_arrivo') {
      const ta = new Date(a.dataArrivo).getTime() || 0;
      const tb = new Date(b.dataArrivo).getTime() || 0;
      return (ta - tb) * segno;
    }
    if (colonna === 'mittente') {
      const ma = a.mittenteEsterno || '';
      const mb = b.mittenteEsterno || '';
      const cmp = compareStrings(ma, mb);
      if (cmp !== 0) return cmp * segno;
      // Ordinamento secondario: data_arrivo desc
      return (new Date(b.dataArrivo).getTime() || 0) - (new Date(a.dataArrivo).getTime() || 0);
    }
    if (colonna === 'unita') {
      const cmp = compareStrings(a.etichettaUnita, b.etichettaUnita);
      if (cmp !== 0) return cmp * segno;
      return (new Date(b.dataArrivo).getTime() || 0) - (new Date(a.dataArrivo).getTime() || 0);
    }
    if (colonna === 'stato') {
      const cmp = compareStrings(a.stato, b.stato);
      if (cmp !== 0) return cmp * segno;
      return (new Date(b.dataArrivo).getTime() || 0) - (new Date(a.dataArrivo).getTime() || 0);
    }
    return 0;
  });

  return copia;
}

/**
 * Paginazione pura.
 */
export function paginaPacchi(
  pacchi: readonly Pacco[],
  pagina: number,
  perPagina: number = PER_PAGINA_PACCHI,
): {
  paginaCorrente: number;
  totalePagine: number;
  elementi: Pacco[];
  totaleElementi: number;
} {
  const totaleElementi = pacchi.length;
  const perPag = perPagina > 0 ? perPagina : PER_PAGINA_PACCHI;
  const totalePagine = Math.max(1, Math.ceil(totaleElementi / perPag));
  const paginaCorrente = Math.min(Math.max(1, pagina), totalePagine);
  const inizio = (paginaCorrente - 1) * perPag;
  const fine = inizio + perPag;
  const elementi = pacchi.slice(inizio, fine);

  return {
    paginaCorrente,
    totalePagine,
    elementi,
    totaleElementi,
  };
}

export interface InputNuovoPacco {
  unitaId?: string | null;
  mittenteEsterno?: string | null;
}

export interface ErroriNuovoPacco {
  unitaId?: string;
  mittenteEsterno?: string;
}

/**
 * Validazione inserimento nuovo pacco (portiere):
 * - unità di destinazione obbligatoria;
 * - mittente opzionale, massimo 100 caratteri.
 */
export function validaNuovoPacco(input: InputNuovoPacco): {
  valido: boolean;
  errori: ErroriNuovoPacco;
} {
  const errori: ErroriNuovoPacco = {};

  if (!input.unitaId || input.unitaId.trim().length === 0) {
    errori.unitaId = 'Seleziona l’unità immobiliare di destinazione.';
  }

  if (input.mittenteEsterno && input.mittenteEsterno.trim().length > MAX_LUNGHEZZA_MITTENTE) {
    errori.mittenteEsterno = `Il nome del mittente non può superare ${MAX_LUNGHEZZA_MITTENTE} caratteri.`;
  }

  return {
    valido: Object.keys(errori).length === 0,
    errori,
  };
}

/**
 * Validazione registrazione ritiro con firma:
 * - firma o nome del ritirante obbligatorio non vuoto (trim > 0);
 * - massimo 100 caratteri.
 */
export function validaRegistrazioneRitiro(firma?: string | null): {
  valido: boolean;
  errore?: string;
} {
  const trimmed = firma ? firma.trim() : '';

  if (trimmed.length === 0) {
    return {
      valido: false,
      errore: 'Inserisci il nome o la firma di chi ritira il pacco.',
    };
  }

  if (trimmed.length > MAX_LUNGHEZZA_FIRMA) {
    return {
      valido: false,
      errore: `La firma o nominativo non può superare ${MAX_LUNGHEZZA_FIRMA} caratteri.`,
    };
  }

  return { valido: true };
}

