import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  DURATA_LINK_VERBALE_SECONDI,
} from '../assembleeLogic.ts';
import { BUCKET_DOCUMENTI_CONDOMINIO } from '../../documenti/documentiLogic.ts';
import { createAssembleeService } from '../assembleeService.ts';

const USER_ID = '00000000-0000-0000-0000-000000000901';
const COND_A = 'd0000000-0000-4000-8000-000000000001';
const COND_B = 'd0000000-0000-4000-8000-000000000002';
const UNITA_1 = 'd0000000-0000-4000-8000-000000000101';
const UNITA_ALTRUI = 'd0000000-0000-4000-8000-000000000199';

const ASS_CONVOCATA = 'ass-convocata-01';
const ASS_IN_CORSO = 'ass-in-corso-01';
const ASS_CONCLUSA = 'ass-conclusa-01';
const ASS_BOZZA = 'ass-bozza-01';
const ASS_ALTRO_COND = 'ass-altro-cond-01';

const PUNTO_1 = 'punto-01';
const PUNTO_2 = 'punto-02';

interface MockOpzioni {
  filePresentiNelloStorage?: string[];
  votiIniziali?: Array<{
    id?: string;
    punto_odg_id: string;
    unita_id: string;
    utente_id: string;
    voto: string;
  }>;
}

function creaMockDb(opzioni: MockOpzioni = {}) {
  const filePresenti = new Set(opzioni.filePresentiNelloStorage ?? []);
  const votiSalvati = [...(opzioni.votiIniziali ?? [])];
  const chiamateSignedUrl: Array<{ bucket: string; path: string; expiresIn: number }> = [];
  let chiamatoGetPublicUrl = false;

  const tutteAssemblee = [
    {
      id: ASS_CONVOCATA,
      condominio_id: COND_A,
      tabella_millesimale_id: null,
      data: '2026-06-15T18:00:00Z',
      luogo: 'Sala civica',
      link_meet: 'https://meet.google.com/convocata',
      verbale_url: null,
      stato: 'CONVOCATA',
      tipo: 'ORDINARIA',
      modalita: 'IBRIDA',
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T10:00:00Z',
    },
    {
      id: ASS_IN_CORSO,
      condominio_id: COND_A,
      tabella_millesimale_id: null,
      data: '2026-05-20T18:00:00Z',
      luogo: 'Atrio condominiale',
      link_meet: 'https://meet.google.com/incorso',
      verbale_url: null,
      stato: 'IN_CORSO',
      tipo: 'STRAORDINARIA',
      modalita: 'IBRIDA',
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T10:00:00Z',
    },
    {
      id: ASS_CONCLUSA,
      condominio_id: COND_A,
      tabella_millesimale_id: null,
      data: '2026-02-10T18:00:00Z',
      luogo: 'Studio Amministratore',
      link_meet: null,
      verbale_url: `${COND_A}/verbali/verbale_2026_02_10.pdf`,
      stato: 'CONCLUSA',
      tipo: 'ORDINARIA',
      modalita: 'PRESENZA',
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-02-11T10:00:00Z',
    },
    {
      id: ASS_BOZZA,
      condominio_id: COND_A,
      tabella_millesimale_id: null,
      data: '2026-07-01T18:00:00Z',
      luogo: 'Bozza Luogo',
      link_meet: null,
      verbale_url: null,
      stato: 'BOZZA',
      tipo: 'ORDINARIA',
      modalita: 'PRESENZA',
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T10:00:00Z',
    },
    {
      id: ASS_ALTRO_COND,
      condominio_id: COND_B,
      tabella_millesimale_id: null,
      data: '2026-05-18T18:00:00Z',
      luogo: 'Altro condominio',
      link_meet: null,
      verbale_url: null,
      stato: 'CONVOCATA',
      tipo: 'ORDINARIA',
      modalita: 'PRESENZA',
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T10:00:00Z',
    },
  ];

  const tuttiPunti = [
    {
      id: PUNTO_1,
      assemblea_id: ASS_IN_CORSO,
      ordine: 1,
      titolo_punto: 'Approvazione manutenzione straordinaria tetto',
      descrizione: 'Preventivo ditta Edilizia Rossi',
      votazione_aperta: true,
    },
    {
      id: PUNTO_2,
      assemblea_id: ASS_IN_CORSO,
      ordine: 2,
      titolo_punto: 'Varie ed eventuali',
      descrizione: null,
      votazione_aperta: false,
    },
  ];

  const db = {
    from(tabella: string) {
      const filtriEq = new Map<string, unknown>();
      const filtriNeq = new Map<string, unknown>();
      const filtriIn = new Map<string, unknown[]>();

      const catena = {
        select() {
          return catena;
        },
        eq(colonna: string, valore: unknown) {
          filtriEq.set(colonna, valore);
          return catena;
        },
        neq(colonna: string, valore: unknown) {
          filtriNeq.set(colonna, valore);
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
        limit(n: number) {
          return catena;
        },
        upsert(record: any, opzioni?: any) {
          const idx = votiSalvati.findIndex(
            (v) => v.punto_odg_id === record.punto_odg_id && v.unita_id === record.unita_id,
          );
          if (idx >= 0) {
            votiSalvati[idx] = { ...votiSalvati[idx], ...record };
          } else {
            votiSalvati.push({ id: `voto-${Date.now()}`, ...record });
          }
          return {
            select() {
              return {
                async single() {
                  return { data: record, error: null };
                },
              };
            },
          };
        },
        async maybeSingle() {
          const righe = eseguiQuery();
          return { data: righe[0] ?? null, error: null };
        },
        async single() {
          const righe = eseguiQuery();
          return { data: righe[0] ?? null, error: null };
        },
        then(
          onFulfilled?: (val: { data: unknown[]; error: null }) => unknown,
          onRejected?: (err: unknown) => unknown,
        ) {
          return Promise.resolve({ data: eseguiQuery(), error: null }).then(
            onFulfilled,
            onRejected,
          );
        },
      };

      function eseguiQuery(): unknown[] {
        if (tabella === 'anagrafiche_unita') {
          return [{ unita_id: UNITA_1 }];
        }
        if (tabella === 'utente_entita_ruolo') {
          return [{ unita_id: UNITA_1 }];
        }
        if (tabella === 'unita_immobiliari') {
          return [
            {
              id: UNITA_1,
              interno: '1',
              palazzi: { condominio_id: COND_A },
            },
          ];
        }
        if (tabella === 'assemblee_testata') {
          return tutteAssemblee.filter((a) => {
            if (filtriEq.has('id') && a.id !== filtriEq.get('id')) return false;
            if (filtriEq.has('condominio_id') && a.condominio_id !== filtriEq.get('condominio_id'))
              return false;
            if (filtriNeq.has('stato') && a.stato === filtriNeq.get('stato')) return false;
            return true;
          });
        }
        if (tabella === 'assemblee_punti_odg') {
          return tuttiPunti
            .filter((p) => {
              if (filtriEq.has('id') && p.id !== filtriEq.get('id')) return false;
              if (filtriEq.has('assemblea_id') && p.assemblea_id !== filtriEq.get('assemblea_id'))
                return false;
              if (filtriIn.has('assemblea_id')) {
                const ammesse = filtriIn.get('assemblea_id') ?? [];
                if (!ammesse.includes(p.assemblea_id)) return false;
              }
              return true;
            })
            .map((p) => {
              // Simula join con assemblee_testata se richiesto (esprimiVoto)
              const ass = tutteAssemblee.find((a) => a.id === p.assemblea_id);
              return {
                ...p,
                assemblee_testata: ass ? { stato: ass.stato, condominio_id: ass.condominio_id } : null,
              };
            });
        }
        if (tabella === 'assemblee_voti') {
          return votiSalvati.filter((v) => {
            if (filtriEq.has('punto_odg_id') && v.punto_odg_id !== filtriEq.get('punto_odg_id'))
              return false;
            if (filtriEq.has('unita_id') && v.unita_id !== filtriEq.get('unita_id')) return false;
            if (filtriEq.has('utente_id') && v.utente_id !== filtriEq.get('utente_id'))
              return false;
            if (filtriIn.has('punto_odg_id')) {
              const ammessi = filtriIn.get('punto_odg_id') ?? [];
              if (!ammessi.includes(v.punto_odg_id)) return false;
            }
            return true;
          });
        }
        return [];
      }

      return catena;
    },
    async rpc(nome: string, args: { p_punto: string }) {
      if (nome === 'risultati_voto') {
        if (args.p_punto === PUNTO_1) {
          return {
            data: [
              {
                voto: 'FAVOREVOLE',
                n_voti: 3,
                millesimi: 250.0,
                percentuale_teste: 75.0,
                percentuale_millesimi: 68.5,
              },
              {
                voto: 'CONTRARIO',
                n_voti: 1,
                millesimi: 115.0,
                percentuale_teste: 25.0,
                percentuale_millesimi: 31.5,
              },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      }
      return { data: null, error: null };
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
              data: {
                signedUrl: `https://storage.test/signed/${bucket}/${path}?exp=${expiresIn}`,
              },
              error: null,
            };
          },
          getPublicUrl() {
            chiamatoGetPublicUrl = true;
            return { data: { publicUrl: 'https://storage.test/public' } };
          },
        };
      },
    },
  };

  return {
    db: db as unknown as TypedSupabaseClient,
    chiamateSignedUrl,
    haChiamatoGetPublicUrl: () => chiamatoGetPublicUrl,
    votiSalvati,
  };
}

describe('assembleeService — isolamento e visibilità condòmino', () => {
  it('elencoAssembleeCondomino esclude categoricamente le BOZZE e le assemblee di altri condomini', async () => {
    const { db } = creaMockDb();
    const service = createAssembleeService(db);

    const elenco = await service.elencoAssembleeCondomino(USER_ID, COND_A);

    // Deve includere CONVOCATA, IN_CORSO, CONCLUSA ma non BOZZA né COND_B
    const ids = elenco.map((a) => a.id);
    assert.equal(ids.includes(ASS_CONVOCATA), true);
    assert.equal(ids.includes(ASS_IN_CORSO), true);
    assert.equal(ids.includes(ASS_CONCLUSA), true);
    assert.equal(ids.includes(ASS_BOZZA), false);
    assert.equal(ids.includes(ASS_ALTRO_COND), false);

    // Verifica aggregazione punti e conteggio votazioni aperte
    const inCorso = elenco.find((a) => a.id === ASS_IN_CORSO);
    assert.equal(inCorso?.totalePuntiOdg, 2);
    assert.equal(inCorso?.votazioniAperte, 1); // solo PUNTO_1 ha votazione_aperta = true
  });

  it('dettaglioAssembleaCondomino restituisce null (NonAutorizzato) per bozze, altri condomini o ID inesistenti', async () => {
    const { db } = creaMockDb();
    const service = createAssembleeService(db);

    // Bozza: non accessibile al condòmino
    const bozza = await service.dettaglioAssembleaCondomino(USER_ID, COND_A, ASS_BOZZA);
    assert.equal(bozza, null);

    // Altro condominio
    const altro = await service.dettaglioAssembleaCondomino(USER_ID, COND_A, ASS_ALTRO_COND);
    assert.equal(altro, null);

    // ID inesistente
    const inesistente = await service.dettaglioAssembleaCondomino(
      USER_ID,
      COND_A,
      '00000000-0000-0000-0000-000000000999',
    );
    assert.equal(inesistente, null);
  });
});

describe('assembleeService — dettaglio, voti e aggregazione risultati', () => {
  it('restituisce dettaglio con punti ODG, voto residente e risultati aggregati via RPC', async () => {
    const { db } = creaMockDb({
      votiIniziali: [
        {
          punto_odg_id: PUNTO_1,
          unita_id: UNITA_1,
          utente_id: USER_ID,
          voto: 'FAVOREVOLE',
        },
      ],
    });
    const service = createAssembleeService(db);

    const dett = await service.dettaglioAssembleaCondomino(USER_ID, COND_A, ASS_IN_CORSO);
    assert.notEqual(dett, null);
    assert.equal(dett?.id, ASS_IN_CORSO);
    assert.equal(dett?.stato, 'IN_CORSO');
    assert.equal(dett?.puntiOdg.length, 2);

    // Punto 1: votabile e con voto espresso
    const p1 = dett?.puntiOdg[0];
    assert.equal(p1?.id, PUNTO_1);
    assert.equal(p1?.votabile, true);
    assert.equal(p1?.mioVoto, 'FAVOREVOLE');
    assert.equal(p1?.unitaIdVoto, UNITA_1);

    // Risultati punto 1: aggregati da RPC, zero voti nominali
    assert.equal(p1?.risultati.haVoti, true);
    assert.equal(p1?.risultati.totaleVoti, 4);
    const fav = p1?.risultati.opzioni.find((o) => o.voto === 'FAVOREVOLE');
    assert.equal(fav?.percentualeTeste, 75);

    // Punto 2: votazione chiusa
    const p2 = dett?.puntiOdg[1];
    assert.equal(p2?.id, PUNTO_2);
    assert.equal(p2?.votabile, false);
    assert.equal(p2?.mioVoto, null);

    // Link video-call valido
    assert.equal(dett?.linkMeetValido, 'https://meet.google.com/incorso');
  });

  it('gestisce verbale presente nello Storage con link firmato temporaneo (600 s, mai URL pubblici)', async () => {
    const fileVerbale = `${COND_A}/verbali/verbale_2026_02_10.pdf`;
    const { db, chiamateSignedUrl, haChiamatoGetPublicUrl } = creaMockDb({
      filePresentiNelloStorage: [fileVerbale],
    });
    const service = createAssembleeService(db);

    const dett = await service.dettaglioAssembleaCondomino(USER_ID, COND_A, ASS_CONCLUSA);
    assert.notEqual(dett, null);
    assert.equal(dett?.verbaleDisponibile, true);
    assert.notEqual(dett?.verbaleUrlFirmato, null);

    // Verifica durata 600 s e bucket
    assert.equal(chiamateSignedUrl.length, 1);
    assert.equal(chiamateSignedUrl[0]?.bucket, BUCKET_DOCUMENTI_CONDOMINIO);
    assert.equal(chiamateSignedUrl[0]?.expiresIn, DURATA_LINK_VERBALE_SECONDI);
    assert.equal(chiamateSignedUrl[0]?.path, fileVerbale);

    // MAI getPublicUrl
    assert.equal(haChiamatoGetPublicUrl(), false);
  });

  it('gestisce verbale assente nello Storage senza errori non gestiti', async () => {
    // Nessun file nello storage
    const { db, chiamateSignedUrl } = creaMockDb({
      filePresentiNelloStorage: [],
    });
    const service = createAssembleeService(db);

    const dett = await service.dettaglioAssembleaCondomino(USER_ID, COND_A, ASS_CONCLUSA);
    assert.notEqual(dett, null);
    assert.equal(dett?.verbaleDisponibile, false);
    assert.equal(dett?.verbaleUrlFirmato, null);
    assert.equal(chiamateSignedUrl.length, 0);
  });
});

describe('assembleeService — esprimiVoto', () => {
  it('registra o modifica il voto se il punto ha votazione aperta e l assemblea è in corso', async () => {
    const { db, votiSalvati } = creaMockDb();
    const service = createAssembleeService(db);

    const voto = await service.esprimiVoto(USER_ID, PUNTO_1, UNITA_1, 'FAVOREVOLE');
    assert.equal(voto.voto, 'FAVOREVOLE');
    assert.equal(voto.punto_odg_id, PUNTO_1);
    assert.equal(voto.unita_id, UNITA_1);

    // Modifica del voto
    const votoModificato = await service.esprimiVoto(USER_ID, PUNTO_1, UNITA_1, 'CONTRARIO');
    assert.equal(votoModificato.voto, 'CONTRARIO');
  });

  it('rifiuta il voto se la votazione è chiusa sul punto', async () => {
    const { db } = creaMockDb();
    const service = createAssembleeService(db);

    await assert.rejects(
      () => service.esprimiVoto(USER_ID, PUNTO_2, UNITA_1, 'FAVOREVOLE'),
      /non è aperta/,
    );
  });

  it('rifiuta il voto se l unità immobiliare non appartiene all utente', async () => {
    const { db } = creaMockDb();
    const service = createAssembleeService(db);

    await assert.rejects(
      () => service.esprimiVoto(USER_ID, PUNTO_1, UNITA_ALTRUI, 'FAVOREVOLE'),
      /Non sei autorizzato a votare per questa unità/,
    );
  });
});
