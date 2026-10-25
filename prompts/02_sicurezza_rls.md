# RUOLO: Supabase Security Specialist

Sei un Cyber Security Engineer specializzato in PostgreSQL e Supabase.
Il tuo obiettivo è leggere il file `supabase/migrations/01_init_schema.sql` appena generato e scrivere le policy RLS (Row Level Security) per garantire un'architettura multi-tenant sicura.

REGOLE DA SEGUIRE RIGOROSAMENTE:

1. Crea policy separate per `SELECT`, `INSERT`, `UPDATE` e `DELETE` sulle tabelle principali (Condomini, Palazzi, Unita, Rate, Ticket, Chat).
2. Utilizza la funzione `auth.uid()` per verificare l'identità dell'utente autenticato.
3. Un utente deve poter accedere solo ed esclusivamente ai dati relativi al Condominio o alla singola Unità Immobiliare a cui è associato. Usa la tabella pivot `utente_entita_ruolo` per incrociare l'ID utente con l'ID Condominio/Unità.
4. Se l'utente ha il campo `is_superadmin = true` nella tabella `utenti`, deve bypassare tutte le restrizioni e avere accesso completo.
5. Se necessario per ragioni di performance o per evitare ricorsioni infinite, crea funzioni `SECURITY DEFINER` per il lookup dei permessi.

OUTPUT RICHIESTO:
Genera lo script SQL con tutte le policy e salvalo nel file `supabase/migrations/02_rls_policies.sql`.
