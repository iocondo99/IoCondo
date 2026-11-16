# Audit Usabilità, Layout Responsive e Funzionamento Mobile — IoCondo

Data audit: **16 novembre 2026**  
Ambiente testato: **`https://io-condo-nine.vercel.app/`** (build web Expo / React Native Web)  
Browser: **Microsoft Edge** (Playwright `channel: 'msedge'`)  
Viewport smartphone testate: **`390 x 844`** (iPhone standard) e **`360 x 800`** (Android compatto)

---

## 1. Riepilogo esecutivo

| Ruolo / Vista | Stato Mobile | Sintesi |
| :--- | :--- | :--- |
| **Condòmino** | **CON PROBLEMI** | Nessun errore runtime/console né errori HTTP `4xx/5xx`; buona tenuta di `AppLayout` e della bottom bar. Presenti però difetti reali su `MobileDataList` senza `onPress` (`/prenotazioni`, `/spese/[id]`), sul pulsante `Indietro` di `PageHeader` che sporge di `-5px` a sinistra nelle pagine di dettaglio, su `ModalActions` annidati nei `children` in `AssistenzaScreen` e sull'altezza `40px` (`< 44px`) di `SearchBar`. |
| **Portiere** | **CON PROBLEMI** | Condivide la vista `Condòmino e portiere`; la schermata chiave `/pacchi` soffre del bug di layout orizzontale di `MobileDataList` quando `onPress` è assente (le righe `Data arrivo` e successive sbordano fino a `right: 580px`). |
| **Amministratore** | **CON PROBLEMI** | Nessun errore console/HTTP, ma presenti criticità importanti su mobile: **pulsanti di conferma/annulla fuori viewport** nella modale `Convoca nuova assemblea` e `Nuova segnalazione` (`ModalActions` inserito nei `children` anziché nella prop `actions`), **tabella presenze e pulsanti non responsive** in `/admin/assemblee/[id]`, **pulsante da `445px`** in `/admin/inviti`, **`FilterChips` che sbordano oltre `600px`** in `/admin/struttura` e `/admin/comunicazioni`, e badge `Migrazione 11` che sborda a `360px` in `/admin/moduli`. |

### Verifiche trasversali (stabilità & regole `AGENTS.md` / `DESIGN_SYSTEM.md`)
- **Stabilità runtime (`390x844` e `360x800`)**: `0` `console.error`, `0` `pageerror`, `0` chiamate HTTP `4xx/5xx`.
- **`<ScrollView>` annidati dentro `<Modal>`**: **CONFORME (0 violazioni)** — verificato sia staticamente su tutti i `.tsx` sia a runtime; l'unica rilevazione di `2` contenitori scrollabili in modali con `<Textarea>` deriva dal `<textarea>` nativo e non da un `ScrollView` annidato.
- **Bottom bar (`MobileNavigation`)**: **CONFORME** — verificato programmaticamente con scroll fino in fondo su `/altro` (`360x800`): `navTop: 735px`, ultimo pulsante (`Esci dall’account`) `bottom: 719px`, nessuna copertura.
- **Header mobile, Campanella Notifiche, Cambio Vista (`Altro`)**: **CONFORMI** — `NotificationPanel`, dropdown profilo e `Select` cambio vista funzionano correttamente al tap su `390x844` e `360x800`.
- **`DatePicker` e `Select` dentro modali (`360x800`)**: **CONFORMI** — verificato il calendario in `Registra spesa` (`overflows: false`) e la listbox del `Select` in `Nuovo invito` (`left: 32, right: 312`, entro i `360px`).

---

## 2. Checklist Schermate & Modali testate

| Ruolo | Schermata / Modale | Esito `390x844` | Esito `360x800` | Overflow / Note |
| :--- | :--- | :--- | :--- | :--- |
| Pubblico | `/login` | **OK** | **OK** | Nessun overflow, target adeguati |
| Condòmino | `/home` | **OK** | **OK** | Nessun overflow; campana notifiche OK |
| Condòmino | `/home` → `NotificationPanel` | **OK** | **OK** | Pannello contenuto nella viewport |
| Condòmino | `/home` → Modale `Nuova segnalazione` | **OK** | **OK** | Modale scrollabile, azioni visibili |
| Condòmino | `/notifiche` | **OK** | **OK** | Nessun overflow |
| Condòmino | `/comunicazioni` | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` altezza `40px` (`< 44px`) |
| Condòmino | `/pagamenti` | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` altezza `40px` |
| Condòmino | `/pagamenti/[id]` | **CON PROBLEMI** | **CON PROBLEMI** | Pulsante `Indietro` sporge a `left: -5px` |
| Condòmino | `/spese` | **OK** | **OK** | Nessun overflow |
| Condòmino | `/spese/[id]` | **BLOCCANTE** | **BLOCCANTE** | `MobileDataList` senza `onPress` sborda fino a `right: 821px`; pulsante `Indietro` a `left: -5px` |
| Condòmino | `/assemblee` | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` altezza `40px` |
| Condòmino | `/assemblee/[id]` | **CON PROBLEMI** | **CON PROBLEMI** | Pulsante `Indietro` a `left: -5px` |
| Condòmino | `/segnalazioni` + Modale `Nuova segnalazione` | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` altezza `40px` |
| Condòmino | `/segnalazioni/[id]` | **CON PROBLEMI** | **CON PROBLEMI** | Pulsante `Indietro` a `left: -5px` |
| Condòmino | `/prenotazioni` + Modale `Prenota` | **BLOCCANTE** | **BLOCCANTE** | `MobileDataList` senza `onPress` sborda fino a `right: 597px` |
| Condòmino | `/raccolta-differenziata` | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` altezza `40px` |
| Condòmino | `/documenti` | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` altezza `40px` |
| Condòmino | `/documenti/[id]` | **CON PROBLEMI** | **CON PROBLEMI** | Pulsante `Indietro` a `left: -5px` |
| Condòmino | `/impostazioni` | **OK** | **OK** | Nessun overflow |
| Condòmino | `/assistenza` + Modali contatti | **CON PROBLEMI** | **CON PROBLEMI** | `ModalActions` dentro `children` nelle modali |
| Condòmino | `/altro` | **OK** | **OK** | Bottom bar non copre `Esci dall’account` |
| Portiere | `/pacchi` + Modale `Registra pacco` | **BLOCCANTE** | **BLOCCANTE** | `MobileDataList` senza `onPress` sborda fino a `right: 580px`; `SearchBar` `40px` |
| Amministratore | `/admin/dashboard` | **OK** | **OK** | Nessun overflow, KPI impilati correttamente |
| Amministratore | `/admin/struttura` (Tab Struttura & Millesimi) + Modali | **BLOCCANTE** | **BLOCCANTE** | `FilterChips` sbordano fino a `right: 652px`; `SearchBar` `40px` |
| Amministratore | `/admin/struttura/tabelle-millesimali/nuova` | **OK** | **CON PROBLEMI** | A `360x800` rilevati 4 elementi con lieve overflow |
| Amministratore | `/admin/contabilita` (5 Tab + Modali Spesa/Rate) | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` `40px`; `ModalActions` dentro `children` in una modale (riga 3086) |
| Amministratore | `/admin/assemblee` + Modale `Convoca nuova assemblea` | **BLOCCANTE** | **BLOCCANTE** | Pulsanti `Conferma e convoca` e `Annulla` fuori schermo (`bottom: 1129–1152px`) |
| Amministratore | `/admin/assemblee/[id]` | **BLOCCANTE** | **BLOCCANTE** | Tabella presenze (`right: 651px`), chip `Straordinaria` (`right: 569px`), bottone `Copia verbale` (`right: 420px`) e `Quorum` (`right: 387px`) sbordano; bottoni presenza `h: 33px` |
| Amministratore | `/admin/comunicazioni` + Modale `Nuova comunicazione` | **BLOCCANTE** | **BLOCCANTE** | `FilterChips` sbordano fino a `right: 641px`; `SearchBar` `40px` |
| Amministratore | `/admin/manutenzione` (Tab Ticket & Fornitori) + Modali | **BLOCCANTE** | **BLOCCANTE** | Titoli `H3` troncati nei ticket; Rubrica Fornitori sborda (`MobileDataList`); `Annulla` fuori vista a `360x800` in `Nuova segnalazione`; `ModalActions` nei `children` |
| Amministratore | `/admin/documenti` + Modali `Nuova cartella` / `Carica` | **CON PROBLEMI** | **CON PROBLEMI** | 9 chip/bottoni cartella con altezza `40px` (`< 44px`) |
| Amministratore | `/admin/inviti` + Modale `Nuovo invito` | **BLOCCANTE** | **BLOCCANTE** | Pulsante `"Aggiungi nuovo condòmino (Palazzo / Scala / Unità)"` largo `445px` (sborda su `390` e `360`) |
| Amministratore | `/admin/prenotazioni` (2 Tab + Modale) | **BLOCCANTE** | **BLOCCANTE** | `MobileDataList` senza `onPress` sborda (`right: 474px` / `512px`) |
| Amministratore | `/admin/raccolta-differenziata` + Modale | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` `40px` |
| Amministratore | `/admin/moduli` | **CON PROBLEMI** | **BLOCCANTE** | Badge `Migrazione 11` sborda a `right: 369px` su `360x800` (e parzialmente su `390x844`) |
| Amministratore | `/admin/coda-email` | **CON PROBLEMI** | **CON PROBLEMI** | `SearchBar` `40px`; `ModalActions` nei `children` nella modale dettaglio |
| Amministratore | `/admin/impostazioni` | **OK** | **OK** | Nessun overflow |
| Amministratore | `/admin/assistenza` | **OK** | **OK** | Nessun overflow |

---

## 3. Elenco dettagliato dei Bug Mobile trovati

### Gravità CRITICA

#### [CRITICO-01] `MobileDataList` senza `onPress` dispone titolo, stato e dettagli in riga orizzontale causando overflow
- **Ruoli e schermate**:
  - Condòmino: `/prenotazioni` (`right: 597px`), `/spese/[id]` (`right: 821px`)
  - Portiere: `/pacchi` (`right: 580px`)
  - Amministratore: `/admin/prenotazioni` (entrambi i tab, `right: 474–512px`), `/admin/manutenzione` (tab `Rubrica Fornitori`, `right: 450px`)
- **File sorgente**: `packages/ui/src/components/MobileDataList.tsx` (righe 168–170 e 200–210)
- **Descrizione**: Quando `onPress` non è definito, `MobileDataList` renderizza `<View style={[styles.press, styles.content]}>{body}</View>`. Poiché `styles.press` imposta `flexDirection: 'row'` e `styles.content` non imposta `flexDirection: 'column'`, tutti i figli di `{body}` (titolo, badge di stato e righe di dettaglio) vengono affiancati orizzontalmente sulla stessa riga anziché impilati in colonna, uscendo ampiamente dallo schermo.
- **Fix consigliato**: Nella variante senza `onPress` usare un contenitore verticale (`flexDirection: 'column'`) o annidare `<View style={styles.content}>{body}</View>` dentro `<View style={styles.press}>`, esattamente come nel ramo con `onPress`.

#### [CRITICO-02] Pulsanti di azione delle modali (`ModalActions`) inseriti nei `children` invece che nella prop `actions`
- **Ruoli e schermate**:
  - Amministratore: `/admin/assemblee` (`Convoca nuova assemblea` — `Conferma e convoca` e `Annulla` finiscono a `bottom: 1129–1152px`, fuori viewport), `/admin/manutenzione` (`Nuova segnalazione` — `Annulla` a `bottom: 819px` su `360x800`, più modali modifica/fornitore), `/admin/assemblee/[id]` (modale ODG), `/admin/contabilita` (modale a riga 3086), `/admin/coda-email` (modale dettaglio)
  - Condòmino/Portiere: `/assistenza` (modali contatti)
- **File sorgente**:
  - `apps/app/src/screens/AdminAssembleeScreen.tsx` (riga 579)
  - `apps/app/src/screens/AdminManutenzioneScreen.tsx` (righe 953, 1032, 1174, 1323)
  - `apps/app/src/screens/AdminAssembleaDettaglioScreen.tsx` (riga 1326)
  - `apps/app/src/screens/AdminContabilitaScreen.tsx` (riga 3086)
  - `apps/app/src/screens/AdminCodaEmailScreen.tsx` (riga 436)
  - `apps/app/src/screens/AssistenzaScreen.tsx` (righe 450, 496)
- **Descrizione**: Passando `<ModalActions>` come figlio di `<Modal>` invece che tramite la prop `actions={...}`, i pulsanti vengono inseriti dentro la `ScrollView` interna della modale e non restano fissi/visibili nel footer della dialog, risultando fuori schermo all'apertura su `360x800` e `390x844`.
- **Fix consigliato**: Spostare tutti i `<ModalActions>` nella prop `actions={...}` di `<Modal>` come previsto dal Design System (sez. 13.1).

#### [CRITICO-03] Tabella presenze, chip tipologia delibera e pulsanti azione in `/admin/assemblee/[id]` sbordano su mobile
- **Ruolo e schermata**: Amministratore — `/admin/assemblee/[id]`
- **File sorgente**: `apps/app/src/screens/AdminAssembleaDettaglioScreen.tsx` (righe 701, 774, 803–808, 955, 989–1007)
- **Descrizione**:
  - La tabella presenze imposta `minWidth: 260` su `Stato Presenza` senza layout card mobile né `ScrollView` orizzontale adeguato, sbordando fino a `right: 651px`.
  - La riga con `Ordinaria (≥ 333,33 ‰ in 2ª conv.)` e `Straordinaria (≥ 500,00 ‰)` non va a capo (`right: 569px`).
  - Il gruppo `Apri votazione` / `Copia verbale` sborda a `right: 420px`.
  - Il testo `Quorum non raggiunto (2ª Convocazione)` sborda a `right: 387px` su `360x800`.
- **Fix consigliato**: Usare `flexWrap: 'wrap'` sulle righe di pulsanti/chip, rendere la lista presenze a schede impilate su mobile (o dentro un contenitore `ScrollView horizontal`), e permettere al testo del quorum di andare a capo con `flexShrink: 1`.

#### [CRITICO-04] `FilterChips` sbordano oltre `600px` in `/admin/struttura` e `/admin/comunicazioni`
- **Ruolo e schermate**: Amministratore — `/admin/struttura` (`right: 652px`), `/admin/comunicazioni` (`right: 641px`)
- **File sorgente**:
  - `apps/app/src/screens/AdminStrutturaScreen.tsx` (righe 666–670, stile `filtroChipsContenitore` a riga 1659)
  - `apps/app/src/screens/AdminComunicazioniScreen.tsx` (righe 532–545, stile `rigaChips` a riga 793)
- **Descrizione**: In `AdminStrutturaScreen` `filtroChipsContenitore` ha `flexShrink: 0`, impedendo al gruppo di chip di restringersi e andare a capo; in `AdminComunicazioniScreen` `rigaChips` ha `flexDirection: 'row'` e i figli `FilterChips` (`alignSelf: 'stretch'`) assumono larghezza `max-content` (`608px`) prima di poter wrappare.
- **Fix consigliato**: Rimuovere `flexShrink: 0` da `filtroChipsContenitore` sostituendolo con `flex: 1, minWidth: 0, width: '100%'`; in `AdminComunicazioniScreen` impilare i due `FilterChips` in colonna (`flexDirection: 'column'`) o dare `maxWidth: '100%', flexShrink: 1` ai wrapper.

#### [CRITICO-05] Pulsante `"Aggiungi nuovo condòmino (Palazzo / Scala / Unità)"` largo `445px` in `/admin/inviti`
- **Ruolo e schermata**: Amministratore — `/admin/inviti`
- **File sorgente**: `apps/app/src/screens/AdminInvitiScreen.tsx` (riga 431)
- **Descrizione**: Il pulsante ha un'etichetta molto lunga su riga singola (`width: 445px`, `right: 461px`), superando sia i `390px` sia i `360px` di viewport.
- **Fix consigliato**: Accorciare l'etichetta su mobile (es. `"Aggiungi nuovo condòmino"`) e/o consentire il wrapping del testo in `Button` su schermi stretti (`flexShrink: 1`).

---

### Gravità MEDIA

#### [MEDIO-01] Pulsante `Indietro` in `PageHeader` tagliato di `-5px` sul bordo sinistro su tutte le pagine di dettaglio
- **Ruolo e schermate**: Condòmino — `/pagamenti/[id]`, `/spese/[id]`, `/assemblee/[id]`, `/segnalazioni/[id]`, `/documenti/[id]`
- **File sorgente**: `packages/ui/src/components/PageHeader.tsx` (riga 102)
- **Descrizione**: `back: { alignSelf: 'flex-start', marginLeft: -(space[5] + borderWidths.thin) }` applica `-21px` di margine sinistro. Su mobile il padding della pagina in `AppLayout` è `space[4]` (`16px`), quindi il pulsante `Indietro` finisce a `left: -5px` fuori dallo schermo.
- **Fix consigliato**: Limitare la compensazione negativa su mobile a `-space[4]` (`-16px`, oppure `0` con allineamento pulito al bordo sinistro) in base a `isMobile`.

#### [MEDIO-02] Badge `Migrazione 11` in `/admin/moduli` sborda su `360x800`
- **Ruolo e schermata**: Amministratore — `/admin/moduli`
- **File sorgente**: `apps/app/src/screens/AdminModuliScreen.tsx` (righe 393–400)
- **Descrizione**: La riga dei badge (`Attivo`, `Condòmino`, `Migrazione 11`) arriva a `right: 369px` su viewport `360px`, tagliando il bordo destro del badge `Migrazione 11`.
- **Fix consigliato**: Assicurare `flexWrap: 'wrap'` sul contenitore dei badge in `AdminModuliScreen.tsx` e `minWidth: 0` sul contenitore testo della card modulo.

#### [MEDIO-03] Titoli `H3` troncati in `/admin/manutenzione`
- **Ruolo e schermata**: Amministratore — `/admin/manutenzione`
- **File sorgente**: `apps/app/src/screens/AdminManutenzioneScreen.tsx` e `packages/ui/src/components/MobileDataList.tsx`
- **Descrizione**: I titoli lunghi dei ticket (`[Scala A] Lampadina fulminata...`, `[Area Comune] Cancello carraio...`) risultano troncati (`scrollW: 394–422px` dentro `clientW: 260px`) invece di andare a capo su più righe.
- **Fix consigliato**: Evitare `numberOfLines={1}` sui titoli delle card mobile e garantire `flexShrink: 1, minWidth: 0` sul testo del titolo.

#### [MEDIO-04] Aree cliccabili sotto `44px` su controlli operativi in `/admin/assemblee/[id]` e `/admin/documenti`
- **Ruolo e schermate**:
  - Amministratore — `/admin/assemblee/[id]`: pulsanti `Presente`, `Delega`, `Assente` (`h: 33px`), `1ª Convocazione` / `2ª Convocazione` (`h: 41px`).
  - Amministratore — `/admin/documenti`: pulsanti cartelle (`h: 40px`).
- **File sorgente**: `apps/app/src/screens/AdminAssembleaDettaglioScreen.tsx` (righe 662, 803–808), `apps/app/src/screens/AdminDocumentiScreen.tsx`
- **Descrizione**: Sebbene sopra il minimo WCAG (`24px`), risultano sotto la soglia ergonomica consigliata dal Design System (`44–48px`) per il tap su smartphone.
- **Fix consigliato**: Impostare `minHeight: touchTarget.control` (`44px`) sui controlli di presenza, convocazione e selezione cartella.

---

### Gravità ESTETICA

#### [ESTETICO-01] `SearchBar` con altezza `40px` invece di `44px` nelle schermate con barra di ricerca
- **Ruoli e schermate**: Tutte le schermate lista che usano `SearchBar` in modalità compatta (`/comunicazioni`, `/pagamenti`, `/assemblee`, `/segnalazioni`, `/raccolta-differenziata`, `/documenti`, `/pacchi`, `/admin/*`)
- **File sorgente**: `packages/ui/src/components/SearchBar.tsx` (riga 42)
- **Descrizione**: `touchTarget.control` / `compact` produce un input `role="searchbox"` alto `40px` (`< 44px` indicati nella sezione 10.1 di `DESIGN_SYSTEM.md`).
- **Fix consigliato**: Portare l'altezza minima del campo `SearchBar` a `44px` su mobile.

#### [ESTETICO-02] Lieve overflow su `4` elementi in `/admin/struttura/tabelle-millesimali/nuova` a `360x800`
- **Ruolo e schermata**: Amministratore — `/admin/struttura/tabelle-millesimali/nuova` (solo `360x800`; `OK` a `390x844`)
- **Descrizione**: Su schermi da `360px` alcuni elementi della riga/tabella millesimale superano di pochi pixel la larghezza utile senza causare `docOverflow`.
- **Fix consigliato**: Verificare i `minWidth` dei campi numerici nella pagina di creazione tabella millesimale sotto i `380px`.

---

## 4. Prossimo passo consigliato (ordine prioritario)

1. **Fix `MobileDataList.tsx` (CRITICO-01)**: risolve immediatamente con una sola modifica 5 schermate critiche (`/pacchi`, `/prenotazioni`, `/spese/[id]`, `/admin/prenotazioni`, `/admin/manutenzione` Fornitori).
2. **Spostare `<ModalActions>` nella prop `actions` di `<Modal>` (CRITICO-02)**: ripristina i pulsanti `Conferma` / `Annulla` sempre visibili su tutte le modali in `/admin/assemblee`, `/admin/manutenzione`, `/admin/assemblee/[id]`, `/admin/contabilita`, `/admin/coda-email` e `/assistenza`.
3. **Fix `FilterChips` wrapper + pulsante `/admin/inviti` + badge `/admin/moduli` (CRITICO-04, CRITICO-05, MEDIO-02)**: 3 interventi rapidi di CSS/Flexbox (`flexWrap: 'wrap'`, `minWidth: 0`, testo bottone breve).
4. **Reflow mobile di `/admin/assemblee/[id]` (CRITICO-03, MEDIO-04)**: adattare la tabella presenze e i chip/pulsanti di votazione e quorum a `360px`/`390px` con `minHeight: 44px`.
5. **Fix `PageHeader` `back` `marginLeft` e `SearchBar` `44px` (MEDIO-01, ESTETICO-01)**: allineamento perfetto su tutte le pagine di dettaglio e ricerca.

---

## 5. Stato Risoluzione (16 novembre 2026)

Tutti i problemi `CRITICO`, `MEDIO` ed `ESTETICO` elencati in questo audit sono stati risolti, preservando il layout Desktop (`1280x800`) e il rispetto di `DESIGN_SYSTEM.md` e `AGENTS.md`.

### Riepilogo interventi per ID

| ID | Stato | Intervento applicato | File modificati |
| :--- | :--- | :--- | :--- |
| **CRITICO-01** | **RISOLTO** | Nella variante senza `onPress`, annidato `<View style={styles.content}>{body}</View>` dentro `<View style={styles.press}>` e aggiunto `flexDirection: 'column'` a `styles.content`. | [MobileDataList.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/packages/ui/src/components/MobileDataList.tsx) |
| **CRITICO-02** | **RISOLTO** | Spostati tutti i `<ModalActions>` dai `children` alla prop `actions={...}` di `<Modal>` (verificato che `AdminContabilitaScreen.tsx` usava già `actions`). | [AdminAssembleeScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminAssembleeScreen.tsx), [AdminManutenzioneScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminManutenzioneScreen.tsx), [AdminAssembleaDettaglioScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminAssembleaDettaglioScreen.tsx), [AdminCodaEmailScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminCodaEmailScreen.tsx), [AssistenzaScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AssistenzaScreen.tsx) |
| **CRITICO-03** | **RISOLTO** | Layout a schede impilate su mobile (`isMobile`) per la rilevazione presenze; `flexShrink: 1, minWidth: 0` su `messaggioQuorum`; `maxWidth: '100%', flexShrink: 1` su `chipsQuorum` e `azioniPunto`; padding mobile `space[4]` su `cardPuntoOdg`. | [AdminAssembleaDettaglioScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminAssembleaDettaglioScreen.tsx) |
| **CRITICO-04** | **RISOLTO** | Sostituito `flexShrink: 0` con `flexShrink: 1, minWidth: 0, maxWidth: '100%'` su `filtroChipsContenitore`; impilato `rigaChips` in colonna (`flexDirection: 'column', alignItems: 'stretch'`); aggiunto `flexWrap: 'wrap', maxWidth: '100%', flexShrink: 1` alle righe azioni di edifici e unità. | [AdminStrutturaScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminStrutturaScreen.tsx), [AdminComunicazioniScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminComunicazioniScreen.tsx) |
| **CRITICO-05** | **RISOLTO** | Etichetta compatta `"Aggiungi nuovo condòmino"` con `fullWidth={isMobile}` su smartphone, mantenendo l'etichetta estesa su tablet/desktop. | [AdminInvitiScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminInvitiScreen.tsx) |
| **MEDIO-01** | **RISOLTO** | Aggiunto `backMobile: { marginLeft: -space[4] }` su mobile (`isMobile`), allineando il pulsante `Indietro` a `left: 0px` senza tagli sul bordo sinistro. | [PageHeader.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/packages/ui/src/components/PageHeader.tsx) |
| **MEDIO-02** | **RISOLTO** | Aggiunto `minWidth: 0` su `colonnaDettagliModulo` e `intestazioneModulo`, `flexShrink: 1` su `titoloModulo`, e `minWidth: 0, maxWidth: '100%'` su `badgeGroup`. | [AdminModuliScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminModuliScreen.tsx) |
| **MEDIO-03** | **RISOLTO** | Rimosso `numberOfLines={1}` su mobile in `CellaTitolo` (`numberOfLines={isMobile ? undefined : 1}`) e aggiunto `flexShrink: 1, minWidth: 0` a `titoloMobile`. | [AdminManutenzioneScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminManutenzioneScreen.tsx) |
| **MEDIO-04** | **RISOLTO** | Impostato `minHeight: touchTarget.control` (`44px`) su `btnConv`, `btnPresenza` e `chipTipo` in dettaglio assemblea e su `areaSelezioneCartella` / `pulsanteEliminaCartella` in documenti. | [AdminAssembleaDettaglioScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminAssembleaDettaglioScreen.tsx), [AdminDocumentiScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminDocumentiScreen.tsx) |
| **ESTETICO-01** | **RISOLTO** | Aggiunto `minHeight: touchTarget.control` (`44px`) sullo stile `input` di `SearchBar` in modo che `role="searchbox"` raggiunga almeno `44px`. | [SearchBar.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/packages/ui/src/components/SearchBar.tsx) |
| **ESTETICO-02** | **RISOLTO** | Aggiunto `maxWidth: '100%', flexShrink: 1` a `stickyMetrics` e `stickyBadgeWrapper`, `minWidth: 0` a `metricItem`, e `campoFull` (`width: '100%', minWidth: 0`) sui campi su mobile. | [AdminEditorTabellaMillesimaleScreen.tsx](file:///C:/Users/mromeo2/OneDrive%20-%20DXC%20Production/Desktop/Matteo/CONDOMINIO/IoCondo/apps/app/src/screens/AdminEditorTabellaMillesimaleScreen.tsx) |

### Esito verifiche tecniche ed E2E su Microsoft Edge (`channel: 'msedge'`)

- **`typecheck` / `lint` / `test`**: superati su tutti i pacchetti del monorepo (`13/13` task Turbo, `448/448` test unitari `@iocondo/data` + test `@iocondo/ui`).
- **E2E Microsoft Edge (`390x844`, `360x800`, `1280x800`) su bundle locale**:
  - `0` `console.error`, `0` `pageerror`.
  - `docOverflow: false` (`scrollWidth === innerWidth`) su tutte le schermate testate in tutti i viewport.
  - `SearchBar` `role="searchbox"` verificata a `44px` di altezza su tutte le schermate con ricerca.
  - Pulsante `Indietro` di `PageHeader` allineato a `left: 0px` su `360x800`.
  - Azioni delle modali (`AssistenzaScreen`, `AdminAssembleeScreen`) sempre visibili dentro la viewport sia a `390x844` sia a `360x800`.
  - `/admin/assemblee/[id]` con tendina presenze espansa, `/admin/struttura/tabelle-millesimali/nuova`, `/admin/inviti`, `/admin/moduli`, `/admin/manutenzione`, `/admin/comunicazioni`, `/admin/prenotazioni`, `/prenotazioni`, `/pacchi`: `0` overflow orizzontali.
  - Desktop `1280x800`: nessuna regressione su sidebar e layout.
