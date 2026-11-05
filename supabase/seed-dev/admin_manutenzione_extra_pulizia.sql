-- =============================================================================
-- RIPRISTINO E PULIZIA DATI DI PROVA PER MANUTENZIONE, TICKET E FORNITORI
-- (NON è una migrazione)
-- =============================================================================
-- Rimuove in modo pulito e idempotente i dati di prova generati da
-- admin_manutenzione_extra.sql.
-- =============================================================================

do $pulizia_admin_manutenzione$
declare
  c_forn_idraulico constant uuid := 'd0000000-0000-4000-8000-000000000601';
  c_forn_elettrico constant uuid := 'd0000000-0000-4000-8000-000000000602';

  c_tkt_urgente    constant uuid := 'd0000000-0000-4000-8000-000000000611';
  c_tkt_in_corso   constant uuid := 'd0000000-0000-4000-8000-000000000612';
  c_tkt_risolto    constant uuid := 'd0000000-0000-4000-8000-000000000613';
  c_tkt_int2       constant uuid := 'd0000000-0000-4000-8000-000000000614';

  c_magic_token    constant text := 'tok_manutentore_prova_612_magic_link_7788';
begin
  -- 1. Rimuovi token fornitori
  delete from public.fornitori_tokens
  where token = c_magic_token;

  -- 2. Rimuovi allegati e messaggi dei ticket di prova
  delete from public.ticket_allegati
  where ticket_id in (c_tkt_urgente, c_tkt_in_corso, c_tkt_risolto, c_tkt_int2);

  delete from public.ticket_messaggi
  where ticket_id in (c_tkt_urgente, c_tkt_in_corso, c_tkt_risolto, c_tkt_int2);

  -- 3. Rimuovi interventi collegati
  delete from public.ticket_interventi
  where ticket_id in (c_tkt_urgente, c_tkt_in_corso, c_tkt_risolto, c_tkt_int2);

  -- 4. Rimuovi i 4 ticket di prova
  delete from public.ticket_testata
  where id in (c_tkt_urgente, c_tkt_in_corso, c_tkt_risolto, c_tkt_int2);

  -- 5. Rimuovi i 2 fornitori convenzionati di prova
  delete from public.fornitori
  where id in (c_forn_idraulico, c_forn_elettrico);

  -- 6. Rimuovi eventuale associazione utente-ruolo di test
  delete from public.utente_entita_ruolo
  where id = 'd0000000-0000-4000-8000-000000000699';

  raise notice 'Pulizia dati di prova manutenzione completata con successo.';
end $pulizia_admin_manutenzione$;
