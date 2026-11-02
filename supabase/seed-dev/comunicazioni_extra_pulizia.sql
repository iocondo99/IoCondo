-- =============================================================================
-- PULIZIA DELLE COMUNICAZIONI EXTRA DI PROVA  (annulla comunicazioni_extra.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Rimuove solo le notifiche e i post con id fisso d0000000-0000-4000-8000-0000000002..
-- creati da comunicazioni_extra.sql. Non tocca i dati di 01_dati_prova.sql o 03_dati_home.sql.
-- =============================================================================

do $pulizia$
begin
  delete from public.notifiche
  where id in (
    'd0000000-0000-4000-8000-000000000251',
    'd0000000-0000-4000-8000-000000000252',
    'd0000000-0000-4000-8000-000000000253',
    'd0000000-0000-4000-8000-000000000254',
    'd0000000-0000-4000-8000-000000000255',
    'd0000000-0000-4000-8000-000000000256',
    'd0000000-0000-4000-8000-000000000257',
    'd0000000-0000-4000-8000-000000000258',
    'd0000000-0000-4000-8000-000000000259'
  );

  delete from public.bacheca_post
  where id in (
    'd0000000-0000-4000-8000-000000000201',
    'd0000000-0000-4000-8000-000000000202',
    'd0000000-0000-4000-8000-000000000203',
    'd0000000-0000-4000-8000-000000000204',
    'd0000000-0000-4000-8000-000000000205',
    'd0000000-0000-4000-8000-000000000206',
    'd0000000-0000-4000-8000-000000000207',
    'd0000000-0000-4000-8000-000000000208',
    'd0000000-0000-4000-8000-000000000209',
    'd0000000-0000-4000-8000-000000000210',
    'd0000000-0000-4000-8000-000000000211',
    'd0000000-0000-4000-8000-000000000212',
    'd0000000-0000-4000-8000-000000000213'
  );

  -- Rimuove il Palazzo B solo se nessun post o unità lo usa più
  delete from public.palazzi p
  where p.id = 'd0000000-0000-4000-8000-000000000004'
    and not exists (select 1 from public.bacheca_post b where b.palazzo_id = p.id)
    and not exists (select 1 from public.unita_immobiliari u where u.palazzo_id = p.id);

  raise notice 'Comunicazioni extra di prova rimosse.';
end
$pulizia$;

