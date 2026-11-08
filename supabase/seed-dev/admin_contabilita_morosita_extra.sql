-- =============================================================================
-- DATI DI TEST PER INCASSI, MOROSITA', RECUPERO CREDITI ART. 1129 C. 9 E SUBENTRI
-- (Sezione 6: RC-F1..F4; Sezione 7: RC-G1..G5, RC-H1..H6; Sezione 10: T6, T12)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase (dopo 10_contabilita_schema_modello_obiettivo.sql).
-- Non eseguire in produzione.
--
-- Che cosa predispone su "Condominio di Prova" (d0000000-0000-4000-8000-000000000001):
--   1. Soggetti contabili dedicati (prefisso 170x):
--      - "Giuseppe Verdi" (Venditore / Ex proprietario Palazzo A Int. 3 fino al 14/04/2026).
--      - "Elena Neri" (Acquirente subentrante Palazzo A Int. 3 dal rogito 15/04/2026).
--      - "Luca Gialli" (Inquilino Palazzo A Int. 1, pagatore terzo per conto del proprietario, RC-F3).
--      - "Paolo Blu" (Proprietario Palazzo B Int. 1, condomino moroso per scadenziario T12).
--   2. Subentro per compravendita e solidarietà biennale ex art. 63 c. 4 disp. att. c.c. (RC-H1..H4, T6):
--      - Vendita in data 15/04/2026 su Palazzo A Int. 3:
--        * Saldo pregresso 2023 (500,00 € = 50.000 cent): oltre il biennio -> esclusivo del venditore
--          (`obbligato_in_solido_utente_id = null`).
--        * Saldo pregresso 2025 (800,00 € = 80.000 cent): anno precedente al rogito -> in solido tra
--          venditore e acquirente (`obbligato_in_solido_utente_id = v_acquirente_id`).
--        * Rata 1/2026 già emessa prima del rogito (300,00 € = 30.000 cent): anno in corso -> in solido
--          tra venditore e acquirente, resta intestata al venditore senza riemissione automatica (RC-H4).
--        * Rata 2/2026 pianificata post-rogito (300,00 € = 30.000 cent): non ancora emessa -> instradata
--          direttamente all'acquirente Elena Neri (RC-H4).
--   3. Incassi con imputazione FIFO, pagamento da terzo e storno per insoluto (RC-F1..F4):
--      - Bonifico di 450,00 € (45.000 cent) eseguito dal terzo inquilino "Luca Gialli" imputato in FIFO:
--        300,00 € a saldo integrale della Rata 1 Int. 1 (`PAGATA`) e 150,00 € a copertura parziale della
--        Rata 2 Int. 1 (`PARZIALMENTE_PAGATA`, residuo 150,00 €).
--      - Incasso di 450,00 € su Palazzo B Int. 1 tramite assegno poi respinto per insoluto: scrittura
--        contraria in `transazioni_bancarie` (-450,00 € con `storno_di_id`), pagamento marcato `RIMBORSATO`
--        e riapertura integrale del debito sulla rata (`importo_pagato_centesimi = 0`, RC-F4).
--   4. Scadenziario recupero crediti 6 mesi ex art. 1129 c. 9 c.c. (RC-G3, T12):
--      - Termine perentorio calcolato da chiusura esercizio `2025-12-31` -> `data_limite_azione = '2026-06-30'`
--        con alert automatici a `-90gg` (`2026-04-01`), `-30gg` (`2026-05-31`) e `-7gg` (`2026-06-23`).
--      - 4 posizioni nei 4 stati del ciclo di vita: `DA_AVVIARE`, `AVVIATO`, `DISPENSATO` (con delibera
--        assembleare e data obbligatorie, esente da alert) e `CHIUSO`.
--   5. Principio di non redistribuzione delle quote morosi (RC-G5, RC-L4):
--      - Conguaglio unità virtuosa Int. 1 con saldo 0,00 € (nessun addebito pro-quota della morosità altrui)
--        e conguaglio unità morosa Pal. B Int. 1 con residuo a debito di 450,00 € interamente a suo carico.
--   6. Eventi di Audit (`audit_logs`, RC-M1) per incasso FIFO da terzo, storno insoluto, dispensa assembleare
--      recupero crediti, subentro compravendita T6 ed esportazione elenco morosi ex art. 63 c. 1 disp. att. c.c.
--
-- GARANZIE:
--   - Totalmente idempotente (`on conflict ... do update / do nothing`).
--   - Per ripulire: eseguire `supabase/seed-dev/admin_contabilita_morosita_extra_pulizia.sql`.
-- =============================================================================

do $seed_admin_contabilita_morosita$
declare
  v_admin_id            uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_venditore_id        uuid;
  v_acquirente_id       uuid;
  v_tipo_appartamento   uuid;

  -- Riferimenti base Condominio di Prova
  c_condominio          constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_config              constant uuid := 'd0000000-0000-4000-8000-000000000041';
  c_palazzo_a           constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_palazzo_b           constant uuid := 'd0000000-0000-4000-8000-000000000004';
  c_scala_a             constant uuid := 'd0000000-0000-4000-8000-000000000901';
  c_scala_unica_b       constant uuid := 'd0000000-0000-4000-8000-000000000903';

  -- Unità immobiliari
  c_u1_a                constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- Palazzo A, Int 1 (Virtuoso / Terzo)
  c_u2_a                constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- Palazzo A, Int 2
  c_u3_a                constant uuid := 'd0000000-0000-4000-8000-000000000913'; -- Palazzo A, Int 3 (Oggetto di Subentro T6)
  c_u1_b                constant uuid := 'd0000000-0000-4000-8000-000000000921'; -- Palazzo B, Int 1 (Moroso Insoluto / T12)

  c_esercizio_corr      constant uuid := 'd0000000-0000-4000-8000-000000000061';
  c_gest_ordinaria      constant uuid := 'd0000000-0000-4000-8000-000000001551';
  c_tab_prop_v2         constant uuid := 'd0000000-0000-4000-8000-000000001512';

  -- Soggetti contabili ed Esercizi storici per biennio solidarietà T6 (prefisso 170x)
  c_sogg_venditore      constant uuid := 'd0000000-0000-4000-8000-000000001701';
  c_sogg_acquirente     constant uuid := 'd0000000-0000-4000-8000-000000001702';
  c_sogg_inquilino      constant uuid := 'd0000000-0000-4000-8000-000000001703';
  c_sogg_moroso_b1      constant uuid := 'd0000000-0000-4000-8000-000000001704';

  c_esercizio_2023      constant uuid := 'd0000000-0000-4000-8000-000000001705';
  c_esercizio_2025      constant uuid := 'd0000000-0000-4000-8000-000000001706';

  v_esercizio_2023_id   uuid;
  v_esercizio_2025_id   uuid;
  v_esercizio_2026_id   uuid;

  -- Anagrafiche unità per storico subentro compravendita 15/04/2026 (prefisso 171x)
  c_anag_venditore_u3   constant uuid := 'd0000000-0000-4000-8000-000000001711';
  c_anag_acquirente_u3  constant uuid := 'd0000000-0000-4000-8000-000000001712';
  c_anag_inquilino_u1   constant uuid := 'd0000000-0000-4000-8000-000000001713';

  -- Saldi pregressi T6 (prefisso 172x)
  c_saldo_2023_u3       constant uuid := 'd0000000-0000-4000-8000-000000001721'; -- 2023: 500,00 € esclusivo venditore
  c_saldo_2025_u3       constant uuid := 'd0000000-0000-4000-8000-000000001722'; -- 2025: 800,00 € in solido venditore+acquirente

  -- Rate Testata e Rate Dettaglio per T6 e Incassi RC-F (prefisso 173x - 174x)
  c_rata_test_emessa    constant uuid := 'd0000000-0000-4000-8000-000000001731'; -- Rata 1/2026 (scad. 15/03/2026, pre-rogito)
  c_rata_test_futura    constant uuid := 'd0000000-0000-4000-8000-000000001732'; -- Rata 2/2026 (scad. 30/06/2026, post-rogito)

  c_rdett_2026_emessa_u3 constant uuid := 'd0000000-0000-4000-8000-000000001741'; -- T6: 300,00 € in solido (resta a venditore)
  c_rdett_2026_futura_u3 constant uuid := 'd0000000-0000-4000-8000-000000001742'; -- RC-H4: 300,00 € instradata ad acquirente
  c_rdett_fifo_1_u1      constant uuid := 'd0000000-0000-4000-8000-000000001743'; -- RC-F1/F3: 300,00 € saldata in FIFO da terzo
  c_rdett_fifo_2_u1      constant uuid := 'd0000000-0000-4000-8000-000000001744'; -- RC-F2/F3: 300,00 € pagata parz. 150,00 € in FIFO
  c_rdett_insoluto_b1    constant uuid := 'd0000000-0000-4000-8000-000000001745'; -- RC-F4: 450,00 € riaperta dopo storno assegno

  -- Transazioni bancarie, Pagamenti rate e Riconciliazioni log (prefisso 175x - 176x)
  c_tx_terzo_fifo       constant uuid := 'd0000000-0000-4000-8000-000000001751'; -- +450,00 € bonifico da terzo Luca Gialli
  c_tx_assegno_orig     constant uuid := 'd0000000-0000-4000-8000-000000001752'; -- +450,00 € versamento assegno Paolo Blu
  c_tx_assegno_storno   constant uuid := 'd0000000-0000-4000-8000-000000001753'; -- -450,00 € storno per assegno insoluto (RC-F4)

  c_pag_fifo_1          constant uuid := 'd0000000-0000-4000-8000-000000001761'; -- 300,00 € su Rata 1 Int. 1 (COMPLETATO)
  c_pag_fifo_2          constant uuid := 'd0000000-0000-4000-8000-000000001762'; -- 150,00 € su Rata 2 Int. 1 (COMPLETATO)
  c_pag_insoluto_b1     constant uuid := 'd0000000-0000-4000-8000-000000001763'; -- 450,00 € su Rata 1 Pal. B (RIMBORSATO per insoluto)

  c_ric_fifo_1          constant uuid := 'd0000000-0000-4000-8000-000000001766';
  c_ric_fifo_2          constant uuid := 'd0000000-0000-4000-8000-000000001767';
  c_ric_insoluto_storno constant uuid := 'd0000000-0000-4000-8000-000000001768';

  -- Scadenziario recupero crediti ex art. 1129 c. 9 c.c. (prefisso 177x, RC-G3, T12)
  c_scad_da_avviare     constant uuid := 'd0000000-0000-4000-8000-000000001771'; -- DA_AVVIARE (Pal. B Int. 1, 450,00 €)
  c_scad_avviato        constant uuid := 'd0000000-0000-4000-8000-000000001772'; -- AVVIATO (Saldo 2023 Int. 3, 500,00 €)
  c_scad_dispensato     constant uuid := 'd0000000-0000-4000-8000-000000001773'; -- DISPENSATO con delibera (Saldo 2025 Int. 3, 800,00 €)
  c_scad_chiuso         constant uuid := 'd0000000-0000-4000-8000-000000001774'; -- CHIUSO per pagamento (Int. 1, 300,00 €)

  -- Conguagli senza redistribuzione quote morosi (prefisso 178x, RC-G5, RC-L4)
  c_cong_virtuoso_u1    constant uuid := 'd0000000-0000-4000-8000-000000001781';
  c_cong_moroso_b1      constant uuid := 'd0000000-0000-4000-8000-000000001782';

  -- Audit logs contabili (prefisso 179x, RC-M1)
  c_audit_incasso_fifo  constant uuid := 'd0000000-0000-4000-8000-000000001791';
  c_audit_storno_rcf4   constant uuid := 'd0000000-0000-4000-8000-000000001792';
  c_audit_dispensa_t12  constant uuid := 'd0000000-0000-4000-8000-000000001793';
  c_audit_subentro_t6   constant uuid := 'd0000000-0000-4000-8000-000000001794';
  c_audit_elenco_art63  constant uuid := 'd0000000-0000-4000-8000-000000001795';
begin
  -- Risoluzione amministratore e utenti validi
  if not exists (select 1 from public.utenti where id = v_admin_id) then
    select admin_id into v_admin_id from public.condomini where id = c_condominio;
  end if;
  if v_admin_id is null then
    select id into v_admin_id from public.utenti limit 1;
  end if;
  if v_admin_id is null then
    raise exception 'Nessun utente trovato in public.utenti. Eseguire prima 01_dati_prova.sql.';
  end if;

  -- Se esistono altri utenti in public.utenti li usiamo per venditore/acquirente, altrimenti fallback su v_admin_id
  select id into v_venditore_id from public.utenti where id <> v_admin_id order by created_at asc limit 1;
  if v_venditore_id is null then
    v_venditore_id := v_admin_id;
  end if;

  select id into v_acquirente_id from public.utenti where id not in (v_admin_id, v_venditore_id) order by created_at asc limit 1;
  if v_acquirente_id is null then
    v_acquirente_id := v_admin_id;
  end if;

  -- ===========================================================================
  -- 1. STRUTTURA BASE E CONFIGURAZIONE REGOLE MOROSITA'/INCASSI (RC-F1, RC-G1, RC-G3)
  -- ===========================================================================
  insert into public.condomini (
    id, admin_id, nome, tipo, codice_fiscale, indirizzo, citta, cap, provincia, iban_principale
  )
  values (
    c_condominio,
    v_admin_id,
    'Condominio di Prova',
    'CONDOMINIO',
    '97543210158',
    'Via dei Test 1',
    'Milano',
    '20121',
    'MI',
    'IT60X0542811101000000123456'
  )
  on conflict (id) do update set
    iban_principale = coalesce(public.condomini.iban_principale, excluded.iban_principale),
    codice_fiscale  = coalesce(public.condomini.codice_fiscale, excluded.codice_fiscale);

  insert into public.configurazioni_condominio (
    id, condominio_id, abilita_contabilita_nuova,
    ordine_imputazione_incassi, decorrenza_recupero_mesi, esigibilita_rate_preventivo
  )
  values (
    c_config, c_condominio, true,
    'PIU_VECCHIO', 'CHIUSURA_ESERCIZIO', 'SCADENZA_RATA'
  )
  on conflict (id) do update set
    abilita_contabilita_nuova   = true,
    ordine_imputazione_incassi  = 'PIU_VECCHIO',
    decorrenza_recupero_mesi    = 'CHIUSURA_ESERCIZIO',
    esigibilita_rate_preventivo = 'SCADENZA_RATA';

  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values
    (c_palazzo_a, c_condominio, 'Palazzo A', 'Via dei Test 1'),
    (c_palazzo_b, c_condominio, 'Palazzo B', 'Via dei Test 1 / Edificio Est')
  on conflict (id) do nothing;

  insert into public.scale_colonne (id, palazzo_id, tipo, nome)
  values
    (c_scala_a, c_palazzo_a, 'SCALA', 'Scala A'),
    (c_scala_unica_b, c_palazzo_b, 'SCALA', 'Scala Unica')
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
    (c_u2_a, c_palazzo_a, c_scala_a, v_tipo_appartamento, '2', 1, 70),
    (c_u3_a, c_palazzo_a, c_scala_a, v_tipo_appartamento, '3', 2, 95),
    (c_u1_b, c_palazzo_b, c_scala_unica_b, v_tipo_appartamento, '1B', 1, 80)
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 2. ESERCIZI CONTABILI 2023, 2025 E 2026 (PER BIENNIO SOLIDARIETA' T6 E SCADENZIARIO T12)
  -- ===========================================================================
  select id into v_esercizio_2023_id from public.esercizi_contabili where condominio_id = c_condominio and anno = 2023 limit 1;
  if v_esercizio_2023_id is null then
    v_esercizio_2023_id := c_esercizio_2023;
    insert into public.esercizi_contabili (
      id, condominio_id, anno, data_inizio, data_fine, stato, stato_modello,
      data_chiusura_effettiva, data_approvazione_rendiconto, delibera_approvazione,
      stato_rendiconto, autore_id
    )
    values (
      v_esercizio_2023_id, c_condominio, 2023,
      '2023-01-01', '2023-12-31', 'CHIUSO', 'RENDICONTO_APPROVATO',
      '2023-12-31', '2024-03-20', 'Verbale Assemblea 20/03/2024 - Delibera n. 2/2024',
      'APPROVATO', v_admin_id
    )
    on conflict (id) do nothing;
  end if;

  select id into v_esercizio_2025_id from public.esercizi_contabili where condominio_id = c_condominio and anno = 2025 limit 1;
  if v_esercizio_2025_id is null then
    v_esercizio_2025_id := c_esercizio_2025;
    insert into public.esercizi_contabili (
      id, condominio_id, anno, data_inizio, data_fine, stato, stato_modello,
      data_chiusura_effettiva, data_approvazione_rendiconto, delibera_approvazione,
      stato_rendiconto, autore_id
    )
    values (
      v_esercizio_2025_id, c_condominio, 2025,
      '2025-01-01', '2025-12-31', 'CHIUSO', 'RENDICONTO_APPROVATO',
      '2025-12-31', '2026-02-28', 'Verbale Assemblea 28/02/2026 - Delibera n. 4/2026',
      'APPROVATO', v_admin_id
    )
    on conflict (id) do nothing;
  end if;

  select id into v_esercizio_2026_id from public.esercizi_contabili where condominio_id = c_condominio and anno = 2026 limit 1;
  if v_esercizio_2026_id is null then
    v_esercizio_2026_id := c_esercizio_corr;
    insert into public.esercizi_contabili (
      id, condominio_id, anno, data_inizio, data_fine, stato, stato_modello, autore_id
    )
    values (
      v_esercizio_2026_id, c_condominio, 2026,
      '2026-01-01', '2026-12-31', 'PREVENTIVO', 'APERTO', v_admin_id
    )
    on conflict (id) do nothing;
  end if;

  insert into public.gestioni_esercizio (
    id, condominio_id, esercizio_id, tipo, nome, descrizione, stato, autore_id
  )
  values (
    c_gest_ordinaria, c_condominio, v_esercizio_2026_id,
    'ORDINARIA', 'Gestione Ordinaria 2026',
    'Gestione ordinaria annuale servizi e manutenzione',
    'ATTIVA', v_admin_id
  )
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 3. SOGGETTI CONTABILI E STORICO ANAGRAFICHE SUBENTRO (RC-H1..H4, T6)
  -- ===========================================================================
  insert into public.soggetti_contabili (
    id, condominio_id, utente_id, tipo_soggetto, nome_denominazione,
    codice_fiscale, email, pec, indirizzo, citta, cap, provincia, autore_id
  )
  values
    (
      c_sogg_venditore, c_condominio, v_venditore_id, 'PERSONA_FISICA',
      'Giuseppe Verdi (Venditore Ex Proprietario Int. 3)',
      'VRDGPP75C10F205K', 'giuseppe.verdi@example.com', 'giuseppe.verdi@pec.it',
      'Via dei Test 1', 'Milano', '20121', 'MI', v_admin_id
    ),
    (
      c_sogg_acquirente, c_condominio, v_acquirente_id, 'PERSONA_FISICA',
      'Elena Neri (Acquirente Subentrante Int. 3 - Rogito 15/04/2026)',
      'NRELNE88D55F205W', 'elena.neri@example.com', 'elena.neri@pec.it',
      'Via dei Test 1', 'Milano', '20121', 'MI', v_admin_id
    ),
    (
      c_sogg_inquilino, c_condominio, null, 'PERSONA_FISICA',
      'Luca Gialli (Conduttore Int. 1 - Pagatore Terzo)',
      'GLLLCU90E12F205J', 'luca.gialli@example.com', null,
      'Via dei Test 1', 'Milano', '20121', 'MI', v_admin_id
    ),
    (
      c_sogg_moroso_b1, c_condominio, v_admin_id, 'PERSONA_FISICA',
      'Paolo Blu (Proprietario Pal. B Int. 1B - Moroso Art. 1129)',
      'BLUPLA70A15F205M', 'paolo.blu@example.com', 'paolo.blu@pec.it',
      'Via dei Test 1 / Edificio Est', 'Milano', '20121', 'MI', v_admin_id
    )
  on conflict (id) do update set
    nome_denominazione = excluded.nome_denominazione,
    codice_fiscale     = excluded.codice_fiscale;

  -- Storico titolarità su Palazzo A Int. 3:
  -- 1) Venditore Giuseppe Verdi dal 01/01/2022 al 14/04/2026 (chiusa il giorno precedente al rogito, RC-H1)
  -- 2) Acquirente Elena Neri dal 15/04/2026 (attiva, referente bollettino, con patto interno straordinarie RC-H3)
  insert into public.anagrafiche_unita (
    id, condominio_id, unita_id, utente_id, soggetto_id,
    data_inizio, data_fine, tipo_possesso, ruolo_titolarita, quota_possesso,
    is_referente_bollettino, data_atto_subentro, dante_causa_utente_id,
    note_patto_straordinarie, autore_id
  )
  values
    (
      c_anag_venditore_u3, c_condominio, c_u3_a, v_venditore_id, c_sogg_venditore,
      '2022-01-01', '2026-04-14', 'PROPRIETARIO', 'PROPRIETARIO', 100.00,
      false, null, null,
      'Titolarità cessata per compravendita del 15/04/2026 (Rep. Notaio Dott. Fumagalli n. 48210).',
      v_admin_id
    ),
    (
      c_anag_acquirente_u3, c_condominio, c_u3_a, v_acquirente_id, c_sogg_acquirente,
      '2026-04-15', null, 'PROPRIETARIO', 'PROPRIETARIO', 100.00,
      true, '2026-04-15', v_venditore_id,
      'Opere straordinarie deliberate prima del rogito 15/04/2026 a carico interno del venditore; verso il condominio resta solidarietà ex art. 63 c. 4 disp. att. c.c. (RC-H3).',
      v_admin_id
    ),
    (
      c_anag_inquilino_u1, c_condominio, c_u1_a, v_admin_id, c_sogg_inquilino,
      '2025-01-01', null, 'INQUILINO', 'CONDUTTORE', 100.00,
      false, null, null,
      'Contratto di locazione 4+4 registrato; abilitato a versamenti per conto del proprietario (RC-F3).',
      v_admin_id
    )
  on conflict (id) do update set
    data_inizio              = excluded.data_inizio,
    data_fine                = excluded.data_fine,
    soggetto_id              = excluded.soggetto_id,
    is_referente_bollettino  = excluded.is_referente_bollettino,
    data_atto_subentro       = excluded.data_atto_subentro,
    dante_causa_utente_id    = excluded.dante_causa_utente_id,
    note_patto_straordinarie = excluded.note_patto_straordinarie;

  -- ===========================================================================
  -- 4. SALDI PREGRESSI PER TEST DI ACCETTAZIONE T6 (BIENNIO ART. 63 DISP. ATT. C.C.)
  -- ===========================================================================
  -- Caso T6:
  -- - Debito 2023 (500,00 € = 50.000 cent): anno_competenza = 2023 < 2025 -> ESCLUSIVO VENDITORE (`obbligato_in_solido_utente_id = null`)
  -- - Debito 2025 (800,00 € = 80.000 cent): anno_competenza = 2025 in [2025, 2026] -> IN SOLIDO (`obbligato_in_solido_utente_id = v_acquirente_id`)
  insert into public.saldi_pregressi (
    id, condominio_id, esercizio_id, gestione_id, unita_id, utente_id,
    soggetto_id, obbligato_in_solido_utente_id, anno_competenza,
    importo, importo_centesimi, importo_pagato_centesimi, data_esigibilita,
    note, autore_id
  )
  values
    (
      c_saldo_2023_u3, c_condominio, v_esercizio_2023_id, null, c_u3_a, v_venditore_id,
      c_sogg_venditore, null, 2023,
      500.00, 50000, 0, '2024-03-20',
      'T6 - Saldo conguaglio consuntivo 2023: fuori dal biennio art. 63 disp. att. c.c., debito esclusivo del venditore Giuseppe Verdi.',
      v_admin_id
    ),
    (
      c_saldo_2025_u3, c_condominio, v_esercizio_2025_id, null, c_u3_a, v_venditore_id,
      c_sogg_venditore, v_acquirente_id, 2025,
      800.00, 80000, 0, '2026-02-28',
      'T6 - Saldo conguaglio consuntivo 2025: anno precedente al rogito 15/04/2026, obbligazione solidale tra venditore Giuseppe Verdi e acquirente Elena Neri.',
      v_admin_id
    )
  on conflict (esercizio_id, unita_id) do update set
    soggetto_id                   = excluded.soggetto_id,
    obbligato_in_solido_utente_id = excluded.obbligato_in_solido_utente_id,
    anno_competenza               = excluded.anno_competenza,
    importo                       = excluded.importo,
    importo_centesimi             = excluded.importo_centesimi,
    importo_pagato_centesimi      = excluded.importo_pagato_centesimi,
    data_esigibilita              = excluded.data_esigibilita,
    note                          = excluded.note;

  -- ===========================================================================
  -- 5. RATE TESTATA E DETTAGLIO PER SUBENTRO (T6, RC-H4) E INCASSI (RC-F1..F4)
  -- ===========================================================================
  insert into public.rate_testata (
    id, condominio_id, esercizio_id, gestione_id,
    versione_preventivo, stato_preventivo, data_approvazione_preventivo, delibera_approvazione,
    emessa_con_override, numero_rata, percentuale_preventivo,
    data_scadenza, descrizione, pubblicata, autore_id
  )
  values
    (
      c_rata_test_emessa, c_condominio, v_esercizio_2026_id, c_gest_ordinaria,
      1, 'APPROVATO', '2026-02-15', 'Verbale Assemblea 15/02/2026 - Delibera n. 3/2026',
      false, 1, 50.00,
      '2026-03-15', 'Rata 1/2026 Ordinaria (Pre-rogito T6 / Incassi RC-F)', true, v_admin_id
    ),
    (
      c_rata_test_futura, c_condominio, v_esercizio_2026_id, c_gest_ordinaria,
      1, 'APPROVATO', '2026-02-15', 'Verbale Assemblea 15/02/2026 - Delibera n. 3/2026',
      false, 2, 50.00,
      '2026-06-30', 'Rata 2/2026 Ordinaria (Post-rogito T6 / Parziale FIFO)', true, v_admin_id
    )
  on conflict (id) do update set
    data_scadenza = excluded.data_scadenza,
    descrizione   = excluded.descrizione;

  insert into public.rate_dettaglio (
    id, condominio_id, rata_testata_id, unita_id, utente_id, soggetto_id,
    obbligato_in_solido_utente_id, importo_dovuto, importo_pagato,
    importo_dovuto_centesimi, importo_pagato_centesimi,
    stato, stato_rata_modello, data_esigibilita, data_pagamento, autore_id
  )
  values
    -- T6 & RC-H4: Rata 1/2026 su Int. 3 già EMESSA prima del rogito 15/04/2026 -> resta intestata al venditore ma con vincolo solidale dell'acquirente
    (
      c_rdett_2026_emessa_u3, c_condominio, c_rata_test_emessa, c_u3_a, v_venditore_id, c_sogg_venditore,
      v_acquirente_id, 300.00, 0.00,
      30000, 0,
      'RITARDO', 'EMESSA', '2026-03-15', null, v_admin_id
    ),
    -- RC-H4: Rata 2/2026 su Int. 3 PIANIFICATA (scad. 30/06/2026 dopo il rogito) -> instradata direttamente all'acquirente Elena Neri
    (
      c_rdett_2026_futura_u3, c_condominio, c_rata_test_futura, c_u3_a, v_acquirente_id, c_sogg_acquirente,
      null, 300.00, 0.00,
      30000, 0,
      'DA_PAGARE', 'PIANIFICATA', '2026-06-30', null, v_admin_id
    ),
    -- RC-F1 & RC-F3: Rata 1/2026 su Int. 1 (300,00 €) saldata integralmente in FIFO tramite bonifico del terzo inquilino Luca Gialli
    (
      c_rdett_fifo_1_u1, c_condominio, c_rata_test_emessa, c_u1_a, v_admin_id, c_sogg_inquilino,
      null, 300.00, 300.00,
      30000, 30000,
      'PAGATO', 'PAGATA', '2026-03-15', '2026-03-20', v_admin_id
    ),
    -- RC-F2 & RC-F3: Rata 2/2026 su Int. 1 (300,00 €) coperta parzialmente per 150,00 € (residuo 150,00 €) con l'eccedenza FIFO del bonifico da 450,00 €
    (
      c_rdett_fifo_2_u1, c_condominio, c_rata_test_futura, c_u1_a, v_admin_id, c_sogg_inquilino,
      null, 300.00, 150.00,
      30000, 15000,
      'DA_PAGARE', 'PARZIALMENTE_PAGATA', '2026-06-30', null, v_admin_id
    ),
    -- RC-F4: Rata 1/2026 su Pal. B Int. 1B (450,00 €) riaperta integralmente a seguito di storno per assegno insoluto
    (
      c_rdett_insoluto_b1, c_condominio, c_rata_test_emessa, c_u1_b, v_admin_id, c_sogg_moroso_b1,
      null, 450.00, 0.00,
      45000, 0,
      'RITARDO', 'EMESSA', '2026-03-15', null, v_admin_id
    )
  on conflict (id) do update set
    utente_id                     = excluded.utente_id,
    soggetto_id                   = excluded.soggetto_id,
    obbligato_in_solido_utente_id = excluded.obbligato_in_solido_utente_id,
    importo_dovuto                = excluded.importo_dovuto,
    importo_pagato                = excluded.importo_pagato,
    importo_dovuto_centesimi      = excluded.importo_dovuto_centesimi,
    importo_pagato_centesimi      = excluded.importo_pagato_centesimi,
    stato                         = excluded.stato,
    stato_rata_modello            = excluded.stato_rata_modello,
    data_esigibilita              = excluded.data_esigibilita,
    data_pagamento                = excluded.data_pagamento;

  -- ===========================================================================
  -- 6. TRANSAZIONI BANCARIE, PAGAMENTI RATE E STORNO PER INSOLUTO (RC-F1..F4)
  -- ===========================================================================
  insert into public.transazioni_bancarie (
    id, condominio_id, data_valuta, importo, importo_centesimi,
    causale, pagatore_nome, riferimento_cro, origine, hash_movimento,
    stato_riconciliazione, storno_di_id, autore_id
  )
  values
    -- Bonifico da terzo (inquilino Luca Gialli) di 450,00 € imputato in FIFO su Rata 1 (300 €) e Rata 2 (150 €)
    (
      c_tx_terzo_fifo, c_condominio, '2026-03-20', 450.00, 45000,
      'Bonifico per conto proprietario Int. 1 - Quote condominiali 2026',
      'Luca Gialli (Inquilino Int. 1)', 'CRO20260320TERZOFIFO',
      'CBI', 'HASH-SEED-1751-TERZO-FIFO',
      'RICONCILIATA', null, v_admin_id
    ),
    -- Versamento assegno originario di 450,00 € (poi risultato insoluto)
    (
      c_tx_assegno_orig, c_condominio, '2026-03-18', 450.00, 45000,
      'Versamento assegno bancario n. 00981234 - Rata 1/2026 Pal. B Int. 1B',
      'Paolo Blu', 'ASS20260318ORIG',
      'MANUALE', 'HASH-SEED-1752-ASSEGNO-ORIG',
      'IGNORATA', null, v_admin_id
    ),
    -- Scrittura contraria di storno (-450,00 €) collegata a c_tx_assegno_orig (RC-F4)
    (
      c_tx_assegno_storno, c_condominio, '2026-03-25', -450.00, -45000,
      'STORNO INCASSO RESPINTO: Assegno insoluto / impagato n. 00981234',
      'Paolo Blu', 'STORNO-ASS20260318ORIG',
      'MANUALE', 'HASH-SEED-1753-ASSEGNO-STORNO',
      'IGNORATA', c_tx_assegno_orig, v_admin_id
    )
  on conflict (id) do update set
    importo               = excluded.importo,
    importo_centesimi     = excluded.importo_centesimi,
    stato_riconciliazione = excluded.stato_riconciliazione,
    storno_di_id          = excluded.storno_di_id;

  insert into public.pagamenti_rate (
    id, condominio_id, rata_dettaglio_id, utente_id,
    importo, importo_centesimi, metodo, provider, provider_ref,
    stato, pagatore_nome, pagatore_utente_id, riferimento_cro,
    data_valuta, storno_di_id, completed_at, autore_id
  )
  values
    (
      c_pag_fifo_1, c_condominio, c_rdett_fifo_1_u1, v_admin_id,
      300.00, 30000, 'BONIFICO', 'MANUALE', 'SEED-1761-FIFO-1',
      'COMPLETATO', 'Luca Gialli (Inquilino Int. 1)', null, 'CRO20260320TERZOFIFO',
      '2026-03-20', null, '2026-03-20T10:30:00Z', v_admin_id
    ),
    (
      c_pag_fifo_2, c_condominio, c_rdett_fifo_2_u1, v_admin_id,
      150.00, 15000, 'BONIFICO', 'MANUALE', 'SEED-1762-FIFO-2',
      'COMPLETATO', 'Luca Gialli (Inquilino Int. 1)', null, 'CRO20260320TERZOFIFO',
      '2026-03-20', null, '2026-03-20T10:30:00Z', v_admin_id
    ),
    (
      c_pag_insoluto_b1, c_condominio, c_rdett_insoluto_b1, v_admin_id,
      450.00, 45000, 'BONIFICO', 'MANUALE', 'SEED-1763-INSOLUTO',
      'RIMBORSATO', 'Paolo Blu', v_admin_id, 'ASS20260318ORIG',
      '2026-03-18', null, '2026-03-18T11:00:00Z', v_admin_id
    )
  on conflict (id) do update set
    stato             = excluded.stato,
    importo           = excluded.importo,
    importo_centesimi = excluded.importo_centesimi,
    pagatore_nome     = excluded.pagatore_nome,
    riferimento_cro   = excluded.riferimento_cro;

  insert into public.riconciliazioni_log (
    id, condominio_id, transazione_id, rata_dettaglio_id,
    importo_assegnato, importo_assegnato_centesimi, metodo, autore_id
  )
  values
    (
      c_ric_fifo_1, c_condominio, c_tx_terzo_fifo, c_rdett_fifo_1_u1,
      300.00, 30000, 'AUTO', v_admin_id
    ),
    (
      c_ric_fifo_2, c_condominio, c_tx_terzo_fifo, c_rdett_fifo_2_u1,
      150.00, 15000, 'AUTO', v_admin_id
    ),
    (
      c_ric_insoluto_storno, c_condominio, c_tx_assegno_storno, c_rdett_insoluto_b1,
      -450.00, -45000, 'MANUALE', v_admin_id
    )
  on conflict (id) do update set
    importo_assegnato           = excluded.importo_assegnato,
    importo_assegnato_centesimi = excluded.importo_assegnato_centesimi;

  -- ===========================================================================
  -- 7. SCADENZIARIO RECUPERO CREDITI 6 MESI EX ART. 1129 C. 9 C.C. (RC-G3, T12)
  -- ===========================================================================
  -- Esercizio chiuso il 2025-12-31 -> Scadenza azione legale: 2026-06-30 (+6 mesi)
  -- Alert automatici: -90gg = 2026-04-01, -30gg = 2026-05-31, -7gg = 2026-06-23 (T12)
  insert into public.scadenziario_recupero_crediti (
    id, condominio_id, esercizio_id, unita_id, utente_id, soggetto_id,
    rata_dettaglio_id, saldo_pregresso_id, importo_esigibile_centesimi,
    data_esigibilita, data_decorrenza_semestre, data_limite_azione,
    alert_90gg_at, alert_30gg_at, alert_7gg_at,
    stato, data_avvio_azione, data_dispensa, delibera_dispensa, data_chiusura,
    note, autore_id
  )
  values
    -- 1) DA_AVVIARE: genera alert automatici a 90, 30 e 7 giorni (T12)
    (
      c_scad_da_avviare, c_condominio, v_esercizio_2025_id, c_u1_b, v_admin_id, c_sogg_moroso_b1,
      c_rdett_insoluto_b1, null, 45000,
      '2025-12-31', '2025-12-31', '2026-06-30',
      '2026-04-01', '2026-05-31', '2026-06-23',
      'DA_AVVIARE', null, null, null, null,
      'T12 - Credito esigibile da oltre 90gg dopo storno assegno insoluto; messa in mora da inviare entro il termine perentorio del 30/06/2026.',
      v_admin_id
    ),
    -- 2) AVVIATO: azione monitoria / decreto ingiuntivo depositato nei termini
    (
      c_scad_avviato, c_condominio, v_esercizio_2023_id, c_u3_a, v_venditore_id, c_sogg_venditore,
      null, c_saldo_2023_u3, 50000,
      '2024-03-20', '2023-12-31', '2024-06-30',
      '2024-04-01', '2024-05-31', '2024-06-23',
      'AVVIATO', '2024-05-15', null, null, null,
      'T6/T12 - Recupero forzoso avviato esclusivamente contro il venditore Giuseppe Verdi per debito 2023 fuori dal biennio solidale.',
      v_admin_id
    ),
    -- 3) DISPENSATO: dispensa assembleare esplicita ex art. 1129 c. 9 c.c. (niente alert automatici, T12)
    (
      c_scad_dispensato, c_condominio, v_esercizio_2025_id, c_u3_a, v_venditore_id, c_sogg_venditore,
      null, c_saldo_2025_u3, 80000,
      '2026-02-28', '2025-12-31', '2026-06-30',
      '2026-04-01', '2026-05-31', '2026-06-23',
      'DISPENSATO', null, '2026-04-20',
      'Verbale Assemblea 20/04/2026 - Delibera n. 6/2026 (Dispensa azione esecutiva per piano di rientro con acquirente coobbligato)',
      null,
      'T12 - Azione esecutiva dispensata dall''assemblea con delibera motivata; nessun alert di scadenza attivo.',
      v_admin_id
    ),
    -- 4) CHIUSO: posizione estinta per pagamento integrale
    (
      c_scad_chiuso, c_condominio, v_esercizio_2026_id, c_u1_a, v_admin_id, c_sogg_inquilino,
      c_rdett_fifo_1_u1, null, 30000,
      '2026-03-15', '2026-03-15', '2026-09-15',
      '2026-06-17', '2026-08-16', '2026-09-08',
      'CHIUSO', null, null, null, '2026-03-20',
      'Posizione chiusa per incasso integrale tramite bonifico del terzo conduttore Luca Gialli.',
      v_admin_id
    )
  on conflict (id) do update set
    stato             = excluded.stato,
    data_avvio_azione = excluded.data_avvio_azione,
    data_dispensa     = excluded.data_dispensa,
    delibera_dispensa = excluded.delibera_dispensa,
    data_chiusura     = excluded.data_chiusura,
    note              = excluded.note;

  -- ===========================================================================
  -- 8. CONGUAGLI SENZA REDISTRIBUZIONE DELLE QUOTE MOROSI (RC-G5, RC-L4)
  -- ===========================================================================
  insert into public.conguagli_unita (
    id, condominio_id, esercizio_id, gestione_id, unita_id, utente_id, soggetto_id,
    periodo_da, periodo_a, quota_consuntivo_centesimi, rate_versate_centesimi,
    saldo_conguaglio_centesimi, modalita_regolazione, autore_id
  )
  values
    -- Condomino virtuoso Int. 1: quota consuntivo 1.200,00 €, versato 1.200,00 € -> saldo 0,00 € (nessun ribaltamento morosità altrui)
    (
      c_cong_virtuoso_u1, c_condominio, v_esercizio_2025_id, c_gest_ordinaria, c_u1_a, v_admin_id, null,
      '2025-01-01', '2025-12-31', 120000, 120000,
      0, 'DA_REGOLARE', v_admin_id
    ),
    -- Condomino moroso Pal. B Int. 1B: quota consuntivo 900,00 €, versato 450,00 € -> saldo a debito +450,00 € resta esclusivamente in capo al moroso
    (
      c_cong_moroso_b1, c_condominio, v_esercizio_2025_id, c_gest_ordinaria, c_u1_b, v_admin_id, c_sogg_moroso_b1,
      '2025-01-01', '2025-12-31', 90000, 45000,
      45000, 'RIPORTATO_NUOVO_ESERCIZIO', v_admin_id
    )
  on conflict (id) do update set
    quota_consuntivo_centesimi = excluded.quota_consuntivo_centesimi,
    rate_versate_centesimi     = excluded.rate_versate_centesimi,
    saldo_conguaglio_centesimi = excluded.saldo_conguaglio_centesimi,
    modalita_regolazione       = excluded.modalita_regolazione;

  -- ===========================================================================
  -- 9. AUDIT LOGS CONTABILI (RC-F4, RC-G3, RC-G4, RC-H1..H4, RC-M1)
  -- ===========================================================================
  insert into public.audit_logs (
    id, condominio_id, utente_id, azione, tabella, record_id,
    valore_prima, valore_dopo, motivo
  )
  values
    (
      c_audit_incasso_fifo, c_condominio, v_admin_id,
      'IMPUTAZIONE_INCASSO_FIFO_DA_TERZO', 'transazioni_bancarie', c_tx_terzo_fifo,
      jsonb_build_object('rdett_1_pagato_centesimi', 0, 'rdett_2_pagato_centesimi', 0),
      jsonb_build_object(
        'importo_incassato_centesimi', 45000,
        'pagatore_terzo', 'Luca Gialli (Inquilino Int. 1)',
        'rdett_1_pagato_centesimi', 30000,
        'rdett_2_pagato_centesimi', 15000
      ),
      'Imputazione automatica FIFO di bonifico eseguito dal conduttore terzo per conto del proprietario (RC-F1, RC-F2, RC-F3).'
    ),
    (
      c_audit_storno_rcf4, c_condominio, v_admin_id,
      'STORNO_INCASSO_RESPINTO', 'transazioni_bancarie', c_tx_assegno_storno,
      jsonb_build_object('transazione_originale_id', c_tx_assegno_orig, 'importo_pagato_centesimi', 45000, 'stato_rata', 'PAGATA'),
      jsonb_build_object('transazione_storno_id', c_tx_assegno_storno, 'importo_pagato_centesimi', 0, 'stato_rata', 'EMESSA'),
      'Storno per assegno bancario n. 00981234 insoluto con riapertura integrale del debito su Pal. B Int. 1B (RC-F4).'
    ),
    (
      c_audit_dispensa_t12, c_condominio, v_admin_id,
      'DISPENSA_RECUPERO_CREDITI_ART1129', 'scadenziario_recupero_crediti', c_scad_dispensato,
      jsonb_build_object('stato', 'DA_AVVIARE'),
      jsonb_build_object(
        'stato', 'DISPENSATO',
        'data_dispensa', '2026-04-20',
        'delibera_dispensa', 'Verbale Assemblea 20/04/2026 - Delibera n. 6/2026'
      ),
      'Dispensa assembleare dall''azione esecutiva ex art. 1129 c. 9 c.c. per piano di rientro concordato (RC-G3, T12).'
    ),
    (
      c_audit_subentro_t6, c_condominio, v_admin_id,
      'REGISTRAZIONE_SUBENTRO_COMPRAVENDITA', 'anagrafiche_unita', c_anag_acquirente_u3,
      jsonb_build_object('titolare_precedente_soggetto_id', c_sogg_venditore, 'data_fine_precedente', null),
      jsonb_build_object(
        'nuovo_titolare_soggetto_id', c_sogg_acquirente,
        'data_atto_subentro', '2026-04-15',
        'biennio_solidarieta', jsonb_build_array(2025, 2026),
        'debito_2023_esclusivo_venditore_centesimi', 50000,
        'debito_2025_in_solido_centesimi', 80000,
        'rata_2026_emessa_in_solido_centesimi', 30000,
        'rata_2026_futura_instradata_acquirente_centesimi', 30000
      ),
      'Subentro compravendita 15/04/2026 su Palazzo A Int. 3 con applicazione solidarietà biennale ex art. 63 c. 4 disp. att. c.c. (RC-H1..H4, T6).'
    ),
    (
      c_audit_elenco_art63, c_condominio, v_admin_id,
      'ESPORTAZIONE_ELENCO_MOROSI_ART63', 'condomini', c_condominio,
      null,
      jsonb_build_object(
        'creditore_richiedente', 'Impresa Termoidraulica Rossi S.r.l.',
        'estremi_richiesta', 'PEC del 25/04/2026 - Fattura scaduta n. 88/2026',
        'totale_morosita_esigibile_centesimi', 205000,
        'numero_posizioni_esposte', 4
      ),
      'Comunicazione dati dei condomini morosi ai creditori non soddisfatti ex art. 63 c. 1 disp. att. c.c. (RC-G4).'
    )
  on conflict (id) do update set
    valore_prima = excluded.valore_prima,
    valore_dopo  = excluded.valore_dopo,
    motivo       = excluded.motivo;

  raise notice 'Seed admin_contabilita_morosita_extra applicato con successo su Condominio di Prova (%).', c_condominio;
end
$seed_admin_contabilita_morosita$;
