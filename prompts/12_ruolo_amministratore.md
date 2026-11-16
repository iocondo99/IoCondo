Immedesimati al 100% in un **Amministratore di Condominio** reale che usa IoCondo tutti i giorni e conduci un audit completo end-to-end di tutta l'esperienza Amministratore.
**Non modificare codice applicativo**: il tuo obiettivo è verificare cosa funziona bene, cosa è incompleto, cosa è rotto e cosa manca, salvando il report finale in `docs/AUDIT_RUOLO_AMMINISTRATORE.md`.

Prima di iniziare, leggi `AGENTS.md`, `DESIGN_SYSTEM.md`, `docs/PIANO_LAVORO.md`, `docs/PRD.md` (per i requisiti attesi) e controlla l'elenco dei file in `supabase/da-applicare/` per distinguere eventuali bug di codice da migrazioni SQL non ancora applicate.

### Cosa devi verificare passo dopo passo (come Amministratore)
1. **Accesso, Onboarding & Stato Abbonamento**:
   - Login, selezione/cambio condominio attivo, blocco se il condominio è sospeso dal Super Admin, permessi (nessun accesso a funzioni Super Admin).
2. **Dashboard & Panoramica Admin**:
   - Coerenza dati reali (niente numeri demo/mock), link rapidi, campanella notifiche.
3. **Struttura, Palazzi, Unità & Tabelle Millesimali**:
   - Gestione palazzi/scale/unità, anagrafiche condòmini e inviti.
   - Creazione manuale **pagina completa** delle tabelle millesimali (non modale), importazione, modifica e validazione somme/quote.
4. **Contabilità, Spese, Ripartizione & Bollettini**:
   - Inserimento spese/fatture, ripartizione su millesimi, emissione bollettini/rate, riconciliazione/stato pagamenti.
   - Verifica che all'emissione bollettini vengano create sia la **notifica in-app (`public.notifiche`)** sia l'eventuale **coda email Gmail**.
5. **Comunicazioni, Assemblee & Notifiche/Email**:
   - Pubblicazione comunicazioni (per tutto il condominio o per singolo palazzo/scala), flag "Importante" -> notifica in-app + email.
   - Creazione e convocazione assemblee, ordine del giorno, deleghe, votazioni/verbale -> notifica in-app + email.
   - Eventuale log coda email e gestione mittente.
6. **Segnalazioni (ex Ticket / Aree Comuni)**:
   - Verifica che i vecchi ticket privati 1-a-1 e la vecchia sezione Aree Comuni siano stati rimossi/sostituiti correttamente dal solo flusso **Segnalazioni** visibile ai ruoli pertinenti (con filtro corretto per scala/palazzo vs area comune).
7. **Servizi Condominiali & Impostazioni**:
   - **Gestione Moduli / Toggle schermate**: attiva/disattiva moduli e verifica che abbiano effetto reale su UI e servizi.
   - Raccolta differenziata, prenotazione spazi comuni, documenti/drive, portineria/fornitori, numeri di assistenza/emergenza.
8. **Qualità UI/UX & Tecnica (Web Desktop + Mobile)**:
   - Verifica `npm run typecheck`, `npm run lint`, `npm run test`.
   - Se possibile avvia l'app e verifica con Playwright su **Edge (`channel: 'msedge'`)** (senza scaricare browser e senza dati finti) almeno navigazione, console errors, errori HTTP 4xx/5xx, contrasto/layout desktop e smartphone.

### Output richiesto (`docs/AUDIT_RUOLO_AMMINISTRATORE.md`)
Scrivi il file `docs/AUDIT_RUOLO_AMMINISTRATORE.md` organizzato in:
1. **Verdetto rapido**: cosa è pronto per la produzione e cosa no.
2. **Matrice Funzionalità Amministratore** (Modulo | Stato: `OK` / `PARZIALE` / `ROTTO` / `MANCANTE` | Note tecniche e file coinvolti).
3. **Problemi trovati ordinati per gravità**:
   - `CRITICO` (blocca il lavoro dell'amministratore o causa errori dati/permessi)
   - `MEDIO` (funziona a metà, UX confusa, mancanza di feedback/validazioni)
   - `MIGLIORIA` (rifiniture utili)
4. **Dipendenze manuali aperte** (es. SQL in `supabase/da-applicare/` o Edge Functions/Secrets ancora da deployare).
5. **Prossimi 5 passi consigliati** in ordine di priorità.