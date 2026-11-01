import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ariaSortFor,
  compareValues,
  nextSort,
  sortAnnouncement,
  sortRows,
  splitMobileColumns,
  tableMinWidth,
  type SortState,
} from './dataTableMath.ts';

interface Row {
  id: number;
  nome: string | null;
  importo: number | null;
  scadenza: string;
}

const rows: Row[] = [
  { id: 1, nome: 'Rata 2', importo: 300, scadenza: '2025-05-10' },
  { id: 2, nome: 'rata 10', importo: null, scadenza: '2025-01-15' },
  { id: 3, nome: 'Àncora', importo: 120.5, scadenza: '2025-03-01' },
  { id: 4, nome: null, importo: 300, scadenza: '2025-02-20' },
];
const value = (row: Row, key: string) => row[key as keyof Row];
const ids = (list: Row[]) => list.map((row) => row.id);

test('sortRows: numeri, con i mancanti sempre in fondo', () => {
  const asc: SortState = { key: 'importo', direction: 'ascending' };
  const desc: SortState = { key: 'importo', direction: 'descending' };
  assert.deepEqual(ids(sortRows(rows, asc, value)), [3, 1, 4, 2]);
  assert.deepEqual(ids(sortRows(rows, desc, value)), [1, 4, 3, 2]);
});

test('sortRows: testo in ordine italiano e numerico ("rata 2" prima di "rata 10")', () => {
  const asc: SortState = { key: 'nome', direction: 'ascending' };
  assert.deepEqual(ids(sortRows(rows, asc, value)), [3, 1, 2, 4]);
});

test('sortRows: date ISO ordinate come testo coerente, stabile a parità', () => {
  const asc: SortState = { key: 'scadenza', direction: 'ascending' };
  assert.deepEqual(ids(sortRows(rows, asc, value)), [2, 4, 3, 1]);
  // Parità di importo (300): resta l'ordine di partenza.
  const byAmount = sortRows(rows, { key: 'importo', direction: 'ascending' }, value);
  assert.ok(byAmount.indexOf(rows[0]!) < byAmount.indexOf(rows[3]!));
});

test('sortRows: senza ordinamento restituisce una copia nell’ordine originale', () => {
  const copy = sortRows(rows, null, value);
  assert.deepEqual(ids(copy), [1, 2, 3, 4]);
  assert.notEqual(copy, rows);
});

test('compareValues: date vere', () => {
  assert.ok(compareValues(new Date(2025, 0, 1), new Date(2025, 0, 2)) < 0);
  assert.equal(compareValues(null, undefined), 0);
});

test('nextSort: crescente, decrescente, nessun ordine; cambio colonna riparte da crescente', () => {
  const first = nextSort(null, 'importo');
  assert.deepEqual(first, { key: 'importo', direction: 'ascending' });
  const second = nextSort(first, 'importo');
  assert.deepEqual(second, { key: 'importo', direction: 'descending' });
  assert.equal(nextSort(second, 'importo'), null);
  assert.deepEqual(nextSort(second, 'nome'), { key: 'nome', direction: 'ascending' });
});

test('ariaSortFor e sortAnnouncement', () => {
  const sort: SortState = { key: 'importo', direction: 'descending' };
  assert.equal(ariaSortFor(sort, 'importo'), 'descending');
  assert.equal(ariaSortFor(sort, 'nome'), 'none');
  assert.equal(ariaSortFor(null, 'nome'), 'none');
  assert.equal(sortAnnouncement(sort, () => 'Importo'), 'Elenco ordinato per Importo, in ordine decrescente.');
  assert.equal(sortAnnouncement(null, () => ''), 'Ordinamento rimosso.');
});

test('tableMinWidth somma colonne e azioni', () => {
  assert.equal(tableMinWidth([100, 150], 72), 322);
});

test('splitMobileColumns: titolo, stato e al massimo 3 dati', () => {
  const columns = [
    { key: 'rata' },
    { key: 'scadenza' },
    { key: 'importo' },
    { key: 'stato', mobile: 'status' as const },
    { key: 'note' },
    { key: 'interno', mobile: 'hidden' as const },
    { key: 'altro' },
  ];
  const split = splitMobileColumns(columns);
  assert.equal(split.title?.key, 'rata');
  assert.equal(split.status?.key, 'stato');
  assert.deepEqual(split.details.map((c) => c.key), ['scadenza', 'importo', 'note']);
});

test('splitMobileColumns: le indicazioni esplicite hanno la precedenza', () => {
  const columns = [
    { key: 'a' },
    { key: 'b', mobile: 'title' as const },
    { key: 'c', mobile: 'detail' as const },
    { key: 'd' },
  ];
  const split = splitMobileColumns(columns);
  assert.equal(split.title?.key, 'b');
  assert.deepEqual(split.details.map((c) => c.key), ['c']);
  assert.equal(split.status, undefined);
});
