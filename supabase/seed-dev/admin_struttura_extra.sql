-- =============================================================================
-- DATI EXTRA PER STRUTTURA DEL CONDOMINIO E TABELLE MILLESIMALI (/admin/struttura, Passo 2)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase. Non eseguire in produzione.
-- Condominio di prova: d0000000-0000-4000-8000-000000000001
-- Palazzi:
--   - Palazzo A: d0000000-0000-4000-8000-000000000002
--   - Palazzo B: d0000000-0000-4000-8000-000000000004
--
-- Che cosa predispone:
--   1. Scale e Colonne:
--      - Scala A e Scala B per Palazzo A
--      - Scala Unica per Palazzo B
--   2. 6 Unità Immobiliari complessive:
--      - Palazzo A: Int 1 (80 mq), Int 2 (65 mq), Int 3 (95 mq), Int 4 (110 mq)
--      - Palazzo B: Int 1 (75 mq), Int 2 (85 mq)
--   3. Anagrafiche residenti attivi (Proprietari) collegate a utenti di prova.
--   4. Tabelle millesimali e relative quote:
--      - Tabella A (Proprietà Generale, 1000 ‰) con 6 quote perfettamente quadrate:
--        200,000 + 175,000 + 225,000 + 150,000 + 120,000 + 130,000 = 1000,000 ‰
--      - Tabella B (Scale e Ascensore Palazzo A, 1000 ‰) con 4 quote per Palazzo A:
--        250,000 + 250,000 + 250,000 + 250,000 = 1000,000 ‰
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (on conflict do nothing / update).
--   - Per annullare: eseguire supabase/seed-dev/admin_struttura_extra_pulizia.sql.
-- =============================================================================

do $seed_admin_struttura$
declare
  c_condominio          constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a           constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_palazzo_b           constant uuid := 'd0000000-0000-4000-8000-000000000004';

  c_scala_a             constant uuid := 'd0000000-0000-4000-8000-000000000901';
  c_scala_b             constant uuid := 'd0000000-0000-4000-8000-000000000902';
  c_scala_unica_b       constant uuid := 'd0000000-0000-4000-8000-000000000903';

  c_tipologia_app       constant uuid := '22000000-0000-4000-8000-000000000001'; -- Appartamento
  c_tipologia_box       constant uuid := '22000000-0000-4000-8000-000000000002'; -- Box auto

  -- Unità
  c_u1_a                constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- Palazzo A, Int 1
  c_u2_a                constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- Palazzo A, Int 2
  c_u3_a                constant uuid := 'd0000000-0000-4000-8000-000000000913'; -- Palazzo A, Int 3
  c_u4_a                constant uuid := 'd0000000-0000-4000-8000-000000000914'; -- Palazzo A, Int 4
  c_u1_b                constant uuid := 'd0000000-0000-4000-8000-000000000921'; -- Palazzo B, Int 1
  c_u2_b                constant uuid := 'd0000000-0000-4000-8000-000000000922'; -- Palazzo B, Int 2

  -- Utenti residenti
  c_user_4              constant uuid := '10000000-0000-4000-8000-000000000004'; -- Luca Romano
  c_user_5              constant uuid := '10000000-0000-4000-8000-000000000005'; -- Francesca Esposito
  c_user_6              constant uuid := '10000000-0000-4000-8000-000000000006'; -- Paolo Conti
  c_user_7              constant uuid := '10000000-0000-4000-8000-000000000007'; -- Elena Marino
  c_user_8              constant uuid := '10000000-0000-4000-8000-000000000008'; -- Andrea De Luca
  c_user_9              constant uuid := '10000000-0000-4000-8000-000000000009'; -- Sara Greco

  -- Anagrafiche
  c_anag_u3_a           constant uuid := 'd0000000-0000-4000-8000-000000000933';
  c_anag_u4_a           constant uuid := 'd0000000-0000-4000-8000-000000000934';
  c_anag_u1_b           constant uuid := 'd0000000-0000-4000-8000-000000000935';
  c_anag_u2_b           constant uuid := 'd0000000-0000-4000-8000-000000000936';

  -- Tabelle millesimali
  c_tab_a               constant uuid := 'd0000000-0000-4000-8000-000000000951'; -- Proprietà Generale
  c_tab_b               constant uuid := 'd0000000-0000-4000-8000-000000000952'; -- Scale e Ascensore Palazzo A
begin
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise notice 'Condominio di prova % non trovato. Esegui prima 01_dati_prova.sql.', c_condominio;
    return;
  end if;

  -- 1. Scale e Colonne
  insert into public.scale_colonne (id, palazzo_id, tipo, nome)
  values
    (c_scala_a, c_palazzo_a, 'SCALA', 'Scala A'),
    (c_scala_b, c_palazzo_a, 'SCALA', 'Scala B'),
    (c_scala_unica_b, c_palazzo_b, 'SCALA', 'Scala Unica')
  on conflict (id) do nothing;

  -- Aggiorna le scale per le unità 1 e 2 già presenti
  update public.unita_immobiliari set scala_colonna_id = c_scala_a where id in (c_u1_a, c_u2_a);

  -- 2. Inserimento unità aggiuntive per completare 6 unità totali
  insert into public.unita_immobiliari (id, palazzo_id, scala_colonna_id, tipologia_id, interno, piano, mq)
  values
    (c_u3_a, c_palazzo_a, c_scala_b, c_tipologia_app, '3', 2, 95.00),
    (c_u4_a, c_palazzo_a, c_scala_b, c_tipologia_app, '4', 2, 110.00),
    (c_u1_b, c_palazzo_b, c_scala_unica_b, c_tipologia_app, '1', 1, 75.00),
    (c_u2_b, c_palazzo_b, c_scala_unica_b, c_tipologia_app, '2', 1, 85.00)
  on conflict (id) do nothing;

  -- 3. Anagrafiche residenti attivi per le nuove unità
  insert into public.anagrafiche_unita (id, unita_id, utente_id, tipo_possesso, data_inizio, quota_possesso)
  values
    (c_anag_u3_a, c_u3_a, c_user_6, 'PROPRIETARIO', '2024-01-01', 100),
    (c_anag_u4_a, c_u4_a, c_user_7, 'PROPRIETARIO', '2024-01-01', 100),
    (c_anag_u1_b, c_u1_b, c_user_8, 'PROPRIETARIO', '2024-01-01', 100),
    (c_anag_u2_b, c_u2_b, c_user_9, 'PROPRIETARIO', '2024-01-01', 100)
  on conflict (id) do nothing;

  -- 4. Tabelle Millesimali
  insert into public.tabelle_millesimali (id, condominio_id, nome, totale)
  values
    (c_tab_a, c_condominio, 'Tabella A - Proprietà Generale', 1000.000),
    (c_tab_b, c_condominio, 'Tabella B - Scale e Ascensore Palazzo A', 1000.000)
  on conflict (id) do nothing;

  -- 5. Quote Millesimali Tabella A (tutte le 6 unità = 1000,000 ‰)
  insert into public.quote_millesimali (id, tabella_id, unita_id, valore_millesimale)
  values
    ('d0000000-0000-4000-8000-000000000961', c_tab_a, c_u1_a, 200.000),
    ('d0000000-0000-4000-8000-000000000962', c_tab_a, c_u2_a, 175.000),
    ('d0000000-0000-4000-8000-000000000963', c_tab_a, c_u3_a, 225.000),
    ('d0000000-0000-4000-8000-000000000964', c_tab_a, c_u4_a, 150.000),
    ('d0000000-0000-4000-8000-000000000965', c_tab_a, c_u1_b, 120.000),
    ('d0000000-0000-4000-8000-000000000966', c_tab_a, c_u2_b, 130.000)
  on conflict (id) do nothing;

  -- 6. Quote Millesimali Tabella B (4 unità di Palazzo A = 1000,000 ‰)
  insert into public.quote_millesimali (id, tabella_id, unita_id, valore_millesimale)
  values
    ('d0000000-0000-4000-8000-000000000971', c_tab_b, c_u1_a, 250.000),
    ('d0000000-0000-4000-8000-000000000972', c_tab_b, c_u2_a, 250.000),
    ('d0000000-0000-4000-8000-000000000973', c_tab_b, c_u3_a, 250.000),
    ('d0000000-0000-4000-8000-000000000974', c_tab_b, c_u4_a, 250.000)
  on conflict (id) do nothing;

  raise notice 'Dati extra Struttura e Millesimi pronti: 2 palazzi, 6 unita, 2 tabelle millesimali quadrate a 1000 ‰.';
end $seed_admin_struttura$;

