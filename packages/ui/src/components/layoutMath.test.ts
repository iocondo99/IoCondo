import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow, placeMenu } from './layoutMath.ts';

test('pageWindow: poche pagine, le mostra tutte', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(3, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('pageWindow: vicino all’inizio, in mezzo e alla fine', () => {
  assert.deepEqual(pageWindow(2, 8), [1, 2, 3, 4, 5, 'end-ellipsis', 8]);
  assert.deepEqual(pageWindow(5, 12), [1, 'start-ellipsis', 4, 5, 6, 'end-ellipsis', 12]);
  assert.deepEqual(pageWindow(8, 8), [1, 'start-ellipsis', 4, 5, 6, 7, 8]);
});

test('pageWindow: stesso numero di voci su ogni pagina (i pulsanti non si spostano)', () => {
  for (let page = 1; page <= 20; page += 1) {
    assert.equal(pageWindow(page, 20).length, 7, `pagina ${page}`);
  }
});

const screen = { width: 1000, height: 800 };
const base = { screen, minWidth: 200, margin: 8, gap: 4, contentHeight: 240 };

test('placeMenu: si apre sotto il pulsante quando c’è posto', () => {
  const placement = placeMenu({ ...base, anchor: { x: 100, y: 100, width: 120, height: 48 }, align: 'start' });
  assert.equal(placement.upward, false);
  assert.deepEqual(placement.vertical, { top: 152 });
  assert.deepEqual(placement.horizontal, { left: 100 });
  assert.equal(placement.minWidth, 200);
});

test('placeMenu: sale sopra se sotto non c’è posto e sopra ce n’è di più', () => {
  const placement = placeMenu({ ...base, anchor: { x: 100, y: 700, width: 120, height: 48 }, align: 'start' });
  assert.equal(placement.upward, true);
  assert.deepEqual(placement.vertical, { bottom: 104 });
  assert.equal(placement.maxHeight, 700 - 4 - 8);
});

test('placeMenu: resta sotto (scorrevole) se sopra c’è ancora meno posto', () => {
  const placement = placeMenu({
    ...base,
    contentHeight: 900,
    anchor: { x: 100, y: 20, width: 120, height: 48 },
    align: 'start',
  });
  assert.equal(placement.upward, false);
  assert.equal(placement.maxHeight, 800 - 68 - 4 - 8);
});

test('placeMenu: non esce dai bordi della finestra', () => {
  const right = placeMenu({ ...base, anchor: { x: 950, y: 100, width: 40, height: 48 }, align: 'start' });
  assert.deepEqual(right.horizontal, { left: 1000 - 8 - 200 });
  const end = placeMenu({ ...base, anchor: { x: 10, y: 100, width: 40, height: 48 }, align: 'end' });
  assert.deepEqual(end.horizontal, { right: 1000 - 8 - 200 });
  const narrow = placeMenu({ ...base, screen: { width: 150, height: 800 }, anchor: { x: 0, y: 0, width: 40, height: 48 }, align: 'start' });
  assert.equal(narrow.maxWidth, 134);
  assert.equal(narrow.minWidth, 134);
});
