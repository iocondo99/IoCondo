-- =============================================================================
-- PULIZIA DATI DI TEST: INCASSI, MOROSITA', RECUPERO CREDITI E SUBENTRI (SEZIONE 7)
-- =============================================================================
-- Rimuove in ordine inverso di dipendenza (FK) tutti i record creati da:
--   supabase/seed-dev/admin_contabilita_morosita_extra.sql
-- Totalmente idempotente e sicuro.
-- =============================================================================

do $cleanup_admin_contabilita_morosita$
begin
  -- 1. Audit logs dedicati alla Sezione 7 (prefisso 179x)
  delete from public.audit_logs
  where id in (
    'd0000000-0000-4000-8000-000000001791',
    'd0000000-0000-4000-8000-000000001792',
    'd0000000-0000-4000-8000-000000001793',
    'd0000000-0000-4000-8000-000000001794',
    'd0000000-0000-4000-8000-000000001795'
  );

  -- 2. Conguagli unità (prefisso 178x)
  delete from public.conguagli_unita
  where id in (
    'd0000000-0000-4000-8000-000000001781',
    'd0000000-0000-4000-8000-000000001782'
  );

  -- 3. Scadenziario recupero crediti ex art. 1129 c. 9 c.c. (prefisso 177x)
  delete from public.scadenziario_recupero_crediti
  where id in (
    'd0000000-0000-4000-8000-000000001771',
    'd0000000-0000-4000-8000-000000001772',
    'd0000000-0000-4000-8000-000000001773',
    'd0000000-0000-4000-8000-000000001774'
  );

  -- 4. Riconciliazioni log e Pagamenti rate (prefisso 176x)
  delete from public.riconciliazioni_log
  where id in (
    'd0000000-0000-4000-8000-000000001766',
    'd0000000-0000-4000-8000-000000001767',
    'd0000000-0000-4000-8000-000000001768'
  );

  delete from public.pagamenti_rate
  where id in (
    'd0000000-0000-4000-8000-000000001761',
    'd0000000-0000-4000-8000-000000001762',
    'd0000000-0000-4000-8000-000000001763'
  );

  -- 5. Transazioni bancarie (prima lo storno che referenzia l'originale via storno_di_id, poi le altre, prefisso 175x)
  delete from public.transazioni_bancarie
  where id = 'd0000000-0000-4000-8000-000000001753';

  delete from public.transazioni_bancarie
  where id in (
    'd0000000-0000-4000-8000-000000001751',
    'd0000000-0000-4000-8000-000000001752'
  );

  -- 6. Rate dettaglio e Rate testata (prefisso 174x e 173x)
  delete from public.rate_dettaglio
  where id in (
    'd0000000-0000-4000-8000-000000001741',
    'd0000000-0000-4000-8000-000000001742',
    'd0000000-0000-4000-8000-000000001743',
    'd0000000-0000-4000-8000-000000001744',
    'd0000000-0000-4000-8000-000000001745'
  );

  delete from public.rate_testata
  where id in (
    'd0000000-0000-4000-8000-000000001731',
    'd0000000-0000-4000-8000-000000001732'
  );

  -- 7. Saldi pregressi T6 (prefisso 172x)
  delete from public.saldi_pregressi
  where id in (
    'd0000000-0000-4000-8000-000000001721',
    'd0000000-0000-4000-8000-000000001722'
  );

  -- 8. Anagrafiche unità di subentro e locazione (prefisso 171x)
  delete from public.anagrafiche_unita
  where id in (
    'd0000000-0000-4000-8000-000000001711',
    'd0000000-0000-4000-8000-000000001712',
    'd0000000-0000-4000-8000-000000001713'
  );

  -- 9. Esercizi storici 2023 e 2025 creati appositamente per T6 e Soggetti contabili (prefisso 170x)
  delete from public.esercizi_contabili
  where id in (
    'd0000000-0000-4000-8000-000000001705',
    'd0000000-0000-4000-8000-000000001706'
  );

  delete from public.soggetti_contabili
  where id in (
    'd0000000-0000-4000-8000-000000001701',
    'd0000000-0000-4000-8000-000000001702',
    'd0000000-0000-4000-8000-000000001703',
    'd0000000-0000-4000-8000-000000001704'
  );

  raise notice 'Pulizia admin_contabilita_morosita_extra_pulizia completata con successo.';
end
$cleanup_admin_contabilita_morosita$;
