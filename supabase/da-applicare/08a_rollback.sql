-- =====================================================================
-- 08a_rollback.sql
-- Ripristina ESATTAMENTE le definizioni live prima di 08a_fix_trigger_e_ruoli.sql.
-- NON eseguire finche' 08a non e' stata applicata.
-- Le definizioni sono state lette dal database live il 2026-11-02
-- tramite pg_get_functiondef e pg_policy.
-- =====================================================================

begin;

-- ---------------------------------------------------------------- Ripristina handle_new_user
-- Definizione letta dal DB: eccezione che rilanciava (raise exception).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
    insert into public.utenti (id, email, nome_cognome, telefono, avatar_url)
    values (new.id, new.email,
            coalesce(nullif(v_meta ->> 'nome_cognome',''), nullif(v_meta ->> 'full_name',''), nullif(v_meta ->> 'name','')),
            coalesce(nullif(new.phone,''), nullif(v_meta ->> 'telefono','')),
            coalesce(nullif(v_meta ->> 'avatar_url',''), nullif(v_meta ->> 'picture','')))
    on conflict (id) do update set email = excluded.email;
    if new.email_confirmed_at is not null then perform public.applica_inviti(new.id, new.email); end if;
    return new;
exception when others then
    raise exception 'handle_new_user fallita per %: % (%)', new.id, sqlerrm, sqlstate;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- Ripristina handle_user_confirmed
-- Definizione letta dal DB: nessun handler (errore propagato).
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if old.email_confirmed_at is null and new.email_confirmed_at is not null then
        perform public.applica_inviti(new.id, new.email);
    end if;
    return new;
end $$;
revoke all on function public.handle_user_confirmed() from public, anon, authenticated;

-- ---------------------------------------------------------------- Rimuove l'helper aggiunto da 08a
drop function if exists public.ruolo_non_admin(uuid);

-- ---------------------------------------------------------------- Ripristina le policy originali
-- Espressioni lette dal DB: is_superadmin() OR is_admin_of(COALESCE(...)).
drop policy if exists utente_entita_ruolo_insert on public.utente_entita_ruolo;
create policy utente_entita_ruolo_insert on public.utente_entita_ruolo
    for insert to authenticated
    with check (is_superadmin() or is_admin_of(coalesce(condominio_id, cond_of_unita(unita_id))));

drop policy if exists utente_entita_ruolo_update on public.utente_entita_ruolo;
create policy utente_entita_ruolo_update on public.utente_entita_ruolo
    for update to authenticated
    using  (is_superadmin() or is_admin_of(coalesce(condominio_id, cond_of_unita(unita_id))))
    with check (is_superadmin() or is_admin_of(coalesce(condominio_id, cond_of_unita(unita_id))));

commit;
