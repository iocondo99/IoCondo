-- =============================================================================
-- PULIZIA DATI DI TEST: REGISTRO CRONOLOGICO CONTABILITA', CATALOGO VOCI E SPESE
-- =============================================================================
-- Rimuove in ordine inverso di dipendenza (FK) tutti i record creati da:
--   supabase/seed-dev/admin_contabilita_registro_extra.sql
-- Totalmente idempotente e sicuro.
-- =============================================================================

do $cleanup_admin_contabilita_registro$
begin
  -- 1. Riparti spese
  delete from public.riparti_spese
  where id in (
    'd0000000-0000-4000-8000-000000001581',
    'd0000000-0000-4000-8000-000000001582',
    'd0000000-0000-4000-8000-000000001583',
    'd0000000-0000-4000-8000-000000001584',
    'd0000000-0000-4000-8000-000000001585',
    'd0000000-0000-4000-8000-000000001586',
    'd0000000-0000-4000-8000-000000001587',
    'd0000000-0000-4000-8000-000000001588',
    'd0000000-0000-4000-8000-000000001589',
    'd0000000-0000-4000-8000-000000001590',
    'd0000000-0000-4000-8000-000000001591',
    'd0000000-0000-4000-8000-000000001592'
  );

  -- 2. Movimenti contabili (prima la scrittura di storno che referenzia l'originale via storno_di_id)
  delete from public.movimenti_contabili
  where id = 'd0000000-0000-4000-8000-000000001577';

  delete from public.movimenti_contabili
  where id in (
    'd0000000-0000-4000-8000-000000001571',
    'd0000000-0000-4000-8000-000000001572',
    'd0000000-0000-4000-8000-000000001573',
    'd0000000-0000-4000-8000-000000001574',
    'd0000000-0000-4000-8000-000000001575',
    'd0000000-0000-4000-8000-000000001576'
  );

  -- 3. Documenti giustificativi e Fornitori
  delete from public.documenti_metadata
  where id in (
    'd0000000-0000-4000-8000-000000001566',
    'd0000000-0000-4000-8000-000000001567',
    'd0000000-0000-4000-8000-000000001568',
    'd0000000-0000-4000-8000-000000001569'
  );

  delete from public.fornitori
  where id in (
    'd0000000-0000-4000-8000-000000001561',
    'd0000000-0000-4000-8000-000000001562',
    'd0000000-0000-4000-8000-000000001563'
  );

  -- 4. Gestioni esercizio e Voci catalogo
  delete from public.gestioni_esercizio
  where id in (
    'd0000000-0000-4000-8000-000000001551',
    'd0000000-0000-4000-8000-000000001552'
  );

  delete from public.voci_spesa_catalogo
  where id in (
    'd0000000-0000-4000-8000-000000001541',
    'd0000000-0000-4000-8000-000000001542',
    'd0000000-0000-4000-8000-000000001543',
    'd0000000-0000-4000-8000-000000001544'
  );

  -- 5. Sottoconti e Piano dei conti dedicati
  delete from public.sottoconti
  where id in (
    'd0000000-0000-4000-8000-000000001503',
    'd0000000-0000-4000-8000-000000001504',
    'd0000000-0000-4000-8000-000000001505',
    'd0000000-0000-4000-8000-000000001506'
  );

  delete from public.piano_dei_conti
  where id in (
    'd0000000-0000-4000-8000-000000001501',
    'd0000000-0000-4000-8000-000000001502'
  );

  -- 6. Quote millesimali e Tabelle millesimali versionate
  delete from public.quote_millesimali
  where id in (
    'd0000000-0000-4000-8000-000000001521',
    'd0000000-0000-4000-8000-000000001522',
    'd0000000-0000-4000-8000-000000001523',
    'd0000000-0000-4000-8000-000000001524',
    'd0000000-0000-4000-8000-000000001525',
    'd0000000-0000-4000-8000-000000001526',
    'd0000000-0000-4000-8000-000000001527',
    'd0000000-0000-4000-8000-000000001528',
    'd0000000-0000-4000-8000-000000001529',
    'd0000000-0000-4000-8000-000000001530',
    'd0000000-0000-4000-8000-000000001531',
    'd0000000-0000-4000-8000-000000001532',
    'd0000000-0000-4000-8000-000000001533',
    'd0000000-0000-4000-8000-000000001534',
    'd0000000-0000-4000-8000-000000001535'
  );

  -- Prima le tabelle derivate/successive, poi la v1
  delete from public.tabelle_millesimali
  where id in (
    'd0000000-0000-4000-8000-000000001513',
    'd0000000-0000-4000-8000-000000001514',
    'd0000000-0000-4000-8000-000000001512'
  );

  delete from public.tabelle_millesimali
  where id = 'd0000000-0000-4000-8000-000000001511';

  raise notice 'Pulizia admin_contabilita_registro_extra_pulizia completata con successo.';
end
$cleanup_admin_contabilita_registro$;
