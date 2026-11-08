# Audit Schema Contabile e Piano di Migrazione — Passo 0 (`RC-O1` – `RC-O13`, `T18` – `T22`)

Documento di allineamento preventivo dello schema contabile (`RC-O6`), redatto in sola lettura confrontando lo schema esistente (`01_init_schema.sql`, `02_rls_policies.sql`, `03_backend_triggers.sql`, `05_security_hardening.sql`, `06_fix_missing_cases.sql`, `07`–`09`) con il **Modello Obiettivo** (Sezione 3 di `requisiti_contabile_completo.txt`).

---

## 1. Mappa delle Dipendenze nel Codice Esistente (`RC-O8`)

Prima di progettare la migrazione sono stati censiti tutti i punti del codice che leggono o scrivono sulle tabelle contabili attuali, per garantire **zero interruzioni** (`T20`):

| File / Modulo | Tabelle utilizzate | Colonne critiche lette / scritte |
|---|---|---|
| `packages/data/src/spese/speseService.ts` | `esercizi_contabili`, `piano_dei_conti`, `sottoconti`, `fornitori`, `movimenti_contabili` | `importo` (`numeric`), `tipo` (`USCITA`), `data`, `descrizione`, `esercizio_id`, `sottoconto_id`, `fornitore_id`, `url_giustificativo` |
| `packages/data/src/pagamenti/pagamentiService.ts` | `rate_dettaglio`, `rate_testata`, `esercizi_contabili`, `pagamenti_rate`, `transazioni_bancarie`, `riconciliazioni_log`, `saldi_pregressi` | `importo_dovuto`, `importo_pagato`, `importo`, `importo_assegnato`, `stato` |
| `packages/data/src/services/rateService.ts` | `rate_dettaglio`, `rate_testata`, `pagamenti_rate` | `importo_dovuto`, `importo_pagato`, `stato`, `importo` |
| `packages/data/src/services/homeService.ts` | `rate_dettaglio`, `rate_testata` | `importo_dovuto`, `importo_pagato`, `stato` |
| `packages/data/src/admin/adminDashboardService.ts` | `esercizi_contabili`, `rate_testata`, `rate_dettaglio`, `movimenti_contabili`, `pagamenti_rate` | `importo_dovuto`, `importo_pagato`, `importo`, `stato` |
| `packages/data/src/admin/strutturaService.ts` | `unita_immobiliari`, `anagrafiche_unita`, `tabelle_millesimali`, `quote_millesimali` | `tipo_possesso` (`PROPRIETARIO`/`INQUILINO`), `percentuale_possesso`, `valore_millesimale` |
| `supabase/functions/ripartizione-spese/index.ts` | `esercizi_contabili`, `tabelle_millesimali`, `quote_millesimali`, `anagrafiche_unita`, `rate_testata`, `rate_dettaglio` | `valore_millesimale`, `importo_totale`, `importo_dovuto` |
| `supabase/functions/sync-pagamenti/index.ts` | `pagamenti_rate`, `rate_dettaglio`, `transazioni_bancarie`, `riconciliazioni_log` | `importo`, `importo_pagato`, `importo_assegnato`, RPC `pagamento_completato` |
| `supabase/seed-dev/*.sql` | Tutte le tabelle contabili | Inserimenti diretti sulle colonne legacy senza `condominio_id` sulle tabelle figlie |

---

## 2. Tabella di Confronto Entità per Entità (`RC-O1`, `RC-O6`, `RC-O7`)

| Entità Modello Obiettivo (Sez. 3) | Tabella Attuale | Stato | Differenze Rilevate e Azione in `10_contabilita_schema_modello_obiettivo.sql` |
|---|---|---|---|
| **Soggetto** (`RC-A8`) | `utenti`, `fornitori` | **Mancante / Estesa** | Creata `soggetti_contabili` (persona fisica/giuridica separata dall'unità, CF, P.IVA, PEC, IBAN). Estesa `fornitori` con `condominio_id`, `codice_fiscale`, `pec`, `indirizzo`. |
| **Titolarità Unità** (`RC-A9`..`A12`, `RC-H`, `RC-I`) | `anagrafiche_unita` | **Da estendere** | Aggiunte: `condominio_id`, `soggetto_id`, `ruolo_titolarita` (`PROPRIETARIO`, `COMPROPRIETARIO`, `USUFRUTTUARIO`, `NUDO_PROPRIETARIO`, `CONDUTTORE`), `is_referente_bollettino`, `contratto_inizio`/`fine`, `patto_contrario_oneri`, `tabella_oneri_custom`, `regola_usufrutto_custom`, `data_atto_subentro`, `dante_causa_utente_id`, `note_patto_straordinarie`, `autore_id`. |
| **Assegnazione Amministratore** (`RC-A13`..`A16`, `T17`) | Solo `condomini.admin_id` | **Mancante** | Creata `assegnazioni_amministratore` (storico nomine/cessazioni, ruoli `AMMINISTRATORE`/`COLLABORATORE`/`REVISORE`/`CONSIGLIERE`, permessi collaboratore, compenso annuo in centesimi, indice parziale di unicità su 1 solo admin attivo per condominio). |
| **Tabella Millesimale e Quote** (`RC-A3`..`A7`, `RC-O4`) | `tabelle_millesimali`, `quote_millesimali` | **Da estendere** | Su `tabelle_millesimali`: `tipo`, `origine` (`INSERITA`/`DERIVATA`), `tabella_sorgente_id`, `da_rigenerare`, `stato_approvazione` (`BOZZA`/`APPROVATA`), `data_approvazione`, `delibera_riferimento`, `valida_da`/`valida_a`, `versione`, `precedente_id`, `autore_id`. Su `quote_millesimali`: `condominio_id`, `valore_millesimi_int` (millesimi × 1000 interi), `autore_id`, `created_at`, `updated_at`. |
| **Esercizio e Gestione** (`RC-D1`, `RC-K1`..`K8`, `T15`) | `esercizi_contabili` | **Da estendere + Nuova tabella** | Estesa `esercizi_contabili` con `stato_modello` (`APERTO`, `CHIUSO`, `RENDICONTO_APPROVATO`), `data_chiusura_effettiva`, `data_approvazione_rendiconto`, `delibera_approvazione`, `scadenza_approvazione_180gg`, saldi iniziali/finali c/c e cassa in centesimi, `stato_rendiconto`, `nota_sintetica_esplicativa`, `riepilogo_finanziario_json`, `registro_contabilita_completo`, `versione_lock`, `autore_id`. Creata `gestioni_esercizio` (`ORDINARIA`, `STRAORDINARIA`, `RISCALDAMENTO`). |
| **Preventivo e Rata** (`RC-D2`..`D5`, `T16`) | `rate_testata`, `rate_dettaglio` | **Da estendere + Nuove tabelle** | Create `preventivi` (versionati: `BOZZA`, `APPROVATO`, `SUPERATO`) e `preventivi_voci`. Estesa `rate_testata` con `condominio_id`, `gestione_id`, `preventivo_id`, `versione_preventivo`, `stato_preventivo`, `delibera_approvazione`, `emessa_con_override`, `motivo_override`, `delibera_override`, `numero_rata`, `percentuale_preventivo`. Estesa `rate_dettaglio` con `condominio_id`, `soggetto_id`, `obbligato_in_solido_utente_id`, `importo_dovuto_centesimi`, `importo_pagato_centesimi`, `stato_rata_modello`, `data_esigibilita`, `bollettino_id`, `versione_motore_calcolo`. |
| **Spesa e Riparto Spesa** (`RC-B`, `RC-C`, `T1`..`T3`, `T8`..`T10`) | `movimenti_contabili` | **Da estendere + Nuove tabelle** | Creata `voci_spesa_catalogo` (popolata con le 10 voci standard per ogni condominio) e `riparti_spese` (quota calcolata, resto arrotondamento, quota finale in centesimi, quote proprietario/conduttore/usufruttuario, giorni titolarità, `da_conguagliare`, `versione_motore_calcolo`). Estesa `movimenti_contabili` con `condominio_id`, `gestione_id`, `voce_spesa_id`, `importo_centesimi`, `tag_spesa`, `competenza_da`/`a`, `chi_paga`, `tabella_millesimale_id`, `versione_tabella`, `palazzo_id`, `scala_colonna_id`, `atto_deroga_*`, `delibera_riferimento`, `stato_spesa`, `storno_di_id`, `eccezione_conto_corrente`, `motivo_eccezione_cc`, `impronta_file_giustificativo`, `imponibile_centesimi`, `iva_centesimi`, `ritenuta_acconto_centesimi`, `fondo_id`, `versione_motore_calcolo`. |
| **Lettura Contatore** (`RC-C5`, `RC-H6`, `T9`) | *Assente* | **Mancante** | Creata `letture_contatori` (`ACQUA`, `RISCALDAMENTO`, `ACQUA_CALDA`, lettura reale/stimata, flag `is_subentro`, `da_conguagliare`). |
| **Bollettino** (`RC-E1`..`E6`, `T11`, `T13`) | *Assente* | **Mancante** | Create `bollettini` (numerazione progressiva annua per condominio, stati `BOZZA` -> `VERIFICATO` -> `EMESSO` -> `PARZIALMENTE_PAGATO`/`PAGATO`/`RETTIFICATO`/`ANNULLATO`, `sostituisce_id`, `sostituito_da_id`, `anomalie_rilevate`, `versione_lock`) e `bollettini_righe` (vincolo `UNIQUE (bollettino_id, rata_dettaglio_id)`). |
| **Incasso e Imputazione** (`RC-F1`..`F4`, `T11`) | `pagamenti_rate`, `transazioni_bancarie`, `riconciliazioni_log` | **Da estendere** | Aggiunti `condominio_id`, `importo_centesimi`, `pagatore_nome`, `pagatore_utente_id`, `riferimento_cro`, `data_valuta`, `storno_di_id`, `autore_id` su `pagamenti_rate` e `transazioni_bancarie`; aggiunti `condominio_id`, `importo_assegnato_centesimi`, `bollettino_id`, `saldo_pregresso_id`, `autore_id` su `riconciliazioni_log`. |
| **Fondo e Movimento Fondo** (`RC-J1`..`J5`, `T7`) | *Assente* | **Mancante** | Create `fondi` (`SPECIALE`, `CASSA`, `MOROSITA`, vincolo di destinazione, SAL) e `movimenti_fondo` (accantonamento, utilizzo, giroconto, override tracciato con motivo e delibera). |
| **Saldo Pregresso e Morosità 6 mesi** (`RC-G1`..`G4`, `T6`, `T12`) | `saldi_pregressi`, `solleciti_morosita` | **Da estendere + Nuova tabella** | Estesa `saldi_pregressi` con `condominio_id`, `gestione_id`, `soggetto_id`, `obbligato_in_solido_utente_id`, `anno_competenza` (biennio ex art. 63 disp. att. c.c.), `importo_centesimi`, `importo_pagato_centesimi`, `data_esigibilita`. Creata `scadenziario_recupero_crediti` (decorrenza semestre, scadenze avvisi a 90/30/7 giorni, dispensa assembleare). |
| **Conguaglio** (`RC-L1`..`L6`, `T5`) | *Assente* | **Mancante** | Creata `conguagli_unita` (saldo conguaglio per unità, gestione e periodo di titolarità `periodo_da`/`periodo_a`, modalità regolazione). |

---

## 3. Strategia a Due Passi per gli Importi in Centesimi Interi (`RC-O10`, `T18`, `T20`, `T21`)

1. **Passo 1 (presente migrazione `10_contabilita_schema_modello_obiettivo.sql`)**:
   - Tutte le colonne esistenti `numeric(14,2)` / `numeric(12,2)` restano intatte (`T20`, `T21`).
   - Vengono affiancate le colonne `*_centesimi bigint not null default 0` sulle tabelle esistenti e usate nativamente su tutte le 15 nuove tabelle.
   - Un blocco transazionale atomico popola `*_centesimi = round(importo * 100)::bigint` e `condominio_id` su tutte le righe esistenti, verificando che conteggi e somme coincidano al centesimo prima e dopo la conversione e che `righe_orfane = 0`, salvando l'esito in `migrazioni_contabilita_log` (`RC-O12`, `T18`, `T19`, `T22`).
   - Il trigger `public.sync_contabilita_row()` (`BEFORE INSERT OR UPDATE`) mantiene sincronizzati in tempo reale i campi `numeric` e `*_centesimi` (e risolve automaticamente `condominio_id` dal padre se un servizio legacy non lo passa), assistito dai vincoli `CHECK (..._centesimi = round(... * 100)::bigint)`.
2. **Passo 2 (futura dismissione a migrazione servizi completata)**:
   - Quando tutti i servizi in `@iocondo/data` e le Edge Functions leggeranno e scriveranno esclusivamente i campi `*_centesimi` (dietro il flag `configurazioni_condominio.abilita_contabilita_nuova`, `RC-O13`), le colonne legacy `numeric` potranno essere deprecate senza rischi.
