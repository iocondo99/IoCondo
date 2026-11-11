import test from 'node:test';
import assert from 'node:assert/strict';

import {
  creaScritturaStorno,
  ErroreStornoNonConsentito,
} from '../registroContabileLogic.ts';

import {
  rettificaBollettinoEmesso,
  validaEmissioneRateDaPreventivo,
} from '../bollettiniLogic.ts';

import {
  imputaIncasso,
} from '../morositaLogic.ts';

import {
  ripartisciSpesa,
} from '../contabilitaLogic.ts';

test('Audit Contabilità - Edge Case 1: Divieto di doppio storno e storno di uno storno (RC-B4)', () => {
  const movimentoOriginale = {
    id: 'mov-1',
    condominio_id: 'condo-1',
    esercizio_id: 'es-2026',
    data: '2026-01-10',
    importo: 120,
    importo_centesimi: 12000,
    segno: '-' as const,
    descrizione: 'Spesa pulizia scale',
    stato_spesa: 'REGISTRATA' as const,
    storno_di_id: null,
  };

  // 1. Primo storno: lecito, genera scrittura uguale e contraria (segno '+') con saldo netto zero
  const storno1 = creaScritturaStorno({
    movimentoOriginale,
    motivoStorno: 'Fattura errata emessa due volte',
    autoreId: 'admin-1',
    dataStorno: '2026-01-15',
  });
  assert.equal(storno1.saldoNettoCent, 0);
  assert.equal(storno1.scritturaContraria.segno, '+');
  assert.equal(storno1.scritturaContraria.importo_centesimi, 12000);
  assert.equal(storno1.scritturaContraria.storno_di_id, 'mov-1');
  assert.equal(storno1.patchMovimentoOriginale.stato_spesa, 'STORNATA');

  // 2. Tentativo di stornare una scrittura già stornata (stato_spesa: 'STORNATA')
  const giaStornato = {
    ...movimentoOriginale,
    stato_spesa: 'STORNATA' as const,
  };
  assert.throws(
    () =>
      creaScritturaStorno({
        movimentoOriginale: giaStornato,
        motivoStorno: 'Secondo storno vietato',
        dataStorno: '2026-01-16',
      }),
    (err: unknown) => err instanceof ErroreStornoNonConsentito,
  );

  // 3. Tentativo di stornare uno storno stesso (storno_di_id valorizzato)
  const scritturaDiStorno = {
    id: 'mov-storno-1',
    condominio_id: 'condo-1',
    esercizio_id: 'es-2026',
    data: '2026-01-15',
    importo: 120,
    importo_centesimi: 12000,
    segno: '+' as const,
    descrizione: '[STORNO] Spesa pulizia scale',
    stato_spesa: 'REGISTRATA' as const,
    storno_di_id: 'mov-1',
  };
  assert.throws(
    () =>
      creaScritturaStorno({
        movimentoOriginale: scritturaDiStorno,
        motivoStorno: 'Tentativo annullo dello storno',
        dataStorno: '2026-01-17',
      }),
    (err: unknown) => err instanceof ErroreStornoNonConsentito,
  );
});

test('Audit Contabilità - Edge Case 2: Rettifica Bollettino con incassi pregressi ed eccedenza (RC-E4, T11)', () => {
  const bollettinoOriginale = {
    id: 'bol-1',
    condominio_id: 'condo-1',
    esercizio_id: 'ese-1',
    anno: 2026,
    numero_progressivo: 1,
    intestazione_destinatario: 'Mario Rossi',
    data_scadenza: '2026-03-31',
    data_emissione: '2026-01-15',
    stato: 'PARZIALMENTE_PAGATO' as const,
    totale_centesimi: 20000, // 200 €
    importo_pagato_centesimi: 15000, // 150 € già incassati
  };

  // Caso A: Rettifica a importo superiore al già pagato (es. 180 €)
  const rettificaA = rettificaBollettinoEmesso({
    bollettinoOriginale,
    nuovoTotaleCent: 18000,
    motivoRettifica: 'Ricalcolo quota millesimale',
  });
  assert.equal(rettificaA.nuovoBollettino.totale_centesimi, 18000);
  assert.equal(rettificaA.nuovoBollettino.importo_pagato_centesimi, 15000);
  assert.equal(rettificaA.saldoResiduoCent, 3000); // 30 € residui da pagare
  assert.equal(rettificaA.creditoEccedenteCent, 0);
  assert.equal(rettificaA.nuovoBollettino.stato, 'PARZIALMENTE_PAGATO');
  assert.equal(rettificaA.bollettinoOriginaleAnnullato.stato, 'ANNULLATO');
  assert.equal(rettificaA.nuovoBollettino.sostituisce_id, 'bol-1');

  // Caso B: Rettifica a importo inferiore al già incassato (es. 100 €, con 150 € già pagati)
  const rettificaB = rettificaBollettinoEmesso({
    bollettinoOriginale,
    nuovoTotaleCent: 10000,
    motivoRettifica: 'Sgravio straordinario approvato',
  });
  assert.equal(rettificaB.nuovoBollettino.totale_centesimi, 10000);
  assert.equal(rettificaB.nuovoBollettino.importo_pagato_centesimi, 15000); // Trascina l'intero incasso
  assert.equal(rettificaB.saldoResiduoCent, 0);
  assert.equal(rettificaB.creditoEccedenteCent, 5000); // 50 € di credito generato per il condomino
  assert.equal(rettificaB.nuovoBollettino.stato, 'PAGATO');

  // Caso C: Validazione importi rettifica non validi (zero o negativi) sollevano RangeError
  assert.throws(
    () =>
      rettificaBollettinoEmesso({
        bollettinoOriginale,
        nuovoTotaleCent: 0,
        motivoRettifica: 'Importo zero non consentito',
      }),
    RangeError,
  );
  assert.throws(
    () =>
      rettificaBollettinoEmesso({
        bollettinoOriginale,
        nuovoTotaleCent: -500,
        motivoRettifica: 'Importo negativo non consentito',
      }),
    RangeError,
  );
});

test('Audit Contabilità - Edge Case 3: Validazione T16 emissione rate da preventivo BOZZA con override', () => {
  // 1. Senza override: bloccato da T16
  const noOverride = validaEmissioneRateDaPreventivo({
    statoPreventivo: 'BOZZA',
    tipoGestione: 'ORDINARIA',
  });
  assert.equal(noOverride.consentita, false);
  assert.equal(noOverride.emissioneBloccata, true);
  assert.equal(noOverride.codiceBlocco, 'PREVENTIVO_NON_APPROVATO');

  // 2. Con flag override ma SENZA delibera o SENZA motivo: bloccato per OVERRIDE_INCOMPLETO
  const overrideSenzaDelibera = validaEmissioneRateDaPreventivo({
    statoPreventivo: 'BOZZA',
    tipoGestione: 'ORDINARIA',
    emessaConOverride: true,
    motivoOverride: 'Emissione urgente acconti di cassa per evitare interruzione riscaldamento',
    deliberaOverride: '', // Mancante!
  });
  assert.equal(overrideSenzaDelibera.consentita, false);
  assert.equal(overrideSenzaDelibera.emissioneBloccata, true);
  assert.equal(overrideSenzaDelibera.codiceBlocco, 'OVERRIDE_INCOMPLETO');

  // 3. Con override completo di motivo e delibera: autorizzato
  const overrideCompleto = validaEmissioneRateDaPreventivo({
    statoPreventivo: 'BOZZA',
    tipoGestione: 'ORDINARIA',
    emessaConOverride: true,
    motivoOverride: 'Emissione urgente acconti di cassa per evitare interruzione riscaldamento',
    deliberaOverride: 'Delibera assembleare del 15/01/2026 punto 2',
  });
  assert.equal(overrideCompleto.consentita, true);
  assert.equal(overrideCompleto.emissioneBloccata, false);
  assert.equal(overrideCompleto.emessaConOverride, true);
  assert.equal(overrideCompleto.codiceBlocco, null);
});

test('Audit Contabilità - Edge Case 4: Imputazione FIFO vs LIFO ed art. 1180 c.c. (terzo pagatore)', () => {
  const debitiSoggetto = [
    {
      id: 'rata-1',
      tipoDebito: 'RATA' as const,
      unitaId: 'unita-1',
      esercizioId: 'es-2026',
      annoCompetenza: 2026,
      numeroRata: 1,
      dataScadenza: '2026-01-31',
      dataEsigibilita: '2026-01-31',
      importoDovutoCent: 10000,
      importoPagatoCent: 0,
      utenteId: 'user-proprietario',
      soggettoId: 'sogg-proprietario',
    },
    {
      id: 'rata-2',
      tipoDebito: 'RATA' as const,
      unitaId: 'unita-1',
      esercizioId: 'es-2026',
      annoCompetenza: 2026,
      numeroRata: 2,
      dataScadenza: '2026-03-31',
      dataEsigibilita: '2026-03-31',
      importoDovutoCent: 10000,
      importoPagatoCent: 0,
      utenteId: 'user-proprietario',
      soggettoId: 'sogg-proprietario',
    },
  ];

  // Incasso parziale di 150 € (15000 centesimi) versato da un terzo (es. conduttore)
  // Imputazione FIFO (PIU_VECCHIO, dal debito più vecchio, art. 1193 c.c.)
  const resFifo = imputaIncasso({
    condominioId: 'condo-1',
    dataValuta: '2026-02-15',
    importoIncassoCent: 15000,
    ordineImputazione: 'FIFO',
    debitoreNome: 'Mario Rossi',
    pagatoreNome: 'Luigi Bianchi (Inquilino terzo)',
    isPagamentoDaTerzo: true,
    pagatoreRelazione: 'TERZO',
    debiti: debitiSoggetto,
  });

  assert.equal(resFifo.ordineImputazioneApplicato, 'PIU_VECCHIO');
  assert.equal(resFifo.pagatore.isPagamentoDaTerzo, true);
  assert.equal(resFifo.totaleImputatoCent, 15000);
  assert.equal(resFifo.imputazioni[0]?.debitoId, 'rata-1');
  assert.equal(resFifo.imputazioni[0]?.importoImputatoCent, 10000);
  assert.equal(resFifo.imputazioni[0]?.nuovoResiduoCent, 0);
  assert.equal(resFifo.imputazioni[1]?.debitoId, 'rata-2');
  assert.equal(resFifo.imputazioni[1]?.importoImputatoCent, 5000);
  assert.equal(resFifo.imputazioni[1]?.nuovoResiduoCent, 5000);

  // Imputazione LIFO (PIU_RECENTE, dal debito più recente)
  const resLifo = imputaIncasso({
    condominioId: 'condo-1',
    dataValuta: '2026-02-15',
    importoIncassoCent: 15000,
    ordineImputazione: 'LIFO',
    debitoreNome: 'Mario Rossi',
    pagatoreNome: 'Luigi Bianchi (Inquilino terzo)',
    isPagamentoDaTerzo: true,
    pagatoreRelazione: 'TERZO',
    debiti: debitiSoggetto,
  });

  assert.equal(resLifo.ordineImputazioneApplicato, 'PIU_RECENTE');
  assert.equal(resLifo.imputazioni[0]?.debitoId, 'rata-2'); // Rata 2 saldata per prima
  assert.equal(resLifo.imputazioni[0]?.importoImputatoCent, 10000);
  assert.equal(resLifo.imputazioni[0]?.nuovoResiduoCent, 0);
  assert.equal(resLifo.imputazioni[1]?.debitoId, 'rata-1');
  assert.equal(resLifo.imputazioni[1]?.importoImputatoCent, 5000);
  assert.equal(resLifo.imputazioni[1]?.nuovoResiduoCent, 5000);
});

test('Audit Contabilità - Edge Case 5: Riparto Millesimale e Quadratura centesimi', () => {
  const millesimiUnita = [
    { unitaId: 'u-1', millesimi: 333.33 },
    { unitaId: 'u-2', millesimi: 333.33 },
    { unitaId: 'u-3', millesimi: 333.34 },
  ];
  const importoSpesaCent = 100000; // 1.000,00 €

  const riparto = ripartisciSpesa({
    importoCent: importoSpesaCent,
    quoteMillesimi: millesimiUnita,
    totaleAttesoMillesimi: 1000.0,
    richiediQuadratura: true,
  });

  const sommaQuote = riparto.quote.reduce((acc, q) => acc + q.quotaFinaleCent, 0);
  assert.equal(sommaQuote, importoSpesaCent, 'La somma delle quote millesimali deve quadrare al singolo centesimo');
});
