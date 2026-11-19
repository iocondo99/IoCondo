-- Rollback di 19_logging.sql (non eseguito).
-- I trigger trg_audit restano sulle tabelle: tornano alla versione semplice della funzione.
do $$ begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.unschedule('iocondo-pulizia-log');
    end if;
exception when others then null;
end $$;

begin;
drop trigger if exists on_auth_user_eventi_log on auth.users;
drop function if exists public.log_eventi_auth();
drop function if exists public.e_privilegiato(uuid);
drop function if exists public.verifica_log_sicurezza();
drop trigger if exists trg_log_cambio_ruolo on public.utente_entita_ruolo;
drop function if exists public.log_cambio_ruolo();
drop function if exists public.pulizia_log();
drop function if exists public.registra_errore_server(text, text, text, uuid, uuid, jsonb);
drop function if exists public.registra_errore_app(text, text, text, jsonb, uuid, text, text, text);
drop function if exists public.registra_evento_sicurezza(text, text, uuid, uuid, text, text, jsonb);
drop function if exists public.registra_evento_audit(text, uuid, uuid, text, uuid, jsonb, text);
drop table if exists public.log_errori;
drop table if exists public.log_sicurezza;

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.audit_logs (utente_id, azione, tabella, record_id)
    values (auth.uid(), tg_op, tg_table_name,
            coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid));
    if tg_op = 'DELETE' then return old; end if;
    return new;
exception when others then
    raise warning 'audit_row_change: %', sqlerrm;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;
drop function if exists public.audit_pulisci(jsonb);
drop function if exists public.audit_campo_riservato(text);
alter table public.audit_logs drop column if exists origine;
commit;
