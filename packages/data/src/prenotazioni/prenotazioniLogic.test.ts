import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IPrenotazioneSpazio, IRisorsaPrenotabile } from '@iocondo/shared-types';
import {
  calcolaCostoPrenotazione,
  filtraPrenotazioni,
  formattaCostoPrenotazione,
  formattaTariffaOraria,
  generaSlotGiorno,
  intervalliSiSovrappongono,
  ordinaPrenotazioni,
  statistichePrenotazioni,
  traduciErrorePrenotazione,
  validaPrenotazione,
  validaRisorsaPrenotabile,
  type PrenotazioneConDettagli,
} from './prenotazioniLogic.ts';

const RISORSA_TENNIS: IRisorsaPrenotabile = {
  id: 'ris-1',
  condominio_id: 'cond-1',
  nome: 'Campo da tennis',
  tariffa_oraria: 12.5,
  max_ore: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const RISORSA_GRATUITA: IRisorsaPrenotabile = {
  id: 'ris-2',
  condominio_id: 'cond-1',
  nome: 'Parcheggio ospiti',
  tariffa_oraria: 0,
  max_ore: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

test('validaRisorsaPrenotabile: accetta risorsa gratuita e a pagamento con virgola', () => {
  const ok1 = validaRisorsaPrenotabile({ nome: '  Sala riunioni  ', tariffa_oraria: '0', max_ore: '' });
  assert.equal(ok1.ok, true);
  if (ok1.ok) {
    assert.equal(ok1.dati.nome, 'Sala riunioni');
    assert.equal(ok1.dati.tariffa_oraria, 0);
    assert.equal(ok1.dati.max_ore, null);
  }

  const ok2 = validaRisorsaPrenotabile({ nome: 'Campo da tennis', tariffa_oraria: '12,50', max_ore: '2' });
  assert.equal(ok2.ok, true);
  if (ok2.ok) {
    assert.equal(ok2.dati.tariffa_oraria, 12.5);
    assert.equal(ok2.dati.max_ore, 2);
  }
});

test('validaRisorsaPrenotabile: blocca nome vuoto, tariffa negativa e max_ore non valido', () => {
  const ko = validaRisorsaPrenotabile({ nome: '   ', tariffa_oraria: '-5', max_ore: '1.5' });
  assert.equal(ko.ok, false);
  if (!ko.ok) {
    assert.ok(ko.errori.nome);
    assert.ok(ko.errori.tariffa_oraria);
    assert.ok(ko.errori.max_ore);
  }
});

test('intervalliSiSovrappongono: gestisce adiacenza semi-aperta [inizio, fine) vs sovrapposizione', () => {
  // Adiacenti: [10:00, 11:00) e [11:00, 12:00) NON si sovrappongono
  assert.equal(
    intervalliSiSovrappongono(
      '2026-11-20T10:00:00Z',
      '2026-11-20T11:00:00Z',
      '2026-11-20T11:00:00Z',
      '2026-11-20T12:00:00Z',
    ),
    false,
  );
  // Sovrapposti: [10:00, 12:00) e [11:00, 13:00) SI sovrappongono
  assert.equal(
    intervalliSiSovrappongono(
      '2026-11-20T10:00:00Z',
      '2026-11-20T12:00:00Z',
      '2026-11-20T11:00:00Z',
      '2026-11-20T13:00:00Z',
    ),
    true,
  );
});

test('calcolaCostoPrenotazione e formattazione italiana', () => {
  assert.equal(calcolaCostoPrenotazione(12.5, '2026-11-20T10:00:00Z', '2026-11-20T12:00:00Z'), 25);
  assert.equal(calcolaCostoPrenotazione(10, '2026-11-20T10:00:00Z', '2026-11-20T11:30:00Z'), 15);
  assert.equal(calcolaCostoPrenotazione(0, '2026-11-20T10:00:00Z', '2026-11-20T12:00:00Z'), 0);
  assert.equal(formattaCostoPrenotazione(0), 'Gratuito');
  assert.equal(formattaCostoPrenotazione(25), '25,00 €');
  assert.equal(formattaTariffaOraria(12.5), '12,50 €/ora');
  assert.equal(formattaTariffaOraria(0), 'Gratuito');
});

test('validaPrenotazione: blocca passato, fine <= inizio, oltre max_ore e slot sovrapposti', () => {
  const now = new Date('2026-11-20T09:00:00Z');
  const esistenti: IPrenotazioneSpazio[] = [
    {
      id: 'p-1',
      risorsa_id: 'ris-1',
      utente_id: 'u-altri',
      data_inizio: '2026-11-20T14:00:00Z',
      data_fine: '2026-11-20T16:00:00Z',
      costo_addebitato: 25,
      created_at: '2026-11-01T00:00:00Z',
    },
  ];

  // Passato
  const passato = validaPrenotazione(
    { risorsa_id: 'ris-1', data_inizio: '2026-11-20T08:00:00Z', data_fine: '2026-11-20T09:00:00Z' },
    RISORSA_TENNIS,
    esistenti,
    now,
  );
  assert.equal(passato.ok, false);
  if (!passato.ok) assert.ok(passato.errori.data_inizio);

  // Oltre max_ore (2h)
  const oltreMax = validaPrenotazione(
    { risorsa_id: 'ris-1', data_inizio: '2026-11-20T10:00:00Z', data_fine: '2026-11-20T13:00:00Z' },
    RISORSA_TENNIS,
    esistenti,
    now,
  );
  assert.equal(oltreMax.ok, false);
  if (!oltreMax.ok) assert.ok(oltreMax.errori.data_fine);

  // Conflitto slot
  const conflitto = validaPrenotazione(
    { risorsa_id: 'ris-1', data_inizio: '2026-11-20T15:00:00Z', data_fine: '2026-11-20T17:00:00Z' },
    RISORSA_TENNIS,
    esistenti,
    now,
  );
  assert.equal(conflitto.ok, false);
  if (!conflitto.ok) assert.ok(conflitto.errori.generale);

  // Valida
  const valida = validaPrenotazione(
    { risorsa_id: 'ris-1', data_inizio: '2026-11-20T16:00:00Z', data_fine: '2026-11-20T18:00:00Z' },
    RISORSA_TENNIS,
    esistenti,
    now,
  );
  assert.equal(valida.ok, true);
  if (valida.ok) assert.equal(valida.dati.costo_addebitato, 25);
});

test('traduciErrorePrenotazione: traduce codice Postgres 23P01 in messaggio leggibile', () => {
  const msg = traduciErrorePrenotazione({
    code: '23P01',
    message: 'conflicting key value violates exclusion constraint "prenotazioni_spazi_risorsa_id_tstzrange_excl"',
  });
  assert.equal(msg, 'Questo spazio risulta già prenotato nella fascia oraria scelta.');
});

test('generaSlotGiorno: maschera prenotazioni altrui come occupato e riconosce le proprie', () => {
  const giorno = new Date(2026, 10, 20);
  const now = new Date(2026, 10, 20, 9, 30, 0, 0);
  const prenotazioni: IPrenotazioneSpazio[] = [
    {
      id: 'p-mia',
      risorsa_id: 'ris-1',
      utente_id: 'u-1',
      data_inizio: new Date(2026, 10, 20, 10, 0, 0, 0).toISOString(),
      data_fine: new Date(2026, 10, 20, 11, 0, 0, 0).toISOString(),
      costo_addebitato: 12.5,
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'p-altro',
      risorsa_id: 'ris-1',
      utente_id: 'u-2',
      data_inizio: new Date(2026, 10, 20, 14, 0, 0, 0).toISOString(),
      data_fine: new Date(2026, 10, 20, 16, 0, 0, 0).toISOString(),
      costo_addebitato: 25,
      created_at: '2026-11-01T00:00:00Z',
    },
  ];

  const slots = generaSlotGiorno(giorno, 'ris-1', prenotazioni, 'u-1', { oraInizio: 8, oraFine: 17, now });
  assert.equal(slots.find((s) => s.oraInizio === 8)?.stato, 'passato');
  assert.equal(slots.find((s) => s.oraInizio === 10)?.stato, 'mio');
  assert.equal(slots.find((s) => s.oraInizio === 10)?.prenotazioneId, 'p-mia');
  assert.equal(slots.find((s) => s.oraInizio === 11)?.stato, 'libero');
  assert.equal(slots.find((s) => s.oraInizio === 14)?.stato, 'occupato');
  assert.equal(slots.find((s) => s.oraInizio === 14)?.prenotazioneId, undefined);
});

test('filtraPrenotazioni, ordinaPrenotazioni e statistichePrenotazioni', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const lista: PrenotazioneConDettagli[] = [
    {
      id: 'passata',
      risorsa_id: 'ris-2',
      utente_id: 'u-1',
      data_inizio: '2026-11-10T10:00:00Z',
      data_fine: '2026-11-10T12:00:00Z',
      costo_addebitato: 0,
      created_at: '2026-11-01T00:00:00Z',
      risorsa_nome: 'Parcheggio ospiti',
      tariffa_oraria: 0,
      utente_nome: 'Mario Rossi',
      utente_email: 'mario@example.com',
    },
    {
      id: 'futura',
      risorsa_id: 'ris-1',
      utente_id: 'u-2',
      data_inizio: '2026-11-25T10:00:00Z',
      data_fine: '2026-11-25T11:00:00Z',
      costo_addebitato: 12.5,
      created_at: '2026-11-01T00:00:00Z',
      risorsa_nome: 'Campo da tennis',
      tariffa_oraria: 12.5,
      utente_nome: 'Luca Verdi',
      utente_email: 'luca@example.com',
    },
  ];

  const ordinate = ordinaPrenotazioni(lista, now);
  assert.equal(ordinate[0]?.id, 'futura');
  assert.equal(ordinate[1]?.id, 'passata');

  const soloProgramma = filtraPrenotazioni(lista, { stato: 'in-programma' }, now);
  assert.equal(soloProgramma.length, 1);
  assert.equal(soloProgramma[0]?.id, 'futura');

  const perTesto = filtraPrenotazioni(lista, { ricerca: 'tennis' }, now);
  assert.equal(perTesto.length, 1);

  const stats = statistichePrenotazioni([RISORSA_TENNIS, RISORSA_GRATUITA], lista, now);
  assert.deepEqual(stats, {
    totaleSpazi: 2,
    prenotazioniAttive: 1,
    spaziAPagamento: 1,
    spaziGratuiti: 1,
  });
});
