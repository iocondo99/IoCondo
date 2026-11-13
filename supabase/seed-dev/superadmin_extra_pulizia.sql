-- =============================================================================
-- PULIZIA DATI DI PROVA SUPER AMMINISTRATORE (idempotente)
-- =============================================================================

delete from public.fatture_saas
where id in ('d0000000-0000-4000-8000-000000000906', 'd0000000-0000-4000-8000-000000000907');

delete from public.unita_immobiliari
where id = 'd0000000-0000-4000-8000-000000000905';

delete from public.palazzi
where id = 'd0000000-0000-4000-8000-000000000904';

delete from public.condomini
where id = 'd0000000-0000-4000-8000-000000000903';

delete from public.licenze_saas
where id = 'd0000000-0000-4000-8000-000000000902';

update public.condomini
set attivo = true
where id = 'd0000000-0000-4000-8000-000000000001';
