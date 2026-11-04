import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assembleaVisibileCondomino,
  badgeStatoAssemblea,
  etichettaModalitaAssemblea,
  etichettaSceltaVoto,
  etichettaStatoAssemblea,
  etichettaTipoAssemblea,
  filtraAssembleeVisibili,
  filtraEOrdinaAssemblee,
  filtriAssembleeAttivi,
  formattaRisultatiVoto,
  isPuntoVotabile,
  isStatoVisibileCondomino,
  opzioniFiltroStatoAssemblee,
  paginaAssemblee,
  riepilogoAssemblee,
  validaLinkVideoCall,
  validaPercorsoVerbaleStorage,
  type AssembleaCondomino,
  type FiltriAssemblee,
  type RisultatoVotoRpc,
} from '../assembleeLogic.ts';

const COND_A = 'd0000000-0000-4000-8000-000000000001';
const COND_B = 'd0000000-0000-4000-8000-000000000002';

function creaAssemblea(dati: Partial<AssembleaCondomino>): AssembleaCondomino {
  return {
    id: dati.id ?? 'ass-01',
    condominioId: dati.condominioId ?? COND_A,
    tabellaMillesimaleId: dati.tabellaMillesimaleId ?? null,
    data: dati.data ?? '2026-05-15T18:00:00Z',
    luogo: dati.luogo ?? 'Sala Condominiale',
    linkMeet: dati.linkMeet ?? null,
    verbaleUrl: dati.verbaleUrl ?? null,
    stato: dati.stato ?? 'CONVOCATA',
    tipo: dati.tipo ?? 'ORDINARIA',
    modalita: dati.modalita ?? 'PRESENZA',
    createdAt: dati.createdAt ?? '2026-04-01T10:00:00Z',
    updatedAt: dati.updatedAt ?? '2026-04-01T10:00:00Z',
    puntiOdg: dati.puntiOdg ?? [],
    totalePuntiOdg: dati.totalePuntiOdg ?? dati.puntiOdg?.length ?? 0,
    votazioniAperte: dati.votazioniAperte ?? 0,
  };
}

describe('assembleeLogic — isolamento e visibilità condòmino', () => {
  it('riconosce gli stati visibili ed esclude tassativamente le BOZZE', () => {
    assert.equal(isStatoVisibileCondomino('CONVOCATA'), true);
    assert.equal(isStatoVisibileCondomino('IN_CORSO'), true);
    assert.equal(isStatoVisibileCondomino('CONCLUSA'), true);
    assert.equal(isStatoVisibileCondomino('ANNULLATA'), true);
    assert.equal(isStatoVisibileCondomino('BOZZA'), false);
    assert.equal(isStatoVisibileCondomino(null), false);
    assert.equal(isStatoVisibileCondomino(undefined), false);
    assert.equal(isStatoVisibileCondomino('ALTRO'), false);
  });

  it('valida visibilità per condominio escludendo le bozze e condomini estranei', () => {
    const valida = creaAssemblea({ stato: 'CONVOCATA', condominioId: COND_A });
    assert.equal(assembleaVisibileCondomino(valida, COND_A), true);

    const bozza = creaAssemblea({ stato: 'BOZZA', condominioId: COND_A });
    assert.equal(assembleaVisibileCondomino(bozza, COND_A), false);

    const altroCondominio = creaAssemblea({ stato: 'CONVOCATA', condominioId: COND_B });
    assert.equal(assembleaVisibileCondomino(altroCondominio, COND_A), false);
  });

  it('filtraAssembleeVisibili restituisce solo le assemblee lecite del condominio', () => {
    const lista = [
      creaAssemblea({ id: '1', stato: 'CONVOCATA', condominioId: COND_A }),
      creaAssemblea({ id: '2', stato: 'BOZZA', condominioId: COND_A }),
      creaAssemblea({ id: '3', stato: 'IN_CORSO', condominioId: COND_A }),
      creaAssemblea({ id: '4', stato: 'CONVOCATA', condominioId: COND_B }),
    ];
    const res = filtraAssembleeVisibili(lista, COND_A);
    assert.deepEqual(
      res.map((a) => a.id),
      ['1', '3'],
    );
  });
});

describe('assembleeLogic — etichette e badge', () => {
  it('restituisce etichette e badge corretti per stato', () => {
    assert.equal(etichettaStatoAssemblea('CONVOCATA'), 'Convocata');
    assert.equal(etichettaStatoAssemblea('IN_CORSO'), 'In corso');
    assert.equal(etichettaStatoAssemblea('CONCLUSA'), 'Conclusa');
    assert.equal(etichettaStatoAssemblea('ANNULLATA'), 'Annullata');
    assert.equal(etichettaStatoAssemblea('BOZZA'), 'Bozza');

    assert.equal(badgeStatoAssemblea('CONVOCATA'), 'convocata');
    assert.equal(badgeStatoAssemblea('IN_CORSO'), 'in-corso');
    assert.equal(badgeStatoAssemblea('CONCLUSA'), 'conclusa');
    assert.equal(badgeStatoAssemblea('ANNULLATA'), 'annullata');
  });

  it('restituisce etichette per tipo, modalità e scelta voto', () => {
    assert.equal(etichettaTipoAssemblea('ORDINARIA'), 'Ordinaria');
    assert.equal(etichettaTipoAssemblea('STRAORDINARIA'), 'Straordinaria');

    assert.equal(etichettaModalitaAssemblea('PRESENZA'), 'In presenza');
    assert.equal(etichettaModalitaAssemblea('ONLINE'), 'Online');
    assert.equal(etichettaModalitaAssemblea('IBRIDA'), 'Ibrida');

    assert.equal(etichettaSceltaVoto('FAVOREVOLE'), 'Favorevole');
    assert.equal(etichettaSceltaVoto('CONTRARIO'), 'Contrario');
    assert.equal(etichettaSceltaVoto('ASTENUTO'), 'Astenuto');
  });
});

describe('assembleeLogic — riepilogo StatCard', () => {
  it('calcola prossima assemblea convocata, assemblee dell anno e votazioni aperte', () => {
    const adesso = '2026-05-01T12:00:00Z';
    const lista: AssembleaCondomino[] = [
      creaAssemblea({
        id: 'passata-anno',
        data: '2026-02-10T18:00:00Z',
        stato: 'CONCLUSA',
      }),
      creaAssemblea({
        id: 'passata-anno-prec',
        data: '2025-11-20T18:00:00Z',
        stato: 'CONCLUSA',
      }),
      creaAssemblea({
        id: 'prossima',
        data: '2026-05-10T18:00:00Z',
        stato: 'CONVOCATA',
      }),
      creaAssemblea({
        id: 'futura-successiva',
        data: '2026-07-01T18:00:00Z',
        stato: 'CONVOCATA',
      }),
      creaAssemblea({
        id: 'in-corso-ora',
        data: '2026-05-01T10:00:00Z',
        stato: 'IN_CORSO',
        votazioniAperte: 2,
        puntiOdg: [
          { id: 'p1', ordine: 1, titoloPunto: 'P1', votazioneAperta: true },
          { id: 'p2', ordine: 2, titoloPunto: 'P2', votazioneAperta: true },
          { id: 'p3', ordine: 3, titoloPunto: 'P3', votazioneAperta: false },
        ],
      }),
      creaAssemblea({
        id: 'bozza-non-visibile',
        data: '2026-05-05T18:00:00Z',
        stato: 'BOZZA',
      }),
    ];

    const riepilogo = riepilogoAssemblee(lista, adesso);
    assert.equal(riepilogo.totaleAnno, 4); // passata-anno, prossima, futura, in-corso (2026)
    assert.equal(riepilogo.votazioniAperte, 2);
    assert.equal(riepilogo.prossimaAssemblea?.id, 'prossima');
    assert.equal(riepilogo.totaleVisibili, 5);
  });

  it('gestisce elenco vuoto senza errori', () => {
    const r = riepilogoAssemblee([], '2026-01-01T00:00:00Z');
    assert.equal(r.prossimaAssemblea, null);
    assert.equal(r.totaleAnno, 0);
    assert.equal(r.votazioniAperte, 0);
    assert.equal(r.totaleVisibili, 0);
  });
});

describe('assembleeLogic — filtri, ricerca, ordinamento e paginazione', () => {
  const lista: AssembleaCondomino[] = [
    creaAssemblea({
      id: 'a1',
      data: '2026-01-10T18:00:00Z',
      stato: 'CONCLUSA',
      tipo: 'ORDINARIA',
      luogo: 'Studio Amministratore',
      puntiOdg: [{ id: 'p1', ordine: 1, titoloPunto: 'Approvazione bilancio', votazioneAperta: false }],
    }),
    creaAssemblea({
      id: 'a2',
      data: '2026-05-15T18:00:00Z',
      stato: 'IN_CORSO',
      tipo: 'STRAORDINARIA',
      luogo: 'Atrio condominiale',
      puntiOdg: [{ id: 'p2', ordine: 1, titoloPunto: 'Lavori facciata', votazioneAperta: true }],
    }),
    creaAssemblea({
      id: 'a3',
      data: '2026-08-20T18:00:00Z',
      stato: 'CONVOCATA',
      tipo: 'ORDINARIA',
      luogo: 'Sala civica',
      puntiOdg: [{ id: 'p3', ordine: 1, titoloPunto: 'Nomina portiere', votazioneAperta: false }],
    }),
  ];

  it('calcola opzioni filtro chip con conteggi corretti', () => {
    const opz = opzioniFiltroStatoAssemblee(lista);
    assert.equal(opz.find((o) => o.value === 'tutte')?.count, 3);
    assert.equal(opz.find((o) => o.value === 'convocate')?.count, 1);
    assert.equal(opz.find((o) => o.value === 'in_corso')?.count, 1);
    assert.equal(opz.find((o) => o.value === 'concluse')?.count, 1);
  });

  it('filtra per stato e per ricerca nel titolo del punto ODG o luogo', () => {
    const filtriTutte: FiltriAssemblee = { stato: 'tutte', ricerca: '' };
    assert.equal(filtriAssembleeAttivi(filtriTutte), false);

    const filtriConvocate: FiltriAssemblee = { stato: 'convocate', ricerca: '' };
    assert.equal(filtriAssembleeAttivi(filtriConvocate), true);
    const convocate = filtraEOrdinaAssemblee(lista, filtriConvocate);
    assert.equal(convocate.length, 1);
    assert.equal(convocate[0]?.id, 'a3');

    // Ricerca per titolo ODG
    const filtriOdg: FiltriAssemblee = { stato: 'tutte', ricerca: 'facciata' };
    const trovatiOdg = filtraEOrdinaAssemblee(lista, filtriOdg);
    assert.equal(trovatiOdg.length, 1);
    assert.equal(trovatiOdg[0]?.id, 'a2');

    // Ricerca per luogo
    const filtriLuogo: FiltriAssemblee = { stato: 'tutte', ricerca: 'civica' };
    const trovatiLuogo = filtraEOrdinaAssemblee(lista, filtriLuogo);
    assert.equal(trovatiLuogo.length, 1);
    assert.equal(trovatiLuogo[0]?.id, 'a3');
  });

  it('ordina per data decrescente e crescente', () => {
    const desc = filtraEOrdinaAssemblee(lista, { stato: 'tutte', ricerca: '' }, 'data-desc');
    assert.deepEqual(
      desc.map((a) => a.id),
      ['a3', 'a2', 'a1'],
    );

    const asc = filtraEOrdinaAssemblee(lista, { stato: 'tutte', ricerca: '' }, 'data-asc');
    assert.deepEqual(
      asc.map((a) => a.id),
      ['a1', 'a2', 'a3'],
    );
  });

  it('pagina correttamente gli elementi', () => {
    const pagina1 = paginaAssemblee(lista, 1, 2);
    assert.equal(pagina1.pagina, 1);
    assert.equal(pagina1.numeroPagine, 2);
    assert.equal(pagina1.totaleFiltrati, 3);
    assert.equal(pagina1.assemblee.length, 2);

    const pagina2 = paginaAssemblee(lista, 2, 2);
    assert.equal(pagina2.pagina, 2);
    assert.equal(pagina2.assemblee.length, 1);

    // Fuori limite
    const clamped = paginaAssemblee(lista, 99, 2);
    assert.equal(clamped.pagina, 2);
  });
});

describe('assembleeLogic — formattazione risultati voto e votabilità', () => {
  it('formattaRisultatiVoto assicura la presenza di tutte le 3 opzioni e totali corretti', () => {
    const rpcRows: RisultatoVotoRpc[] = [
      {
        voto: 'FAVOREVOLE',
        n_voti: 8,
        millesimi: 620.5,
        percentuale_teste: 80.0,
        percentuale_millesimi: 72.5,
      },
      {
        voto: 'CONTRARIO',
        n_voti: 2,
        millesimi: 235.0,
        percentuale_teste: 20.0,
        percentuale_millesimi: 27.5,
      },
    ];

    const res = formattaRisultatiVoto(rpcRows);
    assert.equal(res.haVoti, true);
    assert.equal(res.totaleVoti, 10);
    assert.equal(res.totaleMillesimi, 855.5);

    assert.equal(res.opzioni.length, 3);
    const fav = res.opzioni.find((o) => o.voto === 'FAVOREVOLE');
    assert.equal(fav?.nVoti, 8);
    assert.equal(fav?.percentualeTeste, 80);
    assert.equal(fav?.percentualeMillesimi, 72.5);

    const con = res.opzioni.find((o) => o.voto === 'CONTRARIO');
    assert.equal(con?.nVoti, 2);
    assert.equal(con?.percentualeTeste, 20);

    // Opzione non votata: compare con 0% teste e millesimi
    const ast = res.opzioni.find((o) => o.voto === 'ASTENUTO');
    assert.equal(ast?.nVoti, 0);
    assert.equal(ast?.millesimi, 0);
    assert.equal(ast?.percentualeTeste, 0);
    assert.equal(ast?.percentualeMillesimi, 0);
  });

  it('gestisce risultati vuoti', () => {
    const res = formattaRisultatiVoto([]);
    assert.equal(res.haVoti, false);
    assert.equal(res.totaleVoti, 0);
    assert.equal(res.opzioni.length, 3);
  });

  it('isPuntoVotabile è true solo se votazione_aperta = true E assemblea IN_CORSO', () => {
    assert.equal(isPuntoVotabile({ votazione_aperta: true }, 'IN_CORSO'), true);
    assert.equal(isPuntoVotabile({ votazione_aperta: false }, 'IN_CORSO'), false);
    assert.equal(isPuntoVotabile({ votazione_aperta: true }, 'CONVOCATA'), false);
    assert.equal(isPuntoVotabile({ votazione_aperta: true }, 'CONCLUSA'), false);
    assert.equal(isPuntoVotabile({ votazione_aperta: true }, 'BOZZA'), false);
  });
});

describe('assembleeLogic — validazione link video-call e percorso Storage verbale', () => {
  it('validaLinkVideoCall accetta solo schemi https validi e rifiuta schemi insicuri', () => {
    assert.equal(
      validaLinkVideoCall('https://meet.google.com/abc-defg-hij'),
      'https://meet.google.com/abc-defg-hij',
    );
    assert.equal(
      validaLinkVideoCall('https://zoom.us/j/123456789'),
      'https://zoom.us/j/123456789',
    );

    // Insicuri
    assert.equal(validaLinkVideoCall('http://insecure-call.com'), null);
    assert.equal(validaLinkVideoCall('javascript:alert(1)'), null);
    assert.equal(validaLinkVideoCall('data:text/html,...'), null);
    assert.equal(validaLinkVideoCall(''), null);
    assert.equal(validaLinkVideoCall(null), null);
    assert.equal(validaLinkVideoCall('https://site.com/with<script>'), null);
  });

  it('validaPercorsoVerbaleStorage accetta percorsi del condominio e rifiuta traversal', () => {
    assert.equal(
      validaPercorsoVerbaleStorage(`${COND_A}/verbali/verbale_2026.pdf`, COND_A),
      `${COND_A}/verbali/verbale_2026.pdf`,
    );
    assert.equal(
      validaPercorsoVerbaleStorage(`seed-dev/verbali/verbale_prova.pdf`, COND_A),
      `seed-dev/verbali/verbale_prova.pdf`,
    );

    // Con prefisso bucket
    assert.equal(
      validaPercorsoVerbaleStorage(`documenti-condominio/${COND_A}/verbale.pdf`, COND_A),
      `${COND_A}/verbale.pdf`,
    );

    // Rifiuta path traversal
    assert.equal(validaPercorsoVerbaleStorage(`../segreto.pdf`, COND_A), null);
    assert.equal(validaPercorsoVerbaleStorage(`${COND_A}/../altro/verbale.pdf`, COND_A), null);

    // Rifiuta condominio estraneo
    assert.equal(validaPercorsoVerbaleStorage(`${COND_B}/verbale.pdf`, COND_A), null);

    // Rifiuta barre inverse o slash iniziale
    assert.equal(validaPercorsoVerbaleStorage(`\\${COND_A}\\verbale.pdf`, COND_A), null);
    assert.equal(validaPercorsoVerbaleStorage(`/${COND_A}/verbale.pdf`, COND_A), null);
  });
});

