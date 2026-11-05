import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregaPrioritaTicket,
  calcolaMorositaScaduta,
  calcolaPercentualeRiscossione,
  calcolaTotaleDaRiscuotere,
  differenzaGiorni,
  formattaStatoEsercizio,
  formattaTipoAssemblea,
  ordinaTicketUrgenti,
  type RataAdminDettaglio,
  type TicketAdmin,
} from '../adminDashboardLogic.ts';

const OGGI = '2026-11-05';

test('calcolaPercentualeRiscossione: calcola percentuale intera corretta con guardie', () => {
  assert.equal(calcolaPercentualeRiscossione(0, 1000), 0);
  assert.equal(calcolaPercentualeRiscossione(500, 1000), 50);
  assert.equal(calcolaPercentualeRiscossione(1000, 1000), 100);
  assert.equal(calcolaPercentualeRiscossione(684, 1000), 68);
  assert.equal(calcolaPercentualeRiscossione(1500, 1000), 100); // clamped at 100
  assert.equal(calcolaPercentualeRiscossione(100, 0), 0); // 0 dovuto
  assert.equal(calcolaPercentualeRiscossione(-50, 1000), 0); // incasso negativo
  assert.equal(calcolaPercentualeRiscossione(50, -100), 0); // dovuto negativo
});

test('differenzaGiorni: calcola i giorni corretti di calendario', () => {
  assert.equal(differenzaGiorni('2026-11-05', '2026-11-05'), 0);
  assert.equal(differenzaGiorni('2026-10-20', '2026-11-05'), 16);
  assert.equal(differenzaGiorni('2026-10-21', '2026-11-05'), 15);
  assert.equal(differenzaGiorni('2026-10-22', '2026-11-05'), 14);
  assert.equal(differenzaGiorni('2026-11-10', '2026-11-05'), -5);
});

test('calcolaMorositaScaduta: include solo rate scadute da > 15 giorni con residuo positivo', () => {
  const rate: RataAdminDettaglio[] = [
    {
      id: '1',
      rataTestataId: 't1',
      importoDovuto: 200,
      importoPagato: 0,
      stato: 'DA_PAGARE',
      dataScadenza: '2026-10-20', // 16 gg fa -> scaduta > 15 gg
    },
    {
      id: '2',
      rataTestataId: 't2',
      importoDovuto: 300,
      importoPagato: 100,
      stato: 'DA_PAGARE',
      dataScadenza: '2026-09-22', // 44 gg fa -> residuo 200
    },
    {
      id: '3',
      rataTestataId: 't3',
      importoDovuto: 150,
      importoPagato: 0,
      stato: 'DA_PAGARE',
      dataScadenza: '2026-10-21', // Esattamente 15 gg fa -> NON oltre 15 gg
    },
    {
      id: '4',
      rataTestataId: 't4',
      importoDovuto: 500,
      importoPagato: 500,
      stato: 'PAGATO',
      dataScadenza: '2026-08-01', // Scaduta da mesi ma PAGATA -> NON morosa
    },
    {
      id: '5',
      rataTestataId: 't5',
      importoDovuto: 180,
      importoPagato: 0,
      stato: 'DA_PAGARE',
      dataScadenza: '2026-11-20', // Futura -> NON scaduta
    },
  ];

  const risultato = calcolaMorositaScaduta(rate, OGGI, 15);
  // Rate 1 (200) + Rate 2 residuo (200) = 400
  assert.equal(risultato.totaleMorosita, 400);
  assert.equal(risultato.posizioniMorose, 2);
});

test('calcolaTotaleDaRiscuotere: somma residuo di tutte le rate non saldate', () => {
  const rate: RataAdminDettaglio[] = [
    { id: '1', rataTestataId: 't1', importoDovuto: 200, importoPagato: 50, stato: 'DA_PAGARE', dataScadenza: '2026-11-10' },
    { id: '2', rataTestataId: 't2', importoDovuto: 300, importoPagato: 300, stato: 'PAGATO', dataScadenza: '2026-11-10' },
    { id: '3', rataTestataId: 't3', importoDovuto: 150, importoPagato: 0, stato: 'DA_PAGARE', dataScadenza: '2026-11-20' },
  ];
  // 150 + 150 = 300
  assert.equal(calcolaTotaleDaRiscuotere(rate), 300);
});

test('aggregaPrioritaTicket: calcola correttamente attivi, aperti, lavorazione e priorità', () => {
  const tickets: TicketAdmin[] = [
    { id: '1', titolo: 'Guasto caldaia', priorita: 'URGENTE', stato: 'APERTO', isAreaComune: true, createdAt: '2026-11-01' },
    { id: '2', titolo: 'Perdita tubo', priorita: 'ALTA', stato: 'LAVORAZIONE', isAreaComune: false, createdAt: '2026-11-02' },
    { id: '3', titolo: 'Citofono rotto', priorita: 'MEDIA', stato: 'APERTO', isAreaComune: true, createdAt: '2026-11-03' },
    { id: '4', titolo: 'Luce androne', priorita: 'BASSA', stato: 'RISOLTO', isAreaComune: true, createdAt: '2026-10-25' },
    { id: '5', titolo: 'Ascensore bloccato', priorita: 'URGENTE', stato: 'LAVORAZIONE', isAreaComune: true, createdAt: '2026-11-04' },
  ];

  const aggregato = aggregaPrioritaTicket(tickets);
  assert.equal(aggregato.totaleAttivi, 4); // 1, 2, 3, 5
  assert.equal(aggregato.aperti, 2); // 1, 3
  assert.equal(aggregato.inLavorazione, 2); // 2, 5
  assert.equal(aggregato.risolti, 1); // 4
  assert.equal(aggregato.urgenti, 2); // 1, 5
  assert.equal(aggregato.perPriorita.URGENTE, 2);
  assert.equal(aggregato.perPriorita.ALTA, 1);
  assert.equal(aggregato.perPriorita.MEDIA, 1);
  assert.equal(aggregato.perPriorita.BASSA, 0); // il ticket risolto non incrementa i prioritari attivi
});

test('ordinaTicketUrgenti: ordina per peso priorità e poi per data decrescente', () => {
  const tickets: TicketAdmin[] = [
    { id: '1', titolo: 'Media recente', priorita: 'MEDIA', stato: 'APERTO', isAreaComune: true, createdAt: '2026-11-04' },
    { id: '2', titolo: 'Urgente vecchia', priorita: 'URGENTE', stato: 'APERTO', isAreaComune: true, createdAt: '2026-11-01' },
    { id: '3', titolo: 'Urgente recente', priorita: 'URGENTE', stato: 'LAVORAZIONE', isAreaComune: true, createdAt: '2026-11-03' },
    { id: '4', titolo: 'Risolto ignorato', priorita: 'URGENTE', stato: 'RISOLTO', isAreaComune: true, createdAt: '2026-11-05' },
    { id: '5', titolo: 'Alta', priorita: 'ALTA', stato: 'APERTO', isAreaComune: false, createdAt: '2026-11-02' },
  ];

  const ordinati = ordinaTicketUrgenti(tickets, 3);
  assert.equal(ordinati.length, 3);
  assert.equal(ordinati[0].id, '3'); // Urgente recente
  assert.equal(ordinati[1].id, '2'); // Urgente vecchia
  assert.equal(ordinati[2].id, '5'); // Alta
});

test('formattaStatoEsercizio e formattaTipoAssemblea', () => {
  assert.equal(formattaStatoEsercizio('PREVENTIVO'), 'Preventivo');
  assert.equal(formattaStatoEsercizio('CONSUNTIVO'), 'Consuntivo');
  assert.equal(formattaStatoEsercizio('CHIUSO'), 'Chiuso');
  assert.equal(formattaStatoEsercizio(null), 'Non specificato');

  assert.equal(formattaTipoAssemblea('ORDINARIA'), 'Ordinaria');
  assert.equal(formattaTipoAssemblea('STRAORDINARIA'), 'Straordinaria');
  assert.equal(formattaTipoAssemblea(undefined), 'Assemblea');
});

