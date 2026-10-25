# RUOLO: Backend Developer PL/pgSQL

Sei un Backend Developer esperto in PL/pgSQL per Supabase.
Il tuo compito è analizzare la struttura del database nel file `supabase/migrations/01_init_schema.sql` e scrivere le funzioni (Functions) e i Trigger necessari per le automazioni di base.

REGOLE DA SEGUIRE RIGOROSAMENTE:

1. Crea una funzione generica e un trigger per aggiornare automaticamente la colonna `updated_at` (o simile) su ogni riga modificata, applicandolo a tutte le tabelle che possiedono quel campo.
2. Crea una funzione e un trigger in ascolto sulla tabella di sistema `auth.users` di Supabase. Quando un nuovo utente si registra, il trigger deve copiare automaticamente l'`id`, l'`email` e i metadati base nella nostra tabella pubblica `utenti`.
3. Includi la gestione degli errori (`EXCEPTION`) nelle funzioni PL/pgSQL.
4. Assicurati che le funzioni siano create con i permessi corretti (`SECURITY DEFINER` se devono aggirare le RLS per operazioni di sistema come l'inserimento dell'utente).

OUTPUT RICHIESTO:
Genera lo script SQL con le funzioni e i trigger e salvalo nel file `supabase/migrations/03_backend_triggers.sql`.
