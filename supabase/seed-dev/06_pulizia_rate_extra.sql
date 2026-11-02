-- =============================================================================
-- PULIZIA DEI DATI RATE EXTRA  (annulla 05_rate_extra.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor, PRIMA di 04_pulizia_dati_home.sql e di 02_pulizia_dati_prova.sql
-- (le rate usano l'esercizio di 03: finché ci sono, 04 non può toglierlo).
-- Toglie SOLO le righe con gli id fissi d0000000-0000-4000-8000-0000000002xx / 3xx create da 05. Non tocca
-- il condominio, le unità, l'esercizio di 03, le rate di 03, il Storage né gli utenti.
--
-- Nota: un trigger impedisce di cancellare rate già incassate (importo_pagato > 0 o stato PAGATO). Per le
-- sole rate di prova incassate (id ...222, ...224, ...231, ...233, ...234) lo script le riporta prima a
-- "da pagare" e poi le cancella. Le rate vere non vengono toccate.
-- Un solo blocco `do`: se qualcosa blocca, non cambia niente.
-- =============================================================================

do $pulizia$
declare
  c_esercizio_prec constant uuid := 'd0000000-0000-4000-8000-000000000062';
  c_tabella        constant uuid := 'd0000000-0000-4000-8000-000000000301';
  v_rate constant uuid[] := array[
    'd0000000-0000-4000-8000-000000000221', 'd0000000-0000-4000-8000-000000000222',
    'd0000000-0000-4000-8000-000000000223', 'd0000000-0000-4000-8000-000000000224',
    'd0000000-0000-4000-8000-000000000225', 'd0000000-0000-4000-8000-000000000229',
    'd0000000-0000-4000-8000-000000000230', 'd0000000-0000-4000-8000-000000000231',
    'd0000000-0000-4000-8000-000000000232', 'd0000000-0000-4000-8000-000000000233',
    'd0000000-0000-4000-8000-000000000234', 'd0000000-0000-4000-8000-000000000241',
    'd0000000-0000-4000-8000-000000000242'
  ]::uuid[];
begin
  -- Le rate incassate di prova tornano "da pagare", così il trigger permette di cancellarle
  update public.rate_dettaglio
     set importo_pagato = 0, stato = 'DA_PAGARE', data_pagamento = null
   where id = any (v_rate) and (importo_pagato > 0 or stato = 'PAGATO');

  delete from public.rate_dettaglio where id = any (v_rate);

  delete from public.rate_testata
  where id in (
    'd0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000202',
    'd0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000204',
    'd0000000-0000-4000-8000-000000000205', 'd0000000-0000-4000-8000-000000000206',
    'd0000000-0000-4000-8000-000000000207', 'd0000000-0000-4000-8000-000000000208',
    'd0000000-0000-4000-8000-000000000209', 'd0000000-0000-4000-8000-000000000210',
    'd0000000-0000-4000-8000-000000000211', 'd0000000-0000-4000-8000-000000000212'
  );

  -- Tabella millesimale di prova (le quote vanno via in cascata)
  delete from public.tabelle_millesimali where id = c_tabella;

  -- Esercizio dell'anno scorso: solo se è quello creato da 05 e non ha più rate né movimenti
  delete from public.esercizi_contabili e
  where e.id = c_esercizio_prec
    and not exists (select 1 from public.rate_testata t where t.esercizio_id = e.id)
    and not exists (select 1 from public.movimenti_contabili m where m.esercizio_id = e.id);

  raise notice 'Dati rate extra rimossi. Se hai caricato un PDF in Storage (ricevute-rate) toglilo a mano.';
end
$pulizia$;
