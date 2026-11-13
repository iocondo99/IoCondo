import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigazioneMobile, vociDi, type ContestoNavigazione } from './navigazione.ts';
import { DEFAULT_MODULI_ATTIVI, type ModuliAttivi } from './moduli.ts';

const tuttiModuli: ModuliAttivi = {
  ...DEFAULT_MODULI_ATTIVI,
};

const portierePuroContesto: ContestoNavigazione = {
  vista: 'RESIDENTE',
  ruoli: new Set(['PORTIERE']),
  moduli: tuttiModuli,
};

test('Portiere puro — navigazione desktop: voci attese senza voci contabili né private', () => {
  const voci = vociDi(portierePuroContesto);
  const ids = voci.map((v) => v.id);

  // Voci che DEVONO essere presenti
  assert.ok(ids.includes('home'), 'Home deve essere presente');
  assert.ok(ids.includes('documenti'), 'Documenti deve essere presente');
  assert.ok(ids.includes('comunicazioni'), 'Comunicazioni deve essere presente');
  assert.ok(ids.includes('assemblee'), 'Assemblee deve essere presente');
  assert.ok(ids.includes('pacchi'), 'Registro pacchi deve essere presente');
  assert.ok(ids.includes('segnalazioni'), 'Segnalazioni deve essere presente');
  assert.ok(ids.includes('impostazioni'), 'Impostazioni deve essere presente');
  assert.ok(ids.includes('assistenza'), 'Assistenza deve essere presente');

  // Voci che NON devono essere presenti per un portiere puro
  assert.ok(!ids.includes('spese'), 'Spese NON deve essere presente per il portiere puro');
  assert.ok(!ids.includes('pagamenti'), 'Pagamenti NON deve essere presente per il portiere puro');
  assert.ok(!ids.includes('ticket-aree-comuni'), 'Ticket aree comuni non deve più esistere');
});

test('Portiere puro — barra mobile: Registro pacchi promosso direttamente nella barra a 4 voci', () => {
  const voci = vociDi(portierePuroContesto);
  const mobile = navigazioneMobile(voci, 'RESIDENTE');
  const idsBarra = mobile.barra.map((v) => v.id);

  console.log('Voci barra mobile portiere puro:', idsBarra);
  assert.ok(idsBarra.includes('home'), 'Home nella barra mobile');
  assert.ok(idsBarra.includes('documenti'), 'Documenti nella barra mobile');
  assert.ok(idsBarra.includes('comunicazioni'), 'Messaggi nella barra mobile');
  assert.ok(idsBarra.includes('pacchi'), 'Registro pacchi deve essere direttamente nella barra mobile a 4 voci');
  assert.ok(!idsBarra.includes('spese'), 'Spese assente dalla barra mobile');
});
