/**
 * Ordinamento delle tabelle e larghezza minima. File puro, testato con `node --test`.
 * Il componente non ordina da solo: il chiamante decide se ordinare in locale (`sortRows`)
 * o chiedere i dati già ordinati al server.
 */
import { toDate } from './format.ts';

export type SortDirection = 'ascending' | 'descending';

export interface SortState {
  key: string;
  direction: SortDirection;
}

/** Valore su cui si ordina: numeri e date si confrontano come tali, il testo in ordine alfabetico italiano. */
export type SortValue = string | number | Date | null | undefined;

function isMissing(value: SortValue): boolean {
  return value === null || value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value));
}

export function compareValues(a: SortValue, b: SortValue): number {
  if (isMissing(a) && isMissing(b)) return 0;
  // I valori mancanti vanno sempre in fondo.
  if (isMissing(a)) return 1;
  if (isMissing(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date || b instanceof Date) {
    return (toDate(a as Date)?.getTime() ?? 0) - (toDate(b as Date)?.getTime() ?? 0);
  }
  return String(a).localeCompare(String(b), 'it', { sensitivity: 'base', numeric: true });
}

/** Copia ordinata, stabile: a parità di valore resta l'ordine di partenza. Senza `sort` restituisce l'ordine originale. */
export function sortRows<T>(
  rows: readonly T[],
  sort: SortState | null,
  getValue: (row: T, key: string) => SortValue,
): T[] {
  if (!sort) return [...rows];
  const factor = sort.direction === 'ascending' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const xv = getValue(x.row, sort.key);
      const yv = getValue(y.row, sort.key);
      // Anche in ordine decrescente i valori mancanti restano in fondo.
      if (isMissing(xv) !== isMissing(yv)) return isMissing(xv) ? 1 : -1;
      return compareValues(xv, yv) * factor || x.index - y.index;
    })
    .map((item) => item.row);
}

/** Clic su un'intestazione: nuova colonna → crescente; stessa colonna → decrescente → nessun ordine. */
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, direction: 'ascending' };
  if (current.direction === 'ascending') return { key, direction: 'descending' };
  return null;
}

/** Valore di `aria-sort` per una colonna. */
export function ariaSortFor(current: SortState | null, key: string): SortDirection | 'none' {
  return current && current.key === key ? current.direction : 'none';
}

/** Frase per gli screen reader dopo un cambio di ordinamento. */
export function sortAnnouncement(current: SortState | null, header: (key: string) => string): string {
  if (!current) return 'Ordinamento rimosso.';
  const way = current.direction === 'ascending' ? 'in ordine crescente' : 'in ordine decrescente';
  return `Elenco ordinato per ${header(current.key)}, ${way}.`;
}

/** Larghezza minima della tabella: sotto questa lo scorrimento orizzontale avviene dentro la tabella. */
export function tableMinWidth(columnMinWidths: readonly number[], actionsWidth: number): number {
  return columnMinWidths.reduce((sum, width) => sum + width, 0) + actionsWidth;
}

export type MobileRole = 'title' | 'detail' | 'status' | 'hidden';

export interface MobileColumnSplit<C> {
  title: C | undefined;
  status: C | undefined;
  /** Al massimo 3 dati essenziali. */
  details: C[];
}

export const MOBILE_MAX_DETAILS = 3;

/**
 * Da una definizione di colonne alla scheda per smartphone: un titolo, un badge di stato e
 * 2-3 dati. Senza indicazioni il titolo è la prima colonna e i dati sono le successive.
 */
export function splitMobileColumns<C extends { mobile?: MobileRole }>(
  columns: readonly C[],
): MobileColumnSplit<C> {
  const visible = columns.filter((column) => column.mobile !== 'hidden');
  const status = visible.find((column) => column.mobile === 'status');
  const title = visible.find((column) => column.mobile === 'title') ?? visible.find((column) => column !== status);
  const rest = visible.filter((column) => column !== title && column !== status);
  const marked = rest.filter((column) => column.mobile === 'detail');
  const details = (marked.length > 0 ? marked : rest).slice(0, MOBILE_MAX_DETAILS);
  return { title, status, details };
}
