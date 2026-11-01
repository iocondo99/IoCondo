import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_VALUE,
  formatDate,
  formatDateNumeric,
  formatEuro,
  formatFileSize,
  parseDateNumeric,
  toDate,
} from './format.ts';

test('formatEuro: formato italiano con separatori e due decimali', () => {
  assert.equal(formatEuro(2480), '€ 2.480,00');
  assert.equal(formatEuro(0), '€ 0,00');
  assert.equal(formatEuro(7.5), '€ 7,50');
  assert.equal(formatEuro(1234567.891), '€ 1.234.567,89');
  assert.equal(formatEuro(999.999), '€ 1.000,00');
  assert.equal(formatEuro(-120.5), '-€ 120,50');
});

test('formatEuro: valori mancanti o non validi', () => {
  assert.equal(formatEuro(null), EMPTY_VALUE);
  assert.equal(formatEuro(undefined), EMPTY_VALUE);
  assert.equal(formatEuro(Number.NaN), EMPTY_VALUE);
  assert.equal(formatEuro(Number.POSITIVE_INFINITY), EMPTY_VALUE);
  // Un negativo che arrotonda a zero non mostra "-€ 0,00".
  assert.equal(formatEuro(-0.001), '€ 0,00');
});

test('formatDate: giorno, mese breve e anno', () => {
  assert.equal(formatDate('2025-04-28'), '28 apr 2025');
  assert.equal(formatDate(new Date(2025, 0, 5)), '5 gen 2025');
  assert.equal(formatDate(new Date(2025, 11, 31)), '31 dic 2025');
});

test('formatDate: la data solo-giorno non slitta per il fuso orario', () => {
  assert.equal(formatDate('2025-01-01'), '1 gen 2025');
  assert.equal(toDate('2025-03-30')?.getDate(), 30);
});

test('formatDate: valori mancanti o non validi', () => {
  assert.equal(formatDate(null), EMPTY_VALUE);
  assert.equal(formatDate(''), EMPTY_VALUE);
  assert.equal(formatDate('non è una data'), EMPTY_VALUE);
  assert.equal(formatDate('2025-02-31'), EMPTY_VALUE);
});

test('formatDateNumeric e parseDateNumeric: andata e ritorno', () => {
  assert.equal(formatDateNumeric(new Date(2025, 3, 8)), '08/04/2025');
  assert.equal(formatDateNumeric(null), '');
  const parsed = parseDateNumeric('28/04/2025');
  assert.equal(parsed?.getFullYear(), 2025);
  assert.equal(parsed?.getMonth(), 3);
  assert.equal(parsed?.getDate(), 28);
  assert.equal(parseDateNumeric('1/2/2025')?.getMonth(), 1);
});

test('parseDateNumeric: rifiuta date inesistenti e formati sbagliati', () => {
  assert.equal(parseDateNumeric('31/02/2025'), null);
  assert.equal(parseDateNumeric('29/02/2025'), null);
  assert.ok(parseDateNumeric('29/02/2024'));
  assert.equal(parseDateNumeric('2025-04-28'), null);
  assert.equal(parseDateNumeric('28/04/25'), null);
  assert.equal(parseDateNumeric('ciao'), null);
  assert.equal(parseDateNumeric(''), null);
});

test('formatFileSize: unità decimali con la virgola', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(999), '999 B');
  assert.equal(formatFileSize(1000), '1 KB');
  assert.equal(formatFileSize(850_000), '850 KB');
  assert.equal(formatFileSize(1_234_567), '1,2 MB');
  assert.equal(formatFileSize(10_000_000), '10 MB');
  assert.equal(formatFileSize(2_500_000_000), '2,5 GB');
  assert.equal(formatFileSize(-1), EMPTY_VALUE);
  assert.equal(formatFileSize(null), EMPTY_VALUE);
});
