-- =============================================================================
-- DATI DI TEST PER PREVENTIVI, PIANO RATE E CICLO DI VITA IMMUTABILE BOLLETTINI
-- (Sezione 6: RC-D1..D5, RC-E1..E6; Sezione 9: RC-M1, RC-N2..N5; Sezione 10: T11, T13, T16)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase (dopo 10_contabilita_schema_modello_obiettivo.sql).
-- Non eseguire in produzione.
--
-- Che cosa predispone su "Condominio di Prova" (d0000000-0000-4000-8000-000000000001):
--   1. Soggetto contabile "Mario Rossi" titolare di 2 unità immobiliari (Palazzo A Int. 1 e Int. 2)
--      e soggetto "Laura Bianchi" titolare di Palazzo A Int. 3 e Palazzo B Int. 1.
--   2. Ciclo di vita del Preventivo (RC-D2, RC-D5):
--      - Preventivo Ordinario v1 in stato `SUPERATO` (9.600,00 € = 960.000 cent, delibera n. 1/2026).
--      - Preventivo Ordinario v2 in stato `APPROVATO` (10.000,00 € = 1.000.000 cent, data assemblea
--        2026-02-15, delibera n. 3/2026, `precedente_id = v1`) con 3 voci in `preventivi_voci`.
--      - Preventivo Straordinario v1 in stato `BOZZA` (5.000,00 € = 500.000 cent) per testare il blocco
--        emissione rate da preventivo non approvato e il relativo override tracciato in audit (RC-D4, T16).
--   3. Piano Rate (`rate_testata` e `rate_dettaglio`, RC-D3, RC-D4, T13, T16):
--      - Rata 1 Ordinaria da Preventivo v2 `APPROVATO` (`emessa_con_override = false`).
--      - Rata 1 Straordinaria Acconto Urgente emessa da Preventivo `BOZZA` con override motivato
--        (`emessa_con_override = true`, `motivo_override`, `delibera_override`, T16).
--   4. Ciclo di vita dei Bollettini (`bollettini` e `bollettini_righe`, RC-E1..E4, T11, T13):
--      - Bollettino n. 10/2026 (`EMESSO`, 800,00 € = 80.000 cent): caso T13 per proprietario Mario Rossi
--        con 2 unità nello stesso bollettino (Riga 1: Int. 1 per 500,00 €; Riga 2: Int. 2 per 300,00 €).
--      - Bollettino n. 11/2026 (`VERIFICATO`, 250,00 € = 25.000 cent): pronto per conferma esplicita ed emissione (RC-E3).
--      - Bollettino n. 12/2026 (`ANNULLATO`, 250,00 € = 25.000 cent) e Bollettino n. 13/2026 (`PARZIALMENTE_PAGATO`,
--        230,00 € = 23.000 cent, `sostituisce_id = n. 12`, `importo_pagato_centesimi = 10.000` [100,00 € trascinati],
--        saldo residuo = 130,00 €): caso T11 di rettifica bollettino emesso con trascinamento incasso parziale (RC-E4).
--      - Bollettino n. 14/2026 (`BOZZA`, 150,00 € = 15.000 cent) con warning non bloccanti in `anomalie_rilevate` (RC-N3).
--   5. Eventi di Audit (`audit_logs`, RC-D4, RC-M1) per approvazione preventivo, override emissione rate (T16)
--      e rettifica bollettino per sostituzione (T11).
--
-- GARANZIE:
--   - Totalmente idempotente (`on conflict ... do update / do nothing`).
--   - Per ripulire: eseguire `supabase/seed-dev/admin_contabilita_bollettini_extra_pulizia.sql`.
-- =============================================================================

do $seed_admin_contabilita_bollettini$
declare
  v_admin_id            uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_tipo_appartamento   uuid;
  v_anno_corrente       integer := extract(year from current_date)::integer;

  -- Riferimenti base Condominio di Prova
  c_condominio          constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a           constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_palazzo_b           constant uuid := 'd0000000-0000-4000-8000-000000000004';
  c_scala_a             constant uuid := 'd0000000-0000-4000-8000-000000000901';
  c_scala_unica_b       constant uuid := 'd0000000-0000-4000-8000-000000000903';

  -- Unità immobiliari
  c_u1_a                constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- Palazzo A, Int 1
  c_u2_a                constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- Palazzo A, Int 2
  c_u3_a                constant uuid := 'd0000000-0000-4000-8000-000000000913'; -- Palazzo A, Int 3
  c_u1_b                constant uuid := 'd0000000-0000-4000-8000-000000000921'; -- Palazzo B, Int 1

  c_esercizio_corr      constant uuid := 'd0000000-0000-4000-8000-000000000061';

  -- Gestioni e Tabella millesimale (condivise o auto-create se assenti)
  c_gest_ordinaria      constant uuid := 'd0000000-0000-4000-8000-000000001551';
  c_gest_straordinaria  constant uuid := 'd0000000-0000-4000-8000-000000001552';
  c_tab_prop_v2         constant uuid := 'd0000000-0000-4000-8000-000000001512';

  -- Soggetti contabili (prefisso 160x)
  c_sogg_rossi          constant uuid := 'd0000000-0000-4000-8000-000000001601';
  c_sogg_bianchi        constant uuid := 'd0000000-0000-4000-8000-000000001602';

  -- Preventivi e Voci Preventivo (prefisso 161x - 162x)
  c_prev_ord_v1         constant uuid := 'd0000000-0000-4000-8000-000000001611'; -- SUPERATO
  c_prev_ord_v2         constant uuid := 'd0000000-0000-4000-8000-000000001612'; -- APPROVATO
  c_prev_straord_bozza  constant uuid := 'd0000000-0000-4000-8000-000000001613'; -- BOZZA (T16)

  c_pvoce_v2_pulizia    constant uuid := 'd0000000-0000-4000-8000-000000001621';
  c_pvoce_v2_ascensore  constant uuid := 'd0000000-0000-4000-8000-000000001622';
  c_pvoce_v2_manut      constant uuid := 'd0000000-0000-4000-8000-000000001623';
  c_pvoce_str_facciata  constant uuid := 'd0000000-0000-4000-8000-000000001624';

  -- Rate Testata e Rate Dettaglio (prefisso 163x - 164x)
  c_rata_test_ord_1     constant uuid := 'd0000000-0000-4000-8000-000000001631';
  c_rata_test_str_ovr   constant uuid := 'd0000000-0000-4000-8000-000000001632';

  c_rdett_ord_u1        constant uuid := 'd0000000-0000-4000-8000-000000001641'; -- Mario Rossi Int. 1 (500,00 €)
  c_rdett_ord_u2        constant uuid := 'd0000000-0000-4000-8000-000000001642'; -- Mario Rossi Int. 2 (300,00 €)
  c_rdett_ord_u3        constant uuid := 'd0000000-0000-4000-8000-000000001643'; -- Laura Bianchi Int. 3 (250,00 € -> rettificato 230,00 €)
  c_rdett_ord_u4        constant uuid := 'd0000000-0000-4000-8000-000000001644'; -- Laura Bianchi Pal. B (250,00 €)
  c_rdett_str_u1        constant uuid := 'd0000000-0000-4000-8000-000000001645'; -- Rata con override T16 (150,00 €)

  -- Bollettini e Righe Bollettino (prefisso 165x - 166x)
  c_boll_n10_multi      constant uuid := 'd0000000-0000-4000-8000-000000001651'; -- N. 10 EMESSO multi-riga (T13: 500 + 300 = 800 €)
  c_boll_n11_verif      constant uuid := 'd0000000-0000-4000-8000-000000001652'; -- N. 11 VERIFICATO (250 €)
  c_boll_n12_annullato  constant uuid := 'd0000000-0000-4000-8000-000000001653'; -- N. 12 ANNULLATO (T11: 250 € originale)
  c_boll_n13_rettif     constant uuid := 'd0000000-0000-4000-8000-000000001654'; -- N. 13 PARZIALMENTE_PAGATO (T11: 230 €, 100 € pagati, 130 € residuo)
  c_boll_n14_bozza      constant uuid := 'd0000000-0000-4000-8000-000000001655'; -- N. 14 BOZZA con warning RC-N3 (150 €)

  c_briga_n10_u1        constant uuid := 'd0000000-0000-4000-8000-000000001661';
  c_briga_n10_u2        constant uuid := 'd0000000-0000-4000-8000-000000001662';
  c_briga_n11_u4        constant uuid := 'd0000000-0000-4000-8000-000000001663';
  c_briga_n12_u3        constant uuid := 'd0000000-0000-4000-8000-000000001664';
  c_briga_n13_u3        constant uuid := 'd0000000-0000-4000-8000-000000001665';
  c_briga_n14_u1        constant uuid := 'd0000000-0000-4000-8000-000000001666';

  -- Audit logs contabili (prefisso 167x)
  c_audit_prev_v2       constant uuid := 'd0000000-0000-4000-8000-000000001671';
  c_audit_override_t16  constant uuid := 'd0000000-0000-4000-8000-000000001672';
  c_audit_rettif_t11    constant uuid := 'd0000000-0000-4000-8000-000000001673';
begin
  -- Risolviamo l'utente admin se presente
  if not exists (select 1 from public.utenti where id = v_admin_id) then
    select id into v_admin_id from public.utenti where is_superadmin = true limit 1;
  end if;
  if v_admin_id is null then
    select id into v_admin_id from public.utenti limit 1;
  end if;

  if v_admin_id is null then
    raise exception 'Nessun utente trovato in public.utenti. Eseguire prima 01_dati_prova.sql.';
  end if;

  select id into v_tipo_appartamento from public.tipologie_unita where descrizione = 'Appartamento' limit 1;
  if v_tipo_appartamento is null then
    insert into public.tipologie_unita (descrizione)
    values ('Appartamento')
    returning id into v_tipo_appartamento;
  end if;

  -- ===========================================================================
  -- 1. STRUTTURA BASE GARANTITA (CONDOMINIO, PALAZZI, UNITA', ESERCIZIO, GESTIONI)
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
    'Via Giuseppe Garibaldi 42',
    'Milano',
    '20121',
    'MI',
    'IT60X0542811101000000123456'
  )
  on conflict (id) do update
  set iban_principale = excluded.iban_principale;

  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values
    (c_palazzo_a, c_condominio, 'Palazzo A (Principale)', 'Via Giuseppe Garibaldi 42 - Corpo A'),
    (c_palazzo_b, c_condominio, 'Palazzo B (Interno Cortile)', 'Via Giuseppe Garibaldi 42 - Corpo B')
  on conflict (id) do nothing;

  insert into public.scale_colonne (id, palazzo_id, tipo, nome)
  values
    (c_scala_a,       c_palazzo_a, 'SCALA', 'Scala A'),
    (c_scala_unica_b, c_palazzo_b, 'SCALA', 'Scala Unica B')
  on conflict (id) do nothing;

  insert into public.unita_immobiliari (
    id, palazzo_id, scala_colonna_id, tipologia_id, interno, piano, mq, foglio_catastale, particella, subalterno
  )
  values
    (c_u1_a, c_palazzo_a, c_scala_a,       v_tipo_appartamento, '1', 1,  85.00, '114', '220', '1'),
    (c_u2_a, c_palazzo_a, c_scala_a,       v_tipo_appartamento, '2', 2, 110.00, '114', '220', '2'),
    (c_u3_a, c_palazzo_a, c_scala_a,       v_tipo_appartamento, '3', 3,  95.00, '114', '220', '3'),
    (c_u1_b, c_palazzo_b, c_scala_unica_b, v_tipo_appartamento, '1', 0,  78.00, '114', '221', '1')
  on conflict (id) do nothing;

  insert into public.esercizi_contabili (
    id, condominio_id, anno, data_inizio, data_fine, stato, stato_modello, autore_id
  )
  values (
    c_esercizio_corr,
    c_condominio,
    v_anno_corrente,
    make_date(v_anno_corrente, 1, 1),
    make_date(v_anno_corrente, 12, 31),
    'PREVENTIVO',
    'APERTO',
    v_admin_id
  )
  on conflict (id) do nothing;

  insert into public.gestioni_esercizio (
    id, condominio_id, esercizio_id, tipo, nome, descrizione, delibera_riferimento, data_delibera, stato, autore_id
  )
  values
    (
      c_gest_ordinaria, c_condominio, c_esercizio_corr,
      'ORDINARIA',
      'Gestione Ordinaria ' || v_anno_corrente,
      'Gestione ordinaria annuale servizi e manutenzione',
      'Verbale Assemblea 15/02/' || v_anno_corrente || ' - Punto 2 OdG',
      make_date(v_anno_corrente, 2, 15),
      'ATTIVA', v_admin_id
    ),
    (
      c_gest_straordinaria, c_condominio, c_esercizio_corr,
      'STRAORDINARIA',
      'Gestione Straordinaria Impianti ' || v_anno_corrente,
      'Rifacimento impianto videocitofonico digitale',
      'Verbale Assemblea 20/02/' || v_anno_corrente || ' - Punto 4 OdG',
      make_date(v_anno_corrente, 2, 20),
      'ATTIVA', v_admin_id
    )
  on conflict (id) do nothing;

  insert into public.tabelle_millesimali (
    id, condominio_id, palazzo_id, scala_colonna_id, nome, totale,
    tipo, origine, stato_approvazione, data_approvazione, delibera_riferimento,
    valida_da, valida_a, versione, autore_id
  )
  values (
    c_tab_prop_v2, c_condominio, null, null,
    'Tabella A - Proprietà Generale', 1000.000,
    'PROPRIETA', 'INSERITA', 'APPROVATA',
    make_date(v_anno_corrente, 1, 10),
    'Verbale Assemblea 10/01/' || v_anno_corrente || ' - Punto 1 OdG',
    make_date(v_anno_corrente, 1, 1), null,
    2, v_admin_id
  )
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 2. SOGGETTI CONTABILI E CONDOMINO CON PIU' UNITA' (T13)
  -- ===========================================================================
  insert into public.soggetti_contabili (
    id, condominio_id, utente_id, tipo_soggetto, nome_denominazione,
    codice_fiscale, email, pec, indirizzo, citta, cap, provincia, autore_id
  )
  values
    (
      c_sogg_rossi, c_condominio, v_admin_id, 'PERSONA_FISICA',
      'Mario Rossi (Proprietario Int. 1 + Int. 2)',
      'RSSMRA80A01F205X', 'mario.rossi@example.com', 'mario.rossi@pec.it',
      'Via Giuseppe Garibaldi 42', 'Milano', '20121', 'MI', v_admin_id
    ),
    (
      c_sogg_bianchi, c_condominio, null, 'PERSONA_FISICA',
      'Laura Bianchi (Proprietaria Int. 3)',
      'BNCLRA85B42F205Z', 'laura.bianchi@example.com', 'laura.bianchi@pec.it',
      'Via Giuseppe Garibaldi 42', 'Milano', '20121', 'MI', v_admin_id
    )
  on conflict (id) do update
  set nome_denominazione = excluded.nome_denominazione,
      codice_fiscale = excluded.codice_fiscale;

  -- ===========================================================================
  -- 3. CICLO DI VITA DEL PREVENTIVO: BOZZA -> APPROVATO -> SUPERATO (RC-D2, RC-D5)
  -- ===========================================================================
  insert into public.preventivi (
    id, condominio_id, esercizio_id, gestione_id, versione, stato,
    totale_previsto_centesimi, data_approvazione, delibera_approvazione,
    precedente_id, note, autore_id
  )
  values
    -- Preventivo Ordinario v1: SUPERATO dalla versione v2 (RC-D5)
    (
      c_prev_ord_v1, c_condominio, c_esercizio_corr, c_gest_ordinaria,
      1, 'SUPERATO',
      960000, -- 9.600,00 €
      make_date(v_anno_corrente, 1, 20),
      'Verbale Assemblea 20/01/' || v_anno_corrente || ' - Delibera n. 1/' || v_anno_corrente,
      null,
      'Prima versione approvata del preventivo ordinario, poi superata da v2 per adeguamento costi energia.',
      v_admin_id
    ),
    -- Preventivo Ordinario v2: APPROVATO con data assemblea e delibera (RC-D2, RC-D5)
    (
      c_prev_ord_v2, c_condominio, c_esercizio_corr, c_gest_ordinaria,
      2, 'APPROVATO',
      1000000, -- 10.000,00 €
      make_date(v_anno_corrente, 2, 15),
      'Verbale Assemblea 15/02/' || v_anno_corrente || ' - Delibera n. 3/' || v_anno_corrente,
      c_prev_ord_v1,
      'Seconda versione approvata del preventivo ordinario che sostituisce v1.',
      v_admin_id
    ),
    -- Preventivo Straordinario v1: BOZZA non ancora approvato (per test blocco/override RC-D4, T16)
    (
      c_prev_straord_bozza, c_condominio, c_esercizio_corr, c_gest_straordinaria,
      1, 'BOZZA',
      500000, -- 5.000,00 €
      null,
      null,
      null,
      'Preventivo in bozza per lavori urgenti: emissione rate consentita solo con override tracciato in audit (RC-D4, T16).',
      v_admin_id
    )
  on conflict (id) do update
  set stato = excluded.stato,
      totale_previsto_centesimi = excluded.totale_previsto_centesimi,
      data_approvazione = excluded.data_approvazione,
      delibera_approvazione = excluded.delibera_approvazione,
      precedente_id = excluded.precedente_id,
      note = excluded.note;

  -- Voci del Preventivo Ordinario v2 (somma = 1.000.000 cent = 10.000,00 €)
  insert into public.preventivi_voci (
    id, condominio_id, preventivo_id, tabella_millesimale_id, versione_tabella,
    criterio_ripartizione, descrizione, importo_previsto_centesimi
  )
  values
    (
      c_pvoce_v2_pulizia, c_condominio, c_prev_ord_v2, c_tab_prop_v2, 2,
      'TUTTI', 'Pulizia e igiene parti comuni', 400000 -- 4.000,00 €
    ),
    (
      c_pvoce_v2_ascensore, c_condominio, c_prev_ord_v2, c_tab_prop_v2, 2,
      'TUTTI', 'Canone manutenzione e forza motrice ascensore', 350000 -- 3.500,00 €
    ),
    (
      c_pvoce_v2_manut, c_condominio, c_prev_ord_v2, c_tab_prop_v2, 2,
      'TUTTI', 'Manutenzione ordinaria, assicurazione e compenso amministratore', 250000 -- 2.500,00 €
    ),
    (
      c_pvoce_str_facciata, c_condominio, c_prev_straord_bozza, c_tab_prop_v2, 2,
      'TUTTI', 'Intervento urgente messa in sicurezza impianti', 500000 -- 5.000,00 €
    )
  on conflict (id) do update
  set descrizione = excluded.descrizione,
      importo_previsto_centesimi = excluded.importo_previsto_centesimi;

  -- ===========================================================================
  -- 4. PIANO RATE (rate_testata e rate_dettaglio, RC-D3, RC-D4, T13, T16)
  -- ===========================================================================
  insert into public.rate_testata (
    id, condominio_id, esercizio_id, gestione_id, preventivo_id, versione_preventivo,
    stato_preventivo, data_approvazione_preventivo, delibera_approvazione,
    emessa_con_override, motivo_override, delibera_override,
    numero_rata, percentuale_preventivo, tabella_millesimale_id,
    data_scadenza, descrizione, pubblicata, autore_id
  )
  values
    -- Rata 1 Ordinaria da Preventivo v2 APPROVATO (regolare)
    (
      c_rata_test_ord_1, c_condominio, c_esercizio_corr, c_gest_ordinaria,
      c_prev_ord_v2, 2, 'APPROVATO',
      make_date(v_anno_corrente, 2, 15),
      'Verbale Assemblea 15/02/' || v_anno_corrente || ' - Delibera n. 3/' || v_anno_corrente,
      false, null, null,
      1, 25.00, c_tab_prop_v2,
      make_date(v_anno_corrente, 3, 31),
      'Rata 1/' || v_anno_corrente || ' — Gestione Ordinaria',
      true, v_admin_id
    ),
    -- Rata 1 Straordinaria da Preventivo BOZZA con OVERRIDE tracciato (RC-D4, T16)
    (
      c_rata_test_str_ovr, c_condominio, c_esercizio_corr, c_gest_straordinaria,
      c_prev_straord_bozza, 1, 'BOZZA',
      null, null,
      true,
      'Emissione anticipata urgente per copertura acconto fornitore messa in sicurezza',
      'Delibera d''urgenza Consiglio Condominiale n. 2/' || v_anno_corrente,
      1, 30.00, c_tab_prop_v2,
      make_date(v_anno_corrente, 4, 15),
      'Rata 1 Straordinaria (Emessa con Override da Preventivo in Bozza)',
      false, v_admin_id
    )
  on conflict (id) do update
  set stato_preventivo = excluded.stato_preventivo,
      emessa_con_override = excluded.emessa_con_override,
      motivo_override = excluded.motivo_override,
      delibera_override = excluded.delibera_override,
      descrizione = excluded.descrizione;

  -- Quote analitiche per unità (rate_dettaglio)
  insert into public.rate_dettaglio (
    id, condominio_id, rata_testata_id, unita_id, utente_id, soggetto_id,
    importo_dovuto, importo_pagato, importo_dovuto_centesimi, importo_pagato_centesimi,
    stato, stato_rata_modello, data_esigibilita, versione_motore_calcolo, autore_id
  )
  values
    -- T13: Mario Rossi possiede Int. 1 (500,00 €) e Int. 2 (300,00 €) -> confluiranno nel Bollettino n. 10 da 800,00 €
    (
      c_rdett_ord_u1, c_condominio, c_rata_test_ord_1, c_u1_a, v_admin_id, c_sogg_rossi,
      500.00, 0.00, 50000, 0,
      'DA_PAGARE', 'EMESSA', make_date(v_anno_corrente, 3, 31), '1.0.0', v_admin_id
    ),
    (
      c_rdett_ord_u2, c_condominio, c_rata_test_ord_1, c_u2_a, v_admin_id, c_sogg_rossi,
      300.00, 0.00, 30000, 0,
      'DA_PAGARE', 'EMESSA', make_date(v_anno_corrente, 3, 31), '1.0.0', v_admin_id
    ),
    -- T11: Quota Laura Bianchi Int. 3 rettificata a 230,00 € con 100,00 € già incassati
    (
      c_rdett_ord_u3, c_condominio, c_rata_test_ord_1, c_u3_a, null, c_sogg_bianchi,
      230.00, 100.00, 23000, 10000,
      'DA_PAGARE', 'PARZIALMENTE_PAGATA', make_date(v_anno_corrente, 3, 31), '1.0.0', v_admin_id
    ),
    -- Quota Palazzo B Int. 1 (250,00 €) nel Bollettino n. 11 VERIFICATO
    (
      c_rdett_ord_u4, c_condominio, c_rata_test_ord_1, c_u1_b, null, c_sogg_bianchi,
      250.00, 0.00, 25000, 0,
      'DA_PAGARE', 'PIANIFICATA', make_date(v_anno_corrente, 3, 31), '1.0.0', v_admin_id
    ),
    -- Quota Rata Straordinaria emessa con override (150,00 €) nel Bollettino n. 14 BOZZA
    (
      c_rdett_str_u1, c_condominio, c_rata_test_str_ovr, c_u1_a, v_admin_id, c_sogg_rossi,
      150.00, 0.00, 15000, 0,
      'DA_PAGARE', 'PIANIFICATA', make_date(v_anno_corrente, 4, 15), '1.0.0', v_admin_id
    )
  on conflict (id) do update
  set importo_dovuto = excluded.importo_dovuto,
      importo_pagato = excluded.importo_pagato,
      importo_dovuto_centesimi = excluded.importo_dovuto_centesimi,
      importo_pagato_centesimi = excluded.importo_pagato_centesimi,
      stato_rata_modello = excluded.stato_rata_modello;

  -- ===========================================================================
  -- 5. BOLLETTINI E RIGHE BOLLETTINO (RC-E1..E4, T11, T13)
  -- ===========================================================================

  -- 5.1 Bollettino n. 10: EMESSO multi-riga per Mario Rossi con 2 unità (T13: 500,00 € + 300,00 € = 800,00 €)
  insert into public.bollettini (
    id, condominio_id, esercizio_id, anno, numero_progressivo,
    destinatario_utente_id, destinatario_soggetto_id, intestazione_destinatario,
    totale_centesimi, importo_pagato_centesimi, data_emissione, data_scadenza,
    stato, sostituisce_id, sostituito_da_id, motivo_rettifica_annullamento,
    anomalie_rilevate, confermato_da, confermato_at,
    iban_accredito, causale_versamento, versione, versione_lock, versione_motore_calcolo, autore_id
  )
  values (
    c_boll_n10_multi, c_condominio, c_esercizio_corr, v_anno_corrente, 10,
    v_admin_id, c_sogg_rossi, 'Mario Rossi (Int. 1 + Int. 2)',
    80000, 0, make_date(v_anno_corrente, 3, 1), make_date(v_anno_corrente, 3, 31),
    'EMESSO', null, null, null,
    '[]'::jsonb, v_admin_id, make_timestamptz(v_anno_corrente, 3, 1, 9, 30, 0, 'UTC'),
    'IT60X0542811101000000123456',
    'Bollettino n. 10/' || v_anno_corrente || ' — Mario Rossi (2 unità: Int. 1 + Int. 2)',
    1, 2, '1.0.0', v_admin_id
  )
  on conflict (id) do update
  set totale_centesimi = excluded.totale_centesimi,
      stato = excluded.stato,
      intestazione_destinatario = excluded.intestazione_destinatario;

  -- 5.2 Bollettino n. 11: VERIFICATO (controlli pre-emissione superati, in attesa di conferma esplicita admin, RC-E3)
  insert into public.bollettini (
    id, condominio_id, esercizio_id, anno, numero_progressivo,
    destinatario_utente_id, destinatario_soggetto_id, intestazione_destinatario,
    totale_centesimi, importo_pagato_centesimi, data_emissione, data_scadenza,
    stato, anomalie_rilevate, iban_accredito, causale_versamento,
    versione, versione_lock, versione_motore_calcolo, autore_id
  )
  values (
    c_boll_n11_verif, c_condominio, c_esercizio_corr, v_anno_corrente, 11,
    null, c_sogg_bianchi, 'Laura Bianchi (Palazzo B - Int. 1)',
    25000, 0, null, make_date(v_anno_corrente, 3, 31),
    'VERIFICATO', '[]'::jsonb, 'IT60X0542811101000000123456',
    'Bollettino n. 11/' || v_anno_corrente || ' — Laura Bianchi (Palazzo B Int. 1)',
    1, 2, '1.0.0', v_admin_id
  )
  on conflict (id) do update
  set stato = excluded.stato,
      totale_centesimi = excluded.totale_centesimi;

  -- 5.3 Bollettini n. 12 e n. 13: Caso T11 (Rettifica di bollettino emesso con incasso parziale di 100,00 €)
  -- Inseriamo prima n. 12 senza sostituito_da_id, poi n. 13 con sostituisce_id = n. 12, poi aggiorniamo n. 12.sostituito_da_id = n. 13
  insert into public.bollettini (
    id, condominio_id, esercizio_id, anno, numero_progressivo,
    destinatario_utente_id, destinatario_soggetto_id, intestazione_destinatario,
    totale_centesimi, importo_pagato_centesimi, data_emissione, data_scadenza,
    stato, sostituisce_id, sostituito_da_id, motivo_rettifica_annullamento,
    anomalie_rilevate, confermato_da, confermato_at,
    iban_accredito, causale_versamento, versione, versione_lock, versione_motore_calcolo, autore_id
  )
  values (
    c_boll_n12_annullato, c_condominio, c_esercizio_corr, v_anno_corrente, 12,
    null, c_sogg_bianchi, 'Laura Bianchi (Palazzo A - Int. 3)',
    25000, 0, make_date(v_anno_corrente, 3, 1), make_date(v_anno_corrente, 3, 31),
    'ANNULLATO', null, null,
    'Rettifica per sostituzione con Bollettino n. 13: ricalcolo quota millesimale da 250,00 € a 230,00 € (T11, RC-E4)',
    '[]'::jsonb, v_admin_id, make_timestamptz(v_anno_corrente, 3, 1, 9, 35, 0, 'UTC'),
    'IT60X0542811101000000123456',
    'Bollettino n. 12/' || v_anno_corrente || ' — Laura Bianchi (ANNULLATO, sostituito da n. 13)',
    1, 3, '1.0.0', v_admin_id
  )
  on conflict (id) do update
  set stato = excluded.stato,
      totale_centesimi = excluded.totale_centesimi,
      motivo_rettifica_annullamento = excluded.motivo_rettifica_annullamento;

  insert into public.bollettini (
    id, condominio_id, esercizio_id, anno, numero_progressivo,
    destinatario_utente_id, destinatario_soggetto_id, intestazione_destinatario,
    totale_centesimi, importo_pagato_centesimi, data_emissione, data_scadenza,
    stato, sostituisce_id, sostituito_da_id, motivo_rettifica_annullamento,
    anomalie_rilevate, confermato_da, confermato_at,
    iban_accredito, causale_versamento, versione, versione_lock, versione_motore_calcolo, autore_id
  )
  values (
    c_boll_n13_rettif, c_condominio, c_esercizio_corr, v_anno_corrente, 13,
    null, c_sogg_bianchi, 'Laura Bianchi (Palazzo A - Int. 3)',
    23000, -- 230,00 € (nuovo importo rettificato)
    10000, -- 100,00 € (incasso parziale automaticamente trascinato da n. 12 -> saldo residuo = 130,00 €)
    make_date(v_anno_corrente, 3, 20), make_date(v_anno_corrente, 3, 31),
    'PARZIALMENTE_PAGATO', c_boll_n12_annullato, null,
    'Sostituisce il Bollettino n. 12 con trascinamento incasso parziale di 100,00 € e ricalcolo saldo residuo a 130,00 € (T11, RC-E4)',
    '[]'::jsonb, v_admin_id, make_timestamptz(v_anno_corrente, 3, 20, 10, 0, 0, 'UTC'),
    'IT60X0542811101000000123456',
    'Bollettino n. 13/' || v_anno_corrente || ' (sostituisce n. 12/' || v_anno_corrente || ') — Laura Bianchi',
    2, 1, '1.0.0', v_admin_id
  )
  on conflict (id) do update
  set totale_centesimi = excluded.totale_centesimi,
      importo_pagato_centesimi = excluded.importo_pagato_centesimi,
      stato = excluded.stato,
      sostituisce_id = excluded.sostituisce_id;

  -- Collega in avanti il Bollettino n. 12 al nuovo Bollettino n. 13
  update public.bollettini
  set sostituito_da_id = c_boll_n13_rettif
  where id = c_boll_n12_annullato;

  -- 5.4 Bollettino n. 14: BOZZA con avviso non bloccante (RC-N3, T16)
  insert into public.bollettini (
    id, condominio_id, esercizio_id, anno, numero_progressivo,
    destinatario_utente_id, destinatario_soggetto_id, intestazione_destinatario,
    totale_centesimi, importo_pagato_centesimi, data_emissione, data_scadenza,
    stato, anomalie_rilevate, iban_accredito, causale_versamento,
    versione, versione_lock, versione_motore_calcolo, autore_id
  )
  values (
    c_boll_n14_bozza, c_condominio, c_esercizio_corr, v_anno_corrente, 14,
    v_admin_id, c_sogg_rossi, 'Mario Rossi (Rata Straordinaria con Override)',
    15000, 0, null, make_date(v_anno_corrente, 4, 15),
    'BOZZA',
    jsonb_build_array(
      jsonb_build_object(
        'codice', 'RATE_EMESSE_CON_OVERRIDE_PREVENTIVO',
        'livello', 'WARNING',
        'bloccante', false,
        'messaggio', 'WARNING: Rate generate da preventivo in stato BOZZA tramite override tracciato (RC-D4, RC-N3, T16).'
      )
    ),
    'IT60X0542811101000000123456',
    'Bollettino n. 14/' || v_anno_corrente || ' — Mario Rossi (Acconto Straordinario)',
    1, 1, '1.0.0', v_admin_id
  )
  on conflict (id) do update
  set stato = excluded.stato,
      totale_centesimi = excluded.totale_centesimi,
      anomalie_rilevate = excluded.anomalie_rilevate;

  -- Aggiorna i puntatori bollettino_id sulle rate_dettaglio emesse
  update public.rate_dettaglio set bollettino_id = c_boll_n10_multi where id in (c_rdett_ord_u1, c_rdett_ord_u2);
  update public.rate_dettaglio set bollettino_id = c_boll_n13_rettif where id = c_rdett_ord_u3;

  -- Righe analitiche dei bollettini (bollettini_righe)
  insert into public.bollettini_righe (
    id, condominio_id, bollettino_id, rata_dettaglio_id, unita_id, gestione_id,
    descrizione, importo_centesimi, data_scadenza
  )
  values
    -- Righe Bollettino n. 10 multi-riga (T13: 50.000 + 30.000 = 80.000 cent = 800,00 €)
    (
      c_briga_n10_u1, c_condominio, c_boll_n10_multi, c_rdett_ord_u1, c_u1_a, c_gest_ordinaria,
      'Rata 1/' || v_anno_corrente || ' — Gestione Ordinaria — Unità Int. 1 (50/1000)',
      50000, make_date(v_anno_corrente, 3, 31)
    ),
    (
      c_briga_n10_u2, c_condominio, c_boll_n10_multi, c_rdett_ord_u2, c_u2_a, c_gest_ordinaria,
      'Rata 1/' || v_anno_corrente || ' — Gestione Ordinaria — Unità Int. 2 (30/1000)',
      30000, make_date(v_anno_corrente, 3, 31)
    ),
    -- Riga Bollettino n. 11 VERIFICATO
    (
      c_briga_n11_u4, c_condominio, c_boll_n11_verif, c_rdett_ord_u4, c_u1_b, c_gest_ordinaria,
      'Rata 1/' || v_anno_corrente || ' — Gestione Ordinaria — Palazzo B Int. 1',
      25000, make_date(v_anno_corrente, 3, 31)
    ),
    -- Riga Bollettino n. 12 ANNULLATO (250,00 € originali)
    (
      c_briga_n12_u3, c_condominio, c_boll_n12_annullato, c_rdett_ord_u3, c_u3_a, c_gest_ordinaria,
      'Rata 1/' || v_anno_corrente || ' — Gestione Ordinaria — Unità Int. 3 (importo originario pre-rettifica)',
      25000, make_date(v_anno_corrente, 3, 31)
    ),
    -- Riga Bollettino n. 13 RETTIFICATO sostitutivo (230,00 €)
    (
      c_briga_n13_u3, c_condominio, c_boll_n13_rettif, c_rdett_ord_u3, c_u3_a, c_gest_ordinaria,
      'Rata 1/' || v_anno_corrente || ' — Gestione Ordinaria — Unità Int. 3 (quota rettificata: sostituisce Boll. n. 12)',
      23000, make_date(v_anno_corrente, 3, 31)
    ),
    -- Riga Bollettino n. 14 BOZZA
    (
      c_briga_n14_u1, c_condominio, c_boll_n14_bozza, c_rdett_str_u1, c_u1_a, c_gest_straordinaria,
      'Rata 1 Straordinaria (Override Preventivo Bozza) — Unità Int. 1',
      15000, make_date(v_anno_corrente, 4, 15)
    )
  on conflict (id) do update
  set descrizione = excluded.descrizione,
      importo_centesimi = excluded.importo_centesimi;

  -- ===========================================================================
  -- 6. TRACCIAMENTO AUDIT DELLE AZIONI CONTABILI CRITICHE (audit_logs, RC-D4, RC-M1)
  -- ===========================================================================
  insert into public.audit_logs (
    id, utente_id, condominio_id, azione, tabella, record_id,
    motivo, valore_prima, valore_dopo, timestamp
  )
  values
    (
      c_audit_prev_v2, v_admin_id, c_condominio,
      'APPROVAZIONE_PREVENTIVO', 'preventivi', c_prev_ord_v2,
      'Approvazione preventivo ordinario v2 con passaggio automatico di v1 a SUPERATO (RC-D2, RC-D5)',
      jsonb_build_object('stato', 'BOZZA', 'precedente_id', c_prev_ord_v1, 'precedente_stato', 'APPROVATO'),
      jsonb_build_object('stato', 'APPROVATO', 'versione', 2, 'totale_previsto_centesimi', 1000000, 'precedente_stato', 'SUPERATO'),
      make_timestamptz(v_anno_corrente, 2, 15, 19, 0, 0, 'UTC')
    ),
    (
      c_audit_override_t16, v_admin_id, c_condominio,
      'OVERRIDE_EMISSIONE_RATE_PREVENTIVO_NON_APPROVATO', 'rate_testata', c_rata_test_str_ovr,
      'Emissione anticipata urgente per copertura acconto fornitore messa in sicurezza (Delibera Consiglio n. 2/' || v_anno_corrente || ')',
      jsonb_build_object('stato_preventivo', 'BOZZA', 'emissione_consentita_default', false),
      jsonb_build_object('emessa_con_override', true, 'preventivo_id', c_prev_straord_bozza),
      make_timestamptz(v_anno_corrente, 3, 5, 11, 0, 0, 'UTC')
    ),
    (
      c_audit_rettif_t11, v_admin_id, c_condominio,
      'RETTIFICA_BOLLETTINO_PER_SOSTITUZIONE', 'bollettini', c_boll_n13_rettif,
      'Rettifica Bollettino n. 12 (250,00 €) con creazione Bollettino n. 13 (230,00 €), trascinamento incasso parziale 100,00 € e saldo residuo 130,00 € (T11, RC-E4)',
      jsonb_build_object('bollettino_originale_id', c_boll_n12_annullato, 'numero_progressivo_originale', 12, 'totale_originale_centesimi', 25000, 'importo_pagato_originale_centesimi', 10000),
      jsonb_build_object('bollettino_originale_stato', 'ANNULLATO', 'nuovo_bollettino_id', c_boll_n13_rettif, 'nuovo_numero_progressivo', 13, 'sostituisce_id', c_boll_n12_annullato, 'nuovo_totale_centesimi', 23000, 'incassi_trascinati_centesimi', 10000, 'saldo_residuo_centesimi', 13000),
      make_timestamptz(v_anno_corrente, 3, 20, 10, 0, 0, 'UTC')
    )
  on conflict (id) do update
  set motivo = excluded.motivo,
      valore_prima = excluded.valore_prima,
      valore_dopo = excluded.valore_dopo;

  raise notice 'Seed admin_contabilita_bollettini_extra applicato con successo su Condominio di Prova (%).', c_condominio;
end
$seed_admin_contabilita_bollettini$;
