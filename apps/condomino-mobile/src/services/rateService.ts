import { getCurrentUserId, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { IPagamentoRata, IRataDettaglio, IRataTestata } from '@iocondo/shared-types';

export type IRataConTestata = IRataDettaglio & { testata: IRataTestata | null };

/** "Le mie rate": la RLS restituisce solo le rate di cui l'utente e' debitore (o della sua unita'). */
export function createRateService(db: TypedSupabaseClient) {
  return {
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
  };
}
export type RateService = ReturnType<typeof createRateService>;
