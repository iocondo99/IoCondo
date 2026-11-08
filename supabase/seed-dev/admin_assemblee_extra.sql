-- =============================================================================
-- DATI DI PROVA PER LA GESTIONE ASSEMBLEE AMMINISTRATORE (UC-10)
-- (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dall'SQL Editor di Supabase sul progetto di prova.
-- Crea:
--   1. Assemblea convocata futura (Ordinaria, Ibrida, con 2 punti ODG)
--   2. Assemblea in corso (Straordinaria, con presenze registrate e 2 punti ODG aperti al voto)
--   3. Assemblea conclusa (Ordinaria, con verbale PDF nello Storage e voti nominali storici)
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (UUID deterministici fissi)
--   - RLS coerente con l'isolamento del Condominio di Prova
--   - Script di ripristino: supabase/seed-dev/admin_assemblee_extra_pulizia.sql
-- =============================================================================

do $seed_admin_assemblee$
declare
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_tabella    constant uuid := 'd0000000-0000-4000-8000-000000000700';

  -- Unita del condominio di prova
  c_unita_1    constant uuid := 'd0000000-0000-4000-8000-000000000011';
  c_unita_2    constant uuid := 'd0000000-0000-4000-8000-000000000012';

  -- Utente di prova
  c_utente_1   constant uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';

  -- 1. Assemblea Convocata Futura
  c_ass_conv   constant uuid := 'd0000000-0000-4000-8000-000000000910';
  c_pto_conv_1 constant uuid := 'd0000000-0000-4000-8000-000000000911';
  c_pto_conv_2 constant uuid := 'd0000000-0000-4000-8000-000000000912';

  -- 2. Assemblea In Corso
  c_ass_live   constant uuid := 'd0000000-0000-4000-8000-000000000920';
  c_pto_live_1 constant uuid := 'd0000000-0000-4000-8000-000000000921';
  c_pto_live_2 constant uuid := 'd0000000-0000-4000-8000-000000000922';

  -- 3. Assemblea Conclusa
  c_ass_conc   constant uuid := 'd0000000-0000-4000-8000-000000000930';
  c_pto_conc_1 constant uuid := 'd0000000-0000-4000-8000-000000000931';
  c_pto_conc_2 constant uuid := 'd0000000-0000-4000-8000-000000000932';
begin
  -- 1. Verifica esistenza condominio di prova
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Il condominio di prova (%) non esiste. Esegui prima 01_dati_prova.sql.', c_condominio;
  end if;

  -- 2. Inserimento Tabella Millesimale se non presente
  insert into public.tabelle_millesimali (id, condominio_id, nome, totale)
  values (c_tabella, c_condominio, 'Tabella Generale Assemblee', 1000.000)
  on conflict (id) do update set nome = excluded.nome, totale = excluded.totale;

  -- Assicura quote millesimali di prova
  insert into public.quote_millesimali (tabella_id, unita_id, valore_millesimale)
  values
    (c_tabella, c_unita_1, 150.000),
    (c_tabella, c_unita_2, 120.000)
  on conflict do nothing;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 3. Assemblea 1: Convocata Futura
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.assemblee_testata (
    id, condominio_id, data, luogo, link_meet, stato, tipo, modalita, tabella_millesimale_id, verbale_url
  ) values (
    c_ass_conv,
    c_condominio,
    '2026-11-28 18:30:00+00',
    '1ª conv. 27/11 ore 08:00 - 2ª conv. 28/11 ore 18:30 presso Sala Condominiale Via dei Test 1',
    'https://meet.google.com/convocazione-assemblea-futura',
    'CONVOCATA',
    'ORDINARIA',
    'IBRIDA',
    c_tabella,
    null
  ) on conflict (id) do update set
    data = excluded.data,
    luogo = excluded.luogo,
    link_meet = excluded.link_meet,
    stato = excluded.stato,
    tipo = excluded.tipo,
    modalita = excluded.modalita,
    tabella_millesimale_id = excluded.tabella_millesimale_id;

  insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta)
  values
    (c_pto_conv_1, c_ass_conv, 1, 'Nomina o conferma amministratore e compenso per l’esercizio 2026-2027', 'Valutazione delle proposte pervenute e determinazione del compenso professionale ex art. 1129 c.c.', false),
    (c_pto_conv_2, c_ass_conv, 2, 'Esame e approvazione preventivo gestione ordinaria 2027', 'Presentazione del piano previsionale delle spese ordinarie e ripartizione rateale.', false)
  on conflict (id) do update set
    titolo_punto = excluded.titolo_punto,
    descrizione = excluded.descrizione,
    ordine = excluded.ordine,
    votazione_aperta = excluded.votazione_aperta;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 4. Assemblea 2: In Corso (con presenze e 2 votazioni aperte)
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.assemblee_testata (
    id, condominio_id, data, luogo, link_meet, stato, tipo, modalita, tabella_millesimale_id, verbale_url
  ) values (
    c_ass_live,
    c_condominio,
    '2026-11-06 18:00:00+00',
    'Sala Riunioni Piano Terra e collegamento Google Meet',
    'https://meet.google.com/live-assemblea-in-corso',
    'IN_CORSO',
    'STRAORDINARIA',
    'IBRIDA',
    c_tabella,
    null
  ) on conflict (id) do update set
    data = excluded.data,
    luogo = excluded.luogo,
    link_meet = excluded.link_meet,
    stato = excluded.stato,
    tipo = excluded.tipo,
    modalita = excluded.modalita,
    tabella_millesimale_id = excluded.tabella_millesimale_id;

  insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta)
  values
    (c_pto_live_1, c_ass_live, 1, 'Lavori straordinari risanamento facciata nord e balconi', 'Approvazione del capitolato d’appalto e scelta dell’impresa esecutrice dei lavori di ripristino intonaci e impermeabilizzazione.', true),
    (c_pto_live_2, c_ass_live, 2, 'Installazione infrastruttura di ricarica veicoli elettrici nelle autorimesse', 'Delibera ai sensi dell’art. 1120 comma 2 n. 2 c.c. per punti di ricarica condominiali dedicati.', true)
  on conflict (id) do update set
    titolo_punto = excluded.titolo_punto,
    descrizione = excluded.descrizione,
    ordine = excluded.ordine,
    votazione_aperta = excluded.votazione_aperta;

  -- Presenze registrate: Unità 1 (presente in sala), Unità 2 (online)
  insert into public.assemblee_presenze (id, assemblea_id, unita_id, utente_id, delegato_utente_id, modalita_presenza)
  values
    ('d0000000-0000-4000-8000-000000000923', c_ass_live, c_unita_1, c_utente_1, null, 'PRESENZA'),
    ('d0000000-0000-4000-8000-000000000924', c_ass_live, c_unita_2, null, null, 'ONLINE')
  on conflict (assemblea_id, unita_id) do update set
    modalita_presenza = excluded.modalita_presenza,
    utente_id = excluded.utente_id,
    delegato_utente_id = excluded.delegato_utente_id;

  -- Voti per Punto 1 (entrambi Favorevoli)
  insert into public.assemblee_voti (id, punto_odg_id, unita_id, utente_id, voto)
  values
    ('d0000000-0000-4000-8000-000000000925', c_pto_live_1, c_unita_1, c_utente_1, 'FAVOREVOLE'),
    ('d0000000-0000-4000-8000-000000000926', c_pto_live_1, c_unita_2, null, 'FAVOREVOLE')
  on conflict (punto_odg_id, unita_id) do update set
    voto = excluded.voto,
    utente_id = excluded.utente_id;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 5. Assemblea 3: Conclusa con Verbale PDF e Voti Storici
  -- ─────────────────────────────────────────────────────────────────────────
  insert into public.assemblee_testata (
    id, condominio_id, data, luogo, link_meet, stato, tipo, modalita, tabella_millesimale_id, verbale_url
  ) values (
    c_ass_conc,
    c_condominio,
    '2026-07-20 18:00:00+00',
    'Studio Amministratore Rossi - Corso Italia 45',
    null,
    'CONCLUSA',
    'ORDINARIA',
    'PRESENZA',
    c_tabella,
    c_condominio || '/verbali/verbale_assemblea_' || c_ass_conc || '.pdf'
  ) on conflict (id) do update set
    data = excluded.data,
    luogo = excluded.luogo,
    link_meet = excluded.link_meet,
    stato = excluded.stato,
    tipo = excluded.tipo,
    modalita = excluded.modalita,
    tabella_millesimale_id = excluded.tabella_millesimale_id,
    verbale_url = excluded.verbale_url;

  insert into public.assemblee_punti_odg (id, assemblea_id, ordine, titolo_punto, descrizione, votazione_aperta)
  values
    (c_pto_conc_1, c_ass_conc, 1, 'Approvazione rendiconto consuntivo gestione 2025-2026', 'Rendiconto finanziario consuntivo e situazione patrimoniale.', false),
    (c_pto_conc_2, c_ass_conc, 2, 'Rinnovo contratto manutenzione programmata ascensori', 'Conferma del fornitore convenzionato con adeguamento ISTAT.', false)
  on conflict (id) do update set
    titolo_punto = excluded.titolo_punto,
    descrizione = excluded.descrizione,
    ordine = excluded.ordine,
    votazione_aperta = excluded.votazione_aperta;

  -- Presenze e voti storici assemblea conclusa
  insert into public.assemblee_presenze (id, assemblea_id, unita_id, utente_id, delegato_utente_id, modalita_presenza)
  values
    ('d0000000-0000-4000-8000-000000000933', c_ass_conc, c_unita_1, c_utente_1, null, 'PRESENZA'),
    ('d0000000-0000-4000-8000-000000000934', c_ass_conc, c_unita_2, null, null, 'PRESENZA')
  on conflict (assemblea_id, unita_id) do update set
    modalita_presenza = excluded.modalita_presenza;

  insert into public.assemblee_voti (id, punto_odg_id, unita_id, utente_id, voto)
  values
    ('d0000000-0000-4000-8000-000000000935', c_pto_conc_1, c_unita_1, c_utente_1, 'FAVOREVOLE'),
    ('d0000000-0000-4000-8000-000000000936', c_pto_conc_1, c_unita_2, null, 'FAVOREVOLE'),
    ('d0000000-0000-4000-8000-000000000937', c_pto_conc_2, c_unita_1, c_utente_1, 'FAVOREVOLE'),
    ('d0000000-0000-4000-8000-000000000938', c_pto_conc_2, c_unita_2, null, 'ASTENUTO')
  on conflict (punto_odg_id, unita_id) do update set
    voto = excluded.voto;

  raise notice 'Dati di prova per Assemblee Amministratore inseriti con successo.';
end;
$seed_admin_assemblee$;
