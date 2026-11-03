import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  colonnaDaOrdineSegnalazioni,
  costruisciPercorsoFotoGuasto,
  etichettaAmbitoTicket,
  filtraSegnalazioni,
  filtraTicketVisibiliCondomino,
  filtraTicketVisibiliPortiere,
  filtroTicketCondominoPostgrest,
  filtroTicketPortierePostgrest,
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
  type SegnalazioneRiepilogo,
} from '../segnalazioniLogic.ts';

const U = 'user-1';
const COND_A = 'cond-a';
const COND_B = 'cond-b';
const UNITA_1 = 'unita-1';
const UNITA_2 = 'unita-2';
const TKT = 'ticket-1';

function ticket(over: Partial<SegnalazioneRiepilogo> = {}): SegnalazioneRiepilogo {
  return {
    id: 't1',
    condominioId: COND_A,
    unitaId: UNITA_1,
    unitaInterno: '1',
    segnalatoreId: null,
    categoriaId: null,
    categoriaNome: 'Idraulica',
    titolo: 'Perdita',
    descrizione: null,
    isAreaComune: false,
    etichettaAmbito: 'Unità Int. 1',
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

const iso = (t: Partial<SegnalazioneRiepilogo>) => ({
  condominioId: t.condominioId ?? COND_A,
  segnalatoreId: t.segnalatoreId ?? null,
  unitaId: t.unitaId ?? null,
  isAreaComune: t.isAreaComune ?? false,
});

describe('isolamento condòmino', () => {
  it('vede propri ticket e quelli della propria unità, non di unità altrui né altri condomini', () => {
    const propri = iso({ segnalatoreId: U, unitaId: null, isAreaComune: true });
    const unita = iso({ unitaId: UNITA_1 });
    const altraUnita = iso({ unitaId: UNITA_2 });
    const altroCond = iso({ condominioId: COND_B, segnalatoreId: U, unitaId: UNITA_1 });
    const areaComuneAltrui = iso({ isAreaComune: true });
    assert.equal(ticketVisibileACondomino(propri, U, COND_A, [UNITA_1]), true);
    assert.equal(ticketVisibileACondomino(unita, U, COND_A, [UNITA_1]), true);
    assert.equal(ticketVisibileACondomino(altraUnita, U, COND_A, [UNITA_1]), false);
    assert.equal(ticketVisibileACondomino(altroCond, U, COND_A, [UNITA_1]), false);
    assert.equal(ticketVisibileACondomino(areaComuneAltrui, U, COND_A, [UNITA_1]), false);
    assert.equal(ticketVisibileACondomino(null, U, COND_A, [UNITA_1]), false);
  });

  it('un admin in vista residente senza unità vede solo ciò che ha aperto', () => {
    const elenco = [iso({ unitaId: UNITA_2 }), iso({ segnalatoreId: U }), iso({ isAreaComune: true })];
    assert.equal(filtraTicketVisibiliCondomino(elenco, U, COND_A, []).length, 1);
  });

  it('costruisce il filtro PostgREST', () => {
    assert.equal(filtroTicketCondominoPostgrest(U, []), `segnalatore_id.eq.${U}`);
    assert.equal(
      filtroTicketCondominoPostgrest(U, ['a', 'b']),
      `segnalatore_id.eq.${U},unita_id.in.(a,b)`,
    );
    assert.equal(filtroTicketPortierePostgrest(U), `is_area_comune.eq.true,segnalatore_id.eq.${U}`);
  });
});

describe('isolamento portiere', () => {
  it('vede solo aree comuni (o aperti da lui) del condominio selezionato', () => {
    assert.equal(ticketVisibileAPortiere(iso({ isAreaComune: true }), U, COND_A), true);
    assert.equal(ticketVisibileAPortiere(iso({ segnalatoreId: U }), U, COND_A), true);
    assert.equal(ticketVisibileAPortiere(iso({ unitaId: UNITA_1 }), U, COND_A), false);
    assert.equal(ticketVisibileAPortiere(iso({ condominioId: COND_B, isAreaComune: true }), U, COND_A), false);
    assert.equal(
      filtraTicketVisibiliPortiere([iso({ isAreaComune: true }), iso({ unitaId: UNITA_1 })], U, COND_A).length,
      1,
    );
  });
});

describe('stati, ambito e riepilogo', () => {
  it('mappa stato e ambito', () => {
    assert.equal(statoBadgeDaStatoTicket('LAVORAZIONE'), 'in_lavorazione');
    assert.equal(etichettaAmbitoTicket(true, null), 'Area comune');
    assert.equal(etichettaAmbitoTicket(false, UNITA_1, '2'), 'Unità Int. 2');
    assert.equal(etichettaAmbitoTicket(false, UNITA_1, null), 'Unità propria');
  });

  it('conta per StatCard e opzioni filtro', () => {
    const lista = [
      ticket({ id: 'a', stato: 'APERTO' }),
      ticket({ id: 'b', stato: 'LAVORAZIONE', isAreaComune: true, unitaId: null }),
      ticket({ id: 'c', stato: 'RISOLTO' }),
      ticket({ id: 'd', stato: 'RISOLTO' }),
    ];
    const r = riepilogoSegnalazioni(lista);
    assert.deepEqual(r, { totale: 4, aperte: 1, inLavorazione: 1, risolte: 2, areeComuni: 1, unitaPropria: 3 });
    assert.deepEqual(
      opzioniFiltroStatoSegnalazioni(lista).map((o) => [o.label, o.count]),
      [['Tutti', 4], ['Aperti', 1], ['In lavorazione', 1], ['Risolti', 2]],
    );
  });
});

describe('filtri, ordinamento, paginazione', () => {
  const lista = [
    ticket({ id: 'a', titolo: 'Ascensore fermo', categoriaNome: 'Ascensore', priorita: 'URGENTE', createdAt: '2026-01-03T00:00:00Z' }),
    ticket({ id: 'b', titolo: 'Luce rotta', categoriaNome: 'Elettrica', stato: 'RISOLTO', priorita: 'BASSA', createdAt: '2026-01-01T00:00:00Z' }),
    ticket({ id: 'c', titolo: 'Perdita', stato: 'LAVORAZIONE', priorita: 'ALTA', createdAt: '2026-01-02T00:00:00Z' }),
  ];

  it('filtra per stato e ricerca', () => {
    assert.deepEqual(filtraSegnalazioni(lista, { stato: 'RISOLTO', ricerca: '' }).map((t) => t.id), ['b']);
    assert.deepEqual(filtraSegnalazioni(lista, { stato: 'tutti', ricerca: 'ascens' }).map((t) => t.id), ['a']);
    assert.deepEqual(filtraSegnalazioni(lista, { stato: 'tutti', ricerca: 'elettrica' }).map((t) => t.id), ['b']);
  });

  it('ordina per data, stato e priorità', () => {
    assert.deepEqual(ordinaSegnalazioni(lista, 'data-desc').map((t) => t.id), ['a', 'c', 'b']);
    assert.deepEqual(ordinaSegnalazioni(lista, 'data-asc').map((t) => t.id), ['b', 'c', 'a']);
    assert.deepEqual(ordinaSegnalazioni(lista, 'stato-asc').map((t) => t.id), ['a', 'c', 'b']);
    assert.deepEqual(ordinaSegnalazioni(lista, 'priorita-desc').map((t) => t.id), ['a', 'c', 'b']);
    assert.deepEqual(ordinaSegnalazioni(lista, 'priorita-asc').map((t) => t.id), ['b', 'c', 'a']);
  });

  it('converte ordine da/verso colonna', () => {
    assert.equal(ordineDaColonnaSegnalazioni({ key: 'priorita', direction: 'ascending' }), 'priorita-asc');
    assert.equal(ordineDaColonnaSegnalazioni(null), 'data-desc');
    assert.deepEqual(colonnaDaOrdineSegnalazioni('stato-desc'), { key: 'stato', direction: 'descending' });
  });

  it('pagina e limita la pagina richiesta', () => {
    const molti = Array.from({ length: 25 }, (_, i) => ticket({ id: `x${i}`, createdAt: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00Z` }));
    const p = paginaSegnalazioni(molti, { stato: 'tutti', ricerca: '' }, 'data-desc', 99);
    assert.equal(p.numeroPagine, 3);
    assert.equal(p.pagina, 3);
    assert.equal(p.segnalazioni.length, 5);
  });
});

describe('validazione', () => {
  it('titolo obbligatorio e lunghezza massima', () => {
    const v = validaInputNuovaSegnalazione({ titolo: '  ', isAreaComune: true }, []);
    assert.equal(v.valido, false);
    const lungo = validaInputNuovaSegnalazione({ titolo: 'x'.repeat(121), isAreaComune: true }, []);
    assert.equal(lungo.valido, false);
  });

  it('richiede una propria unità se non area comune', () => {
    assert.equal(validaInputNuovaSegnalazione({ titolo: 'T', isAreaComune: false }, [UNITA_1]).valido, false);
    assert.equal(
      validaInputNuovaSegnalazione({ titolo: 'T', isAreaComune: false, unitaId: UNITA_2 }, [UNITA_1]).valido,
      false,
    );
    const ok = validaInputNuovaSegnalazione({ titolo: ' T ', isAreaComune: false, unitaId: UNITA_1 }, [UNITA_1]);
    assert.ok(ok.valido);
    if (ok.valido) {
      assert.equal(ok.dati.titolo, 'T');
      assert.equal(ok.dati.priorita, 'MEDIA');
    }
  });

  it('il portiere forza area comune e nessuna unità', () => {
    const v = validaInputNuovaSegnalazione({ titolo: 'T', isAreaComune: false, unitaId: UNITA_2 }, [], 'portiere');
    assert.ok(v.valido);
    if (v.valido) {
      assert.equal(v.dati.isAreaComune, true);
      assert.equal(v.dati.unitaId, null);
    }
  });

  it('valida foto: formato e 15 MB', () => {
    assert.equal(validaAllegatiFotoTicket([{ name: 'a.jpg', size: 100, type: 'image/jpeg' }]), null);
    assert.equal(validaAllegatiFotoTicket([{ name: 'a.heic', size: 100, type: 'image/heic' }]), null);
    assert.equal(validaAllegatiFotoTicket([{ name: 'a.webp', size: 100, type: 'image/webp' }]), null);
    assert.ok(validaAllegatiFotoTicket([{ name: 'a.pdf', size: 100, type: 'application/pdf' }]));
    assert.equal(validaAllegatiFotoTicket([{ name: 'a.png', size: 15728640, type: 'image/png' }]), null);
    assert.ok(validaAllegatiFotoTicket([{ name: 'a.png', size: 15728641, type: 'image/png' }]));
    const sei = Array.from({ length: 6 }, () => ({ name: 'a.png', size: 1, type: 'image/png' }));
    assert.ok(validaAllegatiFotoTicket(sei));
  });

  it('valida il messaggio', () => {
    assert.equal(validaMessaggioTicket('  ').valido, false);
    assert.equal(validaMessaggioTicket('x'.repeat(1001)).valido, false);
    assert.deepEqual(validaMessaggioTicket(' ciao '), { valido: true, testo: 'ciao' });
  });
});

describe('percorsi Storage', () => {
  it('sanifica i nomi file', () => {
    assert.equal(sanificaNomeFileFoto('../../etc/passwd.jpg'), 'passwd.jpg');
    assert.equal(sanificaNomeFileFoto('Foto Guasto (1).JPG'), 'Foto_Guasto_1_.JPG');
    assert.equal(sanificaNomeFileFoto('...'), 'foto.jpg');
  });

  it('costruisce percorsi <condominio>/<ticket>/<file> e rifiuta traversal', () => {
    assert.equal(costruisciPercorsoFotoGuasto(COND_A, TKT, 'a b.jpg'), `${COND_A}/${TKT}/a_b.jpg`);
    assert.equal(costruisciPercorsoFotoGuasto(COND_A, '../x', 'a.jpg'), null);
    assert.equal(costruisciPercorsoFotoGuasto('', TKT, 'a.jpg'), null);
  });

  it('valida url_storage', () => {
    assert.equal(validaPercorsoFotoStorage(`${COND_A}/${TKT}/a.jpg`, COND_A), `${COND_A}/${TKT}/a.jpg`);
    assert.equal(validaPercorsoFotoStorage(`foto-guasti/${COND_A}/${TKT}/a.jpg`, COND_A), `${COND_A}/${TKT}/a.jpg`);
    assert.equal(validaPercorsoFotoStorage('seed-dev/guasti/a.jpg', COND_A), 'seed-dev/guasti/a.jpg');
    assert.equal(validaPercorsoFotoStorage(`${COND_B}/${TKT}/a.jpg`, COND_A), null);
    assert.equal(validaPercorsoFotoStorage(`${COND_A}/../${COND_B}/a.jpg`, COND_A), null);
    assert.equal(validaPercorsoFotoStorage('https://x.test/a.jpg', COND_A), null);
    assert.equal(validaPercorsoFotoStorage(`${COND_A}/${TKT}/a.jpg`, COND_A, 'altro'), null);
  });
});

