-- =====================================================================
-- 03_backend_triggers.sql
-- Funzioni PL/pgSQL e trigger di automazione di base.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Aggiornamento automatico di updated_at
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
exception
    when others then
        -- Non bloccare mai l'UPDATE per un errore di sola "contabilita' tecnica"
        raise warning 'set_updated_at fallita su %.%: % (%)', tg_table_schema, tg_table_name, sqlerrm, sqlstate;
        return new;
end;
$$;

-- Applica il trigger a TUTTE le tabelle public che possiedono la colonna updated_at
do $$
declare
    r record;
begin
    for r in
        select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
        where c.table_schema = 'public' and c.column_name = 'updated_at'
    loop
        execute format('drop trigger if exists trg_set_updated_at on public.%I', r.table_name);
        execute format(
            'create trigger trg_set_updated_at before update on public.%I
             for each row execute function public.set_updated_at()', r.table_name);
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Sincronizzazione auth.users -> public.utenti
-- ---------------------------------------------------------------------

-- SECURITY DEFINER: deve poter scrivere in public.utenti aggirando la RLS (operazione di sistema).
-- NB: is_superadmin NON viene mai letto dai metadati (modificabili dall'utente): resta sempre false.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
    insert into public.utenti (id, email, nome_cognome, telefono, avatar_url)
    values (
        new.id,
        new.email,
        coalesce(nullif(v_meta ->> 'nome_cognome', ''), nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', '')),
        coalesce(nullif(new.phone, ''), nullif(v_meta ->> 'telefono', '')),
        coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', ''))
    )
    on conflict (id) do update
        set email        = excluded.email,
            nome_cognome = coalesce(public.utenti.nome_cognome, excluded.nome_cognome),
            telefono     = coalesce(public.utenti.telefono, excluded.telefono),
            avatar_url   = coalesce(public.utenti.avatar_url, excluded.avatar_url);
    return new;
exception
    when others then
        -- Un errore qui non deve impedire la registrazione su auth.users
        raise warning 'handle_new_user fallita per % : % (%)', new.id, sqlerrm, sqlstate;
        return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Allineamento email/metadati quando l'utente li modifica in auth
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.utenti
       set email = new.email,
           telefono = coalesce(nullif(new.phone, ''), telefono)
     where id = new.id
       and (email is distinct from new.email
            or (nullif(new.phone, '') is not null and telefono is distinct from new.phone));
    return new;
exception
    when others then
        raise warning 'handle_user_updated fallita per % : % (%)', new.id, sqlerrm, sqlstate;
        return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
    after update of email, phone on auth.users
    for each row execute function public.handle_user_updated();

-- Le funzioni trigger non devono essere invocabili dai client
revoke all on function public.handle_new_user()     from public, anon, authenticated;
revoke all on function public.handle_user_updated() from public, anon, authenticated;
revoke all on function public.set_updated_at()      from public, anon, authenticated;
