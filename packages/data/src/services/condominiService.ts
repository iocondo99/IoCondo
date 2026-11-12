import { assertOk, unwrap, unwrapMaybe, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { ICondominio, IConfigurazioneCondominio, TablesInsert, TablesUpdate } from '@iocondo/shared-types';
import { DEFAULT_MODULI_ATTIVI, type ModuliAttivi } from '../profilo/moduli.ts';

export type FeatureToggles = ModuliAttivi;
export const DEFAULT_TOGGLES: FeatureToggles = DEFAULT_MODULI_ATTIVI;

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

    /** Moduli attivi (UC-05): l'override del palazzo vince sul default del condominio. */
    async getFeatureToggles(condominioId: string, palazzoId?: string | null): Promise<FeatureToggles> {
      const rows = await this.listConfigurazioni(condominioId);
      const cfg =
        (palazzoId ? rows.find((r) => r.palazzo_id === palazzoId) : undefined) ??
        rows.find((r) => r.palazzo_id === null);
      if (!cfg) return { ...DEFAULT_TOGGLES };
      return {
        ...DEFAULT_TOGGLES,
        ...(cfg as unknown as Partial<FeatureToggles>),
      };
    },

    async setFeatureToggles(
      condominioId: string,
      palazzoId: string | null,
      toggles: Partial<FeatureToggles>,
    ): Promise<IConfigurazioneCondominio> {
      let q = db.from('configurazioni_condominio').select('id').eq('condominio_id', condominioId);
      q = palazzoId ? q.eq('palazzo_id', palazzoId) : q.is('palazzo_id', null);
      const existing = unwrapMaybe(await q.maybeSingle());

      try {
        if (existing) {
          return unwrap(
            await db
              .from('configurazioni_condominio')
              .update(toggles as TablesUpdate<'configurazioni_condominio'>)
              .eq('id', existing.id)
              .select('*')
              .single(),
          );
        }
        return unwrap(
          await db
            .from('configurazioni_condominio')
            .insert({
              condominio_id: condominioId,
              palazzo_id: palazzoId,
              ...toggles,
            } as TablesInsert<'configurazioni_condominio'>)
            .select('*')
            .single(),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('column') || msg.includes('schema cache') || msg.includes('PGRST204')) {
          throw new Error(
            `Per salvare questo modulo è necessario applicare prima la migrazione 11 su Supabase (supabase/da-applicare/11_moduli_condominio_estesi.sql). Dettaglio: ${msg}`,
          );
        }
        throw err;
      }
    },

    /** Ripristina i valori predefiniti del condominio per un palazzo eliminando il suo override. */
    async resetPalazzoOverride(condominioId: string, palazzoId: string): Promise<void> {
      assertOk(
        await db
          .from('configurazioni_condominio')
          .delete()
          .eq('condominio_id', condominioId)
          .eq('palazzo_id', palazzoId),
      );
    },
  };
}
export type CondominiService = ReturnType<typeof createCondominiService>;
