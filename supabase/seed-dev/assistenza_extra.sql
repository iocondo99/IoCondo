-- =============================================================================
-- DATI EXTRA PER ASSISTENZA E POLIZZA (/assistenza, Task 7) (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase. Non eseguire in produzione.
-- Usa l'UUID dell'amministratore/utente di prova: b6e76a6a-bf37-43fd-b00b-efb1cb6921ad
-- Tutti i dati, le compagnie e i numeri sono inventati a scopo di collaudo.
--
-- Che cosa predispone:
--   1. Polizza assicurativa del fabbricato (polizze_assicurative) per il "Condominio di Prova"
--      (d0000000-0000-4000-8000-000000000001):
--      - Compagnia: Generali Italia Assicurazioni
--      - Numero polizza: POL-FAB-2026-9901
--      - Scadenza: 2026-12-31
--   2. Fornitori di pronto intervento legati all'amministratore di prova (fornitori):
--      - Otis Servizio Ascensori H24 (+39 06 8899001, Ascensore)
--      - Pronto Intervento Idraulico Express (+39 06 4433221, Idraulico)
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (on conflict do nothing).
--   - Per annullare: eseguire supabase/seed-dev/assistenza_extra_pulizia.sql.
-- =============================================================================

do $seed_assistenza$
declare
  v_utente_test_id       uuid := 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad';
  c_condominio           constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_polizza_prova        constant uuid := 'd0000000-0000-4000-8000-000000000951';
  c_forn_ascensore       constant uuid := 'd0000000-0000-4000-8000-000000000961';
  c_forn_idraulico       constant uuid := 'd0000000-0000-4000-8000-000000000962';
begin
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise notice 'Condominio di prova % non trovato. Esegui prima 01_dati_prova.sql.', c_condominio;
    return;
  end if;

  -- 1. Polizza Globale Fabbricati del Condominio di Prova
  insert into public.polizze_assicurative (
    id,
    condominio_id,
    compagnia,
    numero_polizza,
    premio_annuo,
    data_scadenza
  ) values (
    c_polizza_prova,
    c_condominio,
    'Generali Italia Assicurazioni',
    'POL-FAB-2026-9901',
    3450.00,
    '2026-12-31'
  ) on conflict (id) do nothing;

  -- 2. Fornitori contrattualizzati per pronto intervento condominiale
  insert into public.fornitori (
    id,
    admin_id,
    ragione_sociale,
    p_iva,
    email,
    telefono,
    categoria
  ) values (
    c_forn_ascensore,
    v_utente_test_id,
    'Otis Servizio Ascensori H24',
    '01234567890',
    'emergenze@otisascentori.it',
    '+39 06 8899001',
    'Ascensore'
  ) on conflict (id) do nothing;

  insert into public.fornitori (
    id,
    admin_id,
    ragione_sociale,
    p_iva,
    email,
    telefono,
    categoria
  ) values (
    c_forn_idraulico,
    v_utente_test_id,
    'Pronto Intervento Idraulico Express',
    '09876543210',
    'urgenze@idraulicoexpress.it',
    '+39 06 4433221',
    'Idraulico'
  ) on conflict (id) do nothing;

  raise notice 'Dati extra Assistenza configurati con successo per il Condominio di Prova.';
end $seed_assistenza$;

