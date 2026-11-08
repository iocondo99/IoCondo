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
});
