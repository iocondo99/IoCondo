import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcolaTotaleSpese,
  colonnaDaOrdineSpese,
  esercizioVisibileA,
  etichettaSegnoMovimento,
  etichettaStatoEsercizio,
  filtraMovimentiSpese,
  MACRO_CATEGORIA_PREDEFINITA,
  opzioniFiltroMovimenti,
  ordinaEserciziSpese,
  ordinaMovimentiSpese,
  ordineDaColonnaSpese,
  paginaMovimentiSpese,
  percorsoDocumentoAllegato,
  PER_PAGINA_SPESE,
  raccogliDocumentiAllegati,
  riepilogoEserciziSpese,
  SOTTOCONTO_PREDEFINITO,
  sottotitoloSpese,
  statoBadgeEsercizio,
  statoEsercizioVisibile,
  totaliPerMacroCategoria,
  type EsercizioSpese,
  type MovimentoSpesa,
} from './speseLogic.ts';

const CONDOMINIO_A = '00000000-0000-0000-0000-000000000001';
const CONDOMINIO_B = '00000000-0000-0000-0000-000000000002';

const ESERCIZI_PROVA: EsercizioSpese[] = [
  {
    id: 'es-2024',
    condominioId: CONDOMINIO_A,
    anno: 2024,
    dataInizio: '2024-01-01',
    dataFine: '2024-12-31',
    stato: 'CHIUSO',
    totaleSpese: 9840.5,
    numeroMovimenti: 8,
  },
  {
    id: 'es-2026',
    condominioId: CONDOMINIO_A,
    anno: 2026,
    dataInizio: '2026-01-01',
    dataFine: '2026-12-31',
    stato: 'PREVENTIVO',
    totaleSpese: 2345.8,
    numeroMovimenti: 3,
  },
  {
    id: 'es-2025',
    condominioId: CONDOMINIO_A,
    anno: 2025,
    dataInizio: '2025-01-01',
    dataFine: '2025-12-31',
    stato: 'CONSUNTIVO',
    totaleSpese: 11420.0,
    numeroMovimenti: 12,
  },
];

const MOVIMENTI_PROVA: MovimentoSpesa[] = [
  {
    id: 'mov-1',
    esercizioId: 'es-2025',
    data: '2025-01-20',
    descrizione: 'Canone 1 trim. manutenzione ascensore',
    importo: 1250.0,
    segno: '-',
    sottocontoId: 'sc-asc-ord',
    sottocontoDescrizione: 'Manutenzione ordinaria ascensore',
    macroId: 'macro-asc',
    macroCodice: 'B',
    macroDescrizione: 'Ascensore',
    documentoAllegato: {
      id: 'doc-1',
      nomeFile: 'Fattura_Ascensore_Q1.pdf',
      tipoMime: 'application/pdf',
      percorsoStorage: `${CONDOMINIO_A}/fatture/Fattura_Ascensore_Q1.pdf`,
    },
  },
  {
    id: 'mov-2',
    esercizioId: 'es-2025',
    data: '2025-02-05',
    descrizione: 'Pulizia scale gennaio',
    importo: 480.0,
    segno: '-',
    sottocontoId: 'sc-pulizia',
    sottocontoDescrizione: 'Pulizia scale',
    macroId: 'macro-pul',
    macroCodice: 'C',
    macroDescrizione: 'Pulizia e igiene',
    documentoAllegato: null,
  },
  {
    id: 'mov-3',
    esercizioId: 'es-2025',
    data: '2025-02-18',
    descrizione: 'Bolletta ENEL bimestre gen-feb',
    importo: 615.8,
    segno: '-',
    sottocontoId: 'sc-luce',
    sottocontoDescrizione: 'Luce scale',
    macroId: 'macro-ut',
    macroCodice: 'D',
    macroDescrizione: 'Utenze',
    documentoAllegato: null,
  },
  {
    id: 'mov-4',
    esercizioId: 'es-2025',
    data: '2025-03-10',
    descrizione: 'Intervento straordinario quadro ascensore',
    importo: 350.2,
    segno: '-',
    sottocontoId: 'sc-asc-str',
    sottocontoDescrizione: 'Interventi straordinari ascensore',
    macroId: 'macro-asc',
    macroCodice: 'B',
    macroDescrizione: 'Ascensore',
    documentoAllegato: null,
  },
];

describe('speseLogic — visibilità e stati degli esercizi', () => {
  it('accetta solo PREVENTIVO, CONSUNTIVO e CHIUSO ed esclude BOZZA o valori nulli', () => {
    assert.equal(statoEsercizioVisibile('PREVENTIVO'), true);
    assert.equal(statoEsercizioVisibile('CONSUNTIVO'), true);
    assert.equal(statoEsercizioVisibile('CHIUSO'), true);
    assert.equal(statoEsercizioVisibile('BOZZA'), false);
    assert.equal(statoEsercizioVisibile(''), false);
    assert.equal(statoEsercizioVisibile(null), false);
    assert.equal(statoEsercizioVisibile(undefined), false);
  });

  it('verifica che l’esercizio appartenga al condominio selezionato e sia pubblicato', () => {
    assert.equal(
      esercizioVisibileA({ condominioId: CONDOMINIO_A, stato: 'CONSUNTIVO' }, CONDOMINIO_A),
      true,
    );
    assert.equal(
      esercizioVisibileA({ condominioId: CONDOMINIO_A, stato: 'PREVENTIVO' }, CONDOMINIO_A),
      true,
    );
    assert.equal(
      esercizioVisibileA({ condominioId: CONDOMINIO_A, stato: 'BOZZA' }, CONDOMINIO_A),
      false,
    );
    assert.equal(
      esercizioVisibileA({ condominioId: CONDOMINIO_B, stato: 'CONSUNTIVO' }, CONDOMINIO_A),
      false,
    );
    assert.equal(esercizioVisibileA(null, CONDOMINIO_A), false);
  });

  it('mappa stati e segni alle etichette e ai Badge del design system', () => {
    assert.equal(statoBadgeEsercizio('PREVENTIVO'), 'preventivo');
    assert.equal(statoBadgeEsercizio('CONSUNTIVO'), 'consuntivo');
    assert.equal(statoBadgeEsercizio('CHIUSO'), 'chiuso');
    assert.equal(etichettaStatoEsercizio('PREVENTIVO'), 'Preventivo');
    assert.equal(etichettaStatoEsercizio('CONSUNTIVO'), 'Consuntivo');
    assert.equal(etichettaStatoEsercizio('CHIUSO'), 'Chiuso');
    assert.equal(etichettaSegnoMovimento('-'), 'Spesa (−)');
    assert.equal(etichettaSegnoMovimento('+'), 'Rettifica (+)');
    assert.equal(
      sottotitoloSpese('Condominio Verdi'),
      'Condominio Verdi — consuntivi e preventivi del condominio',
    );
    assert.equal(sottotitoloSpese(null), 'Consuntivi e preventivi del condominio');
    assert.equal(ordineDaColonnaSpese({ key: 'data', direction: 'ascending' }), 'data-asc');
    assert.equal(ordineDaColonnaSpese({ key: 'importo', direction: 'descending' }), 'importo-desc');
    assert.equal(ordineDaColonnaSpese(null), 'data-desc');
    assert.deepEqual(colonnaDaOrdineSpese('importo-asc'), {
      key: 'importo',
      direction: 'ascending',
    });
  });
});

describe('speseLogic — riepilogo esercizi (3 StatCard)', () => {
  it('ordina gli esercizi per anno decrescente', () => {
    const ordinati = ordinaEserciziSpese(ESERCIZI_PROVA);
    assert.deepEqual(
      ordinati.map((e) => e.anno),
      [2026, 2025, 2024],
    );
  });

  it('calcola esercizio in corso, ultimo consuntivo approvato e preventivo in corso', () => {
    const riepilogo = riepilogoEserciziSpese(ESERCIZI_PROVA, 2026);
    assert.equal(riepilogo.esercizioInCorso?.anno, 2026);
    assert.equal(riepilogo.esercizioInCorso?.totaleSpese, 2345.8);
    assert.equal(riepilogo.ultimoConsuntivo?.anno, 2025);
    assert.equal(riepilogo.ultimoConsuntivo?.totaleSpese, 11420.0);
    assert.equal(riepilogo.preventivoInCorso?.anno, 2026);
    assert.equal(riepilogo.preventivoInCorso?.totaleSpese, 2345.8);
  });

  it('gestisce elenco vuoto e assenza di preventivo in corso', () => {
    const vuoto = riepilogoEserciziSpese([], 2026);
    assert.equal(vuoto.esercizioInCorso, null);
    assert.equal(vuoto.ultimoConsuntivo, null);
    assert.equal(vuoto.preventivoInCorso, null);

    const senzaPreventivo = riepilogoEserciziSpese(
      ESERCIZI_PROVA.filter((e) => e.stato !== 'PREVENTIVO'),
      2026,
    );
    assert.equal(senzaPreventivo.esercizioInCorso?.anno, 2025);
    assert.equal(senzaPreventivo.ultimoConsuntivo?.anno, 2025);
    assert.equal(senzaPreventivo.preventivoInCorso, null);
  });
});

describe('speseLogic — totali di spesa e totali per macro-categoria', () => {
  it('somma solo i movimenti di spesa con segno negativo e arrotonda ai centesimi', () => {
    const totale = calcolaTotaleSpese([
      ...MOVIMENTI_PROVA,
      { importo: 500, segno: '+' },
    ]);
    assert.equal(totale, 2696.0);
  });

  it('raggruppa i movimenti per macro-categoria con totale, conteggio e percentuale', () => {
    const macro = totaliPerMacroCategoria(MOVIMENTI_PROVA);
    assert.equal(macro.length, 3);
    assert.equal(macro[0]?.descrizione, 'Ascensore');
    assert.equal(macro[0]?.codice, 'B');
    assert.equal(macro[0]?.totale, 1600.2);
    assert.equal(macro[0]?.numeroMovimenti, 2);
    assert.equal(macro[0]?.percentuale, 59);

    assert.equal(macro[1]?.descrizione, 'Utenze');
    assert.equal(macro[1]?.totale, 615.8);
    assert.equal(macro[1]?.numeroMovimenti, 1);

    assert.equal(macro[2]?.descrizione, 'Pulizia e igiene');
    assert.equal(macro[2]?.totale, 480.0);
    assert.equal(macro[2]?.numeroMovimenti, 1);
  });

  it('usa la macro-categoria predefinita quando manca il piano dei conti', () => {
    const macro = totaliPerMacroCategoria([
      {
        id: 'm-senza',
        esercizioId: 'es-2025',
        data: '2025-05-01',
        descrizione: 'Spesa postale straordinaria',
        importo: 25.5,
        segno: '-',
        sottocontoId: null,
        sottocontoDescrizione: SOTTOCONTO_PREDEFINITO,
        macroId: null,
        macroCodice: null,
        macroDescrizione: '',
        documentoAllegato: null,
      },
    ]);
    assert.equal(macro.length, 1);
    assert.equal(macro[0]?.descrizione, MACRO_CATEGORIA_PREDEFINITA);
    assert.equal(macro[0]?.totale, 25.5);
    assert.equal(macro[0]?.percentuale, 100);
  });
});

describe('speseLogic — filtri, ricerca, ordinamento e paginazione movimenti', () => {
  it('costruisce i FilterChips per sottoconto ordinati alfabeticamente', () => {
    const opzioni = opzioniFiltroMovimenti(MOVIMENTI_PROVA);
    assert.equal(opzioni[0]?.value, 'tutti');
    assert.equal(opzioni[0]?.count, 4);
    assert.deepEqual(
      opzioni.slice(1).map((o) => o.label),
      [
        'Interventi straordinari ascensore',
        'Luce scale',
        'Manutenzione ordinaria ascensore',
        'Pulizia scale',
      ],
    );
  });

  it('filtra per sottoconto/macro-categoria e per ricerca nella descrizione', () => {
    const perSottoconto = filtraMovimentiSpese(MOVIMENTI_PROVA, 'sottoconto:sc-pulizia', '');
    assert.equal(perSottoconto.length, 1);
    assert.equal(perSottoconto[0]?.id, 'mov-2');

    const perMacro = filtraMovimentiSpese(MOVIMENTI_PROVA, 'macro:macro-asc', '');
    assert.equal(perMacro.length, 2);

    const perTesto = filtraMovimentiSpese(MOVIMENTI_PROVA, 'tutti', '  enel ');
    assert.equal(perTesto.length, 1);
    assert.equal(perTesto[0]?.id, 'mov-3');
  });

  it('ordina i movimenti per data e per importo in entrambe le direzioni', () => {
    assert.deepEqual(
      ordinaMovimentiSpese(MOVIMENTI_PROVA, 'data-desc').map((m) => m.id),
      ['mov-4', 'mov-3', 'mov-2', 'mov-1'],
    );
    assert.deepEqual(
      ordinaMovimentiSpese(MOVIMENTI_PROVA, 'data-asc').map((m) => m.id),
      ['mov-1', 'mov-2', 'mov-3', 'mov-4'],
    );
    assert.deepEqual(
      ordinaMovimentiSpese(MOVIMENTI_PROVA, 'importo-desc').map((m) => m.id),
      ['mov-1', 'mov-3', 'mov-2', 'mov-4'],
    );
    assert.deepEqual(
      ordinaMovimentiSpese(MOVIMENTI_PROVA, 'importo-asc').map((m) => m.id),
      ['mov-4', 'mov-2', 'mov-3', 'mov-1'],
    );
  });

  it('pagina i movimenti e normalizza i numeri di pagina fuori intervallo', () => {
    const dodici: MovimentoSpesa[] = Array.from({ length: 12 }, (_, idx) => ({
      ...MOVIMENTI_PROVA[0]!,
      id: `m-${idx + 1}`,
    }));
    const prima = paginaMovimentiSpese(dodici, 1, PER_PAGINA_SPESE);
    assert.equal(prima.righe.length, 10);
    assert.equal(prima.pagina, 1);
    assert.equal(prima.pagineTotali, 2);
    assert.equal(prima.totaleRighe, 12);

    const seconda = paginaMovimentiSpese(dodici, 99, PER_PAGINA_SPESE);
    assert.equal(seconda.pagina, 2);
    assert.equal(seconda.righe.length, 2);
  });
});

describe('speseLogic — allegati e percorsi Storage', () => {
  it('raccoglie solo i documenti allegati verificati senza duplicati', () => {
    const allegati = raccogliDocumentiAllegati([
      ...MOVIMENTI_PROVA,
      { ...MOVIMENTI_PROVA[0]!, id: 'mov-dup' },
    ]);
    assert.equal(allegati.length, 1);
    assert.equal(allegati[0]?.nomeFile, 'Fattura_Ascensore_Q1.pdf');
  });

  it('valida il percorso Storage e rifiuta path traversal, URL esterni o altri condomini', () => {
    assert.equal(
      percorsoDocumentoAllegato(
        `documenti-condominio/${CONDOMINIO_A}/fatture/Fattura_Ascensore_Q1.pdf`,
        CONDOMINIO_A,
      ),
      `${CONDOMINIO_A}/fatture/Fattura_Ascensore_Q1.pdf`,
    );
    assert.equal(
      percorsoDocumentoAllegato(`${CONDOMINIO_A}/fatture/Fattura_Ascensore_Q1.pdf`, CONDOMINIO_A),
      `${CONDOMINIO_A}/fatture/Fattura_Ascensore_Q1.pdf`,
    );
    assert.equal(
      percorsoDocumentoAllegato(`${CONDOMINIO_B}/fatture/Fattura.pdf`, CONDOMINIO_A),
      null,
    );
    assert.equal(percorsoDocumentoAllegato('../segreto.pdf', CONDOMINIO_A), null);
    assert.equal(percorsoDocumentoAllegato('/assoluto/file.pdf', CONDOMINIO_A), null);
    assert.equal(percorsoDocumentoAllegato('https://esempio.it/file.pdf', CONDOMINIO_A), null);
  });
});
