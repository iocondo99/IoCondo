-- =============================================================================
-- Verifica migrazione 13: Super Amministratore SaaS & Kill-Switch Condominio
-- =============================================================================

-- 1. Colonna attivo su condomini e indice
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'condomini'
  and column_name = 'attivo';

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'condomini'
  and indexname = 'idx_condomini_attivo';

-- 2. Piano Unico presente
select id, nome, prezzo_mensile, limite_unita, feature_premium
from public.piani_abbonamento
where nome = 'Piano Unico Piattaforma';

-- 3. Trigger di protezione attivo
select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'condomini'
  and trigger_name = 'trg_condomini_attivo_only_superadmin';

-- 4. Policy aggiornate su condomini
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'condomini'
order by policyname;
