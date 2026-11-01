import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  descrizioneComunicazioni,
  estrattoCorpo,
  filtroNulloOppureIn,
  oggiIso,
  primoNome,
  residuo,
  riepilogoSpese,
  saluto,
  scadenzeHome,
  statoRata,
  titoloSaluto,
  type RataHome,
} from './homeLogic.ts';

const OGGI = '2026-11-01';
const rata = (id: string, dataScadenza: string, extra: Partial<RataHome> = {}): RataHome => ({
  id,
  descrizione: `Rata ${id}`,
  dataScadenza,
  importoDovuto: 100,
  importoPagato: 0,
  stato: 'DA_PAGARE',
  ...extra,
});

test('saluto in base all’ora', () => {
  assert.equal(saluto(new Date(2026, 10, 1, 4, 59)), 'Buonasera');
  assert.equal(saluto(new Date(2026, 10, 1, 5, 0)), 'Buongiorno');
  assert.equal(saluto(new Date(2026, 10, 1, 12, 59)), 'Buongiorno');
  assert.equal(saluto(new Date(2026, 10, 1, 13, 0)), 'Buon pomeriggio');
  assert.equal(saluto(new Date(2026, 10, 1, 17, 59)), 'Buon pomeriggio');
  assert.equal(saluto(new Date(2026, 10, 1, 18, 0)), 'Buonasera');
});

test('titolo con il nome del profilo, senza nome solo il saluto', () => {
  const mattina = new Date(2026, 10, 1, 9);
  assert.equal(titoloSaluto('Maria Rossi', mattina), 'Buongiorno, Maria!');
  assert.equal(titoloSaluto('  Maria  ', mattina), 'Buongiorno, Maria!');
  assert.equal(titoloSaluto(null, mattina), 'Buongiorno!');
  assert.equal(titoloSaluto('   ', mattina), 'Buongiorno!');
  assert.equal(primoNome(undefined), null);
});

test('oggiIso usa il giorno locale', () => {
  assert.equal(oggiIso(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('stato della rata', () => {
  assert.equal(statoRata(rata('a', '2026-10-31'), OGGI), 'scaduto');
  assert.equal(statoRata(rata('b', OGGI), OGGI), 'da-pagare');
  assert.equal(statoRata(rata('c', '2026-12-01', { stato: 'RITARDO' }), OGGI), 'scaduto');
  assert.equal(statoRata(rata('d', '2026-12-01', { importoPagato: 40 }), OGGI), 'in-corso');
  assert.equal(statoRata(rata('e', '2026-01-01', { stato: 'PAGATO', importoPagato: 100 }), OGGI), 'pagato');
});

test('residuo e totali: le pagate non contano, il pagato in parte si scala', () => {
  assert.equal(residuo(rata('a', OGGI, { importoPagato: 30.5 })), 69.5);
  assert.equal(residuo(rata('b', OGGI, { stato: 'PAGATO', importoPagato: 100 })), 0);
  const rate = [
    rata('1', '2026-10-01', { importoDovuto: 1000.1 }),
    rata('2', '2026-12-01', { importoDovuto: 320, importoPagato: 20 }),
    rata('3', '2026-12-15', { stato: 'PAGATO', importoDovuto: 500, importoPagato: 500 }),
  ];
  assert.deepEqual(riepilogoSpese(rate, OGGI), {
    totaleDaPagare: 1300.1,
    totaleScaduto: 1000.1,
    rateDaPagare: 2,
    rateScadute: 1,
  });
  assert.deepEqual(riepilogoSpese([], OGGI), { totaleDaPagare: 0, totaleScaduto: 0, rateDaPagare: 0, rateScadute: 0 });
});

test('scadenze: scadute prima e distinte, poi le future per data; le pagate passate restano fuori', () => {
  const rate = [
    rata('futura-tarda', '2027-02-01'),
    rata('scaduta-recente', '2026-10-20'),
    rata('pagata-passata', '2026-09-01', { stato: 'PAGATO', importoPagato: 100 }),
    rata('pagata-futura', '2026-11-20', { stato: 'PAGATO', importoPagato: 100 }),
    rata('scaduta-vecchia', '2026-08-01'),
    rata('futura-vicina', '2026-11-10'),
  ];
  const { scadute, prossime, nascoste } = scadenzeHome(rate, OGGI);
  assert.deepEqual(scadute.map((r) => r.id), ['scaduta-vecchia', 'scaduta-recente']);
  assert.deepEqual(prossime.map((r) => r.id), ['futura-vicina', 'pagata-futura', 'futura-tarda']);
  assert.equal(nascoste, 0);
});

test('scadenze: il limite taglia le future prima delle scadute e conta le nascoste', () => {
  const rate = [rata('s1', '2026-01-01'), rata('s2', '2026-02-01'), rata('f1', '2026-12-01'), rata('f2', '2026-12-02')];
  const { scadute, prossime, nascoste } = scadenzeHome(rate, OGGI, 3);
  assert.equal(scadute.length, 2);
  assert.deepEqual(prossime.map((r) => r.id), ['f1']);
  assert.equal(nascoste, 1);
});

test('estratto del corpo: una riga, taglio pulito', () => {
  assert.equal(estrattoCorpo(null), '');
  assert.equal(estrattoCorpo('  Ciao\n\n  a   tutti '), 'Ciao a tutti');
  const lungo = 'parola '.repeat(40);
  const estratto = estrattoCorpo(lungo, 30);
  assert.ok(estratto.endsWith('…'));
  assert.ok(estratto.length <= 31);
  assert.ok(!estratto.includes('parol…'));
});

test('descrizione delle comunicazioni e filtro PostgREST', () => {
  assert.equal(descrizioneComunicazioni(0), 'Non hai nuove comunicazioni');
  assert.equal(descrizioneComunicazioni(1), 'Nuova comunicazione');
  assert.equal(descrizioneComunicazioni(3), 'Nuove comunicazioni');
  const id = 'd0000000-0000-4000-8000-000000000011';
  assert.equal(filtroNulloOppureIn('unita_id', []), 'unita_id.is.null');
  assert.equal(filtroNulloOppureIn('unita_id', [id]), `unita_id.is.null,unita_id.in.(${id})`);
  // Un valore che non è un id non finisce mai nel filtro.
  assert.equal(filtroNulloOppureIn('unita_id', ['x),utente_id.not.is.null']), 'unita_id.is.null');
});
