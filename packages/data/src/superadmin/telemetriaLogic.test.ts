import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregaNotifichePerCategoria,
  calcolaKpiTelemetria,
  calcolaPercentualeCategoria,
  calcolaSoglieCapacita,
  classificaCategoriaNotifica,
  normalizzaRispostaTelemetria,
  orePerIntervallo,
} from './telemetriaLogic.ts';

test('orePerIntervallo: converte 24h, 7g, 30g nelle ore corrette', () => {
  assert.equal(orePerIntervallo('24h'), 24);
  assert.equal(orePerIntervallo('7g'), 168);
  assert.equal(orePerIntervallo('30g'), 720);
});

test('classificaCategoriaNotifica e aggregaNotifichePerCategoria: mappa Comunicazioni, Assemblee, Bollettini e Altro', () => {
  assert.equal(classificaCategoriaNotifica('COMUNICAZIONE', 'bacheca_post'), 'Comunicazioni');
  assert.equal(classificaCategoriaNotifica('ASSEMBLEA', null), 'Assemblee');
  assert.equal(classificaCategoriaNotifica(null, 'assemblee'), 'Assemblee');
  assert.equal(classificaCategoriaNotifica('BOLLETTINO_EMESSO', 'bollettini'), 'Bollettini');
  assert.equal(classificaCategoriaNotifica('SCADENZA_RATA', 'rate'), 'Bollettini');
  assert.equal(classificaCategoriaNotifica('invito', null), 'Altro');

  const riepilogo = aggregaNotifichePerCategoria([
    { tipo: 'COMUNICAZIONE', riferimento_tabella: 'bacheca_post' },
    { tipo: 'COMUNICAZIONE', riferimento_tabella: null },
    { tipo: 'ASSEMBLEA', riferimento_tabella: 'assemblee' },
    { tipo: 'BOLLETTINO_EMESSO', riferimento_tabella: 'bollettini' },
    { tipo: 'invito', riferimento_tabella: null },
  ]);

  assert.deepEqual(riepilogo, {
    comunicazioni: 2,
    assemblee: 1,
    bollettini: 1,
    altro: 1,
    totale: 5,
  });
  assert.equal(calcolaPercentualeCategoria(2, 5), 40);
  assert.equal(calcolaPercentualeCategoria(0, 0), 0);
});

test('calcolaSoglieCapacita: valuta correttamente stato ok, attenzione e critico per DB e MAU', () => {
  const ok = calcolaSoglieCapacita({ dbSizeMb: 42, mau30g: 120, piccoScrittureOra: 50 });
  assert.equal(ok.livelloGenerale, 'ok');
  assert.equal(ok.risorse[0]?.livello, 'ok');
  assert.equal(ok.risorse[1]?.livello, 'ok');

  const attenzione = calcolaSoglieCapacita({ dbSizeMb: 360, mau30g: 1000, piccoScrittureOra: 100 });
  assert.equal(attenzione.livelloGenerale, 'attenzione');
  assert.equal(attenzione.risorse[0]?.livello, 'attenzione');
  assert.equal(attenzione.risorse[0]?.percentuale, 72);

  const critico = calcolaSoglieCapacita({ dbSizeMb: 450, mau30g: 46000, piccoScrittureOra: 900 });
  assert.equal(critico.livelloGenerale, 'critico');
  assert.equal(critico.risorse[0]?.livello, 'critico');
  assert.equal(critico.risorse[1]?.livello, 'critico');
  assert.equal(critico.risorse[2]?.livello, 'critico');
});

test('normalizzaRispostaTelemetria e calcolaKpiTelemetria: gestiscono payload RPC completo', () => {
  const data = normalizzaRispostaTelemetria({
    generato_at: '2026-11-15T18:00:00Z',
    ore_richieste: 24,
    serie_oraria: [
      {
        ora_bucket: '2026-11-15T16:00:00Z',
        utenti_attivi: 3,
        get_count: 30,
        insert_count: 5,
        put_patch_count: 5,
        delete_count: 0,
        edge_fn_count: 2,
        errori_count: 0,
      },
      {
        ora_bucket: '2026-11-15T17:00:00Z',
        utenti_attivi: 8,
        get_count: 50,
        insert_count: 6,
        put_patch_count: 4,
        delete_count: 0,
        edge_fn_count: 1,
        errori_count: 1,
      },
    ],
    notifiche: {
      periodo: { comunicazioni: 4, assemblee: 2, bollettini: 6, altro: 0, totale: 12 },
      storico: { comunicazioni: 40, assemblee: 10, bollettini: 50, altro: 5, totale: 105 },
    },
    coda_email: { disponibile: false },
    database: {
      db_size_bytes: 52428800,
      mau_30g: 15,
      utenti_totali: 20,
      condomini_attivi: 3,
      condomini_sospesi: 1,
      righe_tabelle: [{ tabella: 'utenti', righe: 20 }],
    },
  });

  assert.equal(data.database.dbSizeMb, 50);
  const kpi = calcolaKpiTelemetria(data);
  assert.equal(kpi.piccoOrarioUtenti, 8);
  assert.equal(kpi.oraPiccoUtenti, '2026-11-15T17:00:00Z');
  assert.equal(kpi.totaleGet, 80);
  assert.equal(kpi.totaleScritture, 20);
  assert.equal(kpi.rapportoLettureScritture, '4,0 : 1');
  assert.equal(kpi.totaleOperazioni, 103);
  assert.equal(kpi.totaleErrori, 1);
});
