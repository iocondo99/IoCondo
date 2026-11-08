import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calcolaRipartoLocatoreConduttoreVoce,
  calcolaRipartoTripartitoUnitaVoce,
  calcolaRipartoUsufruttuarioNudoProprietarioVoce,
  calcolaScadenzaPagamentoInquilino,
  calcolaSubentroInquilinoVoce,
  ErrorePattoContrarioNulloArt79,
  generaProspettoInquilino,
  risolviPercentualeConduttoreVoce,
  TABELLA_ONERI_ACCESSORI_DM_2017,
} from './oneriAccessoriLogic.ts';

describe('oneriAccessoriLogic — Sezione 7 (RC-I1..I7, T10): Locatore, Conduttore e Usufruttuario', () => {
  // ==========================================================================
  // 1. CASO UFFICIALE T10 + REGOLE BASE ART. 9 L. 392/1978 E DM 16/01/2017 (RC-I1, RC-I2, RC-I4)
  // ==========================================================================
  describe('T10 & RC-I1, RC-I2, RC-I4 — Ripartizione voce per voce locatore / conduttore', () => {
    it('T10: Ordinaria ascensore (1.000 €, quota 80 €, 100% conduttore) -> Inquilino 80 €; Sostituzione ascensore (5.000 €, quota 400 €, 0% conduttore) -> Proprietario 400 €', () => {
      const ordinariaAscensore = calcolaRipartoLocatoreConduttoreVoce({
        codiceVoce: 'ASCENSORE',
        descrizione: 'Manutenzione ordinaria ascensore',
        tagSpesa: 'ORDINARIA',
        importoSpesaTotaleCondominioCent: 100_000, // 1.000,00 €
        quotaUnitaCent: 8_000, // 80,00 €
        quotaInquilinoCatalogoPerc: 100,
      });

      assert.equal(ordinariaAscensore.quotaConduttoreCent, 8_000);
      assert.equal(ordinariaAscensore.quotaConduttoreEuro, 80);
      assert.equal(ordinariaAscensore.quotaLocatoreCent, 0);
      assert.equal(ordinariaAscensore.quotaLocatoreEuro, 0);
      assert.equal(ordinariaAscensore.debitoreVersoCondominio, 'PROPRIETARIO');
      assert.equal(ordinariaAscensore.isFatturazioneSeparataInquilino, false);

      const sostituzioneAscensore = calcolaRipartoLocatoreConduttoreVoce({
        codiceVoce: 'MANUT_STRAORD',
        descrizione: 'Sostituzione integrale impianto ascensore',
        tagSpesa: 'STRAORDINARIA',
        importoSpesaTotaleCondominioCent: 500_000, // 5.000,00 €
        quotaUnitaCent: 40_000, // 400,00 €
        quotaInquilinoCatalogoPerc: 0,
      });

      assert.equal(sostituzioneAscensore.quotaConduttoreCent, 0);
      assert.equal(sostituzioneAscensore.quotaConduttoreEuro, 0);
      assert.equal(sostituzioneAscensore.quotaLocatoreCent, 40_000);
      assert.equal(sostituzioneAscensore.quotaLocatoreEuro, 400);
      assert.equal(sostituzioneAscensore.fonteRegola, 'STRAORDINARIA_PROPRIETARIO');
    });

    it('RC-I4: Compenso amministratore e Assicurazione fabbricato sono 0% conduttore (100% proprietario) per default', () => {
      const compensoAdmin = calcolaRipartoLocatoreConduttoreVoce({
        codiceVoce: 'COMPENSO_ADMIN',
        tagSpesa: 'ORDINARIA',
        quotaUnitaCent: 15_000, // 150,00 €
      });

      assert.equal(compensoAdmin.percentualeConduttoreApplicata, 0);
      assert.equal(compensoAdmin.quotaConduttoreCent, 0);
      assert.equal(compensoAdmin.quotaLocatoreCent, 15_000);
      assert.equal(compensoAdmin.fonteRegola, 'ESCLUSIONE_LEGALE_RC_I4');

      const assicurazione = calcolaRipartoLocatoreConduttoreVoce({
        codiceVoce: 'ASSICURAZIONE',
        tagSpesa: 'ORDINARIA',
        quotaUnitaCent: 12_000, // 120,00 €
      });

      assert.equal(assicurazione.percentualeConduttoreApplicata, 0);
      assert.equal(assicurazione.quotaConduttoreCent, 0);
      assert.equal(assicurazione.quotaLocatoreCent, 12_000);
      assert.equal(assicurazione.fonteRegola, 'ESCLUSIONE_LEGALE_RC_I4');
    });

    it('RC-I2: Portierato ordinario applica il 90% a carico del conduttore e il 10% a carico del locatore (art. 9 c. 1 L. 392/1978)', () => {
      assert.equal(TABELLA_ONERI_ACCESSORI_DM_2017.PORTIERATO?.quotaConduttoreDefaultPerc, 90);

      const portierato = calcolaRipartoLocatoreConduttoreVoce({
        codiceVoce: 'PORTIERATO',
        tagSpesa: 'ORDINARIA',
        quotaUnitaCent: 10_000, // 100,00 €
      });

      assert.equal(portierato.percentualeConduttoreApplicata, 90);
      assert.equal(portierato.quotaConduttoreCent, 9_000); // 90,00 €
      assert.equal(portierato.quotaLocatoreCent, 1_000); // 10,00 €
      assert.equal(portierato.fonteRegola, 'TABELLA_DM_16_01_2017');
    });
  });

  // ==========================================================================
  // 2. PATTO CONTRARIO E DIVIETO CLAUSOLE NULLE EX ART. 79 L. 392/1978 (RC-I3, RC-I4)
  // ==========================================================================
  describe('RC-I3 & RC-I4 — Patto contrario e controllo di legittimità ex art. 79 L. 392/1978', () => {
    it('consente il patto contrario su Compenso Amministratore e Assicurazione in regime a canone libero tracciando avviso (RC-I4)', () => {
      const esitoPatto = calcolaRipartoLocatoreConduttoreVoce({
        codiceVoce: 'COMPENSO_ADMIN',
        tagSpesa: 'ORDINARIA',
        quotaUnitaCent: 20_000, // 200,00 €
        pattoContrarioOneri: true,
        tabellaOneriCustom: { COMPENSO_ADMIN: 50 },
        regimeContratto: 'CANONE_LIBERO_4_PIU_4',
      });

      assert.equal(esitoPatto.pattoContrarioApplicato, true);
      assert.equal(esitoPatto.fonteRegola, 'PATTO_CONTRARIO_UNITA');
      assert.equal(esitoPatto.percentualeConduttoreApplicata, 50);
      assert.equal(esitoPatto.quotaConduttoreCent, 10_000);
      assert.equal(esitoPatto.quotaLocatoreCent, 10_000);
      assert.ok(esitoPatto.avvisoArt79?.includes('COMPENSO_ADMIN'));
    });

    it('impedisce di addebitare spese STRAORDINARIE al conduttore anche in presenza di patto contrario (art. 79 L. 392/1978, RC-I3)', () => {
      // Modalità ricondotta automaticamente al limite legale (0%)
      const ricondotto = risolviPercentualeConduttoreVoce({
        codiceVoce: 'MANUT_STRAORD',
        tagSpesa: 'STRAORDINARIA',
        pattoContrarioOneri: true,
        tabellaOneriCustom: { MANUT_STRAORD: 100 },
        bloccaClausoleNulleArt79: false,
      });

      assert.equal(ricondotto.violazioneArt79Rilevata, true);
      assert.equal(ricondotto.percentualeConduttoreApplicata, 0);
      assert.equal(ricondotto.fonteRegola, 'RICONDOTTA_LIMITE_LEGALE_ART_79');
      assert.ok(ricondotto.avvisoArt79?.includes('art. 79 L. 392/1978'));

      // Modalità bloccante
      assert.throws(
        () =>
          risolviPercentualeConduttoreVoce({
            codiceVoce: 'MANUT_STRAORD',
            tagSpesa: 'STRAORDINARIA',
            pattoContrarioOneri: true,
            tabellaOneriCustom: { MANUT_STRAORD: 50 },
            bloccaClausoleNulleArt79: true,
          }),
        (err: unknown) =>
          err instanceof ErrorePattoContrarioNulloArt79 &&
          err.codice === 'PATTO_CONTRARIO_NULLO_ART_79',
      );
    });

    it('impedisce deroghe peggiorative della Tabella Allegato D nei contratti a canone concordato DM 16/01/2017 (RC-I3)', () => {
      const concordato = risolviPercentualeConduttoreVoce({
        codiceVoce: 'PORTIERATO', // Default DM 2017: 90%
        tagSpesa: 'ORDINARIA',
        pattoContrarioOneri: true,
        tabellaOneriCustom: { PORTIERATO: 100 }, // Peggiorativo per l'inquilino rispetto al 90%
        regimeContratto: 'CANONE_CONCORDATO_DM_2017',
        bloccaClausoleNulleArt79: false,
      });

      assert.equal(concordato.violazioneArt79Rilevata, true);
      assert.equal(concordato.percentualeConduttoreApplicata, 90);
      assert.equal(concordato.fonteRegola, 'RICONDOTTA_LIMITE_LEGALE_ART_79');

      // Una deroga migliorativa per l'inquilino (es. 50% invece di 90%) è invece pienamente valida
      const migliorativa = risolviPercentualeConduttoreVoce({
        codiceVoce: 'PORTIERATO',
        tagSpesa: 'ORDINARIA',
        pattoContrarioOneri: true,
        tabellaOneriCustom: { PORTIERATO: 50 },
        regimeContratto: 'CANONE_CONCORDATO_DM_2017',
      });
      assert.equal(migliorativa.violazioneArt79Rilevata, false);
      assert.equal(migliorativa.percentualeConduttoreApplicata, 50);
    });
  });

  // ==========================================================================
  // 3. USUFRUTTUARIO E NUDO PROPRIETARIO EX ARTT. 1004 E 1005 C.C. (RC-I5)
  // ==========================================================================
  describe('RC-I5 — Ripartizione usufruttuario / nudo proprietario ex artt. 1004 e 1005 c.c.', () => {
    it('attribuisce custodia, amministrazione (compenso admin) e manutenzione ordinaria al 100% all’usufruttuario e le straordinarie al nudo proprietario', () => {
      const ordinariaAdmin = calcolaRipartoUsufruttuarioNudoProprietarioVoce({
        codiceVoce: 'COMPENSO_ADMIN',
        descrizione: 'Compenso amministrazione ordinaria',
        tagSpesa: 'ORDINARIA',
        quotaUnitaCent: 18_000, // 180,00 €
      });

      assert.equal(ordinariaAdmin.quotaUsufruttuarioCent, 18_000);
      assert.equal(ordinariaAdmin.quotaNudoProprietarioCent, 0);
      assert.equal(ordinariaAdmin.criterioApplicato, 'ART_1004_1005_CC_STANDARD');

      const straordinariaTetto = calcolaRipartoUsufruttuarioNudoProprietarioVoce({
        codiceVoce: 'MANUT_STRAORD',
        descrizione: 'Rifacimento straordinario tetto',
        tagSpesa: 'STRAORDINARIA',
        quotaUnitaCent: 120_000, // 1.200,00 €
      });

      assert.equal(straordinariaTetto.quotaUsufruttuarioCent, 0);
      assert.equal(straordinariaTetto.quotaNudoProprietarioCent, 120_000);
    });

    it('supporta riparazione straordinaria da inadempimento ordinaria (art. 1005 c. 2) e regola custom per unità (RC-I5)', () => {
      const daInadempimento = calcolaRipartoUsufruttuarioNudoProprietarioVoce({
        codiceVoce: 'MANUT_STRAORD',
        tagSpesa: 'STRAORDINARIA',
        quotaUnitaCent: 50_000,
        straordinariaDaInadempimentoOrdinaria: true,
      });
      assert.equal(daInadempimento.quotaUsufruttuarioCent, 50_000);
      assert.equal(daInadempimento.quotaNudoProprietarioCent, 0);
      assert.equal(
        daInadempimento.criterioApplicato,
        'STRAORDINARIA_DA_INADEMPIMENTO_ORDINARIA_ART_1005',
      );

      const conRegolaCustom = calcolaRipartoUsufruttuarioNudoProprietarioVoce({
        codiceVoce: 'MANUT_STRAORD',
        tagSpesa: 'STRAORDINARIA',
        quotaUnitaCent: 50_000,
        regolaUsufruttoCustom: { straordinariaUsufruttuarioPerc: 30 },
      });
      assert.equal(conRegolaCustom.quotaUsufruttuarioCent, 15_000);
      assert.equal(conRegolaCustom.quotaNudoProprietarioCent, 35_000);
      assert.equal(conRegolaCustom.criterioApplicato, 'REGOLA_CUSTOM_UNITA');
    });

    it('calcola il riparto tripartito (nudo proprietario, usufruttuario, conduttore) su unità in usufrutto concessa in locazione', () => {
      // Sul compenso amministratore (ordinaria ma esclusa per il conduttore ex RC-I4),
      // paga l'usufruttuario-locatore ex art. 1004 c.c. (100% usufruttuario, 0% conduttore, 0% nudo proprietario)
      const compAdminTripartito = calcolaRipartoTripartitoUnitaVoce({
        quotaUnitaCent: 15_000,
        codiceVoce: 'COMPENSO_ADMIN',
        tagSpesa: 'ORDINARIA',
        haConduttoreAttivo: true,
        haUsufruttuarioAttivo: true,
      });

      assert.equal(compAdminTripartito.quotaConduttoreCent, 0);
      assert.equal(compAdminTripartito.quotaUsufruttuarioCent, 15_000);
      assert.equal(compAdminTripartito.quotaProprietarioCent, 0);
      assert.equal(compAdminTripartito.sommaQuoteCent, 15_000);
    });
  });

  // ==========================================================================
  // 4. SUBENTRO INQUILINO A META' PERIODO CON GIORNI, SFITTO E CONSUMI (RC-I7, RC-H5, RC-H6)
  // ==========================================================================
  describe('RC-I7, RC-H5 & RC-H6 — Subentro inquilino a metà periodo (giorni e consumi)', () => {
    it('divide una spesa ordinaria annuale tra due inquilini in proporzione ai giorni (181 gg vs 184 gg nel 2026)', () => {
      const subentroGiorni = calcolaSubentroInquilinoVoce(
        {
          spesaId: 'spesa-pulizia-2026',
          codiceVoce: 'PULIZIA_SCALE',
          descrizione: 'Pulizia scale annuale 2026',
          tagSpesa: 'ORDINARIA',
          competenzaDa: '2026-01-01',
          competenzaA: '2026-12-31',
          quotaUnitaCent: 36_500, // 365,00 € (1,00 € al giorno)
        },
        [
          {
            conduttoreId: 'inq-1',
            nomeConduttore: 'Mario Inquilino Uscente',
            contrattoInizio: '2026-01-01',
            contrattoFine: '2026-06-30', // 181 giorni
          },
          {
            conduttoreId: 'inq-2',
            nomeConduttore: 'Lucia Inquilina Subentrante',
            contrattoInizio: '2026-07-01',
            contrattoFine: '2026-12-31', // 184 giorni
          },
        ],
      );

      assert.equal(subentroGiorni.giorniPeriodoTotale, 365);
      assert.equal(subentroGiorni.giorniSfitto, 0);
      assert.equal(subentroGiorni.quotaTotaleLocatoreCent, 0);
      assert.equal(subentroGiorni.quotaTotaleConduttoriCent, 36_500);
      assert.equal(subentroGiorni.quoteConduttori.length, 2);
      assert.equal(subentroGiorni.quoteConduttori[0]?.giorniConduzione, 181);
      assert.equal(subentroGiorni.quoteConduttori[0]?.quotaCent, 18_100); // 181,00 €
      assert.equal(subentroGiorni.quoteConduttori[1]?.giorniConduzione, 184);
      assert.equal(subentroGiorni.quoteConduttori[1]?.quotaCent, 18_400); // 184,00 €
    });

    it('addebita al locatore/proprietario i giorni di sfitto tra due contratti di locazione', () => {
      // Un solo inquilino dal 01/01/2026 al 30/06/2026 (181 gg), poi immobile sfitto per 184 gg
      const conSfitto = calcolaSubentroInquilinoVoce(
        {
          codiceVoce: 'LUCE_COMUNE',
          tagSpesa: 'ORDINARIA',
          competenzaDa: '2026-01-01',
          competenzaA: '2026-12-31',
          quotaUnitaCent: 36_500, // 365,00 €
        },
        [
          {
            conduttoreId: 'inq-unico',
            nomeConduttore: 'Mario Uscente',
            contrattoInizio: '2026-01-01',
            contrattoFine: '2026-06-30',
          },
        ],
      );

      assert.equal(conSfitto.giorniLocatiTotali, 181);
      assert.equal(conSfitto.giorniSfitto, 184);
      assert.equal(conSfitto.quotaTotaleConduttoriCent, 18_100);
      assert.equal(conSfitto.quotaProprietarioPerSfittoCent, 18_400);
      assert.equal(conSfitto.quotaTotaleLocatoreCent, 18_400);
    });

    it('divide i consumi acqua al cambio inquilino con letture reali al subentro oppure stima per giorni marcando "da conguagliare" (RC-H6, RC-I7)', () => {
      const conduttori = [
        {
          conduttoreId: 'inq-a',
          nomeConduttore: 'Inquilino A',
          contrattoInizio: '2026-01-01',
          contrattoFine: '2026-06-30',
        },
        {
          conduttoreId: 'inq-b',
          nomeConduttore: 'Inquilino B',
          contrattoInizio: '2026-07-01',
          contrattoFine: '2026-12-31',
        },
      ];

      // 1) Con lettura contatore rilevata al subentro (100 -> 120 -> 160 m³: 20 m³ A, 40 m³ B su 180,00 €)
      const conLetture = calcolaSubentroInquilinoVoce(
        {
          codiceVoce: 'ACQUA',
          tagSpesa: 'ORDINARIA',
          competenzaDa: '2026-01-01',
          competenzaA: '2026-12-31',
          quotaUnitaCent: 18_000, // 180,00 €
          isAConsumo: true,
          dataSubentroConsumo: '2026-07-01',
          letturaInizioPeriodo: 100,
          letturaAlSubentro: 120,
          letturaFinePeriodo: 160,
        },
        conduttori,
      );

      assert.equal(conLetture.daConguagliare, false);
      assert.equal(conLetture.quoteConduttori[0]?.consumoRilevato, 20);
      assert.equal(conLetture.quoteConduttori[0]?.quotaCent, 6_000); // 60,00 €
      assert.equal(conLetture.quoteConduttori[1]?.consumoRilevato, 40);
      assert.equal(conLetture.quoteConduttori[1]?.quotaCent, 12_000); // 120,00 €

      // 2) Senza lettura intermedia al subentro -> stima per giorni e marca daConguagliare = true
      const senzaLetturaSubentro = calcolaSubentroInquilinoVoce(
        {
          codiceVoce: 'ACQUA',
          tagSpesa: 'ORDINARIA',
          competenzaDa: '2026-01-01',
          competenzaA: '2026-12-31',
          quotaUnitaCent: 36_500, // 365,00 €
          isAConsumo: true,
          dataSubentroConsumo: '2026-07-01',
          letturaInizioPeriodo: 100,
          letturaAlSubentro: null,
          letturaFinePeriodo: 160,
        },
        conduttori,
      );

      assert.equal(senzaLetturaSubentro.daConguagliare, true);
      assert.equal(senzaLetturaSubentro.quoteConduttori[0]?.daConguagliare, true);
      assert.equal(senzaLetturaSubentro.quoteConduttori[0]?.quotaCent, 18_100);
      assert.equal(senzaLetturaSubentro.quoteConduttori[1]?.daConguagliare, true);
      assert.equal(senzaLetturaSubentro.quoteConduttori[1]?.quotaCent, 18_400);
    });
  });

  // ==========================================================================
  // 5. GENERAZIONE PROSPETTO INQUILINO CON SCADENZA A 2 MESI (RC-I6, T10)
  // ==========================================================================
  describe('RC-I6 & T10 — Prospetto inquilino con scadenza di pagamento entro 2 mesi dalla richiesta', () => {
    it('calcola la scadenza di pagamento esattamente a 2 mesi dalla data di richiesta (art. 9 c. 3 L. 392/1978)', () => {
      assert.equal(calcolaScadenzaPagamentoInquilino('2026-03-15'), '2026-05-15');
      assert.equal(calcolaScadenzaPagamentoInquilino('2026-12-31'), '2027-02-28');
    });

    it('genera il prospetto completo voce per voce (T10 + RC-I4 + RC-I6) pronto per l’esportazione PDF', () => {
      const prospetto = generaProspettoInquilino({
        condominioId: 'cond-1',
        nomeCondominio: 'Condominio Parco Verde',
        unitaId: 'unita-a1',
        internoUnita: '1',
        esercizioId: 'es-2026',
        periodoDa: '2026-01-01',
        periodoA: '2026-12-31',
        dataRichiesta: '2026-04-10',
        proprietario: {
          utenteId: 'u-prop',
          soggettoId: 's-prop',
          nomeDenominazione: 'Mario Rossi (Locatore)',
        },
        conduttore: {
          conduttoreId: 's-cond',
          nomeConduttore: 'Luca Gialli (Conduttore)',
          contrattoInizio: '2026-01-01',
          contrattoFine: '2026-12-31',
        },
        accontiVersatiConduttoreCent: 3_000, // 30,00 € già versati in acconto
        vociSpesa: [
          // Voce 1 (T10): Ordinaria ascensore 1.000,00 €, quota unità 80,00 €, 100% conduttore
          {
            spesaId: 'mov-1',
            codiceVoce: 'ASCENSORE',
            descrizione: 'Manutenzione ordinaria ascensore',
            tagSpesa: 'ORDINARIA',
            competenzaDa: '2026-01-01',
            competenzaA: '2026-12-31',
            importoSpesaTotaleCondominioCent: 100_000,
            quotaUnitaCent: 8_000,
            quotaInquilinoCatalogoPerc: 100,
          },
          // Voce 2 (T10): Sostituzione ascensore 5.000,00 €, quota unità 400,00 €, 0% conduttore
          {
            spesaId: 'mov-2',
            codiceVoce: 'MANUT_STRAORD',
            descrizione: 'Sostituzione cabina e argano ascensore',
            tagSpesa: 'STRAORDINARIA',
            competenzaDa: '2026-01-01',
            competenzaA: '2026-12-31',
            importoSpesaTotaleCondominioCent: 500_000,
            quotaUnitaCent: 40_000,
            quotaInquilinoCatalogoPerc: 0,
          },
          // Voce 3 (RC-I4): Compenso amministratore 120,00 € -> 0% conduttore, 100% locatore
          {
            spesaId: 'mov-3',
            codiceVoce: 'COMPENSO_ADMIN',
            descrizione: 'Compenso ordinario amministratore',
            tagSpesa: 'ORDINARIA',
            competenzaDa: '2026-01-01',
            competenzaA: '2026-12-31',
            importoSpesaTotaleCondominioCent: 150_000,
            quotaUnitaCent: 12_000,
          },
        ],
      });

      assert.equal(prospetto.isFatturazioneSeparataCondominio, false);
      assert.equal(prospetto.debitoreVersoCondominio, 'PROPRIETARIO');
      assert.equal(prospetto.dataRichiesta, '2026-04-10');
      assert.equal(prospetto.dataScadenzaPagamentoInquilino, '2026-06-10'); // +2 mesi (RC-I6)
      assert.equal(prospetto.totaleSpeseUnitaCent, 60_000); // 80 + 400 + 120 = 600,00 €
      assert.equal(prospetto.totaleQuotaConduttoreCent, 8_000); // 80,00 € (T10)
      assert.equal(prospetto.totaleQuotaLocatoreCent, 52_000); // 400 + 120 = 520,00 € (T10 + RC-I4)
      assert.equal(prospetto.saldoNettoDaPagareConduttoreCent, 5_000); // 80 - 30 = 50,00 €
      assert.equal(prospetto.payloadPdf.totaleConduttoreFormattato, '80,00 €');
      assert.equal(prospetto.payloadPdf.saldoNettoConduttoreFormattato, '50,00 €');
    });
  });
});
