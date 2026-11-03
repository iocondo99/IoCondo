# Test da fare

Checklist completa prima del rilascio. Ogni voce riporta cosa fare e il risultato atteso.
Nessuna voce è ancora spuntata: spunta tu man mano che le esegui.

Legenda stati: la spunta vale solo se il test è passato sul database reale (non simulato).

---

## A. Database e configurazione (in quest'ordine, tutto a mano)

### A1 — Migrazione 08a: correzioni trigger e policy ruoli

- [ ] **Cosa fare:** aprire il SQL Editor di Supabase, eseguire
  `supabase/da-applicare/08a_fix_trigger_e_ruoli.sql`, poi eseguire
  `supabase/da-applicare/08a_verifica.sql` nella stessa sessione.
  **Risultato atteso:** tutte e sei le query di verifica mostrano "OK";
  in particolare: `handle_user_confirmed` ha il handler warning,
  `handle_new_user` non ha `RAISE EXCEPTION`, il ruolo ADMIN mostra
  `ruolo_non_admin_restituisce_true = false`.

- [ ] **Cosa fare:** dopo A1, fare login con l'account super admin dall'app
  (`http://localhost:8081`).
  **Risultato atteso:** login completato, Home caricata, nessun errore rosso
  in console (F12).

### A2 — Migrazione 08: inviti sicuri

- [ ] **Cosa fare:** eseguire `supabase/da-applicare/08_inviti_sicuri.sql`
  dal SQL Editor.
  **Risultato atteso:** la migrazione completa senza errori; dalla console SQL
  `SELECT proname FROM pg_proc WHERE proname IN ('crea_invito','email_confermata','invitante_valido')`
  restituisce tre righe.

- [ ] **Cosa fare:** fare di nuovo login con il super admin dopo A2.
  **Risultato atteso:** login invariato, Home funziona, nessuna regressione
  visibile nella sezione Spese e Scadenze.

### A3 — Configurazione Auth e redirect

- [ ] **Cosa fare:** nella dashboard Supabase → Authentication → URL
  Configuration, aggiungere (una per riga) tutte le URL elencate in
  `docs/CHECKLIST_INVITI.md` sezione 2 (`/imposta-password`,
  `/reimposta-password` per locale e produzione).
  **Risultato atteso:** i link delle email di invito e reset portano alla
  pagina corretta invece di essere rifiutati come "URL not allowed".

- [ ] **Cosa fare:** nella dashboard → Authentication → Email Templates,
  incollare i template di `docs/EMAIL_TEMPLATES.md` per "Invite" e
  "Reset Password".
  **Risultato atteso:** le email ricevute hanno il testo in italiano e il
  link con `{{ .RedirectTo }}`.

- [ ] **Cosa fare:** impostare il segreto `APP_URL` con la CLI Supabase
  (`npx supabase secrets set APP_URL=http://localhost:8081`) e pubblicare
  la funzione (`npx supabase functions deploy invita-utente`). Verificare
  con `npx supabase functions list`.
  **Risultato atteso:** la funzione `invita-utente` compare nell'elenco con
  "JWT Verification: enabled".

- [ ] **Cosa fare:** per provare l'invito su un indirizzo reale, configurare
  uno SMTP in Authentication → Emails → SMTP Settings (Resend, Postmark,
  SES ecc.) oppure usare un secondo indirizzo membro del team (max 2
  email/ora col server predefinito).
  **Risultato atteso:** l'email di invito arriva nella casella del destinatario.

---

## B. Prove senza migrazione attiva (si possono fare già ora)

### B1 — Login super admin

- [ ] **Cosa fare:** aprire `http://localhost:8081`, inserire email e password
  del super admin.
  **Risultato atteso:** si entra nell'app, l'header mostra "Super
  amministratore", la sidebar ha le voci previste.

### B2 — Pagina /imposta-password da disconnesso con link non valido

- [ ] **Cosa fare:** navigare direttamente a
  `http://localhost:8081/imposta-password` senza un token di sessione valido.
  **Risultato atteso:** la pagina mostra "Il link non è più valido" con il
  pulsante "Richiedi un nuovo link"; non si vede il modulo della password;
  nessun errore JavaScript in console.

### B3 — Pagina /reimposta-password da disconnesso con link non valido

- [ ] **Cosa fare:** navigare direttamente a
  `http://localhost:8081/reimposta-password` senza un token valido.
  **Risultato atteso:** stessa schermata di B2 (link non valido + pulsante
  di richiesta).

### B4 — "Password dimenticata?" risposta uniforme

- [ ] **Cosa fare:** dalla schermata di login premere "Password dimenticata?",
  inserire un indirizzo esistente, inviare. Ripetere con un indirizzo che
  non esiste.
  **Risultato atteso:** la risposta dell'app è identica nei due casi ("Se
  l'indirizzo è registrato, riceverai un'email" o simile); nessun messaggio
  rivela se l'email è registrata.

### B5 — Focus visibile con Tab sulla schermata password

- [ ] **Cosa fare:** aprire `/imposta-password` (o `/reimposta-password`),
  navigare con Tab tra tutti i controlli.
  **Risultato atteso:** ogni controllo riceve un contorno di focus ben visibile
  (#0284C7 su sfondo bianco); nessun elemento interattivo viene saltato;
  focus mai tagliato fuori dalla viewport.

### B6 — Layout a 820 px

- [ ] **Cosa fare:** aprire DevTools, impostare la larghezza a 820 px,
  navigare tra Home, /pagamenti e /imposta-password.
  **Risultato atteso:** nessuno scroll orizzontale, testi leggibili, pulsanti
  toccabili (almeno 44 px di area), sidebar collassata o sostituta da
  navigazione mobile.

### B7 — Errori rossi in console

- [ ] **Cosa fare:** navigare su Home, /pagamenti, /imposta-password con F12
  aperto; osservare la tab Console.
  **Risultato atteso:** nessun errore JavaScript rosso; gli eventuali warning
  di React Native Web (es. `accessibilityLabel`) da esaminare uno a uno e
  correggere se nascondono una regressione.

---

## C. Prove con migrazione e funzione attive

### C1 — Reset password completo

- [ ] **Cosa fare:** dalla schermata di login, richiedere il reset per un
  indirizzo registrato; aprire l'email; cliccare il link; scegliere una
  nuova password (almeno 8 caratteri); salvare.
  **Risultato atteso:** si entra nell'app senza un secondo login; il promemoria
  "password da scegliere" (localStorage `iocondo.password-da-scegliere.v1`)
  scompare dopo il salvataggio.

### C2 — Password non coincidenti o troppo corta

- [ ] **Cosa fare:** nella schermata /imposta-password o /reimposta-password,
  inserire due password diverse nel campo "Conferma" oppure inserire meno
  di 8 caratteri.
  **Risultato atteso:** messaggio di errore in italiano sotto il campo
  interessato; il form non viene inviato; i dati già inseriti restano.

### C3 — Sessione di recupero non apre /home

- [ ] **Cosa fare:** aprire il link di reset da una tab in cui non c'è ancora
  una sessione normale; provare a navigare manualmente a `/home` prima di
  salvare la password.
  **Risultato atteso:** `ProtectedLayout` reindirizza a `/imposta-password`
  finché la password non è stata salvata; non si accede ai contenuti protetti.

### C4 — Schermata "Invita una persona": elenco e modulo

- [ ] **Cosa fare:** accedere come amministratore, aprire la voce "Inviti"
  dal menu, verificare l'elenco degli inviti e il modulo di invito.
  **Risultato atteso:** l'elenco mostra gli inviti del condominio selezionato
  (o vuoto con messaggio "Nessun invito"); il modulo ha i campi email, ruolo
  (CONDOMINO / PORTIERE) e unità opzionale.

### C5 — Invito a un indirizzo nuovo

- [ ] **Cosa fare:** inviare un invito a un indirizzo email che non ha ancora
  un account (SMTP o membro del team).
  **Risultato atteso:** l'app mostra "Invito registrato."; nell'elenco compare
  la riga con stato "In attesa"; l'email arriva al destinatario.

### C6 — Accettazione invito e scelta password con ruolo corretto

- [ ] **Cosa fare:** aprire l'email di invito ricevuta, cliccare il link,
  scegliere una password, salvare.
  **Risultato atteso:** si entra nell'app con il ruolo CONDOMINO (o PORTIERE)
  nel condominio corretto; la riga nell'elenco inviti diventa "Accettato";
  la tabella `inviti_pendenti` ha `accettato_at` impostato;
  `utente_entita_ruolo` contiene la riga con il ruolo corretto.

### C7 — Link di invito già usato

- [ ] **Cosa fare:** aprire una seconda volta lo stesso link di invito
  già usato in C6.
  **Risultato atteso:** la pagina mostra "Il link non è più valido" con
  "Richiedi un nuovo link" (il link Supabase è monouso a livello di token
  Auth, indipendentemente dall'invito).

### C8 — Invitato già registrato (stessa risposta, nessuna email, ruolo e notifica)

- [ ] **Cosa fare:** da amministratore, inviare un invito allo stesso indirizzo
  di un utente già registrato e confermato.
  **Risultato atteso:** l'app risponde "Invito registrato." (stessa risposta
  del caso normale, nessuna differenza visibile); nessuna email viene inviata;
  il ruolo compare subito in `utente_entita_ruolo`; nella tabella `notifiche`
  dell'utente compare una notifica di tipo "invito".

### C9 — Ruolo ADMIN rifiutato a un amministratore non super

- [ ] **Cosa fare:** accedere come amministratore di condominio (non super
  admin), aprire il modulo Inviti e selezionare il ruolo ADMIN (se visibile),
  oppure chiamare direttamente la funzione `crea_invito` con `p_ruolo='ADMIN'`
  dal SQL Editor come `authenticated`.
  **Risultato atteso:** la funzione restituisce errore 42501 (Forbidden) e
  l'app mostra "Non puoi invitare persone in questo condominio" o simile;
  nessuna riga inserita in `inviti_pendenti`.

### C10 — Condòmino semplice apre la voce Inviti

- [ ] **Cosa fare:** accedere come condòmino semplice (nessun ruolo ADMIN,
  non super admin), verificare se la voce Inviti compare nel menu.
  **Risultato atteso:** la voce Inviti non compare nel menu (o, se raggiunta
  direttamente per URL, mostra lo stato "Non disponibile" senza rivelare
  informazioni).

### C11 — Controllo inviti_pendenti dopo i test C5–C9

- [ ] **Cosa fare:** dal SQL Editor: `SELECT email, accettato_at, scadenza FROM
  public.inviti_pendenti ORDER BY scadenza DESC LIMIT 20`.
  **Risultato atteso:** le righe degli inviti C5–C9 hanno i valori attesi
  (accettato_at impostato per C6, null per C5 non ancora accettato, nessuna
  riga con ruolo ADMIN se C9 ha funzionato).

### C12 — Invito a un account non confermato (reinvio)

- [ ] **Cosa fare:** invitare un indirizzo che ha già un account in `auth.users`
  ma con `email_confirmed_at` null (es. un invito precedente mai completato).
  **Risultato atteso:** annotare esattamente cosa succede (risposta HTTP,
  comportamento dell'email); vedi nota "Limite noto" in
  `docs/CHECKLIST_INVITI.md`. Se la risposta è 502 invece di 200, questo
  è il problema 4 annotato in `docs/DECISIONI.md`.

---

## D. Layout e Home

### D1 — Isolamento dati: secondo condòmino senza unità

- [ ] **Cosa fare:** creare un secondo utente di prova senza unità né anagrafica
  nel condominio di prova, accedere con quell'utente.
  **Risultato atteso:** la StatCard Spese mostra "€ 0,00 — Non ci sono rate
  da pagare"; la sezione Prossime scadenze è vuota; in SQL con
  `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" TO ...`
  il conteggio di `rate_dettaglio` è 0 per quell'utente.

### D2 — Cambio condominio senza ricaricare la pagina

- [ ] **Cosa fare:** se l'utente di prova ha accesso a più di un condominio,
  cambiare il condominio dal selettore dell'header.
  **Risultato atteso:** tutti i blocchi della Home si aggiornano (skeleton
  breve poi dati del nuovo condominio) senza ricaricare la pagina; il
  selettore aggiorna anche la pagina /pagamenti.

### D3 — Notifiche: due notifiche, una non letta

- [ ] **Cosa fare:** accedere con l'utente di prova (lo script
  `01_dati_prova.sql` crea due notifiche, una letta e una non letta).
  Aprire il pannello notifiche nell'header.
  **Risultato atteso:** il campanellino mostra un indicatore (es. punto rosso
  o numero "1"); nel pannello compaiono due notifiche; quella non letta ha
  lo stato "Non letto".

### D4 — Selettore "Vista" (condòmino + portiere)

- [ ] **Cosa fare:** con l'utente di prova (che ha sia CONDOMINO che PORTIERE
  e ADMIN), aprire il selettore Vista dall'header.
  **Risultato atteso:** compaiono le opzioni "Condòmino e portiere",
  "Amministratore" (e "Super amministratore" per l'utente super); la scelta
  aggiorna la navigazione e viene ricordata al prossimo accesso.

### D5 — Barra in basso su smartphone (390 px)

- [ ] **Cosa fare:** aprire DevTools a 390 px, navigare tra le voci della
  barra inferiore.
  **Risultato atteso:** la barra mostra le voci previste (Home, Spese,
  Documenti, Messaggi, Altro); le voci hanno etichette visibili e aree
  toccabili di almeno 44 px; la voce attiva è evidenziata.

---

## E. Dispositivi e accessibilità (prima del rilascio)

### E1 — Android con Expo Go

- [ ] **Cosa fare:** scansionare il QR di `npx expo start` con Expo Go su
  Android, navigare tra Home, /pagamenti e il modulo Inviti.
  **Risultato atteso:** nessun crash, layout corretto, testi leggibili,
  Dropdown e Modal si aprono e chiudono correttamente, il tasto Indietro
  di Android torna alla schermata precedente (non chiude l'app).

### E2 — Safari su iPhone (o simulatore)

- [ ] **Cosa fare:** aprire `http://localhost:8081` in Safari su iPhone (o
  nel simulatore iOS).
  **Risultato atteso:** nessun crash, layout mobile corretto, le schermate
  /imposta-password e /pagamenti funzionano, il selettore file (FileUpload)
  apre il picker nativo.

### E3 — TalkBack (Android) e VoiceOver (iOS/macOS)

- [ ] **Cosa fare:** attivare TalkBack o VoiceOver, navigare tra Home e
  /pagamenti: tutte le schede, i badge di stato, i filtri e la paginazione
  devono essere annunciati correttamente.
  **Risultato atteso:** ogni elemento ha un nome accessibile comprensibile;
  nessun elemento interattivo è saltato; i badge di stato leggono la
  descrizione testuale (es. "Scaduto" non solo il colore); l'elenco rate
  è navigabile per righe.

### E4 — Zoom 200% in Chrome

- [ ] **Cosa fare:** in Chrome desktop impostare lo zoom al 200% (Ctrl +
  cinque volte), navigare tra le pagine.
  **Risultato atteso:** nessuno scroll orizzontale, testo leggibile, nessun
  contenuto sovrapposto, i pulsanti restano raggiungibili con Tab.

### E5 — Dropdown, Modal e Toast su nativo

- [ ] **Cosa fare:** su Android (Expo Go), aprire un Dropdown (es. selettore
  ordina), aprire una Modal (es. conferma azione), attendere un Toast.
  **Risultato atteso:** si aprono e chiudono correttamente; su Android il
  tasto Indietro chiude Modal e Dropdown invece di uscire dalla schermata.

### E6 — Selettore file

- [ ] **Cosa fare:** su Android e iOS (se applicabile), usare il componente
  FileUpload (es. nella segnalazione o nell'upload documenti).
  **Risultato atteso:** il picker nativo si apre, il file viene selezionato
  e passato al componente; un file troppo grande mostra un errore in italiano.

---

## F. Da sistemare più avanti

Voci note ma non urgenti: verificale prima di passare a utenti reali.

- [ ] **Richieste doppie al cambio condominio** — al cambio del condominio
  selezionato si osservano doppie query su alcuni servizi. Da indagare con
  React DevTools prima del rilascio pubblico.

- [ ] **Documenti di prova senza file nello Storage** — lo script
  `03_dati_home.sql` crea righe in `documenti_metadata` senza file reali
  nel bucket `documenti-condominio`. Il pulsante di download mostra
  "Bollettino non disponibile" correttamente, ma non si può testare il
  download completo con questi dati.

- [ ] **Enumerazione parziale (problema 4)** — la Edge Function risponde
  HTTP 502 per email esistenti ma non confermate e 200 per le altre. Da
  correggere prima di aprire gli inviti a utenti reali (vedi nota in
  `docs/DECISIONI.md`).

- [ ] **Leaked password protection** — richiede il piano Pro di Supabase.
  Attivare in Authentication → Password security prima del lancio.

- [ ] **SMTP per inviti reali** — il server email predefinito raggiunge solo
  i membri del team. Configurare un SMTP proprio prima di invitare i
  condòmini reali (vedi `docs/CHECKLIST_INVITI.md` sezione 4).

- [ ] **Bucket pubblici `foto-guasti` e `avatar-utenti`** — attualmente
  `public = true`: chiunque con l'URL può leggere i file. Rendere privati
  e usare link firmati prima di avere dati reali.

- [ ] **Migrazione 07 rimandata** — `supabase/da-applicare/07_revoke_execute_funzioni_definer.sql`
  non è ancora stata applicata. Applicarla prima del lancio per togliere
  il grant EXECUTE da `anon` e `public` sulle funzioni trigger.

- [ ] **Riscrittura del codice demo rimasto** — `RoleContext`,
  `CondominioContext` di admin-web, `useRataPayment` (providerRef fittizio),
  `useParcels`, `useReportIssue` usano ancora dati dimostrativi. Da
  riscrivere prima di aprire quelle sezioni a utenti reali.

- [ ] **Allineamento avatar nell'header a 195 px** — a quella larghezza
  l'avatar esce dalla sua area. Da correggere nella prossima revisione UI.

---

## Comunicazioni (/comunicazioni e /comunicazioni/[id])

- [ ] **Cosa fare:** nel SQL Editor di Supabase incollare l'UUID dell'utente di prova in `v_utente_test_id` dentro `supabase/seed-dev/comunicazioni_extra.sql` ed eseguire lo script.
  **Risultato atteso:** lo script termina con `NOTICE: Comunicazioni extra di prova pronte per il condominio ...` senza errori; rieseguendolo una seconda volta non crea duplicati e ripristina lo stato non letto delle notifiche di prova.

- [ ] **Cosa fare:** dalla Home (`/home`) verificare il blocco "Ultime comunicazioni": premere su una singola riga e poi premere "Vedi tutte".
  **Risultato atteso:** premendo una riga si apre `/comunicazioni/[id]` della comunicazione scelta; premendo "Vedi tutte" si apre `/comunicazioni`; il pulsante "Consulta le richieste" resta sul segnaposto `/segnalazioni`.

- [ ] **Cosa fare:** aprire `/comunicazioni` su desktop (1440 px), tablet (820 px) e smartphone (390 px).
  **Risultato atteso:** su desktop e tablet compare la tabella (`Titolo`, `Data`, `Autore`, `Stato`), su smartphone l'elenco a schede; i post fissati (`is_pinned = true`) compaiono in cima con l'etichetta testuale "Fissata in alto" (non solo icona); le comunicazioni non lette mostrano il `Badge` "Non letto" (icona + testo), quelle lette "Letta" e quelle senza notifica collegata "—".

- [ ] **Cosa fare:** in `/comunicazioni` provare i `FilterChips` (`Tutti`, `Non lette`, `Lette`) e il pulsante "Azzera filtri", la ricerca per titolo e l'ordinamento per `Data` (da intestazione tabella con Invio/Spazio o dal selettore "Ordina per" su smartphone) e la `Pagination`.
  **Risultato atteso:** i filtri e la ricerca aggiornano il conteggio e le righe mostrate; "Azzera filtri" riporta a `Tutti`; l'ordinamento inverte l'ordine cronologico mantenendo i post fissati in cima; la paginazione passa tra pagina 1 e pagina 2.

- [ ] **Cosa fare:** aprire il dettaglio di una comunicazione non letta (`/comunicazioni/[id]`), verificare `Breadcrumbs` (`Home / Comunicazioni / ...`), data, autore, destinatari e testo completo, premere "Segna come letta" (o tornare all'elenco).
  **Risultato atteso:** la comunicazione viene segnata come letta in `notifiche` solo per l'utente corrente (`utente_id = auth.uid()`); in pagina lo stato passa a "Letta" e tornando a `/comunicazioni` o `/home` il badge "Non letto" non compare più.

- [ ] **Cosa fare:** aprire il dettaglio di una comunicazione senza notifica collegata (es. `d0000000-0000-4000-8000-000000000210`).
  **Risultato atteso:** il dettaglio mostra data, autore e testo completo senza mostrare lo stato "Letta" né il pulsante "Segna come letta" (non viene inventato uno stato di lettura).

- [ ] **Cosa fare:** provare ad aprire direttamente per URL una comunicazione del Palazzo B (`http://localhost:8081/comunicazioni/d0000000-0000-4000-8000-000000000213`) o un id inesistente (`http://localhost:8081/comunicazioni/00000000-0000-4000-8000-000000000999`).
  **Risultato atteso:** in entrambi i casi compare lo stesso stato `NonAutorizzato` ("Questa comunicazione non è disponibile") con il pulsante "Torna alle comunicazioni", senza rivelare se il post esiste o appartiene a un altro edificio/condominio.


---

## Spese (/spese e /spese/[id])

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/spese_extra.sql` (dopo `01_dati_prova.sql` e `03_dati_home.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Spese pronti: esercizi ...` senza errori; rieseguendolo una seconda volta non crea duplicati.

- [ ] **Cosa fare:** aprire `/spese` dalla voce "Spese" della barra laterale (desktop) o della barra inferiore (smartphone) su 1440 px, 820 px e 390 px; verificare anche che in Home (`/home`) il pulsante "Vedi le rate" continui a portare a `/pagamenti`.
  **Risultato atteso:** in cima a `/spese` compaiono le 3 `StatCard` reali ("Spese esercizio in corso", "Ultimo consuntivo approvato" con anno e totale, "Preventivo in corso" con anno e totale) e sotto la `ResponsiveDataView` con gli esercizi (`Anno`, `Periodo`, `Stato` con `Badge` dotato di icona + testo `Preventivo` / `Consuntivo` / `Chiuso`, `Totale` allineato a destra in formato `€ 2.480,00`). Nessun pulsante di pagamento o modifica è presente.

- [ ] **Cosa fare:** selezionare l'esercizio in stato `CONSUNTIVO` dalla lista in `/spese` per aprire `/spese/[id]`.
  **Risultato atteso:** compaiono i `Breadcrumbs` (`Home / Spese / Esercizio <anno>`), il riepilogo dell'esercizio, la scheda "Totali per macro-categoria" con gli importi e le percentuali calcolati per ciascuna categoria del piano dei conti (`A`, `B`, `C`, `D`) e la `ResponsiveDataView` dei movimenti di spesa (`Data`, `Descrizione`, `Sottoconto`, `Segno`, `Importo`). Il movimento di incasso (`segno = '+'`) non compare e non viene sommato.

- [ ] **Cosa fare:** in `/spese/[id]` provare i `FilterChips` per sottoconto, la `SearchBar` per descrizione, l'ordinamento per `Data` e per `Importo` (da intestazione tabella anche con tastiera tramite Tab + Invio/Spazio, o dal selettore "Ordina per" su smartphone) e la `Pagination` (pagina 1 e pagina 2).
  **Risultato atteso:** i filtri e la ricerca aggiornano il conteggio e le righe mostrate; quando nessun movimento corrisponde compare lo stato vuoto "Non ci sono spese da mostrare."; l'ordinamento ordina correttamente per data o importo crescente/decrescente; la paginazione passa tra le pagine di 10 movimenti ciascuna.

- [ ] **Cosa fare:** verificare la sezione "Documento allegato" in `/spese/[id]` prima e dopo aver caricato manualmente un file PDF chiamato `fattura_ascensore_consuntivo.pdf` nel bucket privato `documenti-condominio` dentro la cartella `d0000000-0000-4000-8000-000000000001/fatture/`.
  **Risultato atteso:** finché il file non è presente nello Storage (come per `fattura_fantasma_non_caricata.pdf`), la sezione "Documento allegato" non compare affatto; dopo aver caricato `fattura_ascensore_consuntivo.pdf` nello Storage, la sezione compare e il pulsante "Scarica allegato" apre un link firmato temporaneo (`createSignedUrl`, mai pubblico).

- [ ] **Cosa fare:** provare ad aprire direttamente per URL l'esercizio del secondo condominio (`http://localhost:8081/spese/d0000000-0000-4000-8000-000000000491`) e un id inesistente (`http://localhost:8081/spese/00000000-0000-4000-8000-000000000999`).
  **Risultato atteso:** in entrambi i casi compare lo stesso identico stato `NonAutorizzato` ("Questo esercizio non è disponibile") con il pulsante "Torna alle spese".
