import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classificaRichiestaSupabase,
  createTelemetryFetch,
  TelemetryCollector,
  type TelemetryCounters,
} from './telemetry.ts';

test('classificaRichiestaSupabase: classifica GET, POST, PATCH, PUT, DELETE ed Edge Function', () => {
  const base = 'https://xyz.supabase.co';
  assert.equal(classificaRichiestaSupabase(`${base}/rest/v1/condomini?select=*`, 'GET'), 'get');
  assert.equal(classificaRichiestaSupabase(`${base}/rest/v1/condomini`, 'HEAD'), 'get');
  assert.equal(classificaRichiestaSupabase(`${base}/rest/v1/bacheca_post`, 'POST'), 'insert');
  assert.equal(classificaRichiestaSupabase(`${base}/rest/v1/bacheca_post?id=eq.1`, 'PATCH'), 'put_patch');
  assert.equal(classificaRichiestaSupabase(`${base}/rest/v1/utenti?id=eq.1`, 'PUT'), 'put_patch');
  assert.equal(classificaRichiestaSupabase(`${base}/rest/v1/notifiche?id=eq.1`, 'DELETE'), 'delete');
  assert.equal(classificaRichiestaSupabase(`${base}/functions/v1/accoda-email`, 'POST'), 'edge_fn');
  assert.equal(classificaRichiestaSupabase(`${base}/functions/v1/invita-utente`, 'post'), 'edge_fn');
});

test('classificaRichiestaSupabase: esclude registra_telemetria_batch (anti-loop) e endpoint non REST/Functions', () => {
  const base = 'https://xyz.supabase.co';
  assert.equal(
    classificaRichiestaSupabase(`${base}/rest/v1/rpc/registra_telemetria_batch`, 'POST'),
    null,
  );
  assert.equal(
    classificaRichiestaSupabase(`${base}/rest/v1/rpc/REGISTRA_TELEMETRIA_BATCH?foo=bar`, 'POST'),
    null,
  );
  assert.equal(classificaRichiestaSupabase(`${base}/auth/v1/token?grant_type=password`, 'POST'), null);
  assert.equal(classificaRichiestaSupabase(`${base}/storage/v1/object/sign/doc/a.pdf`, 'POST'), null);
});

test('TelemetryCollector: accumula, esegue snapshotAndReset e invia batch su flush', async () => {
  const inviati: TelemetryCounters[] = [];
  const collector = new TelemetryCollector({
    autoStart: false,
    onFlush: async (batch) => {
      inviati.push(batch);
    },
  });

  assert.equal(collector.hasPending(), false);
  collector.record('get');
  collector.record('get');
  collector.record('insert', true);
  collector.record('edge_fn');
  assert.equal(collector.hasPending(), true);

  await collector.flush();
  assert.equal(inviati.length, 1);
  assert.deepEqual(inviati[0], {
    get: 2,
    insert: 1,
    put_patch: 0,
    delete: 0,
    edge_fn: 1,
    errori: 1,
  });
  assert.equal(collector.hasPending(), false);

  // Secondo flush senza nuovi eventi non invia nulla
  await collector.flush();
  assert.equal(inviati.length, 1);
});

test('createTelemetryFetch: traccia status >= 400 come errore e ignora la RPC di telemetria', async () => {
  const collector = new TelemetryCollector({ autoStart: false });
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('fail')) {
      return new Response('err', { status: 500 });
    }
    return new Response('ok', { status: 200 });
  };

  const trackedFetch = createTelemetryFetch(collector, fakeFetch);
  await trackedFetch('https://xyz.supabase.co/rest/v1/utenti', { method: 'GET' });
  await trackedFetch('https://xyz.supabase.co/rest/v1/fail', { method: 'POST' });
  await trackedFetch('https://xyz.supabase.co/rest/v1/rpc/registra_telemetria_batch', { method: 'POST' });

  assert.deepEqual(collector.getSnapshot(), {
    get: 1,
    insert: 1,
    put_patch: 0,
    delete: 0,
    edge_fn: 0,
    errori: 1,
  });
});
