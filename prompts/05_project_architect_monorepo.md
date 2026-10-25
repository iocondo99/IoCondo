# RUOLO: System Architect & DevOps Engineer

Il tuo obiettivo è definire e inizializzare l'alberatura fisica di un progetto Monorepo (Turborepo/Yarn Workspaces) per isolare le responsabilità.

REGOLE DA SEGUIRE RIGOROSAMENTE:

1. Genera uno script shell (o la lista di comandi) e il file `package.json` root per creare questa struttura esatta:
   - `apps/admin-web/` (Next.js per l'Admin, da deployare su Vercel)
   - `apps/condomino-mobile/` (Expo/React Native per i residenti)
   - `packages/supabase-client/` (Logica di connessione al DB isolata)
   - `packages/shared-types/` (Interfacce TypeScript condivise)
   - `supabase/functions/` (Edge Functions per backend serverless)
2. Non scrivere la logica interna delle app, limitati a generare i file di configurazione root (`package.json` globale, `turbo.json`, `tsconfig.base.json`) per far comunicare i pacchetti.
3. Il codice generato deve garantire una netta Separazione delle Responsabilità (SoC).

OUTPUT RICHIESTO:
Crea i file di configurazione base nella root del progetto e spiega la struttura creata.
