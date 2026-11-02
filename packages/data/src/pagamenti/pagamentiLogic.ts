/**
 * Logica pura della pagina Pagamenti del condòmino: filtri, ordinamento, paginazione, riepilogo.
 * File volutamente puro (nessun import da react-native o Supabase): si testa con `node --test`.
 * Niente `Intl` né `localeCompare` (Hermes): stesso risultato su web, Android e iOS.
 */

import { residuo, statoRata, type RataHome, type StatoRataHome } from '../home/homeLogic.ts';

export type { RataHome, StatoRataHome };

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type FiltroStato = 'tutti' | 'da-pagare' | 'pagati' | 'scaduti';

export interface FiltriPagamenti {
  stato: FiltroStato;
  ricerca: string;
}

/**
 * Ordine dell'elenco. `predefinito`: le scadute prima (la più vecchia in cima), poi le altre per data.
 * Gli altri valori sono quelli scelti dall'utente sulle colonne "Scadenza" e "Importo dovuto".
 */
export type OrdinePagamenti = 'predefinito' | 'scadenza-asc' | 'scadenza-desc' | 'importo-asc' | 'importo-desc';

/** Stesso formato di `SortState` di @iocondo/ui, ridefinito qui per non dipendere dalla UI. */
export interface OrdineColonna {
  key: string;
  direction: 'ascending' | 'descending';
}

/** Riepilogo numerico mostrato nelle StatCard in cima alla pagina Pagamenti. */
export interface RiepilogoPagamenti {
  totaleDaPagare: number;
  totaleScaduto: number;
  /** La scadenza più vicina fra le rate ancora da pagare e non scadute, o null se non ce n'è. */
  prossima: string | null;
}

/** Rata arricchita con lo stato calcolato e il residuo, pronta per la UI. */
export interface RataVista extends RataHome {
  statoCalcolato: StatoRataHome;
  residuo: number;
}

// ─── Conversione ─────────────────────────────────────────────────────────────

export function rataVista(rata: RataHome, oggi: string): RataVista {
  return { ...rata, statoCalcolato: statoRata(rata, oggi), residuo: residuo(rata) };
}

export function preparaRate(rate: readonly RataHome[], oggi: string): readonly RataVista[] {
  return rate.map((r) => rataVista(r, oggi));
}

// ─── Filtri ──────────────────────────────────────────────────────────────────

export function filtraPerStato(rate: readonly RataVista[], filtro: FiltroStato): readonly RataVista[] {
  if (filtro === 'tutti') return rate;
  if (filtro === 'da-pagare') return rate.filter((r) => r.statoCalcolato === 'da-pagare' || r.statoCalcolato === 'in-corso');
  if (filtro === 'pagati') return rate.filter((r) => r.statoCalcolato === 'pagato');
  if (filtro === 'scaduti') return rate.filter((r) => r.statoCalcolato === 'scaduto');
  return rate;
}

export function filtraPerRicerca(rate: readonly RataVista[], testo: string): readonly RataVista[] {
  const pulito = testo.trim().toLowerCase();
  if (!pulito) return rate;
  return rate.filter((r) => r.descrizione.toLowerCase().includes(pulito));
}

/** Quanti filtri sono attivi (stato diverso da "tutti" e ricerca non vuota). */
export function filtriAttivi(filtri: FiltriPagamenti): number {
  return (filtri.stato !== 'tutti' ? 1 : 0) + (filtri.ricerca.trim() ? 1 : 0);
}

// ─── Ordinamento ─────────────────────────────────────────────────────────────

/** Colonne su cui l'utente può ordinare e l'ordine che ciascuna direzione produce. */
const ORDINE_DA_COLONNA: Record<string, { ascending: OrdinePagamenti; descending: OrdinePagamenti }> = {
  scadenza: { ascending: 'scadenza-asc', descending: 'scadenza-desc' },
  dovuto: { ascending: 'importo-asc', descending: 'importo-desc' },
};

/** Da ordinamento di una colonna (o nessuno) all'ordine dell'elenco. Colonna sconosciuta: predefinito. */
export function ordineDaColonna(sort: OrdineColonna | null): OrdinePagamenti {
  if (!sort) return 'predefinito';
  return ORDINE_DA_COLONNA[sort.key]?.[sort.direction] ?? 'predefinito';
}

/** L'inverso di `ordineDaColonna`: serve a mostrare nell'intestazione la freccia giusta. */
export function colonnaDaOrdine(ordine: OrdinePagamenti): OrdineColonna | null {
  for (const [key, versi] of Object.entries(ORDINE_DA_COLONNA)) {
    if (versi.ascending === ordine) return { key, direction: 'ascending' };
    if (versi.descending === ordine) return { key, direction: 'descending' };
  }
  return null;
}

/** Confronto di testi senza `Intl`: minuscole, poi ordine dei caratteri. */
function confronta(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

const perDescrizioneEId = (a: RataVista, b: RataVista) =>
  confronta(a.descrizione, b.descrizione) || confronta(a.id, b.id);

/** Ordina una copia dell'elenco (a parità di valore: descrizione e id, così l'ordine è sempre lo stesso). */
export function ordinaRate(rate: readonly RataVista[], ordine: OrdinePagamenti): readonly RataVista[] {
  const copia = [...rate];
  switch (ordine) {
    case 'scadenza-asc':
      return copia.sort((a, b) => confronta(a.dataScadenza, b.dataScadenza) || perDescrizioneEId(a, b));
    case 'scadenza-desc':
      return copia.sort((a, b) => confronta(b.dataScadenza, a.dataScadenza) || perDescrizioneEId(a, b));
    case 'importo-asc':
      return copia.sort((a, b) => a.importoDovuto - b.importoDovuto || perDescrizioneEId(a, b));
    case 'importo-desc':
      return copia.sort((a, b) => b.importoDovuto - a.importoDovuto || perDescrizioneEId(a, b));
    default:
      return copia.sort((a, b) => {
        const aScaduta = a.statoCalcolato === 'scaduto';
        const bScaduta = b.statoCalcolato === 'scaduto';
        if (aScaduta !== bScaduta) return aScaduta ? -1 : 1;
        return confronta(a.dataScadenza, b.dataScadenza) || perDescrizioneEId(a, b);
      });
  }
}

// ─── Paginazione ─────────────────────────────────────────────────────────────

export const PER_PAGINA_DEFAULT = 10;

export function paginaCorrente<T>(items: readonly T[], pagina: number, perPagina: number): readonly T[] {
  const da = (pagina - 1) * perPagina;
  return items.slice(da, da + perPagina);
}

export function numeroPagine(totale: number, perPagina: number): number {
  return Math.max(1, Math.ceil(totale / perPagina));
}

/** Tiene la pagina scelta dentro l'intervallo valido (es. dopo un filtro che riduce i risultati). */
export function limitaPagina(pagina: number, totalePagine: number): number {
  return Math.min(Math.max(1, Math.trunc(pagina) || 1), Math.max(1, totalePagine));
}

// ─── Pipeline completa ───────────────────────────────────────────────────────

export interface PaginaPagamenti {
  rate: readonly RataVista[];
  totaleFiltrati: number;
  numeroPagine: number;
  /** La pagina davvero mostrata (quella chiesta, riportata nell'intervallo valido). */
  pagina: number;
}

export function paginaPagamenti(
  rate: readonly RataVista[],
  filtri: FiltriPagamenti,
  ordine: OrdinePagamenti,
  pagina: number,
  perPagina = PER_PAGINA_DEFAULT,
): PaginaPagamenti {
  let filtrati = filtraPerStato(rate, filtri.stato);
  filtrati = filtraPerRicerca(filtrati, filtri.ricerca);
  filtrati = ordinaRate(filtrati, ordine);
  const totaleFiltrati = filtrati.length;
  const npag = numeroPagine(totaleFiltrati, perPagina);
  const paginaValida = limitaPagina(pagina, npag);
  return {
    rate: paginaCorrente(filtrati, paginaValida, perPagina),
    totaleFiltrati,
    numeroPagine: npag,
    pagina: paginaValida,
  };
}

// ─── Riepilogo ───────────────────────────────────────────────────────────────

export function riepilogoPagamenti(rate: readonly RataVista[], oggi: string): RiepilogoPagamenti {
  let totaleDaPagare = 0;
  let totaleScaduto = 0;
  let prossima: string | null = null;

  for (const r of rate) {
    if (r.statoCalcolato === 'pagato') continue;
    totaleDaPagare += r.residuo;
    if (r.statoCalcolato === 'scaduto') {
      totaleScaduto += r.residuo;
    } else if (r.dataScadenza >= oggi && (!prossima || r.dataScadenza < prossima)) {
      prossima = r.dataScadenza;
    }
  }
  return {
    totaleDaPagare: Math.round(totaleDaPagare * 100) / 100,
    totaleScaduto: Math.round(totaleScaduto * 100) / 100,
    prossima,
  };
}

// ─── Di chi è una rata ───────────────────────────────────────────────────────

/** Dati minimi di una riga di `rate_dettaglio` per decidere se appartiene all'utente. */
export interface ProprietaRata {
  utenteId: string | null;
  unitaId: string;
}

/**
 * La rata è dell'utente se è lui il debitore, oppure se non c'è un debitore e la rata è su una sua unità.
 * Le RLS lasciano leggere di più a un amministratore: questo controllo tiene la pagina "da residente".
 */
export function rataAppartieneA(rata: ProprietaRata, utenteId: string, unitaDellUtente: readonly string[]): boolean {
  if (rata.utenteId === utenteId) return true;
  return rata.utenteId === null && unitaDellUtente.includes(rata.unitaId);
}

/** Filtro `or` di PostgREST per le rate dell'utente (stessa regola di `rataAppartieneA`). */
export function filtroRateMie(utenteId: string, unitaDellUtente: readonly string[]): string {
  if (unitaDellUtente.length === 0) return `utente_id.eq.${utenteId}`;
  return `utente_id.eq.${utenteId},and(utente_id.is.null,unita_id.in.(${unitaDellUtente.join(',')}))`;
}

// ─── Bollettino ──────────────────────────────────────────────────────────────

export interface PercorsoBollettino {
  /** Cartella nel bucket (es. "<condominio>/<unità>"). */
  cartella: string;
  /** Nome del file (es. "bollettino.pdf"). */
  nome: string;
}

/**
 * Percorso valido di un bollettino nel bucket privato: relativo, senza ".." né barre doppie, e deve essere
 * un PDF (il bucket accetta anche immagini, ma qui si parla di bollettino PDF). Altrimenti null.
 */
export function percorsoBollettino(percorso: string | null | undefined): PercorsoBollettino | null {
  const pulito = percorso?.trim();
  if (!pulito || pulito.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(pulito)) return null;
  const parti = pulito.split('/');
  if (parti.some((p) => p === '' || p === '.' || p === '..')) return null;
  const nome = parti[parti.length - 1]!;
  if (!/\.pdf$/i.test(nome)) return null;
  return { cartella: parti.slice(0, -1).join('/'), nome };
}

// ─── Millesimi ───────────────────────────────────────────────────────────────

/** Numero con la virgola e il punto sulle migliaia, fino a 3 decimali, senza `Intl`: 1000 → "1.000". */
function numeroItaliano(valore: number): string {
  const [intero = '0', decimali = ''] = (Math.round(Math.abs(valore) * 1000) / 1000).toString().split('.');
  const migliaia = intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${valore < 0 ? '-' : ''}${migliaia}${decimali ? `,${decimali}` : ''}`;
}

/** "125,5 su 1.000": i millesimi dell'unità sul totale della tabella. */
export function descrizioneMillesimi(valore: number, totale: number): string {
  return `${numeroItaliano(valore)} su ${numeroItaliano(totale)}`;
}

// ─── Helper UI ───────────────────────────────────────────────────────────────

export const OPZIONI_STATO: ReadonlyArray<{ value: Exclude<FiltroStato, 'tutti'>; label: string }> = [
  { value: 'da-pagare', label: 'Da pagare' },
  { value: 'pagati', label: 'Pagati' },
  { value: 'scaduti', label: 'Scaduti' },
];

export function sottotitoloPagamenti(condominioNome: string | null | undefined): string {
  return condominioNome ? `${condominioNome} — le tue rate` : 'Le tue rate';
}

export function descrizioneProssima(oggi: string, prossima: string | null): string {
  if (!prossima) return 'Nessuna rata in scadenza';
  const giorni = Math.ceil((new Date(prossima).getTime() - new Date(oggi).getTime()) / 86_400_000);
  if (giorni <= 0) return 'Scade oggi';
  if (giorni === 1) return 'Scade domani';
  if (giorni <= 7) return `Scade tra ${giorni} giorni`;
  return 'Prossima scadenza';
}

export function etichettaRata(rata: RataHome): string {
  return rata.descrizione || `Rata del ${rata.dataScadenza}`;
}
