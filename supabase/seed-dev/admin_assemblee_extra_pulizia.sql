-- =============================================================================
-- RIPRISTINO E PULIZIA DATI DI PROVA ASSEMBLEE AMMINISTRATORE (UC-10)
-- =============================================================================
-- Rimuove esclusivamente i dati di prova inseriti da admin_assemblee_extra.sql.
-- Sicuro ed idempotente.
-- =============================================================================

do $pulizia_admin_assemblee$
declare
  c_ass_conv constant uuid := 'd0000000-0000-4000-8000-000000000910';
  c_ass_live constant uuid := 'd0000000-0000-4000-8000-000000000920';
  c_ass_conc constant uuid := 'd0000000-0000-4000-8000-000000000930';
begin
  -- 1. Elimina le 3 assemblee di prova (cascata su punti_odg, presenze, voti)
  delete from public.assemblee_testata
   where id in (c_ass_conv, c_ass_live, c_ass_conc);

  raise notice 'Pulizia dati di prova Assemblee completata con successo.';
end;
$pulizia_admin_assemblee$;
