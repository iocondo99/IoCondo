# Decisioni

- admin-web da portare su Expo web con @iocondo/ui, decisione dopo Login e Home del condòmino.
- Servizi duplicati tra admin-web e app mobile: unificati in packages/data (Fase 0, 2026-10-30). admin-web conserva ancora le sue copie.
- Expo Go per SDK 58 su iPhone è atteso sugli store; l'account Apple Developer si valuta alla pubblicazione. Nel frattempo si prova su web (Safari) e su Android con Expo Go.
- Aggiornamento da Expo SDK 52 a SDK 58 (React Native 0.88, React 19.3, expo-router 58). Motivo: Expo Go supporta solo l'SDK più recente e l'SDK 52 non era più apribile. Percorso scelto: progetto ricreato sul template SDK 58 e codice spostato (l'app era ancora senza schermate), invece dei sei salti incrementali.
- admin-web portato a Next 15.5 e React 19.3 (con @types/react 19) per avere un'unica versione di React nel monorepo, requisito dell'SDK 58. Nessuna modifica funzionale.
- Da valutare più avanti: TypeScript 6 (expo-doctor lo indica per l'SDK 58; oggi il repo è su 5.6) e @supabase/ssr oltre la 0.5.2 (dalla 0.10 setAll riceve gli header anti-cache per le risposte con cookie di sessione).

## 2026-10-30 — Architettura A: un'unica app Expo per tutti i ruoli
- **Decisione:** una sola app Expo (`apps/app`, `@iocondo/app`) serve tutti i ruoli. Per ora solo web, deploy su Vercel. Navigazione e permessi dipendono dal ruolo attivo.
- **Rename:** `apps/condomino-mobile` → `apps/app`.
- **Super Admin:** sidebar minima con Amministratori, Piani e abbonamenti, Fatture, Impostazioni.
- **Admin:** la navigazione include Assemblee.
- **Pacchetti:** `@iocondo/data` (servizi + hook di sola logica, senza Expo), `@iocondo/supabase-client` (factory + storage per piattaforma), `@iocondo/shared-types` (tipi, ruoli, navigazione), `@iocondo/ui` (design system).
- **Servizi unificati:** base = versione admin, con aggiunta dei metodi del mobile (assemblee, servizi, rate "mie", pagamento, commenti e notifiche bacheca, creazione ticket e allegati). Conflitto di nome su `ticket.list`: resta la firma admin; la lista lato condomino è `ticket.listMiei`.
- **Ruoli:** `RuoloCodice` specchia `ruoli_piattaforma` (CONDOMINO, ADMIN, PORTIERE). `RuoloApp` aggiunge SUPER_ADMIN (flag `utenti.is_superadmin`) e FORNITORE (magic link).
- **Dati:** nessun dato demo, nemmeno nei contesti; nessun pagamento simulato.
- **Da riscrivere su dati reali (fase Auth):** `RoleContext` e `markRataAsPaid` / `resetDemoRata` (dati dimostrativi), `CondominioContext` di admin-web, `useRataPayment` (usa un `providerRef` fittizio).

- Fornitore: non è un utente. Entra con link magico (`fornitori_tokens`) senza login, quindi il CHECK di `ruoli_piattaforma` (CONDOMINO, ADMIN, PORTIERE) NON va esteso. SUPER_ADMIN resta il flag `utenti.is_superadmin`.
- Supabase, da fare dalla dashboard: attivare la leaked password protection (Auth, Password security). Non è eseguibile da migrazione.
- `profili_pubblici`: verifica documentata (2026-10-30). Espone solo `id`, `nome_cognome`, `avatar_url` (niente email né telefono). `anon` non ha SELECT, `authenticated` sì. Il filtro mostra sé stessi e gli utenti che condividono almeno un condominio con chi legge (`has_cond_access`). La vista è SECURITY DEFINER di proposito: `utenti_select` è riservata ad admin e superadmin, quindi senza il definer i condomini non vedrebbero i vicini. L'avviso del linter resta, accettato.
- Bucket Storage pubblici: `foto-guasti` e `avatar-utenti` sono `public=true` (leggibili via URL da chiunque lo conosca). Da rivalutare prima di avere dati reali.

## Da fare prima di utenti reali
- Applicare `supabase/da-applicare/07_revoke_execute_funzioni_definer.sql` (revoke execute da anon/public sulle funzioni trigger e `try_parse_uuid`).
- Attivare la leaked password protection dalla dashboard Supabase.
- Rendere privati i bucket `foto-guasti` e `avatar-utenti` (link firmati).
- Rivalutare la vista `profili_pubblici` (SECURITY DEFINER, accettata per ora).
- Ricontrollare RLS e advisor con `get_advisors`.
