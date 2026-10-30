DESIGN SYSTEM UFFICIALE — SOFTWARE CONDOMINIALE

Versione 1.0 — Specifiche UI/UX, design system e linee guida di sviluppo

1. OBIETTIVO DEL PROGETTO

Realizzare un software gestionale condominiale moderno, professionale, intuitivo e accessibile, utilizzabile da persone di qualsiasi età e con qualsiasi livello di competenza digitale.

L’interfaccia deve unire:

* La semplicità e la chiarezza delle moderne applicazioni SaaS.
* L’affidabilità visiva dei software professionali.
* La facilità d’uso delle applicazioni bancarie più intuitive.
* Un design pulito, ordinato e riconoscibile.
* Un’esperienza coerente tra computer, tablet e smartphone.

Il software deve essere immediatamente comprensibile anche a un utente che lo utilizza per la prima volta.

Principio fondamentale: l’utente non deve chiedersi dove cliccare, cosa significhi un’icona o come completare un’operazione.

Non creare un’interfaccia eccessivamente decorativa, futuristica, complessa o piena di animazioni. La priorità è sempre la chiarezza.

⸻

2. IDENTITÀ VISIVA

2.1 Stile generale

Utilizzare uno stile denominato:

Modern Professional — Friendly SaaS

Caratteristiche obbligatorie:

* Layout pulito e ordinato.
* Sfondo prevalentemente bianco.
* Menu laterale blu navy.
* Pulsanti principali blu brillante.
* Accenti turchesi.
* Schede bianche con bordi sottili.
* Angoli moderatamente arrotondati.
* Ombre molto leggere.
* Icone lineari, uniformi e riconoscibili.
* Tipografia sans-serif moderna e leggibile.
* Spaziatura generosa.
* Gerarchia visiva chiara.
* Elementi interattivi sempre riconoscibili.
* Nessun elemento superfluo.

Il risultato deve sembrare un software professionale reale, pronto per essere utilizzato quotidianamente.

2.2 Palette colori ufficiale

Utilizzare esclusivamente questa palette come base del sistema.

Token	Colore	Codice HEX	Utilizzo
Primary Navy	Blu navy	#0D3B66	Sidebar, intestazioni importanti, struttura
Primary Blue	Blu brillante	#0EA5E9	Pulsanti principali, link, azioni
Secondary Teal	Turchese	#14B8A6	Conferme, stati positivi, elementi secondari
Border Gray	Grigio chiaro	#E5E7EB	Bordi, divisori, separatori
Background	Bianco freddo	#F8FAFC	Sfondo generale
Surface	Bianco	#FFFFFF	Schede, modali, pannelli
Text Primary	Blu molto scuro	#0F172A	Titoli e testi principali
Text Secondary	Grigio ardesia	#475569	Descrizioni e informazioni secondarie
Text Muted	Grigio	#64748B	Metadati e indicazioni non principali
Disabled	Grigio tenue	#CBD5E1	Elementi disabilitati, senza essere l’unico indicatore
Focus	Blu acceso	#0284C7	Indicatore di focus accessibile
Action	Blu d’azione	#0A79AB	Sfondo dei pulsanti primari, testo dei link, voce attiva della sidebar
Action Hover	Blu d’azione scuro	#096C99	Stato hover dei controlli Action
Action Pressed	Blu d’azione più scuro	#085F86	Stato pressed dei controlli Action

Nota sul token Action (contrasto WCAG 2.2 AA)

Il bianco su Primary Blue #0EA5E9 ha un contrasto di 2,77:1, inferiore al 4,5:1 richiesto per il testo normale (WCAG 2.2 AA). Per questo i colori che fanno da sfondo al testo bianco o che colorano il testo dei link usano il token Action #0A79AB, ottenuto dal Primary Blue mantenendo tonalità e saturazione e riducendo la luminosità. Contrasti calcolati: bianco su Action 4,84:1; Action su Background #F8FAFC 4,63:1; Hover 5,81:1 e Pressed 7,02:1 sul bianco.

Dove le sezioni 5.1 (voce attiva), 7.1 (pulsante primario) e 7.3 (pulsante testuale), e la regola d’utilizzo 2, indicano il blu brillante #0EA5E9 per pulsanti, link o voce attiva, si usa il token Action. Primary Blue #0EA5E9 resta per sfondi di icone, accenti, decorazioni e per l’indicatore laterale della voce attiva della sidebar; non va mai usato come sfondo di testo bianco piccolo. Il turchese #14B8A6 (2,49:1 col bianco) non va usato come sfondo di testo bianco piccolo.

Regole d’utilizzo

1. Il blu navy deve costituire la struttura visiva del prodotto.
2. Il blu brillante deve identificare le azioni principali.
3. Il turchese deve essere utilizzato con moderazione per conferme e stati positivi.
4. Il bianco deve prevalere sulle superfici dei contenuti.
5. Il grigio chiaro deve separare gli elementi senza appesantire l’interfaccia.
6. Il testo principale deve essere sempre sufficientemente contrastato.
7. Non utilizzare gradienti decorativi come stile predefinito.
8. Non introdurre nuovi colori arbitrariamente nelle singole pagine.
9. Eventuali nuovi colori devono essere definiti come token condivisi.
10. Non utilizzare il colore come unico modo per comunicare uno stato.

Colori semantici

Definire inoltre questi colori per gli stati del sistema:

* Successo: #15803D
* Sfondo successo: #F0FDF4
* Attenzione: #B45309
* Sfondo attenzione: #FFFBEB
* Errore: #B91C1C
* Sfondo errore: #FEF2F2
* Informazione: #0369A1
* Sfondo informazione: #F0F9FF

Gli stati devono essere accompagnati da etichette testuali e, dove utile, da icone.

Esempio: icona di avviso + testo “Pagamento scaduto”, non soltanto una riga rossa.

⸻

3. TIPOGRAFIA

3.1 Font

Utilizzare Inter come carattere principale.

Se non disponibile, utilizzare una sans-serif moderna equivalente.

La tipografia deve essere uniforme in tutte le pagine.

3.2 Gerarchia tipografica

Elemento	Dimensione desktop	Peso
Titolo pagina H1	28–32 px	600–700
Titolo sezione H2	22–24 px	600
Titolo scheda H3	18–20 px	600
Titolo elemento H4	16–18 px	600
Testo normale	16 px	400
Testo secondario	14–15 px	400
Etichette e metadati	14 px	500
Testo di supporto	14–16 px	400
Pulsanti	15–16 px	600

Regole

* Evitare testi troppo piccoli.
* Non utilizzare 12 px per informazioni importanti.
* Non utilizzare maiuscole per interi paragrafi.
* Evitare testi eccessivamente sottili.
* Utilizzare il grassetto solo per creare una gerarchia.
* Mantenere un’interlinea di circa 1,5 per i testi lunghi.
* Permettere l’ingrandimento del testo senza compromettere l’interfaccia.
* Evitare righe di testo eccessivamente lunghe.
* Utilizzare titoli che descrivono chiaramente il contenuto della pagina.

⸻

4. SPAZIATURE, DIMENSIONI E FORME

Adottare una scala di spaziatura basata su multipli di 4 px.

Token	Valore	Utilizzo
Space 1	4 px	Microdistanze
Space 2	8 px	Distanza tra icona e testo
Space 3	12 px	Elementi ravvicinati
Space 4	16 px	Padding standard
Space 5	20 px	Spaziatura interna
Space 6	24 px	Distanza tra gruppi
Space 8	32 px	Separazione tra sezioni
Space 10	40 px	Separazione importante
Space 12	48 px	Grandi sezioni

Angoli arrotondati

* Pulsanti: 8 px.
* Input: 8 px.
* Schede: 12 px.
* Modali: 16 px.
* Badge: 6 px oppure forma completamente arrotondata per pillole.
* Avatar: circolare.

Evitare sia angoli completamente squadrati sia un eccesso di forme a pillola.

Ombre

Utilizzare ombre leggere, diffuse e poco contrastate.

* Schede normali: preferire il bordo all’ombra.
* Menu a comparsa: ombra leggera.
* Modali: ombra più evidente ma discreta.
* Elementi selezionati: utilizzare principalmente colore, bordo o indicatore laterale.

Non utilizzare ombre pesanti o effetti tridimensionali.

⸻

5. STRUTTURA PRINCIPALE DEL SOFTWARE

L’interfaccia desktop deve essere composta da quattro aree.

5.1 Sidebar

Menu laterale fisso sul desktop, con sfondo blu navy #0D3B66.

Contiene:

1. Logo e nome del software.
2. Voce Home.
3. Spese.
4. Pagamenti.
5. Documenti.
6. Comunicazioni.
7. Assemblee.
8. Segnalazioni.
9. Fornitori, se previsti per il ruolo.
10. Impostazioni.
11. Assistenza nella parte inferiore.

Specifiche

* Larghezza desktop indicativa: 232–248 px.
* Padding interno: 16 px.
* Altezza minima delle voci: 44–48 px.
* Icone lineari di 20–22 px.
* Testo delle voci: 15–16 px.
* Distanza tra icona e testo: 12 px.
* Voci sempre nello stesso ordine.
* Stato attivo chiaramente visibile.
* Icone e testo sempre leggibili.
* Possibilità di comprimere il menu sui desktop più piccoli, se necessario.

Stati delle voci

Normale

* Testo bianco.
* Icona bianca.
* Sfondo trasparente.

Hover

* Sfondo blu leggermente più chiaro.

Attivo

* Sfondo blu brillante #0EA5E9.
* Testo bianco.
* Icona bianca.
* Eventuale indicatore laterale.

Focus

* Contorno ben visibile.
* Nessuna perdita di contrasto.

Disabilitato

* Aspetto attenuato.
* Motivazione disponibile quando l’azione non è utilizzabile.

Le voci disabilitate devono essere rare.

5.2 Header superiore

Deve contenere:

* Campo di ricerca globale.
* Notifiche.
* Avatar o iniziali dell’utente.
* Nome utente.
* Ruolo attivo.
* Menu del profilo.
* Eventuale selettore del condominio, se l’utente ne gestisce più di uno.

Altezza indicativa: 68–76 px.

Sfondo bianco, bordo inferiore #E5E7EB.

Il campo di ricerca deve avere una dimensione adeguata, un’icona riconoscibile e un placeholder esplicativo.

Esempio: “Cerca documenti, spese, comunicazioni…”.

Non inserire troppi elementi nell’header.

5.3 Area contenuti

* Sfondo #F8FAFC.
* Padding desktop: 24–32 px.
* Larghezza utilizzata in modo efficiente.
* Titolo pagina nella parte superiore.
* Eventuale sottotitolo esplicativo.
* Pulsante dell’azione principale allineato al titolo, quando opportuno.
* Contenuti organizzati in schede, elenchi e sezioni.
* Nessuna sovrapposizione tra componenti.

5.4 Footer

Utilizzare un footer discreto quando necessario.

Può contenere:

* Informazioni legali.
* Privacy.
* Versione del software.
* Link all’assistenza.

Non deve sottrarre spazio ai contenuti principali.

⸻

6. DASHBOARD PRINCIPALE

La dashboard è la schermata più importante del prodotto.

Deve permettere all’utente di capire rapidamente la propria situazione condominiale.

6.1 Intestazione

Esempio:

“Buongiorno, Maria!”

Sottotitolo:

“Ecco un riepilogo della situazione condominiale.”

Se utile, mostrare il nome del condominio selezionato.

Non utilizzare testi generici, troppo lunghi o promozionali.

6.2 Schede riepilogative

Mostrare le informazioni più importanti in schede distinte:

1. Spese condominiali.
2. Pagamenti.
3. Comunicazioni.
4. Documenti.
5. Prossima assemblea.
6. Prossime scadenze.

Le prime quattro possono essere evidenziate nella dashboard, mentre assemblee e scadenze possono essere presentate nelle sezioni successive.

Non è obbligatorio visualizzare tutte le schede contemporaneamente: la priorità dipende dal ruolo e dalle informazioni effettivamente disponibili.

Struttura della scheda

Ogni scheda può contenere:

* Icona.
* Titolo.
* Valore principale.
* Descrizione breve.
* Stato, se necessario.
* Azione contestuale.

Esempio:

Spese condominiali

€ 2.480,00

Totale da pagare

[Paga una rata]

Non presentare un pulsante di pagamento se l’utente non ha effettivamente un pagamento disponibile.

I valori economici devono provenire dai dati reali, non da numeri dimostrativi inseriti nell’interfaccia finale.

6.3 Ordine visivo

La priorità deve essere:

1. Informazioni che richiedono un’azione.
2. Pagamenti e scadenze.
3. Comunicazioni non lette.
4. Documenti e assemblee.
5. Informazioni secondarie.

Le informazioni urgenti devono essere evidenti senza rendere l’intera dashboard allarmante.

6.4 Ultime comunicazioni

Ogni elemento deve mostrare:

* Icona o categoria.
* Titolo.
* Breve descrizione.
* Data.
* Stato di lettura.
* Accesso ai dettagli.

Esempio:

“Manutenzione ascensore”

“Intervento programmato per il 10 maggio.”

L’elemento deve essere selezionabile anche cliccando sulla sua area principale, quando appropriato.

6.5 Prossime scadenze

Mostrare:

* Nome della scadenza.
* Data.
* Importo, se pertinente.
* Stato.
* Azione disponibile.

Ordinare le scadenze per data e rilevanza.

Le scadenze già superate devono essere indicate chiaramente, senza confonderle con quelle future.

6.6 Assistenza e segnalazioni rapide

Prevedere accessi diretti a:

* Segnala un problema.
* Richiedi assistenza.
* Consulta le richieste già inviate.

Non utilizzare icone prive di etichette.

⸻

7. PULSANTI

Tutti i pulsanti devono utilizzare uno stile coerente.

7.1 Pulsante primario

Utilizzo: azione principale della schermata.

Esempi:

* Salva modifiche.
* Invia segnalazione.
* Paga una rata.
* Conferma.
* Carica documento.

Stile:

* Sfondo #0EA5E9.
* Testo bianco.
* Altezza minima 44–48 px.
* Padding orizzontale 16–20 px.
* Border radius 8 px.
* Font 15–16 px.
* Peso 600.

Stati:

* Hover: blu leggermente più scuro.
* Focus: contorno visibile.
* Pressed: feedback immediato.
* Loading: indicatore di caricamento e testo coerente.
* Disabled: aspetto attenuato e azione realmente bloccata.

Non utilizzare più pulsanti primari concorrenti nella stessa sezione, salvo casi motivati.

7.2 Pulsante secondario

Utilizzo: azioni alternative.

Stile:

* Sfondo bianco.
* Bordo #CBD5E1.
* Testo #0D3B66.
* Stesse dimensioni del pulsante primario.

Esempi:

* Annulla.
* Visualizza dettagli.
* Torna indietro.

7.3 Pulsante testuale

Utilizzo: azioni leggere e contestuali.

Esempi:

* Vedi tutti.
* Leggi comunicazione.
* Visualizza dettagli.

Testo blu, senza sfondo permanente.

Deve comunque avere un’area interattiva adeguata.

7.4 Pulsante distruttivo

Utilizzo: eliminazioni o operazioni irreversibili.

* Colore rosso semantico.
* Testo esplicito.
* Conferma aggiuntiva quando necessaria.
* Descrizione delle conseguenze.
* Mai usare un semplice colore rosso senza indicare l’azione.

⸻

8. SCHEDE E CONTENITORI

Le schede devono organizzare le informazioni in blocchi facilmente distinguibili.

Regole

* Sfondo bianco.
* Bordo sottile #E5E7EB.
* Border radius 12 px.
* Padding interno 20–24 px sul desktop.
* Padding 16 px sul mobile.
* Titolo nella parte superiore.
* Informazioni correlate raggruppate.
* Azioni principali facilmente individuabili.

Le schede devono avere altezze coerenti quando appartengono alla stessa griglia.

Non utilizzare una scheda per ogni singola frase: raggruppare le informazioni correlate.

Non inserire ombre evidenti su ogni elemento.

⸻

9. ICONE

Utilizzare un’unica libreria di icone lineari, preferibilmente Lucide.

Tutte le icone devono appartenere alla stessa famiglia stilistica.

Dimensioni

* Menu: 20–22 px.
* Azioni: 18–20 px.
* Schede riepilogative: 22–28 px.
* Piccoli indicatori: 16 px.

Regole

* Spessore del tratto uniforme.
* Preferire icone facilmente riconoscibili.
* Non mischiare icone outline e icone piene senza una ragione precisa.
* Non utilizzare emoji come sostituti delle icone.
* Non utilizzare icone decorative prive di significato.
* Le azioni devono avere un’etichetta testuale, soprattutto per gli utenti meno esperti.
* Ogni pulsante composto esclusivamente da un’icona deve avere un nome accessibile e un’indicazione comprensibile.

Esempi di corrispondenze:

* Home: house.
* Spese: coins.
* Pagamenti: credit-card.
* Documenti: file-text.
* Comunicazioni: message-circle.
* Assemblee: users.
* Scadenze: calendar-days.
* Segnalazioni: wrench.
* Impostazioni: settings.
* Assistenza: circle-help.
* Notifiche: bell.
* Ricerca: search.

⸻

10. FORM E CAMPI DI INSERIMENTO

Tutti i moduli devono essere semplici e comprensibili.

10.1 Input

* Altezza minima indicativa: 44–48 px.
* Sfondo bianco.
* Bordo #CBD5E1.
* Border radius 8 px.
* Testo 16 px.
* Padding orizzontale 12–16 px.

Ogni campo deve avere una label visibile.

Non utilizzare il placeholder come unica etichetta.

Esempio:

Email

[Inserisci il tuo indirizzo email]

10.2 Stati

Normale: bordo grigio.

Focus: bordo blu e indicatore di focus visibile.

Errore: bordo rosso e messaggio esplicativo.

Successo: conferma testuale quando utile.

Disabilitato: indicazione chiara dell’indisponibilità.

10.3 Validazione

* Validare i campi obbligatori.
* Spiegare come correggere un errore.
* Conservare i dati già inseriti quando possibile.
* Non mostrare errori prima che l’utente abbia avuto modo di compilare il campo, salvo casi in cui sia necessario.
* Evidenziare il campo interessato.
* Non affidarsi esclusivamente al colore.

Esempio:

“L’indirizzo email non è valido. Controlla il formato e riprova.”

10.4 Conferma

Dopo un’operazione riuscita, mostrare un messaggio chiaro.

Esempio:

“Segnalazione inviata correttamente.”

Non mostrare conferme di operazioni che il server non ha effettivamente completato.

⸻

11. TABELLE E DATI ECONOMICI

Le tabelle devono essere professionali, leggibili e semplici da consultare.

11.1 Stile

* Intestazione con sfondo chiaro.
* Testo delle intestazioni ben leggibile.
* Righe separate da bordi sottili.
* Altezza riga indicativa 52–60 px.
* Padding orizzontale 12–16 px.
* Font 14–16 px.
* Hover leggero sulle righe selezionabili.
* Ordinamento visibile quando disponibile.

11.2 Allineamento

* Testi allineati a sinistra.
* Importi allineati a destra.
* Date visualizzate con formato coerente.
* Azioni in un’ultima colonna.
* Intestazioni brevi e comprensibili.

11.3 Filtri

I filtri devono essere chiari e facilmente individuabili.

Esempi:

* Tutti.
* Da pagare.
* Pagati.
* Scaduti.
* Periodo.
* Ricerca.

Mostrare quali filtri sono attivi e permettere di azzerarli facilmente.

11.4 Tabelle responsive

Su smartphone non comprimere tutte le colonne fino a renderle illeggibili.

Utilizzare, in base al contenuto:

* Elenchi a schede.
* Righe compatte con informazioni essenziali.
* Dettaglio della singola voce.
* Scorrimento orizzontale solo quando necessario.

Le informazioni fondamentali devono rimanere accessibili.

⸻

12. BADGE E STATI

Utilizzare badge per indicare stati, categorie e situazioni.

Esempi:

* Pagato.
* Da pagare.
* Scaduto.
* In lavorazione.
* Completato.
* Non letto.
* In attesa.

Regole

* Badge piccoli ma leggibili.
* Testo sempre presente.
* Colori semantici coerenti.
* Padding interno 8–10 px.
* Forma arrotondata.
* Non utilizzare badge per qualsiasi informazione secondaria.
* Non creare decine di varianti cromatiche.

Gli stati devono avere lo stesso significato in tutte le sezioni del software.

⸻

13. MODALI E CONFERME

Le finestre modali devono essere utilizzate soltanto quando interrompere temporaneamente il flusso è utile.

Esempi:

* Conferma eliminazione.
* Conferma di un’operazione importante.
* Inserimento di una breve informazione.
* Visualizzazione di dettagli che non richiedono una pagina completa.

Regole

* Titolo esplicito.
* Descrizione breve.
* Pulsanti chiaramente distinti.
* Pulsante di chiusura accessibile.
* Focus gestito correttamente.
* Chiusura con Escape quando appropriato.
* Nessuna sovrapposizione con altre modali.
* Su smartphone, dimensioni adattive e contenuto scorrevole.

Per operazioni lunghe o moduli complessi, utilizzare una pagina dedicata invece di una modale.

⸻

14. NOTIFICHE E MESSAGGI

Distinguere quattro categorie.

Successo

Esempio: “Documento caricato correttamente.”

Attenzione

Esempio: “La scadenza è prevista per domani.”

Errore

Esempio: “Non è stato possibile salvare le modifiche. Riprova.”

Informazione

Esempio: “Sono disponibili nuovi documenti.”

Regole

* Messaggi brevi.
* Linguaggio semplice.
* Nessun codice tecnico mostrato all’utente.
* Errori accompagnati da una possibile soluzione.
* Notifiche temporanee per eventi non critici.
* Messaggi persistenti per problemi che richiedono un intervento.
* Non affidarsi soltanto a notifiche che scompaiono rapidamente.

⸻

15. RICERCA, FILTRI E NAVIGAZIONE

La navigazione deve essere prevedibile.

Ricerca globale

Deve consentire di cercare, in base alle autorizzazioni:

* Documenti.
* Comunicazioni.
* Spese.
* Pagamenti.
* Assemblee.
* Segnalazioni.

Mostrare risultati categorizzati, quando utile.

Breadcrumb

Utilizzare breadcrumb nelle sezioni profonde.

Esempio:

Home / Documenti / Bilanci / Bilancio 2025

Non sono necessari nella dashboard o nelle pagine principali.

Navigazione

* Evidenziare sempre la sezione attiva.
* Non cambiare posizione al menu tra le pagine.
* Evitare menu annidati troppo profondi.
* Non nascondere funzioni essenziali in menu poco visibili.
* Mantenere le etichette coerenti in tutto il software.
* Prevedere un modo chiaro per tornare alla pagina precedente.

⸻

16. RESPONSIVE DESIGN

Il software deve funzionare bene su desktop, tablet e smartphone.

Non limitarsi a ridurre la larghezza della versione desktop.

16.1 Desktop

Da circa 1200 px in su:

* Sidebar visibile.
* Header completo.
* Griglie da 3–4 colonne, in base allo spazio.
* Tabelle complete quando leggibili.
* Contenuti distribuiti senza eccessiva larghezza delle righe di testo.

16.2 Tablet

Tra circa 768 e 1199 px:

* Sidebar comprimibile o sostituibile con un menu.
* Griglie da 2 colonne.
* Header semplificato.
* Tabelle adattate.
* Pulsanti e controlli sufficientemente grandi.

16.3 Smartphone

Sotto circa 768 px:

* Menu laterale sostituito da navigazione mobile.
* Contenuti a colonna singola.
* Schede impilate verticalmente.
* Nessuna larghezza fissa che causi overflow.
* Titoli e testi leggibili.
* Form a larghezza disponibile.
* Pulsanti facili da toccare.
* Tabelle trasformate quando opportuno.
* Header compatto.
* Azioni principali facilmente raggiungibili.

Navigazione mobile

Prevedere, quando coerente con le funzioni effettivamente disponibili:

* Home.
* Spese.
* Documenti.
* Messaggi.
* Altro.

Le altre sezioni devono essere raggiungibili facilmente dal menu “Altro”.

Non inserire troppe voci nella barra inferiore.

⸻

17. ACCESSIBILITÀ PER TUTTE LE ETÀ

L’accessibilità è un requisito fondamentale del progetto.

Seguire WCAG 2.2 livello AA come obiettivo di riferimento.

Requisiti

1. Contrasto adeguato tra testo e sfondo.
2. Testo normale preferibilmente da 16 px.
3. Area interattiva minima WCAG di 24 × 24 CSS px, quando applicabile, con spaziatura adeguata; preferire 44–48 px per i controlli principali.
4. Navigazione completa da tastiera.
5. Focus visibile.
6. Etichette per tutti i campi.
7. Nomi accessibili per pulsanti e icone.
8. Messaggi di errore comprensibili.
9. Nessuna informazione affidata soltanto al colore.
10. Testi alternativi per immagini informative.
11. Supporto agli screen reader.
12. Rispetto delle preferenze di riduzione delle animazioni.
13. Layout utilizzabile con ingrandimento del testo.
14. Nessuna dipendenza da interazioni basate esclusivamente sul passaggio del mouse.
15. Tempi adeguati per completare le operazioni.

Linguaggio

Utilizzare italiano semplice e diretto.

Preferire:

* “Paga una rata” invece di “Gestisci la posizione debitoria”.
* “Documenti” invece di “Archivio documentale digitale”.
* “Invia segnalazione” invece di “Attiva workflow di segnalazione”.
* “Scadenza” invece di termini amministrativi non necessari.

Quando serve un termine tecnico, spiegarlo brevemente.

⸻

18. ANIMAZIONI E MICROINTERAZIONI

Le animazioni devono essere discrete e funzionali.

Consentite:

* Transizioni brevi tra stati.
* Hover sui pulsanti.
* Apertura fluida di menu.
* Feedback di caricamento.
* Conferma visiva dopo un’operazione riuscita.
* Indicazione di caricamento durante richieste al server.

Durata indicativa: 120–200 ms per le interazioni semplici.

Evitare:

* Animazioni decorative continue.
* Elementi che lampeggiano.
* Effetti parallax.
* Zoom aggressivi.
* Transizioni lunghe.
* Movimento che rende difficile leggere.
* Animazioni obbligatorie che non rispettano le preferenze dell’utente.

Il software deve rimanere pienamente utilizzabile anche con animazioni ridotte o disattivate.

⸻

19. STATI OBBLIGATORI DI OGNI PAGINA

Ogni pagina deve gestire correttamente tutti questi stati.

Stato normale

I dati sono disponibili e la pagina è pronta.

Stato di caricamento

Mostrare uno skeleton semplice o un indicatore di caricamento.

Evitare schermate vuote senza spiegazioni.

Stato vuoto

Quando non esistono ancora dati, spiegare la situazione.

Esempio:

“Non ci sono ancora documenti disponibili.”

Se appropriato, mostrare l’azione successiva.

Stato di errore

Mostrare un messaggio chiaro e un’opzione per riprovare, se possibile.

Stato senza autorizzazione

Spiegare che la funzione non è disponibile per il ruolo corrente, senza esporre informazioni riservate.

Stato di successo

Confermare l’esito reale dell’operazione.

Questi stati devono essere realizzati come componenti riutilizzabili.

⸻

20. SICUREZZA E AFFIDABILITÀ DELL’INTERFACCIA

Il design non deve mai suggerire che un’operazione sia riuscita quando non è stata completata.

Per pagamenti, documenti e segnalazioni:

* Mostrare stati coerenti con i dati del server.
* Evitare doppi invii accidentali.
* Prevedere indicatori di caricamento.
* Chiedere conferma per operazioni distruttive.
* Non mostrare dati personali a utenti non autorizzati.
* Gestire sessioni scadute con messaggi chiari.
* Non esporre informazioni tecniche sensibili negli errori.
* Conservare le modifiche non inviate quando tecnicamente possibile.
* Non simulare pagamenti o conferme in un ambiente di produzione.

La UI non sostituisce i controlli di autorizzazione e sicurezza del backend.

⸻

21. DESIGN SYSTEM TECNICO

Se il software viene sviluppato con React, utilizzare componenti riutilizzabili e token centralizzati.

Adattare questa indicazione allo stack effettivamente presente nel progetto, senza introdurre una nuova architettura inutilmente.

21.1 Token CSS di riferimento

:root {
  /* Brand */
  --color-primary-navy: #0D3B66;
  --color-primary-blue: #0EA5E9;
  --color-secondary-teal: #14B8A6;
  /* Surfaces */
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-border: #E5E7EB;
  /* Text */
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #64748B;
  /* Semantic */
  --color-success: #15803D;
  --color-warning: #B45309;
  --color-error: #B91C1C;
  --color-info: #0369A1;
  /* Typography */
  --font-family-base: "Inter", sans-serif;
  --font-size-body: 16px;
  --font-size-small: 14px;
  /* Radius */
  --radius-control: 8px;
  --radius-card: 12px;
  --radius-modal: 16px;
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  /* Layout */
  --sidebar-width: 240px;
  --header-height: 72px;
  /* Focus */
  --focus-color: #0284C7;
}

I token devono essere la fonte unica dei valori visivi condivisi.

Non duplicare gli stessi colori con codici diversi nei vari componenti.

21.2 Componenti da creare

Organizzare il progetto in componenti riutilizzabili:

* AppLayout.
* Sidebar.
* MobileNavigation.
* Header.
* SearchBar.
* PageHeader.
* Button.
* IconButton.
* Input.
* Select.
* Textarea.
* Checkbox.
* Radio.
* Card.
* StatCard.
* DataTable.
* MobileDataList.
* Badge.
* Alert.
* Toast.
* Modal.
* ConfirmDialog.
* Tabs.
* Pagination.
* Breadcrumbs.
* EmptyState.
* LoadingState.
* ErrorState.
* Skeleton.
* Avatar.
* Dropdown.
* DatePicker.
* FileUpload.
* NotificationPanel.

Ogni componente deve avere uno stile coerente e stati definiti.

Non ricreare da zero pulsanti, schede e campi in ogni singola pagina.

21.3 Architettura

Separare:

* Componenti UI.
* Layout.
* Pagine.
* Logica applicativa.
* Accesso ai dati.
* Autenticazione e autorizzazioni.
* Tipi e modelli dei dati.
* Utility condivise.

Riutilizzare l’architettura e le dipendenze già presenti, se adeguate.

Non riscrivere o eliminare funzionalità esistenti senza una necessità verificata.

⸻

22. REGOLE PER GENERARE NUOVE PAGINE CON L’IA

Ogni nuova schermata deve rispettare obbligatoriamente queste regole.

1. Riutilizzare la palette ufficiale.
2. Riutilizzare il layout principale.
3. Utilizzare la stessa tipografia.
4. Utilizzare i componenti condivisi.
5. Mantenere menu e navigazione coerenti.
6. Usare etichette italiane semplici.
7. Prevedere stati di caricamento, errore, successo e contenuto vuoto.
8. Adattare la pagina a desktop, tablet e smartphone.
9. Garantire l’accessibilità da tastiera.
10. Non inventare nuove convenzioni visive.
11. Non introdurre librerie aggiuntive senza motivo.
12. Non duplicare componenti esistenti.
13. Non modificare globalmente il design system per risolvere un problema locale.
14. Non inserire dati dimostrativi nella produzione.
15. Non implementare pulsanti puramente decorativi: ogni azione deve funzionare oppure essere esplicitamente indicata come non disponibile.
16. Mantenere coerenti nomi, stati e comportamenti tra le sezioni.
17. Non sostituire la struttura applicativa esistente senza averla analizzata.
18. Verificare la pagina su più dimensioni di schermo.
19. Non eliminare funzionalità esistenti durante un aggiornamento grafico.
20. Preferire la soluzione più semplice che soddisfi tutti i requisiti.

⸻

23. CONTROLLO QUALITÀ PRIMA DEL RILASCIO

Prima di considerare completa una schermata, verificare:

Aspetto visivo

* La palette è rispettata?
* La gerarchia visiva è chiara?
* Le schede sono coerenti?
* I pulsanti hanno le stesse dimensioni e gli stessi stili?
* Le icone appartengono alla stessa famiglia?
* Gli spazi sono uniformi?

Usabilità

* Si capisce subito a cosa serve la pagina?
* L’azione principale è evidente?
* Le etichette sono comprensibili?
* I messaggi di errore sono utili?
* Le azioni importanti richiedono conferma quando necessario?

Accessibilità

* Il contrasto è adeguato?
* Il focus è visibile?
* Si può utilizzare la tastiera?
* Le icone hanno nomi accessibili?
* Il testo può essere ingrandito?
* I controlli sono sufficientemente grandi?

Responsive

* La pagina funziona su desktop?
* Funziona su tablet?
* Funziona su smartphone?
* Le tabelle restano leggibili?
* I pulsanti sono raggiungibili?
* Non esiste scorrimento orizzontale indesiderato?

Funzionamento

* I pulsanti eseguono le azioni previste?
* I dati visualizzati sono reali?
* Gli stati di caricamento sono corretti?
* Gli errori sono gestiti?
* I permessi sono rispettati?
* Non sono state introdotte regressioni?

Non considerare completa una pagina soltanto perché appare bella in uno screenshot.

⸻

24. DIREZIONE CREATIVA FINALE

Il prodotto deve trasmettere:

* Fiducia.
* Ordine.
* Semplicità.
* Professionalità.
* Accessibilità.
* Modernità.
* Sicurezza.

Non deve sembrare un vecchio gestionale amministrativo, ma neppure un’applicazione sperimentale o eccessivamente giocosa.

La combinazione di blu navy, blu brillante, turchese e superfici bianche deve diventare la firma visiva del prodotto.

Ogni pagina deve apparire come parte della stessa famiglia.

L’utente deve imparare a usare il software una volta sola e ritrovare le stesse logiche in tutte le altre sezioni.

⸻

25. PROMPT OPERATIVO PER L’IA DI SVILUPPO

Agisci come un senior UI/UX designer, design system engineer e frontend developer specializzato in applicazioni SaaS professionali e accessibili.

Devi implementare il software condominiale rispettando integralmente tutte le specifiche contenute in questo documento.

Prima di iniziare:

1. Analizza il progetto esistente.
2. Identifica framework, struttura, componenti, routing, dipendenze e funzionalità già presenti.
3. Individua gli elementi riutilizzabili.
4. Definisci un piano di implementazione che minimizzi le modifiche non necessarie.

Successivamente:

1. Implementa il design system centralizzato.
2. Crea o aggiorna i componenti condivisi.
3. Realizza il layout desktop e mobile.
4. Applica la palette, la tipografia, le spaziature e gli stati descritti.
5. Implementa le schermate richieste riutilizzando i componenti.
6. Collega i componenti ai dati e alle azioni reali disponibili nel progetto.
7. Gestisci caricamento, errori, stati vuoti e conferme.
8. Verifica accessibilità, responsive design e coerenza visiva.
9. Esegui i test disponibili e correggi i problemi riscontrati.
10. Riporta le funzionalità completate, quelle ancora mancanti e le eventuali limitazioni.

Vincoli obbligatori

* Non creare pagine scollegate tra loro.
* Non duplicare il design system.
* Non inventare funzionalità backend.
* Non simulare operazioni reali non implementate.
* Non rimuovere funzionalità esistenti senza autorizzazione.
* Non utilizzare dati personali reali negli esempi.
* Non lasciare pulsanti senza comportamento.
* Non ignorare gli stati di errore.
* Non sacrificare leggibilità e accessibilità per ottenere un aspetto più estetico.
* Non limitarti a produrre un mockup statico se è richiesto software funzionante.

Risultato atteso

Un software condominiale con un’identità visiva moderna e professionale, una struttura coerente, componenti riutilizzabili, navigazione intuitiva, interfaccia responsive e un’esperienza accessibile a persone di tutte le età.

La qualità deve essere valutata sia dal punto di vista visivo sia dal punto di vista funzionale.

Se un requisito non è realizzabile con le informazioni o le risorse disponibili, dichiaralo esplicitamente e proponi una soluzione coerente con il design system, senza fingere che sia già implementato.