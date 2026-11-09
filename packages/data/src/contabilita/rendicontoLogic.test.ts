import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertQuadraturaRiepilogoFinanziario,
  assertRendicontoCompleto,
  assertRendicontoModificabile,
  assertTransizioneRendicontoValida,
  calcolaConguagliEsercizio,
  calcolaConguaglioUnita,
  calcolaScadenzaApprovazioneRendiconto,
  costruisciRiepilogoFinanziario,
  ErroreApprovazioneRendiconto,
  ErroreChiusuraEsercizio,
  ErroreQuadraturaRiepilogoFinanziario,
  ErroreRegolazioneConguaglio,
  ErroreRendicontoApprovatoImmodificabile,
  ErroreRendicontoIncompleto,
  ErroreTransizioneRendicontoNonValida,
  isRendicontoModificabile,
  pianificaRegolazioneConguaglio,
  precompilaNotaSintetica,
  preparaApprovazioneRendiconto,
  preparaChiusuraEsercizio,
  preparaRettificaRendiconto,
  riconciliaCassaCompetenza,
  validaCompletezzaRendiconto,
  valutaPromemoriaApprovazioneRendiconto,
} from './rendicontoLogic.ts';
import { aggiungiGiorniIso } from './morositaLogic.ts';

const COMPLETO_OK = {
  registroContabilitaCompleto: true,
  riepilogoFinanziario: { quadra: true },
  notaSintetica: 'Nessuna anomalia, un contenzioso con il fornitore ascensori.',
};

describe('rendicontoLogic — Sezione 8 (RC-K1..K8, RC-L1..L6, T5, T15)', () => {
  describe('RC-K1 & T15 — Inscindibilità dei tre documenti', () => {
    it('T15: manca la nota sintetica -> non può passare a "completo" ed è impugnabile', () => {
      const esito = validaCompletezzaRendiconto({ ...COMPLETO_OK, notaSintetica: '   ' });
      assert.equal(esito.completo, false);
      assert.equal(esito.impugnabile, true);
      assert.equal(esito.statoProposto, 'IN_PREPARAZIONE');
      assert.deepEqual(esito.documentiMancanti, ['NOTA_SINTETICA_ESPLICATIVA']);
      assert.throws(
        () => assertRendicontoCompleto({ ...COMPLETO_OK, notaSintetica: null }),
        ErroreRendicontoIncompleto,
      );
    });

    it('con registro, riepilogo quadrato e nota -> "completo"', () => {
      const esito = assertRendicontoCompleto(COMPLETO_OK);
      assert.equal(esito.completo, true);
      assert.equal(esito.impugnabile, false);
      assert.equal(esito.statoProposto, 'COMPLETO');
    });

    it('registro incompleto, riepilogo assente o non quadrato -> documenti mancanti', () => {
      const esito = validaCompletezzaRendiconto({
        registroContabilitaCompleto: false,
        riepilogoFinanziario: null,
        notaSintetica: 'x',
      });
      assert.deepEqual(esito.documentiMancanti, ['REGISTRO_CONTABILITA', 'RIEPILOGO_FINANZIARIO']);
      const nonQuadra = validaCompletezzaRendiconto({ ...COMPLETO_OK, riepilogoFinanziario: { quadra: false } });
      assert.deepEqual(nonQuadra.documentiMancanti, ['RIEPILOGO_FINANZIARIO']);
    });
  });

  describe('RC-K3 — Riepilogo finanziario e situazione patrimoniale', () => {
    const base = {
      saldoInizialeContoCent: 1_000_000,
      saldoInizialeCassaCent: 50_000,
      movimenti: [
        { importoCent: 800_000, segno: '+' as const },
        { importoCent: 650_000, segno: '-' as const },
        { importoCent: 20_000, segno: '+' as const, mezzo: 'CASSA' as const },
        { importoCent: 30_000, segno: '-' as const, mezzo: 'CASSA' as const },
      ],
      creditiVersoCondomini: [
        { soggettoId: 'A', importoCent: 30_000 },
        { soggettoId: 'B', importoCent: 20_000 },
      ],
      debitiVersoFornitori: [{ fornitoreId: 'F1', importoCent: 15_000 }],
      fondi: [{ nome: 'Fondo cassa', tipo: 'CASSA' as const, saldoCent: 300_000 }],
    };

    it('saldo finale = saldo iniziale + entrate − uscite (conto e cassa)', () => {
      const r = costruisciRiepilogoFinanziario(base);
      assert.equal(r.saldoFinaleContoCent, 1_150_000);
      assert.equal(r.saldoFinaleCassaCent, 40_000);
      assert.equal(r.entrateTotaliCent, 820_000);
      assert.equal(r.usciteTotaliCent, 680_000);
      assert.equal(r.quadra, true);
      assert.doesNotThrow(() => assertQuadraturaRiepilogoFinanziario(r));
    });

    it('situazione patrimoniale: crediti, debiti, fondi e patrimonio netto', () => {
      const r = costruisciRiepilogoFinanziario(base);
      assert.equal(r.creditiVersoCondominiCent, 50_000);
      assert.equal(r.numeroCondominiDebitori, 2);
      assert.equal(r.debitiVersoFornitoriCent, 15_000);
      assert.equal(r.numeroFornitoriCreditori, 1);
      assert.equal(r.consistenzaFondiCent, 300_000);
      assert.equal(r.liquiditaTotaleCent, 1_190_000);
      assert.equal(r.fondiCoperti, true);
      assert.equal(r.patrimonioNettoCent, 1_225_000);
    });

    it('saldo dichiarato diverso dal calcolato -> non quadra e solleva errore', () => {
      const r = costruisciRiepilogoFinanziario({ ...base, saldoFinaleContoDichiaratoCent: 1_149_000 });
      assert.equal(r.quadra, false);
      assert.equal(r.differenzaQuadraturaContoCent, -1_000);
      assert.throws(() => assertQuadraturaRiepilogoFinanziario(r), ErroreQuadraturaRiepilogoFinanziario);
    });

    it('fondi superiori alla liquidità -> non coperti; importi negativi rifiutati', () => {
      const r = costruisciRiepilogoFinanziario({ ...base, fondi: [{ nome: 'Speciale', saldoCent: 2_000_000 }] });
      assert.equal(r.fondiCoperti, false);
      assert.throws(
        () => costruisciRiepilogoFinanziario({ ...base, movimenti: [{ importoCent: -1, segno: '+' }] }),
        RangeError,
      );
    });

    it('RC-K4: la nota precompilata contiene i dati principali', () => {
      const r = costruisciRiepilogoFinanziario(base);
      const nota = precompilaNotaSintetica({ anno: 2026, riepilogo: r, numeroFornitori: 3 });
      assert.match(nota, /esercizio 2026/);
      assert.match(nota, /3 fornitori/);
      assert.match(nota, /nessun contenzioso segnalato/);
    });
  });

  describe('RC-K5 — Riconciliazione cassa-competenza', () => {
    const risultato = riconciliaCassaCompetenza({
      inizioEsercizio: '2026-01-01',
      fineEsercizio: '2026-12-31',
      movimenti: [
        { id: 'm1', importoCent: 100_000, segno: '-', dataCassa: '2026-03-10', dataCompetenza: '2026-03-10' },
        { id: 'm2', importoCent: 36_500, segno: '-', dataCassa: null, dataCompetenza: '2026-12-20' },
        { id: 'm3', importoCent: 50_000, segno: '+', dataCassa: null, dataCompetenza: '2026-11-05' },
        {
          id: 'm4',
          importoCent: 73_000,
          segno: '-',
          dataCassa: '2026-07-01',
          competenzaDa: '2026-07-01',
          competenzaA: '2027-06-30',
        },
        {
          id: 'm5',
          importoCent: 10_000,
          segno: '-',
          dataCassa: '2026-02-01',
          competenzaDa: '2025-12-01',
          competenzaA: '2025-12-31',
        },
        {
          id: 'm6',
          importoCent: 36_500,
          segno: '-',
          dataCassa: null,
          competenzaDa: '2026-07-01',
          competenzaA: '2027-06-30',
        },
        { id: 'm7', importoCent: 5_000, segno: '+', dataCassa: '2025-12-15', dataCompetenza: '2026-01-10' },
      ],
    });

    it('calcola risultato di cassa, di competenza e differenza', () => {
      assert.equal(risultato.risultatoCassaCent, -183_000);
      assert.equal(risultato.risultatoCompetenzaCent, -136_700);
      assert.equal(risultato.differenzaCent, 46_300);
    });

    it('rileva automaticamente crediti, debiti, ratei, risconti e regolazioni pregresse', () => {
      assert.equal(risultato.creditiCent, 50_000);
      assert.equal(risultato.debitiCent, 36_500);
      assert.equal(risultato.rateiPassiviCent, 18_400);
      assert.equal(risultato.rateiAttiviCent, 0);
      assert.equal(risultato.riscontiAttiviCent, 36_200);
      assert.equal(risultato.regolazioniPregresseCent, 10_000);
      assert.equal(risultato.riscontiPregressiCent, 5_000);
    });

    it('la differenza è interamente spiegata dalle voci rilevate', () => {
      assert.equal(risultato.quadra, true);
    });

    it('un movimento regolato e di competenza nell’esercizio non genera voci', () => {
      const r = riconciliaCassaCompetenza({
        inizioEsercizio: '2026-01-01',
        fineEsercizio: '2026-12-31',
        movimenti: [{ id: 'x', importoCent: 1_000, segno: '+', dataCassa: '2026-05-01', dataCompetenza: '2026-05-01' }],
      });
      assert.equal(r.voci.length, 0);
      assert.equal(r.differenzaCent, 0);
    });
  });

  describe('RC-L1, RC-L2, T5 — Conguaglio individuale e aggregato', () => {
    it('T5: rate versate 1.200,00 €, consuntivo 1.340,00 € -> debito 140,00 €', () => {
      const c = calcolaConguaglioUnita({ unitaId: 'U1', quotaConsuntivoCent: 134_000, rateVersateCent: 120_000 });
      assert.equal(c.conguaglioCent, 14_000);
      assert.equal(c.tipo, 'DEBITO');
      assert.equal(c.debitoCent, 14_000);
    });

    it('credito quando le rate superano il consuntivo', () => {
      const c = calcolaConguaglioUnita({ unitaId: 'U2', quotaConsuntivoCent: 50_000, rateVersateCent: 60_000 });
      assert.equal(c.tipo, 'CREDITO');
      assert.equal(c.creditoCent, 10_000);
    });

    it('soggetto con più unità: conguaglio aggregato con dettaglio, separato per gestione', () => {
      const r = calcolaConguagliEsercizio([
        { unitaId: 'U1', soggettoId: 'S', gestioneId: 'G1', quotaConsuntivoCent: 134_000, rateVersateCent: 120_000 },
        { unitaId: 'U2', soggettoId: 'S', gestioneId: 'G1', quotaConsuntivoCent: 50_000, rateVersateCent: 60_000 },
        { unitaId: 'U3', soggettoId: 'T', gestioneId: 'G1', quotaConsuntivoCent: 30_000, rateVersateCent: 30_000 },
        { unitaId: 'U1', soggettoId: 'S', gestioneId: 'G2', quotaConsuntivoCent: 10_000, rateVersateCent: 0 },
      ]);
      assert.equal(r.aggregatiPerSoggetto.length, 3);
      const sG1 = r.aggregatiPerSoggetto.find((a) => a.soggettoId === 'S' && a.gestioneId === 'G1');
      assert.ok(sG1);
      assert.equal(sG1.conguaglioCent, 4_000);
      assert.equal(sG1.tipo, 'DEBITO');
      assert.equal(sG1.dettaglioUnita.length, 2);
      const t = r.aggregatiPerSoggetto.find((a) => a.soggettoId === 'T');
      assert.equal(t?.tipo, 'PAREGGIO');
      assert.equal(r.totaleDebitiCent, 24_000);
      assert.equal(r.totaleCreditiCent, 10_000);
      assert.equal(r.saldoNettoCent, 14_000);
    });

    it('rifiuta quote o rate negative', () => {
      assert.throws(() => calcolaConguaglioUnita({ unitaId: 'U', quotaConsuntivoCent: -1, rateVersateCent: 0 }), RangeError);
    });
  });

  describe('RC-L5 — Compensazione sulla prima rata o rimborso', () => {
    it('compensazione totale sulla prima rata successiva', () => {
      const r = pianificaRegolazioneConguaglio({
        conguaglioCent: -10_000,
        scelta: 'COMPENSAZIONE_PRIMA_RATA',
        primaRataSuccessiva: { id: 'R1', importoDovutoCent: 25_000 },
        conguaglioId: 'C1',
        condominioId: 'COND',
        autoreId: 'ADM',
      });
      assert.equal(r.modalitaRegolazione, 'COMPENSATO_RATA');
      assert.equal(r.importoCompensatoCent, 10_000);
      assert.equal(r.nuovoImportoPrimaRataCent, 15_000);
      assert.equal(r.rataCompensazioneId, 'R1');
      assert.equal(r.eventoAudit.azione, 'COMPENSAZIONE_CREDITO_CONGUAGLIO');
      assert.equal(r.eventoAudit.recordId, 'C1');
    });

    it('rata inferiore al credito: residuo riportato', () => {
      const r = pianificaRegolazioneConguaglio({
        conguaglioCent: -10_000,
        scelta: 'COMPENSAZIONE_PRIMA_RATA',
        primaRataSuccessiva: { id: 'R1', importoDovutoCent: 6_000 },
      });
      assert.equal(r.importoCompensatoCent, 6_000);
      assert.equal(r.residuoRiportatoCent, 4_000);
      assert.equal(r.nuovoImportoPrimaRataCent, 0);
      assert.equal(r.modalitaRegolazione, 'RIPORTATO_NUOVO_ESERCIZIO');
    });

    it('rimborso tracciato in audit', () => {
      const r = pianificaRegolazioneConguaglio({ conguaglioCent: -10_000, scelta: 'RIMBORSO' });
      assert.equal(r.modalitaRegolazione, 'RIMBORSATO');
      assert.equal(r.importoRimborsatoCent, 10_000);
      assert.equal(r.eventoAudit.azione, 'RIMBORSO_CREDITO_CONGUAGLIO');
    });

    it('errori: debito, compensazione senza rata', () => {
      assert.throws(
        () => pianificaRegolazioneConguaglio({ conguaglioCent: 100, scelta: 'RIMBORSO' }),
        ErroreRegolazioneConguaglio,
      );
      assert.throws(
        () => pianificaRegolazioneConguaglio({ conguaglioCent: -100, scelta: 'COMPENSAZIONE_PRIMA_RATA' }),
        ErroreRegolazioneConguaglio,
      );
    });
  });

  describe('RC-K8 — Scadenza a 180 giorni e promemoria a 60, 30 e 7 giorni', () => {
    const chiusura = '2026-12-31';
    const scadenza = '2027-06-29';
    const oggiA = (giorniResidui: number): string => aggiungiGiorniIso(scadenza, -giorniResidui);

    it('la scadenza è la chiusura + 180 giorni', () => {
      assert.equal(calcolaScadenzaApprovazioneRendiconto(chiusura), scadenza);
    });

    it('alert alle soglie 60, 30 e 7 giorni', () => {
      const v = (g: number) => valutaPromemoriaApprovazioneRendiconto({ dataChiusuraEsercizio: chiusura, oggi: oggiA(g) });
      assert.equal(v(61).soglia, null);
      assert.equal(v(61).livello, 'NESSUNO');
      assert.equal(v(60).soglia, 60);
      assert.equal(v(31).soglia, 60);
      assert.equal(v(30).soglia, 30);
      assert.equal(v(8).soglia, 30);
      assert.equal(v(7).soglia, 7);
      assert.equal(v(7).livello, 'URGENTE');
      assert.equal(v(0).scaduto, false);
      assert.equal(v(0).soglia, 7);
    });

    it('termine superato -> scaduto; rendiconto approvato -> promemoria non attivo', () => {
      const scaduto = valutaPromemoriaApprovazioneRendiconto({ dataChiusuraEsercizio: chiusura, oggi: oggiA(-3) });
      assert.equal(scaduto.scaduto, true);
      assert.equal(scaduto.livello, 'SCADUTO');
      const approvato = valutaPromemoriaApprovazioneRendiconto({
        dataChiusuraEsercizio: chiusura,
        oggi: oggiA(5),
        statoRendiconto: 'APPROVATO',
      });
      assert.equal(approvato.attivo, false);
      assert.equal(approvato.messaggio, null);
    });
  });

  describe('RC-K7 — Stati, blocco modifiche e approvazione', () => {
    it('un rendiconto approvato non è modificabile', () => {
      assert.equal(isRendicontoModificabile('APPROVATO'), false);
      assert.throws(() => assertRendicontoModificabile('APPROVATO', 'registra movimento'), ErroreRendicontoApprovatoImmodificabile);
      for (const s of ['IN_PREPARAZIONE', 'COMPLETO', 'RETTIFICATO'] as const) {
        assert.doesNotThrow(() => assertRendicontoModificabile(s));
      }
    });

    it('transizioni consentite e vietate', () => {
      assert.doesNotThrow(() => assertTransizioneRendicontoValida('IN_PREPARAZIONE', 'COMPLETO'));
      assert.doesNotThrow(() => assertTransizioneRendicontoValida('APPROVATO', 'RETTIFICATO'));
      assert.doesNotThrow(() => assertTransizioneRendicontoValida('RETTIFICATO', 'APPROVATO'));
      assert.throws(() => assertTransizioneRendicontoValida('IN_PREPARAZIONE', 'APPROVATO'), ErroreTransizioneRendicontoNonValida);
      assert.throws(() => assertTransizioneRendicontoValida('APPROVATO', 'IN_PREPARAZIONE'), ErroreTransizioneRendicontoNonValida);
    });

    const approvazioneBase = {
      statoRendiconto: 'COMPLETO' as const,
      completezza: COMPLETO_OK,
      dataAssemblea: '2027-04-20',
      deliberaApprovazione: 'Delibera n. 3/2027',
      dataChiusuraEsercizio: '2026-12-31',
      esercizioId: 'E1',
    };

    it('approvazione valida: data, delibera, stato e audit', () => {
      const a = preparaApprovazioneRendiconto(approvazioneBase);
      assert.equal(a.statoRendiconto, 'APPROVATO');
      assert.equal(a.statoModello, 'RENDICONTO_APPROVATO');
      assert.equal(a.tardiva, false);
      assert.equal(a.eventoAudit.azione, 'APPROVAZIONE_RENDICONTO');
    });

    it('approvazione oltre i 180 giorni: segnalata come tardiva', () => {
      const a = preparaApprovazioneRendiconto({ ...approvazioneBase, dataAssemblea: '2027-07-10' });
      assert.equal(a.tardiva, true);
      assert.equal(a.giorniRitardo, 11);
    });

    it('approvazione rifiutata se incompleto, senza delibera, già approvato o prima della chiusura', () => {
      assert.throws(
        () => preparaApprovazioneRendiconto({ ...approvazioneBase, completezza: { ...COMPLETO_OK, notaSintetica: '' } }),
        ErroreRendicontoIncompleto,
      );
      assert.throws(() => preparaApprovazioneRendiconto({ ...approvazioneBase, deliberaApprovazione: ' ' }), ErroreApprovazioneRendiconto);
      assert.throws(() => preparaApprovazioneRendiconto({ ...approvazioneBase, statoRendiconto: 'APPROVATO' }), ErroreRendicontoApprovatoImmodificabile);
      assert.throws(() => preparaApprovazioneRendiconto({ ...approvazioneBase, dataAssemblea: '2026-12-30' }), ErroreApprovazioneRendiconto);
      assert.throws(() => preparaApprovazioneRendiconto({ ...approvazioneBase, statoRendiconto: 'IN_PREPARAZIONE' }), ErroreTransizioneRendicontoNonValida);
    });

    it('rettifica: solo da approvato, con motivo', () => {
      const r = preparaRettificaRendiconto({ statoRendiconto: 'APPROVATO', motivo: 'Errore di riparto' });
      assert.equal(r.statoRendiconto, 'RETTIFICATO');
      assert.equal(r.eventoAudit.azione, 'RETTIFICA_RENDICONTO');
      assert.throws(() => preparaRettificaRendiconto({ statoRendiconto: 'APPROVATO', motivo: '' }), ErroreApprovazioneRendiconto);
      assert.throws(() => preparaRettificaRendiconto({ statoRendiconto: 'COMPLETO', motivo: 'x' }), ErroreTransizioneRendicontoNonValida);
    });
  });

  describe('Chiusura esercizio', () => {
    it('calcola data di chiusura e scadenza dei 180 giorni', () => {
      const c = preparaChiusuraEsercizio({ dataFineEsercizio: '2026-12-31', statoModello: 'APERTO' });
      assert.equal(c.statoModello, 'CHIUSO');
      assert.equal(c.dataChiusuraEffettiva, '2026-12-31');
      assert.equal(c.scadenzaApprovazione180gg, '2027-06-29');
      assert.equal(c.statoRendiconto, 'IN_PREPARAZIONE');
    });

    it('rifiuta esercizio già chiuso o chiusura anticipata', () => {
      assert.throws(() => preparaChiusuraEsercizio({ dataFineEsercizio: '2026-12-31', statoModello: 'CHIUSO' }), ErroreChiusuraEsercizio);
      assert.throws(
        () => preparaChiusuraEsercizio({ dataFineEsercizio: '2026-12-31', dataChiusuraEffettiva: '2026-12-01' }),
        ErroreChiusuraEsercizio,
      );
    });
  });
});
