import { getCurrentUserId, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IAssembleaPuntoOdg, IAssembleaTestata, IAssembleaVoto } from '@iocondo/shared-types';

export interface RisultatoVoto {
  voto: string;
  n_voti: number;
  millesimi: number;
  percentuale_teste: number;
  percentuale_millesimi: number;
}

/** Assemblee e votazioni (UC-10). Il condomino vede solo le PERCENTUALI aggregate dei vicini. */
export function createAssembleaService(db: TypedSupabaseClient) {
  return {
    async list(condominioId: string): Promise<IAssembleaTestata[]> {
      return unwrap(
        await db.from('assemblee_testata').select('*').eq('condominio_id', condominioId).order('data', { ascending: false }),
      );
    },
    async listPunti(assembleaId: string): Promise<IAssembleaPuntoOdg[]> {
      return unwrap(await db.from('assemblee_punti_odg').select('*').eq('assemblea_id', assembleaId).order('ordine'));
    },
    /** Il mio voto (se espresso) per un punto. */
    async mioVoto(puntoId: string, unitaId: string): Promise<IAssembleaVoto | null> {
      const rows = unwrap(
        await db.from('assemblee_voti').select('*').eq('punto_odg_id', puntoId).eq('unita_id', unitaId).limit(1),
      );
      return rows[0] ?? null;
    },
    async vota(puntoId: string, unitaId: string, voto: IAssembleaVoto['voto']): Promise<IAssembleaVoto> {
      const utente_id = await getCurrentUserId(db);
      return unwrap(
        await db
          .from('assemblee_voti')
          .upsert({ punto_odg_id: puntoId, unita_id: unitaId, utente_id, voto }, { onConflict: 'punto_odg_id,unita_id' })
          .select('*')
          .single(),
      );
    },
    async risultati(puntoId: string): Promise<RisultatoVoto[]> {
      return unwrap(await db.rpc('risultati_voto', { p_punto: puntoId }));
    },
  };
}
export type AssembleaService = ReturnType<typeof createAssembleaService>;
