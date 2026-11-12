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
  **Risultato atteso:** la StatCard Spese e scadenze mostra "€ 0,00 — Non ci sono rate
  da pagare"; in SQL con
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

### D6 — Home: verifica Spese e scadenze, Ultime comunicazioni e Segnalazioni rapide

- [ ] **Cosa fare:** accedere con l'utente di prova alla Home (`/home`) a 1440 px, 820 px e 390 px.
  **Risultato atteso:** la prima StatCard in alto si intitola "Spese e scadenze" (mostra importo da pagare o "Non ci sono rate da pagare" e pulsante "Vedi le rate" se presenti insoluti); la sezione "Prossime scadenze" NON è presente; al di sotto della griglia a 4 schede compare la card "Ultime comunicazioni" a larghezza piena con link "Vedi tutte"; al di sotto compare la card "Segnalazioni rapide" con due pulsanti a comportamento differenziato: "Segnala un problema" apre direttamente la modale popup di nuova segnalazione senza lasciare la Home (con campi, validazioni, focus trap e barra di scorrimento ben distanziata dai campi e dal drop file), mentre "Consulta le richieste" porta a `/segnalazioni`; nessun elemento deborda orizzontalmente.

### D7 — Header: Dropdown profilo e focus outline degli elementi del menu

- [ ] **Cosa fare:** accedere con l'utente di prova a 1440 px, 820 px e 390 px e fare clic sull'avatar/nome utente nell'Header ("Luca Romano") per aprire il menu a tendina profilo. Navigare tra le voci "Impostazioni" ed "Esci dall'account" tramite click e tramite tastiera (frecce FrecciaGiù/FrecciaSu e Tab).
  **Risultato atteso:** il menu si apre correttamente sotto il pulsante trigger; la prima voce ("Impostazioni") riceve il focus con un indicatore di selezione (`#0284C7`) dagli angoli arrotondati (raggio 6px), perfettamente armonizzato e distanziato con 4px di padding all'interno del contenitore, senza spigoli vivi ritagliati né tagli diagonali ai bordi; la navigazione con tastiera ed Esc chiudono il menu restituendo il focus al pulsante trigger senza errori in console.

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

---

## Documenti (/documenti e /documenti/[id])

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/documenti_extra.sql` (dopo `01_dati_prova.sql` e `03_dati_home.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Documenti pronti per il condominio ...` senza errori; rieseguendolo una seconda volta non crea duplicati.

- [ ] **Cosa fare:** dalla Home (`/home`) premere sulla card/sezione "Documenti" e verificare anche l'apertura da barra laterale (desktop/tablet) e barra inferiore (smartphone) a 1440 px, 820 px e 390 px.
  **Risultato atteso:** si apre `/documenti` con `PageHeader` ("Documenti" e sottotitolo col nome del condominio), 3 `StatCard` reali ("Documenti disponibili", "Condominiali", "Della tua unità") coerenti con `homeService.contaDocumenti`, e la `ResponsiveDataView` con colonne `Nome documento`, `Cartella`, `Visibilità` (`Badge` con icona + testo: `Condominiale` / `Unità Int. 1`) e `Data`. Il documento dell'Unità 2 (`d0000000-0000-4000-8000-000000000531`) e quello del secondo condominio (`d0000000-0000-4000-8000-000000000592`) NON compaiono, nemmeno se l'utente ha anche ruolo `ADMIN`.

- [ ] **Cosa fare:** in `/documenti` provare i `FilterChips` per cartella (`Tutte` e ciascuna cartella del condominio), la `SearchBar` per nome file o cartella, il pulsante "Azzera filtri" (anche dallo stato vuoto quando nessun documento corrisponde), l'ordinamento per `Nome documento` e per `Data` (da intestazione tabella anche con tastiera tramite Tab + Invio/Spazio, o dal selettore "Ordina per" su smartphone) e la `Pagination` (pagina 1 e pagina 2).
  **Risultato atteso:** i filtri e la ricerca aggiornano il conteggio e le righe mostrate; quando nessun documento corrisponde compare `EmptyState` con il pulsante "Azzera filtri" che ripristina l'elenco completo; l'ordinamento ordina correttamente per data o nome file crescente/decrescente; la paginazione passa tra le pagine di 10 documenti ciascuna.

- [ ] **Cosa fare:** selezionare un documento dalla lista per aprire `/documenti/[id]` quando il file non è ancora caricato nel bucket `documenti-condominio`.
  **Risultato atteso:** compaiono i `Breadcrumbs` (`Home / Documenti / <Nome file>`), la card "Riepilogo documento" (nome file, cartella, visibilità con `Badge` e descrizione, formato/tipo MIME, data di caricamento) e nella card "Scaricamento" compare l'avviso chiaro e onesto `"File non ancora disponibile nello spazio di archiviazione"` senza errori non gestiti.

- [ ] **Cosa fare:** caricare manualmente un PDF di prova nel bucket privato `documenti-condominio` al percorso `d0000000-0000-4000-8000-000000000001/regolamenti/Regolamento_condominiale_vigente.pdf`, aggiornare `/documenti/d0000000-0000-4000-8000-000000000511` e premere "Scarica documento".
  **Risultato atteso:** compare il pulsante "Scarica documento" e solo al clic viene generato e aperto un link firmato temporaneo (`createSignedUrl`, validità 600 secondi, mai `getPublicUrl`).

- [ ] **Cosa fare:** provare ad aprire direttamente per URL il documento dell'Unità 2 (`http://localhost:8081/documenti/d0000000-0000-4000-8000-000000000531`), il documento del secondo condominio (`http://localhost:8081/documenti/d0000000-0000-4000-8000-000000000592`) e un id inesistente (`http://localhost:8081/documenti/00000000-0000-4000-8000-000000000999`).
  **Risultato atteso:** in tutti e tre i casi compare lo stesso identico stato `NonAutorizzato` ("Questo documento non è disponibile") con il pulsante "Torna ai documenti", senza enumerazione.


---

## Segnalazioni (/segnalazioni, /segnalazioni/[id] e /ticket-aree-comuni)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/segnalazioni_extra.sql` (dopo `01_dati_prova.sql` e `03_dati_home.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Segnalazioni pronti per il condominio ...` senza errori; rieseguendolo una seconda volta non crea duplicati.

- [ ] **Cosa fare:** dalla Home (`/home`) premere "Consulta le richieste" (o "Segnala un problema") e aprire anche la voce "Segnalazioni" da barra laterale (desktop/tablet) e barra inferiore (smartphone) a 1440 px, 820 px e 390 px.
  **Risultato atteso:** si apre `/segnalazioni` con `PageHeader` ("Segnalazioni", pulsante "Nuova segnalazione"), 4 `StatCard` reali (Totale segnalazioni, Aperte, In lavorazione, Risolte) e la tabella con `Badge` di stato (icona + testo). Il ticket dell'Unità 2 (`d0000000-0000-4000-8000-000000000631`), quello del secondo condominio (`...691`) e i ticket di area comune aperti da altri (`...620`, `...621`) NON compaiono, nemmeno se l'utente ha anche ruolo `ADMIN`.

- [ ] **Cosa fare:** in `/segnalazioni` provare i `FilterChips` per stato (Tutti, Aperti, In lavorazione, Risolti), la `SearchBar` per titolo o categoria, "Azzera filtri", l'ordinamento per Priorità, Stato e Data (da intestazione tabella con tastiera, o dal selettore "Ordina per" su smartphone) e la `Pagination` (pagina 1 e 2).
  **Risultato atteso:** filtri, ricerca e ordinamento aggiornano righe e conteggio; senza risultati compare `EmptyState` con "Azzera filtri".

- [ ] **Cosa fare:** premere "Nuova segnalazione", lasciare il titolo vuoto e inviare; poi compilare titolo, categoria, ambito (propria unità o area comune), priorità, allegare una foto JPEG/PNG/WEBP/HEIC e inviare. Provare anche un file PDF o oltre 15 MB.
  **Risultato atteso:** il titolo vuoto mostra un errore chiaro; PDF e file oltre 15 MB vengono rifiutati con messaggio; l'invio corretto chiude il modulo, mostra la conferma e la nuova segnalazione compare in elenco con stato "Aperto". La foto è nel bucket `foto-guasti` al percorso `<condominio_id>/<ticket_id>/<file>`.

- [ ] **Cosa fare:** aprire `/segnalazioni/d0000000-0000-4000-8000-000000000611` (foto di prova non caricate nello Storage).
  **Risultato atteso:** `Breadcrumbs` (`Home / Segnalazioni / <titolo>`), riepilogo con stato, priorità, categoria, ambito, date di apertura e chiusura, messaggi con nome del mittente e avviso onesto "Foto non ancora disponibile nello spazio di archiviazione".

- [ ] **Cosa fare:** caricare una foto nel bucket `foto-guasti` al percorso `d0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000611/foto_perdita.jpg`, ricaricare il dettaglio e premere "Apri foto".
  **Risultato atteso:** compare il pulsante "Apri foto" e al clic si apre un link firmato temporaneo (`createSignedUrl`, 600 secondi, mai `getPublicUrl`).

- [ ] **Cosa fare:** nel dettaglio scrivere un messaggio vuoto e premere "Invia messaggio", poi scrivere un testo valido e inviare.
  **Risultato atteso:** il messaggio vuoto mostra un errore; quello valido compare nella cronologia come "Tu" e lo stato della segnalazione non cambia (lo cambia solo l'amministratore).

- [ ] **Cosa fare:** aprire per URL il ticket dell'Unità 2 (`http://localhost:8081/segnalazioni/d0000000-0000-4000-8000-000000000631`), quello del secondo condominio (`.../segnalazioni/d0000000-0000-4000-8000-000000000691`) e un id inesistente (`.../segnalazioni/00000000-0000-4000-8000-000000000999`).
  **Risultato atteso:** in tutti e tre i casi compare lo stesso `NonAutorizzato` ("Questa segnalazione non è disponibile") con il pulsante "Torna a Segnalazioni".

- [ ] **Cosa fare:** con un utente con ruolo `PORTIERE` nel condominio (vista residente) aprire `/ticket-aree-comuni`; con un utente senza ruolo portiere provare lo stesso URL.
  **Risultato atteso:** il portiere vede solo i ticket di area comune (`...617`-`...621`, più quelli aperti da lui) e NON quelli di unità (`...611`, `...631`); gli altri utenti vedono `NonAutorizzato`.

- [ ] **Cosa fare:** da `/ticket-aree-comuni` premere "Nuovo ticket", compilare titolo e foto opzionale, inviare e aprire il dettaglio del ticket creato (`/ticket-aree-comuni/<id>`).
  **Risultato atteso:** il modulo non chiede l'unità; il ticket è registrato con `is_area_comune = true` e `unita_id` vuoto; il dettaglio mostra ambito "Area comune" e permette di scrivere messaggi. Aprire da qui un ticket di unità mostra `NonAutorizzato`.

- [ ] **Cosa fare:** a 1440 px, 820 px, 390 px e con zoom 200% navigare con Tab elenco, modulo e dettaglio.
  **Risultato atteso:** nessuno scroll orizzontale, anello di focus `#0284C7` sempre visibile e mai ritagliato.

- [ ] **Cosa fare:** eseguire `supabase/seed-dev/segnalazioni_extra_pulizia.sql`.
  **Risultato atteso:** termina con `NOTICE: Dati extra Segnalazioni rimossi.` e i ticket di prova spariscono dall'app.

---

## Assemblee (/assemblee e /assemblee/[id])

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/assemblee_extra.sql` (dopo `01_dati_prova.sql` e `03_dati_home.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Assemblee pronti per il condominio ...` senza errori; rieseguendolo una seconda volta non crea duplicati.

- [ ] **Cosa fare:** dalla Home (`/home`) verificare la scheda riepilogativa "Assemblea" su desktop (1440 px), tablet (820 px) e smartphone (390 px) e premere il pulsante contestuale "Dettagli".
  **Risultato atteso:** la scheda mostra la data dell'assemblea convocata futura, il testo descrittivo ("Prossima assemblea") e premendo il pulsante apre `/assemblee` (oppure il dettaglio diretto dell'assemblea convocata).

- [ ] **Cosa fare:** aprire `/assemblee` da barra laterale (desktop) o barra inferiore (smartphone) su 1440 px, 820 px e 390 px.
  **Risultato atteso:** si apre la pagina con `PageHeader` ("Assemblee" e sottotitolo dinamico col nome del condominio), 3 `StatCard` reali ("Prossima assemblea", "Assemblee dell’anno", "Votazioni aperte") e la `ResponsiveDataView` con le assemblee convocate, in corso e concluse (`Data assemblea`, `Luogo / Modalità`, `Stato` con `Badge`, `Ordine del giorno`). L'assemblea bozza (`...780`) e quella del secondo condominio (`...792`) NON compaiono, nemmeno per un utente con ruolo ADMIN.

- [ ] **Cosa fare:** in `/assemblee` provare i `FilterChips` per stato (`Tutte`, `Convocate`, `In corso`, `Concluse`), la `SearchBar` per ordine del giorno o luogo, "Azzera filtri", l'ordinamento cronologico per data (da intestazione tabella con Invio/Spazio o da selettore "Ordina per" su smartphone) e la `Pagination`.
  **Risultato atteso:** filtri e ricerca aggiornano il conteggio e le righe visibili; se nessun risultato corrisponde compare `EmptyState` con il pulsante "Azzera filtri" che ripristina la vista; l'ordinamento inverte correttamente l'ordine cronologico.

- [ ] **Cosa fare:** dalla lista in `/assemblee` cliccare sulla riga dell'assemblea `IN_CORSO` per aprire il dettaglio (`/assemblee/d0000000-0000-4000-8000-000000000730`).
  **Risultato atteso:** si apre `/assemblee/[id]` con `Breadcrumbs` (`Home / Assemblee / Assemblea del ...`), card riepilogo con `Badge` "In corso", data e orario, modalità, riquadro "Riunione online disponibile" con pulsante "Partecipa alla riunione online" (apre link `https://meet.google.com/live-condominio-prova`), e sotto l'elenco dei punti ODG.

- [ ] **Cosa fare:** nel punto ODG 1 ("Intervento urgente riparazione pluviale e grondaia", con votazione aperta) dell'assemblea in corso, premere "Favorevole" (o "Contrario" o "Astenuto").
  **Risultato atteso:** compare l'indicatore di caricamento, l'avviso di conferma "Voto registrato con successo", il voto espresso viene memorizzato nel database su `assemblee_voti` associato all'unità dell'utente e il pulsante selezionato viene evidenziato con badge "Espresso: Favorevole".

- [ ] **Cosa fare:** verificare che per i punti ODG i risultati mostrati sotto ("Risultati complessivi dell’assemblea") siano aggregati (percentuale teste con numero voti e percentuale millesimi con quote) e che NON compaiano i voti nominali o i nomi dei singoli vicini (anonimato e rispetto UC-10).

- [ ] **Cosa fare:** aprire il dettaglio dell'assemblea conclusa (`/assemblee/d0000000-0000-4000-8000-000000000750`).
  **Risultato atteso:** `Badge` "Conclusa", punti ODG con votazioni chiuse, risultati storici aggregati calcolati tramite la RPC `risultati_voto` con quote millesimali (150 su 270 millesimi favorevoli, 120 contrari). Nella sezione "Verbale dell’assemblea" compare l'avviso che il file non è ancora presente nello Storage finché non viene caricato un PDF.

- [ ] **Cosa fare:** caricare un file PDF di prova chiamato `verbale_assemblea_approvazione_2026.pdf` nel bucket privato `documenti-condominio` al percorso `d0000000-0000-4000-8000-000000000001/verbali/`, ricaricare la pagina dell'assemblea conclusa e premere "Scarica verbale".
  **Risultato atteso:** compare il pulsante "Scarica verbale" e al clic si apre un link firmato temporaneo (`createSignedUrl`, 600 secondi, mai URL pubblico).

- [ ] **Cosa fare:** provare ad aprire direttamente per URL l'assemblea in stato bozza (`http://localhost:8081/assemblee/d0000000-0000-4000-8000-000000000780`), l'assemblea del secondo condominio (`.../assemblee/d0000000-0000-4000-8000-000000000792`) e un id inesistente (`.../assemblee/00000000-0000-4000-8000-000000000999`).
  **Risultato atteso:** in tutti e tre i casi compare lo stesso identico stato `NonAutorizzato` ("Questa assemblea non è disponibile") con il pulsante "Torna alle assemblee", senza enumerazione.

- [ ] **Cosa fare:** a 1440 px, 820 px, 390 px e con zoom al 200% navigare con Tab elenco e dettaglio assemblea.
  **Risultato atteso:** nessuno scroll orizzontale, anello di focus `#0284C7` sempre visibile e mai ritagliato su tutti i controlli interattivi (pulsanti, chips, righe, barra di ricerca).

- [ ] **Cosa fare:** eseguire `supabase/seed-dev/assemblee_extra_pulizia.sql`.
  **Risultato atteso:** termina con `NOTICE: Dati extra Assemblee rimossi con successo.` e i dati di prova spariscono dall'applicazione.


---

## Registro Pacchi (/pacchi)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/pacchi_extra.sql` (dopo `01_dati_prova.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Registro Pacchi pronti per il condominio ...` senza errori; rieseguendolo una seconda volta non crea duplicati.

- [ ] **Cosa fare:** con l'utente di prova (ruoli `PORTIERE` e `CONDOMINO`) aprire `/pacchi` da barra laterale (desktop) o da "Altro" / barra inferiore (smartphone) a 1440 px, 820 px e 390 px.
  **Risultato atteso:** si apre la pagina con `PageHeader` ("Registro pacchi", sottotitolo e pulsante primario "Registra arrivo pacco" con icona `package-plus`), 3 `StatCard` reali ("Pacchi in giacenza", "Ritirati di recente", "Totale pacchi") e la tabella/elenco con i pacchi dell'Unità 1 e dell'Unità 2. Il pacco del secondo condominio isolato (`...0895`) NON compare.

- [ ] **Cosa fare:** in `/pacchi` provare i `FilterChips` per stato (`Tutti`, `In giacenza`, `Ritirati`), la `SearchBar` per unità (es. "Int. 1", "Int. 2"), "Azzera filtri", l'ordinamento (per Data arrivo, Destinazione, Stato) e la `Pagination`. Verificare che il badge "In giacenza" resti tutto su una sola linea senza andare a capo.
  **Risultato atteso:** filtri, ricerca e ordinamento aggiornano dinamicamente le righe e il conteggio; se nessun risultato corrisponde compare l'icona di stato vuoto con il pulsante "Azzera filtri" che ripristina l'elenco. Il badge di stato "In giacenza" si trova interamente su un'unica linea orizzontale.

- [ ] **Cosa fare:** come portiere premere "Registra arrivo pacco", lasciare l'unità vuota e premere "Registra"; poi selezionare un'unità dal menu a tendina (ordinato per palazzo/interno) e premere "Registra".
  **Risultato atteso:** l'invio senza unità mostra un messaggio di errore chiaro; la registrazione corretta chiude la modale, mostra il messaggio di successo ("Arrivo pacco registrato con successo"), incrementa il contatore "Pacchi in giacenza" e il nuovo pacco compare in elenco con badge "In giacenza".

- [ ] **Cosa fare:** nella riga di un pacco in stato `GIACENZA` premere direttamente il pulsante "Consegna" (senza menu a tre puntini), lasciare il campo firma vuoto e inviare; poi inserire la firma "Giulia Verdi (delegata)" e confermare.
  **Risultato atteso:** il campo vuoto mostra un errore chiaro; l'invio valido chiude la modale, mostra il messaggio di successo ("Ritiro registrato con successo"), il pacco passa a stato "Ritirato", mostra la data del ritiro con la firma e le StatCard si aggiornano.

- [ ] **Cosa fare:** con un utente che ha esclusivamente il ruolo `CONDOMINO` (senza portiere né admin) aprire `/pacchi`.
  **Risultato atteso:** la schermata si apre in modalità sola lettura: il condòmino vede esclusivamente i pacchi destinati alla propria unità (Unità 1); i pacchi dell'Unità 2 e del secondo condominio non sono visibili; il pulsante "Registra arrivo pacco" e l'azione "Consegna" non sono presenti.

- [ ] **Cosa fare:** a 1440 px, 820 px, 390 px e con zoom al 200% navigare con Tab elenco, modali e controlli.
  **Risultato atteso:** nessun elemento causa scroll orizzontale, focus `#0284C7` sempre visibile e mai ritagliato su pulsanti, campi di testo, chips e controlli interattivi.

- [ ] **Cosa fare:** eseguire `supabase/seed-dev/pacchi_extra_pulizia.sql`.
  **Risultato atteso:** termina con `NOTICE: Dati extra Registro Pacchi rimossi con successo.` e i record di prova spariscono dall'applicazione.


---

## Impostazioni e Assistenza (/impostazioni e /assistenza)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/assistenza_extra.sql` (dopo `01_dati_prova.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Assistenza pronti per il condominio ...` senza errori; l'esecuzione è idempotente e rieseguendola non crea duplicati.

- [ ] **Cosa fare:** da utente autenticato aprire `/impostazioni` da barra laterale (desktop e tablet a 1440 px e 820 px) o dal menu profilo / navigazione mobile (390 px).
  **Risultato atteso:** si apre la pagina con `Breadcrumbs` (`Home / Impostazioni`), `PageHeader` ("Impostazioni" con descrizione) e quattro schede strutturate: "Profilo personale", "Sicurezza dell'account", "Preferenze notifiche" e "Sessione". Su desktop a 1440 px la colonna sinistra presenta "Profilo personale" e la colonna destra presenta "Sicurezza dell'account" e "Preferenze notifiche", con la scheda del profilo che si allinea perfettamente all'altezza della colonna destra terminando rigorosamente allo stesso livello orizzontale di "Preferenze notifiche" (sia il bordo scheda a 1222 px sia gli elementi inferiori a 1197 px con "Salva modifiche" a sinistra e la nota informativa di salvataggio automatico a destra); sotto le colonne la scheda "Sessione" si estende a tutta larghezza con testo a sinistra e pulsante "Esci dall'account" a destra. Su tablet (820 px) e smartphone (390 px) le schede scorrono verticalmente in ordine logico senza debordamenti né scroll orizzontale.

- [ ] **Cosa fare:** nella scheda "Profilo personale" verificare le informazioni visualizzate (iniziali avatar corrette, email di accesso, ruolo attivo con nome del condominio).
  **Risultato atteso:** le informazioni visualizzate corrispondono al profilo autenticato con il nome utente allineato al centro del badge di ruolo e centrato con l'Avatar; è presente il riquadro "Dati dell'appartamento" con palazzina/scala, interno, piano, quota millesimale e badge di possesso; il campo email è disabilitato in sola lettura con nota descrittiva che ne chiarisce la gestione amministrativa.

- [ ] **Cosa fare:** modificare il campo "Nome e cognome" inserendo un solo carattere e premere "Salva modifiche"; successivamente inserire un numero di telefono non valido (es. "abc") e premere "Salva modifiche".
  **Risultato atteso:** il sistema blocca il salvataggio evidenziando il campo con `aria-invalid="true"` e mostrando un messaggio di errore chiaro ("Il nome deve contenere almeno 2 caratteri" o "Inserisci un numero di telefono valido"); nessuna richiesta non valida viene inviata a Supabase.

- [ ] **Cosa fare:** inserire un nome valido (es. "Luca Romano") e un recapito telefonico corretto (es. "+39 333 1000004") e premere "Salva modifiche".
  **Risultato atteso:** compare l'indicatore di caricamento, l'avviso di conferma "Modifiche salvate con successo", l'header dell'applicazione aggiorna le iniziali e il nome se modificato, e il database registra i nuovi recapiti su `utenti`.

- [ ] **Cosa fare:** nella scheda "Sicurezza dell'account" inserire una password inferiore a 8 caratteri (es. "pass") e nel campo di conferma un testo diverso (es. "different"), poi premere "Aggiorna password".
  **Risultato atteso:** i campi mostrano gli avvisi di validazione ("La password è troppo corta: servono almeno 8 caratteri" e "Le due password non coincidono"); il pulsante è disabilitato se i campi sono vuoti; l'icona a occhio consente di mostrare o nascondere la password inserita.

- [ ] **Cosa fare:** nella scheda "Preferenze notifiche" attivare e disattivare i toggle per "Notifiche email", "Avvisi bacheca e messaggi" e "Promemoria scadenze rate". Ricaricare la pagina con F5.
  **Risultato atteso:** i cambi di stato vengono salvati immediatamente nello storage locale con la chiave `iocondo.preferenze.v1` senza perdere le preferenze di navigazione preesistenti; al ricaricamento della pagina lo stato dei toggle resta persistito come impostato.

- [ ] **Cosa fare:** nella scheda "Sessione" premere "Esci dall'account". Nella finestra di dialogo che compare premere "Annulla"; premere nuovamente "Esci dall'account" e poi "Esci".
  **Risultato atteso:** il pulsante apre un `ConfirmDialog` accessibile con focus gestito e ruoli ARIA; "Annulla" chiude la modale mantenendo la sessione attiva; "Esci" disconnette in sicurezza l'utente, pulisce lo stato e reindirizza alla schermata `/login`.

- [ ] **Cosa fare:** aprire `/assistenza` da barra laterale (desktop) o dal footer/menu su 1440 px, 820 px e 390 px.
  **Risultato atteso:** si apre la pagina con `Breadcrumbs` (`Home / Assistenza`), `PageHeader` ("Assistenza e contatti"), con le 3 schede ("Amministrazione del condominio", "Guida e FAQ", "Pronto intervento e numeri utili") disposte verticalmente una sotto l'altra a tutta larghezza (960 px su desktop, 100% su tablet e smartphone); su desktop l'anteprima delle 4 FAQ si dispone su griglia a 2 colonne. Nessun elemento genera scroll orizzontale.

- [ ] **Cosa fare:** nella scheda "Amministrazione del condominio" verificare i dati dello studio (nome studio, referente, indirizzo, orari) e testare i pulsanti "Chiama" e "Scrivi".
  **Risultato atteso:** i recapiti mostrano i dati reali dell'amministratore del condominio attivo; "Chiama" attiva il protocollo `tel:` e "Scrivi" attiva `mailto:` con l'indirizzo email precompilato.

- [ ] **Cosa fare:** nella scheda "Guida e FAQ" verificare l'anteprima delle domande frequenti e premere "Consulta guida completa".
  **Risultato atteso:** si apre la modale accessibile "Guida rapida e domande frequenti" con le FAQ relative a guasti urgenti, pagamenti/rate, assemblee e ascensori; premendo "Chiudi" o "Chiudi guida" la modale si chiude e il focus torna al pulsante di apertura.

- [ ] **Cosa fare:** nella sezione "Pronto intervento e numeri utili" verificare i contatti di emergenza (Pronto Intervento Ascensore H24, Fabbro e Idraulico, Numero Unico 112, Vigili del Fuoco 115).
  **Risultato atteso:** ogni scheda presenta titolo, badge di reperibilità oraria, descrizione del servizio, numero di telefono e pulsante "Chiama ora" con protocollo `tel:`.

- [ ] **Cosa fare:** a 1440 px, 820 px, 390 px e con zoom al 200% navigare con il tasto Tab tutti i controlli delle due schermate.
  **Risultato atteso:** nessun elemento deborda orizzontalmente, l'anello di focus `#0284C7` (o bianco su fondo navy) è sempre nitido e visibile, e la console del browser non presenta errori.

- [ ] **Cosa fare:** eseguire `supabase/seed-dev/assistenza_extra_pulizia.sql`.
  **Risultato atteso:** termina con `NOTICE: Dati extra Assistenza rimossi con successo.` e i dati di prova di assistenza/polizza vengono rimossi.

---

## Dashboard Amministratore (/admin/dashboard)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_dashboard_extra.sql` (dopo `01_dati_prova.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Dashboard Amministratore pronti per il condominio ...` senza errori; l'esecuzione è idempotente e rieseguendola non crea duplicati. Vengono inseriti un movimento di saldo iniziale positivo per la cassa, 3 ticket con differenti priorità (Alta, Media, Bassa) e stati (Aperto, In corso), e verificate le ultime comunicazioni e assemblee.

- [ ] **Cosa fare:** con un utente avente ruolo `ADMIN` (oppure `is_superadmin = true`) accedere all'applicazione e aprire `/admin/dashboard` da barra laterale (desktop) o dal menu di navigazione su desktop (1440 px), tablet (820 px) e smartphone (390 px).
  **Risultato atteso:** si apre la pagina con `PageHeader` ("Dashboard Amministratore"), il selettore del condominio attivo con badge del condominio e il chip indicatore dell'esercizio contabile corrente (es. "Esercizio: 2026 (Preventivo)").

- [ ] **Cosa fare:** verificare i valori e le informazioni mostrate nelle 4 `StatCard` ufficiali posizionate in testata:
  1. "Saldo cassa": mostra il saldo reale calcolato sui movimenti contabili con formattazione in valuta europea (es. "€ 14.850,00"), colore verde/successo se positivo o rosso se negativo, indicatore visivo di tendenza e nota descrittiva.
  2. "Riscossione rate": mostra la percentuale riscossa dell'esercizio corrente calcolata su `rate_dettaglio` (es. "13%"), il totale incassato rispetto al totale preventivato e la nota sulla morosità scaduta da oltre 15 giorni con badge di attenzione.
  3. "Ticket guasti aperti": mostra il numero totale di ticket aperti o in lavorazione (es. "3") con i sottotitoli/badge per ticket ad alta priorità e ticket in lavorazione.
  4. "Prossima assemblea": mostra la data formattata della prossima assemblea convocata futura, il tipo ("Ordinaria" o "Straordinaria") e il luogo o link telematico.

- [ ] **Cosa fare:** su desktop a 1440 px verificare il layout a due colonne:
  - **Colonna sinistra:**
    - Scheda "Ticket guasti urgenti": mostra la lista ordinata per gravità decrescente (priorità ALTA in cima con badge rosso/warning), data di apertura, titolo del guasto, unità immobiliare associata e pulsante rapido "Gestisci" per ciascuna riga. Se non vi sono ticket aperti, mostra lo stato vuoto informativo.
    - Scheda "Ultime comunicazioni pubblicate": mostra le ultime 3 comunicazioni in bacheca con titolo, data di pubblicazione, badge priorità e pulsante "Vai alla bacheca".
  - **Colonna destra:**
    - Scheda "Stato riscossione dell'esercizio": barra di avanzamento percentuale visiva, riepilogo dettagliato degli importi (Incassato, Da riscuotere, Totale preventivato), importo morosità scaduta da oltre 15 giorni evidenziato in rosso, e pulsante "Registro contabilità".
    - Scheda "Azioni rapide": pulsanti interattivi per le operazioni quotidiane più frequenti ("Nuovo avviso", "Registra movimento", "Nuovo ticket").
  **Risultato atteso:** le due colonne sono ben bilanciate, i testi sono formattati correttamente con i token di colore e tipografia ufficiali, nessuna sovrapposizione visiva.

- [ ] **Cosa fare:** ridimensionare la viewport a tablet (820x1180 px) e mobile (390x844 px).
  **Risultato atteso:** il layout collassa verticalmente in modo fluido: le StatCard si dispongono su 2 colonne o colonna singola, la colonna sinistra scorre prima della colonna destra, i pulsanti e le righe mantengono un'area touch di almeno 44 px e `document.documentElement.scrollWidth <= window.innerWidth` (zero scroll orizzontale su tutti i breakpoint).

- [ ] **Cosa fare:** verificare la visualizzazione a zoom 200% su browser desktop.
  **Risultato atteso:** i blocchi e i testi vanno a capo naturalmente, nessun testo viene troncato in modo illeggibile, la leggibilità è garantita e non compare alcuno scroll orizzontale.

- [ ] **Cosa fare:** navigare l'intera schermata della dashboard utilizzando esclusivamente la tastiera (tasto Tab e Shift+Tab).
  **Risultato atteso:** tutti gli elementi interattivi (pulsanti "Gestisci", pulsante "Vai alla bacheca", pulsante "Registro contabilità", bottoni delle azioni rapide e card cliccabili) ricevono l'anello di focus accessibile `#0284C7` nitido, ben visibile e mai ritagliato fuori dai bordi.

- [ ] **Cosa fare:** verificare i contrasti cromatici secondo WCAG 2.2 AA.
  **Risultato atteso:** tutti i testi (`#0F172A`, `#475569`) e tutti gli elementi interattivi primari (`#0A79AB`) rispettano il rapporto di contrasto minimo 4.5:1 rispetto allo sfondo bianco/card.

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_dashboard_extra_pulizia.sql`.
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Dashboard Amministratore rimossi con successo.` e i dati aggiuntivi di prova della dashboard vengono rimossi senza intaccare il resto dei dati del condominio.

---

## Struttura del Condominio e Tabelle Millesimali (/admin/struttura)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_struttura_extra.sql` (dopo `01_dati_prova.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Struttura e Millesimi pronti: 2 palazzi, 6 unita, 2 tabelle millesimali quadrate a 1000 ‰.` senza errori. L'esecuzione è idempotente e non crea duplicati. Vengono configurati 2 palazzi (Palazzo A e Palazzo B), le scale (Scala A, Scala B, Scala Unica), 6 unità complessive con anagrafiche residenti attivi, e 2 tabelle millesimali quadrate ("Tabella A - Proprietà Generale" e "Tabella B - Scale e Ascensore Palazzo A").

- [ ] **Cosa fare:** con un utente avente ruolo `ADMIN` (oppure `is_superadmin = true`) accedere all'applicazione e aprire `/admin/struttura` dalla voce "Struttura" nella barra laterale o via URL diretto sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844).
  **Risultato atteso:** si apre la pagina con `Breadcrumbs` (`Home / Struttura`), `PageHeader` ("Struttura del Condominio") con sottotitolo e pulsanti d'azione primari: "Importa millesimi CSV", "Aggiungi edificio" e "Nuova unità".

- [ ] **Cosa fare:** verificare i valori e le informazioni mostrate nelle 3 `StatCard` ufficiali in testata:
  1. "Edifici e Palazzi": mostra il numero totale di edifici (es. "2 Palazzi"), icona `building-2`, tessera blu e nota "Edifici nel condominio".
  2. "Totale unità immobiliari": mostra il numero totale di unità (es. "6 Unità"), icona `home`, tessera navy e la metratura calpestabile complessiva (es. "510 mq complessivi").
  3. "Residenti associati": mostra il numero di unità con residenti attivi assegnati (es. "6 Assegnate"), icona `users`, tessera teal e la percentuale di occupazione attiva (es. "100% unità con residente attivo").

- [ ] **Cosa fare:** nella Scheda 1 ("Edifici e Unità") testare la barra di ricerca e i filtri a chip:
  - Digitare nel campo "Cerca unità" un interno (es. "1") o il cognome di un residente (es. "Romano").
  - Premere i chip per filtrare per edificio (es. "Palazzo A", "Palazzo B" o "Tutti i palazzi").
  **Risultato atteso:** l'elenco si aggiorna in tempo reale filtrando istantaneamente i palazzi e le unità pertinenti; premendo "Azzera filtri" la vista si reimposta su tutti gli immobili.

- [ ] **Cosa fare:** nella Scheda 1 verificare l'albero gerarchico degli edifici e delle scale:
  - Per ogni Palazzo: verifica il nome, l'indirizzo, il badge del totale unità e mq complessivi, e il pulsante "+ Nuova unità".
  - Per ogni Scala/Colonna: verifica il titolo della scala (es. "Scala A", "Scala B", o "Senza scala / Generale") con conteggio unità.
  - Per ogni Unità: verifica il badge dell'interno ("Int. 1"), la destinazione d'uso (es. "Appartamento", "Box auto"), il piano, la superficie in mq e il badge del residente ("Proprietario: Luca Romano" con badge verde di successo o "Non assegnata").
  - Premere il pulsante "Dettagli" su una riga.
  **Risultato atteso:** si apre la modale accessibile "Dettaglio unità" con il riepilogo dei dati spaziali, catastali (foglio, particella, subalterno) e anagrafica residente con recapiti telefonici e quota possesso.
  - Premere il pulsante "Modifica" su una riga.
  **Risultato atteso:** si apre la modale "Modifica Unità" precompilata con i dati correnti dell'unità; modificando un valore (es. piano o mq) e premendo "Salva modifiche", la modifica viene salvata e la lista aggiornata.

- [ ] **Cosa fare:** premere il pulsante "Aggiungi edificio" in testata.
  **Risultato atteso:** si apre la modale accessibile "Aggiungi nuovo edificio o palazzo"; compilare nome identificativo (es. "Palazzo C") e indirizzo, poi premere "Crea edificio". L'edificio viene creato e compare nell'albero e nelle StatCard. In caso di errore o restrizione permessi, la modale rimane aperta mostrando un `Alert` rosso inline con il messaggio esplicativo del problema, senza mostrare notifiche toast verdi di successo errate.

- [ ] **Cosa fare:** premere il pulsante "Nuova scala" in testata oppure "+ Nuova scala" nella card di un edificio/palazzo.
  **Risultato atteso:** si apre la modale accessibile "Aggiungi scala o colonna":
  - Se aperta dalla card dell'edificio, il campo "Edificio / Palazzo *" è già preselezionato con il palazzo di riferimento;
  - Selezionare la tipologia ("Scala" o "Colonna") e inserire il nome identificativo (es. "Scala A", "Scala B", "Colonna Nord");
  - Premere "Crea scala": la scala viene creata su Supabase con toast di conferma verde (`tone: 'success'`), la modale si chiude e la nuova scala compare immediatamente nell'albero dell'edificio e nell'elenco di selezione delle unità.

- [ ] **Cosa fare:** testare l'associazione tra condòmino e appartamento (unità immobiliare):
  - Per un'unità non assegnata: premere il pulsante "Associa" sulla riga dell'unità (o "Assegna condòmino" dalla modale "Dettagli");
  - Si apre la modale "Associa condòmino · Int. X" con il riassunto della collocazione spaziale;
  - Selezionare il condòmino dal menù a tendina (elenco degli utenti del condominio), scegliere il tipo di possesso ("Proprietario", "Inquilino / Affittuario", "Usufruttuario"), la quota di possesso (es. 100%) e la data di decorrenza (es. data odierna);
  - Premere "Salva associazione": l'anagrafica viene registrata su `anagrafiche_unita`, la modale si chiude e sulla riga compare il badge con il nominativo del residente attivo.
  - Per un'unità con residente attivo: premere il pulsante "Residente" (o "Modifica / Subentro residente" da "Dettagli");
  - La modale mostra il box riepilogativo dell'attuale residente assegnato con pulsante "Termina assegnazione attuale" (per chiudere il possesso) e la possibilità di selezionare un nuovo condòmino per registrare un subentro (UC-11).

- [ ] **Cosa fare:** verificare la visualizzazione e l'anello di focus delle opzioni nei menù a tendina (`Select`):
  - Aprire una modale contenente un menù a tendina (es. "Nuova scala", "Nuova unità" o "Associa condòmino") e cliccare sul controllo per espandere le opzioni;
  - Verificare che la prima riga dell'elenco abbia gli angoli superiori raccordati con un raggio di 7 px corrispondente al bordo interno del contenitore;
  - Verificare che l'ultima riga dell'elenco abbia gli angoli inferiori raccordati con un raggio di 7 px;
  - Spostare il focus con la tastiera (frecce Su/Giù) o selezionare la prima e l'ultima opzione: verificare che l'anello di focus accessibile `#0284C7` (con `boxShadow` inset) segua la curvatura arrotondata degli angoli senza essere minimamente ritagliato dal contenitore con `overflow: hidden`.

- [ ] **Cosa fare:** premere il pulsante "Nuova unità" in testata.
  **Risultato atteso:** si apre la modale accessibile "Nuova unità immobiliare":
  - verificare che la spaziatura tra il titolo ("Nuova unità immobiliare") e la descrizione sottostante sia compatta ed equilibrata (`gap: space[1]`, 4 px), allineata con l'icona di chiusura;
  - verificare che sui menù a tendina (`Select`: "Edificio / Palazzo *", "Scala o Colonna", "Destinazione d'uso / Tipologia *"), durante l'apertura e la valorizzazione della scelta, il bordo e l'anello di focus accessibile `#0284C7` siano continui, nitidi e mai ritagliati sui lati; al clic esterno o blur il menù si chiuda ripristinando lo stato di riposo;
  - verificare che i box dei campi sul lato destro abbiano il respiro previsto dai token e non siano minimamente ritagliati o schiacciati;
  - verificare che quando si valorizzano i campi di testo (es. "Numero Interno *", "Piano", "Superficie calpestabile (mq)", "Subalterno") il bordo e l'anello di focus accessibile `#0284C7` siano nitidi, continui e mai ritagliati sui lati destro, superiore o inferiore;
  - verificare che la barra di scorrimento verticale della finestra sia posizionata all'estremo bordo destro della modale (in piena conformità con `ModuloNuovaSegnalazione` del condòmino), lasciando ampio spazio tra i controlli e la barra di scorrimento;
  - verificare la sezione "Condòmino assegnato (opzionale)": selezionando un condòmino dal menù a tendina compaiono i campi tipologia possesso (Proprietario, Inquilino, Usufruttuario) e quota di possesso (es. 100%), consentendo l'assegnazione immediata del residente all'atto della creazione dell'unità (o in fase di modifica);
  - selezionare palazzo, tipologia, inserire interno obbligatorio, piano e superficie; premendo "Crea unità", la nuova unità viene inserita e collegata alla scala/palazzo selezionato (e al condòmino assegnato, se indicato).

- [ ] **Cosa fare:** passare alla Scheda 2 ("Tabelle Millesimali") premendo il relativo tab.
  **Risultato atteso:** il pannello mostra le tabelle millesimali attive (es. "Tabella A - Proprietà Generale" e "Tabella B - Scale e Ascensore Palazzo A"):
  - Ogni tabella riporta il totale previsto (1000 ‰), la somma calcolata delle quote effettive (es. "1000,000 ‰") e il badge di quadratura ("Quadrata a 1000 ‰" con tono verde/successo se la somma è 1000 ‰, oppure badge rosso/errore "Disavanzo da correggere: +X ‰" se differisce).
  - Viene mostrata la tabella/elenco con le quote per ciascun appartamento (interno, tipologia, edificio/scala, valore millesimale formattato a 3 decimali e percentuale relativa).

- [ ] **Cosa fare:** nella Scheda 2 o in testata premere "Importa millesimi CSV" (UC-09):
  1. Verificare che la modale "Importa millesimi da file CSV" si apra con focus intrappolato e ruoli accessibili.
  2. Verificare che il pulsante "Sfoglia file CSV" sia un `Button` ufficiale del design system (variante secondaria con icona `upload`), con altezza touch di 44 px, perfettamente armonizzato con "Scarica template CSV" e conforme all'accessibilità da tastiera.
  3. Premere "Scarica template CSV": verificare che scarichi il file `.csv` di esempio precompilato con le unità e scale esistenti (o incolli il template nell'area di testo).
  3. Modificare una riga impostando una somma errata (es. totale 950 ‰): verificare che l'anteprima segnali il disavanzo ("Disavanzo: +50,000 ‰") e che il pulsante "Applica e salva quote" sia bloccato/disabilitato.
  4. Inserire una riga con formato numerico italiano con virgola (es. `250,500`) e verificare la corretta interpretazione decimale.
  5. Inserire una riga con un interno inesistente (es. `Int. 99`): verificare che la riga venga evidenziata in rosso con la spiegazione dell'errore ("Unità non trovata nel condominio").
  6. Inserire dati con quadratura esatta a 1000,000 ‰ senza errori: verificare che il riepilogo mostri il badge verde "Quadrata a 1000 ‰" e che il pulsante "Applica e salva quote" diventi attivo.
  7. Premere "Applica e salva quote": le nuove quote vengono salvate su Supabase con notifica Toast di successo e la tabella millesimale si aggiorna immediatamente.

- [ ] **Cosa fare:** verificare la schermata sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844).
  **Risultato atteso:** `document.documentElement.scrollWidth <= window.innerWidth` su tutti i breakpoint (zero scroll orizzontale); le StatCard e le righe delle unità si adattano fluidamente; i pulsanti mantengono un'area touch minima di 44 px.

- [ ] **Cosa fare:** testare la navigazione via tastiera (Tab, Shift+Tab, Frecce sinistra/destra nei Tab) e zoom al 200%.
  **Risultato atteso:** l'anello di focus accessibile `#0284C7` è nitido e mai ritagliato su tabelle, tab, input, pulsanti e modali; con zoom 200% i testi vanno a capo senza troncamenti e senza scroll orizzontale.

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_struttura_extra_pulizia.sql`.
  **Risultato atteso:** lo script termina con `NOTICE: Dati extra Struttura e Millesimi rimossi con successo.` e i dati aggiuntivi di prova della struttura e tabelle vengono rimossi in modo sicuro.

---

## Gestione Inviti Residenti e Portieri (/admin/inviti, Passo 3 modulo Amministratore)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_inviti_extra.sql` (dopo `01_dati_prova.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati di prova inviti inseriti/aggiornati con successo.` senza errori. L'esecuzione è idempotente e crea 3 inviti di prova per il Condominio di Prova (`d0000000-0000-4000-8000-000000000001`): 1 in attesa (CONDOMINO per Int. 2, scadenza tra 4 giorni), 1 scaduto (CONDOMINO per Int. 1, scaduto da 2 giorni) e 1 accettato con timestamp (utente ibrido Condòmino + Portiere, accettato 3 giorni fa).

- [ ] **Cosa fare:** con un utente avente ruolo `ADMIN` (oppure `is_superadmin = true`) accedere all'applicazione e aprire `/admin/inviti` dalla voce "Inviti" nella barra laterale o via URL diretto sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844).
  **Risultato atteso:** si apre la pagina protetta da guardia ADMIN con `Breadcrumbs` (`Home / Inviti`), `PageHeader` ("Inviti residenti e personale") con sottotitolo e pulsante primario d'azione "Invia nuovo invito" (icona `mail-plus`). La navigazione da tastiera e l'anello di focus accessibile `#0284C7` (o bianco su navy) sono visibili e mai ritagliati.

- [ ] **Cosa fare:** verificare i valori e le informazioni mostrate nelle 3 `StatCard` ufficiali (Sez. 8 Design System):
  1. "Inviti in attesa": conteggio degli inviti pendenti attivi (es. "1"), icona `mail`, tessera blu e nota "In attesa di primo accesso".
  2. "Accettati questo mese": conteggio degli inviti convertiti con successo nel mese in corso (es. "1"), icona `check-circle-2`, tessera teal e nota "Convertiti con successo".
  3. "Inviti scaduti": conteggio degli inviti non confermati oltre i 7 giorni (es. "1"), icona `clock`, tessera navy con badge rosso di attenzione `scaduto` e nota "Non confermati oltre 7 giorni".

- [ ] **Cosa fare:** testare la barra di controllo con i `FilterChips` e la `SearchBar`:
  - Premere il chip "In attesa": la tabella mostra solo l'invito pendente;
  - Premere il chip "Accettati": la tabella mostra solo l'invito convertito;
  - Premere il chip "Scaduti": la tabella mostra solo l'invito scaduto;
  - Premere il chip "Tutti gli inviti": la tabella mostra tutti gli inviti;
  - Digitare un indirizzo email (es. "laura"), un interno (es. "2") o un edificio (es. "Palazzo A") nel campo di ricerca: l'elenco si filtra in tempo reale;
  - Inserire un testo che non produce risultati: verificare la comparsa dell'`EmptyState` con icona, messaggio esplicativo e pulsante "Azzera filtri" che ripristina la visualizzazione completa.

- [ ] **Cosa fare:** verificare la tabella `ResponsiveDataView` (desktop e tablet) e le schede per smartphone:
  - Verificare le 7 colonne: Destinatario (email), Ruolo proposto (Badge: "Condòmino", "Portiere", "Condòmino e portiere"), Unità associata (Palazzo e Interno, oppure "Personale condominiale"), Data invio stimata, Scadenza / Accettazione con formattazione relativa (es. "Scade tra 4 giorni", "Scaduto ieri", "Accettato il 02/11/2026"), Stato (Badge azzurro "In attesa", verde "Accettato", rosso "Scaduto"), e Azioni.
  - Sull'invito "In attesa": verificare la presenza del pulsante "Sollecita" e del pulsante "Revoca";
  - Sull'invito "Scaduto": verificare la presenza del pulsante "Rinnova invito";
  - Sull'invito "Accettato": verificare l'indicazione neutra "—" senza pulsanti ridondanti.

- [ ] **Cosa fare:** testare l'azione "Sollecita" su un invito in attesa:
  - Premere "Sollecita": il pulsante entra in stato di caricamento;
  - La scadenza viene prorogata di ulteriori 7 giorni sul database e viene reinviata l'email;
  - Compare il `Toast` di conferma: "Sollecito inviato con successo. Scadenza prorogata di 7 giorni." e la relativa data/stato si aggiorna nella riga.

- [ ] **Cosa fare:** testare l'azione "Rinnova invito" su un invito scaduto:
  - Premere "Rinnova invito": il pulsante entra in stato di caricamento;
  - La scadenza dell'invito viene rinnovata di 7 giorni, lo stato torna "In attesa" con badge azzurro e compare la notifica Toast di successo.

- [ ] **Cosa fare:** testare l'azione "Revoca" su un invito:
  - Premere "Revoca": si apre la finestra modale accessibile `ConfirmDialog` con titolo "Revocare questo invito?", descrizione che chiarisce che il link di attivazione non sarà più utilizzabile e pulsante distruttivo rosso "Revoca invito";
  - Premere "Annulla": la finestra si chiude senza modifiche;
  - Riaprire e premere "Revoca invito": l'invito viene rimosso da `inviti_pendenti`, la riga scompare dalla tabella e compare il Toast di conferma "Invito revocato con successo.".

- [ ] **Cosa fare:** premere il pulsante primario "Invia nuovo invito" in testata (UC-07):
  1. Si apre la modale accessibile con focus posizionato automaticamente sul campo email (`autoFocus`).
  2. Testare la validazione email: inserire una stringa non valida (es. "test", "test@", "mario rossi@domain") e premere "Invia invito"; verificare la comparsa del messaggio di errore "Inserisci un indirizzo email valido (es. nome@dominio.it)." con stato `aria-invalid`.
  3. Selezionare Ruolo "Condòmino": verificare che il campo "Unità immobiliare" sia indicato come obbligatorio e che compaia la casella di controllo facoltativa "Assegna anche mansione di Portiere". Se si tenta l'invio senza selezionare un'unità, compare l'errore "Seleziona l’unità immobiliare associata al condòmino.".
  4. Selezionare Ruolo "Portiere": verificare che la selezione dell'unità diventi facoltativa (opzione predefinita "Nessuna unità (personale o uso comune)") e che la casella utente ibrido scompaia.
  5. Verificare la casella "Assegna anche mansione di Portiere" per un condòmino (creazione profilo ibrido UC-07).
  6. Verificare la nota informativa nella modale: chiarimento che l'invito ha una validità di 7 giorni e invia un link magico sicuro via email per impostare la password.
  7. Inviare un invito valido: verificare che in caso di successo compaia il messaggio uniforme "Invito registrato." (come da requisiti di sicurezza per prevenire l'enumerazione degli account) e che la modale si chiuda aggiornando la lista.

- [ ] **Cosa fare:** verificare la schermata sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844).
  **Risultato atteso:** `document.documentElement.scrollWidth <= window.innerWidth` su tutti i breakpoint (zero scroll orizzontale); layout elastico da tabella a card compatte su smartphone; controlli touch conformi a 44 px minimi.

- [ ] **Cosa fare:** testare con zoom reale 200% e navigazione completa da tastiera (Tab, frecce su/giù nei select, Escape per chiudere le modali).
  **Risultato atteso:** focus `#0284C7` sempre nitido e mai ritagliato; nessun elemento traborda; conformità WCAG 2.2 AA.

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_inviti_extra_pulizia.sql`.
  **Risultato atteso:** i 3 inviti di prova con token fissi vengono rimossi in modo sicuro e pulito dal database.

---

## Comunicazioni e Bacheca in Scrittura (/admin/comunicazioni, Passo 4 modulo Amministratore)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_comunicazioni_extra.sql` (dopo `01_dati_prova.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati di prova comunicazioni bacheca inseriti/aggiornati con successo.` senza errori. L'esecuzione è idempotente e inserisce 3 comunicazioni di prova per il Condominio di Prova (`d0000000-0000-4000-8000-000000000001`): 1 in evidenza per il condominio (`d0000000-0000-4000-8000-000000000301`), 1 ordinaria specifica per Palazzo A (`d0000000-0000-4000-8000-000000000302`), 1 ordinaria generica per il condominio (`d0000000-0000-4000-8000-000000000303`).

- [ ] **Cosa fare:** con un utente con ruolo `ADMIN` (oppure `is_superadmin = true`), accedere all'applicazione e navigare su `/admin/comunicazioni` tramite il menu laterale ("Comunicazioni") o via URL diretto sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844).
  **Risultato atteso:** si apre la pagina protetta da guardia ADMIN con `Breadcrumbs` (`Home / Comunicazioni`), `PageHeader` ("Comunicazioni e Bacheca") con sottotitolo e pulsante primario d'azione "Pubblica comunicazione" (icona `plus`). La navigazione da tastiera e l'anello di focus accessibile `#0284C7` (o bianco su navy) sono visibili e mai ritagliati.

- [ ] **Cosa fare:** verificare le 2 `StatCard` ufficiali (Sez. 8 Design System):
  1. "Comunicazioni attive": conteggio totale dei post pubblicati (es. "3"), icona `message-circle`, tessera blu e nota "Avvisi pubblicati in bacheca".
  2. "Avvisi in evidenza": conteggio dei post fissati in cima (`is_pinned = true`), icona `pin` (senza warning in console), tessera navy e nota "Fissati in cima alla bacheca".

- [ ] **Cosa fare:** testare la sezione di ricerca e i filtri all'interno della `Card`:
  - Verificare che la `SearchBar` ("Cerca avvisi") sia posizionata in alto, sopra i `FilterChips`, conformemente allo standard grafico della sezione condòmino e manutenzione amministratore;
  - Premere il chip "In evidenza": la visualizzazione mostra solo gli avvisi fissati in cima;
  - Premere il chip "Tutte": la visualizzazione mostra tutti i post;
  - Premere il chip dello stabile "Palazzo A": la visualizzazione mostra solo i post dedicati a Palazzo A;
  - Premere il chip "Tutti gli stabili": la visualizzazione ripristina tutti gli stabili;
  - Digitare un termine nel campo di ricerca "Cerca avvisi" (es. "caldaia" o "regolamento"): la lista si filtra in tempo reale su titolo e corpo dell'avviso;
  - Inserire una stringa priva di corrispondenze (es. "xyz"): compare l'`EmptyState` con titolo "Nessun avviso corrisponde ai criteri", descrizione esplicativa e pulsante "Azzera filtri" che ripristina la vista completa.

- [ ] **Cosa fare:** verificare la visualizzazione `ResponsiveDataView` racchiusa in `Card` (tabella su desktop/tablet e lista di card su mobile):
  - Colonne tabella: "Avviso", "Destinatari", "Data pubblicazione", "Azioni" (nessuna colonna commenti); il titolo "Azioni" e i relativi bottoni sono allineati a sinistra in modo coerente con le altre colonne della tabella;
  - Cella Avviso: il badge "In evidenza" (icona `pin`) è posizionato su una riga dedicata in alto; il titolo dell'avviso è SEMPRE collocato sulla riga sottostante anche quando è breve; sotto il titolo è presente l'anteprima del corpo troncata a 2 righe con ellissi;
  - Cella Destinatari: riporta "Condominio" per le comunicazioni generali (non "Intero condominio") oppure il nome del palazzo specifico (es. "Palazzo A");
  - Data di pubblicazione: formattata in italiano (es. "2 nov 2026").

- [ ] **Cosa fare:** cliccare su una qualsiasi riga della tabella delle comunicazioni:
  - **Risultato atteso:** la riga è interamente cliccabile (cursore pointer) e apre la modale "Dettaglio comunicazione" (standard allineato a manutenzione amministratore) con titolo, badge "In evidenza" se presente, destinatari, data formattata, testo completo dell'avviso e pulsanti di azione ordinati come "Chiudi", "Modifica" (primario azzurro/blu `#0A79AB` con icona `pencil`) ed "Elimina" (rosso distruttivo).

- [ ] **Cosa fare:** testare le azioni su riga della tabella:
  - Verificare che su riga siano presenti esclusivamente `[Fissato / Fissa]` ed `[Elimina]` disposti rigorosamente sulla stessa riga (senza pulsante modifica a livello di riga);
  - Verificare che il pulsante "Fissa" abbia lo stesso contorno grafico di "Fissato" (`variant="secondary"` con bordo `#CBD5E1`);
  - Toggle rapido evidenza ("Fissa" / "Fissato"): premere "Fissa" sul post ordinario; la dicitura passa a "Fissato", il post sale al vertice della bacheca e compare il toast informativo "Comunicazione fissata in cima alla bacheca."; premere nuovamente per rimuovere il pin;
  - Pulsante "Elimina": apre la finestra modale accessibile `ConfirmDialog` con titolo "Eliminare questa comunicazione?" e pulsanti "Annulla" ed "Elimina avviso" (rosso distruttivo).

- [ ] **Cosa fare:** premere il pulsante primario "Pubblica comunicazione" (o "Modifica"):
  1. Si apre la modale accessibile con focus automatico posizionato sul campo "Titolo dell'avviso".
  2. Test validazione titolo: lasciare vuoto o con meno di 3 caratteri e tentare la pubblicazione; verificare la comparsa del messaggio di errore "Inserisci il titolo della comunicazione." o "Il titolo deve contenere almeno 3 caratteri." con stato `aria-invalid`.
  3. Test selettore Destinatari / Ambito: verificare il menù a tendina custom `Select` con opzioni "Condominio" oppure selezione del singolo edificio (es. "Palazzo A").
  4. Test validazione corpo dell'avviso: verificare la textarea multilinea, il contatore dinamico di caratteri e l'errore per testi inferiori a 10 caratteri.
  5. Test casella di controllo "Fissa in evidenza in cima alla bacheca": verificare l'attivazione/disattivazione con descrizione accessibile.
  6. Compilare con dati validi e salvare: verificare la creazione della comunicazione su `bacheca_post`, la generazione automatica delle notifiche per i condòmini destinatari nella tabella `notifiche`, il Toast di conferma e la chiusura della modale con aggiornamento istantaneo dell'elenco.

- [ ] **Cosa fare:** verificare la schermata sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844):
  **Risultato atteso:** `document.documentElement.scrollWidth <= window.innerWidth` su tutti i breakpoint (zero scroll orizzontale); passaggio fluido da tabella a card verticali su mobile; nessun taglio visivo o sovrapposizione.

- [ ] **Cosa fare:** verificare conformità WCAG 2.2 AA e navigazione con tastiera:
  - Navigare con Tab, Shift+Tab, Invio, Spazio ed Escape;
  - Verificare l'anello di focus `#0284C7` (o bianco su navy) sempre visibile e mai ritagliato;
  - Testare a zoom 200% verificando che i testi rifluiscano regolarmente e non ci sia scroll orizzontale.

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_comunicazioni_extra_pulizia.sql`.
  **Risultato atteso:** le 3 comunicazioni di prova e le relative notifiche vengono rimosse in modo sicuro dal database senza lasciare residui.

---

## Manutenzione, Ticket e Fornitori (/admin/manutenzione, Passo 5 modulo Amministratore)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_manutenzione_extra.sql` (dopo `01_dati_prova.sql`).
  **Risultato atteso:** lo script termina con `NOTICE: Dati di prova manutenzione, ticket e fornitori inseriti/aggiornati con successo.` senza errori. L'esecuzione è idempotente e inserisce 2 fornitori convenzionati in `fornitori`, 4 ticket rappresentativi (1 urgente aperto in area comune vano autoclave, 1 in lavorazione con intervento e magic link token illuminazione scale, 1 risolto con consuntivo spesa cancello carrabile, 1 aperto per unità privata Int. 2) e garantisce l'associazione utente-ruolo di prova.

- [ ] **Cosa fare:** con un utente con ruolo `ADMIN` (oppure `is_superadmin = true`, es. `superadmin@iocondo.it`), accedere all'applicazione e navigare su `/admin/manutenzione` tramite la voce "Manutenzione" nella sidebar o via URL diretto sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844).
  **Risultato atteso:** si apre la pagina protetta da guardia ADMIN con `Breadcrumbs` (`Home / Manutenzione`), `PageHeader` ("Manutenzione e Ticket") con sottotitolo e pulsante d'azione "Nuova segnalazione" (icona `wrench`, identica a quella del lato condòmino). La navigazione da tastiera e l'anello di focus accessibile `#0284C7` (o bianco su navy) sono visibili e mai ritagliati.

- [ ] **Cosa fare:** verificare le 3 `StatCard` ufficiali (Sez. 8 Design System):
  1. "Ticket guasti aperti": conteggio dei ticket in stato `APERTO` (es. "3"), icona `wrench`, tessera blu e nota "Guasti in attesa di assegnazione".
  2. "Interventi in lavorazione": conteggio dei ticket in stato `LAVORAZIONE` (es. "1"), icona `hard-hat`, tessera navy e nota "Lavori affidati ai manutentori".
  3. "Fornitori convenzionati": conteggio totale delle ditte registrate in rubrica (es. "2"), icona `truck`, tessera teal e nota "Ditte registrate in rubrica".

- [ ] **Cosa fare:** testare la navigazione a schede (Tabs):
  - Scheda 1 predefinita: "Ticket Guasti" con icona chiave inglese `wrench`.
  - Scheda 2: "Rubrica Fornitori" con icona camioncino `truck`.
  - Spostarsi tra le schede con frecce tastiera o click del mouse: il pannello sottostante si aggiorna istantaneamente con gli stati `aria-selected` e `tabIndex` corretti.

- [ ] **Cosa fare:** nella Scheda 1 ("Ticket Guasti"), testare la `SearchBar` posizionata sopra i `FilterChips` (uguale alla sezione condòmino):
  - Premere il chip "Aperti": la tabella filtra mostrando solo i ticket non ancora assegnati;
  - Premere il chip "In lavorazione": mostra solo i ticket presi in carico dai manutentori;
  - Premere il chip "Risolti": mostra solo i ticket chiusi con consuntivo;
  - Premere il chip "Urgenti": mostra solo i ticket con priorità Urgente;
  - Premere il chip "Aree comuni": mostra solo i ticket con badge "Area comune";
  - Premere il chip "Tutti": ripristina la visualizzazione di tutti i ticket;
  - Digitare un termine nella `SearchBar` "Cerca nei ticket" (posizionata sopra i filtri, es. "autoclave", "elettrici" o "infiltrazione"): la tabella filtra in tempo reale su titolo, descrizione, categoria, fornitore e ubicazione;
  - Inserire una stringa priva di corrispondenze (es. "xyz"): compare l'`EmptyState` con titolo "Nessun ticket corrispondente" e pulsante "Azzera filtri".

- [ ] **Cosa fare:** verificare la visualizzazione `ResponsiveDataView` dei ticket (tabella racchiusa in `<Card>` su desktop/tablet e card per smartphone, identica alla vista condòmino):
  - 5 colonne compatte e pulite senza sovrapposizioni:
    1. Priorità (Badge con colori pastello ed etichette coerenti: Urgente, Alta, Media, Bassa);
    2. Titolo (testo del titolo su riga singola senza descrizione sotto);
    3. Apertura (formattata in italiano es. "5 nov 2026");
    4. Stato (Badge con "In lavorazione" rigorosamente su riga singola senza andare a capo);
    5. Azioni: un solo pulsante d'azione dedicato ("Modifica").
  - Click sulla riga: premendo su qualsiasi punto della riga della tabella (o toccando la card da smartphone), si apre direttamente la modale dei dettagli (identica interazione del lato condòmino).
  - Verificare che tutti gli elementi entrino comodamente dentro la pagina senza scroll orizzontale o sovrapposizioni.

- [ ] **Cosa fare:** testare la modale "Dettagli Ticket" (apertura al click su qualsiasi riga):
  1. Cliccare sulla riga di un ticket: si apre la modale accessibile con il titolo completo del guasto, badge di stato e priorità;
  2. Verifica dettagli completi: ubicazione precisa, nominativo segnalatore e data apertura, fornitore incaricato e data intervento prevista;
  3. Verifica sezione "Foto e Allegati": elenco degli allegati con icona documento/foto e badge tipo file;
  4. Verifica sezione "Messaggi e Note di lavoro": storico ordinato cronologicamente con autore, data e messaggio;
  5. Test invio nuova nota: digitare un messaggio nell'input e premere "Invia nota"; il messaggio viene salvato in `ticket_messaggi`, compare istantaneamente nello storico e viene emesso un Toast di conferma;
  6. Premere "Chiudi" o tasto Escape per chiudere la modale.

- [ ] **Cosa fare:** testare la modale "Modifica Ticket" (pulsante "Modifica"):
  1. Premere "Modifica" su una riga: si apre la modale precompilata con titolo del guasto, priorità, stato del ticket, categoria guasto, ubicazione (area comune vs unità privata) e descrizione;
  2. Sezione "Fornitore incaricato e Magic Link": selezione del fornitore convenzionato dal menù a tendina custom `Select`, data prevista intervento e note per il fornitore;
  3. Se è presente o viene generato un intervento con Magic Link, verifica la visualizzazione dell'URL protetto `/fornitore/[token]` e il funzionamento del pulsante "Copia Magic Link" negli appunti;
  4. Se lo stato è o viene impostato a "Risolto", inserimento dell'importo consuntivo spesa (€) e note finali;
  5. Premere "Salva modifiche": le informazioni vengono aggiornate nel database, compare il Toast di conferma e la tabella riflette istantaneamente le modifiche.

- [ ] **Cosa fare:** testare la Scheda 2 ("Rubrica Fornitori"):
  1. Passare alla scheda "Rubrica Fornitori": compare la tabella con l'elenco delle ditte convenzionate;
  2. Verificare le colonne: Ragione sociale (con IBAN in seconda riga), Categoria merceologica (Badge info es. Idraulico, Elettrico), Telefono (con link attivo `tel:`), Email (con link attivo `mailto:`), P.IVA / CF;
  3. Testare la `SearchBar` dei fornitori posizionata sotto i controlli di azione;
  4. Premere "Nuovo fornitore convenzionato" (senza segno più nel testo): si apre la modale "Nuovo fornitore convenzionato";
  5. Compilare i dati: Ragione sociale (obbligatoria), Categoria (menù a tendina: Idraulico, Elettrico, Edile, Ascensori, Pulizie, Giardinaggio, Altro), P.IVA o CF (validazione formato), Telefono, Email (validazione RFC), IBAN (validazione lunghezza e formato);
  6. Premere "Salva fornitore": il fornitore viene registrato in `fornitori` associato all'amministratore, la rubrica si aggiorna, il conteggio della StatCard "Fornitori convenzionati" si incrementa e compare il Toast di notifica.

- [ ] **Cosa fare:** testare la creazione segnalazione (pulsante d'azione "Nuova segnalazione" in testata, con icona `wrench`):
  1. Premere "Nuova segnalazione": si apre la modale accessibile con focus automatico sul titolo;
  2. Inserire Titolo del guasto;
  3. Scegliere la Categoria dal menù a tendina caricato dinamicamente da `categorie_guasti`;
  4. Scegliere la Priorità (Urgente, Alta, Media, Bassa);
  5. Testare il selettore Ubicazione:
     - Casella "Segnalazione per area comune del condominio" spuntata: il ticket viene contrassegnato per le parti comuni (vano autoclave, scale, cortile);
     - Casella deselezionata: compare il campo a tendina obbligatorio "Unità immobiliare interessata" per selezionare l'interno/piano specifico;
  6. Inserire la descrizione del guasto e premere "Crea ticket": il ticket viene salvato in `ticket_testata`, la lista e le StatCard si aggiornano e compare il Toast di successo.

- [ ] **Cosa fare:** verificare la schermata sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844):
  **Risultato atteso:** `document.documentElement.scrollWidth <= window.innerWidth` su tutti i breakpoint (zero scroll orizzontale); impaginazione fluida da tabella desktop/tablet a card su smartphone; target touch conformi a 44 px minimi.

- [ ] **Cosa fare:** verificare conformità WCAG 2.2 AA e navigazione con tastiera:
  - Navigare con Tab, Shift+Tab, Invio, Spazio ed Escape;
  - Verificare l'anello di focus `#0284C7` (o bianco su navy) sempre visibile e mai ritagliato su tabelle, pulsanti, input e modali;
  - Testare a zoom 200% verificando che i testi rifluiscano regolarmente e non ci sia scroll orizzontale.

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_manutenzione_extra_pulizia.sql`.
  **Risultato atteso:** i token magic link, gli allegati, i messaggi, gli interventi, i 4 ticket di prova e i 2 fornitori convenzionati vengono rimossi in modo pulito e sicuro dal database senza lasciare residui.

---

## Documenti e Drive Condominiale (/admin/documenti, Passo 6 modulo Amministratore)

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_documenti_extra.sql`.
  **Risultato atteso:** lo script viene eseguito con successo, inserendo 3 cartelle di prova ("Verbali assemblee", "Contratti e polizze", "Regolamento e tabelle") e 4 metadati di documenti collegati al condominio attivo (di cui 3 pubblici e 1 riservato all'Unità Int. 1), in modo idempotente e senza duplicati.

- [ ] **Cosa fare:** accedere come amministratore (`superadmin@iocondo.it`) e navigare su `/admin/documenti` (o cliccare sulla voce "Documenti" nel menu principale).
  **Risultato atteso:** la pagina si apre correttamente sotto la guardia ADMIN, visualizzando il percorso di navigazione `Home / Documenti`, il titolo "Documenti e Drive Condominiale" e i due pulsanti primari in testata: "Nuova cartella" (icona `folder-plus`) e "Carica documento" (icona `upload`).

- [ ] **Cosa fare:** verificare le 3 StatCard ufficiali (Sez. 8 Design System):
  - "Documenti archiviati": conteggio totale documenti del condominio, icona `file-text`, tessera blu;
  - "Cartelle create": conteggio totale cartelle create, icona `folder`, tessera navy;
  - "Documenti riservati": conteggio file a visibilità limitata per specifica unità, icona `lock`, tessera teal.

- [ ] **Cosa fare:** testare la sezione "Cartelle del condominio" ed il filtro cartelle:
  - Verificare la scheda "Tutte le cartelle" con il totale dei documenti complessivi;
  - Cliccare su una singola cartella (es. "Verbali assemblea"):
    * La cartella diventa attiva (bordo marcato e badge attivo);
    * I breadcrumbs si aggiornano dinamicamente in `Home / Documenti / [Nome Cartella]`;
    * Il titolo della tabella si aggiorna con "Documenti in: [Nome Cartella]" e mostra solo i file appartenenti a quella cartella;
  - Cliccare di nuovo su "Tutte le cartelle" o sul breadcrumb "Documenti" per reimpostare la vista completa.

- [ ] **Cosa fare:** testare la barra dei filtri (SearchBar e FilterChips):
  - Digitare del testo nella `SearchBar` (es. "Verbale"): la lista si aggiorna in tempo reale filtrando per corrispondenza nel nome file;
  - Selezionare il chip "Condominio": vengono mostrati solo i documenti visibili a tutti i condòmini (`unita_id IS NULL`);
  - Selezionare il chip "Riservati per unità": vengono mostrati solo i documenti riservati a una specifica unità (`unita_id IS NOT NULL`);
  - Inserire una stringa priva di corrispondenze (es. "xyz"): compare l'`EmptyState` con titolo "Nessun documento corrisponde ai criteri" e descrizione per guidare l'utente.

- [ ] **Cosa fare:** verificare la visualizzazione `ResponsiveDataView` dei documenti (tabella racchiusa in `<Card>` su desktop/tablet e schede per smartphone):
  - 5 colonne essenziali e pulite (nessuna colonna "Azioni" o "Dimensione" per massima leggibilità e respiro):
    1. Tipo (Badge colorato con icona coerente: PDF = rosso, Immagini = teal, Fogli di calcolo/Excel = verde, Word/Testo = blu, Generico = grigio);
    2. Nome file (nome pulito del file su una o due righe senza ridondanze);
    3. Cartella (nome della cartella di appartenenza con icona cartella);
    4. Caricato il (data formattata in italiano GG/MM/AAAA);
    5. Destinatario (Badge allargato con solo il destinatario reale: "Condominio" per i file comuni, oppure "Palazzo X - Int. Y" / "Int. X" per i file di unità, senza prefisso "Riservato:").
  - Click sulla riga: premendo su qualsiasi punto della riga della tabella (o toccando la scheda da smartphone), si apre direttamente la modale "Dettagli documento".
  - Verificare che tutti gli elementi entrino nella pagina con zero scroll orizzontale (`document.documentElement.scrollWidth <= window.innerWidth`).

- [ ] **Cosa fare:** testare la modale "Dettagli documento" (apertura al click su qualsiasi riga):
  1. Cliccare sulla riga di un documento: si apre la modale accessibile con il titolo del file, badge di tipologia e badge destinatario;
  2. Verifica riepilogo metadati: Cartella, Caricato il, Dimensione formattata (B, KB, MB) e Destinatario ("Condominio" o unità specifica);
  3. Verifica avviso sicurezza Storage: indicazione del bucket protetto `documenti-condominio` e link temporaneo;
  4. Test pulsante "Scarica": genera in tempo reale il link firmato temporaneo (600 s via `createSignedUrl`) e apre il file in sicurezza in una nuova scheda, senza mai esporre URL pubblici permanenti;
  5. Test pulsante "Elimina": chiude il dettaglio e apre il `ConfirmDialog` distruttivo per rimuovere il documento dallo storage e dal database;
  6. Premere "Chiudi" o tasto Escape per chiudere la modale.

- [ ] **Cosa fare:** testare la modale "Nuova cartella":
  1. Premere "Nuova cartella": si apre la modale accessibile con focus automatico sull'input del nome;
  2. Testare validazione: inserire 1 solo carattere o lasciare vuoto e premere "Crea cartella": compare il messaggio di errore "Il nome della cartella deve contenere almeno 2 caratteri" e l'input assume lo stato `aria-invalid="true"`;
  3. Inserire un nome valido (es. "Manutenzioni straordinarie 2026") e confermare: la nuova cartella viene creata in `cartelle_documenti`, compare istantaneamente tra le cartelle, il contatore StatCard si aggiorna e viene mostrato un Toast di successo;
  4. Testare chiusura modale con pulsante "Annulla" o tasto Escape.

- [ ] **Cosa fare:** testare la cancellazione di una cartella vuota:
  - Individuare la cartella appena creata (vuota, con icona cestino rossa accanto al nome);
  - Cliccare sull'icona di eliminazione della cartella: compare il `ConfirmDialog` distruttivo con titolo "Eliminare questa cartella?";
  - Confermare l'eliminazione: la cartella viene rimossa dal database, la lista si aggiorna e compare il Toast di notifica.

- [ ] **Cosa fare:** testare la modale "Carica nuovo documento" (REQ-A04):
  1. Premere il pulsante "Carica documento": si apre la modale accessibile;
  2. Verificare il selettore Cartella di destinazione (menù a tendina custom `Select` con bordi a 7px);
  3. Verificare l'area drag & drop / selezione file (`FileUpload`) con visualizzazione anteprima del nome file, dimensione ed estensione;
  4. Testare il selettore "Ambito di Visibilità e Privacy (RLS)":
     * Opzione predefinita: "Visibile a tutti i condòmini" (`unita_id = null`);
     * Selezionare l'opzione "Riservato a una specifica unità immobiliare": compare dinamicamente il menù a tendina custom `Select` "Unità immobiliare di destinazione *" con l'elenco delle unità del condominio (Palazzo / Scala / Interno);
     * Se non viene selezionata alcuna unità con ambito riservato, la validazione blocca il salvataggio con messaggio di errore esplicito;
  5. Caricare un file reale (es. PDF o immagine), scegliere cartella e ambito di riservatezza e premere "Carica documento":
     * Il file viene inviato allo Storage Supabase nel percorso RLS corretto `${condominio_id}/${cartella_id}/${timestamp}_${nome}`;
     * I metadati vengono salvati nella tabella `documenti_metadata`;
     * La tabella si aggiorna con il nuovo file, le StatCard riflettono i conteggi aggiornati e compare il Toast di conferma;
  6. Premere "Annulla" o tasto Escape per verificare la corretta chiusura della modale.

- [ ] **Cosa fare:** testare l'eliminazione di un documento:
  - Cliccare sul pulsante "Elimina" di un file nella tabella: si apre il `ConfirmDialog` distruttivo con titolo "Eliminare questo documento?" e descrizione con il nome del file;
  - Premere "Elimina documento": il record viene rimosso da `documenti_metadata` e il file fisico eliminato dal bucket `documenti-condominio`;
  - La riga scompare dalla tabella e compare il Toast di conferma.

- [ ] **Cosa fare:** verificare la schermata sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844):
  **Risultato atteso:** `document.documentElement.scrollWidth <= window.innerWidth` su tutti i breakpoint (zero scroll orizzontale); passaggio fluido da tabella desktop a card su smartphone; target touch conformi a 44 px minimi.

- [ ] **Cosa fare:** verificare conformità WCAG 2.2 AA e navigazione con tastiera:
  - Navigare con Tab, Shift+Tab, Invio, Spazio ed Escape;
  - Verificare l'anello di focus `#0284C7` (o bianco su navy) sempre visibile e mai ritagliato su cartelle, righe, pulsanti, input e modali;
  - Testare a zoom reale 200% verificando che i testi e le cartelle rifluiscano regolarmente senza alcuno scroll orizzontale della pagina.

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_documenti_extra_pulizia.sql`.
  **Risultato atteso:** i 4 documenti di prova e le 3 cartelle create dal seed vengono rimossi in modo pulito e sicuro dal database senza lasciare residui.

---

## M. Assemblee del Condominio e Conduzione Sedute (Amministratore - /admin/assemblee e /admin/assemblee/[id])

### M1 — Preparazione dati di prova e policy RLS

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/da-applicare/09_assemblee_voti_admin.sql` per abilitare l'inserimento e l'aggiornamento dei voti in sala da parte dell'amministratore su `assemblee_voti`.
  **Risultato atteso:** le policy `assemblee_voti_admin_select`, `assemblee_voti_admin_insert` e `assemblee_voti_admin_update` vengono create correttamente senza errori.

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_assemblee_extra.sql`.
  **Risultato atteso:** lo script completa con successo senza duplicati, creando 3 assemblee di prova:
  1. Un'assemblea futura "Convocata" (18 nov 2026) con 4 punti all'ODG;
  2. Un'assemblea "In corso" (4 nov 2026) con 3 punti all'ODG, votazioni aperte e presenze;
  3. Un'assemblea "Conclusa" (6 ago 2026) con verbale PDF e voti storici archiviati.

### M2 — Elenco Assemblee Amministratore (/admin/assemblee)

- [ ] **Cosa fare:** accedere all'app come amministratore e navigare su `/admin/assemblee`:
  - Verificare il `PageHeader` con titolo "Assemblee del Condominio" e pulsante primario "Convoca nuova assemblea" (icona `calendar-plus`);
  - Verificare le 3 StatCard ufficiali (Sez. 8 Design System):
    * "Prossima assemblea" (tessera blu): data convocazione e tipo (Ordinaria/Straordinaria, solo in presenza);
    * "Assemblee dell'anno" (tessera navy): totale assemblee svolte, concluse e in bozza;
    * "Votazioni aperte" (tessera teal): conteggio punti ODG in votazione attiva;
  - Testare la barra di controllo con `SearchBar` e `FilterChips` ("Tutti", "Convocate", "In corso", "Concluse", "Bozze"): il filtraggio deve essere istantaneo e fluido;
  - Verificare la visualizzazione `ResponsiveDataView` (tabella su desktop/tablet e lista card su mobile): colonne `Data Convocazione` (solo data formattata, senza posizione secondaria), `Tipo`, `Stato` (Badge colorato) e `Punti ODG` (rimosse le colonne Modalità e Verbale PDF dalla vista tabellare);
  - Cliccare su una riga della tabella: la schermata naviga fluidamente a `/admin/assemblee/[id]`.

### M3 — Modale "Nuova Assemblea"

- [ ] **Cosa fare:** cliccare su "Convoca nuova assemblea" per aprire la modale accessibile:
  - Verificare i campi del modulo:
    * Tipologia assemblea (RadioGroup: Ordinaria vs Straordinaria con testi di supporto);
    * Data e ora 1ª Convocazione e 2ª Convocazione (con orario separato);
    * Luogo fisico di svolgimento in presenza (rimossa la selezione ibrida/online e il campo Google Meet);
    * Selettore custom `Select` per la Tabella millesimale di riferimento;
    * Checkbox "Salva come bozza";
  - Testare la validazione formale lasciando campi vuoti o invertendo le date di 1ª e 2ª convocazione: compaiono i messaggi di errore dedicati;
  - Compilare i dati e confermare la convocazione: l'assemblea compare subito in cima all'elenco e viene mostrato il Toast di successo.

### M4 — Dettaglio e Conduzione Seduta (/admin/assemblee/[id])

- [ ] **Cosa fare:** navigare sul dettaglio dell'assemblea in corso (`/admin/assemblee/d0000000-0000-4000-8000-000000000730`):
  - Verificare i `Breadcrumbs`: `Home / Assemblee / Assemblea del [Data]`;
  - Verificare la card di Testata: titolo con tipologia, badge di stato ("In corso"), data/ora estesa, luogo fisico (rimossa qualsiasi dicitura o link a Google Meet), pulsante "Condividi convocazione" e pulsante "Concludi assemblea";
  - Cliccare su "Concludi assemblea": confermare il dialog; l'assemblea passa a stato `CONCLUSA` con Toast di successo ("Assemblea formalmente conclusa") senza alcun errore o popup "Nessun dato restituito".

- [ ] **Cosa fare:** testare la Sezione 1 "Appello, Presenze e Deleghe (Quorum Costitutivo)":
  - Selettore Convocazione: passare tra "1ª Convocazione" e "2ª Convocazione" e verificare l'aggiornamento dinamico delle soglie legali minime:
    * 1ª conv: maggioranza teste e 2/3 dei millesimi (≥ 666,67 ‰);
    * 2ª conv: 1/3 delle teste e 1/3 dei millesimi (≥ 333,33 ‰);
  - Box Quorum Costitutivo: verificare i contatori grafici (millesimi presenti e teste partecipanti) e i badge dinamici ("Assemblea validamente costituita" verde vs "Seduta deserta" o "Quorum non raggiunto");
  - Tabella Unità in tendina: verificare che ciascuna unità disponga esclusivamente di 3 opzioni presenza: **Presente**, **Delega**, **Assente** (rimosse le diciture "In sala" e "Online");
  - Selezionare "Delega": compare il menù a tendina con i residenti presenti per assegnare la delega;
  - Verifica automatica cumulo deleghe ex art. 67 disp. att. c.c.: se i partecipanti sono > 20 e un delegato supera 1/5 dei partecipanti o 1/5 del valore millesimale, compare il box di allerta rosso;
  - Cliccare su "Salva appello e presenze": salvataggio su Supabase ed emissione Toast di conferma ("Presenze e deleghe registrate con successo!"), con compressione automatica dell'elenco unità nella tendina richiudibile ("Comprimi appello" / "Espandi e modifica presenze") mentre il box del Quorum Costitutivo rimane sempre visibile in alto.

- [ ] **Cosa fare:** testare la Sezione 2 "Ordine del Giorno e Votazioni in Tempo Reale":
  - Premere "Aggiungi punto all'ODG": si apre la modale per inserire titolo del punto e testo della proposta di delibera;
  - Per ciascun punto ODG verificare:
    * Badge di stato votazione ("Votazione aperta" teal vs "Votazione chiusa" grigio);
    * Pulsanti "Apri votazione" e "Chiudi votazione" con aggiornamento istantaneo del DB ed emissione Toast di conferma ("Votazione punto n. X chiusa") senza alcun errore o popup "Nessun dato restituito";
    * Selettore tipo delibera: "Ordinaria (≥ 333,33 ‰ in 2ª conv.)" vs "Straordinaria (≥ 500,00 ‰)";
    * Rimosso il tabellone con i pulsanti di espressione del voto manuale dell'amministratore: l'amministratore dalla sua console non esprime il voto al posto dei condòmini;
    * Monitor "Partecipazione al voto delle unità presenti": tracciamento esplicito delle deleghe (`Proprietario (In delega a: [Nome Delegato])`) e badge verde "Votato" o grigio "Non votato";
    * Box Esito Delibera automatico: calcolo istantaneo delle percentuali teste e millesimi con badge "APPROVATA" verde o "RESPINTA" rosso e motivazione legale in base ai voti reali dei condòmini;
    * Tabella nominale per redazione verbale (UC-10) in tendina a comparsa: di default compressa ("Mostra tabella"), al click si espande visualizzando la colonna "Voto Espresso" (150px) con badge leggibili e formattati ("Non espresso", "Favorevole", "Contrario", "Astenuto", "Assente") senza alcun testo troncato;
    * Pulsante "Copia testo per verbale": copia negli appunti il testo legale formattato del punto per l'inserimento nel verbale.

- [ ] **Cosa fare:** verificare la vista dal profilo/dashboard del condòmino (`/assemblee/[id]`):
  - Rimossa completamente la card informativa / bottone "Partecipa alla riunione online" Google Meet (l'assemblea è solo in presenza);
  - Se l'utente connesso è un amministratore puro o non possiede unità né deleghe nel condominio (`unitaDisponibili.length === 0`), il diritto di voto è disabilitato (`votabile: false`) e compare il messaggio chiaro di avviso;
  - Se l'utente ha ricevuto una o più deleghe nell'appello presenze dell'assemblea:
    * Nel selettore unità per ciascun punto ODG compaiono sia la propria unità che le unità delegate (`Int. X (Delega: [Nome Delegante])`);
    * Il condòmino delegato può selezionare la propria unità ed esprimere il voto, poi selezionare l'unità delegata ed esprimere il voto specifico per delega;
    * Ciascun voto viene salvato e tracciato nominalmente con la quota millesimale corrispondente.

- [ ] **Cosa fare:** testare la Sezione 3 "Verbale Ufficiale e Documenti Firmati":
  - Area drag & drop / selezione file (`FileUpload`) per il verbale PDF firmato;
  - Selezionare un file PDF e premere "Carica verbale e concludi assemblea":
    * Il file viene inviato allo Storage privato `documenti-condominio` nel percorso `<condominio_id>/verbali/verbale_assemblea_<id>.pdf`;
    * Lo stato dell'assemblea passa a `CONCLUSA`;
    * Compare la card con link firmato temporaneo (600s via `createSignedUrl`) e pulsante "Scarica verbale";
  - Cliccare su "Notifica chiusura e verbale ai residenti": genera la notifica per tutti i residenti abilitati in `notifiche`;
  - Verificare la presenza del pulsante "Concludi assemblea" allineato a destra in fondo alla pagina (sotto la Sezione 3) quando l'assemblea è ancora attiva.

### M5 — Responsive Design e Accessibilità WCAG 2.2 AA

- [ ] **Cosa fare:** verificare sia `/admin/assemblee` che `/admin/assemblee/[id]` sui 3 breakpoint obbligatori (Desktop 1440x900, Tablet 820x1180, Mobile 390x844):
  **Risultato atteso:** `document.documentElement.scrollWidth <= window.innerWidth` su tutte le schermate (zero scroll orizzontale); tabelle e tabellone voti fluidi e senza troncamenti; target touch minimi di 44 px conformi.

- [ ] **Cosa fare:** verificare navigazione con tastiera e contrasti cromatici:
  - Navigare con Tab e Shift+Tab attraverso le card, pulsanti di voto, tabelle e modali;
  - Verificare l'anello di focus accessibile `#0284C7` (o bianco su navy) sempre visibile e mai ritagliato;
  - Prova a zoom reale 200% nel browser verificando la corretta leggibilità e assenza di overflow.

### M6 — Ripristino e Pulizia

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/admin_assemblee_extra_pulizia.sql`.
  **Risultato atteso:** le assemblee di prova, i punti ODG, i voti nominali e le presenze create dal seed vengono eliminati in modo sicuro e pulito dal database senza lasciare residui.

---

## N. Modulo Contabile e Bilanci (Amministratore - /admin/contabilita, Passo 8 modulo Amministratore)

### N1 — Migrazione Schema Contabile e Dati di Prova

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire nell'ordine:
  1. `supabase/da-applicare/10_contabilita_schema_modello_obiettivo.sql` (schema completo, trigger di immutabilità, RLS e funzioni RPC/helper);
  2. `supabase/da-applicare/10_verifica.sql` (controlli di integrità post-migrazione).
  **Risultato atteso:** la migrazione termina con successo e lo script `10_verifica.sql` restituisce `OK` su tutti i 12 controlli (tabelle, indici, trigger di immutabilità `movimenti_contabili` e `audit_log`, RLS attive, funzioni helper).

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire gli script di seed contabile per popolare il condominio di prova con movimenti, bollettini, posizioni morose, fondi speciali e rendiconto/conguagli:
  1. `supabase/seed-dev/admin_contabilita_registro_extra.sql`;
  2. `supabase/seed-dev/admin_contabilita_bollettini_extra.sql`;
  3. `supabase/seed-dev/admin_contabilita_morosita_extra.sql`;
  4. `supabase/seed-dev/admin_contabilita_fondi_extra.sql`;
  5. `supabase/seed-dev/admin_contabilita_rendiconto_extra.sql`.
  **Risultato atteso:** tutti gli script completano senza errori né duplicati (idempotenti), popolando l'esercizio contabile con scritture cronologiche, preventivi, rate, bollettini, scadenziario recupero crediti, fondi accantonati e conguagli per unità.

### N2 — Testata Istituzionale, Selettore Esercizio e 4 StatCard Ufficiali

- [ ] **Cosa fare:** accedere all'app come amministratore e navigare su `/admin/contabilita`:
  - Verificare il `PageHeader` con titolo `"Contabilità e Bilanci"`, breadcrumb `"Home / Amministrazione / Contabilità"` e i 2 pulsanti primari d'azione con icone Lucide: `"Nuova spesa"` (icona `plus`) e `"Emetti rate"` (icona `receipt`);
  - Verificare la barra di stato dell'esercizio contabile con il menù a tendina `Select` per cambiare esercizio e i badge informativi di stato esercizio e stato rendiconto;
  - Verificare le 4 `StatCard` ufficiali (Sez. 8 Design System, contrasto WCAG AA):
    1. `"Saldo di Cassa Attuale"` (blu navy, icona `wallet`): importo formattato in Euro da centesimi (`1.250,50 €`) con dettaglio entrate e uscite;
    2. `"Riscossione Rate Esercizio"` (turchese teal, icona `badge-percent`): percentuale di incasso su emesso;
    3. `"Morosità Scadute"` (rosso/navy con badge di allarme se presenti posizioni oltre 180 giorni ex art. 1129 c.c., icona `alert-triangle`): totale insoluto scaduto e numero di posizioni critiche;
    4. `"Fondi Speciali Accantonati"` (viola/blu, icona `piggy-bank`): saldo complessivo accantonato nei fondi attivi (art. 1135 n. 4 c.c.).

### N3 — Scheda 1: Registro & Spese (Art. 1130 n. 7 c.c.)

- [ ] **Cosa fare:** nella scheda `"Registro & Spese"`:
  - Testare i filtri rapidi: `SearchBar` per descrizione/fattura, `FilterChips` (`"Tutti i movimenti"`, `"Spese (-)"`, `"Entrate (+)"`, `"Straordinarie"`, `"Giustificativo incompleto"`) e intervallo date (`"Dal"`, `"Al"`);
  - Verificare la tabella `ResponsiveDataView` (tabella su desktop/tablet, card su smartphone):
    * Colonne: `Prog. & Data` (`#N` + `DD/MM/YYYY`), `Descrizione & Voce` (con alert eventuale di registrazione > 30 gg), `Natura` (`Ordinaria` / `Straordinaria` / `Entrata` / `Storno`), `Giustificativo` (`Completo`, `Eccezione c/c`, `Incompleto`), `Importo` (`- 1.250,00 €` / `+ 500,00 €`) e `Azioni`;
  - Cliccare su `"Nuova spesa"` per aprire la modale accessibile `"Registra spesa"`:
    * Compilare categoria spesa, descrizione, importo in Euro, data pagamento, natura (`Spesa Ordinaria` / `Spesa Straordinaria`), criterio `"Chi paga"` (es. Tabella A o Tabella specifica) e riferimento giustificativo;
    * Verificare che con `"Spesa Straordinaria"` sia richiesto il riferimento alla delibera assembleare;
    * Salvare la spesa: il movimento compare nel registro cronologico e il saldo di cassa si aggiorna;
  - Cliccare sul pulsante `"Storna"` su un movimento attivo:
    * Si apre la modale `"Storna movimento contabile (Art. 1130 c.c.)"`;
    * Verificare che il tentativo di conferma senza motivo mostri l'errore di validazione;
    * Inserire il motivo dello storno e confermare: viene creata la scrittura di contropartita di segno opposto senza mai cancellare il movimento originario (immutabilità registro).

### N4 — Scheda 2: Preventivi & Rate

- [ ] **Cosa fare:** selezionare la scheda `"Preventivi & Rate"`:
  - Verificare l'elenco delle versioni di preventivo con stato (`Bozza`, `Approvato`, `Storico`), totale ripartito in Euro e data assemblea;
  - Cliccare su `"Nuovo preventivo"` per aprire la modale accessibile:
    * Inserire gli importi delle voci principali (Gestione ordinaria, Pulizia/Igiene, Energia elettrica) e salvare la bozza;
  - Cliccare su `"Approva in assemblea"` su un preventivo in bozza:
    * Inserire data assemblea e riferimento delibera e confermare: lo stato passa ad `Approvato`;
  - Cliccare su `"Emetti rate"` per aprire la modale di generazione del piano rate:
    * Selezionare il preventivo, il numero di scadenze (es. 4 rate trimestrali) e la data della prima scadenza;
    * Se si seleziona un preventivo ancora in bozza, verificare il blocco di sicurezza che richiede il flag esplicito di deroga motivata (`Override preventivo in bozza`);
    * Confermare l'emissione: il piano rate e i relativi bollettini per unità vengono generati e compaiono nella tabella `"Piano Rate e Scadenze Esercizio"`.

### N5 — Scheda 3: Bollettini & Incassi (Art. 1193 c.c.)

- [ ] **Cosa fare:** selezionare la scheda `"Bollettini & Incassi"`:
  - Verificare l'elenco dei bollettini emessi filtrabile tramite `SearchBar` (codice bollettino, unità, pagatore);
  - Cliccare su `"Dettaglio / Rettifica"` (o sulla riga del bollettino) per aprire la modale `"Dettaglio bollettino / Rettifica"`:
    * Consultare l'anteprima delle righe analitiche del bollettino e il riepilogo importi (Totale, Incassato, Residuo);
    * Per un bollettino non annullato, compilare la sezione `"Rettifica Bollettino Emesso"` con nuovo importo e motivazione obbligatoria: il bollettino originario passa a `RETTIFICATO` e viene emesso il nuovo bollettino collegato;
  - Cliccare su `"Registra incasso"` per aprire la modale `"Registra incasso manuale"`:
    * Selezionare l'unità immobiliare, il nome del pagatore, l'importo in Euro, la data valuta, il metodo di pagamento (`Bonifico`, `MAV`, ` Bollettino Postale`, ecc.), il criterio di imputazione (`FIFO ex art. 1193 c.c.` dal debito più vecchio) e l'eventuale flag `"Pagamento eseguito da terzo (art. 1180 c.c.)"`;
    * Confermare: l'incasso viene imputato alle rate/bollettini aperti, registrato sul giornale contabile e le StatCard di riscossione si aggiornano.

### N6 — Scheda 4: Morosità & Recupero (Art. 1129 co. 9 c.c. e Art. 63 disp. att. c.c.)

- [ ] **Cosa fare:** selezionare la scheda `"Morosità & Recupero"`:
  - Verificare l'`Alert` automatico nel caso di posizioni con oltre 180 giorni di ritardo dalla scadenza di pagamento (obbligo di attivazione riscossione forzosa entro 6 mesi ex art. 1129 co. 9 c.c.);
  - Verificare la tabella `"Prospetto Debitori e Solidarietà Subentro"` con indicazione di unità, debitore, scadenza più vecchia, giorni di ritardo, stato recupero e insoluto totale;
  - Verificare la tabella `"Scadenziario Pratiche di Recupero Crediti (Art. 1129 c.c.)"` e testare i pulsanti di avanzamento stato (`"Avvia sollecito"`, `"Messa in mora"`, `"Azione legale"`) verificando l'aggiornamento immediato dello stato della pratica.

### N7 — Scheda 5: Rendiconto & Conguagli (Art. 1130-bis c.c.)

- [ ] **Cosa fare:** selezionare la scheda `"Rendiconto & Conguagli"`:
  - Verificare il `"Semaforo Completezza Fascicolo Rendiconto (Art. 1130-bis c.c.)"` con lo stato dei 3 documenti obbligatori per legge:
    1. *Registro di Contabilità* (entrate e uscite cronologiche con verifica giustificativi);
    2. *Riepilogo Finanziario e Fondi* (situazione patrimoniale, cassa e fondi accantonati);
    3. *Nota Sintetica Esplicativa* (relazione gestionale sui rapporti in corso e questioni pendenti);
  - Compilare o aggiornare il testo nella `Textarea` della Nota Sintetica Esplicativa e cliccare su `"Salva e redigi rendiconto"`: il fascicolo viene salvato e il semaforo si aggiorna;
  - Cliccare su `"Calcola conguagli unità"`: vengono calcolati e visualizzati nella tabella `"Prospetto Conguagli per Unità Immobiliare"` per ciascuna unità la quota consuntiva, le rate emesse, il versato e il saldo conguaglio (`A Debito` / `A Credito` / `In Pareggio`).

### N8 — Responsive Design (1440px, 820px, 390px) e Accessibilità WCAG 2.2 AA

- [ ] **Cosa fare:** verificare `/admin/contabilita` sui 3 breakpoint obbligatori:
  - **Desktop (`1440x900`)**: sidebar blu navy visibile, 4 StatCard affiancate, tabelle `ResponsiveDataView` allineate senza alcuna scrollbar orizzontale (`document.documentElement.scrollWidth <= window.innerWidth`);
  - **Tablet (`820x1180`)**: riposizionamento fluido delle StatCard su 2 colonne e tabelle/card prive di overflow orizzontale;
  - **Smartphone (`390x844`)**: barra di navigazione inferiore, commutazione automatica di tutte le `ResponsiveDataView` in card compatte verticali, apertura e chiusura di tutte le modali (`Registra spesa`, `Emetti rate`, `Registra incasso`, `Nuovo preventivo`, `Dettaglio bollettino`) senza overflow né `<ScrollView>` annidati.

- [ ] **Cosa fare:** verificare la navigazione da tastiera e il contrasto cromatico WCAG 2.2 AA:
  - Navigare con `Tab`, `Shift+Tab`, `Invio`, `Spazio` ed `Escape` attraverso pulsanti d'azione, selettore esercizio, barra delle 5 schede (`Tabs`), filtri, tabelle e modali;
  - Verificare che il focus ring `#0284C7` (inset 2px) sia sempre ben visibile e mai tagliato su tutti gli elementi interattivi;
  - Verificare la leggibilità a zoom 200% senza tagli del contenuto.

### N9 — Ripristino e Pulizia Dati di Prova

- [ ] **Cosa fare:** al termine delle verifiche, eseguire nel SQL Editor di Supabase gli script di pulizia in ordine inverso:
  1. `supabase/seed-dev/admin_contabilita_rendiconto_extra_pulizia.sql`;
  2. `supabase/seed-dev/admin_contabilita_fondi_extra_pulizia.sql`;
  3. `supabase/seed-dev/admin_contabilita_morosita_extra_pulizia.sql`;
  4. `supabase/seed-dev/admin_contabilita_bollettini_extra_pulizia.sql`;
  5. `supabase/seed-dev/admin_contabilita_registro_extra_pulizia.sql`.
  **Risultato atteso:** tutti i dati di test contabili aggiunti dagli script `*_extra.sql` vengono rimossi in modo sicuro senza alterare i dati base del condominio.

---

## O. Raccolta Differenziata (Condòmino e Amministratore)

### O1 — Caricamento dati di prova

- [ ] **Cosa fare:** nel SQL Editor di Supabase eseguire `supabase/seed-dev/raccolta_differenziata_extra.sql` (dopo `01_dati_prova.sql`).
  **Risultato atteso:** vengono inseriti 7 turni settimanali idempotenti per il `Condominio di Prova` senza errori né duplicati.

### O2 — Consultazione lato Condòmino / Portiere (`/raccolta-differenziata`)

- [ ] **Cosa fare:** accedere come utente con ruolo `CONDOMINO` (o `PORTIERE`), aprire la voce `Raccolta differenziata` dal menu e verificare la schermata.
  **Risultato atteso:** compaiono i due riquadri "Oggi" e "Domani" con i rifiuti da esporre e le relative note/orari, seguiti dal calendario settimanale completo con ricerca testuale e filtri per giorno (`Lun`–`Dom`). Non compare alcun pulsante di aggiunta, modifica o eliminazione.

- [ ] **Cosa fare:** cambiare condominio dal selettore nell'header (se l'utente appartiene a più condomini).
  **Risultato atteso:** il calendario si ricarica automaticamente mostrando solo i turni del condominio selezionato (o lo stato vuoto se non configurato).

### O3 — Gestione CRUD lato Amministratore (`/admin/raccolta-differenziata`)

- [ ] **Cosa fare:** passare alla vista `Amministratore`, aprire `Raccolta differenziata` dal menu, cliccare su `"Nuovo turno"`, provare a inviare il form vuoto e poi compilare `Tipo di rifiuto`, `Giorno della settimana` e `Note`, quindi salvare.
  **Risultato atteso:** con i campi obbligatori mancanti vengono mostrati gli errori in italiano senza inviare richieste; al salvataggio valido compare il `Toast` di conferma e il turno appare nella tabella/lista ordinato per giorno.

- [ ] **Cosa fare:** cliccare `"Modifica"` su un turno esistente, cambiare giorno o note e salvare; poi cliccare `"Elimina"` su un turno di prova e confermare nel `ConfirmDialog`.
  **Risultato atteso:** la modifica aggiorna immediatamente la riga e mostra il `Toast`; l'eliminazione richiede conferma esplicita, rimuove la riga dal DB e dalla lista e resta persistente al ricaricamento della pagina.

### O4 — Isolamento RLS

- [ ] **Cosa fare:** accedere con un utente `CONDOMINO` non `ADMIN` e provare a navigare manualmente a `/admin/raccolta-differenziata`; inoltre verificare da console/API che un `CONDOMINO` non possa eseguire `INSERT`, `UPDATE` o `DELETE` su `raccolta_differenziata`, né leggere turni di un condominio a cui non appartiene.
  **Risultato atteso:** la guardia client mostra `NonAutorizzato` su `/admin/raccolta-differenziata` e le policy RLS (`has_cond_access` / `is_admin_of`) bloccano qualsiasi lettura cross-condominio o scrittura non autorizzata.

### O5 — Ripristino dati di prova

- [ ] **Cosa fare:** al termine delle verifiche eseguire `supabase/seed-dev/raccolta_differenziata_extra_pulizia.sql` nel SQL Editor.
  **Risultato atteso:** i 7 turni di prova vengono rimossi senza toccare altri dati del condominio.





