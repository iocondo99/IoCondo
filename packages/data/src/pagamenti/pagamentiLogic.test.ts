/**
 * Test della logica di Pagamenti (node --test, senza dipendenze da React o Supabase).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RataHome } from '../home/homeLogic.ts';
import {
  OPZIONI_STATO,
  PER_PAGINA_DEFAULT,
  colonnaDaOrdine,
  descrizioneMillesimi,
  descrizioneProssima,
  etichettaRata,
  filtraPerRicerca,
  filtraPerStato,
  filtriAttivi,
  filtroRateMie,
  limitaPagina,
  numeroPagine,
  ordinaRate,
  ordineDaColonna,
  paginaPagamenti,
  percorsoBollettino,
  preparaRate,
  rataAppartieneA,
  riepilogoPagamenti,
  sottotitoloPagamenti,
} from './pagamentiLogic.ts';

const OGGI = '2026-11-02';

const rata = (id: string, dataScadenza: string, extra: Partial<RataHome> = {}): RataHome => ({
  id,
  descrizione: `Rata ${id}`,
  dataScadenza,
  importoDovuto: 200,
  importoPagato: 0,
  stato: 'DA_PAGARE',
  ...extra,
});

const viste = (rate: RataHome[]) => preparaRate(rate, OGGI);
const ids = (rate: readonly { id: string }[]) => rate.map((r) => r.id);

// ─── filtraPerStato ───────────────────────────────────────────────────────────

test('filtraPerStato tutti: restituisce tutte le rate', () => {
  const rate = viste([
    rata('a', '2026-10-01'),
    rata('b', '2026-12-01'),
    rata('c', '2026-12-01', { stato: 'PAGATO', importoPagato: 200 }),
  ]);
  assert.equal(filtraPerStato(rate, 'tutti').length, 3);
});

test('filtraPerStato da-pagare: include in-corso, esclude scadute e pagate', () => {
  const rate = viste([
    rata('a', '2026-12-01'), // da-pagare
    rata('b', '2026-12-01', { importoPagato: 50 }), // in-corso
    rata('c', '2026-10-01'), // scaduto
    rata('d', '2026-12-01', { stato: 'PAGATO', importoPagato: 200 }), // pagato
  ]);
  const risultato = filtraPerStato(rate, 'da-pagare');
  assert.deepEqual(ids(risultato), ['a', 'b']);
});

test('filtraPerStato scaduti: anche una rata RITARDO con scadenza futura', () => {
  const rate = viste([rata('a', '2026-10-01'), rata('b', '2026-12-01'), rata('c', '2026-12-01', { stato: 'RITARDO' })]);
  assert.deepEqual(ids(filtraPerStato(rate, 'scaduti')), ['a', 'c']);
});

test('filtraPerStato pagati', () => {
  const rate = viste([rata('a', '2026-12-01', { stato: 'PAGATO', importoPagato: 200 }), rata('b', '2026-12-01')]);
  assert.deepEqual(ids(filtraPerStato(rate, 'pagati')), ['a']);
});

// ─── filtraPerRicerca e filtriAttivi ──────────────────────────────────────────

test('filtraPerRicerca case-insensitive', () => {
  const rate = viste([
    rata('a', '2026-12-01'),
    { ...rata('b', '2026-12-01'), descrizione: 'Manutenzione ascensore' },
    { ...rata('c', '2026-12-01'), descrizione: 'Quote ordinarie aprile' },
  ]);
  assert.deepEqual(ids(filtraPerRicerca(rate, 'QUOTE')), ['c']);
});

test('filtraPerRicerca stringa vuota o di soli spazi: restituisce tutto', () => {
  const rate = viste([rata('a', '2026-12-01'), rata('b', '2026-12-01')]);
  assert.equal(filtraPerRicerca(rate, '   ').length, 2);
});

test('filtriAttivi conta stato e ricerca', () => {
  assert.equal(filtriAttivi({ stato: 'tutti', ricerca: '' }), 0);
  assert.equal(filtriAttivi({ stato: 'tutti', ricerca: '  ' }), 0);
  assert.equal(filtriAttivi({ stato: 'scaduti', ricerca: '' }), 1);
  assert.equal(filtriAttivi({ stato: 'pagati', ricerca: 'tetto' }), 2);
});

// ─── ordinaRate ──────────────────────────────────────────────────────────────

test('ordinaRate predefinito: scadute prima (la più vecchia in cima), poi per data crescente', () => {
  const rate = viste([
    rata('a', '2026-12-01'), // futura
    rata('b', '2026-10-01'), // scaduta, più vecchia
    rata('c', '2026-11-15'), // futura, più vicina
    rata('d', '2026-10-20'), // scaduta
  ]);
  assert.deepEqual(ids(ordinaRate(rate, 'predefinito')), ['b', 'd', 'c', 'a']);
});

test('ordinaRate predefinito: una pagata non scaduta sta tra le future, per data', () => {
  const rate = viste([
    rata('a', '2026-12-01'),
    rata('p', '2026-09-01', { stato: 'PAGATO', importoPagato: 200 }), // pagata in passato: non è "scaduta"
    rata('s', '2026-10-01'),
  ]);
  assert.deepEqual(ids(ordinaRate(rate, 'predefinito')), ['s', 'p', 'a']);
});

test('ordinaRate scadenza-asc e scadenza-desc: solo per data', () => {
  const rate = viste([rata('a', '2026-12-01'), rata('b', '2026-10-01'), rata('c', '2026-11-15')]);
  assert.deepEqual(ids(ordinaRate(rate, 'scadenza-asc')), ['b', 'c', 'a']);
  assert.deepEqual(ids(ordinaRate(rate, 'scadenza-desc')), ['a', 'c', 'b']);
});

test("ordinaRate importo: segue l'importo dovuto mostrato, non il residuo", () => {
  const rate = viste([
    rata('a', '2026-12-01', { importoDovuto: 100 }),
    rata('b', '2026-12-01', { importoDovuto: 300, importoPagato: 290 }), // residuo 10, ma dovuto 300
    rata('c', '2026-12-01', { importoDovuto: 200 }),
  ]);
  assert.deepEqual(ids(ordinaRate(rate, 'importo-desc')), ['b', 'c', 'a']);
  assert.deepEqual(ids(ordinaRate(rate, 'importo-asc')), ['a', 'c', 'b']);
});

test("ordinaRate: a parità di valore l'ordine è stabile (descrizione, poi id) e non modifica l'originale", () => {
  const rate = viste([rata('b', '2026-12-01'), rata('a', '2026-12-01'), rata('c', '2026-12-01')]);
  const prima = ids(rate);
  assert.deepEqual(ids(ordinaRate(rate, 'importo-asc')), ['a', 'b', 'c']);
  assert.deepEqual(ids(rate), prima);
});

test('ordineDaColonna e colonnaDaOrdine sono uno l’inverso dell’altro', () => {
  assert.equal(ordineDaColonna(null), 'predefinito');
  assert.equal(ordineDaColonna({ key: 'scadenza', direction: 'ascending' }), 'scadenza-asc');
  assert.equal(ordineDaColonna({ key: 'scadenza', direction: 'descending' }), 'scadenza-desc');
  assert.equal(ordineDaColonna({ key: 'dovuto', direction: 'ascending' }), 'importo-asc');
  assert.equal(ordineDaColonna({ key: 'dovuto', direction: 'descending' }), 'importo-desc');
  assert.equal(ordineDaColonna({ key: 'altro', direction: 'ascending' }), 'predefinito');
  assert.equal(colonnaDaOrdine('predefinito'), null);
  for (const ordine of ['scadenza-asc', 'scadenza-desc', 'importo-asc', 'importo-desc'] as const) {
    assert.equal(ordineDaColonna(colonnaDaOrdine(ordine)), ordine);
  }
});

// ─── riepilogoPagamenti ───────────────────────────────────────────────────────

test('riepilogoPagamenti: totale da pagare, scaduto e prossima scadenza', () => {
  const rate = viste([
    rata('a', '2026-10-01'), // scaduta: 200
    rata('b', '2026-12-01'), // da pagare: 200
    rata('c', '2026-12-01', { stato: 'PAGATO', importoPagato: 200 }), // pagata: 0
    rata('d', '2026-11-20', { importoDovuto: 150, importoPagato: 50 }), // in corso: 100
  ]);
  const r = riepilogoPagamenti(rate, OGGI);
  assert.equal(r.totaleDaPagare, 500);
  assert.equal(r.totaleScaduto, 200);
  assert.equal(r.prossima, '2026-11-20');
});

test('riepilogoPagamenti: la prossima scadenza non è mai una rata scaduta o pagata', () => {
  const rate = viste([
    rata('a', '2026-10-01'),
    rata('b', '2026-11-05', { stato: 'PAGATO', importoPagato: 200 }),
  ]);
  assert.equal(riepilogoPagamenti(rate, OGGI).prossima, null);
});

test('riepilogoPagamenti: tutto pagato → totali zero, prossima null; elenco vuoto uguale', () => {
  const pagata = viste([rata('a', '2026-10-01', { stato: 'PAGATO', importoPagato: 200 })]);
  assert.deepEqual(riepilogoPagamenti(pagata, OGGI), { totaleDaPagare: 0, totaleScaduto: 0, prossima: null });
  assert.deepEqual(riepilogoPagamenti([], OGGI), { totaleDaPagare: 0, totaleScaduto: 0, prossima: null });
});

test('riepilogoPagamenti: somma con i centesimi senza errori di arrotondamento', () => {
  const rate = viste([
    rata('a', '2026-12-01', { importoDovuto: 0.1 }),
    rata('b', '2026-12-02', { importoDovuto: 0.2 }),
    rata('c', '2026-12-03', { importoDovuto: 215.5 }),
  ]);
  assert.equal(riepilogoPagamenti(rate, OGGI).totaleDaPagare, 215.8);
});

// ─── paginazione ─────────────────────────────────────────────────────────────

test('paginaPagamenti: pagina oltre il totale riportata all’ultima', () => {
  const rate = viste(Array.from({ length: 15 }, (_, i) => rata(String(i).padStart(2, '0'), '2026-12-01')));
  const r = paginaPagamenti(rate, { stato: 'tutti', ricerca: '' }, 'predefinito', 99, 10);
  assert.equal(r.numeroPagine, 2);
  assert.equal(r.pagina, 2);
  assert.equal(r.rate.length, 5);
  assert.equal(r.totaleFiltrati, 15);
});

test(`paginaPagamenti: PER_PAGINA_DEFAULT è ${PER_PAGINA_DEFAULT}`, () => {
  const rate = viste(Array.from({ length: 25 }, (_, i) => rata(String(i), '2026-12-01')));
  const r = paginaPagamenti(rate, { stato: 'tutti', ricerca: '' }, 'predefinito', 1);
  assert.equal(r.rate.length, PER_PAGINA_DEFAULT);
  assert.equal(r.numeroPagine, 3);
});

test('paginaPagamenti: filtri e ricerca insieme, poi ordine e pagina', () => {
  const rate = viste([
    { ...rata('a', '2026-12-01'), descrizione: 'Tetto, prima rata' },
    { ...rata('b', '2026-10-01'), descrizione: 'Tetto, seconda rata' },
    { ...rata('c', '2026-12-05'), descrizione: 'Ascensore' },
  ]);
  const r = paginaPagamenti(rate, { stato: 'da-pagare', ricerca: 'tetto' }, 'scadenza-desc', 1);
  assert.deepEqual(ids(r.rate), ['a']);
  assert.equal(r.totaleFiltrati, 1);
});

test('paginaPagamenti: lista vuota → 1 pagina, 0 rate', () => {
  const r = paginaPagamenti([], { stato: 'tutti', ricerca: '' }, 'predefinito', 1);
  assert.equal(r.numeroPagine, 1);
  assert.equal(r.rate.length, 0);
  assert.equal(r.pagina, 1);
});

test('numeroPagine: minimo 1 anche per lista vuota', () => {
  assert.equal(numeroPagine(0, 10), 1);
  assert.equal(numeroPagine(10, 10), 1);
  assert.equal(numeroPagine(11, 10), 2);
});

test('limitaPagina: dentro 1..totale, anche con valori strani', () => {
  assert.equal(limitaPagina(0, 3), 1);
  assert.equal(limitaPagina(-4, 3), 1);
  assert.equal(limitaPagina(2, 3), 2);
  assert.equal(limitaPagina(9, 3), 3);
  assert.equal(limitaPagina(Number.NaN, 3), 1);
  assert.equal(limitaPagina(2, 0), 1);
});

// ─── di chi è una rata ───────────────────────────────────────────────────────

test('rataAppartieneA: debitore, rata senza debitore su una mia unità, rata di un altro', () => {
  const mie = ['u1', 'u2'];
  assert.equal(rataAppartieneA({ utenteId: 'io', unitaId: 'u9' }, 'io', mie), true);
  assert.equal(rataAppartieneA({ utenteId: null, unitaId: 'u2' }, 'io', mie), true);
  assert.equal(rataAppartieneA({ utenteId: null, unitaId: 'u9' }, 'io', mie), false);
  assert.equal(rataAppartieneA({ utenteId: 'altro', unitaId: 'u1' }, 'io', mie), false);
  assert.equal(rataAppartieneA({ utenteId: null, unitaId: 'u1' }, 'io', []), false);
});

test('filtroRateMie: con e senza unità', () => {
  assert.equal(filtroRateMie('io', []), 'utente_id.eq.io');
  assert.equal(filtroRateMie('io', ['u1', 'u2']), 'utente_id.eq.io,and(utente_id.is.null,unita_id.in.(u1,u2))');
});

// ─── bollettino ──────────────────────────────────────────────────────────────

test('percorsoBollettino: accetta solo percorsi relativi a un PDF', () => {
  assert.deepEqual(percorsoBollettino('c1/u1/bollettino_q2.pdf'), { cartella: 'c1/u1', nome: 'bollettino_q2.pdf' });
  assert.deepEqual(percorsoBollettino(' c1/u1/BOLLETTINO.PDF '), { cartella: 'c1/u1', nome: 'BOLLETTINO.PDF' });
  assert.deepEqual(percorsoBollettino('solo.pdf'), { cartella: '', nome: 'solo.pdf' });
});

test('percorsoBollettino: rifiuta null, vuoto, URL, percorsi assoluti o con "..", e file che non sono PDF', () => {
  for (const non of [null, undefined, '', '   ', 'https://esempio.it/a.pdf', '/c1/u1/a.pdf', 'c1/../u2/a.pdf', 'c1//a.pdf', 'c1/./a.pdf', 'c1/u1/', 'c1/u1/foto.png']) {
    assert.equal(percorsoBollettino(non as string | null | undefined), null, String(non));
  }
});

// ─── millesimi e testi ───────────────────────────────────────────────────────

test('descrizioneMillesimi: formato italiano', () => {
  assert.equal(descrizioneMillesimi(125.5, 1000), '125,5 su 1.000');
  assert.equal(descrizioneMillesimi(80, 1000), '80 su 1.000');
});

test('sottotitoloPagamenti con e senza nome', () => {
  assert.equal(sottotitoloPagamenti('Via dei Test'), 'Via dei Test — le tue rate');
  assert.equal(sottotitoloPagamenti(null), 'Le tue rate');
});

test('descrizioneProssima: oggi, domani, giorni, lontana, nessuna', () => {
  assert.equal(descrizioneProssima(OGGI, OGGI), 'Scade oggi');
  assert.equal(descrizioneProssima(OGGI, '2026-11-03'), 'Scade domani');
  assert.equal(descrizioneProssima(OGGI, '2026-11-07'), 'Scade tra 5 giorni');
  assert.equal(descrizioneProssima(OGGI, '2026-12-01'), 'Prossima scadenza');
  assert.equal(descrizioneProssima(OGGI, null), 'Nessuna rata in scadenza');
});

test('etichettaRata con descrizione e senza', () => {
  assert.equal(etichettaRata(rata('a', '2026-12-01')), 'Rata a');
  assert.equal(etichettaRata({ ...rata('a', '2026-12-01'), descrizione: '' }), 'Rata del 2026-12-01');
});

test('OPZIONI_STATO: i tre filtri, senza "Tutti" (lo aggiunge FilterChips)', () => {
  assert.deepEqual(
    OPZIONI_STATO.map((o) => o.value),
    ['da-pagare', 'pagati', 'scaduti'],
  );
});
