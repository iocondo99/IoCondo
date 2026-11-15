-- =============================================================================
-- Migrazione 14: Coda Email Persistente con Resend e Mittente Amministratore
-- =============================================================================
-- Idempotente: rieseguibile senza errori.
-- Non eseguire direttamente da agente: applicare a mano dal SQL Editor di Supabase.
-- =============================================================================

-- 1. Tabella public.coda_email
create table if not exists public.coda_email (
    id                     uuid primary key default uuid_generate_v4(),
    condominio_id          uuid not null references public.condomini (id) on delete cascade,
    amministratore_id      uuid references public.utenti (id) on delete set null,
    destinatario_utente_id uuid references public.utenti (id) on delete set null,
    destinatario_email     text not null,
    destinatario_nome      text,
    tipo_evento            text not null check (tipo_evento in ('BOLLETTINO_EMESSO', 'CONVOCAZIONE_ASSEMBLEA', 'COMUNICAZIONE_IMPORTANTE')),
    riferimento_tabella    text,
    riferimento_id         uuid,
    idempotency_key        text not null unique,
    from_email             text not null,
    reply_to_email         text,
    oggetto                text not null,
    html_body              text not null,
    text_body              text not null,
    stato                  text not null default 'PENDING' check (stato in ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
    tentativi              integer not null default 0 check (tentativi >= 0),
    max_tentativi          integer not null default 5 check (max_tentativi >= 1),
    prossimo_tentativo_at  timestamptz not null default now(),
    provider_message_id    text,
    ultimo_errore          text,
    inviata_at             timestamptz,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

-- 2. Indici per worker batch e consultazione log amministratore
create index if not exists idx_coda_email_stato_prossimo
    on public.coda_email (stato, prossimo_tentativo_at);

create index if not exists idx_coda_email_condominio_created
    on public.coda_email (condominio_id, created_at desc);

create index if not exists idx_coda_email_riferimento
    on public.coda_email (riferimento_tabella, riferimento_id);

-- 3. Row Level Security: sola lettura per amministratore del condominio (e superadmin)
-- Le scritture avvengono esclusivamente tramite Edge Functions con service_role.
alter table public.coda_email enable row level security;

drop policy if exists coda_email_select_admin on public.coda_email;
create policy coda_email_select_admin
    on public.coda_email
    for select
    to authenticated
    using (public.is_admin_of(condominio_id));

-- 4. Funzione atomica di prelievo batch per il worker (FOR UPDATE SKIP LOCKED)
create or replace function public.claim_coda_email_batch(p_limit integer default 25)
returns setof public.coda_email
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
    -- Sblocca eventuali righe rimaste in PROCESSING da oltre 10 minuti (crash/timeout worker)
    update public.coda_email
       set stato = case when tentativi >= max_tentativi then 'FAILED' else 'PENDING' end,
           ultimo_errore = coalesce(ultimo_errore, 'Timeout elaborazione (> 10 minuti)'),
           prossimo_tentativo_at = now(),
           updated_at = now()
     where stato = 'PROCESSING'
       and coalesce(updated_at, prossimo_tentativo_at, created_at) < now() - interval '10 minutes';

    return query
    with candidates as (
        select c.id
          from public.coda_email c
         where c.stato = 'PENDING'
           and c.prossimo_tentativo_at <= now()
         order by c.prossimo_tentativo_at asc, c.created_at asc
         limit v_limit
         for update skip locked
    )
    update public.coda_email q
       set stato = 'PROCESSING',
           updated_at = now()
      from candidates
     where q.id = candidates.id
    returning q.*;
end;
$$;

revoke all on function public.claim_coda_email_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_coda_email_batch(integer) to service_role;

-- =============================================================================
-- SEZIONE VERIFICA (eseguire manualmente dopo l'applicazione)
-- =============================================================================
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'coda_email'
--  order by ordinal_position;
--
-- select indexname, indexdef
--   from pg_indexes
--  where schemaname = 'public' and tablename = 'coda_email';
--
-- select policyname, cmd, qual
--   from pg_policies
--  where schemaname = 'public' and tablename = 'coda_email';
--
-- select proname, prosecdef, proconfig
--   from pg_proc
--  where pronamespace = 'public'::regnamespace and proname = 'claim_coda_email_batch';

-- =============================================================================
-- SEZIONE ROLLBACK (eseguire manualmente solo in caso di ripristino)
-- =============================================================================
-- drop policy if exists coda_email_select_admin on public.coda_email;
-- drop function if exists public.claim_coda_email_batch(integer);
-- drop table if exists public.coda_email;
