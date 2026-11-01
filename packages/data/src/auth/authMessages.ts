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
