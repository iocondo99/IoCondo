import { unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IUtente } from '@iocondo/shared-types';

export function createAuthService(db: TypedSupabaseClient) {
  return {
    async signIn(email: string, password: string) {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
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
