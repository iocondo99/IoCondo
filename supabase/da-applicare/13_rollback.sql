-- =============================================================================
-- Rollback migrazione 13: Super Amministratore SaaS & Kill-Switch Condominio
-- =============================================================================

drop trigger if exists trg_condomini_attivo_only_superadmin on public.condomini;
drop function if exists public.guard_condomini_attivo();

-- Ripristina funzioni RLS originali (senza controllo `attivo = true`)
create or replace function public.is_admin_of(p_cond uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or exists (select 1 from public.condomini c where c.id = p_cond and c.admin_id = auth.uid())
        or exists (
            select 1 from public.utente_entita_ruolo r
            join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
            where r.utente_id = auth.uid() and rp.codice = 'ADMIN' and r.condominio_id = p_cond
        )
    );
$$;

create or replace function public.has_cond_access(p_cond uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or exists (select 1 from private.user_condomini(auth.uid()) x(id) where x.id = p_cond)
    );
$$;

create or replace function public.has_role_in(p_cond uuid, p_codice text)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or (p_codice = 'ADMIN' and exists (select 1 from public.condomini c where c.id = p_cond and c.admin_id = auth.uid()))
        or exists (
            select 1 from public.utente_entita_ruolo r
            join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
            where r.utente_id = auth.uid() and rp.codice = p_codice
              and coalesce(r.condominio_id, public.cond_of_unita(r.unita_id)) = p_cond
        )
    );
$$;

create or replace function public.has_unita_access(p_unita uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_unita is not null and (
        public.is_admin_of(public.cond_of_unita(p_unita))
        or exists (select 1 from public.utente_entita_ruolo r where r.utente_id = auth.uid() and r.unita_id = p_unita)
        or exists (
            select 1 from public.anagrafiche_unita a
            where a.utente_id = auth.uid() and a.unita_id = p_unita
              and (a.data_fine is null or a.data_fine >= current_date)
        )
    );
$$;

-- Ripristina policy originali su condomini
drop policy if exists condomini_select on public.condomini;
drop policy if exists condomini_insert on public.condomini;
drop policy if exists condomini_update on public.condomini;
drop policy if exists condomini_delete on public.condomini;

create policy condomini_select on public.condomini for select to authenticated
using (public.is_superadmin() or public.has_cond_access(id));

create policy condomini_insert on public.condomini for insert to authenticated
with check (public.is_superadmin() or (admin_id = auth.uid() and public.has_active_license()));

create policy condomini_update on public.condomini for update to authenticated
using (public.is_superadmin() or public.is_admin_of(id))
with check (public.is_superadmin() or public.is_admin_of(id));

create policy condomini_delete on public.condomini for delete to authenticated
using (public.is_superadmin() or admin_id = auth.uid());

drop index if exists public.idx_condomini_attivo;
alter table public.condomini drop column if exists attivo;
