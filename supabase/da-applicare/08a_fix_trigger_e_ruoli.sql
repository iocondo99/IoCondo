-- =====================================================================
-- 08a_fix_trigger_e_ruoli.sql
-- Correzioni di sicurezza da applicare PRIMA di 08_inviti_sicuri.sql.
-- Non eseguire nulla finché non lo si esegue a mano dal SQL Editor.
-- =====================================================================
-- Cosa corregge (revisione di sicurezza del 2026-11-02):
--  a) handle_user_confirmed: non aveva handler -> un errore di applica_inviti
--     avrebbe annullato l'UPDATE di email_confirmed_at, bloccando la conferma
--     email e il login. Ora applica_inviti e' isolato in un sotto-blocco che
--     registra solo un warning: la conferma email e il login vanno comunque
--     a buon fine.
--  b) handle_new_user: il handler rilanciava un'eccezione -> bloccava la
--     registrazione. Ora la sola chiamata ad applica_inviti e' isolata con
--     warning; l'inserimento del profilo in utenti resta nel blocco
--     principale (scelta spiegata sotto).
--  c) utente_entita_ruolo_insert/update: il ruolo ADMIN puo' ora essere
--     assegnato solo da un super admin (policy + helper ruolo_non_admin).
--     Le funzioni SECURITY DEFINER (applica_inviti, crea_invito) e gli script
--     seed-dev girano come postgres e bypassano la RLS, quindi non sono
--     influenzati.
--  d) Ogni funzione modificata ha search_path fisso; nessun RAISE EXCEPTION
--     nei trigger di auth (solo RAISE WARNING).
--
-- Scelta per handle_new_user (3 righe): l'inserimento del profilo in
-- public.utenti non ha percorsi di errore realistici (nessuna FK in uscita,
-- nessun NOT NULL senza default, nessun trigger BEFORE INSERT), quindi lo
-- si lascia nel blocco principale senza handler: se fallisse (caso
-- catastrofico) l'intera INSERT su auth.users verrebbe annullata, evitando
-- un utente auth senza profilo; l'unica parte "best effort" (applica_inviti)
-- e' isolata in un sotto-blocco con warning, cosi' non blocca mai un accesso.
-- =====================================================================

begin;

-- ---------------------------------------------------------------- a) handle_user_confirmed
-- applica_inviti isolato: un suo errore non blocca la conferma email.
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if old.email_confirmed_at is null and new.email_confirmed_at is not null then
        begin
            perform public.applica_inviti(new.id, new.email);
        exception when others then
            raise warning 'handle_user_confirmed: applica_inviti fallita per %: % (%)',
                new.id, sqlerrm, sqlstate;
        end;
    end if;
    return new;
end $$;
revoke all on function public.handle_user_confirmed() from public, anon, authenticated;

-- ---------------------------------------------------------------- b) handle_new_user
-- Solo applica_inviti e' best effort; il profilo in utenti resta atomico.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
    insert into public.utenti (id, email, nome_cognome, telefono, avatar_url)
    values (new.id, new.email,
            coalesce(nullif(v_meta ->> 'nome_cognome',''), nullif(v_meta ->> 'full_name',''), nullif(v_meta ->> 'name','')),
            coalesce(nullif(new.phone,''), nullif(v_meta ->> 'telefono','')),
            coalesce(nullif(v_meta ->> 'avatar_url',''), nullif(v_meta ->> 'picture','')))
    on conflict (id) do update set email = excluded.email;

    if new.email_confirmed_at is not null then
        begin
            perform public.applica_inviti(new.id, new.email);
        exception when others then
            raise warning 'handle_new_user: applica_inviti fallita per %: % (%)',
                new.id, sqlerrm, sqlstate;
        end;
    end if;
    return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- c) helper ruolo_non_admin
-- Restituisce TRUE se il ruolo passato NON e' ADMIN (o se l'id non esiste).
-- Usata dalle policy di utente_entita_ruolo per riservare ADMIN al super admin.
-- SECURITY DEFINER, search_path fisso, revocata a public/anon, concessa a authenticated.
create or replace function public.ruolo_non_admin(p_ruolo uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select not exists (
        select 1 from public.ruoli_piattaforma rp
        where rp.id = p_ruolo and rp.codice = 'ADMIN'
    );
$$;
revoke all on function public.ruolo_non_admin(uuid) from public, anon;
grant execute on function public.ruolo_non_admin(uuid) to authenticated;

-- ---------------------------------------------------------------- c) policy: ADMIN riservato al super admin
-- INSERT: un admin non-super puo' inserire solo ruoli non-ADMIN nei propri condomini.
drop policy if exists utente_entita_ruolo_insert on public.utente_entita_ruolo;
create policy utente_entita_ruolo_insert on public.utente_entita_ruolo
    for insert to authenticated
    with check (
        is_superadmin()
        or (
            is_admin_of(coalesce(condominio_id, cond_of_unita(unita_id)))
            and public.ruolo_non_admin(ruolo_id)
        )
    );

-- UPDATE: un admin non-super puo' modificare righe dei propri condomini ma non
-- impostare ruolo_id = ADMIN (la with check lo vieta).
drop policy if exists utente_entita_ruolo_update on public.utente_entita_ruolo;
create policy utente_entita_ruolo_update on public.utente_entita_ruolo
    for update to authenticated
    using  (is_superadmin() or is_admin_of(coalesce(condominio_id, cond_of_unita(unita_id))))
    with check (
        is_superadmin()
        or (
            is_admin_of(coalesce(condominio_id, cond_of_unita(unita_id)))
            and public.ruolo_non_admin(ruolo_id)
        )
    );

commit;
