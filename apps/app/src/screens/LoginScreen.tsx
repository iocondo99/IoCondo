import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  PASSWORD_RESET_SENT_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  validateEmail,
  validatePassword,
} from '@iocondo/data';
import {
  Alert,
  Button,
  Icon,
  Input,
  PageHeader,
  borderWidths,
  colors,
  moveFocusTo,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/context/AuthContext';

type View_ = 'accesso' | 'recupero';

/**
 * Accesso e richiesta di reimpostazione della password. Gli errori dei campi compaiono dopo che si è
 * lasciato il campo o si è provato a inviare; quanto scritto resta. Gli errori del servizio sono sempre
 * messaggi nostri, in italiano, e il focus va all'avviso (o al primo campo non valido).
 */
export function LoginScreen() {
  const { signIn, requestPasswordReset, sessionExpired } = useAuth();
  const { breakpoint } = useBreakpoint();
  // /login?vista=recupero apre direttamente la richiesta del nuovo link (usato dalla pagina del link scaduto).
  const { vista } = useLocalSearchParams<{ vista?: string }>();
  const [view, setView] = useState<View_>(vista === 'recupero' ? 'recupero' : 'accesso');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  // Il blocco sul ref impedisce il doppio invio anche con Invio premuto due volte prima del render.
  const locked = useRef(false);
  const emailRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const noticeRef = useRef<React.ComponentRef<typeof View>>(null);

  const showEmailError = touched.email || submitted;
  const showPasswordError = touched.password || submitted;
  const emailError = showEmailError ? validateEmail(email) : undefined;
  const passwordError = view === 'accesso' && showPasswordError ? validatePassword(password) : undefined;

  // Un avviso nuovo (errore o conferma) riceve il focus: lo leggono anche gli screen reader.
  const notice = failure ?? (resetSent ? PASSWORD_RESET_SENT_MESSAGE : null);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => moveFocusTo(noticeRef.current), 50);
    return () => clearTimeout(timer);
  }, [notice]);

  const goTo = (next: View_) => {
    setView(next);
    setFailure(null);
    setResetSent(false);
    setSubmitted(false);
    setTouched({ email: false, password: false });
  };

  /** Controlla i campi e porta il focus sul primo non valido. */
  const fieldsAreValid = (): boolean => {
    setSubmitted(true);
    if (validateEmail(email)) {
      emailRef.current?.focus();
      return false;
    }
    if (view === 'accesso' && validatePassword(password)) {
      passwordRef.current?.focus();
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (locked.current) return;
    setFailure(null);
    setResetSent(false);
    if (!fieldsAreValid()) return;
    locked.current = true;
    setBusy(true);
    try {
      if (view === 'accesso') {
        const result = await signIn(email.trim(), password);
        // Se l'accesso riesce la guardia porta alla pagina richiesta: qui non resta nulla da fare.
        if (!result.ok) setFailure(result.message);
      } else {
        const result = await requestPasswordReset(email.trim());
        if (result.ok) setResetSent(true);
        else setFailure(result.message);
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const isLogin = view === 'accesso';

  return (
    <AuthShell>
      <PageHeader
        title={isLogin ? 'Accedi a ioCondo' : 'Reimposta la password'}
        subtitle={
          resetSent
            ? undefined
            : isLogin
            ? 'Entra nel tuo condominio con email e password.'
            : 'Scrivi l’email con cui accedi: ti mandiamo le istruzioni.'
        }
      />

      <View role="form" aria-label={isLogin ? 'Accesso a ioCondo' : 'Reimposta la password'} style={styles.form}>
        {notice || (isLogin && sessionExpired) ? (
          <View ref={noticeRef} tabIndex={-1} style={[styles.notice, noOutline]}>
            {failure ? (
              <Alert tone="error" message={failure} />
            ) : resetSent ? (
              <Alert tone="info" message={PASSWORD_RESET_SENT_MESSAGE} />
            ) : (
              <Alert tone="warning" message={SESSION_EXPIRED_MESSAGE} />
            )}
          </View>
        ) : null}

        {resetSent ? null : (
          <>
            <Input
              label="Email"
              leading={<Icon name="mail" size="action" color={colors.text.muted} />}
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              error={emailError}
              inputRef={emailRef}
              placeholder="nome@esempio.it"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              returnKeyType={isLogin ? 'next' : 'send'}
              onSubmitEditing={() => (isLogin ? passwordRef.current?.focus() : void submit())}
              disabled={busy}
            />
            {isLogin ? (
              <Input
                label="Password"
                variant="password"
                leading={<Icon name="lock" size="action" color={colors.text.muted} />}
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                error={passwordError}
                inputRef={passwordRef}
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                disabled={busy}
              />
            ) : null}

            {isLogin ? (
              <View style={styles.forgot}>
                <Button variant="text" label="Password dimenticata?" onPress={() => goTo('recupero')} />
              </View>
            ) : null}

            <Button
              label={isLogin ? "Accedi all'account" : 'Invia istruzioni'}
              loadingLabel={isLogin ? 'Accesso in corso…' : 'Invio in corso…'}
              loading={busy}
              icon={isLogin ? 'log-in' : 'arrow-right'}
              iconPosition="end"
              fullWidth
              onPress={submit}
            />
          </>
        )}

        {isLogin ? null : (
          <Button
            variant={resetSent ? 'primary' : 'text'}
            label="Torna all’accesso"
            icon="chevron-left"
            fullWidth={resetSent}
            onPress={() => goTo('accesso')}
          />
        )}
      </View>

      {isLogin ? (
        <Text style={[textStyle('secondary', breakpoint), styles.invite]}>
          Hai ricevuto un invito? Apri il link che trovi nell’email.
        </Text>
      ) : null}
    </AuthShell>
  );
}

// L'elemento che riceve il focus da programma non mostra l'anello: i controlli interni sì.
const noOutline: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : undefined;

const styles = StyleSheet.create({
  form: { gap: space[5] },
  notice: { alignSelf: 'stretch' },
  /** Il pulsante testuale ha padding e bordo: si compensano perché il testo si allinei ai campi. */
  forgot: { alignSelf: 'flex-start', marginLeft: -(space[5] + borderWidths.thin), marginTop: -space[2] },
  invite: { color: colors.text.secondary, textAlign: 'center' },
});
