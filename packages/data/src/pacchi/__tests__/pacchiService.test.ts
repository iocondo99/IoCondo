import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { createPacchiService } from '../pacchiService.ts';

const USER_PORTIERE = '00000000-0000-0000-0000-000000000001';
const USER_CONDOMINO = '00000000-0000-0000-0000-000000000002';
const USER_ESTRANEO = '00000000-0000-0000-0000-000000000099';

const COND_A = 'd0000000-0000-4000-8000-000000000001';
const COND_B = 'd0000000-0000-4000-8000-000000000002';

const PALAZZO_A = 'pal-01';
const UNITA_MIA = 'unita-01'; // dell'utente condòmino
const UNITA_VICINO = 'unita-02'; // di un altro condòmino

interface MockPacchiData {
  pacchi?: Array<{
    id: string;
    condominio_id: string;
    unita_destinazione_id: string;
    registrato_da: string | null;
    mittente_esterno: string | null;
    stato: 'GIACENZA' | 'RITIRATO';
    data_arrivo: string;
    data_ritiro: string | null;
    firma_ritiro: string | null;
  }>;
}

function creaMockDb(initial: MockPacchiData = {}) {
  const pacchiDb = [
    ...(initial.pacchi ?? [
      {
        id: 'pacco-cond-a-mia-unita',
        condominio_id: COND_A,
        unita_destinazione_id: UNITA_MIA,
        registrato_da: USER_PORTIERE,
        mittente_esterno: 'Amazon',
        stato: 'GIACENZA',
        data_arrivo: '2026-11-03T10:00:00Z',
        data_ritiro: null,
        firma_ritiro: null,
      },
      {
        id: 'pacco-cond-a-vicino',
        condominio_id: COND_A,
        unita_destinazione_id: UNITA_VICINO,
        registrato_da: USER_PORTIERE,
        mittente_esterno: 'Zalando',
        stato: 'GIACENZA',
        data_arrivo: '2026-11-02T11:00:00Z',
        data_ritiro: null,
        firma_ritiro: null,
      },
      {
        id: 'pacco-cond-b',
        condominio_id: COND_B,
        unita_destinazione_id: 'unita-b-01',
        registrato_da: 'portiere-b',
        mittente_esterno: 'Altro Condominio',
        stato: 'GIACENZA',
        data_arrivo: '2026-11-01T12:00:00Z',
        data_ritiro: null,
        firma_ritiro: null,
      },
    ]),
  ];

  const db = {
    auth: {
      getUser: async () => ({
        data: { user: { id: USER_PORTIERE } },
        error: null,
      }),
    },
    from: (table: string) => {
      let selectedFields = '';
      let filterCondominio: string | null = null;
      let filterUnitaIn: string[] | null = null;
      let filterId: string | null = null;
      let filterPalazzoIdIn: string[] | null = null;
      let filterUserId: string | null = null;

      const queryBuilder: any = {
        select: (fields: string) => {
          selectedFields = fields;
          return queryBuilder;
        },
        eq: (col: string, val: any) => {
          if (col === 'condominio_id') filterCondominio = val;
          if (col === 'id') filterId = val;
          if (col === 'utente_id') filterUserId = val;
          return queryBuilder;
        },
        in: (col: string, vals: any[]) => {
          if (col === 'unita_destinazione_id') filterUnitaIn = vals;
          if (col === 'id' && table === 'unita_immobiliari') filterUnitaIn = vals;
          if (col === 'palazzo_id') filterPalazzoIdIn = vals;
          return queryBuilder;
        },
        not: () => queryBuilder,
        or: () => queryBuilder,
        order: () => queryBuilder,
        single: async () => {
          const res = await queryBuilder;
          return { data: res.data?.[0] ?? null, error: null };
        },
        maybeSingle: async () => {
          const res = await queryBuilder;
          return { data: res.data?.[0] ?? null, error: null };
        },
        then: (resolve: any) => {
          if (table === 'registro_pacchi') {
            let res = pacchiDb.filter((p) => {
              if (filterCondominio && p.condominio_id !== filterCondominio) return false;
              if (filterUnitaIn && !filterUnitaIn.includes(p.unita_destinazione_id)) return false;
              if (filterId && p.id !== filterId) return false;
              return true;
            });
            // Aggiungi le join fittizie se richieste
            const enriched = res.map((p) => ({
              ...p,
              unita_immobiliari: {
                id: p.unita_destinazione_id,
                interno: p.unita_destinazione_id === UNITA_MIA ? '1' : '2',
                piano: 1,
                palazzi: {
                  id: PALAZZO_A,
                  nome_identificativo: 'Palazzina A',
                },
              },
              utenti: {
                id: p.registrato_da || '',
                nome_cognome: 'Mario Portiere',
              },
            }));
            return Promise.resolve(resolve({ data: enriched, error: null }));
          }

          if (table === 'palazzi') {
            return Promise.resolve(
              resolve({
                data: [
                  { id: PALAZZO_A, nome_identificativo: 'Palazzina A', condominio_id: COND_A },
                ],
                error: null,
              }),
            );
          }

          if (table === 'unita_immobiliari') {
            const allUnita = [
              { id: UNITA_MIA, palazzo_id: PALAZZO_A, interno: '1', piano: 1 },
              { id: UNITA_VICINO, palazzo_id: PALAZZO_A, interno: '2', piano: 1 },
            ];
            let res = allUnita;
            if (filterUnitaIn) {
              res = res.filter((u) => filterUnitaIn!.includes(u.id));
            }
            if (filterPalazzoIdIn) {
              res = res.filter((u) => filterPalazzoIdIn!.includes(u.palazzo_id));
            }
            return Promise.resolve(resolve({ data: res, error: null }));
          }

          if (table === 'anagrafiche_unita') {
            if (filterUserId === USER_CONDOMINO) {
              return Promise.resolve(resolve({ data: [{ unita_id: UNITA_MIA }], error: null }));
            }
            return Promise.resolve(resolve({ data: [], error: null }));
          }

          if (table === 'utente_entita_ruolo') {
            if (filterUserId === USER_PORTIERE) {
              return Promise.resolve(
                resolve({
                  data: [
                    {
                      condominio_id: COND_A,
                      ruolo_id: 'r-portiere',
                      ruoli_piattaforma: { codice: 'PORTIERE' },
                    },
                  ],
                  error: null,
                }),
              );
            }
            if (filterUserId === USER_CONDOMINO) {
              return Promise.resolve(
                resolve({
                  data: [
                    {
                      condominio_id: COND_A,
                      ruolo_id: 'r-condomino',
                      ruoli_piattaforma: { codice: 'CONDOMINO' },
                    },
                  ],
                  error: null,
                }),
              );
            }
            return Promise.resolve(resolve({ data: [], error: null }));
          }

          if (table === 'condomini') {
            return Promise.resolve(resolve({ data: { admin_id: null }, error: null }));
          }

          if (table === 'profili_pubblici') {
            return Promise.resolve(
              resolve({
                data: [{ id: USER_PORTIERE, nome_cognome: 'Mario Portiere' }],
                error: null,
              }),
            );
          }

          return Promise.resolve(resolve({ data: [], error: null }));
        },
        insert: (row: any) => {
          const newId = `pacco-generato-${Date.now()}`;
          const newRow = { id: newId, ...row };
          pacchiDb.push(newRow);
          return {
            select: () => ({
              single: async () => ({ data: { id: newId }, error: null }),
            }),
          };
        },
        update: (values: any) => {
          return {
            eq: async (col: string, val: any) => {
              const r = pacchiDb.find((p) => p.id === val);
              if (r) {
                Object.assign(r, values);
              }
              return { error: null };
            },
          };
        },
      };

      return queryBuilder;
    },
  } as unknown as TypedSupabaseClient;

  return { db, pacchiDb };
}

describe('pacchiService — elencoPacchi e isolamento dei ruoli', () => {
  it('il portiere visualizza tutti i pacchi del condominio ma non quelli di altri condomini', async () => {
    const { db } = creaMockDb();
    const service = createPacchiService(db);

    const pacchi = await service.elencoPacchi(COND_A, USER_PORTIERE, {
      ruoli: ['PORTIERE'],
    });

    assert.equal(pacchi.length, 2);
    assert.deepEqual(
      pacchi.map((p) => p.id),
      ['pacco-cond-a-mia-unita', 'pacco-cond-a-vicino'],
    );
    assert.ok(!pacchi.some((p) => p.id === 'pacco-cond-b'));
  });

  it('il condòmino visualizza solo i pacchi destinati alla propria unità attiva', async () => {
    const { db } = creaMockDb();
    const service = createPacchiService(db);

    const pacchi = await service.elencoPacchi(COND_A, USER_CONDOMINO, {
      ruoli: ['CONDOMINO'],
    });

    assert.equal(pacchi.length, 1);
    assert.equal(pacchi[0]?.id, 'pacco-cond-a-mia-unita');
    assert.equal(pacchi[0]?.unitaDestinazioneId, UNITA_MIA);
    // Il pacco del vicino non compare
    assert.ok(!pacchi.some((p) => p.id === 'pacco-cond-a-vicino'));
  });

  it('un utente senza unità attive nel condominio riceve un elenco vuoto', async () => {
    const { db } = creaMockDb();
    const service = createPacchiService(db);

    const pacchi = await service.elencoPacchi(COND_A, USER_ESTRANEO, {
      ruoli: ['CONDOMINO'],
    });

    assert.equal(pacchi.length, 0);
  });
});

describe('pacchiService — registraNuovoPacco e segnaComeRitirato', () => {
  it('registra un nuovo pacco in giacenza con la data di arrivo e registrato_da', async () => {
    const { db, pacchiDb } = creaMockDb();
    const service = createPacchiService(db);

    const risultato = await service.registraNuovoPacco({
      condominioId: COND_A,
      unitaId: UNITA_MIA,
      mittenteEsterno: 'Corriere Bartolini',
    });

    assert.equal(risultato.ok, true);
    if (risultato.ok) {
      const creato = pacchiDb.find((p) => p.id === risultato.paccoId);
      assert.ok(creato);
      assert.equal(creato.stato, 'GIACENZA');
      assert.equal(creato.mittente_esterno, 'Corriere Bartolini');
      assert.equal(creato.registrato_da, USER_PORTIERE);
      assert.ok(creato.data_arrivo);
      assert.equal(creato.data_ritiro, null);
    }
  });

  it('rifiuta la creazione se l’unità non è valorizzata', async () => {
    const { db } = creaMockDb();
    const service = createPacchiService(db);

    const risultato = await service.registraNuovoPacco({
      condominioId: COND_A,
      unitaId: '',
      mittenteEsterno: 'Poste',
    });

    assert.equal(risultato.ok, false);
    if (!risultato.ok) {
      assert.ok(risultato.errori.unitaId);
    }
  });

  it('segna un pacco come ritirato salvando data e firma', async () => {
    const { db, pacchiDb } = creaMockDb();
    const service = createPacchiService(db);

    const paccoId = 'pacco-cond-a-mia-unita';
    const esito = await service.segnaComeRitirato(paccoId, 'Luigi Bianchi (residente)');

    assert.equal(esito.ok, true);
    const aggiornato = pacchiDb.find((p) => p.id === paccoId);
    assert.ok(aggiornato);
    assert.equal(aggiornato.stato, 'RITIRATO');
    assert.equal(aggiornato.firma_ritiro, 'Luigi Bianchi (residente)');
    assert.ok(aggiornato.data_ritiro);
  });

  it('rifiuta il ritiro se la firma o nominativo è vuoto', async () => {
    const { db } = creaMockDb();
    const service = createPacchiService(db);

    const esito = await service.segnaComeRitirato('pacco-cond-a-mia-unita', '   ');
    assert.equal(esito.ok, false);
  });
});

describe('pacchiService — elencoUnitaCondominio', () => {
  it('restituisce le opzioni delle unità immobiliari ordinate', async () => {
    const { db } = creaMockDb();
    const service = createPacchiService(db);

    const opzioni = await service.elencoUnitaCondominio(COND_A);
    assert.equal(opzioni.length, 2);
    assert.equal(opzioni[0]?.id, UNITA_MIA);
    assert.equal(opzioni[0]?.etichetta, 'Palazzina A — Int. 1');
    assert.equal(opzioni[1]?.id, UNITA_VICINO);
    assert.equal(opzioni[1]?.etichetta, 'Palazzina A — Int. 2');
  });
});

