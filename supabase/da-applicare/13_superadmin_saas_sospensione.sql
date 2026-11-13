-- =============================================================================
-- Migrazione 13: Super Amministratore SaaS — Kill-Switch Condominio & Piano Unico
-- =============================================================================
-- Idempotente: rieseguibile senza errori.
-- Non eseguire direttamente da agente: applicare a mano dal SQL Editor di Supabase.
-- =============================================================================

-- 1. Colonna `attivo` su `public.condomini` + indice dedicato
alter table public.condomini
    add column if not exists attivo boolean not null default true;

create index if not exists idx_condomini_attivo on public.condomini (attivo);

comment on column public.condomini.attivo is
    'Kill-Switch SaaS gestito dal Super Amministratore: se false il condominio è sospeso per residenti, portieri e amministratori.';

-- 2. Inserimento idempotente del Piano Unico in `public.piani_abbonamento`
insert into public.piani_abbonamento (nome, prezzo_mensile, limite_unita, feature_premium)
values (
    'Piano Unico Piattaforma',
    29.00,
    null,
    jsonb_build_object(
        'contabilita', true,
        'assemblee', true,
        'ticket', true,
        'bacheca', true,
        'spazi_comuni', true,
        'differenziata', true,
        'documenti', true,
        'pacchi', true,
        'note', 'Accesso completo a tutte le funzionalità della piattaforma senza limiti di unità.'
    )
)
on conflict (nome) do nothing;

-- 3. Trigger di protezione: solo il SUPER_ADMIN può modificare `condomini.attivo`
create or replace function public.guard_condomini_attivo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.attivo is distinct from old.attivo and not public.is_superadmin() then
        raise exception 'Solo il Super Amministratore può abilitare o sospendere un condominio.'
            using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_condomini_attivo_only_superadmin on public.condomini;
create trigger trg_condomini_attivo_only_superadmin
    before update on public.condomini
    for each row
    execute function public.guard_condomini_attivo();

-- 4. Aggiornamento funzioni RLS di lookup: se condominio.attivo = false,
--    solo il SUPER_ADMIN conserva l'accesso operativo; residenti, portieri e admin sono bloccati.
create or replace function public.is_admin_of(p_cond uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or (
            exists (select 1 from public.condomini c where c.id = p_cond and c.attivo = true)
            and (
                exists (select 1 from public.condomini c where c.id = p_cond and c.admin_id = auth.uid())
                or exists (
                    select 1 from public.utente_entita_ruolo r
                    join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
                    where r.utente_id = auth.uid() and rp.codice = 'ADMIN' and r.condominio_id = p_cond
                )
            )
        )
    );
$$;

create or replace function public.has_cond_access(p_cond uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or (
            exists (select 1 from public.condomini c where c.id = p_cond and c.attivo = true)
            and exists (select 1 from private.user_condomini(auth.uid()) x(id) where x.id = p_cond)
        )
    );
$$;

create or replace function public.has_role_in(p_cond uuid, p_codice text)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or (
            exists (select 1 from public.condomini c where c.id = p_cond and c.attivo = true)
            and (
                (p_codice = 'ADMIN' and exists (select 1 from public.condomini c where c.id = p_cond and c.admin_id = auth.uid()))
                or exists (
                    select 1 from public.utente_entita_ruolo r
                    join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
                    where r.utente_id = auth.uid() and rp.codice = p_codice
                      and coalesce(r.condominio_id, public.cond_of_unita(r.unita_id)) = p_cond
                )
            )
        )
    );
$$;

create or replace function public.has_unita_access(p_unita uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_unita is not null and (
        public.is_superadmin()
        or (
            exists (select 1 from public.condomini c where c.id = public.cond_of_unita(p_unita) and c.attivo = true)
            and (
                public.is_admin_of(public.cond_of_unita(p_unita))
                or exists (select 1 from public.utente_entita_ruolo r where r.utente_id = auth.uid() and r.unita_id = p_unita)
                or exists (
                    select 1 from public.anagrafiche_unita a
                    where a.utente_id = auth.uid() and a.unita_id = p_unita
                      and (a.data_fine is null or a.data_fine >= current_date)
                )
            )
        )
    );
$$;

-- 5. Policy RLS su `public.condomini`:
--    - SELECT: consente al SUPER_ADMIN di vedere tutti i condomini e agli utenti associati di leggere
--      i metadati base del proprio condominio (incluso `attivo = false`) per mostrare la schermata "Condominio Sospeso"
--      e il selettore condominio, mentre ogni tabella operativa rimane bloccata da `has_cond_access` / `is_admin_of`.
--    - UPDATE / DELETE: bloccati se `attivo = false` (eccetto SUPER_ADMIN); la modifica di `attivo` è riservata al SUPER_ADMIN dal trigger.
drop policy if exists condomini_select on public.condomini;
drop policy if exists condomini_insert on public.condomini;
drop policy if exists condomini_update on public.condomini;
drop policy if exists condomini_delete on public.condomini;

create policy condomini_select on public.condomini for select to authenticated
using (
    public.is_superadmin()
    or exists (select 1 from private.user_condomini(auth.uid()) x(id) where x.id = condomini.id)
);

create policy condomini_insert on public.condomini for insert to authenticated
with check (
    public.is_superadmin()
    or (admin_id = auth.uid() and public.has_active_license())
);

create policy condomini_update on public.condomini for update to authenticated
using (public.is_superadmin() or (public.is_admin_of(id) and attivo = true))
with check (public.is_superadmin() or (public.is_admin_of(id) and attivo = true));

create policy condomini_delete on public.condomini for delete to authenticated
using (public.is_superadmin() or (admin_id = auth.uid() and attivo = true));
