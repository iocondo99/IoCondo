import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  colonnaDaOrdineSegnalazioni,
  costruisciPercorsoFotoGuasto,
  determinaAmbitoTipo,
  etichettaAmbitoTicket,
  filtraSegnalazioni,
  filtraTicketVisibiliCondomino,
  filtraTicketVisibiliPortiere,
  opzioniFiltroAmbitoSegnalazioni,
  opzioniFiltroStatoSegnalazioni,
  ordinaSegnalazioni,
  ordineDaColonnaSegnalazioni,
  paginaSegnalazioni,
  riepilogoSegnalazioni,
  sanificaNomeFileFoto,
  statoBadgeDaStatoTicket,
  ticketVisibileACondomino,
  ticketVisibileAPortiere,
  validaAllegatiFotoTicket,
  validaInputNuovaSegnalazione,
  validaMessaggioTicket,
  validaPercorsoFotoStorage,
  type OpzioneAmbitoTicket,
  type SegnalazioneRiepilogo,
} from '../segnalazioniLogic.ts';

const U = 'user-1';
const COND_A = 'cond-a';
const COND_B = 'cond-b';
const PAL_1 = 'palazzo-1';
const PAL_2 = 'palazzo-2';
const SCALA_A = 'scala-a';
const SCALA_B = 'scala-b';
const TKT = 'ticket-1';

function ticket(over: Partial<SegnalazioneRiepilogo> = {}): SegnalazioneRiepilogo {
  const palId = over.palazzoId ?? null;
  const scaId = over.scalaColonnaId ?? null;
  const ambitoTipo = over.ambitoTipo ?? determinaAmbitoTipo(palId, scaId);
  return {
    id: 't1',
    condominioId: COND_A,
    palazzoId: palId,
    palazzoNome: palId ? 'Palazzo 1' : null,
    scalaColonnaId: scaId,
    scalaNome: scaId ? 'Scala A' : null,
    unitaId: null,
    unitaInterno: null,
    segnalatoreId: null,
    categoriaId: null,
    categoriaNome: 'Idraulica',
    titolo: 'Guasto',
    descrizione: null,
    isAreaComune: true,
    ambitoTipo,
    etichettaAmbito: etichettaAmbitoTicket(
      palId ? 'Palazzo 1' : null,
      scaId ? 'Scala A' : null,
    ),
    priorita: 'MEDIA',
    etichettaPriorita: 'Media',
    stato: 'APERTO',
    etichettaStato: 'Aperto',
    statoBadge: 'aperto',
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
    closedAt: null,
    ...over,
  };
}

describe('isolamento condòmino su ambiti condivisi (Area comune, Palazzo, Scala)', () => {
  it('vede Area comune, proprio Palazzo e propria Scala, ma NON vede altre scale o altri palazzi', () => {
    const areaComune = { condominioId: COND_A, palazzoId: null, scalaColonnaId: null };
    const proprioPalazzo = { condominioId: COND_A, palazzoId: PAL_1, scalaColonnaId: null };
    const altroPalazzo = { condominioId: COND_A, palazzoId: PAL_2, scalaColonnaId: null };
    const propriaScala = { condominioId: COND_A, palazzoId: PAL_1, scalaColonnaId: SCALA_A };
    const altraScala = { condominioId: COND_A, palazzoId: PAL_1, scalaColonnaId: SCALA_B };
    const altroCondominio = { condominioId: COND_B, palazzoId: null, scalaColonnaId: null };

    const palazziUtente = [PAL_1];
    const scaleUtente = [SCALA_A];

    // 1. Area comune visibile a tutti nel condominio
    assert.equal(ticketVisibileACondomino(areaComune, U, COND_A, palazziUtente, scaleUtente), true);
    // 2. Proprio palazzo visibile
    assert.equal(ticketVisibileACondomino(proprioPalazzo, U, COND_A, palazziUtente, scaleUtente), true);
    // 3. Altro palazzo NON visibile
    assert.equal(ticketVisibileACondomino(altroPalazzo, U, COND_A, palazziUtente, scaleUtente), false);
    // 4. Propria scala visibile
    assert.equal(ticketVisibileACondomino(propriaScala, U, COND_A, palazziUtente, scaleUtente), true);
    // 5. Altra scala (Scala B vs Scala A) RIGOROSAMENTE NON VISIBILE
    assert.equal(ticketVisibileACondomino(altraScala, U, COND_A, palazziUtente, scaleUtente), false);
    // 6. Altro condominio non visibile
    assert.equal(ticketVisibileACondomino(altroCondominio, U, COND_A, palazziUtente, scaleUtente), false);
    assert.equal(ticketVisibileACondomino(null, U, COND_A, palazziUtente, scaleUtente), false);
  });

  it('filtra una lista preservando solo i ticket dei propri ambiti', () => {
    const lista = [
      { id: '1', condominioId: COND_A, palazzoId: null, scalaColonnaId: null }, // Area comune -> SI
      { id: '2', condominioId: COND_A, palazzoId: PAL_1, scalaColonnaId: SCALA_A }, // Scala A -> SI
      { id: '3', condominioId: COND_A, palazzoId: PAL_1, scalaColonnaId: SCALA_B }, // Scala B -> NO
      { id: '4', condominioId: COND_A, palazzoId: PAL_2, scalaColonnaId: null }, // Palazzo 2 -> NO
    ];
    const visibili = filtraTicketVisibiliCondomino(lista, U, COND_A, [PAL_1], [SCALA_A]);
    assert.deepEqual(visibili.map((t) => t.id), ['1', '2']);
  });
});

describe('isolamento portiere', () => {
  it('vede tutti i ticket di parti comuni (condominio, palazzi, scale) del condominio attivo', () => {
    assert.equal(ticketVisibileAPortiere({ condominioId: COND_A, palazzoId: null, scalaColonnaId: null }, U, COND_A), true);
    assert.equal(ticketVisibileAPortiere({ condominioId: COND_A, palazzoId: PAL_1, scalaColonnaId: SCALA_A }, U, COND_A), true);
    assert.equal(ticketVisibileAPortiere({ condominioId: COND_A, palazzoId: PAL_1, scalaColonnaId: SCALA_B }, U, COND_A), true);
    assert.equal(ticketVisibileAPortiere({ condominioId: COND_B, palazzoId: null, scalaColonnaId: null }, U, COND_A), false);

    const lista = [
      { id: '1', condominioId: COND_A },
      { id: '2', condominioId: COND_A },
      { id: '3', condominioId: COND_B },
    ];
    assert.equal(filtraTicketVisibiliPortiere(lista, U, COND_A).length, 2);
  });
});

describe('etichette e riepilogo ambiti', () => {
  it('costruisce le etichette per gli ambiti condivisi', () => {
    assert.equal(etichettaAmbitoTicket('Edificio 1', 'A'), 'Palazzo Edificio 1 · Scala A');
    assert.equal(etichettaAmbitoTicket('Edificio 1', null), 'Palazzo Edificio 1');
    assert.equal(etichettaAmbitoTicket(null, 'B'), 'Scala B');
    assert.equal(etichettaAmbitoTicket(null, null), 'Area comune');
  });

  it('conta per StatCard suddivise per ambito', () => {
    const lista = [
      ticket({ id: 'a', stato: 'APERTO', palazzoId: null, scalaColonnaId: null }),
      ticket({ id: 'b', stato: 'LAVORAZIONE', palazzoId: PAL_1, scalaColonnaId: null }),
      ticket({ id: 'c', stato: 'RISOLTO', palazzoId: PAL_1, scalaColonnaId: SCALA_A }),
      ticket({ id: 'd', stato: 'RISOLTO', palazzoId: PAL_1, scalaColonnaId: SCALA_B }),
    ];
    const r = riepilogoSegnalazioni(lista);
    assert.deepEqual(r, {
      totale: 4,
      aperte: 1,
      inLavorazione: 1,
      risolte: 2,
      areeComuni: 1,
      palazzo: 1,
      scala: 2,
      unitaPropria: 0,
    });

    const opzioni = opzioniFiltroAmbitoSegnalazioni(lista);
    assert.deepEqual(
      opzioni.map((o) => [o.value, o.count]),
      [['tutti', 4], ['CONDOMINIO', 1], ['PALAZZO', 1], ['SCALA', 2]],
    );
  });
});

describe('filtri, ordinamento, paginazione', () => {
  const lista = [
    ticket({
      id: 'a',
      titolo: 'Ascensore bloccato',
      palazzoId: PAL_1,
      scalaColonnaId: SCALA_A,
      priorita: 'URGENTE',
      createdAt: '2026-01-03T00:00:00Z',
    }),
    ticket({
      id: 'b',
      titolo: 'Luce androne bruciata',
      palazzoId: PAL_1,
      scalaColonnaId: null,
      stato: 'RISOLTO',
      priorita: 'BASSA',
      createdAt: '2026-01-01T00:00:00Z',
    }),
    ticket({
      id: 'c',
      titolo: 'Cancello carraio rotto',
      palazzoId: null,
      scalaColonnaId: null,
      stato: 'LAVORAZIONE',
      priorita: 'ALTA',
      createdAt: '2026-01-02T00:00:00Z',
    }),
  ];

  it('filtra per stato, ambito e ricerca', () => {
    assert.deepEqual(filtraSegnalazioni(lista, { stato: 'RISOLTO', ricerca: '' }).map((t) => t.id), ['b']);
    assert.deepEqual(filtraSegnalazioni(lista, { stato: 'tutti', ambito: 'SCALA', ricerca: '' }).map((t) => t.id), ['a']);
    assert.deepEqual(filtraSegnalazioni(lista, { stato: 'tutti', ambito: 'CONDOMINIO', ricerca: '' }).map((t) => t.id), ['c']);
    assert.deepEqual(filtraSegnalazioni(lista, { stato: 'tutti', ricerca: 'cancello' }).map((t) => t.id), ['c']);
  });

  it('ordina per data, stato e priorità', () => {
    assert.deepEqual(ordinaSegnalazioni(lista, 'data-desc').map((t) => t.id), ['a', 'c', 'b']);
    assert.deepEqual(ordinaSegnalazioni(lista, 'data-asc').map((t) => t.id), ['b', 'c', 'a']);
    assert.deepEqual(ordinaSegnalazioni(lista, 'priorita-desc').map((t) => t.id), ['a', 'c', 'b']);
  });

  it('pagina correttamente', () => {
    const molti = Array.from({ length: 25 }, (_, i) =>
      ticket({ id: `x${i}`, createdAt: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00Z` }),
    );
    const p = paginaSegnalazioni(molti, { stato: 'tutti', ricerca: '' }, 'data-desc', 99);
    assert.equal(p.numeroPagine, 3);
    assert.equal(p.pagina, 3);
    assert.equal(p.segnalazioni.length, 5);
  });
});

describe('validazione nuova segnalazione su ambiti condivisi', () => {
  const ambitiUtente: OpzioneAmbitoTicket[] = [
    { id: 'condominio', tipo: 'CONDOMINIO', palazzoId: null, scalaColonnaId: null, etichetta: 'Area comune' },
    { id: `palazzo:${PAL_1}`, tipo: 'PALAZZO', palazzoId: PAL_1, scalaColonnaId: null, etichetta: 'Palazzo 1' },
    { id: `scala:${PAL_1}:${SCALA_A}`, tipo: 'SCALA', palazzoId: PAL_1, scalaColonnaId: SCALA_A, etichetta: 'Scala A' },
  ];

  it('accetta Area comune condominiale valida per tutti', () => {
    const res = validaInputNuovaSegnalazione(
      { titolo: 'Citofono rotto', ambitoTipo: 'CONDOMINIO' },
      ambitiUtente,
      'condomino',
    );
    assert.equal(res.valido, true);
    if (res.valido) {
      assert.equal(res.dati.ambitoTipo, 'CONDOMINIO');
      assert.equal(res.dati.palazzoId, null);
      assert.equal(res.dati.scalaColonnaId, null);
      assert.equal(res.dati.unitaId, null);
    }
  });

  it('accetta segnalazione su propria scala o proprio palazzo', () => {
    const resScala = validaInputNuovaSegnalazione(
      { titolo: 'Luce scala fulminata', ambitoTipo: 'SCALA', palazzoId: PAL_1, scalaColonnaId: SCALA_A },
      ambitiUtente,
      'condomino',
    );
    assert.equal(resScala.valido, true);
    if (resScala.valido) {
      assert.equal(resScala.dati.scalaColonnaId, SCALA_A);
      assert.equal(resScala.dati.unitaId, null);
    }
  });

  it('rifiuta segnalazione su una scala a cui il condòmino non appartiene (es. Scala B)', () => {
    const resAltraScala = validaInputNuovaSegnalazione(
      { titolo: 'Guasto altrove', ambitoTipo: 'SCALA', palazzoId: PAL_1, scalaColonnaId: SCALA_B },
      ambitiUtente,
      'condomino',
    );
    assert.equal(resAltraScala.valido, false);
    if (!resAltraScala.valido) {
      assert.ok(resAltraScala.errori.ambito?.includes('non appartiene'));
    }
  });

  it('il portiere può aprire ticket per qualsiasi scala o palazzo', () => {
    const resPortiere = validaInputNuovaSegnalazione(
      { titolo: 'Guasto scala B aperto da portiere', ambitoTipo: 'SCALA', palazzoId: PAL_1, scalaColonnaId: SCALA_B },
      ambitiUtente,
      'portiere',
    );
    assert.equal(resPortiere.valido, true);
  });

  it('valida allegati foto e messaggi', () => {
    assert.equal(validaAllegatiFotoTicket([{ name: 'a.jpg', size: 100, type: 'image/jpeg' }]), null);
    assert.ok(validaAllegatiFotoTicket([{ name: 'a.exe', size: 100, type: 'application/x-msdownload' }]));
    assert.equal(validaMessaggioTicket('  ').valido, false);
    assert.deepEqual(validaMessaggioTicket('aggiornamento'), { valido: true, testo: 'aggiornamento' });
  });
});
