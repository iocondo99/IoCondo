import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  approvaPreventivo,
  assertEmissioneRateConsentita,
  assertModificaBollettinoConsentita,
  assertPreventivoModificabile,
  calcolaTotalePreventivoDaVoci,
  creaNuovaVersionePreventivo,
  emettiBollettino,
  ErroreBollettinoEmessoImmutabile,
  ErroreControlliEmissioneBollettino,
  ErroreFondoSpecialeMancante,
  ErrorePreventivoImmutabile,
  ErrorePreventivoNonApprovato,
  ErroreTransizioneBollettinoNonValida,
  ErroreTransizionePreventivoNonValida,
  eseguiControlliPreEmissione,
  generaPianoRate,
  individuaBollettiniImpattatiDaRicalcolo,
  normalizzaStatoBollettino,
  normalizzaStatoPreventivo,
  raggruppaRateInBollettini,
  registraIncassoSuBollettino,
  rettificaBollettinoEmesso,
  risolviSoggettoPaganteUnita,
  validaEmissioneRateDaPreventivo,
  validaModificaBollettino,
  validaTransizioneStatoBollettino,
  validaTransizioneStatoPreventivo,
  verificaAnomalieBollettino,
  verificaBollettino,
} from './bollettiniLogic.ts';
import { createContabilitaService } from './contabilitaService.ts';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';

// ============================================================================
// 1. CICLO DI VITA DEL PREVENTIVO (RC-D2, RC-D5)
// ============================================================================

describe('Ciclo di vita del preventivo: bozza -> approvato -> superato (RC-D2, RC-D5)', () => {
  it('normalizza gli stati preventivo sia maiuscoli sia minuscoli', () => {
    assert.equal(normalizzaStatoPreventivo('bozza'), 'BOZZA');
    assert.equal(normalizzaStatoPreventivo('APPROVATO'), 'APPROVATO');
    assert.equal(normalizzaStatoPreventivo('superato'), 'SUPERATO');
    assert.throws(() => normalizzaStatoPreventivo('INVALIDO'), TypeError);
  });

  it('consente solo le transizioni BOZZA -> APPROVATO e APPROVATO -> SUPERATO', () => {
    assert.equal(validaTransizioneStatoPreventivo('bozza', 'approvato').valido, true);
    assert.equal(validaTransizioneStatoPreventivo('approvato', 'superato').valido, true);

    assert.equal(validaTransizioneStatoPreventivo('BOZZA', 'SUPERATO').valido, false);
    assert.equal(validaTransizioneStatoPreventivo('APPROVATO', 'BOZZA').valido, false);
    assert.equal(validaTransizioneStatoPreventivo('SUPERATO', 'APPROVATO').valido, false);
  });

  it('calcola il totale del preventivo in centesimi interi dalle singole voci (RC-D2)', () => {
    const totale = calcolaTotalePreventivoDaVoci([
      { descrizione: 'Pulizia scale', importoPrevistoCent: 350_000 },
      { descrizione: 'Luce e forza motrice', importoPrevistoCent: 250_000 },
      { descrizione: 'Manutenzione ascensore', importoPrevistoCent: 400_000 },
    ]);
    assert.equal(totale, 1_000_000); // 10.000,00 €
  });

  it('approva un preventivo in bozza richiedendo obbligatoriamente data assemblea e delibera (RC-D2)', () => {
    const bozza = {
      id: 'prev-v1',
      condominio_id: 'condo-1',
      esercizio_id: 'es-2026',
      gestione_id: 'gest-ord-2026',
      versione: 1,
      stato: 'bozza' as const,
      totale_previsto_centesimi: 1_000_000,
      autore_id: 'admin-1',
    };

    // Mancanza data assemblea -> errore
    assert.throws(
      () =>
        approvaPreventivo({
          preventivo: bozza,
          dataAssemblea: '',
          deliberaRiferimento: 'Delibera n. 3/2026',
        }),
      /data dell'assemblea/,
    );

    // Mancanza delibera -> errore
    assert.throws(
      () =>
        approvaPreventivo({
          preventivo: bozza,
          dataAssemblea: '2026-02-15',
          deliberaRiferimento: '',
        }),
      /delibera assembleare/,
    );

    const esito = approvaPreventivo({
      preventivo: bozza,
      dataAssemblea: '2026-02-15',
      deliberaRiferimento: 'Verbale Assemblea 15/02/2026 - Punto 2 OdG',
      autoreId: 'admin-1',
      timestampIso: '2026-02-15T20:30:00.000Z',
    });

    assert.equal(esito.preventivoApprovato.stato, 'APPROVATO');
    assert.equal(esito.preventivoApprovato.data_approvazione, '2026-02-15');
    assert.equal(
      esito.preventivoApprovato.delibera_approvazione,
      'Verbale Assemblea 15/02/2026 - Punto 2 OdG',
    );
    assert.equal(esito.preventivoSuperato, null);
    assert.equal(esito.eventoAudit.azione, 'APPROVAZIONE_PREVENTIVO');
    assert.equal(esito.eventoAudit.recordId, 'prev-v1');
  });

  it('gestisce le variazioni in corso d’esercizio creando una nuova versione e passando la precedente a SUPERATO senza sovrascriverla (RC-D5)', () => {
    const v1Approvato = {
      id: 'prev-v1',
      condominio_id: 'condo-1',
      esercizio_id: 'es-2026',
      gestione_id: 'gest-ord-2026',
      versione: 1,
      stato: 'APPROVATO' as const,
      totale_previsto_centesimi: 1_000_000, // 10.000,00 €
      data_approvazione: '2026-02-15',
      delibera_approvazione: 'Delibera n. 2/2026',
      autore_id: 'admin-1',
    };

    // Un preventivo APPROVATO non può essere modificato direttamente
    assert.throws(() => assertPreventivoModificabile(v1Approvato), ErrorePreventivoImmutabile);

    // Creazione nuova versione v2 approvata subito che sostituisce v1
    const esitoV2 = creaNuovaVersionePreventivo({
      preventivoPrecedente: v1Approvato,
      nuovoId: 'prev-v2',
      nuovoTotalePrevistoCent: 1_200_000, // 12.000,00 €
      note: 'Integrazione preventivo per rincaro energia',
      approvaSubito: true,
      dataAssemblea: '2026-06-20',
      deliberaRiferimento: 'Delibera n. 8/2026',
      autoreId: 'admin-1',
    });

    // v2 è APPROVATO con versione 2 e punta a v1
    assert.equal(esitoV2.nuovoPreventivo.id, 'prev-v2');
    assert.equal(esitoV2.nuovoPreventivo.versione, 2);
    assert.equal(esitoV2.nuovoPreventivo.stato, 'APPROVATO');
    assert.equal(esitoV2.nuovoPreventivo.precedente_id, 'prev-v1');
    assert.equal(esitoV2.nuovoPreventivo.totale_previsto_centesimi, 1_200_000);
    assert.equal(esitoV2.nuovoPreventivo.data_approvazione, '2026-06-20');
    assert.equal(esitoV2.nuovoPreventivo.delibera_approvazione, 'Delibera n. 8/2026');

    // v1 è passato a SUPERATO ma i suoi importi e delibera storici sono rimasti intatti
    assert.equal(esitoV2.preventivoPrecedenteAggiornato.id, 'prev-v1');
    assert.equal(esitoV2.preventivoPrecedenteAggiornato.stato, 'SUPERATO');
    assert.equal(esitoV2.preventivoPrecedenteAggiornato.totale_previsto_centesimi, 1_000_000);
    assert.equal(esitoV2.preventivoPrecedenteAggiornato.data_approvazione, '2026-02-15');
    assert.equal(esitoV2.preventivoPrecedenteAggiornato.delibera_approvazione, 'Delibera n. 2/2026');
  });
});

// ============================================================================
// 2. BLOCCO EMISSIONE RATE DA PREVENTIVO NON APPROVATO E FONDO SPECIALE (RC-D4, RC-J2, T7, T16)
// ============================================================================

describe('Blocco emissione rate da preventivo non approvato e override tracciato (RC-D4, T16) + Fondo Speciale (RC-J2, T7)', () => {
  it('T16: blocca l’emissione rate da preventivo in stato BOZZA se non è fornito override esplicito (RC-D4)', () => {
    const esito = validaEmissioneRateDaPreventivo({
      statoPreventivo: 'bozza',
      preventivoId: 'prev-bozza-1',
      condominioId: 'condo-1',
    });

    assert.equal(esito.consentita, false);
    assert.equal(esito.emissioneBloccata, true);
    assert.equal(esito.codiceBlocco, 'PREVENTIVO_NON_APPROVATO');
    assert.ok(esito.errore?.includes('RC-D4'));

    assert.throws(
      () =>
        assertEmissioneRateConsentita({
          statoPreventivo: 'BOZZA',
          preventivoId: 'prev-bozza-1',
        }),
      ErrorePreventivoNonApprovato,
    );
  });

  it('T16: consente l’emissione da preventivo non approvato solo con override completo (motivo + delibera) e genera evento di audit + warning (RC-D4, RC-N3)', () => {
    // Override senza delibera -> bloccato
    const esitoIncompleto = validaEmissioneRateDaPreventivo({
      statoPreventivo: 'BOZZA',
      preventivoId: 'prev-bozza-1',
      override: {
        forzaEmissione: true,
        motivoOverride: 'Acconto urgente bollette invernali',
        deliberaOverride: '',
      },
    });
    assert.equal(esitoIncompleto.consentita, false);
    assert.equal(esitoIncompleto.codiceBlocco, 'OVERRIDE_INCOMPLETO');

    // Override completo -> consentito con eventoAudit e avviso non bloccante
    const esitoOverride = validaEmissioneRateDaPreventivo({
      statoPreventivo: 'BOZZA',
      preventivoId: 'prev-bozza-1',
      condominioId: 'condo-1',
      esercizioId: 'es-2026',
      autoreId: 'admin-1',
      override: {
        forzaEmissione: true,
        motivoOverride: 'Emissione rata provvisoria su base esercizio precedente per continuità forniture',
        deliberaOverride: 'Delibera transitoria n. 12/2025',
      },
    });

    assert.equal(esitoOverride.consentita, true);
    assert.equal(esitoOverride.emissioneBloccata, false);
    assert.equal(esitoOverride.emessaConOverride, true);
    assert.equal(
      esitoOverride.motivoOverride,
      'Emissione rata provvisoria su base esercizio precedente per continuità forniture',
    );
    assert.equal(esitoOverride.deliberaOverride, 'Delibera transitoria n. 12/2025');
    assert.ok(esitoOverride.avviso?.includes('Attenzione'));
    assert.notEqual(esitoOverride.eventoAudit, null);
    assert.equal(esitoOverride.eventoAudit?.azione, 'OVERRIDE_EMISSIONE_RATE_PREVENTIVO_BOZZA');
    assert.equal(esitoOverride.eventoAudit?.tabella, 'rate_testata');
  });

  it('T7: blocca l’emissione di rate straordinarie per lavori se non è costituito il fondo speciale pari all’importo dei lavori (RC-J2)', () => {
    const esitoSenzaFondo = validaEmissioneRateDaPreventivo({
      statoPreventivo: 'APPROVATO',
      tipoGestione: 'STRAORDINARIA',
      importoLavoriStraordinariCent: 5_000_000, // 50.000,00 €
      fondoSpecialeCostituito: false,
    });

    assert.equal(esitoSenzaFondo.consentita, false);
    assert.equal(esitoSenzaFondo.emissioneBloccata, true);
    assert.equal(esitoSenzaFondo.codiceBlocco, 'FONDO_SPECIALE_MANCANTE');

    assert.throws(
      () =>
        assertEmissioneRateConsentita({
          statoPreventivo: 'APPROVATO',
          tipoGestione: 'STRAORDINARIA',
          importoLavoriStraordinariCent: 5_000_000,
          fondoSpecialeCostituito: false,
        }),
      ErroreFondoSpecialeMancante,
    );

    // Con fondo speciale regolarmente costituito di pari importo -> consentito
    const esitoConFondo = validaEmissioneRateDaPreventivo({
      statoPreventivo: 'APPROVATO',
      tipoGestione: 'STRAORDINARIA',
      importoLavoriStraordinariCent: 5_000_000,
      fondoSpecialeCostituito: true,
      importoFondoSpecialeCent: 5_000_000,
    });
    assert.equal(esitoConFondo.consentita, true);
    assert.equal(esitoConFondo.emissioneBloccata, false);
  });
});

// ============================================================================
// 3. GENERAZIONE PIANO RATE E BOLLETTINO MULTI-RIGA PER PROPRIETARIO CON PIÙ UNITÀ (RC-D3, RC-E1, T13)
// ============================================================================

describe('Generazione piano rate e raggruppamento bollettino multi-riga per proprietario con più unità (RC-D3, RC-E1, T13)', () => {
  it('T13: Proprietario con 2 unità (Unità 1 = 50 millesimi, Unità 2 = 30 millesimi su 1.000) su spesa/preventivo di 10.000,00 € -> unico bollettino da 800,00 € con 2 righe distinte (500,00 € + 300,00 €)', () => {
    const piano = generaPianoRate({
      condominioId: 'condo-1',
      esercizioId: 'es-2026',
      preventivoId: 'prev-2026',
      versionePreventivo: 1,
      statoPreventivo: 'APPROVATO',
      gestioneId: 'gest-ord-2026',
      importoPreventivoCent: 1_000_000, // 10.000,00 €
      annoBollettini: 2026,
      numeroProgressivoInizialeBollettini: 1,
      scadenze: [
        {
          numeroRata: 1,
          dataScadenza: '2026-03-31',
          percentuale: 100,
          descrizione: 'Rata Unica Preventivo 2026',
        },
      ],
      unita: [
        {
          unitaId: 'unita-1-appartamento',
          interno: 'Int. 1 (Appartamento)',
          millesimi: 50,
          utenteId: 'prop-multi-1',
          soggettoId: 'sogg-multi-1',
          intestazione: 'Mario Rossi',
        },
        {
          unitaId: 'unita-2-box',
          interno: 'Box B1 (Pertinenza)',
          millesimi: 30,
          utenteId: 'prop-multi-1',
          soggettoId: 'sogg-multi-1',
          intestazione: 'Mario Rossi',
        },
        {
          unitaId: 'unita-3-altri',
          interno: 'Int. 2-10',
          millesimi: 920,
          utenteId: 'prop-altri',
          soggettoId: 'sogg-altri',
          intestazione: 'Altri Condomini',
        },
      ],
    });

    assert.equal(piano.rateTestata.length, 1);
    const dettagli = piano.rateTestata[0]!.dettagli;
    const quotaUnita1 = dettagli.find((d) => d.unitaId === 'unita-1-appartamento')!;
    const quotaUnita2 = dettagli.find((d) => d.unitaId === 'unita-2-box')!;

    // Verifica T13: Unità 1 = 500,00 € (50.000 cent), Unità 2 = 300,00 € (30.000 cent)
    assert.equal(quotaUnita1.importoDovutoCent, 50_000);
    assert.equal(quotaUnita1.importoDovutoEuro, 500);
    assert.equal(quotaUnita2.importoDovutoCent, 30_000);
    assert.equal(quotaUnita2.importoDovutoEuro, 300);

    // Verifica raggruppamento in un unico bollettino multi-riga per Mario Rossi
    const bollettiniMario = piano.bollettiniProposti.filter(
      (b) => b.destinatarioSoggettoId === 'sogg-multi-1',
    );
    assert.equal(bollettiniMario.length, 1);

    const bollMario = bollettiniMario[0]!;
    assert.equal(bollMario.totaleCent, 80_000); // 800,00 €
    assert.equal(bollMario.totaleEuro, 800);
    assert.equal(bollMario.righe.length, 2);
    assert.equal(bollMario.righe[0]!.unitaId, 'unita-1-appartamento');
    assert.equal(bollMario.righe[0]!.importoCent, 50_000);
    assert.equal(bollMario.righe[1]!.unitaId, 'unita-2-box');
    assert.equal(bollMario.righe[1]!.importoCent, 30_000);
  });

  it('risolve correttamente il soggetto pagante in caso di subentro (vendita in corso d’anno, RC-H4)', () => {
    const titolaritaSubentro = [
      {
        utenteId: 'venditore-1',
        soggettoId: 'sogg-venditore',
        intestazione: 'Giuseppe Verdi (Venditore)',
        ruoloTitolarita: 'PROPRIETARIO' as const,
        dataInizio: '2020-01-01',
        dataFine: '2026-06-30',
      },
      {
        utenteId: 'acquirente-1',
        soggettoId: 'sogg-acquirente',
        intestazione: 'Laura Bianchi (Acquirente)',
        ruoloTitolarita: 'PROPRIETARIO' as const,
        dataInizio: '2026-07-01',
        dataFine: null,
        dataAttoSubentro: '2026-07-01',
        danteCausaUtenteId: 'venditore-1',
      },
    ];

    // Rata scaduta prima del subentro (es. 31/03/2026) -> resta in capo al venditore
    const rataPreSubentro = risolviSoggettoPaganteUnita(
      {
        unitaId: 'unita-1',
        millesimi: 100,
        titolarita: titolaritaSubentro,
      },
      '2026-03-31',
      'ORDINARIA',
    );
    assert.equal(rataPreSubentro.utenteId, 'venditore-1');

    // Rata successiva al subentro (es. 30/09/2026) -> va all'acquirente con tracciamento obbligato in solido (art. 63 disp. att. c.c.)
    const rataPostSubentro = risolviSoggettoPaganteUnita(
      {
        unitaId: 'unita-1',
        millesimi: 100,
        titolarita: titolaritaSubentro,
      },
      '2026-09-30',
      'ORDINARIA',
    );
    assert.equal(rataPostSubentro.utenteId, 'acquirente-1');
    assert.equal(rataPostSubentro.obbligatoInSolidoUtenteId, 'venditore-1');
  });
});

// ============================================================================
// 4. CICLO DI VITA DEL BOLLETTINO E RETTIFICA CON TRASCINAMENTO INCASSI (RC-E2, RC-E4, T11)
// ============================================================================

describe('Ciclo di vita immutabile del bollettino e rettifica per sostituzione (RC-E2, RC-E4, T11)', () => {
  it('valida l’intero ciclo di vita: bozza -> verificato -> emesso -> parzialmente pagato -> pagato', () => {
    assert.equal(normalizzaStatoBollettino('parzialmente pagato'), 'PARZIALMENTE_PAGATO');
    assert.equal(validaTransizioneStatoBollettino('bozza', 'verificato').valido, true);
    assert.equal(validaTransizioneStatoBollettino('verificato', 'emesso').valido, true);
    assert.equal(validaTransizioneStatoBollettino('emesso', 'parzialmente pagato').valido, true);
    assert.equal(validaTransizioneStatoBollettino('parzialmente pagato', 'pagato').valido, true);

    // Non si può emettere direttamente da BOZZA senza passare per VERIFICATO
    assert.equal(validaTransizioneStatoBollettino('BOZZA', 'EMESSO').valido, false);
  });

  it('percorre verifica -> emissione con conferma admin -> incasso parziale -> incasso a saldo e blocca modifiche dirette dopo l’emissione (RC-E2, RC-E3)', () => {
    const bozza = {
      id: 'boll-1',
      condominio_id: 'condo-1',
      esercizio_id: 'es-2026',
      anno: 2026,
      numero_progressivo: 1,
      destinatario_utente_id: 'utente-1',
      destinatario_soggetto_id: 'sogg-1',
      intestazione_destinatario: 'Mario Rossi',
      totale_centesimi: 25_000, // 250,00 €
      importo_pagato_centesimi: 0,
      data_scadenza: '2026-03-31',
      stato: 'BOZZA' as const,
    };

    const righe = [
      {
        unitaId: 'unita-1',
        gestioneId: 'gest-ord',
        descrizione: 'Rata 1/2026 - Int. 1',
        importoCent: 25_000,
        dataScadenza: '2026-03-31',
      },
    ];

    // 1. BOZZA -> VERIFICATO
    const { bollettinoVerificato } = verificaBollettino({
      bollettino: bozza,
      righe,
    });
    assert.equal(bollettinoVerificato.stato, 'VERIFICATO');

    // 2. VERIFICATO -> EMESSO (richiede confermaEsplicitaAdmin: true)
    assert.throws(
      () =>
        emettiBollettino({
          bollettino: bollettinoVerificato,
          confermaEsplicitaAdmin: false,
          confermatoDa: 'admin-1',
        }),
      /conferma esplicita/,
    );

    const { bollettinoEmesso, statoRateCollegate } = emettiBollettino({
      bollettino: bollettinoVerificato,
      confermaEsplicitaAdmin: true,
      confermatoDa: 'admin-1',
      dataEmissione: '2026-03-01',
    });
    assert.equal(bollettinoEmesso.stato, 'EMESSO');
    assert.equal(statoRateCollegate, 'EMESSA');

    // 3. Un bollettino EMESSO è immutabile nei suoi campi economici (RC-E2)
    assert.throws(
      () =>
        assertModificaBollettinoConsentita(bollettinoEmesso, {
          totale_centesimi: 20_000,
        }),
      ErroreBollettinoEmessoImmutabile,
    );

    // 4. EMESSO -> PARZIALMENTE_PAGATO (incasso 100,00 € su 250,00 €)
    const dopoAcconto = registraIncassoSuBollettino({
      bollettino: bollettinoEmesso,
      importoIncassoCent: 10_000,
    });
    assert.equal(dopoAcconto.bollettinoAggiornato.stato, 'PARZIALMENTE_PAGATO');
    assert.equal(dopoAcconto.nuovoImportoPagatoCent, 10_000);
    assert.equal(dopoAcconto.saldoResiduoCent, 15_000);

    // 5. PARZIALMENTE_PAGATO -> PAGATO (saldo dei restanti 150,00 €)
    const dopoSaldo = registraIncassoSuBollettino({
      bollettino: dopoAcconto.bollettinoAggiornato,
      importoIncassoCent: 15_000,
    });
    assert.equal(dopoSaldo.bollettinoAggiornato.stato, 'PAGATO');
    assert.equal(dopoSaldo.saldoResiduoCent, 0);
    assert.equal(dopoSaldo.statoRataModello, 'PAGATA');
  });

  it('T11: Rettifica di bollettino emesso con incasso parziale — Bollettino n. 12 da 250,00 € con 100,00 € pagati -> n. 12 annullato, n. 13 da 230,00 € lo sostituisce, 100,00 € trascinati e saldo residuo 130,00 € (RC-E4)', () => {
    const bollettinoN12 = {
      id: 'boll-n12',
      condominio_id: 'condo-1',
      esercizio_id: 'es-2026',
      anno: 2026,
      numero_progressivo: 12,
      destinatario_utente_id: 'utente-rossi',
      destinatario_soggetto_id: 'sogg-rossi',
      intestazione_destinatario: 'Mario Rossi',
      totale_centesimi: 25_000, // 250,00 €
      importo_pagato_centesimi: 10_000, // 100,00 € già incassati
      data_emissione: '2026-03-01',
      data_scadenza: '2026-03-31',
      stato: 'PARZIALMENTE_PAGATO' as const,
      confermato_da: 'admin-1',
      autore_id: 'admin-1',
      versione: 1,
    };

    const esito = rettificaBollettinoEmesso({
      bollettinoOriginale: bollettinoN12,
      nuovoBollettinoId: 'boll-n13',
      nuovoNumeroProgressivo: 13,
      nuovoTotaleCent: 23_000, // 230,00 €
      motivoRettifica: 'Ricalcolo quota per rettifica millesimi pertinenza',
      incassiGiaRegistrati: [
        {
          id: 'incasso-parziale-100',
          importoCent: 10_000, // 100,00 €
          dataValuta: '2026-03-10',
          pagatoreNome: 'Mario Rossi',
          riferimentoCro: 'CRO-100-N12',
        },
      ],
      autoreId: 'admin-1',
      timestampIso: '2026-03-20T10:00:00.000Z',
    });

    // 1. N. 12 annullato e collegato in avanti a N. 13
    assert.equal(esito.bollettinoOriginaleAnnullato.id, 'boll-n12');
    assert.equal(esito.bollettinoOriginaleAnnullato.numero_progressivo, 12);
    assert.equal(esito.bollettinoOriginaleAnnullato.stato, 'ANNULLATO');
    assert.equal(esito.bollettinoOriginaleAnnullato.sostituito_da_id, 'boll-n13');

    // 2. N. 13 creato con importo 230,00 € e collegato indietro a N. 12 (campo sostituisce / sostituisce_id)
    assert.equal(esito.nuovoBollettino.id, 'boll-n13');
    assert.equal(esito.nuovoBollettino.numero_progressivo, 13);
    assert.equal(esito.nuovoBollettino.sostituisce_id, 'boll-n12');
    assert.equal(esito.nuovoBollettino.sostituisce, 'boll-n12');
    assert.equal(esito.nuovoBollettino.sostituisceNumeroProgressivo, 12);
    assert.equal(esito.nuovoBollettino.totale_centesimi, 23_000); // 230,00 €

    // 3. Incasso di 100,00 € automaticamente trascinato sul N. 13 e saldo residuo = 130,00 €
    assert.equal(esito.incassiTrascinatiCent, 10_000);
    assert.equal(esito.incassiTrascinatiEuro, 100);
    assert.equal(esito.nuovoBollettino.importo_pagato_centesimi, 10_000);
    assert.equal(esito.saldoResiduoCent, 13_000); // 130,00 €
    assert.equal(esito.saldoResiduoEuro, 130);
    assert.equal(esito.nuovoBollettino.saldo_residuo_centesimi, 13_000);
    assert.equal(esito.nuovoBollettino.stato, 'PARZIALMENTE_PAGATO');

    // 4. L'incasso risulta trasferito da boll-n12 a boll-n13
    assert.equal(esito.incassiTrasferiti.length, 1);
    assert.equal(esito.incassiTrasferiti[0]!.bollettinoPrecedenteId, 'boll-n12');
    assert.equal(esito.incassiTrasferiti[0]!.bollettinoId, 'boll-n13');
    assert.equal(esito.incassiTrasferiti[0]!.importoCent, 10_000);

    // 5. Storico versioni completo con autore e motivo
    assert.equal(esito.storicoVersioni.length, 2);
    assert.equal(esito.storicoVersioni[0]!.numeroProgressivo, 12);
    assert.equal(esito.storicoVersioni[0]!.stato, 'ANNULLATO');
    assert.equal(esito.storicoVersioni[1]!.numeroProgressivo, 13);
    assert.equal(esito.storicoVersioni[1]!.sostituisceId, 'boll-n12');
    assert.equal(esito.storicoVersioni[1]!.saldoResiduoCent, 13_000);
  });
});

// ============================================================================
// 5. CONTROLLI PRE-EMISSIONE BLOCCANTI E WARNING NON BLOCCANTI (RC-E3, RC-N2, RC-N3, T14)
// ============================================================================

describe('Controlli automatici pre-emissione: bloccanti (RC-E3, RC-N2, T14) e warning non bloccanti (RC-N3)', () => {
  it('T14 & RC-N2: blocca l’emissione se la tabella millesimale non quadra a 1.000 (es. 998/1.000), se ci sono unità senza titolare, sovrapposizioni temporali, unità duplicate o quote negative', () => {
    const esito = eseguiControlliPreEmissione({
      bollettino: {
        id: 'boll-err',
        destinatarioUtenteId: 'u-1',
        totaleCent: 20_000,
        dataScadenza: '2026-03-31',
        righe: [
          {
            unitaId: 'unita-1',
            rataDettaglioId: 'rata-1',
            gestioneId: 'gest-1',
            importoCent: 15_000,
          },
          {
            // Stessa unità e stessa rata duplicata nello stesso bollettino!
            unitaId: 'unita-1',
            rataDettaglioId: 'rata-1',
            gestioneId: 'gest-1',
            importoCent: -2_000, // Quota negativa!
          },
        ],
      },
      tabellaMillesimale: {
        id: 'tab-a-998',
        nome: 'Tabella A Proprietà Generale',
        totaleAtteso: 1000,
        statoApprovazione: 'APPROVATA',
        quote: [
          { unitaId: 'unita-1', millesimi: 500 },
          { unitaId: 'unita-2', millesimi: 498 }, // Somma = 998 != 1000 (T14)
        ],
      },
      unitaConTitolarita: [
        {
          unitaId: 'unita-1',
          haTitolareAttivo: true,
          titolarita: [
            {
              utenteId: 'u-1',
              ruoloTitolarita: 'PROPRIETARIO',
              quotaPossesso: 100,
              dataInizio: '2026-01-01',
              dataFine: '2026-12-31',
            },
            {
              utenteId: 'u-2',
              ruoloTitolarita: 'PROPRIETARIO',
              quotaPossesso: 100, // 2 proprietari al 100% sovrapposti!
              dataInizio: '2026-06-01',
              dataFine: '2026-12-31',
            },
          ],
        },
        {
          unitaId: 'unita-2',
          haTitolareAttivo: false, // Unità senza titolare!
        },
        {
          unitaId: 'unita-3',
          haTitolareAttivo: true,
          titolarita: [
            {
              utenteId: 'u-3',
              ruoloTitolarita: 'COMPROPRIETARIO',
              quotaPossesso: 60, // 60% != 100%
              dataInizio: '2026-01-01',
              dataFine: '2026-12-31',
            },
          ],
        },
      ],
      dataRiferimentoTitolarita: '2026-07-01',
      totaleAttesoComplessivoCent: 100_000,
      sommaQuoteCalcolateCent: 99_999, // Differenza di 1 centesimo!
    });

    assert.equal(esito.emissioneBloccata, true);
    assert.equal(esito.emissioneConsentita, false);
    assert.equal(esito.statoConsigliato, 'BOZZA');

    const codici = esito.anomalieBloccanti.map((a) => a.codice);
    assert.ok(codici.includes('TABELLA_MILLESIMALE_NON_QUADRA'));
    assert.ok(codici.includes('UNITA_SENZA_TITOLARE'));
    assert.ok(codici.includes('TITOLARITA_SOVRAPPOSIZIONE'));
    assert.ok(codici.includes('QUOTE_PROPRIETARI_NON_100'));
    assert.ok(codici.includes('UNITA_DUPLICATA_NEL_BOLLETTINO'));
    assert.ok(codici.includes('QUOTA_NEGATIVA'));
    assert.ok(codici.includes('SQUADRATURA_TOTALE_BOLLETTINO'));
    assert.ok(codici.includes('SOMMA_QUOTE_DIVERSA_DA_SPESA'));
  });

  it('RC-N3: rileva i warning non bloccanti (tabella in bozza, criterio personalizzato senza atto, spesa senza allegato, registrazione > 30gg, override preventivo) lasciando consentita l’emissione', () => {
    const esito = verificaAnomalieBollettino({
      bollettino: {
        id: 'boll-ok',
        destinatarioUtenteId: 'u-1',
        totaleCent: 50_000,
        dataScadenza: '2026-03-31',
        righe: [
          {
            unitaId: 'unita-1',
            rataDettaglioId: 'rata-1',
            gestioneId: 'gest-1',
            importoCent: 50_000,
          },
        ],
      },
      tabellaMillesimale: {
        id: 'tab-bozza',
        nome: 'Tabella Scala A',
        totaleAtteso: 1000,
        statoApprovazione: 'BOZZA', // Warning RC-N3
        quote: [{ unitaId: 'unita-1', millesimi: 1000 }],
      },
      speseCollegate: [
        {
          id: 'sp-1',
          descrizione: 'Riparazione urgente',
          chiPaga: 'PERSONALIZZATO',
          attoDerogaTipo: null, // Warning RC-N3
          attoDerogaData: null,
          docAllegatoId: null, // Warning RC-N3
          dataMovimento: '2026-01-01',
          dataRegistrazione: '2026-02-15', // 45 giorni > 30gg -> Warning RC-N3
        },
      ],
      statoPreventivo: 'BOZZA',
      emessaConOverride: true,
      motivoOverride: 'Acconto urgente deliberato',
      deliberaOverride: 'Delibera n. 1/2026',
    });

    assert.equal(esito.emissioneBloccata, false);
    assert.equal(esito.emissioneConsentita, true);
    assert.equal(esito.anomalieBloccanti.length, 0);

    const codiciWarning = esito.avvisiNonBloccanti.map((w) => w.codice);
    assert.ok(codiciWarning.includes('TABELLA_NON_APPROVATA'));
    assert.ok(codiciWarning.includes('CRITERIO_PERSONALIZZATO_SENZA_ATTO'));
    assert.ok(codiciWarning.includes('SPESA_SENZA_GIUSTIFICATIVO'));
    assert.ok(codiciWarning.includes('REGISTRAZIONE_OLTRE_30_GIORNI'));
    assert.ok(codiciWarning.includes('RATE_EMESSE_CON_OVERRIDE_PREVENTIVO'));
  });

  it('RC-N4 / RC-N5: individua i bollettini emessi impattati da un ricalcolo e calcola le differenze', () => {
    const impattati = individuaBollettiniImpattatiDaRicalcolo([
      {
        id: 'boll-12',
        numero_progressivo: 12,
        intestazione_destinatario: 'Mario Rossi',
        totale_centesimi: 25_000,
        nuovoTotaleRicalcolatoCent: 23_000,
      },
      {
        id: 'boll-14',
        numero_progressivo: 14,
        intestazione_destinatario: 'Luigi Verdi',
        totale_centesimi: 18_000,
        nuovoTotaleRicalcolatoCent: 18_000, // Invariato
      },
    ]);

    assert.equal(impattati.length, 1);
    assert.equal(impattati[0]!.bollettinoId, 'boll-12');
    assert.equal(impattati[0]!.differenzaCent, -2_000);
    assert.equal(impattati[0]!.richiedeRettificaSostitutiva, true);
  });
});

// ============================================================================
// 6. TEST INTEGRAZIONE SERVIZIO CONTABILITA' CON MOCK SUPABASE CLIENT
// ============================================================================

describe('createContabilitaService — Preventivi, Piano Rate, Bollettini e Audit Log', () => {
  function creaMockSupabase() {
    const store: Record<string, Array<Record<string, unknown>>> = {
      preventivi: [],
      preventivi_voci: [],
      rate_testata: [],
      rate_dettaglio: [],
      bollettini: [],
      bollettini_righe: [],
      audit_logs: [],
    };
    let seq = 1;

    function createBuilder(table: string) {
      let op: 'select' | 'insert' | 'update' = 'select';
      let insertData: unknown = null;
      let updateData: Record<string, unknown> = {};
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];

      const execute = () => {
        const tableRows = store[table] ?? (store[table] = []);
        if (op === 'insert') {
          const items = Array.isArray(insertData) ? insertData : [insertData];
          const inserted = items.map((item) => {
            const rec = {
              id: (item as Record<string, unknown>).id ?? `${table}-${seq++}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...(item as Record<string, unknown>),
            };
            tableRows.push(rec);
            return rec;
          });
          return { data: Array.isArray(insertData) ? inserted : inserted[0], error: null };
        }
        if (op === 'update') {
          const matched = tableRows.filter((r) => filters.every((f) => f(r)));
          for (const r of matched) {
            Object.assign(r, updateData, { updated_at: new Date().toISOString() });
          }
          return { data: matched, error: null };
        }
        const matched = tableRows.filter((r) => filters.every((f) => f(r)));
        return { data: matched, error: null };
      };

      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        insert(payload: unknown) {
          op = 'insert';
          insertData = payload;
          return builder;
        },
        update(payload: Record<string, unknown>) {
          op = 'update';
          updateData = payload;
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return builder;
        },
        is(col: string, val: unknown) {
          filters.push((r) => (r[col] ?? null) === val);
          return builder;
        },
        in(col: string, vals: unknown[]) {
          filters.push((r) => vals.includes(r[col]));
          return builder;
        },
        order() {
          return builder;
        },
        single() {
          const res = execute();
          const row = Array.isArray(res.data) ? res.data[0] : res.data;
          return Promise.resolve({ data: row ?? null, error: row ? null : { message: 'Not found' } });
        },
        maybeSingle() {
          const res = execute();
          const row = Array.isArray(res.data) ? res.data[0] : res.data;
          return Promise.resolve({ data: row ?? null, error: null });
        },
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return Promise.resolve(execute()).then(onFulfilled, onRejected);
        },
      };

      return builder;
    }

    const db = {
      from(table: string) {
        return createBuilder(table);
      },
    } as unknown as TypedSupabaseClient;

    return { db, store };
  }

  it('gestisce via service creazione preventivo, approvazione con audit, piano rate multi-riga, emissione e rettifica bollettino (T11, T13)', async () => {
    const { db, store } = creaMockSupabase();
    const service = createContabilitaService(db);

    // 1. Crea preventivo in BOZZA (10.000,00 €)
    const { preventivo: prevBozza } = await service.creaPreventivo({
      condominioId: 'condo-1',
      esercizioId: 'es-2026',
      gestioneId: 'gest-ord-2026',
      voci: [
        { descrizione: 'Pulizia e igiene', importoPrevistoCent: 600_000 },
        { descrizione: 'Manutenzione ordinaria', importoPrevistoCent: 400_000 },
      ],
      autoreId: 'admin-1',
    });
    assert.equal(prevBozza.stato, 'BOZZA');
    assert.equal(prevBozza.totale_previsto_centesimi, 1_000_000);

    // 2. Tentativo di generare piano rate da preventivo BOZZA senza override -> bloccato (T16)
    await assert.rejects(
      () =>
        service.generaPianoRateEBozzeBollettini({
          condominioId: 'condo-1',
          esercizioId: 'es-2026',
          preventivoId: prevBozza.id,
          scadenzeRate: [{ numeroRata: 1, dataScadenza: '2026-03-31', percentualePreventivo: 100 }],
          unita: [
            { unitaId: 'u-1', unitaInterno: 'Int. 1', millesimi: 1000, utenteId: 'prop-1' },
          ],
        }),
      ErrorePreventivoNonApprovato,
    );

    // 3. Approva il preventivo con data assemblea e delibera -> registra audit log
    const { preventivoApprovato, auditLog: auditPrev } = await service.approvaPreventivo({
      preventivoId: prevBozza.id,
      condominioId: 'condo-1',
      dataAssemblea: '2026-02-20',
      deliberaRiferimento: 'Delibera Assembleare n. 4/2026',
      autoreId: 'admin-1',
    });
    assert.equal(preventivoApprovato.stato, 'APPROVATO');
    assert.equal(auditPrev.azione, 'APPROVAZIONE_PREVENTIVO');

    // 4. Genera piano rate e bollettini bozza per proprietario con 2 unità (T13: 50 + 30 millesimi = 800,00 €)
    const pianoRes = await service.generaPianoRateEBozzeBollettini({
      condominioId: 'condo-1',
      esercizioId: 'es-2026',
      preventivoId: preventivoApprovato.id,
      annoBollettini: 2026,
      primoProgressivoBollettino: 12,
      scadenzeRate: [
        { numeroRata: 1, dataScadenza: '2026-03-31', percentualePreventivo: 100 },
      ],
      unita: [
        {
          unitaId: 'u-1',
          unitaInterno: 'Int. 1',
          millesimi: 50,
          utenteId: 'prop-rossi',
          soggettoId: 'sogg-rossi',
          intestazioneDestinatario: 'Mario Rossi',
        },
        {
          unitaId: 'u-2',
          unitaInterno: 'Box 1',
          millesimi: 30,
          utenteId: 'prop-rossi',
          soggettoId: 'sogg-rossi',
          intestazioneDestinatario: 'Mario Rossi',
        },
        {
          unitaId: 'u-3',
          unitaInterno: 'Restanti unità',
          millesimi: 920,
          utenteId: 'prop-altri',
          soggettoId: 'sogg-altri',
          intestazioneDestinatario: 'Altri Condomini',
        },
      ],
      autoreId: 'admin-1',
    });

    const bollRossiBozza = pianoRes.bollettiniBozza.find(
      (b) => b.bollettino.destinatario_soggetto_id === 'sogg-rossi',
    )!;
    assert.equal(bollRossiBozza.bollettino.totale_centesimi, 80_000); // 800,00 €
    assert.equal(bollRossiBozza.righe.length, 2);

    // 5. Verifica ed emissione del bollettino di Mario Rossi
    const verRes = await service.verificaBollettino({
      bollettinoId: bollRossiBozza.bollettino.id,
      condominioId: 'condo-1',
    });
    assert.equal(verRes.bollettino.stato, 'VERIFICATO');

    const emessoRes = await service.emettiBollettino({
      bollettinoId: bollRossiBozza.bollettino.id,
      condominioId: 'condo-1',
      confermaEsplicitaAdmin: true,
      confermatoDa: 'admin-1',
      dataEmissione: '2026-03-01',
    });
    assert.equal(emessoRes.bollettino.stato, 'EMESSO');

    // 6. Rettifica del bollettino emesso con incasso parziale di 100,00 € trascinato (T11)
    const rettRes = await service.rettificaBollettinoEmesso({
      bollettinoOriginaleId: emessoRes.bollettino.id,
      condominioId: 'condo-1',
      nuovoTotaleCent: 75_000, // 750,00 €
      nuoveRighe: [
        {
          unitaId: 'u-1',
          descrizione: 'Rata 1/2026 - Int. 1 (rettificata)',
          importoCent: 45_000,
        },
        {
          unitaId: 'u-2',
          descrizione: 'Rata 1/2026 - Box 1',
          importoCent: 30_000,
        },
      ],
      motivoRettifica: 'Rettifica quota Int. 1 dopo revisione millesimale',
      importoGiaIncassatoCent: 10_000, // 100,00 €
      autoreId: 'admin-1',
    });

    assert.equal(rettRes.bollettinoOriginaleAnnullato.stato, 'ANNULLATO');
    assert.equal(rettRes.nuovoBollettino.sostituisce_id, emessoRes.bollettino.id);
    assert.equal(rettRes.nuovoBollettino.totale_centesimi, 75_000);
    assert.equal(rettRes.nuovoBollettino.importo_pagato_centesimi, 10_000);
    assert.equal(rettRes.esitoRettifica.saldoResiduoCent, 65_000);
    assert.equal(rettRes.nuovoBollettino.stato, 'PARZIALMENTE_PAGATO');
    assert.ok((store.audit_logs?.length ?? 0) >= 3);
  });
});
