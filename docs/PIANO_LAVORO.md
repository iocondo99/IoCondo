# PIANO DI LAVORO: "Tu", piattaforma condominiale

Questo file è la fonte di verità per l'ordine dei lavori e lo stato di avanzamento. Le regole generali, di sicurezza e architetturali sono definite in [AGENTS.md](../AGENTS.md). Se qualcosa qui contrasta con un prompt ricevuto, vince AGENTS.md e si chiede conferma all'utente.

## 1. Regole vincolanti per l'agente

Tutte le regole di sicurezza, ambiente aziendale, comandi, architettura e stile sono centralizzate in [AGENTS.md](../AGENTS.md).
- Si lavora a un solo task alla volta.
- Non spuntare mai le caselle di `docs/TEST_DA_FARE.md`: le spunta l'utente dopo verifica su dati reali.

## 2. Architettura (decisioni fisse)

- Un'unica app Expo: `apps/app` (`expo-router`, SDK 58, React 19.3, React Native 0.88).
- Pacchetti condivisi:
  - `packages/ui`: componenti e token;
  - `packages/data`: servizi, logica pura, hook (senza dipendenze da Expo);
  - `packages/supabase-client`: client e storage per piattaforma;
  - `packages/shared-types`: tipi condivisi.
- Target: web ora; Android e iOS compatibili; deploy su Vercel come sito statico (da configurare).
- Gruppi di route: `(pubblico)` per `login`, `imposta-password`, `reimposta-password`; `(app)` con guardia; sottogruppi `(condomino)`, `(portiere)`, `(admin)`, `(superadmin)`.
- Navigazione: condòmino e portiere condividono la stessa vista; amministratore e super admin hanno viste separate con selettore "Vista".
- Sicurezza: la protezione vera sono le policy RLS. La guardia nel client serve solo a non mostrare schermate non consentite.
- Servizi: `createXService(db)` in `packages/data`, con logica pura testata. Nessuna query dentro i componenti.
- Ruoli: nel DB `CONDOMINO`, `ADMIN`, `PORTIERE`. Il super admin è il flag `utenti.is_superadmin`, non un ruolo. Il fornitore non è un utente: entra con link magico (token proprio, tabella `fornitori_tokens`).
- Inviti: `crea_invito` (`SECURITY DEFINER`, identità da `auth.uid()`), `applica_inviti`, Edge Function `invita-utente`. Il flusso usa `token_hash` + `verifyOtp` (non PKCE, perché l'invito parte dal server).
- Il ruolo `ADMIN` si assegna solo al super admin (policy `utente_entita_ruolo_insert/update` con `ruolo_non_admin`).

## 3. Stato del progetto

### Completato e verificato

- Fondamenta e componenti: B1, B2, B3a, B3b (in `packages/ui/src/components`). Pagina di collaudo `/design-system`.
- Login, sessione, guardia, uscita, ritorno alla pagina richiesta (verificato con utente reale).
- Schermata "Scegli la password" per primo accesso e reset (verificata con risposte simulate).
- Layout per ruolo, profilo, selettore vista, navigazione desktop/tablet/mobile (verificato con profili simulati).
- Home del condòmino con dati reali e isolamento delle rate; layout aggiornato con StatCard "Spese e scadenze", lista "Ultime comunicazioni" a tutta larghezza e card "Segnalazioni rapide" ripristinata con apertura diretta del popup di nuova segnalazione (verificato).
- Pagamenti: `/pagamenti` e `/pagamenti/[id]`, sola lettura, nessun pagamento online (verificato).
- Comunicazioni: `/comunicazioni` e `/comunicazioni/[id]`, stato letto tramite notifiche dell'utente (verificato dall'utente).
- Spese: `/spese` e `/spese/[id]`, sola lettura con dati di `spese_extra.sql` (verificato e approvato dall'utente).
- Documenti: `/documenti` e `/documenti/[id]`, sola lettura per il condòmino con isolamento per condominio e unità, link firmati temporanei (`createSignedUrl` 600 s) e dati di prova in `documenti_extra.sql` (verificato e approvato dall'utente).
- Segnalazioni: `/segnalazioni`, `/segnalazioni/[id]` e `/ticket-aree-comuni`, apertura ticket con foto, messaggi e isolamento per condominio/unità (verificato e approvato dall'utente).

### Da verificare (stato sconosciuto: chiedere all'utente prima di procedere)

- Gestione Moduli e Feature Toggle (/admin/moduli, Passo modulo Amministratore): schermata `/admin/moduli` protetta da guardia ADMIN; PageHeader istituzionale ("Moduli e funzionalità", breadcrumb "Home / Amministrazione / Moduli e funzionalità"); 3 StatCard ("Funzionalità attive", "Funzionalità disattivate", "Ambito di configurazione"); selettore ambito edificio/palazzo con gestione override dedicata ed ereditarietà dal condominio con pulsante e `ConfirmDialog` di ripristino valori predefiniti; barra di controllo con `SearchBar` e `FilterChips` (Tutti, Attivi, Disattivati, Condòmino, Portiere); elenco moduli configurabili con `Switch` accessibile WCAG 2.2 AA (`accessibilityRole="switch"`, touch target >= 44x44, focus ring `#0284C7`), `Badge` destinatari e stato, gestione disattivazioni con `ConfirmDialog` preventivo per moduli critici, salvataggio immediato ottimistico con rollback visivo in caso di errore; catalogo centrale tipizzato `CATALOGO_MODULI` in `@iocondo/data` con fallback trasparente (graceful degradation) per colonne non ancora migrate su DB; sincronizzazione reattiva immediata di `ProfiloContext` (`moduli`, `aggiornaModuli`, `ricaricaModuli`) tra le viste senza ricaricamento del browser; componente di protezione reale `GuardiaModulo` per tutte le schermate residenti collegate a feature toggle (`/prenotazioni`, `/raccolta-differenziata`, `/comunicazioni`, `/segnalazioni`, `/pacchi`, `/spese`, `/pagamenti`, `/documenti`, `/assemblee`, `/ticket-aree-comuni`); adattamento di `HomeScreen` per nascondere blocchi e scorciatoie di moduli disattivati; migrazione schema esteso in `supabase/da-applicare/11_moduli_condominio_estesi.sql` (con `11_verifica.sql` e `11_rollback.sql`) per le 5 colonne aggiuntive (`abilita_spese`, `abilita_pagamenti`, `abilita_documenti`, `abilita_assemblee`, `abilita_raccolta_differenziata`) da applicare su DB reale a cura dell'utente (da verificare dall'utente).

- Prenotazione spazi comuni (`/prenotazioni` e `/admin/prenotazioni`): logica pura e servizio `createPrenotazioniService` in `packages/data` con unit test (validazione risorsa e prenotazione, calcolo costo stimato, generazione slot giornalieri con privacy `"Occupato"` per vicini, traduzione errore `23P01`); navigazione collegata a `abilita_prenotazioni` per `RESIDENTE` (`CONDOMINO` e `PORTIERE`) e `ADMIN`; schermata residente con elenco spazi, `Le mie prenotazioni`, modale accessibile `"Prenota spazio comune"` con anteprima slot e `ConfirmDialog` di annullamento; schermata amministratore protetta da guardia `ADMIN` con 3 `StatCard`, 2 `Tabs` (`Spazi configurati` CRUD con `ConfirmDialog` cascade e `Calendario prenotazioni` con filtri e annullamento); script idempotenti `supabase/seed-dev/prenotazioni_extra.sql` e `_pulizia.sql` (da verificare dall'utente su DB reale).

- Raccolta differenziata (`/raccolta-differenziata` e `/admin/raccolta-differenziata`): logica pura e servizio `createRaccoltaDifferenziataService` in `packages/data` con unit test; navigazione aggiornata per vista `RESIDENTE` (`CONDOMINO` e `PORTIERE`) e `ADMIN`; schermata condòmino in sola lettura con riquadri "Oggi" e "Domani", filtri per giorno e ricerca testuale; schermata amministratore protetta da guardia `ADMIN` con 3 `StatCard`, `ResponsiveDataView`, modale accessibile di creazione/modifica con validazione e `ConfirmDialog` di eliminazione; script di prova idempotenti `supabase/seed-dev/raccolta_differenziata_extra.sql` e `_pulizia.sql` (da verificare dall'utente su DB reale).

- Contabilità e Bilanci (/admin/contabilita, Passo 8 modulo Amministratore): schermata `/admin/contabilita` protetta da guardia ADMIN; PageHeader istituzionale ("Contabilità e Bilanci", breadcrumb "Home / Amministrazione / Contabilità", pulsanti primari "Nuova spesa" e "Emetti rate" con icone Lucide); 4 StatCard ufficiali conformi a contrasto WCAG AA ("Saldo di Cassa Attuale" blu navy con icona `wallet`, "Riscossione Rate Esercizio" turchese teal con icona `badge-percent`, "Morosità Scadute" rosso/navy con badge d'allarme e icona `alert-triangle`, "Fondi Speciali Accantonati" viola/blu con icona `piggy-bank`); barra di navigazione a 5 schede (`Registro & Spese` con filtri date e scrittura di storno ex art. 1130 n. 7 c.c., `Preventivi & Rate` con consultazione/approvazione preventivo ed emissione piano rate, `Bollettini & Incassi` con anteprima bollettini, rettifica e imputazione incassi FIFO ex art. 1193 c.c., `Morosità & Recupero` con alert > 180 giorni ex art. 1129 co. 9 c.c., scadenziario pratiche e prospetto debitori con solidarietà subentro ex art. 63 disp. att. c.c., `Rendiconto & Conguagli` con semaforo completezza 3 documenti ex art. 1130-bis c.c. e prospetto conguagli unità); `ResponsiveDataView` (tabella su desktop/tablet e card su smartphone senza overflow orizzontale); modali accessibili senza `<ScrollView>` annidati ("Registra spesa", "Storna movimento", "Nuovo preventivo", "Approva preventivo", "Emetti rate", "Registra incasso", "Dettaglio bollettino / Rettifica"); migrazione schema in `supabase/da-applicare/10_contabilita_schema_modello_obiettivo.sql` (con `10_verifica.sql` e `10_rollback.sql`) e script di prova idempotenti in `supabase/seed-dev/admin_contabilita_*_extra.sql` e relativi `_pulizia.sql` (da verificare dall'utente).

- Assemblee del Condominio e Conduzione Sedute (/admin/assemblee e /admin/assemblee/[id], Passo 7 modulo Amministratore): schermata elenco `/admin/assemblee` e dettaglio `/admin/assemblee/[id]` protette da guardia ADMIN; PageHeader ("Assemblee del Condominio") con pulsante primario "Convoca nuova assemblea" (icona `calendar-plus`); 3 StatCard ufficiali ("Prossima assemblea" blu, "Assemblee dell'anno" navy, "Votazioni aperte" teal); barra di controllo con SearchBar e FilterChips per stato (Tutti, Convocate, In corso, Concluse, Bozze); ResponsiveDataView con tabella desktop/tablet e lista card mobile (Data Convocazione solo data formattata, Tipo, Stato con badge, Punti ODG; rimosse le colonne Modalità e Verbale PDF dalla vista tabellare); righe cliccabili con navigazione a `/admin/assemblee/[id]`; modale accessibile "Nuova Assemblea" con scelta tipologia (Ordinaria / Straordinaria, esclusivamente in presenza fisica), date/ore 1ª e 2ª convocazione, luogo fisico (rimossi del tutto link Meet e modalità online/ibrida), selettore tabella millesimale e checkbox bozza; schermata dettaglio con Breadcrumbs, testata assemblea con cambio stato ("In corso", "Concludi" senza errori di ritorno), luogo fisico e condivisione convocazione; Sezione 1 "Appello, Presenze e Deleghe" con box Quorum Costitutivo (teste e millesimi, validità seduta 1ª o 2ª conv.), tabella unità in tendina richiudibile (con compressione automatica al salvataggio e riespansione su richiesta) con stato presenza a 3 opzioni esclusive (Presente, Delega, Assente; rimosse le diciture "In sala" e "Online"), selettore delegato e calcolo cumulo deleghe con verifica tetto legale ex art. 67 disp. att. c.c., salvataggio presenze protetto con Toast di successo; Sezione 2 "Ordine del Giorno e Votazioni in Tempo Reale" con pulsante "+ Aggiungi punto all'ODG", apertura/chiusura votazioni senza errori di ritorno, monitor di sola lettura "Stato partecipazione al voto delle unità presenti" (con tracciamento esplicito delle deleghe `Proprietario (In delega a: Nome Delegato)` e badge Votato/Non votato, rimossi i pulsanti manuali di espressione voto dell'amministratore che non può votare né da qui né dal profilo), calcolo automatico doppia maggioranza teste e millesimi ex art. 1136 c.c. con Badge esito ("APPROVATA" verde / "RESPINTA" rosso), tabella analitica nominale per verbale (UC-10) integrata in tendina a comparsa ("Mostra tabella" / "Nascondi tabella") con colonna "Voto Espresso" allargata (150px) e badge non troncati ("Non espresso", "Favorevole", "Contrario", "Astenuto", "Assente") e pulsante "Copia testo per verbale"; Sezione 3 "Verbale e Documenti" con area upload PDF firmato su bucket privato `documenti-condominio`, link firmato temporaneo (600s), conclusione formale seduta (con pulsante "Concludi assemblea" presente sia in testata che allineato a destra in fondo pagina dopo la Sezione 3) e notifica residenti; script di prova in `supabase/seed-dev/admin_assemblee_extra.sql` e ripristino `_pulizia.sql` e policy admin in `supabase/da-applicare/09_assemblee_voti_admin.sql` (da verificare dall'utente).

- Documenti e Drive Condominiale (/admin/documenti, Passo 6 modulo Amministratore): schermata `/admin/documenti` protetta da guardia ADMIN, PageHeader ("Documenti e Drive Condominiale") con pulsanti primari "Nuova cartella" (icona `folder-plus`) e "Carica documento" (icona `upload`) e breadcrumbs dinamici (Home / Documenti / [Cartella]), 3 StatCard ufficiali ("Documenti archiviati" blu, "Cartelle create" navy, "Documenti riservati" teal), sezione navigazione cartelle con conteggi e cancellazione cartelle vuote con ConfirmDialog, barra di controllo con SearchBar e FilterChips per riservatezza (Tutti, Condominio, Riservati per unità), ResponsiveDataView con 5 colonne essenziali senza azioni e senza dimensione (Tipo, Nome file, Cartella, Caricato il, Destinatario con badge 'Condominio' verde vs 'Palazzo X - Int. Y' / 'Int. X'), apertura automatica della modale accessibile "Dettagli documento" al click su qualsiasi riga (con pulsanti dedicati Scarica con link firmato a 600s ed Elimina con ConfirmDialog distruttivo), eliminazione documento da storage e database, modale accessibile "Nuova cartella" con autofocus e validazione, modale accessibile "Carica nuovo documento" (REQ-A04) con selettore cartella, drag & drop / selezione file, selettore privacy/RLS (pubblico condominio vs riservato per unità con menù a tendina unità) e caricamento multipart, e script di prova in `supabase/seed-dev/admin_documenti_extra.sql` e ripristino `_pulizia.sql` (da verificare dall'utente).

- Manutenzione, Ticket e Fornitori (/admin/manutenzione, Passo 5 modulo Amministratore): schermata `/admin/manutenzione` protetta da guardia ADMIN con PageHeader (azione "Nuova segnalazione" con icona `wrench` identica al lato condòmino) e breadcrumbs integrati, 3 StatCard ufficiali ("Ticket guasti aperti", "Interventi in lavorazione", "Fornitori convenzionati"), navigazione a schede ("Ticket Guasti" e "Rubrica Fornitori"), tabella racchiusa in `<Card>` con SearchBar posizionata sopra i FilterChips (identica al layout condòmino), ResponsiveDataView con 5 colonne essenziali su riga singola senza sovrapposizioni (Priorità con Badge a colori pastello: Urgente, Alta, Media, Bassa; Titolo senza descrizione; Apertura; Stato con "In lavorazione" rigorosamente su riga singola; Azioni con unico pulsante "Modifica"), apertura automatica dei Dettagli al click su qualsiasi riga (identica al lato condòmino), Rubrica Fornitori con pulsante "Nuovo fornitore convenzionato" (nessun pulsante con `+` nel testo), modale accessibile di Modifica ticket (dati guasto, assegnazione fornitore & Magic Link UC-02/UC-08 con token 14 gg in `fornitori_tokens`, chiusura con consuntivo spesa), Dettagli completi, Nuova segnalazione e Nuovo fornitore, e script idempotenti di prova in `supabase/seed-dev/admin_manutenzione_extra.sql` e ripristino `_pulizia.sql` (da verificare dall'utente).

- Comunicazioni e Bacheca in Scrittura (/admin/comunicazioni, Passo 4 modulo Amministratore): schermata `/admin/comunicazioni` protetta da guardia ADMIN, 2 StatCard riepilogative ufficiali ("Comunicazioni attive" e "Avvisi in evidenza" con icona `pin`), card con SearchBar posizionata in alto sopra i FilterChips (Tutte, In evidenza, e singoli stabili, standard coerente con la sezione condòmino e manutenzione amministratore), visualizzazione ResponsiveDataView (tabella desktop/tablet e lista card mobile) con righe interamente cliccabili che aprono la modale Dettaglio comunicazione (con pulsanti ordinati come Chiudi, Modifica azzurro/blu primario ed Elimina rosso), colonna destinatari ("Condominio" o palazzo specifico), badge in evidenza su riga dedicata sempre sopra il titolo dell'avviso, colonna azioni con intestazione allineata a sinistra in modo coerente con le altre colonne e con `[Fissato / Fissa]` ed `[Elimina]` rigorosamente sulla stessa riga (con "Fissa" avente lo stesso contorno di "Fissato" `variant="secondary"`, rimossa interamente la logica dei commenti residenti), modale accessibile di pubblicazione/modifica con validazione titolo (min 3 car.), textarea multilinea espandibile con conteggio (min 10 car.), selettore destinatari e checkbox pin con generazione automatica notifiche destinatari in `notifiche`, e script idempotenti di prova in `supabase/seed-dev/admin_comunicazioni_extra.sql` e ripristino `_pulizia.sql` (da verificare dall'utente).

- Gestione Inviti Residenti e Portieri (/admin/inviti, Passo 3 modulo Amministratore): schermata `/admin/inviti` protetta da guardia ADMIN, 3 StatCard riepilogative ("Inviti in attesa", "Accettati questo mese", "Inviti scaduti"), barra di controllo con FilterChips e SearchBar real-time, tabella ResponsiveDataView (desktop/tablet e card per smartphone) con azioni riga (Sollecita, Revoca con ConfirmDialog accessibile, Rinnova invito per scaduti), modale accessibile "Invia nuovo invito" (UC-07) con validazione formato RFC, menù a tendina custom unità con bordi a 7px, opzione mansione aggiuntiva Portiere (utente ibrido), messaggio uniforme di sicurezza "Invito registrato." (problema 4) e dati di prova in `supabase/seed-dev/admin_inviti_extra.sql` (da verificare dall'utente).

- Struttura del Condominio e Tabelle Millesimali (/admin/struttura, Passo 2 modulo Amministratore): albero gerarchico spaziale (Palazzi -> Scale/Colonne -> Unità), anagrafiche residenti attivi con badge Proprietario/Inquilino, riepilogo tabelle millesimali con quadratura 1000 ‰, modali interattive per aggiunta palazzo, creazione scala/colonna, aggiunta/modifica unità con associazione diretta contestuale del condòmino, modale dedicata per associazione e gestione subentro (UC-11) e modale accessibile di importazione CSV quote millesimali (UC-09) con pulsante "Sfoglia file CSV" accessibile, validazione real-time, anteprima errori e blocco quadratura (da verificare dall'utente).
- Dashboard Amministratore (/admin/dashboard, Passo 1 modulo Amministratore): KPI saldi di cassa, stato riscossione rate esercizio in corso, morosità > 15 gg, ticket guasti urgenti, assemblea convocata, ultime comunicazioni e azioni rapide (da verificare dall'utente).
- Assemblee: sezione condòmino (`/assemblee` e `/assemblee/[id]`, UC-10), esclusione bozze, espressione voto per la propria unità e per le unità ricevute in delega con tracciamento nominale, percentuali aggregate via RPC `risultati_voto`, assemblee esclusivamente in presenza fisica (rimossi riferimenti e link Meet) e verbale nello Storage (`documenti-condominio`) (da verificare dall'utente).
- Registro pacchi: schermata `/pacchi`, modali di arrivo e ritiro con firma, isolamento unità per condòmino e dati di prova in `supabase/seed-dev/pacchi_extra.sql` (da verificare dall'utente).
- Impostazioni e Assistenza: schermate `/impostazioni` e `/assistenza`, modifica dati profilo (`nome_cognome`, `telefono`), cambio password via Supabase Auth, preferenze notifiche locali (`iocondo.preferenze.v1`), contatti dell'amministrazione affiancati a Guida e FAQ, numeri utili e pronto intervento H24 e dati di prova in `supabase/seed-dev/assistenza_extra.sql` (da verificare dall'utente).
- Migrazione `08a_fix_trigger_e_ruoli.sql` e `08a_verifica.sql`: rimandate dall'utente a dopo.
- Migrazione `08_...sql` (inviti sicuri): rimandata dall'utente a dopo.

### Non attivo

- Funzione `invita-utente`: non pubblicata (`npx supabase functions deploy invita-utente`, a cura dell'utente).
- Configurazione Supabase Auth per gli inviti: Redirect URLs (`/imposta-password`, `/reimposta-password`), template email in italiano, segreto `APP_URL`, SMTP o membro del team per le email di prova.
- Migrazione 07 (revoke execute funzioni definer): rimandata, file in `supabase/da-applicare/`.
- Leaked password protection: richiede il piano Pro.

### Ordine dei lavori da qui in poi

1. Chiudere le voci "Da verificare" (sezione sopra) e completare la configurazione inviti. Finché non è fatto, nessun utente reale può entrare.
2. Spese: completare e provare, poi committare. [COMPLETATO]
3. Documenti (`/documenti`): sola lettura, documenti condominiali pubblici/privati secondo RLS, link firmati a tempo, mai URL pubblici. [COMPLETATO]
4. Segnalazioni: condòmino apre ticket con foto e segue lo stato (REQ-C03, REQ-C04). Portiere: ticket aree comuni. [COMPLETATO]
5. Assemblee: condòmino vota e vede le percentuali; amministratore vede il report completo (UC-10). [COMPLETATO]
6. Registro pacchi (`/pacchi`): portiere registra pacchi in arrivo e segna il ritiro con firma; condòmino consulta i propri pacchi in giacenza (UC-07).
7. Impostazioni e Assistenza (`/impostazioni`, `/assistenza`): profilo personale, cambio password, preferenze notifiche, contatti del condominio e numeri di emergenza. [COMPLETATO - da verificare]
8. Super admin: Amministratori (invito ruolo ADMIN, collegamento `licenze_saas`), Piani e abbonamenti, Fatture.
9. Amministratore (gruppo `(admin)`): Dashboard [COMPLETATO - da verificare], Struttura (palazzi, scale/colonne, unità, anagrafiche, CSV millesimi) [COMPLETATO - da verificare], Inviti [COMPLETATO - da verificare], Comunicazioni in scrittura (/admin/comunicazioni) [COMPLETATO - da verificare], Manutenzione (ticket e fornitori, /admin/manutenzione) [COMPLETATO - da verificare], Documenti e Drive (/admin/documenti) [COMPLETATO - da verificare], Assemblee (/admin/assemblee) [COMPLETATO - da verificare], Contabilità e Bilanci (/admin/contabilita) [COMPLETATO - da verificare], Impostazioni (/admin/impostazioni) [PROSSIMO].
10. Fornitore: `/fornitore/[token]` tramite funzione o RPC che valida il token e restituisce solo i dati di quel ticket. Nessuna policy aperta ad `anon` sulle tabelle dei ticket.
11. Pre-rilascio (sezione 5).

## 4. Debiti tecnici

- Codice demo ancora presente, da non riusare: `apps/app/src/legacy/`, `useParcels`, `useReportIssue`, `RoleContext`, `CondominioContext` di `admin-web`, `useRataPayment` (contiene un pagamento simulato).
- Servizi duplicati tra `apps/admin-web` e `packages/data`: `admin-web` va migrato, poi eliminato.
- Richieste doppie al cambio condominio: innocue, da indagare.
- Documenti di prova senza file reale nello Storage.
- Risposta 502 di `invita-utente` che distingue "account non confermato" (enumerazione parziale, problema 4).
- Avatar nell'header a 195px: eccesso di circa 37-40px.
- Bucket `foto-guasti` e `avatar-utenti` pubblici: vanno resi privati con link firmati.
- Migrazione 07 da applicare dopo revisione.
- `vercel.json` è ancora quello di Next.js: va sostituito con la configurazione per l'export statico di Expo (build `expo export --platform web`, output `dist`, rewrite per le route). Finché non è fatto, ogni push su `main` può generare una build fallita.
- `@supabase/ssr` 0.5.2 in `admin-web`: valutare aggiornamento (gestione cookie anti-cache).
- TypeScript 5.6.3 nel monorepo mentre `expo-doctor` suggerisce 6.x: avviso silenziato, da riesaminare.
- 25 vulnerabilità npm segnalate: da valutare.
- `engines.node` alla radice: allineare a `>=22.13` (richiesto dall'SDK 58).

## 5. Checklist pre-rilascio

- [ ] Tutte le caselle di `docs/TEST_DA_FARE.md` spuntate dall'utente.
- [ ] RLS verificata per ogni tabella toccata, con test di isolamento da un secondo condòmino.
- [ ] Bucket privati e link firmati per documenti, bollettini e allegati.
- [ ] Redirect URLs di produzione, Site URL e `APP_URL` di produzione.
- [ ] SMTP proprio e template email in italiano.
- [ ] Leaked password protection attiva (piano Pro).
- [ ] Vercel configurato per l'app Expo, build verde.
- [ ] Prova su Android (Expo Go per SDK 58 o build di sviluppo) e su iPhone.
- [ ] Prova con TalkBack, VoiceOver e zoom reale al 200% in Chrome.
- [ ] `apps/admin-web` eliminato dopo verifica di tutte le sue funzioni.

## 6. Procedura per ogni task (per l'agente)

1. Leggere `AGENTS.md`, questo file, `docs/DECISIONI.md`, `docs/TEST_DA_FARE.md`.
2. Se il task tocca dati: analisi in sola lettura dello schema reale. Riportare in massimo 10 righe. Fermarsi se emerge un rischio di sicurezza o uno schema diverso dalle attese.
3. Implementare: logica pura e test in `packages/data`; componenti in `packages/ui`; schermate e rotte in `apps/app`.
4. Dati di prova: `supabase/seed-dev/<nome>.sql` più `<nome>_pulizia.sql`. Rieseguibili senza duplicati, nomi inventati, rispetto dei trigger esistenti. Non eseguire nulla sul database.
5. Aggiungere a `docs/TEST_DA_FARE.md` una sezione del task, con caselle non spuntate.
6. Verifiche: test, type-check, build, bundle web/Android/iOS (`npx expo export`); Playwright a 1440, 820 e 390 px con Supabase simulato; nessuno scroll orizzontale; focus visibile; testo leggibile al 200%.
7. Riportare in forma compatta: file creati, cosa funziona, cosa è solo predisposto, cosa deve fare l'utente, cosa provare.
8. Aggiornare la sezione 3 di questo file solo con lo stato "da verificare". Non segnare come completato ciò che l'utente non ha ancora provato.

## 7. Procedura per l'utente

- Commit: `git status --short`, `git add -A`, `git commit -m "..."`, `git push origin main`. Prima del commit controllare che non compaiano `.env`, `.playwright-mcp` o un `tsconfig.json` nella radice.
- Script SQL: copiare sempre dal file sul PC, mai dalla chat. Eseguire nell'SQL Editor.
- Prima di ogni migrazione: revisione di sicurezza in sola lettura da parte dell'agente.
- Un solo agente alla volta sul repository.
- Ogni PC: `npm install` dalla radice; file `.env` e `.env.local` creati a mano; su PowerShell `$env:NODE_OPTIONS="--use-system-ca"`; avvio da `apps/app` con `npx expo start --web --clear`.
- Dati di prova: `01` e `03` sono alla base; `05`, `comunicazioni_extra` e `spese_extra` sono opzionali per i test.

## 8. Prompt di avvio per ogni nuova sessione

> Leggi `AGENTS.md` e `docs/PIANO_LAVORO.md`. Riassumi in 10 righe la sezione 3 e dimmi quali voci "Da verificare" devo chiudere prima di iniziare. Non iniziare nessun task finché non ti confermo.