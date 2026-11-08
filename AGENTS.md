# Regole di Progetto — IoCondo

Fonte unica di verità per agenti e sviluppatori.

## Ambiente aziendale
- PC aziendale: tutto resta dentro la cartella del progetto. Non modificare file fuori dal progetto né configurazioni globali (profilo utente, ~/.claude, ~/.gemini, variabili d'ambiente, registro di sistema).
- Mai installazioni globali: niente `npm install -g`, niente `pip install` fuori da un ambiente virtuale `.venv` dentro il progetto.
- Prima di aggiungere una dipendenza, un plugin, un MCP o un hook, chiedi conferma e dimmi cosa scarica e dove scrive.
- Non disattivare controlli di sicurezza (certificati TLS, `npm audit fix --force`, hook git).
- Per i test E2E usa Edge già installato (`channel: 'msedge'`), senza scaricare browser.
- Segreti: `.env*` mai in git, chiave `service_role` mai nel client, mai chiavi nei log.
- Niente commit o push se non te lo chiedo io.

## Stack tecnologico
- Monorepo: npm workspaces + Turborepo. Node >= 22.13.
- `apps/app` (@iocondo/app): Expo SDK 58, React 19.3, React Native 0.88, expo-router. Unica app per tutti i ruoli. Ora attiva su Web.
- `apps/admin-web` (@iocondo/admin-web): Next.js 15.5 (legacy, da dismettere a migrazione ultimata).
- `packages/data` (@iocondo/data): servizi Supabase e hook di pura logica. Nessuna dipendenza da Expo.
- `packages/supabase-client` (@iocondo/supabase-client): unica factory del client Supabase tipizzato e storage di sessione.
- `packages/shared-types` (@iocondo/shared-types): interfacce DB e ruoli derivate dallo schema SQL.
- `packages/ui` (@iocondo/ui): token, componenti accessibili, icone Lucide.
- Backend: Supabase (Postgres, Auth, RLS, Storage, Edge Functions Deno in supabase/functions).

## Comandi disponibili (root package.json)
- `npm run dev`: avvia tutti i workspace con Turbo.
- `npm run dev:app`: avvia l'app Expo (`apps/app`).
- `npm run dev:admin`: avvia admin-web su porta 3000.
- `npm run build`: compila tutti i pacchetti.
- `npm run lint`: esegue il linter su tutti i workspace.
- `npm run test`: esegue i test unitari con node test runner.
- `npm run typecheck`: verifica statica dei tipi TypeScript.
- `npm run gen:types`: rigenera `packages/shared-types` dallo schema SQL.
- `npm run db:push`: sincronizza lo schema con `supabase db push --linked`.
- `npm run functions:serve`: serve le Edge Functions in locale.
- `npm run functions:deploy`: deploy delle Edge Functions.
- `npm run clean`: rimuove dist, .next e node_modules.

## Architettura e separazione delle responsabilità (SoC)
- Nessuna query o chiamata Supabase dentro i componenti UI.
- La UI usa solo i servizi e gli hook forniti da `@iocondo/data`.
- I servizi in `packages/data` ricevono il client Supabase dal chiamante (dependency injection) e non lo istanziano.
- Solo `@iocondo/supabase-client` crea l'istanza di Supabase.
- `SUPER_ADMIN` è il flag booleano `utenti.is_superadmin` (non è riga in `ruoli_piattaforma`).
- `FORNITORE` accede via magic link con token dedicato (`fornitori_tokens`), senza account utente.
- Nessun dato dimostrativo e nessun pagamento simulato nell'app.

## Supabase, Database e RLS
- La sicurezza primaria risiede nelle policy RLS del database. Le guardie client servono solo per la navigazione.
- Il database Supabase è in sola lettura per l'agente: non eseguire migrazioni o DDL direttamente.
- Proponi modifiche solo come file in `supabase/seed-dev/` (dati test) o `supabase/da-applicare/` (migrazioni).
- L'ambiente Supabase attuale (MVP) va trattato con cautela: nessuna operazione distruttiva.
- Documenti e file sensibili stanno in bucket privati con link firmati a scadenza temporanea.

## UI e Design System
- Leggi sempre `DESIGN_SYSTEM.md` prima di qualsiasi modifica UI: ha priorità assoluta.
- Mobile-first e responsive: stesso codice per Web, Android e iOS.
- Nessun tag HTML né CSS web-only (`<div>`, `<span>`, classi CSS) in `apps/app` e `packages/ui`.
- Usa solo componenti React Native (`View`, `Text`, `Pressable`, `StyleSheet`).
- Valori di stile esclusivamente da `packages/ui/src/tokens.ts`. Zero colori o misure hardcoded.
- Icone esclusivamente da `lucide-react-native`.
- Desktop: sidebar blu navy. Smartphone: barra inferiore.
- Accessibilità: navigazione da tastiera, contrasto elevato, focus ring inset `#0284C7` mai tagliato.
- Modali: non annidare mai `<ScrollView>` dentro `<Modal>` di `@iocondo/ui`.

## Regole di lavoro per l'agente
- Lavora esclusivamente all'interno della cartella del progetto.
- Nessun comando git non richiesto (`add`, `commit`, `push`, `stash`, `reset`, `checkout`, `restore`, `clean`).
- Non leggere, stampare o esporre file `.env*`.
- Prima di ogni sessione leggi `docs/PIANO_LAVORO.md` per lo stato dei task.
- Il PRD è in `docs/PRD.md`: consultalo solo quando serve per i requisiti funzionali.
- Un task alla volta. Non spuntare le caselle in `docs/TEST_DA_FARE.md` (spetta all'utente).
