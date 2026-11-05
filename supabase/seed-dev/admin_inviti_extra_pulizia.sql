-- =============================================================================
-- PULIZIA DATI DI PROVA INVITI (annulla admin_inviti_extra.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Elimina solo i 3 inviti con token fissi di prova. Non tocca altri dati.
-- =============================================================================

delete from public.inviti_pendenti
where token in (
  'd0000000-0000-4000-8000-000000000061',
  'd0000000-0000-4000-8000-000000000062',
  'd0000000-0000-4000-8000-000000000063'
);

