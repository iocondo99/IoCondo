-- =============================================================================
-- PULIZIA DATI EXTRA STRUTTURA DEL CONDOMINIO (/admin/struttura)
-- =============================================================================
-- Ripristina lo stato del database eliminando solo i dati di prova inseriti
-- da admin_struttura_extra.sql. Rieseguibile senza errori.
-- =============================================================================

do $pulizia_admin_struttura$
declare
  c_palazzo_b           constant uuid := 'd0000000-0000-4000-8000-000000000004';

  c_scala_a             constant uuid := 'd0000000-0000-4000-8000-000000000901';
  c_scala_b             constant uuid := 'd0000000-0000-4000-8000-000000000902';
  c_scala_unica_b       constant uuid := 'd0000000-0000-4000-8000-000000000903';

  c_u1_a                constant uuid := 'd0000000-0000-4000-8000-000000000011';
  c_u2_a                constant uuid := 'd0000000-0000-4000-8000-000000000012';
  c_u3_a                constant uuid := 'd0000000-0000-4000-8000-000000000913';
  c_u4_a                constant uuid := 'd0000000-0000-4000-8000-000000000914';
  c_u1_b                constant uuid := 'd0000000-0000-4000-8000-000000000921';
  c_u2_b                constant uuid := 'd0000000-0000-4000-8000-000000000922';

  c_anag_u3_a           constant uuid := 'd0000000-0000-4000-8000-000000000933';
  c_anag_u4_a           constant uuid := 'd0000000-0000-4000-8000-000000000934';
  c_anag_u1_b           constant uuid := 'd0000000-0000-4000-8000-000000000935';
  c_anag_u2_b           constant uuid := 'd0000000-0000-4000-8000-000000000936';

  c_tab_a               constant uuid := 'd0000000-0000-4000-8000-000000000951';
  c_tab_b               constant uuid := 'd0000000-0000-4000-8000-000000000952';

  c_uer_admin_luca      constant uuid := 'd0000000-0000-4000-8000-000000000999';
begin
  -- Rimuovi quote millesimali inserite
  delete from public.quote_millesimali where tabella_id in (c_tab_a, c_tab_b);

  -- Rimuovi tabelle millesimali extra
  delete from public.tabelle_millesimali where id in (c_tab_a, c_tab_b);

  -- Rimuovi anagrafiche extra
  delete from public.anagrafiche_unita where id in (c_anag_u3_a, c_anag_u4_a, c_anag_u1_b, c_anag_u2_b);

  -- Rimuovi unita extra
  delete from public.unita_immobiliari where id in (c_u3_a, c_u4_a, c_u1_b, c_u2_b);

  -- Reset scala per le unità 1 e 2 di base
  update public.unita_immobiliari set scala_colonna_id = null where id in (c_u1_a, c_u2_a);

  -- Rimuovi scale extra
  delete from public.scale_colonne where id in (c_scala_a, c_scala_b, c_scala_unica_b);

  -- Rimuovi palazzo B extra
  delete from public.palazzi where id = c_palazzo_b;

  -- Rimuovi ruolo admin extra di prova
  delete from public.utente_entita_ruolo where id in (
    c_uer_admin_luca,
    'd0000000-0000-4000-8000-000000000998'::uuid,
    'd0000000-0000-4000-8000-000000000997'::uuid
  );

  raise notice 'Dati extra Struttura e Millesimi rimossi con successo.';
end $pulizia_admin_struttura$;
