import { assertOk, getCurrentUserId, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IBachecaCommento, IBachecaPost, INotifica, TablesUpdate } from '@iocondo/shared-types';

/** Bacheca avvisi, commenti e inbox notifiche. L'INSERT scatena il Database Webhook -> Edge Function `notifiche-push`. */
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

    async listCommenti(postId: string): Promise<IBachecaCommento[]> {
      return unwrap(await db.from('bacheca_commenti').select('*').eq('post_id', postId).order('created_at'));
    },
    async addCommento(postId: string, commento: string): Promise<IBachecaCommento> {
      const autore_id = await getCurrentUserId(db);
      return unwrap(await db.from('bacheca_commenti').insert({ post_id: postId, autore_id, commento }).select('*').single());
    },

    // ---- Notifiche in-app
    async listNotifiche(opts: { soloNonLette?: boolean } = {}): Promise<INotifica[]> {
      let q = db.from('notifiche').select('*');
      if (opts.soloNonLette) q = q.eq('letta', false);
      return unwrap(await q.order('created_at', { ascending: false }).limit(100));
    },
    async segnaLetta(id: string): Promise<void> {
      assertOk(await db.from('notifiche').update({ letta: true }).eq('id', id));
    },
    async segnaTutteLette(): Promise<void> {
      assertOk(await db.from('notifiche').update({ letta: true }).eq('letta', false));
    },

    /** Registra il token push del dispositivo (Expo) per `notifiche-push`. */
    async registraDispositivo(token: string, piattaforma: 'IOS' | 'ANDROID' | 'WEB'): Promise<void> {
      const utente_id = await getCurrentUserId(db);
      assertOk(await db.from('dispositivi_push').upsert({ utente_id, token, piattaforma }, { onConflict: 'token' }));
    },
  };
}
export type BachecaService = ReturnType<typeof createBachecaService>;
