-- =============================================================================
-- 10_contabilita_schema_modello_obiettivo.sql
-- Passo 0 Modulo Contabile: Adeguamento additivo e idempotente al Modello Obiettivo
-- Copertura: Requisiti RC-O1 .. RC-O13, RC-A .. RC-N e Test di Regressione T18 .. T22
-- =============================================================================
-- REGOLE DI SICUREZZA E RETROCOMPATIBILITA' (RC-O2, RC-O3, RC-O5, RC-O10):
--   1. Nessuna tabella o colonna esistente viene eliminata o rinominata (T20, T21).
--   2. Strategia a due passi per gli importi (RC-O10, T18, T21):
--      - Si affiancano le colonne `*_centesimi bigint` ai campi `numeric(14,2)` / `numeric(12,2)`.
--      - Si popolano i centesimi dai valori esistenti con `round(importo * 100)::bigint`.
--      - Un trigger bidirezionale `BEFORE INSERT OR UPDATE` mantiene allineati `numeric` e
--        `*_centesimi` per garantire zero regressioni sul codice esistente (T20).
--   3. Isolamento tenant rigoroso (`condominio_id` su ogni tabella contabile, T22):
--      - Popolamento retroattivo di `condominio_id` sulle righe figlie esistenti.
--      - Risoluzione automatica via trigger se un client legacy inserisce senza `condominio_id`.
--   4. Transazione unica atomica: se un controllo pre/post migrazione fallisce, l'intera
--      migrazione viene annullata (RC-O12, T19).
-- =============================================================================

begin;

set search_path = public, extensions;

-- =============================================================================
-- 0. REGISTRO ESITI MIGRAZIONI CONTABILI (RC-O12, T19)
-- =============================================================================

create table if not exists public.migrazioni_contabilita_log (
    id                uuid primary key default uuid_generate_v4(),
    codice_migrazione text not null,
    stato             text not null check (stato in ('AVVIATA','COMPLETATA','FALLITA','ROLLBACK')),
    conteggi_prima    jsonb not null default '{}'::jsonb,
    conteggi_dopo     jsonb not null default '{}'::jsonb,
    somme_prima       jsonb not null default '{}'::jsonb,
    somme_dopo        jsonb not null default '{}'::jsonb,
    righe_orfane      integer not null default 0 check (righe_orfane >= 0),
    note              text,
    eseguita_at       timestamptz not null default now()
);
create index if not exists idx_migrazioni_cont_codice on public.migrazioni_contabilita_log (codice_migrazione);
alter table public.migrazioni_contabilita_log enable row level security;

-- =============================================================================
-- 1. ESTENSIONE TABELLE ESISTENTI (RC-O2, RC-O4, RC-O9, RC-O10, RC-O13)
-- =============================================================================

-- 1.1 Configurazioni condominio: interruttore rilascio graduale (RC-O13) e parametri contabili
alter table public.configurazioni_condominio
    add column if not exists abilita_contabilita_nuova        boolean not null default false,
    add column if not exists quota_fissa_riscaldamento_perc   numeric(5,2) not null default 30.00 check (quota_fissa_riscaldamento_perc >= 0 and quota_fissa_riscaldamento_perc <= 100),
    add column if not exists quota_fissa_acqua_perc           numeric(5,2) not null default 0.00 check (quota_fissa_acqua_perc >= 0 and quota_fissa_acqua_perc <= 100),
    add column if not exists ordine_imputazione_incassi       text not null default 'PIU_VECCHIO' check (ordine_imputazione_incassi in ('PIU_VECCHIO','PIU_RECENTE','MANUALE')),
    add column if not exists decorrenza_recupero_mesi         text not null default 'CHIUSURA_ESERCIZIO' check (decorrenza_recupero_mesi in ('CHIUSURA_ESERCIZIO','APPROVAZIONE_RENDICONTO')),
    add column if not exists esigibilita_rate_preventivo      text not null default 'SCADENZA_RATA' check (esigibilita_rate_preventivo in ('SCADENZA_RATA','APPROVAZIONE_CONSUNTIVO')),
    add column if not exists interessi_mora_tasso_annuo       numeric(6,3) not null default 0 check (interessi_mora_tasso_annuo >= 0),
    add column if not exists interessi_mora_giorni_tolleranza integer not null default 0 check (interessi_mora_giorni_tolleranza >= 0),
    add column if not exists interessi_mora_fonte             text check (interessi_mora_fonte in ('REGOLAMENTO','DELIBERA','LEGGE'));

-- 1.2 Fornitori: dati fiscali completi e legame opzionale al condominio (RC-A8, RC-B5, RC-O4)
alter table public.fornitori
    add column if not exists condominio_id  uuid references public.condomini (id) on delete set null,
    add column if not exists codice_fiscale text,
    add column if not exists pec            text,
    add column if not exists indirizzo      text;

create index if not exists idx_fornitori_condominio on public.fornitori (condominio_id);

-- 1.3 Titolarità unità (`anagrafiche_unita`): ruoli estesi, contratti locazione, patti contrari e subentri (RC-A9..A12, RC-H1..H3, RC-I3..I5)
alter table public.anagrafiche_unita
    add column if not exists condominio_id            uuid references public.condomini (id) on delete cascade,
    add column if not exists soggetto_id              uuid,
    add column if not exists ruolo_titolarita         text not null default 'PROPRIETARIO' check (ruolo_titolarita in ('PROPRIETARIO','COMPROPRIETARIO','USUFRUTTUARIO','NUDO_PROPRIETARIO','CONDUTTORE')),
    add column if not exists is_referente_bollettino  boolean not null default true,
    add column if not exists contratto_inizio         date,
    add column if not exists contratto_fine           date,
    add column if not exists patto_contrario_oneri    boolean not null default false,
    add column if not exists tabella_oneri_custom     jsonb,
    add column if not exists regola_usufrutto_custom  jsonb,
    add column if not exists data_atto_subentro       date,
    add column if not exists dante_causa_utente_id    uuid references public.utenti (id) on delete set null,
    add column if not exists note_patto_straordinarie text,
    add column if not exists autore_id                uuid references public.utenti (id) on delete set null;

create index if not exists idx_anagrafiche_condominio  on public.anagrafiche_unita (condominio_id);
create index if not exists idx_anagrafiche_soggetto    on public.anagrafiche_unita (soggetto_id);
create index if not exists idx_anagrafiche_dante_causa on public.anagrafiche_unita (dante_causa_utente_id);
create index if not exists idx_anagrafiche_autore      on public.anagrafiche_unita (autore_id);

-- 1.4 Esercizi contabili (`esercizi_contabili`): stati modello, rendiconto in 3 documenti, saldi in centesimi e lock ottimistico (RC-D1, RC-K1..K8, T15)
alter table public.esercizi_contabili
    add column if not exists stato_modello                  text not null default 'APERTO' check (stato_modello in ('APERTO','CHIUSO','RENDICONTO_APPROVATO')),
    add column if not exists data_chiusura_effettiva        date,
    add column if not exists data_approvazione_rendiconto   date,
    add column if not exists delibera_approvazione          text,
    add column if not exists scadenza_approvazione_180gg    date,
    add column if not exists saldo_iniziale_conto_centesimi bigint not null default 0,
    add column if not exists saldo_iniziale_cassa_centesimi bigint not null default 0,
    add column if not exists saldo_finale_conto_centesimi   bigint not null default 0,
    add column if not exists saldo_finale_cassa_centesimi   bigint not null default 0,
    add column if not exists stato_rendiconto               text not null default 'IN_PREPARAZIONE' check (stato_rendiconto in ('IN_PREPARAZIONE','COMPLETO','APPROVATO','RETTIFICATO')),
    add column if not exists nota_sintetica_esplicativa     text,
    add column if not exists riepilogo_finanziario_json     jsonb,
    add column if not exists registro_contabilita_completo  boolean not null default false,
    add column if not exists versione_lock                  integer not null default 1 check (versione_lock >= 1),
    add column if not exists autore_id                      uuid references public.utenti (id) on delete set null;

create index if not exists idx_esercizi_autore on public.esercizi_contabili (autore_id);

-- 1.5 Tabelle millesimali (`tabelle_millesimali`): tipologia, origine, stato approvazione, delibera e versionamento (RC-O4, RC-A3..A7)
alter table public.tabelle_millesimali
    add column if not exists tipo                 text not null default 'PROPRIETA' check (tipo in ('PROPRIETA','SCALA','ASCENSORE','RISCALDAMENTO','ACQUA','USO','ALTRA')),
    add column if not exists origine              text not null default 'INSERITA' check (origine in ('INSERITA','DERIVATA')),
    add column if not exists tabella_sorgente_id  uuid references public.tabelle_millesimali (id) on delete set null,
    add column if not exists da_rigenerare        boolean not null default false,
    add column if not exists stato_approvazione   text not null default 'APPROVATA' check (stato_approvazione in ('BOZZA','APPROVATA')),
    add column if not exists data_approvazione    date,
    add column if not exists delibera_riferimento text,
    add column if not exists valida_da            date not null default current_date,
    add column if not exists valida_a             date,
    add column if not exists versione             integer not null default 1 check (versione >= 1),
    add column if not exists precedente_id        uuid references public.tabelle_millesimali (id) on delete set null,
    add column if not exists autore_id            uuid references public.utenti (id) on delete set null;

create index if not exists idx_tabmill_sorgente   on public.tabelle_millesimali (tabella_sorgente_id);
create index if not exists idx_tabmill_precedente on public.tabelle_millesimali (precedente_id);
create index if not exists idx_tabmill_autore     on public.tabelle_millesimali (autore_id);

-- 1.6 Quote millesimali (`quote_millesimali`): riferimento condominio, millesimi interi (x1000) e audit (RC-O4, RC-A3)
alter table public.quote_millesimali
    add column if not exists condominio_id        uuid references public.condomini (id) on delete cascade,
    add column if not exists valore_millesimi_int integer not null default 0 check (valore_millesimi_int >= 0),
    add column if not exists autore_id            uuid references public.utenti (id) on delete set null,
    add column if not exists created_at           timestamptz not null default now(),
    add column if not exists updated_at           timestamptz not null default now();

create index if not exists idx_quotemill_condominio on public.quote_millesimali (condominio_id);
create index if not exists idx_quotemill_autore     on public.quote_millesimali (autore_id);

-- 1.7 Movimenti contabili e Spese (`movimenti_contabili`): centesimi interi, eccezione c/c, competenza, criterio, delibera, storno, dati fattura (RC-B1..B5, RC-C1..C8, T18)
alter table public.movimenti_contabili
    add column if not exists condominio_id                uuid references public.condomini (id) on delete restrict,
    add column if not exists gestione_id                  uuid,
    add column if not exists voce_spesa_id                uuid,
    add column if not exists numero_progressivo           integer,
    add column if not exists data_registrazione           date not null default current_date,
    add column if not exists importo_centesimi            bigint not null default 0 check (importo_centesimi >= 0),
    add column if not exists tag_spesa                    text not null default 'ORDINARIA' check (tag_spesa in ('ORDINARIA','STRAORDINARIA')),
    add column if not exists competenza_da                date,
    add column if not exists competenza_a                 date,
    add column if not exists chi_paga                     text not null default 'TUTTI' check (chi_paga in ('TUTTI','PALAZZO_SCALA','TABELLA_SPECIFICA','PERSONALIZZATO','CONSUMI')),
    add column if not exists tabella_millesimale_id       uuid references public.tabelle_millesimali (id) on delete set null,
    add column if not exists versione_tabella             integer not null default 1 check (versione_tabella >= 1),
    add column if not exists palazzo_id                   uuid references public.palazzi (id) on delete set null,
    add column if not exists scala_colonna_id             uuid references public.scale_colonne (id) on delete set null,
    add column if not exists atto_deroga_tipo             text check (atto_deroga_tipo in ('REGOLAMENTO_CONTRATTUALE','DELIBERA_UNANIME','DELIBERA_ASSEMBLEA')),
    add column if not exists atto_deroga_data             date,
    add column if not exists atto_deroga_numero           text,
    add column if not exists motivazione_deroga           text,
    add column if not exists delibera_riferimento         text,
    add column if not exists stato_spesa                  text not null default 'REGISTRATA' check (stato_spesa in ('BOZZA','REGISTRATA','STORNATA')),
    add column if not exists storno_di_id                 uuid references public.movimenti_contabili (id) on delete restrict,
    add column if not exists eccezione_conto_corrente     boolean not null default false,
    add column if not exists motivo_eccezione_cc          text,
    add column if not exists impronta_file_giustificativo text,
    add column if not exists imponibile_centesimi         bigint check (imponibile_centesimi is null or imponibile_centesimi >= 0),
    add column if not exists iva_centesimi                bigint check (iva_centesimi is null or iva_centesimi >= 0),
    add column if not exists ritenuta_acconto_centesimi   bigint check (ritenuta_acconto_centesimi is null or ritenuta_acconto_centesimi >= 0),
    add column if not exists ritenuta_aliquota_perc       numeric(5,2) check (ritenuta_aliquota_perc is null or (ritenuta_aliquota_perc >= 0 and ritenuta_aliquota_perc <= 100)),
    add column if not exists numero_fattura               text,
    add column if not exists data_scadenza_fattura        date,
    add column if not exists fondo_id                     uuid,
    add column if not exists versione_motore_calcolo      text not null default '1.0.0',
    add column if not exists autore_id                    uuid references public.utenti (id) on delete set null;

create index if not exists idx_movimenti_condominio on public.movimenti_contabili (condominio_id);
create index if not exists idx_movimenti_gestione   on public.movimenti_contabili (gestione_id);
create index if not exists idx_movimenti_voce       on public.movimenti_contabili (voce_spesa_id);
create index if not exists idx_movimenti_tabmill    on public.movimenti_contabili (tabella_millesimale_id);
create index if not exists idx_movimenti_palazzo    on public.movimenti_contabili (palazzo_id);
create index if not exists idx_movimenti_scala      on public.movimenti_contabili (scala_colonna_id);
create index if not exists idx_movimenti_storno     on public.movimenti_contabili (storno_di_id);
create index if not exists idx_movimenti_fondo      on public.movimenti_contabili (fondo_id);
create index if not exists idx_movimenti_autore     on public.movimenti_contabili (autore_id);

-- 1.8 Testata rate (`rate_testata`): versionamento preventivo, approvazione, delibera e override tracciato (RC-O4, RC-D1..D5, T16)
alter table public.rate_testata
    add column if not exists condominio_id                uuid references public.condomini (id) on delete restrict,
    add column if not exists gestione_id                  uuid,
    add column if not exists preventivo_id                uuid,
    add column if not exists versione_preventivo          integer not null default 1 check (versione_preventivo >= 1),
    add column if not exists stato_preventivo             text not null default 'APPROVATO' check (stato_preventivo in ('BOZZA','APPROVATO','SUPERATO')),
    add column if not exists data_approvazione_preventivo date,
    add column if not exists delibera_approvazione        text,
    add column if not exists emessa_con_override          boolean not null default false,
    add column if not exists motivo_override              text,
    add column if not exists delibera_override            text,
    add column if not exists numero_rata                  integer check (numero_rata is null or numero_rata >= 1),
    add column if not exists percentuale_preventivo       numeric(5,2) check (percentuale_preventivo is null or (percentuale_preventivo > 0 and percentuale_preventivo <= 100)),
    add column if not exists autore_id                    uuid references public.utenti (id) on delete set null;

create index if not exists idx_ratetestata_condominio on public.rate_testata (condominio_id);
create index if not exists idx_ratetestata_gestione   on public.rate_testata (gestione_id);
create index if not exists idx_ratetestata_preventivo on public.rate_testata (preventivo_id);
create index if not exists idx_ratetestata_autore     on public.rate_testata (autore_id);

-- 1.9 Dettaglio rate (`rate_dettaglio`): importi in centesimi interi, stato modello, esigibilità, coobbligato in solido, bollettino (RC-D3, RC-G2, RC-H2, T6, T18)
alter table public.rate_dettaglio
    add column if not exists condominio_id                 uuid references public.condomini (id) on delete restrict,
    add column if not exists soggetto_id                   uuid,
    add column if not exists obbligato_in_solido_utente_id uuid references public.utenti (id) on delete set null,
    add column if not exists importo_dovuto_centesimi      bigint not null default 0 check (importo_dovuto_centesimi >= 0),
    add column if not exists importo_pagato_centesimi      bigint not null default 0 check (importo_pagato_centesimi >= 0),
    add column if not exists stato_rata_modello            text not null default 'EMESSA' check (stato_rata_modello in ('PIANIFICATA','EMESSA','PARZIALMENTE_PAGATA','PAGATA')),
    add column if not exists data_esigibilita              date,
    add column if not exists bollettino_id                 uuid,
    add column if not exists versione_motore_calcolo       text not null default '1.0.0',
    add column if not exists autore_id                     uuid references public.utenti (id) on delete set null;

create index if not exists idx_ratedettaglio_condominio on public.rate_dettaglio (condominio_id);
create index if not exists idx_ratedettaglio_soggetto   on public.rate_dettaglio (soggetto_id);
create index if not exists idx_ratedettaglio_solido     on public.rate_dettaglio (obbligato_in_solido_utente_id);
create index if not exists idx_ratedettaglio_bollettino on public.rate_dettaglio (bollettino_id);
create index if not exists idx_ratedettaglio_autore     on public.rate_dettaglio (autore_id);

-- 1.10 Saldi pregressi (`saldi_pregressi`): centesimi interi, anno competenza per biennio solidarietà ex art. 63 disp. att. e coobbligato (RC-G1, RC-H2, T6, T18)
alter table public.saldi_pregressi
    add column if not exists condominio_id                 uuid references public.condomini (id) on delete cascade,
    add column if not exists gestione_id                   uuid,
    add column if not exists soggetto_id                   uuid,
    add column if not exists obbligato_in_solido_utente_id uuid references public.utenti (id) on delete set null,
    add column if not exists anno_competenza               integer check (anno_competenza is null or anno_competenza between 1990 and 2100),
    add column if not exists importo_centesimi             bigint not null default 0,
    add column if not exists importo_pagato_centesimi      bigint not null default 0 check (importo_pagato_centesimi >= 0),
    add column if not exists data_esigibilita              date,
    add column if not exists autore_id                     uuid references public.utenti (id) on delete set null,
    add column if not exists updated_at                    timestamptz not null default now();

create index if not exists idx_saldi_condominio on public.saldi_pregressi (condominio_id);
create index if not exists idx_saldi_gestione   on public.saldi_pregressi (gestione_id);
create index if not exists idx_saldi_soggetto   on public.saldi_pregressi (soggetto_id);
create index if not exists idx_saldi_solido     on public.saldi_pregressi (obbligato_in_solido_utente_id);
create index if not exists idx_saldi_autore     on public.saldi_pregressi (autore_id);

-- 1.11 Pagamenti rate (`pagamenti_rate`): centesimi interi, pagatore terzo (inquilino/altro), CRO, valuta e storno (RC-F1..F4, T18)
alter table public.pagamenti_rate
    add column if not exists condominio_id      uuid references public.condomini (id) on delete restrict,
    add column if not exists importo_centesimi  bigint not null default 0 check (importo_centesimi >= 0),
    add column if not exists pagatore_nome      text,
    add column if not exists pagatore_utente_id uuid references public.utenti (id) on delete set null,
    add column if not exists riferimento_cro    text,
    add column if not exists data_valuta        date,
    add column if not exists storno_di_id       uuid references public.pagamenti_rate (id) on delete restrict,
    add column if not exists autore_id          uuid references public.utenti (id) on delete set null;

create index if not exists idx_pagamenti_condominio on public.pagamenti_rate (condominio_id);
create index if not exists idx_pagamenti_pagatore   on public.pagamenti_rate (pagatore_utente_id);
create index if not exists idx_pagamenti_storno     on public.pagamenti_rate (storno_di_id);
create index if not exists idx_pagamenti_autore     on public.pagamenti_rate (autore_id);

-- 1.12 Transazioni bancarie e Riconciliazioni (`transazioni_bancarie`, `riconciliazioni_log`): centesimi interi, pagatore, CRO, imputazione su bollettini e saldi pregressi (RC-F1..F4, T11, T18)
alter table public.transazioni_bancarie
    add column if not exists importo_centesimi bigint not null default 0,
    add column if not exists pagatore_nome     text,
    add column if not exists riferimento_cro   text,
    add column if not exists storno_di_id      uuid references public.transazioni_bancarie (id) on delete restrict,
    add column if not exists autore_id         uuid references public.utenti (id) on delete set null;

create index if not exists idx_transazioni_storno on public.transazioni_bancarie (storno_di_id);
create index if not exists idx_transazioni_autore on public.transazioni_bancarie (autore_id);

alter table public.riconciliazioni_log
    add column if not exists condominio_id               uuid references public.condomini (id) on delete cascade,
    add column if not exists importo_assegnato_centesimi bigint,
    add column if not exists bollettino_id               uuid,
    add column if not exists saldo_pregresso_id          uuid references public.saldi_pregressi (id) on delete cascade,
    add column if not exists autore_id                   uuid references public.utenti (id) on delete set null;

create index if not exists idx_riconciliazioni_condominio on public.riconciliazioni_log (condominio_id);
create index if not exists idx_riconciliazioni_bollettino on public.riconciliazioni_log (bollettino_id);
create index if not exists idx_riconciliazioni_saldo      on public.riconciliazioni_log (saldo_pregresso_id);
create index if not exists idx_riconciliazioni_autore     on public.riconciliazioni_log (autore_id);

-- 1.13 Audit logs (`audit_logs`): condominio, valore prima/dopo e motivo (RC-M1, RC-O4)
alter table public.audit_logs
    add column if not exists condominio_id uuid references public.condomini (id) on delete set null,
    add column if not exists valore_prima  jsonb,
    add column if not exists valore_dopo   jsonb,
    add column if not exists motivo        text;

create index if not exists idx_audit_logs_condominio on public.audit_logs (condominio_id);

-- =============================================================================
-- 2. NUOVE TABELLE DEL MODELLO OBIETTIVO (RC-O2, Sezione 3)
-- =============================================================================

-- 2.1 Soggetti contabili separati dall'unità (RC-A8)
create table if not exists public.soggetti_contabili (
    id                 uuid primary key default uuid_generate_v4(),
    condominio_id      uuid not null references public.condomini (id) on delete cascade,
    utente_id          uuid references public.utenti (id) on delete set null,
    fornitore_id       uuid references public.fornitori (id) on delete set null,
    tipo_soggetto      text not null default 'PERSONA_FISICA' check (tipo_soggetto in ('PERSONA_FISICA','PERSONA_GIURIDICA')),
    nome_denominazione text not null,
    codice_fiscale     text,
    partita_iva        text,
    indirizzo          text,
    citta              text,
    cap                text,
    provincia          char(2),
    email              text,
    pec                text,
    telefono           text,
    iban               text,
    autore_id          uuid references public.utenti (id) on delete set null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists idx_soggetti_condominio on public.soggetti_contabili (condominio_id);
create index if not exists idx_soggetti_utente     on public.soggetti_contabili (utente_id);
create index if not exists idx_soggetti_fornitore  on public.soggetti_contabili (fornitore_id);
create index if not exists idx_soggetti_autore     on public.soggetti_contabili (autore_id);
alter table public.soggetti_contabili enable row level security;

-- 2.2 Assegnazioni amministratore e passaggio di consegne (RC-A13..A16, T17)
create table if not exists public.assegnazioni_amministratore (
    id                        uuid primary key default uuid_generate_v4(),
    condominio_id             uuid not null references public.condomini (id) on delete cascade,
    admin_id                  uuid not null references public.utenti (id) on delete restrict,
    ruolo_incarico            text not null default 'AMMINISTRATORE' check (ruolo_incarico in ('AMMINISTRATORE','COLLABORATORE','REVISORE','CONSIGLIERE')),
    permessi_collaboratore    jsonb not null default '{}'::jsonb,
    data_nomina               date not null,
    data_cessazione           date,
    delibera_nomina           text,
    compenso_annuo_centesimi  bigint not null default 0 check (compenso_annuo_centesimi >= 0),
    dettaglio_compenso        jsonb not null default '[]'::jsonb,
    is_attivo                 boolean not null default true,
    autore_id                 uuid references public.utenti (id) on delete set null,
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now(),
    check (data_cessazione is null or data_cessazione >= data_nomina)
);
create unique index if not exists idx_assegnazioni_unico_admin_attivo
    on public.assegnazioni_amministratore (condominio_id)
    where ruolo_incarico = 'AMMINISTRATORE' and is_attivo = true and data_cessazione is null;
create index if not exists idx_assegnazioni_condominio on public.assegnazioni_amministratore (condominio_id);
create index if not exists idx_assegnazioni_admin      on public.assegnazioni_amministratore (admin_id);
create index if not exists idx_assegnazioni_autore     on public.assegnazioni_amministratore (autore_id);
alter table public.assegnazioni_amministratore enable row level security;

-- 2.3 Catalogo configurabile delle voci di spesa (RC-C2, RC-I2, RC-I4, T10)
create table if not exists public.voci_spesa_catalogo (
    id                           uuid primary key default uuid_generate_v4(),
    condominio_id                uuid not null references public.condomini (id) on delete cascade,
    sottoconto_id                uuid references public.sottoconti (id) on delete set null,
    codice                       text not null,
    nome                         text not null,
    tag_default                  text not null default 'ORDINARIA' check (tag_default in ('ORDINARIA','STRAORDINARIA')),
    criterio_default             text not null default 'TUTTI' check (criterio_default in ('TUTTI','PALAZZO_SCALA','TABELLA_SPECIFICA','PERSONALIZZATO','CONSUMI','PRESET_1124','PRESET_1125','PRESET_1126')),
    tabella_default_id           uuid references public.tabelle_millesimali (id) on delete set null,
    quota_inquilino_default_perc numeric(5,2) not null default 0 check (quota_inquilino_default_perc >= 0 and quota_inquilino_default_perc <= 100),
    is_a_periodo                 boolean not null default false,
    is_compenso_admin            boolean not null default false,
    attiva                       boolean not null default true,
    autore_id                    uuid references public.utenti (id) on delete set null,
    created_at                   timestamptz not null default now(),
    updated_at                   timestamptz not null default now(),
    unique (condominio_id, codice)
);
create index if not exists idx_vocispesa_condominio on public.voci_spesa_catalogo (condominio_id);
create index if not exists idx_vocispesa_sottoconto on public.voci_spesa_catalogo (sottoconto_id);
create index if not exists idx_vocispesa_tabella    on public.voci_spesa_catalogo (tabella_default_id);
create index if not exists idx_vocispesa_autore     on public.voci_spesa_catalogo (autore_id);
alter table public.voci_spesa_catalogo enable row level security;

-- 2.4 Fondi condominiali e Movimenti Fondo (RC-J1..J5, T7)
create table if not exists public.fondi (
    id                          uuid primary key default uuid_generate_v4(),
    condominio_id               uuid not null references public.condomini (id) on delete cascade,
    esercizio_id                uuid references public.esercizi_contabili (id) on delete set null,
    nome                        text not null,
    tipo                        text not null check (tipo in ('SPECIALE','CASSA','MOROSITA')),
    delibera_costituzione       text,
    data_delibera               date,
    importo_lavori_centesimi    bigint check (importo_lavori_centesimi is null or importo_lavori_centesimi >= 0),
    importo_obiettivo_centesimi bigint not null default 0 check (importo_obiettivo_centesimi >= 0),
    saldo_attuale_centesimi     bigint not null default 0,
    is_progressivo_sal          boolean not null default false,
    contratto_appalto_ref       text,
    stato                       text not null default 'ATTIVO' check (stato in ('ATTIVO','VINCOLATO','CHIUSO')),
    autore_id                   uuid references public.utenti (id) on delete set null,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now()
);
create index if not exists idx_fondi_condominio on public.fondi (condominio_id);
create index if not exists idx_fondi_esercizio  on public.fondi (esercizio_id);
create index if not exists idx_fondi_autore     on public.fondi (autore_id);
alter table public.fondi enable row level security;

create table if not exists public.movimenti_fondo (
    id                     uuid primary key default uuid_generate_v4(),
    condominio_id          uuid not null references public.condomini (id) on delete cascade,
    fondo_id               uuid not null references public.fondi (id) on delete restrict,
    movimento_contabile_id uuid references public.movimenti_contabili (id) on delete set null,
    data                   date not null default current_date,
    importo_centesimi      bigint not null check (importo_centesimi > 0),
    segno                  char(1) not null check (segno in ('+','-')),
    causale                text not null,
    is_override_vincolo    boolean not null default false,
    motivo_override        text,
    delibera_override      text,
    autore_id              uuid references public.utenti (id) on delete set null,
    created_at             timestamptz not null default now()
);
create index if not exists idx_movfondo_condominio on public.movimenti_fondo (condominio_id);
create index if not exists idx_movfondo_fondo      on public.movimenti_fondo (fondo_id);
create index if not exists idx_movfondo_movcont    on public.movimenti_fondo (movimento_contabile_id);
create index if not exists idx_movfondo_autore     on public.movimenti_fondo (autore_id);
alter table public.movimenti_fondo enable row level security;

-- 2.5 Gestioni contabili dentro l'esercizio: ordinaria, straordinaria, riscaldamento (RC-D1, Sez. 3)
create table if not exists public.gestioni_esercizio (
    id                       uuid primary key default uuid_generate_v4(),
    condominio_id            uuid not null references public.condomini (id) on delete cascade,
    esercizio_id             uuid not null references public.esercizi_contabili (id) on delete cascade,
    tipo                     text not null check (tipo in ('ORDINARIA','STRAORDINARIA','RISCALDAMENTO')),
    nome                     text not null,
    descrizione              text,
    delibera_riferimento     text,
    data_delibera            date,
    importo_lavori_centesimi bigint check (importo_lavori_centesimi is null or importo_lavori_centesimi >= 0),
    fondo_speciale_id        uuid references public.fondi (id) on delete set null,
    stato                    text not null default 'ATTIVA' check (stato in ('ATTIVA','CHIUSA','ANNULLATA')),
    autore_id                uuid references public.utenti (id) on delete set null,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now()
);
create index if not exists idx_gestioni_condominio on public.gestioni_esercizio (condominio_id);
create index if not exists idx_gestioni_esercizio  on public.gestioni_esercizio (esercizio_id);
create index if not exists idx_gestioni_fondo      on public.gestioni_esercizio (fondo_speciale_id);
create index if not exists idx_gestioni_autore     on public.gestioni_esercizio (autore_id);
alter table public.gestioni_esercizio enable row level security;

-- 2.6 Preventivi versionati e Voci di preventivo (RC-D2, RC-D4, RC-D5, Sez. 3)
create table if not exists public.preventivi (
    id                        uuid primary key default uuid_generate_v4(),
    condominio_id             uuid not null references public.condomini (id) on delete cascade,
    esercizio_id              uuid not null references public.esercizi_contabili (id) on delete cascade,
    gestione_id               uuid references public.gestioni_esercizio (id) on delete cascade,
    versione                  integer not null default 1 check (versione >= 1),
    stato                     text not null default 'BOZZA' check (stato in ('BOZZA','APPROVATO','SUPERATO')),
    totale_previsto_centesimi bigint not null default 0 check (totale_previsto_centesimi >= 0),
    data_approvazione         date,
    delibera_approvazione     text,
    precedente_id             uuid references public.preventivi (id) on delete set null,
    note                      text,
    autore_id                 uuid references public.utenti (id) on delete set null,
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now()
);
create index if not exists idx_preventivi_condominio on public.preventivi (condominio_id);
create index if not exists idx_preventivi_esercizio  on public.preventivi (esercizio_id);
create index if not exists idx_preventivi_gestione   on public.preventivi (gestione_id);
create index if not exists idx_preventivi_precedente on public.preventivi (precedente_id);
create index if not exists idx_preventivi_autore     on public.preventivi (autore_id);
alter table public.preventivi enable row level security;

create table if not exists public.preventivi_voci (
    id                         uuid primary key default uuid_generate_v4(),
    condominio_id              uuid not null references public.condomini (id) on delete cascade,
    preventivo_id              uuid not null references public.preventivi (id) on delete cascade,
    voce_spesa_id              uuid references public.voci_spesa_catalogo (id) on delete set null,
    sottoconto_id              uuid references public.sottoconti (id) on delete set null,
    tabella_millesimale_id     uuid references public.tabelle_millesimali (id) on delete set null,
    versione_tabella           integer not null default 1 check (versione_tabella >= 1),
    criterio_ripartizione      text not null default 'TUTTI' check (criterio_ripartizione in ('TUTTI','PALAZZO_SCALA','TABELLA_SPECIFICA','PERSONALIZZATO','CONSUMI')),
    descrizione                text not null,
    importo_previsto_centesimi bigint not null check (importo_previsto_centesimi >= 0),
    created_at                 timestamptz not null default now()
);
create index if not exists idx_prevvoci_condominio on public.preventivi_voci (condominio_id);
create index if not exists idx_prevvoci_preventivo on public.preventivi_voci (preventivo_id);
create index if not exists idx_prevvoci_voce       on public.preventivi_voci (voce_spesa_id);
create index if not exists idx_prevvoci_sottoconto on public.preventivi_voci (sottoconto_id);
create index if not exists idx_prevvoci_tabella    on public.preventivi_voci (tabella_millesimale_id);
alter table public.preventivi_voci enable row level security;

-- 2.7 Riparti Spese per unità e titolare (RC-C4, RC-C5, RC-H5, RC-I, T1-T3, T8-T10)
create table if not exists public.riparti_spese (
    id                             uuid primary key default uuid_generate_v4(),
    condominio_id                  uuid not null references public.condomini (id) on delete cascade,
    movimento_id                   uuid not null references public.movimenti_contabili (id) on delete cascade,
    unita_id                       uuid not null references public.unita_immobiliari (id) on delete restrict,
    utente_id                      uuid references public.utenti (id) on delete set null,
    soggetto_id                    uuid references public.soggetti_contabili (id) on delete set null,
    tabella_millesimale_id         uuid references public.tabelle_millesimali (id) on delete set null,
    versione_tabella               integer not null default 1 check (versione_tabella >= 1),
    valore_unitario                numeric(10,3) not null default 0,
    somma_valori_partecipanti      numeric(12,3) not null default 1000 check (somma_valori_partecipanti > 0),
    giorni_titolarita              integer check (giorni_titolarita is null or giorni_titolarita >= 0),
    giorni_periodo                 integer check (giorni_periodo is null or giorni_periodo > 0),
    quota_calcolata_centesimi      bigint not null,
    resto_arrotondamento_centesimi integer not null default 0,
    importo_quota_centesimi        bigint not null,
    quota_proprietario_centesimi   bigint not null default 0,
    quota_conduttore_centesimi     bigint not null default 0,
    quota_usufruttuario_centesimi  bigint not null default 0,
    da_conguagliare                boolean not null default false,
    versione_motore_calcolo        text not null default '1.0.0',
    autore_id                      uuid references public.utenti (id) on delete set null,
    created_at                     timestamptz not null default now()
);
create index if not exists idx_riparti_condominio on public.riparti_spese (condominio_id);
create index if not exists idx_riparti_movimento  on public.riparti_spese (movimento_id);
create index if not exists idx_riparti_unita      on public.riparti_spese (unita_id);
create index if not exists idx_riparti_utente     on public.riparti_spese (utente_id);
create index if not exists idx_riparti_soggetto   on public.riparti_spese (soggetto_id);
create index if not exists idx_riparti_tabella    on public.riparti_spese (tabella_millesimale_id);
create index if not exists idx_riparti_autore     on public.riparti_spese (autore_id);
alter table public.riparti_spese enable row level security;

-- 2.8 Letture contatori per acqua e riscaldamento (RC-C5, RC-H6, T9)
create table if not exists public.letture_contatori (
    id                  uuid primary key default uuid_generate_v4(),
    condominio_id       uuid not null references public.condomini (id) on delete cascade,
    unita_id            uuid not null references public.unita_immobiliari (id) on delete cascade,
    esercizio_id        uuid references public.esercizi_contabili (id) on delete set null,
    utente_id           uuid references public.utenti (id) on delete set null,
    tipo_contatore      text not null check (tipo_contatore in ('ACQUA','RISCALDAMENTO','ACQUA_CALDA')),
    matricola_contatore text,
    data_lettura        date not null,
    valore_lettura      numeric(12,3) not null check (valore_lettura >= 0),
    consumo_calcolato   numeric(12,3) check (consumo_calcolato is null or consumo_calcolato >= 0),
    is_stimata          boolean not null default false,
    is_subentro         boolean not null default false,
    da_conguagliare     boolean not null default false,
    note                text,
    autore_id           uuid references public.utenti (id) on delete set null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists idx_letture_condominio on public.letture_contatori (condominio_id);
create index if not exists idx_letture_unita      on public.letture_contatori (unita_id, tipo_contatore, data_lettura desc);
create index if not exists idx_letture_esercizio  on public.letture_contatori (esercizio_id);
create index if not exists idx_letture_utente     on public.letture_contatori (utente_id);
create index if not exists idx_letture_autore     on public.letture_contatori (autore_id);
alter table public.letture_contatori enable row level security;

-- 2.9 Bollettini e Righe Bollettino (RC-E1..E6, T11, T13)
create table if not exists public.bollettini (
    id                            uuid primary key default uuid_generate_v4(),
    condominio_id                 uuid not null references public.condomini (id) on delete restrict,
    esercizio_id                  uuid not null references public.esercizi_contabili (id) on delete restrict,
    anno                          integer not null check (anno between 1990 and 2100),
    numero_progressivo            integer not null check (numero_progressivo >= 1),
    destinatario_utente_id        uuid references public.utenti (id) on delete set null,
    destinatario_soggetto_id      uuid references public.soggetti_contabili (id) on delete set null,
    intestazione_destinatario     text not null,
    totale_centesimi              bigint not null check (totale_centesimi >= 0),
    importo_pagato_centesimi      bigint not null default 0 check (importo_pagato_centesimi >= 0),
    data_emissione                date,
    data_scadenza                 date not null,
    stato                         text not null default 'BOZZA' check (stato in ('BOZZA','VERIFICATO','EMESSO','PARZIALMENTE_PAGATO','PAGATO','RETTIFICATO','ANNULLATO')),
    sostituisce_id                uuid references public.bollettini (id) on delete restrict,
    sostituito_da_id              uuid references public.bollettini (id) on delete set null,
    motivo_rettifica_annullamento text,
    anomalie_rilevate             jsonb not null default '[]'::jsonb,
    confermato_da                 uuid references public.utenti (id) on delete set null,
    confermato_at                 timestamptz,
    url_pdf                       text,
    iban_accredito                text,
    causale_versamento            text,
    versione                      integer not null default 1 check (versione >= 1),
    versione_lock                 integer not null default 1 check (versione_lock >= 1),
    versione_motore_calcolo       text not null default '1.0.0',
    autore_id                     uuid references public.utenti (id) on delete set null,
    created_at                    timestamptz not null default now(),
    updated_at                    timestamptz not null default now(),
    unique (condominio_id, anno, numero_progressivo)
);
create index if not exists idx_bollettini_condominio   on public.bollettini (condominio_id);
create index if not exists idx_bollettini_esercizio    on public.bollettini (esercizio_id);
create index if not exists idx_bollettini_utente       on public.bollettini (destinatario_utente_id);
create index if not exists idx_bollettini_soggetto     on public.bollettini (destinatario_soggetto_id);
create index if not exists idx_bollettini_sostituisce  on public.bollettini (sostituisce_id);
create index if not exists idx_bollettini_sostituito   on public.bollettini (sostituito_da_id);
create index if not exists idx_bollettini_confermato   on public.bollettini (confermato_da);
create index if not exists idx_bollettini_autore       on public.bollettini (autore_id);
alter table public.bollettini enable row level security;

create table if not exists public.bollettini_righe (
    id                uuid primary key default uuid_generate_v4(),
    condominio_id     uuid not null references public.condomini (id) on delete cascade,
    bollettino_id     uuid not null references public.bollettini (id) on delete cascade,
    rata_dettaglio_id uuid references public.rate_dettaglio (id) on delete restrict,
    unita_id          uuid not null references public.unita_immobiliari (id) on delete restrict,
    gestione_id       uuid references public.gestioni_esercizio (id) on delete set null,
    descrizione       text not null,
    importo_centesimi bigint not null check (importo_centesimi >= 0),
    data_scadenza     date not null,
    created_at        timestamptz not null default now(),
    unique (bollettino_id, rata_dettaglio_id)
);
create index if not exists idx_bollrighe_condominio on public.bollettini_righe (condominio_id);
create index if not exists idx_bollrighe_bollettino on public.bollettini_righe (bollettino_id);
create index if not exists idx_bollrighe_rata       on public.bollettini_righe (rata_dettaglio_id);
create index if not exists idx_bollrighe_unita      on public.bollettini_righe (unita_id);
create index if not exists idx_bollrighe_gestione   on public.bollettini_righe (gestione_id);
alter table public.bollettini_righe enable row level security;

-- 2.10 Scadenziario recupero crediti 6 mesi ex art. 1129 c. 9 c.c. (RC-G3, T12)
create table if not exists public.scadenziario_recupero_crediti (
    id                          uuid primary key default uuid_generate_v4(),
    condominio_id               uuid not null references public.condomini (id) on delete cascade,
    esercizio_id                uuid not null references public.esercizi_contabili (id) on delete cascade,
    unita_id                    uuid not null references public.unita_immobiliari (id) on delete cascade,
    utente_id                   uuid references public.utenti (id) on delete set null,
    soggetto_id                 uuid references public.soggetti_contabili (id) on delete set null,
    rata_dettaglio_id           uuid references public.rate_dettaglio (id) on delete set null,
    saldo_pregresso_id          uuid references public.saldi_pregressi (id) on delete set null,
    importo_esigibile_centesimi bigint not null check (importo_esigibile_centesimi > 0),
    data_esigibilita            date not null,
    data_decorrenza_semestre    date not null,
    data_limite_azione          date not null,
    alert_90gg_at               date not null,
    alert_30gg_at               date not null,
    alert_7gg_at                date not null,
    stato                       text not null default 'DA_AVVIARE' check (stato in ('DA_AVVIARE','AVVIATO','DISPENSATO','CHIUSO')),
    data_avvio_azione           date,
    data_dispensa               date,
    delibera_dispensa           text,
    data_chiusura               date,
    note                        text,
    autore_id                   uuid references public.utenti (id) on delete set null,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now()
);
create index if not exists idx_scadrec_condominio on public.scadenziario_recupero_crediti (condominio_id);
create index if not exists idx_scadrec_esercizio  on public.scadenziario_recupero_crediti (esercizio_id);
create index if not exists idx_scadrec_unita      on public.scadenziario_recupero_crediti (unita_id);
create index if not exists idx_scadrec_utente     on public.scadenziario_recupero_crediti (utente_id);
create index if not exists idx_scadrec_soggetto   on public.scadenziario_recupero_crediti (soggetto_id);
create index if not exists idx_scadrec_rata       on public.scadenziario_recupero_crediti (rata_dettaglio_id);
create index if not exists idx_scadrec_saldo      on public.scadenziario_recupero_crediti (saldo_pregresso_id);
create index if not exists idx_scadrec_autore     on public.scadenziario_recupero_crediti (autore_id);
alter table public.scadenziario_recupero_crediti enable row level security;

-- 2.11 Conguagli per unità, gestione e periodo di titolarità (RC-L1..L6, T5)
create table if not exists public.conguagli_unita (
    id                         uuid primary key default uuid_generate_v4(),
    condominio_id              uuid not null references public.condomini (id) on delete cascade,
    esercizio_id               uuid not null references public.esercizi_contabili (id) on delete cascade,
    gestione_id                uuid references public.gestioni_esercizio (id) on delete cascade,
    unita_id                   uuid not null references public.unita_immobiliari (id) on delete restrict,
    utente_id                  uuid references public.utenti (id) on delete set null,
    soggetto_id                uuid references public.soggetti_contabili (id) on delete set null,
    periodo_da                 date not null,
    periodo_a                  date not null,
    quota_consuntivo_centesimi bigint not null default 0,
    rate_versate_centesimi     bigint not null default 0,
    saldo_conguaglio_centesimi bigint not null default 0,
    modalita_regolazione       text default 'DA_REGOLARE' check (modalita_regolazione in ('DA_REGOLARE','COMPENSATO_RATA','RIMBORSATO','RIPORTATO_NUOVO_ESERCIZIO')),
    rata_compensazione_id      uuid references public.rate_dettaglio (id) on delete set null,
    autore_id                  uuid references public.utenti (id) on delete set null,
    created_at                 timestamptz not null default now(),
    updated_at                 timestamptz not null default now(),
    check (periodo_a >= periodo_da)
);
create index if not exists idx_conguagli_condominio on public.conguagli_unita (condominio_id);
create index if not exists idx_conguagli_esercizio  on public.conguagli_unita (esercizio_id);
create index if not exists idx_conguagli_gestione   on public.conguagli_unita (gestione_id);
create index if not exists idx_conguagli_unita      on public.conguagli_unita (unita_id);
create index if not exists idx_conguagli_utente     on public.conguagli_unita (utente_id);
create index if not exists idx_conguagli_soggetto   on public.conguagli_unita (soggetto_id);
create index if not exists idx_conguagli_rata_comp  on public.conguagli_unita (rata_compensazione_id);
create index if not exists idx_conguagli_autore     on public.conguagli_unita (autore_id);
alter table public.conguagli_unita enable row level security;

-- 2.12 Chiavi esterne incrociate (idempotenti tramite pg_constraint, best practice schema-constraints)
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'anagrafiche_unita_soggetto_id_fkey') then
        alter table public.anagrafiche_unita
            add constraint anagrafiche_unita_soggetto_id_fkey
            foreign key (soggetto_id) references public.soggetti_contabili (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'movimenti_contabili_gestione_id_fkey') then
        alter table public.movimenti_contabili
            add constraint movimenti_contabili_gestione_id_fkey
            foreign key (gestione_id) references public.gestioni_esercizio (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'movimenti_contabili_voce_spesa_id_fkey') then
        alter table public.movimenti_contabili
            add constraint movimenti_contabili_voce_spesa_id_fkey
            foreign key (voce_spesa_id) references public.voci_spesa_catalogo (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'movimenti_contabili_fondo_id_fkey') then
        alter table public.movimenti_contabili
            add constraint movimenti_contabili_fondo_id_fkey
            foreign key (fondo_id) references public.fondi (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'rate_testata_gestione_id_fkey') then
        alter table public.rate_testata
            add constraint rate_testata_gestione_id_fkey
            foreign key (gestione_id) references public.gestioni_esercizio (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'rate_testata_preventivo_id_fkey') then
        alter table public.rate_testata
            add constraint rate_testata_preventivo_id_fkey
            foreign key (preventivo_id) references public.preventivi (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'rate_dettaglio_soggetto_id_fkey') then
        alter table public.rate_dettaglio
            add constraint rate_dettaglio_soggetto_id_fkey
            foreign key (soggetto_id) references public.soggetti_contabili (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'rate_dettaglio_bollettino_id_fkey') then
        alter table public.rate_dettaglio
            add constraint rate_dettaglio_bollettino_id_fkey
            foreign key (bollettino_id) references public.bollettini (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'saldi_pregressi_gestione_id_fkey') then
        alter table public.saldi_pregressi
            add constraint saldi_pregressi_gestione_id_fkey
            foreign key (gestione_id) references public.gestioni_esercizio (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'saldi_pregressi_soggetto_id_fkey') then
        alter table public.saldi_pregressi
            add constraint saldi_pregressi_soggetto_id_fkey
            foreign key (soggetto_id) references public.soggetti_contabili (id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'riconciliazioni_log_bollettino_id_fkey') then
        alter table public.riconciliazioni_log
            add constraint riconciliazioni_log_bollettino_id_fkey
            foreign key (bollettino_id) references public.bollettini (id) on delete set null;
    end if;

    -- Vincoli CHECK composti di coerenza
    if not exists (select 1 from pg_constraint where conname = 'movimenti_eccezione_cc_motivo_chk') then
        alter table public.movimenti_contabili
            add constraint movimenti_eccezione_cc_motivo_chk
            check (not eccezione_conto_corrente or (motivo_eccezione_cc is not null and length(btrim(motivo_eccezione_cc)) > 0));
    end if;

    if not exists (select 1 from pg_constraint where conname = 'rate_testata_override_motivo_chk') then
        alter table public.rate_testata
            add constraint rate_testata_override_motivo_chk
            check (not emessa_con_override or (motivo_override is not null and delibera_override is not null));
    end if;

    if not exists (select 1 from pg_constraint where conname = 'movimenti_fondo_override_chk') then
        alter table public.movimenti_fondo
            add constraint movimenti_fondo_override_chk
            check (not is_override_vincolo or (motivo_override is not null and delibera_override is not null));
    end if;
end $$;

-- =============================================================================
-- 3. CONVERSIONE DEI DATI ESISTENTI E CONTROLLO SOMME/CONTEGGI (RC-O5, RC-O12, T18..T22)
-- =============================================================================

do $migrazione_dati$
declare
    v_cnt_prima       jsonb;
    v_cnt_dopo        jsonb;
    v_somme_prima     jsonb;
    v_somme_dopo      jsonb;
    v_orfane          integer := 0;
begin
    -- 3.1 Fotografia prima della conversione (conteggi e somme in centesimi calcolati dai numeric)
    select jsonb_build_object(
        'esercizi_contabili',  (select count(*) from public.esercizi_contabili),
        'tabelle_millesimali', (select count(*) from public.tabelle_millesimali),
        'quote_millesimali',   (select count(*) from public.quote_millesimali),
        'movimenti_contabili', (select count(*) from public.movimenti_contabili),
        'rate_testata',        (select count(*) from public.rate_testata),
        'rate_dettaglio',      (select count(*) from public.rate_dettaglio),
        'saldi_pregressi',     (select count(*) from public.saldi_pregressi),
        'pagamenti_rate',      (select count(*) from public.pagamenti_rate),
        'transazioni_bancarie',(select count(*) from public.transazioni_bancarie),
        'riconciliazioni_log', (select count(*) from public.riconciliazioni_log)
    ) into v_cnt_prima;

    select jsonb_build_object(
        'movimenti_cents',        coalesce((select sum(round(importo * 100)::bigint) from public.movimenti_contabili), 0),
        'rate_dovuto_cents',      coalesce((select sum(round(importo_dovuto * 100)::bigint) from public.rate_dettaglio), 0),
        'rate_pagato_cents',      coalesce((select sum(round(importo_pagato * 100)::bigint) from public.rate_dettaglio), 0),
        'saldi_pregressi_cents',  coalesce((select sum(round(importo * 100)::bigint) from public.saldi_pregressi), 0),
        'pagamenti_rate_cents',   coalesce((select sum(round(importo * 100)::bigint) from public.pagamenti_rate), 0),
        'transazioni_banc_cents', coalesce((select sum(round(importo * 100)::bigint) from public.transazioni_bancarie), 0),
        'riconciliazioni_cents',  coalesce((select sum(round(coalesce(importo_assegnato, 0) * 100)::bigint) from public.riconciliazioni_log), 0)
    ) into v_somme_prima;

    -- 3.2 Popolamento `condominio_id` e `*_centesimi` sulle righe esistenti (T18, T22)
    update public.anagrafiche_unita a
       set condominio_id    = coalesce(a.condominio_id, public.cond_of_unita(a.unita_id)),
           ruolo_titolarita = case when a.tipo_possesso = 'INQUILINO' then 'CONDUTTORE' else 'PROPRIETARIO' end
     where a.condominio_id is null;

    update public.esercizi_contabili e
       set stato_modello               = case when e.stato = 'CHIUSO' then 'CHIUSO' else 'APERTO' end,
           scadenza_approvazione_180gg = coalesce(e.scadenza_approvazione_180gg, (e.data_fine + interval '180 days')::date)
     where e.scadenza_approvazione_180gg is null;

    update public.quote_millesimali q
       set condominio_id        = coalesce(q.condominio_id, public.cond_of_tabella_mill(q.tabella_id)),
           valore_millesimi_int = round(q.valore_millesimale * 1000)::integer
     where q.condominio_id is null or q.valore_millesimi_int <> round(q.valore_millesimale * 1000)::integer;

    update public.movimenti_contabili m
       set condominio_id      = coalesce(m.condominio_id, public.cond_of_esercizio(m.esercizio_id)),
           importo_centesimi  = round(m.importo * 100)::bigint,
           data_registrazione = coalesce(m.data_registrazione, m.data),
           competenza_da      = coalesce(m.competenza_da, m.data),
           competenza_a       = coalesce(m.competenza_a, m.data)
     where m.condominio_id is null or m.importo_centesimi <> round(m.importo * 100)::bigint;

    update public.rate_testata rt
       set condominio_id = coalesce(rt.condominio_id, public.cond_of_esercizio(rt.esercizio_id))
     where rt.condominio_id is null;

    update public.rate_dettaglio rd
       set condominio_id            = coalesce(rd.condominio_id, public.cond_of_unita(rd.unita_id)),
           importo_dovuto_centesimi = round(rd.importo_dovuto * 100)::bigint,
           importo_pagato_centesimi = round(rd.importo_pagato * 100)::bigint,
           stato_rata_modello       = case
                                          when rd.stato = 'PAGATO' then 'PAGATA'
                                          when rd.importo_pagato > 0 then 'PARZIALMENTE_PAGATA'
                                          else 'EMESSA'
                                      end
     where rd.condominio_id is null
        or rd.importo_dovuto_centesimi <> round(rd.importo_dovuto * 100)::bigint
        or rd.importo_pagato_centesimi <> round(rd.importo_pagato * 100)::bigint;

    update public.saldi_pregressi sp
       set condominio_id     = coalesce(sp.condominio_id, public.cond_of_esercizio(sp.esercizio_id)),
           importo_centesimi = round(sp.importo * 100)::bigint
     where sp.condominio_id is null or sp.importo_centesimi <> round(sp.importo * 100)::bigint;

    update public.pagamenti_rate pr
       set condominio_id     = coalesce(pr.condominio_id, public.cond_of_rata_dettaglio(pr.rata_dettaglio_id)),
           importo_centesimi = round(pr.importo * 100)::bigint,
           data_valuta       = coalesce(pr.data_valuta, (pr.created_at at time zone 'Europe/Rome')::date)
     where pr.condominio_id is null or pr.importo_centesimi <> round(pr.importo * 100)::bigint;

    update public.transazioni_bancarie tb
       set importo_centesimi = round(tb.importo * 100)::bigint
     where tb.importo_centesimi <> round(tb.importo * 100)::bigint;

    update public.riconciliazioni_log rl
       set condominio_id               = coalesce(rl.condominio_id, public.cond_of_transazione(rl.transazione_id)),
           importo_assegnato_centesimi = case when rl.importo_assegnato is not null then round(rl.importo_assegnato * 100)::bigint else null end
     where rl.condominio_id is null
        or (rl.importo_assegnato is not null and rl.importo_assegnato_centesimi is distinct from round(rl.importo_assegnato * 100)::bigint);

    -- 3.3 Popolamento iniziale `assegnazioni_amministratore` per i condomini esistenti (RC-A13)
    insert into public.assegnazioni_amministratore (condominio_id, admin_id, ruolo_incarico, data_nomina, is_attivo)
    select c.id, c.admin_id, 'AMMINISTRATORE', (c.created_at at time zone 'Europe/Rome')::date, true
      from public.condomini c
     where not exists (
         select 1 from public.assegnazioni_amministratore aa
          where aa.condominio_id = c.id and aa.ruolo_incarico = 'AMMINISTRATORE' and aa.is_attivo = true
     );

    -- 3.4 Popolamento gestione ORDINARIA di default per ogni esercizio esistente (RC-D1)
    insert into public.gestioni_esercizio (condominio_id, esercizio_id, tipo, nome, stato)
    select e.condominio_id, e.id, 'ORDINARIA', 'Gestione Ordinaria ' || e.anno,
           case when e.stato = 'CHIUSO' then 'CHIUSA' else 'ATTIVA' end
      from public.esercizi_contabili e
     where not exists (
         select 1 from public.gestioni_esercizio g
          where g.esercizio_id = e.id and g.tipo = 'ORDINARIA'
     );

    -- 3.5 Popolamento catalogo iniziale delle 10 voci di spesa standard (RC-C2, RC-I2, RC-I4)
    insert into public.voci_spesa_catalogo
        (condominio_id, codice, nome, tag_default, criterio_default, quota_inquilino_default_perc, is_a_periodo, is_compenso_admin)
    select c.id, v.codice, v.nome, v.tag_default, v.criterio_default, v.quota_inq, v.is_periodo, v.is_compenso
      from public.condomini c
      cross join (values
          ('ASCENSORE',         'Ascensore',                        'ORDINARIA',     'TABELLA_SPECIFICA', 100.00, false, false),
          ('PULIZIA_SCALE',     'Pulizia scale',                    'ORDINARIA',     'PALAZZO_SCALA',     100.00, false, false),
          ('ACQUA',             'Acqua',                            'ORDINARIA',     'CONSUMI',           100.00, false, false),
          ('RISCALDAMENTO',     'Riscaldamento',                    'ORDINARIA',     'CONSUMI',           100.00, false, false),
          ('LUCE_COMUNE',       'Energia elettrica parti comuni',   'ORDINARIA',     'TUTTI',             100.00, false, false),
          ('ASSICURAZIONE',     'Assicurazione fabbricato',         'ORDINARIA',     'TUTTI',               0.00, true,  false),
          ('COMPENSO_ADMIN',    'Compenso amministratore',          'ORDINARIA',     'TUTTI',               0.00, true,  true),
          ('MANUT_ORDINARIA',   'Manutenzione ordinaria',           'ORDINARIA',     'TUTTI',             100.00, false, false),
          ('MANUT_STRAORD',     'Manutenzione straordinaria',       'STRAORDINARIA', 'TUTTI',               0.00, false, false),
          ('SPESE_LEGALI',      'Spese legali',                     'ORDINARIA',     'TUTTI',               0.00, false, false)
      ) as v(codice, nome, tag_default, criterio_default, quota_inq, is_periodo, is_compenso)
    on conflict (condominio_id, codice) do nothing;

    -- 3.6 Fotografia dopo la conversione e verifica rigorosa (T18, T19, T22)
    select jsonb_build_object(
        'esercizi_contabili',  (select count(*) from public.esercizi_contabili),
        'tabelle_millesimali', (select count(*) from public.tabelle_millesimali),
        'quote_millesimali',   (select count(*) from public.quote_millesimali),
        'movimenti_contabili', (select count(*) from public.movimenti_contabili),
        'rate_testata',        (select count(*) from public.rate_testata),
        'rate_dettaglio',      (select count(*) from public.rate_dettaglio),
        'saldi_pregressi',     (select count(*) from public.saldi_pregressi),
        'pagamenti_rate',      (select count(*) from public.pagamenti_rate),
        'transazioni_bancarie',(select count(*) from public.transazioni_bancarie),
        'riconciliazioni_log', (select count(*) from public.riconciliazioni_log)
    ) into v_cnt_dopo;

    select jsonb_build_object(
        'movimenti_cents',        coalesce((select sum(importo_centesimi) from public.movimenti_contabili), 0),
        'rate_dovuto_cents',      coalesce((select sum(importo_dovuto_centesimi) from public.rate_dettaglio), 0),
        'rate_pagato_cents',      coalesce((select sum(importo_pagato_centesimi) from public.rate_dettaglio), 0),
        'saldi_pregressi_cents',  coalesce((select sum(importo_centesimi) from public.saldi_pregressi), 0),
        'pagamenti_rate_cents',   coalesce((select sum(importo_centesimi) from public.pagamenti_rate), 0),
        'transazioni_banc_cents', coalesce((select sum(importo_centesimi) from public.transazioni_bancarie), 0),
        'riconciliazioni_cents',  coalesce((select sum(coalesce(importo_assegnato_centesimi, 0)) from public.riconciliazioni_log), 0)
    ) into v_somme_dopo;

    select (
        (select count(*) from public.quote_millesimali   where condominio_id is null) +
        (select count(*) from public.movimenti_contabili where condominio_id is null) +
        (select count(*) from public.rate_testata        where condominio_id is null) +
        (select count(*) from public.rate_dettaglio      where condominio_id is null) +
        (select count(*) from public.saldi_pregressi     where condominio_id is null) +
        (select count(*) from public.pagamenti_rate      where condominio_id is null) +
        (select count(*) from public.riconciliazioni_log where condominio_id is null)
    )::integer into v_orfane;

    if v_cnt_prima <> v_cnt_dopo then
        raise exception 'T18/T19 FALLITO: conteggi righe variati durante la migrazione (% vs %)', v_cnt_prima, v_cnt_dopo;
    end if;

    if v_somme_prima <> v_somme_dopo then
        raise exception 'T18/T19 FALLITO: discrepanza somme centesimi (% vs %)', v_somme_prima, v_somme_dopo;
    end if;

    if v_orfane > 0 then
        raise exception 'T22 FALLITO: rilevate % righe contabili senza condominio_id', v_orfane;
    end if;

    insert into public.migrazioni_contabilita_log
        (codice_migrazione, stato, conteggi_prima, conteggi_dopo, somme_prima, somme_dopo, righe_orfane, note)
    values
        ('10_contabilita_schema_modello_obiettivo', 'COMPLETATA', v_cnt_prima, v_cnt_dopo, v_somme_prima, v_somme_dopo, v_orfane,
         'Conversione importi in centesimi interi e allineamento Modello Obiettivo completati senza discrepanze.');
end $migrazione_dati$;

-- Vincoli di parità tra colonne legacy `numeric` e nuove colonne `*_centesimi` (T18, T21)
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'movimenti_importo_centesimi_sync_chk') then
        alter table public.movimenti_contabili
            add constraint movimenti_importo_centesimi_sync_chk
            check (importo_centesimi = round(importo * 100)::bigint);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'rate_dettaglio_centesimi_sync_chk') then
        alter table public.rate_dettaglio
            add constraint rate_dettaglio_centesimi_sync_chk
            check (
                importo_dovuto_centesimi = round(importo_dovuto * 100)::bigint
                and importo_pagato_centesimi = round(importo_pagato * 100)::bigint
            );
    end if;

    if not exists (select 1 from pg_constraint where conname = 'saldi_pregressi_centesimi_sync_chk') then
        alter table public.saldi_pregressi
            add constraint saldi_pregressi_centesimi_sync_chk
            check (importo_centesimi = round(importo * 100)::bigint);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'pagamenti_rate_centesimi_sync_chk') then
        alter table public.pagamenti_rate
            add constraint pagamenti_rate_centesimi_sync_chk
            check (importo_centesimi = round(importo * 100)::bigint);
    end if;

    if not exists (select 1 from pg_constraint where conname = 'transazioni_bancarie_centesimi_sync_chk') then
        alter table public.transazioni_bancarie
            add constraint transazioni_bancarie_centesimi_sync_chk
            check (importo_centesimi = round(importo * 100)::bigint);
    end if;
end $$;

-- =============================================================================
-- 4. TRIGGER DI SINCRONIZZAZIONE BIDIREZIONALE E AUDIT (RC-O10, RC-B4, T18..T22)
-- =============================================================================

create or replace function public.sync_contabilita_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Autore automatico se omesso
    if new.autore_id is null and auth.uid() is not null then
        new.autore_id := auth.uid();
    end if;

    if tg_table_name = 'quote_millesimali' then
        if new.condominio_id is null then
            new.condominio_id := public.cond_of_tabella_mill(new.tabella_id);
        end if;
        if tg_op = 'INSERT' then
            if new.valore_millesimi_int = 0 and new.valore_millesimale > 0 then
                new.valore_millesimi_int := round(new.valore_millesimale * 1000)::integer;
            elsif new.valore_millesimi_int > 0 and coalesce(new.valore_millesimale, 0) = 0 then
                new.valore_millesimale := round((new.valore_millesimi_int::numeric / 1000.0), 3);
            end if;
        else
            if new.valore_millesimi_int is distinct from old.valore_millesimi_int
               and new.valore_millesimale is not distinct from old.valore_millesimale then
                new.valore_millesimale := round((new.valore_millesimi_int::numeric / 1000.0), 3);
            else
                new.valore_millesimi_int := round(new.valore_millesimale * 1000)::integer;
            end if;
        end if;

    elsif tg_table_name = 'movimenti_contabili' then
        if new.condominio_id is null then
            new.condominio_id := public.cond_of_esercizio(new.esercizio_id);
        end if;
        if tg_op = 'INSERT' then
            if new.importo_centesimi > 0 and coalesce(new.importo, 0) = 0 then
                new.importo := round((new.importo_centesimi::numeric / 100.0), 2);
            else
                new.importo_centesimi := round(new.importo * 100)::bigint;
            end if;
        else
            if new.importo_centesimi is distinct from old.importo_centesimi
               and new.importo is not distinct from old.importo then
                new.importo := round((new.importo_centesimi::numeric / 100.0), 2);
            else
                new.importo_centesimi := round(new.importo * 100)::bigint;
            end if;
        end if;

    elsif tg_table_name = 'rate_testata' then
        if new.condominio_id is null then
            new.condominio_id := public.cond_of_esercizio(new.esercizio_id);
        end if;

    elsif tg_table_name = 'rate_dettaglio' then
        if new.condominio_id is null then
            new.condominio_id := public.cond_of_unita(new.unita_id);
        end if;
        if tg_op = 'INSERT' then
            if new.importo_dovuto_centesimi > 0 and coalesce(new.importo_dovuto, 0) = 0 then
                new.importo_dovuto := round((new.importo_dovuto_centesimi::numeric / 100.0), 2);
            else
                new.importo_dovuto_centesimi := round(new.importo_dovuto * 100)::bigint;
            end if;
            if new.importo_pagato_centesimi > 0 and coalesce(new.importo_pagato, 0) = 0 then
                new.importo_pagato := round((new.importo_pagato_centesimi::numeric / 100.0), 2);
            else
                new.importo_pagato_centesimi := round(new.importo_pagato * 100)::bigint;
            end if;
        else
            if new.importo_dovuto_centesimi is distinct from old.importo_dovuto_centesimi
               and new.importo_dovuto is not distinct from old.importo_dovuto then
                new.importo_dovuto := round((new.importo_dovuto_centesimi::numeric / 100.0), 2);
            else
                new.importo_dovuto_centesimi := round(new.importo_dovuto * 100)::bigint;
            end if;
            if new.importo_pagato_centesimi is distinct from old.importo_pagato_centesimi
               and new.importo_pagato is not distinct from old.importo_pagato then
                new.importo_pagato := round((new.importo_pagato_centesimi::numeric / 100.0), 2);
            else
                new.importo_pagato_centesimi := round(new.importo_pagato * 100)::bigint;
            end if;
        end if;

    elsif tg_table_name = 'saldi_pregressi' then
        if new.condominio_id is null then
            new.condominio_id := public.cond_of_esercizio(new.esercizio_id);
        end if;
        if tg_op = 'INSERT' then
            if new.importo_centesimi <> 0 and coalesce(new.importo, 0) = 0 then
                new.importo := round((new.importo_centesimi::numeric / 100.0), 2);
            else
                new.importo_centesimi := round(new.importo * 100)::bigint;
            end if;
        else
            if new.importo_centesimi is distinct from old.importo_centesimi
               and new.importo is not distinct from old.importo then
                new.importo := round((new.importo_centesimi::numeric / 100.0), 2);
            else
                new.importo_centesimi := round(new.importo * 100)::bigint;
            end if;
        end if;

    elsif tg_table_name = 'pagamenti_rate' then
        if new.condominio_id is null then
            new.condominio_id := public.cond_of_rata_dettaglio(new.rata_dettaglio_id);
        end if;
        if tg_op = 'INSERT' then
            if new.importo_centesimi > 0 and coalesce(new.importo, 0) = 0 then
                new.importo := round((new.importo_centesimi::numeric / 100.0), 2);
            else
                new.importo_centesimi := round(new.importo * 100)::bigint;
            end if;
        else
            if new.importo_centesimi is distinct from old.importo_centesimi
               and new.importo is not distinct from old.importo then
                new.importo := round((new.importo_centesimi::numeric / 100.0), 2);
            else
                new.importo_centesimi := round(new.importo * 100)::bigint;
            end if;
        end if;

    elsif tg_table_name = 'transazioni_bancarie' then
        if tg_op = 'INSERT' then
            if new.importo_centesimi <> 0 and coalesce(new.importo, 0) = 0 then
                new.importo := round((new.importo_centesimi::numeric / 100.0), 2);
            else
                new.importo_centesimi := round(new.importo * 100)::bigint;
            end if;
        else
            if new.importo_centesimi is distinct from old.importo_centesimi
               and new.importo is not distinct from old.importo then
                new.importo := round((new.importo_centesimi::numeric / 100.0), 2);
            else
                new.importo_centesimi := round(new.importo * 100)::bigint;
            end if;
        end if;

    elsif tg_table_name = 'riconciliazioni_log' then
        if new.condominio_id is null then
            new.condominio_id := public.cond_of_transazione(new.transazione_id);
        end if;
        if new.importo_assegnato_centesimi is not null and new.importo_assegnato is null then
            new.importo_assegnato := round((new.importo_assegnato_centesimi::numeric / 100.0), 2);
        elsif new.importo_assegnato is not null then
            new.importo_assegnato_centesimi := round(new.importo_assegnato * 100)::bigint;
        end if;
    end if;

    return new;
end;
$$;
revoke all on function public.sync_contabilita_row() from public, anon, authenticated;

do $$
declare
    t text;
begin
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
        execute format(
            'create trigger trg_sync_contabilita_row before insert or update on public.%I
             for each row execute function public.sync_contabilita_row()', t);
    end loop;
end $$;

-- Trigger updated_at per le nuove tabelle dotate di updated_at
do $$
declare
    t text;
begin
    foreach t in array array[
        'quote_millesimali',
        'saldi_pregressi',
        'soggetti_contabili',
        'assegnazioni_amministratore',
        'voci_spesa_catalogo',
        'fondi',
        'gestioni_esercizio',
        'preventivi',
        'letture_contatori',
        'bollettini',
        'scadenziario_recupero_crediti',
        'conguagli_unita'
    ] loop
        execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
        execute format(
            'create trigger trg_set_updated_at before update on public.%I
             for each row execute function public.set_updated_at()', t);
    end loop;
end $$;

-- Aggiornamento `audit_row_change()` per salvare valore_prima, valore_dopo e condominio_id (RC-M1)
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    v_old  jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
    v_new  jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
    v_cond uuid  := coalesce(
        (v_new ->> 'condominio_id')::uuid,
        (v_old ->> 'condominio_id')::uuid
    );
begin
    insert into public.audit_logs (utente_id, condominio_id, azione, tabella, record_id, valore_prima, valore_dopo)
    values (
        auth.uid(),
        v_cond,
        tg_op,
        tg_table_name,
        coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
        v_old,
        v_new
    );
    if tg_op = 'DELETE' then return old; end if;
    return new;
exception when others then
    raise warning 'audit_row_change: %', sqlerrm;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

do $$
declare
    t text;
begin
    foreach t in array array[
        'condomini','utente_entita_ruolo','anagrafiche_unita','esercizi_contabili',
        'tabelle_millesimali','movimenti_contabili','rate_testata','rate_dettaglio',
        'pagamenti_rate','fondi','movimenti_fondo','preventivi','riparti_spese',
        'bollettini','scadenziario_recupero_crediti','conguagli_unita','assegnazioni_amministratore'
    ] loop
        execute format('drop trigger if exists trg_audit on public.%I', t);
        execute format(
            'create trigger trg_audit after insert or update or delete on public.%I
             for each row execute function public.audit_row_change()', t);
    end loop;
end $$;

-- =============================================================================
-- 5. POLICY RLS RIGOROSE PER ISOLAMENTO CONDOMINIO E RUOLI (RC-M4, RC-A15, UC-11)
-- =============================================================================

-- Helper: l'utente ha incarico di sola lettura (ex-amministratore cessato, revisore o consigliere, RC-A15, RC-K10, T17)
create or replace function public.has_readonly_audit_access(p_cond uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
    select p_cond is not null and exists (
        select 1 from public.assegnazioni_amministratore aa
         where aa.condominio_id = p_cond
           and aa.admin_id = (select auth.uid())
           and (
               aa.ruolo_incarico in ('REVISORE','CONSIGLIERE')
               or (aa.ruolo_incarico = 'AMMINISTRATORE' and aa.data_cessazione is not null)
           )
    );
$$;
revoke all on function public.has_readonly_audit_access(uuid) from public, anon;
grant execute on function public.has_readonly_audit_access(uuid) to authenticated;

-- Policy su `migrazioni_contabilita_log`: solo superadmin in lettura
drop policy if exists migrazioni_contabilita_log_select on public.migrazioni_contabilita_log;
create policy migrazioni_contabilita_log_select on public.migrazioni_contabilita_log
    for select to authenticated
    using (public.is_superadmin());

-- Policy su `audit_logs`: l'amministratore (e l'ex-admin / revisore) consulta il log del proprio condominio (RC-M1, T17)
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
    for select to authenticated
    using (
        public.is_superadmin()
        or (condominio_id is not null and (public.is_admin_of(condominio_id) or public.has_readonly_audit_access(condominio_id)))
    );

-- Policy per tutte le nuove tabelle contabili (isolamento condominio + divieto accesso a portiere puro + privacy subentro UC-11)
do $rls_contabilita$
declare
    r record;
begin
    for r in
        select * from (values
        -- Soggetti contabili: visibili ad admin/revisore o al soggetto stesso
        ('soggetti_contabili',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or utente_id = (select auth.uid()) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        -- Assegnazioni amministratore: visibili ai membri del condominio (non portiere puro) e agli ex-admin (T17)
        ('assegnazioni_amministratore',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or admin_id = (select auth.uid())
                or (public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id)) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        -- Catalogo voci di spesa, gestioni, preventivi, fondi: visibili al condominio (escluso portiere puro), scrivibili solo dall'admin attivo
        ('voci_spesa_catalogo',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or (public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id)) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        ('fondi',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or (public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id)) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        ('movimenti_fondo',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or (public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id)) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        ('gestioni_esercizio',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or (public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id)) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        ('preventivi',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or (public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id)) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        ('preventivi_voci',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or (public.has_cond_access(condominio_id) and not public.is_portiere_only(condominio_id)) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        -- Riparti spese e letture contatori: ogni condòmino vede le quote/letture proprie o della propria unità attiva
        ('riparti_spese',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or utente_id = (select auth.uid())
                or (utente_id is null and public.has_unita_access(unita_id)) $p$,
            $p$ public.is_admin_of(condominio_id)
                and public.cond_of_unita(unita_id) = condominio_id $p$),

        ('letture_contatori',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or utente_id = (select auth.uid())
                or public.has_unita_access(unita_id) $p$,
            $p$ public.is_admin_of(condominio_id)
                and public.cond_of_unita(unita_id) = condominio_id $p$),

        -- Bollettini, scadenziario recupero e conguagli: strettamente personali (UC-11, il debito segue la persona)
        ('bollettini',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or (stato <> 'BOZZA' and destinatario_utente_id = (select auth.uid())) $p$,
            $p$ public.is_admin_of(condominio_id) $p$),

        ('bollettini_righe',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or exists (
                    select 1 from public.bollettini b
                     where b.id = bollettino_id
                       and b.stato <> 'BOZZA'
                       and b.destinatario_utente_id = (select auth.uid())
                ) $p$,
            $p$ public.is_admin_of(condominio_id)
                and public.cond_of_unita(unita_id) = condominio_id $p$),

        ('scadenziario_recupero_crediti',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or utente_id = (select auth.uid()) $p$,
            $p$ public.is_admin_of(condominio_id)
                and public.cond_of_unita(unita_id) = condominio_id $p$),

        ('conguagli_unita',
            $p$ public.is_admin_of(condominio_id)
                or public.has_readonly_audit_access(condominio_id)
                or utente_id = (select auth.uid())
                or (utente_id is null and public.has_unita_access(unita_id)) $p$,
            $p$ public.is_admin_of(condominio_id)
                and public.cond_of_unita(unita_id) = condominio_id $p$)
        ) as v(tbl, sel_expr, write_expr)
    loop
        execute format('drop policy if exists %I on public.%I', r.tbl || '_select', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_insert', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_update', r.tbl);
        execute format('drop policy if exists %I on public.%I', r.tbl || '_delete', r.tbl);

        execute format($f$create policy %I on public.%I for select to authenticated
                          using (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_select', r.tbl, r.sel_expr);
        execute format($f$create policy %I on public.%I for insert to authenticated
                          with check (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_insert', r.tbl, r.write_expr);
        execute format($f$create policy %I on public.%I for update to authenticated
                          using (public.is_superadmin() or (%s))
                          with check (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_update', r.tbl, r.write_expr, r.write_expr);
        execute format($f$create policy %I on public.%I for delete to authenticated
                          using (public.is_superadmin() or (%s))$f$,
                       r.tbl || '_delete', r.tbl, r.write_expr);
    end loop;
end
$rls_contabilita$;

commit;
