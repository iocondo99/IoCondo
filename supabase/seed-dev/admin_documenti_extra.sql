-- =============================================================================
-- DATI DI PROVA PER LA GESTIONE DOCUMENTI E DRIVE CONDOMINIALE (Amministratore)
-- (NON è una migrazione)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase sul progetto di prova.
-- Crea:
--   - 3 Cartelle ufficiali per il Condominio di Prova:
--       1. "Verbali assemblee"
--       2. "Contratti e polizze"
--       3. "Regolamento e tabelle"
--   - 4 Documenti metadata con percorsi coerenti:
--       1. Verbale assemblea ordinaria 2026.pdf (Pubblico, cartella Verbali)
--       2. Polizza assicurativa globale fabbricati 2026.pdf (Pubblico, cartella Contratti)
--       3. Regolamento condominiale approvato.pdf (Pubblico, cartella Regolamento)
--       4. Prospetto millesimi e riparto riservato Int. 1.pdf (Riservato Int. 1, cartella Regolamento)
--
-- GARANZIE:
--   - Idempotente e rieseguibile senza duplicati (id deterministici fissi e ON CONFLICT DO UPDATE)
--   - RLS coerente: i percorsi storage iniziano con il condominio_id per le policy di documenti-condominio
--   - Per rimuovere i dati: supabase/seed-dev/admin_documenti_extra_pulizia.sql
-- =============================================================================

do $seed_admin_documenti$
declare
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_unita_int1 constant uuid := 'd0000000-0000-4000-8000-000000000011';
  v_admin_id   constant uuid := '10000000-0000-4000-8000-000000000001';

  -- Cartelle
  c_cart_verbali     constant uuid := 'd0000000-0000-4000-8000-000000000711';
  c_cart_contratti   constant uuid := 'd0000000-0000-4000-8000-000000000712';
  c_cart_regolamento constant uuid := 'd0000000-0000-4000-8000-000000000713';

  -- Documenti
  c_doc_verbale      constant uuid := 'd0000000-0000-4000-8000-000000000721';
  c_doc_polizza      constant uuid := 'd0000000-0000-4000-8000-000000000722';
  c_doc_regolamento  constant uuid := 'd0000000-0000-4000-8000-000000000723';
  c_doc_int1         constant uuid := 'd0000000-0000-4000-8000-000000000724';
begin
  -- 1. Verifica esistenza condominio di prova
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Il condominio di prova (%) non esiste. Esegui prima 01_dati_prova.sql.', c_condominio;
  end if;

  -- 2. Inserimento / Aggiornamento Cartelle
  insert into public.cartelle_documenti (id, condominio_id, parent_id, nome_cartella, created_at)
  values
    (c_cart_verbali, c_condominio, null, 'Verbali assemblee', '2026-03-01 10:00:00+00'),
    (c_cart_contratti, c_condominio, null, 'Contratti e polizze', '2026-03-01 10:05:00+00'),
    (c_cart_regolamento, c_condominio, null, 'Regolamento e tabelle', '2026-03-01 10:10:00+00')
  on conflict (id) do update set
    nome_cartella = excluded.nome_cartella,
    condominio_id = excluded.condominio_id;

  -- 3. Inserimento / Aggiornamento Documenti Metadata
  -- 3 Documenti pubblici (unita_id = null)
  insert into public.documenti_metadata (
    id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da, created_at
  )
  values
    (
      c_doc_verbale,
      c_cart_verbali,
      null,
      'd0000000-0000-4000-8000-000000000001/verbali/verbale_assemblea_ordinaria_2026.pdf',
      'Verbale assemblea ordinaria 2026.pdf',
      'application/pdf',
      v_admin_id,
      '2026-04-10 15:30:00+00'
    ),
    (
      c_doc_polizza,
      c_cart_contratti,
      null,
      'd0000000-0000-4000-8000-000000000001/contratti/polizza_assicurativa_fabbricati_2026.pdf',
      'Polizza assicurativa globale fabbricati 2026.pdf',
      'application/pdf',
      v_admin_id,
      '2026-03-15 09:20:00+00'
    ),
    (
      c_doc_regolamento,
      c_cart_regolamento,
      null,
      'd0000000-0000-4000-8000-000000000001/regolamenti/regolamento_condominiale_approvato.pdf',
      'Regolamento condominiale approvato.pdf',
      'application/pdf',
      v_admin_id,
      '2026-02-20 11:00:00+00'
    ),
    -- 1 Documento riservato all'Unità Int. 1
    (
      c_doc_int1,
      c_cart_regolamento,
      c_unita_int1,
      'd0000000-0000-4000-8000-000000000001/unita-1/prospetto_millesimi_riservato_int1.pdf',
      'Prospetto millesimi e riparto riservato Int. 1.pdf',
      'application/pdf',
      v_admin_id,
      '2026-04-12 17:45:00+00'
    )
  on conflict (id) do update set
    cartella_id = excluded.cartella_id,
    unita_id = excluded.unita_id,
    url_storage = excluded.url_storage,
    nome_file = excluded.nome_file,
    tipo_mime = excluded.tipo_mime;

  raise notice 'Dati di prova per admin_documenti inseriti con successo.';
end;
$seed_admin_documenti$;
