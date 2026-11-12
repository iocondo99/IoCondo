import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { createPrenotazioniService } from './prenotazioniService.ts';

function creaDbMock(config: {
  risorse?: Array<Record<string, unknown>>;
  prenotazioni?: Array<Record<string, unknown>>;
  insertError?: { code?: string; message: string } | null;
}) {
  const chiamate: Array<{ tabella: string; op: string; payload?: unknown }> = [];

  const makeBuilder = (tabella: string) => {
    const state: { eqs: Record<string, unknown> } = { eqs: {} };
    const builder: Record<string, unknown> = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        state.eqs[col] = val;
        return builder;
      },
      order() {
        if (tabella === 'risorse_prenotabili') {
          return Promise.resolve({ data: config.risorse ?? [], error: null });
        }
        return Promise.resolve({ data: config.prenotazioni ?? [], error: null });
      },
      insert(payload: unknown) {
        chiamate.push({ tabella, op: 'insert', payload });
        return {
          select() {
            return {
              single() {
                if (config.insertError) {
                  return Promise.resolve({ data: null, error: config.insertError });
                }
                const obj = payload as Record<string, unknown>;
                return Promise.resolve({
                  data: { id: 'new-id', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', ...obj },
                  error: null,
                });
              },
            };
          },
        };
      },
      update(payload: unknown) {
        chiamate.push({ tabella, op: 'update', payload });
        return {
          eq() {
            return {
              eq() {
                return {
                  select() {
                    return {
                      single() {
                        const obj = payload as Record<string, unknown>;
                        return Promise.resolve({
                          data: { id: 'ris-1', condominio_id: 'cond-1', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', ...obj },
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
      delete() {
        chiamate.push({ tabella, op: 'delete' });
        return {
          eq() {
            return {
              eq() {
                return Promise.resolve({ error: null });
              },
              then(resolve: (v: { error: null }) => void) {
                resolve({ error: null });
              },
            };
          },
        };
      },
      single() {
        const trovata = (config.risorse ?? []).find((r) => r.id === state.eqs.id) ?? (config.risorse ?? [])[0];
        return Promise.resolve({ data: trovata ?? null, error: trovata ? null : { message: 'Not found' } });
      },
    };
    return builder;
  };

  const db = {
    from(tabella: string) {
      return makeBuilder(tabella);
    },
  } as unknown as TypedSupabaseClient;

  return { db, chiamate };
}

test('createPrenotazioniService: elencoRisorse e creaRisorsa', async () => {
  const { db, chiamate } = creaDbMock({
    risorse: [
      {
        id: 'ris-1',
        condominio_id: 'cond-1',
        nome: 'Campo da tennis',
        tariffa_oraria: '12.50',
        max_ore: 2,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
  });
  const svc = createPrenotazioniService(db);

  const lista = await svc.elencoRisorse('cond-1');
  assert.equal(lista.length, 1);
  assert.equal(lista[0]?.tariffa_oraria, 12.5);

  const creata = await svc.creaRisorsa('cond-1', { nome: 'Piscina', tariffa_oraria: '5,00', max_ore: '3' });
  assert.equal(creata.nome, 'Piscina');
  assert.equal(creata.tariffa_oraria, 5);
  assert.equal(creata.max_ore, 3);
  assert.equal(chiamate.some((c) => c.tabella === 'risorse_prenotabili' && c.op === 'insert'), true);
});

test('createPrenotazioniService: creaPrenotazione calcola costo e traduce 23P01', async () => {
  const risorsa = {
    id: 'ris-1',
    condominio_id: 'cond-1',
    nome: 'Campo da tennis',
    tariffa_oraria: 10,
    max_ore: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const inizio = new Date(Date.now() + 24 * 3600 * 1000);
  const fine = new Date(inizio.getTime() + 2 * 3600 * 1000);

  const { db } = creaDbMock({ risorse: [risorsa] });
  const svc = createPrenotazioniService(db);
  const p = await svc.creaPrenotazione('ris-1', 'u-1', { data_inizio: inizio, data_fine: fine });
  assert.equal(p.costo_addebitato, 20);

  const { db: dbConflict } = creaDbMock({
    risorse: [risorsa],
    insertError: { code: '23P01', message: 'exclusion constraint violated' },
  });
  const svcConflict = createPrenotazioniService(dbConflict);
  await assert.rejects(
    () => svcConflict.creaPrenotazione('ris-1', 'u-1', { data_inizio: inizio, data_fine: fine }),
    /Questo spazio risulta già prenotato nella fascia oraria scelta\./,
  );
});

test('createPrenotazioniService: elencoPrenotazioniCondominio e annullaPrenotazione', async () => {
  const { db, chiamate } = creaDbMock({
    prenotazioni: [
      {
        id: 'p-1',
        risorsa_id: 'ris-1',
        utente_id: 'u-1',
        data_inizio: '2027-01-10T10:00:00Z',
        data_fine: '2027-01-10T12:00:00Z',
        costo_addebitato: '20.00',
        created_at: '2026-11-01T00:00:00Z',
        risorse_prenotabili: { nome: 'Campo da tennis', condominio_id: 'cond-1', tariffa_oraria: '10.00' },
        utenti: { nome_cognome: 'Mario Rossi', email: 'mario@example.com' },
      },
    ],
  });
  const svc = createPrenotazioniService(db);
  const lista = await svc.elencoPrenotazioniCondominio('cond-1');
  assert.equal(lista.length, 1);
  assert.equal(lista[0]?.risorsa_nome, 'Campo da tennis');
  assert.equal(lista[0]?.utente_nome, 'Mario Rossi');
  assert.equal(lista[0]?.costo_addebitato, 20);

  await svc.annullaPrenotazione('p-1', 'u-1');
  assert.equal(chiamate.some((c) => c.tabella === 'prenotazioni_spazi' && c.op === 'delete'), true);
});
