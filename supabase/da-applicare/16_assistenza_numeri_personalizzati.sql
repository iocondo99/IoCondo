-- Migrazione 16: Personalizzazione titolo e numero delle card in Assistenza
-- Aggiunge la colonna jsonb `numeri_assistenza` a `public.configurazioni_condominio`
-- per consentire all'amministratore di personalizzare titolo e numero delle card
-- nella sezione Assistenza (/assistenza, /admin/assistenza).
-- Le policy RLS esistenti su `configurazioni_condominio` garantiscono:
--   - lettura ai membri del condominio (has_cond_access)
--   - scrittura al solo amministratore del condominio (is_admin_of)
-- Idempotente: usa ADD COLUMN IF NOT EXISTS.

alter table public.configurazioni_condominio
    add column if not exists numeri_assistenza jsonb;

comment on column public.configurazioni_condominio.numeri_assistenza is
    'Elenco JSON di override {id, titolo, numero} per le card dei numeri utili nella sezione Assistenza';
