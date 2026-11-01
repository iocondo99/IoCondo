import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  checkDateText,
  clampDate,
  isOutOfRange,
  longDateLabel,
  maskDateInput,
  monthGrid,
  monthTitle,
  weekdayIndex,
} from './calendar.ts';

test('mesi e giorni in italiano, settimana da lunedì', () => {
  assert.equal(MONTH_NAMES.length, 12);
  assert.equal(MONTH_NAMES[3], 'aprile');
  assert.deepEqual([...WEEKDAY_SHORT], ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']);
  // 28 aprile 2025 è un lunedì; 27 è una domenica.
  assert.equal(weekdayIndex(new Date(2025, 3, 28)), 0);
  assert.equal(weekdayIndex(new Date(2025, 3, 27)), 6);
});

test('monthGrid: 6 settimane, il primo giorno nella colonna giusta', () => {
  const grid = monthGrid(2025, 3); // aprile 2025: il 1° è un martedì
  assert.equal(grid.length, 6);
  assert.ok(grid.every((week) => week.length === 7));
  assert.equal(grid[0]?.[0], null);
  assert.equal(grid[0]?.[1]?.getDate(), 1);
  const days = grid.flat().filter((day) => day !== null);
  assert.equal(days.length, 30);
  assert.equal(days[29]?.getDate(), 30);
});

test('monthGrid: mese che inizia di lunedì e febbraio bisestile', () => {
  assert.equal(monthGrid(2025, 8)[0]?.[0]?.getDate(), 1); // settembre 2025 inizia di lunedì
  assert.equal(monthGrid(2024, 1).flat().filter(Boolean).length, 29);
});

test('addMonths: tiene il giorno o l’ultimo del mese', () => {
  assert.equal(addMonths(new Date(2025, 0, 31), 1).getDate(), 28);
  assert.equal(addMonths(new Date(2024, 0, 31), 1).getDate(), 29);
  assert.equal(addMonths(new Date(2025, 11, 15), 1).getFullYear(), 2026);
  assert.equal(addMonths(new Date(2025, 0, 15), -1).getMonth(), 11);
  assert.equal(addDays(new Date(2025, 0, 31), 1).getMonth(), 1);
});

test('intervallo min/max e clamp', () => {
  const range = { min: new Date(2025, 0, 10), max: new Date(2025, 0, 20) };
  assert.equal(isOutOfRange(new Date(2025, 0, 9), range), true);
  assert.equal(isOutOfRange(new Date(2025, 0, 10, 23, 59), range), false);
  assert.equal(isOutOfRange(new Date(2025, 0, 21), range), true);
  assert.equal(clampDate(new Date(2025, 0, 1), range).getDate(), 10);
  assert.equal(clampDate(new Date(2025, 5, 1), range).getDate(), 20);
  assert.equal(isOutOfRange(new Date(2030, 0, 1), {}), false);
});

test('maskDateInput: aggiunge le barre e scarta il resto', () => {
  assert.equal(maskDateInput('2'), '2');
  assert.equal(maskDateInput('280'), '28/0');
  assert.equal(maskDateInput('28042025'), '28/04/2025');
  assert.equal(maskDateInput('28/04/2025'), '28/04/2025');
  assert.equal(maskDateInput('28/04/2025999'), '28/04/2025');
  assert.equal(maskDateInput('ab'), '');
});

test('checkDateText: vuoto, valido, formato errato, fuori intervallo', () => {
  assert.deepEqual(checkDateText(''), { date: null });
  assert.equal(checkDateText('28/04/2025').date?.getDate(), 28);
  assert.match(checkDateText('31/02/2025').error ?? '', /gg\/mm\/aaaa/);
  assert.match(checkDateText('28/04').error ?? '', /gg\/mm\/aaaa/);

  const both = { min: new Date(2025, 0, 1), max: new Date(2025, 11, 31) };
  assert.equal(checkDateText('15/06/2025', both).error, undefined);
  assert.equal(checkDateText('31/12/2024', both).error, 'Scegli una data tra il 01/01/2025 e il 31/12/2025.');
  assert.equal(
    checkDateText('01/01/2024', { min: new Date(2025, 0, 1) }).error,
    'La data non può essere prima del 01/01/2025.',
  );
  assert.equal(
    checkDateText('01/01/2026', { max: new Date(2025, 11, 31) }).error,
    'La data non può essere dopo il 31/12/2025.',
  );
});

test('etichette accessibili del calendario', () => {
  assert.equal(monthTitle(2025, 3), 'aprile 2025');
  assert.equal(longDateLabel(new Date(2025, 3, 28)), 'lunedì 28 aprile 2025');
});
