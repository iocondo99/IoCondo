-- Verifica migrazione 11: colonne estese su configurazioni_condominio
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'configurazioni_condominio'
  and column_name in (
    'abilita_spese',
    'abilita_pagamenti',
    'abilita_documenti',
    'abilita_assemblee',
    'abilita_raccolta_differenziata'
  )
order by column_name;
