import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calcolaStatisticheComunicazioni,
  filtraComunicazioni,
  formattaDataItaliana,
  formattaDestinatari,
  formattaEtichettaCommenti,
  ordinaComunicazioni,
  trasformaComunicazioneRawInView,
  troncaTesto,
  validaComunicazione,
  type ComunicazioneAdminRaw,
  type ComunicazioneAdminView,
} from './comunicazioniAdminLogic.ts';

test('validaComunicazione: verifica titolo >= 3 caratteri e corpo >= 10 caratteri', () => {
  // Entrambi vuoti
  const v1 = validaComunicazione('', '');
  assert.equal(v1.valido, false);
  assert.ok(v1.errori.titolo?.includes('titolo'));
  assert.ok(v1.errori.corpo?.includes('testo'));

  // Solo spazi
  const v2 = validaComunicazione('   ', '    ');
  assert.equal(v2.valido, false);
  assert.ok(v2.errori.titolo);
  assert.ok(v2.errori.corpo);

  // Titolo troppo corto (< 3)
  const v3 = validaComunicazione('Ab', 'Corpo del testo valido e lungo.');
  assert.equal(v3.valido, false);
  assert.equal(v3.errori.titolo, 'Il titolo deve contenere almeno 3 caratteri.');
  assert.equal(v3.errori.corpo, undefined);

  // Corpo troppo corto (< 10)
  const v4 = validaComunicazione('Titolo valido', 'Corto');
  assert.equal(v4.valido, false);
  assert.equal(v4.errori.titolo, undefined);
  assert.equal(v4.errori.corpo, 'Il testo deve contenere almeno 10 caratteri.');

  // Dati validi ai limiti minimi
  const v5 = validaComunicazione('123', '1234567890');
  assert.equal(v5.valido, true);
  assert.deepEqual(v5.errori, {});

  // Dati ampiamente validi
  const v6 = validaComunicazione('Riparazione cancello', 'Lunedì mattina la ditta incaricata effettuerà la manutenzione.');
  assert.equal(v6.valido, true);
  assert.deepEqual(v6.errori, {});
});

test('ordinaComunicazioni: prioritizza isPinned = true e poi dataPubblicazione decrescente', () => {
  const items = [
    { id: '1', isPinned: false, dataPubblicazione: '2026-11-01T10:00:00Z' },
    { id: '2', isPinned: true,  dataPubblicazione: '2026-10-15T10:00:00Z' },
    { id: '3', isPinned: false, dataPubblicazione: '2026-11-04T12:00:00Z' },
    { id: '4', isPinned: true,  dataPubblicazione: '2026-11-03T09:00:00Z' },
  ];

  const ordinati = ordinaComunicazioni(items);

  // Le prime due devono essere quelle con isPinned = true, ordinate per data decrescente
  assert.equal(ordinati[0].id, '4'); // 3 nov (pinned)
  assert.equal(ordinati[1].id, '2'); // 15 ott (pinned)
  // Poi le non-pinned, ordinate per data decrescente
  assert.equal(ordinati[2].id, '3'); // 4 nov
  assert.equal(ordinati[3].id, '1'); // 1 nov
});

test('filtraComunicazioni: filtra correttamente per stato, palazzo e ricerca testuale', () => {
  const sampleItems: ComunicazioneAdminView[] = [
    {
      id: 'c1',
      condominioId: 'cond1',
      palazzoId: null,
      palazzoNome: null,
      destinatariEtichetta: 'Intero condominio',
      autoreId: 'admin1',
      titolo: 'Regole per la raccolta differenziata',
      corpo: 'Si ricorda di posizionare i sacchi trasparenti nei bidoni appositi.',
      corpoPreview: 'Si ricorda di posizionare...',
      isPinned: true,
      dataPubblicazione: '2026-11-01T08:00:00Z',
      dataPubblicazioneFormattata: '1 nov 2026',
      conteggioCommenti: 2,
      etichettaCommenti: '2 commenti',
    },
    {
      id: 'c2',
      condominioId: 'cond1',
      palazzoId: 'palA',
      palazzoNome: 'Palazzo A',
      destinatariEtichetta: 'Palazzo A',
      autoreId: 'admin1',
      titolo: 'Pulizia androne Palazzo A',
      corpo: 'I lavori di pulizia straordinaria si terranno mercoledì.',
      corpoPreview: 'I lavori di pulizia...',
      isPinned: false,
      dataPubblicazione: '2026-11-03T10:00:00Z',
      dataPubblicazioneFormattata: '3 nov 2026',
      conteggioCommenti: 0,
      etichettaCommenti: '0 commenti',
    },
    {
      id: 'c3',
      condominioId: 'cond1',
      palazzoId: 'palB',
      palazzoNome: 'Palazzo B',
      destinatariEtichetta: 'Palazzo B',
      autoreId: 'admin1',
      titolo: 'Verifica citofoni Palazzo B',
      corpo: 'Si prega di verificare il corretto funzionamento del campanello.',
      corpoPreview: 'Si prega di verificare...',
      isPinned: false,
      dataPubblicazione: '2026-11-04T15:00:00Z',
      dataPubblicazioneFormattata: '4 nov 2026',
      conteggioCommenti: 1,
      etichettaCommenti: '1 commento',
    },
  ];

  // Filtro stato: tutte
  assert.equal(filtraComunicazioni(sampleItems, { stato: 'tutte' }).length, 3);

  // Filtro stato: in_evidenza
  const inEvidenza = filtraComunicazioni(sampleItems, { stato: 'in_evidenza' });
  assert.equal(inEvidenza.length, 1);
  assert.equal(inEvidenza[0].id, 'c1');

  // Filtro stato: con_commenti
  const conCommenti = filtraComunicazioni(sampleItems, { stato: 'con_commenti' });
  assert.equal(conCommenti.length, 2);
  assert.deepEqual(conCommenti.map((c) => c.id), ['c1', 'c3']);

  // Filtro palazzo: palA
  const palA = filtraComunicazioni(sampleItems, { stato: 'tutte', palazzoId: 'palA' });
  assert.equal(palA.length, 1);
  assert.equal(palA[0].id, 'c2');

  // Filtro ricerca: titolo 'citofoni'
  const ricercaTitolo = filtraComunicazioni(sampleItems, { stato: 'tutte', ricerca: 'citofoni' });
  assert.equal(ricercaTitolo.length, 1);
  assert.equal(ricercaTitolo[0].id, 'c3');

  // Filtro ricerca: corpo 'trasparenti'
  const ricercaCorpo = filtraComunicazioni(sampleItems, { stato: 'tutte', ricerca: 'trasparenti' });
  assert.equal(ricercaCorpo.length, 1);
  assert.equal(ricercaCorpo[0].id, 'c1');

  // Ricerca senza corrispondenze
  const nonTrovato = filtraComunicazioni(sampleItems, { stato: 'tutte', ricerca: 'parolaInesistente' });
  assert.equal(nonTrovato.length, 0);

  // Combinazione: palA con ricerca 'pulizia'
  const combinato = filtraComunicazioni(sampleItems, { stato: 'tutte', palazzoId: 'palA', ricerca: 'pulizia' });
  assert.equal(combinato.length, 1);
  assert.equal(combinato[0].id, 'c2');
});

test('calcolaStatisticheComunicazioni: calcola totale, in evidenza e totale commenti', () => {
  const items = [
    { isPinned: true,  conteggioCommenti: 3 },
    { isPinned: false, conteggioCommenti: 0 },
    { isPinned: true,  conteggioCommenti: 2 },
    { isPinned: false, conteggioCommenti: 5 },
  ];

  const stats = calcolaStatisticheComunicazioni(items);
  assert.equal(stats.totaleAttive, 4);
  assert.equal(stats.inEvidenza, 2);
  assert.equal(stats.totaleCommenti, 10);
});

test('formatters e trasformazione raw: formatta correttamente i campi', () => {
  assert.equal(formattaEtichettaCommenti(0), '0 commenti');
  assert.equal(formattaEtichettaCommenti(1), '1 commento');
  assert.equal(formattaEtichettaCommenti(5), '5 commenti');

  assert.equal(formattaDestinatari(null), 'Intero condominio');
  assert.equal(formattaDestinatari(''), 'Intero condominio');
  assert.equal(formattaDestinatari('  '), 'Intero condominio');
  assert.equal(formattaDestinatari('Palazzo Nord'), 'Palazzo Nord');

  assert.equal(troncaTesto('Testo breve', 20), 'Testo breve');
  assert.equal(troncaTesto('Questo è un testo molto lungo che deve essere tagliato', 15), 'Questo è un…');

  const raw: ComunicazioneAdminRaw = {
    id: '123',
    condominio_id: 'cond-1',
    palazzo_id: 'pal-1',
    autore_id: 'aut-1',
    titolo: 'Avviso assemblea',
    corpo: 'Descrizione completa della riunione annuale.',
    is_pinned: true,
    data_pubblicazione: '2026-11-05T12:00:00Z',
    palazzi: {
      id: 'pal-1',
      nome_identificativo: 'Palazzo A',
    },
    bacheca_commenti: [{ id: 'comm-1' }, { id: 'comm-2' }],
  };

  const view = trasformaComunicazioneRawInView(raw);
  assert.equal(view.id, '123');
  assert.equal(view.palazzoNome, 'Palazzo A');
  assert.equal(view.destinatariEtichetta, 'Palazzo A');
  assert.equal(view.isPinned, true);
  assert.equal(view.conteggioCommenti, 2);
  assert.equal(view.etichettaCommenti, '2 commenti');
  assert.equal(formattaDataItaliana(view.dataPubblicazione), '5 nov 2026');
});

