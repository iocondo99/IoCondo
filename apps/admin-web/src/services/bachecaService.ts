import { assertOk, getCurrentUserId, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IBachecaPost, TablesUpdate } from '@iocondo/shared-types';

/** Bacheca avvisi. L'INSERT scatena il Database Webhook -> Edge Function `notifiche-push`. */
export function createBachecaService(db: TypedSupabaseClient) {
  return {
    async list(condominioId: string): Promise<IBachecaPost[]> {
      return unwrap(
        await db
          .from('bacheca_post')
          .select('*')
          .eq('condominio_id', condominioId)
          .order('is_pinned', { ascending: false })
          .order('data_pubblicazione', { ascending: false }),
      );
    },
    async publish(input: {
      condominio_id: string;
      titolo: string;
      corpo?: string;
      palazzo_id?: string | null;
      is_pinned?: boolean;
    }): Promise<IBachecaPost> {
      const autore_id = await getCurrentUserId(db);
      return unwrap(
        await db
          .from('bacheca_post')
          .insert({
            condominio_id: input.condominio_id,
            titolo: input.titolo,
            corpo: input.corpo ?? null,
            palazzo_id: input.palazzo_id ?? null,
            is_pinned: input.is_pinned ?? false,
            autore_id,
          })
          .select('*')
          .single(),
      );
    },
    async update(id: string, patch: TablesUpdate<'bacheca_post'>): Promise<IBachecaPost> {
      return unwrap(await db.from('bacheca_post').update(patch).eq('id', id).select('*').single());
    },
    async remove(id: string): Promise<void> {
      assertOk(await db.from('bacheca_post').delete().eq('id', id));
    },
  };
}
export type BachecaService = ReturnType<typeof createBachecaService>;
