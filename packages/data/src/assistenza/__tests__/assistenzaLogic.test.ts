import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NUMERI_NAZIONALI_EMERGENZA,
  componiNumeriEmergenza,
  costruisciContattiAmministrazione,
  type FornitoreEmergenzaRaw,
  type PolizzaFabbricato,
} from '../assistenzaLogic.ts';

test('componiNumeriEmergenza: fornitori custom per ascensore e guasti, polizza fabbricato e 112', () => {
  const fornitori: FornitoreEmergenzaRaw[] = [
    {
      id: 'f-asc',
      ragione_sociale: 'Ascensori Express',
      telefono: '+39 02 887766',
      categoria: 'Ascensore',
    },
    {
      id: 'f-idr',
      ragione_sociale: 'Pronto Idraulico 24',
      telefono: '+39 02 112233',
      categoria: 'Idraulico',
    },
  ];

  const polizza: PolizzaFabbricato = {
    id: 'pol-1',
    compagnia: 'Generali Assicurazioni',
    numeroPolizza: 'GEN-2026-001',
    premioAnnuo: 3200,
    dataScadenza: '2026-12-31',
    docId: null,
  };

  const numeri = componiNumeriEmergenza(fornitori, polizza);

  // Deve contenere ascensore custom
  const asc = numeri.find((n) => n.categoria === 'ascensore');
  assert.ok(asc);
  assert.equal(asc.numero, '+39 02 887766');
  assert.ok(asc.titolo.includes('Ascensori Express'));

  // Deve contenere guasti custom
  const guasti = numeri.find((n) => n.categoria === 'guasti');
  assert.ok(guasti);
  assert.equal(guasti.numero, '+39 02 112233');

  // Deve contenere centrale sinistri polizza
  const ass = numeri.find((n) => n.categoria === 'assicurazione');
  assert.ok(ass);
  assert.ok(ass.titolo.includes('Generali Assicurazioni'));

  // Deve contenere numeri 112 e 115
  assert.ok(numeri.some((n) => n.numero === '112'));
  assert.ok(numeri.some((n) => n.numero === '115'));
});

test('componiNumeriEmergenza: fallback di default quando non ci sono fornitori né polizza', () => {
  const numeri = componiNumeriEmergenza([], null);

  const asc = numeri.find((n) => n.categoria === 'ascensore');
  assert.ok(asc);
  assert.equal(asc.numero, '800 123 456');

  const guasti = numeri.find((n) => n.categoria === 'guasti');
  assert.ok(guasti);
  assert.equal(guasti.numero, '+39 06 998877');

  // Nessuna polizza -> nessuna voce assicurazione
  assert.equal(numeri.some((n) => n.categoria === 'assicurazione'), false);

  // Numeri nazionali sempre presenti
  assert.equal(numeri.filter((n) => n.categoria === 'emergenza').length, NUMERI_NAZIONALI_EMERGENZA.length);
});

test('costruisciContattiAmministrazione: compone contatti con dati completi o fallback', () => {
  const completo = costruisciContattiAmministrazione({
    condominioNome: 'Condominio Roma Appia',
    indirizzoCondominio: 'Via Appia Nuova 120',
    cittaCondominio: 'Roma',
    adminNome: 'Giulia Ferretti',
    adminEmail: 'giulia.ferretti@studioferretti.it',
    adminTelefono: '+39 06 5550202',
  });

  assert.equal(completo.amministratore, 'Giulia Ferretti');
  assert.equal(completo.nomeStudio, 'Studio Giulia Ferretti');
  assert.equal(completo.email, 'giulia.ferretti@studioferretti.it');
  assert.equal(completo.telefono, '+39 06 5550202');
  assert.equal(completo.indirizzoStudio, 'Via Appia Nuova 120, Roma');

  const fallback = costruisciContattiAmministrazione({
    condominioNome: 'Condominio Senza Indirizzo',
  });

  assert.equal(fallback.amministratore, 'Amministratore di Condominio');
  assert.equal(fallback.nomeStudio, 'Studio Amministratore di Condominio');
  assert.equal(fallback.email, 'amministrazione@iocondo.it');
  assert.equal(fallback.indirizzoStudio, 'Presso la sede del Condominio');
});

