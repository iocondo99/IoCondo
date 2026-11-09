-- =============================================================================
-- DATI DI TEST PER RENDICONTO ANNUALE TRIPARTITO E CONGUAGLIO (RC-K1..K8, RC-L1..L6, T5, T15)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase (dopo 10_contabilita_schema_modello_obiettivo.sql
-- e dopo i seed base che creano "Condominio di Prova" e le unità Palazzo A Int. 1 e Int. 2,
-- es. admin_contabilita_fondi_extra.sql). Non eseguire in produzione.
--
-- Che cosa predispone su "Condominio di Prova" (d0000000-0000-4000-8000-000000000001),
-- esercizio 2022 chiuso (prefisso 21xx):
--   1. Esercizio 2022 con stato_modello = 'CHIUSO' e rendiconto 'IN_PREPARAZIONE':
--      - registro di contabilità completo (3 movimenti con giustificativo, RC-K2);
--      - riepilogo finanziario NON redatto e nota sintetica MANCANTE
--        -> caso T15: il rendiconto non può passare a "completo" ed è impugnabile (RC-K1);
--      - scadenza approvazione a 180 giorni dalla chiusura (29/06/2023, RC-K8): il promemoria
--        risulta "scaduto" e mostra l'alert in dashboard.
--   2. Movimenti con data di cassa e di competenza diverse (RC-K5):
--      - polizza assicurativa pagata il 01/07/2022 con competenza 01/07/2022 - 30/06/2023
--        -> risconto attivo da rilevare;
--      - versamento rate e manutenzione ordinaria interamente di competenza dell'esercizio.
--   3. Conguagli per unità (RC-L1, RC-L2, T5):
--      - Palazzo A Int. 1: consuntivo 1.340,00 €, rate versate 1.200,00 € -> debito 140,00 € (T5);
--      - Palazzo A Int. 2: consuntivo 500,00 €, rate versate 600,00 € -> credito 100,00 €,
--        da compensare sulla prima rata dell'esercizio successivo o rimborsare (RC-L5).
--   4. Evento di audit della chiusura esercizio (RC-M1).
--
-- Tutti gli ID usano il prefisso d0000000-0000-4000-8000-0000000021xx.
-- Idempotente (on conflict). Per rimuovere i dati usa admin_contabilita_rendiconto_extra_pulizia.sql.
-- =============================================================================

do $seed_admin_contabilita_rendiconto$
declare
  v_admin_id            uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';

  -- Riferimenti base Condominio di Prova
  c_condominio          constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_u1_a                constant uuid := 'd0000000-0000-4000-8000-000000000011'; -- Palazzo A, Int 1
  c_u2_a                constant uuid := 'd0000000-0000-4000-8000-000000000012'; -- Palazzo A, Int 2

  -- Esercizio 2022 e gestione ordinaria (prefisso 210x)
  c_esercizio_2022      constant uuid := 'd0000000-0000-4000-8000-000000002101';
  c_gest_ord_2022       constant uuid := 'd0000000-0000-4000-8000-000000002102';

  -- Movimenti contabili (prefisso 211x)
  c_mov_versamento      constant uuid := 'd0000000-0000-4000-8000-000000002111'; -- entrata 3.000,00 €
  c_mov_manutenzione    constant uuid := 'd0000000-0000-4000-8000-000000002112'; -- uscita 1.200,00 €
  c_mov_assicurazione   constant uuid := 'd0000000-0000-4000-8000-000000002113'; -- uscita 730,00 € (risconto)

  -- Conguagli per unità (prefisso 212x)
  c_cong_u1             constant uuid := 'd0000000-0000-4000-8000-000000002121'; -- T5: debito 140,00 €
  c_cong_u2             constant uuid := 'd0000000-0000-4000-8000-000000002122'; -- credito 100,00 €

  -- Audit (prefisso 219x)
  c_audit_chiusura      constant uuid := 'd0000000-0000-4000-8000-000000002191';
begin
  -- Risoluzione amministratore
  if not exists (select 1 from public.utenti where id = v_admin_id) then
    select admin_id into v_admin_id from public.condomini where id = c_condominio;
  end if;
  if v_admin_id is null then
    select id into v_admin_id from public.utenti limit 1;
  end if;

  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Condominio di Prova non trovato: esegui prima i seed base (es. admin_contabilita_fondi_extra.sql).';
  end if;

  -- 1. Esercizio 2022 chiuso, rendiconto in preparazione senza nota sintetica (T15)
  insert into public.esercizi_contabili (
    id, condominio_id, anno, data_inizio, data_fine, stato, stato_modello,
    data_chiusura_effettiva, scadenza_approvazione_180gg,
    saldo_iniziale_conto_centesimi, stato_rendiconto, registro_contabilita_completo,
    nota_sintetica_esplicativa, riepilogo_finanziario_json, autore_id
  )
  values (
    c_esercizio_2022, c_condominio, 2022, '2022-01-01', '2022-12-31', 'CHIUSO', 'CHIUSO',
    '2022-12-31', '2023-06-29',
    500000, 'IN_PREPARAZIONE', true,
    null, null, v_admin_id
  )
  on conflict (id) do nothing;

  insert into public.gestioni_esercizio (
    id, condominio_id, esercizio_id, tipo, nome, descrizione, stato, autore_id
  )
  values (
    c_gest_ord_2022, c_condominio, c_esercizio_2022, 'ORDINARIA',
    'Gestione Ordinaria 2022', 'Esercizio ordinario 2022 (rendiconto di prova)', 'ATTIVA', v_admin_id
  )
  on conflict (id) do nothing;

  -- 2. Movimenti con data di cassa e di competenza (RC-K2, RC-K5)
  insert into public.movimenti_contabili (
    id, condominio_id, esercizio_id, gestione_id,
    numero_progressivo, data, data_registrazione,
    importo, importo_centesimi, segno, descrizione,
    tag_spesa, competenza_da, competenza_a, chi_paga,
    stato_spesa, impronta_file_giustificativo, versione_motore_calcolo, autore_id
  )
  values
    (
      c_mov_versamento, c_condominio, c_esercizio_2022, c_gest_ord_2022,
      1, '2022-02-01', '2022-02-01',
      3000.00, 300000, '+',
      'Versamenti rate condominiali 1° semestre 2022 (rendiconto di prova)',
      'ORDINARIA', '2022-02-01', '2022-02-01', 'TUTTI',
      'REGISTRATA',
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f62111',
      '1.0.0', v_admin_id
    ),
    (
      c_mov_manutenzione, c_condominio, c_esercizio_2022, c_gest_ord_2022,
      2, '2022-03-10', '2022-03-11',
      1200.00, 120000, '-',
      'Manutenzione ordinaria impianto ascensore (cassa e competenza coincidono)',
      'ORDINARIA', '2022-03-10', '2022-03-10', 'TUTTI',
      'REGISTRATA',
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f62112',
      '1.0.0', v_admin_id
    ),
    (
      c_mov_assicurazione, c_condominio, c_esercizio_2022, c_gest_ord_2022,
      3, '2022-07-01', '2022-07-02',
      730.00, 73000, '-',
      'Premio polizza globale fabbricato 01/07/2022 - 30/06/2023 (competenza a cavallo: risconto attivo RC-K5)',
      'ORDINARIA', '2022-07-01', '2023-06-30', 'TUTTI',
      'REGISTRATA',
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f62113',
      '1.0.0', v_admin_id
    )
  on conflict (id) do nothing;

  -- 3. Conguagli per unità (RC-L1, RC-L2, T5)
  insert into public.conguagli_unita (
    id, condominio_id, esercizio_id, gestione_id, unita_id,
    periodo_da, periodo_a,
    quota_consuntivo_centesimi, rate_versate_centesimi, saldo_conguaglio_centesimi,
    modalita_regolazione, autore_id
  )
  values
    (
      c_cong_u1, c_condominio, c_esercizio_2022, c_gest_ord_2022, c_u1_a,
      '2022-01-01', '2022-12-31',
      134000, 120000, 14000,
      'DA_REGOLARE', v_admin_id
    ),
    (
      c_cong_u2, c_condominio, c_esercizio_2022, c_gest_ord_2022, c_u2_a,
      '2022-01-01', '2022-12-31',
      50000, 60000, -10000,
      'DA_REGOLARE', v_admin_id
    )
  on conflict (id) do nothing;

  -- 4. Audit della chiusura esercizio (RC-M1)
  insert into public.audit_logs (
    id, utente_id, condominio_id, azione, tabella, record_id, motivo, valore_prima, valore_dopo, timestamp
  )
  values (
    c_audit_chiusura,
    v_admin_id,
    c_condominio,
    'CHIUSURA_ESERCIZIO',
    'esercizi_contabili',
    c_esercizio_2022::text,
    'Chiusura esercizio 2022: approvazione rendiconto entro il 2023-06-29 (art. 1130 n. 10 c.c.)',
    jsonb_build_object('stato_modello', 'APERTO'),
    jsonb_build_object(
      'stato_modello', 'CHIUSO',
      'data_chiusura_effettiva', '2022-12-31',
      'scadenza_approvazione_180gg', '2023-06-29'
    ),
    '2023-01-10T09:00:00Z'::timestamptz
  )
  on conflict (id) do update set
    motivo      = excluded.motivo,
    valore_dopo = excluded.valore_dopo;

  raise notice 'Seed admin_contabilita_rendiconto_extra applicato con successo.';
end
$seed_admin_contabilita_rendiconto$;
