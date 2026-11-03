-- =============================================================================
-- DATI EXTRA PER LA PAGINA SPESE (/spese e /spese/[id])  (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Usa già l'UUID dell'amministratore/utente di prova: b6e76a6a-bf37-43fd-b00b-efb1cb6921ad
-- Tutti i nomi, le descrizioni e gli importi sono inventati.
--
-- Che cosa predispone (anche se 03_dati_home.sql non fosse ancora stato eseguito):
--   1. Assicura che il "Condominio di Prova" (d0000000-0000-4000-8000-000000000001), il Palazzo A,
--      l'Interno 1, i ruoli (CONDOMINO, PORTIERE, ADMIN) per l'utente b6e76a6a-bf37-43fd-b00b-efb1cb6921ad
--      e la cartella documenti esistano senza creare duplicati.
--   2. Tre esercizi contabili nei 3 stati previsti:
--      - Anno corrente: stato PREVENTIVO con 5 movimenti di spesa (€ 2.715,50).
--      - Anno scorso: stato CONSUNTIVO con 12 movimenti di spesa (€ 11.736,20 su 2 pagine: 10 + 2 righe).
--      - Due anni fa: stato CHIUSO con 3 movimenti di spesa (€ 7.620,00).
--   3. Un piano dei conti con 4 macro-categorie (A, B, C, D) e 8 sottoconti.
--   4. Due riferimenti in `documenti_metadata` collegati tramite `doc_allegato_id`:
--      - `fattura_ascensore_consuntivo.pdf`: compare nella sezione "Documento allegato" SOLO se carichi
--        davvero il file nel bucket `documenti-condominio` al percorso:
--          d0000000-0000-4000-8000-000000000001/fatture/fattura_ascensore_consuntivo.pdf
--      - `fattura_fantasma_non_caricata.pdf`: non caricata nello Storage -> non deve mai comparire.
--   5. Un movimento con segno '+' (incasso rata) sull'esercizio in corso: non è una spesa e non deve
--      comparire né sommarsi ai totali della pagina Spese.
--   6. Un secondo condominio ("Z - Condominio Isolato Spese") con un esercizio contabile proprio
--      (`d0000000-0000-4000-8000-000000000491`) per verificare che aprendo `/spese/d0000000-0000-4000-8000-000000000491`
--      col "Condominio di Prova" selezionato compaia `NonAutorizzato` con lo stesso messaggio di un id inesistente.
--
-- GARANZIE:
--   - Rieseguibile senza duplicati (`on conflict`).
--   - Rispetta tutti i vincoli (`admin_id not null`, `check`, `unique`) e i trigger (`trg_set_updated_at`).
--   - Per annullare: eseguire `supabase/seed-dev/spese_extra_pulizia.sql`.
-- =============================================================================

do $seed_spese$
declare
  -- UUID dell'amministratore / utente di prova
  v_utente_test_id   uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_altro_admin_id   uuid;

  -- id fissi condivisi con 01_dati_prova.sql e 03_dati_home.sql
  c_condominio       constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a        constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_unita_1          constant uuid := 'd0000000-0000-4000-8000-000000000011';
  c_ruolo_cond       constant uuid := 'd0000000-0000-4000-8000-000000000021';
  c_ruolo_port       constant uuid := 'd0000000-0000-4000-8000-000000000022';
  c_ruolo_admin      constant uuid := 'd0000000-0000-4000-8000-000000000023';
  c_anagrafica       constant uuid := 'd0000000-0000-4000-8000-000000000031';
  c_config           constant uuid := 'd0000000-0000-4000-8000-000000000041';
  c_esercizio_corr   constant uuid := 'd0000000-0000-4000-8000-000000000061';
  c_cartella_doc     constant uuid := 'd0000000-0000-4000-8000-000000000111';

  -- id fissi creati da questo script (prefisso 4xx)
  c_esercizio_cons   constant uuid := 'd0000000-0000-4000-8000-000000000401';
  c_esercizio_chiuso constant uuid := 'd0000000-0000-4000-8000-000000000402';

  c_condominio_altro constant uuid := 'd0000000-0000-4000-8000-000000000490';
  c_esercizio_altro  constant uuid := 'd0000000-0000-4000-8000-000000000491';

  c_macro_a          constant uuid := 'd0000000-0000-4000-8000-000000000411';
  c_macro_b          constant uuid := 'd0000000-0000-4000-8000-000000000412';
  c_macro_c          constant uuid := 'd0000000-0000-4000-8000-000000000413';
  c_macro_d          constant uuid := 'd0000000-0000-4000-8000-000000000414';

  c_sc_compenso      constant uuid := 'd0000000-0000-4000-8000-000000000421';
  c_sc_assicurazione constant uuid := 'd0000000-0000-4000-8000-000000000422';
  c_sc_ascensore_ord constant uuid := 'd0000000-0000-4000-8000-000000000423';
  c_sc_ascensore_ver constant uuid := 'd0000000-0000-4000-8000-000000000424';
  c_sc_pulizia       constant uuid := 'd0000000-0000-4000-8000-000000000425';
  c_sc_giardino      constant uuid := 'd0000000-0000-4000-8000-000000000426';
  c_sc_luce          constant uuid := 'd0000000-0000-4000-8000-000000000427';
  c_sc_acqua         constant uuid := 'd0000000-0000-4000-8000-000000000428';

  c_doc_allegato_ok  constant uuid := 'd0000000-0000-4000-8000-000000000431';
  c_doc_fantasma     constant uuid := 'd0000000-0000-4000-8000-000000000432';

  v_anno              integer := extract(year from current_date)::integer;
  v_id_corrente       uuid;
  v_id_consuntivo     uuid;
  v_id_chiuso         uuid;
  v_id_macro_a        uuid;
  v_id_macro_b        uuid;
  v_id_macro_c        uuid;
  v_id_macro_d        uuid;
  v_ruolo_condomino   uuid;
  v_ruolo_portiere    uuid;
  v_ruolo_admin       uuid;
  v_tipo_appartamento uuid;
begin
  -- Verifica che l'utente esista in public.utenti (se non trovato, usa l'admin del condominio di prova)
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    select admin_id into v_utente_test_id from public.condomini where id = c_condominio;
  end if;
  if v_utente_test_id is null or not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise exception 'L''utente % non esiste in public.utenti. Verifica che sia registrato in Authentication > Users.', 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  end if;

  -- ---- Assicura la struttura base del Condominio di Prova (se 01_dati_prova.sql non è ancora stato eseguito) ----
  insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, provincia)
  values (c_condominio, v_utente_test_id, 'Condominio di Prova', 'CONDOMINIO', 'Via dei Test 1', 'Cittadiprova', '00000', 'XX')
  on conflict (id) do nothing;

  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values (c_palazzo_a, c_condominio, 'Palazzo A', 'Via dei Test 1')
  on conflict (id) do nothing;

  select id into v_tipo_appartamento from public.tipologie_unita where descrizione = 'Appartamento' limit 1;
  if v_tipo_appartamento is not null then
    insert into public.unita_immobiliari (id, palazzo_id, tipologia_id, interno, piano, mq)
    values (c_unita_1, c_palazzo_a, v_tipo_appartamento, '1', 1, 80)
    on conflict do nothing;

    insert into public.anagrafiche_unita (id, unita_id, utente_id, tipo_possesso, quota_possesso)
    select c_anagrafica, c_unita_1, v_utente_test_id, 'PROPRIETARIO', 100
    where not exists (
      select 1 from public.anagrafiche_unita
      where unita_id = c_unita_1 and utente_id = v_utente_test_id and data_fine is null
    )
    on conflict do nothing;
  end if;

  select id into v_ruolo_condomino from public.ruoli_piattaforma where codice = 'CONDOMINO';
  select id into v_ruolo_portiere  from public.ruoli_piattaforma where codice = 'PORTIERE';
  select id into v_ruolo_admin     from public.ruoli_piattaforma where codice = 'ADMIN';

  if v_ruolo_condomino is not null and exists (select 1 from public.unita_immobiliari where id = c_unita_1) then
    insert into public.utente_entita_ruolo (id, utente_id, ruolo_id, condominio_id, unita_id)
    select c_ruolo_cond, v_utente_test_id, v_ruolo_condomino, c_condominio, c_unita_1
    where not exists (
      select 1 from public.utente_entita_ruolo
      where utente_id = v_utente_test_id and ruolo_id = v_ruolo_condomino and condominio_id = c_condominio
    )
    on conflict do nothing;
  end if;

  if v_ruolo_portiere is not null then
    insert into public.utente_entita_ruolo (id, utente_id, ruolo_id, condominio_id)
    select c_ruolo_port, v_utente_test_id, v_ruolo_portiere, c_condominio
    where not exists (
      select 1 from public.utente_entita_ruolo
      where utente_id = v_utente_test_id and ruolo_id = v_ruolo_portiere and condominio_id = c_condominio
    )
    on conflict do nothing;
  end if;

  if v_ruolo_admin is not null then
    insert into public.utente_entita_ruolo (id, utente_id, ruolo_id, condominio_id)
    select c_ruolo_admin, v_utente_test_id, v_ruolo_admin, c_condominio
    where not exists (
      select 1 from public.utente_entita_ruolo
      where utente_id = v_utente_test_id and ruolo_id = v_ruolo_admin and condominio_id = c_condominio
    )
    on conflict do nothing;
  end if;

  insert into public.configurazioni_condominio (id, condominio_id)
  select c_config, c_condominio
  where not exists (
    select 1 from public.configurazioni_condominio where condominio_id = c_condominio and palazzo_id is null
  )
  on conflict do nothing;

  -- ---- Esercizi contabili del Condominio di Prova: anno corrente (PREVENTIVO), anno scorso (CONSUNTIVO), due anni fa (CHIUSO) ----
  insert into public.esercizi_contabili (id, condominio_id, anno, data_inizio, data_fine, stato)
  values (
    c_esercizio_corr,
    c_condominio,
    v_anno,
    make_date(v_anno, 1, 1),
    make_date(v_anno, 12, 31),
    'PREVENTIVO'
  )
  on conflict (condominio_id, anno) do update
    set stato = 'PREVENTIVO';

  select id into v_id_corrente
    from public.esercizi_contabili
   where condominio_id = c_condominio and anno = v_anno;

  insert into public.esercizi_contabili (id, condominio_id, anno, data_inizio, data_fine, stato)
  values (
    c_esercizio_cons,
    c_condominio,
    v_anno - 1,
    make_date(v_anno - 1, 1, 1),
    make_date(v_anno - 1, 12, 31),
    'CONSUNTIVO'
  )
  on conflict (condominio_id, anno) do update
    set stato = 'CONSUNTIVO';

  select id into v_id_consuntivo
    from public.esercizi_contabili
   where condominio_id = c_condominio and anno = v_anno - 1;

  insert into public.esercizi_contabili (id, condominio_id, anno, data_inizio, data_fine, stato)
  values (
    c_esercizio_chiuso,
    c_condominio,
    v_anno - 2,
    make_date(v_anno - 2, 1, 1),
    make_date(v_anno - 2, 12, 31),
    'CHIUSO'
  )
  on conflict (condominio_id, anno) do update
    set stato = 'CHIUSO';

  select id into v_id_chiuso
    from public.esercizi_contabili
   where condominio_id = c_condominio and anno = v_anno - 2;

  -- ---- Secondo condominio ed esercizio isolato (admin_id obbligatorio: usa un altro utente se presente, altrimenti v_utente_test_id) ----
  select u.id into v_altro_admin_id
    from public.utenti u
   where u.id <> v_utente_test_id
   order by u.is_superadmin desc, u.created_at asc
   limit 1;
  v_altro_admin_id := coalesce(v_altro_admin_id, v_utente_test_id);

  insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, provincia, codice_fiscale)
  values (
    c_condominio_altro,
    v_altro_admin_id,
    'Z - Condominio Isolato Spese',
    'CONDOMINIO',
    'Via delle Magnolie 99',
    'Torino',
    '10100',
    'TO',
    '99000000099'
  )
  on conflict (id) do update
    set admin_id = excluded.admin_id,
        nome     = excluded.nome;

  insert into public.esercizi_contabili (id, condominio_id, anno, data_inizio, data_fine, stato)
  values (
    c_esercizio_altro,
    c_condominio_altro,
    v_anno,
    make_date(v_anno, 1, 1),
    make_date(v_anno, 12, 31),
    'CONSUNTIVO'
  )
  on conflict (condominio_id, anno) do nothing;

  -- ---- Piano dei conti (4 macro-categorie) -----------------------------------------------------------
  insert into public.piano_dei_conti (id, condominio_id, codice, descrizione_macro) values
    (c_macro_a, c_condominio, 'A', 'Spese generali e amministrazione'),
    (c_macro_b, c_condominio, 'B', 'Ascensore e impianti'),
    (c_macro_c, c_condominio, 'C', 'Pulizia e igiene'),
    (c_macro_d, c_condominio, 'D', 'Utenze e consumi')
  on conflict (condominio_id, codice) do update
    set descrizione_macro = excluded.descrizione_macro;

  select id into v_id_macro_a from public.piano_dei_conti where condominio_id = c_condominio and codice = 'A';
  select id into v_id_macro_b from public.piano_dei_conti where condominio_id = c_condominio and codice = 'B';
  select id into v_id_macro_c from public.piano_dei_conti where condominio_id = c_condominio and codice = 'C';
  select id into v_id_macro_d from public.piano_dei_conti where condominio_id = c_condominio and codice = 'D';

  -- ---- Sottoconti ------------------------------------------------------------------------------------
  insert into public.sottoconti (id, piano_conto_id, descrizione_micro) values
    (c_sc_compenso,      v_id_macro_a, 'Compenso amministratore'),
    (c_sc_assicurazione, v_id_macro_a, 'Polizza assicurativa fabbricato'),
    (c_sc_ascensore_ord, v_id_macro_b, 'Manutenzione ordinaria ascensore'),
    (c_sc_ascensore_ver, v_id_macro_b, 'Verifiche periodiche ascensore'),
    (c_sc_pulizia,       v_id_macro_c, 'Pulizia scale e atrio'),
    (c_sc_giardino,      v_id_macro_c, 'Cura del giardino'),
    (c_sc_luce,          v_id_macro_d, 'Energia elettrica parti comuni'),
    (c_sc_acqua,         v_id_macro_d, 'Fornitura acqua condominiale')
  on conflict (id) do update
    set piano_conto_id    = excluded.piano_conto_id,
        descrizione_micro = excluded.descrizione_micro;

  -- ---- Cartella documenti e metadati allegati per test `doc_allegato_id` -----------------------------
  insert into public.cartelle_documenti (id, condominio_id, nome_cartella)
  values (c_cartella_doc, c_condominio, 'Documenti di prova')
  on conflict (id) do nothing;

  insert into public.documenti_metadata (id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da)
  values
    (
      c_doc_allegato_ok,
      c_cartella_doc,
      null,
      c_condominio::text || '/fatture/fattura_ascensore_consuntivo.pdf',
      'fattura_ascensore_consuntivo.pdf',
      'application/pdf',
      v_utente_test_id
    ),
    (
      c_doc_fantasma,
      c_cartella_doc,
      null,
      c_condominio::text || '/fatture/fattura_fantasma_non_caricata.pdf',
      'fattura_fantasma_non_caricata.pdf',
      'application/pdf',
      v_utente_test_id
    )
  on conflict (id) do update
    set cartella_id = excluded.cartella_id,
        url_storage = excluded.url_storage,
        nome_file   = excluded.nome_file,
        tipo_mime   = excluded.tipo_mime,
        caricato_da = excluded.caricato_da;

  -- ---- Movimenti di spesa: Esercizio in corso (PREVENTIVO, 5 spese + 1 incasso '+') -------------------
  insert into public.movimenti_contabili
    (id, esercizio_id, data, importo, segno, sottoconto_id, descrizione, doc_allegato_id)
  values
    ('d0000000-0000-4000-8000-000000000441', v_id_corrente, make_date(v_anno, 1, 15), 1150.00, '-', c_sc_assicurazione, 'Premio semestrale polizza globale fabbricato', null),
    ('d0000000-0000-4000-8000-000000000442', v_id_corrente, make_date(v_anno, 2, 10),  640.00, '-', c_sc_ascensore_ord, 'Canone primo trimestre manutenzione ascensore', null),
    ('d0000000-0000-4000-8000-000000000443', v_id_corrente, make_date(v_anno, 2, 28),  420.00, '-', c_sc_pulizia,       'Servizio pulizia scale bimestre gen-feb', null),
    ('d0000000-0000-4000-8000-000000000444', v_id_corrente, make_date(v_anno, 3, 12),  310.50, '-', c_sc_luce,          'Fornitura energia elettrica scale e cortile', null),
    ('d0000000-0000-4000-8000-000000000445', v_id_corrente, make_date(v_anno, 3, 25),  195.00, '-', c_sc_giardino,      'Potatura siepi e sfalcio prato primaverile', null),
    ('d0000000-0000-4000-8000-000000000446', v_id_corrente, make_date(v_anno, 1, 20),  500.00, '+', null,               'Incasso quota condominiale di prova (non spesa)', null)
  on conflict (id) do update
    set esercizio_id    = excluded.esercizio_id,
        data            = excluded.data,
        importo         = excluded.importo,
        segno           = excluded.segno,
        sottoconto_id   = excluded.sottoconto_id,
        descrizione     = excluded.descrizione,
        doc_allegato_id = excluded.doc_allegato_id;

  -- ---- Movimenti di spesa: Esercizio anno scorso (CONSUNTIVO, 12 spese -> 2 pagine) ------------------
  insert into public.movimenti_contabili
    (id, esercizio_id, data, importo, segno, sottoconto_id, descrizione, doc_allegato_id)
  values
    (
      'd0000000-0000-4000-8000-000000000451',
      v_id_consuntivo,
      make_date(v_anno - 1, 1, 18),
      2200.00,
      '-',
      c_sc_assicurazione,
      'Polizza assicurativa annuale fabbricato',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000452',
      v_id_consuntivo,
      make_date(v_anno - 1, 2, 14),
      1280.00,
      '-',
      c_sc_ascensore_ord,
      'Canone manutenzione ascensore primo semestre',
      c_doc_allegato_ok
    ),
    (
      'd0000000-0000-4000-8000-000000000453',
      v_id_consuntivo,
      make_date(v_anno - 1, 3, 5),
      840.00,
      '-',
      c_sc_pulizia,
      'Pulizia scale e atrio primo trimestre',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000454',
      v_id_consuntivo,
      make_date(v_anno - 1, 4, 10),
      590.40,
      '-',
      c_sc_luce,
      'Bolletta energia elettrica primo trimestre',
      c_doc_fantasma
    ),
    (
      'd0000000-0000-4000-8000-000000000455',
      v_id_consuntivo,
      make_date(v_anno - 1, 5, 22),
      380.00,
      '-',
      c_sc_giardino,
      'Manutenzione verde e impianto irrigazione',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000456',
      v_id_consuntivo,
      make_date(v_anno - 1, 6, 15),
      840.00,
      '-',
      c_sc_pulizia,
      'Pulizia scale e atrio secondo trimestre',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000457',
      v_id_consuntivo,
      make_date(v_anno - 1, 7, 9),
      710.20,
      '-',
      c_sc_acqua,
      'Conguaglio fornitura idrica primo semestre',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000458',
      v_id_consuntivo,
      make_date(v_anno - 1, 8, 28),
      1280.00,
      '-',
      c_sc_ascensore_ord,
      'Canone manutenzione ascensore secondo semestre',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000459',
      v_id_consuntivo,
      make_date(v_anno - 1, 9, 19),
      840.00,
      '-',
      c_sc_pulizia,
      'Pulizia scale e atrio terzo trimestre',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000460',
      v_id_consuntivo,
      make_date(v_anno - 1, 10, 11),
      450.00,
      '-',
      c_sc_ascensore_ver,
      'Verifica biennale di sicurezza impianto ascensore',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000461',
      v_id_consuntivo,
      make_date(v_anno - 1, 11, 14),
      625.60,
      '-',
      c_sc_luce,
      'Bolletta energia elettrica secondo semestre',
      null
    ),
    (
      'd0000000-0000-4000-8000-000000000462',
      v_id_consuntivo,
      make_date(v_anno - 1, 12, 20),
      1800.00,
      '-',
      c_sc_compenso,
      'Compenso annuale gestione amministrativa',
      null
    )
  on conflict (id) do update
    set esercizio_id    = excluded.esercizio_id,
        data            = excluded.data,
        importo         = excluded.importo,
        segno           = excluded.segno,
        sottoconto_id   = excluded.sottoconto_id,
        descrizione     = excluded.descrizione,
        doc_allegato_id = excluded.doc_allegato_id;

  -- ---- Movimenti di spesa: Esercizio due anni fa (CHIUSO, 3 spese) -----------------------------------
  insert into public.movimenti_contabili
    (id, esercizio_id, data, importo, segno, sottoconto_id, descrizione, doc_allegato_id)
  values
    ('d0000000-0000-4000-8000-000000000471', v_id_chiuso, make_date(v_anno - 2, 3, 15), 2100.00, '-', c_sc_assicurazione, 'Polizza globale fabbricato esercizio chiuso', null),
    ('d0000000-0000-4000-8000-000000000472', v_id_chiuso, make_date(v_anno - 2, 7, 10), 2400.00, '-', c_sc_ascensore_ord, 'Canone annuale manutenzione ascensore', null),
    ('d0000000-0000-4000-8000-000000000473', v_id_chiuso, make_date(v_anno - 2, 11, 30), 3120.00, '-', c_sc_pulizia,       'Servizio annuale pulizia parti comuni', null)
  on conflict (id) do update
    set esercizio_id    = excluded.esercizio_id,
        data            = excluded.data,
        importo         = excluded.importo,
        segno           = excluded.segno,
        sottoconto_id   = excluded.sottoconto_id,
        descrizione     = excluded.descrizione,
        doc_allegato_id = excluded.doc_allegato_id;

  raise notice 'Dati extra Spese pronti per l''utente %: esercizi % (preventivo: %), % (consuntivo: %) e % (chiuso: %).',
    v_utente_test_id, v_anno, v_id_corrente, v_anno - 1, v_id_consuntivo, v_anno - 2, v_id_chiuso;
end
$seed_spese$;
