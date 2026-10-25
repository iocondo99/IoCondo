-- =====================================================================
-- 02_rls_policies.sql
-- Row Level Security multi-tenant per la Piattaforma Condominiale.
--
-- Modello di accesso:
--   * SuperAdmin (utenti.is_superadmin = true): bypass totale.
--   * Amministratore: condomini.admin_id = auth.uid() OPPURE ruolo ADMIN in utente_entita_ruolo.
--   * Condomino/Portiere: accesso limitato al Condominio / alla Unita' a cui e' associato tramite
--     utente_entita_ruolo (o anagrafiche_unita attiva).
--   * Il DEBITO segue la persona (rate_dettaglio.utente_id, solleciti_morosita.utente_id): un
--     subentrante NON vede debiti/solleciti del precedente proprietario (UC-11).
--
-- Le funzioni di lookup sono SECURITY DEFINER (bypassano la RLS) per evitare ricorsioni infinite.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FUNZIONI DI LOOKUP PERMESSI (SECURITY DEFINER, search_path bloccato)
-- ---------------------------------------------------------------------

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select coalesce((select u.is_superadmin from public.utenti u where u.id = auth.uid()), false);
$$;

-- Risolve gli ID dei condomini a cui un utente e' legato (admin, ruolo diretto, ruolo su unita', anagrafica attiva)
create or replace function public.user_condomini(p_uid uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
    select c.id from public.condomini c where c.admin_id = p_uid
    union
    select r.condominio_id from public.utente_entita_ruolo r
        where r.utente_id = p_uid and r.condominio_id is not null
    union
    select p.condominio_id
        from public.utente_entita_ruolo r
        join public.unita_immobiliari u on u.id = r.unita_id
        join public.palazzi p on p.id = u.palazzo_id
        where r.utente_id = p_uid and r.unita_id is not null
    union
    select p.condominio_id
        from public.anagrafiche_unita a
        join public.unita_immobiliari u on u.id = a.unita_id
        join public.palazzi p on p.id = u.palazzo_id
        where a.utente_id = p_uid and (a.data_fine is null or a.data_fine >= current_date);
$$;

create or replace function public.cond_of_palazzo(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.palazzi where id = p_id; $$;

create or replace function public.cond_of_unita(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select p.condominio_id from public.unita_immobiliari u join public.palazzi p on p.id = u.palazzo_id where u.id = p_id; $$;

create or replace function public.cond_of_esercizio(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.esercizi_contabili where id = p_id; $$;

create or replace function public.cond_of_piano_conto(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.piano_dei_conti where id = p_id; $$;

create or replace function public.cond_of_cartella(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.cartelle_documenti where id = p_id; $$;

create or replace function public.cond_of_documento(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select c.condominio_id from public.documenti_metadata d join public.cartelle_documenti c on c.id = d.cartella_id where d.id = p_id; $$;

create or replace function public.cond_of_ticket(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.ticket_testata where id = p_id; $$;

create or replace function public.cond_of_intervento(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select t.condominio_id from public.ticket_interventi i join public.ticket_testata t on t.id = i.ticket_id where i.id = p_id; $$;

create or replace function public.cond_of_post(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.bacheca_post where id = p_id; $$;

create or replace function public.cond_of_sondaggio(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.sondaggi where id = p_id; $$;

create or replace function public.cond_of_chat_room(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.chat_rooms where id = p_id; $$;

create or replace function public.cond_of_assemblea(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.assemblee_testata where id = p_id; $$;

create or replace function public.cond_of_punto_odg(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select a.condominio_id from public.assemblee_punti_odg o join public.assemblee_testata a on a.id = o.assemblea_id where o.id = p_id; $$;

create or replace function public.cond_of_risorsa(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.risorse_prenotabili where id = p_id; $$;

create or replace function public.cond_of_transazione(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from public.transazioni_bancarie where id = p_id; $$;

create or replace function public.cond_of_rata_dettaglio(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select public.cond_of_unita(unita_id) from public.rate_dettaglio where id = p_id; $$;

-- L'utente e' amministratore del condominio (o superadmin)?
create or replace function public.is_admin_of(p_cond uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or exists (select 1 from public.condomini c where c.id = p_cond and c.admin_id = auth.uid())
        or exists (
            select 1 from public.utente_entita_ruolo r
            join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
            where r.utente_id = auth.uid() and rp.codice = 'ADMIN' and r.condominio_id = p_cond)
    );
$$;

-- L'utente ha accesso (qualsiasi ruolo) al condominio?
create or replace function public.has_cond_access(p_cond uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or exists (select 1 from public.user_condomini(auth.uid()) x(id) where x.id = p_cond)
    );
$$;

-- L'utente ha un certo ruolo (CONDOMINO/ADMIN/PORTIERE) nel condominio?
create or replace function public.has_role_in(p_cond uuid, p_codice text)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and (
        public.is_superadmin()
        or (p_codice = 'ADMIN' and exists (select 1 from public.condomini c where c.id = p_cond and c.admin_id = auth.uid()))
        or exists (
            select 1 from public.utente_entita_ruolo r
            join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
            where r.utente_id = auth.uid() and rp.codice = p_codice
              and coalesce(r.condominio_id, public.cond_of_unita(r.unita_id)) = p_cond)
    );
$$;

-- L'utente ha accesso alla singola unita' immobiliare?
-- (admin del condominio, ruolo diretto sull'unita', oppure anagrafica ATTIVA: il subentrante vede solo il periodo corrente)
create or replace function public.has_unita_access(p_unita uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_unita is not null and (
        public.is_admin_of(public.cond_of_unita(p_unita))
        or exists (select 1 from public.utente_entita_ruolo r where r.utente_id = auth.uid() and r.unita_id = p_unita)
        or exists (select 1 from public.anagrafiche_unita a
                   where a.utente_id = auth.uid() and a.unita_id = p_unita
                     and (a.data_fine is null or a.data_fine >= current_date))
    );
$$;

-- L'amministratore ha una licenza SaaS attiva?
create or replace function public.has_active_license()
returns boolean
language sql stable security definer set search_path = public
as $$
    select public.is_superadmin() or exists (
        select 1 from public.licenze_saas l
        where l.admin_id = auth.uid() and l.is_active
          and (l.data_scadenza is null or l.data_scadenza >= current_date));
$$;

create or replace function public.is_chat_member(p_room uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select public.is_superadmin()
        or public.is_admin_of(public.cond_of_chat_room(p_room))
        or exists (select 1 from public.chat_partecipanti cp where cp.room_id = p_room and cp.utente_id = auth.uid());
$$;

-- Drive condominiale: documenti pubblici (nessun permesso esplicito) vs privati (permessi per ruolo/utente)
create or replace function public.can_read_documento(p_doc uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
    v_cond  uuid;
    v_unita uuid;
begin
    select c.condominio_id, d.unita_id into v_cond, v_unita
    from public.documenti_metadata d join public.cartelle_documenti c on c.id = d.cartella_id
    where d.id = p_doc;
    if v_cond is null then return false; end if;
    if public.is_admin_of(v_cond) then return true; end if;
    if not public.has_cond_access(v_cond) then return false; end if;
    if v_unita is not null and not public.has_unita_access(v_unita) then return false; end if;
    if not exists (select 1 from public.documenti_permessi where documento_id = p_doc) then return true; end if;
    return exists (
        select 1 from public.documenti_permessi dp
        where dp.documento_id = p_doc
          and (dp.utente_target_id = auth.uid()
               or exists (
                   select 1 from public.utente_entita_ruolo r
                   where r.utente_id = auth.uid() and r.ruolo_id = dp.ruolo_target_id
                     and coalesce(r.condominio_id, public.cond_of_unita(r.unita_id)) = v_cond))
    );
end;
$$;

-- Votazioni assemblea: i vicini vedono SOLO percentuali aggregate (UC-10)
create or replace function public.risultati_voto(p_punto uuid)
returns table (voto text, n_voti bigint, percentuale numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
    if not public.has_cond_access(public.cond_of_punto_odg(p_punto)) then
        raise exception 'Accesso negato' using errcode = '42501';
    end if;
    return query
        select v.voto, count(*)::bigint,
               round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1)
        from public.assemblee_voti v
        where v.punto_odg_id = p_punto
        group by v.voto;
end;
$$;

-- Permessi di esecuzione: solo utenti autenticati
do $$
declare f record;
begin
    for f in
        select p.oid::regprocedure as sig
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('is_superadmin','user_condomini','is_admin_of','has_cond_access','has_role_in',
                            'has_unita_access','has_active_license','is_chat_member','can_read_documento',
                            'risultati_voto')
             or (n.nspname = 'public' and p.proname like 'cond\_of\_%')
    loop
        execute format('revoke all on function %s from public, anon', f.sig);
        execute format('grant execute on function %s to authenticated', f.sig);
    end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. POLICY: utenti (regole dedicate)
-- ---------------------------------------------------------------------

drop policy if exists utenti_select on public.utenti;
drop policy if exists utenti_insert on public.utenti;
drop policy if exists utenti_update on public.utenti;
drop policy if exists utenti_delete on public.utenti;

-- Vedo me stesso e chi condivide almeno un condominio con me
create policy utenti_select on public.utenti for select to authenticated
using (
    public.is_superadmin()
    or id = auth.uid()
    or exists (select 1 from public.user_condomini(utenti.id) x(cid) where public.has_cond_access(x.cid))
);
-- L'inserimento avviene dal trigger su auth.users (SECURITY DEFINER); da client solo il superadmin
create policy utenti_insert on public.utenti for insert to authenticated
with check (public.is_superadmin());
-- Aggiorno il mio profilo, ma non posso auto-promuovermi superadmin
create policy utenti_update on public.utenti for update to authenticated
using (public.is_superadmin() or id = auth.uid())
with check (public.is_superadmin() or (id = auth.uid() and is_superadmin = false));
create policy utenti_delete on public.utenti for delete to authenticated
using (public.is_superadmin());

-- ---------------------------------------------------------------------
-- 3. POLICY: generazione SELECT / INSERT / UPDATE / DELETE separate per tabella
--    Parametri per riga: tabella, espressione SELECT, INSERT (with check),
--    UPDATE (using + with check), DELETE (using).
--    Il superadmin e' sempre incluso (bypass).
-- ---------------------------------------------------------------------

do $policies$
declare
    r record;
begin
    for r in
        select * from (values
        -- ===== Core SaaS =====
        ('piani_abbonamento',   $p$ true $p$, $p$ false $p$, $p$ false $p$, $p$ false $p$),
        ('licenze_saas',        $p$ admin_id = auth.uid() $p$, $p$ false $p$, $p$ false $p$, $p$ false $p$),
        ('fatture_saas',        $p$ admin_id = auth.uid() $p$, $p$ false $p$, $p$ false $p$, $p$ false $p$),
        ('ruoli_piattaforma',   $p$ true $p$, $p$ false $p$, $p$ false $p$, $p$ false $p$),
        ('tipologie_unita',     $p$ true $p$, $p$ false $p$, $p$ false $p$, $p$ false $p$),
        ('categorie_guasti',    $p$ true $p$, $p$ false $p$, $p$ false $p$, $p$ false $p$),
        ('utente_entita_ruolo',
            $p$ utente_id = auth.uid() or public.is_admin_of(coalesce(condominio_id, public.cond_of_unita(unita_id))) $p$,
            $p$ public.is_admin_of(coalesce(condominio_id, public.cond_of_unita(unita_id))) $p$,
            $p$ public.is_admin_of(coalesce(condominio_id, public.cond_of_unita(unita_id))) $p$,
            $p$ public.is_admin_of(coalesce(condominio_id, public.cond_of_unita(unita_id))) $p$),
        ('inviti_pendenti',
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('audit_logs',          $p$ false $p$, $p$ utente_id = auth.uid() $p$, $p$ false $p$, $p$ false $p$),
        ('dispositivi_push',
            $p$ utente_id = auth.uid() $p$, $p$ utente_id = auth.uid() $p$, $p$ utente_id = auth.uid() $p$, $p$ utente_id = auth.uid() $p$),
        ('notifiche',
            $p$ utente_id = auth.uid() $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ utente_id = auth.uid() $p$, $p$ utente_id = auth.uid() $p$),

        -- ===== Gerarchia spaziale =====
        ('condomini',
            $p$ public.has_cond_access(id) $p$,
            $p$ admin_id = auth.uid() and public.has_active_license() $p$,
            $p$ public.is_admin_of(id) $p$,
            $p$ admin_id = auth.uid() $p$),
        ('configurazioni_condominio',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('palazzi',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('scale_colonne',
            $p$ public.has_cond_access(public.cond_of_palazzo(palazzo_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_palazzo(palazzo_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_palazzo(palazzo_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_palazzo(palazzo_id)) $p$),
        ('unita_immobiliari',
            $p$ public.has_unita_access(id) or public.has_role_in(public.cond_of_palazzo(palazzo_id), 'PORTIERE') $p$,
            $p$ public.is_admin_of(public.cond_of_palazzo(palazzo_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_palazzo(palazzo_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_palazzo(palazzo_id)) $p$),
        ('anagrafiche_unita',
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$),

        -- ===== Fornitori e Drive =====
        ('fornitori',
            $p$ admin_id = auth.uid() $p$, $p$ admin_id = auth.uid() $p$, $p$ admin_id = auth.uid() $p$, $p$ admin_id = auth.uid() $p$),
        ('cartelle_documenti',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('documenti_metadata',
            $p$ public.can_read_documento(id) $p$,
            $p$ public.is_admin_of(public.cond_of_cartella(cartella_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_cartella(cartella_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_cartella(cartella_id)) $p$),
        ('documenti_permessi',
            $p$ public.is_admin_of(public.cond_of_documento(documento_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_documento(documento_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_documento(documento_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_documento(documento_id)) $p$),

        -- ===== Contabilita' =====
        ('piano_dei_conti',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('sottoconti',
            $p$ public.has_cond_access(public.cond_of_piano_conto(piano_conto_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_piano_conto(piano_conto_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_piano_conto(piano_conto_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_piano_conto(piano_conto_id)) $p$),
        ('esercizi_contabili',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('tabelle_millesimali',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('quote_millesimali',
            $p$ public.has_unita_access(unita_id) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$),
        ('movimenti_contabili',
            $p$ public.has_cond_access(public.cond_of_esercizio(esercizio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_esercizio(esercizio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_esercizio(esercizio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_esercizio(esercizio_id)) $p$),
        ('rate_testata',
            $p$ public.is_admin_of(public.cond_of_esercizio(esercizio_id))
                or (pubblicata and public.has_cond_access(public.cond_of_esercizio(esercizio_id))) $p$,
            $p$ public.is_admin_of(public.cond_of_esercizio(esercizio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_esercizio(esercizio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_esercizio(esercizio_id)) $p$),
        ('rate_dettaglio',
            $p$ public.is_admin_of(public.cond_of_unita(unita_id))
                or utente_id = auth.uid()
                or (utente_id is null and public.has_unita_access(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$),
        ('saldi_pregressi',
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$),
        -- pagamenti in-app: il condomino puo' avviare un pagamento (IN_ATTESA) solo su una rata che vede;
        -- la conferma/esito arriva dal webhook provider (service_role) o dall'admin
        ('pagamenti_rate',
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_rata_dettaglio(rata_dettaglio_id)) $p$,
            $p$ (utente_id = auth.uid() and stato = 'IN_ATTESA'
                 and exists (select 1 from public.rate_dettaglio r where r.id = rata_dettaglio_id))
                or public.is_admin_of(public.cond_of_rata_dettaglio(rata_dettaglio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_rata_dettaglio(rata_dettaglio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_rata_dettaglio(rata_dettaglio_id)) $p$),
        ('transazioni_bancarie',
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('riconciliazioni_log',
            $p$ public.is_admin_of(public.cond_of_transazione(transazione_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_transazione(transazione_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_transazione(transazione_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_transazione(transazione_id)) $p$),
        ('solleciti_morosita',
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$),
        ('polizze_assicurative',
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('f24_generati',
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('fatture_sdi_inbound',
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),

        -- ===== Ticketing =====
        ('ticket_testata',
            $p$ public.is_admin_of(condominio_id)
                or segnalatore_id = auth.uid()
                or public.has_role_in(condominio_id, 'PORTIERE')
                or (unita_id is not null and public.has_unita_access(unita_id)) $p$,
            $p$ segnalatore_id = auth.uid()
                and public.has_cond_access(condominio_id)
                and (unita_id is null or public.has_unita_access(unita_id)) $p$,
            $p$ public.is_admin_of(condominio_id) or segnalatore_id = auth.uid() $p$,
            $p$ public.is_admin_of(condominio_id) $p$),
        ('ticket_messaggi',
            $p$ exists (select 1 from public.ticket_testata t where t.id = ticket_id) $p$,
            $p$ mittente_id = auth.uid() and exists (select 1 from public.ticket_testata t where t.id = ticket_id) $p$,
            $p$ mittente_id = auth.uid() or public.is_admin_of(public.cond_of_ticket(ticket_id)) $p$,
            $p$ mittente_id = auth.uid() or public.is_admin_of(public.cond_of_ticket(ticket_id)) $p$),
        ('ticket_allegati',
            $p$ exists (select 1 from public.ticket_testata t where t.id = ticket_id) $p$,
            $p$ caricato_da = auth.uid() and exists (select 1 from public.ticket_testata t where t.id = ticket_id) $p$,
            $p$ caricato_da = auth.uid() or public.is_admin_of(public.cond_of_ticket(ticket_id)) $p$,
            $p$ caricato_da = auth.uid() or public.is_admin_of(public.cond_of_ticket(ticket_id)) $p$),
        ('ticket_interventi',
            $p$ public.is_admin_of(public.cond_of_ticket(ticket_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_ticket(ticket_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_ticket(ticket_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_ticket(ticket_id)) $p$),
        -- Magic link fornitore: validati lato server (service_role / Edge Function), nessun accesso client tranne admin
        ('fornitori_tokens',
            $p$ public.is_admin_of(public.cond_of_intervento(ticket_intervento_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_intervento(ticket_intervento_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_intervento(ticket_intervento_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_intervento(ticket_intervento_id)) $p$),

        -- ===== Comunicazione =====
        ('bacheca_post',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('bacheca_commenti',
            $p$ public.has_cond_access(public.cond_of_post(post_id)) $p$,
            $p$ autore_id = auth.uid() and public.has_cond_access(public.cond_of_post(post_id)) $p$,
            $p$ autore_id = auth.uid() or public.is_admin_of(public.cond_of_post(post_id)) $p$,
            $p$ autore_id = auth.uid() or public.is_admin_of(public.cond_of_post(post_id)) $p$),
        ('sondaggi',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('sondaggi_opzioni',
            $p$ public.has_cond_access(public.cond_of_sondaggio(sondaggio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_sondaggio(sondaggio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_sondaggio(sondaggio_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_sondaggio(sondaggio_id)) $p$),
        ('sondaggi_voti',
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_sondaggio(sondaggio_id)) $p$,
            $p$ utente_id = auth.uid() and public.has_cond_access(public.cond_of_sondaggio(sondaggio_id)) $p$,
            $p$ utente_id = auth.uid() $p$, $p$ utente_id = auth.uid() $p$),
        ('chat_rooms',
            $p$ public.is_chat_member(id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('chat_partecipanti',
            $p$ utente_id = auth.uid() or public.is_chat_member(room_id) $p$,
            $p$ public.is_admin_of(public.cond_of_chat_room(room_id))
                or (utente_id = auth.uid() and public.has_cond_access(public.cond_of_chat_room(room_id))) $p$,
            $p$ public.is_admin_of(public.cond_of_chat_room(room_id)) $p$,
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_chat_room(room_id)) $p$),
        ('chat_messaggi',
            $p$ public.is_chat_member(room_id) $p$,
            $p$ mittente_id = auth.uid() and public.is_chat_member(room_id) $p$,
            $p$ mittente_id = auth.uid() or public.is_admin_of(public.cond_of_chat_room(room_id)) $p$,
            $p$ mittente_id = auth.uid() or public.is_admin_of(public.cond_of_chat_room(room_id)) $p$),
        ('eventi_calendario',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('raccolta_differenziata',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),

        -- ===== Assemblee e servizi =====
        ('assemblee_testata',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('assemblee_punti_odg',
            $p$ public.has_cond_access(public.cond_of_assemblea(assemblea_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_assemblea(assemblea_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_assemblea(assemblea_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_assemblea(assemblea_id)) $p$),
        -- voto: leggo solo il mio (i vicini usano risultati_voto() con le percentuali); l'admin vede il report completo
        ('assemblee_voti',
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_punto_odg(punto_odg_id)) $p$,
            $p$ utente_id = auth.uid()
                and public.has_unita_access(unita_id)
                and exists (select 1 from public.assemblee_punti_odg o where o.id = punto_odg_id and o.votazione_aperta) $p$,
            $p$ utente_id = auth.uid()
                and exists (select 1 from public.assemblee_punti_odg o where o.id = punto_odg_id and o.votazione_aperta) $p$,
            $p$ public.is_admin_of(public.cond_of_punto_odg(punto_odg_id)) $p$),
        ('registro_pacchi',
            $p$ public.is_admin_of(condominio_id) or public.has_role_in(condominio_id, 'PORTIERE')
                or public.has_unita_access(unita_destinazione_id) $p$,
            $p$ public.is_admin_of(condominio_id) or public.has_role_in(condominio_id, 'PORTIERE') $p$,
            $p$ public.is_admin_of(condominio_id) or public.has_role_in(condominio_id, 'PORTIERE') $p$,
            $p$ public.is_admin_of(condominio_id) $p$),
        ('risorse_prenotabili',
            $p$ public.has_cond_access(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$,
            $p$ public.is_admin_of(condominio_id) $p$, $p$ public.is_admin_of(condominio_id) $p$),
        ('prenotazioni_spazi',
            $p$ public.has_cond_access(public.cond_of_risorsa(risorsa_id)) $p$,
            $p$ utente_id = auth.uid() and public.has_cond_access(public.cond_of_risorsa(risorsa_id)) $p$,
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_risorsa(risorsa_id)) $p$,
            $p$ utente_id = auth.uid() or public.is_admin_of(public.cond_of_risorsa(risorsa_id)) $p$),
        -- storico immobile (UC-11): il subentrante vede solo eventi PUBBLICI (guasti, ricevute generiche)
        ('log_storico_immobile',
            $p$ public.is_admin_of(public.cond_of_unita(unita_id))
                or (visibilita = 'PUBBLICO' and public.has_unita_access(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$,
            $p$ public.is_admin_of(public.cond_of_unita(unita_id)) $p$)
        ) as v(tbl, sel_expr, ins_expr, upd_expr, del_expr)
    loop
        execute format('drop policy if exists %I on public.%I', r.tbl || '_select', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_insert', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_update', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_delete', r.tbl);

        execute format($f$create policy %I on public.%I for select to authenticated
                          using (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_select', r.tbl, r.sel_expr);
        execute format($f$create policy %I on public.%I for insert to authenticated
                          with check (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_insert', r.tbl, r.ins_expr);
        execute format($f$create policy %I on public.%I for update to authenticated
                          using (public.is_superadmin() or (%s))
                          with check (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_update', r.tbl, r.upd_expr, r.upd_expr);
        execute format($f$create policy %I on public.%I for delete to authenticated
                          using (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_delete', r.tbl, r.del_expr);
    end loop;
end
$policies$;
