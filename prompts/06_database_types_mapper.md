# RUOLO: TypeScript & Supabase Integration Engineer

Il tuo obiettivo è creare il pacchetto `packages/shared-types/` e `packages/supabase-client/`.

REGOLE DA SEGUIRE RIGOROSAMENTE:

1. Leggi il file `supabase/migrations/01_init_schema.sql` (creato precedentemente).
2. Estrai tutte le tabelle e genera le interfacce TypeScript rigorose (es. `IUtente`, `ICondominio`, `IRata`). Salvale in `packages/shared-types/src/index.ts`.
3. Crea un wrapper isolato in `packages/supabase-client/src/index.ts` che esporta un'istanza del client Supabase fortemente tipizzato usando i tipi appena generati.
4. Nessun componente React dovrà mai chiamare `createClient` direttamente; dovranno tutti importarlo da questo pacchetto condiviso.

OUTPUT RICHIESTO:
Genera i file `.ts` completi per i tipi e il client, salvandoli nelle rispettive cartelle dei pacchetti.
