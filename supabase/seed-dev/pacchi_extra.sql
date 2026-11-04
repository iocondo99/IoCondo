-- =============================================================================
-- DATI EXTRA PER IL REGISTRO PACCHI (/pacchi, UC-07)  (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase. Non eseguire in produzione.
-- Usa l'UUID dell'amministratore/utente di prova: b6e76a6a-bf37-43fd-b00b-efb1cb6921ad
-- Tutti i nomi, i mittenti e le date sono inventati.
--
-- Che cosa predispone:
--   1. Assicura la struttura base del "Condominio di Prova" (d0000000-0000-4000-8000-000000000001),
--      il Palazzo A, l'Unità 1 (dell'utente di prova) e l'Unità 2 (di un altro condomino).
--   2. Abilita il modulo 'abilita_pacchi = true' in configurazioni_condominio se non presente.
--   3. Pacchi per l'Unità 1 (visibili al condòmino di prova):
--      - 1 pacco in GIACENZA da 'Amazon Logistics' (arrivato ieri);
--      - 1 pacco in GIACENZA da 'Zalando Prowork' (arrivato 2 giorni fa);
--      - 1 pacco RITIRATO da 'Poste Italiane - Raccomandata' (con data ritiro e firma 'M. Rossi (di persona)').
--   4. Pacchi per l'Unità 2 (del vicino):
--      - 1 pacco in GIACENZA da 'Nespresso Italia';
--      - 1 pacco RITIRATO da 'BRT Corriere Espresso' (ritirato da 'G. Bianchi').
--      -> Questi pacchi sono visibili al PORTIERE nel condominio, ma NON al condòmino dell'Unità 1.
--   5. Un secondo condominio isolato ("Z - Condominio Isolato Pacchi", d0000000-0000-4000-8000-000000000890)
--      con 1 pacco (d0000000-0000-4000-8000-000000000895) per testare l'isolamento tra condomini.
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (on conflict do nothing).
--   - Per annullare: eseguire supabase/seed-dev/pacchi_extra_pulizia.sql.
-- =============================================================================

do $seed_pacchi$
declare
  v_utente_test_id       uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_altro_admin_id       uuid;

  -- ID base del Condominio di Prova
  c_condominio           constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a            constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_unita_1              constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- dell'utente di prova
  c_unita_2              constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- del vicino

  -- Pacchi Unità 1 (utente di prova)
  c_pacco_u1_giac_1      constant uuid := 'd0000000-0000-4000-8000-000000000811';
  c_pacco_u1_giac_2      constant uuid := 'd0000000-0000-4000-8000-000000000812';
  c_pacco_u1_rit_1       constant uuid := 'd0000000-0000-4000-8000-000000000813';

  -- Pacchi Unità 2 (vicino)
  c_pacco_u2_giac_1      constant uuid := 'd0000000-0000-4000-8000-000000000821';
  c_pacco_u2_rit_1       constant uuid := 'd0000000-0000-4000-8000-000000000822';

  -- Secondo condominio isolato
  c_condominio_altro     constant uuid := 'd0000000-0000-4000-8000-000000000890';
  c_palazzo_altro        constant uuid := 'd0000000-0000-4000-8000-000000000891';
  c_unita_altra          constant uuid := 'd0000000-0000-4000-8000-000000000892';
  c_pacco_altro_condo    constant uuid := 'd0000000-0000-4000-8000-000000000895';
  v_tipologia_appartamento uuid;

begin
  -- 1. Verifica utente di prova
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise notice 'Utente di prova % non trovato. Esegui prima 01_dati_prova.sql.', v_utente_test_id;
    return;
  end if;

  -- 2. Assicura la struttura del Condominio di Prova
  insert into public.condomini (id, admin_id, nome, indirizzo, citta, cap, codice_fiscale)
  values (c_condominio, v_utente_test_id, 'Condominio di Prova', 'Via dei Test 1', 'Roma', '00100', '99999990001')
  on conflict (id) do nothing;

  insert into public.palazzi (id, condominio_id, nome_identificativo)
  values (c_palazzo_a, c_condominio, 'Palazzo A')
  on conflict (id) do nothing;

  select id into v_tipologia_appartamento
    from public.tipologie_unita
   where codice = 'APPARTAMENTO'
   limit 1;

  if v_tipologia_appartamento is not null then
    insert into public.unita_immobiliari (id, palazzo_id, interno, piano, tipologia_id)
    values (c_unita_1, c_palazzo_a, '1', 1, v_tipologia_appartamento)
    on conflict (id) do nothing;

    insert into public.unita_immobiliari (id, palazzo_id, interno, piano, tipologia_id)
    values (c_unita_2, c_palazzo_a, '2', 1, v_tipologia_appartamento)
    on conflict (id) do nothing;
  end if;

  -- 3. Assicura abilitazione modulo pacchi in configurazioni_condominio
  update public.configurazioni_condominio
     set abilita_pacchi = true
   where condominio_id = c_condominio;

  -- 4. Inserimento pacchi per l'Unità 1 (utente di prova)
  insert into public.registro_pacchi (
    id,
    condominio_id,
    unita_destinazione_id,
    registrato_da,
    mittente_esterno,
    stato,
    data_arrivo,
    data_ritiro,
    firma_ritiro
  ) values
    (
      c_pacco_u1_giac_1,
      c_condominio,
      c_unita_1,
      v_utente_test_id,
      'Amazon Logistics',
      'GIACENZA',
      now() - interval '1 day',
      null,
      null
    ),
    (
      c_pacco_u1_giac_2,
      c_condominio,
      c_unita_1,
      v_utente_test_id,
      'Zalando Prowork',
      'GIACENZA',
      now() - interval '2 days',
      null,
      null
    ),
    (
      c_pacco_u1_rit_1,
      c_condominio,
      c_unita_1,
      v_utente_test_id,
      'Poste Italiane - Raccomandata',
      'RITIRATO',
      now() - interval '5 days',
      now() - interval '3 days',
      'M. Rossi (di persona)'
    )
  on conflict (id) do update set
    stato = excluded.stato,
    mittente_esterno = excluded.mittente_esterno,
    data_arrivo = excluded.data_arrivo,
    data_ritiro = excluded.data_ritiro,
    firma_ritiro = excluded.firma_ritiro;

  -- 5. Inserimento pacchi per l'Unità 2 (vicino)
  insert into public.registro_pacchi (
    id,
    condominio_id,
    unita_destinazione_id,
    registrato_da,
    mittente_esterno,
    stato,
    data_arrivo,
    data_ritiro,
    firma_ritiro
  ) values
    (
      c_pacco_u2_giac_1,
      c_condominio,
      c_unita_2,
      v_utente_test_id,
      'Nespresso Italia',
      'GIACENZA',
      now() - interval '4 hours',
      null,
      null
    ),
    (
      c_pacco_u2_rit_1,
      c_condominio,
      c_unita_2,
      v_utente_test_id,
      'BRT Corriere Espresso',
      'RITIRATO',
      now() - interval '10 days',
      now() - interval '9 days',
      'G. Bianchi'
    )
  on conflict (id) do update set
    stato = excluded.stato,
    mittente_esterno = excluded.mittente_esterno,
    data_arrivo = excluded.data_arrivo,
    data_ritiro = excluded.data_ritiro,
    firma_ritiro = excluded.firma_ritiro;

  -- 6. Secondo condominio isolato per testare l'isolamento cross-condominiale
  select id into v_altro_admin_id
    from public.utenti
   where id <> v_utente_test_id
   limit 1;

  if v_altro_admin_id is null then
    v_altro_admin_id := v_utente_test_id;
  end if;

  insert into public.condomini (id, admin_id, nome, indirizzo, citta, cap, codice_fiscale)
  values (
    c_condominio_altro,
    v_altro_admin_id,
    'Z - Condominio Isolato Pacchi',
    'Via dell''Isolamento 99',
    'Milano',
    '20100',
    '99999990890'
  )
  on conflict (id) do nothing;

  insert into public.palazzi (id, condominio_id, nome_identificativo)
  values (c_palazzo_altro, c_condominio_altro, 'Palazzo Isolato')
  on conflict (id) do nothing;

  if v_tipologia_appartamento is not null then
    insert into public.unita_immobiliari (id, palazzo_id, interno, piano, tipologia_id)
    values (c_unita_altra, c_palazzo_altro, '99', 9, v_tipologia_appartamento)
    on conflict (id) do nothing;
  end if;

  insert into public.registro_pacchi (
    id,
    condominio_id,
    unita_destinazione_id,
    registrato_da,
    mittente_esterno,
    stato,
    data_arrivo,
    data_ritiro,
    firma_ritiro
  ) values (
    c_pacco_altro_condo,
    c_condominio_altro,
    c_unita_altra,
    v_altro_admin_id,
    'GLS Express',
    'GIACENZA',
    now() - interval '6 hours',
    null,
    null
  )
  on conflict (id) do update set
    stato = excluded.stato,
    mittente_esterno = excluded.mittente_esterno,
    data_arrivo = excluded.data_arrivo;

  raise notice 'Dati extra Registro Pacchi pronti per il condominio %', c_condominio;
end $seed_pacchi$;

