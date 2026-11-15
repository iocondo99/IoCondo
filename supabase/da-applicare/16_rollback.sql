-- Rollback Migrazione 16
alter table public.configurazioni_condominio
    drop column if exists numeri_assistenza;
