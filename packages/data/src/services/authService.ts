import { unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IUtente } from '@iocondo/shared-types';
import type { SessionUser } from '../auth/authMessages';

export function createAuthService(db: TypedSupabaseClient) {
  return {
    async signIn(email: string, password: string) {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    /** Utente della sessione salvata (se c'e'). Il token non esce da qui. */
    async getSessionUser(): Promise<SessionUser | null> {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      const user = data.session?.user;
      return user ? { id: user.id, email: user.email ?? null } : null;
    },

    /**
     * Ascolta accesso, uscita e rinnovo della sessione. Restituisce la funzione che smette di ascoltare.
     * Il callback non deve chiamare altri metodi di Supabase mentre e' in esecuzione.
     */
    onSessionChange(callback: (event: string, user: SessionUser | null) => void): () => void {
      const { data } = db.auth.onAuthStateChange((event, session) => {
        const user = session?.user;
        callback(event, user ? { id: user.id, email: user.email ?? null } : null);
      });
      return () => data.subscription.unsubscribe();
    },

    /** Chiede l'email di reimpostazione. L'esito non dice se l'indirizzo esiste. */
    async requestPasswordReset(email: string, redirectTo: string) {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },

    /** Conferma il link dell'email (invito o recupero): se è valido apre la sessione. Il token_hash non si salva né si registra. */
    async verifyLink(tokenHash: string, type: 'invite' | 'recovery') {
      const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) throw error;
    },

    /** Salva la nuova password dell'utente della sessione. Riuscito solo se lo conferma il server. */
    async updatePassword(password: string) {
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
    },

    async signOut() {
      const { error } = await db.auth.signOut();
      if (error) throw error;
    },

    async getCurrentUser() {
      const { data: { user } } = await db.auth.getUser();
      return user;
    },

    async getProfile(): Promise<IUtente | null> {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return null;
      return unwrap(await db.from('utenti').select('*').eq('id', user.id).single());
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
