-- =====================================================================
-- 04_mock_data.sql
-- Dati di test realistici (Italia). Ordine di inserimento dettato dalle Foreign Key.
-- Eseguire DOPO 01 (schema), 02 (RLS) e 03 (trigger).
--
-- ID: UUID deterministici generati da pg_temp.id(<gruppo>, <n>) cosi' i collegamenti restano leggibili.
--   10 utenti | 20 piani | 21 ruoli | 22 tipologie | 23 categorie guasti | 24 fornitori | 30 condomini
--   31 palazzi | 32 scale | 33 unita' | 40 tab. millesimali | 41 esercizi | 42 rate testata
--   43 rate dettaglio | 44 piano conti | 45 sottoconti | 50 ticket | 51 interventi | 60 varie
--
-- Credenziali di test (tutti gli utenti): password  Password123!
-- NB: le righe in auth.users fanno scattare il trigger 03 (handle_new_user) che crea public.utenti;
--     poi completiamo anagrafica e flag con un UPSERT.
-- =====================================================================

create or replace function pg_temp.id(grp int, n int) returns uuid
language sql immutable as $$
    select (lpad(grp::text, 2, '0') || '000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;

-- ---------------------------------------------------------------------
-- 1. UTENTI AUTH (1 SuperAdmin, 2 Admin, 10 Condomini, 1 Portiere)
-- ---------------------------------------------------------------------
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
)
select
    '00000000-0000-0000-0000-000000000000', pg_temp.id(10, v.n), 'authenticated', 'authenticated', v.email,
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome_cognome', v.nome),
    now(), now(), '', '', '', ''
from (values
    (1,  'superadmin@iocondo.it',        'Roberto Santoro'),
    (2,  'giulia.ferretti@studioferretti.it', 'Giulia Ferretti'),
    (3,  'marco.bellandi@amministrazioni-bellandi.it', 'Marco Bellandi'),
    (4,  'luca.romano@example.it',       'Luca Romano'),
    (5,  'francesca.esposito@example.it','Francesca Esposito'),
    (6,  'paolo.conti@example.it',       'Paolo Conti'),
    (7,  'elena.marino@example.it',      'Elena Marino'),
    (8,  'andrea.deluca@example.it',     'Andrea De Luca'),
    (9,  'sara.greco@example.it',        'Sara Greco'),
    (10, 'matteo.ricci@example.it',      'Matteo Ricci'),
    (11, 'chiara.colombo@example.it',    'Chiara Colombo'),
    (12, 'davide.fontana@example.it',    'Davide Fontana'),
    (13, 'valentina.moretti@example.it', 'Valentina Moretti'),
    (14, 'gennaro.esposito@example.it',  'Gennaro Esposito')
) as v(n, email, nome);

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select u.id, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', u.email, now(), now(), now()
from auth.users u
where u.id in (select pg_temp.id(10, g) from generate_series(1, 14) g);

-- Completamento profili pubblici (la riga base e' gia' stata creata dal trigger)
insert into public.utenti (id, email, nome_cognome, telefono, is_superadmin)
select pg_temp.id(10, v.n), v.email, v.nome, v.tel, v.sa
from (values
    (1,  'superadmin@iocondo.it',        'Roberto Santoro',   '+39 06 5550101', true),
    (2,  'giulia.ferretti@studioferretti.it', 'Giulia Ferretti', '+39 06 5550202', false),
    (3,  'marco.bellandi@amministrazioni-bellandi.it', 'Marco Bellandi', '+39 02 5550303', false),
    (4,  'luca.romano@example.it',       'Luca Romano',       '+39 333 1000004', false),
    (5,  'francesca.esposito@example.it','Francesca Esposito','+39 333 1000005', false),
    (6,  'paolo.conti@example.it',       'Paolo Conti',       '+39 333 1000006', false),
    (7,  'elena.marino@example.it',      'Elena Marino',      '+39 333 1000007', false),
    (8,  'andrea.deluca@example.it',     'Andrea De Luca',    '+39 333 1000008', false),
    (9,  'sara.greco@example.it',        'Sara Greco',        '+39 333 1000009', false),
    (10, 'matteo.ricci@example.it',      'Matteo Ricci',      '+39 347 2000010', false),
    (11, 'chiara.colombo@example.it',    'Chiara Colombo',    '+39 347 2000011', false),
    (12, 'davide.fontana@example.it',    'Davide Fontana',    '+39 347 2000012', false),
    (13, 'valentina.moretti@example.it', 'Valentina Moretti', '+39 347 2000013', false),
    (14, 'gennaro.esposito@example.it',  'Gennaro Esposito',  '+39 333 1000014', false)
) as v(n, email, nome, tel, sa)
on conflict (id) do update
    set email = excluded.email, nome_cognome = excluded.nome_cognome,
        telefono = excluded.telefono, is_superadmin = excluded.is_superadmin;

-- ---------------------------------------------------------------------
-- 2. PIANI, LICENZE SAAS, RUOLI, TIPOLOGIE, CATEGORIE
-- ---------------------------------------------------------------------
insert into public.piani_abbonamento (id, nome, prezzo_mensile, limite_unita, feature_premium) values
    (pg_temp.id(20,1), 'Starter',      29.00,  50,   '{"open_banking": false, "assistente_ai": false}'),
    (pg_temp.id(20,2), 'Professional', 79.00,  500,  '{"open_banking": true,  "assistente_ai": false}'),
    (pg_temp.id(20,3), 'Enterprise',   199.00, null, '{"open_banking": true,  "assistente_ai": true}');

insert into public.licenze_saas (id, admin_id, piano_id, is_active, data_scadenza) values
    (pg_temp.id(20,11), pg_temp.id(10,2), pg_temp.id(20,2), true, '2027-06-30'),
    (pg_temp.id(20,12), pg_temp.id(10,3), pg_temp.id(20,3), true, '2027-03-31');

insert into public.fatture_saas (id, admin_id, importo, url_pdf, data_emissione) values
    (pg_temp.id(20,21), pg_temp.id(10,2), 948.00,  'saas-fatture/2026/FT-2026-0001.pdf', '2026-07-01'),
    (pg_temp.id(20,22), pg_temp.id(10,3), 2388.00, 'saas-fatture/2026/FT-2026-0002.pdf', '2026-04-01');

insert into public.ruoli_piattaforma (id, codice) values
    (pg_temp.id(21,1), 'CONDOMINO'), (pg_temp.id(21,2), 'ADMIN'), (pg_temp.id(21,3), 'PORTIERE');

insert into public.tipologie_unita (id, descrizione) values
    (pg_temp.id(22,1), 'Appartamento'), (pg_temp.id(22,2), 'Box auto'),
    (pg_temp.id(22,3), 'Negozio'),      (pg_temp.id(22,4), 'Cantina');

insert into public.categorie_guasti (id, nome) values
    (pg_temp.id(23,1), 'Idraulico'), (pg_temp.id(23,2), 'Elettrico'), (pg_temp.id(23,3), 'Ascensore'),
    (pg_temp.id(23,4), 'Edile'),     (pg_temp.id(23,5), 'Giardinaggio');

-- ---------------------------------------------------------------------
-- 3. CONDOMINI, CONFIGURAZIONI, PALAZZI, SCALE, UNITA'
-- ---------------------------------------------------------------------
insert into public.condomini (id, admin_id, nome, tipo, codice_fiscale, partita_iva, indirizzo, citta, cap, provincia, iban_principale) values
    (pg_temp.id(30,1), pg_temp.id(10,2), 'Condominio Roma Appia', 'CONDOMINIO', '97654320581', null,
        'Via Appia Nuova 120', 'Roma', '00183', 'RM', 'IT60X0542811101000000123456'),
    (pg_temp.id(30,2), pg_temp.id(10,3), 'Supercondominio Milano Lambrate', 'SUPERCONDOMINIO', '97123450152', null,
        'Via Pacini 48', 'Milano', '20131', 'MI', 'IT28W8000000292100645211208');

insert into public.configurazioni_condominio (id, condominio_id, palazzo_id, abilita_social, abilita_chat, abilita_bacheca, abilita_ticket, abilita_prenotazioni, abilita_pacchi) values
    (pg_temp.id(60,1), pg_temp.id(30,1), null, true,  true,  true, true, true,  true),
    (pg_temp.id(60,2), pg_temp.id(30,2), null, true,  true,  true, true, true,  true);

insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo) values
    (pg_temp.id(31,1), pg_temp.id(30,1), 'Palazzo A',    'Via Appia Nuova 120'),
    (pg_temp.id(31,2), pg_temp.id(30,1), 'Palazzo B',    'Via Appia Nuova 122'),
    (pg_temp.id(31,3), pg_temp.id(30,2), 'Torre Nord',   'Via Pacini 48'),
    (pg_temp.id(31,4), pg_temp.id(30,2), 'Torre Sud',    'Via Pacini 50'),
    (pg_temp.id(31,5), pg_temp.id(30,2), 'Corpo Basso',  'Via Pacini 52');

-- override per edificio (UC-05): modulo Social disabilitato nel Corpo Basso (richiede che i palazzi esistano)
insert into public.configurazioni_condominio (id, condominio_id, palazzo_id, abilita_social, abilita_chat, abilita_bacheca, abilita_ticket, abilita_prenotazioni, abilita_pacchi) values
    (pg_temp.id(60,3), pg_temp.id(30,2), pg_temp.id(31,5), false, false, true, true, false, true);

insert into public.scale_colonne (id, palazzo_id, tipo, nome) values
    (pg_temp.id(32,1), pg_temp.id(31,1), 'SCALA',   'Scala A'),
    (pg_temp.id(32,2), pg_temp.id(31,2), 'SCALA',   'Scala B'),
    (pg_temp.id(32,3), pg_temp.id(31,1), 'COLONNA', 'Colonna Nord');

insert into public.unita_immobiliari (id, palazzo_id, scala_colonna_id, tipologia_id, interno, piano, mq) values
    -- Condominio Roma (6 unita')
    (pg_temp.id(33,1),  pg_temp.id(31,1), pg_temp.id(32,1), pg_temp.id(22,1), '1',   1, 85.00),
    (pg_temp.id(33,2),  pg_temp.id(31,1), pg_temp.id(32,1), pg_temp.id(22,1), '2',   1, 72.50),
    (pg_temp.id(33,3),  pg_temp.id(31,1), pg_temp.id(32,1), pg_temp.id(22,1), '3',   2, 68.00),
    (pg_temp.id(33,4),  pg_temp.id(31,1), pg_temp.id(32,1), pg_temp.id(22,1), '4',   2, 64.00),
    (pg_temp.id(33,5),  pg_temp.id(31,2), pg_temp.id(32,2), pg_temp.id(22,1), '1',   1, 60.00),
    (pg_temp.id(33,6),  pg_temp.id(31,2), pg_temp.id(32,2), pg_temp.id(22,1), '2',   1, 60.00),
    -- Supercondominio Milano (9 unita')
    (pg_temp.id(33,7),  pg_temp.id(31,3), null, pg_temp.id(22,1), '1A',  1, 90.00),
    (pg_temp.id(33,8),  pg_temp.id(31,3), null, pg_temp.id(22,1), '1B',  1, 75.00),
    (pg_temp.id(33,9),  pg_temp.id(31,3), null, pg_temp.id(22,1), '2A',  2, 95.00),
    (pg_temp.id(33,10), pg_temp.id(31,4), null, pg_temp.id(22,1), '1A',  1, 88.00),
    (pg_temp.id(33,11), pg_temp.id(31,4), null, pg_temp.id(22,1), '2A',  2, 82.00),
    (pg_temp.id(33,12), pg_temp.id(31,4), null, pg_temp.id(22,2), 'B1', -1, 14.00),
    (pg_temp.id(33,13), pg_temp.id(31,5), null, pg_temp.id(22,1), '1',   1, 70.00),
    (pg_temp.id(33,14), pg_temp.id(31,5), null, pg_temp.id(22,2), 'B2', -1, 15.00),
    (pg_temp.id(33,15), pg_temp.id(31,5), null, pg_temp.id(22,3), 'N1',  0, 120.00);

-- ---------------------------------------------------------------------
-- 4. RUOLI (pivot) E ANAGRAFICHE CONDOMINI
-- ---------------------------------------------------------------------
insert into public.utente_entita_ruolo (id, utente_id, ruolo_id, condominio_id, unita_id) values
    (pg_temp.id(60,11), pg_temp.id(10,2),  pg_temp.id(21,2), pg_temp.id(30,1), null),
    (pg_temp.id(60,12), pg_temp.id(10,3),  pg_temp.id(21,2), pg_temp.id(30,2), null),
    (pg_temp.id(60,13), pg_temp.id(10,14), pg_temp.id(21,3), pg_temp.id(30,1), null);

insert into public.utente_entita_ruolo (id, utente_id, ruolo_id, condominio_id, unita_id)
select pg_temp.id(60, 20 + g), pg_temp.id(10, 3 + g), pg_temp.id(21,1), null, pg_temp.id(33, g)
from generate_series(1, 10) g;   -- utenti 4..13 -> unita' 1..10

insert into public.anagrafiche_unita (id, unita_id, utente_id, data_inizio, data_fine, tipo_possesso, quota_possesso)
select pg_temp.id(60, 40 + g), pg_temp.id(33, g), pg_temp.id(10, 3 + g),
       date '2018-01-01' + (g * 97), null,
       case when g = 9 then 'INQUILINO' else 'PROPRIETARIO' end, 100
from generate_series(1, 10) g;

-- ---------------------------------------------------------------------
-- 5. TABELLE MILLESIMALI (2) E QUOTE  -- ogni tabella somma a 1000
-- ---------------------------------------------------------------------
insert into public.tabelle_millesimali (id, condominio_id, palazzo_id, scala_colonna_id, nome, totale) values
    (pg_temp.id(40,1), pg_temp.id(30,1), null, null,              'Tabella A - Proprieta generale', 1000),
    (pg_temp.id(40,2), pg_temp.id(30,1), pg_temp.id(31,1), pg_temp.id(32,1), 'Tabella B - Ascensore Scala A', 1000);

insert into public.quote_millesimali (id, tabella_id, unita_id, valore_millesimale) values
    -- Tabella A: 190+170+160+180+150+150 = 1000
    (pg_temp.id(40,101), pg_temp.id(40,1), pg_temp.id(33,1), 190),
    (pg_temp.id(40,102), pg_temp.id(40,1), pg_temp.id(33,2), 170),
    (pg_temp.id(40,103), pg_temp.id(40,1), pg_temp.id(33,3), 160),
    (pg_temp.id(40,104), pg_temp.id(40,1), pg_temp.id(33,4), 180),
    (pg_temp.id(40,105), pg_temp.id(40,1), pg_temp.id(33,5), 150),
    (pg_temp.id(40,106), pg_temp.id(40,1), pg_temp.id(33,6), 150),
    -- Tabella B (solo Scala A): 300+280+220+200 = 1000
    (pg_temp.id(40,201), pg_temp.id(40,2), pg_temp.id(33,1), 300),
    (pg_temp.id(40,202), pg_temp.id(40,2), pg_temp.id(33,2), 280),
    (pg_temp.id(40,203), pg_temp.id(40,2), pg_temp.id(33,3), 220),
    (pg_temp.id(40,204), pg_temp.id(40,2), pg_temp.id(33,4), 200);

-- ---------------------------------------------------------------------
-- 6. FORNITORI, DRIVE DOCUMENTALE
-- ---------------------------------------------------------------------
insert into public.fornitori (id, admin_id, ragione_sociale, p_iva, iban, email, telefono, categoria) values
    (pg_temp.id(24,1), pg_temp.id(10,2), 'Idrotermica Rossi S.r.l.',     '04567890581', 'IT45R0300203280000400162854', 'info@idrotermicarossi.it',   '+39 06 7890123', 'Idraulico'),
    (pg_temp.id(24,2), pg_temp.id(10,2), 'Elettroimpianti Capitale S.n.c.','05678901004','IT02L1234512345123456789012', 'assistenza@elettrocapitale.it','+39 06 7890456', 'Elettrico'),
    (pg_temp.id(24,3), pg_temp.id(10,3), 'Ascensori Lombardi S.p.A.',    '08765430961', 'IT73K0306909606100000063456', 'servizio@ascensorilombardi.it','+39 02 4567890', 'Ascensore'),
    (pg_temp.id(24,4), pg_temp.id(10,3), 'Pulizie Meneghina Soc. Coop.', '09876540150', 'IT91P0200809432000104567890', 'amministrazione@meneghina.it','+39 02 4567123', 'Pulizie');

insert into public.cartelle_documenti (id, condominio_id, parent_id, nome_cartella) values
    (pg_temp.id(60,51), pg_temp.id(30,1), null, 'Verbali Assemblee'),
    (pg_temp.id(60,52), pg_temp.id(30,1), null, 'Fatture Fornitori'),
    (pg_temp.id(60,53), pg_temp.id(30,2), null, 'Regolamento');

insert into public.documenti_metadata (id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da) values
    (pg_temp.id(60,61), pg_temp.id(60,51), null, 'drive/30-1/verbali/verbale_assemblea_2026_04.pdf', 'Verbale assemblea 15-04-2026.pdf', 'application/pdf', pg_temp.id(10,2)),
    (pg_temp.id(60,62), pg_temp.id(60,52), null, 'drive/30-1/fatture/fattura_ascensori_0345.pdf',    'Fattura manutenzione ascensore.pdf', 'application/pdf', pg_temp.id(10,2)),
    (pg_temp.id(60,63), pg_temp.id(60,53), null, 'drive/30-2/regolamento/regolamento_condominiale.pdf', 'Regolamento condominiale.pdf', 'application/pdf', pg_temp.id(10,3));

-- La fattura e' privata: leggibile solo dall'amministratore (permesso esplicito al ruolo ADMIN)
insert into public.documenti_permessi (id, documento_id, ruolo_target_id, utente_target_id, tipo_permesso) values
    (pg_temp.id(60,71), pg_temp.id(60,62), pg_temp.id(21,2), null, 'LETTURA');

-- ---------------------------------------------------------------------
-- 7. CONTABILITA': esercizio, piano dei conti, movimenti, rate
-- ---------------------------------------------------------------------
insert into public.esercizi_contabili (id, condominio_id, anno, data_inizio, data_fine, stato) values
    (pg_temp.id(41,1), pg_temp.id(30,1), 2026, '2026-01-01', '2026-12-31', 'PREVENTIVO');

insert into public.piano_dei_conti (id, condominio_id, codice, descrizione_macro) values
    (pg_temp.id(44,1), pg_temp.id(30,1), '100', 'Spese di manutenzione ordinaria'),
    (pg_temp.id(44,2), pg_temp.id(30,1), '200', 'Spese generali e utenze');

insert into public.sottoconti (id, piano_conto_id, descrizione_micro) values
    (pg_temp.id(45,1), pg_temp.id(44,1), 'Manutenzione ascensore'),
    (pg_temp.id(45,2), pg_temp.id(44,1), 'Pulizia scale'),
    (pg_temp.id(45,3), pg_temp.id(44,2), 'Energia elettrica parti comuni');

insert into public.movimenti_contabili (id, esercizio_id, data, importo, segno, sottoconto_id, fornitore_id, descrizione, doc_allegato_id) values
    (pg_temp.id(60,81), pg_temp.id(41,1), '2026-02-10',  1250.00, '-', pg_temp.id(45,1), null,            'Canone manutenzione ascensore - 1 semestre', pg_temp.id(60,62)),
    (pg_temp.id(60,82), pg_temp.id(41,1), '2026-03-05',   480.00, '-', pg_temp.id(45,2), null,            'Pulizia scale - febbraio 2026', null),
    (pg_temp.id(60,83), pg_temp.id(41,1), '2026-04-12',   615.80, '-', pg_temp.id(45,3), null,            'Bolletta ENEL parti comuni - bimestre', null),
    (pg_temp.id(60,84), pg_temp.id(41,1), '2026-09-18',  1140.00, '+', null,             null,            'Incasso rata 1/2026 - Romano Luca (int. 1)', null);

insert into public.rate_testata (id, esercizio_id, tabella_millesimale_id, data_scadenza, descrizione, pubblicata) values
    (pg_temp.id(42,1), pg_temp.id(41,1), pg_temp.id(40,1), '2026-09-30', 'Rata ordinaria 1/2026 - Gestione ordinaria (Tab. A)', true),
    (pg_temp.id(42,2), pg_temp.id(41,1), pg_temp.id(40,2), '2026-12-15', 'Rata straordinaria 2/2026 - Revisione ascensore Scala A (Tab. B)', true);

-- 10 rate: 6 (Tab. A, totale 6.000 EUR) + 4 (Tab. B, totale 4.000 EUR)
insert into public.rate_dettaglio (id, rata_testata_id, unita_id, utente_id, importo_dovuto, importo_pagato, stato, data_pagamento, bollettino_url) values
    (pg_temp.id(43,1),  pg_temp.id(42,1), pg_temp.id(33,1), pg_temp.id(10,4), 1140.00, 1140.00, 'PAGATO',    '2026-09-18', 'bollettini/2026/rata1_int1.pdf'),
    (pg_temp.id(43,2),  pg_temp.id(42,1), pg_temp.id(33,2), pg_temp.id(10,5), 1020.00, 1020.00, 'PAGATO',    '2026-09-22', 'bollettini/2026/rata1_int2.pdf'),
    (pg_temp.id(43,3),  pg_temp.id(42,1), pg_temp.id(33,3), pg_temp.id(10,6),  960.00,  960.00, 'PAGATO',    '2026-09-25', 'bollettini/2026/rata1_int3.pdf'),
    (pg_temp.id(43,4),  pg_temp.id(42,1), pg_temp.id(33,4), pg_temp.id(10,7), 1080.00, 1080.00, 'PAGATO',    '2026-09-29', 'bollettini/2026/rata1_int4.pdf'),
    (pg_temp.id(43,5),  pg_temp.id(42,1), pg_temp.id(33,5), pg_temp.id(10,8),  900.00,    0.00, 'RITARDO',    null,        'bollettini/2026/rata1_int5.pdf'),
    (pg_temp.id(43,6),  pg_temp.id(42,1), pg_temp.id(33,6), pg_temp.id(10,9),  900.00,  900.00, 'PAGATO',    '2026-09-30', 'bollettini/2026/rata1_int6.pdf'),
    (pg_temp.id(43,7),  pg_temp.id(42,2), pg_temp.id(33,1), pg_temp.id(10,4), 1200.00, 1200.00, 'PAGATO',    '2026-10-05', 'bollettini/2026/rata2_int1.pdf'),
    (pg_temp.id(43,8),  pg_temp.id(42,2), pg_temp.id(33,2), pg_temp.id(10,5), 1120.00,    0.00, 'DA_PAGARE', null,        'bollettini/2026/rata2_int2.pdf'),
    (pg_temp.id(43,9),  pg_temp.id(42,2), pg_temp.id(33,3), pg_temp.id(10,6),  880.00,    0.00, 'DA_PAGARE', null,        'bollettini/2026/rata2_int3.pdf'),
    (pg_temp.id(43,10), pg_temp.id(42,2), pg_temp.id(33,4), pg_temp.id(10,7),  800.00,    0.00, 'DA_PAGARE', null,        'bollettini/2026/rata2_int4.pdf');

insert into public.pagamenti_rate (id, rata_dettaglio_id, utente_id, importo, metodo, provider, provider_ref, stato, created_at, completed_at) values
    (pg_temp.id(60,91), pg_temp.id(43,1), pg_temp.id(10,4), 1140.00, 'BONIFICO',    'MANUALE', null,                          'COMPLETATO', '2026-09-18 10:12+02', '2026-09-18 10:12+02'),
    (pg_temp.id(60,92), pg_temp.id(43,4), pg_temp.id(10,7), 1080.00, 'CARTA',       'STRIPE',  'pi_3PmockCard0000000000001',  'COMPLETATO', '2026-09-29 18:40+02', '2026-09-29 18:41+02'),
    (pg_temp.id(60,93), pg_temp.id(43,7), pg_temp.id(10,4), 1200.00, 'PAY_BY_BANK', 'NEXI',    'nx_mock_pbb_000002',          'COMPLETATO', '2026-10-05 09:03+02', '2026-10-05 09:04+02'),
    (pg_temp.id(60,94), pg_temp.id(43,8), pg_temp.id(10,5), 1120.00, 'SDD',         'STRIPE',  'pi_3PmockSdd00000000000003',  'IN_ATTESA',  '2026-10-23 17:25+02', null);

insert into public.saldi_pregressi (id, esercizio_id, unita_id, utente_id, importo, note) values
    (pg_temp.id(60,101), pg_temp.id(41,1), pg_temp.id(33,5), pg_temp.id(10,8),  210.50, 'Debito residuo esercizio 2025'),
    (pg_temp.id(60,102), pg_temp.id(41,1), pg_temp.id(33,3), pg_temp.id(10,6), -75.00,  'Credito residuo esercizio 2025');

insert into public.transazioni_bancarie (id, condominio_id, data_valuta, importo, causale, origine, hash_movimento, stato_riconciliazione) values
    (pg_temp.id(60,111), pg_temp.id(30,1), '2026-09-18', 1140.00, 'BONIFICO DA ROMANO LUCA - RATA 1/2026 INT 1 COND ROMA APPIA', 'CBI', 'mock-hash-0001', 'RICONCILIATA'),
    (pg_temp.id(60,112), pg_temp.id(30,1), '2026-10-02',  -615.80, 'ADDEBITO SDD ENEL ENERGIA - FATT 2026/004471', 'CBI', 'mock-hash-0002', 'NON_RICONCILIATA');

insert into public.riconciliazioni_log (id, transazione_id, rata_dettaglio_id, importo_assegnato, metodo) values
    (pg_temp.id(60,121), pg_temp.id(60,111), pg_temp.id(43,1), 1140.00, 'AUTO');

insert into public.solleciti_morosita (id, unita_id, utente_id, rata_dettaglio_id, data_invio, livello_gravita, url_pdf_lettera) values
    (pg_temp.id(60,131), pg_temp.id(33,5), pg_temp.id(10,8), pg_temp.id(43,5), '2026-10-16 09:00+02', 1, 'solleciti/2026/sollecito_int5_lv1.pdf');

insert into public.polizze_assicurative (id, condominio_id, compagnia, numero_polizza, premio_annuo, data_scadenza) values
    (pg_temp.id(60,141), pg_temp.id(30,1), 'Generali Italia', 'GI-2025-778812', 2850.00, '2026-12-31');

-- ---------------------------------------------------------------------
-- 8. TICKET DI GUASTO (3)
-- ---------------------------------------------------------------------
insert into public.ticket_testata (id, condominio_id, unita_id, segnalatore_id, categoria_id, titolo, descrizione, is_area_comune, priorita, stato, created_at, closed_at) values
    (pg_temp.id(50,1), pg_temp.id(30,1), pg_temp.id(33,1), pg_temp.id(10,4), pg_temp.id(23,1),
        'Perdita d''acqua dal soffitto del bagno',
        'Dal soffitto del bagno gocciola acqua da due giorni, probabile rottura della colonna di scarico condominiale.',
        false, 'ALTA', 'LAVORAZIONE', '2026-10-19 08:30+02', null),
    (pg_temp.id(50,2), pg_temp.id(30,1), null, pg_temp.id(10,14), pg_temp.id(23,2),
        'Lampada scale non funzionante al secondo piano',
        'Il punto luce del pianerottolo del secondo piano di Scala A e'' spento: rischio inciampo.',
        true, 'MEDIA', 'APERTO', '2026-10-22 18:05+02', null),
    (pg_temp.id(50,3), pg_temp.id(30,2), pg_temp.id(33,7), pg_temp.id(10,10), pg_temp.id(23,3),
        'Ascensore Torre Nord bloccato al primo piano',
        'L''ascensore si e'' fermato tra il primo e il secondo piano con porte che non si aprono.',
        true, 'URGENTE', 'RISOLTO', '2026-09-30 07:50+02', '2026-10-01 16:20+02');

insert into public.ticket_messaggi (id, ticket_id, mittente_id, messaggio, "timestamp") values
    (pg_temp.id(60,151), pg_temp.id(50,1), pg_temp.id(10,4), 'Allego foto della macchia sul soffitto, sta peggiorando.', '2026-10-19 08:32+02'),
    (pg_temp.id(60,152), pg_temp.id(50,1), pg_temp.id(10,2), 'Ricevuto, ho incaricato l''idraulico. Intervento previsto il 28/10.', '2026-10-19 11:10+02'),
    (pg_temp.id(60,153), pg_temp.id(50,3), pg_temp.id(10,3), 'Tecnico in arrivo entro un''ora.', '2026-09-30 08:15+02');

insert into public.ticket_allegati (id, ticket_id, url_storage, tipo_file, caricato_da) values
    (pg_temp.id(60,161), pg_temp.id(50,1), 'tickets/50-1/macchia_soffitto.jpg', 'FOTO',    pg_temp.id(10,4)),
    (pg_temp.id(60,162), pg_temp.id(50,3), 'tickets/50-3/fattura_ascensori_lombardi.pdf', 'FATTURA', pg_temp.id(10,3));

insert into public.ticket_interventi (id, ticket_id, fornitore_id, data_prevista, importo_consuntivo, note_fornitore) values
    (pg_temp.id(51,1), pg_temp.id(50,1), pg_temp.id(24,1), '2026-10-28', null,   null),
    (pg_temp.id(51,3), pg_temp.id(50,3), pg_temp.id(24,3), '2026-09-30', 380.00, 'Sostituito relay porte di piano; test di funzionamento superato.');

insert into public.fornitori_tokens (token, ticket_intervento_id, url_magico, data_scadenza, used_at) values
    ('mock_magic_idrotermica_0001', pg_temp.id(51,1), 'https://app.iocondo.it/fornitore/mock_magic_idrotermica_0001', '2026-11-30 23:59+01', null),
    ('mock_magic_ascensori_0003',   pg_temp.id(51,3), 'https://app.iocondo.it/fornitore/mock_magic_ascensori_0003',   '2026-10-31 23:59+01', '2026-10-01 16:20+02');

-- ---------------------------------------------------------------------
-- 9. COMUNICAZIONE, ASSEMBLEA, SERVIZI, STORICO IMMOBILE
-- ---------------------------------------------------------------------
insert into public.bacheca_post (id, condominio_id, palazzo_id, autore_id, titolo, corpo, is_pinned, data_pubblicazione) values
    (pg_temp.id(60,171), pg_temp.id(30,1), null, pg_temp.id(10,2), 'Convocazione assemblea straordinaria',
        'E'' convocata l''assemblea straordinaria per il 20/11/2026 alle ore 18:30 presso la sala condominiale.', true, '2026-10-15 10:00+02'),
    (pg_temp.id(60,172), pg_temp.id(30,2), null, pg_temp.id(10,3), 'Chiusura temporanea ingresso carraio',
        'Per lavori di asfaltatura l''ingresso carraio sara'' chiuso dal 3 al 5 novembre.', false, '2026-10-20 09:00+02');

insert into public.chat_rooms (id, condominio_id, palazzo_id, nome_stanza, tipo) values
    (pg_temp.id(60,181), pg_temp.id(30,1), null,            'Condominio Roma Appia - Generale', 'GENERALE'),
    (pg_temp.id(60,182), pg_temp.id(30,2), pg_temp.id(31,3), 'Torre Nord',                       'PALAZZO');

insert into public.chat_partecipanti (room_id, utente_id) values
    (pg_temp.id(60,181), pg_temp.id(10,4)), (pg_temp.id(60,181), pg_temp.id(10,5)), (pg_temp.id(60,181), pg_temp.id(10,6)),
    (pg_temp.id(60,182), pg_temp.id(10,10)), (pg_temp.id(60,182), pg_temp.id(10,11));

insert into public.chat_messaggi (id, room_id, mittente_id, testo_messaggio, "timestamp") values
    (pg_temp.id(60,191), pg_temp.id(60,181), pg_temp.id(10,4), 'Buonasera a tutti, qualcuno sa quando passa l''idraulico?', '2026-10-20 19:02+02'),
    (pg_temp.id(60,192), pg_temp.id(60,181), pg_temp.id(10,5), 'Dovrebbe venire il 28, l''ha scritto l''amministratore in bacheca.', '2026-10-20 19:10+02'),
    (pg_temp.id(60,193), pg_temp.id(60,182), pg_temp.id(10,11), 'L''ascensore adesso funziona, grazie a chi ha segnalato.', '2026-10-01 17:00+02');

insert into public.assemblee_testata (id, condominio_id, tabella_millesimale_id, data, luogo, link_meet, stato, tipo, modalita) values
    (pg_temp.id(60,201), pg_temp.id(30,1), pg_temp.id(40,2), '2026-11-20 18:30+01', 'Sala condominiale - Via Appia Nuova 120, Roma', 'https://meet.google.com/mock-roma-ass', 'CONVOCATA', 'STRAORDINARIA', 'IBRIDA');

insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta) values
    (pg_temp.id(60,211), pg_temp.id(60,201), 1, 'Approvazione lavori revisione ascensore Scala A', 'Preventivo Ascensori Lombardi 4.000 EUR ripartiti su Tabella B.', true),
    (pg_temp.id(60,212), pg_temp.id(60,201), 2, 'Rinnovo polizza assicurativa globale fabbricati', 'Confronto tra tre preventivi.', false);

insert into public.assemblee_voti (id, punto_odg_id, unita_id, utente_id, voto) values
    (pg_temp.id(60,221), pg_temp.id(60,211), pg_temp.id(33,1), pg_temp.id(10,4), 'FAVOREVOLE'),
    (pg_temp.id(60,222), pg_temp.id(60,211), pg_temp.id(33,2), pg_temp.id(10,5), 'FAVOREVOLE'),
    (pg_temp.id(60,223), pg_temp.id(60,211), pg_temp.id(33,4), pg_temp.id(10,7), 'CONTRARIO');

insert into public.risorse_prenotabili (id, condominio_id, nome, tariffa_oraria, max_ore) values
    (pg_temp.id(60,231), pg_temp.id(30,2), 'Campo da tennis', 8.00, 2),
    (pg_temp.id(60,232), pg_temp.id(30,2), 'Lavanderia condominiale', 0.00, 3);

insert into public.prenotazioni_spazi (id, risorsa_id, utente_id, data_inizio, data_fine, costo_addebitato) values
    (pg_temp.id(60,241), pg_temp.id(60,231), pg_temp.id(10,10), '2026-10-31 10:00+01', '2026-10-31 12:00+01', 16.00);

insert into public.registro_pacchi (id, condominio_id, unita_destinazione_id, registrato_da, mittente_esterno, stato, data_arrivo, data_ritiro, firma_ritiro) values
    (pg_temp.id(60,251), pg_temp.id(30,1), pg_temp.id(33,2), pg_temp.id(10,14), 'Amazon EU S.a.r.l.', 'GIACENZA', '2026-10-23 11:20+02', null, null),
    (pg_temp.id(60,252), pg_temp.id(30,1), pg_temp.id(33,6), pg_temp.id(10,14), 'BRT Corriere Espresso', 'RITIRATO', '2026-10-21 15:45+02', '2026-10-21 19:10+02', 'S. Greco');

insert into public.eventi_calendario (id, condominio_id, palazzo_id, titolo, descrizione, data_inizio, data_fine, creato_da) values
    (pg_temp.id(60,261), pg_temp.id(30,1), null, 'Assemblea straordinaria', 'Voto lavori ascensore e polizza', '2026-11-20 18:30+01', '2026-11-20 20:30+01', pg_temp.id(10,2));

insert into public.raccolta_differenziata (id, condominio_id, tipo_rifiuto, giorno_settimana, note) values
    (pg_temp.id(60,271), pg_temp.id(30,1), 'Carta e cartone', 2, 'Esporre entro le 7:00'),
    (pg_temp.id(60,272), pg_temp.id(30,1), 'Plastica e metalli', 4, 'Esporre entro le 7:00');

-- Storico immobile (UC-11): i fatti tecnici sono PUBBLICI, la morosita' e' RISERVATA
insert into public.log_storico_immobile (id, unita_id, tipo_evento, descrizione, visibilita, data_evento) values
    (pg_temp.id(60,281), pg_temp.id(33,1), 'GUASTO',    'Ticket: perdita d''acqua dal soffitto del bagno (colonna di scarico)', 'PUBBLICO',  '2026-10-19 08:30+02'),
    (pg_temp.id(60,282), pg_temp.id(33,1), 'PAGAMENTO', 'Ricevuta rata ordinaria 1/2026', 'PUBBLICO',  '2026-09-18 10:12+02'),
    (pg_temp.id(60,283), pg_temp.id(33,5), 'SOLLECITO', 'Sollecito di pagamento livello 1 - rata 1/2026', 'RISERVATO', '2026-10-16 09:00+02');

-- Presenze e deleghe assemblea ibrida (UC-10)
insert into public.assemblee_presenze (id, assemblea_id, unita_id, utente_id, delegato_utente_id, modalita_presenza) values
    (pg_temp.id(60,291), pg_temp.id(60,201), pg_temp.id(33,1), pg_temp.id(10,4), null,              'PRESENZA'),
    (pg_temp.id(60,292), pg_temp.id(60,201), pg_temp.id(33,2), pg_temp.id(10,5), null,              'ONLINE'),
    (pg_temp.id(60,293), pg_temp.id(60,201), pg_temp.id(33,4), pg_temp.id(10,7), pg_temp.id(10,4), 'DELEGA');

-- Sinistri assicurativi (Excel A17)
insert into public.sinistri_assicurativi (id, condominio_id, polizza_id, ticket_id, numero_pratica, descrizione, importo_stimato, stato, data_apertura) values
    (pg_temp.id(60,301), pg_temp.id(30,1), pg_temp.id(60,141), pg_temp.id(50,1), 'SIN-2026-0098', 'Danni da infiltrazione acqua colonna di scarico bagno int. 1', 1450.00, 'PERIZIA', '2026-10-20');

-- Piani di rateizzazione personalizzati (Excel C26)
insert into public.piani_rateizzazione (id, condominio_id, unita_id, utente_id, importo_totale, numero_rate, stato, note) values
    (pg_temp.id(60,311), pg_temp.id(30,1), pg_temp.id(33,5), pg_temp.id(10,8), 900.00, 3, 'ATTIVO', 'Piano rientro rata 1/2026 concordato con studio amministratore');

-- Storico job di importazione CSV (UC-09)
insert into public.import_jobs (id, condominio_id, eseguito_da, tipo_import, nome_file, righe_totali, righe_importate, stato) values
    (pg_temp.id(60,321), pg_temp.id(30,1), pg_temp.id(10,2), 'MILLESIMI', 'tabella_a_b_roma_appia.csv', 10, 10, 'COMPLETATO');


