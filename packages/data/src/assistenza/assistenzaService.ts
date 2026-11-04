import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  componiNumeriEmergenza,
  costruisciContattiAmministrazione,
  type ContattiAmministrazione,
  type DatiAssistenza,
  type FornitoreEmergenzaRaw,
  type NumeroEmergenza,
  type PolizzaFabbricato,
} from './assistenzaLogic.ts';

function unwrapMaybe<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> | null {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T> | null;
}

export function createAssistenzaService(db: TypedSupabaseClient) {
  return {
    /**
     * Recupera i contatti dell'amministrazione del condominio attivo.
     * Legge la riga del condominio e il relativo amministratore (admin_id).
     */
    async getContattiAmministrazione(condominioId: string): Promise<ContattiAmministrazione | null> {
      const condo = unwrapMaybe(
        await db
          .from('condomini')
          .select('id, admin_id, nome, indirizzo, citta')
          .eq('id', condominioId)
          .maybeSingle(),
      );
      if (!condo) return null;

      let adminNome: string | null = null;
      let adminEmail: string | null = null;
      let adminTelefono: string | null = null;

      if (condo.admin_id) {
        try {
          const utente = unwrapMaybe(
            await db
              .from('utenti')
              .select('id, nome_cognome, email, telefono')
              .eq('id', condo.admin_id)
              .maybeSingle(),
          );
          if (utente) {
            adminNome = utente.nome_cognome;
            adminEmail = utente.email;
            adminTelefono = utente.telefono;
          } else {
            // Se la policy su utenti limita la visualizzazione, prova la vista profili_pubblici
            const pubblico = unwrapMaybe(
              await db
                .from('profili_pubblici')
                .select('id, nome_cognome')
                .eq('id', condo.admin_id)
                .maybeSingle(),
            );
            if (pubblico) {
              adminNome = pubblico.nome_cognome;
            }
          }
        } catch {
          // Fallback gestito da costruisciContattiAmministrazione
        }
      }

      return costruisciContattiAmministrazione({
        condominioNome: condo.nome,
        indirizzoCondominio: condo.indirizzo,
        cittaCondominio: condo.citta,
        adminNome,
        adminEmail,
        adminTelefono,
      });
    },

    /**
     * Recupera la polizza assicurativa del fabbricato (se presente e accessibile secondo RLS).
     */
    async getPolizza(condominioId: string): Promise<PolizzaFabbricato | null> {
      try {
        const res = await db
          .from('polizze_assicurative')
          .select('id, condominio_id, compagnia, numero_polizza, premio_annuo, data_scadenza, doc_id')
          .eq('condominio_id', condominioId)
          .order('data_scadenza', { ascending: false })
          .limit(1);

        if (res.error || !res.data || res.data.length === 0) return null;
        const row = res.data[0];
        if (!row) return null;
        return {
          id: row.id,
          compagnia: row.compagnia,
          numeroPolizza: row.numero_polizza,
          premioAnnuo: row.premio_annuo ? Number(row.premio_annuo) : null,
          dataScadenza: row.data_scadenza,
          docId: row.doc_id,
        };
      } catch {
        return null;
      }
    },

    /**
     * Recupera i numeri utili e di pronto intervento condominiale.
     */
    async getNumeriEmergenza(condominioId: string): Promise<NumeroEmergenza[]> {
      const polizza = await this.getPolizza(condominioId);
      let fornitori: FornitoreEmergenzaRaw[] = [];

      try {
        const resForn = await db
          .from('fornitori')
          .select('id, ragione_sociale, telefono, categoria')
          .order('ragione_sociale');

        if (!resForn.error && resForn.data) {
          fornitori = resForn.data;
        }
      } catch {
        // Se non accessibile (RLS condòmino), fornitori resta vuoto e si usano i default
      }

      return componiNumeriEmergenza(fornitori, polizza);
    },

    /**
     * Caricamento combinato di tutti i dati della schermata Assistenza.
     */
    async caricaDatiAssistenza(condominioId: string): Promise<DatiAssistenza | null> {
      const condo = unwrapMaybe(
        await db
          .from('condomini')
          .select('id, admin_id, nome, indirizzo, citta')
          .eq('id', condominioId)
          .maybeSingle(),
      );
      if (!condo) return null;

      const amministrazione = (await this.getContattiAmministrazione(condominioId)) ?? costruisciContattiAmministrazione({
        condominioNome: condo.nome,
        indirizzoCondominio: condo.indirizzo,
        cittaCondominio: condo.citta,
      });

      const polizza = await this.getPolizza(condominioId);
      const numeriEmergenza = await this.getNumeriEmergenza(condominioId);

      return {
        condominioId: condo.id,
        condominioNome: condo.nome,
        condominioIndirizzo: condo.indirizzo ? `${condo.indirizzo}${condo.citta ? `, ${condo.citta}` : ''}` : null,
        amministrazione,
        numeriEmergenza,
        polizza,
      };
    },
  };
}
export type AssistenzaService = ReturnType<typeof createAssistenzaService>;
