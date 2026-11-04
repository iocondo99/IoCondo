-- =============================================================================
-- PULIZIA DATI EXTRA REGISTRO PACCHI (supabase/seed-dev/pacchi_extra.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase.
-- Rimuove solo i record di test creati da pacchi_extra.sql.
-- =============================================================================

do $pulizia_pacchi$
declare
  -- Pacchi del Condominio di Prova
  c_pacco_u1_giac_1      constant uuid := 'd0000000-0000-4000-8000-000000000811';
  c_pacco_u1_giac_2      constant uuid := 'd0000000-0000-4000-8000-000000000812';
  c_pacco_u1_rit_1       constant uuid := 'd0000000-0000-4000-8000-000000000813';
  c_pacco_u2_giac_1      constant uuid := 'd0000000-0000-4000-8000-000000000821';
  c_pacco_u2_rit_1       constant uuid := 'd0000000-0000-4000-8000-000000000822';

  -- Secondo condominio isolato
  c_condominio_altro     constant uuid := 'd0000000-0000-4000-8000-000000000890';
  c_pacco_altro_condo    constant uuid := 'd0000000-0000-4000-8000-000000000895';
begin
  -- 1. Elimina i pacchi di test del Condominio di Prova
  delete from public.registro_pacchi
   where id in (
     c_pacco_u1_giac_1,
     c_pacco_u1_giac_2,
     c_pacco_u1_rit_1,
     c_pacco_u2_giac_1,
     c_pacco_u2_rit_1,
     c_pacco_altro_condo
   );

  -- 2. Elimina il secondo condominio di prova isolato (in cascata elimina palazzo e unità)
  delete from public.condomini
   where id = c_condominio_altro;

  raise notice 'Dati extra Registro Pacchi rimossi con successo.';
end $pulizia_pacchi$;

