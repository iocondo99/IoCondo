-- =============================================================================
-- DATI EXTRA PER SEGNALAZIONI (/segnalazioni, /segnalazioni/[id], /ticket-aree-comuni)  (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase. NON viene eseguito dall'agente.
-- Usa l'UUID dell'utente di prova: b6e76a6a-bf37-43fd-b00b-efb1cb6921ad
-- Tutti i nomi, i percorsi e le date sono inventati.
--
-- Che cosa predispone (anche se gli altri seed non fossero stati eseguiti):
--   1. Struttura base del "Condominio di Prova" (d0000000-0000-4000-8000-000000000001), Palazzo A,
--      Unità 1 (dell'utente di prova) e Unità 2 (di un altro condomino).
--   2. Categorie guasti (categorie_guasti, nome univoco): Idraulica, Elettrica, Ascensore, Serramenti, Aree verdi.
--   3. Segnalazioni visibili al condòmino dell'Unità 1 (11 in tutto): stati APERTO, LAVORAZIONE e RISOLTO,
--      priorità BASSA/MEDIA/ALTA/URGENTE, sia sull'Unità 1 sia su aree comuni aperte dall'utente
--      (paginazione oltre 10 righe).
--   4. Ticket di area comune aperti da altri (…620, …621): li vede solo il portiere in /ticket-aree-comuni,
--      NON il condòmino.
--   5. Messaggi (ticket_messaggi) e allegati di prova (ticket_allegati, tipo FOTO). I file NON sono caricati nello
--      Storage: il dettaglio deve mostrare "Foto non ancora disponibile nello spazio di archiviazione". Per vedere la foto,
--      caricare un'immagine nel bucket `foto-guasti` al percorso:
--        d0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000611/foto_perdita.jpg
--   6. Un ticket dell'Unità 2 (…631): NON deve comparire nell'elenco né nei contatori del condòmino
--      dell'Unità 1 (nemmeno se ha ruolo ADMIN); /segnalazioni/<id> deve mostrare
--      "Questa segnalazione non è disponibile".
--   7. Un ticket di un secondo condominio isolato (…690 / ticket …691) che NON deve comparire con il
--      "Condominio di Prova" attivo e deve mostrare lo stesso stato di non disponibilità.
--
-- NOTA: l'inserimento di un ticket con unita_id attiva il trigger trg_log_storico_ticket, che scrive in
-- log_storico_immobile (la pulizia rimuove anche quelle righe).
--
-- GARANZIE: idempotente e rieseguibile senza duplicati (`on conflict do nothing`).
-- Per annullare: eseguire `supabase/seed-dev/segnalazioni_extra_pulizia.sql`.
-- =============================================================================

do $seed_segnalazioni$
declare
  v_utente_test_id   uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_altro_admin_id   uuid;

  c_condominio       constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a        constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_unita_1          constant uuid := 'd0000000-0000-4000-8000-000000000011';
  c_unita_2          constant uuid := 'd0000000-0000-4000-8000-000000000012';
  c_anagrafica       constant uuid := 'd0000000-0000-4000-8000-000000000031';

  c_condominio_altro constant uuid := 'd0000000-0000-4000-8000-000000000690';

  v_tipo_appartamento uuid;
  v_cat_idraulica     uuid;
  v_cat_elettrica     uuid;
  v_cat_ascensore     uuid;
  v_cat_serramenti    uuid;
  v_cat_verde         uuid;
begin
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    select admin_id into v_utente_test_id from public.condomini where id = c_condominio;
  end if;
  if v_utente_test_id is null or not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise exception 'L''utente % non esiste in public.utenti. Verifica che sia registrato in Authentication > Users.', 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  end if;

  -- ---- 1. Struttura base -------------------------------------------------------------------------
  insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, provincia)
  values (c_condominio, v_utente_test_id, 'Condominio di Prova', 'CONDOMINIO', 'Via dei Test 1', 'Cittadiprova', '00000', 'XX')
  on conflict (id) do nothing;

  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values (c_palazzo_a, c_condominio, 'Palazzo A', 'Via dei Test 1')
  on conflict (id) do nothing;

  select id into v_tipo_appartamento from public.tipologie_unita where descrizione = 'Appartamento' limit 1;
  if v_tipo_appartamento is not null then
    insert into public.unita_immobiliari (id, palazzo_id, tipologia_id, interno, piano, mq) values
      (c_unita_1, c_palazzo_a, v_tipo_appartamento, '1', 1, 80),
      (c_unita_2, c_palazzo_a, v_tipo_appartamento, '2', 1, 75)
    on conflict do nothing;

    insert into public.anagrafiche_unita (id, unita_id, utente_id, tipo_possesso, quota_possesso)
    select c_anagrafica, c_unita_1, v_utente_test_id, 'PROPRIETARIO', 100
    where not exists (
      select 1 from public.anagrafiche_unita
      where unita_id = c_unita_1 and utente_id = v_utente_test_id and data_fine is null
    )
    on conflict do nothing;
  end if;

  -- ---- 2. Categorie guasti -----------------------------------------------------------------------
  insert into public.categorie_guasti (nome) values
    ('Idraulica'), ('Elettrica'), ('Ascensore'), ('Serramenti'), ('Aree verdi')
  on conflict (nome) do nothing;

  select id into v_cat_idraulica  from public.categorie_guasti where nome = 'Idraulica';
  select id into v_cat_elettrica  from public.categorie_guasti where nome = 'Elettrica';
  select id into v_cat_ascensore  from public.categorie_guasti where nome = 'Ascensore';
  select id into v_cat_serramenti from public.categorie_guasti where nome = 'Serramenti';
  select id into v_cat_verde      from public.categorie_guasti where nome = 'Aree verdi';

  -- ---- 3. Segnalazioni visibili al condòmino dell'Unità 1 ----------------------------------------
  insert into public.ticket_testata
    (id, condominio_id, unita_id, segnalatore_id, categoria_id, titolo, descrizione, is_area_comune, priorita, stato, created_at, updated_at, closed_at)
  values
    ('d0000000-0000-4000-8000-000000000611', c_condominio, c_unita_1, v_utente_test_id, v_cat_idraulica,
      'Perdita d''acqua sotto il lavello', 'Dal sifone della cucina cade acqua da due giorni.', false, 'ALTA', 'APERTO',
      now() - interval '1 day', now() - interval '1 day', null),
    ('d0000000-0000-4000-8000-000000000612', c_condominio, c_unita_1, v_utente_test_id, v_cat_elettrica,
      'Citofono non funzionante', 'Il citofono non squilla più da lunedì.', false, 'MEDIA', 'LAVORAZIONE',
      now() - interval '3 days', now() - interval '1 day', null),
    ('d0000000-0000-4000-8000-000000000613', c_condominio, c_unita_1, v_utente_test_id, v_cat_elettrica,
      'Lampadina bruciata sul pianerottolo', 'La luce del pianerottolo è spenta.', false, 'BASSA', 'RISOLTO',
      now() - interval '20 days', now() - interval '18 days', now() - interval '18 days'),
    ('d0000000-0000-4000-8000-000000000614', c_condominio, c_unita_1, v_utente_test_id, v_cat_idraulica,
      'Infiltrazione dal soffitto del bagno', 'Macchia umida che si allarga sul soffitto.', false, 'URGENTE', 'APERTO',
      now() - interval '4 hours', now() - interval '4 hours', null),
    ('d0000000-0000-4000-8000-000000000615', c_condominio, c_unita_1, v_utente_test_id, v_cat_serramenti,
      'Serratura del portoncino che si blocca', 'La chiave gira con fatica.', false, 'ALTA', 'LAVORAZIONE',
      now() - interval '6 days', now() - interval '2 days', null),
    ('d0000000-0000-4000-8000-000000000616', c_condominio, c_unita_1, v_utente_test_id, v_cat_serramenti,
      'Zanzariera da sostituire', 'La rete della zanzariera è strappata.', false, 'MEDIA', 'RISOLTO',
      now() - interval '40 days', now() - interval '35 days', now() - interval '35 days'),
    ('d0000000-0000-4000-8000-000000000617', c_condominio, null, v_utente_test_id, v_cat_ascensore,
      'Ascensore rumoroso', 'Durante la salita si sente un forte stridio.', true, 'MEDIA', 'APERTO',
      now() - interval '2 days', now() - interval '2 days', null),
    ('d0000000-0000-4000-8000-000000000618', c_condominio, null, v_utente_test_id, v_cat_elettrica,
      'Luce dell''androne intermittente', 'La luce dell''androne si accende e spegne.', true, 'BASSA', 'RISOLTO',
      now() - interval '30 days', now() - interval '27 days', now() - interval '27 days'),
    ('d0000000-0000-4000-8000-000000000619', c_condominio, null, v_utente_test_id, v_cat_serramenti,
      'Cancello carraio lento', 'Il cancello impiega molto ad aprirsi.', true, 'ALTA', 'LAVORAZIONE',
      now() - interval '8 days', now() - interval '3 days', null),
    ('d0000000-0000-4000-8000-000000000622', c_condominio, c_unita_1, v_utente_test_id, v_cat_serramenti,
      'Tapparella che non scende', 'La tapparella del soggiorno si inceppa.', false, 'BASSA', 'APERTO',
      now() - interval '10 days', now() - interval '10 days', null)
  on conflict (id) do nothing;

  -- ---- 4. Ticket di area comune aperti da altri (solo portiere) ----------------------------------
  insert into public.ticket_testata
    (id, condominio_id, unita_id, segnalatore_id, categoria_id, titolo, descrizione, is_area_comune, priorita, stato, created_at, updated_at, closed_at)
  values
    ('d0000000-0000-4000-8000-000000000620', c_condominio, null, null, v_cat_serramenti,
      'Porta del garage non si chiude (area comune, solo portiere)', 'Segnalata da un altro condomino.', true, 'MEDIA', 'APERTO',
      now() - interval '5 days', now() - interval '5 days', null),
    ('d0000000-0000-4000-8000-000000000621', c_condominio, null, null, v_cat_verde,
      'Siepe del giardino da potare (area comune, solo portiere)', 'La siepe invade il vialetto.', true, 'BASSA', 'LAVORAZIONE',
      now() - interval '12 days', now() - interval '4 days', null)
  on conflict (id) do nothing;

  -- ---- 5. Messaggi e allegati di prova -----------------------------------------------------------
  insert into public.ticket_messaggi (id, ticket_id, mittente_id, messaggio, "timestamp") values
    ('d0000000-0000-4000-8000-000000000641', 'd0000000-0000-4000-8000-000000000611', v_utente_test_id,
      'Ho messo un secchio sotto il sifone in attesa dell''intervento.', now() - interval '20 hours'),
    ('d0000000-0000-4000-8000-000000000642', 'd0000000-0000-4000-8000-000000000612', v_utente_test_id,
      'Il problema è presente anche al secondo citofono.', now() - interval '2 days'),
    ('d0000000-0000-4000-8000-000000000643', 'd0000000-0000-4000-8000-000000000617', v_utente_test_id,
      'Il rumore è peggiorato stamattina.', now() - interval '1 day')
  on conflict (id) do nothing;

  insert into public.ticket_allegati (id, ticket_id, url_storage, tipo_file, caricato_da) values
    ('d0000000-0000-4000-8000-000000000651', 'd0000000-0000-4000-8000-000000000611',
      'd0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000611/foto_perdita.jpg', 'FOTO', v_utente_test_id),
    ('d0000000-0000-4000-8000-000000000652', 'd0000000-0000-4000-8000-000000000611',
      'd0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000611/foto_sifone.jpg', 'FOTO', v_utente_test_id),
    ('d0000000-0000-4000-8000-000000000653', 'd0000000-0000-4000-8000-000000000617',
      'd0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000617/foto_ascensore.jpg', 'FOTO', v_utente_test_id)
  on conflict (id) do nothing;

  -- ---- 6. Ticket dell'Unità 2: NON deve comparire al condòmino dell'Unità 1 ----------------------
  insert into public.ticket_testata
    (id, condominio_id, unita_id, segnalatore_id, categoria_id, titolo, descrizione, is_area_comune, priorita, stato, created_at, updated_at)
  values
    ('d0000000-0000-4000-8000-000000000631', c_condominio, c_unita_2, null, v_cat_idraulica,
      'Ticket riservato Int. 2 (non deve comparire)', 'Segnalazione dell''altra unità.', false, 'MEDIA', 'APERTO',
      now() - interval '1 day', now() - interval '1 day')
  on conflict (id) do nothing;

  -- ---- 7. Secondo condominio isolato -------------------------------------------------------------
  select id into v_altro_admin_id from public.utenti where id <> v_utente_test_id limit 1;
  if v_altro_admin_id is null then
    v_altro_admin_id := v_utente_test_id;
  end if;

  insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, provincia)
  values (c_condominio_altro, v_altro_admin_id, 'Z - Condominio Isolato Segnalazioni', 'CONDOMINIO', 'Via Isolata 98', 'Altracitta', '99998', 'ZZ')
  on conflict (id) do nothing;

  insert into public.ticket_testata
    (id, condominio_id, unita_id, segnalatore_id, categoria_id, titolo, descrizione, is_area_comune, priorita, stato, created_at, updated_at)
  values
    ('d0000000-0000-4000-8000-000000000691', c_condominio_altro, null, v_altro_admin_id, v_cat_verde,
      'Ticket altro condominio (non deve comparire)', 'Segnalazione di un altro condominio.', true, 'MEDIA', 'APERTO',
      now() - interval '1 day', now() - interval '1 day')
  on conflict (id) do nothing;

  raise notice 'Dati extra Segnalazioni pronti per il condominio %.', c_condominio;
end
$seed_segnalazioni$;

