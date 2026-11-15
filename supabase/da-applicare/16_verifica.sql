-- Verifica Migrazione 16: controlla esistenza della colonna numeri_assistenza
select
    column_name,
    data_type,
    is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'configurazioni_condominio'
  and column_name = 'numeri_assistenza';
