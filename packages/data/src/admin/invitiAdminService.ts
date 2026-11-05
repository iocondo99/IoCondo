import { assertOk, invokeFunction, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  trasformaInvitoRawInView,
  type InvitoPendenteRaw,
  type RigaInvitoAdminView,
  type RuoloInvitabileAdmin,
} from './invitiAdminLogic';

export interface NuovoInvitoAdminInput {
  email: string;
  ruolo: RuoloInvitabileAdmin;
  condominioId: string;
  unitaId?: string | null;
  flagPortiere?: boolean;
}

export interface OpzioneUnitaInvito {
  id: string;
  label: string;
  palazzoId: string;
  palazzoNome: string;
  interno: string;
}

export function createInvitiAdminService(db: TypedSupabaseClient) {
  return {
    /**
     * Lettura degli inviti del condominio attivo da `inviti_pendenti` con JOIN/relazione
     * su `unita_immobiliari`, `palazzi` e `ruoli_piattaforma`.
     */
    async list(condominioId: string): Promise<RigaInvitoAdminView[]> {
      const res = unwrap(
        await db
          .from('inviti_pendenti')
          .select(`
            token,
            email,
            ruolo_proposto,
            flag_portiere,
            condominio_id,
            unita_id,
            scadenza,
            accettato_at,
            ruoli_piattaforma:ruolo_proposto (
              id,
              codice
            ),
            unita_immobiliari:unita_id (
              id,
              interno,
              piano,
              palazzi:palazzo_id (
                id,
                nome_identificativo
              )
            )
          `)
          .eq('condominio_id', condominioId)
          .order('scadenza', { ascending: false }),
      );

      const righe = (res as unknown as InvitoPendenteRaw[]) ?? [];
      const adesso = new Date();
      return righe.map((r) => trasformaInvitoRawInView(r, adesso));
    },

    /**
     * Carica le unità del condominio raggruppate per Edificio/Scala/Interno
     * per popolare il menu a tendina dinamico della modale di invito.
     */
    async listUnita(condominioId: string): Promise<OpzioneUnitaInvito[]> {
      const palazzi = unwrap(
        await db
          .from('palazzi')
          .select('id, nome_identificativo')
          .eq('condominio_id', condominioId)
          .order('nome_identificativo'),
      );

      if (palazzi.length === 0) return [];
      const palazzoIds = palazzi.map((p) => p.id);
      const nomePalazzoDi = new Map(palazzi.map((p) => [p.id, p.nome_identificativo]));

      // Carica scale/colonne per arricchire l'etichetta
      const scale = unwrap(
        await db
          .from('scale_colonne')
          .select('id, palazzo_id, nome, tipo')
          .in('palazzo_id', palazzoIds),
      );
      const nomeScalaDi = new Map(scale.map((s) => [s.id, s.nome]));

      const unita = unwrap(
        await db
          .from('unita_immobiliari')
          .select('id, palazzo_id, scala_colonna_id, interno, piano')
          .in('palazzo_id', palazzoIds)
          .order('interno'),
      );

      return unita
        .map((u) => {
          const palazzoNome = nomePalazzoDi.get(u.palazzo_id) ?? 'Edificio';
          const scalaNome = u.scala_colonna_id ? nomeScalaDi.get(u.scala_colonna_id) : null;
          const parteScala = scalaNome ? ` • Scala ${scalaNome}` : '';
          const partePiano = u.piano != null ? ` (P. ${u.piano})` : '';
          const label = `${palazzoNome}${parteScala} • Int. ${u.interno}${partePiano}`;

          return {
            id: u.id,
            label,
            palazzoId: u.palazzo_id,
            palazzoNome,
            interno: u.interno,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'it', { numeric: true }));
    },

    /**
     * Invocazione Edge Function `invita-utente` (`supabase.functions.invoke('invita-utente', { body: ... })`).
     * Ritorna messaggio uniforme "Invito registrato." come da requisiti di sicurezza.
     */
    async invia(invito: NuovoInvitoAdminInput): Promise<{ messaggio: string }> {
      await invokeFunction<{ ok: true }>(db, 'invita-utente', {
        email: invito.email.trim().toLowerCase(),
        ruolo: invito.ruolo,
        condominio_id: invito.condominioId,
        unita_id: invito.unitaId ?? null,
        flag_portiere: Boolean(invito.flagPortiere),
      });

      return { messaggio: 'Invito registrato.' };
    },

    /**
     * Azione di revoca/eliminazione invito pendente su `inviti_pendenti`.
     */
    async revoca(token: string): Promise<void> {
      assertOk(await db.from('inviti_pendenti').delete().eq('token', token));
    },

    /**
     * Azione di sollecito invito (reinvio email e aggiornamento scadenza a +7 giorni).
     */
    async sollecita(invito: {
      token: string;
      email: string;
      ruolo: RuoloInvitabileAdmin;
      condominioId: string;
      unitaId?: string | null;
      flagPortiere?: boolean;
    }): Promise<void> {
      const nuovaScadenza = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      assertOk(
        await db
          .from('inviti_pendenti')
          .update({ scadenza: nuovaScadenza })
          .eq('token', invito.token),
      );

      try {
        await invokeFunction<{ ok: true }>(db, 'invita-utente', {
          email: invito.email.trim().toLowerCase(),
          ruolo: invito.ruolo,
          condominio_id: invito.condominioId,
          unita_id: invito.unitaId ?? null,
          flag_portiere: Boolean(invito.flagPortiere),
        });
      } catch (err) {
        // Se la funzione non è ancora pubblicata sul server o c'è rate limit,
        // la scadenza sul database è comunque prorogata con successo.
        console.warn('Reinvio email tramite Edge Function non riuscito:', err);
      }
    },

    /**
     * Azione di rinnovo invito scaduto (+7 giorni e reinvio).
     */
    async rinnova(
      token: string,
      invito?: {
        email: string;
        ruolo: RuoloInvitabileAdmin;
        condominioId: string;
        unitaId?: string | null;
        flagPortiere?: boolean;
      },
    ): Promise<void> {
      const nuovaScadenza = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      assertOk(
        await db
          .from('inviti_pendenti')
          .update({ scadenza: nuovaScadenza })
          .eq('token', token),
      );

      if (invito) {
        try {
          await invokeFunction<{ ok: true }>(db, 'invita-utente', {
            email: invito.email.trim().toLowerCase(),
            ruolo: invito.ruolo,
            condominio_id: invito.condominioId,
            unita_id: invito.unitaId ?? null,
            flag_portiere: Boolean(invito.flagPortiere),
          });
        } catch (err) {
          console.warn('Reinvio email tramite Edge Function non riuscito:', err);
        }
      }
    },
  };
}

export type InvitiAdminService = ReturnType<typeof createInvitiAdminService>;

