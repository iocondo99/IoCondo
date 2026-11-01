import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD_RESET_SENT_MESSAGE,
  authFailureMessage,
  classifyAuthError,
  classifyLinkError,
  classifyPasswordError,
  passwordFailureMessage,
  passwordResetFailure,
  readPasswordLink,
  validateNewPassword,
  validatePasswordConfirm,
  weakPasswordReasons,
  safeReturnPath,
  validateEmail,
  validatePassword,
} from './authMessages.ts';

test('classifyAuthError: credenziali, email non confermata, troppi tentativi', () => {
  assert.equal(classifyAuthError({ name: 'AuthApiError', status: 400, code: 'invalid_credentials' }), 'credenziali');
  assert.equal(classifyAuthError({ status: 400, message: 'Invalid login credentials' }), 'credenziali');
  assert.equal(classifyAuthError({ status: 400, code: 'email_not_confirmed' }), 'email-non-confermata');
  assert.equal(classifyAuthError({ status: 429, code: 'over_request_rate_limit' }), 'troppi-tentativi');
  assert.equal(classifyAuthError({ status: 429 }), 'troppi-tentativi');
  assert.equal(classifyAuthError({ code: 'user_banned' }), 'accesso-non-disponibile');
});

test('classifyAuthError: rete assente e server', () => {
  assert.equal(classifyAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }), 'rete');
  assert.equal(classifyAuthError(new TypeError('Network request failed')), 'rete');
  assert.equal(classifyAuthError({ name: 'AuthRetryableFetchError', status: 503 }), 'server');
  assert.equal(classifyAuthError({ status: 500 }), 'server');
});

test('classifyAuthError: tutto il resto è sconosciuto, anche valori strani', () => {
  assert.equal(classifyAuthError({ status: 400, code: 'weird' }), 'sconosciuto');
  assert.equal(classifyAuthError(null), 'sconosciuto');
  assert.equal(classifyAuthError('boom'), 'sconosciuto');
});

test('i messaggi sono in italiano e non contengono testo tecnico', () => {
  for (const kind of [
    'credenziali',
    'email-non-confermata',
    'troppi-tentativi',
    'accesso-non-disponibile',
    'rete',
    'server',
    'sconosciuto',
  ] as const) {
    const text = authFailureMessage(kind);
    assert.ok(text.length > 20);
    assert.doesNotMatch(text, /supabase|AuthApiError|invalid_|\b4\d\d\b|\b5\d\d\b/i);
  }
  assert.equal(authFailureMessage('credenziali'), 'Email o password non corretti. Controlla e riprova.');
});

test('reimpostazione password: si mostrano solo i problemi che non rivelano chi è registrato', () => {
  assert.equal(passwordResetFailure({ status: 429 }), 'troppi-tentativi');
  assert.equal(passwordResetFailure({ name: 'AuthRetryableFetchError', status: 0 }), 'rete');
  assert.equal(passwordResetFailure({ status: 400, code: 'user_not_found' }), null);
  assert.equal(passwordResetFailure({ status: 400, code: 'email_address_invalid' }), null);
  assert.equal(PASSWORD_RESET_SENT_MESSAGE, 'Se l’indirizzo è registrato, riceverai un’email con le istruzioni.');
});

test('validateEmail e validatePassword', () => {
  assert.equal(validateEmail(''), 'Scrivi il tuo indirizzo email.');
  assert.equal(validateEmail('   '), 'Scrivi il tuo indirizzo email.');
  assert.equal(validateEmail('maria@esempio'), 'L’indirizzo email non è valido. Controlla il formato e riprova.');
  assert.equal(validateEmail('maria rossi@esempio.it'), 'L’indirizzo email non è valido. Controlla il formato e riprova.');
  assert.equal(validateEmail(' maria@esempio.it '), undefined);
  assert.equal(validatePassword(''), 'Scrivi la tua password.');
  assert.equal(validatePassword(' '), undefined);
});

test('safeReturnPath: solo percorsi interni', () => {
  assert.equal(safeReturnPath('/spese'), '/spese');
  assert.equal(safeReturnPath('/documenti?anno=2025'), '/documenti?anno=2025');
  assert.equal(safeReturnPath('//sito-esterno.it'), '/');
  assert.equal(safeReturnPath('https://sito-esterno.it'), '/');
  assert.equal(safeReturnPath('/\\sito'), '/');
  assert.equal(safeReturnPath('/login'), '/');
  assert.equal(safeReturnPath('/login?redirect=/spese'), '/');
  assert.equal(safeReturnPath(undefined), '/');
  assert.equal(safeReturnPath(['/a']), '/');
});

test('readPasswordLink: serve token_hash e il tipo giusto per la pagina', () => {
  assert.deepEqual(readPasswordLink({ token_hash: 'abc', type: 'invite' }, 'invito'), { tokenHash: 'abc', type: 'invite' });
  assert.deepEqual(readPasswordLink({ token_hash: ['abc'], type: 'recovery' }, 'recupero'), { tokenHash: 'abc', type: 'recovery' });
  assert.equal(readPasswordLink({ token_hash: 'abc', type: 'recovery' }, 'invito'), null);
  assert.equal(readPasswordLink({ token_hash: 'abc', type: 'invite' }, 'recupero'), null);
  assert.equal(readPasswordLink({ type: 'invite' }, 'invito'), null);
  assert.equal(readPasswordLink({ token_hash: '  ', type: 'invite' }, 'invito'), null);
  assert.equal(readPasswordLink({ token_hash: 'x'.repeat(600), type: 'invite' }, 'invito'), null);
  assert.equal(readPasswordLink({ token_hash: 5, type: 'invite' }, 'invito'), null);
});

test('validateNewPassword e validatePasswordConfirm', () => {
  assert.equal(validateNewPassword(''), 'Scegli una password.');
  assert.match(validateNewPassword('1234567') ?? '', /almeno 8 caratteri/);
  assert.equal(validateNewPassword('12345678'), undefined);
  assert.equal(validatePasswordConfirm('abcdefgh', ''), 'Scrivi di nuovo la password per conferma.');
  assert.match(validatePasswordConfirm('abcdefgh', 'abcdefgi') ?? '', /non coincidono/);
  assert.equal(validatePasswordConfirm('abcdefgh', 'abcdefgh'), undefined);
});

test('classifyPasswordError: debole, uguale, sessione scaduta, rete', () => {
  assert.equal(classifyPasswordError({ name: 'AuthWeakPasswordError', code: 'weak_password', reasons: ['pwned'] }), 'debole');
  assert.equal(classifyPasswordError({ status: 422, code: 'same_password' }), 'uguale');
  assert.equal(classifyPasswordError({ name: 'AuthSessionMissingError' }), 'sessione-scaduta');
  assert.equal(classifyPasswordError({ status: 401, code: 'bad_jwt' }), 'sessione-scaduta');
  assert.equal(classifyPasswordError({ name: 'AuthRetryableFetchError', status: 0 }), 'rete');
  assert.equal(classifyPasswordError({ status: 500 }), 'server');
  assert.equal(classifyPasswordError({ status: 429 }), 'troppi-tentativi');
  assert.equal(classifyPasswordError(null), 'sconosciuto');
});

test('password debole: il messaggio usa solo i motivi dati dal server', () => {
  assert.deepEqual(weakPasswordReasons({ reasons: ['length', 'pwned', 3] }), ['length', 'pwned']);
  assert.deepEqual(weakPasswordReasons(null), []);
  assert.match(passwordFailureMessage('debole', ['pwned']), /violazioni di dati/);
  assert.doesNotMatch(passwordFailureMessage('debole', ['pwned']), /troppo corta/);
  assert.match(passwordFailureMessage('debole', ['length', 'characters']), /troppo corta.*tipi di caratteri/);
  assert.equal(passwordFailureMessage('debole'), 'Questa password non è abbastanza sicura. Scegline un’altra.');
  for (const kind of ['debole', 'uguale', 'sessione-scaduta', 'troppi-tentativi', 'rete', 'server', 'sconosciuto'] as const) {
    assert.doesNotMatch(passwordFailureMessage(kind), /supabase|AuthApiError|weak_password|jwt|[45]dd/i);
  }
});

test('classifyLinkError: scaduto salvo rete e server', () => {
  assert.equal(classifyLinkError({ name: 'AuthApiError', status: 403, code: 'otp_expired' }), 'scaduto');
  assert.equal(classifyLinkError({ status: 400, message: 'Token has expired or is invalid' }), 'scaduto');
  assert.equal(classifyLinkError({ name: 'AuthRetryableFetchError', status: 0 }), 'rete');
  assert.equal(classifyLinkError({ status: 503 }), 'server');
});
