-- =============================================================================
-- PULIZIA DATI DI TEST: PREVENTIVI, PIANO RATE E BOLLETTINI (SEZIONE 6)
-- =============================================================================
-- Rimuove in ordine inverso di dipendenza (FK) tutti i record creati da:
--   supabase/seed-dev/admin_contabilita_bollettini_extra.sql
-- Totalmente idempotente e sicuro.
-- =============================================================================

do $cleanup_admin_contabilita_bollettini$
begin
  -- 1. Audit logs dedicati alla Sezione 6
  delete from public.audit_logs
  where id in (
    'd0000000-0000-4000-8000-000000001671',
    'd0000000-0000-4000-8000-000000001672',
    'd0000000-0000-4000-8000-000000001673'
  );

  -- 2. Scollega i riferimenti bollettino_id dalle rate_dettaglio prima di eliminare i bollettini
  update public.rate_dettaglio
  set bollettino_id = null
  where id in (
    'd0000000-0000-4000-8000-000000001641',
    'd0000000-0000-4000-8000-000000001642',
    'd0000000-0000-4000-8000-000000001643',
    'd0000000-0000-4000-8000-000000001644',
    'd0000000-0000-4000-8000-000000001645'
  );

  -- 3. Righe bollettino
  delete from public.bollettini_righe
  where id in (
    'd0000000-0000-4000-8000-000000001661',
    'd0000000-0000-4000-8000-000000001662',
    'd0000000-0000-4000-8000-000000001663',
    'd0000000-0000-4000-8000-000000001664',
    'd0000000-0000-4000-8000-000000001665',
    'd0000000-0000-4000-8000-000000001666'
  );

  -- 4. Bollettini (azzera prima i riferimenti incrociati sostituisce_id / sostituito_da_id tra n. 12 e n. 13)
  update public.bollettini
  set sostituisce_id = null,
      sostituito_da_id = null
  where id in (
    'd0000000-0000-4000-8000-000000001653',
    'd0000000-0000-4000-8000-000000001654'
  );

  delete from public.bollettini
  where id in (
    'd0000000-0000-4000-8000-000000001651',
    'd0000000-0000-4000-8000-000000001652',
    'd0000000-0000-4000-8000-000000001653',
    'd0000000-0000-4000-8000-000000001654',
    'd0000000-0000-4000-8000-000000001655'
  );

  -- 5. Rate dettaglio e Rate testata
  delete from public.rate_dettaglio
  where id in (
    'd0000000-0000-4000-8000-000000001641',
    'd0000000-0000-4000-8000-000000001642',
    'd0000000-0000-4000-8000-000000001643',
    'd0000000-0000-4000-8000-000000001644',
    'd0000000-0000-4000-8000-000000001645'
  );

  delete from public.rate_testata
  where id in (
    'd0000000-0000-4000-8000-000000001631',
    'd0000000-0000-4000-8000-000000001632'
  );

  -- 6. Voci preventivo e Preventivi (prima v2 che referenzia v1 tramite precedente_id, poi v1 e bozza straordinaria)
  delete from public.preventivi_voci
  where id in (
    'd0000000-0000-4000-8000-000000001621',
    'd0000000-0000-4000-8000-000000001622',
    'd0000000-0000-4000-8000-000000001623',
    'd0000000-0000-4000-8000-000000001624'
  );

  delete from public.preventivi
  where id in (
    'd0000000-0000-4000-8000-000000001612',
    'd0000000-0000-4000-8000-000000001613'
  );

  delete from public.preventivi
  where id = 'd0000000-0000-4000-8000-000000001611';

  -- 7. Soggetti contabili creati per la Sezione 6
  delete from public.soggetti_contabili
  where id in (
    'd0000000-0000-4000-8000-000000001601',
    'd0000000-0000-4000-8000-000000001602'
  );

  raise notice 'Pulizia admin_contabilita_bollettini_extra_pulizia completata con successo.';
end
$cleanup_admin_contabilita_bollettini$;
