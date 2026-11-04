import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREFERENZE_NOTIFICHE_DEFAULT,
  normalizzaPreferenzeNotifiche,
  validaNomeCognome,
  validaTelefono,
} from './profiloFormLogic.ts';

test('validaNomeCognome: vuoto, troppo corto, troppo lungo e valido', () => {
  assert.equal(validaNomeCognome(''), 'Inserisci nome e cognome.');
  assert.equal(validaNomeCognome('   '), 'Inserisci nome e cognome.');
  assert.equal(validaNomeCognome('A'), 'Il nome deve contenere almeno 2 caratteri.');
  assert.equal(validaNomeCognome('A'.repeat(101)), 'Il nome non può superare 100 caratteri.');
  assert.equal(validaNomeCognome('Mario Rossi'), undefined);
  assert.equal(validaNomeCognome('  Giulia Bianchi  '), undefined);
});

test('validaTelefono: opzionale, formati validi e formati errati', () => {
  assert.equal(validaTelefono(null), undefined);
  assert.equal(validaTelefono(undefined), undefined);
  assert.equal(validaTelefono(''), undefined);
  assert.equal(validaTelefono('   '), undefined);

  // Troppo poche cifre
  assert.equal(validaTelefono('12345'), 'Il numero di telefono deve contenere almeno 6 cifre.');

  // Troppo lungo
  assert.equal(validaTelefono('1234567890123456789'), 'Il numero di telefono è troppo lungo.');

  // Caratteri non ammessi
  assert.equal(validaTelefono('06 1234abc'), 'Inserisci un numero di telefono valido (es. +39 06 1234567).');

  // Formati validi
  assert.equal(validaTelefono('+39 06 1234567'), undefined);
  assert.equal(validaTelefono('333-1234567'), undefined);
  assert.equal(validaTelefono('(02) 9876543'), undefined);
  assert.equal(validaTelefono('06123456'), undefined);
});

test('normalizzaPreferenzeNotifiche: default e fallback', () => {
  assert.deepEqual(normalizzaPreferenzeNotifiche(null), PREFERENZE_NOTIFICHE_DEFAULT);
  assert.deepEqual(normalizzaPreferenzeNotifiche(undefined), PREFERENZE_NOTIFICHE_DEFAULT);
  assert.deepEqual(normalizzaPreferenzeNotifiche('invalido'), PREFERENZE_NOTIFICHE_DEFAULT);

  assert.deepEqual(
    normalizzaPreferenzeNotifiche({
      email: false,
      bacheca: true,
      scadenzeRate: false,
    }),
    {
      email: false,
      bacheca: true,
      scadenzeRate: false,
    },
  );

  // Campi parziali
  assert.deepEqual(
    normalizzaPreferenzeNotifiche({
      email: false,
    }),
    {
      email: false,
      bacheca: true,
      scadenzeRate: true,
    },
  );
});

