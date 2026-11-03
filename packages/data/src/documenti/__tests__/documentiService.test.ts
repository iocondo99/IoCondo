import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  BUCKET_DOCUMENTI_CONDOMINIO,
  DURATA_LINK_DOCUMENTO_SECONDI,
  MESSAGGIO_FILE_NON_DISPONIBILE,
} from '../documentiLogic.ts';
import { createDocumentiService } from '../documentiService.ts';

const USER_RESIDENTE = '00000000-0000-0000-0000-000000000901';
const USER_ADMIN_CONDOMINO = '00000000-0000-0000-0000-000000000902';
const CONDOMINIO_A = '00000000-0000-0000-0000-000000000001';
const CONDOMINIO_B = '00000000-0000-0000-0000-000000000002';
const UNITA_1 = '00000000-0000-0000-0000-000000000201';
const UNITA_2 = '00000000-0000-0000-0000-000000000202';
const CARTELLA_A_REG = '00000000-0000-0000-0000-000000000801';
const CARTELLA_A_VERB = '00000000-0000-0000-0000-000000000802';
const CARTELLA_B_REG = '00000000-0000-0000-0000-000000000899';

const DOC_CONDOMINIALE = '00000000-0000-0000-0000-000000000811';
const DOC_UNITA_1 = '00000000-0000-0000-0000-000000000812';
const DOC_UNITA_2 = '00000000-0000-0000-0000-000000000813';
const DOC_ALTRO_CONDOMINIO = '00000000-0000-0000-0000-000000000891';

interface MockOpzioni {
  unitaAnagrafiche?: string[];
  unitaRuoli?: string[];
  simulaAdminRls?: boolean;
  filePresentiNelloStorage?: string[];
}

function creaMockDb(opzioni: MockOpzioni = {}) {
  const unitaAnagrafiche = opzioni.unitaAnagrafiche ?? [UNITA_1];
  const unitaRuoli = opzioni.unitaRuoli ?? [];
  const simulaAdminRls = opzioni.simulaAdminRls ?? false;
  const filePresenti = new Set(opzioni.filePresentiNelloStorage ?? []);

  const chiamateSignedUrl: Array<{ bucket: string; path: string; expiresIn: number }> = [];
  let chiamatoGetPublicUrl = false;

  const tutteCartelle = [
    {
      id: CARTELLA_A_REG,
      condominio_id: CONDOMINIO_A,
      parent_id: null,
      nome_cartella: 'Regolamenti e tabelle',
    },
    {
      id: CARTELLA_A_VERB,
      condominio_id: CONDOMINIO_A,
      parent_id: null,
      nome_cartella: 'Verbali assemblea',
    },
    {
      id: CARTELLA_B_REG,
      condominio_id: CONDOMINIO_B,
      parent_id: null,
      nome_cartella: 'Cartella altro condominio',
    },
  ];

  const tuttiDocumenti = [
    {
      id: DOC_CONDOMINIALE,
      cartella_id: CARTELLA_A_REG,
      unita_id: null,
      url_storage: 'seed-dev/documenti/regolamento-condominiale.pdf',
      nome_file: 'Regolamento condominiale e tabelle millesimali.pdf',
      tipo_mime: 'application/pdf',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: DOC_UNITA_1,
      cartella_id: CARTELLA_A_VERB,
      unita_id: UNITA_1,
      url_storage: `${CONDOMINIO_A}/unita-1/Prospetto_Int_1.pdf`,
      nome_file: 'Prospetto_Int_1.pdf',
      tipo_mime: 'application/pdf',
      created_at: '2026-02-15T12:00:00Z',
    },
    {
      id: DOC_UNITA_2,
      cartella_id: CARTELLA_A_VERB,
      unita_id: UNITA_2,
      url_storage: `${CONDOMINIO_A}/unita-2/Prospetto_Int_2.pdf`,
      nome_file: 'Prospetto_Int_2.pdf',
      tipo_mime: 'application/pdf',
      created_at: '2026-02-20T12:00:00Z',
    },
    {
      id: DOC_ALTRO_CONDOMINIO,
      cartella_id: CARTELLA_B_REG,
      unita_id: null,
      url_storage: `${CONDOMINIO_B}/regolamenti/Regolamento_B.pdf`,
      nome_file: 'Regolamento_B.pdf',
      tipo_mime: 'application/pdf',
      created_at: '2026-03-01T12:00:00Z',
    },
  ];

  const tutteUnita = [
    { id: UNITA_1, interno: '1' },
    { id: UNITA_2, interno: '2' },
  ];

  const db = {
    from(tabella: string) {
      const filtriEq = new Map<string, unknown>();
      const filtriIn = new Map<string, unknown[]>();

      const catena = {
        select() {
          return catena;
        },
        eq(colonna: string, valore: unknown) {
          filtriEq.set(colonna, valore);
          return catena;
        },
        in(colonna: string, valori: unknown[]) {
          filtriIn.set(colonna, valori);
          return catena;
        },
        not() {
          return catena;
        },
        or() {
          return catena;
        },
        order() {
          return catena;
        },
        async maybeSingle() {
          const righe = eseguiQuery();
          return { data: righe[0] ?? null, error: null };
        },
        then(
          onFulfilled?: (val: { data: unknown[]; error: null }) => unknown,
          onRejected?: (err: unknown) => unknown,
        ) {
          return Promise.resolve({ data: eseguiQuery(), error: null }).then(onFulfilled, onRejected);
        },
      };

      function eseguiQuery(): unknown[] {
        if (tabella === 'anagrafiche_unita') {
          return unitaAnagrafiche.map((unita_id) => ({ unita_id }));
        }
        if (tabella === 'utente_entita_ruolo') {
          return unitaRuoli.map((unita_id) => ({ unita_id }));
        }
        if (tabella === 'cartelle_documenti') {
          return tutteCartelle.filter((c) => {
            if (filtriEq.has('id') && c.id !== filtriEq.get('id')) return false;
            if (!simulaAdminRls && filtriEq.has('condominio_id') && c.condominio_id !== filtriEq.get('condominio_id')) {
              return false;
            }
            return true;
          });
        }
        if (tabella === 'documenti_metadata') {
          return tuttiDocumenti.filter((d) => {
            if (filtriEq.has('id') && d.id !== filtriEq.get('id')) return false;
            if (!simulaAdminRls && filtriIn.has('cartella_id')) {
              const ammesse = filtriIn.get('cartella_id') ?? [];
              if (!ammesse.includes(d.cartella_id)) return false;
            }
            return true;
          });
        }
        if (tabella === 'unita_immobiliari') {
          const ammesse = filtriIn.get('id') ?? [];
          return tutteUnita.filter((u) => ammesse.length === 0 || ammesse.includes(u.id));
        }
        return [];
      }

      return catena;
    },
    storage: {
      from(bucket: string) {
        return {
          async list(cartella: string, opzioniList?: { search?: string }) {
            const cerca = opzioniList?.search ?? '';
            const completo = cartella ? `${cartella}/${cerca}` : cerca;
            if (bucket === BUCKET_DOCUMENTI_CONDOMINIO && filePresenti.has(completo)) {
              return { data: [{ name: cerca }], error: null };
            }
            return { data: [], error: null };
          },
          async createSignedUrl(path: string, expiresIn: number) {
            chiamateSignedUrl.push({ bucket, path, expiresIn });
            return {
              data: { signedUrl: `https://storage.example.test/signed/${bucket}/${path}?exp=${expiresIn}` },
              error: null,
            };
          },
          getPublicUrl() {
            chiamatoGetPublicUrl = true;
            return { data: { publicUrl: 'https://storage.example.test/public' } };
          },
        };
      },
    },
  };

  return {
    db: db as unknown as TypedSupabaseClient,
    chiamateSignedUrl,
    get chiamatoGetPublicUrl() {
      return chiamatoGetPublicUrl;
    },
  };
}

describe('documentiService — isolamento tra unità, condomini e ruolo admin in vista condòmino', () => {
  it('restituisce al residente dell’Unità 1 solo i documenti condominiali e dell’Unità 1, escludendo Unità 2 e altri condomini', async () => {
    const { db } = creaMockDb({ unitaAnagrafiche: [UNITA_1] });
    const service = createDocumentiService(db);

    const { cartelle, documenti } = await service.elencoDocumentiCondomino(
      USER_RESIDENTE,
      CONDOMINIO_A,
    );

    assert.equal(cartelle.length, 2);
    assert.deepEqual(
      documenti.map((d) => d.id),
      [DOC_UNITA_1, DOC_CONDOMINIALE],
    );
    assert.equal(documenti[0]?.etichettaVisibilita, 'Unità Int. 1');
    assert.equal(documenti[1]?.etichettaVisibilita, 'Condominiale');
  });

  it('isola anche un amministratore o superadmin in vista condòmino: non mostra mai documenti di unità altrui', async () => {
    const { db } = creaMockDb({
      unitaAnagrafiche: [UNITA_1],
      simulaAdminRls: true, // il DB restituisce anche Unità 2 e Condominio B
    });
    const service = createDocumentiService(db);

    const { cartelle, documenti } = await service.elencoDocumentiCondomino(
      USER_ADMIN_CONDOMINO,
      CONDOMINIO_A,
    );

    assert.ok(cartelle.every((c) => c.condominioId === CONDOMINIO_A));
    assert.deepEqual(
      documenti.map((d) => d.id),
      [DOC_UNITA_1, DOC_CONDOMINIALE],
    );

    // Se l'admin non possiede alcuna unità in quel condominio, vede solo i documenti condominiali
    const { db: dbAdminSenzaUnita } = creaMockDb({
      unitaAnagrafiche: [],
      unitaRuoli: [],
      simulaAdminRls: true,
    });
    const serviceAdminSenzaUnita = createDocumentiService(dbAdminSenzaUnita);
    const resSenzaUnita = await serviceAdminSenzaUnita.elencoDocumentiCondomino(
      USER_ADMIN_CONDOMINO,
      CONDOMINIO_A,
    );
    assert.deepEqual(
      resSenzaUnita.documenti.map((d) => d.id),
      [DOC_CONDOMINIALE],
    );
  });

  it('dettaglioDocumentoCondomino restituisce null per ID inesistente, di altra unità o di altro condominio (senza enumerazione)', async () => {
    const { db, chiamateSignedUrl } = creaMockDb({
      unitaAnagrafiche: [UNITA_1],
      simulaAdminRls: true,
      filePresentiNelloStorage: [`${CONDOMINIO_A}/unita-1/Prospetto_Int_1.pdf`],
    });
    const service = createDocumentiService(db);

    const nonEsiste = await service.dettaglioDocumentoCondomino(
      USER_RESIDENTE,
      CONDOMINIO_A,
      '00000000-0000-0000-0000-000000009999',
    );
    assert.equal(nonEsiste, null);

    const altraUnita = await service.dettaglioDocumentoCondomino(
      USER_RESIDENTE,
      CONDOMINIO_A,
      DOC_UNITA_2,
    );
    assert.equal(altraUnita, null);

    const altroCondominio = await service.dettaglioDocumentoCondomino(
      USER_RESIDENTE,
      CONDOMINIO_A,
      DOC_ALTRO_CONDOMINIO,
    );
    assert.equal(altroCondominio, null);

    const validoPresente = await service.dettaglioDocumentoCondomino(
      USER_RESIDENTE,
      CONDOMINIO_A,
      DOC_UNITA_1,
    );
    assert.ok(validoPresente);
    assert.equal(validoPresente.disponibileNelloStorage, true);
    assert.equal(validoPresente.etichettaVisibilita, 'Unità Int. 1');
    // Il caricamento del dettaglio NON deve generare in anticipo il link firmato
    assert.equal(chiamateSignedUrl.length, 0);
  });
});

describe('documentiService — Storage privato, file assente e link firmato a 600 secondi', () => {
  it('rileva onestamente quando il file di prova non è presente nello Storage e non lancia errori non gestiti', async () => {
    const { db, chiamateSignedUrl, chiamatoGetPublicUrl } = creaMockDb({
      unitaAnagrafiche: [UNITA_1],
      filePresentiNelloStorage: [],
    });
    const service = createDocumentiService(db);

    const dettaglio = await service.dettaglioDocumentoCondomino(
      USER_RESIDENTE,
      CONDOMINIO_A,
      DOC_CONDOMINIALE,
    );
    assert.ok(dettaglio);
    assert.equal(dettaglio.disponibileNelloStorage, false);

    const esitoLink = await service.creaLinkFirmatoDocumento(
      dettaglio.urlStorage,
      CONDOMINIO_A,
    );
    assert.deepEqual(esitoLink, {
      disponibile: false,
      messaggio: MESSAGGIO_FILE_NON_DISPONIBILE,
    });
    assert.equal(chiamateSignedUrl.length, 0);
    assert.equal(chiamatoGetPublicUrl, false);
  });

  it('genera un link firmato temporaneo di 600 secondi (createSignedUrl, mai getPublicUrl) quando il file esiste nello Storage', async () => {
    const percorso = `${CONDOMINIO_A}/unita-1/Prospetto_Int_1.pdf`;
    const { db, chiamateSignedUrl, chiamatoGetPublicUrl } = creaMockDb({
      unitaAnagrafiche: [UNITA_1],
      filePresentiNelloStorage: [percorso],
    });
    const service = createDocumentiService(db);

    const esito = await service.creaLinkFirmatoDocumento(percorso, CONDOMINIO_A);
    assert.equal(esito.disponibile, true);
    if (esito.disponibile) {
      assert.match(esito.signedUrl, /exp=600/);
    }
    assert.equal(chiamateSignedUrl.length, 1);
    assert.deepEqual(chiamateSignedUrl[0], {
      bucket: BUCKET_DOCUMENTI_CONDOMINIO,
      path: percorso,
      expiresIn: DURATA_LINK_DOCUMENTO_SECONDI,
    });
    assert.equal(chiamatoGetPublicUrl, false);
  });

  it('rifiuta tentativi di path traversal o percorsi di un altro condominio in creaLinkFirmatoDocumento', async () => {
    const { db } = creaMockDb();
    const service = createDocumentiService(db);

    await assert.rejects(
      () =>
        service.creaLinkFirmatoDocumento(
          `${CONDOMINIO_A}/../${CONDOMINIO_B}/segreto.pdf`,
          CONDOMINIO_A,
        ),
      /Percorso del documento non valido/,
    );

    await assert.rejects(
      () =>
        service.creaLinkFirmatoDocumento(
          `${CONDOMINIO_B}/regolamenti/Regolamento_B.pdf`,
          CONDOMINIO_A,
        ),
      /Percorso del documento non valido/,
    );
  });
});

