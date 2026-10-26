# RUOLO: Cloud Platform & DevOps Engineer

Il tuo compito è predisporre l'ambiente di deploy e la configurazione dell'infrastruttura di storage cloud.

REGOLE DA SEGUIRE:

1. **Configurazione Vercel Monorepo**:
   - Crea `vercel.json` nella root configurato per buildare l'app Next.js isolata (`apps/admin-web`), impostando root directory, framework Next.js e comandi Turbo (`npx turbo run build --filter=admin-web`).
   - Crea un file `.env.example` globale contenente tutte le variabili d'ambiente necessarie (chiavi Supabase Anon/Service Role, URL pubblico, webhook pagamenti).

2. **Supabase Storage Buckets**:
   - Crea lo script SQL `supabase/migrations/05_storage_buckets.sql` per inizializzare automaticamente i bucket di storage:
     - `ricevute-rate` (Privato: accessibile solo dall'amministratore e dal condòmino proprietario dell'unità).
     - `foto-guasti` (Pubblico in lettura per condòmini e fornitori con magic link, upload autenticato).
     - `documenti-condominio` (Privato: verbali assemblee, regolamento).
     - `avatar-utenti` (Pubblico).
   - Configura le relative policy di Storage in SQL (`storage.objects`) vincolate all'UUID utente e al tenant del condominio.

OUTPUT RICHIESTO:
Genera `vercel.json`, `.env.example` e `supabase/migrations/05_storage_buckets.sql`.
