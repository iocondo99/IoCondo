-- =============================================================================
-- DATI DI PROVA SUPER AMMINISTRATORE (idempotente)
-- =============================================================================
-- Prerequisito: aver eseguito `supabase/da-applicare/13_superadmin_saas_sospensione.sql`
-- e avere gli utenti di prova di `01_dati_prova.sql`.
-- =============================================================================

do $seed$
declare
  v_utente_super_id uuid := null; -- Incolla l'UUID del Super Admin (o lascia null per usare il primo is_superadmin=true)
  v_utente_admin_id uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';

  c_piano_id       constant uuid := 'd0000000-0000-4000-8000-000000000901';
  c_licenza_id     constant uuid := 'd0000000-0000-4000-8000-000000000902';
  c_cond_attivo    constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_cond_test_sosp constant uuid := 'd0000000-0000-4000-8000-000000000903';
  c_palazzo_sosp   constant uuid := 'd0000000-0000-4000-8000-000000000904';
  c_unita_sosp     constant uuid := 'd0000000-0000-4000-8000-000000000905';
  c_fattura_1      constant uuid := 'd0000000-0000-4000-8000-000000000906';
  c_fattura_2      constant uuid := 'd0000000-0000-4000-8000-000000000907';

  v_piano_reale uuid;
  v_tipo_app    uuid;
begin
  -- 1. Assicura flag is_superadmin = true sull'utente super admin
  if v_utente_super_id is not null then
    update public.utenti set is_superadmin = true where id = v_utente_super_id;
  end if;

  if not exists (select 1 from public.utenti where is_superadmin = true) then
    raise notice 'Nessun utente con is_superadmin = true trovato: imposta v_utente_super_id nello script.';
  end if;

  -- 2. Configura il Piano Unico in piani_abbonamento
  select id into v_piano_reale from public.piani_abbonamento where nome = 'Piano Unico Piattaforma' limit 1;
  if v_piano_reale is null then
    insert into public.piani_abbonamento (id, nome, prezzo_mensile, limite_unita, feature_premium)
    values (
      c_piano_id,
      'Piano Unico Piattaforma',
      29.00,
      null,
      '{"contabilita": true, "assemblee": true, "ticket": true, "bacheca": true, "spazi_comuni": true, "differenziata": true, "documenti": true, "pacchi": true, "note": "Accesso completo a tutte le funzionalità della piattaforma senza limiti di unità."}'::jsonb
    )
    on conflict (nome) do nothing;
    select id into v_piano_reale from public.piani_abbonamento where nome = 'Piano Unico Piattaforma' limit 1;
  end if;

  -- 3. Verifica esistenza utente admin di prova
  if exists (select 1 from public.utenti where id = v_utente_admin_id) then
    -- Licenza SaaS collegata al Piano Unico
    if not exists (select 1 from public.licenze_saas where admin_id = v_utente_admin_id) then
      insert into public.licenze_saas (id, admin_id, piano_id, is_active, data_scadenza)
      values (c_licenza_id, v_utente_admin_id, v_piano_reale, true, (current_date + interval '12 months')::date)
      on conflict (id) do nothing;
    end if;

    -- Assicura condominio attivo di prova
    if exists (select 1 from public.condomini where id = c_cond_attivo) then
      update public.condomini set attivo = true where id = c_cond_attivo;
    end if;

    -- Secondo condominio di prova (inizialmente attivo, pronto per testare la sospensione)
    insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, provincia, attivo)
    values (
      c_cond_test_sosp,
      v_utente_admin_id,
      'Condominio Test Sospensione',
      'CONDOMINIO',
      'Via Test Kill-Switch 99',
      'Milano',
      '20100',
      'MI',
      true
    )
    on conflict (id) do update set nome = excluded.nome;

    insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
    values (c_palazzo_sosp, c_cond_test_sosp, 'Palazzina Test', 'Via Test Kill-Switch 99')
    on conflict (id) do nothing;

    select id into v_tipo_app from public.tipologie_unita limit 1;
    if v_tipo_app is not null then
      insert into public.unita_immobiliari (id, palazzo_id, tipologia_id, interno, piano, mq)
      values (c_unita_sosp, c_palazzo_sosp, v_tipo_app, '1', 1, 80)
      on conflict (id) do nothing;
    end if;

    -- Fatture SaaS di prova
    insert into public.fatture_saas (id, admin_id, importo, url_pdf, data_emissione)
    values
      (c_fattura_1, v_utente_admin_id, 29.00, null, (current_date - interval '30 days')::date),
      (c_fattura_2, v_utente_admin_id, 29.00, null, current_date)
    on conflict (id) do nothing;
  end if;
end
$seed$;
