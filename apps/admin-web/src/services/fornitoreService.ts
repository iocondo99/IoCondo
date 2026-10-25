import { assertOk, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IFornitore, TablesInsert, TablesUpdate } from '@iocondo/shared-types';

export function createFornitoreService(db: TypedSupabaseClient) {
  return {
    async list(): Promise<IFornitore[]> {
      return unwrap(await db.from('fornitori').select('*').order('ragione_sociale'));
    },
    async getById(id: string): Promise<IFornitore> {
      return unwrap(await db.from('fornitori').select('*').eq('id', id).single());
    },
    /** `admin_id` deve essere l'id dell'amministratore autenticato (imposto dalla RLS). */
    async create(input: TablesInsert<'fornitori'>): Promise<IFornitore> {
      return unwrap(await db.from('fornitori').insert(input).select('*').single());
    },
    async update(id: string, patch: TablesUpdate<'fornitori'>): Promise<IFornitore> {
      return unwrap(await db.from('fornitori').update(patch).eq('id', id).select('*').single());
    },
    async remove(id: string): Promise<void> {
      assertOk(await db.from('fornitori').delete().eq('id', id));
    },
  };
}
export type FornitoreService = ReturnType<typeof createFornitoreService>;
