-- =====================================================================
-- 06_fix_missing_cases.sql
-- Migration incrementale ed idempotente di copertura Casi d'Uso (PRD + Excel)
-- =====================================================================
-- Copre in modo idempotente:
--   * UC-08 (Intervento Fornitore): colonne `fattura_url` e `foto_lavoro_url` su `ticket_interventi`
--   * UC-09 (Import CSV Anagrafiche/Millesimi): tabella `import_jobs` + RPC `valida_e_importa_millesimi`
--   * UC-10 (Assemblea Ibrida & Quorum): colonne `tabella_millesimale_id` e `verbale_url` su
--           `assemblee_testata`, tabella `assemblee_presenze` e RPC `quorum_assemblea`
--   * Excel A17 (Gestione Sinistri Assicurativi): tabella `sinistri_assicurativi`
--   * Excel C26 (Piani di Rateizzazione Personalizzati): tabella `piani_rateizzazione`
--   * Indici completi su tutte le Foreign Key e policy RLS mancanti
-- =====================================================================

set search_path = public, extensions;

-- 1. Estensioni colonne su tabelle esistenti (idempotenti)
alter table public.ticket_interventi
    add column if not exists fattura_url     text,
    add column if not exists foto_lavoro_url text;

alter table public.assemblee_testata
    add column if not exists tabella_millesimale_id uuid references public.tabelle_millesimali (id) on delete set null,
    add column if not exists verbale_url            text;

create index if not exists idx_assemblee_tabella_mill on public.assemblee_testata (tabella_millesimale_id);

-- 2. Nuove tabelle per copertura completa casi d'uso Excel & PRD (se non create da 01)
create table if not exists public.assemblee_presenze (
    id                 uuid primary key default uuid_generate_v4(),
    assemblea_id       uuid not null references public.assemblee_testata (id) on delete cascade,
    unita_id           uuid not null references public.unita_immobiliari (id) on delete cascade,
    utente_id          uuid references public.utenti (id) on delete set null,
    delegato_utente_id uuid references public.utenti (id) on delete set null,
    modalita_presenza  text not null default 'PRESENZA' check (modalita_presenza in ('PRESENZA','ONLINE','DELEGA')),
    check_in_at        timestamptz not null default now(),
    unique (assemblea_id, unita_id)
);
create index if not exists idx_ass_pres_assemblea on public.assemblee_presenze (assemblea_id);
create index if not exists idx_ass_pres_unita     on public.assemblee_presenze (unita_id);
create index if not exists idx_ass_pres_utente    on public.assemblee_presenze (utente_id);
create index if not exists idx_ass_pres_delegato  on public.assemblee_presenze (delegato_utente_id);
alter table public.assemblee_presenze enable row level security;

create table if not exists public.sinistri_assicurativi (
    id                  uuid primary key default uuid_generate_v4(),
    condominio_id       uuid not null references public.condomini (id) on delete cascade,
    polizza_id          uuid not null references public.polizze_assicurative (id) on delete restrict,
    ticket_id           uuid references public.ticket_testata (id) on delete set null,
    numero_pratica      text,
    descrizione         text not null,
    importo_stimato     numeric(12,2) check (importo_stimato is null or importo_stimato >= 0),
    importo_liquidato   numeric(12,2) check (importo_liquidato is null or importo_liquidato >= 0),
    stato               text not null default 'APERTO' check (stato in ('APERTO','PERIZIA','LIQUIDATO','RESPINTO','CHIUSO')),
    data_apertura       date not null default current_date,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists idx_sinistri_cond    on public.sinistri_assicurativi (condominio_id);
create index if not exists idx_sinistri_polizza on public.sinistri_assicurativi (polizza_id);
create index if not exists idx_sinistri_ticket  on public.sinistri_assicurativi (ticket_id);
alter table public.sinistri_assicurativi enable row level security;

create table if not exists public.piani_rateizzazione (
    id                uuid primary key default uuid_generate_v4(),
    condominio_id     uuid not null references public.condomini (id) on delete cascade,
    unita_id          uuid not null references public.unita_immobiliari (id) on delete cascade,
    utente_id         uuid not null references public.utenti (id) on delete cascade,
    importo_totale    numeric(12,2) not null check (importo_totale > 0),
    numero_rate       integer not null default 3 check (numero_rate between 2 and 36),
    stato             text not null default 'ATTIVO' check (stato in ('RICHIESTO','ATTIVO','COMPLETATO','REVOCATO')),
    note              text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists idx_pianirat_cond   on public.piani_rateizzazione (condominio_id);
create index if not exists idx_pianirat_unita  on public.piani_rateizzazione (unita_id);
create index if not exists idx_pianirat_utente on public.piani_rateizzazione (utente_id);
alter table public.piani_rateizzazione enable row level security;

create table if not exists public.import_jobs (
    id                uuid primary key default uuid_generate_v4(),
    condominio_id     uuid not null references public.condomini (id) on delete cascade,
    eseguito_da       uuid references public.utenti (id) on delete set null,
    tipo_import       text not null check (tipo_import in ('ANAGRAFICHE','MILLESIMI','SALDI_PREGRESSI')),
    nome_file         text not null,
    righe_totali      integer not null default 0 check (righe_totali >= 0),
    righe_importate   integer not null default 0 check (righe_importate >= 0),
    stato             text not null default 'COMPLETATO' check (stato in ('IN_CORSO','COMPLETATO','ERRORE')),
    dettaglio_errori  jsonb not null default '[]'::jsonb,
    created_at        timestamptz not null default now()
);
create index if not exists idx_importjobs_cond   on public.import_jobs (condominio_id);
create index if not exists idx_importjobs_utente on public.import_jobs (eseguito_da);
alter table public.import_jobs enable row level security;

-- 3. Trigger updated_at per le nuove tabelle
drop trigger if exists trg_set_updated_at on public.sinistri_assicurativi;
create trigger trg_set_updated_at before update on public.sinistri_assicurativi
    for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.piani_rateizzazione;
create trigger trg_set_updated_at before update on public.piani_rateizzazione
    for each row execute function public.set_updated_at();

-- 4. Policy RLS per le nuove tabelle
do $fix_policies$
declare
    r record;
begin
    for r in
        select * from (values
        ('assemblee_presenze',
            $p$ public.has_cond_access(public.cond_of_assemblea(assemblea_id))
                and not public.is_portiere_only(public.cond_of_assemblea(assemblea_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_assemblea(assemblea_id))
                or (utente_id = auth.uid() and public.has_unita_access(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_assemblea(assemblea_id))
                or (utente_id = auth.uid() and public.has_unita_access(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_assemblea(assemblea_id)) $p$),
        ('sinistri_assicurativi',
            $p$ public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),
        ('piani_rateizzazione',
            $p$ utente_id = auth.uid() or public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id)
                or (utente_id = auth.uid() and stato = 'RICHIESTO' and public.has_unita_access(unita_id)) $p$,
            $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),
        ('import_jobs',
            $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$)
        ) as v(tbl, sel_expr, ins_expr, upd_expr, del_expr)
    loop
        execute format('drop policy if exists %I on public.%I', r.tbl || '_select', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_insert', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_update', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_delete', r.tbl);

        execute format($f$create policy %I on public.%I for select to authenticated
                          using (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_select', r.tbl, r.sel_expr);
        execute format($f$create policy %I on public.%I for insert to authenticated
                          with check (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_insert', r.tbl, r.ins_expr);
        execute format($f$create policy %I on public.%I for update to authenticated
                          using (public.is_superadmin() or (%s))
                          with check (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_update', r.tbl, r.upd_expr, r.upd_expr);
        execute format($f$create policy %I on public.%I for delete to authenticated
                          using (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_delete', r.tbl, r.del_expr);
    end loop;
end
$fix_policies$;

-- 5. RPC calcolo Quorum Assemblea in tempo reale (teste + millesimi su presenti/deleghe)
create or replace function public.quorum_assemblea(p_assemblea uuid)
returns table (
    presenti_teste bigint,
    totale_unita bigint,
    presenti_millesimi numeric,
    totale_millesimi numeric,
    quorum_seconda_convocazione boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
    v_cond uuid;
    v_tab  uuid;
begin
    select condominio_id, tabella_millesimale_id into v_cond, v_tab
      from public.assemblee_testata
     where id = p_assemblea;

    if v_cond is null or not public.has_cond_access(v_cond) then
        raise exception 'Accesso negato' using errcode = '42501';
    end if;

    -- Se l'assemblea non ha una tabella specifica associata, usa la prima tabella generale del condominio
    if v_tab is null then
        select id into v_tab
          from public.tabelle_millesimali
         where condominio_id = v_cond
         order by created_at
         limit 1;
    end if;

    return query
    with tot as (
        select count(distinct u.id)::bigint as n_unita,
               coalesce((select totale from public.tabelle_millesimali where id = v_tab), 1000::numeric) as tot_mm
          from public.unita_immobiliari u
          join public.palazzi p on p.id = u.palazzo_id
         where p.condominio_id = v_cond
    ),
    pres as (
        select count(distinct ap.unita_id)::bigint as n_pres,
               coalesce(sum(q.valore_millesimale), 0)::numeric as mm_pres
          from public.assemblee_presenze ap
          left join public.quote_millesimali q
            on q.tabella_id = v_tab and q.unita_id = ap.unita_id
         where ap.assemblea_id = p_assemblea
    )
    select pres.n_pres,
           tot.n_unita,
           pres.mm_pres,
           tot.tot_mm,
           -- Art. 1136 c.c. 2a convocazione: almeno 1/3 dei partecipanti e 1/3 del valore dell'edificio (>= 333.33 mm)
           (pres.n_pres * 3 >= tot.n_unita and pres.mm_pres * 3 >= tot.tot_mm) as quorum_ok
      from pres, tot;
end $$;

revoke all on function public.quorum_assemblea(uuid) from public, anon;
grant execute on function public.quorum_assemblea(uuid) to authenticated;

-- 5b. RPC validazione e importazione massiva quote millesimali (UC-09 / somma = 1000)
create or replace function public.valida_e_importa_millesimi(p_tabella_id uuid, p_quote jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_cond       uuid;
    v_tot_target numeric;
    v_somma      numeric := 0;
    v_item       jsonb;
    v_count      integer := 0;
begin
    select condominio_id, totale into v_cond, v_tot_target
      from public.tabelle_millesimali
     where id = p_tabella_id;

    if v_cond is null or not public.is_admin_of(v_cond) then
        raise exception 'Accesso negato' using errcode = '42501';
    end if;

    for v_item in select * from jsonb_array_elements(coalesce(p_quote, '[]'::jsonb)) loop
        v_somma := v_somma + coalesce((v_item ->> 'valore_millesimale')::numeric, 0);
    end loop;

    if abs(v_somma - v_tot_target) > 0.01 then
        raise exception 'Somma millesimi (%) diversa dal totale tabella (%)', v_somma, v_tot_target
            using errcode = '22023';
    end if;

    for v_item in select * from jsonb_array_elements(coalesce(p_quote, '[]'::jsonb)) loop
        insert into public.quote_millesimali (tabella_id, unita_id, valore_millesimale)
        values (
            p_tabella_id,
            (v_item ->> 'unita_id')::uuid,
            (v_item ->> 'valore_millesimale')::numeric
        )
        on conflict (tabella_id, unita_id) do update
        set valore_millesimale = excluded.valore_millesimale;
        v_count := v_count + 1;
    end loop;

    return jsonb_build_object(
        'esito', 'importato',
        'tabella_id', p_tabella_id,
        'righe_importate', v_count,
        'somma_millesimi', v_somma
    );
end $$;

revoke all on function public.valida_e_importa_millesimi(uuid, jsonb) from public, anon;
grant execute on function public.valida_e_importa_millesimi(uuid, jsonb) to authenticated;

-- 6. Indici completi su Foreign Key aggiuntive (idempotenti)
create index if not exists idx_inviti_ruolo_proposto on public.inviti_pendenti (ruolo_proposto);
create index if not exists idx_inviti_unita          on public.inviti_pendenti (unita_id);
create index if not exists idx_inviti_invitato_da    on public.inviti_pendenti (invitato_da);
create index if not exists idx_docmeta_caricato_da   on public.documenti_metadata (caricato_da);
create index if not exists idx_movimenti_doc_all     on public.movimenti_contabili (doc_allegato_id);
create index if not exists idx_polizze_doc           on public.polizze_assicurative (doc_id);
create index if not exists idx_ticketall_caricato_da on public.ticket_allegati (caricato_da);
create index if not exists idx_bacheca_autore        on public.bacheca_post (autore_id);
create index if not exists idx_bachecacomm_autore    on public.bacheca_commenti (autore_id);
create index if not exists idx_sondaggi_autore       on public.sondaggi (autore_id);
create index if not exists idx_sondaggivoti_utente   on public.sondaggi_voti (utente_id);
create index if not exists idx_chatrooms_palazzo     on public.chat_rooms (palazzo_id);
create index if not exists idx_chatmsg_mittente      on public.chat_messaggi (mittente_id);
create index if not exists idx_eventi_palazzo        on public.eventi_calendario (palazzo_id);
create index if not exists idx_eventi_creato_da      on public.eventi_calendario (creato_da);
create index if not exists idx_pacchi_registrato_da  on public.registro_pacchi (registrato_da);
create index if not exists idx_prenot_risorsa        on public.prenotazioni_spazi (risorsa_id);

-- 7. Bucket di Storage Cloud e Policy RLS (storage.objects) - Allineamento con 05_storage_buckets.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    (
        'ricevute-rate',
        'ricevute-rate',
        false,
        10485760,
        array['application/pdf', 'image/png', 'image/jpeg']
    ),
    (
        'foto-guasti',
        'foto-guasti',
        true,
        15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    ),
    (
        'documenti-condominio',
        'documenti-condominio',
        false,
        52428800,
        array[
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png'
        ]
    ),
    (
        'avatar-utenti',
        'avatar-utenti',
        true,
        5242880,
        array['image/jpeg', 'image/png', 'image/webp']
    )
on conflict (id) do update
set
    public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.try_parse_uuid(p_text text)
returns uuid
language plpgsql immutable security definer set search_path = public
as $$
begin
    if p_text is null or p_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        return null;
    end if;
    return p_text::uuid;
end;
$$;

revoke all on function public.try_parse_uuid(text) from public;
grant execute on function public.try_parse_uuid(text) to anon, authenticated;

drop policy if exists ricevute_rate_select on storage.objects;
drop policy if exists ricevute_rate_insert on storage.objects;
drop policy if exists ricevute_rate_update on storage.objects;
drop policy if exists ricevute_rate_delete on storage.objects;

drop policy if exists foto_guasti_select on storage.objects;
drop policy if exists foto_guasti_insert on storage.objects;
drop policy if exists foto_guasti_update on storage.objects;
drop policy if exists foto_guasti_delete on storage.objects;

drop policy if exists documenti_condominio_select on storage.objects;
drop policy if exists documenti_condominio_insert on storage.objects;
drop policy if exists documenti_condominio_update on storage.objects;
drop policy if exists documenti_condominio_delete on storage.objects;

drop policy if exists avatar_utenti_select on storage.objects;
drop policy if exists avatar_utenti_insert on storage.objects;
drop policy if exists avatar_utenti_update on storage.objects;
drop policy if exists avatar_utenti_delete on storage.objects;

create policy ricevute_rate_select on storage.objects
for select to authenticated
using (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
        or public.has_unita_access(public.try_parse_uuid((storage.foldername(name))[2]))
    )
);

create policy ricevute_rate_insert on storage.objects
for insert to authenticated
with check (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy ricevute_rate_update on storage.objects
for update to authenticated
using (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
)
with check (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy ricevute_rate_delete on storage.objects
for delete to authenticated
using (
    bucket_id = 'ricevute-rate'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy foto_guasti_select on storage.objects
for select to anon, authenticated
using (
    bucket_id = 'foto-guasti'
);

create policy foto_guasti_insert on storage.objects
for insert to authenticated
with check (
    bucket_id = 'foto-guasti'
    and (
        public.is_superadmin()
        or public.has_cond_access(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy foto_guasti_update on storage.objects
for update to authenticated
using (
    bucket_id = 'foto-guasti'
    and (
        public.is_superadmin()
        or owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
)
with check (
    bucket_id = 'foto-guasti'
    and (
        public.is_superadmin()
        or owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy foto_guasti_delete on storage.objects
for delete to authenticated
using (
    bucket_id = 'foto-guasti'
    and (
        public.is_superadmin()
        or owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy documenti_condominio_select on storage.objects
for select to authenticated
using (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.has_cond_access(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy documenti_condominio_insert on storage.objects
for insert to authenticated
with check (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy documenti_condominio_update on storage.objects
for update to authenticated
using (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
)
with check (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy documenti_condominio_delete on storage.objects
for delete to authenticated
using (
    bucket_id = 'documenti-condominio'
    and (
        public.is_superadmin()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(name))[1]))
    )
);

create policy avatar_utenti_select on storage.objects
for select to anon, authenticated
using (
    bucket_id = 'avatar-utenti'
);

create policy avatar_utenti_insert on storage.objects
for insert to authenticated
with check (
    bucket_id = 'avatar-utenti'
    and (
        public.is_superadmin()
        or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
    )
);

create policy avatar_utenti_update on storage.objects
for update to authenticated
using (
    bucket_id = 'avatar-utenti'
    and (
        public.is_superadmin()
        or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
    )
)
with check (
    bucket_id = 'avatar-utenti'
    and (
        public.is_superadmin()
        or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
    )
);

create policy avatar_utenti_delete on storage.objects
for delete to authenticated
using (
    bucket_id = 'avatar-utenti'
    and (
        public.is_superadmin()
        or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
    )
);

