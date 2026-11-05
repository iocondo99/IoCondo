-- =============================================================================
-- DATI DI PROVA PER LA GESTIONE COMUNICAZIONI E BACHECA AMMINISTRATORE (Passo 4)
-- (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase sul progetto di prova.
-- Crea 3 comunicazioni di prova per il Condominio di Prova (d0000000-0000-4000-8000-000000000001):
--   1. Comunicazione in evidenza per l'intero condominio (palazzo_id = null, is_pinned = true)
--   2. Comunicazione ordinaria per Palazzo A (palazzo_id = c_palazzo_a, is_pinned = false)
--      con 2 commenti residenti associati
--   3. Avviso generico ordinario per l'intero condominio (palazzo_id = null, is_pinned = false)
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (id fissi e 'on conflict (id) do update')
--   - Rispetto dei vincoli di integrità referenziale e RLS
--   - Per rimuovere i dati: supabase/seed-dev/admin_comunicazioni_extra_pulizia.sql
-- =============================================================================

do $seed_admin_comunicazioni$
declare
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a  constant uuid := 'd0000000-0000-4000-8000-000000000002';

  c_post_1 constant uuid := 'd0000000-0000-4000-8000-000000000301';
  c_post_2 constant uuid := 'd0000000-0000-4000-8000-000000000302';
  c_post_3 constant uuid := 'd0000000-0000-4000-8000-000000000303';

  c_comm_1 constant uuid := 'd0000000-0000-4000-8000-000000000351';
  c_comm_2 constant uuid := 'd0000000-0000-4000-8000-000000000352';

  v_admin_id  uuid;
  v_utente_id uuid;
begin
  -- Verifica esistenza condominio di prova
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Il condominio di prova (%) non esiste. Esegui prima 01_dati_prova.sql.', c_condominio;
  end if;

  -- Verifica o assicura l'esistenza di Palazzo A
  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values (c_palazzo_a, c_condominio, 'Palazzo A', 'Via dei Test 1')
  on conflict (id) do nothing;

  -- Recupera l'amministratore del condominio (o il primo utente disponibile)
  select admin_id into v_admin_id from public.condomini where id = c_condominio;
  if v_admin_id is null then
    select id into v_admin_id from public.utenti order by created_at limit 1;
  end if;

  -- Recupera un utente per i commenti di prova (diverso dall'admin se possibile)
  select id into v_utente_id from public.utenti where id <> coalesce(v_admin_id, '00000000-0000-0000-0000-000000000000'::uuid) order by created_at limit 1;
  if v_utente_id is null then
    v_utente_id := v_admin_id;
  end if;

  -- 1. Comunicazione in evidenza per tutto il condominio
  insert into public.bacheca_post (
    id,
    condominio_id,
    palazzo_id,
    autore_id,
    titolo,
    corpo,
    is_pinned,
    data_pubblicazione
  )
  values (
    c_post_1,
    c_condominio,
    null,
    v_admin_id,
    'Interventi di efficientamento energetico e manutenzione caldaia',
    'Si comunica a tutti i residenti che a partire da lunedì prossimo avranno inizio le verifiche periodiche sull''impianto termico centralizzato per ottimizzare i consumi invernali.',
    true,
    now() - interval '1 day'
  )
  on conflict (id) do update
  set titolo = excluded.titolo,
      corpo = excluded.corpo,
      palazzo_id = excluded.palazzo_id,
      is_pinned = excluded.is_pinned,
      data_pubblicazione = excluded.data_pubblicazione,
      updated_at = now();

  -- 2. Comunicazione ordinaria per Palazzo A (con commenti)
  insert into public.bacheca_post (
    id,
    condominio_id,
    palazzo_id,
    autore_id,
    titolo,
    corpo,
    is_pinned,
    data_pubblicazione
  )
  values (
    c_post_2,
    c_condominio,
    c_palazzo_a,
    v_admin_id,
    'Sostituzione citofoni e verifica impianto videocitofonico Palazzo A',
    'Mercoledì mattina i tecnici della ditta incaricata effettueranno la verifica dei cablaggi e la sostituzione dei moduli pulsantiera all''ingresso del Palazzo A.',
    false,
    now() - interval '3 days'
  )
  on conflict (id) do update
  set titolo = excluded.titolo,
      corpo = excluded.corpo,
      palazzo_id = excluded.palazzo_id,
      is_pinned = excluded.is_pinned,
      data_pubblicazione = excluded.data_pubblicazione,
      updated_at = now();

  -- Commenti dei residenti al post 2
  insert into public.bacheca_commenti (
    id,
    post_id,
    autore_id,
    commento,
    created_at
  )
  values (
    c_comm_1,
    c_post_2,
    v_utente_id,
    'Buongiorno, il tecnico dovrà accedere anche agli appartamenti per verificare la cornetta interna?',
    now() - interval '2 days'
  )
  on conflict (id) do update
  set commento = excluded.commento,
      created_at = excluded.created_at;

  insert into public.bacheca_commenti (
    id,
    post_id,
    autore_id,
    commento,
    created_at
  )
  values (
    c_comm_2,
    c_post_2,
    v_utente_id,
    'Confermo che il mio citofono al secondo piano ha un fruscio persistente durante le chiamate.',
    now() - interval '1 day'
  )
  on conflict (id) do update
  set commento = excluded.commento,
      created_at = excluded.created_at;

  -- 3. Avviso generico per tutto il condominio
  insert into public.bacheca_post (
    id,
    condominio_id,
    palazzo_id,
    autore_id,
    titolo,
    corpo,
    is_pinned,
    data_pubblicazione
  )
  values (
    c_post_3,
    c_condominio,
    null,
    v_admin_id,
    'Aggiornamento orari apertura locale biciclette e passeggini',
    'Ricordiamo a tutti i condòmini che il locale comune per il deposito biciclette rimane aperto tutti i giorni dalle 07:00 alle 22:00. Si raccomanda di richiudere la porta dopo l''uso.',
    false,
    now() - interval '5 days'
  )
  on conflict (id) do update
  set titolo = excluded.titolo,
      corpo = excluded.corpo,
      palazzo_id = excluded.palazzo_id,
      is_pinned = excluded.is_pinned,
      data_pubblicazione = excluded.data_pubblicazione,
      updated_at = now();

end $seed_admin_comunicazioni$;

