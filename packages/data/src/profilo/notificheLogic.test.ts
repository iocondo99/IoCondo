import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destinazioneNotifica, ripartisciPerPannello } from './notificheLogic.ts';

const ID = 'd0000000-0000-4000-8000-000000000091';

test('comunicazione: sia il condòmino che l\'admin vanno al dettaglio dell\'oggetto', () => {
  const n = { tipo: 'COMUNICAZIONE', riferimento_tabella: 'bacheca_post', riferimento_id: ID };
  assert.equal(destinazioneNotifica(n, 'RESIDENTE'), `/comunicazioni/${ID}`);
  assert.equal(destinazioneNotifica(n, 'ADMIN'), `/admin/comunicazioni?dettaglioId=${ID}`);
});

test('assemblea senza riferimento porta all\'elenco assemblee', () => {
  const n = { tipo: 'ASSEMBLEA', riferimento_tabella: null, riferimento_id: null };
  assert.equal(destinazioneNotifica(n, 'RESIDENTE'), '/assemblee');
  assert.equal(destinazioneNotifica(n, 'ADMIN'), '/admin/assemblee');
});

test('riferimento non valido o tipo sconosciuto: nessuna destinazione precisa', () => {
  assert.equal(
    destinazioneNotifica({ tipo: 'COMUNICAZIONE', riferimento_tabella: 'bacheca_post', riferimento_id: 'x' }, 'RESIDENTE'),
    '/comunicazioni',
  );
  assert.equal(destinazioneNotifica({ tipo: 'PROVA', riferimento_tabella: null, riferimento_id: null }, 'RESIDENTE'), null);
  assert.equal(destinazioneNotifica({ tipo: 'ASSEMBLEA', riferimento_tabella: null, riferimento_id: null }, 'SUPER_ADMIN'), null);
});

test('il pannello mostra solo le non lette, al massimo 10, e conta le altre', () => {
  const righe = Array.from({ length: 14 }, (_, i) => ({ id: i, letta: false }));
  righe.push({ id: 99, letta: true });
  const { visibili, nascoste } = ripartisciPerPannello(righe);
  assert.equal(visibili.length, 10);
  assert.equal(nascoste, 4);
  assert.ok(visibili.every((r) => !r.letta));
});
