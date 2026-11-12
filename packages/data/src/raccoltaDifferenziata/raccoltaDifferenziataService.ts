import type { IRaccoltaDifferenziata, TablesInsert, TablesUpdate } from '@iocondo/shared-types';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  ordinaTurniRaccolta,
  validaTurnoRaccolta,
  type InputTurnoRaccolta,
} from './raccoltaDifferenziataLogic.ts';

const COLONNE_RACCOLTA = 'id, condominio_id, tipo_rifiuto, giorno_settimana, note';

function estraiErrore(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return new Error(err.message);
  }
  return new Error(fallback);
}

/**
 * Servizio per la gestione della Raccolta Differenziata:
 * - `elenco`: consultazione turni del condominio (Condòmino, Portiere e Amministratore);
 * - `crea`, `aggiorna`, `elimina`: gestione CRUD riservata all'Amministratore (protetta da RLS).
 */
export function createRaccoltaDifferenziataService(db: TypedSupabaseClient) {
  return {
    async elenco(condominioId: string): Promise<IRaccoltaDifferenziata[]> {
      const { data, error } = await db
        .from('raccolta_differenziata')
        .select(COLONNE_RACCOLTA)
        .eq('condominio_id', condominioId)
        .order('giorno_settimana', { ascending: true })
        .order('tipo_rifiuto', { ascending: true });

      if (error) throw estraiErrore(error, 'Errore durante il caricamento della raccolta differenziata.');
      return ordinaTurniRaccolta((data ?? []) as IRaccoltaDifferenziata[]);
    },

    async crea(condominioId: string, input: InputTurnoRaccolta): Promise<IRaccoltaDifferenziata> {
      const validazione = validaTurnoRaccolta(input);
      if (!validazione.ok) {
        const primoErrore =
          validazione.errori.tipo_rifiuto ??
          validazione.errori.giorno_settimana ??
          validazione.errori.note ??
          'Dati del turno non validi.';
        throw new Error(primoErrore);
      }

      const payload: TablesInsert<'raccolta_differenziata'> = {
        condominio_id: condominioId,
        tipo_rifiuto: validazione.dati.tipo_rifiuto,
        giorno_settimana: validazione.dati.giorno_settimana,
        note: validazione.dati.note,
      };

      const { data, error } = await db
        .from('raccolta_differenziata')
        .insert(payload)
        .select(COLONNE_RACCOLTA)
        .single();

      if (error || !data) throw estraiErrore(error, 'Errore durante il salvataggio del turno.');
      return data as IRaccoltaDifferenziata;
    },

    async aggiorna(
      id: string,
      condominioId: string,
      input: InputTurnoRaccolta,
    ): Promise<IRaccoltaDifferenziata> {
      const validazione = validaTurnoRaccolta(input);
      if (!validazione.ok) {
        const primoErrore =
          validazione.errori.tipo_rifiuto ??
          validazione.errori.giorno_settimana ??
          validazione.errori.note ??
          'Dati del turno non validi.';
        throw new Error(primoErrore);
      }

      const payload: TablesUpdate<'raccolta_differenziata'> = {
        tipo_rifiuto: validazione.dati.tipo_rifiuto,
        giorno_settimana: validazione.dati.giorno_settimana,
        note: validazione.dati.note,
      };

      const { data, error } = await db
        .from('raccolta_differenziata')
        .update(payload)
        .eq('id', id)
        .eq('condominio_id', condominioId)
        .select(COLONNE_RACCOLTA)
        .single();

      if (error || !data) throw estraiErrore(error, 'Errore durante l\'aggiornamento del turno.');
      return data as IRaccoltaDifferenziata;
    },

    async elimina(id: string, condominioId: string): Promise<void> {
      const { error } = await db
        .from('raccolta_differenziata')
        .delete()
        .eq('id', id)
        .eq('condominio_id', condominioId);

      if (error) throw estraiErrore(error, 'Errore durante l\'eliminazione del turno.');
    },
  };
}
