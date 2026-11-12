-- =====================================================================
-- 12_verifica.sql
-- Script di verifica per la migrazione 12_ticket_ambiti_comuni.sql.
-- Eseguibile in sola lettura per confermare la corretta applicazione.
-- =====================================================================

do $verifica_12$
declare
    v_has_palazzo_col boolean;
    v_has_scala_col   boolean;
    v_has_check       boolean;
    v_has_fn_palazzo  boolean;
    v_has_fn_scala    boolean;
    v_has_select_pol  boolean;
    v_has_insert_pol  boolean;
    v_has_update_pol  boolean;
    v_has_delete_pol  boolean;
begin
    -- 1. Verifica colonne
    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ticket_testata' and column_name = 'palazzo_id'
    ) into v_has_palazzo_col;

    select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ticket_testata' and column_name = 'scala_colonna_id'
    ) into v_has_scala_col;

    -- 2. Verifica vincolo di coerenza
    select exists (
        select 1 from pg_constraint
        where conname = 'ticket_testata_scala_palazzo_check'
    ) into v_has_check;

    -- 3. Verifica funzioni di sicurezza
    select exists (
        select 1 from pg_proc
        where proname = 'has_palazzo_access'
    ) into v_has_fn_palazzo;

    select exists (
        select 1 from pg_proc
        where proname = 'has_scala_access'
    ) into v_has_fn_scala;

    -- 4. Verifica policy RLS
    select exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'ticket_testata' and policyname = 'ticket_testata_select'
    ) into v_has_select_pol;

    select exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'ticket_testata' and policyname = 'ticket_testata_insert'
    ) into v_has_insert_pol;

    select exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'ticket_testata' and policyname = 'ticket_testata_update'
    ) into v_has_update_pol;

    select exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'ticket_testata' and policyname = 'ticket_testata_delete'
    ) into v_has_delete_pol;

    if not (v_has_palazzo_col and v_has_scala_col and v_has_check and v_has_fn_palazzo and v_has_fn_scala
            and v_has_select_pol and v_has_insert_pol and v_has_update_pol and v_has_delete_pol) then
        raise exception 'VERIFICA 12 FALLITA: uno o più elementi non sono stati creati correttamente. '
            'palazzo_col=%, scala_col=%, check=%, fn_palazzo=%, fn_scala=%, pol_sel=%, pol_ins=%, pol_upd=%, pol_del=%',
            v_has_palazzo_col, v_has_scala_col, v_has_check, v_has_fn_palazzo, v_has_fn_scala,
            v_has_select_pol, v_has_insert_pol, v_has_update_pol, v_has_delete_pol;
    end if;

    raise notice 'VERIFICA 12 COMPLETATA CON SUCCESSO: schema e RLS ticket ambiti comuni operativi.';
end
$verifica_12$;
