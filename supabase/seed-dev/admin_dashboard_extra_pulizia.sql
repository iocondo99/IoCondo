-- =============================================================================
-- PULIZIA DATI EXTRA DASHBOARD AMMINISTRATORE (/admin/dashboard)
-- =============================================================================
-- Ripristina lo stato del database eliminando solo i dati di prova inseriti
-- da admin_dashboard_extra.sql. Rieseguibile senza errori.
-- =============================================================================

do $pulizia_admin_dashboard$
declare
  c_mov_saldo_iniziale   constant uuid := 'd0000000-0000-4000-8000-000000000449';
  c_ticket_urgente_1     constant uuid := 'd0000000-0000-4000-8000-000000000881';
  c_ticket_urgente_2     constant uuid := 'd0000000-0000-4000-8000-000000000882';
  c_ticket_urgente_3     constant uuid := 'd0000000-0000-4000-8000-000000000883';
begin
  delete from public.movimenti_contabili where id = c_mov_saldo_iniziale;
  delete from public.ticket_testata where id in (c_ticket_urgente_1, c_ticket_urgente_2, c_ticket_urgente_3);

  raise notice 'Dati extra Dashboard Amministratore rimossi con successo.';
end $pulizia_admin_dashboard$;

