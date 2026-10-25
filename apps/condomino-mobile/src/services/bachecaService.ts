import { assertOk, getCurrentUserId, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IBachecaCommento, IBachecaPost, INotifica } from '@iocondo/shared-types';

/** Bacheca avvisi e inbox notifiche del condomino. */
export function createBachecaService(db: TypedSupabaseClient) {
  return {
    async listPost(condominioId: string): Promise<IBachecaPost[]> {
      return unwrap(
        await db
          .from('bacheca_post')
          .select('*')
          .eq('condominio_id', condominioId)
          .order('is_pinned', { ascending: false })
          .order('data_pubblicazione', { ascending: false }),
      );
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
