-- =============================================================================
-- PULIZIA DEI DATI EXTRA PER SEGNALAZIONI  (annulla segnalazioni_extra.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase. NON viene eseguito dall'agente.
-- Rimuove solo ticket, messaggi, allegati, righe di log storico e il condominio isolato creati da
-- `segnalazioni_extra.sql` (prefisso d0000000-0000-4000-8000-0000000006..).
-- Le categorie guasti (Idraulica, Elettrica, ...) restano: sono dati di riferimento condivisi.
-- Non tocca i dati degli altri seed.
-- =============================================================================

do $pulizia_segnalazioni$
declare
  v_ticket_ids uuid[] := array[
    'd0000000-0000-4000-8000-000000000611',
    'd0000000-0000-4000-8000-000000000612',
    'd0000000-0000-4000-8000-000000000613',
    'd0000000-0000-4000-8000-000000000614',
    'd0000000-0000-4000-8000-000000000615',
    'd0000000-0000-4000-8000-000000000616',
    'd0000000-0000-4000-8000-000000000617',
    'd0000000-0000-4000-8000-000000000618',
    'd0000000-0000-4000-8000-000000000619',
    'd0000000-0000-4000-8000-000000000620',
    'd0000000-0000-4000-8000-000000000621',
    'd0000000-0000-4000-8000-000000000622',
    'd0000000-0000-4000-8000-000000000631',
    'd0000000-0000-4000-8000-000000000691'
  ]::uuid[];
begin
  -- 1. Righe di log storico scritte dal trigger trg_log_storico_ticket
  delete from public.log_storico_immobile
  where tipo_evento = 'GUASTO'
    and descrizione in (
      select 'Ticket: ' || t.titolo from public.ticket_testata t where t.id = any (v_ticket_ids)
    );

  -- 2. Allegati e messaggi
  delete from public.ticket_allegati where ticket_id = any (v_ticket_ids);
  delete from public.ticket_messaggi where ticket_id = any (v_ticket_ids);

  -- 3. Ticket
  delete from public.ticket_testata where id = any (v_ticket_ids);

  -- 4. Condominio isolato di prova (solo se non contiene altri dati)
  delete from public.condomini c
  where c.id = 'd0000000-0000-4000-8000-000000000690'
    and not exists (select 1 from public.ticket_testata t where t.condominio_id = c.id)
    and not exists (select 1 from public.cartelle_documenti f where f.condominio_id = c.id);

  raise notice 'Dati extra Segnalazioni rimossi.';
end
$pulizia_segnalazioni$;

