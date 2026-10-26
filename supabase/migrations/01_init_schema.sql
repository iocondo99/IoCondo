-- =====================================================================
-- 01_init_schema.sql
-- Piattaforma Gestionale e App Condominiale ("Tu") - Schema fisico DDL
-- Solo struttura (tabelle, colonne, vincoli, indici) + RLS abilitata.
-- Policy RLS -> 02_rls_policies.sql | Trigger/funzioni -> 03_backend_triggers.sql
--
-- AGGIUNTE rispetto al PRD (sez. 6) emerse dall'analisi incrociata PRD/xlsx:
--   * utenti.email / updated_at                (richiesti dal sync con auth.users)
--   * pagamenti_rate                           (UC-01 pagamenti in-app Stripe/Nexi/SDD)
--   * saldi_pregressi                          (REQ-F04 saldi iniziali da import)
--   * rate_dettaglio.utente_id                 (il debito segue la PERSONA, non l'unita': UC-11 subentro)
--   * log_storico_immobile.visibilita          (UC-11: storico tecnico visibile, debiti/CU riservati)
--   * configurazioni_condominio per palazzo    (UC-05: toggle a livello di edificio)
--   * notifiche, dispositivi_push              (notifiche push - feature Alta nell'xlsx)
--   * sondaggi (+opzioni, +voti)               (bacheca e sondaggi non vincolanti)
--   * eventi_calendario, raccolta_differenziata, polizze_assicurative (feature xlsx)
-- =====================================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "btree_gist" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- Nelle migrazioni del CLI lo schema "extensions" non e' nel search_path: senza questo
-- uuid_generate_v4() non viene trovata (SQLSTATE 42883). Vale per la sessione di questa migrazione.
set search_path = public, extensions;

-- =====================================================================
-- 6.1 CORE SAAS, AUTH & SICUREZZA
-- =====================================================================

create table public.utenti (
    id            uuid primary key references auth.users (id) on delete cascade,
    email         text unique,
    nome_cognome  text,
    telefono      text,
    avatar_url    text,
    is_superadmin boolean not null default false,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
alter table public.utenti enable row level security;

create table public.piani_abbonamento (
    id              uuid primary key default uuid_generate_v4(),
    nome            text not null unique,
    prezzo_mensile  numeric(10,2) not null check (prezzo_mensile >= 0),
    limite_unita    integer check (limite_unita is null or limite_unita > 0),
    feature_premium jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
alter table public.piani_abbonamento enable row level security;

create table public.licenze_saas (
    id             uuid primary key default uuid_generate_v4(),
    admin_id       uuid not null references public.utenti (id) on delete cascade,
    piano_id       uuid not null references public.piani_abbonamento (id) on delete restrict,
    is_active      boolean not null default true,
    data_scadenza  date,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index on public.licenze_saas (admin_id);
alter table public.licenze_saas enable row level security;

create table public.fatture_saas (
    id             uuid primary key default uuid_generate_v4(),
    admin_id       uuid not null references public.utenti (id) on delete restrict,
    importo        numeric(10,2) not null check (importo >= 0),
    url_pdf        text,
    data_emissione date not null default current_date
);
create index on public.fatture_saas (admin_id);
alter table public.fatture_saas enable row level security;

create table public.ruoli_piattaforma (
    id     uuid primary key default uuid_generate_v4(),
    codice text not null unique check (codice in ('CONDOMINO','ADMIN','PORTIERE'))
);
alter table public.ruoli_piattaforma enable row level security;

-- (le FK verso condomini/unita_immobiliari vengono aggiunte piu' sotto)
create table public.utente_entita_ruolo (
    id            uuid primary key default uuid_generate_v4(),
    utente_id     uuid not null references public.utenti (id) on delete cascade,
    ruolo_id      uuid not null references public.ruoli_piattaforma (id) on delete restrict,
    condominio_id uuid,
    unita_id      uuid,
    created_at    timestamptz not null default now(),
    constraint uer_entita_not_null check (condominio_id is not null or unita_id is not null)
);
create unique index uer_unique on public.utente_entita_ruolo (
    utente_id, ruolo_id,
    coalesce(condominio_id, '00000000-0000-0000-0000-000000000000'),
    coalesce(unita_id,      '00000000-0000-0000-0000-000000000000')
);
create index on public.utente_entita_ruolo (utente_id);
create index on public.utente_entita_ruolo (condominio_id);
create index on public.utente_entita_ruolo (unita_id);
alter table public.utente_entita_ruolo enable row level security;

create table public.audit_logs (
    id         uuid primary key default uuid_generate_v4(),
    utente_id  uuid references public.utenti (id) on delete set null,
    azione     text not null,
    tabella    text,
    record_id  uuid,
    "timestamp" timestamptz not null default now(),
    ip_address inet
);
create index on public.audit_logs (utente_id);
create index on public.audit_logs (tabella, record_id);
alter table public.audit_logs enable row level security;

-- =====================================================================
-- 6.2 GERARCHIA SPAZIALE & ANAGRAFICHE
-- =====================================================================

create table public.condomini (
    id             uuid primary key default uuid_generate_v4(),
    admin_id       uuid not null references public.utenti (id) on delete restrict,
    nome           text not null,
    tipo           text not null default 'CONDOMINIO' check (tipo in ('CONDOMINIO','SUPERCONDOMINIO')),
    codice_fiscale text,
    partita_iva    text,
    indirizzo      text,
    citta          text,
    cap            text,
    provincia      char(2),
    iban_principale text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index on public.condomini (admin_id);
alter table public.condomini enable row level security;

create table public.palazzi (
    id                  uuid primary key default uuid_generate_v4(),
    condominio_id       uuid not null references public.condomini (id) on delete cascade,
    nome_identificativo text not null,
    indirizzo           text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (condominio_id, nome_identificativo)
);
create index on public.palazzi (condominio_id);
alter table public.palazzi enable row level security;

-- Feature toggles: riga con palazzo_id NULL = default del condominio; riga con palazzo_id = override edificio
create table public.configurazioni_condominio (
    id                    uuid primary key default uuid_generate_v4(),
    condominio_id         uuid not null references public.condomini (id) on delete cascade,
    palazzo_id            uuid references public.palazzi (id) on delete cascade,
    abilita_social        boolean not null default true,
    abilita_chat          boolean not null default true,
    abilita_bacheca       boolean not null default true,
    abilita_ticket        boolean not null default true,
    abilita_prenotazioni  boolean not null default true,
    abilita_pacchi        boolean not null default true,
    updated_at            timestamptz not null default now()
);
create unique index configurazioni_unique on public.configurazioni_condominio (
    condominio_id, coalesce(palazzo_id, '00000000-0000-0000-0000-000000000000')
);
alter table public.configurazioni_condominio enable row level security;

create table public.scale_colonne (
    id         uuid primary key default uuid_generate_v4(),
    palazzo_id uuid not null references public.palazzi (id) on delete cascade,
    tipo       text not null check (tipo in ('SCALA','COLONNA')),
    nome       text not null,
    unique (palazzo_id, tipo, nome)
);
create index on public.scale_colonne (palazzo_id);
alter table public.scale_colonne enable row level security;

create table public.tipologie_unita (
    id          uuid primary key default uuid_generate_v4(),
    descrizione text not null unique
);
alter table public.tipologie_unita enable row level security;

create table public.unita_immobiliari (
    id               uuid primary key default uuid_generate_v4(),
    palazzo_id       uuid not null references public.palazzi (id) on delete cascade,
    scala_colonna_id uuid references public.scale_colonne (id) on delete set null,
    tipologia_id     uuid not null references public.tipologie_unita (id) on delete restrict,
    interno          text not null,
    piano            integer,
    mq               numeric(8,2) check (mq is null or mq > 0),
    foglio_catastale text,
    particella       text,
    subalterno       text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (palazzo_id, interno, tipologia_id)
);
create index on public.unita_immobiliari (palazzo_id);
create index on public.unita_immobiliari (scala_colonna_id);
alter table public.unita_immobiliari enable row level security;

create table public.anagrafiche_unita (
    id            uuid primary key default uuid_generate_v4(),
    unita_id      uuid not null references public.unita_immobiliari (id) on delete cascade,
    utente_id     uuid not null references public.utenti (id) on delete restrict,
    data_inizio   date not null default current_date,
    data_fine     date,
    tipo_possesso text not null check (tipo_possesso in ('PROPRIETARIO','INQUILINO')),
    quota_possesso numeric(5,2) not null default 100 check (quota_possesso > 0 and quota_possesso <= 100),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint anagrafiche_date_ok check (data_fine is null or data_fine >= data_inizio)
);
create index on public.anagrafiche_unita (unita_id);
create index on public.anagrafiche_unita (utente_id);
alter table public.anagrafiche_unita enable row level security;

-- FK differite della pivot ruoli e inviti
alter table public.utente_entita_ruolo
    add constraint uer_condominio_fk foreign key (condominio_id) references public.condomini (id) on delete cascade,
    add constraint uer_unita_fk      foreign key (unita_id)      references public.unita_immobiliari (id) on delete cascade;

create table public.inviti_pendenti (
    token          text primary key default replace(uuid_generate_v4()::text, '-', ''),
    email          text not null,
    ruolo_proposto uuid not null references public.ruoli_piattaforma (id) on delete restrict,
    flag_portiere  boolean not null default false,   -- UC-07 utente ibrido
    condominio_id  uuid not null references public.condomini (id) on delete cascade,
    unita_id       uuid references public.unita_immobiliari (id) on delete cascade,
    invitato_da    uuid references public.utenti (id) on delete set null,
    scadenza       timestamptz not null default (now() + interval '7 days'),
    accettato_at   timestamptz
);
create index on public.inviti_pendenti (condominio_id);
create index on public.inviti_pendenti (email);
alter table public.inviti_pendenti enable row level security;

-- Notifiche push
create table public.dispositivi_push (
    id         uuid primary key default uuid_generate_v4(),
    utente_id  uuid not null references public.utenti (id) on delete cascade,
    token      text not null unique,
    piattaforma text not null check (piattaforma in ('IOS','ANDROID','WEB')),
    created_at timestamptz not null default now()
);
create index on public.dispositivi_push (utente_id);
alter table public.dispositivi_push enable row level security;

create table public.notifiche (
    id            uuid primary key default uuid_generate_v4(),
    utente_id     uuid not null references public.utenti (id) on delete cascade,
    condominio_id uuid references public.condomini (id) on delete cascade,
    titolo        text not null,
    corpo         text,
    tipo          text,
    riferimento_tabella text,
    riferimento_id uuid,
    letta         boolean not null default false,
    created_at    timestamptz not null default now()
);
create index on public.notifiche (utente_id, letta);
alter table public.notifiche enable row level security;

-- =====================================================================
-- 6.4 (anticipato) FORNITORI & 6.5 DRIVE DOCUMENTALE (servono a contabilita')
-- =====================================================================

create table public.fornitori (
    id              uuid primary key default uuid_generate_v4(),
    admin_id        uuid not null references public.utenti (id) on delete cascade,
    ragione_sociale text not null,
    p_iva           text,
    iban            text,
    email           text,
    telefono        text,
    categoria       text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on public.fornitori (admin_id);
alter table public.fornitori enable row level security;

create table public.cartelle_documenti (
    id            uuid primary key default uuid_generate_v4(),
    condominio_id uuid not null references public.condomini (id) on delete cascade,
    parent_id     uuid references public.cartelle_documenti (id) on delete cascade,
    nome_cartella text not null,
    created_at    timestamptz not null default now()
);
create index on public.cartelle_documenti (condominio_id);
create index on public.cartelle_documenti (parent_id);
alter table public.cartelle_documenti enable row level security;

create table public.documenti_metadata (
    id            uuid primary key default uuid_generate_v4(),
    cartella_id   uuid not null references public.cartelle_documenti (id) on delete cascade,
    unita_id      uuid references public.unita_immobiliari (id) on delete cascade, -- visibilita' limitata
    url_storage   text not null,
    nome_file     text not null,
    tipo_mime     text,
    caricato_da   uuid references public.utenti (id) on delete set null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index on public.documenti_metadata (cartella_id);
create index on public.documenti_metadata (unita_id);
alter table public.documenti_metadata enable row level security;

create table public.documenti_permessi (
    id               uuid primary key default uuid_generate_v4(),
    documento_id     uuid not null references public.documenti_metadata (id) on delete cascade,
    ruolo_target_id  uuid references public.ruoli_piattaforma (id) on delete cascade,
    utente_target_id uuid references public.utenti (id) on delete cascade,
    tipo_permesso    text not null default 'LETTURA' check (tipo_permesso in ('LETTURA','SCRITTURA')),
    constraint documenti_permessi_target check (ruolo_target_id is not null or utente_target_id is not null)
);
create index on public.documenti_permessi (documento_id);
alter table public.documenti_permessi enable row level security;

-- =====================================================================
-- 6.3 CONTABILITA' & FINANZA
-- =====================================================================

create table public.piano_dei_conti (
    id               uuid primary key default uuid_generate_v4(),
    condominio_id    uuid not null references public.condomini (id) on delete cascade,
    codice           text not null,
    descrizione_macro text not null,
    unique (condominio_id, codice)
);
alter table public.piano_dei_conti enable row level security;

create table public.sottoconti (
    id              uuid primary key default uuid_generate_v4(),
    piano_conto_id  uuid not null references public.piano_dei_conti (id) on delete cascade,
    descrizione_micro text not null
);
create index on public.sottoconti (piano_conto_id);
alter table public.sottoconti enable row level security;

create table public.esercizi_contabili (
    id            uuid primary key default uuid_generate_v4(),
    condominio_id uuid not null references public.condomini (id) on delete cascade,
    anno          integer not null check (anno between 1990 and 2100),
    data_inizio   date not null,
    data_fine     date not null,
    stato         text not null default 'PREVENTIVO' check (stato in ('PREVENTIVO','CONSUNTIVO','CHIUSO')),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (condominio_id, anno),
    check (data_fine > data_inizio)
);
alter table public.esercizi_contabili enable row level security;

create table public.tabelle_millesimali (
    id               uuid primary key default uuid_generate_v4(),
    condominio_id    uuid not null references public.condomini (id) on delete cascade,
    palazzo_id       uuid references public.palazzi (id) on delete cascade,
    scala_colonna_id uuid references public.scale_colonne (id) on delete cascade,
    nome             text not null,
    totale           numeric(8,3) not null default 1000 check (totale > 0),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (condominio_id, nome)
);
create index on public.tabelle_millesimali (condominio_id);
alter table public.tabelle_millesimali enable row level security;

create table public.quote_millesimali (
    id                uuid primary key default uuid_generate_v4(),
    tabella_id        uuid not null references public.tabelle_millesimali (id) on delete cascade,
    unita_id          uuid not null references public.unita_immobiliari (id) on delete cascade,
    valore_millesimale numeric(8,3) not null check (valore_millesimale >= 0),
    unique (tabella_id, unita_id)
);
create index on public.quote_millesimali (unita_id);
alter table public.quote_millesimali enable row level security;

create table public.movimenti_contabili (
    id              uuid primary key default uuid_generate_v4(),
    esercizio_id    uuid not null references public.esercizi_contabili (id) on delete restrict,
    data            date not null,
    importo         numeric(14,2) not null check (importo > 0),
    segno           char(1) not null check (segno in ('+','-')),
    sottoconto_id   uuid references public.sottoconti (id) on delete set null,
    fornitore_id    uuid references public.fornitori (id) on delete set null,
    descrizione     text,
    doc_allegato_id uuid references public.documenti_metadata (id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index on public.movimenti_contabili (esercizio_id);
create index on public.movimenti_contabili (sottoconto_id);
alter table public.movimenti_contabili enable row level security;

create table public.rate_testata (
    id                    uuid primary key default uuid_generate_v4(),
    esercizio_id          uuid not null references public.esercizi_contabili (id) on delete restrict,
    tabella_millesimale_id uuid references public.tabelle_millesimali (id) on delete set null,
    data_scadenza         date not null,
    descrizione           text not null,
    pubblicata            boolean not null default false,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);
create index on public.rate_testata (esercizio_id);
alter table public.rate_testata enable row level security;

create table public.rate_dettaglio (
    id              uuid primary key default uuid_generate_v4(),
    rata_testata_id uuid not null references public.rate_testata (id) on delete cascade,
    unita_id        uuid not null references public.unita_immobiliari (id) on delete restrict,
    utente_id       uuid references public.utenti (id) on delete set null, -- debitore (segue la persona)
    importo_dovuto  numeric(12,2) not null check (importo_dovuto >= 0),
    importo_pagato  numeric(12,2) not null default 0 check (importo_pagato >= 0),
    stato           text not null default 'DA_PAGARE' check (stato in ('DA_PAGARE','PAGATO','RITARDO')),
    data_pagamento  date,
    bollettino_url  text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (rata_testata_id, unita_id)
);
create index on public.rate_dettaglio (unita_id);
create index on public.rate_dettaglio (utente_id);
create index on public.rate_dettaglio (stato);
alter table public.rate_dettaglio enable row level security;

create table public.saldi_pregressi (
    id           uuid primary key default uuid_generate_v4(),
    esercizio_id uuid not null references public.esercizi_contabili (id) on delete cascade,
    unita_id     uuid not null references public.unita_immobiliari (id) on delete cascade,
    utente_id    uuid references public.utenti (id) on delete set null,
    importo      numeric(12,2) not null,  -- >0 debito iniziale, <0 credito iniziale
    note         text,
    created_at   timestamptz not null default now(),
    unique (esercizio_id, unita_id)
);
alter table public.saldi_pregressi enable row level security;

create table public.pagamenti_rate (
    id                uuid primary key default uuid_generate_v4(),
    rata_dettaglio_id uuid not null references public.rate_dettaglio (id) on delete restrict,
    utente_id         uuid references public.utenti (id) on delete set null,
    importo           numeric(12,2) not null check (importo > 0),
    metodo            text not null check (metodo in ('SDD','CARTA','PAY_BY_BANK','BONIFICO')),
    provider          text check (provider in ('STRIPE','NEXI','MANUALE')),
    provider_ref      text,
    stato             text not null default 'IN_ATTESA' check (stato in ('IN_ATTESA','COMPLETATO','FALLITO','RIMBORSATO')),
    created_at        timestamptz not null default now(),
    completed_at      timestamptz,
    updated_at        timestamptz not null default now()
);
create index on public.pagamenti_rate (rata_dettaglio_id);
create unique index pagamenti_rate_provider_ref on public.pagamenti_rate (provider, provider_ref) where provider_ref is not null;
alter table public.pagamenti_rate enable row level security;

create table public.transazioni_bancarie (
    id                   uuid primary key default uuid_generate_v4(),
    condominio_id        uuid not null references public.condomini (id) on delete cascade,
    data_valuta          date not null,
    importo              numeric(14,2) not null,
    causale              text,
    origine              text not null default 'CBI' check (origine in ('CBI','OPEN_BANKING','MANUALE')),
    hash_movimento       text,
    stato_riconciliazione text not null default 'NON_RICONCILIATA'
        check (stato_riconciliazione in ('NON_RICONCILIATA','PARZIALE','RICONCILIATA','IGNORATA')),
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    unique (condominio_id, hash_movimento)
);
create index on public.transazioni_bancarie (condominio_id);
alter table public.transazioni_bancarie enable row level security;

create table public.riconciliazioni_log (
    id                uuid primary key default uuid_generate_v4(),
    transazione_id    uuid not null references public.transazioni_bancarie (id) on delete cascade,
    rata_dettaglio_id uuid not null references public.rate_dettaglio (id) on delete cascade,
    importo_assegnato numeric(12,2),
    metodo            text not null default 'AUTO' check (metodo in ('AUTO','MANUALE')),
    data_matching     timestamptz not null default now()
);
create index on public.riconciliazioni_log (transazione_id);
create index on public.riconciliazioni_log (rata_dettaglio_id);
alter table public.riconciliazioni_log enable row level security;

create table public.solleciti_morosita (
    id                uuid primary key default uuid_generate_v4(),
    unita_id          uuid not null references public.unita_immobiliari (id) on delete cascade,
    utente_id         uuid references public.utenti (id) on delete set null, -- destinatario (morosita' personale)
    rata_dettaglio_id uuid references public.rate_dettaglio (id) on delete cascade,
    data_invio        timestamptz not null default now(),
    livello_gravita   smallint not null default 1 check (livello_gravita between 1 and 3),
    url_pdf_lettera   text
);
create index on public.solleciti_morosita (unita_id);
create index on public.solleciti_morosita (utente_id);
alter table public.solleciti_morosita enable row level security;

create table public.polizze_assicurative (
    id            uuid primary key default uuid_generate_v4(),
    condominio_id uuid not null references public.condomini (id) on delete cascade,
    compagnia     text not null,
    numero_polizza text,
    premio_annuo  numeric(12,2),
    data_scadenza date not null,
    doc_id        uuid references public.documenti_metadata (id) on delete set null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index on public.polizze_assicurative (condominio_id);
alter table public.polizze_assicurative enable row level security;

-- =====================================================================
-- 6.4 TICKETING, MANUTENZIONE E FORNITORI
-- =====================================================================

create table public.categorie_guasti (
    id   uuid primary key default uuid_generate_v4(),
    nome text not null unique
);
alter table public.categorie_guasti enable row level security;

create table public.ticket_testata (
    id             uuid primary key default uuid_generate_v4(),
    condominio_id  uuid not null references public.condomini (id) on delete cascade,
    unita_id       uuid references public.unita_immobiliari (id) on delete set null,
    segnalatore_id uuid references public.utenti (id) on delete set null,
    categoria_id   uuid references public.categorie_guasti (id) on delete set null,
    titolo         text not null,
    descrizione    text,
    is_area_comune boolean not null default false,
    priorita       text not null default 'MEDIA' check (priorita in ('BASSA','MEDIA','ALTA','URGENTE')),
    stato          text not null default 'APERTO' check (stato in ('APERTO','LAVORAZIONE','RISOLTO')),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    closed_at      timestamptz
);
create index on public.ticket_testata (condominio_id, stato);
create index on public.ticket_testata (unita_id);
create index on public.ticket_testata (segnalatore_id);
alter table public.ticket_testata enable row level security;

create table public.ticket_messaggi (
    id         uuid primary key default uuid_generate_v4(),
    ticket_id  uuid not null references public.ticket_testata (id) on delete cascade,
    mittente_id uuid references public.utenti (id) on delete set null,
    messaggio  text not null,
    "timestamp" timestamptz not null default now()
);
create index on public.ticket_messaggi (ticket_id);
alter table public.ticket_messaggi enable row level security;

create table public.ticket_allegati (
    id          uuid primary key default uuid_generate_v4(),
    ticket_id   uuid not null references public.ticket_testata (id) on delete cascade,
    url_storage text not null,
    tipo_file   text not null default 'FOTO' check (tipo_file in ('FOTO','FATTURA','ALTRO')),
    caricato_da uuid references public.utenti (id) on delete set null,
    created_at  timestamptz not null default now()
);
create index on public.ticket_allegati (ticket_id);
alter table public.ticket_allegati enable row level security;

create table public.ticket_interventi (
    id                uuid primary key default uuid_generate_v4(),
    ticket_id         uuid not null references public.ticket_testata (id) on delete cascade,
    fornitore_id      uuid not null references public.fornitori (id) on delete restrict,
    data_prevista     date,
    importo_consuntivo numeric(12,2) check (importo_consuntivo is null or importo_consuntivo >= 0),
    note_fornitore    text,
    fattura_url       text,
    foto_lavoro_url   text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index on public.ticket_interventi (ticket_id);
create index on public.ticket_interventi (fornitore_id);
alter table public.ticket_interventi enable row level security;

create table public.fornitori_tokens (
    token                text primary key,
    ticket_intervento_id uuid not null references public.ticket_interventi (id) on delete cascade,
    url_magico           text,
    data_scadenza        timestamptz not null,
    used_at              timestamptz
);
create index on public.fornitori_tokens (ticket_intervento_id);
alter table public.fornitori_tokens enable row level security;

-- =====================================================================
-- 6.5 COMUNICAZIONE & SOCIAL
-- =====================================================================

create table public.bacheca_post (
    id                uuid primary key default uuid_generate_v4(),
    condominio_id     uuid not null references public.condomini (id) on delete cascade,
    palazzo_id        uuid references public.palazzi (id) on delete cascade, -- NULL = tutto il condominio
    autore_id         uuid references public.utenti (id) on delete set null,
    titolo            text not null,
    corpo             text,
    is_pinned         boolean not null default false,
    data_pubblicazione timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index on public.bacheca_post (condominio_id);
alter table public.bacheca_post enable row level security;

create table public.bacheca_commenti (
    id         uuid primary key default uuid_generate_v4(),
    post_id    uuid not null references public.bacheca_post (id) on delete cascade,
    autore_id  uuid references public.utenti (id) on delete set null,
    commento   text not null,
    created_at timestamptz not null default now()
);
create index on public.bacheca_commenti (post_id);
alter table public.bacheca_commenti enable row level security;

create table public.sondaggi (
    id            uuid primary key default uuid_generate_v4(),
    condominio_id uuid not null references public.condomini (id) on delete cascade,
    autore_id     uuid references public.utenti (id) on delete set null,
    domanda       text not null,
    data_chiusura timestamptz,
    created_at    timestamptz not null default now()
);
alter table public.sondaggi enable row level security;

create table public.sondaggi_opzioni (
    id          uuid primary key default uuid_generate_v4(),
    sondaggio_id uuid not null references public.sondaggi (id) on delete cascade,
    testo       text not null
);
create index on public.sondaggi_opzioni (sondaggio_id);
alter table public.sondaggi_opzioni enable row level security;

create table public.sondaggi_voti (
    id          uuid primary key default uuid_generate_v4(),
    opzione_id  uuid not null references public.sondaggi_opzioni (id) on delete cascade,
    sondaggio_id uuid not null references public.sondaggi (id) on delete cascade,
    utente_id   uuid not null references public.utenti (id) on delete cascade,
    created_at  timestamptz not null default now(),
    unique (sondaggio_id, utente_id)
);
alter table public.sondaggi_voti enable row level security;

create table public.chat_rooms (
    id            uuid primary key default uuid_generate_v4(),
    condominio_id uuid not null references public.condomini (id) on delete cascade,
    palazzo_id    uuid references public.palazzi (id) on delete cascade,
    nome_stanza   text not null,
    tipo          text not null default 'GENERALE' check (tipo in ('GENERALE','PALAZZO')),
    created_at    timestamptz not null default now()
);
create index on public.chat_rooms (condominio_id);
alter table public.chat_rooms enable row level security;

create table public.chat_partecipanti (
    room_id   uuid not null references public.chat_rooms (id) on delete cascade,
    utente_id uuid not null references public.utenti (id) on delete cascade,
    joined_at timestamptz not null default now(),
    primary key (room_id, utente_id)
);
create index on public.chat_partecipanti (utente_id);
alter table public.chat_partecipanti enable row level security;

create table public.chat_messaggi (
    id          uuid primary key default uuid_generate_v4(),
    room_id     uuid not null references public.chat_rooms (id) on delete cascade,
    mittente_id uuid references public.utenti (id) on delete set null,
    testo_messaggio text not null,
    "timestamp" timestamptz not null default now()
);
create index on public.chat_messaggi (room_id, "timestamp");
alter table public.chat_messaggi enable row level security;

create table public.eventi_calendario (
    id            uuid primary key default uuid_generate_v4(),
    condominio_id uuid not null references public.condomini (id) on delete cascade,
    palazzo_id    uuid references public.palazzi (id) on delete cascade,
    titolo        text not null,
    descrizione   text,
    data_inizio   timestamptz not null,
    data_fine     timestamptz,
    creato_da     uuid references public.utenti (id) on delete set null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index on public.eventi_calendario (condominio_id, data_inizio);
alter table public.eventi_calendario enable row level security;

create table public.raccolta_differenziata (
    id            uuid primary key default uuid_generate_v4(),
    condominio_id uuid not null references public.condomini (id) on delete cascade,
    tipo_rifiuto  text not null,
    giorno_settimana smallint not null check (giorno_settimana between 1 and 7),
    note          text
);
create index on public.raccolta_differenziata (condominio_id);
alter table public.raccolta_differenziata enable row level security;

-- =====================================================================
-- 6.6 ASSEMBLEE, SERVIZI EXTRA E FASE 2
-- =====================================================================

create table public.assemblee_testata (
    id                     uuid primary key default uuid_generate_v4(),
    condominio_id          uuid not null references public.condomini (id) on delete cascade,
    tabella_millesimale_id uuid references public.tabelle_millesimali (id) on delete set null,
    data                   timestamptz not null,
    luogo                  text,
    link_meet              text,
    verbale_url            text,
    stato                  text not null default 'CONVOCATA' check (stato in ('BOZZA','CONVOCATA','IN_CORSO','CONCLUSA','ANNULLATA')),
    tipo                   text not null default 'ORDINARIA' check (tipo in ('ORDINARIA','STRAORDINARIA')),
    modalita               text not null default 'PRESENZA' check (modalita in ('PRESENZA','ONLINE','IBRIDA')),
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);
create index on public.assemblee_testata (condominio_id);
create index on public.assemblee_testata (tabella_millesimale_id);
alter table public.assemblee_testata enable row level security;

create table public.assemblee_punti_odg (
    id           uuid primary key default uuid_generate_v4(),
    assemblea_id uuid not null references public.assemblee_testata (id) on delete cascade,
    ordine       integer not null default 1,
    titolo_punto text not null,
    descrizione  text,
    votazione_aperta boolean not null default false
);
create index on public.assemblee_punti_odg (assemblea_id);
alter table public.assemblee_punti_odg enable row level security;

create table public.assemblee_voti (
    id           uuid primary key default uuid_generate_v4(),
    punto_odg_id uuid not null references public.assemblee_punti_odg (id) on delete cascade,
    unita_id     uuid not null references public.unita_immobiliari (id) on delete restrict,
    utente_id    uuid references public.utenti (id) on delete set null,
    voto         text not null check (voto in ('FAVOREVOLE','CONTRARIO','ASTENUTO')),
    created_at   timestamptz not null default now(),
    unique (punto_odg_id, unita_id)
);
create index on public.assemblee_voti (punto_odg_id);
alter table public.assemblee_voti enable row level security;

create table public.registro_pacchi (
    id                   uuid primary key default uuid_generate_v4(),
    condominio_id        uuid not null references public.condomini (id) on delete cascade,
    unita_destinazione_id uuid not null references public.unita_immobiliari (id) on delete cascade,
    registrato_da        uuid references public.utenti (id) on delete set null,
    mittente_esterno     text,
    stato                text not null default 'GIACENZA' check (stato in ('GIACENZA','RITIRATO')),
    data_arrivo          timestamptz not null default now(),
    data_ritiro          timestamptz,
    firma_ritiro         text
);
create index on public.registro_pacchi (condominio_id, stato);
create index on public.registro_pacchi (unita_destinazione_id);
alter table public.registro_pacchi enable row level security;

create table public.risorse_prenotabili (
    id            uuid primary key default uuid_generate_v4(),
    condominio_id uuid not null references public.condomini (id) on delete cascade,
    nome          text not null,
    tariffa_oraria numeric(8,2) not null default 0 check (tariffa_oraria >= 0),
    max_ore       integer check (max_ore is null or max_ore > 0),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index on public.risorse_prenotabili (condominio_id);
alter table public.risorse_prenotabili enable row level security;

create table public.prenotazioni_spazi (
    id              uuid primary key default uuid_generate_v4(),
    risorsa_id      uuid not null references public.risorse_prenotabili (id) on delete cascade,
    utente_id       uuid not null references public.utenti (id) on delete cascade,
    data_inizio     timestamptz not null,
    data_fine       timestamptz not null,
    costo_addebitato numeric(8,2) not null default 0,
    created_at      timestamptz not null default now(),
    check (data_fine > data_inizio),
    exclude using gist (risorsa_id with =, tstzrange(data_inizio, data_fine) with &&)
);
create index on public.prenotazioni_spazi (utente_id);
alter table public.prenotazioni_spazi enable row level security;

-- Storico immobile (UC-11): tabella di log. 'visibilita' governa cosa vede un subentrante.
create table public.log_storico_immobile (
    id          uuid primary key default uuid_generate_v4(),
    unita_id    uuid not null references public.unita_immobiliari (id) on delete cascade,
    tipo_evento text not null,
    descrizione text,
    visibilita  text not null default 'PUBBLICO' check (visibilita in ('PUBBLICO','RISERVATO')),
    data_evento timestamptz not null default now()
);
create index on public.log_storico_immobile (unita_id, data_evento desc);
alter table public.log_storico_immobile enable row level security;

create table public.f24_generati (
    id              uuid primary key default uuid_generate_v4(),
    condominio_id   uuid not null references public.condomini (id) on delete cascade,
    codici_tributo  text[] not null default '{}',
    importo_totale  numeric(12,2) not null check (importo_totale >= 0),
    data_scadenza   date not null,
    stato_invio     text not null default 'DA_INVIARE' check (stato_invio in ('DA_INVIARE','INVIATO','ERRORE')),
    created_at      timestamptz not null default now()
);
create index on public.f24_generati (condominio_id);
alter table public.f24_generati enable row level security;

create table public.fatture_sdi_inbound (
    id                uuid primary key default uuid_generate_v4(),
    condominio_id     uuid not null references public.condomini (id) on delete cascade,
    piva_fornitore    text not null,
    xml_raw           text,
    importo_tot       numeric(12,2),
    stato_prima_nota  text not null default 'DA_REGISTRARE' check (stato_prima_nota in ('DA_REGISTRARE','REGISTRATA','SCARTATA')),
    created_at        timestamptz not null default now()
);
create index on public.fatture_sdi_inbound (condominio_id);
alter table public.fatture_sdi_inbound enable row level security;

-- Appello, presenze e deleghe in assemblea ibrida (UC-10 / Excel Feature Assemblea)
create table public.assemblee_presenze (
    id                 uuid primary key default uuid_generate_v4(),
    assemblea_id       uuid not null references public.assemblee_testata (id) on delete cascade,
    unita_id           uuid not null references public.unita_immobiliari (id) on delete cascade,
    utente_id          uuid references public.utenti (id) on delete set null,
    delegato_utente_id uuid references public.utenti (id) on delete set null,
    modalita_presenza  text not null default 'PRESENZA' check (modalita_presenza in ('PRESENZA','ONLINE','DELEGA')),
    check_in_at        timestamptz not null default now(),
    unique (assemblea_id, unita_id)
);
create index on public.assemblee_presenze (assemblea_id);
create index on public.assemblee_presenze (unita_id);
create index on public.assemblee_presenze (utente_id);
create index on public.assemblee_presenze (delegato_utente_id);
alter table public.assemblee_presenze enable row level security;

-- Gestione sinistri assicurativi (Excel Feature A17)
create table public.sinistri_assicurativi (
    id                  uuid primary key default uuid_generate_v4(),
    condominio_id       uuid not null references public.condomini (id) on delete cascade,
    polizza_id          uuid not null references public.polizze_assicurative (id) on delete restrict,
    ticket_id           uuid references public.ticket_testata (id) on delete set null,
    numero_pratica      text,
    descrizione         text not null,
    importo_stimato     numeric(12,2) check (importo_stimato is null or importo_stimato >= 0),
    importo_liquidato   numeric(12,2) check (importo_liquidato is null or importo_liquidato >= 0),
    stato               text not null default 'APERTO' check (stato in ('APERTO','PERIZIA','LIQUIDATO','RESPINTO','CHIUSO')),
    data_apertura       date not null default current_date,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index on public.sinistri_assicurativi (condominio_id);
create index on public.sinistri_assicurativi (polizza_id);
create index on public.sinistri_assicurativi (ticket_id);
alter table public.sinistri_assicurativi enable row level security;

-- Piani di rateizzazione personalizzati per il condomino (Excel Feature C26)
create table public.piani_rateizzazione (
    id                uuid primary key default uuid_generate_v4(),
    condominio_id     uuid not null references public.condomini (id) on delete cascade,
    unita_id          uuid not null references public.unita_immobiliari (id) on delete cascade,
    utente_id         uuid not null references public.utenti (id) on delete cascade,
    importo_totale    numeric(12,2) not null check (importo_totale > 0),
    numero_rate       integer not null default 3 check (numero_rate between 2 and 36),
    stato             text not null default 'ATTIVO' check (stato in ('RICHIESTO','ATTIVO','COMPLETATO','REVOCATO')),
    note              text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index on public.piani_rateizzazione (condominio_id);
create index on public.piani_rateizzazione (unita_id);
create index on public.piani_rateizzazione (utente_id);
alter table public.piani_rateizzazione enable row level security;

-- Importazione massiva CSV/Excel di anagrafiche e tabelle millesimali (UC-09 / REQ-A07)
create table public.import_jobs (
    id                uuid primary key default uuid_generate_v4(),
    condominio_id     uuid not null references public.condomini (id) on delete cascade,
    eseguito_da       uuid references public.utenti (id) on delete set null,
    tipo_import       text not null check (tipo_import in ('ANAGRAFICHE','MILLESIMI','SALDI_PREGRESSI')),
    nome_file         text not null,
    righe_totali      integer not null default 0 check (righe_totali >= 0),
    righe_importate   integer not null default 0 check (righe_importate >= 0),
    stato             text not null default 'COMPLETATO' check (stato in ('IN_CORSO','COMPLETATO','ERRORE')),
    dettaglio_errori  jsonb not null default '[]'::jsonb,
    created_at        timestamptz not null default now()
);
create index on public.import_jobs (condominio_id);
create index on public.import_jobs (eseguito_da);
alter table public.import_jobs enable row level security;

-- Indici completi su tutte le Foreign Key per performance join e RLS
create index on public.licenze_saas (piano_id);
create index on public.utente_entita_ruolo (ruolo_id);
create index on public.unita_immobiliari (tipologia_id);
create index on public.inviti_pendenti (ruolo_proposto);
create index on public.inviti_pendenti (unita_id);
create index on public.inviti_pendenti (invitato_da);
create index on public.notifiche (condominio_id);
create index on public.documenti_metadata (caricato_da);
create index on public.documenti_permessi (ruolo_target_id);
create index on public.documenti_permessi (utente_target_id);
create index on public.tabelle_millesimali (palazzo_id);
create index on public.tabelle_millesimali (scala_colonna_id);
create index on public.movimenti_contabili (fornitore_id);
create index on public.movimenti_contabili (doc_allegato_id);
create index on public.rate_testata (tabella_millesimale_id);
create index on public.saldi_pregressi (unita_id);
create index on public.saldi_pregressi (utente_id);
create index on public.pagamenti_rate (utente_id);
create index on public.solleciti_morosita (rata_dettaglio_id);
create index on public.polizze_assicurative (doc_id);
create index on public.ticket_testata (categoria_id);
create index on public.ticket_messaggi (mittente_id);
create index on public.ticket_allegati (caricato_da);
create index on public.bacheca_post (palazzo_id);
create index on public.bacheca_post (autore_id);
create index on public.bacheca_commenti (autore_id);
create index on public.sondaggi (condominio_id);
create index on public.sondaggi (autore_id);
create index on public.sondaggi_voti (opzione_id);
create index on public.sondaggi_voti (utente_id);
create index on public.chat_rooms (palazzo_id);
create index on public.chat_messaggi (mittente_id);
create index on public.eventi_calendario (palazzo_id);
create index on public.eventi_calendario (creato_da);
create index on public.assemblee_voti (unita_id);
create index on public.assemblee_voti (utente_id);
create index on public.registro_pacchi (registrato_da);
create index on public.prenotazioni_spazi (risorsa_id);

