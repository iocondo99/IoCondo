import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { createAssistenzaService } from '../assistenzaService.ts';

const COND_ID = 'c-01';
const ADMIN_ID = 'u-admin-01';

function creaMockDb(options: {
  withAdmin?: boolean;
  withPolizza?: boolean;
  withFornitori?: boolean;
  overrides?: Array<{ id: string; titolo: string; numero: string }>;
} = {}) {
  const { withAdmin = true, withPolizza = true, withFornitori = true } = options;
  let configRow: { id: string; numeri_assistenza: unknown } | null = options.overrides
    ? { id: 'cfg-1', numeri_assistenza: options.overrides }
    : null;

  const mockDb = {
    from(table: string) {
      if (table === 'condomini') {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, val: string) {
                return {
                  async maybeSingle() {
                    if (val === COND_ID) {
                      return {
                        data: {
                          id: COND_ID,
                          admin_id: ADMIN_ID,
                          nome: 'Condominio Parco dei Pini',
                          indirizzo: 'Via Pini 10',
                          citta: 'Milano',
                        },
                        error: null,
                      };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'utenti') {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, val: string) {
                return {
                  async maybeSingle() {
                    if (withAdmin && val === ADMIN_ID) {
                      return {
                        data: {
                          id: ADMIN_ID,
                          nome_cognome: 'Laura Colombo',
                          email: 'laura.colombo@studiocolombo.it',
                          telefono: '+39 02 778899',
                        },
                        error: null,
                      };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'profili_pubblici') {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: string) {
                return {
                  async maybeSingle() {
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'polizze_assicurative') {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: string) {
                return {
                  order(_col: string) {
                    return {
                      async limit(_n: number) {
                        if (withPolizza) {
                          return {
                            data: [
                              {
                                id: 'pol-01',
                                condominio_id: COND_ID,
                                compagnia: 'Allianz Global',
                                numero_polizza: 'POL-AL-2026',
                                premio_annuo: 2400,
                                data_scadenza: '2026-12-31',
                                doc_id: null,
                              },
                            ],
                            error: null,
                          };
                        }
                        return { data: [], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'fornitori') {
        return {
          select(_cols: string) {
            return {
              async order(_col: string) {
                if (withFornitori) {
                  return {
                    data: [
                      {
                        id: 'forn-asc',
                        ragione_sociale: 'Schindler Ascensori S.p.A.',
                        telefono: '+39 02 445566',
                        categoria: 'Ascensore',
                      },
                    ],
                    error: null,
                  };
                }
                return { data: [], error: null };
              },
            };
          },
        };
      }
      if (table === 'configurazioni_condominio') {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: string) {
                return {
                  is(_col2: string, _val2: null) {
                    return {
                      async maybeSingle() {
                        return { data: configRow, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
          update(payload: { numeri_assistenza: unknown }) {
            return {
              async eq(_col: string, _val: string) {
                if (configRow) {
                  configRow = { ...configRow, numeri_assistenza: payload.numeri_assistenza };
                }
                return { error: null };
              },
            };
          },
          async insert(payload: { numeri_assistenza: unknown }) {
            configRow = { id: 'cfg-new', numeri_assistenza: payload.numeri_assistenza };
            return { error: null };
          },
        };
      }
      throw new Error(`Table ${table} not supported in mock`);
    },
  };

  return mockDb as unknown as TypedSupabaseClient;
}

describe('assistenzaService', () => {
  it('caricaDatiAssistenza: carica amministrazione, polizza e numeri di emergenza', async () => {
    const mockDb = creaMockDb({ withAdmin: true, withPolizza: true, withFornitori: true });
    const service = createAssistenzaService(mockDb);

    const dati = await service.caricaDatiAssistenza(COND_ID);
    assert.ok(dati);
    assert.equal(dati.condominioNome, 'Condominio Parco dei Pini');
    assert.equal(dati.amministrazione.amministratore, 'Laura Colombo');
    assert.equal(dati.amministrazione.email, 'laura.colombo@studiocolombo.it');
    assert.equal(dati.amministrazione.telefono, '+39 02 778899');

    assert.ok(dati.polizza);
    assert.equal(dati.polizza.compagnia, 'Allianz Global');
    assert.equal(dati.polizza.numeroPolizza, 'POL-AL-2026');

    // Numeri emergenza contiene il fornitore ascensore
    assert.ok(dati.numeriEmergenza.some((n) => n.numero === '+39 02 445566'));
    // E il numero unico europeo
    assert.ok(dati.numeriEmergenza.some((n) => n.numero === '112'));
  });

  it('caricaDatiAssistenza: fallback pulito se admin o polizza mancano', async () => {
    const mockDb = creaMockDb({ withAdmin: false, withPolizza: false, withFornitori: false });
    const service = createAssistenzaService(mockDb);

    const dati = await service.caricaDatiAssistenza(COND_ID);
    assert.ok(dati);
    assert.equal(dati.amministrazione.amministratore, 'Amministratore di Condominio');
    assert.equal(dati.polizza, null);
    // Include sempre i numeri di default
    assert.ok(dati.numeriEmergenza.some((n) => n.categoria === 'ascensore'));
    assert.ok(dati.numeriEmergenza.some((n) => n.numero === '112'));
  });

  it('caricaDatiAssistenza: restituisce null se il condominio non esiste', async () => {
    const mockDb = creaMockDb();
    const service = createAssistenzaService(mockDb);

    const dati = await service.caricaDatiAssistenza('id-inesistente');
    assert.equal(dati, null);
  });

  it('aggiornaNumeroEmergenza: salva e applica titolo, numero e visibilità personalizzati dall’amministratore', async () => {
    const mockDb = creaMockDb({ withAdmin: true, withPolizza: false, withFornitori: false });
    const service = createAssistenzaService(mockDb);

    const aggiornati = await service.aggiornaNumeroEmergenza(COND_ID, {
      id: 'default-ascensore',
      titolo: 'Ascensori Italia H24',
      numero: '800 555 111',
      visibile: false,
    });

    const asc = aggiornati.find((n) => n.id === 'default-ascensore');
    assert.ok(asc);
    assert.equal(asc.titolo, 'Ascensori Italia H24');
    assert.equal(asc.numero, '800 555 111');
    assert.equal(asc.visibile, false);
  });
});

