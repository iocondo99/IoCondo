-- =============================================================================
-- PULIZIA DEI DATI EXTRA PER LA PAGINA DOCUMENTI  (annulla documenti_extra.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Rimuove solo i documenti, le cartelle e il condominio isolato creati da
-- `documenti_extra.sql` (prefisso d0000000-0000-4000-8000-0000000005..).
-- Non tocca i dati di 01_dati_prova.sql, 03_dati_home.sql, 05_rate_extra.sql,
-- comunicazioni_extra.sql o spese_extra.sql.
-- =============================================================================

do $pulizia_documenti$
begin
  -- 1. Rimuove i metadati dei documenti creati da documenti_extra.sql
  delete from public.documenti_metadata
  where id in (
    'd0000000-0000-4000-8000-000000000511',
    'd0000000-0000-4000-8000-000000000512',
    'd0000000-0000-4000-8000-000000000513',
    'd0000000-0000-4000-8000-000000000514',
    'd0000000-0000-4000-8000-000000000515',
    'd0000000-0000-4000-8000-000000000516',
    'd0000000-0000-4000-8000-000000000517',
    'd0000000-0000-4000-8000-000000000518',
    'd0000000-0000-4000-8000-000000000519',
    'd0000000-0000-4000-8000-000000000520',
    'd0000000-0000-4000-8000-000000000521',
    'd0000000-0000-4000-8000-000000000522',
    'd0000000-0000-4000-8000-000000000531',
    'd0000000-0000-4000-8000-000000000592'
  );

  -- 2. Rimuove le cartelle create da documenti_extra.sql (se non contengono altri documenti)
  delete from public.cartelle_documenti c
  where c.id in (
    'd0000000-0000-4000-8000-000000000501',
    'd0000000-0000-4000-8000-000000000502',
    'd0000000-0000-4000-8000-000000000503',
    'd0000000-0000-4000-8000-000000000504',
    'd0000000-0000-4000-8000-000000000591'
  )
    and not exists (select 1 from public.documenti_metadata d where d.cartella_id = c.id);

  -- 3. Rimuove il condominio isolato di prova
  delete from public.condomini c
  where c.id = 'd0000000-0000-4000-8000-000000000590'
    and not exists (select 1 from public.cartelle_documenti f where f.condominio_id = c.id);

  raise notice 'Dati extra Documenti rimossi.';
end
$pulizia_documenti$;

