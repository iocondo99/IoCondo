import { assertOk, getCurrentUserId, invokeFunction, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type {
  IEsercizioContabile,
  IPagamentoRata,
  IQuotaMillesimale,
  IRataDettaglio,
  IRataTestata,
  ITabellaMillesimale,
  TablesInsert,
} from '@iocondo/shared-types';

export interface RipartizioneInput {
  importo: number;
  tabella_millesimale_id: string;
  esercizio_id: string;
  data_scadenza: string; // YYYY-MM-DD
  descrizione: string;
  pubblica?: boolean;
}

export interface RipartizioneResult {
  rata_testata_id: string;
  totale: number;
  numero_quote: number;
  righe: { unita_id: string; utente_id: string | null; importo_dovuto: number }[];
}

export type IRataConTestata = IRataDettaglio & { testata: IRataTestata | null };

const oggi = () => new Date().toISOString().slice(0, 10);

/** Contabilita': esercizi, tabelle millesimali, rate e riconciliazione manuale. */
export function createRateService(db: TypedSupabaseClient) {
  return {
    // ---- Esercizi
    async listEsercizi(condominioId: string): Promise<IEsercizioContabile[]> {
      return unwrap(
        await db.from('esercizi_contabili').select('*').eq('condominio_id', condominioId).order('anno', { ascending: false }),
      );
    },
    async createEsercizio(input: TablesInsert<'esercizi_contabili'>): Promise<IEsercizioContabile> {
      return unwrap(await db.from('esercizi_contabili').insert(input).select('*').single());
    },

    // ---- Tabelle millesimali
    async listTabelleMillesimali(condominioId: string): Promise<ITabellaMillesimale[]> {
      return unwrap(await db.from('tabelle_millesimali').select('*').eq('condominio_id', condominioId).order('nome'));
    },
    async listQuote(tabellaId: string): Promise<IQuotaMillesimale[]> {
      return unwrap(await db.from('quote_millesimali').select('*').eq('tabella_id', tabellaId));
    },

    // ---- Ripartizione (logica server-side: Edge Function)
    async ripartisciSpese(input: RipartizioneInput): Promise<RipartizioneResult> {
      return invokeFunction<RipartizioneResult>(db, 'ripartizione-spese', { ...input });
    },

    // ---- Rate
    async listTestate(esercizioId: string): Promise<IRataTestata[]> {
      return unwrap(await db.from('rate_testata').select('*').eq('esercizio_id', esercizioId).order('data_scadenza'));
    },
    async pubblicaTestata(testataId: string): Promise<IRataTestata> {
      return unwrap(await db.from('rate_testata').update({ pubblicata: true }).eq('id', testataId).select('*').single());
    },
    async listDettaglio(testataId: string): Promise<IRataDettaglio[]> {
      return unwrap(await db.from('rate_dettaglio').select('*').eq('rata_testata_id', testataId));
    },

    /** Rate non pagate ordinate per scadenza; con `soloInRitardo` solo quelle gia' scadute o in stato RITARDO. */
    async listMorosi(esercizioId: string, soloInRitardo = true): Promise<(IRataDettaglio & { data_scadenza: string })[]> {
      const testate = await this.listTestate(esercizioId);
      if (testate.length === 0) return [];
      const scadenze = new Map(testate.map((t) => [t.id, t.data_scadenza]));
      const rows = unwrap(
        await db
          .from('rate_dettaglio')
          .select('*')
          .in('rata_testata_id', testate.map((t) => t.id))
          .neq('stato', 'PAGATO'),
      );
      return rows
        .map((r) => ({ ...r, data_scadenza: scadenze.get(r.rata_testata_id) ?? '' }))
        .filter((r) => !soloInRitardo || r.stato === 'RITARDO' || r.data_scadenza < oggi())
        .sort((a, b) => a.data_scadenza.localeCompare(b.data_scadenza));
    },

    /** Marcatura manuale (es. incasso in contanti/assegno). */
    async segnaPagata(rataId: string, importoPagato?: number): Promise<IRataDettaglio> {
      const rata = unwrap(await db.from('rate_dettaglio').select('importo_dovuto').eq('id', rataId).single());
      return unwrap(
        await db
          .from('rate_dettaglio')
          .update({
            stato: 'PAGATO',
            importo_pagato: importoPagato ?? rata.importo_dovuto,
            data_pagamento: oggi(),
          })
          .eq('id', rataId)
          .select('*')
          .single(),
      );
    },

    // ---- Lato condomino: "le mie rate" (la RLS restituisce solo quelle di cui l'utente e' debitore)
    async listMie(opts: { soloDaPagare?: boolean } = {}): Promise<IRataConTestata[]> {
      let q = db.from('rate_dettaglio').select('*');
      if (opts.soloDaPagare) q = q.neq('stato', 'PAGATO');
      const rate = unwrap(await q);
      if (rate.length === 0) return [];

      const testate = unwrap(
        await db.from('rate_testata').select('*').in('id', [...new Set(rate.map((r) => r.rata_testata_id))]),
      );
      const byId = new Map(testate.map((t) => [t.id, t]));
      return rate
        .map((r) => ({ ...r, testata: byId.get(r.rata_testata_id) ?? null }))
        .sort((a, b) => (a.testata?.data_scadenza ?? '').localeCompare(b.testata?.data_scadenza ?? ''));
    },

    async getById(rataId: string): Promise<IRataConTestata> {
      const rata = unwrap(await db.from('rate_dettaglio').select('*').eq('id', rataId).single());
      const testata = unwrap(await db.from('rate_testata').select('*').eq('id', rata.rata_testata_id).single());
      return { ...rata, testata };
    },

    async listPagamenti(rataId: string): Promise<IPagamentoRata[]> {
      return unwrap(
        await db.from('pagamenti_rate').select('*').eq('rata_dettaglio_id', rataId).order('created_at', { ascending: false }),
      );
    },

    /**
     * Registra l'intenzione di pagare (stato IN_ATTESA). L'esito definitivo arriva dal webhook
     * (Edge Function `sync-pagamenti`): il client NON puo' mai marcare una rata come pagata.
     */
    async avviaPagamento(input: {
      rataId: string;
      importo: number;
      metodo: IPagamentoRata['metodo'];
      provider?: IPagamentoRata['provider'];
      providerRef?: string;
    }): Promise<IPagamentoRata> {
      const utente_id = await getCurrentUserId(db);
      return unwrap(
        await db
          .from('pagamenti_rate')
          .insert({
            rata_dettaglio_id: input.rataId,
            utente_id,
            importo: input.importo,
            metodo: input.metodo,
            provider: input.provider ?? null,
            provider_ref: input.providerRef ?? null,
            stato: 'IN_ATTESA',
          })
          .select('*')
          .single(),
      );
    },

    async removeTestata(testataId: string): Promise<void> {
      assertOk(await db.from('rate_testata').delete().eq('id', testataId));
    },
  };
}
export type RateService = ReturnType<typeof createRateService>;
