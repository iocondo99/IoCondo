import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import {
  authFailureMessage,
  classifyAuthError,
  passwordResetFailure,
  type AuthFailureKind,
  type SessionUser,
} from '@iocondo/data';
import { services } from '@/services';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Esito di un'azione: mai l'errore grezzo di Supabase, solo il tipo e il testo da mostrare. */
export type AuthResult = { ok: true } | { ok: false; kind: AuthFailureKind; message: string };

interface AuthContextValue {
  status: AuthStatus;
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

/** Dove porta il link dell'email di reimpostazione: la pagina di accesso, sul web o nell'app. */
function passwordResetRedirect(): string {
  if (Platform.OS === 'web') {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin ?? '';
    return `${origin}/login`;
  }
  return Linking.createURL('/login');
}

/**
 * Sessione dell'utente: la legge all'avvio e ne segue i cambiamenti. Non conosce ruoli, condomìni
 * o dati: sa solo chi è entrato. Nessun log di email o password; il token resta nel servizio.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const hadUser = useRef(false);
  const signingOut = useRef(false);

  const apply = useCallback((next: SessionUser | null) => {
    hadUser.current = next !== null;
    setUser(next);
    setStatus(next ? 'authenticated' : 'unauthenticated');
    if (next) setSessionExpired(false);
  }, []);

  useEffect(() => {
    let active = true;
    const stopListening = services.auth.onSessionChange((event, next) => {
      if (!active) return;
      // Uscita non chiesta dall'utente (token non più rinnovabile, uscita da un'altra scheda): sessione scaduta.
      if (event === 'SIGNED_OUT' && hadUser.current && !signingOut.current) setSessionExpired(true);
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
  }, [apply]);

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
      return { ok: true };
    } catch (error) {
      return failure(error);
    } finally {
      signingOut.current = false;
    }
  }, []);

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

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, sessionExpired, signIn, signOut, requestPasswordReset }),
    [status, user, sessionExpired, signIn, signOut, requestPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth va usato dentro AuthProvider.');
  return context;
}
