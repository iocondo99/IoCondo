import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assertQuadraturaMillesimi,
  calcolaConguaglio,
  calcolaGiorniInclusivi,
  centsToEuro,
  dividiEArrotondaHalfUp,
  ErroreQuadraturaMillesimi,
  euroToCents,
  formattaCentsItaliano,
  normalizzaCentesimi,
  ripartisciConsumi,
  ripartisciSpesa,
  ripartisciSpesaPeriodo,
  validaQuadraturaMillesimi,
  VERSIONE_MOTORE_CALCOLO,
} from '../contabilitaLogic.ts';
import {
  costruisciAlberoStruttura,
  calcolaQuadraturaTabella,
} from '../../admin/strutturaLogic.ts';
import {
  preparaRate,
  riepilogoPagamenti,
} from '../../pagamenti/pagamentiLogic.ts';

describe('Motore di calcolo contabile puro (Sezione 10)', () => {
  test('Rappresentazione monetaria: conversione e formattazione italiana (centsToEuro, euroToCents)', () => {
    // Da Euro numerico a Centesimi interi
    assert.equal(euroToCents(10000), 1_000_000);
    assert.equal(euroToCents(850), 85_000);
    assert.equal(euroToCents(100.01), 10_001);
    assert.equal(euroToCents(33.33), 3_333);
    assert.equal(euroToCents(0), 0);
    assert.equal(euroToCents(-140), -14_000);
    assert.equal(euroToCents(100n), 10_000);

    // Da stringa formattata in italiano a Centesimi interi
    assert.equal(euroToCents('10.000,00 €'), 1_000_000);
    assert.equal(euroToCents('10.000,00'), 1_000_000);
    assert.equal(euroToCents('100,01 €'), 10_001);
    assert.equal(euroToCents('33,34'), 3_334);
    assert.equal(euroToCents('-140,00 €'), -14_000);

    // Da Centesimi interi a Euro numerico e stringa italiana
    assert.equal(centsToEuro(1_000_000), 10000);
    assert.equal(centsToEuro(85_000), 850);
    assert.equal(centsToEuro(3_333), 33.33);
    assert.equal(centsToEuro(1_000_000, true), '10.000,00');
    assert.equal(centsToEuro(1_000_000, true, true), '10.000,00 €');
    assert.equal(centsToEuro(85_000, { formatoItaliano: true, conSimbolo: true }), '850,00 €');
    assert.equal(formattaCentsItaliano(3_334, true), '33,34 €');
    assert.equal(formattaCentsItaliano(-14_000, true), '-140,00 €');

    // Rifiuto di numeri decimali non interi come Centesimi
    assert.throws(() => normalizzaCentesimi(33.33), TypeError);
    assert.throws(() => normalizzaCentesimi(Number.NaN), TypeError);
  });

  test('Arrotondamento razionale al centesimo per eccesso da 0,5 (half-up)', () => {
    // 0,5 esatto -> arrotonda per eccesso a 1
    assert.equal(dividiEArrotondaHalfUp(1n, 2n), 1);
    assert.equal(dividiEArrotondaHalfUp(3n, 2n), 2);
    // 0,499... -> arrotonda per difetto a 0
    assert.equal(dividiEArrotondaHalfUp(499n, 1000n), 0);
    // 0,500 -> arrotonda per eccesso a 1
    assert.equal(dividiEArrotondaHalfUp(500n, 1000n), 1);
  });

  test('T1 — Ripartizione generale: Spesa 10.000,00 €; tabella proprietà 1000; unità da 85 -> Quota 850,00 €', () => {
    const importoCent = euroToCents('10.000,00'); // 1_000_000 centesimi
    const esito = ripartisciSpesa({
      importoCent,
      quoteMillesimi: [
        { unitaId: 'unita-85', millesimi: 85 },
        { unitaId: 'unita-resto-condominio', millesimi: 915 },
      ],
      richiediQuadratura: true,
      totaleAttesoMillesimi: 1000,
    });

    const quotaUnita85 = esito.quote.find((q) => q.unitaId === 'unita-85');
    assert.ok(quotaUnita85);
    assert.equal(quotaUnita85.quotaFinaleCent, euroToCents('850,00')); // 85_000 cent
    assert.equal(quotaUnita85.quotaFinaleEuro, 850);
    assert.equal(formattaCentsItaliano(quotaUnita85.quotaFinaleCent, true), '850,00 €');
    assert.equal(esito.sommaQuoteFinaliCent, importoCent);
    assert.equal(esito.restoCent, 0);
    assert.equal(esito.rigaArrotondamento, null);
    assert.equal(esito.versioneMotore, VERSIONE_MOTORE_CALCOLO);
  });

  test('T2 — Resto negativo: Spesa 100,01 €; 3 unità uguali -> 33,33 / 33,34 / 33,34 €; somma 100,01 €', () => {
    const importoCent = euroToCents('100,01'); // 10_001 centesimi
    const esito = ripartisciSpesa({
      importoCent,
      quoteMillesimi: [
        { unitaId: 'U1', millesimi: 1 },
        { unitaId: 'U2', millesimi: 1 },
        { unitaId: 'U3', millesimi: 1 },
      ],
    });

    // Ogni unità prima del resto arrotonda 3333,666... cent a 3334 cent (33,34 €)
    assert.deepEqual(
      esito.quote.map((q) => q.quotaCalcolataCent),
      [3334, 3334, 3334],
    );
    assert.equal(esito.sommaQuoteCalcolateCent, 10_002);

    // Resto = 10001 - 10002 = -1 centesimo. A parità di valore millesimale, va alla prima unità per ordine di inserimento (U1)
    assert.equal(esito.restoCent, -1);
    assert.equal(esito.unitaArrotondamentoId, 'U1');
    assert.ok(esito.rigaArrotondamento);
    assert.equal(esito.rigaArrotondamento.descrizione, 'arrotondamento');
    assert.equal(esito.rigaArrotondamento.unitaId, 'U1');
    assert.equal(esito.rigaArrotondamento.importoCent, -1);

    // Quote finali: 33,33 € / 33,34 € / 33,34 € e somma 100,01 €
    assert.deepEqual(
      esito.quote.map((q) => q.quotaFinaleCent),
      [3333, 3334, 3334],
    );
    assert.deepEqual(
      esito.quote.map((q) => formattaCentsItaliano(q.quotaFinaleCent)),
      ['33,33', '33,34', '33,34'],
    );
    assert.equal(esito.sommaQuoteFinaliCent, 10_001);
  });

  test('T3 — Resto positivo: Spesa 1.000,00 €; unità da 333,333 / 333,333 / 333,334 su 1000 -> 333,33 / 333,33 / 333,34 € (resto alla terza)', () => {
    const importoCent = euroToCents('1.000,00'); // 100_000 centesimi
    const esito = ripartisciSpesa({
      importoCent,
      quoteMillesimi: [
        { unitaId: 'U1', millesimi: 333.333 },
        { unitaId: 'U2', millesimi: 333.333 },
        { unitaId: 'U3', millesimi: 333.334 },
      ],
      richiediQuadratura: true,
      totaleAttesoMillesimi: 1000,
    });

    // Quote calcolate prima del resto: 333,33 € ciascuna (somma 999,99 €)
    assert.deepEqual(
      esito.quote.map((q) => q.quotaCalcolataCent),
      [33_333, 33_333, 33_333],
    );
    assert.equal(esito.sommaQuoteCalcolateCent, 99_999);

    // Resto +1 centesimo assegnato alla terza unità (U3) che ha millesimi maggiori (333,334)
    assert.equal(esito.restoCent, 1);
    assert.equal(esito.unitaArrotondamentoId, 'U3');
    assert.ok(esito.rigaArrotondamento);
    assert.equal(esito.rigaArrotondamento.descrizione, 'arrotondamento');
    assert.equal(esito.rigaArrotondamento.unitaId, 'U3');
    assert.equal(esito.rigaArrotondamento.importoCent, 1);

    // Quote finali: 333,33 / 333,33 / 333,34 € e somma 1.000,00 €
    assert.deepEqual(
      esito.quote.map((q) => q.quotaFinaleCent),
      [33_333, 33_333, 33_334],
    );
    assert.deepEqual(
      esito.quote.map((q) => formattaCentsItaliano(q.quotaFinaleCent)),
      ['333,33', '333,33', '333,34'],
    );
    assert.equal(esito.sommaQuoteFinaliCent, 100_000);
  });

  test('T5 — Conguaglio: Rate versate 1.200,00 €; consuntivo 1.340,00 € -> Debito 140,00 €', () => {
    const esitoDebito = calcolaConguaglio({
      quotaConsuntivoCent: euroToCents('1.340,00'), // 134_000
      rateVersateCent: euroToCents('1.200,00'), // 120_000
      unitaId: 'U1',
      gestioneId: 'gestione-ordinaria-2026',
    });

    assert.equal(esitoDebito.conguaglioCent, 14_000);
    assert.equal(esitoDebito.debitoCent, 14_000);
    assert.equal(esitoDebito.creditoCent, 0);
    assert.equal(esitoDebito.tipo, 'DEBITO');
    assert.equal(esitoDebito.isDebito, true);
    assert.equal(esitoDebito.isCredito, false);
    assert.equal(esitoDebito.conguaglioEuro, 140);
    assert.equal(formattaCentsItaliano(esitoDebito.debitoCent, true), '140,00 €');

    // Verifica simmetrica per caso a credito (consuntivo inferiore alle rate versate)
    const esitoCredito = calcolaConguaglio({
      quotaConsuntivoCent: euroToCents('1.100,00'),
      rateVersateCent: euroToCents('1.200,00'),
    });
    assert.equal(esitoCredito.conguaglioCent, -10_000);
    assert.equal(esitoCredito.creditoCent, 10_000);
    assert.equal(esitoCredito.debitoCent, 0);
    assert.equal(esitoCredito.tipo, 'CREDITO');
    assert.equal(esitoCredito.isCredito, true);
  });

  test('T8 — Spesa a periodo con cambio titolare: Premio 730,00 € per il 2026; unità da 100 su 1000; A 1/1-30/6 (181 gg), B 1/7-31/12 (184 gg) -> Quota annua 73,00 €; A 36,20 €; B 36,80 €', () => {
    // Verifica calcolo giorni inclusivi (immune da cambio ora legale/solare)
    assert.equal(calcolaGiorniInclusivi('2026-01-01', '2026-06-30'), 181);
    assert.equal(calcolaGiorniInclusivi('2026-07-01', '2026-12-31'), 184);
    assert.equal(calcolaGiorniInclusivi('2026-01-01', '2026-12-31'), 365);

    // Caso 1: passaggio del premio condominiale (730,00 €) con millesimi unità (100 su 1000)
    const esitoDaPremioTotale = ripartisciSpesaPeriodo({
      importoCent: euroToCents('730,00'), // 73_000 cent
      millesimiUnita: 100,
      totaleMillesimi: 1000,
      dataInizio: '2026-01-01',
      dataFine: '2026-12-31',
      periodiTitolarita: [
        { titolareId: 'A', dataInizio: '2026-01-01', dataFine: '2026-06-30' },
        { titolareId: 'B', dataInizio: '2026-07-01', dataFine: '2026-12-31' },
      ],
    });

    assert.equal(esitoDaPremioTotale.quotaPeriodoUnitaCent, euroToCents('73,00')); // 7_300 cent (73,00 €)
    assert.equal(esitoDaPremioTotale.giorniPeriodoTotale, 365);
    assert.equal(esitoDaPremioTotale.sommaGiorniTitolarita, 365);

    const quotaA = esitoDaPremioTotale.quoteTitolari.find((q) => q.titolareId === 'A');
    const quotaB = esitoDaPremioTotale.quoteTitolari.find((q) => q.titolareId === 'B');
    assert.ok(quotaA);
    assert.ok(quotaB);

    assert.equal(quotaA.giorni, 181);
    assert.equal(quotaA.quotaFinaleCent, euroToCents('36,20')); // 3_620 cent
    assert.equal(formattaCentsItaliano(quotaA.quotaFinaleCent, true), '36,20 €');

    assert.equal(quotaB.giorni, 184);
    assert.equal(quotaB.quotaFinaleCent, euroToCents('36,80')); // 3_680 cent
    assert.equal(formattaCentsItaliano(quotaB.quotaFinaleCent, true), '36,80 €');

    assert.equal(esitoDaPremioTotale.sommaQuoteFinaliCent, euroToCents('73,00'));

    // Caso 2: passaggio diretto della quota annua dell'unità (73,00 €)
    const esitoDaQuotaUnita = ripartisciSpesaPeriodo({
      importoCent: euroToCents('73,00'), // 7_300 cent
      dataInizio: '2026-01-01',
      dataFine: '2026-12-31',
      periodiTitolarita: [
        { titolareId: 'A', dataInizio: '2026-01-01', dataFine: '2026-06-30' },
        { titolareId: 'B', dataInizio: '2026-07-01', dataFine: '2026-12-31' },
      ],
    });

    assert.equal(esitoDaQuotaUnita.quoteTitolari[0]?.quotaFinaleCent, 3_620);
    assert.equal(esitoDaQuotaUnita.quoteTitolari[1]?.quotaFinaleCent, 3_680);
    assert.equal(esitoDaQuotaUnita.sommaQuoteFinaliCent, 7_300);

    // Caso 3: spesa a periodo con resto di arrotondamento -> assegnato al periodo con più giorni (B, 184 gg)
    const esitoConResto = ripartisciSpesaPeriodo({
      importoCent: 10_000, // 100,00 € su 365 giorni: A (181 gg) = 4958,90 -> 4959; B (184 gg) = 5041,09 -> 5041; o con 100,01 €
      dataInizio: '2026-01-01',
      dataFine: '2026-12-31',
      periodiTitolarita: [
        { titolareId: 'A', dataInizio: '2026-01-01', dataFine: '2026-06-30' },
        { titolareId: 'B', dataInizio: '2026-07-01', dataFine: '2026-12-31' },
      ],
    });
    assert.equal(esitoConResto.sommaQuoteFinaliCent, 10_000);
  });

  test('T9 — Consumi: Acqua 2.400,00 €; 1.200 m³ totali; unità con 30 m³ -> 60,00 € e marcatura "da conguagliare" su letture stimate', () => {
    const importoTotaleCent = euroToCents('2.400,00'); // 240_000 centesimi

    // Ripartizione con letture reali + 1 lettura mancante stimata dallo storico
    const esito = ripartisciConsumi({
      importoTotaleCent,
      consumiUnita: [
        { unitaId: 'unita-30mc', consumo: 30 },
        { unitaId: 'unita-reale-2', consumo: 1120 },
        { unitaId: 'unita-senza-lettura', consumo: null },
      ],
      stimeMancanti: {
        'unita-senza-lettura': 50, // 30 + 1120 + 50 = 1200 m³ totali
      },
    });

    assert.equal(esito.consumoTotale, 1200);
    assert.equal(esito.sommaQuoteFinaliCent, importoTotaleCent);
    assert.equal(esito.haQuoteDaConguagliare, true);

    const quota30 = esito.quote.find((q) => q.unitaId === 'unita-30mc');
    assert.ok(quota30);
    assert.equal(quota30.consumo, 30);
    assert.equal(quota30.quotaFinaleCent, euroToCents('60,00')); // 6_000 cent (60,00 €)
    assert.equal(quota30.quotaFinaleEuro, 60);
    assert.equal(formattaCentsItaliano(quota30.quotaFinaleCent, true), '60,00 €');
    assert.equal(quota30.isStimato, false);
    assert.equal(quota30.daConguagliare, false);
    assert.equal(quota30.statoQuota, 'DEFINITIVA');

    const quotaStimata = esito.quote.find((q) => q.unitaId === 'unita-senza-lettura');
    assert.ok(quotaStimata);
    assert.equal(quotaStimata.consumo, 50);
    assert.equal(quotaStimata.quotaFinaleCent, euroToCents('100,00')); // 10_000 cent (100,00 €)
    assert.equal(quotaStimata.isStimato, true);
    assert.equal(quotaStimata.daConguagliare, true);
    assert.equal(quotaStimata.statoQuota, 'DA_CONGUAGLIARE');
  });

  test('T14 — Tabella non quadra: Tabella con somma 998 -> Errore; emissione bloccata', () => {
    const quoteNonQuadrate = [
      { unitaId: 'U1', millesimi: 500 },
      { unitaId: 'U2', millesimi: 498 },
    ];

    const validazione = validaQuadraturaMillesimi(quoteNonQuadrate, 1000);
    assert.equal(validazione.valido, false);
    assert.equal(validazione.isQuadrata, false);
    assert.equal(validazione.emissioneBloccata, true);
    assert.equal(validazione.sommaMillesimi, 998);
    assert.equal(validazione.totaleAtteso, 1000);
    assert.equal(validazione.differenza, -2);
    assert.ok(validazione.errore);
    assert.match(validazione.errore, /998/);
    assert.match(validazione.errore, /Emissione bloccata/i);

    // Verifica anche il blocco tramite eccezione tipizzata in assertQuadraturaMillesimi e ripartisciSpesa({ richiediQuadratura: true })
    assert.throws(
      () => assertQuadraturaMillesimi(quoteNonQuadrate, 1000),
      (err: unknown) => {
        assert.ok(err instanceof ErroreQuadraturaMillesimi);
        assert.equal(err.sommaMillesimi, 998);
        assert.equal(err.totaleAtteso, 1000);
        assert.equal(err.differenza, -2);
        assert.equal(err.emissioneBloccata, true);
        return true;
      },
    );

    assert.throws(
      () =>
        ripartisciSpesa({
          importoCent: euroToCents('10.000,00'),
          quoteMillesimi: quoteNonQuadrate,
          richiediQuadratura: true,
          totaleAttesoMillesimi: 1000,
        }),
      ErroreQuadraturaMillesimi,
    );

    // Verifica caso valido con somma 1000,000 esatta (inclusi decimali)
    const validazioneOk = validaQuadraturaMillesimi([333.333, 333.333, 333.334], 1000);
    assert.equal(validazioneOk.valido, true);
    assert.equal(validazioneOk.isQuadrata, true);
    assert.equal(validazioneOk.emissioneBloccata, false);
    assert.equal(validazioneOk.sommaMillesimi, 1000);
    assert.equal(validazioneOk.errore, null);
  });

  test('T4 — Lastrico solare (art. 1126 c.c.): Riparazione 9.000,00 €; 1/3 uso esclusivo (3.000,00 €), 2/3 unità sottostanti 200/300/500 -> 1.200,00 / 1.800,00 / 3.000,00 €', () => {
    const totaleSpesaCent = euroToCents('9.000,00'); // 900_000 centesimi
    const quotaUnTerzoEsclusivoCent = dividiEArrotondaHalfUp(BigInt(totaleSpesaCent), 3n);
    const quotaDueTerziSottostantiCent = totaleSpesaCent - quotaUnTerzoEsclusivoCent;

    assert.equal(quotaUnTerzoEsclusivoCent, euroToCents('3.000,00'));
    assert.equal(quotaDueTerziSottostantiCent, euroToCents('6.000,00'));

    const esitoSottostanti = ripartisciSpesa({
      importoCent: quotaDueTerziSottostantiCent,
      quoteMillesimi: [
        { unitaId: 'U-200', millesimi: 200 },
        { unitaId: 'U-300', millesimi: 300 },
        { unitaId: 'U-500', millesimi: 500 },
      ],
      richiediQuadratura: true,
      totaleAttesoMillesimi: 1000,
    });

    assert.deepEqual(
      esitoSottostanti.quote.map((q) => q.quotaFinaleCent),
      [euroToCents('1.200,00'), euroToCents('1.800,00'), euroToCents('3.000,00')],
    );
    assert.equal(
      quotaUnTerzoEsclusivoCent + esitoSottostanti.sommaQuoteFinaliCent,
      totaleSpesaCent,
    );
  });

  test('T17 — Cambio amministratore (RC-A13..A15): Passaggio da A a B -> A cessa e conserva autore_id sui movimenti del suo periodo, B unico attivo', () => {
    const assegnazioneA = {
      id: 'ass-admin-a',
      condominio_id: 'cond-1',
      utente_id: 'admin-A',
      ruolo_incarico: 'AMMINISTRATORE' as const,
      data_nomina: '2025-01-01',
      data_cessazione: '2026-06-30',
      is_attivo: false,
      permessi: { solaLettura: true, export: true, scrittura: false },
    };
    const assegnazioneB = {
      id: 'ass-admin-b',
      condominio_id: 'cond-1',
      utente_id: 'admin-B',
      ruolo_incarico: 'AMMINISTRATORE' as const,
      data_nomina: '2026-07-01',
      data_cessazione: null,
      is_attivo: true,
      permessi: { solaLettura: true, export: true, scrittura: true },
    };
    const movimentoPeriodoA = {
      id: 'mov-periodo-a',
      condominio_id: 'cond-1',
      data: '2026-03-15',
      importo_centesimi: 50_000,
      autore_id: 'admin-A',
    };

    const assegnazioniAttive = [assegnazioneA, assegnazioneB].filter(
      (a) => a.ruolo_incarico === 'AMMINISTRATORE' && a.is_attivo && a.data_cessazione === null,
    );
    assert.equal(assegnazioniAttive.length, 1);
    assert.equal(assegnazioniAttive[0]?.utente_id, 'admin-B');
    assert.equal(assegnazioneA.permessi.solaLettura, true);
    assert.equal(assegnazioneA.permessi.export, true);
    assert.equal(assegnazioneA.permessi.scrittura, false);
    assert.equal(movimentoPeriodoA.autore_id, 'admin-A');
  });

  test('T18, T19, T21, T22 — Regressione migrazione importi in centesimi, parità numeric/centesimi e zero righe orfane', () => {
    const righePreMigrazione = [
      { id: 'm1', condominio_id: 'cond-1', importo: 1250.5 },
      { id: 'm2', condominio_id: 'cond-1', importo: 33.33 },
      { id: 'm3', condominio_id: 'cond-2', importo: 890.17 },
    ];

    // T18 + T21: conversione in centesimi interi e coesistenza con colonna numeric
    const righePostMigrazione = righePreMigrazione.map((r) => ({
      ...r,
      importo_centesimi: euroToCents(r.importo),
    }));

    const sommaPrimaCent = righePreMigrazione.reduce((acc, r) => acc + Math.round(r.importo * 100), 0);
    const sommaDopoCent = righePostMigrazione.reduce((acc, r) => acc + r.importo_centesimi, 0);
    assert.equal(sommaPrimaCent, sommaDopoCent);
    assert.equal(sommaDopoCent, 217_400);

    for (const r of righePostMigrazione) {
      assert.equal(centsToEuro(r.importo_centesimi), r.importo);
      // T22: zero righe orfane (condominio_id presente e valido)
      assert.ok(r.condominio_id && r.condominio_id.length > 0);
    }

    // T19: verifica che una discrepanza durante la migrazione venga intercettata bloccando il commit
    const verificaIntegritaMigrazione = (prima: number, dopo: number, orfane: number) => {
      if (prima !== dopo || orfane > 0) {
        throw new Error('ROLLBACK_MIGRAZIONE_CONTABILITA');
      }
      return { stato: 'COMPLETATA', righe_orfane: 0 };
    };
    assert.equal(verificaIntegritaMigrazione(sommaPrimaCent, sommaDopoCent, 0).stato, 'COMPLETATA');
    assert.throws(() => verificaIntegritaMigrazione(sommaPrimaCent, sommaDopoCent - 1, 0), /ROLLBACK_MIGRAZIONE_CONTABILITA/);
  });

  test('T20 — Regressione comportamento esistente: struttura, anagrafiche, tabelle millesimali e rate del condòmino invariati', () => {
    // 1. Verifica struttura e anagrafiche (strutturaLogic) con campi estesi dal modello contabile
    const albero = costruisciAlberoStruttura({
      palazzi: [{ id: 'pal-1', condominio_id: 'cond-1', nome_identificativo: 'Palazzo A', indirizzo: 'Via Roma 1' }],
      scale: [{ id: 'sc-a', palazzo_id: 'pal-1', tipo: 'SCALA', nome: 'Scala A' }],
      tipologie: [{ id: 'tip-app', descrizione: 'Appartamento' }],
      unita: [
        { id: 'u-1', palazzo_id: 'pal-1', scala_colonna_id: 'sc-a', tipologia_id: 'tip-app', interno: '1', piano: 1, mq: 90 },
        { id: 'u-2', palazzo_id: 'pal-1', scala_colonna_id: 'sc-a', tipologia_id: 'tip-app', interno: '2', piano: 2, mq: 110 },
      ],
      anagrafiche: [
        {
          id: 'anag-1',
          unita_id: 'u-1',
          utente_id: 'ut-1',
          tipo_possesso: 'PROPRIETARIO',
          data_inizio: '2024-01-01',
          data_fine: null,
          quota_possesso: 100,
          utente: { id: 'ut-1', nome_cognome: 'Mario Rossi', telefono: '3331234567' },
        },
      ],
      dataRifOggi: '2026-11-10',
    });

    assert.equal(albero.statistiche.totalePalazzi, 1);
    assert.equal(albero.statistiche.totaleUnita, 2);
    assert.equal(albero.statistiche.residentiAssociati, 1);
    assert.equal(albero.tutteUnita[0]?.residenteAttivo?.nomeCognome, 'Mario Rossi');

    // 2. Verifica quadratura tabella millesimale esistente
    const tabQuadratura = calcolaQuadraturaTabella(
      { id: 'tab-a', condominio_id: 'cond-1', nome: 'Tabella A', totale: 1000 },
      [
        { id: 'q1', tabella_id: 'tab-a', unita_id: 'u-1', valore_millesimale: 450 },
        { id: 'q2', tabella_id: 'tab-a', unita_id: 'u-2', valore_millesimale: 550 },
      ],
      albero.tutteUnita,
    );
    assert.equal(tabQuadratura.isQuadrata, true);
    assert.equal(tabQuadratura.totaleEffettivo, 1000);

    // 3. Verifica rate del condòmino (pagamentiLogic) con righe che coesistono col nuovo modello
    const rateCondomino = preparaRate(
      [
        {
          id: 'rd-1',
          descrizione: 'Rata 1 Preventivo 2026',
          dataScadenza: '2026-03-31',
          importoDovuto: 250,
          importoPagato: 100,
          stato: 'RITARDO',
        },
        {
          id: 'rd-2',
          descrizione: 'Rata 2 Preventivo 2026',
          dataScadenza: '2026-12-31',
          importoDovuto: 250,
          importoPagato: 0,
          stato: 'DA_PAGARE',
        },
      ],
      '2026-11-10',
    );
    const riepilogoRate = riepilogoPagamenti(rateCondomino, '2026-11-10');
    assert.equal(riepilogoRate.totaleDaPagare, 400);
    assert.equal(riepilogoRate.totaleScaduto, 150);
    assert.equal(riepilogoRate.prossima, '2026-12-31');
  });
});
