import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGO_MODULI,
  DEFAULT_MODULI_ATTIVI,
  CHIAVI_NATIVE_DB,
  isModuloNativo,
  infoModulo,
  moduloDiRotta,
  moduloAbilitato,
  type ModuliAttivi,
} from './moduli.ts';
import { createCondominiService } from '../services/condominiService.ts';

test('CATALOGO_MODULI: contiene tutti gli 11 moduli con metadati completi', () => {
  assert.equal(CATALOGO_MODULI.length, 11);
  for (const m of CATALOGO_MODULI) {
    assert.ok(m.chiave, 'ogni modulo ha una chiave');
    assert.ok(m.titolo.length > 0, `titolo valido per ${m.chiave}`);
    assert.ok(m.descrizione.length > 0, `descrizione valida per ${m.chiave}`);
    assert.ok(m.destinatari.length > 0, `destinatari validi per ${m.chiave}`);
    assert.ok(m.rottaResidente.startsWith('/'), `rotta valida per ${m.chiave}`);
    assert.equal(typeof m.richiedeMigrazione11, 'boolean');
  }
});

test('CHIAVI_NATIVE_DB: 6 chiavi native e 5 chiavi estese', () => {
  assert.equal(CHIAVI_NATIVE_DB.size, 6);
  assert.ok(isModuloNativo('abilita_bacheca'));
  assert.ok(isModuloNativo('abilita_chat'));
  assert.ok(isModuloNativo('abilita_ticket'));
  assert.ok(isModuloNativo('abilita_prenotazioni'));
  assert.ok(isModuloNativo('abilita_pacchi'));
  assert.ok(isModuloNativo('abilita_social'));

  assert.ok(!isModuloNativo('abilita_spese'));
  assert.ok(!isModuloNativo('abilita_pagamenti'));
  assert.ok(!isModuloNativo('abilita_documenti'));
  assert.ok(!isModuloNativo('abilita_assemblee'));
  assert.ok(!isModuloNativo('abilita_raccolta_differenziata'));
});

test('DEFAULT_MODULI_ATTIVI: tutti i moduli sono attivi per impostazione predefinita', () => {
  for (const [chiave, valore] of Object.entries(DEFAULT_MODULI_ATTIVI)) {
    assert.equal(valore, true, `default per ${chiave} deve essere true`);
  }
});

test('moduloDiRotta e infoModulo: individuazione rotta residente', () => {
  assert.equal(moduloDiRotta('/prenotazioni')?.chiave, 'abilita_prenotazioni');
  assert.equal(moduloDiRotta('/spese/123')?.chiave, 'abilita_spese');
  assert.equal(moduloDiRotta('/comunicazioni')?.chiave, 'abilita_bacheca');
  assert.equal(moduloDiRotta('/percorso-inesistente'), undefined);

  assert.equal(infoModulo('abilita_pacchi')?.titolo, 'Registro pacchi in portineria');
  assert.equal(infoModulo('abilita_ticket')?.critico, true);
});

test('moduloAbilitato: verifica flag booleano con fallback sicuro', () => {
  const moduli: ModuliAttivi = {
    ...DEFAULT_MODULI_ATTIVI,
    abilita_prenotazioni: false,
  };
  assert.equal(moduloAbilitato(moduli, 'abilita_prenotazioni'), false);
  assert.equal(moduloAbilitato(moduli, 'abilita_bacheca'), true);
});

test('condominiService: graceful degradation e risoluzione override palazzo', async () => {
  const mockRows = [
    // Riga predefinita del condominio (con solo le 6 colonne native)
    {
      id: 'cfg-1',
      condominio_id: 'cond-1',
      palazzo_id: null,
      abilita_social: true,
      abilita_chat: true,
      abilita_bacheca: true,
      abilita_ticket: false, // disattivato nel condominio
      abilita_prenotazioni: true,
      abilita_pacchi: true,
      // colonne estese assenti dal DB
    },
    // Override per palazzo-A: ticket riattivato
    {
      id: 'cfg-2',
      condominio_id: 'cond-1',
      palazzo_id: 'palazzo-A',
      abilita_social: true,
      abilita_chat: true,
      abilita_bacheca: true,
      abilita_ticket: true,
      abilita_prenotazioni: false,
      abilita_pacchi: true,
    },
  ];

  const fakeDb = {
    from(table: string) {
      assert.equal(table, 'configurazioni_condominio');
      return {
        select() {
          return {
            eq(col: string, val: string) {
              assert.equal(col, 'condominio_id');
              assert.equal(val, 'cond-1');
              return Promise.resolve({ data: mockRows, error: null });
            },
          };
        },
      };
    },
  };

  const service = createCondominiService(fakeDb as any);

  // 1. Lettura per tutto il condominio: eredita i valori DB e completa con fallback default true per le colonne estese
  const togglesCondominio = await service.getFeatureToggles('cond-1');
  assert.equal(togglesCondominio.abilita_ticket, false);
  assert.equal(togglesCondominio.abilita_prenotazioni, true);
  assert.equal(togglesCondominio.abilita_spese, true); // colonna DB assente -> fallback true!

  // 2. Lettura per palazzo-A: vince l'override del palazzo
  const togglesPalazzoA = await service.getFeatureToggles('cond-1', 'palazzo-A');
  assert.equal(togglesPalazzoA.abilita_ticket, true);
  assert.equal(togglesPalazzoA.abilita_prenotazioni, false);
  assert.equal(togglesPalazzoA.abilita_documenti, true); // fallback true

  // 3. Lettura per palazzo-B senza override: riceve il default del condominio
  const togglesPalazzoB = await service.getFeatureToggles('cond-1', 'palazzo-B');
  assert.equal(togglesPalazzoB.abilita_ticket, false);
});

test('condominiService.setFeatureToggles: messaggio chiaro in caso di colonna DB mancante', async () => {
  const fakeDb = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                is() {
                  return {
                    maybeSingle: () => Promise.resolve({ data: { id: 'cfg-1' }, error: null }),
                  };
                },
              };
            },
          };
        },
        update() {
          return {
            eq() {
              return {
                select() {
                  return {
                    single: () =>
                      Promise.reject(
                        new Error(
                          "Could not find the 'abilita_spese' column of 'configurazioni_condominio' in the schema cache",
                        ),
                      ),
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const service = createCondominiService(fakeDb as any);
  await assert.rejects(
    () => service.setFeatureToggles('cond-1', null, { abilita_spese: false }),
    /migrazione 11 su Supabase/,
  );
});

test('condominiService.resetPalazzoOverride: elimina correttamente la riga di override del palazzo', async () => {
  let tableChiamata = '';
  let filtriApplicati: Record<string, string> = {};

  const fakeDb = {
    from(table: string) {
      tableChiamata = table;
      return {
        delete() {
          return {
            eq(col1: string, val1: string) {
              filtriApplicati[col1] = val1;
              return {
                eq(col2: string, val2: string) {
                  filtriApplicati[col2] = val2;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const service = createCondominiService(fakeDb as any);
  await service.resetPalazzoOverride('cond-123', 'palazzo-xyz');

  assert.equal(tableChiamata, 'configurazioni_condominio');
  assert.equal(filtriApplicati.condominio_id, 'cond-123');
  assert.equal(filtriApplicati.palazzo_id, 'palazzo-xyz');
});
