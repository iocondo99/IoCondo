import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calcolaDataInvioStimata,
  calcolaStatisticheInviti,
  calcolaStatoInvito,
  etichettaRuoloInvitoAdmin,
  filtraInviti,
  formattaDataItaliana,
  formattaDataRelativaInvito,
  isEmailValida,
  trasformaInvitoRawInView,
  type InvitoPendenteRaw,
  type RigaInvitoAdminView,
} from './invitiAdminLogic.ts';

test('isEmailValida: valida formati conformi allo standard RFC', () => {
  // Email valide
  assert.equal(isEmailValida('mario.rossi@example.com'), true);
  assert.equal(isEmailValida('condomino+test@sub.dominio.it'), true);
  assert.equal(isEmailValida('admin@iocondo.app'), true);
  assert.equal(isEmailValida('utente_123.test@domain-name.org'), true);

  // Email non valide
  assert.equal(isEmailValida(''), false);
  assert.equal(isEmailValida('   '), false);
  assert.equal(isEmailValida(null as unknown as string), false);
  assert.equal(isEmailValida(undefined as unknown as string), false);
  assert.equal(isEmailValida('senza-chiocciola.it'), false);
  assert.equal(isEmailValida('@senza-utente.it'), false);
  assert.equal(isEmailValida('utente@senza-dominio'), false);
  assert.equal(isEmailValida('mario rossi@example.com'), false);
  assert.equal(isEmailValida('mario@example..com'), false);
  assert.equal(isEmailValida('a'.repeat(250) + '@example.com'), false);
});

test('calcolaStatoInvito: calcola IN_ATTESA, ACCETTATO e SCADUTO', () => {
  const adesso = new Date('2026-11-05T12:00:00Z');

  // Accettato
  assert.equal(
    calcolaStatoInvito(
      { scadenza: '2026-11-08T12:00:00Z', accettatoAt: '2026-11-02T10:00:00Z' },
      adesso,
    ),
    'ACCETTATO',
  );

  // In attesa (scadenza futura, non accettato)
  assert.equal(
    calcolaStatoInvito(
      { scadenza: '2026-11-09T12:00:00Z', accettatoAt: null },
      adesso,
    ),
    'IN_ATTESA',
  );

  // Scaduto (scadenza passata o uguale ad adesso, non accettato)
  assert.equal(
    calcolaStatoInvito(
      { scadenza: '2026-11-04T12:00:00Z', accettatoAt: null },
      adesso,
    ),
    'SCADUTO',
  );
  assert.equal(
    calcolaStatoInvito(
      { scadenza: '2026-11-05T12:00:00Z', accettatoAt: null },
      adesso,
    ),
    'SCADUTO',
  );
});

test('formattaDataRelativaInvito: formatta scadenze relative e accettazioni', () => {
  const adesso = new Date('2026-11-05T12:00:00Z');

  // Accettato
  assert.equal(
    formattaDataRelativaInvito(
      { scadenza: '2026-11-08T12:00:00Z', accettatoAt: '2026-11-02T10:00:00Z' },
      adesso,
    ),
    'Accettato il 02/11/2026',
  );

  // In attesa: tra 4 giorni
  assert.equal(
    formattaDataRelativaInvito(
      { scadenza: '2026-11-09T12:00:00Z', accettatoAt: null },
      adesso,
    ),
    'Scade tra 4 giorni',
  );

  // In attesa: domani
  assert.equal(
    formattaDataRelativaInvito(
      { scadenza: '2026-11-06T12:00:00Z', accettatoAt: null },
      adesso,
    ),
    'Scade domani',
  );

  // In attesa: oggi
  assert.equal(
    formattaDataRelativaInvito(
      { scadenza: '2026-11-05T14:00:00Z', accettatoAt: null },
      adesso,
    ),
    'Scade oggi',
  );

  // Scaduto: ieri
  assert.equal(
    formattaDataRelativaInvito(
      { scadenza: '2026-11-04T11:00:00Z', accettatoAt: null },
      adesso,
    ),
    'Scaduto ieri',
  );

  // Scaduto: 2 giorni fa
  assert.equal(
    formattaDataRelativaInvito(
      { scadenza: '2026-11-03T11:00:00Z', accettatoAt: null },
      adesso,
    ),
    'Scaduto da 2 giorni',
  );
});

test('calcolaDataInvioStimata: calcola 7 giorni prima della scadenza', () => {
  const scadenza = '2026-11-12T10:00:00.000Z';
  const stimata = calcolaDataInvioStimata(scadenza);
  assert.equal(stimata.dataTesto, '05/11/2026');
});

test('etichettaRuoloInvitoAdmin: restituisce etichette corrette con supporto ibrido', () => {
  assert.equal(etichettaRuoloInvitoAdmin('CONDOMINO', false), 'Condòmino');
  assert.equal(etichettaRuoloInvitoAdmin('CONDOMINO', true), 'Condòmino e portiere');
  assert.equal(etichettaRuoloInvitoAdmin('PORTIERE', false), 'Portiere');
  assert.equal(etichettaRuoloInvitoAdmin('ADMIN', false), 'Amministratore');
});

test('trasformaInvitoRawInView: converte riga grezza in vista completa', () => {
  const adesso = new Date('2026-11-05T12:00:00Z');
  const raw: InvitoPendenteRaw = {
    token: 'tok123',
    email: 'mario.rossi@example.com',
    ruolo_proposto: 'CONDOMINO',
    flag_portiere: true,
    condominio_id: 'c1',
    unita_id: 'u1',
    scadenza: '2026-11-09T12:00:00Z',
    accettato_at: null,
    ruoli_piattaforma: { id: 'r1', codice: 'CONDOMINO' },
    unita_immobiliari: {
      id: 'u1',
      interno: '2',
      piano: 1,
      palazzi: { id: 'p1', nome_identificativo: 'Palazzo A' },
    },
  };

  const view = trasformaInvitoRawInView(raw, adesso);
  assert.equal(view.token, 'tok123');
  assert.equal(view.email, 'mario.rossi@example.com');
  assert.equal(view.ruoloCodice, 'CONDOMINO');
  assert.equal(view.flagPortiere, true);
  assert.equal(view.ruoloEtichetta, 'Condòmino e portiere');
  assert.equal(view.unitaEtichetta, 'Palazzo A • Int. 2');
  assert.equal(view.stato, 'IN_ATTESA');
  assert.equal(view.statoBadge, 'in-attesa');
  assert.equal(view.scadenzaRelativa, 'Scade tra 4 giorni');
});

test('filtraInviti: filtra per stato e ricerca libera', () => {
  const inviti: RigaInvitoAdminView[] = [
    {
      token: '1',
      email: 'mario@test.it',
      ruoloCodice: 'CONDOMINO',
      flagPortiere: false,
      ruoloEtichetta: 'Condòmino',
      unitaId: 'u1',
      unitaEtichetta: 'Palazzo A • Int. 2',
      palazzoNome: 'Palazzo A',
      interno: '2',
      dataInvio: '',
      dataInvioTesto: '01/11/2026',
      scadenza: '',
      accettatoAt: null,
      stato: 'IN_ATTESA',
      statoBadge: 'in-attesa',
      scadenzaRelativa: 'Scade tra 3 giorni',
    },
    {
      token: '2',
      email: 'luigi.portiere@test.it',
      ruoloCodice: 'PORTIERE',
      flagPortiere: false,
      ruoloEtichetta: 'Portiere',
      unitaId: null,
      unitaEtichetta: 'Personale condominiale',
      palazzoNome: null,
      interno: null,
      dataInvio: '',
      dataInvioTesto: '28/10/2026',
      scadenza: '',
      accettatoAt: '2026-11-01T10:00:00Z',
      stato: 'ACCETTATO',
      statoBadge: 'accettato',
      scadenzaRelativa: 'Accettato il 01/11/2026',
    },
    {
      token: '3',
      email: 'anna.scaduta@test.it',
      ruoloCodice: 'CONDOMINO',
      flagPortiere: false,
      ruoloEtichetta: 'Condòmino',
      unitaId: 'u2',
      unitaEtichetta: 'Palazzo B • Int. 5',
      palazzoNome: 'Palazzo B',
      interno: '5',
      dataInvio: '',
      dataInvioTesto: '20/10/2026',
      scadenza: '',
      accettatoAt: null,
      stato: 'SCADUTO',
      statoBadge: 'scaduto',
      scadenzaRelativa: 'Scaduto da 5 giorni',
    },
  ];

  // Tutti
  assert.equal(filtraInviti(inviti, { stato: 'tutti', ricerca: '' }).length, 3);

  // Filtro stato
  assert.equal(filtraInviti(inviti, { stato: 'in_attesa', ricerca: '' }).length, 1);
  assert.equal(filtraInviti(inviti, { stato: 'accettati', ricerca: '' }).length, 1);
  assert.equal(filtraInviti(inviti, { stato: 'scaduti', ricerca: '' }).length, 1);

  // Ricerca email
  const perEmail = filtraInviti(inviti, { stato: 'tutti', ricerca: 'portiere' });
  assert.equal(perEmail.length, 1);
  assert.equal(perEmail[0]?.email, 'luigi.portiere@test.it');

  // Ricerca per interno o palazzo
  const perPalazzo = filtraInviti(inviti, { stato: 'tutti', ricerca: 'palazzo b' });
  assert.equal(perPalazzo.length, 1);
  assert.equal(perPalazzo[0]?.token, '3');
});

test('calcolaStatisticheInviti: calcola in attesa, accettati mese e scaduti', () => {
  const adesso = new Date('2026-11-05T12:00:00Z');
  const inviti: RigaInvitoAdminView[] = [
    {
      token: '1',
      email: 'a@test.it',
      ruoloCodice: 'CONDOMINO',
      flagPortiere: false,
      ruoloEtichetta: 'Condòmino',
      unitaId: null,
      unitaEtichetta: '',
      palazzoNome: null,
      interno: null,
      dataInvio: '',
      dataInvioTesto: '',
      scadenza: '',
      accettatoAt: null,
      stato: 'IN_ATTESA',
      statoBadge: 'in-attesa',
      scadenzaRelativa: '',
    },
    {
      token: '2',
      email: 'b@test.it',
      ruoloCodice: 'CONDOMINO',
      flagPortiere: false,
      ruoloEtichetta: 'Condòmino',
      unitaId: null,
      unitaEtichetta: '',
      palazzoNome: null,
      interno: null,
      dataInvio: '',
      dataInvioTesto: '',
      scadenza: '',
      accettatoAt: '2026-11-02T10:00:00Z', // Mese corrente (novembre 2026)
      stato: 'ACCETTATO',
      statoBadge: 'accettato',
      scadenzaRelativa: '',
    },
    {
      token: '3',
      email: 'c@test.it',
      ruoloCodice: 'CONDOMINO',
      flagPortiere: false,
      ruoloEtichetta: 'Condòmino',
      unitaId: null,
      unitaEtichetta: '',
      palazzoNome: null,
      interno: null,
      dataInvio: '',
      dataInvioTesto: '',
      scadenza: '',
      accettatoAt: '2026-10-15T10:00:00Z', // Mese precedente
      stato: 'ACCETTATO',
      statoBadge: 'accettato',
      scadenzaRelativa: '',
    },
    {
      token: '4',
      email: 'd@test.it',
      ruoloCodice: 'CONDOMINO',
      flagPortiere: false,
      ruoloEtichetta: 'Condòmino',
      unitaId: null,
      unitaEtichetta: '',
      palazzoNome: null,
      interno: null,
      dataInvio: '',
      dataInvioTesto: '',
      scadenza: '',
      accettatoAt: null,
      stato: 'SCADUTO',
      statoBadge: 'scaduto',
      scadenzaRelativa: '',
    },
  ];

  const stats = calcolaStatisticheInviti(inviti, adesso);
  assert.equal(stats.inAttesa, 1);
  assert.equal(stats.accettatiMese, 1);
  assert.equal(stats.scaduti, 1);
});

