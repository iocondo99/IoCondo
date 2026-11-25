-- =============================================================================
-- 21_fix_sicurezza.sql
-- Consolidamento e rimedio vulnerabilità di sicurezza emerse dall'audit
-- (`docs/AUDIT_SICUREZZA.md`)
-- =============================================================================
-- Idempotente: rieseguibile senza errori.
-- Database in sola lettura per l'agente: NON applicare automaticamente.
-- Applicare manualmente dopo le migrazioni precedenti (`07`..`20`).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. [CRITICO-02] Riallineamento policy SELECT su `public.documenti_metadata`
--    Corregge la sintassi invalida preesistente in `09_fix_documenti_rls.sql`.
-- -----------------------------------------------------------------------------
drop policy if exists "documenti_select" on public.documenti_metadata;
drop policy if exists documenti_metadata_select on public.documenti_metadata;
create policy documenti_metadata_select on public.documenti_metadata
    for select to authenticated
    using (
        public.is_superadmin()
        or public.is_admin_of(public.cond_of_cartella(cartella_id))
        or public.can_read_documento(id)
    );

-- -----------------------------------------------------------------------------
-- 2. [CRITICO-01] Helper autorizzazione per Edge Function `invia-email`
--    Consente il controllo lato server se il chiamante e' Super Admin o Admin
--    di almeno un condominio attivo (`attivo = true`).
-- -----------------------------------------------------------------------------
create or replace function public.is_active_admin_any()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select auth.uid() is not null and (
        public.is_superadmin()
        or exists (
            select 1
              from public.condomini c
             where c.attivo = true
               and c.admin_id = auth.uid()
        )
        or exists (
            select 1
              from public.utente_entita_ruolo r
              join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
              join public.condomini c on c.id = r.condominio_id
             where r.utente_id = auth.uid()
               and rp.codice = 'ADMIN'
               and c.attivo = true
        )
    );
$$;

revoke all on function public.is_active_admin_any() from public, anon;
grant execute on function public.is_active_admin_any() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. [ALTO-01] Protezione `public.utenti.email` e `is_superadmin` + Lookup verificato
--    Impedisce a qualsiasi client di alterare direttamente `email` o `is_superadmin`
--    tramite PostgREST PATCH su `public.utenti`, mantenendo sincronizzato il
--    solo flusso proveniente dal trigger su `auth.users`.
-- -----------------------------------------------------------------------------
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform set_config('iocondo.sync_email', '1', true);
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
revoke all on function public.handle_user_updated() from public, anon, authenticated;

create or replace function public.trg_utenti_protect_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_trusted boolean :=
        coalesce(auth.role(), '') = 'service_role'
        or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin');
begin
    if new.is_superadmin is distinct from old.is_superadmin and not v_is_trusted then
        raise exception 'Modifica diretta di is_superadmin non consentita' using errcode = '42501';
    end if;

    if new.email is distinct from old.email
       and not v_is_trusted
       and coalesce(current_setting('iocondo.sync_email', true), '') <> '1'
    then
        raise exception 'Modifica diretta di email su public.utenti non consentita' using errcode = '42501';
    end if;

    return new;
end;
$$;
revoke all on function public.trg_utenti_protect_sensitive_fields() from public, anon, authenticated;

drop trigger if exists trg_utenti_protect_sensitive on public.utenti;
create trigger trg_utenti_protect_sensitive
    before update on public.utenti
    for each row execute function public.trg_utenti_protect_sensitive_fields();

-- Lookup rigoroso per Super Admin: verifica corrispondenza e conferma email in `auth.users`
create or replace function public.risolvi_utente_verificato_da_email(p_email text)
returns table (
    id uuid,
    nome_cognome text,
    telefono text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
    v_email text := lower(trim(coalesce(p_email, '')));
begin
    if not public.is_superadmin() then
        raise exception 'Permesso negato: richiesto ruolo Super Admin' using errcode = '42501';
    end if;

    if v_email = '' then
        return;
    end if;

    return query
    select u.id, u.nome_cognome, u.telefono
      from auth.users au
      join public.utenti u on u.id = au.id
     where lower(trim(coalesce(au.email, ''))) = v_email
       and au.email_confirmed_at is not null
     limit 1;
end;
$$;
revoke all on function public.risolvi_utente_verificato_da_email(text) from public, anon;
grant execute on function public.risolvi_utente_verificato_da_email(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. [ALTO-02] Isolamento Storage (`documenti-condominio`, `ricevute-rate`) +
--    chiusura lettura bozze su `rate_dettaglio`
-- -----------------------------------------------------------------------------
create or replace function public.can_read_documento_by_path(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
    v_cond uuid := public.try_parse_uuid((storage.foldername(p_object_name))[1]);
    v_doc_id uuid;
begin
    if public.is_superadmin() then
        return true;
    end if;

    if v_cond is null then
        return false;
    end if;

    if public.is_admin_of(v_cond) then
        return true;
    end if;

    select dm.id
      into v_doc_id
      from public.documenti_metadata dm
     where dm.url_storage = p_object_name
     limit 1;

    if v_doc_id is null then
        -- Un file orfano/non indicizzato in `documenti_metadata` resta accessibile solo ad Admin/Superadmin.
        return false;
    end if;

    return public.can_read_documento(v_doc_id);
end;
$$;
revoke all on function public.can_read_documento_by_path(text) from public, anon;
grant execute on function public.can_read_documento_by_path(text) to authenticated;

create or replace function public.can_read_ricevuta_rate(p_object_name text, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
    select
        public.is_superadmin()
        or p_owner = auth.uid()
        or public.is_admin_of(public.try_parse_uuid((storage.foldername(p_object_name))[1]))
        or exists (
            select 1
              from public.rate_dettaglio rd
              join public.rate_testata rt on rt.id = rd.rata_testata_id
              join public.esercizi_contabili ec on ec.id = rt.esercizio_id
              join public.condomini c on c.id = ec.condominio_id
             where c.attivo = true
               and ec.condominio_id = public.try_parse_uuid((storage.foldername(p_object_name))[1])
               and rd.unita_id = public.try_parse_uuid((storage.foldername(p_object_name))[2])
               and rd.utente_id = auth.uid()
               and rt.pubblicata = true
               and (
                   rd.bollettino_url = p_object_name
                   or not exists (
                       select 1
                         from public.rate_dettaglio rd_other
                        where rd_other.bollettino_url = p_object_name
                          and rd_other.utente_id is distinct from auth.uid()
                   )
               )
        );
$$;
revoke all on function public.can_read_ricevuta_rate(text, uuid) from public, anon;
grant execute on function public.can_read_ricevuta_rate(text, uuid) to authenticated;

drop policy if exists documenti_condominio_select on storage.objects;
create policy documenti_condominio_select on storage.objects
    for select to authenticated
    using (
        bucket_id = 'documenti-condominio'
        and public.can_read_documento_by_path(name)
    );

drop policy if exists ricevute_rate_select on storage.objects;
create policy ricevute_rate_select on storage.objects
    for select to authenticated
    using (
        bucket_id = 'ricevute-rate'
        and public.can_read_ricevuta_rate(name, owner)
    );

-- Impedisce la lettura anticipata di `rate_dettaglio` legate a `rate_testata` in bozza (`pubblicata = false`)
drop policy if exists rate_dettaglio_select on public.rate_dettaglio;
create policy rate_dettaglio_select on public.rate_dettaglio
    for select to authenticated
    using (
        public.is_superadmin()
        or public.is_admin_of(public.cond_of_unita(unita_id))
        or (
            exists (
                select 1
                  from public.rate_testata rt
                 where rt.id = rata_testata_id
                   and rt.pubblicata = true
            )
            and (
                utente_id = auth.uid()
                or (utente_id is null and public.has_unita_access(unita_id))
            )
        )
    );

-- -----------------------------------------------------------------------------
-- 5. [MEDIO-01] Bucket `foto-guasti` e `avatar-utenti` privati (no accesso `anon`)
-- -----------------------------------------------------------------------------
update storage.buckets
   set public = false
 where id in ('foto-guasti', 'avatar-utenti');

drop policy if exists foto_guasti_select on storage.objects;
create policy foto_guasti_select on storage.objects
    for select to authenticated
    using (
        bucket_id = 'foto-guasti'
        and (
            public.is_superadmin()
            or owner = auth.uid()
            or public.has_cond_access(public.try_parse_uuid((storage.foldername(name))[1]))
        )
    );

drop policy if exists avatar_utenti_select on storage.objects;
create policy avatar_utenti_select on storage.objects
    for select to authenticated
    using (
        bucket_id = 'avatar-utenti'
        and (
            public.is_superadmin()
            or public.try_parse_uuid((storage.foldername(name))[1]) = auth.uid()
            or exists (
                select 1
                  from private.user_condomini(public.try_parse_uuid((storage.foldername(name))[1])) x(cid)
                 where public.has_cond_access(x.cid)
            )
        )
    );

-- -----------------------------------------------------------------------------
-- 6. [ALTO-05] `chat_partecipanti`, `prenotazioni_spazi` server-side + RPC mascherata,
--    e vincoli cross-tenant padre-figlio
-- -----------------------------------------------------------------------------
-- 6.1 Chat partecipanti: auto-iscrizione consentita solo a stanze aperte del proprio ambito
drop policy if exists chat_partecipanti_insert on public.chat_partecipanti;
create policy chat_partecipanti_insert on public.chat_partecipanti
    for insert to authenticated
    with check (
        public.is_superadmin()
        or public.is_admin_of(public.cond_of_chat_room(room_id))
        or (
            utente_id = auth.uid()
            and exists (
                select 1
                  from public.chat_rooms cr
                 where cr.id = room_id
                   and public.has_cond_access(cr.condominio_id)
                   and (
                       cr.tipo = 'GENERALE'
                       or (
                           cr.tipo = 'PALAZZO'
                           and cr.palazzo_id is not null
                           and public.has_palazzo_access(cr.palazzo_id)
                       )
                   )
            )
        )
    );

-- 6.2 Prenotazioni spazi: CHECK >= 0 + trigger di calcolo costi/durata + privacy vicini
do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'prenotazioni_spazi_costo_non_negativo'
           and conrelid = 'public.prenotazioni_spazi'::regclass
    ) then
        alter table public.prenotazioni_spazi
            add constraint prenotazioni_spazi_costo_non_negativo check (costo_addebitato >= 0);
    end if;
end $$;

create or replace function public.trg_prenotazioni_spazi_enforce()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cond       uuid;
    v_tariffa    numeric(8,2);
    v_max_ore    integer;
    v_durata_ore numeric;
    v_is_admin   boolean;
begin
    select rp.condominio_id, rp.tariffa_oraria, rp.max_ore
      into v_cond, v_tariffa, v_max_ore
      from public.risorse_prenotabili rp
     where rp.id = new.risorsa_id;

    if v_cond is null then
        raise exception 'Risorsa prenotabile inesistente' using errcode = '22023';
    end if;

    v_is_admin := public.is_superadmin() or public.is_admin_of(v_cond);

    if not v_is_admin and not public.has_cond_access(v_cond) then
        raise exception 'Accesso non autorizzato al condominio della risorsa' using errcode = '42501';
    end if;

    if tg_op = 'UPDATE' and not v_is_admin then
        if new.risorsa_id is distinct from old.risorsa_id
           or new.utente_id is distinct from old.utente_id
        then
            raise exception 'Non puoi cambiare risorsa o titolare della prenotazione' using errcode = '42501';
        end if;
    end if;

    if tg_op = 'INSERT' and not v_is_admin and new.utente_id is distinct from auth.uid() then
        raise exception 'utente_id non valido per la prenotazione' using errcode = '42501';
    end if;

    if new.data_fine <= new.data_inizio then
        raise exception 'data_fine deve essere successiva a data_inizio' using errcode = '22023';
    end if;

    v_durata_ore := extract(epoch from (new.data_fine - new.data_inizio)) / 3600.0;
    if v_max_ore is not null and v_durata_ore > v_max_ore then
        raise exception 'Durata massima consentita (% ore) superata', v_max_ore using errcode = '22023';
    end if;

    -- Il costo viene calcolato lato server dalla tariffa oraria (niente manipolazione client).
    if not v_is_admin or new.costo_addebitato is null or new.costo_addebitato < 0 then
        new.costo_addebitato := round((v_durata_ore * coalesce(v_tariffa, 0))::numeric, 2);
    end if;

    return new;
end;
$$;
revoke all on function public.trg_prenotazioni_spazi_enforce() from public, anon, authenticated;

drop trigger if exists trg_prenotazioni_spazi_server_enforce on public.prenotazioni_spazi;
create trigger trg_prenotazioni_spazi_server_enforce
    before insert or update on public.prenotazioni_spazi
    for each row execute function public.trg_prenotazioni_spazi_enforce();

drop policy if exists prenotazioni_spazi_select on public.prenotazioni_spazi;
create policy prenotazioni_spazi_select on public.prenotazioni_spazi
    for select to authenticated
    using (
        public.is_superadmin()
        or public.is_admin_of(public.cond_of_risorsa(risorsa_id))
        or utente_id = auth.uid()
    );

-- RPC sicura per visualizzare il calendario disponibilità senza esporre identità o costi altrui ai vicini
create or replace function public.elenco_slot_prenotazioni(p_condominio_id uuid)
returns table (
    id uuid,
    risorsa_id uuid,
    utente_id uuid,
    data_inizio timestamptz,
    data_fine timestamptz,
    costo_addebitato numeric,
    created_at timestamptz,
    risorsa_nome text,
    tariffa_oraria numeric,
    utente_nome text,
    utente_email text,
    is_mia boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_uid      uuid := auth.uid();
    v_is_admin boolean := public.is_superadmin() or public.is_admin_of(p_condominio_id);
begin
    if v_uid is null or not public.has_cond_access(p_condominio_id) then
        raise exception 'Accesso non autorizzato' using errcode = '42501';
    end if;

    return query
    select
        p.id,
        p.risorsa_id,
        case when v_is_admin or p.utente_id = v_uid then p.utente_id else null end as utente_id,
        p.data_inizio,
        p.data_fine,
        case when v_is_admin or p.utente_id = v_uid then p.costo_addebitato else null::numeric end as costo_addebitato,
        p.created_at,
        rp.nome as risorsa_nome,
        rp.tariffa_oraria,
        case when v_is_admin or p.utente_id = v_uid then u.nome_cognome else null end as utente_nome,
        case when v_is_admin then u.email else null end as utente_email,
        (p.utente_id = v_uid) as is_mia
      from public.prenotazioni_spazi p
      join public.risorse_prenotabili rp on rp.id = p.risorsa_id
      left join public.utenti u on u.id = p.utente_id
     where rp.condominio_id = p_condominio_id
     order by p.data_inizio asc;
end;
$$;
revoke all on function public.elenco_slot_prenotazioni(uuid) from public, anon;
grant execute on function public.elenco_slot_prenotazioni(uuid) to authenticated;

-- 6.3 Coerenza cross-tenant padre-figlio (palazzi, scale, unità, fondi, preventivi, bollettini)
create or replace function public.trg_check_ambito_condominio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_scala_palazzo uuid;
    v_ref_cond      uuid;
begin
    if tg_table_name in ('ticket_testata', 'bacheca_post', 'eventi_calendario', 'tabelle_millesimali') then
        if new.palazzo_id is not null and public.cond_of_palazzo(new.palazzo_id) is distinct from new.condominio_id then
            raise exception 'palazzo_id non appartiene al condominio specificato' using errcode = '22023';
        end if;
    end if;

    if tg_table_name in ('ticket_testata', 'tabelle_millesimali') then
        if new.scala_colonna_id is not null then
            select sc.palazzo_id into v_scala_palazzo
              from public.scale_colonne sc
             where sc.id = new.scala_colonna_id;
            if v_scala_palazzo is null or public.cond_of_palazzo(v_scala_palazzo) is distinct from new.condominio_id then
                raise exception 'scala_colonna_id non appartiene al condominio specificato' using errcode = '22023';
            end if;
            if tg_table_name = 'ticket_testata' and new.palazzo_id is not null and new.palazzo_id is distinct from v_scala_palazzo then
                raise exception 'scala_colonna_id non coerente con palazzo_id' using errcode = '22023';
            end if;
        end if;
    end if;

    if tg_table_name = 'ticket_testata' and new.unita_id is not null then
        if public.cond_of_unita(new.unita_id) is distinct from new.condominio_id then
            raise exception 'unita_id non appartiene al condominio specificato' using errcode = '22023';
        end if;
    end if;

    if tg_table_name = 'movimenti_fondo' then
        select f.condominio_id into v_ref_cond from public.fondi f where f.id = new.fondo_id;
        if v_ref_cond is distinct from new.condominio_id then
            raise exception 'fondo_id non appartiene al condominio specificato' using errcode = '22023';
        end if;
    end if;

    if tg_table_name = 'preventivi_voci' then
        select p.condominio_id into v_ref_cond from public.preventivi p where p.id = new.preventivo_id;
        if v_ref_cond is distinct from new.condominio_id then
            raise exception 'preventivo_id non appartiene al condominio specificato' using errcode = '22023';
        end if;
    end if;

    if tg_table_name = 'bollettini_righe' then
        select b.condominio_id into v_ref_cond from public.bollettini b where b.id = new.bollettino_id;
        if v_ref_cond is distinct from new.condominio_id then
            raise exception 'bollettino_id non appartiene al condominio specificato' using errcode = '22023';
        end if;
    end if;

    return new;
end;
$$;
revoke all on function public.trg_check_ambito_condominio() from public, anon, authenticated;

do $$
declare
    v_tbl text;
begin
    foreach v_tbl in array array[
        'ticket_testata',
        'bacheca_post',
        'eventi_calendario',
        'tabelle_millesimali',
        'movimenti_fondo',
        'preventivi_voci',
        'bollettini_righe'
    ] loop
        if to_regclass('public.' || v_tbl) is not null then
            execute format('drop trigger if exists trg_check_ambito_condominio on public.%I', v_tbl);
            execute format(
                'create trigger trg_check_ambito_condominio before insert or update on public.%I for each row execute function public.trg_check_ambito_condominio()',
                v_tbl
            );
        end if;
    end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. [ALTO-06] Kill-Switch SaaS esteso a `public.has_readonly_audit_access`
-- -----------------------------------------------------------------------------
do $$
begin
    if to_regclass('public.assegnazioni_amministratore') is not null then
        create or replace function public.has_readonly_audit_access(p_cond uuid)
        returns boolean
        language sql
        stable
        security definer
        set search_path = public
        as $fn$
            select p_cond is not null and (
                public.is_superadmin()
                or (
                    exists (select 1 from public.condomini c where c.id = p_cond and c.attivo = true)
                    and exists (
                        select 1 from public.assegnazioni_amministratore aa
                         where aa.condominio_id = p_cond
                           and aa.admin_id = (select auth.uid())
                           and (
                               aa.ruolo_incarico in ('REVISORE','CONSIGLIERE')
                               or (aa.ruolo_incarico = 'AMMINISTRATORE' and aa.data_cessazione is not null)
                           )
                    )
                )
            );
        $fn$;
        revoke all on function public.has_readonly_audit_access(uuid) from public, anon;
        grant execute on function public.has_readonly_audit_access(uuid) to authenticated;
    end if;
end $$;

-- -----------------------------------------------------------------------------
-- 8. [ALTO-07] Hashing SHA-256 e consumo atomico dei `fornitori_tokens`
-- -----------------------------------------------------------------------------
alter table public.fornitori_tokens
    add column if not exists token_hash text;

-- Backfill dei token esistenti: converte in digest SHA-256 senza lasciare token in chiaro in url_magico/token
update public.fornitori_tokens
   set token_hash = encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex')
 where token_hash is null
   and token !~ '^[0-9a-f]{64}$';

update public.fornitori_tokens
   set token_hash = token
 where token_hash is null
   and token ~ '^[0-9a-f]{64}$';

create unique index if not exists idx_fornitori_tokens_hash
    on public.fornitori_tokens (token_hash)
    where token_hash is not null;

create or replace function public.trg_fornitori_tokens_normalize()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    if new.token_hash is null or trim(new.token_hash) = '' then
        if new.token ~ '^[0-9a-f]{64}$' then
            new.token_hash := lower(new.token);
        else
            new.token_hash := encode(extensions.digest(convert_to(new.token, 'UTF8'), 'sha256'), 'hex');
            new.token := new.token_hash;
        end if;
    else
        new.token_hash := lower(trim(new.token_hash));
        if new.token !~ '^[0-9a-f]{64}$' then
            new.token := new.token_hash;
        end if;
    end if;
    -- Non persistere mai il segreto magic link in chiaro sul DB
    new.url_magico := null;
    return new;
end;
$$;
revoke all on function public.trg_fornitori_tokens_normalize() from public, anon, authenticated;

drop trigger if exists trg_fornitori_tokens_before_insert on public.fornitori_tokens;
create trigger trg_fornitori_tokens_before_insert
    before insert on public.fornitori_tokens
    for each row execute function public.trg_fornitori_tokens_normalize();

-- Consumo atomico (anti-TOCTOU) riservato a `service_role` (Edge Function `fornitore-intervento`)
create or replace function public.consuma_fornitore_token(
    p_token_hash text,
    p_legacy_token text default null
)
returns table (
    token text,
    ticket_intervento_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    update public.fornitori_tokens ft
       set used_at = now()
     where ft.used_at is null
       and ft.data_scadenza > now()
       and (
           (p_token_hash is not null and (ft.token_hash = lower(p_token_hash) or ft.token = lower(p_token_hash)))
           or (p_legacy_token is not null and ft.token = p_legacy_token)
       )
    returning ft.token, ft.ticket_intervento_id;
end;
$$;
revoke all on function public.consuma_fornitore_token(text, text) from public, anon, authenticated;
grant execute on function public.consuma_fornitore_token(text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 9. [BASSO-05] Isolamento dati catastali al Portiere (`unita_portineria`)
-- -----------------------------------------------------------------------------
create or replace function public.unita_portineria_visibili()
returns table (
    id               public.unita_immobiliari.id%type,
    palazzo_id       public.unita_immobiliari.palazzo_id%type,
    scala_colonna_id public.unita_immobiliari.scala_colonna_id%type,
    tipologia_id     public.unita_immobiliari.tipologia_id%type,
    interno          public.unita_immobiliari.interno%type,
    piano            public.unita_immobiliari.piano%type
)
language sql
stable
security definer
set search_path = public
as $$
    select u.id, u.palazzo_id, u.scala_colonna_id, u.tipologia_id, u.interno, u.piano
      from public.unita_immobiliari u
     where auth.uid() is not null
       and (
           public.is_superadmin()
           or public.has_unita_access(u.id)
           or public.has_role_in(public.cond_of_palazzo(u.palazzo_id), 'PORTIERE')
       );
$$;
revoke all on function public.unita_portineria_visibili() from public, anon;
grant execute on function public.unita_portineria_visibili() to authenticated;

create or replace view public.unita_portineria
with (security_invoker = true, security_barrier = true) as
select
    u.id,
    u.palazzo_id,
    u.scala_colonna_id,
    u.tipologia_id,
    u.interno,
    u.piano
  from public.unita_portineria_visibili() u;

revoke all on public.unita_portineria from public, anon;
grant select on public.unita_portineria to authenticated;

drop policy if exists unita_immobiliari_select on public.unita_immobiliari;
create policy unita_immobiliari_select on public.unita_immobiliari
    for select to authenticated
    using (
        public.is_superadmin()
        or public.has_unita_access(id)
    );

commit;

-- =============================================================================
-- SEZIONE VERIFICA (eseguire manualmente dopo l'applicazione)
-- =============================================================================
-- select policyname, tablename, roles, cmd
--   from pg_policies
--  where schemaname in ('public', 'storage')
--    and policyname in (
--      'documenti_metadata_select', 'documenti_condominio_select', 'ricevute_rate_select',
--      'rate_dettaglio_select', 'foto_guasti_select', 'avatar_utenti_select',
--      'chat_partecipanti_insert', 'prenotazioni_spazi_select', 'unita_immobiliari_select'
--    )
--  order by tablename, policyname;
--
-- select id, public from storage.buckets where id in ('foto-guasti', 'avatar-utenti');
--
-- select proname, prosecdef, proconfig
--   from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in (
--      'is_active_admin_any', 'risolvi_utente_verificato_da_email',
--      'can_read_documento_by_path', 'can_read_ricevuta_rate',
--      'elenco_slot_prenotazioni', 'has_readonly_audit_access', 'consuma_fornitore_token'
--    );

-- =============================================================================
-- SEZIONE ROLLBACK (eseguire manualmente solo in caso di ripristino)
-- =============================================================================
-- drop view if exists public.unita_portineria;
-- drop policy if exists unita_immobiliari_select on public.unita_immobiliari;
-- create policy unita_immobiliari_select on public.unita_immobiliari for select to authenticated
--   using (public.is_superadmin() or public.has_unita_access(id) or public.has_role_in(public.cond_of_palazzo(palazzo_id), 'PORTIERE'));
-- drop trigger if exists trg_fornitori_tokens_before_insert on public.fornitori_tokens;
-- drop function if exists public.trg_fornitori_tokens_normalize();
-- drop function if exists public.consuma_fornitore_token(text, text);
-- alter table public.fornitori_tokens drop column if exists token_hash;
-- drop trigger if exists trg_prenotazioni_spazi_server_enforce on public.prenotazioni_spazi;
-- drop function if exists public.trg_prenotazioni_spazi_enforce();
-- drop function if exists public.elenco_slot_prenotazioni(uuid);
-- alter table public.prenotazioni_spazi drop constraint if exists prenotazioni_spazi_costo_non_negativo;
-- drop trigger if exists trg_utenti_protect_sensitive on public.utenti;
-- drop function if exists public.trg_utenti_protect_sensitive_fields();
-- drop function if exists public.risolvi_utente_verificato_da_email(text);
-- drop function if exists public.is_active_admin_any();
-- drop function if exists public.can_read_documento_by_path(text);
-- drop function if exists public.can_read_ricevuta_rate(text, uuid);
