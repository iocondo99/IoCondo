# PIANO DI LAVORO: "Tu", piattaforma condominiale

Questo file è la fonte di verità per ordine dei lavori, stato e regole. Va letto all'inizio di ogni sessione, insieme a `CLAUDE.md`. Se qualcosa qui contrasta con un prompt ricevuto, vince questo file e si chiede conferma all'utente.

## 1. Regole vincolanti per l'agente

- Si lavora solo sul branch `main`. Non creare branch.
- Nessun comando `git` (`add`, `commit`, `push`, `pull`, `stash`, `reset`, `checkout`, `restore`, `clean`, `diff`, `status`). Commit e push li fa l'utente.
- Il database Supabase è in sola lettura per l'agente. Ogni modifica al database passa da file in `supabase/seed-dev/` (dati di prova) o `supabase/da-applicare/` (migrazioni da rivedere), che l'utente esegue a mano nell'SQL Editor. L'agente non esegue mai migrazioni.
- Non leggere né stampare i file `.env*`.
- Nessuna password, token, chiave o email reale in codice, test, log o documenti. Nell'app solo la chiave pubblica. Mai `service_role`.
- Non toccare: `supabase/migrations/` esistenti, `apps/admin-web` (da eliminare a migrazione verificata), `.env*`.
- Nessuna libreria nuova senza approvazione esplicita. Se serve, elencarla con motivo e attendere.
- Nessun colore o misura scritti a mano fuori da `packages/ui/src/tokens.ts`.
- Nessun dato dimostrativo nell'interfaccia finale. I dati finti stanno solo in `/design-system` e negli script in `supabase/seed-dev/`.
- Nessun pagamento simulato. Il condòmino legge; le scritture sono dell'amministratore.
- Ogni schermata deve funzionare su web, Android e iOS (i bundle devono completare). Differenze di layout con `useBreakpoint`; file `.web.tsx` / `.native.tsx` solo se necessario.
- Accessibilità: tastiera completa sul web, focus `#0284C7` mai ritagliato, ruoli e stati corretti, testi in italiano semplice, nessuna interazione solo con hover.
- Un task alla volta. Non spuntare mai le caselle di `docs/TEST_DA_FARE.md`: le spunta l'utente.

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

- Struttura del Condominio e Tabelle Millesimali (/admin/struttura, Passo 2 modulo Amministratore): albero gerarchico spaziale (Palazzi -> Scale/Colonne -> Unità), anagrafiche residenti attivi con badge Proprietario/Inquilino, riepilogo tabelle millesimali con quadratura 1000 ‰, modali interattive per aggiunta palazzo, creazione scala/colonna, aggiunta/modifica unità con associazione diretta contestuale del condòmino, modale dedicata per associazione e gestione subentro (UC-11) e modale accessibile di importazione CSV quote millesimali (UC-09) con pulsante "Sfoglia file CSV" accessibile, validazione real-time, anteprima errori e blocco quadratura (da verificare dall'utente).
- Dashboard Amministratore (/admin/dashboard, Passo 1 modulo Amministratore): KPI saldi di cassa, stato riscossione rate esercizio in corso, morosità > 15 gg, ticket guasti urgenti, assemblea convocata, ultime comunicazioni e azioni rapide (da verificare dall'utente).
- Assemblee: sezione condòmino (`/assemblee` e `/assemblee/[id]`, UC-10), esclusione bozze, espressione voto, percentuali aggregate via RPC `risultati_voto`, link Meet sicuro e verbale nello Storage (`documenti-condominio`) (da verificare dall'utente).
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
9. Amministratore (gruppo `(admin)`): Dashboard [IN CORSO - da verificare], Struttura (palazzi, scale/colonne, unità, anagrafiche, CSV millesimi) [COMPLETATO - da verificare], Contabilità (bilanci, rate, ripartizione), Manutenzione (ticket e fornitori), Comunicazioni in scrittura, Documenti, Assemblee.
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

1. Leggere `CLAUDE.md`, questo file, `docs/DECISIONI.md`, `docs/TEST_DA_FARE.md`.
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

> Leggi `CLAUDE.md` e `docs/PIANO_LAVORO.md`. Riassumi in 10 righe la sezione 3 e dimmi quali voci "Da verificare" devo chiudere prima di iniziare. Non iniziare nessun task finché non ti confermo.
