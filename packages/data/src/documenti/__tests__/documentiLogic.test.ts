import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BUCKET_DOCUMENTI_CONDOMINIO,
  colonnaDaOrdineDocumenti,
  descrizioneVisibilitaDocumento,
  documentoVisibileAResidente,
  DURATA_LINK_DOCUMENTO_SECONDI,
  etichettaFormatoDocumento,
  etichettaRigaDocumento,
  etichettaVisibilitaDocumento,
  filtraDocumenti,
  filtraDocumentiVisibili,
  filtriDocumentiAttivi,
  filtroDocumentiPostgrest,
  MESSAGGIO_FILE_NON_DISPONIBILE,
  opzioniFiltroCartelle,
  ordinaDocumenti,
  ordineDaColonnaDocumenti,
  paginaDocumenti,
  PER_PAGINA_DOCUMENTI,
  riepilogoDocumenti,
  scomponiPercorsoStorage,
  sottotitoloDocumenti,
  validaPercorsoDocumentoStorage,
  visibilitaDocumento,
  type CartellaDocumento,
  type DocumentoCondomino,
} from '../documentiLogic.ts';

const CONDOMINIO_A = '00000000-0000-0000-0000-000000000001';
const CONDOMINIO_B = '00000000-0000-0000-0000-000000000002';
const UNITA_1 = '00000000-0000-0000-0000-000000000201';
const UNITA_2 = '00000000-0000-0000-0000-000000000202';

const CARTELLE_PROVA: CartellaDocumento[] = [
  { id: 'c-reg', condominioId: CONDOMINIO_A, parentId: null, nomeCartella: 'Regolamenti e tabelle' },
  { id: 'c-verb', condominioId: CONDOMINIO_A, parentId: null, nomeCartella: 'Verbali assemblea' },
  { id: 'c-bil', condominioId: CONDOMINIO_A, parentId: null, nomeCartella: 'Bilanci e preventivi' },
];

const DOCUMENTI_PROVA: DocumentoCondomino[] = [
  {
    id: 'doc-1',
    condominioId: CONDOMINIO_A,
    cartellaId: 'c-reg',
    cartellaNome: 'Regolamenti e tabelle',
    unitaId: null,
    unitaInterno: null,
    visibilita: 'condominiale',
    etichettaVisibilita: 'Condominiale',
    nomeFile: 'Regolamento_condominiale.pdf',
    tipoMime: 'application/pdf',
    urlStorage: 'seed-dev/documenti/regolamento-condominiale.pdf',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'doc-2',
    condominioId: CONDOMINIO_A,
    cartellaId: 'c-verb',
    cartellaNome: 'Verbali assemblea',
    unitaId: null,
    unitaInterno: null,
    visibilita: 'condominiale',
    etichettaVisibilita: 'Condominiale',
    nomeFile: 'Verbale_assemblea_2025.pdf',
    tipoMime: 'application/pdf',
    urlStorage: `${CONDOMINIO_A}/verbali/Verbale_assemblea_2025.pdf`,
    createdAt: '2026-02-15T14:30:00Z',
  },
  {
    id: 'doc-3',
    condominioId: CONDOMINIO_A,
    cartellaId: 'c-bil',
    cartellaNome: 'Bilanci e preventivi',
    unitaId: UNITA_1,
    unitaInterno: '1',
    visibilita: 'personale',
    etichettaVisibilita: 'Unità Int. 1',
    nomeFile: 'Prospetto_riparto_Int_1.pdf',
    tipoMime: 'application/pdf',
    urlStorage: `${CONDOMINIO_A}/unita-1/Prospetto_riparto_Int_1.pdf`,
    createdAt: '2026-03-01T09:15:00Z',
  },
];

describe('documentiLogic — isolamento del residente tra unità e condomini', () => {
  it('costruisce il filtro PostgREST coerente con homeService.contaDocumenti', () => {
    assert.equal(filtroDocumentiPostgrest([]), 'unita_id.is.null');
    assert.equal(
      filtroDocumentiPostgrest([UNITA_1]),
      `unita_id.is.null,unita_id.in.(${UNITA_1})`,
    );
  });

  it('ammette documenti condominiali (unitaId null) e documenti della propria unità nel condominio selezionato', () => {
    assert.equal(
      documentoVisibileAResidente(
        { condominioId: CONDOMINIO_A, unitaId: null },
        CONDOMINIO_A,
        [UNITA_1],
      ),
      true,
    );
    assert.equal(
      documentoVisibileAResidente(
        { condominioId: CONDOMINIO_A, unitaId: UNITA_1 },
        CONDOMINIO_A,
        [UNITA_1],
      ),
      true,
    );
  });

  it('esclude i documenti di un’altra unità (es. Unità 2) anche se lo stesso condominio è attivo', () => {
    assert.equal(
      documentoVisibileAResidente(
        { condominioId: CONDOMINIO_A, unitaId: UNITA_2 },
        CONDOMINIO_A,
        [UNITA_1],
      ),
      false,
    );
  });

  it('esclude sempre i documenti di un altro condominio, anche se senza unità o con stessa lista unità', () => {
    assert.equal(
      documentoVisibileAResidente(
        { condominioId: CONDOMINIO_B, unitaId: null },
        CONDOMINIO_A,
        [UNITA_1],
      ),
      false,
    );
    assert.equal(
      documentoVisibileAResidente(
        { condominioId: CONDOMINIO_B, unitaId: UNITA_1 },
        CONDOMINIO_A,
        [UNITA_1],
      ),
      false,
    );
    assert.equal(documentoVisibileAResidente(null, CONDOMINIO_A, [UNITA_1]), false);
    assert.equal(
      documentoVisibileAResidente({ condominioId: CONDOMINIO_A, unitaId: null }, '', [UNITA_1]),
      false,
    );
  });

  it('isola un amministratore in vista condòmino: se non ha l’unità 2, non vede i documenti dell’unità 2', () => {
    const righeDalDbPerAdmin = [
      { id: 'd-cond', condominioId: CONDOMINIO_A, unitaId: null },
      { id: 'd-u1', condominioId: CONDOMINIO_A, unitaId: UNITA_1 },
      { id: 'd-u2', condominioId: CONDOMINIO_A, unitaId: UNITA_2 },
      { id: 'd-altro-cond', condominioId: CONDOMINIO_B, unitaId: null },
    ];

    const visibiliConUnita1 = filtraDocumentiVisibili(righeDalDbPerAdmin, CONDOMINIO_A, [UNITA_1]);
    assert.deepEqual(
      visibiliConUnita1.map((d) => d.id),
      ['d-cond', 'd-u1'],
    );

    const visibiliSenzaUnita = filtraDocumentiVisibili(righeDalDbPerAdmin, CONDOMINIO_A, []);
    assert.deepEqual(
      visibiliSenzaUnita.map((d) => d.id),
      ['d-cond'],
    );
  });
});

describe('documentiLogic — visibilità e riepilogo StatCard', () => {
  it('distingue correttamente visibilità Condominiale e Personale / Unità', () => {
    assert.equal(visibilitaDocumento(null), 'condominiale');
    assert.equal(visibilitaDocumento(UNITA_1), 'personale');

    assert.equal(etichettaVisibilitaDocumento(null, null), 'Condominiale');
    assert.equal(etichettaVisibilitaDocumento(UNITA_1, '1'), 'Unità Int. 1');
    assert.equal(etichettaVisibilitaDocumento(UNITA_1, 'Int. 4B'), 'Unità Int. 4B');
    assert.equal(etichettaVisibilitaDocumento(UNITA_1, 'Unità 3'), 'Unità 3');
    assert.equal(etichettaVisibilitaDocumento(UNITA_1, ''), 'Personale');

    assert.match(descrizioneVisibilitaDocumento(null), /Condominiale/);
    assert.equal(descrizioneVisibilitaDocumento(UNITA_1, '1'), 'Personale — Unità Int. 1');
  });

  it('calcola i conteggi reali per le StatCard (totale, condominiali, personali, cartelle)', () => {
    const riepilogo = riepilogoDocumenti(DOCUMENTI_PROVA);
    assert.deepEqual(riepilogo, {
      totale: 3,
      condominiali: 2,
      personali: 1,
      cartelle: 3,
    });
  });
});

describe('documentiLogic — filtri per cartella, ricerca, ordinamento e paginazione', () => {
  it('genera le opzioni FilterChips con Tutte in testa e conteggi per cartella', () => {
    const opzioni = opzioniFiltroCartelle(CARTELLE_PROVA, DOCUMENTI_PROVA);
    assert.equal(opzioni[0]?.value, 'tutte');
    assert.equal(opzioni[0]?.label, 'Tutte');
    assert.equal(opzioni[0]?.count, 3);
    assert.deepEqual(
      opzioni.slice(1).map((o) => ({ value: o.value, label: o.label, count: o.count })),
      [
        { value: 'c-bil', label: 'Bilanci e preventivi', count: 1 },
        { value: 'c-reg', label: 'Regolamenti e tabelle', count: 1 },
        { value: 'c-verb', label: 'Verbali assemblea', count: 1 },
      ],
    );
  });

  it('filtra per cartella e per testo su nome file, cartella o visibilità', () => {
    const perCartella = filtraDocumenti(DOCUMENTI_PROVA, { cartellaId: 'c-verb', ricerca: '' });
    assert.deepEqual(perCartella.map((d) => d.id), ['doc-2']);

    const perNome = filtraDocumenti(DOCUMENTI_PROVA, { cartellaId: 'tutte', ricerca: 'riparto' });
    assert.deepEqual(perNome.map((d) => d.id), ['doc-3']);

    const perNomeCartella = filtraDocumenti(DOCUMENTI_PROVA, {
      cartellaId: 'tutte',
      ricerca: 'regolamenti',
    });
    assert.deepEqual(perNomeCartella.map((d) => d.id), ['doc-1']);

    assert.equal(filtriDocumentiAttivi({ cartellaId: 'tutte', ricerca: '' }), 0);
    assert.equal(filtriDocumentiAttivi({ cartellaId: 'c-verb', ricerca: '' }), 1);
    assert.equal(filtriDocumentiAttivi({ cartellaId: 'c-verb', ricerca: 'verbale' }), 2);
  });

  it('ordina per data di caricamento (asc/desc) e per nome file (asc/desc)', () => {
    assert.deepEqual(
      ordinaDocumenti(DOCUMENTI_PROVA, 'data-desc').map((d) => d.id),
      ['doc-3', 'doc-2', 'doc-1'],
    );
    assert.deepEqual(
      ordinaDocumenti(DOCUMENTI_PROVA, 'data-asc').map((d) => d.id),
      ['doc-1', 'doc-2', 'doc-3'],
    );
    assert.deepEqual(
      ordinaDocumenti(DOCUMENTI_PROVA, 'nome-asc').map((d) => d.nomeFile),
      [
        'Prospetto_riparto_Int_1.pdf',
        'Regolamento_condominiale.pdf',
        'Verbale_assemblea_2025.pdf',
      ],
    );
    assert.deepEqual(
      ordinaDocumenti(DOCUMENTI_PROVA, 'nome-desc').map((d) => d.nomeFile),
      [
        'Verbale_assemblea_2025.pdf',
        'Regolamento_condominiale.pdf',
        'Prospetto_riparto_Int_1.pdf',
      ],
    );

    assert.equal(ordineDaColonnaDocumenti({ key: 'nome', direction: 'ascending' }), 'nome-asc');
    assert.deepEqual(colonnaDaOrdineDocumenti('nome-desc'), {
      key: 'nome',
      direction: 'descending',
    });
  });

  it('pagina correttamente oltre 10 documenti e normalizza pagine fuori intervallo', () => {
    const dodici: DocumentoCondomino[] = Array.from({ length: 12 }, (_, idx) => ({
      id: `doc-pag-${idx + 1}`,
      condominioId: CONDOMINIO_A,
      cartellaId: 'c-verb',
      cartellaNome: 'Verbali assemblea',
      unitaId: null,
      unitaInterno: null,
      visibilita: 'condominiale',
      etichettaVisibilita: 'Condominiale',
      nomeFile: `Documento_${String(idx + 1).padStart(2, '0')}.pdf`,
      tipoMime: 'application/pdf',
      urlStorage: `seed-dev/documenti/doc-${idx + 1}.pdf`,
      createdAt: `2026-01-${String(idx + 1).padStart(2, '0')}T10:00:00Z`,
    }));

    const pag1 = paginaDocumenti(dodici, { cartellaId: 'tutte', ricerca: '' }, 'data-desc', 1, PER_PAGINA_DOCUMENTI);
    assert.equal(pag1.documenti.length, 10);
    assert.equal(pag1.totaleFiltrati, 12);
    assert.equal(pag1.numeroPagine, 2);

    const pag2 = paginaDocumenti(dodici, { cartellaId: 'tutte', ricerca: '' }, 'data-desc', 2, PER_PAGINA_DOCUMENTI);
    assert.equal(pag2.documenti.length, 2);
    assert.equal(pag2.pagina, 2);
  });
});

describe('documentiLogic — validazione sicura del percorso url_storage', () => {
  it('accetta percorsi validi del condominio selezionato o del prefisso seed-dev/', () => {
    assert.equal(
      validaPercorsoDocumentoStorage(`${CONDOMINIO_A}/verbali/verbale-2025.pdf`, CONDOMINIO_A),
      `${CONDOMINIO_A}/verbali/verbale-2025.pdf`,
    );
    assert.equal(
      validaPercorsoDocumentoStorage(
        `${BUCKET_DOCUMENTI_CONDOMINIO}/${CONDOMINIO_A}/verbali/verbale-2025.pdf`,
        CONDOMINIO_A,
      ),
      `${CONDOMINIO_A}/verbali/verbale-2025.pdf`,
    );
    assert.equal(
      validaPercorsoDocumentoStorage('seed-dev/documenti/regolamento-condominiale.pdf', CONDOMINIO_A),
      'seed-dev/documenti/regolamento-condominiale.pdf',
    );
  });

  it('rifiuta path traversal (..), backslash, URL assoluti e percorsi di altri condomini', () => {
    assert.equal(
      validaPercorsoDocumentoStorage(`${CONDOMINIO_A}/../${CONDOMINIO_B}/segreto.pdf`, CONDOMINIO_A),
      null,
    );
    assert.equal(
      validaPercorsoDocumentoStorage('../segreto.pdf', CONDOMINIO_A),
      null,
    );
    assert.equal(
      validaPercorsoDocumentoStorage(`${CONDOMINIO_A}\\verbali\\file.pdf`, CONDOMINIO_A),
      null,
    );
    assert.equal(
      validaPercorsoDocumentoStorage('https://evil.example.com/file.pdf', CONDOMINIO_A),
      null,
    );
    assert.equal(
      validaPercorsoDocumentoStorage(`${CONDOMINIO_B}/verbali/file.pdf`, CONDOMINIO_A),
      null,
    );
    assert.equal(
      validaPercorsoDocumentoStorage(`/${CONDOMINIO_A}/verbali/file.pdf`, CONDOMINIO_A),
      null,
    );
  });

  it('scompone correttamente il percorso e formatta testi ed etichette', () => {
    assert.deepEqual(
      scomponiPercorsoStorage('seed-dev/documenti/regolamento-condominiale.pdf'),
      { cartella: 'seed-dev/documenti', nomeFile: 'regolamento-condominiale.pdf' },
    );
    assert.equal(DURATA_LINK_DOCUMENTO_SECONDI, 600);
    assert.equal(
      MESSAGGIO_FILE_NON_DISPONIBILE,
      'File non ancora disponibile nello spazio di archiviazione',
    );
    assert.equal(
      sottotitoloDocumenti('Condominio Verdi'),
      'Condominio Verdi — regolamenti, verbali e documenti',
    );
    assert.equal(
      etichettaFormatoDocumento('application/pdf', 'file.pdf'),
      'Documento PDF (application/pdf)',
    );
    assert.match(etichettaRigaDocumento(DOCUMENTI_PROVA[0]!, '10/01/2026'), /Regolamento_condominiale\.pdf/);
  });
});

