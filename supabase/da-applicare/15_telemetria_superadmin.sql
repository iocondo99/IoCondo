-- =============================================================================
-- Migrazione 15: Telemetria & Prestazioni Super Admin
-- =============================================================================
-- Idempotente: rieseguibile senza errori.
-- Non eseguire direttamente da agente: applicare a mano dal SQL Editor di Supabase.
-- =============================================================================

-- 1. Tabella aggregata oraria delle operazioni piattaforma
create table if not exists public.telemetria_oraria (
    ora_bucket      timestamptz primary key,
    get_count       bigint not null default 0 check (get_count >= 0),
    insert_count    bigint not null default 0 check (insert_count >= 0),
    put_patch_count bigint not null default 0 check (put_patch_count >= 0),
    delete_count    bigint not null default 0 check (delete_count >= 0),
    edge_fn_count   bigint not null default 0 check (edge_fn_count >= 0),
    errori_count    bigint not null default 0 check (errori_count >= 0),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_telemetria_oraria_bucket_desc
    on public.telemetria_oraria (ora_bucket desc);

-- 2. Tabella utenti unici attivi per fascia oraria (senza duplicati)
create table if not exists public.telemetria_utenti_ora (
    ora_bucket timestamptz not null,
    utente_id  uuid not null,
    created_at timestamptz not null default now(),
    primary key (ora_bucket, utente_id)
);

create index if not exists idx_telemetria_utenti_ora_utente
    on public.telemetria_utenti_ora (utente_id, ora_bucket desc);

-- 3. Row Level Security: lettura consentita solo al Super Amministratore
alter table public.telemetria_oraria enable row level security;
alter table public.telemetria_utenti_ora enable row level security;

drop policy if exists telemetria_oraria_select_superadmin on public.telemetria_oraria;
create policy telemetria_oraria_select_superadmin
    on public.telemetria_oraria
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.utenti u
            where u.id = auth.uid()
              and u.is_superadmin = true
        )
    );

drop policy if exists telemetria_utenti_ora_select_superadmin on public.telemetria_utenti_ora;
create policy telemetria_utenti_ora_select_superadmin
    on public.telemetria_utenti_ora
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.utenti u
            where u.id = auth.uid()
              and u.is_superadmin = true
        )
    );

-- 4. Funzione RPC batch per registrare i contatori aggregati dal client
--    Richiede utente autenticato; esegue UPSERT atomico per l'ora corrente.
create or replace function public.registra_telemetria_batch(
    p_get integer default 0,
    p_insert integer default 0,
    p_put integer default 0,
    p_delete integer default 0,
    p_edge integer default 0,
    p_errori integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid    uuid := auth.uid();
    v_bucket timestamptz := date_trunc('hour', now());
    v_get    integer := least(greatest(coalesce(p_get, 0), 0), 100000);
    v_insert integer := least(greatest(coalesce(p_insert, 0), 0), 100000);
    v_put    integer := least(greatest(coalesce(p_put, 0), 0), 100000);
    v_delete integer := least(greatest(coalesce(p_delete, 0), 0), 100000);
    v_edge   integer := least(greatest(coalesce(p_edge, 0), 0), 100000);
    v_errori integer := least(greatest(coalesce(p_errori, 0), 0), 100000);
begin
    if v_uid is null then
        raise exception 'Non autenticato' using errcode = '42501';
    end if;

    insert into public.telemetria_oraria (
        ora_bucket,
        get_count,
        insert_count,
        put_patch_count,
        delete_count,
        edge_fn_count,
        errori_count,
        updated_at
    )
    values (
        v_bucket,
        v_get,
        v_insert,
        v_put,
        v_delete,
        v_edge,
        v_errori,
        now()
    )
    on conflict (ora_bucket) do update
       set get_count       = public.telemetria_oraria.get_count + excluded.get_count,
           insert_count    = public.telemetria_oraria.insert_count + excluded.insert_count,
           put_patch_count = public.telemetria_oraria.put_patch_count + excluded.put_patch_count,
           delete_count    = public.telemetria_oraria.delete_count + excluded.delete_count,
           edge_fn_count   = public.telemetria_oraria.edge_fn_count + excluded.edge_fn_count,
           errori_count    = public.telemetria_oraria.errori_count + excluded.errori_count,
           updated_at      = now();

    insert into public.telemetria_utenti_ora (ora_bucket, utente_id)
    values (v_bucket, v_uid)
    on conflict (ora_bucket, utente_id) do nothing;
end;
$$;

revoke all on function public.registra_telemetria_batch(integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.registra_telemetria_batch(integer, integer, integer, integer, integer, integer) to authenticated;

-- 5. Funzione RPC dashboard Super Admin (unica chiamata strutturata)
create or replace function public.get_superadmin_dashboard_metriche(p_ore integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid              uuid := auth.uid();
    v_is_superadmin    boolean := false;
    v_ore              integer := least(greatest(coalesce(p_ore, 24), 1), 720);
    v_inizio_periodo   timestamptz := date_trunc('hour', now()) - ((v_ore - 1) || ' hours')::interval;
    v_fine_periodo     timestamptz := date_trunc('hour', now());
    v_serie_oraria     jsonb := '[]'::jsonb;
    v_notifiche_per    jsonb := '{}'::jsonb;
    v_notifiche_sto    jsonb := '{}'::jsonb;
    v_coda_email       jsonb := jsonb_build_object('disponibile', false);
    v_db_size_bytes    bigint := 0;
    v_mau_30g          bigint := 0;
    v_utenti_totali    bigint := 0;
    v_cond_attivi      bigint := 0;
    v_cond_sospesi     bigint := 0;
    v_righe_tabelle    jsonb := '[]'::jsonb;
    v_tab              text;
    v_cnt              bigint;
    v_tabelle          text[] := array[
        'utenti',
        'condomini',
        'unita_immobiliari',
        'notifiche',
        'bacheca_post',
        'ticket_guasti',
        'assemblee',
        'documenti',
        'bollettini',
        'movimenti_contabili'
    ];
begin
    if v_uid is null then
        raise exception '403: Accesso non autorizzato' using errcode = '42501';
    end if;

    select coalesce(u.is_superadmin, false)
      into v_is_superadmin
      from public.utenti u
     where u.id = v_uid;

    if not coalesce(v_is_superadmin, false) then
        raise exception '403: Accesso riservato al Super Amministratore' using errcode = '42501';
    end if;

    -- Serie oraria completa (zero-filled per tutte le ore dell'intervallo)
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'ora_bucket', gs.ora,
                'utenti_attivi', coalesce(u_agg.cnt, 0),
                'get_count', coalesce(t.get_count, 0),
                'insert_count', coalesce(t.insert_count, 0),
                'put_patch_count', coalesce(t.put_patch_count, 0),
                'delete_count', coalesce(t.delete_count, 0),
                'edge_fn_count', coalesce(t.edge_fn_count, 0),
                'errori_count', coalesce(t.errori_count, 0)
            )
            order by gs.ora asc
        ),
        '[]'::jsonb
    )
    into v_serie_oraria
    from generate_series(v_inizio_periodo, v_fine_periodo, interval '1 hour') as gs(ora)
    left join public.telemetria_oraria t
      on t.ora_bucket = gs.ora
    left join (
        select ora_bucket, count(distinct utente_id) as cnt
        from public.telemetria_utenti_ora
        where ora_bucket >= v_inizio_periodo
        group by ora_bucket
    ) u_agg
      on u_agg.ora_bucket = gs.ora;

    -- Notifiche per categoria nel periodo selezionato
    select jsonb_build_object(
        'comunicazioni', coalesce(sum(case
            when upper(coalesce(tipo, '')) like '%COMUNICAZ%' or riferimento_tabella = 'bacheca_post' then 1 else 0
        end), 0),
        'assemblee', coalesce(sum(case
            when upper(coalesce(tipo, '')) like '%ASSEMBLE%' or riferimento_tabella in ('assemblee', 'assemblee_odg') then 1 else 0
        end), 0),
        'bollettini', coalesce(sum(case
            when upper(coalesce(tipo, '')) like '%BOLLETTIN%'
              or upper(coalesce(tipo, '')) like '%RATA%'
              or upper(coalesce(tipo, '')) like '%PAGAMENT%'
              or riferimento_tabella in ('bollettini', 'rate', 'pagamenti') then 1 else 0
        end), 0),
        'altro', coalesce(sum(case
            when not (
                upper(coalesce(tipo, '')) like '%COMUNICAZ%' or riferimento_tabella = 'bacheca_post'
                or upper(coalesce(tipo, '')) like '%ASSEMBLE%' or riferimento_tabella in ('assemblee', 'assemblee_odg')
                or upper(coalesce(tipo, '')) like '%BOLLETTIN%'
                or upper(coalesce(tipo, '')) like '%RATA%'
                or upper(coalesce(tipo, '')) like '%PAGAMENT%'
                or riferimento_tabella in ('bollettini', 'rate', 'pagamenti')
            ) then 1 else 0
        end), 0),
        'totale', count(*)
    )
    into v_notifiche_per
    from public.notifiche
    where created_at >= now() - (v_ore || ' hours')::interval;

    -- Notifiche per categoria storico totale
    select jsonb_build_object(
        'comunicazioni', coalesce(sum(case
            when upper(coalesce(tipo, '')) like '%COMUNICAZ%' or riferimento_tabella = 'bacheca_post' then 1 else 0
        end), 0),
        'assemblee', coalesce(sum(case
            when upper(coalesce(tipo, '')) like '%ASSEMBLE%' or riferimento_tabella in ('assemblee', 'assemblee_odg') then 1 else 0
        end), 0),
        'bollettini', coalesce(sum(case
            when upper(coalesce(tipo, '')) like '%BOLLETTIN%'
              or upper(coalesce(tipo, '')) like '%RATA%'
              or upper(coalesce(tipo, '')) like '%PAGAMENT%'
              or riferimento_tabella in ('bollettini', 'rate', 'pagamenti') then 1 else 0
        end), 0),
        'altro', coalesce(sum(case
            when not (
                upper(coalesce(tipo, '')) like '%COMUNICAZ%' or riferimento_tabella = 'bacheca_post'
                or upper(coalesce(tipo, '')) like '%ASSEMBLE%' or riferimento_tabella in ('assemblee', 'assemblee_odg')
                or upper(coalesce(tipo, '')) like '%BOLLETTIN%'
                or upper(coalesce(tipo, '')) like '%RATA%'
                or upper(coalesce(tipo, '')) like '%PAGAMENT%'
                or riferimento_tabella in ('bollettini', 'rate', 'pagamenti')
            ) then 1 else 0
        end), 0),
        'totale', count(*)
    )
    into v_notifiche_sto
    from public.notifiche;

    -- Coda email (opzionale: solo se la tabella public.coda_email esiste)
    if to_regclass('public.coda_email') is not null then
        execute $q$
            select jsonb_build_object(
                'disponibile', true,
                'per_categoria', jsonb_build_object(
                    'comunicazioni', coalesce(sum(case when tipo_evento = 'COMUNICAZIONE_IMPORTANTE' then 1 else 0 end), 0),
                    'assemblee', coalesce(sum(case when tipo_evento = 'CONVOCAZIONE_ASSEMBLEA' then 1 else 0 end), 0),
                    'bollettini', coalesce(sum(case when tipo_evento = 'BOLLETTINO_EMESSO' then 1 else 0 end), 0)
                ),
                'per_stato', jsonb_build_object(
                    'pending', coalesce(sum(case when stato = 'PENDING' then 1 else 0 end), 0),
                    'processing', coalesce(sum(case when stato = 'PROCESSING' then 1 else 0 end), 0),
                    'sent', coalesce(sum(case when stato = 'SENT' then 1 else 0 end), 0),
                    'failed', coalesce(sum(case when stato = 'FAILED' then 1 else 0 end), 0),
                    'cancelled', coalesce(sum(case when stato = 'CANCELLED' then 1 else 0 end), 0)
                ),
                'totale', count(*)
            )
            from public.coda_email
        $q$ into v_coda_email;
    end if;

    -- Metriche reali database Supabase
    select pg_database_size(current_database()) into v_db_size_bytes;

    select count(distinct utente_id)
      into v_mau_30g
      from public.telemetria_utenti_ora
     where ora_bucket >= now() - interval '30 days';

    select count(*) into v_utenti_totali from public.utenti;

    select
        coalesce(sum(case when coalesce(attivo, true) = true then 1 else 0 end), 0),
        coalesce(sum(case when attivo = false then 1 else 0 end), 0)
      into v_cond_attivi, v_cond_sospesi
      from public.condomini;

    -- Conteggio righe principali tabelle (tollerante a tabelle non ancora migrate)
    foreach v_tab in array v_tabelle loop
        if to_regclass('public.' || v_tab) is not null then
            execute format('select count(*) from public.%I', v_tab) into v_cnt;
            v_righe_tabelle := v_righe_tabelle || jsonb_build_array(
                jsonb_build_object('tabella', v_tab, 'righe', v_cnt)
            );
        end if;
    end loop;

    return jsonb_build_object(
        'generato_at', now(),
        'ore_richieste', v_ore,
        'serie_oraria', v_serie_oraria,
        'notifiche', jsonb_build_object(
            'periodo', v_notifiche_per,
            'storico', v_notifiche_sto
        ),
        'coda_email', v_coda_email,
        'database', jsonb_build_object(
            'db_size_bytes', v_db_size_bytes,
            'mau_30g', v_mau_30g,
            'utenti_totali', v_utenti_totali,
            'condomini_attivi', v_cond_attivi,
            'condomini_sospesi', v_cond_sospesi,
            'righe_tabelle', v_righe_tabelle
        )
    );
end;
$$;

revoke all on function public.get_superadmin_dashboard_metriche(integer) from public, anon;
grant execute on function public.get_superadmin_dashboard_metriche(integer) to authenticated;

-- =============================================================================
-- SEZIONE VERIFICA (eseguire manualmente dopo l'applicazione)
-- =============================================================================
-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public'
--    and tablename in ('telemetria_oraria', 'telemetria_utenti_ora');
--
-- select proname, prosecdef
--   from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in ('registra_telemetria_batch', 'get_superadmin_dashboard_metriche');

-- =============================================================================
-- SEZIONE ROLLBACK (eseguire manualmente solo se necessario annullare)
-- =============================================================================
-- revoke execute on function public.get_superadmin_dashboard_metriche(integer) from authenticated;
-- drop function if exists public.get_superadmin_dashboard_metriche(integer);
-- revoke execute on function public.registra_telemetria_batch(integer, integer, integer, integer, integer, integer) from authenticated;
-- drop function if exists public.registra_telemetria_batch(integer, integer, integer, integer, integer, integer);
-- drop table if exists public.telemetria_utenti_ora;
-- drop table if exists public.telemetria_oraria;
