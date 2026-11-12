-- Migrazione 11: Estensione Feature Toggles Condominio
-- Aggiunge le colonne per il controllo granulare di tutte le schermate residenti:
-- spese, pagamenti, documenti, assemblee, raccolta differenziata.
-- Idempotente: usa ADD COLUMN IF NOT EXISTS. Default TRUE per non interrompere i condomini esistenti.

alter table public.configurazioni_condominio
    add column if not exists abilita_spese boolean not null default true,
    add column if not exists abilita_pagamenti boolean not null default true,
    add column if not exists abilita_documenti boolean not null default true,
    add column if not exists abilita_assemblee boolean not null default true,
    add column if not exists abilita_raccolta_differenziata boolean not null default true;

comment on column public.configurazioni_condominio.abilita_spese is 'Abilita la sezione Spese per i residenti del condominio/palazzo';
comment on column public.configurazioni_condominio.abilita_pagamenti is 'Abilita la sezione Pagamenti per i residenti del condominio/palazzo';
comment on column public.configurazioni_condominio.abilita_documenti is 'Abilita la sezione Documenti per i residenti del condominio/palazzo';
comment on column public.configurazioni_condominio.abilita_assemblee is 'Abilita la sezione Assemblee per i residenti del condominio/palazzo';
comment on column public.configurazioni_condominio.abilita_raccolta_differenziata is 'Abilita il calendario Raccolta Differenziata per i residenti del condominio/palazzo';
