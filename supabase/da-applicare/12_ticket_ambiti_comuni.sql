-- =====================================================================
-- 12_ticket_ambiti_comuni.sql
-- Refactoring del ticketing condominiale per ambiti condivisi (condominio, palazzo, scala).
-- Elimina i ticket privati 1-a-1 e implementa visibilità per parti comuni:
--   - Condominio / Area comune: palazzo_id IS NULL AND scala_colonna_id IS NULL (visibile a tutti)
--   - Palazzo: palazzo_id IS NOT NULL AND scala_colonna_id IS NULL (visibile ai residenti del palazzo)
--   - Scala: scala_colonna_id IS NOT NULL (visibile ai residenti di quella scala/colonna)
-- =====================================================================

do $migration_12$
begin
    -- 1. Aggiunta colonne di ambito condiviso su ticket_testata
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ticket_testata' and column_name = 'palazzo_id'
    ) then
        alter table public.ticket_testata
            add column palazzo_id uuid references public.palazzi(id) on delete set null;
    end if;

    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ticket_testata' and column_name = 'scala_colonna_id'
    ) then
        alter table public.ticket_testata
            add column scala_colonna_id uuid references public.scale_colonne(id) on delete set null;
    end if;

    -- 2. Vincolo di coerenza: se scala_colonna_id è valorizzato, anche palazzo_id deve essere valorizzato
    if not exists (
        select 1 from pg_constraint
        where conname = 'ticket_testata_scala_palazzo_check'
    ) then
        alter table public.ticket_testata
            add constraint ticket_testata_scala_palazzo_check
            check (scala_colonna_id is null or palazzo_id is not null);
    end if;

    -- 3. Indici per performance su filtri RLS e query per ambito
    create index if not exists idx_ticket_testata_palazzo on public.ticket_testata (palazzo_id);
    create index if not exists idx_ticket_testata_scala on public.ticket_testata (scala_colonna_id);
end
$migration_12$;

-- 4. Funzioni di verifica permessi per Palazzo e Scala (SECURITY DEFINER, search_path bloccato)
create or replace function public.has_palazzo_access(p_palazzo uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_palazzo is not null and (
        public.is_admin_of(public.cond_of_palazzo(p_palazzo))
        or public.has_role_in(public.cond_of_palazzo(p_palazzo), 'PORTIERE')
        or exists (
            select 1 from public.anagrafiche_unita a
            join public.unita_immobiliari u on u.id = a.unita_id
            where a.utente_id = auth.uid()
              and (a.data_fine is null or a.data_fine >= current_date)
              and u.palazzo_id = p_palazzo
        )
        or exists (
            select 1 from public.utente_entita_ruolo r
            join public.unita_immobiliari u on u.id = r.unita_id
            where r.utente_id = auth.uid()
              and u.palazzo_id = p_palazzo
        )
    );
$$;

create or replace function public.has_scala_access(p_scala uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_scala is not null and (
        exists (
            select 1 from public.scale_colonne s
            where s.id = p_scala and (
                public.is_admin_of(public.cond_of_palazzo(s.palazzo_id))
                or public.has_role_in(public.cond_of_palazzo(s.palazzo_id), 'PORTIERE')
            )
        )
        or exists (
            select 1 from public.anagrafiche_unita a
            join public.unita_immobiliari u on u.id = a.unita_id
            where a.utente_id = auth.uid()
              and (a.data_fine is null or a.data_fine >= current_date)
              and u.scala_colonna_id = p_scala
        )
        or exists (
            select 1 from public.utente_entita_ruolo r
            join public.unita_immobiliari u on u.id = r.unita_id
            where r.utente_id = auth.uid()
              and u.scala_colonna_id = p_scala
        )
    );
$$;

-- 5. Aggiornamento policy RLS su ticket_testata
drop policy if exists ticket_testata_select on public.ticket_testata;
drop policy if exists ticket_testata_insert on public.ticket_testata;
drop policy if exists ticket_testata_update on public.ticket_testata;
drop policy if exists ticket_testata_delete on public.ticket_testata;

-- SELECT:
-- - Superadmin, Admin e Portiere vedono tutti i ticket del condominio.
-- - Il residente (CONDOMINO) vede SOLO:
--     1. Area comune del condominio (palazzo_id is null and scala_colonna_id is null);
--     2. Il proprio Palazzo (palazzo_id associato a una sua unità attiva e scala_colonna_id is null);
--     3. La propria Scala/Colonna (scala_colonna_id associato a una sua unità attiva).
create policy ticket_testata_select on public.ticket_testata for select to authenticated
using (
    public.is_superadmin()
    or public.is_admin_of(condominio_id)
    or public.has_role_in(condominio_id, 'PORTIERE')
    or (
        public.has_cond_access(condominio_id)
        and (
            (palazzo_id is null and scala_colonna_id is null)
            or (palazzo_id is not null and scala_colonna_id is null and public.has_palazzo_access(palazzo_id))
            or (scala_colonna_id is not null and public.has_scala_access(scala_colonna_id))
        )
    )
);

-- INSERT:
-- - Admin e Portiere possono inserire per qualsiasi ambito nel condominio.
-- - Il residente può inserire solo per Area comune oppure per il proprio palazzo / propria scala.
-- - È vietato l'inserimento di ticket privati legati a unita_id (unita_id deve essere null per condòmini).
create policy ticket_testata_insert on public.ticket_testata for insert to authenticated
with check (
    public.is_superadmin()
    or (
        segnalatore_id = auth.uid()
        and public.has_cond_access(condominio_id)
        and (
            public.is_admin_of(condominio_id)
            or public.has_role_in(condominio_id, 'PORTIERE')
            or (
                unita_id is null
                and (
                    (palazzo_id is null and scala_colonna_id is null)
                    or (palazzo_id is not null and scala_colonna_id is null and public.has_palazzo_access(palazzo_id))
                    or (scala_colonna_id is not null and public.has_scala_access(scala_colonna_id))
                )
            )
        )
    )
);

-- UPDATE:
-- - Riservato ad Admin o Portiere (stato, note, interventi).
create policy ticket_testata_update on public.ticket_testata for update to authenticated
using (
    public.is_superadmin()
    or public.is_admin_of(condominio_id)
    or public.has_role_in(condominio_id, 'PORTIERE')
)
with check (
    public.is_superadmin()
    or public.is_admin_of(condominio_id)
    or public.has_role_in(condominio_id, 'PORTIERE')
);

-- DELETE:
-- - Riservato ad Admin / Superadmin.
create policy ticket_testata_delete on public.ticket_testata for delete to authenticated
using (
    public.is_superadmin()
    or public.is_admin_of(condominio_id)
);
