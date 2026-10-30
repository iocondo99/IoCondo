import { assertOk, getCurrentUserId, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type {
  ICategoriaGuasto,
  IFornitoreToken,
  ITicketAllegato,
  ITicketIntervento,
  ITicketMessaggio,
  ITicketTestata,
} from '@iocondo/shared-types';

type StatoTicket = ITicketTestata['stato'];

function newToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
}

/** Ticket guasti (UC-02): gestione admin e segnalazione condomino/portiere. */
export function createTicketService(db: TypedSupabaseClient) {
  return {
    async listCategorie(): Promise<ICategoriaGuasto[]> {
      return unwrap(await db.from('categorie_guasti').select('*').order('nome'));
    },

    async list(condominioId: string, stato?: StatoTicket): Promise<ITicketTestata[]> {
      let q = db.from('ticket_testata').select('*').eq('condominio_id', condominioId);
      if (stato) q = q.eq('stato', stato);
      return unwrap(await q.order('created_at', { ascending: false }));
    },

    /** Ticket visibili all'utente (suoi, della sua unita', o delle aree comuni per il portiere). */
    async listMiei(opts: { soloMiei?: boolean } = {}): Promise<ITicketTestata[]> {
      let q = db.from('ticket_testata').select('*');
      if (opts.soloMiei) q = q.eq('segnalatore_id', await getCurrentUserId(db));
      return unwrap(await q.order('created_at', { ascending: false }));
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

    async getById(id: string): Promise<ITicketTestata> {
      return unwrap(await db.from('ticket_testata').select('*').eq('id', id).single());
    },

    async cambiaStato(id: string, stato: StatoTicket): Promise<ITicketTestata> {
      return unwrap(
        await db
          .from('ticket_testata')
          .update({ stato, closed_at: stato === 'RISOLTO' ? new Date().toISOString() : null })
          .eq('id', id)
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

    async listInterventi(ticketId: string): Promise<ITicketIntervento[]> {
      return unwrap(await db.from('ticket_interventi').select('*').eq('ticket_id', ticketId));
    },

    /**
     * Assegna il ticket a un fornitore: crea l'intervento, genera il token del magic link (UC-08),
     * e porta il ticket in LAVORAZIONE. L'invio dell'email e la validazione del token sono lato server.
     */
    async assegnaFornitore(input: {
      ticketId: string;
      fornitoreId: string;
      dataPrevista?: string;
      baseUrl: string; // es. https://app.iocondo.it/fornitore
      giorniValidita?: number;
    }): Promise<{ intervento: ITicketIntervento; token: IFornitoreToken }> {
      const intervento = unwrap(
        await db
          .from('ticket_interventi')
          .insert({
            ticket_id: input.ticketId,
            fornitore_id: input.fornitoreId,
            data_prevista: input.dataPrevista ?? null,
          })
          .select('*')
          .single(),
      );
      const token = newToken();
      const scadenza = new Date(Date.now() + (input.giorniValidita ?? 7) * 86_400_000).toISOString();
      const tokenRow = unwrap(
        await db
          .from('fornitori_tokens')
          .insert({
            token,
            ticket_intervento_id: intervento.id,
            url_magico: `${input.baseUrl.replace(/\/$/, '')}/${token}`,
            data_scadenza: scadenza,
          })
          .select('*')
          .single(),
      );
      assertOk(await db.from('ticket_testata').update({ stato: 'LAVORAZIONE' }).eq('id', input.ticketId));
      return { intervento, token: tokenRow };
    },
  };
}
export type TicketService = ReturnType<typeof createTicketService>;
