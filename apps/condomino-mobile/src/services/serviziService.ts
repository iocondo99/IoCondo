import {
  assertOk,
  getCurrentUserId,
  invokeFunction,
  ServiceError,
  unwrap,
  type TypedSupabaseClient,
} from '@iocondo/supabase-client';
import type {
  ILogStoricoImmobile,
  IPrenotazioneSpazio,
  IRegistroPacco,
  IRisorsaPrenotabile,
} from '@iocondo/shared-types';

/** Servizi di condominio: prenotazione spazi comuni (REQ-C05) e pacchi in portineria. */
export function createServiziService(db: TypedSupabaseClient) {
  return {
    // ---- Spazi comuni
    async listRisorse(condominioId: string): Promise<IRisorsaPrenotabile[]> {
      return unwrap(await db.from('risorse_prenotabili').select('*').eq('condominio_id', condominioId).order('nome'));
    },

    async listPrenotazioni(risorsaId: string, dal: Date, al: Date): Promise<IPrenotazioneSpazio[]> {
      return unwrap(
        await db
          .from('prenotazioni_spazi')
          .select('*')
          .eq('risorsa_id', risorsaId)
          .lt('data_inizio', al.toISOString())
          .gt('data_fine', dal.toISOString())
          .order('data_inizio'),
      );
    },

    /** Calcola il costo da tariffa oraria, rispetta `max_ore`; le sovrapposizioni sono respinte dal DB. */
    async prenota(risorsa: IRisorsaPrenotabile, inizio: Date, fine: Date): Promise<IPrenotazioneSpazio> {
      const ore = (fine.getTime() - inizio.getTime()) / 3_600_000;
      if (ore <= 0) throw new ServiceError('La fine deve essere successiva all\'inizio');
      if (risorsa.max_ore !== null && ore > risorsa.max_ore) {
        throw new ServiceError(`Durata massima consentita: ${risorsa.max_ore} ore`);
      }
      const utente_id = await getCurrentUserId(db);
      return unwrap(
        await db
          .from('prenotazioni_spazi')
          .insert({
            risorsa_id: risorsa.id,
            utente_id,
            data_inizio: inizio.toISOString(),
            data_fine: fine.toISOString(),
            costo_addebitato: Math.round(ore * risorsa.tariffa_oraria * 100) / 100,
          })
          .select('*')
          .single(),
      );
    },

    async annullaPrenotazione(id: string): Promise<void> {
      assertOk(await db.from('prenotazioni_spazi').delete().eq('id', id));
    },

    // ---- Pacchi (condomino: i propri; portiere: tutti del condominio)
    async listPacchi(condominioId: string, opts: { soloInGiacenza?: boolean } = {}): Promise<IRegistroPacco[]> {
      let q = db.from('registro_pacchi').select('*').eq('condominio_id', condominioId);
      if (opts.soloInGiacenza) q = q.eq('stato', 'GIACENZA');
      return unwrap(await q.order('data_arrivo', { ascending: false }));
    },

    /** Solo portiere/admin (la RLS lo impone). */
    async registraPacco(input: {
      condominio_id: string;
      unita_destinazione_id: string;
      mittente_esterno?: string;
    }): Promise<IRegistroPacco> {
      const registrato_da = await getCurrentUserId(db);
      return unwrap(
        await db
          .from('registro_pacchi')
          .insert({
            condominio_id: input.condominio_id,
            unita_destinazione_id: input.unita_destinazione_id,
            mittente_esterno: input.mittente_esterno ?? null,
            registrato_da,
          })
          .select('*')
          .single(),
      );
    },

    async segnaRitirato(id: string, firma: string): Promise<IRegistroPacco> {
      return unwrap(
        await db
          .from('registro_pacchi')
          .update({ stato: 'RITIRATO', data_ritiro: new Date().toISOString(), firma_ritiro: firma })
          .eq('id', id)
          .select('*')
          .single(),
      );
    },

    /** Attiva la push notification di sollecito ritiro pacco al residente tramite Edge Function. */
    async sollecitaRitiroPacco(input: {
      condominio_id: string;
      unita_id: string;
      titolo: string;
      corpo: string;
    }): Promise<{ destinatari: number; push_inviate: number }> {
      return invokeFunction<{ destinatari: number; push_inviate: number }>(db, 'notifiche-push', {
        condominio_id: input.condominio_id,
        unita_id: input.unita_id,
        titolo: input.titolo,
        corpo: input.corpo,
        tipo: 'PORTINERIA_PACCO',
      });
    },

    // ---- Storico Immobile (UC-11: la RLS espone al subentrante solo gli eventi PUBBLICI)
    async listStoricoImmobile(unitaId: string): Promise<ILogStoricoImmobile[]> {
      return unwrap(
        await db
          .from('log_storico_immobile')
          .select('*')
          .eq('unita_id', unitaId)
          .order('data_evento', { ascending: false }),
      );
    },
  };
}
export type ServiziService = ReturnType<typeof createServiziService>;
