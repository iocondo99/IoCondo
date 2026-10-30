PRODUCT REQUIREMENTS DOCUMENT (PRD) COMPLETO
 
Progetto: Piattaforma Gestionale e App Condominiale ("Tu")
 
Versione: 2.0 (Estesa con Schemi Fisici e Tutti i Casi d'Uso)
 
Stack Tecnologico: React Native (Web & Mobile), Supabase (PostgreSQL, Auth, Storage), Vercel.
 
# 1. Scopo del Progetto e Architettura
 
Sviluppo di una piattaforma gestionale e app di property management volta a semplificare e digitalizzare l'amministrazione condominiale. Il sistema richiede un database relazionale capace di gestire gerarchie spaziali complesse e utenze trasversali (multi-tenancy).
 
• Gerarchia Spaziale: Condominio/Supercondominio -> Palazzo/Edificio -> Colonna/Scala -> Unità Immobiliare.
 
• Multi-Tenancy: Un singolo utente (Auth ID) può essere associato a più condomini tramite tabella pivot.
 
• Feature Toggles: Configurazione a livello di singolo edificio per abilitare/disabilitare moduli (Social, Ticket, ecc.).
 
# 2. Attori e Ruoli di Sistema (RBAC)
 
1. Super Admin: Proprietario della piattaforma, gestisce i piani di abbonamento e attiva gli Amministratori.
 
2. Amministratore: Utente gestionale. Crea condomini, anagrafiche, bilanci, ripartisce spese, gestisce fornitori.
 
3. Condòmino: Residente/proprietario. Consulta rate, scarica bollettini, prenota spazi, apre ticket guasti, vota in assemblea.
 
4. Portiere: Ruolo ibridabile. Vede la dashboard per gestione pacchi e ticket per le aree comuni. Nessun accesso contabile.
 
5. Fornitore/Manutentore: Accesso via Magic Link (senza login) per gestire l'intervento e caricare fattura.
 
# 3. Requisiti Funzionali Dettagliati
 
## 3.1 Modulo Interfaccia Condòmino
 
REQ-C01: Visualizzazione e download in autonomia dei bollettini PDF.
 
REQ-C02: Stato di pagamento della rata in tempo reale.
 
REQ-C03: Apertura ticket di segnalazione guasto con foto allegata.
 
REQ-C04: Tracking avanzamento ticket (Aperto, In Lavorazione, Risolto).
 
REQ-C05: Vantaggio Competitivo - Prenotazione Spazi Comuni (es. tennis, lavanderia) con o senza tariffa.
 
## 3.2 Modulo Amministratore
 
REQ-A01: Invio massivo bollettini tramite app/email.
 
REQ-A02: CRM integrato anagrafiche multi-palazzo.
 
REQ-A03: Gestione ticket, assegnazione a fornitori tramite Magic Link.
 
REQ-A04: Drive condominiale cloud con permessi RLS (documenti pubblici vs privati).
 
REQ-A05: Feature Toggles (attivare/disattivare chat o bacheca per singolo condominio).
 
REQ-A06: Creazione Supercondomini e gestione gerarchie (Palazzo, Scala, Colonna).
 
REQ-A07: Importazione massiva via CSV/Excel di anagrafiche e tabelle millesimali.
 
## 3.3 Modulo Contabile-Fiscale (MVP & Fase 2)
 
REQ-F01: Ripartizione automatica rate su tabelle millesimali multiple, anche limitate a singole "Colonne" (es. tubo rotto).
 
REQ-F02: Riconciliazione bancaria Ibrida (Upload file CBI manuale o sync Open Banking automatico).
 
REQ-F03: Solleciti automatici ai morosi.
 
REQ-F04: Inserimento saldi pregressi (credito/debito iniziale) da import.
 
REQ-F05: (Predisposizione Fase 2) F24, Certificazione Unica, Modello 770 e ricezione automatica SdI (Fatturazione Elettronica).
 
# 4. Casi d'Uso Completi (Use Cases)
 
## UC-01: Pagamento e Verifica Rata
 
1. Condòmino accede alla tab 'Contabilità'.
2. Visualizza rate pendenti.
3. Scarica bollettino PDF o (Fase 2) paga via Stripe/Nexi.
4. Sistema aggiorna lo stato a 'Pagato' o in attesa di riconciliazione.
 
## UC-02: Gestione Ticket Guasto end-to-end
 
1. Condòmino/Portiere apre ticket con foto.
2. Notifica push all'Admin.
3. Admin assegna a Fornitore (genera Magic Link).
4. Condòmino vede stato 'In Lavorazione'.
5. Fornitore risolve e chiude. Stato 'Risolto'.
 
## UC-03: Ripartizione Millesimale
 
1. Admin inserisce preventivo.
2. Seleziona tabelle (es. A + Scale).
3. Motore genera rate.
4. Admin pubblica massivamente via push/email.
 
## UC-04: Riconciliazione Bancaria Automatica
 
1. Sistema acquisisce movimenti via API PSD2 o caricamento CBI.
2. Incrocia causali/riferimenti.
3. Marca le rate come 'Pagate'.
4. Genera avvisi per i morosi (rate scadute > 15gg).
 
## UC-05: Configurazione Moduli (Toggling)
 
1. Admin va su Impostazioni 'Palazzo A'.
2. Disabilita 'Modulo Social'.
3. L'icona scompare in real-time dalle app dei residenti del Palazzo A.
 
## UC-06: Spesa su Singola Colonna
 
1. Rottura tubo Colonna Nord.
2. Admin inserisce fattura 1.500€.
3. Seleziona competenza 'Colonna Nord'.
4. Sistema ripartisce solo sui 4 appartamenti collegati e genera rate specifiche.
 
## UC-07: Invito Utente ibrido
 
1. Admin invita Luigi (Condòmino).
2. Aggiunge flag 'Portiere'.
3. Luigi logga e vede un'app unificata con tab 'Le Mie Rate' + 'Gestione Pacchi'.
 
## UC-08: Intervento Fornitore (Frictionless)
 
1. Fornitore riceve email con Magic Link.
2. Apre web-app temporanea.
3. Vede info guasto, scatta foto lavoro finito, inserisce costo e allega PDF fattura.
4. Preme Chiudi, link si invalida, fattura va nel cloud dell'Admin.
 
## UC-09: Import CSV Anagrafiche/Millesimi
 
1. Admin scarica template CSV vuoto.
2. Compila offline (Interno, Scala, Millesimi A, B, C).
3. Carica file, sistema convalida somma millesimi (1000) e popola il DB.
 
## UC-10: Votazione Assemblea
 
1. Admin apre punto ODG.
2. Condòmino vota Favorevole da app.
3. DB salva voto legato all'utente.
4. I vicini vedono solo percentuali (es. 60% Fav). Admin vede report completo per verbale.
 
## UC-11: Storico Immobile per Subentro
 
1. Vendita appartamento. Admin assegna Unità al nuovo acquirente.
2. Acquirente vede storico guasti tecnici e ricevute bollettini generici, ma le policy RLS nascondono debiti, solleciti e CU del vecchio proprietario.
 
# 5. Information Architecture (Mappatura Interfacce)
 
## 5.1 Interfaccia Amministratore (Desktop Web)
 
• Sidebar: Selettore Condominio, Dashboard, Struttura (Palazzi/Unità), Contabilità (Bilanci/Rate), Manutenzione (Fornitori/Ticket), Comunicazioni, Documenti (Drive), Impostazioni.
 
## 5.2 Interfaccia Condòmino (Mobile/App)
 
• Bottom Tab Bar: Bacheca (Avvisi), Le mie Rate, Community (se attiva), Servizi (Ticket, Prenotazioni Spazi, Assemblea, Storico Immobile). Profilo in alto a destra.
 
## 5.3 Interfaccia Portiere (Mobile)
 
• Integrazione Tab: Registro Pacchi (nuovo pacco/ritiro), Ticket Aree Comuni (fast-track per guasti luce/scale).
 
# 6. Schema Database Fisico (Modellazione per Supabase)
 
Elenco estensivo delle ~50 tabelle con definizione dei campi (Columns) per garantire normalizzazione, privacy (RLS) e integrità referenziale per il team Antigravity.
 
## 6.1 Core SaaS, Auth & Sicurezza
 
| **Tabella Database** | **Campi / Colonne (Schema FIsico)** |
| --- | --- |
| **utenti** | id (PK, Auth), nome_cognome, telefono, avatar_url, is_superadmin, created_at |
| **piani_abbonamento** | id (PK), nome, prezzo_mensile, limite_unita, feature_premium (JSONB) |
| **licenze_saas** | id (PK), admin_id (FK utenti), piano_id (FK), is_active, data_scadenza |
| **fatture_saas** | id, admin_id, importo, url_pdf, data_emissione |
| **ruoli_piattaforma** | id (PK), codice (CONDOMINO, ADMIN, PORTIERE) |
| **utente_entita_ruolo** | id (PK), utente_id, ruolo_id, condominio_id (Nullable), unita_id (Nullable) |
| **inviti_pendenti** | token (PK), email, ruolo_proposto, condominio_id, scadenza |
| **audit_logs** | id, utente_id, azione, tabella, record_id, timestamp, ip_address |
 
## 6.2 Gerarchia Spaziale & Anagrafiche
 
| **Tabella Database** | **Campi / Colonne (Schema FIsico)** |
| --- | --- |
| **condomini** | id (PK), admin_id, nome, partita_iva, indirizzo, iban_principale |
| **configurazioni_condominio** | condominio_id (PK), abilita_social, abilita_prenotazioni, abilita_pacchi |
| **palazzi** | id (PK), condominio_id, nome_identificativo |
| **scale_colonne** | id (PK), palazzo_id, tipo (SCALA, COLONNA), nome |
| **tipologie_unita** | id (PK), descrizione (Appartamento, Box, ecc) |
| **unita_immobiliari** | id (PK), palazzo_id, scala_colonna_id (Nullable), tipologia_id, interno, piano, mq |
| **anagrafiche_unita** | id (PK), unita_id, utente_id, data_inizio, data_fine, tipo_possesso (Proprietario, Inquilino) |
 
## 6.3 Contabilità & Finanza (Prima Nota e Rate)
 
| **Tabella Database** | **Campi / Colonne (Schema FIsico)** |
| --- | --- |
| **piano_dei_conti** | id (PK), condominio_id, codice, descrizione_macro |
| **sottoconti** | id (PK), piano_conto_id, descrizione_micro |
| **esercizi_contabili** | id (PK), condominio_id, anno, data_inizio, data_fine, stato (PREVENTIVO, CONSUNTIVO, CHIUSO) |
| **tabelle_millesimali** | id (PK), condominio_id, palazzo_id (Nullable), scala_colonna_id (Nullable), nome, totale (1000) |
| **quote_millesimali** | id (PK), tabella_id, unita_id, valore_millesimale |
| **movimenti_contabili** | id (PK), esercizio_id, data, importo, segno (+/-), sottoconto_id, descrizione, doc_allegato_id |
| **rate_testata** | id (PK), esercizio_id, data_scadenza, descrizione |
| **rate_dettaglio** | id (PK), rata_testata_id, unita_id, importo_dovuto, stato (DA_PAGARE, PAGATO, RITARDO) |
| **transazioni_bancarie** | id (PK), condominio_id, data_valuta, importo, causale, stato_riconciliazione |
| **riconciliazioni_log** | id (PK), transazione_id, rata_dettaglio_id, data_matching |
| **solleciti_morosita** | id (PK), unita_id, rata_dettaglio_id, data_invio, livello_gravita, url_pdf_lettera |
 
## 6.4 Ticketing, Manutenzione e Fornitori
 
| **Tabella Database** | **Campi / Colonne (Schema FIsico)** |
| --- | --- |
| **fornitori** | id (PK), admin_id, ragione_sociale, p_iva, iban, email, telefono, categoria |
| **categorie_guasti** | id (PK), nome (Idraulico, Elettrico) |
| **ticket_testata** | id (PK), condominio_id, unita_id (Nullable), segnalatore_id, categoria_id, titolo, descrizione, stato (APERTO, LAVORAZIONE, RISOLTO) |
| **ticket_messaggi** | id (PK), ticket_id, mittente_id, messaggio, timestamp |
| **ticket_allegati** | id (PK), ticket_id, url_storage, tipo_file (Foto, Fattura) |
| **ticket_interventi** | id (PK), ticket_id, fornitore_id, data_prevista, importo_consuntivo, note_fornitore |
| **fornitori_tokens** | token (PK), ticket_intervento_id, url_magico, data_scadenza |
 
## 6.5 Comunicazione, Documenti e Social
 
| **Tabella Database** | **Campi / Colonne (Schema FIsico)** |
| --- | --- |
| **bacheca_post** | id (PK), condominio_id, autore_id (Admin), titolo, corpo, is_pinned, data_pubblicazione |
| **bacheca_commenti** | id (PK), post_id, autore_id, commento |
| **chat_rooms** | id (PK), condominio_id, palazzo_id (Nullable), nome_stanza, tipo (GENERALE, PALAZZO) |
| **chat_partecipanti** | room_id (FK), utente_id (FK) |
| **chat_messaggi** | id (PK), room_id, mittente_id, test_messaggio, timestamp |
| **cartelle_documenti** | id (PK), condominio_id, parent_id, nome_cartella |
| **documenti_metadata** | id (PK), cartella_id, unita_id (Nullable - per visibilità limitata), url_storage, nome_file, tipo_mime |
| **documenti_permessi** | documento_id (FK), ruolo_target, utente_target_id, tipo_permesso |
 
## 6.6 Assemblee, Servizi Extra e Fase 2
 
| **Tabella Database** | **Campi / Colonne (Schema FIsico)** |
| --- | --- |
| **assemblee_testata** | id (PK), condominio_id, data, luogo, link_meet, stato, tipo |
| **assemblee_punti_odg** | id (PK), assemblea_id, titolo_punto, descrizione |
| **assemblee_voti** | id (PK), punto_odg_id, unita_id, voto (FAVOREVOLE, CONTRARIO, ASTENUTO) |
| **registro_pacchi** | id (PK), condominio_id, unita_destinazione_id, mittente_esterno, stato (GIACENZA, RITIRATO), data_arrivo, firma_ritiro |
| **risorse_prenotabili** | id (PK), condominio_id, nome, tariffa_oraria, max_ore |
| **prenotazioni_spazi** | id (PK), risorsa_id, utente_id, data_inizio, data_fine, costo_addebitato |
| **log_storico_immobile** | id (PK), unita_id, tipo_evento, descrizione, data_evento (Vista materializzata o Tab log) |
| **f24_generati** | [Predisposizione] id, condominio_id, codici_tributo, importo_totale, data_scadenza, stato_invio |
| **fatture_sdi_inbound** | [Predisposizione] id, condominio_id, piva_fornitore, xml_raw, importo_tot, stato_prima_nota |