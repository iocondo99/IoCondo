-- =============================================================================
-- 10_rollback.sql
-- Script di rollback completo e reversibile per 10_contabilita_schema_modello_obiettivo.sql
-- Ripristina lo schema contabile allo stato precedente al Passo 0 (RC-O5, T19).
-- NON eseguire finche' 10_contabilita_schema_modello_obiettivo.sql non e' stata applicata.
-- =============================================================================

begin;

set search_path = public, extensions;

-- =============================================================================
-- 1. RIMOZIONE TRIGGER E FUNZIONI INTRODOTTE DAL PASSO 0
-- =============================================================================

do $$
declare
    t text;
begin
    -- Rimuove il trigger di sincronizzazione bidirezionale centesimi / condominio_id
    foreach t in array array[
        'quote_millesimali',
        'movimenti_contabili',
        'rate_testata',
        'rate_dettaglio',
        'saldi_pregressi',
        'pagamenti_rate',
        'transazioni_bancarie',
        'riconciliazioni_log'
    ] loop
        execute format('drop trigger if exists trg_sync_contabilita_row on public.%I', t);
    end loop;

    -- Rimuove trg_set_updated_at dalle tabelle esistenti cui era stato aggiunto (quote_millesimali, saldi_pregressi)
    foreach t in array array['quote_millesimali', 'saldi_pregressi'] loop
        execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    end loop;

    -- Rimuove trg_audit dalle tabelle esistenti cui era stato esteso in 10 (esercizi_contabili, tabelle_millesimali, movimenti_contabili)
    foreach t in array array['esercizi_contabili', 'tabelle_millesimali', 'movimenti_contabili'] loop
        execute format('drop trigger if exists trg_audit on public.%I', t);
    end loop;
end $$;

drop function if exists public.sync_contabilita_row();

-- Ripristina la definizione originale di audit_row_change() da 05_security_hardening.sql
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.audit_logs (utente_id, azione, tabella, record_id)
    values (auth.uid(), tg_op, tg_table_name,
            coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid));
    if tg_op = 'DELETE' then return old; end if;
    return new;
exception when others then
    raise warning 'audit_row_change: %', sqlerrm;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

-- Ripristina la policy originale audit_logs_select da 02_rls_policies.sql
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
    for select to authenticated
    using (public.is_superadmin() or (false));

-- =============================================================================
-- 2. RIMOZIONE VINCOLI INCROCIATI E CHECK AGGIUNTI ALLE TABELLE ESISTENTI
-- =============================================================================

alter table public.anagrafiche_unita
    drop constraint if exists anagrafiche_unita_soggetto_id_fkey;

alter table public.movimenti_contabili
    drop constraint if exists movimenti_contabili_gestione_id_fkey,
    drop constraint if exists movimenti_contabili_voce_spesa_id_fkey,
    drop constraint if exists movimenti_contabili_fondo_id_fkey,
    drop constraint if exists movimenti_eccezione_cc_motivo_chk,
    drop constraint if exists movimenti_importo_centesimi_sync_chk;

alter table public.rate_testata
    drop constraint if exists rate_testata_gestione_id_fkey,
    drop constraint if exists rate_testata_preventivo_id_fkey,
    drop constraint if exists rate_testata_override_motivo_chk;

alter table public.rate_dettaglio
    drop constraint if exists rate_dettaglio_soggetto_id_fkey,
    drop constraint if exists rate_dettaglio_bollettino_id_fkey,
    drop constraint if exists rate_dettaglio_centesimi_sync_chk;

alter table public.saldi_pregressi
    drop constraint if exists saldi_pregressi_gestione_id_fkey,
    drop constraint if exists saldi_pregressi_soggetto_id_fkey,
    drop constraint if exists saldi_pregressi_centesimi_sync_chk;

alter table public.pagamenti_rate
    drop constraint if exists pagamenti_rate_centesimi_sync_chk;

alter table public.transazioni_bancarie
    drop constraint if exists transazioni_bancarie_centesimi_sync_chk;

alter table public.riconciliazioni_log
    drop constraint if exists riconciliazioni_log_bollettino_id_fkey;

-- =============================================================================
-- 3. RIMOZIONE DELLE NUOVE TABELLE (IN ORDINE INVERSO DI DIPENDENZA)
-- =============================================================================

drop table if exists public.conguagli_unita cascade;
drop table if exists public.scadenziario_recupero_crediti cascade;
drop table if exists public.bollettini_righe cascade;
drop table if exists public.bollettini cascade;
drop table if exists public.letture_contatori cascade;
drop table if exists public.riparti_spese cascade;
drop table if exists public.preventivi_voci cascade;
drop table if exists public.preventivi cascade;
drop table if exists public.gestioni_esercizio cascade;
drop table if exists public.movimenti_fondo cascade;
drop table if exists public.fondi cascade;
drop table if exists public.voci_spesa_catalogo cascade;
drop table if exists public.assegnazioni_amministratore cascade;
drop table if exists public.soggetti_contabili cascade;
drop table if exists public.migrazioni_contabilita_log cascade;

drop function if exists public.has_readonly_audit_access(uuid);

-- =============================================================================
-- 4. RIMOZIONE DELLE COLONNE AGGIUNTE ALLE TABELLE ESISTENTI
-- =============================================================================

alter table public.configurazioni_condominio
    drop column if exists abilita_contabilita_nuova,
    drop column if exists quota_fissa_riscaldamento_perc,
    drop column if exists quota_fissa_acqua_perc,
    drop column if exists ordine_imputazione_incassi,
    drop column if exists decorrenza_recupero_mesi,
    drop column if exists esigibilita_rate_preventivo,
    drop column if exists interessi_mora_tasso_annuo,
    drop column if exists interessi_mora_giorni_tolleranza,
    drop column if exists interessi_mora_fonte;

alter table public.fornitori
    drop column if exists condominio_id,
    drop column if exists codice_fiscale,
    drop column if exists pec,
    drop column if exists indirizzo;

alter table public.anagrafiche_unita
    drop column if exists condominio_id,
    drop column if exists soggetto_id,
    drop column if exists ruolo_titolarita,
    drop column if exists is_referente_bollettino,
    drop column if exists contratto_inizio,
    drop column if exists contratto_fine,
    drop column if exists patto_contrario_oneri,
    drop column if exists tabella_oneri_custom,
    drop column if exists regola_usufrutto_custom,
    drop column if exists data_atto_subentro,
    drop column if exists dante_causa_utente_id,
    drop column if exists note_patto_straordinarie,
    drop column if exists autore_id;

alter table public.esercizi_contabili
    drop column if exists stato_modello,
    drop column if exists data_chiusura_effettiva,
    drop column if exists data_approvazione_rendiconto,
    drop column if exists delibera_approvazione,
    drop column if exists scadenza_approvazione_180gg,
    drop column if exists saldo_iniziale_conto_centesimi,
    drop column if exists saldo_iniziale_cassa_centesimi,
    drop column if exists saldo_finale_conto_centesimi,
    drop column if exists saldo_finale_cassa_centesimi,
    drop column if exists stato_rendiconto,
    drop column if exists nota_sintetica_esplicativa,
    drop column if exists riepilogo_finanziario_json,
    drop column if exists registro_contabilita_completo,
    drop column if exists versione_lock,
    drop column if exists autore_id;

alter table public.tabelle_millesimali
    drop column if exists tipo,
    drop column if exists origine,
    drop column if exists tabella_sorgente_id,
    drop column if exists da_rigenerare,
    drop column if exists stato_approvazione,
    drop column if exists data_approvazione,
    drop column if exists delibera_riferimento,
    drop column if exists valida_da,
    drop column if exists valida_a,
    drop column if exists versione,
    drop column if exists precedente_id,
    drop column if exists autore_id;

alter table public.quote_millesimali
    drop column if exists condominio_id,
    drop column if exists valore_millesimi_int,
    drop column if exists autore_id,
    drop column if exists created_at,
    drop column if exists updated_at;

alter table public.movimenti_contabili
    drop column if exists condominio_id,
    drop column if exists gestione_id,
    drop column if exists voce_spesa_id,
    drop column if exists numero_progressivo,
    drop column if exists data_registrazione,
    drop column if exists importo_centesimi,
    drop column if exists tag_spesa,
    drop column if exists competenza_da,
    drop column if exists competenza_a,
    drop column if exists chi_paga,
    drop column if exists tabella_millesimale_id,
    drop column if exists versione_tabella,
    drop column if exists palazzo_id,
    drop column if exists scala_colonna_id,
    drop column if exists atto_deroga_tipo,
    drop column if exists atto_deroga_data,
    drop column if exists atto_deroga_numero,
    drop column if exists motivazione_deroga,
    drop column if exists delibera_riferimento,
    drop column if exists stato_spesa,
    drop column if exists storno_di_id,
    drop column if exists eccezione_conto_corrente,
    drop column if exists motivo_eccezione_cc,
    drop column if exists impronta_file_giustificativo,
    drop column if exists imponibile_centesimi,
    drop column if exists iva_centesimi,
    drop column if exists ritenuta_acconto_centesimi,
    drop column if exists ritenuta_aliquota_perc,
    drop column if exists numero_fattura,
    drop column if exists data_scadenza_fattura,
    drop column if exists fondo_id,
    drop column if exists versione_motore_calcolo,
    drop column if exists autore_id;

alter table public.rate_testata
    drop column if exists condominio_id,
    drop column if exists gestione_id,
    drop column if exists preventivo_id,
    drop column if exists versione_preventivo,
    drop column if exists stato_preventivo,
    drop column if exists data_approvazione_preventivo,
    drop column if exists delibera_approvazione,
    drop column if exists emessa_con_override,
    drop column if exists motivo_override,
    drop column if exists delibera_override,
    drop column if exists numero_rata,
    drop column if exists percentuale_preventivo,
    drop column if exists autore_id;

alter table public.rate_dettaglio
    drop column if exists condominio_id,
    drop column if exists soggetto_id,
    drop column if exists obbligato_in_solido_utente_id,
    drop column if exists importo_dovuto_centesimi,
    drop column if exists importo_pagato_centesimi,
    drop column if exists stato_rata_modello,
    drop column if exists data_esigibilita,
    drop column if exists bollettino_id,
    drop column if exists versione_motore_calcolo,
    drop column if exists autore_id;

alter table public.saldi_pregressi
    drop column if exists condominio_id,
    drop column if exists gestione_id,
    drop column if exists soggetto_id,
    drop column if exists obbligato_in_solido_utente_id,
    drop column if exists anno_competenza,
    drop column if exists importo_centesimi,
    drop column if exists importo_pagato_centesimi,
    drop column if exists data_esigibilita,
    drop column if exists autore_id,
    drop column if exists updated_at;

alter table public.pagamenti_rate
    drop column if exists condominio_id,
    drop column if exists importo_centesimi,
    drop column if exists pagatore_nome,
    drop column if exists pagatore_utente_id,
    drop column if exists riferimento_cro,
    drop column if exists data_valuta,
    drop column if exists storno_di_id,
    drop column if exists autore_id;

alter table public.transazioni_bancarie
    drop column if exists importo_centesimi,
    drop column if exists pagatore_nome,
    drop column if exists riferimento_cro,
    drop column if exists storno_di_id,
    drop column if exists autore_id;

alter table public.riconciliazioni_log
    drop column if exists condominio_id,
    drop column if exists importo_assegnato_centesimi,
    drop column if exists bollettino_id,
    drop column if exists saldo_pregresso_id,
    drop column if exists autore_id;

alter table public.audit_logs
    drop column if exists condominio_id,
    drop column if exists valore_prima,
    drop column if exists valore_dopo,
    drop column if exists motivo;

commit;
