import type {
  IPrenotazioneSpazio,
  IRisorsaPrenotabile,
  TablesInsert,
  TablesUpdate,
} from '@iocondo/shared-types';
import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  ordinaPrenotazioni,
  traduciErrorePrenotazione,
  validaPrenotazione,
  validaRisorsaPrenotabile,
  type InputRisorsaPrenotabile,
  type PrenotazioneConDettagli,
} from './prenotazioniLogic.ts';

const COLONNE_RISORSA = 'id, condominio_id, nome, tariffa_oraria, max_ore, created_at, updated_at';

const COLONNE_PRENOTAZIONE =
  'id, risorsa_id, utente_id, data_inizio, data_fine, costo_addebitato, created_at, risorse_prenotabili!inner(nome, condominio_id, tariffa_oraria), utenti(nome_cognome, email)';

interface RawPrenotazioneRow {
  id: string;
  risorsa_id: string;
  utente_id: string;
  data_inizio: string;
  data_fine: string;
  costo_addebitato: number | string;
  created_at: string;
  risorse_prenotabili?:
    | { nome?: string; condominio_id?: string; tariffa_oraria?: number | string }
    | Array<{ nome?: string; condominio_id?: string; tariffa_oraria?: number | string }>
    | null;
  utenti?:
    | { nome_cognome?: string | null; email?: string | null }
    | Array<{ nome_cognome?: string | null; email?: string | null }>
    | null;
}

function normalizzaRisorsa(row: IRisorsaPrenotabile): IRisorsaPrenotabile {
  return {
    ...row,
    tariffa_oraria: Number(row.tariffa_oraria) || 0,
    max_ore: row.max_ore !== null && row.max_ore !== undefined ? Number(row.max_ore) : null,
  };
}

function normalizzaPrenotazioneDettagli(row: RawPrenotazioneRow): PrenotazioneConDettagli {
  const risorsa = Array.isArray(row.risorse_prenotabili)
    ? row.risorse_prenotabili[0]
    : row.risorse_prenotabili;
  const utente = Array.isArray(row.utenti) ? row.utenti[0] : row.utenti;

  return {
    id: row.id,
    risorsa_id: row.risorsa_id,
    utente_id: row.utente_id,
    data_inizio: row.data_inizio,
    data_fine: row.data_fine,
    costo_addebitato: Number(row.costo_addebitato) || 0,
    created_at: row.created_at,
    risorsa_nome: risorsa?.nome ?? 'Spazio comune',
    tariffa_oraria: Number(risorsa?.tariffa_oraria) || 0,
    utente_nome: utente?.nome_cognome ?? null,
    utente_email: utente?.email ?? null,
  };
}

/**
 * Servizio Supabase per la gestione degli Spazi Comuni (`risorse_prenotabili`)
 * e delle relative prenotazioni (`prenotazioni_spazi`).
 */
export function createPrenotazioniService(db: TypedSupabaseClient) {
  return {
    async elencoRisorse(condominioId: string): Promise<IRisorsaPrenotabile[]> {
      const { data, error } = await db
        .from('risorse_prenotabili')
        .select(COLONNE_RISORSA)
        .eq('condominio_id', condominioId)
        .order('nome', { ascending: true });

      if (error) {
        throw new Error(traduciErrorePrenotazione(error, 'Errore durante il caricamento degli spazi comuni.'));
      }
      return ((data ?? []) as IRisorsaPrenotabile[]).map(normalizzaRisorsa);
    },

    async creaRisorsa(condominioId: string, input: InputRisorsaPrenotabile): Promise<IRisorsaPrenotabile> {
      const validazione = validaRisorsaPrenotabile(input);
      if (!validazione.ok) {
        const primoErrore =
          validazione.errori.nome ??
          validazione.errori.tariffa_oraria ??
          validazione.errori.max_ore ??
          'Dati dello spazio non validi.';
        throw new Error(primoErrore);
      }

      const payload: TablesInsert<'risorse_prenotabili'> = {
        condominio_id: condominioId,
        nome: validazione.dati.nome,
        tariffa_oraria: validazione.dati.tariffa_oraria,
        max_ore: validazione.dati.max_ore,
      };

      const { data, error } = await db
        .from('risorse_prenotabili')
        .insert(payload)
        .select(COLONNE_RISORSA)
        .single();

      if (error || !data) {
        throw new Error(traduciErrorePrenotazione(error, 'Errore durante il salvataggio dello spazio comune.'));
      }
      return normalizzaRisorsa(data as IRisorsaPrenotabile);
    },

    async aggiornaRisorsa(
      id: string,
      condominioId: string,
      input: InputRisorsaPrenotabile,
    ): Promise<IRisorsaPrenotabile> {
      const validazione = validaRisorsaPrenotabile(input);
      if (!validazione.ok) {
        const primoErrore =
          validazione.errori.nome ??
          validazione.errori.tariffa_oraria ??
          validazione.errori.max_ore ??
          'Dati dello spazio non validi.';
        throw new Error(primoErrore);
      }

      const payload: TablesUpdate<'risorse_prenotabili'> = {
        nome: validazione.dati.nome,
        tariffa_oraria: validazione.dati.tariffa_oraria,
        max_ore: validazione.dati.max_ore,
      };

      const { data, error } = await db
        .from('risorse_prenotabili')
        .update(payload)
        .eq('id', id)
        .eq('condominio_id', condominioId)
        .select(COLONNE_RISORSA)
        .single();

      if (error || !data) {
        throw new Error(traduciErrorePrenotazione(error, 'Errore durante l’aggiornamento dello spazio comune.'));
      }
      return normalizzaRisorsa(data as IRisorsaPrenotabile);
    },

    async eliminaRisorsa(id: string, condominioId: string): Promise<void> {
      const { error } = await db
        .from('risorse_prenotabili')
        .delete()
        .eq('id', id)
        .eq('condominio_id', condominioId);

      if (error) {
        throw new Error(traduciErrorePrenotazione(error, 'Errore durante l’eliminazione dello spazio comune.'));
      }
    },

    async elencoPrenotazioniCondominio(condominioId: string): Promise<PrenotazioneConDettagli[]> {
      const { data, error } = await db
        .from('prenotazioni_spazi')
        .select(COLONNE_PRENOTAZIONE)
        .eq('risorse_prenotabili.condominio_id', condominioId)
        .order('data_inizio', { ascending: true });

      if (error) {
        throw new Error(traduciErrorePrenotazione(error, 'Errore durante il caricamento delle prenotazioni.'));
      }
      const lista = ((data ?? []) as unknown as RawPrenotazioneRow[]).map(normalizzaPrenotazioneDettagli);
      return ordinaPrenotazioni(lista);
    },

    async creaPrenotazione(
      risorsaId: string,
      utenteId: string,
      input: { data_inizio: Date | string; data_fine: Date | string },
    ): Promise<IPrenotazioneSpazio> {
      const { data: risorsaRow, error: risorsaErr } = await db
        .from('risorse_prenotabili')
        .select(COLONNE_RISORSA)
        .eq('id', risorsaId)
        .single();

      if (risorsaErr || !risorsaRow) {
        throw new Error(traduciErrorePrenotazione(risorsaErr, 'Spazio comune non trovato.'));
      }

      const risorsa = normalizzaRisorsa(risorsaRow as IRisorsaPrenotabile);
      const validazione = validaPrenotazione(
        { risorsa_id: risorsaId, data_inizio: input.data_inizio, data_fine: input.data_fine },
        risorsa,
        [],
      );

      if (!validazione.ok) {
        const primoErrore =
          validazione.errori.risorsa_id ??
          validazione.errori.data_inizio ??
          validazione.errori.data_fine ??
          validazione.errori.generale ??
          'Dati della prenotazione non validi.';
        throw new Error(primoErrore);
      }

      const payload: TablesInsert<'prenotazioni_spazi'> = {
        risorsa_id: risorsaId,
        utente_id: utenteId,
        data_inizio: validazione.dati.data_inizio.toISOString(),
        data_fine: validazione.dati.data_fine.toISOString(),
        costo_addebitato: validazione.dati.costo_addebitato,
      };

      const { data, error } = await db
        .from('prenotazioni_spazi')
        .insert(payload)
        .select('id, risorsa_id, utente_id, data_inizio, data_fine, costo_addebitato, created_at')
        .single();

      if (error || !data) {
        throw new Error(traduciErrorePrenotazione(error, 'Errore durante la creazione della prenotazione.'));
      }

      const row = data as IPrenotazioneSpazio;
      return {
        ...row,
        costo_addebitato: Number(row.costo_addebitato) || 0,
      };
    },

    async annullaPrenotazione(id: string, _utenteIdOAdmin?: string): Promise<void> {
      const { error } = await db.from('prenotazioni_spazi').delete().eq('id', id);

      if (error) {
        throw new Error(traduciErrorePrenotazione(error, 'Errore durante l’annullamento della prenotazione.'));
      }
    },
  };
}
export type PrenotazioniService = ReturnType<typeof createPrenotazioniService>;
