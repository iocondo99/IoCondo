-- =============================================================================
-- PULIZIA DATI EXTRA ASSEMBLEE (supabase/seed-dev/assemblee_extra.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Rimuove solo i record di test creati da assemblee_extra.sql.
-- =============================================================================

do $pulizia_assemblee$
declare
  c_condominio       constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_tabella_mill     constant uuid := 'd0000000-0000-4000-8000-000000000700';

  c_ass_convocata    constant uuid := 'd0000000-0000-4000-8000-000000000710';
  c_ass_incorso      constant uuid := 'd0000000-0000-4000-8000-000000000730';
  c_ass_conclusa     constant uuid := 'd0000000-0000-4000-8000-000000000750';
  c_ass_bozza        constant uuid := 'd0000000-0000-4000-8000-000000000780';

  c_condominio_altro constant uuid := 'd0000000-0000-4000-8000-000000000790';
  c_ass_altra        constant uuid := 'd0000000-0000-4000-8000-000000000792';
begin
  -- 1. Elimina voti e punti ODG legati alle assemblee di test (on delete cascade fa il resto, ma per sicurezza esplicito)
  delete from public.assemblee_voti
   where punto_odg_id in (
     select id from public.assemblee_punti_odg
      where assemblea_id in (c_ass_convocata, c_ass_incorso, c_ass_conclusa, c_ass_bozza, c_ass_altra)
   );

  delete from public.assemblee_punti_odg
   where assemblea_id in (c_ass_convocata, c_ass_incorso, c_ass_conclusa, c_ass_bozza, c_ass_altra);

  -- 2. Elimina le assemblee di test
  delete from public.assemblee_testata
   where id in (c_ass_convocata, c_ass_incorso, c_ass_conclusa, c_ass_bozza, c_ass_altra);

  -- 3. Elimina quote e tabella millesimale creata per il test
  delete from public.quote_millesimali
   where tabella_id = c_tabella_mill;

  delete from public.tabelle_millesimali
   where id = c_tabella_mill;

  -- 4. Elimina il secondo condominio di prova
  delete from public.condomini
   where id = c_condominio_altro;

  raise notice 'Dati extra Assemblee rimossi con successo.';
end $pulizia_assemblee$;

