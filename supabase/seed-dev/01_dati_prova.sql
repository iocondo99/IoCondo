-- =============================================================================
-- DATI DI PROVA PER LO SVILUPPO  (NON è una migrazione: non va in supabase/migrations)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase, sul progetto di prova (MVP).
-- Crea un condominio di prova con un palazzo, tre unità e i ruoli necessari a provare
-- i layout dell'app: super amministratore, amministratore, condòmino e portiere.
--
-- PRIMA DI ESEGUIRLO
--   1. In Authentication > Users crea (o scegli) DUE utenti di prova. La riga in `utenti`
--      la crea da sola il trigger `handle_new_user`. Email e password le scegli tu:
--      questo file non le contiene e non le chiede.
--   2. Copia l'id (UUID) dei due utenti e incollalo qui sotto, al posto dei due `null`.
--      Il SQL Editor non supporta le variabili di psql (:nome): per questo i segnaposto
--      stanno in due costanti all'inizio del blocco.
--
-- GARANZIE
--   - Rieseguibile: ogni riga ha un id fisso (prefisso d0000000-...) e un controllo
--     "se non esiste". Rieseguirlo non crea duplicati.
--   - Tutto in un'unica transazione: o passa tutto o non cambia niente.
--   - Se un utente non esiste lo script si ferma con un messaggio chiaro, prima di scrivere.
--   - Nessuna email, password o dato reale: nomi e indirizzi sono inventati.
--   - Per tornare indietro: supabase/seed-dev/02_pulizia_dati_prova.sql.
--
-- NOTA SULLE POLICY (RLS)
--   Il SQL Editor gira come `postgres` e salta le RLS: lo script scrive righe che le policy
--   avrebbero comunque accettato (vedi docs/DECISIONI.md, sezione "Dati di prova"), così
--   l'app, che legge con le RLS attive, le vede come previsto:
--     - condomini_select: has_cond_access -> admin_id = utente di prova, oppure una riga di ruolo;
--     - utente_entita_ruolo_select: utente_id = auth.uid();
--     - unita_immobiliari_select: has_unita_access -> anagrafica attiva (condòmino) o ruolo PORTIERE;
--     - configurazioni_condominio_select / palazzi_select: has_cond_access;
--     - notifiche_select: utente_id = auth.uid().
-- =============================================================================

do $seed$
declare
  -- >>> INCOLLA QUI I DUE UUID (tra gli apici) <<<
  v_utente_super_id uuid := null;  -- utente SOLO super amministratore: nessun ruolo di condominio
  v_utente_test_id  uuid := null;  -- utente SENZA flag: condòmino + portiere + amministratore sul condominio di prova

  -- id fissi dei dati di prova (servono a rieseguire e a ripulire)
  c_condominio   constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo      constant uuid := 'd0000000-0000-4000-8000-000000000002';
  c_unita_1      constant uuid := 'd0000000-0000-4000-8000-000000000011';
  c_unita_2      constant uuid := 'd0000000-0000-4000-8000-000000000012';
  c_unita_box    constant uuid := 'd0000000-0000-4000-8000-000000000013';
  c_ruolo_cond   constant uuid := 'd0000000-0000-4000-8000-000000000021';
  c_ruolo_port   constant uuid := 'd0000000-0000-4000-8000-000000000022';
  c_ruolo_admin  constant uuid := 'd0000000-0000-4000-8000-000000000023';
  c_anagrafica   constant uuid := 'd0000000-0000-4000-8000-000000000031';
  c_config       constant uuid := 'd0000000-0000-4000-8000-000000000041';
  c_notifica_1   constant uuid := 'd0000000-0000-4000-8000-000000000051';
  c_notifica_2   constant uuid := 'd0000000-0000-4000-8000-000000000052';

  v_ruolo_condomino uuid;
  v_ruolo_portiere  uuid;
  v_ruolo_admin     uuid;
  v_tipo_appartamento uuid;
  v_tipo_box          uuid;
begin
  -- ---- Controlli iniziali: nessuna scrittura se qualcosa non torna ----------------------
  if v_utente_super_id is null or v_utente_test_id is null then
    raise exception 'Incolla i due UUID degli utenti di prova nelle costanti v_utente_super_id e v_utente_test_id (inizio dello script).';
  end if;
  if v_utente_super_id = v_utente_test_id then
    raise exception 'I due utenti devono essere diversi: uno solo super amministratore, l''altro con i ruoli di condominio.';
  end if;
  if not exists (select 1 from public.utenti where id = v_utente_super_id) then
    raise exception 'L''utente super (%) non esiste in "utenti". Crealo da Authentication > Users e riprova.', v_utente_super_id;
  end if;
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise exception 'L''utente di prova (%) non esiste in "utenti". Crealo da Authentication > Users e riprova.', v_utente_test_id;
  end if;

  select id into v_ruolo_condomino from public.ruoli_piattaforma where codice = 'CONDOMINO';
  select id into v_ruolo_portiere  from public.ruoli_piattaforma where codice = 'PORTIERE';
  select id into v_ruolo_admin     from public.ruoli_piattaforma where codice = 'ADMIN';
  if v_ruolo_condomino is null or v_ruolo_portiere is null or v_ruolo_admin is null then
    raise exception 'Mancano righe in ruoli_piattaforma (CONDOMINO, PORTIERE, ADMIN): le crea la migrazione iniziale.';
  end if;
  select id into v_tipo_appartamento from public.tipologie_unita where descrizione = 'Appartamento';
  select id into v_tipo_box          from public.tipologie_unita where descrizione = 'Box auto';
  if v_tipo_appartamento is null or v_tipo_box is null then
    raise exception 'Mancano le tipologie "Appartamento" e "Box auto" in tipologie_unita.';
  end if;

  -- ---- Utenti: il flag super amministratore e un nome visibile (solo se manca) ------------
  update public.utenti set is_superadmin = true  where id = v_utente_super_id and is_superadmin = false;
  update public.utenti set is_superadmin = false where id = v_utente_test_id  and is_superadmin = true;
  update public.utenti set nome_cognome = 'Super Admin di Prova' where id = v_utente_super_id and nome_cognome is null;
  update public.utenti set nome_cognome = 'Utente di Prova'      where id = v_utente_test_id  and nome_cognome is null;

  -- ---- Condominio (admin_id è NOT NULL: è l'utente di prova) -----------------------------
  insert into public.condomini (id, admin_id, nome, tipo, indirizzo, citta, cap, provincia)
  values (c_condominio, v_utente_test_id, 'Condominio di Prova', 'CONDOMINIO', 'Via dei Test 1', 'Cittadiprova', '00000', 'XX')
  on conflict do nothing;

  -- ---- Palazzo (univoco per condominio + nome) -------------------------------------------
  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values (c_palazzo, c_condominio, 'Palazzo A', 'Via dei Test 1')
  on conflict do nothing;

  -- ---- Unità (univoche per palazzo + interno + tipologia) --------------------------------
  insert into public.unita_immobiliari (id, palazzo_id, tipologia_id, interno, piano, mq) values
    (c_unita_1,   c_palazzo, v_tipo_appartamento, '1',   1, 80),
    (c_unita_2,   c_palazzo, v_tipo_appartamento, '2',   1, 65),
    (c_unita_box, c_palazzo, v_tipo_box,          'B1', -1, 14)
  on conflict do nothing;

  -- ---- Possesso: l'utente di prova è proprietario dell'interno 1 -------------------------
  -- (has_unita_access guarda l'anagrafica attiva: senza, il condòmino non vedrebbe la sua unità)
  insert into public.anagrafiche_unita (id, unita_id, utente_id, tipo_possesso, quota_possesso)
  select c_anagrafica, c_unita_1, v_utente_test_id, 'PROPRIETARIO', 100
  where not exists (
    select 1 from public.anagrafiche_unita
    where unita_id = c_unita_1 and utente_id = v_utente_test_id and data_fine is null
  )
  on conflict do nothing;

  -- ---- Ruoli dell'utente di prova (CHECK: serve condominio_id oppure unita_id) -----------
  insert into public.utente_entita_ruolo (id, utente_id, ruolo_id, condominio_id, unita_id)
  select c_ruolo_cond, v_utente_test_id, v_ruolo_condomino, c_condominio, c_unita_1
  where not exists (
    select 1 from public.utente_entita_ruolo
    where utente_id = v_utente_test_id and ruolo_id = v_ruolo_condomino and condominio_id = c_condominio
  )
  on conflict do nothing;

  insert into public.utente_entita_ruolo (id, utente_id, ruolo_id, condominio_id)
  select c_ruolo_port, v_utente_test_id, v_ruolo_portiere, c_condominio
  where not exists (
    select 1 from public.utente_entita_ruolo
    where utente_id = v_utente_test_id and ruolo_id = v_ruolo_portiere and condominio_id = c_condominio
  )
  on conflict do nothing;

  insert into public.utente_entita_ruolo (id, utente_id, ruolo_id, condominio_id)
  select c_ruolo_admin, v_utente_test_id, v_ruolo_admin, c_condominio
  where not exists (
    select 1 from public.utente_entita_ruolo
    where utente_id = v_utente_test_id and ruolo_id = v_ruolo_admin and condominio_id = c_condominio
  )
  on conflict do nothing;

  -- L'utente super NON riceve alcun ruolo di condominio, di proposito.

  -- ---- Moduli attivi: una riga di default per il condominio (palazzo_id nullo), tutti attivi ----
  insert into public.configurazioni_condominio (id, condominio_id)
  select c_config, c_condominio
  where not exists (
    select 1 from public.configurazioni_condominio where condominio_id = c_condominio and palazzo_id is null
  )
  on conflict do nothing;

  -- ---- Due notifiche in-app per l'utente di prova (una già letta), per provare il pannello ----
  insert into public.notifiche (id, utente_id, condominio_id, titolo, corpo, tipo, letta, created_at) values
    (c_notifica_1, v_utente_test_id, c_condominio, 'Notifica di prova', 'Questa è una notifica di prova: se la vedi, il pannello legge dal database.', 'PROVA', false, now() - interval '1 hour'),
    (c_notifica_2, v_utente_test_id, c_condominio, 'Notifica già letta', 'Questa notifica di prova è già segnata come letta.', 'PROVA', true, now() - interval '2 days')
  on conflict do nothing;

  raise notice 'Dati di prova pronti. Condominio %, utente di prova %, utente super %.', c_condominio, v_utente_test_id, v_utente_super_id;
end
$seed$;
