-- =============================================================================
-- PULIZIA DATI EXTRA PER ASSISTENZA E POLIZZA (/assistenza, Task 7)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Rimuove unicamente i record creati da assistenza_extra.sql.
-- =============================================================================

do $pulizia_assistenza$
declare
  c_polizza_prova        constant uuid := 'd0000000-0000-4000-8000-000000000951';
  c_forn_ascensore       constant uuid := 'd0000000-0000-4000-8000-000000000961';
  c_forn_idraulico       constant uuid := 'd0000000-0000-4000-8000-000000000962';
begin
  delete from public.polizze_assicurative where id = c_polizza_prova;
  delete from public.fornitori where id in (c_forn_ascensore, c_forn_idraulico);

  raise notice 'Dati extra Assistenza rimossi con successo.';
end $pulizia_assistenza$;

