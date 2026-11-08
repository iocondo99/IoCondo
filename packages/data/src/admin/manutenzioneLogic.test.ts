import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calcolaStatisticheManutenzione,
  filtraFornitori,
  filtraTicket,
  formattaDataItaliana,
  formattaEuro,
  generaUrlMagicLink,
  mappaBadgePriorita,
  mappaBadgeStato,
  trasformaTicketRawInView,
  validaAssegnazioneFornitore,
  validaChiusuraTicket,
  validaNuovoFornitore,
  validaNuovoTicket,
  type FornitoreAdminView,
  type TicketAdminRaw,
  type TicketAdminView,
} from './manutenzioneLogic';

test('mappaBadgePriorita: mappa correttamente i livelli di priorità', () => {
  assert.deepEqual(mappaBadgePriorita('URGENTE'), { label: 'Urgente', status: 'error' });
  assert.deepEqual(mappaBadgePriorita('ALTA'), { label: 'Alta', status: 'warning' });
  assert.deepEqual(mappaBadgePriorita('MEDIA'), { label: 'Media', status: 'info' });
  assert.deepEqual(mappaBadgePriorita('BASSA'), { label: 'Bassa', status: 'neutral' });
});

test('mappaBadgeStato: mappa correttamente gli stati dei ticket', () => {
  assert.deepEqual(mappaBadgeStato('APERTO'), { label: 'Aperto', status: 'aperto' });
  assert.deepEqual(mappaBadgeStato('LAVORAZIONE'), { label: 'In lavorazione', status: 'in-lavorazione' });
  assert.deepEqual(mappaBadgeStato('RISOLTO'), { label: 'Risolto', status: 'risolto' });
});

test('generaUrlMagicLink: produce link corretto con o senza baseUrl', () => {
  const token = 'abc123token';
  assert.equal(generaUrlMagicLink(token), '/fornitore/abc123token');
  assert.equal(
    generaUrlMagicLink(token, 'https://app.iocondo.it'),
    'https://app.iocondo.it/fornitore/abc123token',
  );
  assert.equal(
    generaUrlMagicLink(token, 'https://app.iocondo.it/'),
    'https://app.iocondo.it/fornitore/abc123token',
  );
  assert.equal(generaUrlMagicLink(''), '');
});

test('formattaDataItaliana e formattaEuro: formattano date e valute secondo convenzione italiana', () => {
  assert.equal(formattaDataItaliana('2026-11-05T10:00:00Z'), '5 nov 2026');
  assert.equal(formattaDataItaliana(null), '—');
  assert.equal(formattaEuro(240), '€ 240,00');
  assert.equal(formattaEuro(null), '—');
});

test('validaNuovoTicket: controlla titolo e ubicazione', () => {
  // Vuoto
  const r1 = validaNuovoTicket({});
  assert.equal(r1.valido, false);
  assert.ok(r1.errori.titolo);
  assert.ok(r1.errori.unitaId);

  // Titolo troppo breve (<3)
  const r2 = validaNuovoTicket({ titolo: 'No', isAreaComune: true });
  assert.equal(r2.valido, false);
  assert.ok(r2.errori.titolo);

  // Area comune valida
  const r3 = validaNuovoTicket({ titolo: 'Perdita acqua', isAreaComune: true });
  assert.equal(r3.valido, true);
  assert.deepEqual(r3.errori, {});

  // Unità privata valida
  const r4 = validaNuovoTicket({ titolo: 'Guasto citofono', isAreaComune: false, unitaId: 'u1' });
  assert.equal(r4.valido, true);
  assert.deepEqual(r4.errori, {});
});

test('validaNuovoFornitore: controlla ragione sociale ed email facoltativa', () => {
  const r1 = validaNuovoFornitore({});
  assert.equal(r1.valido, false);
  assert.ok(r1.errori.ragioneSociale);

  const r2 = validaNuovoFornitore({ ragioneSociale: 'A', email: 'email_invalida' });
  assert.equal(r2.valido, false);
  assert.ok(r2.errori.ragioneSociale);
  assert.ok(r2.errori.email);

  const r3 = validaNuovoFornitore({
    ragioneSociale: 'ClimaTerm Srl',
    email: 'info@climaterm.it',
  });
  assert.equal(r3.valido, true);
  assert.deepEqual(r3.errori, {});
});

test('validaAssegnazioneFornitore: verifica fornitore obbligatorio', () => {
  const r1 = validaAssegnazioneFornitore({});
  assert.equal(r1.valido, false);
  assert.ok(r1.errori.fornitoreId);

  const r2 = validaAssegnazioneFornitore({ fornitoreId: 'forn-1' });
  assert.equal(r2.valido, true);
  assert.deepEqual(r2.errori, {});
});

test('validaChiusuraTicket: verifica consuntivo numerico valido o vuoto', () => {
  const r1 = validaChiusuraTicket({});
  assert.equal(r1.valido, true);
  assert.equal(r1.importoNumerico, null);

  const r2 = validaChiusuraTicket({ importoConsuntivo: '125,50' });
  assert.equal(r2.valido, true);
  assert.equal(r2.importoNumerico, 125.5);

  const r3 = validaChiusuraTicket({ importoConsuntivo: '-10' });
  assert.equal(r3.valido, false);
  assert.ok(r3.errori.importoConsuntivo);
});

test('calcolaStatisticheManutenzione: conteggia aperti, lavorazione e fornitori', () => {
  const dummyTickets: TicketAdminView[] = [
    {
      id: '1',
      condominio_id: 'c1',
      unita_id: null,
      unita_descrizione: null,
      segnalatore_id: null,
      segnalatore_nome: null,
      categoria_id: null,
      categoria_nome: 'Idraulico',
      titolo: 'Guasto 1',
      descrizione: null,
      is_area_comune: true,
      ubicazione_label: 'Area comune',
      priorita: 'URGENTE',
      stato: 'APERTO',
      created_at: '2026-11-05T10:00:00Z',
      created_at_formattata: '5 nov 2026',
      closed_at: null,
      closed_at_formattato: '—',
      fornitore_assegnato_id: null,
      fornitore_assegnato_nome: 'Non assegnato',
      data_intervento_prevista: null,
      data_intervento_formattata: null,
      ultimo_intervento: null,
      interventi: [],
      allegati: [],
      messaggi: [],
    },
    {
      id: '2',
      condominio_id: 'c1',
      unita_id: null,
      unita_descrizione: null,
      segnalatore_id: null,
      segnalatore_nome: null,
      categoria_id: null,
      categoria_nome: 'Elettrico',
      titolo: 'Guasto 2',
      descrizione: null,
      is_area_comune: true,
      ubicazione_label: 'Area comune',
      priorita: 'ALTA',
      stato: 'LAVORAZIONE',
      created_at: '2026-11-05T10:00:00Z',
      created_at_formattata: '5 nov 2026',
      closed_at: null,
      closed_at_formattato: '—',
      fornitore_assegnato_id: 'f1',
      fornitore_assegnato_nome: 'Volta Impianti',
      data_intervento_prevista: null,
      data_intervento_formattata: null,
      ultimo_intervento: null,
      interventi: [],
      allegati: [],
      messaggi: [],
    },
    {
      id: '3',
      condominio_id: 'c1',
      unita_id: null,
      unita_descrizione: null,
      segnalatore_id: null,
      segnalatore_nome: null,
      categoria_id: null,
      categoria_nome: 'Elettrico',
      titolo: 'Guasto 3',
      descrizione: null,
      is_area_comune: true,
      ubicazione_label: 'Area comune',
      priorita: 'BASSA',
      stato: 'RISOLTO',
      created_at: '2026-11-05T10:00:00Z',
      created_at_formattata: '5 nov 2026',
      closed_at: '2026-11-05T12:00:00Z',
      closed_at_formattato: '5 nov 2026',
      fornitore_assegnato_id: null,
      fornitore_assegnato_nome: 'Non assegnato',
      data_intervento_prevista: null,
      data_intervento_formattata: null,
      ultimo_intervento: null,
      interventi: [],
      allegati: [],
      messaggi: [],
    },
  ];

  const dummyFornitori: FornitoreAdminView[] = [
    {
      id: 'f1',
      admin_id: 'a1',
      ragione_sociale: 'Ditta 1',
      p_iva: '123',
      iban: null,
      email: null,
      telefono: null,
      categoria: 'Idraulico',
      created_at: '2026-11-05T10:00:00Z',
    },
    {
      id: 'f2',
      admin_id: 'a1',
      ragione_sociale: 'Ditta 2',
      p_iva: '456',
      iban: null,
      email: null,
      telefono: null,
      categoria: 'Elettrico',
      created_at: '2026-11-05T10:00:00Z',
    },
  ];

  const stats = calcolaStatisticheManutenzione(dummyTickets, dummyFornitori);
  assert.equal(stats.ticketAperti, 1);
  assert.equal(stats.interventiInLavorazione, 1);
  assert.equal(stats.fornitoriConvenzionati, 2);
});

test('filtraTicket: filtra per chip e per ricerca testuale', () => {
  const dummyTickets: TicketAdminView[] = [
    {
      id: '1',
      condominio_id: 'c1',
      unita_id: null,
      unita_descrizione: null,
      segnalatore_id: null,
      segnalatore_nome: null,
      categoria_id: null,
      categoria_nome: 'Idraulico',
      titolo: 'Perdita autoclave vano pompe',
      descrizione: 'Allagamento piano terra',
      is_area_comune: true,
      ubicazione_label: 'Area comune',
      priorita: 'URGENTE',
      stato: 'APERTO',
      created_at: '2026-11-05T10:00:00Z',
      created_at_formattata: '5 nov 2026',
      closed_at: null,
      closed_at_formattato: '—',
      fornitore_assegnato_id: null,
      fornitore_assegnato_nome: 'Non assegnato',
      data_intervento_prevista: null,
      data_intervento_formattata: null,
      ultimo_intervento: null,
      interventi: [],
      allegati: [],
      messaggi: [],
    },
    {
      id: '2',
      condominio_id: 'c1',
      unita_id: 'u2',
      unita_descrizione: 'Palazzo A - Int. 2',
      segnalatore_id: null,
      segnalatore_nome: null,
      categoria_id: null,
      categoria_nome: 'Elettrico',
      titolo: 'Guasto citofono interno',
      descrizione: null,
      is_area_comune: false,
      ubicazione_label: 'Palazzo A - Int. 2',
      priorita: 'MEDIA',
      stato: 'LAVORAZIONE',
      created_at: '2026-11-05T10:00:00Z',
      created_at_formattata: '5 nov 2026',
      closed_at: null,
      closed_at_formattato: '—',
      fornitore_assegnato_id: 'f1',
      fornitore_assegnato_nome: 'Volta Elettrica',
      data_intervento_prevista: null,
      data_intervento_formattata: null,
      ultimo_intervento: null,
      interventi: [],
      allegati: [],
      messaggi: [],
    },
  ];

  // Tutti
  assert.equal(filtraTicket(dummyTickets, { stato: 'tutti' }).length, 2);

  // Aperti
  const aperti = filtraTicket(dummyTickets, { stato: 'aperti' });
  assert.equal(aperti.length, 1);
  assert.equal(aperti[0]?.id, '1');

  // In lavorazione
  const inLav = filtraTicket(dummyTickets, { stato: 'in_lavorazione' });
  assert.equal(inLav.length, 1);
  assert.equal(inLav[0]?.id, '2');

  // Urgenti
  const urg = filtraTicket(dummyTickets, { stato: 'urgenti' });
  assert.equal(urg.length, 1);
  assert.equal(urg[0]?.id, '1');

  // Aree comuni
  const areeComuni = filtraTicket(dummyTickets, { stato: 'aree_comuni' });
  assert.equal(areeComuni.length, 1);
  assert.equal(areeComuni[0]?.id, '1');

  // Ricerca fornitore
  const perFornitore = filtraTicket(dummyTickets, { ricerca: 'volta' });
  assert.equal(perFornitore.length, 1);
  assert.equal(perFornitore[0]?.id, '2');

  // Ricerca ubicazione
  const perUbicazione = filtraTicket(dummyTickets, { ricerca: 'Int. 2' });
  assert.equal(perUbicazione.length, 1);
  assert.equal(perUbicazione[0]?.id, '2');
});

test('filtraFornitori: filtra per ragione sociale o categoria', () => {
  const fornitori: FornitoreAdminView[] = [
    {
      id: '1',
      admin_id: 'a1',
      ragione_sociale: 'ClimaTerm Edilizia Srl',
      p_iva: '01234567890',
      iban: null,
      email: 'info@climaterm.it',
      telefono: '06123456',
      categoria: 'Idraulico',
      created_at: '2026-11-05T10:00:00Z',
    },
    {
      id: '2',
      admin_id: 'a1',
      ragione_sociale: 'Volta Impianti Snc',
      p_iva: '09876543210',
      iban: null,
      email: 'info@volta.it',
      telefono: '06987654',
      categoria: 'Elettrico',
      created_at: '2026-11-05T10:00:00Z',
    },
  ];

  assert.equal(filtraFornitori(fornitori).length, 2);
  assert.equal(filtraFornitori(fornitori, 'clima').length, 1);
  assert.equal(filtraFornitori(fornitori, 'elettrico').length, 1);
  assert.equal(filtraFornitori(fornitori, 'non_esiste').length, 0);
});

test('trasformaTicketRawInView: converte correttamente raw in view con ubicazione ed interventi', () => {
  const raw: TicketAdminRaw = {
    id: 'tkt-1',
    condominio_id: 'c1',
    unita_id: 'u1',
    segnalatore_id: 'seg-1',
    categoria_id: 'cat-1',
    titolo: 'Guasto perdita',
    descrizione: 'Tubo gocciola',
    is_area_comune: false,
    priorita: 'ALTA',
    stato: 'LAVORAZIONE',
    created_at: '2026-11-05T08:00:00Z',
    closed_at: null,
    categorie_guasti: { id: 'cat-1', nome: 'Idraulico' },
    unita_immobiliari: {
      id: 'u1',
      interno: '3',
      piano: 2,
      palazzi: { id: 'p1', nome_identificativo: 'Palazzo B' },
    },
    utenti: { id: 'seg-1', nome_cognome: 'Mario Rossi', email: 'mario@test.it' },
    ticket_interventi: [
      {
        id: 'int-1',
        ticket_id: 'tkt-1',
        fornitore_id: 'forn-1',
        data_prevista: '2026-11-06',
        importo_consuntivo: 180,
        note_fornitore: 'Sostituzione raccordo',
        fattura_url: null,
        foto_lavoro_url: null,
        created_at: '2026-11-05T09:00:00Z',
        fornitori: { id: 'forn-1', ragione_sociale: 'Idro Rossi Srl' },
        fornitori_tokens: [
          {
            token: 'tok-abc',
            url_magico: 'https://app.iocondo.it/fornitore/tok-abc',
            data_scadenza: '2026-11-19T09:00:00Z',
            used_at: null,
          },
        ],
      },
    ],
    ticket_allegati: [
      {
        id: 'all-1',
        ticket_id: 'tkt-1',
        url_storage: 'foto/perdita.png',
        tipo_file: 'FOTO',
        caricato_da: 'seg-1',
        created_at: '2026-11-05T08:05:00Z',
      },
    ],
    ticket_messaggi: [
      {
        id: 'msg-1',
        ticket_id: 'tkt-1',
        mittente_id: 'seg-1',
        messaggio: 'Ho chiuso l’acqua',
        timestamp: '2026-11-05T08:10:00Z',
        utenti: { nome_cognome: 'Mario Rossi' },
      },
    ],
  };

  const view = trasformaTicketRawInView(raw);
  assert.equal(view.id, 'tkt-1');
  assert.equal(view.ubicazione_label, 'Palazzo B - Int. 3 - P. 2');
  assert.equal(view.categoria_nome, 'Idraulico');
  assert.equal(view.fornitore_assegnato_nome, 'Idro Rossi Srl');
  assert.equal(view.interventi.length, 1);
  assert.equal(view.interventi[0]?.magic_token, 'tok-abc');
  assert.equal(view.interventi[0]?.importo_consuntivo_formattato, '€ 180,00');
  assert.equal(view.allegati.length, 1);
  assert.equal(view.messaggi.length, 1);
});

