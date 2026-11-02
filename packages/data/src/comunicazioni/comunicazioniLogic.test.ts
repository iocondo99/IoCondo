import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OPZIONI_STATO_COMUNICAZIONI,
  PER_PAGINA_COMUNICAZIONI,
  colonnaDaOrdineComunicazioni,
  comunicazioneVisibileA,
  etichettaAutore,
  etichettaRigaComunicazione,
  etichettaStatoLettura,
  filtraComunicazioniPerRicerca,
  filtraComunicazioniPerStato,
  filtriComunicazioniAttivi,
  limitaPaginaComunicazioni,
  mappaStatoLettura,
  numeroPagineComunicazioni,
  ordinaComunicazioni,
  ordineComunicazioniDaColonna,
  paginaComunicazioni,
  sottotitoloComunicazioni,
  statoLetturaDaNotifiche,
  type ComunicazioneRiga,
} from './comunicazioniLogic.ts';

const ESEMPIO: readonly ComunicazioneRiga[] = [
  {
    id: 'c1',
    titolo: 'Convocazione assemblea ordinaria',
    corpo: 'Assemblea in sala condominiale.',
    dataPubblicazione: '2026-10-30T10:00:00Z',
    fissato: false,
    autoreNome: 'Marco Bianchi',
    statoLettura: 'non-letta',
  },
  {
    id: 'c2',
    titolo: 'Manutenzione ascensore',
    corpo: 'Ascensore fermo.',
    dataPubblicazione: '2026-10-25T09:00:00Z',
    fissato: false,
    autoreNome: 'Marco Bianchi',
    statoLettura: 'letta',
  },
  {
    id: 'c3',
    titolo: 'Regolamento raccolta differenziata',
    corpo: 'Nuovi giorni di ritiro.',
    dataPubblicazione: '2026-10-10T08:00:00Z',
    fissato: true,
    autoreNome: null,
    statoLettura: 'nessuna',
  },
  {
    id: 'c4',
    titolo: 'Chiusura acqua per lavori',
    corpo: 'Dalle 9 alle 12.',
    dataPubblicazione: '2026-11-01T14:00:00Z',
    fissato: true,
    autoreNome: 'Marco Bianchi',
    statoLettura: 'non-letta',
  },
];

test('statoLetturaDaNotifiche: non inventa "letta" quando non ci sono notifiche', () => {
  assert.equal(statoLetturaDaNotifiche([]), 'nessuna');
  assert.equal(statoLetturaDaNotifiche([{ letta: false }]), 'non-letta');
  assert.equal(statoLetturaDaNotifiche([{ letta: true }, { letta: false }]), 'non-letta');
  assert.equal(statoLetturaDaNotifiche([{ letta: true }]), 'letta');
  assert.equal(statoLetturaDaNotifiche([{ letta: true }, { letta: true }]), 'letta');
});

test('mappaStatoLettura: raggruppa per riferimento_id e ignora righe senza id', () => {
  const m = mappaStatoLettura([
    { riferimento_id: 'p1', letta: true },
    { riferimento_id: 'p1', letta: false },
    { riferimento_id: 'p2', letta: true },
    { riferimento_id: null, letta: false },
    { riferimento_id: '   ', letta: false },
  ]);
  assert.equal(m.get('p1'), 'non-letta');
  assert.equal(m.get('p2'), 'letta');
  assert.equal(m.get('p3'), undefined);
});

test('comunicazioneVisibileA: condominio selezionato, palazzo dell’utente o generale, non futura', () => {
  const adesso = '2026-11-02T12:00:00Z';
  assert.equal(
    comunicazioneVisibileA(
      { condominio_id: 'cond-1', palazzo_id: null, data_pubblicazione: '2026-11-01T10:00:00Z' },
      'cond-1',
      ['pal-a'],
      adesso,
    ),
    true,
  );
  assert.equal(
    comunicazioneVisibileA(
      { condominio_id: 'cond-1', palazzo_id: 'pal-a', data_pubblicazione: '2026-11-01T10:00:00Z' },
      'cond-1',
      ['pal-a'],
      adesso,
    ),
    true,
  );
  // Altro palazzo dello stesso condominio -> false
  assert.equal(
    comunicazioneVisibileA(
      { condominio_id: 'cond-1', palazzo_id: 'pal-b', data_pubblicazione: '2026-11-01T10:00:00Z' },
      'cond-1',
      ['pal-a'],
      adesso,
    ),
    false,
  );
  // Altro condominio -> false
  assert.equal(
    comunicazioneVisibileA(
      { condominio_id: 'cond-2', palazzo_id: null, data_pubblicazione: '2026-11-01T10:00:00Z' },
      'cond-1',
      ['pal-a'],
      adesso,
    ),
    false,
  );
  // Data futura -> false
  assert.equal(
    comunicazioneVisibileA(
      { condominio_id: 'cond-1', palazzo_id: null, data_pubblicazione: '2026-11-05T10:00:00Z' },
      'cond-1',
      ['pal-a'],
      adesso,
    ),
    false,
  );
});

test('filtraComunicazioniPerStato: tutti, non-lette, lette (esclude stato "nessuna" da lette e non-lette)', () => {
  assert.equal(filtraComunicazioniPerStato(ESEMPIO, 'tutti').length, 4);
  assert.deepEqual(
    filtraComunicazioniPerStato(ESEMPIO, 'non-lette').map((c) => c.id),
    ['c1', 'c4'],
  );
  assert.deepEqual(
    filtraComunicazioniPerStato(ESEMPIO, 'lette').map((c) => c.id),
    ['c2'],
  );
});

test('filtraComunicazioniPerRicerca e filtriComunicazioniAttivi', () => {
  assert.equal(filtraComunicazioniPerRicerca(ESEMPIO, '   ').length, 4);
  assert.deepEqual(
    filtraComunicazioniPerRicerca(ESEMPIO, 'ASCENSORE').map((c) => c.id),
    ['c2'],
  );
  assert.equal(filtriComunicazioniAttivi({ stato: 'tutti', ricerca: '' }), 0);
  assert.equal(filtriComunicazioniAttivi({ stato: 'non-lette', ricerca: '' }), 1);
  assert.equal(filtriComunicazioniAttivi({ stato: 'lette', ricerca: 'acqua' }), 2);
});

test('ordineComunicazioniDaColonna e colonnaDaOrdineComunicazioni', () => {
  assert.equal(ordineComunicazioniDaColonna(null), 'predefinito');
  assert.equal(ordineComunicazioniDaColonna({ key: 'altro', direction: 'ascending' }), 'predefinito');
  assert.equal(ordineComunicazioniDaColonna({ key: 'data', direction: 'ascending' }), 'data-asc');
  assert.equal(ordineComunicazioniDaColonna({ key: 'data', direction: 'descending' }), 'data-desc');

  assert.equal(colonnaDaOrdineComunicazioni('predefinito'), null);
  assert.deepEqual(colonnaDaOrdineComunicazioni('data-asc'), { key: 'data', direction: 'ascending' });
  assert.deepEqual(colonnaDaOrdineComunicazioni('data-desc'), { key: 'data', direction: 'descending' });
});

test('ordinaComunicazioni: post fissati sempre in cima, poi per data (recenti prima o vecchi prima)', () => {
  const predefinito = ordinaComunicazioni(ESEMPIO, 'predefinito').map((c) => c.id);
  // Fissati: c4 (1 nov) poi c3 (10 ott); non fissati: c1 (30 ott) poi c2 (25 ott)
  assert.deepEqual(predefinito, ['c4', 'c3', 'c1', 'c2']);

  const decrescente = ordinaComunicazioni(ESEMPIO, 'data-desc').map((c) => c.id);
  assert.deepEqual(decrescente, ['c4', 'c3', 'c1', 'c2']);

  const crescente = ordinaComunicazioni(ESEMPIO, 'data-asc').map((c) => c.id);
  // Fissati: c3 (10 ott) poi c4 (1 nov); non fissati: c2 (25 ott) poi c1 (30 ott)
  assert.deepEqual(crescente, ['c3', 'c4', 'c2', 'c1']);
});

test('paginaComunicazioni: combina filtri, ordine e paginazione con clamp sicuro', () => {
  assert.equal(numeroPagineComunicazioni(0, 10), 1);
  assert.equal(numeroPagineComunicazioni(13, 10), 2);
  assert.equal(limitaPaginaComunicazioni(99, 2), 2);
  assert.equal(limitaPaginaComunicazioni(0, 2), 1);

  const p1 = paginaComunicazioni(ESEMPIO, { stato: 'tutti', ricerca: '' }, 'predefinito', 1, 2);
  assert.equal(p1.totaleFiltrati, 4);
  assert.equal(p1.numeroPagine, 2);
  assert.equal(p1.pagina, 1);
  assert.deepEqual(
    p1.comunicazioni.map((c) => c.id),
    ['c4', 'c3'],
  );

  const p2 = paginaComunicazioni(ESEMPIO, { stato: 'tutti', ricerca: '' }, 'predefinito', 2, 2);
  assert.deepEqual(
    p2.comunicazioni.map((c) => c.id),
    ['c1', 'c2'],
  );
});

test('testi per la UI: sottotitolo, autore, stato lettura, etichetta accessibile e opzioni', () => {
  assert.equal(OPZIONI_STATO_COMUNICAZIONI.length, 2);
  assert.equal(PER_PAGINA_COMUNICAZIONI, 10);
  assert.equal(sottotitoloComunicazioni('Condominio Primavera'), 'Condominio Primavera — avvisi e comunicazioni');
  assert.equal(sottotitoloComunicazioni(null), 'Avvisi e comunicazioni del condominio.');
  assert.equal(etichettaAutore('Marco Bianchi'), 'Marco Bianchi');
  assert.equal(etichettaAutore('  '), '—');
  assert.equal(etichettaAutore(null), '—');
  assert.equal(etichettaStatoLettura('non-letta'), 'Non letto');
  assert.equal(etichettaStatoLettura('letta'), 'Letta');
  assert.equal(etichettaStatoLettura('nessuna'), '—');
  assert.equal(
    etichettaRigaComunicazione(ESEMPIO[3]!, '1 nov 2026'),
    'Chiusura acqua per lavori, Fissata in alto, pubblicata il 1 nov 2026, autore Marco Bianchi, Non letto',
  );
});

