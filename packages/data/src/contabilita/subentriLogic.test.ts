import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcolaConsumiCambioTitolare,
  calcolaRipartoSpesaAPeriodoSubentro,
  ErroreSubentroNonValido,
  instradaRateSuSubentro,
  registraSubentroCompravendita,
  valutaLavoriStraordinariSubentro,
  valutaSolidarietaBiennaleSubentro,
} from './subentriLogic.ts';

// ============================================================================
// 1. VINCOLO DI SOLIDARIETA' BIENNALE EX ART. 63 C. 4 DISP. ATT. E CASO T6 (RC-H2, T6)
// ============================================================================

describe('Subentro per compravendita e solidarietà biennale ex art. 63 c. 4 disp. att. c.c. — Caso T6 (RC-H1, RC-H2, T6)', () => {
  const venditore = {
    utenteId: 'user-venditore',
    soggettoId: 'sogg-venditore',
    nomeDenominazione: 'Paolo Neri (Venditore)',
  };
  const acquirente = {
    utenteId: 'user-acquirente',
    soggettoId: 'sogg-acquirente',
    nomeDenominazione: 'Marco Gialli (Acquirente)',
  };

  it('T6: Atto 15/4/2026 con debiti del 2023, 2025 e 2026 -> Acquirente in solido per 2025 e 2026; il 2023 resta al solo venditore', () => {
    const esito = valutaSolidarietaBiennaleSubentro({
      dataAtto: '2026-04-15',
      venditore,
      acquirente,
      debiti: [
        {
          id: 'deb-2023',
          tipoDebito: 'SALDO_PREGRESSO',
          unitaId: 'unita-3',
          esercizioId: 'es-2023',
          annoCompetenza: 2023,
          descrizione: 'Saldo consuntivo esercizio 2023',
          importoDovutoCent: 45_000, // 450,00 €
          importoPagatoCent: 0,
        },
        {
          id: 'deb-2025',
          tipoDebito: 'SALDO_PREGRESSO',
          unitaId: 'unita-3',
          esercizioId: 'es-2025',
          annoCompetenza: 2025,
          descrizione: 'Saldo consuntivo esercizio 2025 (anno precedente)',
          importoDovutoCent: 60_000, // 600,00 €
          importoPagatoCent: 0,
        },
        {
          id: 'deb-2026',
          tipoDebito: 'RATA',
          unitaId: 'unita-3',
          esercizioId: 'es-2026',
          annoCompetenza: 2026,
          descrizione: 'Rata 1 esercizio 2026 (anno in corso)',
          importoDovutoCent: 30_000, // 300,00 €
          importoPagatoCent: 0,
        },
      ],
    });

    assert.deepEqual(esito.anniBiennioSolidale, [2025, 2026]);

    const deb2023 = esito.debitiValutati.find((d) => d.annoCompetenza === 2023)!;
    const deb2025 = esito.debitiValutati.find((d) => d.annoCompetenza === 2025)!;
    const deb2026 = esito.debitiValutati.find((d) => d.annoCompetenza === 2026)!;

    // 2023: oltre il biennio -> resta a carico esclusivo del solo venditore
    assert.equal(deb2023.rientraNelBiennioArt63, false);
    assert.equal(deb2023.inSolidoConAcquirente, false);
    assert.equal(deb2023.esclusivoVenditoreOltreBiennio, true);
    assert.equal(deb2023.regimeResponsabilita, 'ESCLUSIVO_VENDITORE_OLTRE_BIENNIO');
    assert.equal(deb2023.debitorePrincipale.utenteId, 'user-venditore');
    assert.equal(deb2023.obbligatoInSolido, null);
    assert.equal(deb2023.obbligato_in_solido_utente_id, null);

    // 2025: anno precedente -> acquirente obbligato in solido col venditore
    assert.equal(deb2025.rientraNelBiennioArt63, true);
    assert.equal(deb2025.inSolidoConAcquirente, true);
    assert.equal(deb2025.esclusivoVenditoreOltreBiennio, false);
    assert.equal(deb2025.regimeResponsabilita, 'SOLIDARIETA_BIENNALE_ART_63_C4');
    assert.equal(deb2025.debitorePrincipale.utenteId, 'user-venditore');
    assert.equal(deb2025.obbligatoInSolido?.utenteId, 'user-acquirente');
    assert.equal(deb2025.obbligato_in_solido_utente_id, 'user-acquirente');

    // 2026: anno in corso -> acquirente obbligato in solido col venditore
    assert.equal(deb2026.rientraNelBiennioArt63, true);
    assert.equal(deb2026.inSolidoConAcquirente, true);
    assert.equal(deb2026.esclusivoVenditoreOltreBiennio, false);
    assert.equal(deb2026.debitorePrincipale.utenteId, 'user-venditore');
    assert.equal(deb2026.obbligatoInSolido?.utenteId, 'user-acquirente');
    assert.equal(deb2026.obbligato_in_solido_utente_id, 'user-acquirente');

    // Totali: 600 + 300 = 900,00 € in solido nel biennio; 450,00 € esclusivi del venditore
    assert.equal(esito.totaleInSolidoBiennioCent, 90_000);
    assert.equal(esito.totaleEsclusivoVenditoreOltreBiennioCent, 45_000);
    assert.equal(esito.totaleComplessivoResiduoCent, 135_000);
  });
});

// ============================================================================
// 2. INSTRADAMENTO RATE EMESSE VS RATE SUCCESSIVE E CHIUSURA TITOLARITA' (RC-H1, RC-H3, RC-H4)
// ============================================================================

describe('Registrazione completa subentro, instradamento rate e lavori straordinari (RC-H1, RC-H3, RC-H4)', () => {
  const venditore = {
    anagraficaUnitaId: 'anag-venditore-1',
    utenteId: 'user-venditore',
    soggettoId: 'sogg-venditore',
    nomeDenominazione: 'Paolo Neri',
    dataInizioTitolarita: '2020-01-01',
  };
  const acquirente = {
    utenteId: 'user-acquirente',
    soggettoId: 'sogg-acquirente',
    nomeDenominazione: 'Marco Gialli',
  };

  it('chiude la titolarità del venditore, apre quella dell’acquirente, mantiene al venditore le rate già emesse senza riemetterle e instrada all’acquirente quelle successive (RC-H1, RC-H4)', () => {
    const risultato = registraSubentroCompravendita({
      condominioId: 'condo-1',
      unitaId: 'unita-3',
      dataAtto: '2026-04-15',
      venditore,
      acquirente,
      lavoriStraordinariPreAtto: {
        dataDelibera: '2026-02-20',
        deliberaRiferimento: 'Delibera Assemblea Straordinaria n. 4/2026',
        importoQuotaStraordinariaUnitaCent: 180_000,
        notePattoTraParti: 'Rogito Notaio Rossi rep. 8812: rivalsa interna a carico della parte venditrice',
      },
      debitiPregressi: [
        {
          id: 'sp-2023',
          unitaId: 'unita-3',
          annoCompetenza: 2023,
          importoDovutoCent: 45_000,
        },
        {
          id: 'sp-2025',
          unitaId: 'unita-3',
          annoCompetenza: 2025,
          importoDovutoCent: 60_000,
        },
      ],
      rateUnita: [
        {
          id: 'rata-q1-emessa',
          rataTestataId: 'rt-1',
          unitaId: 'unita-3',
          annoCompetenza: 2026,
          dataScadenza: '2026-03-31',
          bollettinoId: 'boll-emesso-1',
          statoRataModello: 'EMESSA',
          importoDovutoCent: 30_000,
          importoPagatoCent: 0,
          utenteId: 'user-venditore',
          soggettoId: 'sogg-venditore',
        },
        {
          id: 'rata-q2-pianificata',
          rataTestataId: 'rt-2',
          unitaId: 'unita-3',
          annoCompetenza: 2026,
          dataScadenza: '2026-06-30',
          bollettinoId: null,
          statoRataModello: 'PIANIFICATA',
          importoDovutoCent: 30_000,
          importoPagatoCent: 0,
          utenteId: 'user-venditore',
          soggettoId: 'sogg-venditore',
        },
        {
          id: 'rata-q3-pianificata',
          rataTestataId: 'rt-3',
          unitaId: 'unita-3',
          annoCompetenza: 2026,
          dataScadenza: '2026-09-30',
          bollettinoId: null,
          statoRataModello: 'PIANIFICATA',
          importoDovutoCent: 30_000,
          importoPagatoCent: 0,
          utenteId: 'user-venditore',
          soggettoId: 'sogg-venditore',
        },
      ],
      autoreId: 'admin-1',
    });

    // RC-H1: Chiusura titolarità venditore al giorno precedente l'atto (2026-04-14) e apertura acquirente al 2026-04-15
    assert.equal(risultato.titolaritaVenditoreChiusa.data_fine, '2026-04-14');
    assert.equal(risultato.titolaritaAcquirenteAperta.data_inizio, '2026-04-15');
    assert.equal(risultato.titolaritaAcquirenteAperta.data_atto_subentro, '2026-04-15');
    assert.equal(risultato.titolaritaAcquirenteAperta.dante_causa_utente_id, 'user-venditore');

    // RC-H3: Patto lavori straordinari deliberati prima dell'atto tracciato in nota, non vincolante per il condominio
    assert.ok(risultato.lavoriStraordinari);
    assert.equal(risultato.lavoriStraordinari?.deliberatiPrimaDellAtto, true);
    assert.equal(risultato.lavoriStraordinari?.pattoInternoVincolaCondominio, false);
    assert.ok(
      risultato.titolaritaAcquirenteAperta.note_patto_straordinarie?.includes('Rogito Notaio Rossi'),
    );

    // RC-H4: Rata Q1 già emessa resta al venditore e non si riemette, con l'acquirente obbligato in solido
    assert.equal(risultato.instradamentoRate.rateMantenuteAlVenditore.length, 1);
    const rQ1 = risultato.instradamentoRate.rateMantenuteAlVenditore[0]!;
    assert.equal(rQ1.id, 'rata-q1-emessa');
    assert.equal(rQ1.azione, 'MANTIENI_A_VENDITORE');
    assert.equal(rQ1.daRiemettere, false);
    assert.equal(rQ1.intestatarioUtenteId, 'user-venditore');
    assert.equal(rQ1.obbligatoInSolidoUtenteId, 'user-acquirente');

    // RC-H4: Rate Q2 e Q3 non ancora emesse vengono instradate all'acquirente
    assert.equal(risultato.instradamentoRate.rateInstradateAllAcquirente.length, 2);
    for (const rSucc of risultato.instradamentoRate.rateInstradateAllAcquirente) {
      assert.equal(rSucc.azione, 'INSTRADA_AD_ACQUIRENTE');
      assert.equal(rSucc.intestatarioUtenteId, 'user-acquirente');
      assert.equal(rSucc.intestatarioSoggettoId, 'sogg-acquirente');
    }
  });

  it('rifiuta un subentro con venditore e acquirente coincidenti o data atto antecedente alla titolarità', () => {
    assert.throws(
      () =>
        registraSubentroCompravendita({
          condominioId: 'condo-1',
          unitaId: 'unita-3',
          dataAtto: '2026-04-15',
          venditore,
          acquirente: {
            utenteId: 'user-venditore',
            soggettoId: 'sogg-venditore',
            nomeDenominazione: 'Paolo Neri',
          },
        }),
      ErroreSubentroNonValido,
    );

    assert.throws(
      () =>
        instradaRateSuSubentro({
          dataAtto: 'data-errata',
          venditore,
          acquirente,
          rateUnita: [],
        }),
      TypeError,
    );
  });
});

// ============================================================================
// 3. SPESE A PERIODO (RC-H5, T8) E CAMBIO INQUILINO CON CONTATORI (RC-H6)
// ============================================================================

describe('Spese a periodo al subentro (RC-H5, T8) e cambio inquilino con letture contatori (RC-H6)', () => {
  it('T8 / RC-H5: Premio assicurazione 730,00 € per il 2026, unità 100/1000, A dal 1/1 al 30/6 (181 gg) e B dal 1/7 al 31/12 (184 gg) -> A 36,20 €, B 36,80 €', () => {
    const esito = calcolaRipartoSpesaAPeriodoSubentro({
      importoSpesaTotaleCent: 73_000, // 730,00 €
      unitaId: 'unita-1',
      quoteMillesimali: [
        { unitaId: 'unita-1', millesimi: 100 },
        { unitaId: 'altre', millesimi: 900 },
      ],
      dataInizioPeriodo: '2026-01-01',
      dataFinePeriodo: '2026-12-31',
      titolareUscenteId: 'titolare-A',
      dataFineTitolareUscente: '2026-06-30',
      titolareSubentranteId: 'titolare-B',
      dataInizioTitolareSubentrante: '2026-07-01',
    });

    assert.equal(esito.quotaPeriodoUnitaCent, 7_300); // 73,00 €
    assert.equal(esito.quoteTitolari[0]?.giorni, 181);
    assert.equal(esito.quoteTitolari[0]?.quotaFinaleCent, 3_620); // 36,20 €
    assert.equal(esito.quoteTitolari[1]?.giorni, 184);
    assert.equal(esito.quoteTitolari[1]?.quotaFinaleCent, 3_680); // 36,80 €
  });

  it('RC-H6: divide i consumi per letture reali alla data di subentro e stima per giorni marcando "da conguagliare" se manca la lettura intermedia', () => {
    // 1. Con lettura intermedia al subentro: inizio 100 m³, subentro 120 m³ (20 m³), fine 150 m³ (30 m³) su 100,00 €
    const conLettura = calcolaConsumiCambioTitolare({
      unitaId: 'unita-1',
      importoTotaleConsumoUnitaCent: 10_000, // 100,00 €
      dataInizioPeriodo: '2026-01-01',
      dataFinePeriodo: '2026-12-31',
      dataSubentro: '2026-07-01',
      titolareUscenteId: 'inq-uscente',
      titolareSubentranteId: 'inq-subentrante',
      letturaInizioPeriodo: 100,
      letturaAlSubentro: 120,
      letturaFinePeriodo: 150,
    });

    assert.equal(conLettura.metodoCalcolo, 'LETTURE_REALI_SUBENTRO');
    assert.equal(conLettura.daConguagliare, false);
    assert.equal(conLettura.quotaUscente.consumoCalcolato, 20);
    assert.equal(conLettura.quotaUscente.quotaCent, 4_000); // 40,00 €
    assert.equal(conLettura.quotaSubentrante.consumoCalcolato, 30);
    assert.equal(conLettura.quotaSubentrante.quotaCent, 6_000); // 60,00 €

    // 2. Senza lettura intermedia al subentro -> stima per giorni (181/365 e 184/365) con daConguagliare = true
    const senzaLettura = calcolaConsumiCambioTitolare({
      unitaId: 'unita-1',
      importoTotaleConsumoUnitaCent: 7_300, // 73,00 €
      dataInizioPeriodo: '2026-01-01',
      dataFinePeriodo: '2026-12-31',
      dataSubentro: '2026-07-01',
      titolareUscenteId: 'inq-uscente',
      titolareSubentranteId: 'inq-subentrante',
      letturaInizioPeriodo: 100,
      letturaAlSubentro: null,
      letturaFinePeriodo: 150,
    });

    assert.equal(senzaLettura.metodoCalcolo, 'STIMA_PER_GIORNI_DA_CONGUAGLIARE');
    assert.equal(senzaLettura.daConguagliare, true);
    assert.equal(senzaLettura.quotaUscente.daConguagliare, true);
    assert.equal(senzaLettura.quotaSubentrante.daConguagliare, true);
    assert.equal(senzaLettura.quotaUscente.quotaCent, 3_620);
    assert.equal(senzaLettura.quotaSubentrante.quotaCent, 3_680);
  });
});
