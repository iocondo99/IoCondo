# Decisioni

- admin-web da portare su Expo web con @iocondo/ui, decisione dopo Login e Home del condòmino.
- Servizi duplicati tra admin-web e app mobile: unificati in packages/data (Fase 0, 2026-10-30). admin-web conserva ancora le sue copie.
- Expo Go per SDK 58 su iPhone è atteso sugli store; l'account Apple Developer si valuta alla pubblicazione. Nel frattempo si prova su web (Safari) e su Android con Expo Go.
- Aggiornamento da Expo SDK 52 a SDK 58 (React Native 0.88, React 19.3, expo-router 58). Motivo: Expo Go supporta solo l'SDK più recente e l'SDK 52 non era più apribile. Percorso scelto: progetto ricreato sul template SDK 58 e codice spostato (l'app era ancora senza schermate), invece dei sei salti incrementali.
- admin-web portato a Next 15.5 e React 19.3 (con @types/react 19) per avere un'unica versione di React nel monorepo, requisito dell'SDK 58. Nessuna modifica funzionale.
- Da valutare più avanti: TypeScript 6 (expo-doctor lo indica per l'SDK 58; oggi il repo è su 5.6) e @supabase/ssr oltre la 0.5.2 (dalla 0.10 setAll riceve gli header anti-cache per le risposte con cookie di sessione).

## 2026-10-30 — Architettura A: un'unica app Expo per tutti i ruoli
- **Decisione:** una sola app Expo (`apps/app`, `@iocondo/app`) serve tutti i ruoli. Per ora solo web, deploy su Vercel. Navigazione e permessi dipendono dal ruolo attivo.
- **Rename:** `apps/condomino-mobile` → `apps/app`.
- **Super Admin:** sidebar minima con Amministratori, Piani e abbonamenti, Fatture, Impostazioni.
- **Admin:** la navigazione include Assemblee.
- **Pacchetti:** `@iocondo/data` (servizi + hook di sola logica, senza Expo), `@iocondo/supabase-client` (factory + storage per piattaforma), `@iocondo/shared-types` (tipi, ruoli, navigazione), `@iocondo/ui` (design system).
- **Servizi unificati:** base = versione admin, con aggiunta dei metodi del mobile (assemblee, servizi, rate "mie", pagamento, commenti e notifiche bacheca, creazione ticket e allegati). Conflitto di nome su `ticket.list`: resta la firma admin; la lista lato condomino è `ticket.listMiei`.
- **Ruoli:** `RuoloCodice` specchia `ruoli_piattaforma` (CONDOMINO, ADMIN, PORTIERE). `RuoloApp` aggiunge SUPER_ADMIN (flag `utenti.is_superadmin`) e FORNITORE (magic link).
- **Dati:** nessun dato demo, nemmeno nei contesti; nessun pagamento simulato.
- **Da riscrivere su dati reali (fase Auth):** `RoleContext` e `markRataAsPaid` / `resetDemoRata` (dati dimostrativi), `CondominioContext` di admin-web, `useRataPayment` (usa un `providerRef` fittizio).

- Fornitore: non è un utente. Entra con link magico (`fornitori_tokens`) senza login, quindi il CHECK di `ruoli_piattaforma` (CONDOMINO, ADMIN, PORTIERE) NON va esteso. SUPER_ADMIN resta il flag `utenti.is_superadmin`.
- Supabase, da fare dalla dashboard: attivare la leaked password protection (Auth, Password security). Non è eseguibile da migrazione.
- `profili_pubblici`: verifica documentata (2026-10-30). Espone solo `id`, `nome_cognome`, `avatar_url` (niente email né telefono). `anon` non ha SELECT, `authenticated` sì. Il filtro mostra sé stessi e gli utenti che condividono almeno un condominio con chi legge (`has_cond_access`). La vista è SECURITY DEFINER di proposito: `utenti_select` è riservata ad admin e superadmin, quindi senza il definer i condomini non vedrebbero i vicini. L'avviso del linter resta, accettato.
- Bucket Storage pubblici: `foto-guasti` e `avatar-utenti` sono `public=true` (leggibili via URL da chiunque lo conosca). Da rivalutare prima di avere dati reali.

## Da fare prima di utenti reali
- Applicare `supabase/da-applicare/07_revoke_execute_funzioni_definer.sql` (revoke execute da anon/public sulle funzioni trigger e `try_parse_uuid`).
- Attivare la leaked password protection dalla dashboard Supabase.
- Rendere privati i bucket `foto-guasti` e `avatar-utenti` (link firmati).
- Rivalutare la vista `profili_pubblici` (SECURITY DEFINER, accettata per ora).
- Ricontrollare RLS e advisor con `get_advisors`.

## 2026-11-01 — B3a e B3b
- B3a e B3b completati; da provare su dispositivi (Android, iPhone), con screen reader e a zoom reale 200% prima del rilascio.
- FileUpload: scelta file su web senza librerie; su Android e iOS con `expo-document-picker` (~58.0.4). Il selettore filtra solo per MIME: estensioni, tipo mancante e peso li controlla `fileRules.ts`.

## Configurazione Supabase Auth (da fare nella dashboard)
Analisi del 2026-11-01. Il codice usa un solo `redirectTo`: `resetPasswordForEmail` in `AuthContext.tsx`, che vale `${window.location.origin}/login` su web e `Linking.createURL('/login')` su nativo (con lo scheme `iocondo` di `app.json` diventa `iocondo://login`). Non ci sono inviti né link magici di Supabase: il link del Fornitore è un token proprio (`fornitori_tokens`), non passa da Supabase Auth. In locale `npx expo start --web` serve su `http://localhost:8081` (porta predefinita di Expo, nessuna modifica nel repo). `supabase/config.toml` vale solo per lo stack locale della CLI, non per il progetto in cloud: le impostazioni vere vanno controllate nella dashboard.

- **Redirect URLs di sviluppo** — da fare. Aggiungere `http://localhost:8081/login` (aggiungere anche `http://127.0.0.1:8081/login` solo se si apre l'app con quell'indirizzo) e `iocondo://login` (build di sviluppo o standalone). In Expo Go l'indirizzo è `exp://<IP-della-rete>:8081/--/login`, cambia con la rete e non si elenca.
- **Redirect URLs di produzione** — da fare, dopo la configurazione di Vercel (oggi `vercel.json` costruisce solo `admin-web`; l'app Expo non è ancora pubblicata). Aggiungere `https://<dominio-app>/login`, poi `https://<dominio-app>/reimposta-password` e il link di invito quando esisteranno (con gli equivalenti `iocondo://reimposta-password` e `iocondo://invito`).
- **Site URL** — da fare. Oggi `http://localhost:8081`; in produzione l'indirizzo pubblico dell'app. È il ripiego quando un `redirectTo` non è nell'elenco e finisce nei modelli delle email.
- **Registrazioni libere disattivate** — da fare. Non esiste "Registrati": gli utenti entrano su invito. `config.toml` ha `enable_signup = true` (solo locale): nella dashboard, Sign In / Providers → disattivare "Allow new users to sign up".
- **Leaked password protection** — da fare (Authentication → Password security; già annotata sopra).
- **Conferma email** — da fare (scelta da confermare). Proposta: tenerla attiva. Motivo: protegge da indirizzi sbagliati o non propri, l'invito dell'amministratore la soddisfa già e l'app mostra già un messaggio dedicato per "email non confermata". `config.toml` ha `enable_confirmations = false` (solo locale).

Limiti noti finché mancano le pagine:
- **Reimpostazione password**: la richiesta parte e la conferma è corretta, ma il link porta a `/login` e non c'è la schermata per scegliere la nuova password (il client ha `detectSessionInUrl: false` e nessuna gestione della sessione di recupero). Il reset non si completa. Serve `/reimposta-password` con `updateUser({ password })`.
- **Inviti**: nessuna schermata né codice; l'email di invito userebbe Site URL e Redirect URLs.

## 2026-11-01 — Layout, profilo e ruoli
- **Viste (UC-07):** chi ha più ruoli sceglie la vista dal selettore dell'header (o da "Altro" su smartphone). Le vere viste sono tre: Super amministratore (flag `utenti.is_superadmin`), Amministratore e Residente. Condòmino e portiere stanno nella stessa vista: le voci si sommano (Registro pacchi e Ticket aree comuni solo con il ruolo PORTIERE; Spese e Pagamenti solo con il ruolo CONDOMINO, quindi un portiere "puro" non ha voci contabili). Admin e condòmino restano separati perché hanno navigazioni diverse. Scelta di condominio e vista ricordata sul dispositivo (`iocondo.preferenze.v1`).
- **Ruoli reali:** `ProfiloProvider` legge `utenti`, `utente_entita_ruolo` (+ `ruoli_piattaforma`) e `condomini`. Un ruolo legato solo a un'unità prende il condominio da unità e palazzo; chi è `condomini.admin_id` è amministratore anche senza riga di ruolo (come fa `is_admin_of`). Nessun ruolo e nessun flag → "Account non ancora attivo".
- **Moduli (UC-05):** le voci seguono `configurazioni_condominio` (riga di default con `palazzo_id` nullo; senza riga sono tutte attive): Comunicazioni ← bacheca o chat, Segnalazioni e Ticket aree comuni ← ticket, Registro pacchi ← pacchi. Per l'amministratore nessuna voce è nascosta dai moduli.
- **Percorsi:** condòmino/portiere alla radice (`/home`, `/spese`, `/pacchi`…), amministratore sotto `/admin/…`, super amministratore sotto `/superadmin/…`. `/` porta alla home della vista attiva. Gruppi di rotte `(condomino)`, `(portiere)`, `(admin)`, `(superadmin)` con guardia che mostra "non disponibile" (mai un reindirizzamento silenzioso). La guardia è solo cortesia dell'interfaccia: la sicurezza vera è nelle RLS.
- **Lezioni di expo-router (web):** (1) lo `Slot` del layout protetto deve restare montato anche durante il caricamento del profilo, altrimenti dopo l'accesso la pagina richiesta si perde e si torna a `/`; (2) `Link asChild` scarta gli stili a funzione e rifiuta array di stili (vedi `NavLink`); (3) un layout che mostra "non disponibile" al posto dello `Slot` fa riportare a `/`.
- **Focus sulla sidebar:** sul navy il focus è bianco, non #0284C7 (2,8:1 sul navy, sotto il 3:1 di WCAG 1.4.11). Altrove resta #0284C7.
- **Notifiche:** il pannello legge la tabella `notifiche` filtrata per `utente_id`. La policy di SELECT/UPDATE lascia al super amministratore tutte le righe: `bacheca.listNotifiche` e `segnaTutteLette` (servizi esistenti, senza filtro) per un super amministratore leggerebbero e marcherebbero le notifiche di tutti. L'app usa quindi `profilo.listMieNotifiche` e `segnaMieNotificheLette`; i due metodi vecchi vanno corretti prima di usarli.
- **Ricerca globale:** disattivata e dichiarata ("La ricerca sarà disponibile a breve") finché non c'è nulla da cercare.
- **Codice vecchio fuori dal routing:** `RoleProvider` non è più nel layout radice. Le rotte demo (`(tabs)`, `report-issue`, `parcels`) sono in `apps/app/src/legacy/`, non raggiungibili. Restano da riscrivere: `RoleContext` (dati dimostrativi), `useRataPayment` (`providerRef` fittizio), `CondominioContext` di admin-web, `HomeScreen`, `ParcelScreen`, `ReportIssueScreen`, `useParcels`, `useReportIssue`.

## Dati di prova (supabase/seed-dev)
Script da eseguire a mano dal SQL Editor, mai come migrazione. `01_dati_prova.sql` crea un condominio di prova ("Condominio di Prova", Via dei Test 1), un palazzo, tre unità, il possesso, tre ruoli per l'utente di prova (CONDOMINO, PORTIERE, ADMIN), la riga dei moduli e due notifiche. L'utente "super" riceve solo il flag `is_superadmin`. Gli id fissi hanno prefisso `d0000000-` e ogni inserimento è rieseguibile (`on conflict` e `where not exists`). `02_pulizia_dati_prova.sql` toglie tutto cancellando il condominio (cascata) e le due notifiche; gli utenti non si toccano.
Verifiche fatte sullo schema reale (sola lettura): `utenti.id` è FK di `auth.users` e la riga nasce dal trigger `handle_new_user`; `utente_entita_ruolo` ha CHECK `condominio_id` o `unita_id` non nulli e nessun UNIQUE; `palazzi` è univoco per (condominio, nome), `unita_immobiliari` per (palazzo, interno, tipologia); `condomini.admin_id` è NOT NULL (RESTRICT); `provincia` è `char(2)`; `ruoli_piattaforma` e `tipologie_unita` hanno già le righe (lo script le cerca per codice/descrizione). Le RLS di lettura (`has_cond_access`, `is_admin_of`, `has_unita_access`, `has_role_in`) risultano soddisfatte dai dati inseriti. Le policy di INSERT per un amministratore (`has_active_license()`) richiedono una riga in `licenze_saas`: lo script non la crea, serve solo quando l'app inizierà a scrivere come amministratore.

## 2026-11-01 — Home del condòmino
- **"In corso":** una rata è "in corso" se non è scaduta ed è stata pagata in parte.
- **"Non letto":** si basa sulle notifiche dell'utente collegate al post.
- **Banner promozionale:** non si realizza.
- **Richieste doppie al cambio condominio:** da indagare più avanti.

## 2026-11-01 — Inviti e scelta della password
- **Flusso:** una sola Edge Function di invio (`invita-utente`, `verify_jwt = true`); nessuna funzione di accettazione. L'accettazione resta nel trigger esistente: alla conferma dell'email `applica_inviti` assegna ruolo, condominio e unità dalla riga `inviti_pendenti`. L'app non sceglie mai i ruoli.
- **Link email:** `{{ .RedirectTo }}?token_hash=…&type=invite|recovery`; la pagina conferma con `verifyOtp` solo dopo il pulsante "Continua" (i programmi che aprono le email non consumano il link). Client invariato: `detectSessionInUrl: false`, nessun PKCE.
- **Scadenza 7 giorni:** `applica_inviti` considera solo inviti con `scadenza > now()` al momento della conferma. Scaduto = nessun ruolo, mai; l'account resta "non ancora attivo". Il link dell'email dura invece quanto "Email OTP expiration" (default 1 ora).
- **Ruoli:** l'amministratore invita solo CONDOMINO e PORTIERE nei propri condomini; ADMIN solo il super amministratore. Controlli in `crea_invito` (database, `auth.uid()`). `applica_inviti` verifica anche che chi ha invitato sia ancora amministratore. Mai toccati ruoli esistenti né `is_superadmin`.
- **Già registrato:** riceve solo il ruolo e una notifica, nessuna email; all'amministratore la risposta è identica ("Invito registrato.").
- **Password da scegliere:** promemoria `iocondo.password-da-scegliere.v1` nel dispositivo (invite|recovery), scritto prima di aprire la sessione dal link e tolto solo a `updateUser` riuscito o all'uscita. `ProtectedLayout` rimanda alla schermata finché c'è. È cortesia dell'interfaccia, non sicurezza.
- **Email vere:** il server email predefinito di Supabase consegna solo ai membri del team e ha 2 email/ora: serve un SMTP proprio.
- **Da fare:** applicare `supabase/da-applicare/08a_fix_trigger_e_ruoli.sql` poi `08_inviti_sicuri.sql` e seguire `docs/CHECKLIST_INVITI.md`. Reinvio a utente invitato ma mai confermato: non verificato con prova reale.
- **Lista completa dei test da fare** (database, UI, accessibilità, dispositivi): `docs/TEST_DA_FARE.md`.
- **Lista test da eseguire:** vedi `docs/TEST_DA_FARE.md` (sezioni A–F, inviti/password/pagamenti/dispositivi).
- **Da migliorare prima di invitare utenti reali (problema 4 — revisione 2026-11-02):** la Edge Function `invita-utente` risponde con HTTP 502 quando l'email esiste in `auth.users` ma non è ancora confermata (account in attesa), e con 200 quando l'email è nuova o già confermata. Questo permette a un amministratore di distinguere "account non confermato" da "email non registrata" (oracolo di enumerazione a bassa gravità). Soluzione da valutare: tentare il re-invito via `admin.auth.admin.inviteUserByEmail` anche per account non confermati (GoTrue ri-manda l'email) prima di considerarlo un errore, così la risposta rimane 200 in tutti i casi di successo.

## 2026-11-04 — Task 7: Impostazioni e Assistenza (/impostazioni e /assistenza)
- **Profilo personale e aggiornamento anagrafica:** l'aggiornamento è limitato unicamente ai recapiti personali (`nome_cognome`, `telefono`) su `public.utenti`. Le policy RLS (`utenti_update`) vietano a qualunque utente non superadmin di modificare il proprio `id`, `email`, ruoli o flag `is_superadmin`. L'indirizzo email di accesso è mostrato in sola lettura con nota che ne chiarisce la gestione da parte dell'amministrazione.
- **Sicurezza account e cambio password:** cambio password tramite Supabase Auth (`supabase.auth.updateUser({ password })`), incapsulato in `profiloService.ts` / `authService.ts`. Nessuna query diretta nei componenti. Validazione di almeno 8 caratteri, conferma password e feedback accessibile (`alert`, `aria-invalid`).
- **Preferenze notifiche locali:** le preferenze di ricezione degli avvisi (email, bacheca, promemoria rate) sono memorizzate con persistenza locale nello storage del dispositivo tramite la chiave `iocondo.preferenze.v1` (campo `notifiche`), preservando le preferenze di navigazione già memorizzate (`condominioId`, `vista`).
- **Layout Impostazioni:** organizzazione Desktop a 2 colonne affiancate (`flex: 1` ciascuna): a sinistra Profilo personale e Preferenze notifiche, a destra Sicurezza dell'account e Sessione (azione protetta "Esci dall'account" con `ConfirmDialog` accessibile). Su Tablet e Mobile le colonne collassano verticalmente nel flusso naturale.
- **Layout Assistenza (schede a tutta larghezza impilate verticalmente):**
  - Concentrate le informazioni sui canali di reperibilità e supporto reale: rimosse le card scorciatoia ridondanti ("Segnala un guasto", "I tuoi ticket") e il riquadro dell'assicurazione del fabbricato.
  - Le 3 schede principali ("Amministrazione del condominio", "Guida e FAQ", "Pronto intervento e numeri utili") sono disposte verticalmente una sotto l'altra, ciascuna estesa a tutta la larghezza utile della pagina (960 px su desktop, 100% su tablet e smartphone) con spaziatura coerente di 24 px (`space[6]`).
  - Nella scheda "Guida e FAQ", le 4 domande di anteprima sono organizzate a griglia 2x2 su desktop (`flexDirection: 'row'`, `flexWrap: 'wrap'`, `flexBasis: '48%'`) per sfruttare l'ampiezza orizzontale in modo elegante e ordinato, mantenendo la visualizzazione a colonna singola su tablet e mobile.
  - Dati di prova e ripristino salvati in `supabase/seed-dev/assistenza_extra.sql` e `assistenza_extra_pulizia.sql` senza scritture sul database remoto.

## 2026-11-04 — Aggiornamenti Home del condòmino (/home)
- **StatCard "Spese e scadenze":** la prima StatCard della griglia riepilogativa è stata rinominata da *"Spese condominiali"* a *"Spese e scadenze"*, coprendo in modo chiaro sia la situazione contabile complessiva sia lo stato delle rate con pulsante rapido *"Vedi le rate"*.
- **Rimozione "Prossime scadenze":** rimossa la sezione estesa `ProssimeScadenze` per eliminare duplicazioni con la StatCard e la pagina specializzata `/pagamenti`.
- **Ultime comunicazioni a piena larghezza:** la lista delle ultime comunicazioni (`UltimeComunicazioni`) si espande a tutta larghezza sotto la griglia delle 4 card, offrendo una lettura comoda e immediata degli avvisi di bacheca.
- **Ripristino e differenziazione "Segnalazioni rapide":** ripristinata la card `SegnalazioniRapide` sotto "Ultime comunicazioni". Per evitare ridondanze tra i due pulsanti:
  - *"Segnala un problema"* apre direttamente la finestra modale popup (`ModuloNuovaSegnalazione`) per creare una segnalazione senza abbandonare la Home.
  - *"Consulta le richieste"* reindirizza all'elenco delle segnalazioni (`/segnalazioni` o `/ticket-aree-comuni` a seconda del ruolo).
- **Spaziatura e respiro scrollbar nelle finestre modali (Modal):** aumentata la spaziatura destra e inferiore del corpo scorrevole (`bodyContent`) in `packages/ui/src/components/Modal.tsx` a `space[6]` (24px) su desktop e `space[4]` (16px) su mobile. Questa modifica allontana nettamente la barra di scorrimento verticale dai campi di input e dalle aree di caricamento (es. drag & drop di `ModuloNuovaSegnalazione`), evitando la sovrapposizione visiva e preservando lo spazio per gli anelli di focus `#0284C7`.
- **Rifinitura grafica e focus outline del menu a tendina (Dropdown):** nel componente `Dropdown.tsx` (`packages/ui/src/components/Dropdown.tsx`), all'apertura del menu il focus viene posizionato programmaticamente sul primo elemento interattivo (`Impostazioni`) tramite `moveFocusTo`. Precedentemente, l'indicatore di focus interno (`insetFocusStyle`) generava un contorno CSS rettangolare a 90° (`borderRadius: 0`) che veniva ritagliato diagonalmente dal contenitore arrotondato a 8px con `overflow: hidden`, producendo spigoli tagliati e imperfezioni grafiche. La soluzione ha introdotto un padding interno (`padding: space[1]` = 4px) sul contenitore `styles.menu`, raggio arrotondato coerente `radii.badge` (6px) sul clip interno e sui singoli elementi `MenuItem` (`styles.item`), con `paddingHorizontal: space[3]` (12px) e margini verticali sul divisore. In questo modo l'anello di focus blu `#0284C7` curva in modo fluido e armonioso all'interno della tendina con raggio 6px, garantendo accessibilità WCAG 2.4.7 e perfezione estetica senza tagli.
- **Riorganizzazione schede e allineamento visivo in Impostazioni (/impostazioni):**
  - Scambio tra le schede *Sessione* e *Preferenze notifiche*: la scheda *Preferenze notifiche* è stata spostata nella colonna di destra sotto la scheda *Sicurezza dell'account*, mentre la scheda *Sessione* è stata collocata in basso a tutta larghezza (`width: 100%`) con layout orizzontale su desktop (testo descrittivo a sinistra, pulsante distruttivo *"Esci dall'account"* a destra) e verticale su mobile/tablet.
  - Allineamento delle altezze tra le colonne su desktop: la griglia a due colonne adotta `alignItems: 'stretch'`; la scheda *Profilo personale* nella colonna di sinistra è configurata con `flex: 1` e il pulsante *"Salva modifiche"* è ancorato in basso tramite `marginTop: 'auto'`. In questo modo la scheda del profilo e la scheda delle preferenze notifiche (seconda scheda della colonna destra) terminano alla medesima linea orizzontale, creando una composizione equilibrata, pulita e priva di dislivelli asimmetrici.
  - Estensione componente `Card`: aggiunta la prop opzionale `style?: StyleProp<ViewStyle>` al componente `Card` (`packages/ui/src/components/Card.tsx`) per consentire composizioni flessibili e allineamenti controllati in layout complessi.
- **Sezione "Dati dell'appartamento" e allineamento identità in Profilo personale (/impostazioni):**
  - Allineamento del nome con il badge: nella card *Profilo personale*, il nome dell'utente è stato posizionato sulla stessa riga del badge del ruolo (`[Condòmino]`) con allineamento verticale centrato (`alignItems: 'center'`), in perfetta armonia con il centro dell'Avatar circolare (`rigaIntestazioneProfilo`).
  - Riquadro "Dati dell'appartamento": per ridurre lo spazio bianco verticale e arricchire la scheda con dati operativi del residente, è stato introdotto il riquadro informativo che carica le unità del residente tramite `services.profilo.caricaUnitaCondominio`. Il riquadro presenta: edificio/palazzina (es. "Palazzo A • Scala A"), interno e piano (es. "Int. 1 • Piano 1"), quota millesimale (es. "300,000 ‰") e titolo di possesso con badge *Proprietario*. In questo modo la card del profilo personale bilancia naturalmente l'altezza della colonna destra senza spazi vuoti non necessari.
  - Parità assoluta di allineamento inferiore e bilanciamento contenuti tra le colonne: per garantire che la scheda *Profilo personale* e la scheda *Preferenze notifiche* terminino rigorosamente sulla stessa riga orizzontale al pixel, sia a livello di bordo contenitore sia a livello di contenuti interni:
    1. Entrambe le card adottano `flex: 1` (`cardProfiloDesktop` e `cardPreferenzeDesktop`) all'interno del contenitore desktop con `alignItems: 'stretch'`.
    2. Nella card *Profilo personale*, il pulsante *"Salva modifiche"* è ancorato sul fondo tramite `marginTop: 'auto'`.
    3. Nella card *Preferenze notifiche*, il contenitore interno `sezioneDati` adotta `sezioneDatiDesktop: { flex: 1 }` ed è stata introdotta una nota a piè di scheda (`notaSalvataggioPreferenze` con icona check e testo informativo *"Le preferenze di notifica vengono salvate automaticamente su questo dispositivo."*) ancorata in basso con `marginTop: 'auto'`, bordo superiore divisorio sottile e padding dedicato. In questo modo:
       - Il bordo inferiore di entrambe le card termina alla medesima quota (1222 px a 1440 px di viewport).
       - Il margine inferiore degli elementi attivi interni coincide al pixel (1197 px).
       - Viene eliminato qualsiasi dislivello visivo o spazio bianco asimmetrico tra la colonna di sinistra e la colonna di destra.


## 2026-11-06 — Modulo Amministratore: Contabilità rimandata, precedenza a Documenti ed Assemblee
- **Decisione:** su indicazione esplicita dell'utente, lo sviluppo della sezione Contabilità (`/admin/contabilita`: bilanci, prima nota movimenti, emissione rate e riconciliazioni) viene temporaneamente rimandato a dopo il completamento dei moduli Documenti (`/admin/documenti`), Assemblee (`/admin/assemblee`) e Impostazioni (`/admin/impostazioni`).
- **Ordine aggiornato per l'Amministratore:** Passo 5 Manutenzione (completato) → Passo 6 Documenti (`/admin/documenti`) → Passo 7 Assemblee (`/admin/assemblee`) → Passo 8 Impostazioni (`/admin/impostazioni`) → Contabilità.
