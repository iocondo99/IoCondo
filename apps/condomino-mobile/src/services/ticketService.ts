import { assertOk, getCurrentUserId, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { ICategoriaGuasto, ITicketAllegato, ITicketMessaggio, ITicketTestata } from '@iocondo/shared-types';

/** Ticket guasti lato condomino/portiere (UC-02). */
export function createTicketService(db: TypedSupabaseClient) {
  return {
    async listCategorie(): Promise<ICategoriaGuasto[]> {
      return unwrap(await db.from('categorie_guasti').select('*').order('nome'));
    },

    /** Ticket visibili all'utente (suoi, della sua unita', o delle aree comuni per il portiere). */
    async list(opts: { soloMiei?: boolean } = {}): Promise<ITicketTestata[]> {
      let q = db.from('ticket_testata').select('*');
      if (opts.soloMiei) q = q.eq('segnalatore_id', await getCurrentUserId(db));
      return unwrap(await q.order('created_at', { ascending: false }));
    },

    async getById(id: string): Promise<ITicketTestata> {
      return unwrap(await db.from('ticket_testata').select('*').eq('id', id).single());
    },

    async create(input: {
      condominio_id: string;
      titolo: string;
      descrizione?: string;
      unita_id?: string | null;
      categoria_id?: string | null;
      is_area_comune?: boolean;
      priorita?: ITicketTestata['priorita'];
    }): Promise<ITicketTestata> {
      const segnalatore_id = await getCurrentUserId(db);
      return unwrap(
        await db
          .from('ticket_testata')
          .insert({
            condominio_id: input.condominio_id,
            titolo: input.titolo,
            descrizione: input.descrizione ?? null,
            unita_id: input.unita_id ?? null,
            categoria_id: input.categoria_id ?? null,
            is_area_comune: input.is_area_comune ?? false,
            priorita: input.priorita ?? 'MEDIA',
            segnalatore_id,
          })
          .select('*')
          .single(),
      );
    },

    async listMessaggi(ticketId: string): Promise<ITicketMessaggio[]> {
      return unwrap(await db.from('ticket_messaggi').select('*').eq('ticket_id', ticketId).order('timestamp'));
    },

    async addMessaggio(ticketId: string, messaggio: string): Promise<ITicketMessaggio> {
      const mittente_id = await getCurrentUserId(db);
      return unwrap(await db.from('ticket_messaggi').insert({ ticket_id: ticketId, mittente_id, messaggio }).select('*').single());
    },

    async listAllegati(ticketId: string): Promise<ITicketAllegato[]> {
      return unwrap(await db.from('ticket_allegati').select('*').eq('ticket_id', ticketId));
    },

    /** Registra un allegato gia' caricato su Storage (REQ-C03: foto del guasto). */
    async addAllegato(ticketId: string, urlStorage: string, tipo: ITicketAllegato['tipo_file'] = 'FOTO'): Promise<ITicketAllegato> {
      const caricato_da = await getCurrentUserId(db);
      return unwrap(
        await db
          .from('ticket_allegati')
          .insert({ ticket_id: ticketId, url_storage: urlStorage, tipo_file: tipo, caricato_da })
          .select('*')
          .single(),
      );
    },

    async removeAllegato(id: string): Promise<void> {
      assertOk(await db.from('ticket_allegati').delete().eq('id', id));
    },
  };
}
export type TicketService = ReturnType<typeof createTicketService>;
