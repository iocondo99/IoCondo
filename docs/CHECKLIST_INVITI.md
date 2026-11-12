# Checklist: inviti e scelta della password

Tutto da fare a mano (nulla è stato applicato o pubblicato dal codice). Ordine consigliato.

## 1. Migrazione (da rivedere, poi eseguire)
1. Leggi `supabase/da-applicare/08_inviti_sicuri.sql` (ha il rollback in fondo).
2. Eseguila dal SQL Editor della dashboard. Toglie INSERT/UPDATE diretti su `inviti_pendenti`, aggiunge
   `crea_invito()`, `email_confermata()` e rende più rigida `applica_inviti()`.

## 2. Redirect URLs (Authentication → URL Configuration)
**Site URL:** `https://<nome-progetto>.vercel.app` (o dominio proprio di produzione).

Aggiungi (uno per riga):

| Ambiente | URL |
|---|---|
| Produzione (Vercel) | `https://<nome-progetto>.vercel.app/**` |
| Produzione (Vercel) | `https://<nome-progetto>.vercel.app/imposta-password` |
| Produzione (Vercel) | `https://<nome-progetto>.vercel.app/reimposta-password` |
| Produzione (Vercel) | `https://<nome-progetto>.vercel.app/login` |
| Preview Vercel (opzionale) | `https://*-<team>.vercel.app/**` |
| Nativo | `iocondo://imposta-password` e `iocondo://reimposta-password` |
| Locale (sviluppo) | `http://localhost:8081/imposta-password` e `/reimposta-password` |

`/login` può restare (era il vecchio redirect del reset) ma non serve più.

## 3. Impostazioni Auth (dashboard)
- **Sign In / Providers → Email:** "Allow new users to sign up" **disattivato**; "Confirm email" attivo.
- **Email OTP expiration:** 86400 (vedi `docs/EMAIL_TEMPLATES.md`).
- **Password security:** minimo 8 caratteri (l'app chiede 8: `PASSWORD_MIN_LENGTH` in
  `packages/data/src/auth/authMessages.ts`). Attiva "Prevent use of leaked passwords". Se imposti anche i caratteri
  richiesti (maiuscole, numeri, simboli) la schermata non li elenca in anticipo ma, se la password non li ha, li
  segnala con il messaggio del server. Per elencarli in anticipo basta aggiungere una riga di testo nel campo
  "Nuova password" di `PasswordScreen.tsx`, scritta dopo aver letto la dashboard: non vanno inventati.
- **Email Templates:** incolla i due template di `docs/EMAIL_TEMPLATES.md`.

## 4. Email vere: SMTP proprio (obbligatorio per invitare persone reali)
Il server email predefinito di Supabase (documentazione ufficiale, Auth → SMTP e Rate limits):
- **consegna solo agli indirizzi dei membri dell'organizzazione/team del progetto**; agli altri risponde
  "Email address not authorized";
- ha un limite di **2 email all'ora** per progetto ed è "best effort", pensato solo per prove.

Per invitare persone vere configura un SMTP (Authentication → Emails → SMTP Settings: Resend, Postmark, SES, ecc.).
Poi rialza il limite di invio email (Authentication → Rate limits).

## 5. Edge Function
Da PowerShell, nella cartella del progetto (serve la CLI di Supabase, già usata per le altre funzioni):

```powershell
$env:NODE_OPTIONS = "--use-system-ca"
npx supabase login
npx supabase link --project-ref <ref-del-progetto>
npx supabase secrets set APP_URL=https://<nome-progetto>.vercel.app
npx supabase functions deploy invita-utente
```

- `APP_URL` è l'**unico** segreto da impostare: è l'origine dell'app, senza barra finale né percorso.
- La chiave `service_role` NON va impostata: la inietta Supabase nella funzione come `SUPABASE_SERVICE_ROLE_KEY`.
  Non va in nessun file né nei `.env` dell'app.
- `verify_jwt = true` è già in `supabase/config.toml`; il deploy lo applica. Controlla con
  `npx supabase functions list` o dalla dashboard (Edge Functions → invita-utente → "Enforce JWT verification").
- Se cambi `APP_URL` (per esempio passando alla produzione) rilancia `secrets set` e, per sicurezza, anche il deploy.

## 6. Come provare un invito con il tuo indirizzo
1. Con l'SMTP configurato (o con un indirizzo membro del team, max 2 email/ora), apri l'app come amministratore
   di un condominio di prova → **Inviti** (menu) → email = un tuo indirizzo che NON ha ancora un account,
   ruolo Condòmino → **Invia invito**. Deve comparire "Invito registrato." e la riga "In attesa".
2. Apri l'email, premi "Scegli la tua password" → pagina "Benvenuto" → **Continua** → scegli la password (almeno 8
   caratteri) → **Salva password**: entri nell'app senza un nuovo accesso. Nell'elenco l'invito diventa "Accettato".
3. Esci e accedi con email e password. Prova anche "Password dimenticata?": l'email porta a
   `/reimposta-password`, stessa schermata con testi del recupero.
4. Prove di errore: apri due volte lo stesso link (la seconda deve dire "Il link non è più valido" con
   "Richiedi un nuovo link"); invita di nuovo un indirizzo già registrato: stessa risposta "Invito registrato",
   nessuna email, ma arriva la notifica nell'app e il nuovo ruolo.
5. Controllo sicurezza: da un account condòmino la voce Inviti non c'è; chiamare la funzione con un condominio
   non tuo deve dare "Non puoi invitare persone in questo condominio."

## Limiti noti (da conoscere)
- Reinvio a un utente già invitato ma mai confermato: si affida al comportamento di `inviteUserByEmail` per gli
  utenti non confermati (la documentazione dice di mandare un nuovo invito). **Non verificato con una prova reale**:
  provalo al punto 6.
- Nativo: i link dell'email si aprono nel browser; la password si sceglie sul web e poi si accede dall'app
  (finché non ci sono universal link). Redirect `iocondo://…` predisposti.
- Il promemoria "password da scegliere" vive nel dispositivo: protegge dall'entrare per sbaglio senza password, non
  è un controllo di sicurezza (quello è nelle RLS).
