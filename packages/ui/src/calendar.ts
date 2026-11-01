/**
 * Calcoli del calendario del DatePicker: settimana da lunedì, mesi e giorni in italiano,
 * limiti min/max e testi di errore. File puro, testato con `node --test`.
 */
import { formatDateNumeric, parseDateNumeric } from './format.ts';

export const MONTH_NAMES = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const;

/** Intestazioni della griglia, a partire da lunedì. */
export const WEEKDAY_SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const;
export const WEEKDAY_LONG = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'] as const;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Aggiunge mesi tenendo il giorno, o l'ultimo del mese se non esiste (31 gennaio + 1 mese = 28/29 febbraio). */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last));
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Indice del giorno nella settimana che parte da lunedì: lunedì 0 … domenica 6. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export interface DateRange {
  min?: Date | null;
  max?: Date | null;
}

export function isOutOfRange(date: Date, { min, max }: DateRange): boolean {
  const day = startOfDay(date).getTime();
  if (min && day < startOfDay(min).getTime()) return true;
  if (max && day > startOfDay(max).getTime()) return true;
  return false;
}

/** Porta la data dentro l'intervallo consentito. */
export function clampDate(date: Date, { min, max }: DateRange): Date {
  if (min && startOfDay(date).getTime() < startOfDay(min).getTime()) return startOfDay(min);
  if (max && startOfDay(date).getTime() > startOfDay(max).getTime()) return startOfDay(max);
  return startOfDay(date);
}

/** Le 6 settimane (42 giorni) che coprono il mese: `null` fuori dal mese. Sempre 6 righe: l'altezza non salta. */
export function monthGrid(year: number, month: number): Array<Array<Date | null>> {
  const first = new Date(year, month, 1);
  const offset = weekdayIndex(first);
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const number = week * 7 + day - offset + 1;
      return number >= 1 && number <= days ? new Date(year, month, number) : null;
    }),
  );
}

/** "aprile 2025" */
export function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** "lunedì 28 aprile 2025": nome accessibile di un giorno. */
export function longDateLabel(date: Date): string {
  return `${WEEKDAY_LONG[weekdayIndex(date)]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Aggiunge le barre mentre si scrive: "28042025" → "28/04/2025". Tiene solo le cifre. */
export function maskDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export interface DateCheck {
  date: Date | null;
  /** Messaggio in italiano semplice, con cosa fare. Assente se la data è valida o il campo è vuoto. */
  error?: string;
}

/** Controlla il testo di un campo data: formato, esistenza del giorno, intervallo. */
export function checkDateText(text: string, range: DateRange = {}): DateCheck {
  if (text.trim() === '') return { date: null };
  const date = parseDateNumeric(text);
  if (!date) {
    return { date: null, error: 'Scrivi una data valida nel formato gg/mm/aaaa, per esempio 28/04/2025.' };
  }
  const { min, max } = range;
  if (isOutOfRange(date, range)) {
    if (min && max) {
      return { date: null, error: `Scegli una data tra il ${formatDateNumeric(min)} e il ${formatDateNumeric(max)}.` };
    }
    if (min) return { date: null, error: `La data non può essere prima del ${formatDateNumeric(min)}.` };
    if (max) return { date: null, error: `La data non può essere dopo il ${formatDateNumeric(max)}.` };
  }
  return { date };
}
