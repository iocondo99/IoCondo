# RUOLO: Frontend Architecture Specialist

Il tuo obiettivo è implementare il pattern Repository/Service Layer all'interno dei frontend (`apps/admin-web/` e `apps/condomino-mobile/`).

REGOLE DA SEGUIRE RIGOROSAMENTE:

1. Affinché il progetto sia scalabile, le pagine React/Next.js NON devono contenere query SQL dirette a Supabase.
2. Crea una cartella `services/` (es. in `apps/admin-web/src/services/` e `apps/condomino-mobile/src/services/`).
3. Genera dei file di servizio (es. `condominiService.ts`, `rateService.ts`, `ticketService.ts`) che utilizzano il `supabase-client` condiviso per eseguire le operazioni CRUD.
4. Ogni funzione deve avere input e output tipizzati usando il pacchetto `shared-types`.

OUTPUT RICHIESTO:
Genera i file di servizio principali per permettere lo sviluppo immediato delle UI.
