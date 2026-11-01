import { invokeFunction, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  etichettaUnita,
  type RigaInvito,
  type RuoloInvitabile,
} from '../inviti/invitiLogic';

export interface NuovoInvito {
  email: string;
  ruolo: RuoloInvitabile;
  condominioId: string;
  unitaId: string | null;
  flagPortiere: boolean;
}

export interface OpzioneUnita {
  id: string;
  etichetta: string;
}

/**
 * Inviti a un condominio. L'invio passa dalla Edge Function `invita-utente`: permessi, ruoli e unità li
 * controlla il database. L'elenco legge solo ciò che la RLS consente (amministratore e super amministratore).
 */
export function createInvitiService(db: TypedSupabaseClient) {
  return {
    /** Lancia ServiceError: il codice è lo stato HTTP della funzione, il testo non va mostrato così com'è. */
    async invia(invito: NuovoInvito): Promise<void> {
      await invokeFunction<{ ok: true }>(db, 'invita-utente', {
        email: invito.email,
        ruolo: invito.ruolo,
        condominio_id: invito.condominioId,
        unita_id: invito.unitaId,
        flag_portiere: invito.flagPortiere,
      });
    },

    async list(condominioId: string): Promise<RigaInvito[]> {
      const ruoli = unwrap(await db.from('ruoli_piattaforma').select('id, codice'));
      const codiceDi = new Map(ruoli.map((r) => [r.id, r.codice]));
      const righe = unwrap(
        await db
          .from('inviti_pendenti')
          .select('email, ruolo_proposto, flag_portiere, unita_id, scadenza, accettato_at')
          .eq('condominio_id', condominioId)
          .order('scadenza', { ascending: false }),
      );
      return righe.flatMap((r) => {
        const ruolo = codiceDi.get(r.ruolo_proposto);
        if (ruolo !== 'CONDOMINO' && ruolo !== 'PORTIERE' && ruolo !== 'ADMIN') return [];
        return [
          {
            email: r.email,
            ruolo,
            flagPortiere: r.flag_portiere,
            unitaId: r.unita_id,
            scadenza: r.scadenza,
            accettatoAt: r.accettato_at,
          },
        ];
      });
    },

    /** Unità del condominio, per sceglierne una nell'invito. */
    async listUnita(condominioId: string): Promise<OpzioneUnita[]> {
      const palazzi = unwrap(await db.from('palazzi').select('id, nome_identificativo').eq('condominio_id', condominioId));
      if (palazzi.length === 0) return [];
      const nomeDi = new Map(palazzi.map((p) => [p.id, p.nome_identificativo]));
      const unita = unwrap(
        await db.from('unita_immobiliari').select('id, palazzo_id, interno').in('palazzo_id', [...nomeDi.keys()]),
      );
      return unita
        .map((u) => ({ id: u.id, etichetta: etichettaUnita(nomeDi.get(u.palazzo_id) ?? '', u.interno) }))
        .sort((x, y) => x.etichetta.localeCompare(y.etichetta, 'it', { numeric: true }));
    },
  };
}

export type InvitiService = ReturnType<typeof createInvitiService>;
