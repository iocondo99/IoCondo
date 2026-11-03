-- =============================================================================
-- DATI EXTRA PER LA PAGINA DOCUMENTI (/documenti e /documenti/[id])  (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Usa l'UUID dell'amministratore/utente di prova: b6e76a6a-bf37-43fd-b00b-efb1cb6921ad
-- Tutti i nomi, i percorsi e le date sono inventati.
--
-- Che cosa predispone (anche se 03_dati_home.sql non fosse ancora stato eseguito):
--   1. Assicura la struttura base del "Condominio di Prova" (d0000000-0000-4000-8000-000000000001),
--      il Palazzo A, l'Unità 1 (dell'utente di prova) e l'Unità 2 (di un altro condomino / nessun residente).
--   2. Quattro cartelle tematiche nel "Condominio di Prova":
--      - Regolamenti e tabelle (d0000000-0000-4000-8000-000000000501)
--      - Verbali assemblea     (d0000000-0000-4000-8000-000000000502)
--      - Bilanci e preventivi  (d0000000-0000-4000-8000-000000000503)
--      - Polizze e contratti   (d0000000-0000-4000-8000-000000000504)
--   3. Dodici documenti visibili al residente dell'Unità 1 (10 condominiali con unita_id IS NULL +
--      2 riservati all'Unità 1) per verificare:
--      - StatCard reali (totale, condominiali, della tua unità);
--      - FilterChips per cartella ("Tutte" + le cartelle del condominio);
--      - SearchBar per nome file o cartella;
--      - ordinamento per Data e Nome (crescente/decrescente);
--      - paginazione oltre 10 righe (2 pagine);
--      - dettaglio `/documenti/[id]` con stato chiaro "File non ancora disponibile nello spazio di archiviazione"
--        quando il PDF non è stato caricato nello Storage, oppure scaricamento con `createSignedUrl` (600 s)
--        se carichi un PDF di prova nel bucket `documenti-condominio` al percorso:
--          d0000000-0000-4000-8000-000000000001/regolamenti/Regolamento_condominiale_vigente.pdf
--   4. Un documento riservato all'Unità 2 (`d0000000-0000-4000-8000-000000000531`):
--      NON deve comparire nell'elenco né nei contatori della vista condòmino (nemmeno se l'utente ha
--      anche ruolo ADMIN), e aprendo `/documenti/d0000000-0000-4000-8000-000000000531` deve mostrare
--      `NonAutorizzato` ("Questo documento non è disponibile").
--   5. Un secondo condominio ("Z - Condominio Isolato Documenti", `d0000000-0000-4000-8000-000000000590`)
--      con una cartella (`d0000000-0000-4000-8000-000000000591`) e un documento (`d0000000-0000-4000-8000-000000000592`)
--      che NON devono comparire col "Condominio di Prova" attivo e devono mostrare lo stesso stato
--      `NonAutorizzato` su `/documenti/d0000000-0000-4000-8000-000000000592`.
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (`on conflict do nothing`).
--   - Per annullare: eseguire `supabase/seed-dev/documenti_extra_pulizia.sql`.
-- =============================================================================

do $seed_documenti$
declare
  v_utente_test_id   uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_altro_admin_id   uuid;

  -- id fissi condivisi con 01_dati_prova.sql e 03_dati_home.sql
  c_condominio       constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a        constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_unita_1          constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- dell'utente di prova
  c_unita_2          constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- di un'altra unità
  c_anagrafica       constant uuid := 'd0000000-0000-4000-8000-000000000031';

  -- cartelle extra del Condominio di Prova (prefisso 50x)
  c_cartella_reg     constant uuid := 'd0000000-0000-4000-8000-000000000501';
  c_cartella_verb    constant uuid := 'd0000000-0000-4000-8000-000000000502';
  c_cartella_bil     constant uuid := 'd0000000-0000-4000-8000-000000000503';
  c_cartella_pol     constant uuid := 'd0000000-0000-4000-8000-000000000504';

  -- secondo condominio isolato (prefisso 59x)
  c_condominio_altro constant uuid := 'd0000000-0000-4000-8000-000000000590';
  c_cartella_altro   constant uuid := 'd0000000-0000-4000-8000-000000000591';
  c_doc_altro        constant uuid := 'd0000000-0000-4000-8000-000000000592';

  v_tipo_appartamento uuid;
begin
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    select admin_id into v_utente_test_id from public.condomini where id = c_condominio;
  end if;
  if v_utente_test_id is null or not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise exception 'L''utente % non esiste in public.utenti. Verifica che sia registrato in Authentication > Users.', 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  end if;

  -- ---- 1. Assicura la struttura base del Condominio di Prova ------------------------------------
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

  -- ---- 2. Cartelle documenti del Condominio di Prova --------------------------------------------
  insert into public.cartelle_documenti (id, condominio_id, parent_id, nome_cartella) values
    (c_cartella_reg,  c_condominio, null, 'Regolamenti e tabelle'),
    (c_cartella_verb, c_condominio, null, 'Verbali assemblea'),
    (c_cartella_bil,  c_condominio, null, 'Bilanci e preventivi'),
    (c_cartella_pol,  c_condominio, null, 'Polizze e contratti')
  on conflict (id) do nothing;

  -- ---- 3. Documenti visibili al residente dell'Unità 1 (10 condominiali + 2 dell'Unità 1) -------
  insert into public.documenti_metadata (id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da, created_at) values
    ('d0000000-0000-4000-8000-000000000511', c_cartella_reg,  null,
      'd0000000-0000-4000-8000-000000000001/regolamenti/Regolamento_condominiale_vigente.pdf',
      'Regolamento condominiale vigente.pdf', 'application/pdf', v_utente_test_id, now() - interval '2 days'),
    ('d0000000-0000-4000-8000-000000000512', c_cartella_reg,  null,
      'd0000000-0000-4000-8000-000000000001/regolamenti/Tabella_millesimale_generale_A.pdf',
      'Tabella millesimale generale A.pdf', 'application/pdf', v_utente_test_id, now() - interval '5 days'),
    ('d0000000-0000-4000-8000-000000000513', c_cartella_reg,  null,
      'd0000000-0000-4000-8000-000000000001/regolamenti/Tabella_millesimale_scale_ascensore_B.pdf',
      'Tabella millesimale scale e ascensore B.pdf', 'application/pdf', v_utente_test_id, now() - interval '9 days'),
    ('d0000000-0000-4000-8000-000000000514', c_cartella_verb, null,
      'd0000000-0000-4000-8000-000000000001/verbali/Verbale_assemblea_ordinaria_2025.pdf',
      'Verbale assemblea ordinaria 2025.pdf', 'application/pdf', v_utente_test_id, now() - interval '14 days'),
    ('d0000000-0000-4000-8000-000000000515', c_cartella_verb, null,
      'd0000000-0000-4000-8000-000000000001/verbali/Verbale_assemblea_straordinaria_tetto.pdf',
      'Verbale assemblea straordinaria lavori tetto.pdf', 'application/pdf', v_utente_test_id, now() - interval '21 days'),
    ('d0000000-0000-4000-8000-000000000516', c_cartella_verb, null,
      'd0000000-0000-4000-8000-000000000001/verbali/Avviso_convocazione_assemblea_annuale.pdf',
      'Avviso convocazione assemblea annuale.pdf', 'application/pdf', v_utente_test_id, now() - interval '28 days'),
    ('d0000000-0000-4000-8000-000000000517', c_cartella_bil,  null,
      'd0000000-0000-4000-8000-000000000001/bilanci/Bilancio_consuntivo_approvato.pdf',
      'Bilancio consuntivo approvato.pdf', 'application/pdf', v_utente_test_id, now() - interval '35 days'),
    ('d0000000-0000-4000-8000-000000000518', c_cartella_bil,  null,
      'd0000000-0000-4000-8000-000000000001/bilanci/Preventivo_gestione_ordinaria.pdf',
      'Preventivo gestione ordinaria.pdf', 'application/pdf', v_utente_test_id, now() - interval '42 days'),
    ('d0000000-0000-4000-8000-000000000519', c_cartella_pol,  null,
      'd0000000-0000-4000-8000-000000000001/polizze/Polizza_globale_fabbricati.pdf',
      'Polizza globale fabbricati.pdf', 'application/pdf', v_utente_test_id, now() - interval '50 days'),
    ('d0000000-0000-4000-8000-000000000520', c_cartella_pol,  null,
      'd0000000-0000-4000-8000-000000000001/polizze/Contratto_manutenzione_ascensore.pdf',
      'Contratto manutenzione ascensore.pdf', 'application/pdf', v_utente_test_id, now() - interval '60 days'),
    ('d0000000-0000-4000-8000-000000000521', c_cartella_bil,  c_unita_1,
      'd0000000-0000-4000-8000-000000000001/unita-1/Prospetto_riparto_individuale_Int_1.pdf',
      'Prospetto riparto individuale Int. 1.pdf', 'application/pdf', v_utente_test_id, now() - interval '3 days'),
    ('d0000000-0000-4000-8000-000000000522', c_cartella_bil,  c_unita_1,
      'd0000000-0000-4000-8000-000000000001/unita-1/Attestazione_oneri_detraibili_Int_1.pdf',
      'Attestazione oneri detraibili Int. 1.pdf', 'application/pdf', v_utente_test_id, now() - interval '12 days')
  on conflict (id) do nothing;

  -- ---- 4. Documento dell'Unità 2 (NON deve comparire al residente dell'Unità 1) -----------------
  insert into public.documenti_metadata (id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da, created_at)
  values (
    'd0000000-0000-4000-8000-000000000531',
    c_cartella_bil,
    c_unita_2,
    'd0000000-0000-4000-8000-000000000001/unita-2/Prospetto_riservato_Int_2.pdf',
    'Prospetto riservato Int. 2 (non deve comparire).pdf',
    'application/pdf',
    v_utente_test_id,
    now() - interval '1 day'
  )
  on conflict (id) do nothing;

  -- ---- 5. Secondo condominio isolato per testare l'isolamento tra condomini ---------------------
  select id into v_altro_admin_id from public.utenti where id <> v_utente_test_id limit 1;
  if v_altro_admin_id is null then
    v_altro_admin_id := v_utente_test_id;
  end if;

  insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, provincia)
  values (
    c_condominio_altro,
    v_altro_admin_id,
    'Z - Condominio Isolato Documenti',
    'CONDOMINIO',
    'Via Isolata 99',
    'Altracitta',
    '99999',
    'ZZ'
  )
  on conflict (id) do nothing;

  insert into public.cartelle_documenti (id, condominio_id, parent_id, nome_cartella)
  values (c_cartella_altro, c_condominio_altro, null, 'Cartella riservata altro condominio')
  on conflict (id) do nothing;

  insert into public.documenti_metadata (id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da, created_at)
  values (
    c_doc_altro,
    c_cartella_altro,
    null,
    'd0000000-0000-4000-8000-000000000590/regolamenti/Documento_altro_condominio.pdf',
    'Documento altro condominio (non deve comparire).pdf',
    'application/pdf',
    v_altro_admin_id,
    now() - interval '1 day'
  )
  on conflict (id) do nothing;

  raise notice 'Dati extra Documenti pronti per il condominio %.', c_condominio;
end
$seed_documenti$;

