/**
 * Messaggi e controlli del login, in italiano semplice (DESIGN_SYSTEM.md, sez. 10.3, 14 e 20).
 * Gli errori di Supabase non arrivano mai all'utente: si riconosce il tipo e si mostra un testo nostro.
 * File puro (nessun import), testato con `node --test`.
 */

/** Utente della sessione: solo ciò che serve alla UI. Il token non esce dal servizio. */
export interface SessionUser {
  id: string;
  email: string | null;
}

export type AuthFailureKind =
  | 'credenziali'
  | 'email-non-confermata'
  | 'troppi-tentativi'
  | 'accesso-non-disponibile'
  | 'rete'
  | 'server'
  | 'sconosciuto';

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

const NETWORK_MESSAGE = /failed to fetch|network request failed|networkerror|load failed|network error/i;

/** Riconosce il tipo di errore da codice, stato HTTP e nome (supabase-js v2); il testo grezzo non si mostra mai. */
export function classifyAuthError(error: unknown): AuthFailureKind {
  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike;
  const code = typeof e.code === 'string' ? e.code : '';
  const name = typeof e.name === 'string' ? e.name : '';
  const status = typeof e.status === 'number' ? e.status : undefined;
  const message = typeof e.message === 'string' ? e.message : '';

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'credenziali';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) return 'email-non-confermata';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429) {
    return 'troppi-tentativi';
  }
  if (code === 'user_banned') return 'accesso-non-disponibile';
  if (name === 'AuthRetryableFetchError' && (status === 0 || status === undefined)) return 'rete';
  if (NETWORK_MESSAGE.test(message)) return 'rete';
  if (name === 'AuthRetryableFetchError' || (status !== undefined && status >= 500)) return 'server';
  return 'sconosciuto';
}

const MESSAGES: Record<AuthFailureKind, string> = {
  credenziali: 'Email o password non corretti. Controlla e riprova.',
  'email-non-confermata':
    'Il tuo indirizzo email non è ancora confermato. Apri il link che ti abbiamo mandato per email, poi riprova.',
  'troppi-tentativi': 'Hai fatto troppi tentativi. Aspetta qualche minuto e riprova.',
  'accesso-non-disponibile':
    'Questo accesso non è disponibile al momento. Contatta l’amministratore del condominio.',
  rete: 'Non riusciamo a collegarci. Controlla la connessione a internet e riprova.',
  server: 'Il servizio non risponde in questo momento. Riprova tra qualche minuto.',
  sconosciuto: 'Non è stato possibile completare l’operazione. Riprova tra poco.',
};

export function authFailureMessage(kind: AuthFailureKind): string {
  return MESSAGES[kind];
}

export const SESSION_EXPIRED_MESSAGE = 'La sessione è scaduta. Accedi di nuovo.';

/** Conferma della richiesta di reimpostazione: uguale per ogni indirizzo, registrato o no. */
export const PASSWORD_RESET_SENT_MESSAGE =
  'Se l’indirizzo è registrato, riceverai un’email con le istruzioni.';

/**
 * Nella richiesta di reimpostazione solo i problemi che non dipendono dall'indirizzo si mostrano;
 * ogni altro esito dà la stessa conferma, così non si scopre chi è registrato.
 */
export function passwordResetFailure(error: unknown): AuthFailureKind | null {
  const kind = classifyAuthError(error);
  return kind === 'rete' || kind === 'server' || kind === 'troppi-tentativi' ? kind : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (email === '') return 'Scrivi il tuo indirizzo email.';
  if (!EMAIL_PATTERN.test(email)) return 'L’indirizzo email non è valido. Controlla il formato e riprova.';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  return value === '' ? 'Scrivi la tua password.' : undefined;
}

/**
 * Dopo l'accesso si torna alla pagina richiesta, ma solo se è un percorso interno:
 * niente indirizzi esterni (//sito.it, https://…) e mai /login.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  if (/[\u0000-\u001f]/.test(value)) return '/';
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/login/')) return '/';
  return value;
}

// ---------------------------------------------------------------------------------------------------------
// Scelta della password (primo accesso da invito e reimpostazione). Stessi principi: testi nostri, mai tecnici.
// ---------------------------------------------------------------------------------------------------------

/** Lunghezza minima chiesta dall'app: quella configurata su Supabase (Auth, Password security). Se cambia lì, cambia qui. */
export const PASSWORD_MIN_LENGTH = 8;

export type PasswordLinkType = 'invite' | 'recovery';

/** Pagina e tipo di link che si corrispondono: /imposta-password ↔ invite, /reimposta-password ↔ recovery. */
export type PasswordMode = 'invito' | 'recupero';

const LINK_TYPE_OF_MODE: Record<PasswordMode, PasswordLinkType> = { invito: 'invite', recupero: 'recovery' };

function firstParam(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : '';
}

/**
 * Legge `token_hash` e `type` dai parametri dell'indirizzo. Restituisce null se manca qualcosa o se il tipo
 * non è quello della pagina (un link di recupero non apre la pagina dell'invito e viceversa).
 */
export function readPasswordLink(
  params: { token_hash?: unknown; type?: unknown },
  mode: PasswordMode,
): { tokenHash: string; type: PasswordLinkType } | null {
  const tokenHash = firstParam(params.token_hash).trim();
  const type = firstParam(params.type);
  if (tokenHash === '' || tokenHash.length > 512 || type !== LINK_TYPE_OF_MODE[mode]) return null;
  return { tokenHash, type: LINK_TYPE_OF_MODE[mode] };
}

export function validateNewPassword(value: string): string | undefined {
  if (value === '') return 'Scegli una password.';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `La password è troppo corta: servono almeno ${PASSWORD_MIN_LENGTH} caratteri.`;
  }
  return undefined;
}

export function validatePasswordConfirm(password: string, confirm: string): string | undefined {
  if (confirm === '') return 'Scrivi di nuovo la password per conferma.';
  if (confirm !== password) return 'Le due password non coincidono. Controlla e riprova.';
  return undefined;
}

export const LINK_EXPIRED_MESSAGE = 'Il link è scaduto o è già stato usato.';

export type PasswordFailureKind =
  | 'debole'
  | 'uguale'
  | 'sessione-scaduta'
  | 'troppi-tentativi'
  | 'rete'
  | 'server'
  | 'sconosciuto';

/** Riconosce l'esito negativo di `updateUser({ password })`. */
export function classifyPasswordError(error: unknown): PasswordFailureKind {
  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike;
  const code = typeof e.code === 'string' ? e.code : '';
  const status = typeof e.status === 'number' ? e.status : undefined;
  const name = typeof e.name === 'string' ? e.name : '';
  if (code === 'weak_password' || name === 'AuthWeakPasswordError') return 'debole';
  if (code === 'same_password') return 'uguale';
  if (
    code === 'session_not_found' ||
    code === 'session_expired' ||
    code === 'bad_jwt' ||
    code === 'reauthentication_needed' ||
    name === 'AuthSessionMissingError' ||
    status === 401
  ) {
    return 'sessione-scaduta';
  }
  const kind = classifyAuthError(error);
  return kind === 'rete' || kind === 'server' || kind === 'troppi-tentativi' ? kind : 'sconosciuto';
}

/** Motivi con cui Supabase rifiuta una password debole (`length`, `characters`, `pwned`). */
export function weakPasswordReasons(error: unknown): string[] {
  const reasons = (error as { reasons?: unknown } | null)?.reasons;
  return Array.isArray(reasons) ? reasons.filter((r): r is string => typeof r === 'string') : [];
}

export function passwordFailureMessage(kind: PasswordFailureKind, reasons: readonly string[] = []): string {
  switch (kind) {
    case 'debole': {
      const parts: string[] = [];
      if (reasons.includes('length')) parts.push('è troppo corta');
      if (reasons.includes('characters')) {
        parts.push('mancano alcuni tipi di caratteri richiesti (per esempio maiuscole, numeri o simboli)');
      }
      if (reasons.includes('pwned')) parts.push('è già comparsa in violazioni di dati pubbliche');
      return parts.length > 0
        ? `Questa password non è abbastanza sicura: ${parts.join('; ')}. Scegline un’altra.`
        : 'Questa password non è abbastanza sicura. Scegline un’altra.';
    }
    case 'uguale':
      return 'La nuova password deve essere diversa da quella che usavi prima.';
    case 'sessione-scaduta':
      return LINK_EXPIRED_MESSAGE;
    case 'troppi-tentativi':
    case 'rete':
    case 'server':
      return authFailureMessage(kind);
    default:
      return 'Non è stato possibile salvare la password. Riprova tra poco.';
  }
}

export type LinkFailureKind = 'scaduto' | 'rete' | 'server';

/** Esito negativo di `verifyOtp`: salvo problemi di rete o di server, il link non è più valido. */
export function classifyLinkError(error: unknown): LinkFailureKind {
  const kind = classifyAuthError(error);
  return kind === 'rete' || kind === 'server' ? kind : 'scaduto';
}
