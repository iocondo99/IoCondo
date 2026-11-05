-- =============================================================================
-- RIPRISTINO E PULIZIA DATI DI PROVA PER COMUNICAZIONI AMMINISTRATORE
-- (NON è una migrazione)
-- =============================================================================
-- Rimuove i 3 post di prova creati da admin_comunicazioni_extra.sql.
-- I commenti associati vengono eliminati automaticamente per vincolo ON DELETE CASCADE.
-- =============================================================================

do $pulizia_admin_comunicazioni$
declare
  c_post_1 constant uuid := 'd0000000-0000-4000-8000-000000000301';
  c_post_2 constant uuid := 'd0000000-0000-4000-8000-000000000302';
  c_post_3 constant uuid := 'd0000000-0000-4000-8000-000000000303';
begin
  -- Rimuovi eventuali notifiche collegate ai post di prova
  delete from public.notifiche
  where riferimento_tabella = 'bacheca_post'
    and riferimento_id in (c_post_1, c_post_2, c_post_3);

  -- Rimuovi commenti esplicitamente (anche se già cascade)
  delete from public.bacheca_commenti
  where post_id in (c_post_1, c_post_2, c_post_3);

  -- Rimuovi i post di prova
  delete from public.bacheca_post
  where id in (c_post_1, c_post_2, c_post_3);

end $pulizia_admin_comunicazioni$;

