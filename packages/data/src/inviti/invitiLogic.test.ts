import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  etichettaRuoloInvito,
  etichettaUnita,
  messaggioErroreInvito,
  ruoliInvitabili,
  statoInvito,
} from './invitiLogic.ts';

const adesso = new Date('2026-11-10T12:00:00Z');

test('statoInvito: accettato, in attesa e scaduto', () => {
  assert.equal(statoInvito({ scadenza: '2026-11-01T00:00:00Z', accettatoAt: '2026-10-30T00:00:00Z' }, adesso), 'accettato');
  assert.equal(statoInvito({ scadenza: '2026-11-17T00:00:00Z', accettatoAt: null }, adesso), 'in-attesa');
  assert.equal(statoInvito({ scadenza: '2026-11-10T12:00:00Z', accettatoAt: null }, adesso), 'scaduto');
  assert.equal(statoInvito({ scadenza: '2026-11-09T00:00:00Z', accettatoAt: null }, adesso), 'scaduto');
});

test('ruoli invitabili: ADMIN solo al super amministratore', () => {
  assert.deepEqual(ruoliInvitabili(false), ['CONDOMINO', 'PORTIERE']);
  assert.deepEqual(ruoliInvitabili(true), ['CONDOMINO', 'PORTIERE', 'ADMIN']);
});

test('etichette', () => {
  assert.equal(etichettaRuoloInvito('CONDOMINO', true), 'Condòmino e portiere');
  assert.equal(etichettaRuoloInvito('PORTIERE', true), 'Portiere');
  assert.equal(etichettaUnita('Palazzo A', '3'), 'Palazzo A · interno 3');
});

test('errori dell’invito: testi in italiano, senza dettagli tecnici', () => {
  for (const codice of ['400', '403', '429', '500', '502', '', null]) {
    const testo = messaggioErroreInvito(codice);
    assert.ok(testo.length > 10);
    assert.doesNotMatch(testo, /edge function|jwt|supabase|http|exception/i);
  }
});
