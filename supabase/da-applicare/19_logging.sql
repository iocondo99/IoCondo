-- =====================================================================
-- 19 - Logging: audit delle operazioni, eventi di sicurezza, errori tecnici
-- DA RIVEDERE E APPLICARE dal SQL Editor di Supabase. Non ancora eseguito.
-- =====================================================================
--
-- Tre registri, con regole diverse:
--   1. audit_logs     (esistente)  chi ha fatto cosa sui dati del condominio. Conservazione lunga.
--   2. log_sicurezza  (nuovo)      eventi di sicurezza. Conservazione 7 mesi: gli accessi di chi ha
--                                  privilegi elevati vanno tenuti almeno 6 mesi, inalterabili e
--                                  verificabili (Garante, provv. 27/11/2008 amministratori di sistema).
--   3. log_errori     (nuovo)      errori tecnici di app e funzioni server. Conservazione 30 giorni.
-- Basi: art. 5.1 c) ed e) GDPR (minimizzazione, conservazione limitata), art. 32 GDPR (sicurezza),
-- art. 2220 c.c. e art. 1130 n. 7 c.c. (scritture contabili e registro di contabilita' del condominio).
-- Consultazione: solo super amministratore (scelta di progetto).
-- Scrittura: solo da trigger e funzioni SECURITY DEFINER; nessuno modifica o cancella le righe a mano.
-- Mai nei log: password, token, link magici, corpi di email e documenti. I campi personali
-- (email, telefono, codice fiscale, IBAN, nomi) nelle modifiche compaiono come "[riservato]".
-- Accessi: si registrano solo quelli di super amministratori e amministratori (obbligo del Garante).
-- Gli accessi dei condomini non si registrano: non c'e' un obbligo e sarebbe un dato superfluo.

begin;

-- ---------------------------------------------------------------- 1. AUDIT DELLE OPERAZIONI
alter table public.audit_logs
    add column if not exists origine text not null default 'DB'
        check (origine in ('DB', 'SERVER', 'APP', 'SISTEMA'));

create index if not exists idx_audit_logs_timestamp  on public.audit_logs ("timestamp" desc);
create index if not exists idx_audit_logs_condominio on public.audit_logs (condominio_id, "timestamp" desc);
create index if not exists idx_audit_logs_record     on public.audit_logs (tabella, record_id);

-- Campi che non devono comparire in chiaro nei confronti prima/dopo.
create or replace function public.audit_campo_riservato(p_campo text)
returns boolean
language sql
immutable
as $$
    select p_campo = any (array[
        'email', 'destinatario_email', 'from_email', 'reply_to_email', 'pec',
        'telefono', 'codice_fiscale', 'partita_iva', 'iban', 'iban_accredito', 'iban_principale',
        'nome_cognome', 'nome_cognome_storico', 'nome_denominazione', 'intestazione_destinatario',
        'indirizzo', 'password', 'token', 'url_magico', 'html_body', 'text_body', 'avatar_url'
    ]);
$$;

-- Riga -> jsonb senza campi tecnici e con i campi personali mascherati.
create or replace function public.audit_pulisci(p_riga jsonb)
returns jsonb
language sql
immutable
as $$
    select coalesce(jsonb_object_agg(
               key,
               case when public.audit_campo_riservato(key) and value <> 'null'::jsonb
                    then to_jsonb('[riservato]'::text) else value end),
           '{}'::jsonb)
      from jsonb_each(coalesce(p_riga, '{}'::jsonb))
     where key not in ('created_at', 'updated_at');
$$;

-- Trigger: chi, cosa, quale condominio e, per le modifiche, solo i campi cambiati.
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    v_new  jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
    v_old  jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
    v_riga jsonb := coalesce(v_new, v_old);
    v_cond uuid;
    v_prima jsonb;
    v_dopo  jsonb;
begin
    -- Condominio: diretto, oppure ricavato da palazzo o unita'.
    begin
        v_cond := case
            when tg_table_name = 'condomini' then (v_riga ->> 'id')::uuid
            when v_riga ? 'condominio_id' then (v_riga ->> 'condominio_id')::uuid
            when v_riga ? 'palazzo_id' then (select p.condominio_id from public.palazzi p where p.id = (v_riga ->> 'palazzo_id')::uuid)
            when v_riga ? 'unita_id' then public.cond_of_unita((v_riga ->> 'unita_id')::uuid)
        end;
    exception when others then
        v_cond := null;
    end;

    if tg_op = 'UPDATE' then
        select public.audit_pulisci(jsonb_object_agg(o.key, o.value)),
               public.audit_pulisci(jsonb_object_agg(o.key, v_new -> o.key))
          into v_prima, v_dopo
          from jsonb_each(v_old) o
         where (v_new -> o.key) is distinct from o.value
           and o.key not in ('created_at', 'updated_at');
        -- Nessun campo davvero cambiato: niente riga di audit.
        if v_dopo is null or v_dopo = '{}'::jsonb then
            return new;
        end if;
    elsif tg_op = 'INSERT' then
        v_dopo := public.audit_pulisci(v_new);
    else
        v_prima := public.audit_pulisci(v_old);
    end if;

    insert into public.audit_logs (utente_id, azione, tabella, record_id, condominio_id, valore_prima, valore_dopo, origine)
    values (auth.uid(), tg_op, tg_table_name, (v_riga ->> 'id')::uuid, v_cond, v_prima, v_dopo,
            case when auth.uid() is null then 'SISTEMA' else 'DB' end);

    if tg_op = 'DELETE' then return old; end if;
    return new;
exception when others then
    -- L'audit non deve mai bloccare l'operazione.
    raise warning 'audit_row_change: %', sqlerrm;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

-- Tabelle sorvegliate: dati del condominio, contabilita', assemblee, ruoli. Solo quelle che esistono.
do $$
declare t text;
begin
    foreach t in array array[
        'condomini', 'palazzi', 'scale_colonne', 'unita_immobiliari', 'utente_entita_ruolo', 'anagrafiche_unita',
        'tabelle_millesimali', 'quote_millesimali', 'licenze_saas',
        'esercizi_contabili', 'gestioni_esercizio', 'movimenti_contabili', 'preventivi', 'preventivi_voci',
        'rate_testata', 'rate_dettaglio', 'pagamenti_rate', 'bollettini', 'saldi_pregressi', 'piani_rateizzazione',
        'conguagli_unita', 'riparti_spese', 'fondi', 'movimenti_fondo', 'transazioni_bancarie', 'soggetti_contabili',
        'assemblee_testata', 'assemblee_punti_odg', 'assemblee_presenze', 'assemblee_voti',
        'documenti_metadata', 'bacheca_post', 'fornitori'
    ] loop
        if to_regclass('public.' || t) is not null then
            execute format('drop trigger if exists trg_audit on public.%I', t);
            execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t);
        end if;
    end loop;
end $$;

-- Eventi con un nome (es. RATE_EMESSE, CONVOCAZIONE_INVIATA): li scrivono funzioni server e database.
create or replace function public.registra_evento_audit(
    p_azione        text,
    p_utente        uuid,
    p_condominio    uuid,
    p_tabella       text default null,
    p_record        uuid default null,
    p_dettagli      jsonb default null,
    p_motivo        text default null
) returns void
language sql security definer set search_path = public as $$
    insert into public.audit_logs (utente_id, azione, tabella, record_id, condominio_id, valore_dopo, motivo, origine)
    values (p_utente, upper(left(p_azione, 80)), p_tabella, p_record, p_condominio,
            public.audit_pulisci(p_dettagli), left(p_motivo, 500), 'SERVER');
$$;
revoke all on function public.registra_evento_audit(text, uuid, uuid, text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.registra_evento_audit(text, uuid, uuid, text, uuid, jsonb, text) to service_role;

-- Registro in sola aggiunta e leggibile solo dal super amministratore.
drop policy if exists audit_logs_insert on public.audit_logs;
drop policy if exists audit_logs_update on public.audit_logs;
drop policy if exists audit_logs_delete on public.audit_logs;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
    for select to authenticated using (public.is_superadmin());
revoke insert, update, delete on table public.audit_logs from anon, authenticated;

-- ---------------------------------------------------------------- 2. EVENTI DI SICUREZZA
create table if not exists public.log_sicurezza (
    id            uuid primary key default uuid_generate_v4(),
    created_at    timestamptz not null default now(),
    evento        text not null,
    esito         text not null default 'OK' check (esito in ('OK', 'NEGATO', 'ERRORE')),
    utente_id     uuid references public.utenti (id) on delete set null,
    condominio_id uuid references public.condomini (id) on delete set null,
    email_hash    text,
    ip_address    inet,
    dettagli      jsonb,
    -- Catena di integrita': ogni riga contiene l'impronta della precedente.
    -- Se una riga viene alterata o tolta, la catena non torna piu' (vedi verifica_log_sicurezza).
    hash_precedente text,
    hash            text
);
create index if not exists idx_log_sicurezza_created on public.log_sicurezza (created_at desc);
create index if not exists idx_log_sicurezza_evento  on public.log_sicurezza (evento, created_at desc);
alter table public.log_sicurezza enable row level security;
drop policy if exists log_sicurezza_select on public.log_sicurezza;
create policy log_sicurezza_select on public.log_sicurezza
    for select to authenticated using (public.is_superadmin());
revoke insert, update, delete on table public.log_sicurezza from anon, authenticated;

-- Eventi previsti: INVITO_INVIATO, INVITO_ACCETTATO, RUOLO_ASSEGNATO, RUOLO_RIMOSSO, PASSWORD_CAMBIATA,
-- ACCOUNT_ELIMINATO, ACCESSO_NEGATO (403 nelle funzioni server), CONDOMINIO_SOSPESO.
-- L'email non si salva mai in chiaro: solo un'impronta (sha256) per riconoscere tentativi ripetuti.
create or replace function public.registra_evento_sicurezza(
    p_evento     text,
    p_esito      text default 'OK',
    p_utente     uuid default null,
    p_condominio uuid default null,
    p_email      text default null,
    p_ip         text default null,
    p_dettagli   jsonb default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
    v_prec text; v_evento text; v_esito text; v_email text; v_ip inet; v_dett jsonb;
    v_quando timestamptz; v_hash text;
begin
    perform pg_advisory_xact_lock(hashtext('log_sicurezza'));
    v_prec := (select hash from public.log_sicurezza order by created_at desc, id desc limit 1);
    v_evento := upper(left(p_evento, 80));
    v_esito := case when p_esito in ('OK', 'NEGATO', 'ERRORE') then p_esito else 'OK' end;
    v_email := case when p_email is null then null else encode(digest(lower(btrim(p_email)), 'sha256'), 'hex') end;
    v_ip := case when p_ip ~ '^[0-9a-fA-F:.]+$' then p_ip::inet end;
    v_dett := public.audit_pulisci(p_dettagli);
    v_quando := clock_timestamp();
    v_hash := encode(digest(concat_ws('|', coalesce(v_prec, ''), v_quando::text, v_evento, v_esito,
                     coalesce(p_utente::text, ''), coalesce(p_condominio::text, ''), coalesce(v_email, ''),
                     coalesce(v_ip::text, ''), coalesce(v_dett::text, '')), 'sha256'), 'hex');
    insert into public.log_sicurezza (created_at, evento, esito, utente_id, condominio_id, email_hash, ip_address, dettagli, hash_precedente, hash)
    values (v_quando, v_evento, v_esito, p_utente, p_condominio, v_email, v_ip, v_dett, v_prec, v_hash);
exception when others then
    raise warning 'registra_evento_sicurezza: %', sqlerrm;
end $$;
revoke all on function public.registra_evento_sicurezza(text, text, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.registra_evento_sicurezza(text, text, uuid, uuid, text, text, jsonb) to service_role;

-- Verifica di integrita': restituisce le righe in cui la catena si interrompe (vuoto = registro integro).
-- Le righe piu' vecchie cancellate dalla pulizia a scadenza non sono un'interruzione.
create or replace function public.verifica_log_sicurezza()
returns table (id uuid, created_at timestamptz, problema text)
language sql stable security definer set search_path = public, extensions as $$
    with righe as (
        select l.*, lag(l.hash) over (order by l.created_at, l.id) as hash_atteso,
               row_number() over (order by l.created_at, l.id) as n
          from public.log_sicurezza l
    )
    select r.id, r.created_at,
           case
               when r.hash is distinct from encode(digest(concat_ws('|', coalesce(r.hash_precedente, ''), r.created_at::text,
                        r.evento, r.esito, coalesce(r.utente_id::text, ''), coalesce(r.condominio_id::text, ''),
                        coalesce(r.email_hash, ''), coalesce(r.ip_address::text, ''), coalesce(r.dettagli::text, '')), 'sha256'), 'hex')
                   then 'Contenuto alterato'
               else 'Riga precedente mancante o modificata'
           end
      from righe r
     where public.is_superadmin()
       and (r.hash is distinct from encode(digest(concat_ws('|', coalesce(r.hash_precedente, ''), r.created_at::text,
                r.evento, r.esito, coalesce(r.utente_id::text, ''), coalesce(r.condominio_id::text, ''),
                coalesce(r.email_hash, ''), coalesce(r.ip_address::text, ''), coalesce(r.dettagli::text, '')), 'sha256'), 'hex')
            or (r.n > 1 and r.hash_precedente is distinct from r.hash_atteso));
$$;
revoke all on function public.verifica_log_sicurezza() from public, anon;
grant execute on function public.verifica_log_sicurezza() to authenticated;

-- Profilo privilegiato: super amministratore, ruolo ADMIN o amministratore diretto di un condominio.
create or replace function public.e_privilegiato(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce((select is_superadmin from public.utenti where id = p_uid), false)
        or exists (select 1 from public.condomini where admin_id = p_uid)
        or exists (select 1 from public.utente_entita_ruolo r join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
                    where r.utente_id = p_uid and rp.codice = 'ADMIN');
$$;
revoke all on function public.e_privilegiato(uuid) from public, anon, authenticated;

-- Accessi e cambi password: da auth.users. Accessi solo per profili privilegiati, password per tutti.
create or replace function public.log_eventi_auth() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.last_sign_in_at is distinct from old.last_sign_in_at and new.last_sign_in_at is not null
       and public.e_privilegiato(new.id) then
        perform public.registra_evento_sicurezza('ACCESSO', 'OK', new.id, null, null, null,
            jsonb_build_object('superadmin', coalesce((select is_superadmin from public.utenti where id = new.id), false)));
    end if;
    if new.encrypted_password is distinct from old.encrypted_password and old.encrypted_password is not null then
        perform public.registra_evento_sicurezza('PASSWORD_CAMBIATA', 'OK', new.id);
    end if;
    return new;
exception when others then
    raise warning 'log_eventi_auth: %', sqlerrm;
    return new;
end $$;
revoke all on function public.log_eventi_auth() from public, anon, authenticated;
drop trigger if exists on_auth_user_eventi_log on auth.users;
create trigger on_auth_user_eventi_log after update of last_sign_in_at, encrypted_password on auth.users
    for each row execute function public.log_eventi_auth();

-- Cambi di ruolo registrati in automatico.
create or replace function public.log_cambio_ruolo() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_codice text;
begin
    select codice into v_codice from public.ruoli_piattaforma
     where id = case when tg_op = 'DELETE' then old.ruolo_id else new.ruolo_id end;
    perform public.registra_evento_sicurezza(
        case when tg_op = 'DELETE' then 'RUOLO_RIMOSSO' else 'RUOLO_ASSEGNATO' end,
        'OK',
        case when tg_op = 'DELETE' then old.utente_id else new.utente_id end,
        coalesce(case when tg_op = 'DELETE' then old.condominio_id else new.condominio_id end,
                 public.cond_of_unita(case when tg_op = 'DELETE' then old.unita_id else new.unita_id end)),
        null, null,
        jsonb_build_object('ruolo', v_codice, 'da_utente', auth.uid())
    );
    if tg_op = 'DELETE' then return old; end if;
    return new;
exception when others then
    raise warning 'log_cambio_ruolo: %', sqlerrm;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;
revoke all on function public.log_cambio_ruolo() from public, anon, authenticated;
drop trigger if exists trg_log_cambio_ruolo on public.utente_entita_ruolo;
create trigger trg_log_cambio_ruolo after insert or delete on public.utente_entita_ruolo
    for each row execute function public.log_cambio_ruolo();

-- ---------------------------------------------------------------- 3. ERRORI TECNICI
create table if not exists public.log_errori (
    id            uuid primary key default uuid_generate_v4(),
    created_at    timestamptz not null default now(),
    origine       text not null check (origine in ('APP', 'SERVER')),
    livello       text not null default 'ERROR' check (livello in ('ERROR', 'WARNING')),
    utente_id     uuid references public.utenti (id) on delete set null,
    condominio_id uuid references public.condomini (id) on delete set null,
    contesto      text,      -- pagina dell'app o nome della funzione server
    codice        text,      -- es. codice HTTP o codice errore Postgres
    messaggio     text not null,
    dettagli      jsonb,     -- es. stack ridotto, versione app, piattaforma
    versione_app  text,
    piattaforma   text
);
create index if not exists idx_log_errori_created  on public.log_errori (created_at desc);
create index if not exists idx_log_errori_contesto on public.log_errori (contesto, created_at desc);
alter table public.log_errori enable row level security;
drop policy if exists log_errori_select on public.log_errori;
create policy log_errori_select on public.log_errori
    for select to authenticated using (public.is_superadmin());
revoke insert, update, delete on table public.log_errori from anon, authenticated;

-- Dall'app (utente collegato): testo tagliato, dettagli limitati, massimo 60 errori l'ora per utente.
create or replace function public.registra_errore_app(
    p_contesto     text,
    p_messaggio    text,
    p_codice       text default null,
    p_dettagli     jsonb default null,
    p_condominio   uuid default null,
    p_versione_app text default null,
    p_piattaforma  text default null,
    p_livello      text default 'ERROR'
) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
    if v_uid is null then return; end if;
    if (select count(*) from public.log_errori
         where utente_id = v_uid and created_at > now() - interval '1 hour') >= 60 then
        return;
    end if;
    insert into public.log_errori (origine, livello, utente_id, condominio_id, contesto, codice, messaggio, dettagli, versione_app, piattaforma)
    values ('APP',
            case when p_livello = 'WARNING' then 'WARNING' else 'ERROR' end,
            v_uid, p_condominio,
            left(p_contesto, 200), left(p_codice, 50), left(coalesce(p_messaggio, 'Errore sconosciuto'), 1000),
            case when p_dettagli is not null and length(p_dettagli::text) <= 4000 then public.audit_pulisci(p_dettagli) end,
            left(p_versione_app, 30), left(p_piattaforma, 20));
exception when others then
    raise warning 'registra_errore_app: %', sqlerrm;
end $$;
revoke all on function public.registra_errore_app(text, text, text, jsonb, uuid, text, text, text) from public, anon;
grant execute on function public.registra_errore_app(text, text, text, jsonb, uuid, text, text, text) to authenticated;

-- Dalle funzioni server (service_role).
create or replace function public.registra_errore_server(
    p_contesto   text,
    p_messaggio  text,
    p_codice     text default null,
    p_utente     uuid default null,
    p_condominio uuid default null,
    p_dettagli   jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
    insert into public.log_errori (origine, utente_id, condominio_id, contesto, codice, messaggio, dettagli)
    values ('SERVER', p_utente, p_condominio, left(p_contesto, 200), left(p_codice, 50),
            left(coalesce(p_messaggio, 'Errore sconosciuto'), 1000),
            case when p_dettagli is not null and length(p_dettagli::text) <= 4000 then public.audit_pulisci(p_dettagli) end);
exception when others then
    raise warning 'registra_errore_server: %', sqlerrm;
end $$;
revoke all on function public.registra_errore_server(text, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registra_errore_server(text, text, text, uuid, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------- 4. CONSERVAZIONE
-- audit_logs: nessuna pulizia automatica (dati contabili, 10 anni art. 2220 c.c.).
-- Sicurezza 7 mesi (minimo 6 per il Garante), errori 30 giorni.
create or replace function public.pulizia_log() returns void
language sql security definer set search_path = public as $$
    delete from public.log_sicurezza where created_at < now() - interval '7 months';
    delete from public.log_errori    where created_at < now() - interval '30 days';
$$;
revoke all on function public.pulizia_log() from public, anon, authenticated;
grant execute on function public.pulizia_log() to service_role;

commit;

-- Pulizia automatica ogni notte, se l'estensione pg_cron e' attiva (Database > Extensions).
-- Se non lo e', attivala e riesegui solo questo blocco.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.schedule('iocondo-pulizia-log', '30 3 * * *', 'select public.pulizia_log()');
    else
        raise notice 'pg_cron non attivo: pulizia automatica dei log non programmata.';
    end if;
end $$;
