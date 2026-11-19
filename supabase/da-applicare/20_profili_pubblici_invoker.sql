-- =====================================================================
-- 20 - Avviso Supabase "Security Definer View" su public.profili_pubblici
-- DA APPLICARE dal SQL Editor. Non ancora eseguito.
-- =====================================================================
-- Perche': in Postgres una vista legge i dati con i permessi del suo proprietario (postgres),
-- quindi ignora la RLS di public.utenti. Qui e' voluto (deve mostrare nome e avatar dei vicini
-- di condominio), ma Supabase lo segnala come rischio.
-- Soluzione: la regola di visibilita' va in una funzione SECURITY DEFINER esplicita, con
-- search_path fisso, e la vista diventa security_invoker (rispetta i permessi di chi interroga).
-- Stessi dati e stesse colonne di prima: l'app non cambia.

begin;

create or replace function public.profili_pubblici_visibili()
returns table (
    id           public.utenti.id%type,
    nome_cognome public.utenti.nome_cognome%type,
    avatar_url   public.utenti.avatar_url%type
)
language sql stable security definer set search_path = public, private as $$
    select u.id, u.nome_cognome, u.avatar_url
      from public.utenti u
     where auth.uid() is not null
       and (u.id = auth.uid()
            or exists (select 1 from private.user_condomini(u.id) x(cid) where public.has_cond_access(x.cid)));
$$;
revoke all on function public.profili_pubblici_visibili() from public, anon;
grant execute on function public.profili_pubblici_visibili() to authenticated;

create or replace view public.profili_pubblici
    with (security_invoker = true)
as
select p.id, p.nome_cognome, p.avatar_url
  from public.profili_pubblici_visibili() p;

revoke all on public.profili_pubblici from anon;
grant select on public.profili_pubblici to authenticated;

commit;
