-- Rollback migrazione 11: rimozione colonne estese
alter table public.configurazioni_condominio
    drop column if exists abilita_spese,
    drop column if exists abilita_pagamenti,
    drop column if exists abilita_documenti,
    drop column if exists abilita_assemblee,
    drop column if exists abilita_raccolta_differenziata;
