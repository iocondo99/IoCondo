import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import type { Json } from '@iocondo/shared-types';
import {
  aggiornaListaOverrides,
  applicaOverrideNumeriEmergenza,
  componiNumeriEmergenza,
  costruisciContattiAmministrazione,
  parseNumeriAssistenzaOverrides,
  validaModificaNumeroEmergenza,
  type ContattiAmministrazione,
  type DatiAssistenza,
  type FornitoreEmergenzaRaw,
  type NumeroAssistenzaOverride,
  type NumeroEmergenza,
  type PolizzaFabbricato,
} from './assistenzaLogic.ts';

function isMissingNumeriColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('numeri_assistenza') && (m.includes('schema cache') || m.includes('does not exist') || m.includes('column'));
}

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
     * Recupera gli override personalizzati (titolo e numero) configurati dall'amministratore.
     */
    async getOverridesNumeri(condominioId: string): Promise<NumeroAssistenzaOverride[]> {
      try {
        const res = await db
          .from('configurazioni_condominio')
          .select('numeri_assistenza')
          .eq('condominio_id', condominioId)
          .is('palazzo_id', null)
          .maybeSingle();

        if (res.error || !res.data) return [];
        const rec = res.data as { numeri_assistenza?: unknown };
        return parseNumeriAssistenzaOverrides(rec.numeri_assistenza);
      } catch {
        return [];
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

      const base = componiNumeriEmergenza(fornitori, polizza);
      const overrides = await this.getOverridesNumeri(condominioId);
      return applicaOverrideNumeriEmergenza(base, overrides);
    },

    /**
     * Aggiorna titolo, numero e visibilità di una card dei numeri utili (solo amministratore del condominio).
     */
    async aggiornaNumeroEmergenza(
      condominioId: string,
      input: { id: string; titolo: string; numero: string; visibile?: boolean },
    ): Promise<NumeroEmergenza[]> {
      const check = validaModificaNumeroEmergenza(input);
      if (!check.valido) {
        throw new Error(check.erroreTitolo ?? check.erroreNumero ?? 'Dati non validi.');
      }

      const existingRes = await db
        .from('configurazioni_condominio')
        .select('id, numeri_assistenza')
        .eq('condominio_id', condominioId)
        .is('palazzo_id', null)
        .maybeSingle();

      if (existingRes.error) {
        if (isMissingNumeriColumnError(existingRes.error.message)) {
          throw new Error(
            'La colonna numeri_assistenza non è ancora presente nel database. Applica la migrazione 16_assistenza_numeri_personalizzati.sql.',
          );
        }
        throw new Error(existingRes.error.message);
      }

      const existingRow = existingRes.data as { id: string; numeri_assistenza?: unknown } | null;
      const correnti = parseNumeriAssistenzaOverrides(existingRow?.numeri_assistenza);
      const aggiornati = aggiornaListaOverrides(
        correnti,
        input.id,
        input.titolo,
        input.numero,
        input.visibile ?? true,
      );
      const payloadJson = aggiornati as unknown as Json;

      if (existingRow?.id) {
        const updRes = await db
          .from('configurazioni_condominio')
          .update({
            numeri_assistenza: payloadJson,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRow.id);
        if (updRes.error) {
          if (isMissingNumeriColumnError(updRes.error.message)) {
            throw new Error(
              'La colonna numeri_assistenza non è ancora presente nel database. Applica la migrazione 16_assistenza_numeri_personalizzati.sql.',
            );
          }
          throw new Error(updRes.error.message);
        }
      } else {
        const insRes = await db
          .from('configurazioni_condominio')
          .insert({
            condominio_id: condominioId,
            palazzo_id: null,
            numeri_assistenza: payloadJson,
          });
        if (insRes.error) {
          if (isMissingNumeriColumnError(insRes.error.message)) {
            throw new Error(
              'La colonna numeri_assistenza non è ancora presente nel database. Applica la migrazione 16_assistenza_numeri_personalizzati.sql.',
            );
          }
          throw new Error(insRes.error.message);
        }
      }

      return this.getNumeriEmergenza(condominioId);
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
