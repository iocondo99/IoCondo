/**
 * Formattazione di importi, date e pesi dei file in italiano (DESIGN_SYSTEM.md, sez. 11.2).
 * Tutta la UI passa da qui: stesso aspetto ovunque. Niente `Intl`: Hermes su alcuni
 * dispositivi non ha i dati italiani, e così il risultato è identico su web, Android e iOS.
 *
 * File volutamente puro (nessun import da react-native): si testa con `node --test`.
 */

/** Segnaposto per un valore mancante o non valido. */
export const EMPTY_VALUE = '—';

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** Cifre intere con il punto ogni tre cifre: 2480 → "2.480". */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Importo in euro: 2480 → "€ 2.480,00"; negativo → "-€ 120,50". Valori mancanti → "—". */
export function formatEuro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return EMPTY_VALUE;
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100);
  const fraction = pad(cents % 100);
  const sign = amount < 0 && cents > 0 ? '-' : '';
  return `${sign}€ ${groupThousands(String(whole))},${fraction}`;
}

export type DateInput = Date | string | number | null | undefined;

/**
 * Converte in Date. Le date "solo giorno" (AAAA-MM-GG) restano quelle del calendario locale:
 * `new Date('2025-04-28')` le sposterebbe in UTC e, a ovest di Greenwich, al giorno prima.
 */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (day) {
      const date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
      return date.getMonth() === Number(day[2]) - 1 ? date : null;
    }
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Data breve e coerente: "28 apr 2025". */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return EMPTY_VALUE;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** Data numerica dei campi di inserimento: "28/04/2025". */
export function formatDateNumeric(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${pad(date.getFullYear(), 4)}`;
}

/** Legge "gg/mm/aaaa" (anche con "-" o "." come separatori). Data inesistente (31/02) → null. */
export function parseDateNumeric(text: string): Date | null {
  const match = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(text);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1000) return null;
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

/** Peso di un file: "850 KB", "1,2 MB". Unità decimali (1 MB = 1000 KB), come mostrano i sistemi operativi. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return EMPTY_VALUE;
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')} ${units[unit]}`;
}
