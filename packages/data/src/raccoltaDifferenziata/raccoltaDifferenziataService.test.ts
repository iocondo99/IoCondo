import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IRaccoltaDifferenziata } from '@iocondo/shared-types';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { createRaccoltaDifferenziataService } from './raccoltaDifferenziataService.ts';

const COND_A = 'd0000000-0000-4000-8000-000000000001';
const COND_B = 'd0000000-0000-4000-8000-000000000002';

function creaMockDb(iniziali: IRaccoltaDifferenziata[] = []) {
  const righe: IRaccoltaDifferenziata[] = [...iniziali];
  let seq = 1;

  const client = {
    from(table: string) {
      assert.equal(table, 'raccolta_differenziata');
      return {
        select(_cols?: string) {
          const filtri: Array<[string, unknown]> = [];
          const builder = {
            eq(col: string, val: unknown) {
              filtri.push([col, val]);
              return builder;
            },
            order() {
              return builder;
            },
            then(resolve: (res: { data: IRaccoltaDifferenziata[]; error: null }) => void) {
              const out = righe.filter((r) =>
                filtri.every(([c, v]) => r[c as keyof IRaccoltaDifferenziata] === v),
              );
              resolve({ data: out, error: null });
            },
          };
          return builder;
        },
        insert(payload: Omit<IRaccoltaDifferenziata, 'id'>) {
          const nuovo: IRaccoltaDifferenziata = {
            id: `turno-${seq++}`,
            condominio_id: payload.condominio_id,
            tipo_rifiuto: payload.tipo_rifiuto,
            giorno_settimana: payload.giorno_settimana,
            note: payload.note ?? null,
          };
          righe.push(nuovo);
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: nuovo, error: null });
                },
              };
            },
          };
        },
        update(payload: Partial<IRaccoltaDifferenziata>) {
          const filtri: Array<[string, unknown]> = [];
          const builder = {
            eq(col: string, val: unknown) {
              filtri.push([col, val]);
              return builder;
            },
            select() {
              return {
                single() {
                  const idx = righe.findIndex((r) =>
                    filtri.every(([c, v]) => r[c as keyof IRaccoltaDifferenziata] === v),
                  );
                  if (idx < 0) {
                    return Promise.resolve({
                      data: null,
                      error: { message: 'Not found', code: 'PGRST116' },
                    });
                  }
                  const aggiornato = { ...righe[idx]!, ...payload };
                  righe[idx] = aggiornato;
                  return Promise.resolve({ data: aggiornato, error: null });
                },
              };
            },
          };
          return builder;
        },
        delete() {
          const filtri: Array<[string, unknown]> = [];
          const builder = {
            eq(col: string, val: unknown) {
              filtri.push([col, val]);
              return builder;
            },
            then(resolve: (res: { data: null; error: null }) => void) {
              for (let i = righe.length - 1; i >= 0; i -= 1) {
                if (filtri.every(([c, v]) => righe[i]![c as keyof IRaccoltaDifferenziata] === v)) {
                  righe.splice(i, 1);
                }
              }
              resolve({ data: null, error: null });
            },
          };
          return builder;
        },
      };
    },
  };

  return { client: client as unknown as TypedSupabaseClient, righe };
}

describe('createRaccoltaDifferenziataService', () => {
  it('elenco restituisce solo i turni del condominio ordinati', async () => {
    const { client } = creaMockDb([
      { id: 't1', condominio_id: COND_A, tipo_rifiuto: 'Vetro', giorno_settimana: 5, note: null },
      { id: 't2', condominio_id: COND_A, tipo_rifiuto: 'Carta', giorno_settimana: 1, note: 'Entro 7:00' },
      { id: 't3', condominio_id: COND_B, tipo_rifiuto: 'Umido', giorno_settimana: 2, note: null },
    ]);
    const service = createRaccoltaDifferenziataService(client);
    const lista = await service.elenco(COND_A);
    assert.deepEqual(
      lista.map((x) => x.id),
      ['t2', 't1'],
    );
  });

  it('crea, aggiorna ed elimina rispettando il condominio', async () => {
    const { client, righe } = creaMockDb();
    const service = createRaccoltaDifferenziataService(client);

    const creato = await service.crea(COND_A, {
      tipo_rifiuto: '  Umido / Organico ',
      giorno_settimana: 1,
      note: '  Esporre entro le 7:00 ',
    });
    assert.equal(creato.tipo_rifiuto, 'Umido / Organico');
    assert.equal(creato.note, 'Esporre entro le 7:00');
    assert.equal(righe.length, 1);

    const aggiornato = await service.aggiorna(creato.id, COND_A, {
      tipo_rifiuto: 'Umido',
      giorno_settimana: 4,
      note: '',
    });
    assert.equal(aggiornato.giorno_settimana, 4);
    assert.equal(aggiornato.note, null);

    await assert.rejects(
      () =>
        service.aggiorna(creato.id, COND_B, {
          tipo_rifiuto: 'Umido',
          giorno_settimana: 4,
        }),
      /Not found/,
    );

    await service.elimina(creato.id, COND_A);
    assert.equal(righe.length, 0);
  });

  it('rifiuta input non valido in crea e aggiorna', async () => {
    const { client } = creaMockDb();
    const service = createRaccoltaDifferenziataService(client);

    await assert.rejects(
      () => service.crea(COND_A, { tipo_rifiuto: '', giorno_settimana: 1 }),
      /tipologia di rifiuto/,
    );
    await assert.rejects(
      () => service.aggiorna('id-1', COND_A, { tipo_rifiuto: 'Vetro', giorno_settimana: 9 }),
      /giorno della settimana/,
    );
  });
});
