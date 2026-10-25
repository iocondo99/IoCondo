-- =====================================================================
-- 05_security_hardening.sql
-- Hardening di sicurezza, isolamento multi-tenant, privacy PII,
-- storico immobile automatico, audit logs, portineria e storage.
-- =====================================================================

set search_path = public, extensions;

-- 1. Helper privati (non esposti come RPC pubbliche PostgREST)
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.user_condomini(p_uid uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
    select c.id from public.condomini c where c.admin_id = p_uid
    union
    select r.condominio_id from public.utente_entita_ruolo r
      where r.utente_id = p_uid and r.condominio_id is not null
    union
    -- Subentro (UC-11): il ruolo sull'unità non deve prevalere se esiste uno storico di anagrafica chiuso
    select p.condominio_id
      from public.utente_entita_ruolo r
      join public.unita_immobiliari u on u.id = r.unita_id
      join public.palazzi p on p.id = u.palazzo_id
     where r.utente_id = p_uid and r.unita_id is not null
       and not exists (select 1 from public.anagrafiche_unita a where a.utente_id = r.utente_id and a.unita_id = r.unita_id)
    union
    select p.condominio_id
      from public.anagrafiche_unita a
      join public.unita_immobiliari u on u.id = a.unita_id
      join public.palazzi p on p.id = u.palazzo_id
     where a.utente_id = p_uid and (a.data_fine is null or a.data_fine >= current_date);
$$;
revoke all on function private.user_condomini(uuid) from public, anon;
grant execute on function private.user_condomini(uuid) to authenticated;

-- Aggiorna has_cond_access per usare private.user_condomini
create or replace function public.has_cond_access(p_cond uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select p_cond is not null and (public.is_superadmin()
        or exists (select 1 from private.user_condomini(auth.uid()) x(id) where x.id = p_cond));
$$;

-- Subentro (UC-11): has_unita_access revoca l'accesso se l'anagrafica è chiusa
create or replace function public.has_unita_access(p_unita uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select p_unita is not null and (
        public.is_admin_of(public.cond_of_unita(p_unita))
        or exists (select 1 from public.anagrafiche_unita a
                    where a.utente_id = auth.uid() and a.unita_id = p_unita
                      and (a.data_fine is null or a.data_fine >= current_date))
        or (exists (select 1 from public.utente_entita_ruolo r where r.utente_id = auth.uid() and r.unita_id = p_unita)
            and not exists (select 1 from public.anagrafiche_unita a where a.utente_id = auth.uid() and a.unita_id = p_unita))
    );
$$;

-- 2. Privacy dei vicini (PII) e aggiornamento policy utenti (rimuove dipendenza da public.user_condomini)
drop policy if exists utenti_select on public.utenti;
create policy utenti_select on public.utenti for select to authenticated
using (
    public.is_superadmin() or id = auth.uid()
    or exists (select 1 from private.user_condomini(utenti.id) x(cid) where public.is_admin_of(x.cid))
);

-- Rimuovi la vecchia funzione pubblica insicura se esistente
drop function if exists public.user_condomini(uuid) cascade;

create or replace view public.profili_pubblici as
select u.id, u.nome_cognome, u.avatar_url
from public.utenti u
where u.id = auth.uid()
   or exists (select 1 from private.user_condomini(u.id) x(cid) where public.has_cond_access(x.cid));
revoke all on public.profili_pubblici from anon;
grant select on public.profili_pubblici to authenticated;

-- 3. Portiere: nessun accesso contabile e solo ticket aree comuni
create or replace function public.is_portiere_only(p_cond uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select public.has_role_in(p_cond, 'PORTIERE')
       and not public.is_admin_of(p_cond)
       and not exists (select 1 from public.utente_entita_ruolo r
                        join public.ruoli_piattaforma rp on rp.id = r.ruolo_id
                       where r.utente_id = auth.uid() and rp.codice = 'CONDOMINO'
                         and coalesce(r.condominio_id, public.cond_of_unita(r.unita_id)) = p_cond)
       and not exists (select 1 from public.anagrafiche_unita a
                        where a.utente_id = auth.uid() and (a.data_fine is null or a.data_fine >= current_date)
                          and public.cond_of_unita(a.unita_id) = p_cond);
$$;
revoke all on function public.is_portiere_only(uuid) from public, anon;
grant execute on function public.is_portiere_only(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['piano_dei_conti','esercizi_contabili','tabelle_millesimali'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format($f$create policy %I on public.%I for select to authenticated
        using (public.is_superadmin() or (public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id)))$f$,
        t||'_select', t);
  end loop;
end $$;

drop policy if exists movimenti_contabili_select on public.movimenti_contabili;
create policy movimenti_contabili_select on public.movimenti_contabili for select to authenticated
using (public.is_superadmin() or (public.has_cond_access(public.cond_of_esercizio(esercizio_id))
       and not public.is_portiere_only(public.cond_of_esercizio(esercizio_id))));

drop policy if exists sottoconti_select on public.sottoconti;
create policy sottoconti_select on public.sottoconti for select to authenticated
using (public.is_superadmin() or (public.has_cond_access(public.cond_of_piano_conto(piano_conto_id))
       and not public.is_portiere_only(public.cond_of_piano_conto(piano_conto_id))));

drop policy if exists ticket_testata_select on public.ticket_testata;
create policy ticket_testata_select on public.ticket_testata for select to authenticated
using (public.is_superadmin()
    or public.is_admin_of(condominio_id)
    or segnalatore_id = auth.uid()
    or (is_area_comune and public.has_role_in(condominio_id, 'PORTIERE'))
    or (unita_id is not null and public.has_unita_access(unita_id)));

-- 4. Scritture coerenti (nessun incrocio cross-tenant tra padre e figlio)
create or replace function public.cond_of_rata_testata(p_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
    select e.condominio_id from public.rate_testata t join public.esercizi_contabili e on e.id = t.esercizio_id where t.id = p_id; $$;
create or replace function public.cond_of_tabella_mill(p_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
    select condominio_id from public.tabelle_millesimali where id = p_id; $$;
revoke all on function public.cond_of_rata_testata(uuid), public.cond_of_tabella_mill(uuid) from public, anon;
grant execute on function public.cond_of_rata_testata(uuid), public.cond_of_tabella_mill(uuid) to authenticated;

do $$
declare r record;
begin
  for r in select * from (values
    ('rate_dettaglio',  $p$ public.is_admin_of(public.cond_of_unita(unita_id))
                           and public.cond_of_unita(unita_id) = public.cond_of_rata_testata(rata_testata_id) $p$),
    ('quote_millesimali',$p$ public.is_admin_of(public.cond_of_unita(unita_id))
                           and public.cond_of_unita(unita_id) = public.cond_of_tabella_mill(tabella_id) $p$),
    ('rate_testata',    $p$ public.is_admin_of(public.cond_of_esercizio(esercizio_id))
                           and (tabella_millesimale_id is null
                                or public.cond_of_tabella_mill(tabella_millesimale_id) = public.cond_of_esercizio(esercizio_id)) $p$)
  ) as v(tbl, expr) loop
    execute format('drop policy if exists %I on public.%I', r.tbl||'_insert', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl||'_update', r.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_superadmin() or (%s))', r.tbl||'_insert', r.tbl, r.expr);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_superadmin() or (%s)) with check (public.is_superadmin() or (%s))', r.tbl||'_update', r.tbl, r.expr, r.expr);
  end loop;
end $$;

-- 5. Audit logs sicuro e trigger automatico
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert to authenticated with check (public.is_superadmin());

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
revoke all on function public.audit_row_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['condomini','utente_entita_ruolo','anagrafiche_unita','rate_testata','rate_dettaglio','pagamenti_rate'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- 6. Storico immobile popolato da trigger
create or replace function public.log_storico_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.unita_id is not null then
        insert into public.log_storico_immobile (unita_id, tipo_evento, descrizione, visibilita)
        values (new.unita_id, 'GUASTO', 'Ticket: ' || new.titolo, 'PUBBLICO');
    end if;
    return new;
end $$;
drop trigger if exists trg_log_storico_ticket on public.ticket_testata;
create trigger trg_log_storico_ticket after insert on public.ticket_testata
    for each row execute function public.log_storico_ticket();

create or replace function public.log_storico_subentro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.log_storico_immobile (unita_id, tipo_evento, descrizione, visibilita)
    values (new.unita_id, 'SUBENTRO', 'Nuovo ' || lower(new.tipo_possesso) || ' dal ' || new.data_inizio, 'PUBBLICO');
    return new;
end $$;
drop trigger if exists trg_log_storico_subentro on public.anagrafiche_unita;
create trigger trg_log_storico_subentro after insert on public.anagrafiche_unita
    for each row execute function public.log_storico_subentro();

-- 7. Protezione rate pagate da cancellazione
create or replace function public.block_delete_rate_pagate() returns trigger
language plpgsql set search_path = public as $$
begin
    if old.importo_pagato > 0 or old.stato = 'PAGATO' then
        raise exception 'Rata % gia'' incassata: non cancellabile', old.id using errcode = '23503';
    end if;
    return old;
end $$;
drop trigger if exists trg_block_delete_rate_pagate on public.rate_dettaglio;
create trigger trg_block_delete_rate_pagate before delete on public.rate_dettaglio
    for each row execute function public.block_delete_rate_pagate();

-- 8. Indici per performance RLS e Join
create index if not exists idx_anag_utente_attive on public.anagrafiche_unita (utente_id, unita_id) where data_fine is null;
create index if not exists idx_unita_tipologia      on public.unita_immobiliari (tipologia_id);
create index if not exists idx_tabmill_palazzo      on public.tabelle_millesimali (palazzo_id);
create index if not exists idx_tabmill_scala        on public.tabelle_millesimali (scala_colonna_id);
create index if not exists idx_ratetestata_tabella  on public.rate_testata (tabella_millesimale_id);
create index if not exists idx_movimenti_fornitore  on public.movimenti_contabili (fornitore_id);
create index if not exists idx_saldi_unita          on public.saldi_pregressi (unita_id);
create index if not exists idx_saldi_utente         on public.saldi_pregressi (utente_id);
create index if not exists idx_pagamenti_utente     on public.pagamenti_rate (utente_id);
create index if not exists idx_solleciti_rata       on public.solleciti_morosita (rata_dettaglio_id);
create index if not exists idx_ticket_categoria     on public.ticket_testata (categoria_id);
create index if not exists idx_ticketmsg_mittente   on public.ticket_messaggi (mittente_id);
create index if not exists idx_bacheca_palazzo      on public.bacheca_post (palazzo_id);
create index if not exists idx_sondaggi_condominio  on public.sondaggi (condominio_id);
create index if not exists idx_sondvoti_opzione     on public.sondaggi_voti (opzione_id);
create index if not exists idx_voti_unita           on public.assemblee_voti (unita_id);
create index if not exists idx_voti_utente          on public.assemblee_voti (utente_id);
create index if not exists idx_uer_ruolo            on public.utente_entita_ruolo (ruolo_id);
create index if not exists idx_notifiche_cond       on public.notifiche (condominio_id);
create index if not exists idx_licenze_piano        on public.licenze_saas (piano_id);
create index if not exists idx_docperm_utente       on public.documenti_permessi (utente_target_id);
create index if not exists idx_docperm_ruolo        on public.documenti_permessi (ruolo_target_id);

-- 9. Conversione automatica inviti e trigger user
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

create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if old.email_confirmed_at is null and new.email_confirmed_at is not null then
        perform public.applica_inviti(new.id, new.email);
    end if;
    return new;
end $$;
revoke all on function public.handle_user_confirmed() from public, anon, authenticated;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
    for each row execute function public.handle_user_confirmed();

-- 10. Funzione atomica completamento pagamento per Stripe
create or replace function public.pagamento_completato(p_provider_ref text, p_importo numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pag public.pagamenti_rate; v_rata public.rate_dettaglio;
begin
    update public.pagamenti_rate set stato = 'COMPLETATO', completed_at = now(), importo = p_importo
     where provider = 'STRIPE' and provider_ref = p_provider_ref and stato = 'IN_ATTESA'
    returning * into v_pag;
    if not found then return jsonb_build_object('esito', 'ignorato'); end if;

    update public.rate_dettaglio
       set importo_pagato = importo_pagato + p_importo,
           stato = case when importo_pagato + p_importo >= importo_dovuto - 0.005 then 'PAGATO' else stato end,
           data_pagamento = case when importo_pagato + p_importo >= importo_dovuto - 0.005 then current_date else data_pagamento end
     where id = v_pag.rata_dettaglio_id
    returning * into v_rata;
    return jsonb_build_object('esito','completato','stato',v_rata.stato,'importo_pagato',v_rata.importo_pagato);
end $$;
revoke all on function public.pagamento_completato(text, numeric) from public, anon, authenticated;
grant execute on function public.pagamento_completato(text, numeric) to service_role;

-- 11. Voto assemblea con pesatura millesimi
alter table public.assemblee_testata
    add column if not exists tabella_millesimale_id uuid references public.tabelle_millesimali (id) on delete set null;

drop function if exists public.risultati_voto(uuid);
create or replace function public.risultati_voto(p_punto uuid)
returns table (voto text, n_voti bigint, millesimi numeric, percentuale_teste numeric, percentuale_millesimi numeric)
language plpgsql stable security definer set search_path = public as $$
begin
    if not public.has_cond_access(public.cond_of_punto_odg(p_punto)) then
        raise exception 'Accesso negato' using errcode = '42501';
    end if;
    return query
    with v as (
        select av.voto, coalesce(q.valore_millesimale, 0) as m
          from public.assemblee_voti av
          join public.assemblee_punti_odg o on o.id = av.punto_odg_id
          join public.assemblee_testata a on a.id = o.assemblea_id
          left join public.quote_millesimali q on q.tabella_id = a.tabella_millesimale_id and q.unita_id = av.unita_id
         where av.punto_odg_id = p_punto)
    select v.voto, count(*)::bigint, sum(v.m),
           round(100.0 * count(*) / sum(count(*)) over (), 1),
           round(100.0 * sum(v.m) / nullif(sum(sum(v.m)) over (), 0), 1)
      from v group by v.voto;
end $$;
revoke all on function public.risultati_voto(uuid) from public, anon;
grant execute on function public.risultati_voto(uuid) to authenticated;
