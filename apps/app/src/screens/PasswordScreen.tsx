import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  LINK_EXPIRED_MESSAGE,
  PASSWORD_MIN_LENGTH,
  readPasswordLink,
  validateNewPassword,
  validatePasswordConfirm,
  type PasswordMode,
} from '@iocondo/data';
import {
  Alert,
  Button,
  Input,
  PageHeader,
  borderWidths,
  colors,
  moveFocusTo,
  space,
  textStyle,
  useBreakpoint,
  useToast,
} from '@iocondo/ui';
import { AuthShell } from '@/components/auth/AuthShell';
import { SessionLoading } from '@/components/auth/SessionLoading';
import { useAuth } from '@/context/AuthContext';

const PERCORSO: Record<PasswordMode, string> = { invito: '/imposta-password', recupero: '/reimposta-password' };

const TESTI: Record<PasswordMode, { continuaTitolo: string; continuaTesto: string; titolo: string; testo: string }> = {
  invito: {
    continuaTitolo: 'Benvenuto',
    continuaTesto: 'Premi Continua per confermare il tuo invito e scegliere la password.',
    titolo: 'Scegli la tua password',
    testo: 'È l’ultimo passaggio: con questa password entrerai ogni volta nel tuo condominio.',
  },
  recupero: {
    continuaTitolo: 'Reimposta la password',
    continuaTesto: 'Premi Continua per confermare e scegliere una nuova password.',
    titolo: 'Scegli una nuova password',
    testo: 'Scrivila due volte. Poi entri subito nell’app.',
  },
};

/**
 * Scelta della password, uguale per il primo accesso da invito (/imposta-password) e per la reimpostazione
 * (/reimposta-password). Si usa solo con un link valido (il pulsante "Continua" conferma il link: così un
 * programma che apre l'email non lo consuma) o con una sessione aperta da quel link e senza password scelta.
 * Il successo si mostra solo dopo la conferma del server; errori sempre in italiano semplice.
 */
export function PasswordScreen({ modo }: { modo: PasswordMode }) {
  const { status, passwordPending, verifyLink, savePassword, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { breakpoint } = useBreakpoint();
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const link = useMemo(
    () => readPasswordLink({ token_hash: params.token_hash, type: params.type }, modo),
    [params.token_hash, params.type, modo],
  );

  const [invalidated, setInvalidated] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [submitted, setSubmitted] = useState(false);
  // Il blocco sul ref impedisce il doppio invio anche con Invio premuto due volte prima del render.
  const locked = useRef(false);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const noticeRef = useRef<React.ComponentRef<typeof View>>(null);

  const testi = TESTI[modo];

  useEffect(() => {
    if (!failure) return undefined;
    const timer = setTimeout(() => moveFocusTo(noticeRef.current), 50);
    return () => clearTimeout(timer);
  }, [failure]);

  if (status === 'loading') return <SessionLoading />;
  if (done) return <SessionLoading message="Password salvata. Ti portiamo nell’app…" />;

  const authenticated = status === 'authenticated';
  // Con una sessione che aspetta la password si sceglie quella; altrimenti serve un link valido.
  const fase: 'scegli' | 'continua' | 'non-valido' | 'gia-dentro' = invalidated
    ? 'non-valido'
    : authenticated && passwordPending
      ? 'scegli'
      : link
        ? 'continua'
        : authenticated
          ? 'gia-dentro'
          : 'non-valido';

  const vaiAlNuovoLink = async () => {
    if (passwordPending) await signOut();
    router.replace('/login?vista=recupero' as Href);
  };

  const continua = async () => {
    if (locked.current || !link) return;
    locked.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const result = await verifyLink(link.tokenHash, link.type);
      if (result.ok) {
        // L'indirizzo perde il codice del link: ricaricando la pagina non si riusa un link già consumato.
        router.replace(PERCORSO[modo] as Href);
      } else if (result.kind === 'scaduto') {
        setInvalidated(true);
      } else {
        setFailure(result.message);
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const passwordError =
    touched.password || submitted ? validateNewPassword(password) : undefined;
  const confirmError =
    touched.confirm || submitted ? validatePasswordConfirm(password, confirm) : undefined;

  const salva = async () => {
    if (locked.current) return;
    setFailure(null);
    setSubmitted(true);
    if (validateNewPassword(password)) {
      passwordRef.current?.focus();
      return;
    }
    if (validatePasswordConfirm(password, confirm)) {
      confirmRef.current?.focus();
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      const result = await savePassword(password);
      if (result.ok) {
        // Confermato dal server: la sessione è già quella giusta, si entra senza un nuovo accesso.
        setDone(true);
        toast.show({ message: 'Password salvata.' });
        router.replace('/' as Href);
      } else if (result.kind === 'sessione-scaduta') {
        await signOut();
        setInvalidated(true);
      } else {
        setFailure(result.message);
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const esci = async () => {
    await signOut();
    router.replace('/login' as Href);
  };

  if (fase === 'non-valido') {
    return (
      <AuthShell>
        <PageHeader title="Il link non è più valido" />
        <View style={styles.form}>
          <Alert tone="warning" message={LINK_EXPIRED_MESSAGE} />
          <Text style={[textStyle('body', breakpoint), styles.testo]}>
            Per sicurezza i link funzionano una volta sola e per poco tempo. Richiedi un nuovo link: ti mandiamo un’email.
          </Text>
          {modo === 'invito' ? (
            <Text style={[textStyle('secondary', breakpoint), styles.secondario]}>
              Se non ricevi nulla, scrivi all’amministratore del condominio: potrà mandarti di nuovo l’invito.
            </Text>
          ) : null}
          <Button label="Richiedi un nuovo link" icon="mail" fullWidth onPress={vaiAlNuovoLink} />
        </View>
      </AuthShell>
    );
  }

  if (fase === 'gia-dentro') {
    return (
      <AuthShell>
        <PageHeader title="Sei già dentro l’app" subtitle="Questa pagina serve solo per scegliere la password dal link ricevuto per email." />
        <View style={styles.form}>
          <Button label="Vai alla Home" icon="home" fullWidth onPress={() => router.replace('/' as Href)} />
        </View>
      </AuthShell>
    );
  }

  if (fase === 'continua') {
    return (
      <AuthShell>
        <PageHeader title={testi.continuaTitolo} subtitle={testi.continuaTesto} />
        <View role="form" aria-label={testi.continuaTitolo} style={styles.form}>
          {failure ? (
            <View ref={noticeRef} tabIndex={-1} style={[styles.notice, noOutline]}>
              <Alert tone="error" message={failure} />
            </View>
          ) : null}
          <Button
            label="Continua"
            loadingLabel="Verifica in corso…"
            loading={busy}
            fullWidth
            onPress={continua}
          />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <PageHeader title={testi.titolo} subtitle={testi.testo} />
      <View role="form" aria-label={testi.titolo} style={styles.form}>
        {failure ? (
          <View ref={noticeRef} tabIndex={-1} style={[styles.notice, noOutline]}>
            <Alert tone="error" message={failure} />
          </View>
        ) : null}

        <Input
          label="Nuova password"
          variant="password"
          value={password}
          onChangeText={setPassword}
          onBlur={() => setTouched((current) => ({ ...current, password: true }))}
          error={passwordError}
          helperText={`Almeno ${PASSWORD_MIN_LENGTH} caratteri. Se serve altro per renderla sicura, te lo diciamo qui.`}
          inputRef={passwordRef}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          disabled={busy}
        />
        <Input
          label="Conferma password"
          variant="password"
          value={confirm}
          onChangeText={setConfirm}
          onBlur={() => setTouched((current) => ({ ...current, confirm: true }))}
          error={confirmError}
          inputRef={confirmRef}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => void salva()}
          disabled={busy}
        />

        <Button label="Salva password" loadingLabel="Salvataggio in corso…" loading={busy} fullWidth onPress={salva} />
        <View style={styles.esci}>
          <Button variant="text" label="Non ora, esci" onPress={esci} disabled={busy} />
        </View>
      </View>
    </AuthShell>
  );
}

// L'elemento che riceve il focus da programma non mostra l'anello: i controlli interni sì.
const noOutline: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : undefined;

const styles = StyleSheet.create({
  form: { gap: space[5] },
  notice: { alignSelf: 'stretch' },
  testo: { color: colors.text.primary },
  secondario: { color: colors.text.secondary },
  /** Il pulsante testuale ha padding e bordo: si compensano perché il testo si allinei ai campi. */
  esci: { alignSelf: 'flex-start', marginLeft: -(space[5] + borderWidths.thin) },
});
