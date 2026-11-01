# Template email di Supabase (invito e reimpostazione)

Da incollare nella dashboard: **Authentication → Email Templates**. Il link punta all'app (non a Supabase) con
`token_hash` e `type`: la pagina `/imposta-password` o `/reimposta-password` lo conferma solo quando la persona preme
"Continua". `{{ .RedirectTo }}` è l'indirizzo passato dall'app o dalla funzione (`APP_URL/imposta-password`,
`<origine>/reimposta-password`): deve essere nell'elenco dei Redirect URLs (vedi `docs/CHECKLIST_INVITI.md`).

> Non usare `{{ .ConfirmationURL }}`: porterebbe a un flusso che l'app non legge.

## 1. Invite user (invito)

**Oggetto:** `Sei stato invitato su Tu, la app del tuo condominio`

```html
<h2>Ciao!</h2>
<p>L'amministratore del tuo condominio ti ha invitato a usare <strong>Tu</strong>, l'app dove trovi spese, documenti e comunicazioni.</p>
<p>Per cominciare scegli la tua password:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">Scegli la tua password</a></p>
<p>Il link funziona una volta sola e per poco tempo. Se è scaduto, scrivi all'amministratore: ti manderà un nuovo invito.</p>
<p>Se non ti aspettavi questa email, puoi ignorarla: senza il link nessuno può entrare.</p>
```

## 2. Reset password (reimpostazione)

**Oggetto:** `Scegli una nuova password per Tu`

```html
<h2>Ciao!</h2>
<p>Hai chiesto di scegliere una nuova password per <strong>Tu</strong>.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Scegli una nuova password</a></p>
<p>Il link funziona una volta sola e per poco tempo. Se è scaduto, torna alla pagina di accesso e premi "Password dimenticata?".</p>
<p>Se non l'hai chiesto tu, ignora questa email: la tua password non cambia.</p>
```

## Note
- Il link vale quanto **Email OTP expiration** (Authentication → Sign In / Providers → Email): il default è 1 ora.
  Per gli inviti conviene alzarlo (es. 86400 secondi = 24 ore, il massimo consigliato da Supabase). L'invito nel
  database resta valido 7 giorni, ma il link dell'email dura quanto questa impostazione: dopo, serve un nuovo invito.
- Verifica "Confirm signup" e "Magic link": l'app non li usa. Se restano quelli predefiniti non fa danni, perché le
  registrazioni libere vanno disattivate.
