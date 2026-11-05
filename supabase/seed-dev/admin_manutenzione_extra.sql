-- =============================================================================
-- DATI DI PROVA PER LA GESTIONE MANUTENZIONE, TICKET E FORNITORI (Passo 5)
-- (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase sul progetto di prova.
-- Crea:
--   - 2 Fornitori convenzionati per l'amministratore del condominio di prova
--   - 4 Ticket rappresentativi:
--       1. Urgente aperto in area comune (autoclave)
--       2. In lavorazione con intervento e magic link (illuminazione scale)
--       3. Risolto con consuntivo spesa (cancello automatico)
--       4. Aperto per unità privata Int. 2 (infiltrazione)
--   - Messaggi e allegati di prova per testare il dettaglio del ticket
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (id fissi e 'on conflict do update')
--   - Rispetto dei vincoli di integrità referenziale e RLS
--   - Per rimuovere i dati: supabase/seed-dev/admin_manutenzione_extra_pulizia.sql
-- =============================================================================

do $seed_admin_manutenzione$
declare
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_unita_int2 constant uuid := 'd0000000-0000-4000-8000-000000000012';

  -- Categorie guasti
  c_cat_idraulico  constant uuid := '23000000-0000-4000-8000-000000000001';
  c_cat_elettrico  constant uuid := '23000000-0000-4000-8000-000000000002';

  -- Fornitori convenzionati
  c_forn_idraulico constant uuid := 'd0000000-0000-4000-8000-000000000601';
  c_forn_elettrico constant uuid := 'd0000000-0000-4000-8000-000000000602';

  -- Ticket testata
  c_tkt_urgente    constant uuid := 'd0000000-0000-4000-8000-000000000611';
  c_tkt_in_corso   constant uuid := 'd0000000-0000-4000-8000-000000000612';
  c_tkt_risolto    constant uuid := 'd0000000-0000-4000-8000-000000000613';
  c_tkt_int2       constant uuid := 'd0000000-0000-4000-8000-000000000614';

  -- Interventi
  c_int_elettrico  constant uuid := 'd0000000-0000-4000-8000-000000000621';
  c_int_risolto    constant uuid := 'd0000000-0000-4000-8000-000000000622';

  -- Token Magic Link
  c_magic_token    constant text := 'tok_manutentore_prova_612_magic_link_7788';

  -- Messaggi e allegati
  c_msg_1          constant uuid := 'd0000000-0000-4000-8000-000000000631';
  c_all_1          constant uuid := 'd0000000-0000-4000-8000-000000000641';

  v_admin_id  uuid;
  v_utente_id uuid;
begin
  -- 1. Verifica esistenza condominio di prova
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Il condominio di prova (%) non esiste. Esegui prima 01_dati_prova.sql.', c_condominio;
  end if;

  -- 2. Amministratore di riferimento (superadmin Roberto Santoro per i test)
  v_admin_id := '10000000-0000-4000-8000-000000000001';

  -- 3. Recupera un utente residente per segnalazioni/messaggi
  select id into v_utente_id from public.utenti where id <> coalesce(v_admin_id, '00000000-0000-0000-0000-000000000000'::uuid) order by created_at limit 1;
  if v_utente_id is null then
    v_utente_id := v_admin_id;
  end if;

  -- 4. Assicura le categorie guasti essenziali
  insert into public.categorie_guasti (id, nome)
  values
    (c_cat_idraulico, 'Idraulico'),
    (c_cat_elettrico, 'Elettrico')
  on conflict (id) do update set nome = excluded.nome;

  -- 4b. Assicura associazione utente superadmin (Roberto Santoro) come ADMIN del condominio
  insert into public.utente_entita_ruolo (
    id, utente_id, condominio_id, ruolo_id
  ) values (
    'd0000000-0000-4000-8000-000000000699',
    '10000000-0000-4000-8000-000000000001',
    c_condominio,
    '21000000-0000-4000-8000-000000000002'
  )
  on conflict (id) do nothing;

  -- 5. Inserimento Fornitori convenzionati
  insert into public.fornitori (
    id, admin_id, ragione_sociale, p_iva, iban, email, telefono, categoria
  ) values (
    c_forn_idraulico,
    v_admin_id,
    'ClimaTerm Edilizia S.r.l.',
    '01234567890',
    'IT60X0542811101000000123456',
    'interventi@climatermedil.it',
    '+39 06 9988776',
    'Idraulico'
  )
  on conflict (id) do update set
    admin_id = excluded.admin_id,
    ragione_sociale = excluded.ragione_sociale,
    p_iva = excluded.p_iva,
    iban = excluded.iban,
    email = excluded.email,
    telefono = excluded.telefono,
    categoria = excluded.categoria;

  insert into public.fornitori (
    id, admin_id, ragione_sociale, p_iva, iban, email, telefono, categoria
  ) values (
    c_forn_elettrico,
    v_admin_id,
    'Volta Impianti Elettrici S.n.c.',
    '09876543210',
    'IT40Y030020328000000987654',
    'info@voltaimpianti.it',
    '+39 06 8877665',
    'Elettrico'
  )
  on conflict (id) do update set
    admin_id = excluded.admin_id,
    ragione_sociale = excluded.ragione_sociale,
    p_iva = excluded.p_iva,
    iban = excluded.iban,
    email = excluded.email,
    telefono = excluded.telefono,
    categoria = excluded.categoria;

  -- 6. Ticket 1: Urgente aperto in area comune (autoclave)
  insert into public.ticket_testata (
    id, condominio_id, unita_id, segnalatore_id, categoria_id,
    titolo, descrizione, is_area_comune, priorita, stato, created_at
  ) values (
    c_tkt_urgente,
    c_condominio,
    null,
    v_admin_id,
    c_cat_idraulico,
    'Allagamento locale autoclave e perdita tubatura',
    'Rilevata consistente fuoriuscita di acqua nel vano autoclave comune al piano interrato. Rischio blocco pompe.',
    true,
    'URGENTE',
    'APERTO',
    now() - interval '2 hours'
  )
  on conflict (id) do update set
    titolo = excluded.titolo,
    descrizione = excluded.descrizione,
    priorita = excluded.priorita,
    stato = excluded.stato,
    is_area_comune = excluded.is_area_comune;

  -- Messaggio su ticket urgente
  insert into public.ticket_messaggi (
    id, ticket_id, mittente_id, messaggio, timestamp
  ) values (
    c_msg_1,
    c_tkt_urgente,
    v_admin_id,
    'Ho chiuso provvisoriamente la valvola di mandata generale, contattare subito il manutentore!',
    now() - interval '1 hour 45 minutes'
  )
  on conflict (id) do update set messaggio = excluded.messaggio;

  -- Allegato foto guasto su ticket urgente
  insert into public.ticket_allegati (
    id, ticket_id, url_storage, tipo_file, caricato_da, created_at
  ) values (
    c_all_1,
    c_tkt_urgente,
    'foto-guasti/perdita-autoclave.jpg',
    'FOTO',
    v_admin_id,
    now() - interval '1 hour 50 minutes'
  )
  on conflict (id) do update set url_storage = excluded.url_storage;

  -- 7. Ticket 2: In lavorazione con intervento e magic link (illuminazione scale)
  insert into public.ticket_testata (
    id, condominio_id, unita_id, segnalatore_id, categoria_id,
    titolo, descrizione, is_area_comune, priorita, stato, created_at
  ) values (
    c_tkt_in_corso,
    c_condominio,
    null,
    v_utente_id,
    c_cat_elettrico,
    'Guasto illuminazione atrio e scale',
    'I faretti a LED dell''atrio principale e le lampade di emergenza delle scale non si accendono.',
    true,
    'ALTA',
    'LAVORAZIONE',
    now() - interval '1 day'
  )
  on conflict (id) do update set
    titolo = excluded.titolo,
    descrizione = excluded.descrizione,
    priorita = excluded.priorita,
    stato = excluded.stato;

  insert into public.ticket_interventi (
    id, ticket_id, fornitore_id, data_prevista, note_fornitore, created_at
  ) values (
    c_int_elettrico,
    c_tkt_in_corso,
    c_forn_elettrico,
    current_date + interval '1 day',
    'Sostituzione relè temporizzato quadro scale e verifica alimentatori LED.',
    now() - interval '18 hours'
  )
  on conflict (id) do update set
    fornitore_id = excluded.fornitore_id,
    data_prevista = excluded.data_prevista,
    note_fornitore = excluded.note_fornitore;

  insert into public.fornitori_tokens (
    token, ticket_intervento_id, url_magico, data_scadenza
  ) values (
    c_magic_token,
    c_int_elettrico,
    'https://app.iocondo.it/fornitore/' || c_magic_token,
    now() + interval '14 days'
  )
  on conflict (token) do update set
    ticket_intervento_id = excluded.ticket_intervento_id,
    data_scadenza = excluded.data_scadenza;

  -- 8. Ticket 3: Risolto con data consuntivo e spesa (cancello carrabile)
  insert into public.ticket_testata (
    id, condominio_id, unita_id, segnalatore_id, categoria_id,
    titolo, descrizione, is_area_comune, priorita, stato, created_at, closed_at
  ) values (
    c_tkt_risolto,
    c_condominio,
    null,
    v_admin_id,
    c_cat_elettrico,
    'Riparazione cancello carrabile e fotocellule',
    'Il cancello automatico non si richiudeva a causa di fotocellula otturata e sensore guasto.',
    true,
    'MEDIA',
    'RISOLTO',
    now() - interval '4 days',
    now() - interval '1 day'
  )
  on conflict (id) do update set
    titolo = excluded.titolo,
    descrizione = excluded.descrizione,
    priorita = excluded.priorita,
    stato = excluded.stato,
    closed_at = excluded.closed_at;

  insert into public.ticket_interventi (
    id, ticket_id, fornitore_id, data_prevista, importo_consuntivo, note_fornitore, created_at
  ) values (
    c_int_risolto,
    c_tkt_risolto,
    c_forn_elettrico,
    current_date - interval '2 days',
    240.00,
    'Sostituita coppia fotocellule e calibrato sensore antischiacciamento.',
    now() - interval '3 days'
  )
  on conflict (id) do update set
    fornitore_id = excluded.fornitore_id,
    importo_consuntivo = excluded.importo_consuntivo,
    note_fornitore = excluded.note_fornitore;

  -- 9. Ticket 4: Aperto per unità privata Int. 2
  insert into public.ticket_testata (
    id, condominio_id, unita_id, segnalatore_id, categoria_id,
    titolo, descrizione, is_area_comune, priorita, stato, created_at
  ) values (
    c_tkt_int2,
    c_condominio,
    c_unita_int2,
    v_utente_id,
    c_cat_idraulico,
    'Infiltrazione dal soffitto bagno principale',
    'Macchia di umidità e gocciolamento in corrispondenza della colonna di scarico condominiale.',
    false,
    'MEDIA',
    'APERTO',
    now() - interval '1 day'
  )
  on conflict (id) do update set
    titolo = excluded.titolo,
    descrizione = excluded.descrizione,
    priorita = excluded.priorita,
    stato = excluded.stato,
    unita_id = excluded.unita_id;

  raise notice 'Dati di prova manutenzione, ticket e fornitori inseriti/aggiornati con successo.';
end $seed_admin_manutenzione$;
