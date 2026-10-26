# RUOLO: Senior Mobile Architect (React Native, Expo, TypeScript)

Il tuo compito è sviluppare `apps/condomino-mobile/` con Expo Router, garantendo massima responsività e un'esperienza ultra-accessibile (Senior-Friendly WCAG AAA) per i residenti, oltre alla modalità operativa per il portiere.

SPECIFICHE ARCHITETTURALI & UX:

1. **Modalità Condòmino (Senior-Friendly & Zero Barriere)**:
   - **Tipografia e Tasti XL**: Bottoni con altezza minima 58px, angoli arrotondati (14px), font ad alto contrasto per consentire la lettura senza occhiali.
   - **Riquadro Semaforico Saldo**:
     - _Tutto in Regola_: Scheda verde rassicurante con spunta gigante ("Tutti i pagamenti sono saldati").
     - _Rata da Pagare_: Scheda ambra con importo chiaro (`€ 145,00`), scadenza e due bottoni enormi: "PAGA ORA CON 1 TOCCO" (integrazione Apple Pay / Google Pay) e "STAMPA BOLLETTINO" (modulo `expo-print` per inviare alla stampante di casa).
   - **Segnalazione Guasti Visiva (Nessuna digitazione richiesta)**:
     - Selezione del problema tramite 5 pulsanti a griglia con icone giganti (Ascensore, Lampadine, Portone, Acqua/Tubi, Altro).
     - Integrazione fotocamera nativa (`expo-image-picker`) con anteprima scatto.
     - Invio immediato con vibrazione aptica (`expo-haptics`).
   - **Pulsante "Chiama Amministratore"**: Apre direttamente il dialer telefonico (`Linking.openURL('tel:...')`).

2. **Modalità Switch Portiere / Staff**:
   - Accessibile tramite selettore di ruolo se l'utente ha permessi di portineria.
   - Schermata registro pacchi: lista delle giacenze per interno, bottone rapido "Registra Nuovo Pacco" e pulsante "Invia Notifica Sollecito" che attiva la push notification al residente.

3. **Struttura Navigazione**:
   - Usa `expo-router` con layout a Tab inferiori (`app/(tabs)/_layout.tsx`) ad alto contrasto (Home, Spese/Ricevute, Avvisi, Profilo/Aiuto).

OUTPUT RICHIESTO:
Genera i file di configurazione (`app.json`, `package.json`), la navigazione principale, e le viste chiave `HomeScreen.tsx`, `ReportIssueScreen.tsx` e `ParcelScreen.tsx` pronte all'uso.
