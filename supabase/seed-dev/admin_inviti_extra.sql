-- =============================================================================
-- DATI DI PROVA PER LA GESTIONE INVITI (UC-07)  (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase, sul progetto di prova.
-- Crea 3 inviti di prova per il Condominio di Prova (d0000000-0000-4000-8000-000000000001):
--   1. Invito in attesa (CONDOMINO, associato a Int. 2, scadenza tra 4 giorni)
--   2. Invito scaduto (CONDOMINO, associato a Int. 1, scadenza passata da 2 giorni)
--   3. Invito accettato (CONDOMINO con flag_portiere = true, accettato 3 giorni fa)
--
-- GARANZIE:
--   - Idempotente e rieseguibile: id/token fissi con controllo "on conflict (token) do update / do nothing"
--   - Nessun dato demo hardcoded nei componenti: script isolato in supabase/seed-dev/
--   - Per rimuovere i dati: supabase/seed-dev/admin_inviti_extra_pulizia.sql
-- =============================================================================

do $seed_inviti$
declare
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_unita_1    constant uuid := 'd0000000-0000-4000-8000-000000000011';
  c_unita_2    constant uuid := 'd0000000-0000-4000-8000-000000000012';

  v_ruolo_condomino uuid;
  v_ruolo_portiere  uuid;
  v_admin_id        uuid;
begin
  -- Verifica esistenza condominio di prova
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Il condominio di prova (%) non esiste. Esegui prima 01_dati_prova.sql.', c_condominio;
  end if;

  select admin_id into v_admin_id from public.condomini where id = c_condominio;
  select id into v_ruolo_condomino from public.ruoli_piattaforma where codice = 'CONDOMINO';
  select id into v_ruolo_portiere  from public.ruoli_piattaforma where codice = 'PORTIERE';

  if v_ruolo_condomino is null or v_ruolo_portiere is null then
    raise exception 'Mancano i ruoli CONDOMINO o PORTIERE in ruoli_piattaforma.';
  end if;

  -- 1. Invito in attesa (Int. 2, scade tra 4 giorni)
  insert into public.inviti_pendenti (
    token,
    email,
    ruolo_proposto,
    flag_portiere,
    condominio_id,
    unita_id,
    invitato_da,
    scadenza,
    accettato_at
  )
  values (
    'd0000000-0000-4000-8000-000000000061',
    'mario.rossi.invitato@example.com',
    v_ruolo_condomino,
    false,
    c_condominio,
    c_unita_2,
    v_admin_id,
    now() + interval '4 days',
    null
  )
  on conflict (token) do update
  set email = excluded.email,
      ruolo_proposto = excluded.ruolo_proposto,
      flag_portiere = excluded.flag_portiere,
      condominio_id = excluded.condominio_id,
      unita_id = excluded.unita_id,
      scadenza = excluded.scadenza,
      accettato_at = null;

  -- 2. Invito scaduto (Int. 1, scaduto da 2 giorni)
  insert into public.inviti_pendenti (
    token,
    email,
    ruolo_proposto,
    flag_portiere,
    condominio_id,
    unita_id,
    invitato_da,
    scadenza,
    accettato_at
  )
  values (
    'd0000000-0000-4000-8000-000000000062',
    'laura.bianchi.scaduta@example.com',
    v_ruolo_condomino,
    false,
    c_condominio,
    c_unita_1,
    v_admin_id,
    now() - interval '2 days',
    null
  )
  on conflict (token) do update
  set email = excluded.email,
      ruolo_proposto = excluded.ruolo_proposto,
      flag_portiere = excluded.flag_portiere,
      condominio_id = excluded.condominio_id,
      unita_id = excluded.unita_id,
      scadenza = excluded.scadenza,
      accettato_at = null;

  -- 3. Invito accettato (Utente ibrido Condòmino + Portiere, accettato 3 giorni fa)
  insert into public.inviti_pendenti (
    token,
    email,
    ruolo_proposto,
    flag_portiere,
    condominio_id,
    unita_id,
    invitato_da,
    scadenza,
    accettato_at
  )
  values (
    'd0000000-0000-4000-8000-000000000063',
    'giuseppe.verdi.accettato@example.com',
    v_ruolo_condomino,
    true,
    c_condominio,
    null,
    v_admin_id,
    now() + interval '1 day',
    now() - interval '3 days'
  )
  on conflict (token) do update
  set email = excluded.email,
      ruolo_proposto = excluded.ruolo_proposto,
      flag_portiere = excluded.flag_portiere,
      condominio_id = excluded.condominio_id,
      unita_id = excluded.unita_id,
      scadenza = excluded.scadenza,
      accettato_at = excluded.accettato_at;

  raise notice 'Dati di prova inviti inseriti/aggiornati con successo.';
end
$seed_inviti$;

