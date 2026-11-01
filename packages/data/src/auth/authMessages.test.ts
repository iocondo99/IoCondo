import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD_RESET_SENT_MESSAGE,
  authFailureMessage,
  classifyAuthError,
  passwordResetFailure,
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
