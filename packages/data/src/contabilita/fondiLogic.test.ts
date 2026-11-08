import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertFondoSpecialeCostituitoPerRateStraordinarie,
  calcolaSaldoEMovimentiFondo,
  creaFondo,
  ErroreCapienzaFondoInsufficiente,
  ErroreDivietoCompensoAdminFondo,
  ErroreFondoSpecialeNonCostituito,
  ErroreVincoloDestinazioneFondo,
  riconciliaFondiConContoUnico,
  validaERegistraMovimentoFondo,
  validaFondoSpecialePerEmissioneRateStraordinarie,
} from './fondiLogic.ts';

describe('fondiLogic — Sezione 8 (RC-J1..J5, T7): Fondi Condominiali, Blocco Art. 1135 e Vincoli', () => {
  // ==========================================================================
  // 1. CASO UFFICIALE T7 E BLOCCO LEGALE EMISSIONE RATE STRAORDINARIE (RC-J2, RC-J3)
  // ==========================================================================
  describe('T7 & RC-J2, RC-J3 — Blocco legale emissione rate straordinarie ex art. 1135 c. 1 n. 4 c.c.', () => {
    it('T7: Lavori deliberati 60.000,00 € con fondo non costituito -> rate straordinarie NON emettibili; con fondo costituito da 60.000,00 € -> emettibili', () => {
      // 1) Fondo non costituito -> bloccato
      const senzaFondo = validaFondoSpecialePerEmissioneRateStraordinarie({
        tipoGestione: 'STRAORDINARIA',
        importoLavoriDeliberatiCent: 6_000_000, // 60.000,00 €
        fondoSpecialeCostituito: false,
      });

      assert.equal(senzaFondo.consentita, false);
      assert.equal(senzaFondo.emissioneBloccata, true);
      assert.equal(senzaFondo.codiceBlocco, 'FONDO_SPECIALE_NON_COSTITUITO');
      assert.equal(senzaFondo.importoLavoriDeliberatiCent, 6_000_000);
      assert.equal(senzaFondo.differenzaMancanteCent, 6_000_000);

      assert.throws(
        () =>
          assertFondoSpecialeCostituitoPerRateStraordinarie({
            tipoGestione: 'STRAORDINARIA',
            importoLavoriDeliberatiCent: 6_000_000,
            fondoSpecialeCostituito: false,
          }),
        (err: unknown) =>
          err instanceof ErroreFondoSpecialeNonCostituito &&
          err.codice === 'FONDO_SPECIALE_NON_COSTITUITO_ART_1135' &&
          err.emissioneBloccata === true,
      );

      // 2) Fondo parziale (es. 30.000,00 € su 60.000,00 € deliberati) -> nullo ex art. 1135, bloccato
      const fondoParziale = validaFondoSpecialePerEmissioneRateStraordinarie({
        tipoGestione: 'STRAORDINARIA',
        importoLavoriDeliberatiCent: 6_000_000,
        importoFondoSpecialeDeliberatoCent: 3_000_000,
      });

      assert.equal(fondoParziale.consentita, false);
      assert.equal(fondoParziale.emissioneBloccata, true);
      assert.equal(fondoParziale.codiceBlocco, 'FONDO_SPECIALE_PARZIALE_NULLO_ART_1135');
      assert.equal(fondoParziale.differenzaMancanteCent, 3_000_000);

      // 3) Con fondo costituito per l'intero importo deliberato (60.000,00 €) -> rate straordinarie emettibili
      const conFondoCostituito = assertFondoSpecialeCostituitoPerRateStraordinarie({
        tipoGestione: 'STRAORDINARIA',
        importoLavoriDeliberatiCent: 6_000_000,
        fondoSpeciale: {
          id: 'fondo-spec-t7',
          tipo: 'SPECIALE',
          stato: 'VINCOLATO',
          deliberaCostituzione: 'Verbale Assemblea Straordinaria del 10/03/2026 - Punto 2',
          importoLavoriCent: 6_000_000,
          importoObiettivoCent: 6_000_000,
          saldoAttualeCent: 0,
        },
      });

      assert.equal(conFondoCostituito.consentita, true);
      assert.equal(conFondoCostituito.emissioneBloccata, false);
      assert.equal(conFondoCostituito.codiceBlocco, null);
      assert.equal(conFondoCostituito.importoFondoDeliberatoCent, 6_000_000);
    });

    it('RC-J3: supporta la costituzione progressiva del Fondo Speciale per SAL collegata al contratto d’appalto', () => {
      // Senza riferimento al contratto d'appalto -> bloccato
      const senzaContratto = validaFondoSpecialePerEmissioneRateStraordinarie({
        tipoGestione: 'STRAORDINARIA',
        importoLavoriDeliberatiCent: 6_000_000,
        fondoSpeciale: {
          tipo: 'SPECIALE',
          stato: 'VINCOLATO',
          importoLavoriCent: 6_000_000,
          importoObiettivoCent: 6_000_000,
          isProgressivoSal: true,
          contrattoAppaltoRef: null,
        },
      });
      assert.equal(senzaContratto.consentita, false);
      assert.equal(senzaContratto.codiceBlocco, 'CONTRATTO_APPALTO_SAL_MANCANTE');

      // Con contratto d'appalto e 3 scaglioni SAL che coprono i 60.000,00 €
      const conSalValidi = validaFondoSpecialePerEmissioneRateStraordinarie({
        tipoGestione: 'STRAORDINARIA',
        importoLavoriDeliberatiCent: 6_000_000,
        fondoSpeciale: {
          tipo: 'SPECIALE',
          stato: 'VINCOLATO',
          importoLavoriCent: 6_000_000,
          importoObiettivoCent: 6_000_000,
          isProgressivoSal: true,
          contrattoAppaltoRef: 'Contratto Appalto Rep. 452/2026 - Impresa EdilRestauri Srl',
        },
        scaglioniSal: [
          { numeroSal: 1, importoSalCent: 2_000_000, costituito: true },
          { numeroSal: 2, importoSalCent: 2_000_000, costituito: true },
          { numeroSal: 3, importoSalCent: 2_000_000, costituito: false },
        ],
        finoAlSalNumero: 2,
      });

      assert.equal(conSalValidi.consentita, true);
      assert.equal(conSalValidi.isProgressivoSal, true);
    });
  });

  // ==========================================================================
  // 2. CREAZIONE E GESTIONE SALDI/MOVIMENTI DEI 3 TIPI DI FONDO (RC-J1)
  // ==========================================================================
  describe('RC-J1 — Creazione e calcolo saldi e movimenti (SPECIALE, CASSA, MOROSITA)', () => {
    it('crea correttamente Fondo Speciale, Fondo Cassa e Fondo Morosità e calcola saldi e copertura', () => {
      const esitoSpeciale = creaFondo({
        id: 'f-spec-1',
        condominioId: 'cond-1',
        esercizioId: 'es-2026',
        nome: 'Fondo Speciale Rifacimento Facciata',
        tipo: 'SPECIALE',
        deliberaCostituzione: 'Delibera Assemblea 15/02/2026 n. 4',
        dataDelibera: '2026-02-15',
        importoLavoriCent: 6_000_000,
        importoObiettivoCent: 6_000_000,
        isProgressivoSal: true,
        contrattoAppaltoRef: 'Contratto Appalto n. 18/2026',
      });

      assert.equal(esitoSpeciale.fondo.tipo, 'SPECIALE');
      assert.equal(esitoSpeciale.fondo.stato, 'VINCOLATO');
      assert.equal(esitoSpeciale.isVoceContabileNonContoBancario, true);

      const esitoCassa = creaFondo({
        id: 'f-cassa-1',
        condominioId: 'cond-1',
        nome: 'Fondo Cassa e Riserva Ordinaria',
        tipo: 'CASSA',
        importoObiettivoCent: 500_000,
        saldoInizialeCent: 200_000,
      });
      assert.equal(esitoCassa.fondo.tipo, 'CASSA');
      assert.equal(esitoCassa.fondo.saldo_attuale_centesimi, 200_000);

      const esitoMorosita = creaFondo({
        id: 'f-mor-1',
        condominioId: 'cond-1',
        nome: 'Fondo Morosità',
        tipo: 'MOROSITA',
        importoObiettivoCent: 300_000,
        saldoInizialeCent: 100_000,
      });
      assert.equal(esitoMorosita.fondo.tipo, 'MOROSITA');

      // Calcolo analitico saldo e movimenti sul Fondo Speciale:
      // +2.000.000 cent (1° SAL) + 2.000.000 cent (2° SAL) - 1.500.000 cent (pagamento fattura 1° SAL) = 2.500.000 cent
      const riepilogoSaldo = calcolaSaldoEMovimentiFondo(
        {
          id: 'f-spec-1',
          ...esitoSpeciale.fondo,
          saldo_attuale_centesimi: 2_500_000,
        },
        [
          {
            condominio_id: 'cond-1',
            fondo_id: 'f-spec-1',
            data: '2026-03-10',
            importo_centesimi: 2_000_000,
            segno: '+',
            causale: 'Accantonamento 1° rata Fondo Speciale Facciata',
          },
          {
            condominio_id: 'cond-1',
            fondo_id: 'f-spec-1',
            data: '2026-05-10',
            importo_centesimi: 2_000_000,
            segno: '+',
            causale: 'Accantonamento 2° rata Fondo Speciale Facciata',
          },
          {
            condominio_id: 'cond-1',
            fondo_id: 'f-spec-1',
            data: '2026-05-20',
            importo_centesimi: 1_500_000,
            segno: '-',
            causale: 'Pagamento Fattura n. 12/2026 1° SAL Impresa EdilRestauri',
          },
        ],
      );

      assert.equal(riepilogoSaldo.totaleAccantonatoCent, 4_000_000);
      assert.equal(riepilogoSaldo.totaleUtilizzatoCent, 1_500_000);
      assert.equal(riepilogoSaldo.saldoCalcolatoCent, 2_500_000);
      assert.equal(riepilogoSaldo.saldoCalcolatoEuro, 25_000);
      assert.equal(riepilogoSaldo.isSaldoAllineato, true);
      assert.equal(riepilogoSaldo.residuoDaAccantonareCent, 2_000_000);
      assert.equal(riepilogoSaldo.percentualeCoperturaObiettivo, 66.67);
    });
  });

  // ==========================================================================
  // 3. VINCOLO DI DESTINAZIONE E DIVIETO ASSOLUTO PER COMPENSO AMMINISTRATORE (RC-J4)
  // ==========================================================================
  describe('RC-J4 — Vincolo di destinazione, override tracciato e divieto assoluto compenso amministratore', () => {
    const fondoBase = {
      id: 'fondo-spec-1',
      condominio_id: 'cond-1',
      nome: 'Fondo Speciale Lavori Tetto',
      tipo: 'SPECIALE' as const,
      delibera_costituzione: 'Delibera 10/01/2026',
      importo_lavori_centesimi: 6_000_000,
      importo_obiettivo_centesimi: 6_000_000,
      saldo_attuale_centesimi: 3_000_000, // 30.000,00 € disponibili
      stato: 'VINCOLATO' as const,
    };

    it('consente il prelievo conforme alla destinazione deliberata entro la capienza del fondo', () => {
      const prelievoOk = validaERegistraMovimentoFondo({
        fondo: fondoBase,
        data: '2026-06-15',
        importoCent: 1_000_000, // 10.000,00 €
        segno: '-',
        causale: 'Saldo Fattura 1° SAL Rifacimento Tetto',
        codiceVoceSpesa: 'MANUT_STRAORD',
        destinazioneConformeAlVincolo: true,
      });

      assert.equal(prelievoOk.overrideApplicato, false);
      assert.equal(prelievoOk.nuovoSaldoFondoCent, 2_000_000);
      assert.equal(prelievoOk.eventoAudit, null);
    });

    it('blocca lo spostamento ad altra destinazione senza override e lo consente solo con motivo + delibera + audit (RC-J4)', () => {
      // 1) Senza override -> bloccato
      assert.throws(
        () =>
          validaERegistraMovimentoFondo({
            fondo: fondoBase,
            data: '2026-06-20',
            importoCent: 500_000,
            segno: '-',
            causale: 'Giroconto emergenza riparazione caldaia',
            destinazioneConformeAlVincolo: false,
            isOverrideVincolo: false,
          }),
        (err: unknown) =>
          err instanceof ErroreVincoloDestinazioneFondo &&
          err.codice === 'VINCOLO_DESTINAZIONE_FONDO_RC_J4',
      );

      // 2) Con override completo (motivo + delibera assembleare) -> consentito e tracciato in audit
      const conOverride = validaERegistraMovimentoFondo({
        fondo: fondoBase,
        data: '2026-06-20',
        importoCent: 500_000,
        segno: '-',
        causale: 'Utilizzo residuo per sostituzione urgente bruciatore caldaia',
        destinazioneConformeAlVincolo: false,
        isOverrideVincolo: true,
        motivoOverride: 'Economia di spesa sui lavori tetto destinata dall’assemblea a sostituzione caldaia',
        deliberaOverride: 'Verbale Assemblea 18/06/2026 - Delibera n. 3',
        autoreId: 'admin-1',
      });

      assert.equal(conOverride.overrideApplicato, true);
      assert.equal(conOverride.movimentoFondo.is_override_vincolo, true);
      assert.equal(conOverride.nuovoSaldoFondoCent, 2_500_000);
      assert.ok(conOverride.eventoAudit);
      assert.equal(conOverride.eventoAudit.azione, 'OVERRIDE_VINCOLO_DESTINAZIONE_FONDO');
    });

    it('RC-J4: vieta SEMPRE di usare il fondo per pagare il compenso dell’amministratore, anche se viene passato un override con motivo e delibera', () => {
      // Per codice voce COMPENSO_ADMIN
      assert.throws(
        () =>
          validaERegistraMovimentoFondo({
            fondo: fondoBase,
            data: '2026-07-01',
            importoCent: 150_000,
            segno: '-',
            causale: 'Pagamento fattura studio amministrazione',
            codiceVoceSpesa: 'COMPENSO_ADMIN',
            isOverrideVincolo: true,
            motivoOverride: 'Tentativo di usare il fondo con override',
            deliberaOverride: 'Delibera 01/07/2026',
          }),
        (err: unknown) =>
          err instanceof ErroreDivietoCompensoAdminFondo &&
          err.codice === 'DIVIETO_COMPENSO_ADMIN_FONDO_RC_J4',
      );

      // Per causale testuale "compenso amministratore" o flag isCompensoAdmin
      assert.throws(
        () =>
          validaERegistraMovimentoFondo({
            fondo: {
              ...fondoBase,
              tipo: 'CASSA',
              nome: 'Fondo Cassa Ordinario',
            },
            data: '2026-07-01',
            importoCent: 100_000,
            segno: '-',
            causale: 'Prelievo per saldo compenso amministratore 2026',
            isOverrideVincolo: true,
            motivoOverride: 'Copertura temporanea cassa per onorario amministratore',
            deliberaOverride: 'Delibera 01/07/2026',
          }),
        (err: unknown) => err instanceof ErroreDivietoCompensoAdminFondo,
      );
    });

    it('impedisce prelievi superiori al saldo disponibile del fondo', () => {
      assert.throws(
        () =>
          validaERegistraMovimentoFondo({
            fondo: fondoBase, // saldo 3.000.000 cent
            data: '2026-07-10',
            importoCent: 4_000_000, // richiesta 4.000.000 cent
            segno: '-',
            causale: 'Pagamento fattura eccedente saldo fondo',
          }),
        (err: unknown) => err instanceof ErroreCapienzaFondoInsufficiente,
      );
    });
  });

  // ==========================================================================
  // 4. UNICITA' DEL CONTO CORRENTE CONDOMINIALE (RC-J5)
  // ==========================================================================
  describe('RC-J5 — Riconciliazione dei fondi come voci contabili sull’unico conto corrente', () => {
    it('riconcilia i fondi con il saldo dell’unico conto corrente condominiale calcolando la liquidità libera', () => {
      const riconciliazione = riconciliaFondiConContoUnico({
        condominioId: 'cond-1',
        ibanContoUnico: 'IT60X0542811101000000123456',
        saldoContoCorrenteCent: 5_000_000, // 50.000,00 € sul conto corrente unico
        fondi: [
          {
            id: 'f-1',
            condominio_id: 'cond-1',
            nome: 'Fondo Speciale Lavori Facciata',
            tipo: 'SPECIALE',
            importo_obiettivo_centesimi: 6_000_000,
            saldo_attuale_centesimi: 2_500_000, // 25.000,00 €
            stato: 'VINCOLATO',
          },
          {
            id: 'f-2',
            condominio_id: 'cond-1',
            nome: 'Fondo Cassa Riserva',
            tipo: 'CASSA',
            importo_obiettivo_centesimi: 500_000,
            saldo_attuale_centesimi: 400_000, // 4.000,00 €
            stato: 'ATTIVO',
          },
          {
            id: 'f-3',
            condominio_id: 'cond-1',
            nome: 'Fondo Morosità',
            tipo: 'MOROSITA',
            importo_obiettivo_centesimi: 300_000,
            saldo_attuale_centesimi: 100_000, // 1.000,00 €
            stato: 'ATTIVO',
          },
        ],
      });

      assert.equal(riconciliazione.isFondoVoceContabileNonContoAggiuntivo, true);
      assert.equal(riconciliazione.numeroContiCorrentiCondominio, 1);
      assert.equal(riconciliazione.totaleFondiAccantonatiCent, 3_000_000); // 30.000,00 €
      assert.equal(riconciliazione.liquiditaLiberaNonVincolataCent, 2_000_000); // 20.000,00 €
      assert.equal(riconciliazione.coperturaBancariaFondiValida, true);
      assert.equal(riconciliazione.avvisoDisallineamentoLiquidita, null);
    });
  });
});
