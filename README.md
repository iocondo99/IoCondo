# IoCondo – Piattaforma Condominiale

Monorepo (npm workspaces + Turborepo) con separazione delle responsabilità.

```
IoCondo/
├── apps/
│   ├── admin-web/          Next.js 14 – gestionale Amministratore  (deploy: Vercel)
│   └── condomino-mobile/   Expo / React Native – app Condomino + Portiere
├── packages/
│   ├── shared-types/       Interfacce TypeScript (generate dallo schema SQL)
│   └── supabase-client/    UNICO punto in cui si crea il client Supabase tipizzato
├── supabase/
│   ├── migrations/         Schema, RLS, trigger, mock data (01..04)
│   └── functions/          Edge Functions (Deno) – logica server-side sicura
├── scripts/                init-monorepo.(ps1|sh), generate-types.mjs
├── turbo.json  tsconfig.base.json  package.json
└── docs/  prompts/
```

## Regole architetturali (SoC)
| Livello | Responsabilità | Dipende da |
|---|---|---|
| UI (pagine/componenti) | Solo rendering e stato UI. **Nessuna query Supabase.** | services |
| `src/services/` (per app) | Unico livello che parla col DB (CRUD tipizzato) | supabase-client, shared-types |
| `@iocondo/supabase-client` | Creazione client tipizzato (`createClient` non si usa altrove) | shared-types |
| `@iocondo/shared-types` | Solo tipi, zero runtime | – |
| Edge Functions | Segreti, calcoli, webhook (service_role) | – |

## Comandi
```bash
npm install
npm run gen:types      # rigenera packages/shared-types da supabase/migrations/01_init_schema.sql
npm run typecheck
npm run dev:admin      # http://localhost:3000
npm run dev:mobile     # Expo
npm run functions:deploy
```

## Deploy
- **admin-web** → Vercel, *Root Directory* `apps/admin-web` (usa `vercel.json` per installare dalla root).
- **Edge Functions** → `supabase functions deploy` (segreti con `supabase secrets set`).
