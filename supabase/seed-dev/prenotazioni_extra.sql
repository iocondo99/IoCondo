-- =============================================================================
-- DATI DI PROVA PER PRENOTAZIONE SPAZI COMUNI (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase sul progetto di prova (MVP),
-- DOPO 01_dati_prova.sql (che crea il "Condominio di Prova").
--
-- GARANZIE
--   - Idempotente: UUID fissi (prefisso d0000000-...09xx) + controlli di esistenza.
--   - Verifica l'esistenza del Condominio di Prova prima di inserire.
--   - Per annullare: eseguire prenotazioni_extra_pulizia.sql.
-- =============================================================================

do $seed_prenotazioni$
declare
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  v_utente_id  uuid;
  v_giorno_futuro_1 timestamptz := date_trunc('day', now() + interval '2 days') + interval '10 hours';
  v_giorno_futuro_2 timestamptz := date_trunc('day', now() + interval '5 days') + interval '15 hours';
  v_giorno_passato  timestamptz := date_trunc('day', now() - interval '3 days') + interval '16 hours';
begin
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Manca il Condominio di Prova (%). Esegui prima 01_dati_prova.sql.', c_condominio;
  end if;

  select id into v_utente_id
  from public.utenti
  order by (id = 'b6e76a6a-bf37-43fd-b00b-efb1cb6921ad') desc, created_at asc
  limit 1;

  insert into public.risorse_prenotabili (id, condominio_id, nome, tariffa_oraria, max_ore)
  values
    ('d0000000-0000-4000-8000-000000000901', c_condominio, 'Parcheggio ospiti', 0.00, 4),
    ('d0000000-0000-4000-8000-000000000902', c_condominio, 'Campo da tennis', 12.50, 2),
    ('d0000000-0000-4000-8000-000000000903', c_condominio, 'Piscina condominiale', 5.00, 3),
    ('d0000000-0000-4000-8000-000000000904', c_condominio, 'Sala riunioni', 0.00, null)
  on conflict (id) do nothing;

  if v_utente_id is not null then
    if not exists (select 1 from public.prenotazioni_spazi where id = 'd0000000-0000-4000-8000-000000000911') then
      insert into public.prenotazioni_spazi (id, risorsa_id, utente_id, data_inizio, data_fine, costo_addebitato)
      values (
        'd0000000-0000-4000-8000-000000000911',
        'd0000000-0000-4000-8000-000000000902',
        v_utente_id,
        v_giorno_futuro_1,
        v_giorno_futuro_1 + interval '2 hours',
        25.00
      );
    end if;

    if not exists (select 1 from public.prenotazioni_spazi where id = 'd0000000-0000-4000-8000-000000000912') then
      insert into public.prenotazioni_spazi (id, risorsa_id, utente_id, data_inizio, data_fine, costo_addebitato)
      values (
        'd0000000-0000-4000-8000-000000000912',
        'd0000000-0000-4000-8000-000000000901',
        v_utente_id,
        v_giorno_futuro_2,
        v_giorno_futuro_2 + interval '3 hours',
        0.00
      );
    end if;

    if not exists (select 1 from public.prenotazioni_spazi where id = 'd0000000-0000-4000-8000-000000000913') then
      insert into public.prenotazioni_spazi (id, risorsa_id, utente_id, data_inizio, data_fine, costo_addebitato)
      values (
        'd0000000-0000-4000-8000-000000000913',
        'd0000000-0000-4000-8000-000000000903',
        v_utente_id,
        v_giorno_passato,
        v_giorno_passato + interval '2 hours',
        10.00
      );
    end if;
  end if;
end $seed_prenotazioni$;
