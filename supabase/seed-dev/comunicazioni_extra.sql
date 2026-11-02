-- =============================================================================
-- DATI DI PROVA EXTRA PER LE COMUNICAZIONI (/comunicazioni) — NON è una migrazione
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase, DOPO 01_dati_prova.sql (ed eventualmente
-- dopo 03_dati_home.sql), sul progetto di prova (MVP).
--
-- Aggiunge 12 comunicazioni visibili al condòmino di prova (oltre a 1 riservata al Palazzo B,
-- che non compare nell'elenco e restituisce "Questa comunicazione non è disponibile" se aperta
-- per id), così da superare la soglia di 10 righe per pagina e poter provare:
--   - Paginazione (pagina 1 e pagina 2);
--   - Post fissati in cima (`is_pinned = true`, dichiarati con testo "Fissata in alto");
--   - Filtri per stato: Tutti, Non lette, Lette e "Azzera filtri";
--   - Ricerca per titolo e ordinamento per data;
--   - Comunicazioni con autore, senza autore (`autore_id = null`) e senza notifica collegata
--     (che mostrano "—" e non inventano lo stato "Letta");
--   - Apertura del dettaglio `/comunicazioni/[id]` e pulsante esplicito "Segna come letta".
--
-- PRIMA DI ESEGUIRLO
--   Incolla l'UUID dell'utente di prova (lo stesso usato in 01_dati_prova.sql) in v_utente_test_id.
--
-- GARANZIE
--   - Rieseguibile senza duplicati: id fissi (`d0000000-0000-4000-8000-0000000002..`) e
--     `on conflict (id) do update`, così rieseguirlo ripristina anche lo stato "Non letto"
--     delle notifiche di prova già aperte durante i test.
--   - Autore = utente di prova (o null): un eventuale webhook `notifiche-push` ignora l'autore
--     e non genera notifiche duplicate.
--   - Per rimuovere solo questi dati: `supabase/seed-dev/comunicazioni_extra_pulizia.sql`.
-- =============================================================================

do $seed$
declare
  -- >>> INCOLLA QUI L'UUID DELL'UTENTE DI PROVA <<<
  v_utente_test_id uuid := null;

  -- creati da 01_dati_prova.sql
  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_palazzo_a  constant uuid := 'd0000000-0000-4000-8000-000000000002';

  -- Palazzo B (condiviso con 03_dati_home.sql se già presente)
  c_palazzo_b  constant uuid := 'd0000000-0000-4000-8000-000000000004';
begin
  if v_utente_test_id is null then
    raise exception 'Incolla l''UUID dell''utente di prova nella costante v_utente_test_id (inizio dello script).';
  end if;
  if not exists (select 1 from public.utenti where id = v_utente_test_id) then
    raise exception 'L''utente % non esiste in "utenti".', v_utente_test_id;
  end if;
  if not exists (select 1 from public.condomini where id = c_condominio) then
    raise exception 'Manca il condominio di prova: esegui prima 01_dati_prova.sql.';
  end if;

  -- Assicura che esista il Palazzo B per la prova di isolamento tra edifici
  insert into public.palazzi (id, condominio_id, nome_identificativo, indirizzo)
  values (c_palazzo_b, c_condominio, 'Palazzo B', 'Via dei Test 3')
  on conflict (id) do nothing;

  -- ---- 12 comunicazioni visibili (2 fissate in alto + 10 ordinarie) + 1 del Palazzo B ----
  insert into public.bacheca_post (id, condominio_id, palazzo_id, autore_id, titolo, corpo, is_pinned, data_pubblicazione) values
    ('d0000000-0000-4000-8000-000000000201', c_condominio, null,        v_utente_test_id,
      'Regole per il conferimento dei rifiuti ingombranti',
      'Si ricorda che i materiali ingombranti non vanno lasciati nel locale bidoni. Il ritiro gratuito a domicilio va prenotato con il servizio comunale indicando il numero civico dello stabile.',
      true,  now() - interval '6 hours'),
    ('d0000000-0000-4000-8000-000000000202', c_condominio, c_palazzo_a, v_utente_test_id,
      'Numeri utili per le emergenze impianti del Palazzo A',
      'Per guasti urgenti all''impianto idrico o al portone automatico del Palazzo A in orario notturno o festivo è attivo il recapito della ditta incaricata esposto in bacheca all''ingresso.',
      true,  now() - interval '20 days'),
    ('d0000000-0000-4000-8000-000000000203', c_condominio, null,        v_utente_test_id,
      'Chiusura temporanea dell''acqua per sostituzione valvola',
      'Mercoledì prossimo dalle ore 9:30 alle ore 12:00 verrà sospesa l''erogazione dell''acqua per consentire la sostituzione della valvola principale nel locale contatori.',
      false, now() - interval '2 days'),
    ('d0000000-0000-4000-8000-000000000204', c_condominio, c_palazzo_a, v_utente_test_id,
      'Pulizia straordinaria delle scale del Palazzo A',
      'Venerdì mattina verrà eseguito il lavaggio di fondo dei pianerottoli del Palazzo A. Si chiede cortesemente di liberare i passaggi da zerbini e vasi.',
      false, now() - interval '4 days'),
    ('d0000000-0000-4000-8000-000000000205', c_condominio, null,        v_utente_test_id,
      'Verifica periodica dell''impianto di messa a terra',
      'Un tecnico abilitato effettuerà i controlli di legge sull''impianto elettrico delle parti comuni. Non è richiesto l''accesso agli appartamenti privati.',
      false, now() - interval '6 days'),
    ('d0000000-0000-4000-8000-000000000206', c_condominio, null,        null,
      'Potatura delle siepi del giardino condominiale',
      'La ditta del verde interverrà nella giornata di lunedì per la potatura delle siepi perimetrali e la raccolta del fogliame.',
      false, now() - interval '10 days'),
    ('d0000000-0000-4000-8000-000000000207', c_condominio, c_palazzo_a, v_utente_test_id,
      'Sostituzione lampade a LED nell''androne',
      'Sono state installate le nuove plafoniere a basso consumo nell''androne e lungo il vialetto pedonale del Palazzo A.',
      false, now() - interval '12 days'),
    ('d0000000-0000-4000-8000-000000000208', c_condominio, null,        v_utente_test_id,
      'Controllo estintori e porte tagliafuoco',
      'Il controllo semestrale dei presidi antincendio nei corselli dei box e nel locale centrale termica si è concluso regolarmente.',
      false, now() - interval '15 days'),
    ('d0000000-0000-4000-8000-000000000209', c_condominio, null,        null,
      'Nuovi codici di accesso per il cancello pedonale',
      'I telecomandi restano invariati; per chi utilizza la tastiera numerica il nuovo codice è disponibile in portineria.',
      false, now() - interval '18 days'),
    ('d0000000-0000-4000-8000-000000000210', c_condominio, null,        v_utente_test_id,
      'Lettura dei contabilizzatori del riscaldamento',
      'La lettura dei consumi avviene da remoto tramite centralina di piano: non occorre prendere appuntamento con l''operatore.',
      false, now() - interval '25 days'),
    ('d0000000-0000-4000-8000-000000000211', c_condominio, c_palazzo_a, v_utente_test_id,
      'Riparazione del chiudiporta del portone d''ingresso',
      'La molla idraulica del portone del Palazzo A è stata registrata per evitare chiusure rumorose.',
      false, now() - interval '30 days'),
    ('d0000000-0000-4000-8000-000000000212', c_condominio, null,        v_utente_test_id,
      'Calendario di accensione del riscaldamento centralizzato',
      'L''impianto seguirà gli orari stabiliti dal regolamento comunale: dalle 6:30 alle 9:30 e dalle 16:30 alle 22:00.',
      false, now() - interval '40 days'),
    ('d0000000-0000-4000-8000-000000000213', c_condominio, c_palazzo_b, v_utente_test_id,
      'Tinteggiatura del vano scala del Palazzo B',
      'Comunicazione riservata ai residenti del Palazzo B: chi ha unità solo nel Palazzo A non deve vederla.',
      false, now() - interval '5 days')
  on conflict (id) do update
    set condominio_id      = excluded.condominio_id,
        palazzo_id         = excluded.palazzo_id,
        autore_id          = excluded.autore_id,
        titolo             = excluded.titolo,
        corpo              = excluded.corpo,
        is_pinned          = excluded.is_pinned,
        data_pubblicazione = excluded.data_pubblicazione;

  -- ---- Notifiche collegate per l'utente di prova (4 non lette, 5 lette; 3 post restano senza notifica) ----
  insert into public.notifiche (id, utente_id, condominio_id, titolo, corpo, tipo, riferimento_tabella, riferimento_id, letta, created_at) values
    ('d0000000-0000-4000-8000-000000000251', v_utente_test_id, c_condominio,
      'Regole per il conferimento dei rifiuti ingombranti', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000201', false, now() - interval '6 hours'),
    ('d0000000-0000-4000-8000-000000000252', v_utente_test_id, c_condominio,
      'Numeri utili per le emergenze impianti del Palazzo A', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000202', true,  now() - interval '20 days'),
    ('d0000000-0000-4000-8000-000000000253', v_utente_test_id, c_condominio,
      'Chiusura temporanea dell''acqua per sostituzione valvola', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000203', false, now() - interval '2 days'),
    ('d0000000-0000-4000-8000-000000000254', v_utente_test_id, c_condominio,
      'Pulizia straordinaria delle scale del Palazzo A', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000204', false, now() - interval '4 days'),
    ('d0000000-0000-4000-8000-000000000255', v_utente_test_id, c_condominio,
      'Verifica periodica dell''impianto di messa a terra', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000205', true,  now() - interval '6 days'),
    ('d0000000-0000-4000-8000-000000000256', v_utente_test_id, c_condominio,
      'Potatura delle siepi del giardino condominiale', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000206', true,  now() - interval '10 days'),
    ('d0000000-0000-4000-8000-000000000257', v_utente_test_id, c_condominio,
      'Sostituzione lampade a LED nell''androne', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000207', true,  now() - interval '12 days'),
    ('d0000000-0000-4000-8000-000000000258', v_utente_test_id, c_condominio,
      'Controllo estintori e porte tagliafuoco', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000208', false, now() - interval '15 days'),
    ('d0000000-0000-4000-8000-000000000259', v_utente_test_id, c_condominio,
      'Nuovi codici di accesso per il cancello pedonale', 'Nuova comunicazione in bacheca.', 'BACHECA', 'bacheca_post',
      'd0000000-0000-4000-8000-000000000209', true,  now() - interval '18 days')
  on conflict (id) do update
    set utente_id           = excluded.utente_id,
        condominio_id       = excluded.condominio_id,
        titolo              = excluded.titolo,
        corpo               = excluded.corpo,
        tipo                = excluded.tipo,
        riferimento_tabella = excluded.riferimento_tabella,
        riferimento_id      = excluded.riferimento_id,
        letta               = excluded.letta,
        created_at          = excluded.created_at;

  raise notice 'Comunicazioni extra di prova pronte per il condominio %.', c_condominio;
end
$seed$;

