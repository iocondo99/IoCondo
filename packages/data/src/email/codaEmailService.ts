import { invokeFunction, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { ICodaEmail } from '@iocondo/shared-types';
import {
  costruisciMittenteAmministratore,
  type MittenteAmministratore,
  type TipoEventoEmail,
} from './codaEmailLogic';

export interface AccodaEmailInput {
  condominioId: string;
  tipoEvento: TipoEventoEmail;
  riferimentoId: string;
  riferimentoIds?: string[];
  secondaConvocazione?: string | null;
}

export interface AccodaEmailResult {
  accodate: number;
  saltate_senza_email: number;
  from_email: string;
  reply_to_email: string | null;
  worker_avviato: boolean;
}

export interface ElaboraCodaResult {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

export interface AnteprimaMittenteAdmin {
  nomeCognome: string | null;
  email: string | null;
  mittente: MittenteAmministratore;
}

/**
 * Servizio per l'accodamento email via Edge Function `accoda-email`,
 * l'elaborazione batch tramite `invia-coda-email` e la consultazione dei log `coda_email`.
 */
export function createCodaEmailService(db: TypedSupabaseClient) {
  return {
    /**
     * Elenco ultimi invii in `public.coda_email` per il condominio attivo.
     */
    async listCodaEmail(condominioId: string, limit = 100): Promise<ICodaEmail[]> {
      const rows = unwrap(
        await db
          .from('coda_email')
          .select('*')
          .eq('condominio_id', condominioId)
          .order('created_at', { ascending: false })
          .limit(limit),
      );
      return rows ?? [];
    },

    /**
     * Ricava in sola lettura i dati dell'amministratore del condominio attivo
     * per mostrare l'anteprima di `From` e `Reply-To` nella vista Log & Coda Email.
     */
    async getAnteprimaMittente(
      condominioId: string,
      utenteCorrenteId?: string | null,
    ): Promise<AnteprimaMittenteAdmin> {
      const { data: condominio } = await db
        .from('condomini')
        .select('admin_id')
        .eq('id', condominioId)
        .maybeSingle();

      const adminId = utenteCorrenteId || condominio?.admin_id || null;
      let nomeCognome: string | null = null;
      let email: string | null = null;

      if (adminId) {
        const { data: utente } = await db
          .from('utenti')
          .select('nome_cognome, email')
          .eq('id', adminId)
          .maybeSingle();
        nomeCognome = utente?.nome_cognome ?? null;
        email = utente?.email ?? null;
      }

      return {
        nomeCognome,
        email,
        mittente: costruisciMittenteAmministratore({
          nomeCognome,
          email,
        }),
      };
    },

    /**
     * Accoda le email per un evento (`BOLLETTINO_EMESSO`, `CONVOCAZIONE_ASSEMBLEA`, `COMUNICAZIONE_IMPORTANTE`).
     */
    async accodaEmail(input: AccodaEmailInput): Promise<AccodaEmailResult> {
      return await invokeFunction<AccodaEmailResult>(db, 'accoda-email', {
        condominio_id: input.condominioId,
        tipo_evento: input.tipoEvento,
        riferimento_id: input.riferimentoId,
        riferimento_ids: input.riferimentoIds,
        seconda_convocazione: input.secondaConvocazione ?? null,
      });
    },

    /**
     * Avvia manualmente l'elaborazione della coda email per il condominio attivo.
     */
    async elaboraCodaOra(condominioId: string, limit = 25): Promise<ElaboraCodaResult> {
      return await invokeFunction<ElaboraCodaResult>(db, 'invia-coda-email', {
        condominio_id: condominioId,
        limit,
      });
    },

    /**
     * Rimette in coda le email `FAILED` del condominio attivo e avvia subito un giro di invio.
     */
    async riprovaFallite(condominioId: string, limit = 25): Promise<ElaboraCodaResult> {
      return await invokeFunction<ElaboraCodaResult>(db, 'invia-coda-email', {
        condominio_id: condominioId,
        action: 'retry_failed',
        limit,
      });
    },
  };
}

export type CodaEmailService = ReturnType<typeof createCodaEmailService>;
