import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigazioneMobile, vociDi, voceAttiva, type ContestoNavigazione } from './navigazione.ts';

const tutti = { abilita_chat: true, abilita_bacheca: true, abilita_ticket: true, abilita_pacchi: true };
const ids = (voci: ReadonlyArray<{ id: string }>) => voci.map((v) => v.id);
const residente = (ruoli: Array<'CONDOMINO' | 'PORTIERE' | 'ADMIN'>, moduli = tutti): ContestoNavigazione => ({
  vista: 'RESIDENTE',
  ruoli: new Set(ruoli),
  moduli,
});

test('condòmino: voci complete, senza Fornitori né voci del portiere', () => {
  const voci = vociDi(residente(['CONDOMINO']));
  assert.deepEqual(ids(voci), [
    'home', 'spese', 'pagamenti', 'documenti', 'comunicazioni', 'assemblee', 'raccolta-differenziata', 'segnalazioni', 'impostazioni', 'assistenza',
  ]);
  assert.ok(!ids(voci).includes('fornitori'));
});

test('portiere e condòmino: stesse voci più Registro pacchi e Ticket aree comuni', () => {
  const voci = vociDi(residente(['CONDOMINO', 'PORTIERE']));
  assert.deepEqual(ids(voci), [
    'home', 'spese', 'pagamenti', 'documenti', 'comunicazioni', 'assemblee', 'raccolta-differenziata', 'segnalazioni', 'pacchi',
    'ticket-aree-comuni', 'impostazioni', 'assistenza',
  ]);
});

test('solo portiere: nessuna voce contabile né segnalazioni private condòmino', () => {
  const voci = ids(vociDi(residente(['PORTIERE'])));
  assert.ok(!voci.includes('spese'));
  assert.ok(!voci.includes('pagamenti'));
  assert.ok(!voci.includes('segnalazioni'));
  assert.ok(voci.includes('pacchi'));
  assert.ok(voci.includes('ticket-aree-comuni'));
});

test('i moduli disattivati nascondono le voci collegate', () => {
  const voci = ids(
    vociDi(
      residente(['CONDOMINO', 'PORTIERE'], { abilita_chat: false, abilita_bacheca: false, abilita_ticket: false, abilita_pacchi: false }),
    ),
  );
  assert.ok(!voci.includes('comunicazioni'));
  assert.ok(!voci.includes('segnalazioni'));
  assert.ok(!voci.includes('pacchi'));
  assert.ok(!voci.includes('ticket-aree-comuni'));
  // Basta la bacheca o la chat per tenere Comunicazioni.
  const soloChat = ids(vociDi(residente(['CONDOMINO'], { ...tutti, abilita_bacheca: false })));
  assert.ok(soloChat.includes('comunicazioni'));
});

test('amministratore e super amministratore', () => {
  assert.deepEqual(ids(vociDi({ vista: 'ADMIN', ruoli: new Set(['ADMIN']), moduli: tutti })), [
    'dashboard', 'struttura', 'inviti', 'contabilita', 'manutenzione', 'comunicazioni', 'documenti', 'assemblee', 'raccolta-differenziata', 'impostazioni', 'assistenza',
  ]);
  assert.deepEqual(ids(vociDi({ vista: 'SUPER_ADMIN', ruoli: new Set(), moduli: tutti })), [
    'amministratori', 'piani-abbonamenti', 'fatture', 'impostazioni',
  ]);
});

test('barra mobile: Home, Spese, Documenti, Messaggi e il resto in "Altro"', () => {
  const voci = vociDi(residente(['CONDOMINO']));
  const { barra, altre } = navigazioneMobile(voci, 'RESIDENTE');
  assert.deepEqual(barra.map((v) => v.label), ['Home', 'Spese', 'Documenti', 'Messaggi']);
  assert.deepEqual(ids(altre), ['pagamenti', 'assemblee', 'raccolta-differenziata', 'segnalazioni', 'impostazioni', 'assistenza']);
  assert.equal(barra.length + altre.length, voci.length);
});

test('barra mobile: se mancano voci si passa alle successive; con 4 voci niente "Altro"', () => {
  const portiere = vociDi(residente(['PORTIERE']));
  assert.deepEqual(ids(navigazioneMobile(portiere, 'RESIDENTE').barra), ['home', 'documenti', 'comunicazioni', 'pacchi']);
  const admin = vociDi({ vista: 'ADMIN', ruoli: new Set(['ADMIN']), moduli: tutti });
  assert.deepEqual(ids(navigazioneMobile(admin, 'ADMIN').barra), ['dashboard', 'contabilita', 'comunicazioni', 'documenti']);
  const superVoci = vociDi({ vista: 'SUPER_ADMIN', ruoli: new Set(), moduli: tutti });
  const mobile = navigazioneMobile(superVoci, 'SUPER_ADMIN');
  assert.equal(mobile.barra.length, 4);
  assert.deepEqual(mobile.altre, []);
});

test('voceAttiva: percorso esatto o pagina di dettaglio', () => {
  const voci = vociDi(residente(['CONDOMINO']));
  assert.equal(voceAttiva(voci, '/spese')?.id, 'spese');
  assert.equal(voceAttiva(voci, '/spese/123')?.id, 'spese');
  assert.equal(voceAttiva(voci, '/spese-altro'), undefined);
  assert.equal(voceAttiva(voci, '/home?x=1')?.id, 'home');
  assert.equal(voceAttiva(voci, '/raccolta-differenziata')?.id, 'raccolta-differenziata');
  assert.equal(voceAttiva(voci, '/altro'), undefined);
  const adminVoci = vociDi({ vista: 'ADMIN', ruoli: new Set(['ADMIN']), moduli: tutti });
  assert.equal(voceAttiva(adminVoci, '/admin/raccolta-differenziata')?.id, 'raccolta-differenziata');
});
