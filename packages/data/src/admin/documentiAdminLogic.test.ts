import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  determinaTipoFile,
  configurazioneTipoFile,
  determinaRiservatezza,
  mappaBadgeRiservatezza,
  formattaDimensioneFile,
  formattaDataDocumento,
  filtraDocumentiAdmin,
  calcolaStatisticheDocumentiAdmin,
  validaNuovaCartella,
  validaCaricamentoDocumento,
  type DocumentoAdminView,
  type CartellaAdminView,
} from './documentiAdminLogic.ts';

describe('documentiAdminLogic', () => {
  describe('determinaTipoFile & configurazioneTipoFile', () => {
    it('riconosce correttamente PDF per estensione e mime', () => {
      assert.equal(determinaTipoFile('verbale.pdf'), 'pdf');
      assert.equal(determinaTipoFile('documento', 'application/pdf'), 'pdf');
      const conf = configurazioneTipoFile('pdf');
      assert.equal(conf.color, '#B91C1C'); // rosso
      assert.equal(conf.bgColor, '#FEF2F2');
      assert.equal(conf.icon, 'file-text');
    });

    it('riconosce immagini e imposta colore teal', () => {
      assert.equal(determinaTipoFile('foto.jpg'), 'immagine');
      assert.equal(determinaTipoFile('foto.png'), 'immagine');
      assert.equal(determinaTipoFile('allegato', 'image/webp'), 'immagine');
      const conf = configurazioneTipoFile('immagine');
      assert.equal(conf.color, '#0F766E'); // teal
      assert.equal(conf.bgColor, '#CCFBF1');
      assert.equal(conf.icon, 'image');
    });

    it('riconosce fogli di calcolo ed Excel con colore verde', () => {
      assert.equal(determinaTipoFile('bilancio.xlsx'), 'foglio_calcolo');
      assert.equal(determinaTipoFile('dati.csv'), 'foglio_calcolo');
      const conf = configurazioneTipoFile('foglio_calcolo');
      assert.equal(conf.color, '#15803D'); // verde
      assert.equal(conf.bgColor, '#F0FDF4');
    });

    it('riconosce documenti Word e testo con colore blu', () => {
      assert.equal(determinaTipoFile('contratto.docx'), 'testo_word');
      assert.equal(determinaTipoFile('note.txt'), 'testo_word');
      const conf = configurazioneTipoFile('testo_word');
      assert.equal(conf.color, '#0369A1'); // blu
      assert.equal(conf.bgColor, '#F0F9FF');
    });

    it('riconosce file generici con colore grigio', () => {
      assert.equal(determinaTipoFile('archivio.zip'), 'generico');
      const conf = configurazioneTipoFile('generico');
      assert.equal(conf.color, '#475569'); // grigio
      assert.equal(conf.bgColor, '#F8FAFC');
    });
  });

  describe('determinaRiservatezza & mappaBadgeRiservatezza', () => {
    it('identifica correttamente ambito pubblico', () => {
      assert.equal(determinaRiservatezza(null), 'PUBBLICO');
      assert.equal(determinaRiservatezza(undefined), 'PUBBLICO');
      assert.equal(determinaRiservatezza(''), 'PUBBLICO');

      const badge = mappaBadgeRiservatezza(null);
      assert.equal(badge.label, 'Condominio');
      assert.equal(badge.isRiservato, false);
      assert.equal(badge.status, 'condominiale');
    });

    it('identifica correttamente ambito riservato per unità', () => {
      assert.equal(determinaRiservatezza('unita-123'), 'RISERVATO');

      const badge = mappaBadgeRiservatezza('unita-123', '1', 'Palazzo A');
      assert.equal(badge.label, 'Palazzo A - Int. 1');
      assert.equal(badge.isRiservato, true);
      assert.equal(badge.status, 'personale');
    });
  });

  describe('formattaDimensioneFile', () => {
    it('gestisce valori nulli, negativi o zero', () => {
      assert.equal(formattaDimensioneFile(null), 'N/D');
      assert.equal(formattaDimensioneFile(undefined), 'N/D');
      assert.equal(formattaDimensioneFile(-5), 'N/D');
      assert.equal(formattaDimensioneFile(0), '0 B');
    });

    it('formatta correttamente Byte, KB e MB', () => {
      assert.equal(formattaDimensioneFile(500), '500 B');
      assert.equal(formattaDimensioneFile(1536), '1,5 KB');
      assert.equal(formattaDimensioneFile(2097152), '2,0 MB');
    });
  });

  describe('formattaDataDocumento', () => {
    it('formatta correttamente data ISO in GG/MM/AAAA', () => {
      assert.equal(formattaDataDocumento('2026-05-15T10:30:00Z'), '15/05/2026');
      assert.equal(formattaDataDocumento(null), 'N/D');
      assert.equal(formattaDataDocumento('non-valida'), 'N/D');
    });
  });

  describe('filtraDocumentiAdmin', () => {
    const doc1: DocumentoAdminView = {
      id: 'doc-1',
      cartellaId: 'cart-1',
      cartellaNome: 'Verbali',
      unitaId: null,
      unitaInterno: null,
      palazzoNome: null,
      scalaNome: null,
      urlStorage: 'cond/cart-1/verbale.pdf',
      nomeFile: 'Verbale Assemblea 2026.pdf',
      tipoMime: 'application/pdf',
      dimensioneBytes: 1024,
      caricatoDa: null,
      createdAt: '2026-04-15T00:00:00Z',
      tipoFile: 'pdf',
      specificaTipo: configurazioneTipoFile('pdf'),
      riservatezza: 'PUBBLICO',
      badgeRiservatezza: mappaBadgeRiservatezza(null),
    };

    const doc2: DocumentoAdminView = {
      id: 'doc-2',
      cartellaId: 'cart-2',
      cartellaNome: 'Contratti',
      unitaId: 'u-1',
      unitaInterno: '1',
      palazzoNome: 'Palazzo A',
      scalaNome: null,
      urlStorage: 'cond/cart-2/polizza.pdf',
      nomeFile: 'Polizza fabbricati.pdf',
      tipoMime: 'application/pdf',
      dimensioneBytes: 2048,
      caricatoDa: null,
      createdAt: '2026-04-20T00:00:00Z',
      tipoFile: 'pdf',
      specificaTipo: configurazioneTipoFile('pdf'),
      riservatezza: 'RISERVATO',
      badgeRiservatezza: mappaBadgeRiservatezza('u-1', '1', 'Palazzo A'),
    };

    it('restituisce tutti i documenti se nessun filtro è attivo', () => {
      const res = filtraDocumentiAdmin([doc1, doc2], {});
      assert.equal(res.length, 2);
    });

    it('filtra per cartellaId', () => {
      const res = filtraDocumentiAdmin([doc1, doc2], { cartellaId: 'cart-1' });
      assert.equal(res.length, 1);
      assert.equal(res[0]?.id, 'doc-1');
    });

    it('filtra per ricerca testuale per nome file', () => {
      const res = filtraDocumentiAdmin([doc1, doc2], { ricerca: 'polizza' });
      assert.equal(res.length, 1);
      assert.equal(res[0]?.id, 'doc-2');
    });

    it('filtra per riservatezza (pubblici vs riservati)', () => {
      const pub = filtraDocumentiAdmin([doc1, doc2], { filtroRiservatezza: 'pubblici' });
      assert.equal(pub.length, 1);
      assert.equal(pub[0]?.id, 'doc-1');

      const ris = filtraDocumentiAdmin([doc1, doc2], { filtroRiservatezza: 'riservati' });
      assert.equal(ris.length, 1);
      assert.equal(ris[0]?.id, 'doc-2');
    });
  });

  describe('calcolaStatisticheDocumentiAdmin', () => {
    it('calcola correttamente i totali per le StatCards', () => {
      const cartelle: CartellaAdminView[] = [
        {
          id: 'c1',
          condominioId: 'cond1',
          parentId: null,
          nomeCartella: 'Verbali',
          conteggioDocumenti: 1,
          createdAt: '2026-01-01',
        },
        {
          id: 'c2',
          condominioId: 'cond1',
          parentId: null,
          nomeCartella: 'Contratti',
          conteggioDocumenti: 1,
          createdAt: '2026-01-01',
        },
      ];

      const docs: DocumentoAdminView[] = [
        {
          id: 'd1',
          cartellaId: 'c1',
          cartellaNome: 'Verbali',
          unitaId: null,
          unitaInterno: null,
          palazzoNome: null,
          scalaNome: null,
          urlStorage: 'test',
          nomeFile: 'test.pdf',
          tipoMime: 'application/pdf',
          dimensioneBytes: 100,
          caricatoDa: null,
          createdAt: '2026-01-01',
          tipoFile: 'pdf',
          specificaTipo: configurazioneTipoFile('pdf'),
          riservatezza: 'PUBBLICO',
          badgeRiservatezza: mappaBadgeRiservatezza(null),
        },
        {
          id: 'd2',
          cartellaId: 'c2',
          cartellaNome: 'Contratti',
          unitaId: 'u-1',
          unitaInterno: '1',
          palazzoNome: 'Palazzo A',
          scalaNome: null,
          urlStorage: 'test2',
          nomeFile: 'test2.pdf',
          tipoMime: 'application/pdf',
          dimensioneBytes: 100,
          caricatoDa: null,
          createdAt: '2026-01-01',
          tipoFile: 'pdf',
          specificaTipo: configurazioneTipoFile('pdf'),
          riservatezza: 'RISERVATO',
          badgeRiservatezza: mappaBadgeRiservatezza('u-1'),
        },
      ];

      const stats = calcolaStatisticheDocumentiAdmin(docs, cartelle);
      assert.equal(stats.totaleDocumenti, 2);
      assert.equal(stats.totaleCartelle, 2);
      assert.equal(stats.documentiRiservati, 1);
    });
  });

  describe('validaNuovaCartella', () => {
    it('rifiuta nomi vuoti o troppo corti', () => {
      assert.equal(validaNuovaCartella('').valido, false);
      assert.equal(validaNuovaCartella('   ').valido, false);
      assert.equal(validaNuovaCartella('A').valido, false);
    });

    it('accetta nomi validi', () => {
      assert.equal(validaNuovaCartella('Verbali assemblee').valido, true);
    });
  });

  describe('validaCaricamentoDocumento', () => {
    it('rifiuta caricamento senza file selezionato', () => {
      const res = validaCaricamentoDocumento({
        cartellaId: 'c1',
        nomeFile: '',
        filePresente: false,
        isRiservato: false,
      });
      assert.equal(res.valido, false);
    });

    it('rifiuta caricamento se riservato ma senza unità selezionata', () => {
      const res = validaCaricamentoDocumento({
        cartellaId: 'c1',
        nomeFile: 'doc.pdf',
        filePresente: true,
        isRiservato: true,
        unitaId: null,
      });
      assert.equal(res.valido, false);
    });

    it('accetta caricamento valido pubblico', () => {
      const res = validaCaricamentoDocumento({
        cartellaId: 'c1',
        nomeFile: 'doc.pdf',
        filePresente: true,
        isRiservato: false,
      });
      assert.equal(res.valido, true);
    });

    it('accetta caricamento valido riservato con unità', () => {
      const res = validaCaricamentoDocumento({
        cartellaId: 'c1',
        nomeFile: 'doc.pdf',
        filePresente: true,
        isRiservato: true,
        unitaId: 'u-1',
      });
      assert.equal(res.valido, true);
    });
  });
});
