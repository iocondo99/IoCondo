# Audit End-to-End — Ruolo Amministratore (`ADMIN`)

Data audit: 16 novembre 2026  
Ambiente verificato:
- **App Web Live**: `https://io-condo-nine.vercel.app` (accesso con account multi-ruolo `ADMIN` / `CONDOMINO` / `PORTIERE`, Playwright su desktop 1280px e mobile 390px)
- **Qualità tecnica locale**: `npm run test --workspace=@iocondo/data` (447 test in 96 suite: **447 passati, 0 falliti**), `npm run lint --workspace=@iocondo/app` (`tsc --noEmit`: **0 errori**), `npm run typecheck` sui pacchetti `@iocondo/shared-types`, `@iocondo/data`, `@iocondo/app` (**0 errori**).
- **Nota su `prompts/12_ruolo_condomino.md`**: il file risulta attualmente vuoto (0 byte), pertanto l'audit operativo è stato eseguito sul ruolo Amministratore come specificato in `prompts/12_ruolo_amministratore.md`.

---

## 1. Verdetto rapido

- **Cosa è pronto per la produzione (lato codice applicativo)**:
  - L'intera area Amministratore (`/admin/*`) è completa, coerente con il Design System (`DESIGN_SYSTEM.md`), priva di errori console o HTTP 4xx/5xx nelle schermate principali testate live (`/admin/dashboard`, `/admin/struttura`, `/admin/contabilita`, `/admin/manutenzione`, `/admin/coda-email`, `/admin/moduli`, `/admin/struttura/tabelle-millesimali/nuova`), e **senza overflow orizzontale** sia su desktop (1280px) che su smartphone (390px).
  - Separazione delle responsabilità (SoC) rispettata: logica pura e testata in `@iocondo/data`, componenti React Native puri in `@iocondo/ui`, guardie `GuardiaVista` e `GuardiaModulo` funzionanti.
  - Flussi chiave completi nel codice: Struttura & Tabelle millesimali (pagina dedicata `/admin/struttura/tabelle-millesimali/nuova` e `[id]` + import CSV), Contabilità multi-tab con ripartizioni, incassi FIFO, morosità e rendiconto, Assemblee in presenza, Comunicazioni, Manutenzione/Fornitori con Magic Link, Drive Documenti con URL firmati, Feature Toggle per condominio/palazzo, Notifiche in-app (`public.notifiche`) e accodamento email (`accoda-email`).
- **Cosa NON è ancora pronto per la produzione**:
  - **Dipendenze manuali su Supabase**: diverse migrazioni SQL in `supabase/da-applicare/` (tra cui `10`..`16`) e le Edge Functions (`invita-utente`, `accoda-email`, `invia-coda-email`) + secrets Resend non risultano ancora deployate/verificate in produzione.
  - **Dati storici/residui sul DB di collaudo**: su `/admin/dashboard` compare ancora la dicitura `"e collegamento Google Meet"` nel luogo di un'assemblea di prova già presente nel database.
  - **Funzionalità accessorie ancora disabilitate o da completare**: la barra di ricerca globale nell'header è disabilitata (`"Cerca, non ancora disponibile"`), il titolo browser (`app.json` -> `"IoCondo — Condòmino & Portiere"`) non si adatta al ruolo Amministratore, e mancano link/azioni per la creazione autonoma di un nuovo condominio da parte dell'Amministratore (attualmente gestito via Super Admin / DB).

---

## 2. Matrice Funzionalità Amministratore

| Modulo | Stato | Note tecniche e file coinvolti |
| --- | --- | --- |
| **Accesso, Onboarding & Stato Abbonamento** | `OK` | Login reale funzionante su `io-condo-nine.vercel.app`, selettore condominio e cambio vista (`ADMIN` / `RESIDENTE`), blocco `condominioSospeso` in `AppShell.tsx` e `GuardiaVista.tsx`, isolamento `/superadmin/*`. Richiede migrazione `13_superadmin_saas_sospensione.sql` e deploy Edge Function `invita-utente`. |
| **Dashboard & Panoramica Admin** | `OK` | Dati reali da DB (`Saldo cassa`, `Riscossione rate`, `Ticket guasti aperti`, `Prossima assemblea`), link rapidi e campanella notifiche attivi (`AdminDashboardScreen.tsx`, `adminDashboardService.ts`). Un dato di prova in DB contiene ancora testo `"Google Meet"`. |
| **Struttura, Palazzi, Unità & Tabelle Millesimali** | `OK` | Albero Palazzi -> Scale/Colonne -> Unità, anagrafiche/subentri, inviti (`/admin/inviti`), creazione/modifica **a pagina completa** delle tabelle millesimali (`/admin/struttura/tabelle-millesimali/nuova` e `[id]`) + import CSV con quadratura 1000‰ (`AdminStrutturaScreen.tsx`, `AdminEditorTabellaMillesimaleScreen.tsx`). |
| **Contabilità, Spese, Ripartizione & Bollettini** | `PARZIALE` | Codice completo in `AdminContabilitaScreen.tsx` e `contabilitaService.ts` (5 tab: Registro & Spese, Preventivi & Rate, Bollettini & Incassi FIFO, Morosità & Recupero, Rendiconto). All'emissione rate inserisce `public.notifiche` (`contabilitaService.ts:998`) e chiama `services.codaEmail.accodaEmail` (`AdminContabilitaScreen.tsx:1142`). Stato `PARZIALE` in produzione finché non vengono applicate `10_contabilita_schema_modello_obiettivo.sql`, `14_coda_email_resend.sql` e il deploy Resend. |
| **Comunicazioni, Assemblee & Notifiche/Email** | `PARZIALE` | `AdminComunicazioniScreen.tsx` (`comunicazioniAdminService.ts:236`) e `AdminAssembleeScreen.tsx` / `AdminAssembleaDettaglioScreen.tsx` (`assembleeAdminService.ts:750`) generano sia righe in `public.notifiche` sia chiamate `accodaEmail`. `/admin/coda-email` (`AdminCodaEmailScreen.tsx`) è operativo lato UI; invio email reale subordinato a `14_coda_email_resend.sql` e deploy Edge Functions + Resend. |
| **Segnalazioni (ex Ticket / Aree Comuni)** | `OK` | Modello unificato ad ambiti condivisi (`CONDOMINIO`, `PALAZZO`, `SCALA`) senza ticket privati 1-a-1; gestione fornitori e Magic Link su `/admin/manutenzione` (`AdminManutenzioneScreen.tsx`). Richiede `12_ticket_ambiti_comuni.sql` sul DB reale. |
| **Gestione Moduli / Feature Toggle** | `OK` | `/admin/moduli` (`AdminModuliScreen.tsx`) gestisce toggle per condominio e override per palazzo con salvataggio ottimistico, rollback su errore e sincronizzazione reattiva via `ProfiloContext` + `GuardiaModulo`. Richiede `11_moduli_condominio_estesi.sql` per i 5 moduli estesi. |
| **Servizi Condominiali & Assistenza** | `OK` | Raccolta differenziata (`/admin/raccolta-differenziata`), Spazi comuni (`/admin/prenotazioni`), Documenti/Drive con link firmati 600s (`/admin/documenti`), Impostazioni (`/admin/impostazioni`) senza sezione appartamento per l'admin, Assistenza (`/admin/assistenza`) con card a tutta larghezza e modifica titolo/numero/visibilità (richiede `16_assistenza_numeri_personalizzati.sql`). |
| **Qualità UI/UX & Tecnica (Desktop + Mobile)** | `OK` | 447/447 test unitari verdi, `tsc --noEmit` verde, 0 errori console sulle pagine admin visitate, 0 risposte HTTP 4xx/5xx su `/admin/contabilita` e rotte principali, nessun overflow orizzontale a 1280px e 390px. |

---

## 3. Problemi trovati ordinati per gravità

### `CRITICO`
1. **Invio email massivo e inviti reali non ancora attivi lato infrastruttura Supabase/Resend**:
   - Il codice client chiama correttamente `accoda-email` e `invita-utente`, ma finché non vengono applicate le migrazioni (`14_coda_email_resend.sql`, `08_inviti_sicuri.sql`) ed eseguito il deploy delle Edge Functions con `RESEND_API_KEY` e dominio verificato, l'amministratore non può inviare email né invitare nuovi utenti reali in produzione.
2. **Allineamento schema DB in sospeso (`supabase/da-applicare/`)**:
   - Le funzionalità estese di contabilità (`10`), feature toggle estesi (`11`), ticket ad ambiti comuni (`12`), sospensione SaaS (`13`), coda email (`14`), telemetria (`15`) e personalizzazione card assistenza (`16`) dipendono da script SQL non ancora applicati sull'istanza Supabase di produzione.

### `MEDIO`
1. **Errore 400 su refresh token al primo caricamento di `/login`**:
   - All'apertura di `https://io-condo-nine.vercel.app/login` è stato rilevato 1 errore console (`400` su `/auth/v1/token?grant_type=refresh_token`) dovuto a un eventuale token di sessione residuo/scaduto nel browser prima del login.
2. **Dati di prova con residui obsoleti su DB live**:
   - Nella Dashboard live (`/admin/dashboard`), la card *Prossima assemblea* mostra ancora `"Straordinaria · Sala Riunioni Piano Terra e collegamento Google Meet"`, nonostante le assemblee siano state convertite esclusivamente in presenza fisica.
3. **Creazione nuovo condominio non esposta all'Amministratore**:
   - Nel PRD (§ 2) l'Amministratore può creare condomini, mentre nell'app attuale i condomini vengono creati/associati lato Super Admin o seed SQL.

### `MIGLIORIA`
1. **Titolo documento web statico**:
   - Tutte le rotte Admin mostrano nel `<title>` del browser `"IoCondo — Condòmino & Portiere"` (derivato da `apps/app/app.json`), invece di `"IoCondo"` o un titolo dinamico per vista/pagina.
2. **Barra di ricerca globale nell'Header disabilitata**:
   - Il campo di ricerca in alto (`"Cerca, non ancora disponibile"`) è visibile ma `disabled`: rimuoverlo finché non è implementato o collegarlo alla ricerca rapida migliorerebbe la pulizia dell'header.
3. **Script di deploy statico Vercel (`vercel.json`)**:
   - Come segnalato in `docs/PIANO_LAVORO.md`, verificare che `vercel.json` resti allineato all'export statico Expo (`expo export --platform web`, output `dist`, rewrite SPA) per evitare regressioni ai futuri push.

---

## 4. Dipendenze manuali aperte

File in `supabase/da-applicare/` e configurazioni esterne da eseguire manualmente a cura dell'utente:
- **Migrazioni SQL da applicare/verificare nell'SQL Editor di Supabase**:
  - `07_revoke_execute_funzioni_definer.sql`
  - `08_inviti_sicuri.sql` e `08a_fix_trigger_e_ruoli.sql`
  - `09_assemblee_voti_admin.sql` e `09_fix_documenti_rls.sql`
  - `10_contabilita_schema_modello_obiettivo.sql`
  - `11_moduli_condominio_estesi.sql`
  - `12_ticket_ambiti_comuni.sql`
  - `13_superadmin_saas_sospensione.sql`
  - `14_coda_email_resend.sql`
  - `15_telemetria_superadmin.sql`
  - `16_assistenza_numeri_personalizzati.sql`
- **Edge Functions & Secrets Supabase**:
  - Deploy di `invita-utente`, `accoda-email`, `invia-coda-email`.
  - Configurazione Secrets: `RESEND_API_KEY`, `RESEND_SENDER_DOMAIN`, `APP_URL`, Redirect URLs Auth (`/imposta-password`, `/reimposta-password`) e verifica dominio DNS su Resend.

---

## 5. Prossimi 5 passi consigliati (in ordine di priorità)

1. **Applicare e verificare su Supabase le migrazioni pendenti** (`10` → `16`, partendo da contabilità, moduli, ticket ambiti, sospensione SaaS, coda email e assistenza) usando i relativi script `*_verifica.sql`.
2. **Completare il deploy delle Edge Functions e di Resend** (`invita-utente`, `accoda-email`, `invia-coda-email`, secrets e dominio verificato) per sbloccare inviti ed email reali da bollettini, comunicazioni e assemblee.
3. **Pulire i dati di prova obsoleti su Supabase** (es. rimuovere `"e collegamento Google Meet"` dall'assemblea di prova) e verificare i bucket privati (`documenti-condominio`, `foto-guasti`, `avatar-utenti`).
4. **Rifinire i dettagli UX web segnalati**: titolo `<title>` neutro/dinamico (`IoCondo`) e rimozione/attivazione della barra di ricerca disabilitata nell'header.
5. **Compilare `prompts/12_ruolo_condomino.md`** (attualmente vuoto) ed eseguire l'audit end-to-end speculare sul ruolo **Condòmino & Portiere** su `https://io-condo-nine.vercel.app`.
