-- =============================================================================
-- PULIZIA DATI DI TEST: RENDICONTO ANNUALE E CONGUAGLIO (RC-K1..K8, RC-L1..L6, T5, T15)
-- =============================================================================
-- Rimuove in ordine inverso di dipendenza (FK) tutti i record creati da:
--   supabase/seed-dev/admin_contabilita_rendiconto_extra.sql
-- Totalmente idempotente e sicuro: tocca solo gli ID con prefisso 21xx.
-- =============================================================================

do $cleanup_admin_contabilita_rendiconto$
begin
  -- 1. Audit logs (prefisso 219x)
  delete from public.audit_logs
  where id in (
    'd0000000-0000-4000-8000-000000002191'
  );

  -- 2. Conguagli per unità (prefisso 212x)
  delete from public.conguagli_unita
  where id in (
    'd0000000-0000-4000-8000-000000002121',
    'd0000000-0000-4000-8000-000000002122'
  );

  -- 3. Movimenti contabili (prefisso 211x)
  delete from public.movimenti_contabili
  where id in (
    'd0000000-0000-4000-8000-000000002111',
    'd0000000-0000-4000-8000-000000002112',
    'd0000000-0000-4000-8000-000000002113'
  );

  -- 4. Gestione ed esercizio 2022 (prefisso 210x)
  delete from public.gestioni_esercizio
  where id = 'd0000000-0000-4000-8000-000000002102';

  delete from public.esercizi_contabili
  where id = 'd0000000-0000-4000-8000-000000002101';

  raise notice 'Pulizia admin_contabilita_rendiconto_extra_pulizia completata con successo.';
end
$cleanup_admin_contabilita_rendiconto$;
