import { assertOk, getCurrentUserId, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IBachecaCommento, IBachecaPost, TablesUpdate } from '@iocondo/shared-types';

/** Bacheca avvisi e commenti. L'INSERT scatena il Database Webhook -> Edge Function `notifiche-push`. */
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

    // Notifiche in-app: lettura e "segna come lette" sono in `profilo` (listMieNotifiche, segnaMieNotificheLette,
    // segnaNotificaLetta), sempre filtrate per utente: la policy lascia al super amministratore tutte le righe.

    /** Registra il token push del dispositivo (Expo) per `notifiche-push`. */
    async registraDispositivo(token: string, piattaforma: 'IOS' | 'ANDROID' | 'WEB'): Promise<void> {
      const utente_id = await getCurrentUserId(db);
      assertOk(await db.from('dispositivi_push').upsert({ utente_id, token, piattaforma }, { onConflict: 'token' }));
    },
  };
}
export type BachecaService = ReturnType<typeof createBachecaService>;
