-- =============================================================================
-- PULIZIA DEI DATI EXTRA PER LA PAGINA SPESE  (annulla spese_extra.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Rimuove solo i movimenti, i documenti di prova, i sottoconti, il piano dei conti
-- e gli esercizi creati da `spese_extra.sql` (prefisso d0000000-0000-4000-8000-0000000004..).
-- Non tocca i dati di 01_dati_prova.sql, 03_dati_home.sql, 05_rate_extra.sql o comunicazioni_extra.sql.
-- =============================================================================

do $pulizia_spese$
begin
  -- 1. Rimuove i movimenti contabili creati da spese_extra.sql
  delete from public.movimenti_contabili
  where id in (
    'd0000000-0000-4000-8000-000000000441',
    'd0000000-0000-4000-8000-000000000442',
    'd0000000-0000-4000-8000-000000000443',
    'd0000000-0000-4000-8000-000000000444',
    'd0000000-0000-4000-8000-000000000445',
    'd0000000-0000-4000-8000-000000000446',
    'd0000000-0000-4000-8000-000000000451',
    'd0000000-0000-4000-8000-000000000452',
    'd0000000-0000-4000-8000-000000000453',
    'd0000000-0000-4000-8000-000000000454',
    'd0000000-0000-4000-8000-000000000455',
    'd0000000-0000-4000-8000-000000000456',
    'd0000000-0000-4000-8000-000000000457',
    'd0000000-0000-4000-8000-000000000458',
    'd0000000-0000-4000-8000-000000000459',
    'd0000000-0000-4000-8000-000000000460',
    'd0000000-0000-4000-8000-000000000461',
    'd0000000-0000-4000-8000-000000000462',
    'd0000000-0000-4000-8000-000000000471',
    'd0000000-0000-4000-8000-000000000472',
    'd0000000-0000-4000-8000-000000000473'
  );

  -- 2. Rimuove i metadati dei documenti allegati di prova
  delete from public.documenti_metadata
  where id in (
    'd0000000-0000-4000-8000-000000000431',
    'd0000000-0000-4000-8000-000000000432'
  );

  -- 3. Rimuove i sottoconti creati da spese_extra.sql
  delete from public.sottoconti
  where id in (
    'd0000000-0000-4000-8000-000000000421',
    'd0000000-0000-4000-8000-000000000422',
    'd0000000-0000-4000-8000-000000000423',
    'd0000000-0000-4000-8000-000000000424',
    'd0000000-0000-4000-8000-000000000425',
    'd0000000-0000-4000-8000-000000000426',
    'd0000000-0000-4000-8000-000000000427',
    'd0000000-0000-4000-8000-000000000428'
  );

  -- 4. Rimuove le macro-categorie create da spese_extra.sql (se non referenziate da altri sottoconti)
  delete from public.piano_dei_conti p
  where p.id in (
    'd0000000-0000-4000-8000-000000000411',
    'd0000000-0000-4000-8000-000000000412',
    'd0000000-0000-4000-8000-000000000413',
    'd0000000-0000-4000-8000-000000000414'
  )
    and not exists (select 1 from public.sottoconti s where s.piano_conto_id = p.id);

  -- 5. Se l'esercizio dell'anno scorso era stato creato da 05_rate_extra.sql (062), lo riporta a CHIUSO
  update public.esercizi_contabili
     set stato = 'CHIUSO'
   where id = 'd0000000-0000-4000-8000-000000000062';

  -- 6. Rimuove gli esercizi extra se non hanno rate o movimenti residui
  delete from public.esercizi_contabili e
  where e.id in (
    'd0000000-0000-4000-8000-000000000401',
    'd0000000-0000-4000-8000-000000000402',
    'd0000000-0000-4000-8000-000000000491'
  )
    and not exists (select 1 from public.rate_testata r where r.esercizio_id = e.id)
    and not exists (select 1 from public.movimenti_contabili m where m.esercizio_id = e.id);

  -- 7. Rimuove il condominio isolato di prova
  delete from public.condomini c
  where c.id = 'd0000000-0000-4000-8000-000000000490'
    and not exists (select 1 from public.esercizi_contabili e where e.condominio_id = c.id);

  raise notice 'Dati extra Spese rimossi.';
end
$pulizia_spese$;
