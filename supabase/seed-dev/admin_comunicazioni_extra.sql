-- =============================================================================
-- DATI DI PROVA PER LA GESTIONE COMUNICAZIONI E BACHECA AMMINISTRATORE (Passo 4)
-- (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase sul progetto di prova.
-- Crea 3 comunicazioni di prova per il Condominio di Prova (d0000000-0000-4000-8000-000000000001):
--   1. Comunicazione in evidenza per l'intero condominio (palazzo_id = null, is_pinned = true)
--   2. Comunicazione ordinaria per Palazzo A (palazzo_id = c_palazzo_a, is_pinned = false)
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

  v_admin_id  uuid;
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

  -- 2. Comunicazione ordinaria per Palazzo A
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
