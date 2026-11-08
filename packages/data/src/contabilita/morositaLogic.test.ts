import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  aggiungiGiorniIso,
  aggiungiMesiCalendarioIso,
  analizzaMorositaCondominio,
  calcolaAnzianitaDebito,
  calcolaConguagliSenzaRedistribuzioneMorosi,
  calcolaDataEsigibilitaCredito,
  calcolaScadenzeRecuperoCredito,
  creaVoceScadenziarioRecupero,
  ErroreDispensaRecuperoSenzaDelibera,
  ErroreImputazioneIncassoNonValida,
  ErroreIncassoNonValido,
  ErroreRedistribuzioneMorositaVietata,
  ErroreStornoIncassoNonValido,
  ErroreTransizioneRecuperoCreditiNonValida,
  generaElencoMorosiPerCreditori,
  imputaIncasso,
  normalizzaOrdineImputazione,
  normalizzaStatoRecuperoCredito,
  ordinaDebitiPerImputazione,
  stornaIncassoRespinto,
  transitaStatoRecuperoCredito,
} from './morositaLogic.ts';
import { createContabilitaService } from './contabilitaService.ts';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';

// ============================================================================
// 1. IMPUTAZIONE INCASSO (FIFO DEFAULT, MANUALE, PARZIALE, TERZO) E STORNO (RC-F1..F4)
// ============================================================================

describe('Imputazione incasso configurabile, pagamento da terzo e storno (RC-F1..F4)', () => {
  const debitiSoggetto = [
    {
      id: 'rata-2026-q2',
      tipoDebito: 'RATA' as const,
      unitaId: 'unita-1',
      esercizioId: 'es-2026',
      annoCompetenza: 2026,
      numeroRata: 2,
      dataScadenza: '2026-06-30',
      dataEsigibilita: '2026-06-30',
      importoDovutoCent: 30_000, // 300,00 €
      importoPagatoCent: 0,
      utenteId: 'user-proprietario',
      soggettoId: 'sogg-proprietario',
    },
    {
      id: 'saldo-2025',
      tipoDebito: 'SALDO_PREGRESSO' as const,
      unitaId: 'unita-1',
      esercizioId: 'es-2025',
      annoCompetenza: 2025,
      dataScadenza: '2025-12-31',
      dataEsigibilita: '2025-12-31',
      importoDovutoCent: 20_000, // 200,00 €
      importoPagatoCent: 0,
      utenteId: 'user-proprietario',
      soggettoId: 'sogg-proprietario',
    },
    {
      id: 'rata-2026-q1',
      tipoDebito: 'RATA' as const,
      unitaId: 'unita-1',
      esercizioId: 'es-2026',
      annoCompetenza: 2026,
      numeroRata: 1,
      dataScadenza: '2026-03-31',
      dataEsigibilita: '2026-03-31',
      importoDovutoCent: 30_000, // 300,00 €
      importoPagatoCent: 0,
      utenteId: 'user-proprietario',
      soggettoId: 'sogg-proprietario',
    },
  ];

  it('normalizza gli ordini di imputazione (PIU_VECCHIO / FIFO, PIU_RECENTE / LIFO, MANUALE)', () => {
    assert.equal(normalizzaOrdineImputazione(), 'PIU_VECCHIO');
    assert.equal(normalizzaOrdineImputazione('FIFO'), 'PIU_VECCHIO');
    assert.equal(normalizzaOrdineImputazione('LIFO'), 'PIU_RECENTE');
    assert.equal(normalizzaOrdineImputazione('MANUALE'), 'MANUALE');
    assert.throws(() => normalizzaOrdineImputazione('CASUALE'), TypeError);
  });

  it('ordina i debiti dal più vecchio al più recente per default (FIFO, RC-F2)', () => {
    const ordinatiFifo = ordinaDebitiPerImputazione(debitiSoggetto, 'PIU_VECCHIO');
    assert.deepEqual(
      ordinatiFifo.map((d) => d.id),
      ['saldo-2025', 'rata-2026-q1', 'rata-2026-q2'],
    );

    const ordinatiLifo = ordinaDebitiPerImputazione(debitiSoggetto, 'PIU_RECENTE');
    assert.deepEqual(
      ordinatiLifo.map((d) => d.id),
      ['rata-2026-q2', 'rata-2026-q1', 'saldo-2025'],
    );
  });

  it('imputa per default in FIFO sul debito più vecchio gestendo incasso parziale sul secondo debito (RC-F1, RC-F2, RC-F3)', () => {
    // Incasso di 350,00 € (35.000 cent):
    // - Salda interamente saldo-2025 (200,00 €)
    // - Copre parzialmente rata-2026-q1 per 150,00 € (residuo 150,00 €)
    // - Lascia intatta rata-2026-q2 (residuo 300,00 €)
    const esito = imputaIncasso({
      incassoId: 'tx-101',
      condominioId: 'condo-1',
      dataValuta: '2026-04-10',
      importoIncassoCent: 35_000,
      contoAccredito: 'IT60X0542811101000000123456',
      riferimentoCro: 'CRO20260410001',
      debitoreUtenteId: 'user-proprietario',
      debitoreSoggettoId: 'sogg-proprietario',
      debitoreNome: 'Mario Rossi',
      pagatoreNome: 'Mario Rossi',
      pagatoreUtenteId: 'user-proprietario',
      debiti: debitiSoggetto,
    });

    assert.equal(esito.ordineImputazioneApplicato, 'PIU_VECCHIO');
    assert.equal(esito.totaleImputatoCent, 35_000);
    assert.equal(esito.creditoEccedenteSoggettoCent, 0);
    assert.equal(esito.haEccedenza, false);
    assert.equal(esito.haImputazioneParziale, true);
    assert.equal(esito.pagatore.isPagamentoDaTerzo, false);
    assert.equal(esito.statoRiconciliazioneTransazione, 'RICONCILIATA');

    assert.equal(esito.imputazioni.length, 2);
    assert.equal(esito.imputazioni[0]?.debitoId, 'saldo-2025');
    assert.equal(esito.imputazioni[0]?.importoImputatoCent, 20_000);
    assert.equal(esito.imputazioni[0]?.nuovoResiduoCent, 0);
    assert.equal(esito.imputazioni[0]?.saldatoIntegralmente, true);
    assert.equal(esito.imputazioni[0]?.nuovoStatoRataModello, 'PAGATA');

    assert.equal(esito.imputazioni[1]?.debitoId, 'rata-2026-q1');
    assert.equal(esito.imputazioni[1]?.importoImputatoCent, 15_000);
    assert.equal(esito.imputazioni[1]?.nuovoResiduoCent, 15_000);
    assert.equal(esito.imputazioni[1]?.isParziale, true);
    assert.equal(esito.imputazioni[1]?.nuovoStatoRataModello, 'PARZIALMENTE_PAGATA');
  });

  it('consente l’imputazione manuale dell’amministratore su debiti specifici (RC-F2)', () => {
    const esito = imputaIncasso({
      condominioId: 'condo-1',
      dataValuta: '2026-07-02',
      importoIncassoCent: 30_000, // 300,00 €
      pagatoreNome: 'Mario Rossi',
      ordineImputazione: 'MANUALE',
      debiti: debitiSoggetto,
      imputazioniManuali: [
        { debitoId: 'rata-2026-q2', importoCent: 20_000 },
        { debitoId: 'rata-2026-q1', importoCent: 10_000 },
      ],
    });

    assert.equal(esito.ordineImputazioneApplicato, 'MANUALE');
    assert.equal(esito.totaleImputatoCent, 30_000);
    assert.equal(esito.imputazioni.length, 2);

    const impQ2 = esito.imputazioni.find((i) => i.debitoId === 'rata-2026-q2')!;
    const impQ1 = esito.imputazioni.find((i) => i.debitoId === 'rata-2026-q1')!;
    assert.equal(impQ2.importoImputatoCent, 20_000);
    assert.equal(impQ2.nuovoResiduoCent, 10_000);
    assert.equal(impQ2.metodoMatching, 'MANUALE');

    assert.equal(impQ1.importoImputatoCent, 10_000);
    assert.equal(impQ1.nuovoResiduoCent, 20_000);
    assert.equal(impQ1.metodoMatching, 'MANUALE');

    // Il saldo 2025 non toccato manualmente resta a residuo 200,00 €
    const saldo2025 = esito.debitiAggiornati.find((d) => d.id === 'saldo-2025')!;
    assert.equal(saldo2025.residuoCent, 20_000);
  });

  it('gestisce l’incasso eccedente generando un credito a favore del soggetto e traccia il pagamento per conto terzi (es. inquilino per il proprietario, RC-F3)', () => {
    // Totale debiti = 200 + 300 + 300 = 800,00 € (80.000 cent)
    // Bonifico eseguito dall'inquilino di 950,00 € (95.000 cent) -> 150,00 € di credito eccedente
    const esito = imputaIncasso({
      condominioId: 'condo-1',
      dataValuta: '2026-07-10',
      importoIncassoCent: 95_000,
      riferimentoCro: 'CRO-INQUILINO-99',
      debitoreUtenteId: 'user-proprietario',
      debitoreSoggettoId: 'sogg-proprietario',
      debitoreNome: 'Mario Rossi (Proprietario)',
      pagatoreNome: 'Luca Verdi (Inquilino Int. 1)',
      pagatoreUtenteId: 'user-inquilino',
      pagatoreRelazione: 'CONDUTTORE',
      debiti: debitiSoggetto,
    });

    assert.equal(esito.totaleImputatoCent, 80_000);
    assert.equal(esito.creditoEccedenteSoggettoCent, 15_000); // 150,00 € a credito del soggetto
    assert.equal(esito.creditoEccedenteSoggettoEuro, 150);
    assert.equal(esito.haEccedenza, true);
    assert.equal(esito.pagatore.isPagamentoDaTerzo, true);
    assert.equal(esito.pagatore.relazione, 'CONDUTTORE');
    assert.equal(esito.pagatore.nome, 'Luca Verdi (Inquilino Int. 1)');
    assert.equal(esito.debitore.utenteId, 'user-proprietario');
    assert.equal(esito.statoRiconciliazioneTransazione, 'PARZIALE');
  });

  it('storna un incasso per assegno/bonifico respinto con scrittura contraria collegata e riapertura del debito (RC-F4)', () => {
    const esitoStorno = stornaIncassoRespinto({
      incassoOriginaleId: 'tx-101',
      condominioId: 'condo-1',
      importoOriginaleCent: 35_000,
      dataValutaOriginale: '2026-04-10',
      dataStorno: '2026-04-18',
      motivoStorno: 'Assegno bancario insoluto / respinto per mancanza fondi',
      pagatoreNome: 'Mario Rossi',
      riferimentoCroOriginale: 'ASS-88421',
      giustificazioniImputazione: [
        {
          debitoId: 'saldo-2025',
          tipoDebito: 'SALDO_PREGRESSO',
          unitaId: 'unita-1',
          importoDovutoCent: 20_000,
          importoPagatoAttualeCent: 20_000,
          importoImputatoDaIncassoCent: 20_000,
        },
        {
          debitoId: 'rata-2026-q1',
          tipoDebito: 'RATA',
          unitaId: 'unita-1',
          importoDovutoCent: 30_000,
          importoPagatoAttualeCent: 15_000,
          importoImputatoDaIncassoCent: 15_000,
        },
      ],
      autoreId: 'admin-1',
    });

    assert.equal(esitoStorno.scritturaStornoTransazione.storno_di_id, 'tx-101');
    assert.equal(esitoStorno.scritturaStornoTransazione.importo_centesimi, -35_000);
    assert.equal(esitoStorno.totaleDebitoRiapertoCent, 35_000);
    assert.equal(esitoStorno.saldoNettoIncassoCent, 0);

    // Entrambi i debiti sono stati riaperti al loro residuo originario
    assert.equal(esitoStorno.debitiRiaperti[0]?.debitoId, 'saldo-2025');
    assert.equal(esitoStorno.debitiRiaperti[0]?.nuovoImportoPagatoCent, 0);
    assert.equal(esitoStorno.debitiRiaperti[0]?.nuovoResiduoCent, 20_000);
    assert.equal(esitoStorno.debitiRiaperti[0]?.debitoRiaperto, true);
    assert.equal(esitoStorno.debitiRiaperti[0]?.nuovoStatoRataModello, 'EMESSA');

    assert.equal(esitoStorno.debitiRiaperti[1]?.debitoId, 'rata-2026-q1');
    assert.equal(esitoStorno.debitiRiaperti[1]?.nuovoImportoPagatoCent, 0);
    assert.equal(esitoStorno.debitiRiaperti[1]?.nuovoResiduoCent, 30_000);
    assert.equal(esitoStorno.debitiRiaperti[1]?.debitoRiaperto, true);
    assert.equal(esitoStorno.eventoAudit.azione, 'STORNO_INCASSO_RIAPERTURA_DEBITO');
  });

  it('rifiuta incassi o storni non validi con errori tipizzati', () => {
    assert.throws(
      () =>
        imputaIncasso({
          condominioId: 'condo-1',
          dataValuta: '2026-04-10',
          importoIncassoCent: 0,
          pagatoreNome: 'Mario Rossi',
          debiti: [],
        }),
      ErroreIncassoNonValido,
    );

    assert.throws(
      () =>
        imputaIncasso({
          condominioId: 'condo-1',
          dataValuta: '2026-04-10',
          importoIncassoCent: 50_000,
          pagatoreNome: 'Mario Rossi',
          ordineImputazione: 'MANUALE',
          debiti: debitiSoggetto,
          imputazioniManuali: [{ debitoId: 'saldo-2025', importoCent: 25_000 }], // supera il residuo di 20.000
        }),
      ErroreImputazioneIncassoNonValida,
    );

    assert.throws(
      () =>
        stornaIncassoRespinto({
          incassoOriginaleId: 'tx-101',
          condominioId: 'condo-1',
          importoOriginaleCent: 20_000,
          dataValutaOriginale: '2026-04-10',
          dataStorno: '2026-04-18',
          motivoStorno: '',
          giustificazioniImputazione: [],
        }),
      ErroreStornoIncassoNonValido,
    );
  });
});

// ============================================================================
// 2. ESIGIBILITA' CREDITI E ANZIANITA' DEL DEBITO (RC-G1, RC-G2)
// ============================================================================

describe('Esigibilità crediti e calcolo anzianità del debito per soggetto, unità ed esercizio (RC-G1, RC-G2)', () => {
  it('determina l’esigibilità delle rate alla scadenza (default) o dopo approvazione consuntivo, e del conguaglio dopo approvazione consuntivo (RC-G2)', () => {
    // Rata preventivo con default SCADENZA_RATA -> esigibile alla data di scadenza
    assert.equal(
      calcolaDataEsigibilitaCredito({
        tipoCredito: 'RATA',
        dataScadenza: '2026-03-31',
        criterioEsigibilitaRatePreventivo: 'SCADENZA_RATA',
      }),
      '2026-03-31',
    );

    // Rata preventivo con configurazione APPROVAZIONE_CONSUNTIVO e consuntivo non ancora approvato -> null
    assert.equal(
      calcolaDataEsigibilitaCredito({
        tipoCredito: 'RATA',
        dataScadenza: '2026-03-31',
        dataApprovazioneConsuntivo: null,
        criterioEsigibilitaRatePreventivo: 'APPROVAZIONE_CONSUNTIVO',
      }),
      null,
    );

    // Conguaglio -> esigibile solo dopo approvazione del consuntivo
    assert.equal(
      calcolaDataEsigibilitaCredito({
        tipoCredito: 'CONGUAGLIO',
        dataApprovazioneConsuntivo: null,
      }),
      null,
    );
    assert.equal(
      calcolaDataEsigibilitaCredito({
        tipoCredito: 'CONGUAGLIO',
        dataApprovazioneConsuntivo: '2027-03-15',
      }),
      '2027-03-15',
    );
  });

  it('aggrega lo stato del debito e l’anzianità per soggetto, unità ed esercizio (RC-G1)', () => {
    const crediti = [
      {
        id: 'cred-2025-u1',
        tipoCredito: 'SALDO_PREGRESSO' as const,
        unitaId: 'unita-1',
        unitaInterno: 'Int. 1',
        esercizioId: 'es-2025',
        annoCompetenza: 2025,
        utenteId: 'user-bianchi',
        soggettoId: 'sogg-bianchi',
        nomeSoggetto: 'Laura Bianchi',
        importoDovutoCent: 40_000, // 400,00 €
        importoPagatoCent: 10_000, // 100,00 € -> residuo 300,00 €
        dataEsigibilita: '2025-12-31',
      },
      {
        id: 'cred-2026-u1-scaduta',
        tipoCredito: 'RATA' as const,
        unitaId: 'unita-1',
        unitaInterno: 'Int. 1',
        esercizioId: 'es-2026',
        annoCompetenza: 2026,
        utenteId: 'user-bianchi',
        soggettoId: 'sogg-bianchi',
        nomeSoggetto: 'Laura Bianchi',
        importoDovutoCent: 25_000, // 250,00 € esigibili
        importoPagatoCent: 0,
        dataScadenza: '2026-03-31',
      },
      {
        id: 'cred-2026-u2-futura',
        tipoCredito: 'RATA' as const,
        unitaId: 'unita-2',
        unitaInterno: 'Int. 2',
        esercizioId: 'es-2026',
        annoCompetenza: 2026,
        utenteId: 'user-bianchi',
        soggettoId: 'sogg-bianchi',
        nomeSoggetto: 'Laura Bianchi',
        importoDovutoCent: 20_000, // 200,00 € non ancora scaduta al 2026-05-10
        importoPagatoCent: 0,
        dataScadenza: '2026-09-30',
      },
    ];

    const analisi = analizzaMorositaCondominio({
      crediti,
      dataRiferimento: '2026-05-10',
    });

    // Totale residuo = 300 + 250 + 200 = 750,00 €, di cui esigibili = 550,00 € e non esigibili = 200,00 €
    assert.equal(analisi.totaleResiduoComplessivoCent, 75_000);
    assert.equal(analisi.totaleMorositaEsigibileCent, 55_000);
    assert.equal(analisi.totaleNonAncoraEsigibileCent, 20_000);

    // Anzianità massima dal 2025-12-31 al 2026-05-10 = 130 giorni (fascia 91_180_GG)
    assert.equal(analisi.anzianitaMassimaCondominioGiorni, 130);

    // Riepilogo per soggetto (Laura Bianchi ha 2 unità e 2 anni di competenza)
    assert.equal(analisi.perSoggetto.length, 1);
    const sogg = analisi.perSoggetto[0]!;
    assert.equal(sogg.totaleEsigibileCent, 55_000);
    assert.equal(sogg.totaleNonEsigibileCent, 20_000);
    assert.equal(sogg.anzianitaMassimaGiorni, 130);
    assert.equal(sogg.fasciaMassima, '91_180_GG');
    assert.deepEqual(sogg.anniCompetenza, [2025, 2026]);

    // Riepilogo per unità
    assert.equal(analisi.perUnita.length, 2);
    const u1 = analisi.perUnita.find((u) => u.unitaId === 'unita-1')!;
    const u2 = analisi.perUnita.find((u) => u.unitaId === 'unita-2')!;
    assert.equal(u1.totaleEsigibileCent, 55_000);
    assert.equal(u2.totaleEsigibileCent, 0);
    assert.equal(u2.totaleNonEsigibileCent, 20_000);

    // Riepilogo per esercizio/anno
    assert.equal(analisi.perAnnoEsercizio.length, 2);
    assert.equal(analisi.perAnnoEsercizio[0]?.annoCompetenza, 2025);
    assert.equal(analisi.perAnnoEsercizio[0]?.totaleEsigibileCent, 30_000);
    assert.equal(analisi.perAnnoEsercizio[1]?.annoCompetenza, 2026);
    assert.equal(analisi.perAnnoEsercizio[1]?.totaleEsigibileCent, 25_000);
  });
});

// ============================================================================
// 3. SCADENZIARIO RECUPERO CREDITI ART. 1129 C. 9 E CASO DI TEST T12 (RC-G3, T12)
// ============================================================================

describe('Scadenziario recupero crediti ex art. 1129 c. 9 c.c. — Caso di test T12 (RC-G3, T12)', () => {
  it('T12: Esercizio chiuso il 31/12/2026 -> limite 30/6/2027; alert 1/4, 31/5 e 23/6/2027; con dispensa stato "dispensata" e nessun alert', () => {
    const scadenze = calcolaScadenzeRecuperoCredito({
      dataChiusuraEsercizio: '2026-12-31',
    });

    assert.equal(scadenze.dataDecorrenzaSemestre, '2026-12-31');
    assert.equal(scadenze.dataLimiteAzione, '2027-06-30'); // 30/6/2027
    assert.equal(scadenze.alert90ggAt, '2027-04-01'); // 1/4/2027
    assert.equal(scadenze.alert30ggAt, '2027-05-31'); // 31/5/2027
    assert.equal(scadenze.alert7ggAt, '2027-06-23'); // 23/6/2027

    // Creazione voce in stato iniziale "da avviare" valutata al 2027-06-01 (dopo alert 90gg e 30gg)
    const voceDaAvviare = creaVoceScadenziarioRecupero(
      {
        id: 'scad-t12',
        condominioId: 'condo-1',
        esercizioId: 'es-2026',
        unitaId: 'unita-3',
        soggettoId: 'sogg-moroso',
        importoEsigibileCent: 120_000, // 1.200,00 €
        dataEsigibilita: '2026-12-31',
        dataChiusuraEsercizio: '2026-12-31',
      },
      '2027-06-01',
    );

    assert.equal(voceDaAvviare.stato, 'DA_AVVIARE');
    assert.equal(voceDaAvviare.statoTesto, 'da avviare');
    assert.equal(voceDaAvviare.alertAbilitati, true);
    assert.equal(voceDaAvviare.alertProgrammati.length, 3);
    assert.deepEqual(
      voceDaAvviare.alertScattati.map((a) => a.codice),
      ['ALERT_90_GG', 'ALERT_30_GG'],
    );

    // Con dispensa assembleare -> stato "dispensata" e nessun alert (T12)
    const esitoDispensa = transitaStatoRecuperoCredito({
      voceCorrente: voceDaAvviare,
      nuovoStato: 'dispensata',
      dataDispensa: '2027-03-20',
      deliberaDispensa: 'Verbale Assemblea 20/03/2027 - Punto 5 OdG (Piano rientro concordato)',
      autoreId: 'admin-1',
    });

    assert.equal(esitoDispensa.voceAggiornata.stato, 'DISPENSATO');
    assert.equal(esitoDispensa.voceAggiornata.statoTesto, 'dispensata');
    assert.equal(esitoDispensa.voceAggiornata.alertAbilitati, false);
    assert.deepEqual(esitoDispensa.voceAggiornata.alertProgrammati, []);
    assert.deepEqual(esitoDispensa.voceAggiornata.alertScattati, []);
    assert.equal(esitoDispensa.eventoAudit.azione, 'DISPENSA_ASSEMBLEARE_RECUPERO_CREDITI');
  });

  it('richiede obbligatoriamente data e delibera per la dispensa e gestisce il ciclo da avviare -> avviata -> chiusa (RC-G3)', () => {
    const voce = creaVoceScadenziarioRecupero({
      id: 'scad-2',
      condominioId: 'condo-1',
      esercizioId: 'es-2026',
      unitaId: 'unita-3',
      importoEsigibileCent: 80_000,
      dataEsigibilita: '2026-10-31',
      dataChiusuraEsercizio: '2026-12-31',
    });

    // Dispensa senza delibera -> bloccata
    assert.throws(
      () =>
        transitaStatoRecuperoCredito({
          voceCorrente: voce,
          nuovoStato: 'dispensata',
          dataDispensa: '2027-02-10',
          deliberaDispensa: '',
        }),
      ErroreDispensaRecuperoSenzaDelibera,
    );

    // da avviare -> avviata
    const avviata = transitaStatoRecuperoCredito({
      voceCorrente: voce,
      nuovoStato: 'avviata',
      dataAvvioAzione: '2027-04-15',
      note: 'Conferito mandato a studio legale per decreto ingiuntivo ex art. 63 disp. att.',
    });
    assert.equal(avviata.voceAggiornata.stato, 'AVVIATO');
    assert.equal(avviata.voceAggiornata.statoTesto, 'avviata');
    assert.equal(avviata.voceAggiornata.data_avvio_azione, '2027-04-15');

    // avviata -> chiusa
    const chiusa = transitaStatoRecuperoCredito({
      voceCorrente: avviata.voceAggiornata,
      nuovoStato: 'chiusa',
      dataChiusura: '2027-06-10',
      note: 'Credito integralmente recuperato',
    });
    assert.equal(chiusa.voceAggiornata.stato, 'CHIUSO');
    assert.equal(chiusa.voceAggiornata.statoTesto, 'chiusa');

    // chiusa -> avviata non consentita
    assert.throws(
      () =>
        transitaStatoRecuperoCredito({
          voceCorrente: chiusa.voceAggiornata,
          nuovoStato: 'avviata',
          dataAvvioAzione: '2027-06-12',
        }),
      ErroreTransizioneRecuperoCreditiNonValida,
    );
  });

  it('verifica le funzioni ausiliarie di calendario e normalizzazione stato', () => {
    assert.equal(aggiungiMesiCalendarioIso('2026-12-31', 6), '2027-06-30');
    assert.equal(aggiungiGiorniIso('2027-06-30', -90), '2027-04-01');
    assert.equal(normalizzaStatoRecuperoCredito('da avviare').statoDb, 'DA_AVVIARE');
    assert.equal(normalizzaStatoRecuperoCredito('AVVIATO').statoTesto, 'avviata');
  });
});

// ============================================================================
// 4. ELENCO MOROSI PER I CREDITORI EX ART. 63 C. 1 DISP. ATT. (RC-G4)
// ============================================================================

describe('Elenco morosi per i creditori non soddisfatti ex art. 63 c. 1 disp. att. c.c. (RC-G4)', () => {
  it('include solo i condòmini con morosità esigibile > 0 con nome, cognome, CF e indirizzo da anagrafe e traccia richiesta/risposta in audit', () => {
    const esito = generaElencoMorosiPerCreditori({
      condominioId: 'condo-1',
      dataRiferimento: '2026-06-01',
      crediti: [
        {
          id: 'c-moroso-1',
          tipoCredito: 'RATA',
          unitaId: 'unita-3',
          unitaInterno: 'Int. 3',
          esercizioId: 'es-2026',
          annoCompetenza: 2026,
          soggettoId: 'sogg-moroso',
          utenteId: 'user-moroso',
          nomeSoggetto: 'Paolo Neri',
          obbligatoInSolidoUtenteId: 'user-acquirente',
          importoDovutoCent: 90_000, // 900,00 € scaduti ed esigibili
          importoPagatoCent: 15_000, // residuo esigibile = 750,00 €
          dataScadenza: '2026-03-31',
        },
        {
          id: 'c-in-regola',
          tipoCredito: 'RATA',
          unitaId: 'unita-1',
          unitaInterno: 'Int. 1',
          esercizioId: 'es-2026',
          annoCompetenza: 2026,
          soggettoId: 'sogg-rossi',
          utenteId: 'user-rossi',
          nomeSoggetto: 'Mario Rossi',
          importoDovutoCent: 50_000,
          importoPagatoCent: 50_000, // pagato in regola -> escluso
          dataScadenza: '2026-03-31',
        },
        {
          id: 'c-non-scaduto',
          tipoCredito: 'RATA',
          unitaId: 'unita-2',
          unitaInterno: 'Int. 2',
          esercizioId: 'es-2026',
          annoCompetenza: 2026,
          soggettoId: 'sogg-verdi',
          utenteId: 'user-verdi',
          nomeSoggetto: 'Anna Verdi',
          importoDovutoCent: 40_000,
          importoPagatoCent: 0,
          dataScadenza: '2026-10-31', // non ancora esigibile al 2026-06-01 -> escluso
        },
      ],
      anagraficheSoggetti: [
        {
          soggettoId: 'sogg-moroso',
          utenteId: 'user-moroso',
          nome: 'Paolo',
          cognome: 'Neri',
          nomeDenominazione: 'Paolo Neri',
          codiceFiscale: 'NREPLA75C12F205K',
          indirizzoAnagrafe: 'Via Giuseppe Garibaldi 42',
          cap: '20121',
          citta: 'Milano',
          provincia: 'MI',
        },
      ],
      creditoreRichiedente: {
        ragioneSociale: 'TermoImpianti S.r.l.',
        codiceFiscaleOPiva: '08877660961',
        pecOEmail: 'termoimpianti@pec.it',
        riferimentoFatturaOCredito: 'Fattura n. 44/2026 scaduta il 30/04/2026',
        importoCreditoInsolutoCent: 250_000,
        dataRichiesta: '2026-05-28',
        dataRisposta: '2026-06-01',
      },
      autoreId: 'admin-1',
    });

    assert.equal(esito.numeroMorosi, 1);
    assert.equal(esito.totaleMorositaEsigibileComunicataCent, 75_000); // 750,00 €
    assert.equal(esito.tuttiDatiAnagraficiCompleti, true);

    const moroso = esito.morosi[0]!;
    assert.equal(moroso.nome, 'Paolo');
    assert.equal(moroso.cognome, 'Neri');
    assert.equal(moroso.codiceFiscale, 'NREPLA75C12F205K');
    assert.ok(moroso.indirizzoAnagrafeCompleto?.includes('Via Giuseppe Garibaldi 42'));
    assert.equal(moroso.importoMorositaEsigibileCent, 75_000);
    assert.deepEqual(moroso.obbligatiInSolidoUtenteIds, ['user-acquirente']);
    assert.equal(esito.eventoAudit.azione, 'COMUNICAZIONE_ELENCO_MOROSI_ART_63');
  });
});

// ============================================================================
// 5. PRINCIPIO DI NON REDISTRIBUZIONE DELLE QUOTE MOROSI SUI VIRTUOSI (RC-G5, RC-L4)
// ============================================================================

describe('Principio di non redistribuzione delle quote morosi sui condomini virtuosi (RC-G5, RC-L4)', () => {
  it('mantiene inalterato il conguaglio dei condomini virtuosi, lascia il debito del moroso come credito e copre la liquidità col fondo cassa', () => {
    const risultato = calcolaConguagliSenzaRedistribuzioneMorosi({
      saldoFondoCassaDisponibileCent: 100_000, // 1.000,00 € nel fondo cassa
      unita: [
        {
          unitaId: 'unita-virtuosa-1',
          quotaConsuntivoPropriaCent: 134_000, // 1.340,00 € (T5)
          rateDovutePreventivoCent: 120_000, // 1.200,00 €
          rateVersateProprieCent: 120_000, // 1.200,00 € regolarmente versati
        },
        {
          unitaId: 'unita-morosa-2',
          quotaConsuntivoPropriaCent: 100_000, // 1.000,00 €
          rateDovutePreventivoCent: 90_000, // 900,00 €
          rateVersateProprieCent: 20_000, // solo 200,00 € versati -> 700,00 € di morosità sulle rate
        },
      ],
    });

    assert.equal(risultato.nessunaRedistribuzioneSuVirtuosi, true);

    const virtuoso = risultato.posizioniUnita[0]!;
    const moroso = risultato.posizioniUnita[1]!;

    // Il condòmino virtuoso paga solo il proprio conguaglio (1.340 - 1.200 = 140,00 €), mai la morosità altrui
    assert.equal(virtuoso.conguaglio.conguaglioCent, 14_000); // 140,00 €
    assert.equal(virtuoso.quotaMorositaAltruiApplicataCent, 0);
    assert.equal(virtuoso.isUnitaMorosa, false);

    // La morosità resta a carico esclusivo del moroso (1.000 - 200 = 800,00 € di saldo finale, di cui 700,00 € da rate insolute)
    assert.equal(moroso.morositaPropriaSuRateCent, 70_000);
    assert.equal(moroso.conguaglio.conguaglioCent, 80_000);
    assert.equal(moroso.isUnitaMorosa, true);

    // Il deficit di cassa da rate non incassate (700,00 €) viene coperto dal Fondo Cassa senza toccare i condòmini in regola
    assert.equal(risultato.totaleCreditiVersoMorosiCent, 70_000);
    assert.equal(risultato.coperturaDaFondoCassaCent, 70_000);
    assert.equal(risultato.saldoFondoCassaResiduoCent, 30_000);
    assert.equal(risultato.fabbisognoCassaNonCopertoCent, 0);
  });

  it('blocca con ErroreRedistribuzioneMorositaVietata qualsiasi tentativo di spalmare quote morosi sui condòmini in regola (RC-G5)', () => {
    assert.throws(
      () =>
        calcolaConguagliSenzaRedistribuzioneMorosi({
          unita: [
            {
              unitaId: 'unita-virtuosa-1',
              quotaConsuntivoPropriaCent: 120_000,
              rateDovutePreventivoCent: 120_000,
              rateVersateProprieCent: 120_000,
              quotaMorositaAltruiAddebitataCent: 15_000, // VIETATO
            },
          ],
        }),
      ErroreRedistribuzioneMorositaVietata,
    );
  });
});

// ============================================================================
// 6. INTEGRAZIONE SERVIZIO SUPABASE IN contabilitaService.ts
// ============================================================================

describe('Integrazione metodi incassi e scadenziario in createContabilitaService', () => {
  it('espone i metodi di incasso, storno, morosità, scadenziario recupero, art. 63 e subentro', () => {
    const mockDb = {} as unknown as TypedSupabaseClient;
    const service = createContabilitaService(mockDb);

    assert.equal(typeof service.registraEImputaIncasso, 'function');
    assert.equal(typeof service.stornaIncassoRespinto, 'function');
    assert.equal(typeof service.analizzaMorositaCondominio, 'function');
    assert.equal(typeof service.listScadenziarioRecuperoCrediti, 'function');
    assert.equal(typeof service.creaVoceScadenziarioRecuperoCredito, 'function');
    assert.equal(typeof service.aggiornaStatoScadenziarioRecuperoCredito, 'function');
    assert.equal(typeof service.generaElencoMorosiArt63, 'function');
    assert.equal(typeof service.calcolaConguagliSenzaRedistribuzioneMorosi, 'function');
    assert.equal(typeof service.registraSubentroCompravendita, 'function');
  });
});
