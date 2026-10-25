import { unwrap, unwrapMaybe, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { ICondominio, IConfigurazioneCondominio } from '@iocondo/shared-types';

export type FeatureToggles = Pick<
  IConfigurazioneCondominio,
  'abilita_social' | 'abilita_chat' | 'abilita_bacheca' | 'abilita_ticket' | 'abilita_prenotazioni' | 'abilita_pacchi'
>;

const DEFAULT_TOGGLES: FeatureToggles = {
  abilita_social: true,
  abilita_chat: true,
  abilita_bacheca: true,
  abilita_ticket: true,
  abilita_prenotazioni: true,
  abilita_pacchi: true,
};

export function createCondominiService(db: TypedSupabaseClient) {
  return {
    /** Condomini a cui l'utente e' associato (la RLS filtra). */
    async listMiei(): Promise<ICondominio[]> {
      return unwrap(await db.from('condomini').select('*').order('nome'));
    },

    async getById(id: string): Promise<ICondominio | null> {
      return unwrapMaybe(await db.from('condomini').select('*').eq('id', id).maybeSingle());
    },

    /** Moduli attivi (UC-05): l'override del palazzo vince sul default del condominio. */
    async getFeatureToggles(condominioId: string, palazzoId?: string | null): Promise<FeatureToggles> {
      const rows = unwrap(
        await db.from('configurazioni_condominio').select('*').eq('condominio_id', condominioId),
      );
      const cfg =
        (palazzoId ? rows.find((r) => r.palazzo_id === palazzoId) : undefined) ??
        rows.find((r) => r.palazzo_id === null);
      return cfg ?? DEFAULT_TOGGLES;
    },
  };
}
export type CondominiService = ReturnType<typeof createCondominiService>;
