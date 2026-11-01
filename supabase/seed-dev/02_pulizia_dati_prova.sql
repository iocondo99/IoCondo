-- =============================================================================
-- PULIZIA DEI DATI DI PROVA  (annulla 01_dati_prova.sql)
-- =============================================================================
-- Da eseguire A MANO dal SQL Editor di Supabase. Toglie SOLO ciò che ha gli id fissi
-- d0000000-... creati da 01_dati_prova.sql. Non tocca altri condomini, utenti o dati.
--
-- Se hai eseguito 03_dati_home.sql, esegui PRIMA 04_pulizia_dati_home.sql (le rate bloccherebbero la cancellazione).
--
-- Cosa succede:
--   - si cancella il condominio di prova: per le chiavi esterne con ON DELETE CASCADE spariscono
--     insieme il palazzo, le unità, le anagrafiche, i ruoli, le configurazioni e le notifiche collegati;
--   - se in quel condominio hai creato altri dati che lo bloccano (chiavi RESTRICT) lo script si ferma
--     con un errore e non cancella niente (è tutto in una transazione);
--   - gli utenti (Authentication > Users e riga in `utenti`) NON vengono cancellati: se vuoi toglierli
--     fallo dalla dashboard;
--   - il flag super amministratore si toglie solo se incolli qui sotto l'UUID dell'utente super.
-- =============================================================================

do $pulizia$
declare
  -- Facoltativo: incolla l'UUID dell'utente super per togliergli il flag is_superadmin.
  v_utente_super_id uuid := null;

  c_condominio constant uuid := 'd0000000-0000-4000-8000-000000000001';
begin
  -- Notifiche di prova (anche se non fossero più legate al condominio)
  delete from public.notifiche
  where id in ('d0000000-0000-4000-8000-000000000051', 'd0000000-0000-4000-8000-000000000052');

  -- Il resto cade a cascata dal condominio (palazzi -> unità -> anagrafiche, ruoli, configurazioni)
  delete from public.condomini where id = c_condominio;

  if v_utente_super_id is not null then
    update public.utenti set is_superadmin = false where id = v_utente_super_id and is_superadmin = true;
  end if;

  raise notice 'Dati di prova rimossi.';
end
$pulizia$;
