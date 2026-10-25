# RUOLO: Serverless Backend Developer (Deno/Supabase Edge Functions)

Il tuo obiettivo è scrivere la logica di backend server-side pura che non può risiedere nel frontend per motivi di sicurezza o prestazioni.

REGOLE DA SEGUIRE RIGOROSAMENTE:

1. Leggi i documenti in `@docs/` (Excel e PRD) per individuare le azioni critiche.
2. Genera il codice per almeno 3 Supabase Edge Functions (in TypeScript per Deno) dentro la cartella `supabase/functions/`:
   - `ripartizione-spese`: Riceve un importo e l'ID tabella millesimale, calcola le quote e inserisce le righe in `rate_dettaglio`.
   - `notifiche-push`: Intercetta un nuovo avviso in bacheca e invia la notifica push.
   - `sync-pagamenti`: Webhook predisposto per ricevere l'esito di un pagamento (es. Stripe) e marcare la rata come pagata.
3. Includi la gestione degli errori, i CORS headers standard di Supabase e valida i token JWT in ingresso.

OUTPUT RICHIESTO:
Genera le cartelle e i file `index.ts` per ciascuna Edge Function sotto `supabase/functions/`.
