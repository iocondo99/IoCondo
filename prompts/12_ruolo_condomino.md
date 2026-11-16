Immedesimati al 100% in un **Condòmino** reale (proprietario o inquilino, ad esempio residente nella Scala A di un condominio con più scale/palazzi) che usa la web app IoCondo da smartphone e da desktop.
**Non modificare codice applicativo**: il tuo obiettivo è verificare cosa funziona bene, cosa è confuso/incompleto, cosa è rotto e se esistono buchi di visibilità/permessi, salvando il report finale in `docs/AUDIT_RUOLO_CONDOMINO.md`.

Prima di iniziare, leggi `AGENTS.md`, `DESIGN_SYSTEM.md`, `docs/PIANO_LAVORO.md`, `docs/PRD.md` (per i requisiti attesi) e controlla `supabase/da-applicare/` per distinguere eventuali bug di codice da migrazioni SQL non ancora applicate.

### Cosa devi verificare passo dopo passo (come Condòmino)
1. **Accesso, Primo Ingresso & Sicurezza/Isolamento**:
   - Login, comportamento se il condominio è disabilitato/sospeso dal Super Admin, comportamento con più unità/condomini.
   - **Privacy & Sicurezza**: verifica che il condòmino NON veda schermate/azioni di Amministratore, Portiere o Super Admin (anche provando URL diretti) e NON veda dati privati/pagamenti di altri condòmini.
2. **Home & Campanella Notifiche**:
   - Riepilogo Home reale (nessun dato finto/hardcoded), contatore notifiche non lette, apertura notifica -> passaggio a `letta = true`, pagina archivio notifiche.
   - Verifica che arrivino le notifiche per **Comunicazioni**, **Assemblee** e **Bollettini emessi**.
3. **Pagamenti, Bollettini & Situazione Contabile**:
   - Visualizzazione bollettini/rate della propria unità, stato pagato/da pagare/scaduto, dettaglio spese/ripartizioni, eventuale download ricevuta/documento.
4. **Assemblee**:
   - Visualizzazione convocazioni, ordine del giorno, allegati, deleghe, votazioni/presenza (se previste), stato post-assemblea/verbale.
5. **Comunicazioni (Bacheca)**:
   - Visibilità corretta: comunicazioni generali + comunicazioni del proprio palazzo/scala, NESSUNA comunicazione destinata solo ad altri palazzi/scale. Lettura dettaglio e aggiornamento stato letto.
6. **Segnalazioni**:
   - Apertura di una segnalazione (es. lampadina fulminata Scala A / cancello rotto area comune).
   - **Verifica isolamento scale/palazzi**: una segnalazione di Scala A deve essere visibile a Scala A (e non a Scala B); una segnalazione di Area Comune visibile a tutti; nessun residuo di ticket privati 1-a-1 o vecchia sezione Aree Comuni.
7. **Altri Servizi & Toggle Moduli**:
   - Raccolta differenziata, prenotazione spazi comuni, documenti/drive, portineria/pacchi (se attiva), numeri utili/assistenza, profilo personale.
   - Verifica che se l'amministratore spegne un modulo dai Toggle, la voce sparisca davvero anche lato Condòmino.
8. **Esperienza Mobile & Web (Responsive + Accessibilità)**:
   - Verifica `npm run typecheck`, `npm run lint`, `npm run test`.
   - Se possibile avvia l'app e verifica con Playwright su **Edge (`channel: 'msedge'`)** sia a larghezza desktop sia a larghezza smartphone (barra inferiore, nessun testo tagliato, nessun errore in console o rete 4xx/5xx).

### Output richiesto (`docs/AUDIT_RUOLO_CONDOMINO.md`)
Scrivi il file `docs/AUDIT_RUOLO_CONDOMINO.md` organizzato in:
1. **Verdetto rapido**: l'app è pronta per essere consegnata a un condòmino vero?
2. **Matrice Funzionalità Condòmino** (Schermata/Flusso | Stato: `OK` / `PARZIALE` / `ROTTO` / `MANCANTE` | Note UX/tecniche e file coinvolti).
3. **Controllo Privacy & Permessi** (cosa è protetto da RLS + UI e eventuali falle trovate).
4. **Problemi trovati ordinati per gravità** (`CRITICO`, `MEDIO`, `MIGLIORIA`).
5. **Prossimi 5 passi consigliati** prima del rilascio ai condòmini.