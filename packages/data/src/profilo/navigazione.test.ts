import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODULI_ATTIVI, type ModuliAttivi } from './moduli.ts';
import { navigazioneMobile, vociDi, voceAttiva, type ContestoNavigazione } from './navigazione.ts';

const tutti: ModuliAttivi = DEFAULT_MODULI_ATTIVI;
const ids = (voci: ReadonlyArray<{ id: string }>) => voci.map((v) => v.id);
const residente = (ruoli: Array<'CONDOMINO' | 'PORTIERE' | 'ADMIN'>, moduli = tutti): ContestoNavigazione => ({
  vista: 'RESIDENTE',
  ruoli: new Set(ruoli),
  moduli,
});

test('condòmino: voci complete, senza Fornitori né voci del portiere', () => {
  const voci = vociDi(residente(['CONDOMINO']));
  assert.deepEqual(ids(voci), [
    'home', 'spese', 'pagamenti', 'documenti', 'comunicazioni', 'assemblee', 'prenotazioni', 'raccolta-differenziata', 'segnalazioni', 'impostazioni', 'assistenza',
  ]);
  assert.ok(!ids(voci).includes('fornitori'));
});

test('portiere e condòmino: stesse voci più Registro pacchi e Ticket aree comuni', () => {
  const voci = vociDi(residente(['CONDOMINO', 'PORTIERE']));
  assert.deepEqual(ids(voci), [
    'home', 'spese', 'pagamenti', 'documenti', 'comunicazioni', 'assemblee', 'prenotazioni', 'raccolta-differenziata', 'segnalazioni', 'pacchi',
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
      residente(['CONDOMINO', 'PORTIERE'], {
        ...tutti,
        abilita_chat: false,
        abilita_bacheca: false,
        abilita_ticket: false,
        abilita_prenotazioni: false,
        abilita_pacchi: false,
        abilita_spese: false,
        abilita_pagamenti: false,
        abilita_documenti: false,
        abilita_assemblee: false,
        abilita_raccolta_differenziata: false,
      }),
    ),
  );
  assert.ok(!voci.includes('spese'));
  assert.ok(!voci.includes('pagamenti'));
  assert.ok(!voci.includes('documenti'));
  assert.ok(!voci.includes('comunicazioni'));
  assert.ok(!voci.includes('assemblee'));
  assert.ok(!voci.includes('prenotazioni'));
  assert.ok(!voci.includes('raccolta-differenziata'));
  assert.ok(!voci.includes('segnalazioni'));
  assert.ok(!voci.includes('pacchi'));
  assert.ok(!voci.includes('ticket-aree-comuni'));
  // Voci di sistema essenziali sempre visibili
  assert.ok(voci.includes('home'));
  assert.ok(voci.includes('impostazioni'));
  assert.ok(voci.includes('assistenza'));

  // Basta la bacheca o la chat per tenere Comunicazioni.
  const soloChat = ids(vociDi(residente(['CONDOMINO'], { ...tutti, abilita_bacheca: false })));
  assert.ok(soloChat.includes('comunicazioni'));
});

test('amministratore e super amministratore', () => {
  assert.deepEqual(ids(vociDi({ vista: 'ADMIN', ruoli: new Set(['ADMIN']), moduli: tutti })), [
    'dashboard', 'struttura', 'inviti', 'contabilita', 'manutenzione', 'comunicazioni', 'documenti', 'assemblee', 'prenotazioni', 'raccolta-differenziata', 'moduli', 'impostazioni', 'assistenza',
  ]);
  assert.deepEqual(ids(vociDi({ vista: 'SUPER_ADMIN', ruoli: new Set(), moduli: tutti })), [
    'amministratori', 'piani-abbonamenti', 'fatture', 'impostazioni',
  ]);
});

test('barra mobile: ricalcolo quando spese e comunicazioni sono spente', () => {
  const senzaSpese = vociDi(residente(['CONDOMINO'], { ...tutti, abilita_spese: false, abilita_chat: false, abilita_bacheca: false }));
  const { barra } = navigazioneMobile(senzaSpese, 'RESIDENTE');
  assert.ok(!barra.map((v) => v.id).includes('spese'));
  assert.ok(!barra.map((v) => v.id).includes('comunicazioni'));
  assert.equal(barra.length, 4);
  assert.deepEqual(barra.map((v) => v.id), ['home', 'pagamenti', 'documenti', 'segnalazioni']);
});

test('barra mobile: Home, Spese, Documenti, Messaggi e il resto in "Altro"', () => {
  const voci = vociDi(residente(['CONDOMINO']));
  const { barra, altre } = navigazioneMobile(voci, 'RESIDENTE');
  assert.deepEqual(barra.map((v) => v.label), ['Home', 'Spese', 'Documenti', 'Messaggi']);
  assert.deepEqual(ids(altre), ['pagamenti', 'assemblee', 'prenotazioni', 'raccolta-differenziata', 'segnalazioni', 'impostazioni', 'assistenza']);
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

test('amministratore e super amministratore: i moduli residenti spenti non alterano le voci admin', () => {
  const moduliTuttiSpenti: ModuliAttivi = {
    abilita_social: false,
    abilita_chat: false,
    abilita_bacheca: false,
    abilita_ticket: false,
    abilita_prenotazioni: false,
    abilita_pacchi: false,
    abilita_spese: false,
    abilita_pagamenti: false,
    abilita_documenti: false,
    abilita_assemblee: false,
    abilita_raccolta_differenziata: false,
  };
  // Sull'admin tutte le sezioni di gestione rimangono accessibili per configurazione o archivio
  const adminVoci = ids(vociDi({ vista: 'ADMIN', ruoli: new Set(['ADMIN']), moduli: moduliTuttiSpenti }));
  assert.ok(adminVoci.includes('moduli'));
  assert.ok(adminVoci.includes('dashboard'));
  assert.ok(adminVoci.includes('contabilita'));
  assert.ok(adminVoci.includes('manutenzione'));
  assert.ok(adminVoci.includes('comunicazioni'));
  assert.ok(adminVoci.includes('documenti'));
  assert.ok(adminVoci.includes('assemblee'));
  assert.ok(adminVoci.includes('prenotazioni'));
  assert.ok(adminVoci.includes('raccolta-differenziata'));
});

test('barra mobile: ricalcolo con tutte le 5 voci prioritarie spente (spese, documenti, comunicazioni, pacchi, segnalazioni)', () => {
  const senzaPrioritarie = vociDi(
    residente(['CONDOMINO', 'PORTIERE'], {
      ...tutti,
      abilita_spese: false,
      abilita_documenti: false,
      abilita_chat: false,
      abilita_bacheca: false,
      abilita_pacchi: false,
      abilita_ticket: false,
    }),
  );
  const { barra, altre } = navigazioneMobile(senzaPrioritarie, 'RESIDENTE');
  // Le 4 voci subentrate devono essere le successive in ordine di vociDi: home, pagamenti, assemblee, prenotazioni
  assert.deepEqual(barra.map((v) => v.id), ['home', 'pagamenti', 'assemblee', 'prenotazioni']);
  assert.equal(barra.length, 4);
  // Altre contiene il resto: raccolta-differenziata, impostazioni, assistenza
  assert.deepEqual(ids(altre), ['raccolta-differenziata', 'impostazioni', 'assistenza']);
});

test('barra mobile: caso limite con <= 4 voci attive totali (nessuna voce "Altro")', () => {
  const quasiTuttoSpento = vociDi(
    residente(['CONDOMINO'], {
      abilita_social: false,
      abilita_chat: false,
      abilita_bacheca: false,
      abilita_ticket: false,
      abilita_prenotazioni: false,
      abilita_pacchi: false,
      abilita_spese: false,
      abilita_pagamenti: false,
      abilita_documenti: false,
      abilita_assemblee: false,
      abilita_raccolta_differenziata: false,
    }),
  );
  // Rimangono solo: home, impostazioni, assistenza (3 voci)
  assert.deepEqual(ids(quasiTuttoSpento), ['home', 'impostazioni', 'assistenza']);
  const { barra, altre } = navigazioneMobile(quasiTuttoSpento, 'RESIDENTE');
  assert.equal(barra.length, 3);
  assert.deepEqual(barra.map((v) => v.id), ['home', 'impostazioni', 'assistenza']);
  assert.deepEqual(altre, [], 'quando le voci totali sono <= 4, altre deve essere un array vuoto');
});

test('ibrido condòmino + portiere: combinazione toggle parziali', () => {
  const ibrido = vociDi(
    residente(['CONDOMINO', 'PORTIERE'], {
      ...tutti,
      abilita_pacchi: false,
      abilita_ticket: false,
      abilita_prenotazioni: false,
    }),
  );
  const vociIbrido = ids(ibrido);
  // Pacchi e prenotazioni spenti
  assert.ok(!vociIbrido.includes('pacchi'));
  assert.ok(!vociIbrido.includes('prenotazioni'));
  // Con abilita_ticket = false sia le segnalazioni private sia i ticket aree comuni sono spenti
  assert.ok(!vociIbrido.includes('segnalazioni'));
  assert.ok(!vociIbrido.includes('ticket-aree-comuni'));
  // Altre sezioni attive
  assert.ok(vociIbrido.includes('spese'));
  assert.ok(vociIbrido.includes('pagamenti'));
  assert.ok(vociIbrido.includes('documenti'));
  assert.ok(vociIbrido.includes('comunicazioni'));
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
