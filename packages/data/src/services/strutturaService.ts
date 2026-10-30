import { assertOk, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type {
  IAnagraficaUnita,
  IPalazzo,
  IScalaColonna,
  ITipologiaUnita,
  IUnitaImmobiliare,
  TablesInsert,
  TablesUpdate,
} from '@iocondo/shared-types';

const oggi = () => new Date().toISOString().slice(0, 10);

/** Gerarchia spaziale: Palazzo -> Scala/Colonna -> Unita' + anagrafiche (proprietari/inquilini). */
export function createStrutturaService(db: TypedSupabaseClient) {
  return {
    // ---- Palazzi
    async listPalazzi(condominioId: string): Promise<IPalazzo[]> {
      return unwrap(await db.from('palazzi').select('*').eq('condominio_id', condominioId).order('nome_identificativo'));
    },
    async createPalazzo(input: TablesInsert<'palazzi'>): Promise<IPalazzo> {
      return unwrap(await db.from('palazzi').insert(input).select('*').single());
    },
    async updatePalazzo(id: string, patch: TablesUpdate<'palazzi'>): Promise<IPalazzo> {
      return unwrap(await db.from('palazzi').update(patch).eq('id', id).select('*').single());
    },
    async removePalazzo(id: string): Promise<void> {
      assertOk(await db.from('palazzi').delete().eq('id', id));
    },

    // ---- Scale / Colonne
    async listScaleColonne(palazzoId: string): Promise<IScalaColonna[]> {
      return unwrap(await db.from('scale_colonne').select('*').eq('palazzo_id', palazzoId).order('nome'));
    },
    async createScalaColonna(input: TablesInsert<'scale_colonne'>): Promise<IScalaColonna> {
      return unwrap(await db.from('scale_colonne').insert(input).select('*').single());
    },

    // ---- Unita'
    async listTipologie(): Promise<ITipologiaUnita[]> {
      return unwrap(await db.from('tipologie_unita').select('*').order('descrizione'));
    },
    async listUnita(palazzoId: string): Promise<IUnitaImmobiliare[]> {
      return unwrap(await db.from('unita_immobiliari').select('*').eq('palazzo_id', palazzoId).order('interno'));
    },
    async getUnita(id: string): Promise<IUnitaImmobiliare> {
      return unwrap(await db.from('unita_immobiliari').select('*').eq('id', id).single());
    },
    async createUnita(input: TablesInsert<'unita_immobiliari'>): Promise<IUnitaImmobiliare> {
      return unwrap(await db.from('unita_immobiliari').insert(input).select('*').single());
    },
    async updateUnita(id: string, patch: TablesUpdate<'unita_immobiliari'>): Promise<IUnitaImmobiliare> {
      return unwrap(await db.from('unita_immobiliari').update(patch).eq('id', id).select('*').single());
    },
    async removeUnita(id: string): Promise<void> {
      assertOk(await db.from('unita_immobiliari').delete().eq('id', id));
    },

    // ---- Anagrafiche (storico possessi)
    async listAnagrafiche(unitaId: string): Promise<IAnagraficaUnita[]> {
      return unwrap(
        await db.from('anagrafiche_unita').select('*').eq('unita_id', unitaId).order('data_inizio', { ascending: false }),
      );
    },

    /**
     * Subentro (UC-11): chiude le anagrafiche attive dello stesso tipo e apre quella nuova.
     * Il debito del precedente proprietario resta legato a lui (rate_dettaglio.utente_id).
     */
    async subentro(input: {
      unitaId: string;
      nuovoUtenteId: string;
      tipoPossesso: IAnagraficaUnita['tipo_possesso'];
      dataSubentro?: string;
    }): Promise<IAnagraficaUnita> {
      const data = input.dataSubentro ?? oggi();
      assertOk(
        await db
          .from('anagrafiche_unita')
          .update({ data_fine: data })
          .eq('unita_id', input.unitaId)
          .eq('tipo_possesso', input.tipoPossesso)
          .is('data_fine', null),
      );
      return unwrap(
        await db
          .from('anagrafiche_unita')
          .insert({
            unita_id: input.unitaId,
            utente_id: input.nuovoUtenteId,
            tipo_possesso: input.tipoPossesso,
            data_inizio: data,
          })
          .select('*')
          .single(),
      );
    },
  };
}
export type StrutturaService = ReturnType<typeof createStrutturaService>;
