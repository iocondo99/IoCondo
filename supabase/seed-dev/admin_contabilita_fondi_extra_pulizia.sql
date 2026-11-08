-- =============================================================================
-- PULIZIA DATI DI TEST: INQUILINI, USUFRUTTO (RC-I1..I7, T10) E FONDI SPECIALI (RC-J1..J5, T7)
-- =============================================================================
-- Rimuove in ordine inverso di dipendenza (FK) tutti i record creati da:
--   supabase/seed-dev/admin_contabilita_fondi_extra.sql
-- Totalmente idempotente e sicuro.
-- =============================================================================

do $cleanup_admin_contabilita_fondi$
begin
  -- 1. Audit logs dedicati a Fondi e Oneri Accessori (prefisso 189x)
  delete from public.audit_logs
  where id in (
    'd0000000-0000-4000-8000-000000001891',
    'd0000000-0000-4000-8000-000000001892'
  );

  -- 2. Movimenti Fondo (prefisso 187x)
  delete from public.movimenti_fondo
  where id in (
    'd0000000-0000-4000-8000-000000001871',
    'd0000000-0000-4000-8000-000000001872',
    'd0000000-0000-4000-8000-000000001873',
    'd0000000-0000-4000-8000-000000001874',
    'd0000000-0000-4000-8000-000000001875',
    'd0000000-0000-4000-8000-000000001876'
  );

  -- 3. Riparti spese e Movimenti contabili dedicati a T10, RC-I4, RC-I5 e SAL (prefisso 183x e 182x)
  delete from public.riparti_spese
  where id in (
    'd0000000-0000-4000-8000-000000001831',
    'd0000000-0000-4000-8000-000000001832',
    'd0000000-0000-4000-8000-000000001833',
    'd0000000-0000-4000-8000-000000001834',
    'd0000000-0000-4000-8000-000000001835'
  );

  delete from public.movimenti_contabili
  where id in (
    'd0000000-0000-4000-8000-000000001821',
    'd0000000-0000-4000-8000-000000001822',
    'd0000000-0000-4000-8000-000000001823',
    'd0000000-0000-4000-8000-000000001824'
  );

  -- 4. Rate dettaglio, Rate testata, Preventivo e Gestione Straordinaria T7 (prefisso 186x e 185x)
  delete from public.rate_dettaglio
  where id = 'd0000000-0000-4000-8000-000000001862';

  delete from public.rate_testata
  where id = 'd0000000-0000-4000-8000-000000001861';

  delete from public.preventivi
  where id = 'd0000000-0000-4000-8000-000000001852';

  delete from public.gestioni_esercizio
  where id = 'd0000000-0000-4000-8000-000000001851';

  -- 5. Fondi condominiali (prefisso 184x)
  delete from public.fondi
  where id in (
    'd0000000-0000-4000-8000-000000001841',
    'd0000000-0000-4000-8000-000000001842',
    'd0000000-0000-4000-8000-000000001843'
  );

  -- 6. Letture contatori subentro inquilino (prefisso 1816..1818)
  delete from public.letture_contatori
  where id in (
    'd0000000-0000-4000-8000-000000001816',
    'd0000000-0000-4000-8000-000000001817',
    'd0000000-0000-4000-8000-000000001818'
  );

  -- 7. Anagrafiche unità e Soggetti contabili (prefisso 181x e 180x)
  delete from public.anagrafiche_unita
  where id in (
    'd0000000-0000-4000-8000-000000001811',
    'd0000000-0000-4000-8000-000000001812',
    'd0000000-0000-4000-8000-000000001813',
    'd0000000-0000-4000-8000-000000001814',
    'd0000000-0000-4000-8000-000000001815'
  );

  delete from public.soggetti_contabili
  where id in (
    'd0000000-0000-4000-8000-000000001801',
    'd0000000-0000-4000-8000-000000001802',
    'd0000000-0000-4000-8000-000000001803',
    'd0000000-0000-4000-8000-000000001804',
    'd0000000-0000-4000-8000-000000001805'
  );

  raise notice 'Pulizia admin_contabilita_fondi_extra_pulizia completata con successo.';
end
$cleanup_admin_contabilita_fondi$;
