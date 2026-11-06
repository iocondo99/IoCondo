-- =============================================================================
-- PULIZIA DATI DI PROVA GESTIONE DOCUMENTI E DRIVE CONDOMINIALE
-- =============================================================================
-- Rimuove esclusivamente i record inseriti da admin_documenti_extra.sql.
-- Sicuro e idempotente (eseguibile più volte senza errori).
-- =============================================================================

do $pulizia_admin_documenti$
begin
  -- 1. Eliminazione documenti metadata di prova
  delete from public.documenti_metadata
  where id in (
    'd0000000-0000-4000-8000-000000000721',
    'd0000000-0000-4000-8000-000000000722',
    'd0000000-0000-4000-8000-000000000723',
    'd0000000-0000-4000-8000-000000000724'
  );

  -- 2. Eliminazione cartelle di prova
  delete from public.cartelle_documenti
  where id in (
    'd0000000-0000-4000-8000-000000000711',
    'd0000000-0000-4000-8000-000000000712',
    'd0000000-0000-4000-8000-000000000713'
  );

  raise notice 'Pulizia dati di prova admin_documenti completata.';
end;
$pulizia_admin_documenti$;
