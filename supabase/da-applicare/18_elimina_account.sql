-- =====================================================================
-- 18 - Eliminazione dell'account da parte dell'utente (diritto alla cancellazione, GDPR art. 17)
-- DA RIVEDERE E APPLICARE dal SQL Editor di Supabase. Non ancora eseguito.
-- =====================================================================
--
-- Principio: si cancella l'ACCOUNT (accesso e profilo personale), non i dati del condominio.
--   - Cancellati (dalle regole gia' presenti, alla rimozione di auth.users -> public.utenti):
--       profilo utenti, ruoli (utente_entita_ruolo), notifiche, dispositivi push, partecipazioni chat,
--       permessi documenti. Inviti pendenti: rimossi qui sotto.
--   - Conservati senza collegamento all'account (on delete set null, gia' presente):
--       contabilita', rate, bollettini, pagamenti, ticket, messaggi, comunicazioni, assemblee, audit,
--       prenotazioni spazi e voti ai sondaggi (resi SET NULL qui sotto).
--   - Conservati dall'amministratore (obbligo di tenuta registro e contabilita'):
--       anagrafica dell'unita' (con il nome copiato qui sotto) e soggetti_contabili.
--
-- Esclusi dalla cancellazione self-service: super amministratore e chi ha il ruolo ADMIN o
-- amministra direttamente un condominio (scelta di progetto).
--
-- L'eliminazione vera dell'utente da auth.users la fa la Edge Function `elimina-account`
-- (serve la service_role): questo script prepara il database e i controlli.

begin;

-- ---------------------------------------------------------------- 1. Anagrafica unita': lo storico resta
-- Oggi utente_id e' NOT NULL con ON DELETE RESTRICT: impedirebbe di cancellare quasi ogni condomino.
-- Diventa facoltativo con SET NULL, e il nominativo viene copiato per lo storico.
alter table public.anagrafiche_unita
    add column if not exists nome_cognome_storico text;

alter table public.anagrafiche_unita
    alter column utente_id drop not null;

do $$
declare v_nome text;
begin
    select tc.constraint_name into v_nome
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public' and tc.table_name = 'anagrafiche_unita'
       and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'utente_id';
    if v_nome is not null then
        execute format('alter table public.anagrafiche_unita drop constraint %I', v_nome);
    end if;
end $$;

alter table public.anagrafiche_unita
    add constraint anagrafiche_unita_utente_id_fkey
    foreign key (utente_id) references public.utenti (id) on delete set null;

-- ---------------------------------------------------------------- 2. Piani di rateizzazione: restano
-- Oggi ON DELETE CASCADE: cancellerebbe i piani di rientro dei debiti (dato contabile del condominio).
alter table public.piani_rateizzazione
    alter column utente_id drop not null;

do $$
declare v_nome text;
begin
    select tc.constraint_name into v_nome
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public' and tc.table_name = 'piani_rateizzazione'
       and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'utente_id';
    if v_nome is not null then
        execute format('alter table public.piani_rateizzazione drop constraint %I', v_nome);
    end if;
end $$;

alter table public.piani_rateizzazione
    add constraint piani_rateizzazione_utente_id_fkey
    foreign key (utente_id) references public.utenti (id) on delete set null;

-- ---------------------------------------------------------------- 2b. Prenotazioni e voti ai sondaggi: restano
-- Oggi ON DELETE CASCADE: le prenotazioni (anche con costo addebitato) e i voti verrebbero cancellati,
-- alterando storico degli spazi e risultati dei sondaggi. Restano, senza collegamento all'account.
-- Nota sondaggi: il vincolo unique (sondaggio_id, utente_id) resta valido; piu' voti con utente_id NULL
-- non vanno in conflitto tra loro, quindi i voti di piu' account eliminati convivono.
alter table public.prenotazioni_spazi
    alter column utente_id drop not null;

do $$
declare v_nome text;
begin
    select tc.constraint_name into v_nome
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public' and tc.table_name = 'prenotazioni_spazi'
       and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'utente_id';
    if v_nome is not null then
        execute format('alter table public.prenotazioni_spazi drop constraint %I', v_nome);
    end if;
end $$;

alter table public.prenotazioni_spazi
    add constraint prenotazioni_spazi_utente_id_fkey
    foreign key (utente_id) references public.utenti (id) on delete set null;

alter table public.sondaggi_voti
    alter column utente_id drop not null;

do $$
declare v_nome text;
begin
    select tc.constraint_name into v_nome
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public' and tc.table_name = 'sondaggi_voti'
       and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'utente_id';
    if v_nome is not null then
        execute format('alter table public.sondaggi_voti drop constraint %I', v_nome);
    end if;
end $$;

alter table public.sondaggi_voti
    add constraint sondaggi_voti_utente_id_fkey
    foreign key (utente_id) references public.utenti (id) on delete set null;

-- ---------------------------------------------------------------- 3. Chi puo' eliminare il proprio account
create or replace function public.puo_eliminare_account(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case
        when p_uid is null then 'NON_AUTENTICATO'
        when coalesce((select u.is_superadmin from public.utenti u where u.id = p_uid), false) then 'SUPERADMIN'
        when exists (select 1 from public.condomini c where c.admin_id = p_uid) then 'AMMINISTRATORE'
        when exists (
            select 1 from public.utente_entita_ruolo r
              join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
             where r.utente_id = p_uid and rp.codice = 'ADMIN'
        ) then 'AMMINISTRATORE'
        else 'OK'
    end;
$$;
revoke all on function public.puo_eliminare_account(uuid) from public, anon, authenticated;
grant execute on function public.puo_eliminare_account(uuid) to service_role;

-- Per l'app: stato per l'utente collegato (mostrare o no la voce "Elimina il mio account").
create or replace function public.stato_eliminazione_account()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select public.puo_eliminare_account(auth.uid());
$$;
revoke all on function public.stato_eliminazione_account() from public, anon;
grant execute on function public.stato_eliminazione_account() to authenticated;

-- ---------------------------------------------------------------- 4. Preparazione all'eliminazione
-- Eseguita dalla Edge Function (service_role) subito prima di cancellare l'utente da auth.users.
-- Restituisce lo stato: se diverso da 'OK' non tocca nulla.
create or replace function public.prepara_eliminazione_account(p_uid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_stato text := public.puo_eliminare_account(p_uid);
    v_email text;
    v_nome  text;
begin
    if v_stato <> 'OK' then
        return v_stato;
    end if;

    select lower(email), nome_cognome into v_email, v_nome from public.utenti where id = p_uid;

    -- Storico delle unita': il nominativo resta leggibile per l'amministratore.
    update public.anagrafiche_unita
       set nome_cognome_storico = coalesce(nome_cognome_storico, v_nome, 'Ex condomino')
     where utente_id = p_uid;

    -- Le email non ancora partite per questa persona non vengono piu' inviate.
    update public.coda_email
       set stato = 'CANCELLED',
           ultimo_errore = coalesce(ultimo_errore, 'Account eliminato dall''utente'),
           updated_at = now()
     where (destinatario_utente_id = p_uid or (v_email is not null and lower(destinatario_email) = v_email))
       and stato in ('PENDING', 'FAILED');

    -- Inviti ancora aperti per il suo indirizzo.
    if v_email is not null then
        delete from public.inviti_pendenti
         where lower(email) = v_email and accettato_at is null;
    end if;

    -- Traccia senza dati personali: resta anche dopo l'eliminazione (utente_id diventa null).
    insert into public.audit_logs (utente_id, azione, tabella, record_id, motivo)
    values (p_uid, 'ELIMINAZIONE_ACCOUNT', 'utenti', p_uid, 'Richiesta dell''utente (GDPR art. 17)');

    return 'OK';
end;
$$;
revoke all on function public.prepara_eliminazione_account(uuid) from public, anon, authenticated;
grant execute on function public.prepara_eliminazione_account(uuid) to service_role;

commit;
