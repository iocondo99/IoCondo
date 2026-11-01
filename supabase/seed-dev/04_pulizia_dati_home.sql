-- =============================================================================
-- PULIZIA DEI DATI DELLA HOME  (annulla 03_dati_home.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase, PRIMA di 02_pulizia_dati_prova.sql (che cancella il
-- condominio: le rate hanno chiavi esterne RESTRICT e lo bloccherebbero finché esistono).
-- Toglie SOLO le righe con gli id fissi d0000000-... creati da 03. Non tocca il condominio, le unità, i ruoli
-- né altri dati. Tutto in una transazione: se qualcosa blocca, non cambia niente.
--
-- Nota: un trigger impedisce di cancellare rate già incassate (importo_pagato > 0 o stato PAGATO). Per le
-- sole due rate di prova incassate lo script le riporta prima a "da pagare" (solo id d0000000-...-86 e -85)
-- e poi le cancella. Le rate vere non vengono toccate.
-- =============================================================================

do $pulizia$
declare
  c_esercizio constant uuid := 'd0000000-0000-4000-8000-000000000061';
begin
  -- Notifiche e comunicazioni
  delete from public.notifiche
  where id in ('d0000000-0000-4000-8000-000000000101', 'd0000000-0000-4000-8000-000000000102');
  delete from public.bacheca_post
  where id in ('d0000000-0000-4000-8000-000000000091', 'd0000000-0000-4000-8000-000000000092',
               'd0000000-0000-4000-8000-000000000093', 'd0000000-0000-4000-8000-000000000094');

  -- Documenti e cartella
  delete from public.documenti_metadata
  where id in ('d0000000-0000-4000-8000-000000000121', 'd0000000-0000-4000-8000-000000000122',
               'd0000000-0000-4000-8000-000000000123', 'd0000000-0000-4000-8000-000000000124',
               'd0000000-0000-4000-8000-000000000125', 'd0000000-0000-4000-8000-000000000126');
  delete from public.cartelle_documenti where id = 'd0000000-0000-4000-8000-000000000111';

  -- Assemblee
  delete from public.assemblee_testata
  where id in ('d0000000-0000-4000-8000-000000000131', 'd0000000-0000-4000-8000-000000000132',
               'd0000000-0000-4000-8000-000000000133');

  -- Rate: prima le due incassate di prova tornano "da pagare", poi si cancella il dettaglio e le testate
  update public.rate_dettaglio
     set importo_pagato = 0, stato = 'DA_PAGARE', data_pagamento = null
   where id in ('d0000000-0000-4000-8000-000000000085', 'd0000000-0000-4000-8000-000000000086');
  delete from public.rate_dettaglio
  where id in ('d0000000-0000-4000-8000-000000000081', 'd0000000-0000-4000-8000-000000000082',
               'd0000000-0000-4000-8000-000000000083', 'd0000000-0000-4000-8000-000000000084',
               'd0000000-0000-4000-8000-000000000085', 'd0000000-0000-4000-8000-000000000086',
               'd0000000-0000-4000-8000-000000000087', 'd0000000-0000-4000-8000-000000000088',
               'd0000000-0000-4000-8000-000000000089');
  delete from public.rate_testata
  where id in ('d0000000-0000-4000-8000-000000000071', 'd0000000-0000-4000-8000-000000000072',
               'd0000000-0000-4000-8000-000000000073', 'd0000000-0000-4000-8000-000000000074',
               'd0000000-0000-4000-8000-000000000075', 'd0000000-0000-4000-8000-000000000076',
               'd0000000-0000-4000-8000-000000000077');

  -- Esercizio di prova (solo se è il nostro e non ha più rate) e Palazzo B
  delete from public.esercizi_contabili e
  where e.id = c_esercizio
    and not exists (select 1 from public.rate_testata t where t.esercizio_id = e.id)
    and not exists (select 1 from public.movimenti_contabili m where m.esercizio_id = e.id);
  delete from public.palazzi where id = 'd0000000-0000-4000-8000-000000000004';

  raise notice 'Dati della Home rimossi.';
end
$pulizia$;
