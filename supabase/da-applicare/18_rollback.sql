-- Rollback di 18_elimina_account.sql (non eseguito).
-- ATTENZIONE: il ripristino dei vincoli fallisce se esistono gia' righe con utente_id NULL
-- (account eliminati nel frattempo): in quel caso vanno gestite prima a mano.
begin;
drop function if exists public.prepara_eliminazione_account(uuid);
drop function if exists public.stato_eliminazione_account();
drop function if exists public.puo_eliminare_account(uuid);

alter table public.prenotazioni_spazi drop constraint if exists prenotazioni_spazi_utente_id_fkey;
alter table public.prenotazioni_spazi
    add constraint prenotazioni_spazi_utente_id_fkey
    foreign key (utente_id) references public.utenti (id) on delete cascade;
alter table public.prenotazioni_spazi alter column utente_id set not null;

alter table public.sondaggi_voti drop constraint if exists sondaggi_voti_utente_id_fkey;
alter table public.sondaggi_voti
    add constraint sondaggi_voti_utente_id_fkey
    foreign key (utente_id) references public.utenti (id) on delete cascade;
alter table public.sondaggi_voti alter column utente_id set not null;

alter table public.piani_rateizzazione drop constraint if exists piani_rateizzazione_utente_id_fkey;
alter table public.piani_rateizzazione
    add constraint piani_rateizzazione_utente_id_fkey
    foreign key (utente_id) references public.utenti (id) on delete cascade;
alter table public.piani_rateizzazione alter column utente_id set not null;

alter table public.anagrafiche_unita drop constraint if exists anagrafiche_unita_utente_id_fkey;
alter table public.anagrafiche_unita
    add constraint anagrafiche_unita_utente_id_fkey
    foreign key (utente_id) references public.utenti (id) on delete restrict;
alter table public.anagrafiche_unita alter column utente_id set not null;
alter table public.anagrafiche_unita drop column if exists nome_cognome_storico;
commit;
