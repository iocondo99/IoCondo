# Audit End-to-End — Ruolo Condòmino (`CONDOMINO` / `RESIDENTE`)

Data audit: 16 novembre 2026  
Ambiente verificato:
- **App Web Live**: `https://io-condo-nine.vercel.app` (vista `Condòmino e portiere` su desktop `1280px` e smartphone `390px`)
- **Qualità tecnica locale**: `npm run test --workspace=@iocondo/data` (447 test in 96 suite: **447 passati, 0 falliti**), `npm run lint --workspace=@iocondo/app` (`tsc --noEmit`: **0 errori**), `npm run typecheck` (`0` errori).

---

## 1. Verdetto rapido

- **L'app è pronta per essere consegnata a un condòmino vero?**
  - **Lato interfaccia e logica client: quasi pronta (`PARZIALE` in produzione)** — L'esperienza del condòmino è ordinata, chiara, responsive (desktop e smartphone 390px con barra inferiore e zero overflow orizzontale), senza dati finti nella Home né errori console/HTTP sulle rotte principali (`/home`, `/pagamenti`, `/comunicazioni`, `/assemblee`, `/segnalazioni`).
  - **Blocchi prima della consegna a utenti reali**:
    1. Applicare su Supabase le migrazioni SQL in `supabase/da-applicare/` ancora pendenti (in particolare `11_moduli_condominio_estesi.sql` per i toggle estesi, `12_ticket_ambiti_comuni.sql` per l'isolamento Scala A vs Scala B nelle segnalazioni, `13_superadmin_saas_sospensione.sql` per il blocco condominio sospeso, `14_coda_email_gmail.sql` e `16_assistenza_numeri_personalizzati.sql`).
    2. Completare il flusso inviti/email (`invita-utente` + Gmail), altrimenti un condòmino reale non può ricevere l'email di invito e impostare la password.
    3. Verifica finale su DB reale con **due account condòmino distinti** (es. Scala A vs Scala B) per validare l'isolamento RLS post-migrazioni.

---

## 2. Matrice Funzionalità Condòmino

| Schermata / Flusso | Stato | Note UX/tecniche e file coinvolti |
| --- | --- | --- |
| **Accesso, Condominio Sospeso & Multi-Unità** | `OK` | Login reale funzionante; se `attivo === false` `AppShell.tsx` blocca il layout e mostra "Servizio momentaneamente sospeso" con eventuale selettore per altri condomini (`13_superadmin_saas_sospensione.sql`). |
| **Home & Campanella Notifiche** | `OK` | Dati reali su `/home` (`Spese e scadenze`, `Comunicazioni`, `Documenti`, `Assemblea`, `Segnalazioni`). Campanella in `Header.tsx` e archivio in `NotificheScreen.tsx` con aggiornamento ottimistico + `segnaNotificaLetta` (`letta = true`). Le notifiche per Comunicazioni, Assemblee e Bollettini vengono generate dai relativi flussi admin. |
| **Pagamenti, Bollettini & Situazione Contabile** | `OK` | `/pagamenti` e `/pagamenti/[id]` (`DettaglioRataScreen.tsx`) mostrano rate della propria unità/utente, stato (`Pagato`, `Da pagare`, `Scaduto`), ripartizione spese e download bollettino PDF con link firmato temporaneo (`10 min`, mai URL pubblici). Pagamento online correttamente assente (Fase 2). |
| **Spese Condominiali** | `OK` | `/spese` e `/spese/[id]` in sola lettura con filtri e dettaglio allegati firmati. |
| **Documenti (Drive)** | `OK` | `/documenti` e `/documenti/[id]` con isolamento per condominio e unità (`unita_id IS NULL OR unita_id IN (...)`) e download via `createSignedUrl` (`600s`). |
| **Assemblee** | `OK` | `/assemblee` e `/assemblee/[id]` escludono le bozze, mostrano ODG, deleghe, votazione in tempo reale (`assemblee_voti`) e verbale PDF firmato. |
| **Comunicazioni (Bacheca)** | `OK` | `/comunicazioni` e `/comunicazioni/[id]` filtrano per condominio (`palazzo_id IS NULL`) + palazzo dell'utente (`palazzo_id IN (...)`) e aggiornano lo stato letto su `notifiche`. Nota: il DB (`bacheca_post`) filtra fino a livello **Palazzo**, non a livello di singola Scala. |
| **Segnalazioni (Ambiti Condivisi)** | `PARZIALE` | Nessun residuo di ticket privati 1-a-1 né vecchia sezione Aree Comuni (`SegnalazioniScreen.tsx`, `segnalazioniService.ts`). Isolamento `Condominio` / `Palazzo` / `Scala` implementato nel codice e in `supabase/da-applicare/12_ticket_ambiti_comuni.sql` (stato `PARZIALE` finché la migrazione `12` non viene applicata sul DB reale). |
| **Altri Servizi & Toggle Moduli** | `OK` | `GuardiaModulo` + `navigazione.ts` + `HomeScreen.tsx` nascondono in tempo reale voci e schermate disattivate. Raccolta differenziata (`/raccolta-differenziata`), Spazi comuni (`/prenotazioni`), Assistenza (`/assistenza` con card leggibili e personalizzabili dall'admin) e Impostazioni (`/impostazioni`) operativi. |
| **Responsive Mobile & Web + Accessibilità** | `OK` | Verificato su desktop `1280px` e smartphone `390px`: zero errori console, tutte le chiamate Supabase `[200]`, zero scroll orizzontale (`scrollW === innerW`), barra inferiore mobile attiva. |

---

## 3. Controllo Privacy & Permessi

- **Isolamento vista Super Admin**: navigando direttamente a `https://io-condo-nine.vercel.app/superadmin/amministratori` dalla vista `RESIDENTE`, `GuardiaVista` blocca correttamente l'accesso mostrando `<NonAutorizzato />` (*"Questa funzione non è disponibile per te"*).
- **Isolamento vista Admin / Portiere**:
  - `GuardiaVista` protegge `/(admin)` con `ruoli={["ADMIN"]}` e `/(portiere)/pacchi` con `ruoli={["PORTIERE"]}` (in `navigazione.ts`, Spese e Pagamenti sono visibili solo a `CONDOMINO`, mai al `PORTIERE` puro).
  - *Nota test*: usando un account ibrido (`ADMIN + CONDOMINO + PORTIERE`), `GuardiaVista` su `/admin/*` rileva il ruolo `ADMIN` e commuta automaticamente vista; per un condòmino puro senza ruolo `ADMIN`, `/admin/*` resta bloccato da `GuardiaVista` + RLS (`is_admin_of`).
- **Isolamento dati tra condòmini (`rate_dettaglio`, `documenti_metadata`, `bacheca_post`, `ticket_testata`)**:
  - Dalle query osservate in rete su `/home`, `rate_dettaglio` filtra per `utente_id = auth.uid()` (o `utente_id IS NULL` limitato alle proprie `unita_id`), impedendo di vedere debiti di proprietari precedenti (UC-11) o di altri condòmini.
  - `documenti_metadata` filtra `unita_id IS NULL OR unita_id IN (proprie unità)`.
  - `bacheca_post` filtra `palazzo_id IS NULL OR palazzo_id IN (propri palazzi)`.
  - `ticket_testata` (Segnalazioni) richiede l'applicazione di `12_ticket_ambiti_comuni.sql` su Supabase affinché la policy RLS `has_scala_access(scala_colonna_id)` blocchi lato DB la visibilità incrociata tra Scala A e Scala B.
- **Fallback hardcoded residuo in `ImpostazioniScreen.tsx`**:
  - In `ImpostazioniScreen.tsx` (righe 66-89), se un condòmino non ha righe in `anagrafiche_unita` o la query fallisce, viene mostrato un fallback locale (`Palazzo A`, `Interno 1`, `Piano 1`, `125,500 ‰`) invece di uno stato vuoto.

---

## 4. Problemi trovati ordinati per gravità

### `CRITICO`
1. **Onboarding condòmini reali non ancora attivo**:
   - Senza deploy di `invita-utente`, `08_inviti_sicuri.sql` e configurazione SMTP/Gmail (`14_coda_email_gmail.sql`), un nuovo condòmino non può ricevere l'invito né attivare l'account.
2. **Isolamento RLS Scala A vs Scala B su Segnalazioni subordinato alla migrazione `12`**:
   - Il codice client è già aggiornato, ma l'effettivo blocco lato Postgres (`has_scala_access`) dipende dall'applicazione di `supabase/da-applicare/12_ticket_ambiti_comuni.sql`.

### `MEDIO`
1. **Fallback fittizio in `ImpostazioniScreen.tsx` per "Dati dell'appartamento"**:
   - Se un utente residente non ha ancora un'unità associata o la query va in errore, `ImpostazioniScreen.tsx` mostra dati finti (`Palazzo A · Int. 1 · Piano 1 · 125,500 ‰`), violando la regola *"nessun dato dimostrativo nell'app"* e rischiando di confondere il residente.
2. **Comunicazioni (`bacheca_post`) isolate per Palazzo ma non per Scala**:
   - Schema DB e query filtrano per `condominio_id` e `palazzo_id`; se in futuro servono avvisi mirati a una singola scala, `bacheca_post` non ha ancora `scala_colonna_id`.
3. **Documenti/Bollettini di prova senza file PDF reale nello Storage**:
   - Nei dati seed, alcune rate o documenti non hanno il file fisico nel bucket privato `documenti-condominio`, quindi al click mostrano l'avviso di file non disponibile.

### `MIGLIORIA`
1. **Titolo e barra di ricerca nell'Header**:
   - La barra di ricerca in alto è visibile ma disabilitata (`"Cerca, non ancora disponibile"`), occupando spazio su desktop.
2. **Verifica accessibilità manuale su dispositivo reale**:
   - Necessario completare il collaudo con VoiceOver/TalkBack e zoom al 200% su smartphone reale (checklist § 5 di `docs/PIANO_LAVORO.md`).

---

## 5. Prossimi 5 passi consigliati prima del rilascio ai condòmini

1. **Applicare le migrazioni SQL pendenti su Supabase** (`08`, `11`, `12`, `13`, `14`, `16`) e verificarle con gli script `*_verifica.sql`.
2. **Deployare Edge Functions e Gmail** (`invita-utente`, `accoda-email`, `invia-coda-email`, Redirect URLs Auth e template email in italiano).
3. **Eseguire il test RLS incrociato con 2 account condòmino reali** (es. Scala A vs Scala B) su Pagamenti, Documenti, Comunicazioni e Segnalazioni.
4. **Rimuovere il fallback fittizio (`Palazzo A / Int. 1`) in `ImpostazioniScreen.tsx`**, mostrando uno stato chiaro *"Nessuna unità associata"* quando `unitaList` è vuoto.
5. **Caricare almeno un bollettino PDF e un verbale reale nel bucket privato** per collaudare end-to-end il download con link firmato prima dell'apertura ai condòmini.
