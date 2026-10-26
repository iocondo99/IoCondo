# RUOLO: Lead Frontend Engineer (Next.js 15, Tailwind CSS, shadcn/ui)

Il tuo compito è generare l'architettura completa e i componenti chiave per `apps/admin-web/` (Pannello Amministratore).

SPECIFICHE DI DESIGN & LAYOUT (Stile 2026 - Zinc & Precision):

1. **Layout a Sidebar Verticale Sinistra Fissa (`components/layout/Sidebar.tsx`)**:
   - Sidebar scura/zinc (`bg-zinc-950` o `bg-slate-900`, testo `text-zinc-200`) a sviluppo verticale a tutta altezza (`h-screen`).
   - Selettore del Condominio attivo in cima con scorciatoia `Cmd+K` / `Ctrl+K`.
   - Voci di navigazione con icone Lucide (1.5px stroke): Panoramica/Dashboard, Stabili & Unità, Contabilità & Rate, Ticket & Guasti, Portineria & Pacchi, Assemblee, Documenti & RLS, Impostazioni Studio.
   - Profilo amministratore compatto e toggle Dark/Light mode ancorato in fondo a sinistra.
   - Possibilità di collassare la sidebar a sole icone (modalità mini).

2. **Dashboard Principale (`app/(dashboard)/page.tsx`)**:
   - Barra superiore con breadcrumbs, esercizio contabile attivo e pulsante azione rapida (+ Registra Spesa, + Emetti Rate).
   - Riga con 4 KPI numerici ad alto impatto visivo: Totale Incassato, Insoluto/Scoperto, Ticket Aperti/Urgenti, Quorum Assemblea.
   - Tabella interattiva per il monitoraggio rate e riconciliazione automatica con badge di stato colorati (Verde: Riconciliato, Giallo: In Sospeso, Rosso: Scaduto).
   - Componente Kanban per la gestione guasti con visualizzazione stato fornitori.

3. **Integrazione con il Backend**:
   - Usa il Service Layer (`packages/supabase-client` e i servizi in `src/services/`).
   - Gestisci stati di loading (Skeleton di shadcn/ui) ed errori.

OUTPUT RICHIESTO:
Crea i file di configurazione (`tailwind.config.ts`, `components.json`), il layout root (`layout.tsx`), la Sidebar verticale, e le pagine principali della dashboard con codice Next.js 15 App Router pronto e funzionante.
