-- =============================================================================
-- DATI DI TEST PER REGISTRO CRONOLOGICO CONTABILITA', CATALOGO VOCI E SPESE
-- (Sezione 4: RC-A1, RC-A3..A5 e Sezione 5: RC-B1..B5, RC-C1..C8)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase (dopo 10_contabilita_schema_modello_obiettivo.sql).
-- Non eseguire in produzione.
--
-- Che cosa predispone su "Condominio di Prova" (d0000000-0000-4000-8000-000000000001):
--   1. IBAN principale del conto corrente condominiale (IT60X0542811101000000123456)
--      e codice fiscale del condominio (RC-A1), più flag `abilita_contabilita_nuova = true`.
--   2. Struttura minima garantita (Palazzo A, Palazzo B, Scale e 4 Unità Immobiliari) se non già presente.
--   3. Tabelle millesimali versionate (RC-A3, RC-A4, RC-A5):
--      - Tabella A Proprietà Generale v1 (storica chiusa, valida_da 2025-01-01, valida_a 2026-01-01, 1000‰).
--      - Tabella A Proprietà Generale v2 (attiva APPROVATA, valida_da 2026-01-01, precedente_id = v1, 1000‰).
--      - Tabella B Ascensore Palazzo A v1 (attiva APPROVATA, 1000‰ sulle 3 unità di Palazzo A).
--      - Tabella C Riscaldamento Centralizzato v1 (in stato BOZZA per testare l'avviso RC-A5, 1000‰).
--   4. Catalogo configurabile delle voci di spesa (`voci_spesa_catalogo`, RC-C2) e
--      2 gestioni nell'esercizio corrente (`ORDINARIA` e `STRAORDINARIA`, RC-D1).
--   5. 3 Fornitori completi di P.IVA, Codice Fiscale, IBAN e PEC (`fornitori`, RC-B5) +
--      3 giustificativi PDF in `documenti_metadata` con impronta SHA-256 (RC-B3).
--   6. 7 Movimenti nel registro cronologico (`movimenti_contabili`) e relative quote in `riparti_spese`:
--      - Mov. #101: Fattura ordinaria pulizia scale con IVA 22% e ritenuta d'acconto 4% (solo dato analitico,
--        senza F24, RC-B5), giustificativo PDF con impronta SHA-256 (RC-B3), criterio `PALAZZO_SCALA` su Palazzo A.
--      - Mov. #102: Fattura manutenzione ordinaria ascensore registrata con ritardo > 30 giorni
--        (data movimento 2026-01-10, data registrazione 2026-02-25 -> 46 giorni, alert RC-B2), criterio `TABELLA_SPECIFICA`.
--      - Mov. #103: Spesa urgente fuori conto corrente (`eccezione_conto_corrente = true` con `motivo_eccezione_cc`
--        obbligatorio, RC-B1), criterio `TUTTI`.
--      - Mov. #104: Spesa straordinaria sostituzione videocitofono con criterio `PERSONALIZZATO`
--        (atto `DELIBERA_UNANIME`, data e motivazione obbligatori, RC-C3, RC-C6).
--      - Mov. #105: Spesa priva di giustificativo allegato e impronta (`stato_spesa = 'BOZZA'`, RC-B3)
--        che mantiene incompleto il registro fino al caricamento dell'allegato.
--      - Mov. #106 e #107: Movimento errato (`stato_spesa = 'STORNATA'`) e relativa scrittura contraria
--        di storno (`segno = '+'`, `storno_di_id = Mov. #106`, saldo netto = 0 €, RC-B4).
--
-- GARANZIE:
--   - Totalmente idempotente (`on conflict ... do update / do nothing`).
--   - Per ripulire: eseguire `supabase/seed-dev/admin_contabilita_registro_extra_pulizia.sql`.
-- =============================================================================

do $seed_admin_contabilita_registro$
declare
  v_admin_id            uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  v_tipo_appartamento   uuid;
  v_anno_corrente       integer := extract(year from current_date)::integer;

  -- Riferimenti base Condominio di Prova
  c_condominio          constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_config              constant uuid := 'd0000000-0000-4000-8000-000000000041';
  c_palazzo_a           constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_palazzo_b           constant uuid := 'd0000000-0000-4000-8000-000000000004';
  c_scala_a             constant uuid := 'd0000000-0000-4000-8000-000000000901';
  c_scala_unica_b       constant uuid := 'd0000000-0000-4000-8000-000000000903';

  -- Unità immobiliari utilizzate nei riparti
  c_u1_a                constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- Palazzo A, Int 1
  c_u2_a                constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- Palazzo A, Int 2
  c_u3_a                constant uuid := 'd0000000-0000-4000-8000-000000000913'; -- Palazzo A, Int 3
  c_u1_b                constant uuid := 'd0000000-0000-4000-8000-000000000921'; -- Palazzo B, Int 1

  c_esercizio_corr      constant uuid := 'd0000000-0000-4000-8000-000000000061';
  c_cartella_doc        constant uuid := 'd0000000-0000-4000-8000-000000000111';

  -- Piano dei conti e sottoconti (prefisso 150x)
  c_macro_servizi       constant uuid := 'd0000000-0000-4000-8000-000000001501';
  c_macro_manut         constant uuid := 'd0000000-0000-4000-8000-000000001502';
  c_sc_pulizia          constant uuid := 'd0000000-0000-4000-8000-000000001503';
  c_sc_ascensore        constant uuid := 'd0000000-0000-4000-8000-000000001504';
  c_sc_manut_ord        constant uuid := 'd0000000-0000-4000-8000-000000001505';
  c_sc_manut_straord    constant uuid := 'd0000000-0000-4000-8000-000000001506';

  -- Tabelle millesimali versionate (prefisso 151x)
  c_tab_prop_v1         constant uuid := 'd0000000-0000-4000-8000-000000001511';
  c_tab_prop_v2         constant uuid := 'd0000000-0000-4000-8000-000000001512';
  c_tab_asc_v1          constant uuid := 'd0000000-0000-4000-8000-000000001513';
  c_tab_risc_bozza      constant uuid := 'd0000000-0000-4000-8000-000000001514';

  -- Quote millesimali (prefisso 152x)
  c_qm_v1_u1            constant uuid := 'd0000000-0000-4000-8000-000000001521';
  c_qm_v1_u2            constant uuid := 'd0000000-0000-4000-8000-000000001522';
  c_qm_v1_u3            constant uuid := 'd0000000-0000-4000-8000-000000001523';
  c_qm_v1_u4            constant uuid := 'd0000000-0000-4000-8000-000000001524';

  c_qm_v2_u1            constant uuid := 'd0000000-0000-4000-8000-000000001525';
  c_qm_v2_u2            constant uuid := 'd0000000-0000-4000-8000-000000001526';
  c_qm_v2_u3            constant uuid := 'd0000000-0000-4000-8000-000000001527';
  c_qm_v2_u4            constant uuid := 'd0000000-0000-4000-8000-000000001528';

  c_qm_asc_u1           constant uuid := 'd0000000-0000-4000-8000-000000001529';
  c_qm_asc_u2           constant uuid := 'd0000000-0000-4000-8000-000000001530';
  c_qm_asc_u3           constant uuid := 'd0000000-0000-4000-8000-000000001531';

  c_qm_risc_u1          constant uuid := 'd0000000-0000-4000-8000-000000001532';
  c_qm_risc_u2          constant uuid := 'd0000000-0000-4000-8000-000000001533';
  c_qm_risc_u3          constant uuid := 'd0000000-0000-4000-8000-000000001534';
  c_qm_risc_u4          constant uuid := 'd0000000-0000-4000-8000-000000001535';

  -- Catalogo voci spesa (prefisso 154x)
  c_voce_pulizia        constant uuid := 'd0000000-0000-4000-8000-000000001541';
  c_voce_ascensore      constant uuid := 'd0000000-0000-4000-8000-000000001542';
  c_voce_manut_ord      constant uuid := 'd0000000-0000-4000-8000-000000001543';
  c_voce_manut_straord  constant uuid := 'd0000000-0000-4000-8000-000000001544';

  -- Gestioni esercizio (prefisso 155x)
  c_gest_ordinaria      constant uuid := 'd0000000-0000-4000-8000-000000001551';
  c_gest_straordinaria  constant uuid := 'd0000000-0000-4000-8000-000000001552';

  -- Fornitori e Documenti giustificativi (prefisso 156x)
  c_forn_pulizie        constant uuid := 'd0000000-0000-4000-8000-000000001561';
  c_forn_ascensori      constant uuid := 'd0000000-0000-4000-8000-000000001562';
  c_forn_impianti       constant uuid := 'd0000000-0000-4000-8000-000000001563';

  c_doc_fatt_pulizie    constant uuid := 'd0000000-0000-4000-8000-000000001566';
  c_doc_fatt_ascensore  constant uuid := 'd0000000-0000-4000-8000-000000001567';
  c_doc_ric_fabbro      constant uuid := 'd0000000-0000-4000-8000-000000001568';
  c_doc_fatt_citofono   constant uuid := 'd0000000-0000-4000-8000-000000001569';

  -- Movimenti contabili (prefisso 157x)
  c_mov_fatt_pulizie    constant uuid := 'd0000000-0000-4000-8000-000000001571';
  c_mov_ritardo_30gg    constant uuid := 'd0000000-0000-4000-8000-000000001572';
  c_mov_fuori_conto     constant uuid := 'd0000000-0000-4000-8000-000000001573';
  c_mov_personalizzato  constant uuid := 'd0000000-0000-4000-8000-000000001574';
  c_mov_bozza_incompl   constant uuid := 'd0000000-0000-4000-8000-000000001575';
  c_mov_errato_orig     constant uuid := 'd0000000-0000-4000-8000-000000001576';
  c_mov_storno_contr    constant uuid := 'd0000000-0000-4000-8000-000000001577';

  -- Riparti spese (prefisso 158x)
  c_rip_1               constant uuid := 'd0000000-0000-4000-8000-000000001581';
  c_rip_2               constant uuid := 'd0000000-0000-4000-8000-000000001582';
  c_rip_3               constant uuid := 'd0000000-0000-4000-8000-000000001583';
  c_rip_4               constant uuid := 'd0000000-0000-4000-8000-000000001584';
  c_rip_5               constant uuid := 'd0000000-0000-4000-8000-000000001585';
  c_rip_6               constant uuid := 'd0000000-0000-4000-8000-000000001586';
  c_rip_7               constant uuid := 'd0000000-0000-4000-8000-000000001587';
  c_rip_8               constant uuid := 'd0000000-0000-4000-8000-000000001588';
  c_rip_9               constant uuid := 'd0000000-0000-4000-8000-000000001589';
  c_rip_10              constant uuid := 'd0000000-0000-4000-8000-000000001590';
  c_rip_11              constant uuid := 'd0000000-0000-4000-8000-000000001591';
  c_rip_12              constant uuid := 'd0000000-0000-4000-8000-000000001592';

  v_esercizio_id        uuid;
begin
  -- Risoluzione amministratore valido
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
  -- 1. CONDOMINIO CON IBAN OBBLIGATORIO E CONFIGURAZIONE CONTABILITA' (RC-A1)
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
    id, condominio_id, abilita_contabilita_nuova, quota_fissa_riscaldamento_perc
  )
  values (c_config, c_condominio, true, 30.00)
  on conflict (id) do update set
    abilita_contabilita_nuova = true;

  -- Struttura minima: Palazzi, Scale e 4 Unità Immobiliari
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

  -- Esercizio contabile corrente
  select id into v_esercizio_id
  from public.esercizi_contabili
  where condominio_id = c_condominio and anno = v_anno_corrente
  limit 1;

  if v_esercizio_id is null then
    v_esercizio_id := c_esercizio_corr;
    insert into public.esercizi_contabili (
      id, condominio_id, anno, data_inizio, data_fine, stato, stato_modello,
      saldo_iniziale_conto_centesimi, stato_rendiconto, registro_contabilita_completo, autore_id
    )
    values (
      v_esercizio_id,
      c_condominio,
      v_anno_corrente,
      make_date(v_anno_corrente, 1, 1),
      make_date(v_anno_corrente, 12, 31),
      'PREVENTIVO',
      'APERTO',
      1250000, -- € 12.500,00 saldo iniziale conto
      'IN_PREPARAZIONE',
      false,
      v_admin_id
    )
    on conflict (id) do nothing;
  end if;

  -- ===========================================================================
  -- 2. TABELLE MILLESIMALI VERSIONATE E QUOTE MILLESIMALI (RC-A3, RC-A4, RC-A5)
  -- ===========================================================================
  -- Versione 1 storica chiusa (anno precedente)
  insert into public.tabelle_millesimali (
    id, condominio_id, nome, totale, tipo, origine, stato_approvazione,
    data_approvazione, delibera_riferimento, valida_da, valida_a, versione, precedente_id, autore_id
  )
  values (
    c_tab_prop_v1,
    c_condominio,
    'Tabella A - Proprietà Generale (v1 storica)',
    1000.000,
    'PROPRIETA',
    'INSERITA',
    'APPROVATA',
    make_date(v_anno_corrente - 1, 1, 15),
    'Delibera Assembleare n. 1/2025',
    make_date(v_anno_corrente - 1, 1, 1),
    make_date(v_anno_corrente, 1, 1),
    1,
    null,
    v_admin_id
  )
  on conflict (id) do update set
    valida_a = excluded.valida_a,
    versione = 1;

  insert into public.quote_millesimali (id, condominio_id, tabella_id, unita_id, valore_millesimale, valore_millesimi_int, autore_id)
  values
    (c_qm_v1_u1, c_condominio, c_tab_prop_v1, c_u1_a, 300.000, 300000, v_admin_id),
    (c_qm_v1_u2, c_condominio, c_tab_prop_v1, c_u2_a, 250.000, 250000, v_admin_id),
    (c_qm_v1_u3, c_condominio, c_tab_prop_v1, c_u3_a, 250.000, 250000, v_admin_id),
    (c_qm_v1_u4, c_condominio, c_tab_prop_v1, c_u1_b, 200.000, 200000, v_admin_id)
  on conflict (id) do update set
    valore_millesimale   = excluded.valore_millesimale,
    valore_millesimi_int = excluded.valore_millesimi_int;

  -- Versione 2 attiva approvata (revisione post-ampliamento unità 3, RC-A4)
  insert into public.tabelle_millesimali (
    id, condominio_id, nome, totale, tipo, origine, stato_approvazione,
    data_approvazione, delibera_riferimento, valida_da, valida_a, versione, precedente_id, autore_id
  )
  values (
    c_tab_prop_v2,
    c_condominio,
    'Tabella A - Proprietà Generale (v2 in vigore)',
    1000.000,
    'PROPRIETA',
    'INSERITA',
    'APPROVATA',
    make_date(v_anno_corrente, 1, 10),
    'Delibera Assembleare n. 2/2026 - Revisione ex art. 69 disp. att. c.c.',
    make_date(v_anno_corrente, 1, 1),
    null,
    2,
    c_tab_prop_v1,
    v_admin_id
  )
  on conflict (id) do update set
    precedente_id = c_tab_prop_v1,
    versione      = 2,
    valida_a      = null;

  -- Quote v2: 280 + 220 + 300 + 200 = 1000,000 ‰ (Palazzo A = 800 ‰, Palazzo B = 200 ‰)
  insert into public.quote_millesimali (id, condominio_id, tabella_id, unita_id, valore_millesimale, valore_millesimi_int, autore_id)
  values
    (c_qm_v2_u1, c_condominio, c_tab_prop_v2, c_u1_a, 280.000, 280000, v_admin_id),
    (c_qm_v2_u2, c_condominio, c_tab_prop_v2, c_u2_a, 220.000, 220000, v_admin_id),
    (c_qm_v2_u3, c_condominio, c_tab_prop_v2, c_u3_a, 300.000, 300000, v_admin_id),
    (c_qm_v2_u4, c_condominio, c_tab_prop_v2, c_u1_b, 200.000, 200000, v_admin_id)
  on conflict (id) do update set
    valore_millesimale   = excluded.valore_millesimale,
    valore_millesimi_int = excluded.valore_millesimi_int;

  -- Tabella B Ascensore Palazzo A (specifica, 1000 ‰ sulle 3 unità di Palazzo A)
  insert into public.tabelle_millesimali (
    id, condominio_id, palazzo_id, scala_colonna_id, nome, totale, tipo, origine,
    tabella_sorgente_id, stato_approvazione, data_approvazione, delibera_riferimento,
    valida_da, valida_a, versione, autore_id
  )
  values (
    c_tab_asc_v1,
    c_condominio,
    c_palazzo_a,
    c_scala_a,
    'Tabella B - Ascensore Palazzo A (art. 1124 c.c.)',
    1000.000,
    'ASCENSORE',
    'DERIVATA',
    c_tab_prop_v2,
    'APPROVATA',
    make_date(v_anno_corrente, 1, 10),
    'Delibera Assembleare n. 2/2026',
    make_date(v_anno_corrente, 1, 1),
    null,
    1,
    v_admin_id
  )
  on conflict (id) do update set
    stato_approvazione = 'APPROVATA';

  insert into public.quote_millesimali (id, condominio_id, tabella_id, unita_id, valore_millesimale, valore_millesimi_int, autore_id)
  values
    (c_qm_asc_u1, c_condominio, c_tab_asc_v1, c_u1_a, 300.000, 300000, v_admin_id),
    (c_qm_asc_u2, c_condominio, c_tab_asc_v1, c_u2_a, 250.000, 250000, v_admin_id),
    (c_qm_asc_u3, c_condominio, c_tab_asc_v1, c_u3_a, 450.000, 450000, v_admin_id)
  on conflict (id) do update set
    valore_millesimale   = excluded.valore_millesimale,
    valore_millesimi_int = excluded.valore_millesimi_int;

  -- Tabella C Riscaldamento in stato BOZZA (per testare l'avviso RC-A5)
  insert into public.tabelle_millesimali (
    id, condominio_id, nome, totale, tipo, origine, stato_approvazione,
    valida_da, valida_a, versione, autore_id
  )
  values (
    c_tab_risc_bozza,
    c_condominio,
    'Tabella C - Quota Fissa Riscaldamento (Bozza UNI 10200)',
    1000.000,
    'RISCALDAMENTO',
    'INSERITA',
    'BOZZA',
    make_date(v_anno_corrente, 1, 1),
    null,
    1,
    v_admin_id
  )
  on conflict (id) do update set
    stato_approvazione = 'BOZZA';

  insert into public.quote_millesimali (id, condominio_id, tabella_id, unita_id, valore_millesimale, valore_millesimi_int, autore_id)
  values
    (c_qm_risc_u1, c_condominio, c_tab_risc_bozza, c_u1_a, 270.000, 270000, v_admin_id),
    (c_qm_risc_u2, c_condominio, c_tab_risc_bozza, c_u2_a, 230.000, 230000, v_admin_id),
    (c_qm_risc_u3, c_condominio, c_tab_risc_bozza, c_u3_a, 290.000, 290000, v_admin_id),
    (c_qm_risc_u4, c_condominio, c_tab_risc_bozza, c_u1_b, 210.000, 210000, v_admin_id)
  on conflict (id) do update set
    valore_millesimale   = excluded.valore_millesimale,
    valore_millesimi_int = excluded.valore_millesimi_int;

  -- ===========================================================================
  -- 3. PIANO DEI CONTI, CATALOGO VOCI DI SPESA E GESTIONI (RC-C2, RC-D1)
  -- ===========================================================================
  insert into public.piano_dei_conti (id, condominio_id, codice, descrizione_macro)
  values
    (c_macro_servizi, c_condominio, 'REG-S', 'Servizi e Pulizia Parti Comuni'),
    (c_macro_manut,   c_condominio, 'REG-M', 'Manutenzioni Ordinarie e Straordinarie')
  on conflict (id) do nothing;

  insert into public.sottoconti (id, piano_conto_id, descrizione_micro)
  values
    (c_sc_pulizia,       c_macro_servizi, 'Pulizia e igienizzazione scale'),
    (c_sc_ascensore,     c_macro_servizi, 'Canone e assistenza ascensore'),
    (c_sc_manut_ord,     c_macro_manut,   'Piccole riparazioni e pronto intervento'),
    (c_sc_manut_straord, c_macro_manut,   'Interventi straordinari deliberati')
  on conflict (id) do nothing;

  insert into public.voci_spesa_catalogo (
    id, condominio_id, sottoconto_id, codice, nome, tag_default,
    criterio_default, tabella_default_id, quota_inquilino_default_perc,
    is_a_periodo, is_compenso_admin, attiva, autore_id
  )
  values
    (c_voce_pulizia,       c_condominio, c_sc_pulizia,       'PULIZIA_SCALE',   'Pulizia scale',              'ORDINARIA',     'PALAZZO_SCALA',     c_tab_prop_v2, 100.00, false, false, true, v_admin_id),
    (c_voce_ascensore,     c_condominio, c_sc_ascensore,     'ASCENSORE',       'Ascensore',                  'ORDINARIA',     'TABELLA_SPECIFICA', c_tab_asc_v1,  100.00, false, false, true, v_admin_id),
    (c_voce_manut_ord,     c_condominio, c_sc_manut_ord,     'MANUT_ORDINARIA', 'Manutenzione ordinaria',     'ORDINARIA',     'TUTTI',             c_tab_prop_v2, 100.00, false, false, true, v_admin_id),
    (c_voce_manut_straord, c_condominio, c_sc_manut_straord, 'MANUT_STRAORD',   'Manutenzione straordinaria', 'STRAORDINARIA', 'TUTTI',             c_tab_prop_v2,   0.00, false, false, true, v_admin_id)
  on conflict (condominio_id, codice) do update set
    nome               = excluded.nome,
    tag_default        = excluded.tag_default,
    criterio_default   = excluded.criterio_default,
    tabella_default_id = excluded.tabella_default_id;

  insert into public.gestioni_esercizio (
    id, condominio_id, esercizio_id, tipo, nome, descrizione, delibera_riferimento, data_delibera, stato, autore_id
  )
  values
    (
      c_gest_ordinaria,
      c_condominio,
      v_esercizio_id,
      'ORDINARIA',
      'Gestione Ordinaria ' || v_anno_corrente,
      'Gestione ordinaria annuale servizi e manutenzione corrente',
      'Delibera n. 1/' || v_anno_corrente,
      make_date(v_anno_corrente, 1, 15),
      'ATTIVA',
      v_admin_id
    ),
    (
      c_gest_straordinaria,
      c_condominio,
      v_esercizio_id,
      'STRAORDINARIA',
      'Gestione Straordinaria Adeguamento Impianti ' || v_anno_corrente,
      'Sostituzione impianto videocitofonico e adeguamento elettrico',
      'Delibera Unanime n. 4/' || v_anno_corrente,
      make_date(v_anno_corrente, 2, 18),
      'ATTIVA',
      v_admin_id
    )
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 4. FORNITORI FISCALMENTE COMPLETI E GIUSTIFICATIVI ALLEGATI (RC-B3, RC-B5)
  -- ===========================================================================
  insert into public.fornitori (
    id, admin_id, condominio_id, ragione_sociale, p_iva, codice_fiscale,
    iban, email, pec, telefono, indirizzo, categoria
  )
  values
    (
      c_forn_pulizie,
      v_admin_id,
      c_condominio,
      'Splendor Pulizie Condominiali S.r.l.',
      '08451230961',
      '08451230961',
      'IT44G0306909400100000045612',
      'amministrazione@splendorpulizie.it',
      'splendorpulizie@pec.it',
      '0245896321',
      'Via Mecenate 84, 20138 Milano (MI)',
      'Pulizie'
    ),
    (
      c_forn_ascensori,
      v_admin_id,
      c_condominio,
      'ElevaTech Ascensori S.p.A.',
      '03918270964',
      '03918270964',
      'IT71M0200801600000102938475',
      'fatture@elevatech.it',
      'elevatech@legalmail.it',
      '0265987412',
      'Viale Monza 120, 20127 Milano (MI)',
      'Ascensori'
    ),
    (
      c_forn_impianti,
      v_admin_id,
      c_condominio,
      'ElettroSicura Impianti di Bianchi Marco',
      '05123980967',
      'BNCMRC78D15F205Z',
      'IT19S0503401600000000098712',
      'info@elettrosicura.it',
      'marcobianchi.impianti@pec.it',
      '3487654321',
      'Via Padova 55, 20131 Milano (MI)',
      'Elettricista'
    )
  on conflict (id) do update set
    p_iva          = excluded.p_iva,
    codice_fiscale = excluded.codice_fiscale,
    pec            = excluded.pec;

  insert into public.cartelle_documenti (id, condominio_id, parent_id, nome_cartella)
  values (c_cartella_doc, c_condominio, null, 'Giustificativi e Fatture Contabili')
  on conflict (id) do nothing;

  insert into public.documenti_metadata (id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da)
  values
    (
      c_doc_fatt_pulizie,
      c_cartella_doc,
      null,
      c_condominio::text || '/fatture/fattura_splendor_2026_101.pdf',
      'fattura_splendor_2026_101.pdf',
      'application/pdf',
      v_admin_id
    ),
    (
      c_doc_fatt_ascensore,
      c_cartella_doc,
      null,
      c_condominio::text || '/fatture/fattura_elevatech_2026_018.pdf',
      'fattura_elevatech_2026_018.pdf',
      'application/pdf',
      v_admin_id
    ),
    (
      c_doc_ric_fabbro,
      c_cartella_doc,
      null,
      c_condominio::text || '/fatture/ricevuta_sblocco_serratura_urgente.pdf',
      'ricevuta_sblocco_serratura_urgente.pdf',
      'application/pdf',
      v_admin_id
    ),
    (
      c_doc_fatt_citofono,
      c_cartella_doc,
      null,
      c_condominio::text || '/fatture/fattura_elettrosicura_videocitofono.pdf',
      'fattura_elettrosicura_videocitofono.pdf',
      'application/pdf',
      v_admin_id
    )
  on conflict (id) do nothing;

  -- ===========================================================================
  -- 5. MOVIMENTI DEL REGISTRO CRONOLOGICO E RIPARTI SPESE (RC-B1..B5, RC-C1..C6)
  -- ===========================================================================

  -- MOVIMENTO #101: Fattura fornitore ordinaria con IVA 22% e ritenuta d'acconto 4%
  -- (solo dato analitico, no F24 - RC-B5), ripartita su PALAZZO_SCALA (Palazzo A = 800‰)
  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id, sottoconto_id, fornitore_id,
    numero_progressivo, data, data_registrazione, importo, importo_centesimi, segno,
    descrizione, doc_allegato_id, impronta_file_giustificativo,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    tabella_millesimale_id, versione_tabella, palazzo_id,
    stato_spesa, eccezione_conto_corrente, motivo_eccezione_cc,
    imponibile_centesimi, iva_centesimi, ritenuta_acconto_centesimi, ritenuta_aliquota_perc,
    numero_fattura, data_scadenza_fattura, versione_motore_calcolo, autore_id
  )
  values (
    c_mov_fatt_pulizie,
    c_condominio,
    v_esercizio_id,
    c_gest_ordinaria,
    c_sc_pulizia,
    c_forn_pulizie,
    101,
    make_date(v_anno_corrente, 3, 5),
    make_date(v_anno_corrente, 3, 10),
    976.00,
    97600, -- Imponibile € 800,00 + IVA 22% € 176,00 = Totale € 976,00 (Ritenuta 4% = € 32,00)
    '-',
    '[Fatt. n. FT-2026/101] Pulizia e igienizzazione scale Palazzo A - 1° trimestre',
    c_doc_fatt_pulizie,
    'sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    'ORDINARIA',
    make_date(v_anno_corrente, 1, 1),
    make_date(v_anno_corrente, 3, 31),
    'PALAZZO_SCALA',
    c_tab_prop_v2,
    2,
    c_palazzo_a,
    'REGISTRATA',
    false,
    null,
    80000,
    17600,
    3200,
    4.00,
    'FT-2026/101',
    make_date(v_anno_corrente, 4, 5),
    '1.0.0',
    v_admin_id
  )
  on conflict (id) do update set
    importo                = excluded.importo,
    importo_centesimi      = excluded.importo_centesimi,
    imponibile_centesimi   = excluded.imponibile_centesimi,
    iva_centesimi          = excluded.iva_centesimi,
    ritenuta_acconto_centesimi = excluded.ritenuta_acconto_centesimi,
    stato_spesa            = excluded.stato_spesa;

  -- Riparto #101 su Palazzo A (somma millesimi partecipanti = 280 + 220 + 300 = 800):
  -- u1_a: 97600 * 280 / 800 = 34160 cent (€ 341,60)
  -- u2_a: 97600 * 220 / 800 = 26840 cent (€ 268,40)
  -- u3_a: 97600 * 300 / 800 = 36600 cent (€ 366,00)
  insert into public.riparti_spese (
    id, condominio_id, movimento_id, unita_id, tabella_millesimale_id, versione_tabella,
    valore_unitario, somma_valori_partecipanti, quota_calcolata_centesimi,
    resto_arrotondamento_centesimi, importo_quota_centesimi,
    quota_proprietario_centesimi, quota_conduttore_centesimi, autore_id
  )
  values
    (c_rip_1, c_condominio, c_mov_fatt_pulizie, c_u1_a, c_tab_prop_v2, 2, 280.000, 800.000, 34160, 0, 34160, 34160, 0, v_admin_id),
    (c_rip_2, c_condominio, c_mov_fatt_pulizie, c_u2_a, c_tab_prop_v2, 2, 220.000, 800.000, 26840, 0, 26840, 26840, 0, v_admin_id),
    (c_rip_3, c_condominio, c_mov_fatt_pulizie, c_u3_a, c_tab_prop_v2, 2, 300.000, 800.000, 36600, 0, 36600, 36600, 0, v_admin_id)
  on conflict (id) do update set
    importo_quota_centesimi = excluded.importo_quota_centesimi;

  -- MOVIMENTO #102: Registrazione con ritardo > 30 giorni rispetto alla data movimento (RC-B2)
  -- Data movimento: 10 gennaio, Data registrazione: 25 febbraio (46 giorni > 30 gg)
  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id, sottoconto_id, fornitore_id,
    numero_progressivo, data, data_registrazione, importo, importo_centesimi, segno,
    descrizione, doc_allegato_id, impronta_file_giustificativo,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    tabella_millesimale_id, versione_tabella,
    stato_spesa, eccezione_conto_corrente,
    imponibile_centesimi, iva_centesimi, ritenuta_acconto_centesimi, ritenuta_aliquota_perc,
    numero_fattura, data_scadenza_fattura, versione_motore_calcolo, autore_id
  )
  values (
    c_mov_ritardo_30gg,
    c_condominio,
    v_esercizio_id,
    c_gest_ordinaria,
    c_sc_ascensore,
    c_forn_ascensori,
    102,
    make_date(v_anno_corrente, 1, 10),
    make_date(v_anno_corrente, 2, 25), -- 46 giorni dopo la data del movimento (RC-B2)
    610.00,
    61000, -- Imponibile € 500,00 + IVA 22% € 110,00 = € 610,00 (Ritenuta 4% = € 20,00)
    '-',
    '[Fatt. n. EL-2026/018] Canone manutenzione ordinaria ascensore 1° semestre',
    c_doc_fatt_ascensore,
    'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'ORDINARIA',
    make_date(v_anno_corrente, 1, 1),
    make_date(v_anno_corrente, 6, 30),
    'TABELLA_SPECIFICA',
    c_tab_asc_v1,
    1,
    'REGISTRATA',
    false,
    50000,
    11000,
    2000,
    4.00,
    'EL-2026/018',
    make_date(v_anno_corrente, 2, 10),
    '1.0.0',
    v_admin_id
  )
  on conflict (id) do update set
    data               = excluded.data,
    data_registrazione = excluded.data_registrazione,
    importo_centesimi  = excluded.importo_centesimi;

  -- Riparto #102 su Tabella B Ascensore (300, 250, 450 su 1000‰):
  -- u1_a: 61000 * 300 / 1000 = 18300 cent (€ 183,00)
  -- u2_a: 61000 * 250 / 1000 = 15250 cent (€ 152,50)
  -- u3_a: 61000 * 450 / 1000 = 27450 cent (€ 274,50)
  insert into public.riparti_spese (
    id, condominio_id, movimento_id, unita_id, tabella_millesimale_id, versione_tabella,
    valore_unitario, somma_valori_partecipanti, quota_calcolata_centesimi,
    resto_arrotondamento_centesimi, importo_quota_centesimi,
    quota_proprietario_centesimi, quota_conduttore_centesimi, autore_id
  )
  values
    (c_rip_4, c_condominio, c_mov_ritardo_30gg, c_u1_a, c_tab_asc_v1, 1, 300.000, 1000.000, 18300, 0, 18300, 18300, 0, v_admin_id),
    (c_rip_5, c_condominio, c_mov_ritardo_30gg, c_u2_a, c_tab_asc_v1, 1, 250.000, 1000.000, 15250, 0, 15250, 15250, 0, v_admin_id),
    (c_rip_6, c_condominio, c_mov_ritardo_30gg, c_u3_a, c_tab_asc_v1, 1, 450.000, 1000.000, 27450, 0, 27450, 27450, 0, v_admin_id)
  on conflict (id) do update set
    importo_quota_centesimi = excluded.importo_quota_centesimi;

  -- MOVIMENTO #103: Eccezione fuori conto corrente con motivazione obbligatoria (RC-B1)
  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id, sottoconto_id, fornitore_id,
    numero_progressivo, data, data_registrazione, importo, importo_centesimi, segno,
    descrizione, doc_allegato_id, impronta_file_giustificativo,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    tabella_millesimale_id, versione_tabella,
    stato_spesa, eccezione_conto_corrente, motivo_eccezione_cc,
    versione_motore_calcolo, autore_id
  )
  values (
    c_mov_fuori_conto,
    c_condominio,
    v_esercizio_id,
    c_gest_ordinaria,
    c_sc_manut_ord,
    null,
    103,
    make_date(v_anno_corrente, 3, 18),
    make_date(v_anno_corrente, 3, 19),
    150.00,
    15000,
    '-',
    'Riparazione urgente notturna serratura portone pedonale',
    c_doc_ric_fabbro,
    'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    'ORDINARIA',
    make_date(v_anno_corrente, 3, 18),
    make_date(v_anno_corrente, 3, 18),
    'TUTTI',
    c_tab_prop_v2,
    2,
    'REGISTRATA',
    true,
    'Anticipo contanti urgente in orario notturno al fabbro reperibile; riversato giustificativo quietanzato (art. 1129 c. 7 c.c.)',
    '1.0.0',
    v_admin_id
  )
  on conflict (id) do update set
    eccezione_conto_corrente = true,
    motivo_eccezione_cc      = excluded.motivo_eccezione_cc;

  -- Riparto #103 su TUTTI (280, 220, 300, 200 su 1000‰ di € 150,00 = 15000 cent):
  -- u1_a: 4200, u2_a: 3300, u3_a: 4500, u1_b: 3000
  insert into public.riparti_spese (
    id, condominio_id, movimento_id, unita_id, tabella_millesimale_id, versione_tabella,
    valore_unitario, somma_valori_partecipanti, quota_calcolata_centesimi,
    resto_arrotondamento_centesimi, importo_quota_centesimi,
    quota_proprietario_centesimi, quota_conduttore_centesimi, autore_id
  )
  values
    (c_rip_7,  c_condominio, c_mov_fuori_conto, c_u1_a, c_tab_prop_v2, 2, 280.000, 1000.000, 4200, 0, 4200, 4200, 0, v_admin_id),
    (c_rip_8,  c_condominio, c_mov_fuori_conto, c_u2_a, c_tab_prop_v2, 2, 220.000, 1000.000, 3300, 0, 3300, 3300, 0, v_admin_id),
    (c_rip_9,  c_condominio, c_mov_fuori_conto, c_u3_a, c_tab_prop_v2, 2, 300.000, 1000.000, 4500, 0, 4500, 4500, 0, v_admin_id),
    (c_rip_10, c_condominio, c_mov_fuori_conto, c_u1_b, c_tab_prop_v2, 2, 200.000, 1000.000, 3000, 0, 3000, 3000, 0, v_admin_id)
  on conflict (id) do update set
    importo_quota_centesimi = excluded.importo_quota_centesimi;

  -- MOVIMENTO #104: Spesa straordinaria con criterio PERSONALIZZATO, atto e data obbligatori (RC-C3, RC-C6)
  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id, sottoconto_id, fornitore_id,
    numero_progressivo, data, data_registrazione, importo, importo_centesimi, segno,
    descrizione, doc_allegato_id, impronta_file_giustificativo,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    atto_deroga_tipo, atto_deroga_data, atto_deroga_numero, motivazione_deroga, delibera_riferimento,
    stato_spesa, eccezione_conto_corrente,
    imponibile_centesimi, iva_centesimi, ritenuta_acconto_centesimi, ritenuta_aliquota_perc,
    numero_fattura, data_scadenza_fattura, versione_motore_calcolo, autore_id
  )
  values (
    c_mov_personalizzato,
    c_condominio,
    v_esercizio_id,
    c_gest_straordinaria,
    c_sc_manut_straord,
    c_forn_impianti,
    104,
    make_date(v_anno_corrente, 3, 22),
    make_date(v_anno_corrente, 3, 24),
    1220.00,
    122000, -- Imponibile € 1.000,00 + IVA 22% € 220,00 = € 1.220,00
    '-',
    '[Fatt. n. ES-2026/009] Installazione monitor videocitofono Wi-Fi su Interno 1 e Interno 2',
    c_doc_fatt_citofono,
    'sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    'STRAORDINARIA',
    make_date(v_anno_corrente, 3, 1),
    make_date(v_anno_corrente, 3, 31),
    'PERSONALIZZATO',
    'DELIBERA_UNANIME',
    make_date(v_anno_corrente, 2, 18),
    'DEL-2026-04',
    'Ripartizione in parti uguali tra le sole unità Interno 1 e Interno 2 che hanno richiesto il monitor aggiuntivo (art. 1123 c. 1 c.c.)',
    'Delibera Unanime n. 4/' || v_anno_corrente,
    'REGISTRATA',
    false,
    100000,
    22000,
    4000,
    4.00,
    'ES-2026/009',
    make_date(v_anno_corrente, 4, 22),
    '1.0.0',
    v_admin_id
  )
  on conflict (id) do update set
    chi_paga           = 'PERSONALIZZATO',
    atto_deroga_tipo   = excluded.atto_deroga_tipo,
    atto_deroga_data   = excluded.atto_deroga_data,
    motivazione_deroga = excluded.motivazione_deroga;

  insert into public.riparti_spese (
    id, condominio_id, movimento_id, unita_id, tabella_millesimale_id, versione_tabella,
    valore_unitario, somma_valori_partecipanti, quota_calcolata_centesimi,
    resto_arrotondamento_centesimi, importo_quota_centesimi,
    quota_proprietario_centesimi, quota_conduttore_centesimi, autore_id
  )
  values
    (c_rip_11, c_condominio, c_mov_personalizzato, c_u1_a, null, 1, 61000, 122000, 61000, 0, 61000, 61000, 0, v_admin_id),
    (c_rip_12, c_condominio, c_mov_personalizzato, c_u2_a, null, 1, 61000, 122000, 61000, 0, 61000, 61000, 0, v_admin_id)
  on conflict (id) do update set
    importo_quota_centesimi = excluded.importo_quota_centesimi;

  -- MOVIMENTO #105: Spesa priva di giustificativo allegato e impronta -> BOZZA incompleta (RC-B3)
  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id, sottoconto_id, fornitore_id,
    numero_progressivo, data, data_registrazione, importo, importo_centesimi, segno,
    descrizione, doc_allegato_id, impronta_file_giustificativo,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    tabella_millesimale_id, versione_tabella,
    stato_spesa, eccezione_conto_corrente, versione_motore_calcolo, autore_id
  )
  values (
    c_mov_bozza_incompl,
    c_condominio,
    v_esercizio_id,
    c_gest_ordinaria,
    c_sc_manut_ord,
    c_forn_impianti,
    105,
    make_date(v_anno_corrente, 3, 28),
    make_date(v_anno_corrente, 3, 28),
    244.00,
    24400,
    '-',
    'Sostituzione lampade LED androne (in attesa di fattura PDF dal fornitore)',
    null,
    null,
    'ORDINARIA',
    make_date(v_anno_corrente, 3, 1),
    make_date(v_anno_corrente, 3, 31),
    'TUTTI',
    c_tab_prop_v2,
    2,
    'BOZZA',
    false,
    '1.0.0',
    v_admin_id
  )
  on conflict (id) do update set
    stato_spesa                  = 'BOZZA',
    doc_allegato_id              = null,
    impronta_file_giustificativo = null;

  -- MOVIMENTI #106 e #107: Movimento errato e scrittura contraria di storno collegata (RC-B4)
  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id, sottoconto_id, fornitore_id,
    numero_progressivo, data, data_registrazione, importo, importo_centesimi, segno,
    descrizione, doc_allegato_id, impronta_file_giustificativo,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    tabella_millesimale_id, versione_tabella,
    stato_spesa, storno_di_id, eccezione_conto_corrente, versione_motore_calcolo, autore_id
  )
  values (
    c_mov_errato_orig,
    c_condominio,
    v_esercizio_id,
    c_gest_ordinaria,
    c_sc_pulizia,
    c_forn_pulizie,
    106,
    make_date(v_anno_corrente, 3, 29),
    make_date(v_anno_corrente, 3, 29),
    450.00,
    45000,
    '-',
    'Addebito duplicato pulizia straordinaria cortile (errata imputazione)',
    c_doc_fatt_pulizie,
    'sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    'ORDINARIA',
    make_date(v_anno_corrente, 3, 1),
    make_date(v_anno_corrente, 3, 31),
    'TUTTI',
    c_tab_prop_v2,
    2,
    'STORNATA',
    null,
    false,
    '1.0.0',
    v_admin_id
  )
  on conflict (id) do update set
    stato_spesa = 'STORNATA';

  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id, sottoconto_id, fornitore_id,
    numero_progressivo, data, data_registrazione, importo, importo_centesimi, segno,
    descrizione, doc_allegato_id, impronta_file_giustificativo,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    tabella_millesimale_id, versione_tabella,
    stato_spesa, storno_di_id, eccezione_conto_corrente, versione_motore_calcolo, autore_id
  )
  values (
    c_mov_storno_contr,
    c_condominio,
    v_esercizio_id,
    c_gest_ordinaria,
    c_sc_pulizia,
    c_forn_pulizie,
    107,
    make_date(v_anno_corrente, 3, 30),
    make_date(v_anno_corrente, 3, 30),
    450.00,
    45000,
    '+',
    '[STORNO] Addebito duplicato pulizia straordinaria cortile (errata imputazione) — Motivo: Registrazione duplicata, annullata con scrittura contraria ex RC-B4',
    c_doc_fatt_pulizie,
    'sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    'ORDINARIA',
    make_date(v_anno_corrente, 3, 1),
    make_date(v_anno_corrente, 3, 31),
    'TUTTI',
    c_tab_prop_v2,
    2,
    'STORNATA',
    c_mov_errato_orig,
    false,
    '1.0.0',
    v_admin_id
  )
  on conflict (id) do update set
    stato_spesa  = 'STORNATA',
    storno_di_id = c_mov_errato_orig,
    segno        = '+';

  raise notice 'Seed admin_contabilita_registro_extra completato con successo per il condominio %.', c_condominio;
end
$seed_admin_contabilita_registro$;
