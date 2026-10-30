-- Riduce la superficie RPC delle funzioni SECURITY DEFINER segnalate da get_advisors.
-- Verificato prima di scrivere: nessuna policy/vista/funzione usa le due funzioni trigger;
-- try_parse_uuid e' usata solo da 14 policy storage riservate al ruolo `authenticated`.
-- I trigger non richiedono EXECUTE al momento dello scatto. NON si toccano has_role_in,
-- is_superadmin e le altre funzioni usate dalle policy RLS.
--
-- Grant prima (proacl):
--   try_parse_uuid:       postgres, anon, authenticated, service_role   (nessun PUBLIC)
--   log_storico_subentro: PUBLIC (=X), postgres, anon, authenticated, service_role
--   log_storico_ticket:   PUBLIC (=X), postgres, anon, authenticated, service_role

-- a) try_parse_uuid: via PUBLIC e anon; authenticated resta esplicito (policy storage)
revoke execute on function public.try_parse_uuid(text) from public, anon;
grant  execute on function public.try_parse_uuid(text) to authenticated;

-- b) funzioni trigger: nessun ruolo API deve poterle chiamare via /rest/v1/rpc.
--    Il grant a PUBLIC e' ereditato da anon: va revocato esplicitamente.
revoke execute on function public.log_storico_subentro() from public, anon, authenticated;
revoke execute on function public.log_storico_ticket()   from public, anon, authenticated;

-- ============================ ROLLBACK (non eseguito) ============================
-- Ripristina i grant originali:
--
-- grant execute on function public.try_parse_uuid(text)      to anon, authenticated, service_role;
-- grant execute on function public.log_storico_subentro()    to public, anon, authenticated, service_role;
-- grant execute on function public.log_storico_ticket()      to public, anon, authenticated, service_role;
