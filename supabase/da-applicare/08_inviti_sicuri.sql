-- Inviti sicuri (UC-07). DA RIVEDERE: non eseguita. Da applicare dal SQL Editor dopo la revisione.
--
-- Cosa cambia:
--  1. Nessuno scrive piu' direttamente in inviti_pendenti: INSERT e UPDATE passano solo da crea_invito().
--     SELECT e DELETE per amministratore e super amministratore restano (elenco e annullamento).
--  2. crea_invito(): controlli lato database con auth.uid(), mai sui dati dell'app.
--       - l'amministratore invita solo CONDOMINO e PORTIERE, solo nei condomini che amministra;
--       - il ruolo ADMIN solo il super amministratore;
--       - l'unita' deve appartenere al condominio indicato; email e ruolo validati;
--       - un invito aperto uguale viene rinnovato (nuova scadenza), non duplicato;
--       - massimo 50 inviti l'ora per chi invita.
--     Se l'indirizzo ha gia' un account confermato, il ruolo si assegna subito (senza email) e arriva una
--     notifica nell'app. Ruoli esistenti e is_superadmin non si toccano mai.
--  3. applica_inviti() resa piu' rigida (parte alla conferma dell'email, come prima):
--       - solo inviti non scaduti: scaduto = nessun ruolo, per sempre;
--       - chi ha invitato deve essere ancora amministratore del condominio (o super amministratore);
--       - il ruolo ADMIN solo se l'invito e' di un super amministratore;
--       - nessun ruolo duplicato.
--  4. email_confermata(): usata solo dalla Edge Function (service_role).
--
-- Stato verificato prima di scrivere (sola lettura): 0 inviti; applica_inviti eseguibile solo da postgres e
-- service_role; policy inviti_pendenti_* = is_superadmin() OR is_admin_of(condominio_id).

begin;

-- ---------------------------------------------------------------- 1. Solo crea_invito scrive
drop policy if exists inviti_pendenti_insert on public.inviti_pendenti;
drop policy if exists inviti_pendenti_update on public.inviti_pendenti;
revoke all on table public.inviti_pendenti from anon;
revoke insert, update on table public.inviti_pendenti from authenticated;

-- ---------------------------------------------------------------- Chi ha invitato puo' ancora invitare?
create or replace function public.invitante_valido(p_invitante uuid, p_condominio uuid, p_ruolo text)
returns boolean
language sql stable security definer set search_path = public as $$
    select p_invitante is not null and (
        coalesce((select u.is_superadmin from public.utenti u where u.id = p_invitante), false)
        or (
            p_ruolo in ('CONDOMINO', 'PORTIERE')
            and (
                exists (select 1 from public.condomini c where c.id = p_condominio and c.admin_id = p_invitante)
                or exists (
                    select 1 from public.utente_entita_ruolo r
                    join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
                    where r.utente_id = p_invitante and rp.codice = 'ADMIN' and r.condominio_id = p_condominio)
            )
        )
    );
$$;
revoke all on function public.invitante_valido(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. applica_inviti piu' rigida
create or replace function public.applica_inviti(p_uid uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
    v_portiere uuid;
    r record;
begin
    select id into v_portiere from public.ruoli_piattaforma where codice = 'PORTIERE';
    for r in
        select i.token, i.ruolo_proposto, rp.codice, i.condominio_id, i.unita_id, i.flag_portiere
          from public.inviti_pendenti i
          join public.ruoli_piattaforma rp on rp.id = i.ruolo_proposto
         where lower(i.email) = lower(p_email)
           and i.accettato_at is null
           and i.scadenza > now()
           and public.invitante_valido(i.invitato_da, i.condominio_id, rp.codice)
           for update of i
    loop
        insert into public.utente_entita_ruolo (utente_id, ruolo_id, condominio_id, unita_id)
        select p_uid, r.ruolo_proposto, r.condominio_id, r.unita_id
         where not exists (
            select 1 from public.utente_entita_ruolo e
             where e.utente_id = p_uid and e.ruolo_id = r.ruolo_proposto
               and e.condominio_id is not distinct from r.condominio_id
               and e.unita_id is not distinct from r.unita_id);

        if r.flag_portiere and r.codice = 'CONDOMINO' then
            insert into public.utente_entita_ruolo (utente_id, ruolo_id, condominio_id)
            select p_uid, v_portiere, r.condominio_id
             where not exists (
                select 1 from public.utente_entita_ruolo e
                 where e.utente_id = p_uid and e.ruolo_id = v_portiere
                   and e.condominio_id is not distinct from r.condominio_id
                   and e.unita_id is null);
        end if;

        update public.inviti_pendenti set accettato_at = now() where token = r.token;
    end loop;
end $$;
revoke all on function public.applica_inviti(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- 2. crea_invito
create or replace function public.crea_invito(
    p_email          text,
    p_ruolo          text,
    p_condominio     uuid,
    p_unita          uuid    default null,
    p_flag_portiere  boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
    v_uid     uuid := auth.uid();
    v_email   text := lower(btrim(coalesce(p_email, '')));
    v_ruolo   uuid;
    v_portiere boolean := coalesce(p_flag_portiere, false) and p_ruolo = 'CONDOMINO';
    v_utente  uuid;
    v_nome    text;
    v_token   text;
    v_accettato timestamptz;
begin
    if v_uid is null then
        raise exception 'Non autorizzato' using errcode = '42501';
    end if;
    if length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
        raise exception 'Email non valida' using errcode = '22023';
    end if;
    if p_ruolo is null or p_ruolo not in ('CONDOMINO', 'PORTIERE', 'ADMIN') then
        raise exception 'Ruolo non valido' using errcode = '22023';
    end if;
    if p_ruolo = 'ADMIN' and not public.is_superadmin() then
        raise exception 'Non autorizzato' using errcode = '42501';
    end if;
    -- is_admin_of vale anche per il super amministratore; per gli altri solo nei propri condomini.
    if p_condominio is null or not public.is_admin_of(p_condominio) then
        raise exception 'Non autorizzato' using errcode = '42501';
    end if;
    if p_unita is not null and public.cond_of_unita(p_unita) is distinct from p_condominio then
        raise exception 'Unita non valida' using errcode = '22023';
    end if;
    -- La tabella non ha created_at: scadenza - 7 giorni e' il momento di creazione o rinnovo.
    if (select count(*) from public.inviti_pendenti
         where invitato_da = v_uid and scadenza > now() + interval '7 days' - interval '1 hour') >= 50 then
        raise exception 'Troppi inviti' using errcode = '54000';
    end if;

    select id into v_ruolo from public.ruoli_piattaforma where codice = p_ruolo;

    -- Invito aperto uguale: si rinnova (nuova scadenza), non si duplica.
    select token into v_token from public.inviti_pendenti
     where lower(email) = v_email and condominio_id = p_condominio and ruolo_proposto = v_ruolo
       and unita_id is not distinct from p_unita and accettato_at is null
     limit 1;
    if v_token is not null then
        update public.inviti_pendenti
           set scadenza = now() + interval '7 days', flag_portiere = v_portiere, invitato_da = v_uid
         where token = v_token;
    else
        insert into public.inviti_pendenti (email, ruolo_proposto, flag_portiere, condominio_id, unita_id, invitato_da, scadenza)
        values (v_email, v_ruolo, v_portiere, p_condominio, p_unita, v_uid, now() + interval '7 days')
        returning token into v_token;
    end if;

    -- Gia' registrato e confermato: ruolo subito e notifica; nessuna email di invito.
    select id into v_utente from auth.users where lower(email) = v_email and email_confirmed_at is not null;
    if v_utente is not null then
        perform public.applica_inviti(v_utente, v_email);
        select accettato_at into v_accettato from public.inviti_pendenti where token = v_token;
        if v_accettato is not null then
            select nome into v_nome from public.condomini where id = p_condominio;
            insert into public.notifiche (utente_id, condominio_id, titolo, corpo, tipo)
            values (v_utente, p_condominio, 'Nuovo accesso al condominio',
                    'Ora puoi usare l''app anche per ' || coalesce(v_nome, 'un nuovo condominio') || '.', 'invito');
        end if;
    end if;
end $$;
revoke all on function public.crea_invito(text, text, uuid, uuid, boolean) from public, anon;
grant execute on function public.crea_invito(text, text, uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- 4. Per la Edge Function
create or replace function public.email_confermata(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from auth.users where lower(email) = lower(p_email) and email_confirmed_at is not null);
$$;
revoke all on function public.email_confermata(text) from public, anon, authenticated;
grant execute on function public.email_confermata(text) to service_role;

commit;

-- ============================ ROLLBACK (non eseguito) ============================
-- create policy inviti_pendenti_insert on public.inviti_pendenti for insert to authenticated
--     with check (public.is_superadmin() or public.is_admin_of(condominio_id));
-- create policy inviti_pendenti_update on public.inviti_pendenti for update to authenticated
--     using (public.is_superadmin() or public.is_admin_of(condominio_id))
--     with check (public.is_superadmin() or public.is_admin_of(condominio_id));
-- grant insert, update on table public.inviti_pendenti to authenticated;
-- drop function public.crea_invito(text, text, uuid, uuid, boolean);
-- drop function public.email_confermata(text);
-- applica_inviti: ripristinare la definizione di supabase/migrations/05_security_hardening.sql (sez. 9);
-- poi drop function public.invitante_valido(uuid, uuid, text);
