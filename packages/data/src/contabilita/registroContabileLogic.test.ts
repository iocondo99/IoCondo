import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcolaImprontaSha256,
  validaIbanCondominio,
  mascheraIban,
  validaEccezioneContoCorrente,
  filtraMovimentiFuoriConto,
  rilevaRitardoRegistrazione,
  verificaRitardoRegistrazione,
  ordinaRegistroCronologico,
  validaImprontaGiustificativo,
  validaGiustificativoAllegato,
  verificaCompletezzaGiustificativiEsercizio,
  bloccaCancellazioneMovimento,
  ErroreCancellazioneContabileVietata,
  ErroreModificaEconomicaVietata,
  ErroreStornoNonConsentito,
  creaScritturaStorno,
  validaModificaMovimento,
  calcolaEValidaFatturaFornitore,
  VOCI_SPESA_CATALOGO_DEFAULT,
  risolviTagSpesaConTraccia,
  calcolaMenuChiPaga,
} from './registroContabileLogic.ts';

import { createContabilitaService } from './contabilitaService.ts';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';

describe('registroContabileLogic — Sezioni 4 e 5 Requisiti Contabili', () => {
  // =========================================================================
  // RC-A1 / RC-M5: IBAN condominio e mascheramento
  // =========================================================================
  describe('validaIbanCondominio e mascheraIban (RC-A1, RC-M5)', () => {
    it('valida un IBAN italiano formalmente corretto', () => {
      const esito = validaIbanCondominio('IT60 X054 2811 1010 0000 0123 456');
      assert.equal(esito.valido, true);
      assert.equal(esito.ibanNormalizzato, 'IT60X0542811101000000123456');
      assert.equal(esito.errore, null);
    });

    it('rifiuta IBAN assente o con lunghezza/formato non validi', () => {
      const errVuoto = validaIbanCondominio('');
      assert.equal(errVuoto.valido, false);
      assert.match(errVuoto.errore ?? '', /obbligatorio/i);

      const errLen = validaIbanCondominio('IT60X054281110100000');
      assert.equal(errLen.valido, false);
      assert.match(errLen.errore ?? '', /27 caratteri/i);
    });

    it('maschera correttamente l’IBAN per i ruoli non amministrativi (RC-M5)', () => {
      assert.equal(mascheraIban('IT60X0542811101000000123456'), 'IT60 **** **** 3456');
      assert.equal(mascheraIban(null), '—');
    });
  });

  // =========================================================================
  // RC-B1: Obbligo transito conto corrente ed eccezioni fuori conto
  // =========================================================================
  describe('validaEccezioneContoCorrente e filtraMovimentiFuoriConto (RC-B1)', () => {
    it('accetta movimenti ordinari transitati su conto corrente senza motivo eccezione', () => {
      const esito = validaEccezioneContoCorrente({
        eccezioneContoCorrente: false,
        motivoEccezioneCc: null,
      });
      assert.equal(esito.valido, true);
      assert.equal(esito.eccezioneContoCorrente, false);
      assert.equal(esito.motivoEccezioneCc, null);
      assert.equal(esito.inElencoControllo, false);
    });

    it('blocca un movimento fuori conto privo di motivazione obbligatoria', () => {
      const esitoVuoto = validaEccezioneContoCorrente({
        eccezioneContoCorrente: true,
        motivoEccezioneCc: '  ',
      });
      assert.equal(esitoVuoto.valido, false);
      assert.match(esitoVuoto.errore ?? '', /art\. 1129/i);
    });

    it('accetta un movimento fuori conto con motivazione e lo filtra nella sezione dedicata', () => {
      const esito = validaEccezioneContoCorrente({
        eccezioneContoCorrente: true,
        motivoEccezioneCc: 'Anticipo urgente fabbro per sblocco serratura portone notturno',
      });
      assert.equal(esito.valido, true);
      assert.equal(esito.eccezioneContoCorrente, true);
      assert.equal(esito.inElencoControllo, true);
      assert.match(esito.avviso ?? '', /elenco di controllo/i);

      const movimenti = [
        { id: 'm1', eccezione_conto_corrente: false },
        { id: 'm2', eccezione_conto_corrente: true },
        { id: 'm3', eccezioneContoCorrente: true },
      ];
      const fuoriConto = filtraMovimentiFuoriConto(movimenti);
      assert.deepEqual(
        fuoriConto.map((m) => m.id),
        ['m2', 'm3'],
      );
    });
  });

  // =========================================================================
  // RC-B2 / RC-N3: Ritardo di registrazione > 30 giorni solari e ordinamento
  // =========================================================================
  describe('rilevaRitardoRegistrazione e ordinaRegistroCronologico (RC-B2, RC-N3)', () => {
    it('non segnala ritardo se la registrazione avviene entro 30 giorni solari (incluso 30° giorno)', () => {
      const entro10 = rilevaRitardoRegistrazione('2026-03-01', '2026-03-11');
      assert.equal(entro10.inRitardo, false);
      assert.equal(entro10.giorniRitardo, 10);
      assert.equal(entro10.avviso, null);

      const esatto30 = rilevaRitardoRegistrazione({
        dataMovimento: '2026-03-01',
        dataRegistrazione: '2026-03-31',
      });
      assert.equal(esatto30.inRitardo, false);
      assert.equal(esatto30.giorniRitardo, 30);
      assert.equal(esatto30.avviso, null);
    });

    it('rileva ritardo > 30 giorni solari e restituisce alert non bloccante (art. 1130 n. 7 c.c.)', () => {
      const ritardo31 = rilevaRitardoRegistrazione('2026-03-01', '2026-04-01');
      assert.equal(ritardo31.inRitardo, true);
      assert.equal(ritardo31.superaSoglia, true);
      assert.equal(ritardo31.giorniRitardo, 31);
      assert.equal(ritardo31.bloccante, false);
      assert.equal(ritardo31.codiceAlert, 'RITARDO_REGISTRAZIONE_OLTRE_30GG');
      assert.match(ritardo31.avviso ?? '', /31 giorni di ritardo/i);
      assert.match(ritardo31.avviso ?? '', /art\. 1130 n\. 7/i);

      const aliasCheck = verificaRitardoRegistrazione('2026-01-10', '2026-03-01');
      assert.equal(aliasCheck.inRitardo, true);
      assert.equal(aliasCheck.giorniRitardo, 50);
    });

    it('segnala incoerenza se la data registrazione precede la data movimento', () => {
      const antecedente = rilevaRitardoRegistrazione('2026-05-10', '2026-05-01');
      assert.equal(antecedente.inRitardo, false);
      assert.equal(antecedente.registrazioneAntecedenteMovimento, true);
      assert.equal(antecedente.giorniRitardo, -9);
      assert.equal(antecedente.codiceAlert, 'DATA_REGISTRAZIONE_ANTECEDENTE');
    });

    it('ordina il registro cronologicamente per data movimento, numero progressivo e data registrazione', () => {
      const righe = [
        { id: 'r3', data: '2026-03-15', numero_progressivo: 3, data_registrazione: '2026-03-16' },
        { id: 'r2', data: '2026-03-10', numero_progressivo: 2, data_registrazione: '2026-03-12' },
        { id: 'r1', data: '2026-03-10', numero_progressivo: 1, data_registrazione: '2026-03-10' },
      ];
      const ordinate = ordinaRegistroCronologico(righe, 'asc');
      assert.deepEqual(
        ordinate.map((r) => r.id),
        ['r1', 'r2', 'r3'],
      );
    });
  });

  // =========================================================================
  // RC-B3 / RC-K1: Validazione giustificativo allegato e impronta SHA-256
  // =========================================================================
  describe('validaGiustificativoAllegato e SHA-256 (RC-B3, RC-K1)', () => {
    it('calcola un hash SHA-256 deterministico a 64 caratteri esadecimali', () => {
      const hashAbc = calcolaImprontaSha256('abc');
      assert.equal(
        hashAbc,
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
      const valid = validaImprontaGiustificativo(hashAbc);
      assert.equal(valid.valida, true);
      assert.equal(valid.improntaNormalizzata, `sha256:${hashAbc}`);

      const invalid = validaImprontaGiustificativo('non-un-hash');
      assert.equal(invalid.valida, false);
    });

    it('marca una spesa con PDF e impronta SHA-256 valida come REGISTRATA completa', () => {
      const esito = validaGiustificativoAllegato({
        docAllegatoId: 'doc-123',
        contenutoFile: 'FATTURA-ENEL-2026-001',
        tipoMime: 'application/pdf',
      });
      assert.equal(esito.valido, true);
      assert.equal(esito.spesaCompleta, true);
      assert.equal(esito.statoCompletezza, 'COMPLETA');
      assert.equal(esito.statoSpesaConsigliato, 'REGISTRATA');
      assert.equal(esito.impedisceRendicontoCompleto, false);
      assert.match(esito.improntaNormalizzata ?? '', /^sha256:[a-f0-9]{64}$/);
    });

    it('marca una spesa priva di allegato o impronta come BOZZA incompleta (bloccante per rendiconto completo)', () => {
      const senzaDoc = validaGiustificativoAllegato({
        docAllegatoId: null,
        improntaFile: null,
      });
      assert.equal(senzaDoc.valido, true);
      assert.equal(senzaDoc.spesaCompleta, false);
      assert.equal(senzaDoc.statoCompletezza, 'INCOMPLETA');
      assert.equal(senzaDoc.statoSpesaConsigliato, 'BOZZA');
      assert.equal(senzaDoc.impedisceRendicontoCompleto, true);

      const checkEsercizio = verificaCompletezzaGiustificativiEsercizio([
        {
          id: 'sp-1',
          descrizione: 'Pulizia scale marzo',
          stato_spesa: 'BOZZA',
          doc_allegato_id: null,
          impronta_file_giustificativo: null,
        },
        {
          id: 'sp-2',
          descrizione: 'Manutenzione ascensore',
          stato_spesa: 'REGISTRATA',
          doc_allegato_id: 'doc-999',
          impronta_file_giustificativo: calcolaImprontaSha256('ascensore-pdf'),
        },
      ]);
      assert.equal(checkEsercizio.registroCompleto, false);
      assert.deepEqual(checkEsercizio.movimentiIncompletiIds, ['sp-1']);
    });

    it('rifiuta formati non ammessi o impronte SHA-256 non corrispondenti al contenuto del file', () => {
      const mimeErrato = validaGiustificativoAllegato({
        docAllegatoId: 'doc-exe',
        improntaFile: calcolaImprontaSha256('test'),
        tipoMime: 'application/x-msdownload',
      });
      assert.equal(mimeErrato.valido, false);
      assert.match(mimeErrato.errore ?? '', /non ammesso/i);

      const hashMismatch = validaGiustificativoAllegato({
        docAllegatoId: 'doc-tampered',
        improntaFile: calcolaImprontaSha256('contenuto-originale'),
        contenutoFile: 'contenuto-alterato',
      });
      assert.equal(hashMismatch.valido, false);
      assert.match(hashMismatch.errore ?? '', /non corrisponde/i);
    });
  });

  // =========================================================================
  // RC-B4: Regola di non cancellazione contabile, storno e blocco modifiche
  // =========================================================================
  describe('bloccaCancellazioneMovimento, creaScritturaStorno e validaModificaMovimento (RC-B4)', () => {
    it('vieta sempre la cancellazione fisica di un movimento registrato', () => {
      assert.throws(
        () => bloccaCancellazioneMovimento('mov-001'),
        (err: unknown) =>
          err instanceof ErroreCancellazioneContabileVietata &&
          err.codice === 'CANCELLAZIONE_CONTABILE_VIETATA' &&
          err.movimentoId === 'mov-001',
      );
    });

    it('genera scrittura di storno uguale e contraria collegata all’originale con saldo netto zero', () => {
      const originale = {
        id: 'mov-orig-1',
        condominio_id: 'cond-1',
        esercizio_id: 'es-2026',
        gestione_id: 'gest-ord-2026',
        voce_spesa_id: 'voce-pulizia',
        sottoconto_id: 'sc-pulizia',
        fornitore_id: 'forn-1',
        data: '2026-04-10',
        data_registrazione: '2026-04-10',
        importo: 1220,
        importo_centesimi: 122_000,
        segno: '-' as const,
        descrizione: 'Fattura pulizia aprile 2026',
        doc_allegato_id: 'doc-1',
        impronta_file_giustificativo: `sha256:${calcolaImprontaSha256('pdf-pulizia-aprile')}`,
        tag_spesa: 'ORDINARIA' as const,
        competenza_da: '2026-04-01',
        competenza_a: '2026-04-30',
        chi_paga: 'TUTTI' as const,
        tabella_millesimale_id: 'tab-a-v2',
        versione_tabella: 2,
        palazzo_id: null,
        scala_colonna_id: null,
        stato_spesa: 'REGISTRATA' as const,
        storno_di_id: null,
        eccezione_conto_corrente: false,
        motivo_eccezione_cc: null,
        imponibile_centesimi: 100_000,
        iva_centesimi: 22_000,
        ritenuta_acconto_centesimi: 4_000,
        ritenuta_aliquota_perc: 4,
        numero_fattura: 'FT-2026/04',
        data_scadenza_fattura: '2026-04-30',
        fondo_id: null,
      };

      const risultato = creaScritturaStorno({
        movimentoOriginale: originale,
        motivoStorno: 'Importo errato rispetto a nota di credito fornitore',
        dataStorno: '2026-04-15',
        autoreId: 'user-admin-1',
      });

      assert.equal(risultato.saldoNettoCent, 0);
      assert.equal(risultato.patchMovimentoOriginale.stato_spesa, 'STORNATA');
      assert.equal(risultato.scritturaContraria.storno_di_id, 'mov-orig-1');
      assert.equal(risultato.scritturaContraria.segno, '+');
      assert.equal(risultato.scritturaContraria.importo_centesimi, 122_000);
      assert.equal(risultato.scritturaContraria.autore_id, 'user-admin-1');
      assert.match(risultato.scritturaContraria.descrizione, /^\[STORNO\]/);
    });

    it('impedisce di stornare un movimento già stornato o una scrittura di storno', () => {
      const giaStornato = {
        id: 'mov-x',
        esercizio_id: 'es-1',
        data: '2026-04-10',
        importo_centesimi: 10_000,
        segno: '-' as const,
        stato_spesa: 'STORNATA' as const,
        storno_di_id: null,
      };

      assert.throws(
        () =>
          creaScritturaStorno({
            movimentoOriginale: giaStornato,
            motivoStorno: 'Tentativo doppio storno',
            dataStorno: '2026-04-16',
          }),
        (err: unknown) => err instanceof ErroreStornoNonConsentito,
      );
    });

    it('consente la modifica descrittiva su movimento REGISTRATO ma segnala blocco su modifiche economiche', () => {
      const attuale = {
        id: 'mov-reg-1',
        esercizio_id: 'es-1',
        stato_spesa: 'REGISTRATA' as const,
        importo_centesimi: 50_000,
        segno: '-' as const,
        data: '2026-03-20',
        chi_paga: 'TUTTI' as const,
        tabella_millesimale_id: 'tab-a',
      };

      const modDescrittiva = validaModificaMovimento(attuale, {
        descrizione: 'Causale rettificata per chiarezza',
        doc_allegato_id: 'doc-new',
      });
      assert.equal(modDescrittiva.ammessa, true);
      assert.equal(modDescrittiva.richiedeStorno, false);

      const modEconomica = validaModificaMovimento(attuale, {
        importo_centesimi: 60_000,
      });
      assert.equal(modEconomica.ammessa, false);
      assert.equal(modEconomica.richiedeStorno, true);
      assert.deepEqual(modEconomica.campiEconomiciToccati, ['importo_centesimi']);
    });
  });

  // =========================================================================
  // RC-B5: Registrazione fatture fornitori con ritenuta solo analitica (no F24)
  // =========================================================================
  describe('calcolaEValidaFatturaFornitore (RC-B5)', () => {
    it('valida imponibile, IVA e ritenuta d’acconto 4% come solo dato analitico (generaF24 = false)', () => {
      const esito = calcolaEValidaFatturaFornitore({
        fornitoreId: 'forn-pulizie-1',
        partitaIvaFornitore: '01234567890',
        numeroFattura: 'FT-2026/042',
        dataFattura: '2026-03-15',
        imponibileCent: 100_000, // 1.000,00 €
        ivaCent: 22_000, // 220,00 € (22%)
        ritenutaAliquotaPerc: 4, // 4% su imponibile = 40,00 €
        competenzaDa: '2026-03-01',
        competenzaA: '2026-03-31',
      });

      assert.equal(esito.valido, true);
      assert.equal(esito.imponibileCent, 100_000);
      assert.equal(esito.ivaCent, 22_000);
      assert.equal(esito.totaleFatturaCent, 122_000);
      assert.equal(esito.ritenutaAccontoCent, 4_000);
      assert.equal(esito.nettoAPagareFornitoreCent, 118_000);
      assert.equal(esito.soloDatoAnaliticoRitenuta, true);
      assert.equal(esito.generaF24, false);
      assert.equal(esito.generaCu, false);
      assert.equal(esito.genera770, false);
    });

    it('rifiuta fattura con totale non quadrato o fornitore privo di CF/P.IVA', () => {
      const nonQuadrata = calcolaEValidaFatturaFornitore({
        fornitoreId: 'forn-1',
        partitaIvaFornitore: '01234567890',
        numeroFattura: 'FT-1',
        dataFattura: '2026-03-15',
        imponibileCent: 100_000,
        ivaCent: 22_000,
        totaleFatturaCent: 125_000,
        competenzaDa: '2026-03-01',
        competenzaA: '2026-03-31',
      });
      assert.equal(nonQuadrata.valido, false);
      assert.match(nonQuadrata.errore ?? '', /non coincide/i);

      const senzaPiva = calcolaEValidaFatturaFornitore({
        fornitoreId: 'forn-2',
        codiceFiscaleFornitore: '',
        partitaIvaFornitore: '',
        numeroFattura: 'FT-2',
        dataFattura: '2026-03-15',
        imponibileCent: 50_000,
        ivaCent: 11_000,
        competenzaDa: '2026-03-01',
        competenzaA: '2026-03-31',
      });
      assert.equal(senzaPiva.valido, false);
      assert.match(senzaPiva.errore ?? '', /Codice Fiscale o la Partita IVA/i);
    });
  });

  // =========================================================================
  // RC-C1 / RC-C2 / RC-C3 / RC-C4 / RC-C5 / RC-C6: Catalogo e menu "Chi paga"
  // =========================================================================
  describe('Catalogo voci e calcolaMenuChiPaga (RC-C1..RC-C6)', () => {
    const unitaCondominio = [
      { id: 'u1', palazzoId: 'pal-a', scalaColonnaId: 'sc-a', utenteId: 'ut-1' },
      { id: 'u2', palazzoId: 'pal-a', scalaColonnaId: 'sc-a', utenteId: 'ut-2' },
      { id: 'u3', palazzoId: 'pal-b', scalaColonnaId: 'sc-b', utenteId: 'ut-3' },
    ];

    const tabellaGenerale = {
      id: 'tab-a-v2',
      nome: 'Tabella A - Proprietà Generale',
      tipo: 'PROPRIETA' as const,
      versione: 2,
      statoApprovazione: 'APPROVATA' as const,
      totale: 1000,
      quote: [
        { unitaId: 'u1', millesimi: 400 },
        { unitaId: 'u2', millesimi: 350 },
        { unitaId: 'u3', millesimi: 250 },
      ],
    };

    const tabellaAscensore = {
      id: 'tab-b-v1',
      nome: 'Tabella B - Ascensore (art. 1124 c.c.)',
      tipo: 'ASCENSORE' as const,
      versione: 1,
      statoApprovazione: 'APPROVATA' as const,
      totale: 1000,
      quote: [
        { unitaId: 'u1', millesimi: 200 },
        { unitaId: 'u2', millesimi: 500 },
        { unitaId: 'u3', millesimi: 300 },
      ],
    };

    it('espone le 10 voci iniziali del catalogo e traccia il cambio di tag rispetto al default (RC-C1, RC-C2)', () => {
      assert.equal(VOCI_SPESA_CATALOGO_DEFAULT.length, 10);
      const voceStraord = VOCI_SPESA_CATALOGO_DEFAULT.find(
        (v) => v.codice === 'MANUT_STRAORD',
      )!;
      assert.equal(voceStraord.tagDefault, 'STRAORDINARIA');

      const risoluzione = risolviTagSpesaConTraccia({
        tagSpesa: 'ORDINARIA',
        tagDefaultVoce: voceStraord.tagDefault,
        motivoCambioTag: 'Piccola riparazione ricorrente deliberata come ordinaria',
      });
      assert.equal(risoluzione.tagSpesa, 'ORDINARIA');
      assert.equal(risoluzione.tagModificatoRispettoDefault, true);
      assert.match(risoluzione.tracciaCambioTag ?? '', /STRAORDINARIA a ORDINARIA/);
    });

    it('1) TUTTI: ripartisce su tutte le unità usando la tabella generale a 1000‰', () => {
      const res = calcolaMenuChiPaga({
        importoCent: 100_000, // 1.000,00 €
        chiPaga: 'TUTTI',
        unitaCondominio,
        tabellaMillesimale: tabellaGenerale,
        tagSpesa: 'ORDINARIA',
      });

      assert.equal(res.sommaQuoteFinaliCent, 100_000);
      assert.equal(res.righeRiparto.length, 3);
      assert.equal(res.righeRiparto.find((r) => r.unitaId === 'u1')?.importoQuotaCent, 40_000);
      assert.equal(res.righeRiparto.find((r) => r.unitaId === 'u2')?.importoQuotaCent, 35_000);
      assert.equal(res.righeRiparto.find((r) => r.unitaId === 'u3')?.importoQuotaCent, 25_000);
    });

    it('2) PALAZZO_SCALA: filtra le unità del solo palazzo selezionato e riproporziona a 750‰ (RC-C5)', () => {
      const res = calcolaMenuChiPaga({
        importoCent: 75_000, // 750,00 €
        chiPaga: 'PALAZZO_SCALA',
        palazzoId: 'pal-a', // u1 (400) + u2 (350) = 750 millesimi
        unitaCondominio,
        tabellaMillesimale: tabellaGenerale,
        tagSpesa: 'ORDINARIA',
      });

      assert.equal(res.righeRiparto.length, 2);
      assert.equal(res.righeRiparto[0]?.sommaValoriPartecipanti, 750);
      assert.equal(res.righeRiparto.find((r) => r.unitaId === 'u1')?.importoQuotaCent, 40_000);
      assert.equal(res.righeRiparto.find((r) => r.unitaId === 'u2')?.importoQuotaCent, 35_000);
    });

    it('3) TABELLA_SPECIFICA: usa la tabella dedicata e segnala warning se è in BOZZA (RC-A5)', () => {
      const tabellaBozza = { ...tabellaAscensore, statoApprovazione: 'BOZZA' as const };
      const res = calcolaMenuChiPaga({
        importoCent: 10_000,
        chiPaga: 'TABELLA_SPECIFICA',
        unitaCondominio,
        tabellaMillesimale: tabellaBozza,
        tagSpesa: 'ORDINARIA',
      });

      assert.equal(res.sommaQuoteFinaliCent, 10_000);
      assert.ok(res.avvisi.some((a) => /stato BOZZA/i.test(a)));
    });

    it('4) PERSONALIZZATO: richiede obbligatoriamente atto, data e motivazione e supporta sia millesimi sia importi (RC-C6)', () => {
      assert.throws(() =>
        calcolaMenuChiPaga({
          importoCent: 30_000,
          chiPaga: 'PERSONALIZZATO',
          personalizzato: null,
        }),
      );

      const conAttoImporti = calcolaMenuChiPaga({
        importoCent: 30_000,
        chiPaga: 'PERSONALIZZATO',
        unitaCondominio,
        tagSpesa: 'STRAORDINARIA',
        personalizzato: {
          attoDerogaTipo: 'DELIBERA_UNANIME',
          attoDerogaData: '2026-02-18',
          attoDerogaNumero: 'DEL-2026-02',
          motivazioneDeroga: 'Accordo unanime condòmini scala A per sostituzione citofono video',
          modalita: 'IMPORTI',
          quote: [
            { unitaId: 'u1', importoCent: 12_500 },
            { unitaId: 'u2', importoCent: 17_500 },
          ],
        },
      });
      assert.equal(conAttoImporti.sommaQuoteFinaliCent, 30_000);
      assert.equal(conAttoImporti.attoDeroga?.tipo, 'DELIBERA_UNANIME');
      assert.equal(conAttoImporti.righeRiparto[0]?.importoQuotaCent, 12_500);
      assert.equal(conAttoImporti.righeRiparto[1]?.importoQuotaCent, 17_500);
    });
  });

  // =========================================================================
  // Service test: createContabilitaService con mock TypedSupabaseClient
  // =========================================================================
  describe('createContabilitaService — Dependency Injection e operazioni contabili', () => {
    it('registra una spesa con riparto generato, blocca eliminazione e gestisce lo storno (RC-B4, RC-C4)', async () => {
      const insertedMovimenti: Record<string, unknown>[] = [];
      const insertedRiparti: Record<string, unknown>[] = [];

      const mockDb = {
        from(table: string) {
          if (table === 'voci_spesa_catalogo') {
            return {
              select() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          maybeSingle: async () => ({
                            data: null,
                            error: null,
                          }),
                        };
                      },
                    };
                  },
                };
              },
            };
          }

          if (table === 'esercizi_contabili') {
            return {
              // Guard RC-K7: esercizio con rendiconto non approvato
              select() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          maybeSingle: async () => ({
                            data: { stato_rendiconto: 'IN_PREPARAZIONE' },
                            error: null,
                          }),
                        };
                      },
                    };
                  },
                };
              },
              update() {
                return {
                  eq() {
                    return {
                      eq: async () => ({ data: null, error: null }),
                    };
                  },
                };
              },
            };
          }

          if (table === 'movimenti_contabili') {
            return {
              select(cols?: string) {
                if (cols === 'numero_progressivo') {
                  return {
                    eq() {
                      return {
                        eq: async () => ({
                          data: [{ numero_progressivo: insertedMovimenti.length }],
                          error: null,
                        }),
                      };
                    },
                  };
                }
                if (cols?.includes('impronta_file_giustificativo')) {
                  return {
                    eq() {
                      return {
                        eq: async () => ({
                          data: insertedMovimenti.map((m, idx) => ({
                            id: `mov-${idx + 1}`,
                            ...m,
                          })),
                          error: null,
                        }),
                      };
                    },
                  };
                }
                return {
                  eq(_col: string, val: string) {
                    return {
                      eq() {
                        return {
                          single: async () => ({
                            data: {
                              id: val,
                              condominio_id: 'cond-1',
                              esercizio_id: 'es-2026',
                              gestione_id: 'gest-ord',
                              voce_spesa_id: null,
                              sottoconto_id: 'sc-1',
                              fornitore_id: 'forn-1',
                              numero_progressivo: 1,
                              data: '2026-03-01',
                              data_registrazione: '2026-04-20',
                              importo: 1000,
                              importo_centesimi: 100_000,
                              segno: '-',
                              descrizione: 'Spesa pulizia marzo',
                              doc_allegato_id: 'doc-1',
                              impronta_file_giustificativo: `sha256:${calcolaImprontaSha256('pdf-1')}`,
                              tag_spesa: 'ORDINARIA',
                              competenza_da: '2026-03-01',
                              competenza_a: '2026-03-31',
                              chi_paga: 'TUTTI',
                              tabella_millesimale_id: 'tab-a-v2',
                              versione_tabella: 2,
                              palazzo_id: null,
                              scala_colonna_id: null,
                              stato_spesa: 'REGISTRATA',
                              storno_di_id: null,
                              eccezione_conto_corrente: false,
                              motivo_eccezione_cc: null,
                            },
                            error: null,
                          }),
                        };
                      },
                    };
                  },
                };
              },
              insert(payload: Record<string, unknown>) {
                insertedMovimenti.push(payload);
                return {
                  select() {
                    return {
                      single: async () => ({
                        data: {
                          id: `mov-${insertedMovimenti.length}`,
                          created_at: '2026-04-20T10:00:00Z',
                          updated_at: '2026-04-20T10:00:00Z',
                          ...payload,
                        },
                        error: null,
                      }),
                    };
                  },
                };
              },
              update(payload: Record<string, unknown>) {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          select() {
                            return {
                              single: async () => ({
                                data: { id: 'mov-1', ...payload },
                                error: null,
                              }),
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          }

          if (table === 'riparti_spese') {
            return {
              insert(rows: Record<string, unknown>[]) {
                insertedRiparti.push(...rows);
                return {
                  select: async () => ({
                    data: rows.map((r, idx) => ({ id: `rip-${idx + 1}`, ...r })),
                    error: null,
                  }),
                };
              },
            };
          }

          throw new Error(`Tabella inattesa nel mock: ${table}`);
        },
      } as unknown as TypedSupabaseClient;

      const service = createContabilitaService(mockDb);

      // 1. Registrazione spesa con riparto automatico e rilevazione ritardo (> 30 gg tra 2026-03-01 e 2026-04-20)
      const esitoSpesa = await service.registraSpesaConRiparto({
        condominioId: 'cond-1',
        esercizioId: 'es-2026',
        sottocontoId: 'sc-1',
        tagSpesa: 'ORDINARIA',
        importoCent: 100_000,
        dataMovimento: '2026-03-01',
        dataRegistrazione: '2026-04-20',
        competenzaDa: '2026-03-01',
        competenzaA: '2026-03-31',
        descrizione: 'Spesa pulizia marzo',
        docAllegatoId: 'doc-1',
        contenutoFileGiustificativo: 'pdf-1',
        chiPaga: 'TUTTI',
        unitaCondominio: [
          { id: 'u1', palazzoId: 'pal-1', utenteId: 'ut-1' },
          { id: 'u2', palazzoId: 'pal-1', utenteId: 'ut-2' },
        ],
        tabellaMillesimale: {
          id: 'tab-a-v2',
          nome: 'Tabella A Generale',
          versione: 2,
          statoApprovazione: 'APPROVATA',
          totale: 1000,
          quote: [
            { unitaId: 'u1', millesimi: 600 },
            { unitaId: 'u2', millesimi: 400 },
          ],
        },
      });

      assert.equal(esitoSpesa.riparti.length, 2);
      assert.equal(esitoSpesa.riparti[0]?.importo_quota_centesimi, 60_000);
      assert.equal(esitoSpesa.riparti[1]?.importo_quota_centesimi, 40_000);
      assert.equal(esitoSpesa.ritardoRegistrazione.inRitardo, true);
      assert.equal(esitoSpesa.giustificativo.spesaCompleta, true);

      // 2. Tentativo di eliminazione fisica -> deve lanciare ErroreCancellazioneContabileVietata (RC-B4)
      await assert.rejects(
        () => service.eliminaMovimento('mov-1'),
        (err: unknown) => err instanceof ErroreCancellazioneContabileVietata,
      );

      // 3. Storno contabile -> marca originale STORNATA e inserisce scrittura contraria '+'
      const esitoStorno = await service.stornaMovimento({
        condominioId: 'cond-1',
        movimentoId: 'mov-1',
        motivoStorno: 'Fattura duplicata',
        dataStorno: '2026-04-21',
      });

      assert.equal(esitoStorno.saldoNettoCent, 0);
      assert.equal(esitoStorno.movimentoOriginaleAggiornato.stato_spesa, 'STORNATA');
      assert.equal(esitoStorno.scritturaStorno.segno, '+');
      assert.equal(esitoStorno.scritturaStorno.storno_di_id, 'mov-1');
    });
  });
});
