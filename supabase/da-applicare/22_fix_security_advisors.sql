-- =============================================================================
-- 22 - Fix residui Supabase Security Advisors (IoCondo)
-- Da eseguire nel SQL Editor di Supabase (idempotente).
-- Risolve gli advisor segnalati su PROD dopo l'applicazione della 21:
--   1. [ERROR] security_definer_view su `public.unita_portineria`
--   2. [WARN]  function_search_path_mutable su `audit_campo_riservato` e `audit_pulisci`
--   3. [WARN]  anon_security_definer_function_executable su `guard_condomini_attivo`,
--              `has_palazzo_access` e `has_scala_access`
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. [ERROR] Trasforma `public.unita_portineria` in view `security_invoker = true`
--    spostando la lettura RLS-safe in `public.unita_portineria_visibili()`
--    (stesso pattern adottato in 20_profili_pubblici_invoker.sql).
-- -----------------------------------------------------------------------------
create or replace function public.unita_portineria_visibili()
returns table (
    id               public.unita_immobiliari.id%type,
    palazzo_id       public.unita_immobiliari.palazzo_id%type,
    scala_colonna_id public.unita_immobiliari.scala_colonna_id%type,
    tipologia_id     public.unita_immobiliari.tipologia_id%type,
    interno          public.unita_immobiliari.interno%type,
    piano            public.unita_immobiliari.piano%type
)
language sql
stable
security definer
set search_path = public
as $$
    select u.id, u.palazzo_id, u.scala_colonna_id, u.tipologia_id, u.interno, u.piano
      from public.unita_immobiliari u
     where auth.uid() is not null
       and (
           public.is_superadmin()
           or public.has_unita_access(u.id)
           or public.has_role_in(public.cond_of_palazzo(u.palazzo_id), 'PORTIERE')
       );
$$;

revoke all on function public.unita_portineria_visibili() from public, anon;
grant execute on function public.unita_portineria_visibili() to authenticated;

create or replace view public.unita_portineria
    with (security_invoker = true, security_barrier = true)
as
select
    u.id,
    u.palazzo_id,
    u.scala_colonna_id,
    u.tipologia_id,
    u.interno,
    u.piano
  from public.unita_portineria_visibili() u;

revoke all on public.unita_portineria from public, anon;
grant select on public.unita_portineria to authenticated;

-- -----------------------------------------------------------------------------
-- 2. [WARN] Fissa `search_path` sulle funzioni di redazione audit
-- -----------------------------------------------------------------------------
alter function public.audit_campo_riservato(text) set search_path = public;
alter function public.audit_pulisci(jsonb) set search_path = public;

-- -----------------------------------------------------------------------------
-- 3. [WARN] Revoca `EXECUTE` ad `anon` e `PUBLIC` sulle SECURITY DEFINER residue
--    (`guard_condomini_attivo` e' una funzione trigger: revoca anche ad `authenticated`)
-- -----------------------------------------------------------------------------
revoke execute on function public.guard_condomini_attivo() from public, anon, authenticated;

revoke execute on function public.has_palazzo_access(uuid) from public, anon;
grant  execute on function public.has_palazzo_access(uuid) to authenticated;

revoke execute on function public.has_scala_access(uuid) from public, anon;
grant  execute on function public.has_scala_access(uuid) to authenticated;

commit;

-- =============================================================================
-- SEZIONE VERIFICA (eseguire manualmente dopo l'applicazione)
-- =============================================================================
-- select c.relname, c.reloptions
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relname = 'unita_portineria';
--
-- select p.proname, p.proconfig,
--        pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
--        pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in (
--      'unita_portineria_visibili', 'audit_campo_riservato', 'audit_pulisci',
--      'guard_condomini_attivo', 'has_palazzo_access', 'has_scala_access'
--    )
--  order by p.proname;

-- =============================================================================
-- SEZIONE ROLLBACK (eseguire manualmente solo in caso di ripristino)
-- =============================================================================
-- create or replace view public.unita_portineria with (security_barrier = true) as
--   select u.id, u.palazzo_id, u.scala_colonna_id, u.tipologia_id, u.interno, u.piano
--     from public.unita_immobiliari u
--    where public.is_superadmin() or public.has_unita_access(u.id)
--       or public.has_role_in(public.cond_of_palazzo(u.palazzo_id), 'PORTIERE');
-- drop function if exists public.unita_portineria_visibili();
-- alter function public.audit_campo_riservato(text) reset search_path;
-- alter function public.audit_pulisci(jsonb) reset search_path;
-- grant execute on function public.guard_condomini_attivo() to anon, authenticated;
-- grant execute on function public.has_palazzo_access(uuid) to anon, authenticated;
-- grant execute on function public.has_scala_access(uuid) to anon, authenticated;
