import { assertOk, unwrap, unwrapMaybe, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { ICondominio, IConfigurazioneCondominio, TablesInsert, TablesUpdate } from '@iocondo/shared-types';

export type FeatureToggles = Pick<
  IConfigurazioneCondominio,
  'abilita_social' | 'abilita_chat' | 'abilita_bacheca' | 'abilita_ticket' | 'abilita_prenotazioni' | 'abilita_pacchi'
>;

export function createCondominiService(db: TypedSupabaseClient) {
  return {
    /** Condomini visibili all'utente (la RLS limita ai propri). */
    async list(): Promise<ICondominio[]> {
      return unwrap(await db.from('condomini').select('*').order('nome'));
    },

    async getById(id: string): Promise<ICondominio | null> {
      return unwrapMaybe(await db.from('condomini').select('*').eq('id', id).maybeSingle());
    },

    async create(input: TablesInsert<'condomini'>): Promise<ICondominio> {
      return unwrap(await db.from('condomini').insert(input).select('*').single());
    },

    async update(id: string, patch: TablesUpdate<'condomini'>): Promise<ICondominio> {
      return unwrap(await db.from('condomini').update(patch).eq('id', id).select('*').single());
    },

    async remove(id: string): Promise<void> {
      assertOk(await db.from('condomini').delete().eq('id', id));
    },

    /** Toggle moduli: righe di default (palazzoId null) e override per palazzo (UC-05). */
    async listConfigurazioni(condominioId: string): Promise<IConfigurazioneCondominio[]> {
      return unwrap(await db.from('configurazioni_condominio').select('*').eq('condominio_id', condominioId));
    },

    async setFeatureToggles(
      condominioId: string,
      palazzoId: string | null,
      toggles: Partial<FeatureToggles>,
    ): Promise<IConfigurazioneCondominio> {
      let q = db.from('configurazioni_condominio').select('id').eq('condominio_id', condominioId);
      q = palazzoId ? q.eq('palazzo_id', palazzoId) : q.is('palazzo_id', null);
      const existing = unwrapMaybe(await q.maybeSingle());
      if (existing) {
        return unwrap(
          await db.from('configurazioni_condominio').update(toggles).eq('id', existing.id).select('*').single(),
        );
      }
      return unwrap(
        await db
          .from('configurazioni_condominio')
          .insert({ condominio_id: condominioId, palazzo_id: palazzoId, ...toggles })
          .select('*')
          .single(),
      );
    },
  };
}
export type CondominiService = ReturnType<typeof createCondominiService>;
