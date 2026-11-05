-- =============================================================================
-- DATI EXTRA PER LA DASHBOARD AMMINISTRATORE (/admin/dashboard, Passo 1) (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase. Non eseguire in produzione.
-- Usa l'UUID dell'amministratore/utente di prova: b6e76a6a-bf37-43fd-b00b-efb1cb6921ad
-- Condominio di prova: d0000000-0000-4000-8000-000000000001
-- Esercizio 2026: d0000000-0000-4000-8000-000000000061
--
-- Che cosa predispone:
--   1. Saldo iniziale di cassa / conto corrente (+36.521,70 €) in movimenti_contabili
--      che porta il saldo netto di cassa del condominio esattamente a +14.850,00 €.
--   2. Tre ticket guasti urgenti/in lavorazione in ticket_testata:
--      - Perdita idrica colonna montante Scala A (URGENTE, APERTO, Area comune)
--      - Blocco cancello carrabile elettrico (ALTA, LAVORAZIONE, Area comune)
--      - Guasto serratura portone principale (ALTA, APERTO, Unità 1)
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (on conflict do nothing).
--   - Per annullare: eseguire supabase/seed-dev/admin_dashboard_extra_pulizia.sql.
-- =============================================================================

do $seed_admin_dashboard$
declare
  c_condominio           constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_esercizio_2026       constant uuid := 'd0000000-0000-4000-8000-000000000061';
  v_utente_test_id       constant uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  c_unita_1              constant uuid := 'd0000000-0000-4000-8000-000000000011';

  c_mov_saldo_iniziale   constant uuid := 'd0000000-0000-4000-8000-000000000449';
  c_ticket_urgente_1     constant uuid := 'd0000000-0000-4000-8000-000000000881';
  c_ticket_urgente_2     constant uuid := 'd0000000-0000-4000-8000-000000000882';
  c_ticket_urgente_3     constant uuid := 'd0000000-0000-4000-8000-000000000883';
begin
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise notice 'Condominio di prova % non trovato. Esegui prima 01_dati_prova.sql.', c_condominio;
    return;
  end if;

  if not exists (select 1 from public.esercizi_contabili where id = c_esercizio_2026) then
    raise notice 'Esercizio contabile 2026 % non trovato. Esegui prima 03_dati_home.sql.', c_esercizio_2026;
    return;
  end if;

  -- 1. Saldo cassa iniziale / incasso quote a credito per disponibilità bancaria positiva
  insert into public.movimenti_contabili (
    id,
    esercizio_id,
    data,
    importo,
    segno,
    descrizione
  ) values (
    c_mov_saldo_iniziale,
    c_esercizio_2026,
    '2026-01-01',
    36521.70,
    '+',
    'Fondo riserva e saldo iniziale conto corrente'
  ) on conflict (id) do nothing;

  -- 2. Ticket guasti urgenti per la colonna sinistra della dashboard
  insert into public.ticket_testata (
    id,
    condominio_id,
    segnalatore_id,
    titolo,
    descrizione,
    priorita,
    stato,
    is_area_comune,
    created_at
  ) values (
    c_ticket_urgente_1,
    c_condominio,
    v_utente_test_id,
    'Perdita idrica colonna montante Scala A',
    'Infiltrazione attiva dal vano contatori verso il piano terra con gocciolamento continuo.',
    'URGENTE',
    'APERTO',
    true,
    '2026-11-04 09:30:00+00'
  ) on conflict (id) do nothing;

  insert into public.ticket_testata (
    id,
    condominio_id,
    segnalatore_id,
    titolo,
    descrizione,
    priorita,
    stato,
    is_area_comune,
    created_at
  ) values (
    c_ticket_urgente_2,
    c_condominio,
    v_utente_test_id,
    'Blocco cancello carrabile elettrico',
    'Fotocellula otturata e motore in surriscaldamento: il cancello rimane parzialmente aperto.',
    'ALTA',
    'LAVORAZIONE',
    true,
    '2026-11-03 14:15:00+00'
  ) on conflict (id) do nothing;

  insert into public.ticket_testata (
    id,
    condominio_id,
    segnalatore_id,
    unita_id,
    titolo,
    descrizione,
    priorita,
    stato,
    is_area_comune,
    created_at
  ) values (
    c_ticket_urgente_3,
    c_condominio,
    v_utente_test_id,
    c_unita_1,
    'Guasto serratura portone principale',
    'La chiave gira con fatica e la molla di ritorno è bloccata.',
    'ALTA',
    'APERTO',
    false,
    '2026-11-02 11:00:00+00'
  ) on conflict (id) do nothing;

  raise notice 'Dati extra Dashboard Amministratore pronti per il condominio %.', c_condominio;
end $seed_admin_dashboard$;

