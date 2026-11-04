-- =============================================================================
-- DATI EXTRA PER LA SEZIONE ASSEMBLEE (/assemblee e /assemblee/[id])  (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase. Non eseguire in produzione.
-- Usa l'UUID dell'amministratore/utente di prova: b6e76a6a-bf37-43fd-b00b-efb1cb6921ad
-- Tutti i nomi, i percorsi e le date sono inventati.
--
-- Che cosa predispone:
--   1. Assicura la struttura base del "Condominio di Prova" (d0000000-0000-4000-8000-000000000001),
--      il Palazzo A, l'Unità 1 (dell'utente di prova) e l'Unità 2 (di un altro condomino).
--   2. Una tabella millesimale generale (d0000000-0000-4000-8000-000000000700) con quote
--      per l'Unità 1 (150.000 millesimi) e l'Unità 2 (120.000 millesimi).
--   3. Un'assemblea CONVOCATA futura (d0000000-0000-4000-8000-000000000710):
--      - data futura, tipo ORDINARIA, modalità IBRIDA;
--      - link_meet valido https://meet.google.com/iocondo-assemblea-2026;
--      - 4 punti ODG con votazioni ancora chiuse;
--      - per verificare StatCard "Prossima assemblea", ordine cronologico e visualizzazione ODG.
--   4. Un'assemblea IN_CORSO (d0000000-0000-4000-8000-000000000730):
--      - data odierna, tipo STRAORDINARIA, modalità IBRIDA;
--      - link_meet valido https://meet.google.com/live-condominio-prova;
--      - 3 punti ODG di cui 2 con votazione_aperta = true;
--      - per verificare StatCard "Votazioni aperte", interazione ed espressione/modifica del voto.
--   5. Un'assemblea CONCLUSA (d0000000-0000-4000-8000-000000000750):
--      - data passata, tipo ORDINARIA, modalità PRESENZA;
--      - verbale_url nel bucket documenti-condominio:
--        d0000000-0000-4000-8000-000000000001/verbali/verbale_assemblea_approvazione_2026.pdf
--      - punti ODG conclusi con voti già registrati (Unità 1 e Unità 2);
--      - per verificare il calcolo millesimale e teste della RPC risultati_voto,
--        l'evidenziazione del proprio voto e lo scaricamento del verbale con link firmato.
--   6. Un'assemblea in stato BOZZA (d0000000-0000-4000-8000-000000000780):
--      - NON deve comparire nell'elenco né nelle StatCard della vista condòmino;
--      - aprendo /assemblee/d0000000-0000-4000-8000-000000000780 compare lo stato NonAutorizzato.
--   7. Un secondo condominio ("Z - Condominio Isolato Assemblee", d0000000-0000-4000-8000-000000000790)
--      con un'assemblea (d0000000-0000-4000-8000-000000000792):
--      - NON deve comparire col "Condominio di Prova" attivo;
--      - aprendo l'URL diretto compare lo stato NonAutorizzato (senza enumerazione).
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati.
--   - Per annullare: eseguire supabase/seed-dev/assemblee_extra_pulizia.sql.
-- =============================================================================

do $seed_assemblee$
declare
  v_utente_test_id    uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_altro_admin_id    uuid;
  v_tipo_appartamento uuid;

  -- ID base del Condominio di Prova
  c_condominio        constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a         constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_unita_1           constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- del residente di prova
  c_unita_2           constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- di un altro condomino
  c_anagrafica        constant uuid := 'd0000000-0000-4000-8000-000000000031';

  -- Tabella millesimale per le assemblee
  c_tabella_mill      constant uuid := 'd0000000-0000-4000-8000-000000000700';

  -- Assemblea Convocata futura
  c_ass_convocata     constant uuid := 'd0000000-0000-4000-8000-000000000710';
  c_punto_conv_1      constant uuid := 'd0000000-0000-4000-8000-000000000721';
  c_punto_conv_2      constant uuid := 'd0000000-0000-4000-8000-000000000722';
  c_punto_conv_3      constant uuid := 'd0000000-0000-4000-8000-000000000723';
  c_punto_conv_4      constant uuid := 'd0000000-0000-4000-8000-000000000724';

  -- Assemblea In Corso con votazione aperta
  c_ass_incorso       constant uuid := 'd0000000-0000-4000-8000-000000000730';
  c_punto_inc_1       constant uuid := 'd0000000-0000-4000-8000-000000000741';
  c_punto_inc_2       constant uuid := 'd0000000-0000-4000-8000-000000000742';
  c_punto_inc_3       constant uuid := 'd0000000-0000-4000-8000-000000000743';

  -- Assemblea Conclusa con voti e verbale
  c_ass_conclusa      constant uuid := 'd0000000-0000-4000-8000-000000000750';
  c_punto_conc_1      constant uuid := 'd0000000-0000-4000-8000-000000000761';
  c_punto_conc_2      constant uuid := 'd0000000-0000-4000-8000-000000000762';

  -- Assemblea Bozza (amministratore only)
  c_ass_bozza         constant uuid := 'd0000000-0000-4000-8000-000000000780';
  c_punto_bozza_1     constant uuid := 'd0000000-0000-4000-8000-000000000781';

  -- Secondo condominio isolato
  c_condominio_altro  constant uuid := 'd0000000-0000-4000-8000-000000000790';
  c_palazzo_altro     constant uuid := 'd0000000-0000-4000-8000-000000000791';
  c_ass_altra         constant uuid := 'd0000000-0000-4000-8000-000000000792';
  c_punto_altro       constant uuid := 'd0000000-0000-4000-8000-000000000793';

begin
  -- 1. Verifica utente di prova
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    select admin_id into v_utente_test_id from public.condomini where id = c_condominio;
  end if;
  if v_utente_test_id is null or not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise notice 'Utente di prova % non trovato. Esegui prima 01_dati_prova.sql.', v_utente_test_id;
    return;
  end if;

  -- 2. Assicura la struttura del Condominio di Prova
  insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, codice_fiscale)
  values (c_condominio, v_utente_test_id, 'Condominio di Prova', 'CONDOMINIO', 'Via dei Test 1', 'Roma', '00100', '99999990001')
  on conflict (id) do nothing;

  insert into public.palazzi (id, condominio_id, nome_identificativo)
  values (c_palazzo_a, c_condominio, 'Palazzo A')
  on conflict (id) do nothing;

  select id into v_tipo_appartamento
  from public.tipologie_unita
  where lower(descrizione) = 'appartamento'
  limit 1;

  if v_tipo_appartamento is null then
    select id into v_tipo_appartamento from public.tipologie_unita limit 1;
  end if;

  if v_tipo_appartamento is not null then
    insert into public.unita_immobiliari (id, palazzo_id, tipologia_id, interno, piano, mq)
    values
      (c_unita_1, c_palazzo_a, v_tipo_appartamento, '1', 1, 80),
      (c_unita_2, c_palazzo_a, v_tipo_appartamento, '2', 1, 75)
    on conflict (id) do nothing;

    insert into public.anagrafiche_unita (id, unita_id, utente_id, tipo_possesso, quota_possesso)
    select c_anagrafica, c_unita_1, v_utente_test_id, 'PROPRIETARIO', 100
    where not exists (
      select 1 from public.anagrafiche_unita
      where unita_id = c_unita_1 and utente_id = v_utente_test_id and data_fine is null
    )
    on conflict (id) do nothing;
  end if;

  -- 3. Tabella millesimale e quote
  if not exists (select 1 from public.tabelle_millesimali where id = c_tabella_mill) then
    insert into public.tabelle_millesimali (id, condominio_id, nome, totale)
    values (c_tabella_mill, c_condominio, 'Tabella Generale Assemblee', 1000.000)
    on conflict do nothing;
  end if;

  insert into public.quote_millesimali (tabella_id, unita_id, valore_millesimale)
  values
    (c_tabella_mill, c_unita_1, 150.000),
    (c_tabella_mill, c_unita_2, 120.000)
  on conflict (tabella_id, unita_id) do update set
    valore_millesimale = excluded.valore_millesimale;

  -- 4. Assemblea CONVOCATA futura (tra 14 giorni)
  insert into public.assemblee_testata (
    id, condominio_id, tabella_millesimale_id, data, luogo, link_meet, verbale_url, stato, tipo, modalita
  ) values (
    c_ass_convocata,
    c_condominio,
    c_tabella_mill,
    (current_date + interval '14 days' + time '18:30:00'),
    'Sala Condominiale "Girasole", Via dei Test 1',
    'https://meet.google.com/iocondo-assemblea-2026',
    null,
    'CONVOCATA',
    'ORDINARIA',
    'IBRIDA'
  ) on conflict (id) do update set
    data = (current_date + interval '14 days' + time '18:30:00'),
    stato = 'CONVOCATA',
    link_meet = 'https://meet.google.com/iocondo-assemblea-2026';

  insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta)
  values
    (c_punto_conv_1, c_ass_convocata, 1, 'Approvazione rendiconto consuntivo esercizio precedente', 'Relazione della gestione e approvazione stato patrimoniale.', false),
    (c_punto_conv_2, c_ass_convocata, 2, 'Esame e approvazione preventivo esercizio corrente', 'Spese ordinarie e riparto delle quote condominiali.', false),
    (c_punto_conv_3, c_ass_convocata, 3, 'Nomina o conferma amministratore e compenso', 'Valutazione delle offerte pervenute per il mandato.', false),
    (c_punto_conv_4, c_ass_convocata, 4, 'Varie ed eventuali', 'Discussione libera e comunicazioni tra i residenti.', false)
  on conflict (id) do nothing;

  -- 5. Assemblea IN_CORSO con votazione aperta (oggi)
  insert into public.assemblee_testata (
    id, condominio_id, tabella_millesimale_id, data, luogo, link_meet, verbale_url, stato, tipo, modalita
  ) values (
    c_ass_incorso,
    c_condominio,
    c_tabella_mill,
    (current_date + time '19:00:00'),
    'Sala Riunioni Piano Terra e collegamento Google Meet',
    'https://meet.google.com/live-condominio-prova',
    null,
    'IN_CORSO',
    'STRAORDINARIA',
    'IBRIDA'
  ) on conflict (id) do update set
    data = (current_date + time '19:00:00'),
    stato = 'IN_CORSO',
    link_meet = 'https://meet.google.com/live-condominio-prova';

  insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta)
  values
    (c_punto_inc_1, c_ass_incorso, 1, 'Intervento urgente riparazione pluviale e grondaia', 'Approvazione spesa urgente preventivata in euro 1.850.', true),
    (c_punto_inc_2, c_ass_incorso, 2, 'Sostituzione sensori luci atrio scala A', 'Sostituzione con tecnologia LED a risparmio energetico.', true),
    (c_punto_inc_3, c_ass_incorso, 3, 'Revisione orari apertura cancello carraio', 'Discussione proposta modifiche orari e telecomandi.', false)
  on conflict (id) do update set
    votazione_aperta = excluded.votazione_aperta;

  -- 6. Assemblea CONCLUSA (90 giorni fa) con verbale e voti registrati
  insert into public.assemblee_testata (
    id, condominio_id, tabella_millesimale_id, data, luogo, link_meet, verbale_url, stato, tipo, modalita
  ) values (
    c_ass_conclusa,
    c_condominio,
    c_tabella_mill,
    (current_date - interval '90 days' + time '18:00:00'),
    'Studio Amministratore Rossi',
    null,
    'd0000000-0000-4000-8000-000000000001/verbali/verbale_assemblea_approvazione_2026.pdf',
    'CONCLUSA',
    'ORDINARIA',
    'PRESENZA'
  ) on conflict (id) do update set
    stato = 'CONCLUSA',
    verbale_url = 'd0000000-0000-4000-8000-000000000001/verbali/verbale_assemblea_approvazione_2026.pdf';

  insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta)
  values
    (c_punto_conc_1, c_ass_conclusa, 1, 'Approvazione bilancio consuntivo e piano di riparto', 'Consuntivo approvato a maggioranza dei presenti.', false),
    (c_punto_conc_2, c_ass_conclusa, 2, 'Conferma polizza assicurativa globale fabbricato', 'Rinnovo contratto annuale con primaria compagnia assicurativa.', false)
  on conflict (id) do nothing;

  -- Voti storici dell'assemblea conclusa
  insert into public.assemblee_voti (punto_odg_id, unita_id, utente_id, voto)
  values
    (c_punto_conc_1, c_unita_1, v_utente_test_id, 'FAVOREVOLE'),
    (c_punto_conc_1, c_unita_2, null,            'CONTRARIO'),
    (c_punto_conc_2, c_unita_1, v_utente_test_id, 'FAVOREVOLE'),
    (c_punto_conc_2, c_unita_2, null,            'FAVOREVOLE')
  on conflict (punto_odg_id, unita_id) do update set
    voto = excluded.voto,
    utente_id = excluded.utente_id;

  -- 7. Assemblea in stato BOZZA (riservata all'amministratore, NON deve apparire al condòmino)
  insert into public.assemblee_testata (
    id, condominio_id, tabella_millesimale_id, data, luogo, link_meet, verbale_url, stato, tipo, modalita
  ) values (
    c_ass_bozza,
    c_condominio,
    c_tabella_mill,
    (current_date + interval '45 days' + time '17:00:00'),
    'Bozza non pubblicata',
    null,
    null,
    'BOZZA',
    'STRAORDINARIA',
    'PRESENZA'
  ) on conflict (id) do update set
    stato = 'BOZZA';

  insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta)
  values
    (c_punto_bozza_1, c_ass_bozza, 1, 'Bozza discussione interna manutenzione straordinaria', 'Punto non ancora consolidato.', false)
  on conflict (id) do nothing;

  -- 8. Secondo condominio isolato con assemblea propria (NON deve apparire nel Condominio di Prova)
  select id into v_altro_admin_id from public.utenti where id <> v_utente_test_id limit 1;
  if v_altro_admin_id is null then
    v_altro_admin_id := v_utente_test_id;
  end if;

  insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, codice_fiscale)
  values (c_condominio_altro, v_altro_admin_id, 'Z - Condominio Isolato Assemblee', 'CONDOMINIO', 'Via Altra 99', 'Roma', '00100', '99999990099')
  on conflict (id) do nothing;

  insert into public.palazzi (id, condominio_id, nome_identificativo)
  values (c_palazzo_altro, c_condominio_altro, 'Palazzo Isolato')
  on conflict (id) do nothing;

  insert into public.assemblee_testata (
    id, condominio_id, tabella_millesimale_id, data, luogo, link_meet, verbale_url, stato, tipo, modalita
  ) values (
    c_ass_altra,
    c_condominio_altro,
    null,
    (current_date + interval '20 days' + time '18:00:00'),
    'Sede Distaccata',
    null,
    null,
    'CONVOCATA',
    'ORDINARIA',
    'PRESENZA'
  ) on conflict (id) do update set
    stato = 'CONVOCATA';

  insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta)
  values
    (c_punto_altro, c_ass_altra, 1, 'Punto assemblea altro condominio', 'Non deve mai apparire nel condominio di prova.', false)
  on conflict (id) do nothing;

  raise notice 'Dati extra Assemblee pronti per il condominio % (assemblea convocata %, in corso %, conclusa %, bozza %, altro cond %).',
    c_condominio, c_ass_convocata, c_ass_incorso, c_ass_conclusa, c_ass_bozza, c_ass_altra;
end $seed_assemblee$;
