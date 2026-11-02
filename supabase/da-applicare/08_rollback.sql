-- 08_rollback.sql — Annulla la migrazione 08_inviti_sicuri.sql
-- NON eseguire finché 08 non è stata applicata.
-- Eseguire dal SQL Editor di Supabase.
--
-- Stato ripristinato: applica_inviti v05, policy insert/update su inviti_pendenti,
-- grant originali Supabase ad anon/authenticated, rimosse crea_invito / email_confermata / invitante_valido.

begin;

-- 1. Rimuove le nuove funzioni create da 08
drop function if exists public.email_confermata(text);
drop function if exists public.crea_invito(text, text, uuid, uuid, boolean);
drop function if exists public.invitante_valido(uuid, uuid, text);

-- 2. Ripristina applica_inviti dalla versione di 05_security_hardening.sql
create or replace function public.applica_inviti(p_uid uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_portiere uuid;
begin
    select id into v_portiere from public.ruoli_piattaforma where codice = 'PORTIERE';
    insert into public.utente_entita_ruolo (utente_id, ruolo_id, condominio_id, unita_id)
    select p_uid, i.ruolo_proposto, i.condominio_id, i.unita_id
      from public.inviti_pendenti i
     where lower(i.email) = lower(p_email) and i.accettato_at is null and i.scadenza > now()
    on conflict do nothing;
    insert into public.utente_entita_ruolo (utente_id, ruolo_id, condominio_id)
    select p_uid, v_portiere, i.condominio_id
      from public.inviti_pendenti i
     where lower(i.email) = lower(p_email) and i.accettato_at is null and i.scadenza > now() and i.flag_portiere
    on conflict do nothing;
    update public.inviti_pendenti set accettato_at = now()
     where lower(email) = lower(p_email) and accettato_at is null and scadenza > now();
end $$;
revoke all on function public.applica_inviti(uuid, text) from public, anon, authenticated;

-- 3. Ripristina i grant su inviti_pendenti (come da default Supabase applicati da 01_init_schema.sql)
--    Il grant su anon era stato completamente rimosso da 08; qui lo si riporta allo stato precedente.
grant all on table public.inviti_pendenti to anon;
grant insert, update on table public.inviti_pendenti to authenticated;

-- 4. Ripristina le policy di scrittura diretta (DROP + CREATE per idempotenza)
drop policy if exists inviti_pendenti_insert on public.inviti_pendenti;
drop policy if exists inviti_pendenti_update on public.inviti_pendenti;

create policy inviti_pendenti_insert on public.inviti_pendenti
    for insert to authenticated
    with check (is_superadmin() or is_admin_of(condominio_id));

create policy inviti_pendenti_update on public.inviti_pendenti
    for update to authenticated
    using  (is_superadmin() or is_admin_of(condominio_id))
    with check (is_superadmin() or is_admin_of(condominio_id));

commit;
