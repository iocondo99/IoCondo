# Audit di Sicurezza Informatica — IoCondo

**Data audit iniziale:** 25/11/2026  
**Data consolidamento e verifica fix:** 25/11/2026  
**Ambito analizzato:** monorepo IoCondo (`apps/app`, `packages/data`, `packages/supabase-client`, `packages/shared-types`, `packages/ui`, `supabase/migrations`, `supabase/da-applicare`, `supabase/functions`, `supabase/templates`, `scripts`).  
**Nota operativa:** audit statico, applicazioni fix difensivi e verifiche negative eseguite **esclusivamente in locale** (test unitari Node, build/export locale e Microsoft Edge `channel: 'msedge'` con mock locali su `apps/app/dist`), senza leggere/esporre `.env*`, senza eseguire DDL o migrazioni sul database remoto e senza eseguire attacchi verso ambienti esterni.

---

## 1. Riepilogo Esecutivo

Tutti e **19 i rischi individuati** nell'audit iniziale (`2 CRITICO`, `7 ALTO`, `5 MEDIO`, `5 BASSO`) sono stati indirizzati con fix concreti in codice TypeScript/React Native/Edge Functions e con script SQL idempotenti pronti in `supabase/da-applicare/`.

- **Fix immediati lato applicativo / Edge Functions / igiene repository:** applicati, compilati e verificati in locale (`typecheck` `9/9` task, `lint` `5/5` task, unit test `533/533` senza errori, bundle web riesportato e verificato su Microsoft Edge).
- **Fix lato Database / RLS / Trigger / Storage (`supabase/da-applicare/`):** `8/8` migrazioni pendenti applicate dall'utente e verificate su `IoCondo - PROD` (`07`, `09`, `11`, `14`, `15`, `20`, `21`, `22`); `get_advisors` segnala **`0 ERROR`** (`0` `security_definer_view`, `0` `function_search_path_mutable`, `0` `anon_security_definer_function_executable`).
- **Dipendenze npm (`[MEDIO-05]`):** con `npm audit fix` (senza `--force`, previa conferma utente) le vulnerabilità production-runtime sono scese da **10 (`8 moderate`, `2 high`)** a **3 `moderate` (`0 high`, `0 critical`)**, legate esclusivamente a `minimatch` in `@expo/fingerprint`/`expo` (aggiornabile solo con downgrade breaking a `expo@52.0.49`).

### Stato riepilogativo per gravità

| Gravità | Totale iniziale | Risolti in codice / DB | Azioni manuali residue prima del go-live |
| :--- | :---: | :---: | :--- |
| **CRITICO** | **2** | 2/2 (`VERIFICATO ONLINE`: DB + Edge Functions) | Nessuna (verifica solo `APP_URL`/`ALLOWED_ORIGINS` nei Secrets se usi un dominio web diverso da `app.iocondo.it`) |
| **ALTO** | **7** | 7/7 (`VERIFICATO ONLINE`: DB + Edge Functions) | Nessuna |
| **MEDIO** | **5** | 4/5 + 1/5 mitigato (`VERIFICATO ONLINE`: DB + Edge Functions; `npm audit` 3 `moderate`) | Verificare `APP_URL`/`ALLOWED_ORIGINS` nei Secrets + attivare Leaked Password Protection su Auth |
| **BASSO** | **5** | 5/5 (`VERIFICATO ONLINE`: `21` + `22` applicate) | Nessuna |
| **Totale** | **19** | **19/19 gestiti** | |

---

## 2. Stato Finale delle Vulnerabilità Trovate

### CRITICO

#### [CRITICO-01] Open SMTP Relay autenticato e possibile Email Header Injection in `invia-email`
- **Stato finale:** `RISOLTO IN CODICE` + `FIX SQL PRONTO IN supabase/da-applicare/21_fix_sicurezza.sql`
- **File modificati:**
  - `supabase/functions/invia-email/index.ts`: aggiunta verifica autorizzazione per `isServiceCaller(req)` oppure utente `ADMIN` di condominio attivo / `SUPER_ADMIN` (`is_admin_of` se passato `condominio_id`, oppure `is_active_admin_any()` con fallback rigoroso su `adminClient`), rifiuto esplicito di `[\r\n\0]` in `to` e `subject`, limiti dimensione HTML (`200_000`) / text (`100_000`) e rate limit `10 req/min` per utente.
  - `supabase/functions/_shared/email.ts`: aggiunto helper esportato `stripHeaderControl`, applicato in `risolviFrom` prima dell'estrazione `<indirizzo>` (con validazione email interna) e in `inviaViaGmail` su `from`, `to`, `subject`, `replyTo`.
  - `supabase/da-applicare/21_fix_sicurezza.sql`: creata helper `SECURITY DEFINER` `public.is_active_admin_any()` (con `SET search_path = public`).
  - `packages/data/src/email/codaEmailLogic.ts`: sanitizzazione `[\r\n\0]` sugli oggetti generati dai 3 template email e in `isEmailValida` / `pulisciNomeHeader`.

#### [CRITICO-02] Sintassi SQL invalida in `09_fix_documenti_rls.sql` e difese critiche subordinate a migrazioni pendenti in `supabase/da-applicare/`
- **Stato finale:** `FIX SQL PRONTO IN supabase/da-applicare/09_fix_documenti_rls.sql e 21_fix_sicurezza.sql`
- **File modificati:**
  - `supabase/da-applicare/09_fix_documenti_rls.sql`: sostituito l'invalido `create or replace policy` con `drop policy if exists ...` + `create policy documenti_metadata_select ... to authenticated` con `public.is_superadmin()`.
  - `supabase/da-applicare/21_fix_sicurezza.sql`: riallineata in modo idempotente `documenti_metadata_select` (`to authenticated`).
- **Nota operativa:** le migrazioni pendenti `07`, `08a`, `08`, `09`, `12`, `13`, `14`, `15`, `17`, `18`, `19`, `20` e `21` devono essere eseguite manualmente dall'amministratore DB su Supabase nell'ordine progressivo prima della messa online.

---

### ALTO

#### [ALTO-01] Hijack di assegnazione Amministratore / Condominio tramite modifica self-service di `public.utenti.email`
- **Stato finale:** `RISOLTO IN CODICE` + `FIX SQL PRONTO IN supabase/da-applicare/21_fix_sicurezza.sql`
- **File modificati:**
  - `supabase/da-applicare/21_fix_sicurezza.sql`: introdotto trigger `trg_utenti_protect_sensitive` (`BEFORE UPDATE ON public.utenti`) che blocca modifiche dirette a `email` e `is_superadmin` da client (`42501`), aggiornato `handle_user_updated()` (`auth.users` -> `public.utenti`) con `set_config('iocondo.sync_email', '1', true)`, e introdotta la RPC `SECURITY DEFINER` `risolvi_utente_verificato_da_email(p_email)` riservata al `SUPER_ADMIN` (`auth.users.email_confirmed_at IS NOT NULL`).
  - `packages/data/src/superadmin/superadminService.ts`: rimosso il lookup diretto su `public.utenti.email` in `invitaAmministratore` e `creaCondominioEAssegnaAdmin`, sostituito dalla RPC `risolvi_utente_verificato_da_email` (fail-closed se migrazione `21` assente).

#### [ALTO-02] Isolamento Storage insufficiente su `documenti-condominio` (documenti riservati) e `ricevute-rate` (subentro), più `rate_dettaglio` in bozza
- **Stato finale:** `FIX SQL PRONTO IN supabase/da-applicare/21_fix_sicurezza.sql`
- **File modificati:**
  - `supabase/da-applicare/21_fix_sicurezza.sql`:
    - `can_read_documento_by_path` + nuova policy `documenti_condominio_select` su `storage.objects`: delega a `documenti_metadata` / `can_read_documento`, bloccando la lettura di file riservati altrui o orfani ai non-admin.
    - `can_read_ricevuta_rate` + nuova policy `ricevute_rate_select` su `storage.objects`: rimosso l'accesso generico via `has_unita_access`; richiede `owner = auth.uid()`, `is_admin_of(...)` oppure `rate_dettaglio.utente_id = auth.uid()` con controllo anti-subentro su `bollettino_url`.
    - Nuova policy `rate_dettaglio_select` con vincolo `rate_testata.pubblicata = true` per tutti i profili non amministrativi.

#### [ALTO-03] Elaborazione coda email cross-tenant in `invia-coda-email`
- **Stato finale:** `RISOLTO IN CODICE` + `FIX SQL PRONTO IN supabase/da-applicare/14_coda_email_gmail.sql`
- **File modificati:**
  - `supabase/da-applicare/14_coda_email_gmail.sql`: aggiornata `claim_coda_email_batch(p_limit, p_condominio_id)` filtrando per `p_condominio_id` sia il recovery da `PROCESSING` sia il prelievo `PENDING`, con `REVOKE/GRANT` aggiornato sulla nuova firma.
  - `supabase/functions/invia-coda-email/index.ts`: passa obbligatoriamente `p_condominio_id` quando invocata da Admin (e filtra in uscita eventuali righe non coerenti prima del deploy SQL).

#### [ALTO-04] IDOR cross-condominio sul parametro `unita_id` in `notifiche-push`
- **Stato finale:** `RISOLTO IN CODICE`
- **File modificati:**
  - `supabase/functions/notifiche-push/index.ts`: verificati `condomini.attivo !== false` e appartenenza di `unitaTargetId` al `condominioId` autorizzato tramite join `unita_immobiliari -> palazzi` prima di risolvere i destinatari (restituendo `403` in caso di discrepanza e `400` se `unita_id` è malformato).

#### [ALTO-05] Auto-iscrizione arbitraria a stanze chat private, manipolazione costi/durata in `prenotazioni_spazi` e assenza vincoli cross-tenant padre-figlio
- **Stato finale:** `RISOLTO IN CODICE` + `FIX SQL PRONTO IN supabase/da-applicare/21_fix_sicurezza.sql`
- **File modificati:**
  - `supabase/da-applicare/21_fix_sicurezza.sql`:
    - `chat_partecipanti_insert`: limita l'auto-iscrizione alle sole stanze `GENERALE` del condominio o `PALAZZO` dell'edificio di appartenenza (`has_palazzo_access`), riservando stanze private all'admin.
    - `prenotazioni_spazi`: aggiunto vincolo `prenotazioni_spazi_costo_non_negativo`, trigger `trg_prenotazioni_spazi_server_enforce` (calcolo server-side di `costo_addebitato`, verifica `max_ore`, blocco cambio `risorsa_id`/`utente_id`), policy `prenotazioni_spazi_select` ristretta a titolare/admin e RPC `elenco_slot_prenotazioni(p_condominio_id)` che oscura `utente_id`, `utente_nome`, `utente_email` e `costo_addebitato` sugli slot dei vicini.
    - Trigger `trg_check_ambito_condominio()` applicato su `ticket_testata`, `bacheca_post`, `eventi_calendario`, `tabelle_millesimali`, `movimenti_fondo`, `preventivi_voci` e `bollettini_righe` per garantire la coerenza `condominio_id` padre-figlio.
  - `packages/data/src/prenotazioni/prenotazioniService.ts`: `elencoPrenotazioniCondominio` utilizza prioritariamente la RPC `elenco_slot_prenotazioni` con fallback compatibile pre-migrazione.

#### [ALTO-06] Bypass del Kill-Switch SaaS (`condomini.attivo = false`) per revisori / ex-amministratori
- **Stato finale:** `FIX SQL PRONTO IN supabase/da-applicare/21_fix_sicurezza.sql`
- **File modificati:**
  - `supabase/da-applicare/21_fix_sicurezza.sql`: aggiornata `public.has_readonly_audit_access(p_cond)` includendo la verifica `condomini.attivo = true` (mantenendo il solo accesso Super Admin in stato sospeso).

#### [ALTO-07] Debolezze nell'endpoint pubblico `fornitore-intervento` e nella gestione di `fornitori_tokens`
- **Stato finale:** `RISOLTO IN CODICE` + `FIX SQL PRONTO IN supabase/da-applicare/21_fix_sicurezza.sql`
- **File modificati:**
  - `packages/data/src/security/tokenCrypto.ts`: nuovo modulo privo di dipendenze `node:` con `generaTokenHex256()` basato su `crypto.getRandomValues` (zero `Math.random()`) e `sha256Hex()` / `sha256HexSync()`.
  - `packages/data/src/admin/manutenzioneService.ts` e `packages/data/src/services/ticketService.ts`: generazione token 256-bit via `generaTokenHex256()` e salvataggio su DB del solo digest SHA-256 (`url_magico: null`), restituendo URL/token in chiaro una tantum al chiamante.
  - `supabase/da-applicare/21_fix_sicurezza.sql`: aggiunta colonna `token_hash` con indice unico parziale, backfill SHA-256 sui record esistenti, trigger `trg_fornitori_tokens_before_insert` (normalizzazione hash e azzeramento `url_magico`) e RPC atomica `consuma_fornitore_token` (riservata a `service_role`).
  - `supabase/functions/fornitore-intervento/index.ts`: validazione formato token, rate limit per IP (`20 req/min`), lookup via digest SHA-256 (con fallback transitorio controllato), blocco se `condomini.attivo = false`, consumo atomico anti-TOCTOU prima della chiusura, validazione `Number.isFinite(importo_consuntivo)`, limite `note_fornitore <= 2000` e sanitizzazione rigorosa di `fattura_url` / `foto_lavoro_url` (solo `https://` validi o path Storage del `condominio_id` del ticket).

---

### MEDIO

#### [MEDIO-01] Bucket Storage `foto-guasti` e `avatar-utenti` pubblici in lettura anche per `anon`
- **Stato finale:** `FIX SQL PRONTO IN supabase/da-applicare/21_fix_sicurezza.sql`
- **File modificati:**
  - `supabase/da-applicare/21_fix_sicurezza.sql`: imposta `public = false` in `storage.buckets` per entrambi i bucket e restringe `foto_guasti_select` e `avatar_utenti_select` a `to authenticated` con isolamento per condominio (`has_cond_access` / `private.user_condomini`). Nessun uso di `getPublicUrl` nel codice applicativo (verificato sull'intero workspace).

#### [MEDIO-02] Esposizione di `details` tecnici Postgres nelle Edge Functions, enumerazione in `invita-utente`, difetti `accoda-email` e configurazione CORS/`config.toml`
- **Stato finale:** `RISOLTO IN CODICE`
- **File modificati:**
  - `supabase/functions/_shared/http.ts`: rimosso `details` dalla risposta JSON client in `serve()` (registrato solo nei log server/`log_errori`), sostituito CORS wildcard `'*'` con `corsHeadersFor(req)` basato su allowlist `APP_URL`/`ALLOWED_ORIGINS`/localhost + `Vary: Origin`.
  - `supabase/functions/invia-coda-email/index.ts`, `notifiche-push/index.ts`, `fornitore-intervento/index.ts`, `accoda-email/index.ts`, `ripartizione-spese/index.ts`, `sync-pagamenti/index.ts`: rimossi tutti i dettagli `error.message` SQL/Stripe dalle risposte `HttpError`.
  - `supabase/functions/invita-utente/index.ts`: risposta uniforme `{ ok: true }` per tutti i casi `email_exists` / `user_already_exists`, chiudendo l'oracolo `200` vs `502`.
  - `supabase/functions/accoda-email/index.ts`: aggiunto controllo `condomini.attivo !== false`, esclusione `BOZZA`/`ANNULLATO`/`RETTIFICATO` su `bollettini` e `BOZZA`/`ANNULLATA` su `assemblee_testata`, corretta la colonna `nome_denominazione` su `soggetti_contabili`.
  - `supabase/config.toml`: aggiunte dichiarazioni esplicite `[functions.accoda-email]` e `[functions.invia-coda-email]` con `verify_jwt = true`.

#### [MEDIO-03] Avvelenamento / DoS dei contatori di telemetria e nomi tabelle obsoleti in `15_telemetria_superadmin.sql`
- **Stato finale:** `FIX SQL PRONTO IN supabase/da-applicare/15_telemetria_superadmin.sql`
- **File modificati:**
  - `supabase/da-applicare/15_telemetria_superadmin.sql`: introdotto `batch_count` su `telemetria_utenti_ora` con rate limit atomico `120` batch/ora per utente e clamp abbassato a `500` unità per metrica per batch in `registra_telemetria_batch`; corretti i nomi tabella in `get_superadmin_dashboard_metriche` (`ticket_testata`, `assemblee_testata`, `documenti_metadata`).

#### [MEDIO-04] Query in background da schermate prive di `useAccessoConsentito()` in `display: 'none'`, trust ruolo in `pacchiService` e reset stato logout
- **Stato finale:** `RISOLTO IN CODICE`
- **File modificati:**
  - `apps/app/src/components/layout/AppShell.tsx` & `Header.tsx` & `apps/app/src/hooks/useNotifiche.ts`: esportato `useAppAttivo()` (attivo solo se profilo pronto, con ruoli e condominio non sospeso); `Header` disabilita `useNotifiche` quando `!appAttivo` e l'hook azzera subito lo stato al passaggio a `null`.
  - `apps/app/src/screens/AssistenzaScreen.tsx`, `NotificheScreen.tsx`, `ImpostazioniScreen.tsx`, `AltroScreen.tsx`: aggiunta guardia `useAppAttivo()` + `useAccessoConsentito()` (con split in componente `*Contenuto` per evitare `useEffect`/fetch a layout bloccato).
  - `apps/app/src/context/AuthContext.tsx`, `ProfiloContext.tsx`, `apps/app/src/app/(app)/_layout.tsx`: reset esplicito di profilo/preferenze/moduli su logout, rimozione `CHIAVE_PREFERENZE` in `signOut()` e `key={user?.id ?? 'anon'}` su `ProfiloProvider`.
  - `packages/data/src/pacchi/pacchiService.ts`: rimossi gli shortcut basati su parametri client `opzioni.isPortiereOAdmin` / `opzioni.ruoli` e il match permissivo `!cid`; verifica esclusiva lato DB sul `condominioId` target.

#### [MEDIO-05] File di sessione presente nel repository non escluso da `.gitignore` e vulnerabilità npm nella catena Expo
- **Stato finale:** `RISOLTO IN CODICE` (file sessione rimosso e `.gitignore` aggiornato; dipendenze aggiornate senza `--force` da `10` a `3 moderate`)
- **Azioni eseguite:**
  - Rimosso `scripts/session-portiere.json` dal workspace e aggiunto `scripts/session-*.json` a `.gitignore`.
  - Previa conferma dell'utente, eseguito `npm audit fix` (senza `--force`) su workspace locale: risolte **7 vulnerabilità su 10** (eliminate le **2 high** su `zod` e le vulnerabilità su `node-forge` e `glob`).
  - Residuo non-breaking tracciato in `npm audit --omit=dev`: **3 `moderate`** su `minimatch` (`GHSA-g3hv-75wg-m249`) dentro `@expo/fingerprint` -> `expo` (risolvibili solo con `expo@52.0.49` breaking, in attesa di fix upstream Expo 58).

---

### BASSO

- **[BASSO-01] `RISOLTO IN CODICE` — HTML non sanitizzato nel codice legacy inutilizzato `useRataPayment`:** verificata l'assenza di qualsiasi import nel monorepo e rimosso definitivamente il file `apps/app/src/hooks/useRataPayment.ts`.
- **[BASSO-02] `RISOLTO IN CODICE` — Edge case validatori e chiamanti `Linking.openURL`:**
  - `validaChiusuraTicket` (`packages/data/src/admin/manutenzioneLogic.ts`) usa ora `Number.isFinite` + regex numerica rigorosa `^\d+(?:\.\d{1,2})?$`.
  - `parseValoreMillesimale` (`packages/data/src/admin/strutturaLogic.ts`) controlla `!Number.isFinite(num)`.
  - `validaModificaNumeroEmergenza` (`packages/data/src/assistenza/assistenzaLogic.ts`) impone formato telefonico valido con almeno 2 cifre e vieta schemi URL; `AssistenzaScreen.tsx` valida `tel:`/`mailto:` prima di `Linking.openURL`; `SuperAdminFattureScreen.tsx` consente solo URL `https://` privi di credenziali prima di `Linking.openURL`.
- **[BASSO-03] `RISOLTO IN CODICE` — Offuscamento parziale log client e `nome_file` DB:**
  - Estratto helper condiviso `oscuraTestoSensibile` in `packages/data/src/security/redact.ts` (usato da `apps/app/src/lib/logErrori.ts`), estendendo il masking a UUID, token esadecimali (`>= 32` hex) e intestazioni `Bearer ...`.
  - Aggiunta sanitizzazione `sanitizzaNomeFileDb` e validazione client `validaUploadDocumento` (estensioni consentite, MIME consentiti e limite 50 MB) in `packages/data/src/admin/documentiAdminService.ts`.
- **[BASSO-04] `RISOLTO IN CODICE` — `JSON.parse` non protetto da `try/catch`:** aggiunto helper `parsePreferenzeSafe` in `apps/app/src/app/(pubblico)/_layout.tsx` resistente a `localStorage` corrotto.
- **[BASSO-05] `RISOLTO IN CODICE` + `FIX SQL PRONTO IN supabase/da-applicare/21_fix_sicurezza.sql e 22_fix_security_advisors.sql` — Dati catastali al Portiere:** creata la vista `public.unita_portineria` priva di colonne catastali/mq (`security_invoker = true`, `security_barrier = true` tramite `unita_portineria_visibili()`) e ristretta `unita_immobiliari_select` al solo `is_superadmin() or has_unita_access(id)`; aggiornato `packages/data/src/pacchi/pacchiService.ts` per leggere `unita_portineria` (con fallback sicuro su DB pre-migrazione senza mai selezionare campi catastali).

---

## 3. Esito Test Negativi & Guardie Verificate (post-fix in locale)

### 3.1 Suite difensiva ampliata (`packages/data/src/__tests__/securityNegative.test.ts`)
Risultato diretto ultima esecuzione: **`23/23` test superati (`0` fallimenti)** su 4 suite, coprendo sia le verifiche dell'audit iniziale sia tutti i nuovi fix:
- Sanitizzazione HTML email (`escapeHtml`, 3 template server/client) e rimozione `[\r\n\0]` negli oggetti e in `isEmailValida`.
- Path traversal Storage, open redirect (`safeReturnPath`), link onboarding/recovery (`readPasswordLink`), encoding magic link (`generaUrlMagicLink`).
- Blocco di `Infinity`, `NaN`, notazione scientifica `12e5`, importi negativi/zero e schemi URL `javascript:`/`https://` su `validaChiusuraTicket`, `parseValoreMillesimale`, `validaModificaNumeroEmergenza`.
- Blocco `.exe`/HTML/`text/html`/file vuoti/file `> 50 MB` e sanificazione `nome_file` DB in `validaUploadDocumento` / `sanitizzaNomeFileDb`.
- Entropia crittografica 256-bit CSPRNG, vettori NIST SHA-256 (`sha256Hex`, `sha256HexSync`), e salvataggio su `fornitori_tokens` del solo digest SHA-256 (`url_magico: null`) in `manutenzioneService`.
- Risoluzione utenti Super Admin tramite RPC `risolvi_utente_verificato_da_email` (fail-closed pre-migrazione `21`).
- Rimozione trust su flag client/ruoli null in `pacchiService`, utilizzo vista `unita_portineria` senza colonne catastali, e mascheramento slot `prenotazioniService` via `elenco_slot_prenotazioni`.
- Offuscamento log client (`oscuraTestoSensibile`: email, Bearer, JWT, UUID, token hex >=32, IBAN, numeri >=7 cifre).

### 3.2 Verifica UI Guardie & Isolamento Ruoli su build statica aggiornata (Edge `channel: 'msedge'`)
Esito dopo export aggiornato `apps/app/dist` (`expo export -p web`, 3205 moduli, inclusi `/superadmin/telemetria` e `/superadmin/log`):

| Scenario | Route testate | Esito post-fix osservato | Note di verifica |
| :--- | :--- | :--- | :--- |
| **Utente non autenticato** | `/admin/dashboard`, `/admin/moduli`, `/pacchi`, `/superadmin/amministratori`, `/superadmin/piani-abbonamenti`, `/superadmin/fatture`, `/superadmin/telemetria`, `/superadmin/log` | **BLOCCATO (8/8)** — Redirect a `/login?redirect=...`, **0** chiamate REST | Anche `/superadmin/telemetria` e `/superadmin/log` instradati correttamente e reindirizzati. |
| **Condòmino puro (`CONDOMINO`)** | `/admin/dashboard`, `/admin/moduli`, `/superadmin/amministratori`, `/superadmin/piani-abbonamenti`, `/superadmin/fatture`, `/superadmin/telemetria`, `/superadmin/log` | **BLOCCATO (7/7)** — `blockedUi: true`, `unmatchedInStaleDist: false`, **0** chiamate a tabelle protette, **0** mutazioni | Su `/pacchi` i pulsanti portineria risultano assenti (`pacchiHasPortiereControls: false`). |
| **Portiere puro (`PORTIERE`)** | `/admin/moduli`, `/superadmin/amministratori`, `/spese`, `/pagamenti` | **BLOCCATO (4/4)** — `blockedUi: true` | Bloccate le viste contabili e amministrative. |
| **Condominio sospeso (`attivo: false`)** | `/assistenza`, `/notifiche`, `/impostazioni` | **BLOCCATO (3/3)** — UI `"Servizio momentaneamente sospeso"`, **0** query di background su `notifiche`, `polizze_assicurative`, `fornitori` | Risolto `[MEDIO-04]`: osservate solo le chiamate di bootstrap profilo (`utenti`, `ruoli_piattaforma`, `utente_entita_ruolo`, `condomini`). |
| **Utente senza ruoli (`NESSUNO`)** | `/admin/dashboard` | **BLOCCATO** — `"Account non ancora attivo"`, **0** query verso `notifiche` | Risolto `[MEDIO-04]` anche in `Header`. |

### 3.3 Esito reale comandi monorepo post-fix (dopo tutte le modifiche ed `npm audit fix`)
*(Nota sandbox Windows: i comandi `turbo` sono stati eseguiti con `--no-cache` per il permesso di scrittura locale cache `.turbo`; risolti anche tutti gli errori TypeScript e unit test preesistenti in `Select.tsx`, `codaEmailLogic.test.ts`, `tokens.test.ts`, `SettimanaRaccolta.tsx`, `logErrori.ts`, `AdminStrutturaScreen.tsx`.)*

- **`npx turbo run typecheck --no-cache`**: **`9 successful, 9 total`** — **SUPERATO (`0` errori)** in `@iocondo/shared-types`, `@iocondo/ui`, `@iocondo/supabase-client`, `@iocondo/data`, `@iocondo/app`.
- **`npx turbo run lint --no-cache`**: **`5 successful, 5 total`** — **SUPERATO (`0` errori)**.
- **`npx turbo run test --no-cache`**: **`7 successful, 7 total`** — **SUPERATO (`533/533` test totali, `0` fallimenti, `0` saltati)**:
  - `@iocondo/ui`: **`59/59`** superati (`0` fallimenti; incluso `tokens.test.ts`).
  - `@iocondo/supabase-client`: **`4/4`** superati (`0` fallimenti).
  - `@iocondo/data`: **`470/470`** superati (`0` fallimenti; inclusi `codaEmailLogic.test.ts`, `pacchiService.test.ts`, `prenotazioniService.test.ts` e `23/23` di `securityNegative.test.ts`).
- **`npm audit --omit=dev`**: **3 vulnerabilità moderate** residue (`minimatch` in `@expo/fingerprint` -> `expo`; `0` critiche, `0` alte).

---

## 4. Stato Remoto Verificato e Ultimi Passi Operativi prima della Messa Online

Verifica live in sola lettura eseguita su `IoCondo - PROD` (`hhumsgeitajvmqmrtthh`):

1. **Edge Functions — `9/9` ALLINEATE AL 100% CON IL CODICE LOCALE (`ALL_EDGE_FUNCTIONS_MATCH: true`):**
   - Verificate online tutte le funzioni (`invia-email` `v29`, `invia-coda-email` `v6`, `accoda-email` `v6`, `fornitore-intervento` `v38`, `notifiche-push` `v38`, `invita-utente` `v38`, `ripartizione-spese` `v38`, `sync-pagamenti` `v38`, `elimina-account` `v9`): sia `<slug>/index.ts` sia `_shared/http.ts`, `_shared/auth.ts` ed `_shared/email.ts` coincidono hash per hash con i file locali, e `verify_jwt` è coerente con `supabase/config.toml`.
2. **Database PostgreSQL — `8/8` migrazioni applicate (`07`, `09`, `11`, `14`, `15`, `20`, `21`, `22`) e `0` errori Advisor:**
   - Verificate presenti e attive su PROD tutte le difese di `07`, `09`, `11`, `14`, `15`, `20`, `21`, `22` (incluse le 5 colonne su `configurazioni_condominio`, `claim_coda_email_batch(integer, uuid)`, `token_hash` con `0` record scoperti, trigger `trg_utenti_protect_sensitive`, bucket privati `foto-guasti`/`avatar-utenti`, `4` policy `storage.objects`, `public.unita_portineria` con `{security_invoker=true,security_barrier=true}` via `unita_portineria_visibili()`, `search_path=public` su `audit_campo_riservato` e `audit_pulisci`, revoca `EXECUTE` ad `anon` su `guard_condomini_attivo`, `has_palazzo_access` e `has_scala_access`).
   - Verifica `get_advisors` (`security`): **`0 ERROR`**, **`0` `function_search_path_mutable`**, **`0` `anon_security_definer_function_executable`**; restano solo `49` avvisi `authenticated_security_definer_function_executable` (helper RLS/viste e RPC per utenti autenticati) e `1` `WARN auth_leaked_password_protection`.
3. **Configurazioni Dashboard Supabase:**
   - **Edge Functions -> Secrets**: verificare/impostare `APP_URL` ed eventualmente `ALLOWED_ORIGINS` (separati da virgola) se il frontend web di produzione usa un dominio diverso da `https://app.iocondo.it` / `https://iocondo.it`.
   - **Authentication -> Password Security**: attivare **Leaked Password Protection (HaveIBeenPwned)** ancora segnalata da `get_advisors` (`WARN auth_leaked_password_protection`).
4. **Monitoraggio dipendenze Expo (`3 moderate` residue):**
   - Mantenere `minimatch` sotto osservazione fino a un aggiornamento compatibile di `expo` / `@expo/fingerprint` nella serie `58.x` (non usare `npm audit fix --force`, che farebbe il downgrade a `expo@52.0.49`).
5. **Controllo git e build finale web:**
   - Prima di un eventuale commit, verificare con `git status` che nessun file `scripts/session-*.json` risulti tracciato.
