import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { createProfiloService } from '../../services/profiloService.ts';

const USER_ID = 'u-test-01';

interface MockUtente {
  id: string;
  email: string | null;
  nome_cognome: string | null;
  telefono: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
}

function creaMockDb(initialUtente: MockUtente) {
  let utente = { ...initialUtente };
  let passwordAggiornata: string | null = null;

  const mockDb = {
    auth: {
      async updateUser(attrs: { password?: string }) {
        if (attrs.password === 'trigger_error') {
          return { data: { user: null }, error: new Error('Auth error') };
        }
        if (attrs.password) {
          passwordAggiornata = attrs.password;
        }
        return { data: { user: { id: utente.id } }, error: null };
      },
    },
    from(table: string) {
      if (table === 'utenti') {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, val: string) {
                return {
                  async maybeSingle() {
                    return utente.id === val
                      ? { data: utente, error: null }
                      : { data: null, error: null };
                  },
                };
              },
            };
          },
          update(patch: Partial<MockUtente>) {
            return {
              eq(_col: string, val: string) {
                if (utente.id === val) {
                  utente = { ...utente, ...patch };
                  return Promise.resolve({ data: null, error: null });
                }
                return Promise.resolve({ data: null, error: new Error('User not found') });
              },
            };
          },
        };
      }
      if (table === 'ruoli_piattaforma') {
        return {
          async select(_cols: string) {
            return {
              data: [
                { id: 'r-cond', codice: 'CONDOMINO', nome: 'Condòmino' },
              ],
              error: null,
            };
          },
        };
      }
      if (table === 'utente_entita_ruolo') {
        return {
          select(_cols: string) {
            return {
              async eq(_col: string, _val: string) {
                return {
                  data: [
                    { utente_id: USER_ID, ruolo_id: 'r-cond', condominio_id: 'c-01', unita_id: null },
                  ],
                  error: null,
                };
              },
            };
          },
        };
      }
      if (table === 'condomini') {
        return {
          select(_cols: string) {
            return {
              async eq(_col: string, _val: string) {
                return { data: [], error: null };
              },
              in(_col: string, _ids: string[]) {
                return {
                  async order(_col: string) {
                    return {
                      data: [
                        { id: 'c-01', nome: 'Condominio Test', indirizzo: 'Via Roma 1', citta: 'Roma' },
                      ],
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Table ${table} not implemented in mock`);
    },
    getUtente() {
      return utente;
    },
    getPasswordAggiornata() {
      return passwordAggiornata;
    },
  };

  return mockDb as unknown as TypedSupabaseClient & {
    getUtente: () => MockUtente;
    getPasswordAggiornata: () => string | null;
  };
}

describe('profiloService', () => {
  it('carica: restituisce anagrafica completa con telefono, email e condomini', async () => {
    const mockDb = creaMockDb({
      id: USER_ID,
      email: 'mario.rossi@test.it',
      nome_cognome: 'Mario Rossi',
      telefono: '+39 06 1234567',
      avatar_url: null,
      is_superadmin: false,
    });
    const service = createProfiloService(mockDb);
    const profilo = await service.carica(USER_ID, 'sessione@test.it');

    assert.equal(profilo.id, USER_ID);
    assert.equal(profilo.email, 'mario.rossi@test.it');
    assert.equal(profilo.nome, 'Mario Rossi');
    assert.equal(profilo.telefono, '+39 06 1234567');
    assert.equal(profilo.condomini.length, 1);
    assert.equal(profilo.condomini[0]?.nome, 'Condominio Test');
  });

  it('aggiornaAnagrafica: aggiorna nome_cognome e telefono con trim', async () => {
    const mockDb = creaMockDb({
      id: USER_ID,
      email: 'mario.rossi@test.it',
      nome_cognome: 'Mario Rossi',
      telefono: null,
      avatar_url: null,
      is_superadmin: false,
    });
    const service = createProfiloService(mockDb);

    await service.aggiornaAnagrafica(USER_ID, {
      nome_cognome: '  Mario Bianchi  ',
      telefono: '  +39 333 9988776  ',
    });

    assert.equal(mockDb.getUtente().nome_cognome, 'Mario Bianchi');
    assert.equal(mockDb.getUtente().telefono, '+39 333 9988776');

    // Se telefono è stringa vuota o null diventa null
    await service.aggiornaAnagrafica(USER_ID, {
      nome_cognome: 'Mario Bianchi',
      telefono: '   ',
    });
    assert.equal(mockDb.getUtente().telefono, null);
  });

  it('cambiaPassword: chiama updateUser con successo o rilancia errore', async () => {
    const mockDb = creaMockDb({
      id: USER_ID,
      email: 'mario.rossi@test.it',
      nome_cognome: 'Mario Rossi',
      telefono: null,
      avatar_url: null,
      is_superadmin: false,
    });
    const service = createProfiloService(mockDb);

    await service.cambiaPassword('NuovaPassword123!');
    assert.equal(mockDb.getPasswordAggiornata(), 'NuovaPassword123!');

    await assert.rejects(
      async () => service.cambiaPassword('trigger_error'),
      /Auth error/,
    );
  });
});
