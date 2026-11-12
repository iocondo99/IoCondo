-- =====================================================================
-- 12_rollback.sql
-- Ripristino schema e policy precedenti per ticket_testata.
-- =====================================================================

-- 1. Ripristino policy standard (da 02_rls_policies.sql)
drop policy if exists ticket_testata_select on public.ticket_testata;
drop policy if exists ticket_testata_insert on public.ticket_testata;
drop policy if exists ticket_testata_update on public.ticket_testata;
drop policy if exists ticket_testata_delete on public.ticket_testata;

create policy ticket_testata_select on public.ticket_testata for select to authenticated
using (
    public.is_superadmin()
    or public.is_admin_of(condominio_id)
    or segnalatore_id = auth.uid()
    or public.has_role_in(condominio_id, 'PORTIERE')
    or (unita_id is not null and public.has_unita_access(unita_id))
);

create policy ticket_testata_insert on public.ticket_testata for insert to authenticated
with check (
    public.is_superadmin()
    or (
        segnalatore_id = auth.uid()
        and public.has_cond_access(condominio_id)
        and (unita_id is null or public.has_unita_access(unita_id))
    )
);

create policy ticket_testata_update on public.ticket_testata for update to authenticated
using (
    public.is_superadmin()
    or public.is_admin_of(condominio_id)
    or segnalatore_id = auth.uid()
)
with check (
    public.is_superadmin()
    or public.is_admin_of(condominio_id)
    or segnalatore_id = auth.uid()
);

create policy ticket_testata_delete on public.ticket_testata for delete to authenticated
using (
    public.is_superadmin()
    or public.is_admin_of(condominio_id)
);

-- 2. Eliminazione funzioni di lookup
drop function if exists public.has_scala_access(uuid);
drop function if exists public.has_palazzo_access(uuid);

-- 3. Eliminazione vincoli, indici e colonne aggiunte
alter table public.ticket_testata drop constraint if exists ticket_testata_scala_palazzo_check;
drop index if exists public.idx_ticket_testata_scala;
drop index if exists public.idx_ticket_testata_palazzo;

alter table public.ticket_testata drop column if exists scala_colonna_id;
alter table public.ticket_testata drop column if exists palazzo_id;
