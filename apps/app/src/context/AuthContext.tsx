import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { platformStorage } from '@iocondo/supabase-client/storage';
import {
  LINK_EXPIRED_MESSAGE,
  authFailureMessage,
  classifyAuthError,
  classifyLinkError,
  classifyPasswordError,
  passwordFailureMessage,
  passwordResetFailure,
  weakPasswordReasons,
  type AuthFailureKind,
  type LinkFailureKind,
  type PasswordFailureKind,
  type PasswordLinkType,
  type SessionUser,
} from '@iocondo/data';
import { services } from '@/services';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Esito di un'azione: mai l'errore grezzo di Supabase, solo il tipo e il testo da mostrare. */
export type AuthResult = { ok: true } | { ok: false; kind: AuthFailureKind; message: string };

export type LinkResult = { ok: true } | { ok: false; kind: LinkFailureKind; message: string };
export type PasswordResult = { ok: true } | { ok: false; kind: PasswordFailureKind; message: string };

/**
 * Chiave del promemoria "password da scegliere". Si scrive prima di aprire la sessione dal link e si toglie
 * solo quando il server conferma la nuova password (o all'uscita): finché c'è, l'app non lascia entrare.
 * È una cortesia dell'interfaccia: la sicurezza dei dati resta nelle RLS.
 */
const CHIAVE_PASSWORD_DA_SCEGLIERE = 'iocondo.password-da-scegliere.v1';

interface AuthContextValue {
  status: AuthStatus;
  /** Tipo di link con cui è stata aperta la sessione, finché l'utente non ha scelto la password. */
  passwordPending: PasswordLinkType | null;
  /** Conferma il link dell'email (invito o recupero) e apre la sessione. */
  verifyLink: (tokenHash: string, type: PasswordLinkType) => Promise<LinkResult>;
  /** Salva la nuova password; il promemoria si toglie solo se il server conferma. */
  savePassword: (password: string) => Promise<PasswordResult>;
  user: SessionUser | null;
  /** true se la sessione è finita senza che l'utente abbia premuto "Esci". */
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function failure(error: unknown): AuthResult {
  const kind = classifyAuthError(error);
  return { ok: false, kind, message: authFailureMessage(kind) };
}

/** Dove porta il link dell'email di reimpostazione: la pagina per scegliere la password, sul web o nell'app. */
function passwordResetRedirect(): string {
  if (Platform.OS === 'web') {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin ?? '';
    return `${origin}/reimposta-password`;
  }
  return Linking.createURL('/reimposta-password');
}

async function leggiPromemoria(): Promise<PasswordLinkType | null> {
  try {
    const valore = await platformStorage.getItem(CHIAVE_PASSWORD_DA_SCEGLIERE);
    return valore === 'invite' || valore === 'recovery' ? valore : null;
  } catch {
    return null;
  }
}

async function scriviPromemoria(valore: PasswordLinkType | null): Promise<void> {
  try {
    if (valore) await platformStorage.setItem(CHIAVE_PASSWORD_DA_SCEGLIERE, valore);
    else await platformStorage.removeItem(CHIAVE_PASSWORD_DA_SCEGLIERE);
  } catch {
    /* senza memoria del dispositivo il promemoria vale solo finché l'app è aperta */
  }
}

/**
 * Sessione dell'utente: la legge all'avvio e ne segue i cambiamenti. Non conosce ruoli, condomìni
 * o dati: sa solo chi è entrato. Nessun log di email o password; il token resta nel servizio.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pending, setPending] = useState<PasswordLinkType | null>(null);
  const [pendingRead, setPendingRead] = useState(false);
  const pendingRef = useRef<PasswordLinkType | null>(null);
  const hadUser = useRef(false);
  const signingOut = useRef(false);

  const apply = useCallback((next: SessionUser | null) => {
    hadUser.current = next !== null;
    setUser(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
    if (next) setSessionExpired(false);
  }, []);

  const setPromemoria = useCallback((valore: PasswordLinkType | null) => {
    pendingRef.current = valore;
    setPending(valore);
    return scriviPromemoria(valore);
  }, []);

  useEffect(() => {
    let active = true;
    leggiPromemoria().then((valore) => {
      if (!active) return;
      pendingRef.current = valore;
      setPending(valore);
      setPendingRead(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const stopListening = services.auth.onSessionChange((event, next) => {
      if (!active) return;
      // Uscita non chiesta dall'utente (token non più rinnovabile, uscita da un'altra scheda): sessione scaduta.
      if (event === 'SIGNED_OUT' && hadUser.current && !signingOut.current) setSessionExpired(true);
      if (event === 'SIGNED_OUT') void setPromemoria(null);
      apply(next);
    });
    services.auth
      .getSessionUser()
      .then((saved) => active && apply(saved))
      .catch(() => active && apply(null));
    return () => {
      active = false;
      stopListening();
    };
  }, [apply, setPromemoria]);

  const verifyLink = useCallback(
    async (tokenHash: string, type: PasswordLinkType): Promise<LinkResult> => {
      // Il promemoria va scritto PRIMA: aprendo la sessione l'app deve già sapere che manca la password.
      const precedente = pendingRef.current;
      await setPromemoria(type);
      try {
        await services.auth.verifyLink(tokenHash, type);
        return { ok: true };
      } catch (error) {
        await setPromemoria(precedente);
        const kind = classifyLinkError(error);
        return { ok: false, kind, message: kind === 'scaduto' ? LINK_EXPIRED_MESSAGE : authFailureMessage(kind) };
      }
    },
    [setPromemoria],
  );

  const savePassword = useCallback(
    async (password: string): Promise<PasswordResult> => {
      try {
        await services.auth.updatePassword(password);
        await setPromemoria(null);
        return { ok: true };
      } catch (error) {
        const kind = classifyPasswordError(error);
        return { ok: false, kind, message: passwordFailureMessage(kind, weakPasswordReasons(error)) };
      }
    },
    [setPromemoria],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      await services.auth.signIn(email, password);
      return { ok: true };
    } catch (error) {
      return failure(error);
    }
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    signingOut.current = true;
    try {
      await services.auth.signOut();
      await setPromemoria(null);
      return { ok: true };
    } catch (error) {
      return failure(error);
    } finally {
      signingOut.current = false;
    }
  }, [setPromemoria]);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      await services.auth.requestPasswordReset(email, passwordResetRedirect());
      return { ok: true };
    } catch (error) {
      // Solo rete, server e troppe richieste si mostrano: ogni altro esito dà la stessa conferma.
      const kind = passwordResetFailure(error);
      return kind ? { ok: false, kind, message: authFailureMessage(kind) } : { ok: true };
    }
  }, []);

  // Finché non si è letto anche il promemoria, niente decisioni: si resta in caricamento.
  const effectiveStatus: AuthStatus = pendingRead ? status : 'loading';

  const value = useMemo<AuthContextValue>(
    () => ({
      status: effectiveStatus,
      passwordPending: pending,
      verifyLink,
      savePassword,
      user,
      sessionExpired,
      signIn,
      signOut,
      requestPasswordReset,
    }),
    [effectiveStatus, pending, verifyLink, savePassword, user, sessionExpired, signIn, signOut, requestPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth va usato dentro AuthProvider.');
  return context;
}
