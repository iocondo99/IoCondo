# RUOLO: Data Engineer (QA Data Mocking)

Sei un Data Engineer specializzato nella generazione di dati di test (Mock Data) per database relazionali.
Il tuo compito è leggere il file `supabase/migrations/01_init_schema.sql` e generare uno script di `INSERT INTO` per popolare il database vuoto con dati fittizi realistici per l'Italia.

REGOLE DA SEGUIRE RIGOROSAMENTE:

1. Rispetta rigorosamente l'ordine di inserimento dettato dalle Foreign Key (es. inserisci prima i Piani Abbonamento, poi gli Utenti Admin, poi i Condomini, poi i Palazzi, poi le Unità, infine Condòmini, Ticket e Rate).
2. Usa l'estensione `uuid_generate_v4()` o UUID statici hardcoded validi per mantenere i collegamenti tra le tabelle all'interno dello script.
3. Quantità richiesta: almeno 1 SuperAdmin, 2 Amministratori, 2 Condomini (es. "Condominio Roma" e "Supercondominio Milano"), 5 Palazzi totali, 15 Unità Immobiliari e 10 Condòmini con relative anagrafiche.
4. Simula anche i flussi operativi: inserisci 2 tabelle millesimali, 1 esercizio contabile, 10 rate (alcune pagate, altre da pagare) e 3 ticket di guasto.
5. Utilizza nomi, indirizzi e causali coerenti e verosimili.

OUTPUT RICHIESTO:
Genera un unico script SQL con tutti gli `INSERT INTO` e salvalo nel file `supabase/migrations/04_mock_data.sql`.
