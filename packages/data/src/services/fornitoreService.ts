import { assertOk, invokeFunction, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IFornitore, TablesInsert, TablesUpdate } from '@iocondo/shared-types';

export interface FornitoreMagicLinkInfo {
  ticket: {
    id: string;
    titolo: string;
    descrizione: string | null;
    stato: string;
    priorita: string;
    is_area_comune: boolean;
    condominio: string;
  };
  intervento: {
    id: string;
    data_prevista: string | null;
  };
}

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
    /** UC-08: Accesso e chiusura intervento tramite Magic Link (Edge Function `fornitore-intervento`). */
    async getMagicLinkInfo(token: string): Promise<FornitoreMagicLinkInfo> {
      return invokeFunction<FornitoreMagicLinkInfo>(db, 'fornitore-intervento', {
        token,
        azione: 'get',
      });
    },
    async chiudiInterventoMagicLink(input: {
      token: string;
      importo_consuntivo?: number;
      note_fornitore?: string;
      fattura_url?: string;
      foto_lavoro_url?: string;
    }): Promise<{ ok: boolean; messaggio: string }> {
      return invokeFunction<{ ok: boolean; messaggio: string }>(db, 'fornitore-intervento', {
        ...input,
        azione: 'chiudi',
      });
    },
  };
}
export type FornitoreService = ReturnType<typeof createFornitoreService>;
