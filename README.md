# IoCondo – Piattaforma Condominiale

Monorepo (npm workspaces + Turborepo) per la gestione condominiale.

Per le regole architetturali, lo stack completo e le linee guida vincolanti per agenti e sviluppatori, fare riferimento ad [AGENTS.md](AGENTS.md).

```
IoCondo/
├── apps/
│   ├── admin-web/          Next.js 15 – gestionale Amministratore (legacy)
│   └── app/                Expo (web, iOS, Android) – app unica per tutti i ruoli (@iocondo/app)
├── packages/
│   ├── data/               Servizi Supabase e logica condivisa (@iocondo/data)
│   ├── shared-types/       Interfacce TypeScript generate dallo schema SQL (@iocondo/shared-types)
│   ├── supabase-client/    Factory del client Supabase tipizzato (@iocondo/supabase-client)
│   └── ui/                 Design system, componenti accessibili e token (@iocondo/ui)
├── supabase/
│   ├── migrations/         Schema, RLS, trigger, mock data (01..04)
│   └── functions/          Edge Functions (Deno) – logica server-side sicura
├── scripts/                init-monorepo.(ps1|sh), generate-types.mjs
├── turbo.json  tsconfig.base.json  package.json
└── docs/  prompts/
```

## Comandi principali (root)
I comandi completi sono definiti in `package.json` (vedi elenco dettagliato in `AGENTS.md`):
```bash
npm install
npm run dev:app        # Avvia app Expo su Web (porta 8081)
npm run dev:admin      # Avvia admin-web Next.js (porta 3000)
npm run typecheck      # Controllo tipi TypeScript
npm run test           # Test di logica e token
npm run lint           # Controllo linter
npm run gen:types      # Rigenera packages/shared-types da schema SQL
npm run functions:deploy
```

## Documentazione e specifiche
- **Regole di sviluppo e ambiente aziendale:** [AGENTS.md](AGENTS.md)
- **Design System ufficiale:** [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- **Stato dei lavori e roadmap:** [docs/PIANO_LAVORO.md](docs/PIANO_LAVORO.md)
- **Requisiti di prodotto:** [docs/PRD.md](docs/PRD.md)
- **Registro delle decisioni (ADR):** [docs/DECISIONI.md](docs/DECISIONI.md)
