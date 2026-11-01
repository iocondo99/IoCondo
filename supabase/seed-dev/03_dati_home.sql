-- =============================================================================
-- DATI DI PROVA PER LA HOME DEL CONDÒMINO  (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase, DOPO 01_dati_prova.sql, sul progetto di prova (MVP).
-- Aggiunge al "Condominio di Prova": un esercizio con rate (scadute, da pagare, in corso, una pagata, una non
-- pubblicata e alcune di un'altra unità), comunicazioni (una non letta, una di un altro palazzo), documenti,
-- e assemblee (una convocata, una bozza e una conclusa). Nomi, importi e testi sono inventati.
--
-- PRIMA DI ESEGUIRLO
--   Incolla l'UUID dell'utente di prova (lo stesso usato in 01_dati_prova.sql) in v_utente_test_id.
--
-- GARANZIE
--   - Rieseguibile: id fissi (prefisso d0000000-...) e "on conflict do nothing". Nessun duplicato.
--   - Date relative a oggi (current_date): le rate "scadute" restano scadute, le future restano future.
--   - Un'unica transazione; si ferma con un messaggio chiaro se manca il condominio di prova o l'utente.
--   - Per annullare: 04_pulizia_dati_home.sql (prima di 02_pulizia_dati_prova.sql).
--
-- COSA VEDE L'APP (utente di prova, vista Condòmino e portiere)
--   - Spese: cinque rate da pagare, totale EUR 1.635,50 (480,00 + 215,50 scadute; 480,00 + 320,00 future;
--     140,00 residui di una rata pagata in parte), di cui EUR 695,50 scaduti; più una rata pagata in
--     anticipo (badge "Pagato"). La rata non pubblicata e quelle dell'interno 2
--     NON compaiono, anche se l'utente di prova è anche amministratore e le RLS gliele lascerebbero leggere.
--   - Comunicazioni: 3 più recenti, una "Non letto"; la comunicazione del Palazzo B non compare.
--   - Documenti: 5 (4 generali + 1 sull'interno 1); quello dell'interno 2 non conta.
--   - Assemblea: la convocata tra 21 giorni (bozza e conclusa non contano).
--
-- NOTA SULLE POLICY (RLS)
--   Il SQL Editor gira come `postgres` e salta le RLS. Lo script scrive righe che le policy accettano:
--     - rate_testata_select: pubblicata + has_cond_access; rate_dettaglio_select: utente_id = auth.uid()
--       (o utente_id nullo e has_unita_access) oppure is_admin_of;
--     - bacheca_post_select, assemblee_testata_select, cartelle_documenti_select: has_cond_access;
--     - documenti_metadata_select: can_read_documento (nessun permesso esplicito = leggibile da chi ha
--       accesso al condominio, e all'unità se il documento ne ha una);
--     - notifiche_select: utente_id = auth.uid().
--   CHECK rispettati: stato rate in (DA_PAGARE, PAGATO, RITARDO), importi >= 0, esercizio con data_fine >
--   data_inizio e unico per (condominio, anno), assemblea con stato/tipo/modalità ammessi.
--   Le bozze di bacheca non esistono: i post scritti qui hanno come autore l'utente di prova, così un
--   eventuale Database Webhook `notifiche-push` non crea altre notifiche (esclude l'autore).
-- =============================================================================

do $seed$
declare
  -- >>> INCOLLA QUI L'UUID DELL'UTENTE DI PROVA <<<
  v_utente_test_id uuid := null;

  -- creati da 01_dati_prova.sql
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a  constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_unita_1    constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- dell'utente di prova
  c_unita_2    constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- di nessuno (nessun residente)

  -- creati da questo script
  c_palazzo_b  constant uuid := 'd0000000-0000-4000-8000-000000000004';
  c_esercizio  constant uuid := 'd0000000-0000-4000-8000-000000000061';

  v_esercizio uuid;
  v_anno      integer := extract(year from current_date)::integer;
begin
  if v_utente_test_id is null then
    raise exception 'Incolla l''UUID dell''utente di prova nella costante v_utente_test_id (inizio dello script).';
  end if;
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise exception 'L''utente % non esiste in "utenti".', v_utente_test_id;
  end if;
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Manca il condominio di prova: esegui prima 01_dati_prova.sql.';
  end if;
  if not exists (select 1 from public.unita_immobiliari where id in (c_unita_1, c_unita_2)) then
    raise exception 'Mancano le unità di prova: esegui prima 01_dati_prova.sql.';
  end if;

  -- ---- Palazzo B: serve a provare che una comunicazione di un altro palazzo non compare ----------
  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values (c_palazzo_b, c_condominio, 'Palazzo B', 'Via dei Test 3')
  on conflict do nothing;

  -- ---- Esercizio dell'anno corrente (univoco per condominio + anno) ------------------------------
  insert into public.esercizi_contabili (id, condominio_id, anno, data_inizio, data_fine, stato)
  values (c_esercizio, c_condominio, v_anno, make_date(v_anno, 1, 1), make_date(v_anno, 12, 31), 'PREVENTIVO')
  on conflict do nothing;
  select id into v_esercizio from public.esercizi_contabili where condominio_id = c_condominio and anno = v_anno;

  -- ---- Rate (testate): scadute, future, una già pagata in anticipo, una non pubblicata -----------
  insert into public.rate_testata (id, esercizio_id, data_scadenza, descrizione, pubblicata) values
    ('d0000000-0000-4000-8000-000000000071', v_esercizio, current_date - 40, 'Spese ordinarie, terza rata',          true),
    ('d0000000-0000-4000-8000-000000000072', v_esercizio, current_date - 12, 'Conguaglio riscaldamento',             true),
    ('d0000000-0000-4000-8000-000000000073', v_esercizio, current_date + 14, 'Spese ordinarie, quarta rata',         true),
    ('d0000000-0000-4000-8000-000000000074', v_esercizio, current_date + 45, 'Manutenzione del tetto',               true),
    ('d0000000-0000-4000-8000-000000000075', v_esercizio, current_date + 30, 'Assicurazione dello stabile',          true),
    ('d0000000-0000-4000-8000-000000000076', v_esercizio, current_date + 20, 'Fondo di riserva',                     true),
    ('d0000000-0000-4000-8000-000000000077', v_esercizio, current_date + 60, 'Rata non ancora pubblicata',           false)
  on conflict do nothing;

  -- ---- Rate (dettaglio) dell'interno 1: debitore = utente di prova ------------------------------
  insert into public.rate_dettaglio (id, rata_testata_id, unita_id, utente_id, importo_dovuto, importo_pagato, stato, data_pagamento) values
    ('d0000000-0000-4000-8000-000000000081', 'd0000000-0000-4000-8000-000000000071', c_unita_1, v_utente_test_id, 480.00,   0.00, 'RITARDO',   null),
    ('d0000000-0000-4000-8000-000000000082', 'd0000000-0000-4000-8000-000000000072', c_unita_1, v_utente_test_id, 215.50,   0.00, 'DA_PAGARE', null),
    ('d0000000-0000-4000-8000-000000000083', 'd0000000-0000-4000-8000-000000000073', c_unita_1, v_utente_test_id, 480.00,   0.00, 'DA_PAGARE', null),
    ('d0000000-0000-4000-8000-000000000084', 'd0000000-0000-4000-8000-000000000074', c_unita_1, v_utente_test_id, 320.00,   0.00, 'DA_PAGARE', null),
    ('d0000000-0000-4000-8000-000000000085', 'd0000000-0000-4000-8000-000000000075', c_unita_1, v_utente_test_id, 240.00, 100.00, 'DA_PAGARE', null),
    ('d0000000-0000-4000-8000-000000000086', 'd0000000-0000-4000-8000-000000000076', c_unita_1, v_utente_test_id, 500.00, 500.00, 'PAGATO',    current_date - 3),
    ('d0000000-0000-4000-8000-000000000087', 'd0000000-0000-4000-8000-000000000077', c_unita_1, v_utente_test_id, 480.00,   0.00, 'DA_PAGARE', null)
  on conflict do nothing;

  -- ---- Rate dell'interno 2 (nessun debitore, nessun residente): un condòmino senza quell'unità non le vede --
  insert into public.rate_dettaglio (id, rata_testata_id, unita_id, utente_id, importo_dovuto, importo_pagato, stato) values
    ('d0000000-0000-4000-8000-000000000088', 'd0000000-0000-4000-8000-000000000071', c_unita_2, null, 390.00, 0.00, 'RITARDO'),
    ('d0000000-0000-4000-8000-000000000089', 'd0000000-0000-4000-8000-000000000073', c_unita_2, null, 390.00, 0.00, 'DA_PAGARE')
  on conflict do nothing;

  -- ---- Comunicazioni (autore = utente di prova, vedi nota sul webhook) ---------------------------
  insert into public.bacheca_post (id, condominio_id, palazzo_id, autore_id, titolo, corpo, is_pinned, data_pubblicazione) values
    ('d0000000-0000-4000-8000-000000000091', c_condominio, null,        v_utente_test_id, 'Convocazione assemblea ordinaria',
       'L''assemblea ordinaria si terrà nella sala condominiale. L''ordine del giorno è disponibile tra i documenti.', false, now() - interval '1 day'),
    ('d0000000-0000-4000-8000-000000000092', c_condominio, c_palazzo_a, v_utente_test_id, 'Manutenzione ascensore',
       'Intervento programmato nel Palazzo A. L''ascensore resterà fermo per alcune ore: usa le scale.', false, now() - interval '3 days'),
    ('d0000000-0000-4000-8000-000000000093', c_condominio, null,        v_utente_test_id, 'Orari della raccolta differenziata',
       'Da questo mese cambiano i giorni di ritiro della carta e della plastica. Trovi il calendario aggiornato in portineria.', false, now() - interval '8 days'),
    ('d0000000-0000-4000-8000-000000000094', c_condominio, c_palazzo_b, v_utente_test_id, 'Lavori al cortile del Palazzo B',
       'Questa comunicazione riguarda solo il Palazzo B: chi abita nel Palazzo A non deve vederla.', false, now() - interval '2 days')
  on conflict do nothing;

  -- ---- Stato di lettura: l'unico dato reale è la notifica dell'utente collegata al post ----------
  -- Il post "Convocazione assemblea ordinaria" è NON letto; "Manutenzione ascensore" è già letto.
  insert into public.notifiche (id, utente_id, condominio_id, titolo, corpo, tipo, riferimento_tabella, riferimento_id, letta, created_at) values
    ('d0000000-0000-4000-8000-000000000101', v_utente_test_id, c_condominio, 'Convocazione assemblea ordinaria',
       'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post', 'd0000000-0000-4000-8000-000000000091', false, now() - interval '1 day'),
    ('d0000000-0000-4000-8000-000000000102', v_utente_test_id, c_condominio, 'Manutenzione ascensore',
       'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post', 'd0000000-0000-4000-8000-000000000092', true, now() - interval '3 days')
  on conflict do nothing;

  -- ---- Documenti: una cartella, 4 generali, 1 dell'interno 1, 1 dell'interno 2 ------------------
  -- url_storage è solo un percorso di esempio: nel bucket non c'è nessun file (la pagina Documenti non c'è ancora).
  insert into public.cartelle_documenti (id, condominio_id, nome_cartella)
  values ('d0000000-0000-4000-8000-000000000111', c_condominio, 'Documenti di prova')
  on conflict do nothing;

  insert into public.documenti_metadata (id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da) values
    ('d0000000-0000-4000-8000-000000000121', 'd0000000-0000-4000-8000-000000000111', null,      'seed-dev/regolamento.pdf',        'Regolamento condominiale.pdf',   'application/pdf', v_utente_test_id),
    ('d0000000-0000-4000-8000-000000000122', 'd0000000-0000-4000-8000-000000000111', null,      'seed-dev/verbale-precedente.pdf', 'Verbale dell''ultima assemblea.pdf', 'application/pdf', v_utente_test_id),
    ('d0000000-0000-4000-8000-000000000123', 'd0000000-0000-4000-8000-000000000111', null,      'seed-dev/bilancio-preventivo.pdf','Bilancio preventivo.pdf',         'application/pdf', v_utente_test_id),
    ('d0000000-0000-4000-8000-000000000124', 'd0000000-0000-4000-8000-000000000111', null,      'seed-dev/tabelle-millesimali.pdf','Tabelle millesimali.pdf',        'application/pdf', v_utente_test_id),
    ('d0000000-0000-4000-8000-000000000125', 'd0000000-0000-4000-8000-000000000111', c_unita_1, 'seed-dev/bollettino-int1.pdf',    'Bollettino interno 1.pdf',       'application/pdf', v_utente_test_id),
    ('d0000000-0000-4000-8000-000000000126', 'd0000000-0000-4000-8000-000000000111', c_unita_2, 'seed-dev/bollettino-int2.pdf',    'Bollettino interno 2.pdf',       'application/pdf', v_utente_test_id)
  on conflict do nothing;

  -- ---- Assemblee: convocata (si vede), bozza (non si vede), conclusa (non si vede) ---------------
  insert into public.assemblee_testata (id, condominio_id, data, luogo, stato, tipo, modalita) values
    ('d0000000-0000-4000-8000-000000000131', c_condominio, (current_date + 21)::timestamp + time '18:30', 'Sala condominiale', 'CONVOCATA', 'ORDINARIA',     'PRESENZA'),
    ('d0000000-0000-4000-8000-000000000132', c_condominio, (current_date + 10)::timestamp + time '18:00', 'Sala condominiale', 'BOZZA',     'STRAORDINARIA', 'PRESENZA'),
    ('d0000000-0000-4000-8000-000000000133', c_condominio, (current_date - 90)::timestamp + time '18:30', 'Sala condominiale', 'CONCLUSA',  'ORDINARIA',     'PRESENZA')
  on conflict do nothing;

  raise notice 'Dati della Home pronti per il condominio %.', c_condominio;
end
$seed$;
