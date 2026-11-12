-- =============================================================================
-- DATI DI PROVA PER RACCOLTA DIFFERENZIATA (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase sul progetto di prova (MVP),
-- DOPO 01_dati_prova.sql (che crea il "Condominio di Prova").
--
-- GARANZIE
--   - Idempotente: UUID fissi (prefisso d0000000-...050x) + "on conflict do nothing".
--   - Verifica l'esistenza del Condominio di Prova prima di inserire.
--   - Per annullare: eseguire raccolta_differenziata_extra_pulizia.sql.
-- =============================================================================

do $seed$
declare
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Manca il Condominio di Prova (%). Esegui prima 01_dati_prova.sql.', c_condominio;
  end if;

  insert into public.raccolta_differenziata (id, condominio_id, tipo_rifiuto, giorno_settimana, note)
  values
    ('d0000000-0000-4000-8000-000000000501', c_condominio, 'Umido / Organico', 1, 'Esporre entro le 7:00 nel mastello marrone davanti al passo carraio.'),
    ('d0000000-0000-4000-8000-000000000502', c_condominio, 'Carta e cartone', 1, 'Piegare gli scatoloni e legarli o usare il contenitore bianco.'),
    ('d0000000-0000-4000-8000-000000000503', c_condominio, 'Plastica e metalli', 3, 'Sacco giallo semitrasparente entro le 7:00.'),
    ('d0000000-0000-4000-8000-000000000504', c_condominio, 'Umido / Organico', 4, 'Esporre entro le 7:00 nel mastello marrone.'),
    ('d0000000-0000-4000-8000-000000000505', c_condominio, 'Vetro', 5, 'Conferire senza sacchetti nel bidone verde entro le 8:00.'),
    ('d0000000-0000-4000-8000-000000000506', c_condominio, 'Indifferenziato', 6, 'Sacco grigio entro le 7:00. Non inserire rifiuti riciclabili.'),
    ('d0000000-0000-4000-8000-000000000507', c_condominio, 'Sfalci e potature', 2, 'Solo su prenotazione in portineria nei mesi primaverili ed estivi.')
  on conflict (id) do nothing;
end $seed$;
