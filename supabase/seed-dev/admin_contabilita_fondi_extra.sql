-- =============================================================================
-- DATI DI TEST PER INQUILINI, USUFRUTTO (RC-I1..I7, T10) E FONDI SPECIALI (RC-J1..J5, T7)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase (dopo 10_contabilita_schema_modello_obiettivo.sql).
-- Non eseguire in produzione.
--
-- Che cosa predispone su "Condominio di Prova" (d0000000-0000-4000-8000-000000000001):
--   1. Soggetti contabili e Titolarità in `anagrafiche_unita` (prefisso 180x - 181x):
--      - Palazzo A Int. 1: conduttore attivo per il caso di test T10 (oneri accessori art. 9 L. 392/1978
--        e DM 16/01/2017) e RC-I4 (esclusione compenso amministratore e assicurazione).
--      - Palazzo A Int. 2:
--        * Nudo proprietario + Usufruttuaria ("Carla Bianchi", `ruolo_titolarita = 'USUFRUTTUARIO'`, RC-I5
--          artt. 1004-1005 c.c.) con regola usufrutto configurata;
--        * Subentro inquilino a metà esercizio 2026 (RC-I7, RC-H5, RC-H6): Conduttore 1 dal 01/01/2026
--          al 30/06/2026 (181 gg) e Conduttore 2 dal 01/07/2026 al 31/12/2026 (184 gg), con letture
--          contatore acqua di inizio, subentro (`is_subentro = true`) e fine periodo in `letture_contatori`.
--   2. Movimenti contabili e Riparti Spese per T10, RC-I4 e RC-I5 (prefisso 182x - 183x):
--      - Spesa ordinaria ascensore 1.000,00 € (100.000 cent): quota Int. 1 = 80,00 € (8.000 cent) ->
--        100% conduttore (`quota_conduttore_centesimi = 8000`, `quota_proprietario_centesimi = 0`, T10).
--      - Sostituzione straordinaria ascensore 5.000,00 € (500.000 cent): quota Int. 1 = 400,00 € (40.000 cent) ->
--        0% conduttore, 100% proprietario (`quota_conduttore_centesimi = 0`, `quota_proprietario_centesimi = 40000`, T10).
--      - Compenso amministratore 1.500,00 € (150.000 cent): su Int. 1 = 0% conduttore, 100% proprietario (RC-I4);
--        su Int. 2 (in usufrutto) = 100% usufruttuario ex art. 1004 c.c. (`quota_usufruttuario_centesimi = 12000`, RC-I5).
--   3. Fondi Condominiali (`SPECIALE`, `CASSA`, `MOROSITA`) e Gestione Straordinaria T7 (prefisso 184x - 186x):
--      - Fondo Speciale Lavori Straordinari Facciata e Cappotto (T7, RC-J2, RC-J3): lavori deliberati per
--        60.000,00 € (6.000.000 cent) e fondo costituito per l'intero importo di 60.000,00 € con costituzione
--        progressiva per SAL collegata al contratto d'appalto, che abilita l'emissione delle rate straordinarie.
--      - Fondo Cassa e Riserva Ordinaria (`CASSA`, obiettivo 5.000,00 €, saldo 3.500,00 €).
--      - Fondo Morosità Condominiale (`MOROSITA`, obiettivo 3.000,00 €, saldo 1.500,00 €).
--   4. Movimenti Fondo (`movimenti_fondo`, prefisso 187x) e Vincolo di Destinazione (RC-J1, RC-J4):
--      - Accantonamento 1° e 2° SAL sul Fondo Speciale (+20.000,00 € + 20.000,00 € = +40.000,00 €).
--      - Prelievo conforme per pagamento Fattura 1° SAL (-15.000,00 €).
--      - Utilizzo con override tracciato (`is_override_vincolo = true`, motivo e delibera assembleare)
--        dal Fondo Cassa (-500,00 €) con relativo evento in `audit_logs` (prefisso 189x, RC-J4, RC-M1).
--
-- GARANZIE:
--   - Totalmente idempotente (`on conflict ... do update / do nothing`).
--   - Per ripulire: eseguire `supabase/seed-dev/admin_contabilita_fondi_extra_pulizia.sql`.
-- =============================================================================

do $seed_admin_contabilita_fondi$
declare
  v_admin_id            uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_tipo_appartamento   uuid;

  -- Riferimenti base Condominio di Prova
  c_condominio          constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_config              constant uuid := 'd0000000-0000-4000-8000-000000000041';
  c_palazzo_a           constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_scala_a             constant uuid := 'd0000000-0000-4000-8000-000000000901';
  c_u1_a                constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- Palazzo A, Int 1 (80 millesimi in T10)
  c_u2_a                constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- Palazzo A, Int 2 (Usufrutto RC-I5 + Subentro Inquilino RC-I7)
  c_esercizio_corr      constant uuid := 'd0000000-0000-4000-8000-000000000061';
  c_gest_ordinaria      constant uuid := 'd0000000-0000-4000-8000-000000001551';
  c_tab_prop_v2         constant uuid := 'd0000000-0000-4000-8000-000000001512';

  -- Soggetti contabili dedicati a Inquilini e Usufrutto (prefisso 180x)
  c_sogg_conduttore_u1  constant uuid := 'd0000000-0000-4000-8000-000000001801';
  c_sogg_usufruttuario  constant uuid := 'd0000000-0000-4000-8000-000000001802';
  c_sogg_nudo_prop      constant uuid := 'd0000000-0000-4000-8000-000000001803';
  c_sogg_inq_uscente    constant uuid := 'd0000000-0000-4000-8000-000000001804';
  c_sogg_inq_subentr    constant uuid := 'd0000000-0000-4000-8000-000000001805';

  -- Anagrafiche unità (prefisso 181x)
  c_anag_cond_u1        constant uuid := 'd0000000-0000-4000-8000-000000001811';
  c_anag_nudo_u2        constant uuid := 'd0000000-0000-4000-8000-000000001812';
  c_anag_usuf_u2        constant uuid := 'd0000000-0000-4000-8000-000000001813';
  c_anag_inq_usc_u2     constant uuid := 'd0000000-0000-4000-8000-000000001814';
  c_anag_inq_sub_u2     constant uuid := 'd0000000-0000-4000-8000-000000001815';

  -- Letture contatori subentro inquilino (prefisso 1816..1818, RC-H6, RC-I7)
  c_lett_inizio_u2      constant uuid := 'd0000000-0000-4000-8000-000000001816';
  c_lett_subentro_u2    constant uuid := 'd0000000-0000-4000-8000-000000001817';
  c_lett_fine_u2        constant uuid := 'd0000000-0000-4000-8000-000000001818';

  -- Movimenti contabili e Riparti spese per T10, RC-I4, RC-I5 (prefisso 182x - 183x)
  c_mov_asc_ord_t10     constant uuid := 'd0000000-0000-4000-8000-000000001821'; -- T10: Ordinaria ascensore 1.000,00 €
  c_mov_asc_straord_t10 constant uuid := 'd0000000-0000-4000-8000-000000001822'; -- T10: Sostituzione ascensore 5.000,00 €
  c_mov_comp_admin_rci4 constant uuid := 'd0000000-0000-4000-8000-000000001823'; -- RC-I4/I5: Compenso admin 1.500,00 €
  c_mov_sal1_facciata   constant uuid := 'd0000000-0000-4000-8000-000000001824'; -- Fattura 1° SAL Facciata 15.000,00 €

  c_rip_asc_ord_u1      constant uuid := 'd0000000-0000-4000-8000-000000001831'; -- T10: quota 80,00 € -> 100% conduttore (80,00 €)
  c_rip_asc_straord_u1  constant uuid := 'd0000000-0000-4000-8000-000000001832'; -- T10: quota 400,00 € -> 100% proprietario (400,00 €)
  c_rip_comp_admin_u1   constant uuid := 'd0000000-0000-4000-8000-000000001833'; -- RC-I4: quota 120,00 € -> 100% proprietario
  c_rip_comp_admin_u2   constant uuid := 'd0000000-0000-4000-8000-000000001834'; -- RC-I5: quota 120,00 € -> 100% usufruttuario (art. 1004 c.c.)
  c_rip_asc_straord_u2  constant uuid := 'd0000000-0000-4000-8000-000000001835'; -- RC-I5: quota 400,00 € -> 100% nudo proprietario (art. 1005 c.c.)

  -- Fondi condominiali (prefisso 184x, RC-J1..J5, T7)
  c_fondo_speciale_t7   constant uuid := 'd0000000-0000-4000-8000-000000001841'; -- SPECIALE: 60.000,00 € (T7)
  c_fondo_cassa         constant uuid := 'd0000000-0000-4000-8000-000000001842'; -- CASSA: obiettivo 5.000,00 €, saldo 3.500,00 €
  c_fondo_morosita      constant uuid := 'd0000000-0000-4000-8000-000000001843'; -- MOROSITA: obiettivo 3.000,00 €, saldo 1.500,00 €

  -- Gestione Straordinaria, Preventivo e Rata Straordinaria T7 (prefisso 185x - 186x)
  c_gest_straord_t7     constant uuid := 'd0000000-0000-4000-8000-000000001851';
  c_prev_straord_t7     constant uuid := 'd0000000-0000-4000-8000-000000001852';
  c_rata_test_straord   constant uuid := 'd0000000-0000-4000-8000-000000001861';
  c_rdett_straord_u1    constant uuid := 'd0000000-0000-4000-8000-000000001862';

  -- Movimenti Fondo (prefisso 187x, RC-J1, RC-J4)
  c_mf_spec_acc_1       constant uuid := 'd0000000-0000-4000-8000-000000001871'; -- +20.000,00 € 1° SAL
  c_mf_spec_acc_2       constant uuid := 'd0000000-0000-4000-8000-000000001872'; -- +20.000,00 € 2° SAL
  c_mf_spec_uso_sal1    constant uuid := 'd0000000-0000-4000-8000-000000001873'; -- -15.000,00 € Pagamento 1° SAL
  c_mf_cassa_acc_1      constant uuid := 'd0000000-0000-4000-8000-000000001874'; -- +4.000,00 € Dotazione iniziale Fondo Cassa
  c_mf_cassa_override   constant uuid := 'd0000000-0000-4000-8000-000000001875'; -- -500,00 € Utilizzo con override e delibera (RC-J4)
  c_mf_morosita_acc_1   constant uuid := 'd0000000-0000-4000-8000-000000001876'; -- +1.500,00 € Accantonamento Fondo Morosità

  -- Audit logs (prefisso 189x, RC-M1)
  c_audit_fondo_t7      constant uuid := 'd0000000-0000-4000-8000-000000001891';
  c_audit_override_rcj4 constant uuid := 'd0000000-0000-4000-8000-000000001892';

  v_voce_ascensore_id   uuid;
  v_voce_straord_id     uuid;
  v_voce_admin_id       uuid;
begin
  -- Risoluzione amministratore
  if not exists (select 1 from public.utenti where id = v_admin_id) then
    select admin_id into v_admin_id from public.condomini where id = c_condominio;
  end if;
  if v_admin_id is null then
    select id into v_admin_id from public.utenti limit 1;
  end if;
  if v_admin_id is null then
    raise exception 'Nessun utente trovato in public.utenti. Eseguire prima 01_dati_prova.sql.';
  end if;

  -- ===========================================================================
  -- 1. STRUTTURA BASE E VOCI DI CATALOGO (RC-C2, RC-I2, RC-I4)
  -- ===========================================================================
  insert into public.condomini (
    id, admin_id, nome, tipo, codice_fiscale, indirizzo, citta, cap, provincia, iban_principale
  )
  values (
    c_condominio, v_admin_id, 'Condominio di Prova', 'CONDOMINIO',
    '97543210158', 'Via dei Test 1', 'Milano', '20121', 'MI', 'IT60X0542811101000000123456'
  )
  on conflict (id) do update set
    iban_principale = coalesce(public.condomini.iban_principale, excluded.iban_principale);

  insert into public.configurazioni_condominio (id, condominio_id, abilita_contabilita_nuova)
  values (c_config, c_condominio, true)
  on conflict (id) do update set abilita_contabilita_nuova = true;

  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values (c_palazzo_a, c_condominio, 'Palazzo A', 'Via dei Test 1')
  on conflict (id) do nothing;

  insert into public.scale_colonne (id, palazzo_id, tipo, nome)
  values (c_scala_a, c_palazzo_a, 'SCALA', 'Scala A')
  on conflict (id) do nothing;

  select id into v_tipo_appartamento from public.tipologie_unita where descrizione = 'Appartamento' limit 1;
  if v_tipo_appartamento is null then
    v_tipo_appartamento := '22000000-0000-4000-8000-000000000001';
    insert into public.tipologie_unita (id, descrizione)
    values (v_tipo_appartamento, 'Appartamento')
    on conflict (id) do nothing;
  end if;

  insert into public.unita_immobiliari (id, palazzo_id, scala_colonna_id, tipologia_id, interno, piano, mq)
  values
    (c_u1_a, c_palazzo_a, c_scala_a, v_tipo_appartamento, '1', 1, 85),
    (c_u2_a, c_palazzo_a, c_scala_a, v_tipo_appartamento, '2', 1, 70)
  on conflict (id) do nothing;

  insert into public.esercizi_contabili (
    id, condominio_id, anno, data_inizio, data_fine, stato, stato_modello, autore_id
  )
  values (
    c_esercizio_corr, c_condominio, 2026, '2026-01-01', '2026-12-31', 'PREVENTIVO', 'APERTO', v_admin_id
  )
  on conflict (id) do nothing;

  insert into public.gestioni_esercizio (
    id, condominio_id, esercizio_id, tipo, nome, descrizione, stato, autore_id
  )
  values (
    c_gest_ordinaria, c_condominio, c_esercizio_corr, 'ORDINARIA',
    'Gestione Ordinaria 2026', 'Esercizio ordinario 2026', 'ATTIVA', v_admin_id
  )
  on conflict (id) do nothing;

  insert into public.tabelle_millesimali (
    id, condominio_id, nome, totale, tipo, origine, stato_approvazione, valida_da, versione, autore_id
  )
  values (
    c_tab_prop_v2, c_condominio, 'Tabella A - Proprietà Generale', 1000,
    'PROPRIETA', 'INSERITA', 'APPROVATA', '2026-01-01', 2, v_admin_id
  )
  on conflict (id) do nothing;

  -- Voci catalogo spese per T10 e RC-I4
  insert into public.voci_spesa_catalogo (
    condominio_id, codice, nome, tag_default, criterio_default,
    quota_inquilino_default_perc, is_a_periodo, is_compenso_admin, attiva, autore_id
  )
  values
    (c_condominio, 'ASCENSORE', 'Ascensore', 'ORDINARIA', 'TABELLA_SPECIFICA', 100, false, false, true, v_admin_id),
    (c_condominio, 'MANUT_STRAORD', 'Manutenzione straordinaria', 'STRAORDINARIA', 'TUTTI', 0, false, false, true, v_admin_id),
    (c_condominio, 'COMPENSO_ADMIN', 'Compenso amministratore', 'ORDINARIA', 'TUTTI', 0, true, true, true, v_admin_id)
  on conflict (condominio_id, codice) do update set
    quota_inquilino_default_perc = excluded.quota_inquilino_default_perc,
    is_compenso_admin            = excluded.is_compenso_admin;

  select id into v_voce_ascensore_id from public.voci_spesa_catalogo where condominio_id = c_condominio and codice = 'ASCENSORE';
  select id into v_voce_straord_id   from public.voci_spesa_catalogo where condominio_id = c_condominio and codice = 'MANUT_STRAORD';
  select id into v_voce_admin_id     from public.voci_spesa_catalogo where condominio_id = c_condominio and codice = 'COMPENSO_ADMIN';

  -- ===========================================================================
  -- 2. SOGGETTI CONTABILI, CONDUTTORI, USUFRUTTO E LETTURE SUBENTRO (RC-I1..I7)
  -- ===========================================================================
  insert into public.soggetti_contabili (
    id, condominio_id, utente_id, tipo_soggetto, nome_denominazione,
    codice_fiscale, indirizzo, citta, cap, provincia, email, autore_id
  )
  values
    (
      c_sogg_conduttore_u1, c_condominio, null, 'PERSONA_FISICA',
      'Marco Conduttori (Inquilino Int. 1 - Caso T10)', 'CNDMRC88C15F205Z',
      'Via dei Test 1, Int. 1', 'Milano', '20121', 'MI', 'marco.conduttori@example.it', v_admin_id
    ),
    (
      c_sogg_usufruttuario, c_condominio, v_admin_id, 'PERSONA_FISICA',
      'Carla Bianchi (Usufruttuaria Int. 2 - Art. 1004 c.c.)', 'BNCCRL55D50F205W',
      'Via dei Test 1, Int. 2', 'Milano', '20121', 'MI', 'carla.bianchi@example.it', v_admin_id
    ),
    (
      c_sogg_nudo_prop, c_condominio, v_admin_id, 'PERSONA_FISICA',
      'Stefano Bianchi (Nudo Proprietario Int. 2 - Art. 1005 c.c.)', 'BNCSFN82A10F205K',
      'Corso Italia 40', 'Milano', '20122', 'MI', 'stefano.bianchi@example.it', v_admin_id
    ),
    (
      c_sogg_inq_uscente, c_condominio, null, 'PERSONA_FISICA',
      'Davide Uscente (Inquilino Int. 2 I Semestre 2026)', 'USCDVD90A01F205J',
      'Via dei Test 1, Int. 2', 'Milano', '20121', 'MI', 'davide.uscente@example.it', v_admin_id
    ),
    (
      c_sogg_inq_subentr, c_condominio, null, 'PERSONA_FISICA',
      'Sara Subentrante (Inquilina Int. 2 II Semestre 2026)', 'SBNSRA92E45F205Y',
      'Via dei Test 1, Int. 2', 'Milano', '20121', 'MI', 'sara.subentrante@example.it', v_admin_id
    )
  on conflict (id) do update set
    nome_denominazione = excluded.nome_denominazione,
    updated_at         = now();

  insert into public.anagrafiche_unita (
    id, condominio_id, unita_id, utente_id, soggetto_id,
    data_inizio, data_fine, tipo_possesso, ruolo_titolarita, quota_possesso,
    is_referente_bollettino, contratto_inizio, contratto_fine,
    patto_contrario_oneri, tabella_oneri_custom, regola_usufrutto_custom, autore_id
  )
  values
    (
      c_anag_cond_u1, c_condominio, c_u1_a, v_admin_id, c_sogg_conduttore_u1,
      '2026-01-01', null, 'INQUILINO', 'CONDUTTORE', 100,
      false, '2026-01-01', '2029-12-31',
      false, null, null, v_admin_id
    ),
    (
      c_anag_nudo_u2, c_condominio, c_u2_a, v_admin_id, c_sogg_nudo_prop,
      '2022-01-01', null, 'PROPRIETARIO', 'NUDO_PROPRIETARIO', 100,
      false, null, null,
      false, null, null, v_admin_id
    ),
    (
      c_anag_usuf_u2, c_condominio, c_u2_a, v_admin_id, c_sogg_usufruttuario,
      '2022-01-01', null, 'PROPRIETARIO', 'USUFRUTTUARIO', 100,
      true, null, null,
      false, null,
      jsonb_build_object(
        'ordinariaUsufruttuarioPerc', 100,
        'straordinariaUsufruttuarioPerc', 0,
        'noteRegola', 'Riparto ex artt. 1004 e 1005 c.c.'
      ),
      v_admin_id
    ),
    (
      c_anag_inq_usc_u2, c_condominio, c_u2_a, v_admin_id, c_sogg_inq_uscente,
      '2026-01-01', '2026-06-30', 'INQUILINO', 'CONDUTTORE', 100,
      false, '2026-01-01', '2026-06-30',
      false, null, null, v_admin_id
    ),
    (
      c_anag_inq_sub_u2, c_condominio, c_u2_a, v_admin_id, c_sogg_inq_subentr,
      '2026-07-01', null, 'INQUILINO', 'CONDUTTORE', 100,
      false, '2026-07-01', '2026-12-31',
      false, null, null, v_admin_id
    )
  on conflict (id) do update set
    ruolo_titolarita        = excluded.ruolo_titolarita,
    contratto_inizio        = excluded.contratto_inizio,
    contratto_fine          = excluded.contratto_fine,
    regola_usufrutto_custom = excluded.regola_usufrutto_custom,
    updated_at              = now();

  -- Letture contatore acqua su Int. 2 per subentro inquilino al 01/07/2026 (RC-H6, RC-I7)
  insert into public.letture_contatori (
    id, condominio_id, unita_id, esercizio_id, utente_id,
    tipo_contatore, matricola_contatore, data_lettura, valore_lettura,
    consumo_calcolato, is_stimata, is_subentro, da_conguagliare, note, autore_id
  )
  values
    (
      c_lett_inizio_u2, c_condominio, c_u2_a, c_esercizio_corr, v_admin_id,
      'ACQUA', 'MTR-ACQ-A2', '2026-01-01', 100.000,
      0.000, false, false, false, 'Lettura iniziale esercizio 2026', v_admin_id
    ),
    (
      c_lett_subentro_u2, c_condominio, c_u2_a, c_esercizio_corr, v_admin_id,
      'ACQUA', 'MTR-ACQ-A2', '2026-07-01', 120.000,
      20.000, false, true, false, 'Lettura rilevata al subentro inquilino del 01/07/2026 (20 m³ uscente)', v_admin_id
    ),
    (
      c_lett_fine_u2, c_condominio, c_u2_a, c_esercizio_corr, v_admin_id,
      'ACQUA', 'MTR-ACQ-A2', '2026-12-31', 160.000,
      40.000, false, false, false, 'Lettura fine esercizio 2026 (40 m³ subentrante)', v_admin_id
    )
  on conflict (id) do update set
    valore_lettura    = excluded.valore_lettura,
    consumo_calcolato = excluded.consumo_calcolato,
    is_subentro       = excluded.is_subentro,
    updated_at        = now();

  -- ===========================================================================
  -- 3. FONDI CONDOMINIALI (SPECIALE T7, CASSA, MOROSITA) E GESTIONE STRAORDINARIA (RC-J1..J5, T7)
  -- ===========================================================================
  insert into public.fondi (
    id, condominio_id, esercizio_id, nome, tipo,
    delibera_costituzione, data_delibera,
    importo_lavori_centesimi, importo_obiettivo_centesimi, saldo_attuale_centesimi,
    is_progressivo_sal, contratto_appalto_ref, stato, autore_id
  )
  values
    (
      c_fondo_speciale_t7, c_condominio, c_esercizio_corr,
      'Fondo Speciale Lavori Straordinari Facciata (Art. 1135 c. 1 n. 4 - Caso T7)',
      'SPECIALE',
      'Verbale Assemblea Straordinaria del 10/02/2026 - Delibera n. 3/2026',
      '2026-02-10',
      6000000, -- 60.000,00 € lavori deliberati (T7)
      6000000, -- 60.000,00 € fondo speciale costituito di pari importo (T7)
      2500000, -- 25.000,00 € saldo attuale (+40.000,00 € accantonati - 15.000,00 € 1° SAL pagato)
      true,
      'Contratto Appalto Rep. 88/2026 del 18/02/2026 - Impresa EdilRestauri Srl (3 SAL)',
      'VINCOLATO',
      v_admin_id
    ),
    (
      c_fondo_cassa, c_condominio, c_esercizio_corr,
      'Fondo Cassa e Riserva Ordinaria',
      'CASSA',
      'Verbale Assemblea Ordinaria del 15/01/2026 - Delibera n. 2/2026',
      '2026-01-15',
      null,
      500000, -- 5.000,00 € obiettivo
      350000, -- 3.500,00 € saldo (+4.000,00 € dotazione - 500,00 € utilizzo con override)
      false,
      null,
      'ATTIVO',
      v_admin_id
    ),
    (
      c_fondo_morosita, c_condominio, c_esercizio_corr,
      'Fondo Morosità a Garanzia Liquidità Fornitori',
      'MOROSITA',
      'Verbale Assemblea Ordinaria del 15/01/2026 - Delibera n. 3/2026',
      '2026-01-15',
      null,
      300000, -- 3.000,00 € obiettivo
      150000, -- 1.500,00 € saldo attuale
      false,
      null,
      'ATTIVO',
      v_admin_id
    )
  on conflict (id) do update set
    importo_lavori_centesimi    = excluded.importo_lavori_centesimi,
    importo_obiettivo_centesimi = excluded.importo_obiettivo_centesimi,
    saldo_attuale_centesimi     = excluded.saldo_attuale_centesimi,
    is_progressivo_sal          = excluded.is_progressivo_sal,
    contratto_appalto_ref       = excluded.contratto_appalto_ref,
    stato                       = excluded.stato,
    updated_at                  = now();

  -- Gestione Straordinaria collegata al Fondo Speciale T7 (60.000,00 €)
  insert into public.gestioni_esercizio (
    id, condominio_id, esercizio_id, tipo, nome, descrizione,
    delibera_riferimento, data_delibera, importo_lavori_centesimi,
    fondo_speciale_id, stato, autore_id
  )
  values (
    c_gest_straord_t7, c_condominio, c_esercizio_corr,
    'STRAORDINARIA',
    'Gestione Straordinaria Rifacimento Facciata (T7)',
    'Lavori straordinari deliberati per 60.000,00 € con Fondo Speciale integralmente costituito ex art. 1135 c. 1 n. 4 c.c.',
    'Verbale Assemblea Straordinaria del 10/02/2026 - Delibera n. 3/2026',
    '2026-02-10',
    6000000,
    c_fondo_speciale_t7,
    'ATTIVA',
    v_admin_id
  )
  on conflict (id) do update set
    importo_lavori_centesimi = excluded.importo_lavori_centesimi,
    fondo_speciale_id        = excluded.fondo_speciale_id,
    updated_at               = now();

  insert into public.preventivi (
    id, condominio_id, esercizio_id, gestione_id, versione, stato,
    totale_previsto_centesimi, data_approvazione, delibera_approvazione, note, autore_id
  )
  values (
    c_prev_straord_t7, c_condominio, c_esercizio_corr, c_gest_straord_t7,
    1, 'APPROVATO', 6000000, '2026-02-10',
    'Verbale Assemblea Straordinaria del 10/02/2026 - Delibera n. 3/2026',
    'Preventivo straordinario 60.000,00 € con Fondo Speciale costituito (T7)',
    v_admin_id
  )
  on conflict (id) do update set
    totale_previsto_centesimi = excluded.totale_previsto_centesimi,
    stato                     = excluded.stato,
    updated_at                = now();

  insert into public.rate_testata (
    id, condominio_id, esercizio_id, gestione_id, preventivo_id,
    versione_preventivo, stato_preventivo, data_approvazione_preventivo, delibera_approvazione,
    tabella_millesimale_id, numero_rata, percentuale_preventivo,
    data_scadenza, descrizione, pubblicata, autore_id
  )
  values (
    c_rata_test_straord, c_condominio, c_esercizio_corr, c_gest_straord_t7, c_prev_straord_t7,
    1, 'APPROVATO', '2026-02-10', 'Verbale Assemblea Straordinaria del 10/02/2026 - Delibera n. 3/2026',
    c_tab_prop_v2, 1, 33.33,
    '2026-03-31', '1° Rata Straordinaria Facciata (1° SAL - Fondo Speciale T7)', true, v_admin_id
  )
  on conflict (id) do update set
    gestione_id   = excluded.gestione_id,
    preventivo_id = excluded.preventivo_id,
    updated_at    = now();

  insert into public.rate_dettaglio (
    id, condominio_id, rata_testata_id, unita_id, utente_id,
    importo_dovuto, importo_pagato, importo_dovuto_centesimi, importo_pagato_centesimi,
    stato, stato_rata_modello, data_esigibilita, versione_motore_calcolo, autore_id
  )
  values (
    c_rdett_straord_u1, c_condominio, c_rata_test_straord, c_u1_a, v_admin_id,
    1600.00, 1600.00, 160000, 160000,
    'PAGATO', 'PAGATA', '2026-03-31', '1.0.0', v_admin_id
  )
  on conflict (id) do update set
    importo_dovuto_centesimi = excluded.importo_dovuto_centesimi,
    importo_pagato_centesimi = excluded.importo_pagato_centesimi,
    stato_rata_modello       = excluded.stato_rata_modello,
    updated_at               = now();

  -- ===========================================================================
  -- 4. MOVIMENTI CONTABILI E RIPARTI SPESE PER T10, RC-I4, RC-I5 E SAL FONDO SPECIALE
  -- ===========================================================================
  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id, voce_spesa_id,
    numero_progressivo, data, data_registrazione,
    importo, importo_centesimi, segno, descrizione,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    tabella_millesimale_id, versione_tabella, stato_spesa,
    impronta_file_giustificativo, fondo_id, versione_motore_calcolo, autore_id
  )
  values
    (
      c_mov_asc_ord_t10, c_condominio, c_esercizio_corr, c_gest_ordinaria, v_voce_ascensore_id,
      201, '2026-03-10', '2026-03-11',
      1000.00, 100000, '-',
      'Manutenzione ordinaria e canone ispezione ascensore (Caso T10: 1.000,00 €)',
      'ORDINARIA', '2026-01-01', '2026-12-31', 'TABELLA_SPECIFICA',
      c_tab_prop_v2, 2, 'REGISTRATA',
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60201',
      null, '1.0.0', v_admin_id
    ),
    (
      c_mov_asc_straord_t10, c_condominio, c_esercizio_corr, c_gest_ordinaria, v_voce_straord_id,
      202, '2026-04-05', '2026-04-06',
      5000.00, 500000, '-',
      'Sostituzione straordinaria argano e quadro manovra ascensore (Caso T10: 5.000,00 €)',
      'STRAORDINARIA', '2026-01-01', '2026-12-31', 'TABELLA_SPECIFICA',
      c_tab_prop_v2, 2, 'REGISTRATA',
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60202',
      null, '1.0.0', v_admin_id
    ),
    (
      c_mov_comp_admin_rci4, c_condominio, c_esercizio_corr, c_gest_ordinaria, v_voce_admin_id,
      203, '2026-04-15', '2026-04-15',
      1500.00, 150000, '-',
      'Compenso ordinario amministratore esercizio 2026 (RC-I4: escluso per inquilino; RC-I5: a carico usufruttuario)',
      'ORDINARIA', '2026-01-01', '2026-12-31', 'TUTTI',
      c_tab_prop_v2, 2, 'REGISTRATA',
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60203',
      null, '1.0.0', v_admin_id
    ),
    (
      c_mov_sal1_facciata, c_condominio, c_esercizio_corr, c_gest_straord_t7, v_voce_straord_id,
      204, '2026-05-20', '2026-05-20',
      15000.00, 1500000, '-',
      'Pagamento Fattura n. 14/2026 - 1° SAL Lavori Straordinari Facciata (prelevato da Fondo Speciale T7)',
      'STRAORDINARIA', '2026-02-10', '2026-12-31', 'TUTTI',
      c_tab_prop_v2, 2, 'REGISTRATA',
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60204',
      c_fondo_speciale_t7, '1.0.0', v_admin_id
    )
  on conflict (id) do update set
    importo_centesimi = excluded.importo_centesimi,
    tag_spesa         = excluded.tag_spesa,
    fondo_id          = excluded.fondo_id,
    updated_at        = now();

  -- Riparti Spese per T10 (Int. 1: 80 millesimi su 1000) e RC-I5 (Int. 2 in usufrutto: 80 millesimi su 1000)
  insert into public.riparti_spese (
    id, condominio_id, movimento_id, unita_id, utente_id, soggetto_id,
    tabella_millesimale_id, versione_tabella, valore_unitario, somma_valori_partecipanti,
    quota_calcolata_centesimi, resto_arrotondamento_centesimi, importo_quota_centesimi,
    quota_proprietario_centesimi, quota_conduttore_centesimi, quota_usufruttuario_centesimi,
    da_conguagliare, versione_motore_calcolo, autore_id
  )
  values
    (
      -- T10 Voce 1: Ordinaria ascensore 1.000,00 € -> quota Int. 1 = 80,00 € -> 100% Conduttore (80,00 €)
      c_rip_asc_ord_u1, c_condominio, c_mov_asc_ord_t10, c_u1_a, v_admin_id, c_sogg_conduttore_u1,
      c_tab_prop_v2, 2, 80.000, 1000.000,
      8000, 0, 8000,
      0, 8000, 0,
      false, '1.0.0', v_admin_id
    ),
    (
      -- T10 Voce 2: Sostituzione ascensore 5.000,00 € -> quota Int. 1 = 400,00 € -> 100% Proprietario (400,00 €), 0% Conduttore
      c_rip_asc_straord_u1, c_condominio, c_mov_asc_straord_t10, c_u1_a, v_admin_id, null,
      c_tab_prop_v2, 2, 80.000, 1000.000,
      40000, 0, 40000,
      40000, 0, 0,
      false, '1.0.0', v_admin_id
    ),
    (
      -- RC-I4: Compenso amministratore su Int. 1 = 120,00 € -> 0% Conduttore, 100% Proprietario (120,00 €)
      c_rip_comp_admin_u1, c_condominio, c_mov_comp_admin_rci4, c_u1_a, v_admin_id, null,
      c_tab_prop_v2, 2, 80.000, 1000.000,
      12000, 0, 12000,
      12000, 0, 0,
      false, '1.0.0', v_admin_id
    ),
    (
      -- RC-I5: Compenso amministratore su Int. 2 (in usufrutto) = 120,00 € -> 100% Usufruttuario ex art. 1004 c.c.
      c_rip_comp_admin_u2, c_condominio, c_mov_comp_admin_rci4, c_u2_a, v_admin_id, c_sogg_usufruttuario,
      c_tab_prop_v2, 2, 80.000, 1000.000,
      12000, 0, 12000,
      0, 0, 12000,
      false, '1.0.0', v_admin_id
    ),
    (
      -- RC-I5: Sostituzione straordinaria ascensore su Int. 2 (in usufrutto) = 400,00 € -> 100% Nudo Proprietario ex art. 1005 c.c.
      c_rip_asc_straord_u2, c_condominio, c_mov_asc_straord_t10, c_u2_a, v_admin_id, c_sogg_nudo_prop,
      c_tab_prop_v2, 2, 80.000, 1000.000,
      40000, 0, 40000,
      40000, 0, 0,
      false, '1.0.0', v_admin_id
    )
  on conflict (id) do update set
    importo_quota_centesimi       = excluded.importo_quota_centesimi,
    quota_proprietario_centesimi  = excluded.quota_proprietario_centesimi,
    quota_conduttore_centesimi    = excluded.quota_conduttore_centesimi,
    quota_usufruttuario_centesimi = excluded.quota_usufruttuario_centesimi;

  -- ===========================================================================
  -- 5. MOVIMENTI DEI FONDI E OVERRIDE TRACCIATO CON DELIBERA (RC-J1, RC-J4)
  -- ===========================================================================
  insert into public.movimenti_fondo (
    id, condominio_id, fondo_id, movimento_contabile_id, data,
    importo_centesimi, segno, causale,
    is_override_vincolo, motivo_override, delibera_override, autore_id
  )
  values
    (
      c_mf_spec_acc_1, c_condominio, c_fondo_speciale_t7, null, '2026-03-31',
      2000000, '+', 'Accantonamento 1° rata straordinaria al Fondo Speciale Facciata (1° SAL)',
      false, null, null, v_admin_id
    ),
    (
      c_mf_spec_acc_2, c_condominio, c_fondo_speciale_t7, null, '2026-05-15',
      2000000, '+', 'Accantonamento 2° rata straordinaria al Fondo Speciale Facciata (2° SAL)',
      false, null, null, v_admin_id
    ),
    (
      c_mf_spec_uso_sal1, c_condominio, c_fondo_speciale_t7, c_mov_sal1_facciata, '2026-05-20',
      1500000, '-', 'Utilizzo Fondo Speciale per saldo Fattura n. 14/2026 - 1° SAL Impresa EdilRestauri Srl',
      false, null, null, v_admin_id
    ),
    (
      c_mf_cassa_acc_1, c_condominio, c_fondo_cassa, null, '2026-01-31',
      400000, '+', 'Dotazione annuale Fondo Cassa e Riserva Ordinaria',
      false, null, null, v_admin_id
    ),
    (
      c_mf_cassa_override, c_condominio, c_fondo_cassa, null, '2026-06-10',
      50000, '-', 'Utilizzo Fondo Cassa con override assembleare per messa in sicurezza urgente cornicione',
      true,
      'Intervento urgente di messa in sicurezza cornicione autorizzato con prelievo dal Fondo Cassa (escluso compenso amministratore ex RC-J4)',
      'Verbale Assemblea del 08/06/2026 - Delibera n. 4/2026',
      v_admin_id
    ),
    (
      c_mf_morosita_acc_1, c_condominio, c_fondo_morosita, null, '2026-02-15',
      150000, '+', 'Accantonamento iniziale al Fondo Morosità a tutela della liquidità fornitori',
      false, null, null, v_admin_id
    )
  on conflict (id) do update set
    importo_centesimi   = excluded.importo_centesimi,
    segno               = excluded.segno,
    causale             = excluded.causale,
    is_override_vincolo = excluded.is_override_vincolo,
    motivo_override     = excluded.motivo_override,
    delibera_override   = excluded.delibera_override;

  -- ===========================================================================
  -- 6. AUDIT LOGS CONTABILI (RC-M1, RC-J2, RC-J4)
  -- ===========================================================================
  insert into public.audit_logs (
    id, utente_id, condominio_id, azione, tabella, record_id, motivo, valore_prima, valore_dopo, timestamp
  )
  values
    (
      c_audit_fondo_t7,
      v_admin_id,
      c_condominio,
      'CREAZIONE_FONDO_CONDOMINIALE',
      'fondi',
      c_fondo_speciale_t7,
      'Costituzione Fondo Speciale Lavori Straordinari Facciata pari all''intero importo dei lavori (60.000,00 €, art. 1135 c. 1 n. 4 c.c., T7)',
      null,
      jsonb_build_object(
        'tipo', 'SPECIALE',
        'importo_lavori_centesimi', 6000000,
        'importo_obiettivo_centesimi', 6000000,
        'is_progressivo_sal', true,
        'delibera_costituzione', 'Verbale Assemblea Straordinaria del 10/02/2026 - Delibera n. 3/2026'
      ),
      '2026-02-10T18:30:00Z'::timestamptz
    ),
    (
      c_audit_override_rcj4,
      v_admin_id,
      c_condominio,
      'OVERRIDE_VINCOLO_DESTINAZIONE_FONDO',
      'movimenti_fondo',
      c_mf_cassa_override,
      'Intervento urgente di messa in sicurezza cornicione autorizzato con prelievo dal Fondo Cassa (escluso compenso amministratore ex RC-J4)',
      jsonb_build_object(
        'fondo_id', c_fondo_cassa,
        'saldo_precedente_centesimi', 400000
      ),
      jsonb_build_object(
        'fondo_id', c_fondo_cassa,
        'importo_prelevato_centesimi', 50000,
        'nuovo_saldo_centesimi', 350000,
        'is_override_vincolo', true,
        'delibera_override', 'Verbale Assemblea del 08/06/2026 - Delibera n. 4/2026'
      ),
      '2026-06-10T10:15:00Z'::timestamptz
    )
  on conflict (id) do update set
    motivo      = excluded.motivo,
    valore_dopo = excluded.valore_dopo;

  raise notice 'Seed admin_contabilita_fondi_extra applicato con successo.';
end
$seed_admin_contabilita_fondi$;
