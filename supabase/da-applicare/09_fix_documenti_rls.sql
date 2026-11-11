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

create or replace policy "documenti_select" on public.documenti_metadata
    for select using (
        public.is_admin_of(public.cond_of_cartella(cartella_id)) or
        public.can_read_documento(id)
    );

commit;
