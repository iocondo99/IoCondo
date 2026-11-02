-- =============================================================================
-- DATI EXTRA PER LA PAGINA PAGAMENTI  (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor, DOPO 01_dati_prova.sql e 03_dati_home.sql. Nomi inventati.
--
-- Che cosa aggiunge al "Condominio di Prova" (le date sono RELATIVE a oggi: le rate "scadute" restano scadute
-- e quelle future restano future, qualunque giorno si esegua o si riesegua lo script):
--   Interno 1 (debitore = utente di prova), 10 rate pubblicate:
--     da pagare (2), in corso (1, pagata in parte), scadute (2, una di anno scorso), pagate (4, di cui 3 di
--     anno scorso), 1 con bollettino su un file CHE ESISTE SOLO SE LO CARICHI TU (vedi sotto), 1 con
--     bollettino su un file che NON esiste mai (la pagina deve dire "non ancora disponibile").
--   Interno 2 (nessun debitore, non dell'utente di prova): 2 rate pubblicate. L'utente di prova è anche
--     amministratore: le RLS gliele fanno leggere, ma la pagina "da residente" NON deve mostrarle e il loro
--     dettaglio deve dare "non disponibile".
--   1 rata dell'interno 1 NON pubblicata: non deve comparire né in elenco né nel dettaglio.
--   Una tabella millesimale ("Tabella A, prova") con le quote degli interni 1 e 2, collegata a 2 rate.
--   Con le 6 rate di 03_dati_home.sql l'utente di prova vede 16 rate in 2 pagine (10 per pagina).
--
-- PER PROVARE IL DOWNLOAD DEL BOLLETTINO (facoltativo)
--   Dashboard > Storage > ricevute-rate: crea le cartelle
--     d0000000-0000-4000-8000-000000000001 / d0000000-0000-4000-8000-000000000011
--   e carica un PDF qualsiasi chiamato  bollettino_assicurazione.pdf  (nome esatto). Senza il file la pagina
--   mostra "Il bollettino non è ancora disponibile." (comportamento corretto).
--
-- GARANZIE
--   - Rieseguibile: id fissi (prefisso d0000000-0000-4000-8000-0000000002xx / 3xx) e `on conflict`.
--   - Un solo blocco `do`: se qualcosa fallisce non cambia niente.
--   - Non tocca il Storage, gli utenti né i dati di 01 e 03.
--   - Per tornare indietro: 06_pulizia_rate_extra.sql (da eseguire PRIMA di 04 e di 02).
-- =============================================================================

do $seed$
declare
  -- >>> FACOLTATIVO: UUID dell'utente di prova. Se resta null si usa il proprietario dell'interno 1. <<<
  v_utente_test_id uuid := null;

  -- creati da 01_dati_prova.sql e 03_dati_home.sql
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_unita_1    constant uuid := 'd0000000-0000-4000-8000-000000000011';
  c_unita_2    constant uuid := 'd0000000-0000-4000-8000-000000000012';
  c_esercizio  constant uuid := 'd0000000-0000-4000-8000-000000000061';

  -- creati da questo script
  c_esercizio_prec constant uuid := 'd0000000-0000-4000-8000-000000000062';
  c_tabella        constant uuid := 'd0000000-0000-4000-8000-000000000301';

  v_anno      integer := extract(year from current_date)::integer;
  v_prec      uuid;
  v_percorso  text;
begin
  if v_utente_test_id is null then
    select utente_id into v_utente_test_id
      from public.anagrafiche_unita
     where unita_id = c_unita_1 and data_fine is null
     order by utente_id
     limit 1;
  end if;
  if v_utente_test_id is null then
    raise exception 'Non trovo l''utente di prova: esegui prima 01_dati_prova.sql oppure incolla il suo UUID in v_utente_test_id.';
  end if;
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise exception 'L''utente % non esiste in "utenti".', v_utente_test_id;
  end if;
  if not exists (select 1 from public.esercizi_contabili where id = c_esercizio) then
    raise exception 'Manca l''esercizio di prova: esegui prima 03_dati_home.sql.';
  end if;

  -- ---- Esercizio dell'anno scorso (univoco per condominio + anno: se c'è già, si usa quello) ------------
  insert into public.esercizi_contabili (id, condominio_id, anno, data_inizio, data_fine, stato)
  values (c_esercizio_prec, c_condominio, v_anno - 1, make_date(v_anno - 1, 1, 1), make_date(v_anno - 1, 12, 31), 'CHIUSO')
  on conflict do nothing;
  select id into v_prec from public.esercizi_contabili where condominio_id = c_condominio and anno = v_anno - 1;

  -- ---- Tabella millesimale di prova e quote degli interni 1 e 2 --------------------------------------
  insert into public.tabelle_millesimali (id, condominio_id, nome, totale)
  values (c_tabella, c_condominio, 'Tabella A, prova', 1000)
  on conflict do nothing;
  insert into public.quote_millesimali (id, tabella_id, unita_id, valore_millesimale) values
    ('d0000000-0000-4000-8000-000000000302', c_tabella, c_unita_1, 125.500),
    ('d0000000-0000-4000-8000-000000000303', c_tabella, c_unita_2,  98.000)
  on conflict do nothing;

  -- ---- Testate (la scadenza si aggiorna a ogni esecuzione, così resta relativa a oggi) ----------------
  insert into public.rate_testata (id, esercizio_id, tabella_millesimale_id, data_scadenza, descrizione, pubblicata) values
    ('d0000000-0000-4000-8000-000000000201', c_esercizio, c_tabella, current_date + 7,   'Quota straordinaria ascensore',        true),
    ('d0000000-0000-4000-8000-000000000202', c_esercizio, null,      current_date - 70,  'Quota riscaldamento, primo trimestre', true),
    ('d0000000-0000-4000-8000-000000000203', c_esercizio, null,      current_date - 25,  'Quota pulizia delle scale',            true),
    ('d0000000-0000-4000-8000-000000000204', c_esercizio, null,      current_date + 25,  'Quota manutenzione del verde',         true),
    ('d0000000-0000-4000-8000-000000000205', c_esercizio, null,      current_date + 40,  'Quota riservata, non pubblicata',      false),
    ('d0000000-0000-4000-8000-000000000206', c_esercizio, null,      current_date - 5,   'Quota antenna TV',                     true),
    ('d0000000-0000-4000-8000-000000000209', c_esercizio, c_tabella, current_date + 50,  'Quota assicurazione, secondo semestre', true),
    ('d0000000-0000-4000-8000-000000000210', c_esercizio, null,      current_date + 3,   'Quota giardinaggio',                   true),
    ('d0000000-0000-4000-8000-000000000207', v_prec,      null,      current_date - 400, 'Quota pulizie, anno scorso',           true),
    ('d0000000-0000-4000-8000-000000000208', v_prec,      null,      current_date - 380, 'Quota riscaldamento, anno scorso',     true),
    ('d0000000-0000-4000-8000-000000000211', v_prec,      null,      current_date - 360, 'Quota ascensore, anno scorso',         true),
    ('d0000000-0000-4000-8000-000000000212', v_prec,      null,      current_date - 340, 'Quota giardino, anno scorso',          true)
  on conflict (id) do update
    set data_scadenza = excluded.data_scadenza,
        descrizione   = excluded.descrizione,
        pubblicata    = excluded.pubblicata,
        tabella_millesimale_id = excluded.tabella_millesimale_id;

  -- ---- Interno 1: debitore = utente di prova -------------------------------------------------------
  insert into public.rate_dettaglio (id, rata_testata_id, unita_id, utente_id, importo_dovuto, importo_pagato, stato, data_pagamento) values
    ('d0000000-0000-4000-8000-000000000221', 'd0000000-0000-4000-8000-000000000201', c_unita_1, v_utente_test_id, 320.00,   0.00, 'DA_PAGARE', null),
    ('d0000000-0000-4000-8000-000000000222', 'd0000000-0000-4000-8000-000000000202', c_unita_1, v_utente_test_id, 215.50, 215.50, 'PAGATO',    current_date - 65),
    ('d0000000-0000-4000-8000-000000000223', 'd0000000-0000-4000-8000-000000000203', c_unita_1, v_utente_test_id,  95.00,   0.00, 'RITARDO',   null),
    ('d0000000-0000-4000-8000-000000000224', 'd0000000-0000-4000-8000-000000000204', c_unita_1, v_utente_test_id, 480.00, 150.00, 'DA_PAGARE', null),
    ('d0000000-0000-4000-8000-000000000225', 'd0000000-0000-4000-8000-000000000205', c_unita_1, v_utente_test_id,  55.00,   0.00, 'DA_PAGARE', null),
    ('d0000000-0000-4000-8000-000000000230', 'd0000000-0000-4000-8000-000000000210', c_unita_1, v_utente_test_id,  60.00,   0.00, 'DA_PAGARE', null),
    ('d0000000-0000-4000-8000-000000000231', 'd0000000-0000-4000-8000-000000000207', c_unita_1, v_utente_test_id, 200.00, 200.00, 'PAGATO',    current_date - 395),
    ('d0000000-0000-4000-8000-000000000232', 'd0000000-0000-4000-8000-000000000208', c_unita_1, v_utente_test_id, 175.00,   0.00, 'RITARDO',   null),
    ('d0000000-0000-4000-8000-000000000233', 'd0000000-0000-4000-8000-000000000211', c_unita_1, v_utente_test_id, 150.00, 150.00, 'PAGATO',    current_date - 355),
    ('d0000000-0000-4000-8000-000000000234', 'd0000000-0000-4000-8000-000000000212', c_unita_1, v_utente_test_id,  90.00,  90.00, 'PAGATO',    current_date - 335)
  on conflict do nothing;

  -- Bollettini (percorso nel bucket privato ricevute-rate: <condominio>/<unità>/<file>.pdf, come vuole la policy).
  -- 209: il file va caricato a mano (vedi in alto). 210: il file non esiste mai.
  v_percorso := c_condominio::text || '/' || c_unita_1::text || '/';
  insert into public.rate_dettaglio (id, rata_testata_id, unita_id, utente_id, importo_dovuto, stato, bollettino_url) values
    ('d0000000-0000-4000-8000-000000000229', 'd0000000-0000-4000-8000-000000000209', c_unita_1, v_utente_test_id, 185.00, 'DA_PAGARE', v_percorso || 'bollettino_assicurazione.pdf')
  on conflict do nothing;
  update public.rate_dettaglio set bollettino_url = v_percorso || 'bollettino_giardinaggio.pdf'
   where id = 'd0000000-0000-4000-8000-000000000230';

  -- ---- Interno 2: nessun debitore, non dell'utente di prova (non devono comparire nella sua pagina) -----
  insert into public.rate_dettaglio (id, rata_testata_id, unita_id, utente_id, importo_dovuto, stato) values
    ('d0000000-0000-4000-8000-000000000241', 'd0000000-0000-4000-8000-000000000206', c_unita_2, null,  45.00, 'DA_PAGARE'),
    ('d0000000-0000-4000-8000-000000000242', 'd0000000-0000-4000-8000-000000000201', c_unita_2, null, 280.00, 'DA_PAGARE')
  on conflict do nothing;

  raise notice 'Rate extra pronte. L''utente % deve vedere 16 rate (6 di 03 + 10 di questo script).', v_utente_test_id;
end
$seed$;
