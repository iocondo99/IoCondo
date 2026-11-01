import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  etichettaVista,
  homeDi,
  nomeVisibile,
  risolviAssegnazioni,
  ruoliIn,
  scegliCondominio,
  scegliVista,
  senzaRuoli,
  vistePossibili,
  type ProfiloUtente,
} from './profiloLogic.ts';

const condominio = (id: string, nome: string) => ({ id, nome, indirizzo: null, citta: null });

const base: ProfiloUtente = {
  id: 'u1',
  email: 'a@esempio.invalid',
  nome: null,
  avatarUrl: null,
  isSuperAdmin: false,
  condomini: [],
  assegnazioni: [],
};

test('risolviAssegnazioni: condominio diretto, da unità, amministrato, senza doppioni', () => {
  const risultato = risolviAssegnazioni(
    [
      { ruolo: 'CONDOMINO', condominioId: null, unitaId: 'unita-1' },
      { ruolo: 'PORTIERE', condominioId: 'c1', unitaId: null },
      { ruolo: 'ADMIN', condominioId: 'c1', unitaId: null },
      { ruolo: 'CONDOMINO', condominioId: null, unitaId: 'unita-sconosciuta' },
    ],
    { 'unita-1': 'c2' },
    ['c1', 'c3'],
  );
  assert.deepEqual(risultato, [
    { ruolo: 'CONDOMINO', condominioId: 'c2' },
    { ruolo: 'PORTIERE', condominioId: 'c1' },
    { ruolo: 'ADMIN', condominioId: 'c1' },
    { ruolo: 'ADMIN', condominioId: 'c3' },
  ]);
});

test('senzaRuoli: serve almeno un condominio oppure il flag super amministratore', () => {
  assert.equal(senzaRuoli(base), true);
  assert.equal(senzaRuoli({ ...base, isSuperAdmin: true }), false);
  assert.equal(senzaRuoli({ ...base, condomini: [condominio('c1', 'A')] }), false);
});

test('vistePossibili: admin, residente e super amministratore', () => {
  const profilo: ProfiloUtente = {
    ...base,
    isSuperAdmin: true,
    condomini: [condominio('c1', 'A'), condominio('c2', 'B')],
    assegnazioni: [
      { ruolo: 'ADMIN', condominioId: 'c1' },
      { ruolo: 'CONDOMINO', condominioId: 'c1' },
      { ruolo: 'PORTIERE', condominioId: 'c2' },
    ],
  };
  assert.deepEqual(vistePossibili(profilo, 'c1'), ['ADMIN', 'RESIDENTE', 'SUPER_ADMIN']);
  assert.deepEqual(vistePossibili(profilo, 'c2'), ['RESIDENTE', 'SUPER_ADMIN']);
  assert.deepEqual(vistePossibili(profilo, null), ['SUPER_ADMIN']);
  assert.deepEqual([...ruoliIn(profilo, 'c1')].sort(), ['ADMIN', 'CONDOMINO']);
});

test('scegliVista e scegliCondominio: la preferenza vale solo se è ancora disponibile', () => {
  const profilo: ProfiloUtente = {
    ...base,
    condomini: [condominio('c1', 'A'), condominio('c2', 'B')],
    assegnazioni: [
      { ruolo: 'ADMIN', condominioId: 'c1' },
      { ruolo: 'CONDOMINO', condominioId: 'c1' },
    ],
  };
  assert.equal(scegliCondominio(profilo, 'c2'), 'c2');
  assert.equal(scegliCondominio(profilo, 'sparito'), 'c1');
  assert.equal(scegliCondominio(base, 'c1'), null);
  assert.equal(scegliVista(profilo, 'c1', 'RESIDENTE'), 'RESIDENTE');
  assert.equal(scegliVista(profilo, 'c1', 'SUPER_ADMIN'), 'ADMIN');
  assert.equal(scegliVista(profilo, 'c1'), 'ADMIN');
  assert.equal(scegliVista(profilo, 'c2'), null);
});

test('etichettaVista, homeDi e nomeVisibile', () => {
  assert.equal(etichettaVista('ADMIN', new Set(['ADMIN'])), 'Amministratore');
  assert.equal(etichettaVista('SUPER_ADMIN', new Set()), 'Super amministratore');
  assert.equal(etichettaVista('RESIDENTE', new Set(['CONDOMINO'])), 'Condòmino');
  assert.equal(etichettaVista('RESIDENTE', new Set(['PORTIERE'])), 'Portiere');
  assert.equal(etichettaVista('RESIDENTE', new Set(['CONDOMINO', 'PORTIERE'])), 'Condòmino e portiere');
  assert.equal(homeDi('RESIDENTE'), '/home');
  assert.equal(homeDi('ADMIN'), '/admin/dashboard');
  assert.equal(homeDi('SUPER_ADMIN'), '/superadmin/amministratori');
  assert.equal(nomeVisibile({ nome: ' Maria Rossi ', email: 'x@y.it' }), 'Maria Rossi');
  assert.equal(nomeVisibile({ nome: null, email: 'x@y.it' }), 'x@y.it');
  assert.equal(nomeVisibile({ nome: '', email: null }), 'Utente');
});
