-- ==============================================================================
-- 09_fix_documenti_rls.sql
-- Risoluzione trap RLS durante clausola RETURNING su INSERT documenti_metadata
-- ==============================================================================

begin;

-- La policy di SELECT su documenti_metadata delega a can_read_documento(id).
-- Quando l'amministratore inserisce una riga con .select('id'), la funzione
-- can_read_documento(id) tenta di fare una SELECT su documenti_metadata prima che
-- la transazione sia committata, risultando in v_cond null e violazione RLS 42501.
--
-- Soluzione: La SELECT su documenti_metadata per l'amministratore del condominio
-- associato alla cartella deve essere valutata direttamente senza subquery su se stessa.

drop policy if exists "documenti_select" on public.documenti_metadata;
drop policy if exists documenti_metadata_select on public.documenti_metadata;
create policy documenti_metadata_select on public.documenti_metadata
    for select to authenticated
    using (
        public.is_superadmin()
        or public.is_admin_of(public.cond_of_cartella(cartella_id))
        or public.can_read_documento(id)
    );

commit;

-- =============================================================================
-- SEZIONE VERIFICA (eseguire manualmente dopo l'applicazione)
-- =============================================================================
-- select policyname, roles, cmd, qual
--   from pg_policies
--  where schemaname = 'public' and tablename = 'documenti_metadata';

-- =============================================================================
-- SEZIONE ROLLBACK (eseguire manualmente solo in caso di ripristino)
-- =============================================================================
-- drop policy if exists documenti_metadata_select on public.documenti_metadata;
-- create policy documenti_metadata_select on public.documenti_metadata
--     for select to authenticated
--     using (public.is_superadmin() or public.can_read_documento(id));
