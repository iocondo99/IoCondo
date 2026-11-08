import { assertOk, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type {
  IAnagraficaUnita,
  IPalazzo,
  IScalaColonna,
  ITipologiaUnita,
  IUnitaImmobiliare,
  TablesInsert,
  TablesUpdate,
} from '@iocondo/shared-types';
import {
  calcolaQuadraturaTabella,
  costruisciAlberoStruttura,
  type AnagraficaUnitaRaw,
  type PalazzoRaw,
  type QuotaMillesimaleRaw,
  type ScalaColonnaRaw,
  type StrutturaCompletaView,
  type TabellaMillesimaleDettaglioView,
  type TabellaMillesimaleRaw,
  type TipologiaUnitaRaw,
  type UnitaDettaglioView,
  type UnitaImmobiliareRaw,
} from './strutturaLogic';

export interface StrutturaAdminData extends StrutturaCompletaView {
  tabelle: TabellaMillesimaleDettaglioView[];
}

export interface CreaPalazzoInput {
  condominioId: string;
  nomeIdentificativo: string;
  indirizzo?: string | null;
}

export interface ModificaPalazzoInput {
  id: string;
  nomeIdentificativo?: string;
  indirizzo?: string | null;
}

export interface CreaScalaColonnaInput {
  palazzoId: string;
  nome: string;
  tipo: 'SCALA' | 'COLONNA';
}

export interface ResidenteAssegnatoInput {
  utenteId: string;
  tipoPossesso: 'PROPRIETARIO' | 'INQUILINO';
  quotaPossesso?: number;
  dataInizio?: string;
}

export interface CreaUnitaInput {
  palazzoId: string;
  scalaColonnaId?: string | null;
  tipologiaId: string;
  interno: string;
  piano?: number | null;
  mq?: number | null;
  foglioCatastale?: string | null;
  particella?: string | null;
  subalterno?: string | null;
  condominioId?: string;
  residente?: ResidenteAssegnatoInput | null;
}

export interface ModificaUnitaInput {
  id: string;
  palazzoId?: string;
  scalaColonnaId?: string | null;
  tipologiaId?: string;
  interno?: string;
  piano?: number | null;
  mq?: number | null;
  foglioCatastale?: string | null;
  particella?: string | null;
  subalterno?: string | null;
  condominioId?: string;
  residente?: ResidenteAssegnatoInput | null;
}

export interface QuotaMillesimaleInput {
  unitaId: string;
  valoreMillesimale: number;
}

export interface CondominoDisponibile {
  id: string;
  nomeCognome: string;
  email?: string | null;
  telefono?: string | null;
}

export interface AssociaResidenteInput {
  unitaId: string;
  utenteId: string;
  tipoPossesso: 'PROPRIETARIO' | 'INQUILINO';
  quotaPossesso?: number;
  dataInizio?: string;
  condominioId?: string;
}

const oggi = () => new Date().toISOString().slice(0, 10);

export function createStrutturaService(db: TypedSupabaseClient) {
  return {
    /**
     * Carica l'intera gerarchia spaziale e le tabelle millesimali del condominio attivo:
     * Palazzi -> Scale/Colonne -> Unità Immobiliari (con tipologia, residenti attivi) + Tabelle e Quote.
     */
    async caricaStrutturaCompleta(condominioId: string): Promise<StrutturaAdminData> {
      // 1. Tipologie unità (tutte)
      const tipologie = unwrap(
        await db.from('tipologie_unita').select('id, descrizione').order('descrizione')
      ) as TipologiaUnitaRaw[];

      // 2. Palazzi del condominio
      const palazzi = unwrap(
        await db
          .from('palazzi')
          .select('id, condominio_id, nome_identificativo, indirizzo')
          .eq('condominio_id', condominioId)
          .order('nome_identificativo')
      ) as PalazzoRaw[];

      if (palazzi.length === 0) {
        return {
          palazzi: [],
          statistiche: {
            totalePalazzi: 0,
            totaleUnita: 0,
            residentiAssociati: 0,
            totaleMq: 0,
          },
          tutteUnita: [],
          tipologie,
          tabelle: [],
        };
      }

      const palazzoIds = palazzi.map((p) => p.id);

      // 3. Scale / colonne dei palazzi
      const scale = unwrap(
        await db
          .from('scale_colonne')
          .select('id, palazzo_id, tipo, nome')
          .in('palazzo_id', palazzoIds)
          .order('nome')
      ) as ScalaColonnaRaw[];

      // 4. Unità immobiliari dei palazzi
      const unita = unwrap(
        await db
          .from('unita_immobiliari')
          .select('id, palazzo_id, scala_colonna_id, tipologia_id, interno, piano, mq, foglio_catastale, particella, subalterno')
          .in('palazzo_id', palazzoIds)
          .order('interno')
      ) as UnitaImmobiliareRaw[];

      // 5. Anagrafiche residenti attivi per le unità trovate
      let anagrafiche: AnagraficaUnitaRaw[] = [];
      const unitaIds = unita.map((u) => u.id);

      if (unitaIds.length > 0) {
        const resAnagrafiche = unwrap(
          await db
            .from('anagrafiche_unita')
            .select(`
              id,
              unita_id,
              utente_id,
              tipo_possesso,
              data_inizio,
              data_fine,
              quota_possesso,
              utente:utenti (
                id,
                nome_cognome,
                telefono
              )
            `)
            .in('unita_id', unitaIds)
        );
        anagrafiche = resAnagrafiche as unknown as AnagraficaUnitaRaw[];
      }

      // 6. Costruisci albero normalizzato
      const albero = costruisciAlberoStruttura({
        palazzi,
        scale,
        unita,
        tipologie,
        anagrafiche,
        dataRifOggi: oggi(),
      });

      // 7. Carica tabelle millesimali e relative quote
      const tabelleRaw = unwrap(
        await db
          .from('tabelle_millesimali')
          .select('id, condominio_id, palazzo_id, scala_colonna_id, nome, totale')
          .eq('condominio_id', condominioId)
          .order('nome')
      ) as TabellaMillesimaleRaw[];

      let quoteRaw: QuotaMillesimaleRaw[] = [];
      const tabellaIds = tabelleRaw.map((t) => t.id);

      if (tabellaIds.length > 0) {
        quoteRaw = unwrap(
          await db
            .from('quote_millesimali')
            .select('id, tabella_id, unita_id, valore_millesimale')
            .in('tabella_id', tabellaIds)
        ) as QuotaMillesimaleRaw[];
      }

      // Raggruppa quote per tabella e calcola quadratura
      const quotePerTabella = new Map<string, QuotaMillesimaleRaw[]>();
      for (const q of quoteRaw) {
        const list = quotePerTabella.get(q.tabella_id) ?? [];
        list.push(q);
        quotePerTabella.set(q.tabella_id, list);
      }

      const tabelle: TabellaMillesimaleDettaglioView[] = tabelleRaw.map((t) => {
        const qList = quotePerTabella.get(t.id) ?? [];
        return calcolaQuadraturaTabella(t, qList, albero.tutteUnita);
      });

      return {
        ...albero,
        tabelle,
      };
    },

    // =========================================================================
    // PALAZZI
    // =========================================================================

    async listPalazzi(condominioId: string): Promise<IPalazzo[]> {
      return unwrap(await db.from('palazzi').select('*').eq('condominio_id', condominioId).order('nome_identificativo'));
    },

    async createPalazzo(input: TablesInsert<'palazzi'> | CreaPalazzoInput): Promise<PalazzoRaw> {
      const payload: TablesInsert<'palazzi'> = {
        condominio_id: 'condominioId' in input ? input.condominioId : input.condominio_id,
        nome_identificativo: ('nomeIdentificativo' in input ? input.nomeIdentificativo : input.nome_identificativo).trim(),
        indirizzo: input.indirizzo ? input.indirizzo.trim() : null,
      };
      return unwrap(await db.from('palazzi').insert(payload).select('*').single()) as PalazzoRaw;
    },

    async updatePalazzo(id: string, patch: TablesUpdate<'palazzi'> | ModificaPalazzoInput): Promise<PalazzoRaw> {
      const updatePayload: TablesUpdate<'palazzi'> = {};
      if ('nomeIdentificativo' in patch && patch.nomeIdentificativo !== undefined) {
        updatePayload.nome_identificativo = patch.nomeIdentificativo.trim();
      } else if ('nome_identificativo' in patch && patch.nome_identificativo !== undefined) {
        updatePayload.nome_identificativo = patch.nome_identificativo.trim();
      }
      if (patch.indirizzo !== undefined) {
        updatePayload.indirizzo = patch.indirizzo ? patch.indirizzo.trim() : null;
      }

      return unwrap(await db.from('palazzi').update(updatePayload).eq('id', id).select('*').single()) as PalazzoRaw;
    },

    async removePalazzo(id: string): Promise<void> {
      assertOk(await db.from('palazzi').delete().eq('id', id));
    },

    async eliminaPalazzo(id: string): Promise<void> {
      assertOk(await db.from('palazzi').delete().eq('id', id));
    },

    async creaPalazzo(input: TablesInsert<'palazzi'> | CreaPalazzoInput): Promise<PalazzoRaw> {
      return this.createPalazzo(input);
    },

    async modificaPalazzo(id: string, patch: TablesUpdate<'palazzi'> | ModificaPalazzoInput): Promise<PalazzoRaw> {
      return this.updatePalazzo(id, patch);
    },

    // =========================================================================
    // SCALE / COLONNE
    // =========================================================================

    async listScaleColonne(palazzoId: string): Promise<IScalaColonna[]> {
      return unwrap(await db.from('scale_colonne').select('*').eq('palazzo_id', palazzoId).order('nome'));
    },

    async createScalaColonna(input: TablesInsert<'scale_colonne'> | CreaScalaColonnaInput): Promise<ScalaColonnaRaw> {
      const payload: TablesInsert<'scale_colonne'> = {
        palazzo_id: 'palazzoId' in input ? input.palazzoId : input.palazzo_id,
        nome: input.nome.trim(),
        tipo: input.tipo,
      };
      return unwrap(await db.from('scale_colonne').insert(payload).select('*').single()) as ScalaColonnaRaw;
    },

    async creaScalaColonna(input: TablesInsert<'scale_colonne'> | CreaScalaColonnaInput): Promise<ScalaColonnaRaw> {
      return this.createScalaColonna(input);
    },

    async removeScalaColonna(id: string): Promise<void> {
      assertOk(await db.from('scale_colonne').delete().eq('id', id));
    },

    async eliminaScalaColonna(id: string): Promise<void> {
      assertOk(await db.from('scale_colonne').delete().eq('id', id));
    },

    // =========================================================================
    // UNITA' IMMOBILIARI
    // =========================================================================

    async listTipologie(): Promise<ITipologiaUnita[]> {
      return unwrap(await db.from('tipologie_unita').select('*').order('descrizione'));
    },

    async listUnita(palazzoId: string): Promise<IUnitaImmobiliare[]> {
      return unwrap(await db.from('unita_immobiliari').select('*').eq('palazzo_id', palazzoId).order('interno'));
    },

    async getUnita(id: string): Promise<IUnitaImmobiliare> {
      return unwrap(await db.from('unita_immobiliari').select('*').eq('id', id).single());
    },

    async createUnita(input: TablesInsert<'unita_immobiliari'> | CreaUnitaInput): Promise<UnitaImmobiliareRaw> {
      const isCreaInput = 'palazzoId' in input;
      const payload: TablesInsert<'unita_immobiliari'> = isCreaInput
        ? {
            palazzo_id: input.palazzoId,
            scala_colonna_id: input.scalaColonnaId || null,
            tipologia_id: input.tipologiaId,
            interno: input.interno.trim(),
            piano: input.piano !== undefined ? input.piano : null,
            mq: input.mq !== undefined ? input.mq : null,
            foglio_catastale: input.foglioCatastale?.trim() || null,
            particella: input.particella ? input.particella.trim() : null,
            subalterno: input.subalterno ? input.subalterno.trim() : null,
          }
        : input;
      const unita = unwrap(await db.from('unita_immobiliari').insert(payload).select('*').single()) as UnitaImmobiliareRaw;

      // Se fornito condòmino al momento della creazione, associa subito l'anagrafica
      if ('residente' in input && input.residente && input.residente.utenteId) {
        await this.associaResidente({
          unitaId: unita.id,
          utenteId: input.residente.utenteId,
          tipoPossesso: input.residente.tipoPossesso,
          quotaPossesso: input.residente.quotaPossesso,
          dataInizio: input.residente.dataInizio,
          condominioId: 'condominioId' in input ? input.condominioId : undefined,
        });
      }

      return unita;
    },

    async creaUnita(input: TablesInsert<'unita_immobiliari'> | CreaUnitaInput): Promise<UnitaImmobiliareRaw> {
      return this.createUnita(input);
    },

    async updateUnita(id: string, patch: TablesUpdate<'unita_immobiliari'> | ModificaUnitaInput): Promise<UnitaImmobiliareRaw> {
      const updatePayload: TablesUpdate<'unita_immobiliari'> = {};
      if ('palazzoId' in patch && patch.palazzoId !== undefined) updatePayload.palazzo_id = patch.palazzoId;
      else if ('palazzo_id' in patch && patch.palazzo_id !== undefined) updatePayload.palazzo_id = patch.palazzo_id;

      if ('scalaColonnaId' in patch && patch.scalaColonnaId !== undefined) updatePayload.scala_colonna_id = patch.scalaColonnaId || null;
      else if ('scala_colonna_id' in patch && patch.scala_colonna_id !== undefined) updatePayload.scala_colonna_id = patch.scala_colonna_id || null;

      if ('tipologiaId' in patch && patch.tipologiaId !== undefined) updatePayload.tipologia_id = patch.tipologiaId;
      else if ('tipologia_id' in patch && patch.tipologia_id !== undefined) updatePayload.tipologia_id = patch.tipologia_id;

      if (patch.interno !== undefined) updatePayload.interno = patch.interno.trim();
      if (patch.piano !== undefined) updatePayload.piano = patch.piano;
      if (patch.mq !== undefined) updatePayload.mq = patch.mq;

      if ('foglioCatastale' in patch && patch.foglioCatastale !== undefined) {
        updatePayload.foglio_catastale = patch.foglioCatastale ? patch.foglioCatastale.trim() : null;
      } else if ('foglio_catastale' in patch && patch.foglio_catastale !== undefined) {
        updatePayload.foglio_catastale = patch.foglio_catastale ? patch.foglio_catastale.trim() : null;
      }

      if (patch.particella !== undefined) updatePayload.particella = patch.particella ? patch.particella.trim() : null;
      if (patch.subalterno !== undefined) updatePayload.subalterno = patch.subalterno ? patch.subalterno.trim() : null;

      const unita = unwrap(await db.from('unita_immobiliari').update(updatePayload).eq('id', id).select('*').single()) as UnitaImmobiliareRaw;

      // Se fornito condòmino durante la modifica, associa o aggiorna l'anagrafica
      if ('residente' in patch && patch.residente && patch.residente.utenteId) {
        await this.associaResidente({
          unitaId: unita.id,
          utenteId: patch.residente.utenteId,
          tipoPossesso: patch.residente.tipoPossesso,
          quotaPossesso: patch.residente.quotaPossesso,
          dataInizio: patch.residente.dataInizio,
          condominioId: 'condominioId' in patch ? patch.condominioId : undefined,
        });
      }

      return unita;
    },

    async modificaUnita(id: string, patch: TablesUpdate<'unita_immobiliari'> | ModificaUnitaInput): Promise<UnitaImmobiliareRaw> {
      return this.updateUnita(id, patch);
    },

    async removeUnita(id: string): Promise<void> {
      assertOk(await db.from('unita_immobiliari').delete().eq('id', id));
    },

    async eliminaUnita(id: string): Promise<void> {
      assertOk(await db.from('unita_immobiliari').delete().eq('id', id));
    },

    // =========================================================================
    // ANAGRAFICHE (STORICO POSSESSI, RESIDENTI E SUBENTRO)
    // =========================================================================

    async listAnagrafiche(unitaId: string): Promise<IAnagraficaUnita[]> {
      return unwrap(
        await db.from('anagrafiche_unita').select('*').eq('unita_id', unitaId).order('data_inizio', { ascending: false }),
      );
    },

    async listCondominiDisponibili(condominioId: string): Promise<CondominoDisponibile[]> {
      const utenti = unwrap(
        await db
          .from('utenti')
          .select('id, nome_cognome, email, telefono')
          .order('nome_cognome')
      );
      return (utenti ?? []).map((u) => ({
        id: u.id,
        nomeCognome: u.nome_cognome || u.email || 'Utente senza nome',
        email: u.email,
        telefono: u.telefono,
      }));
    },

    async associaResidente(input: AssociaResidenteInput): Promise<IAnagraficaUnita> {
      const data = input.dataInizio ?? oggi();
      // Chiudi eventuale anagrafica attiva per la stessa unità
      assertOk(
        await db
          .from('anagrafiche_unita')
          .update({ data_fine: data })
          .eq('unita_id', input.unitaId)
          .is('data_fine', null)
      );

      // Inserisci nuova anagrafica
      const nuova = unwrap(
        await db
          .from('anagrafiche_unita')
          .insert({
            unita_id: input.unitaId,
            utente_id: input.utenteId,
            tipo_possesso: input.tipoPossesso,
            quota_possesso: input.quotaPossesso ?? 100,
            data_inizio: data,
          })
          .select('*')
          .single()
      );

      // Se fornito condominioId, sincronizza il ruolo CONDOMINO in utente_entita_ruolo se non esiste
      if (input.condominioId) {
        try {
          const ruoloCondomino = unwrap(
            await db.from('ruoli_piattaforma').select('id').eq('codice', 'CONDOMINO').single()
          );
          if (ruoloCondomino) {
            const esisteRuolo = unwrap(
              await db
                .from('utente_entita_ruolo')
                .select('id')
                .eq('utente_id', input.utenteId)
                .eq('ruolo_id', ruoloCondomino.id)
                .eq('condominio_id', input.condominioId)
                .maybeSingle()
            );
            if (!esisteRuolo) {
              await db.from('utente_entita_ruolo').insert({
                utente_id: input.utenteId,
                ruolo_id: ruoloCondomino.id,
                condominio_id: input.condominioId,
                unita_id: input.unitaId,
              });
            }
          }
        } catch {
          // Ignora errori di sincronizzazione ruolo se permessi RLS sono ristretti
        }
      }

      return nuova;
    },

    async rimuoviResidente(anagraficaId: string, dataTermine?: string): Promise<void> {
      const data = dataTermine ?? oggi();
      assertOk(
        await db
          .from('anagrafiche_unita')
          .update({ data_fine: data })
          .eq('id', anagraficaId)
      );
    },

    /**
     * Subentro (UC-11): chiude le anagrafiche attive dello stesso tipo e apre quella nuova.
     */
    async subentro(input: {
      unitaId: string;
      nuovoUtenteId: string;
      tipoPossesso: IAnagraficaUnita['tipo_possesso'];
      dataSubentro?: string;
      condominioId?: string;
    }): Promise<IAnagraficaUnita> {
      return this.associaResidente({
        unitaId: input.unitaId,
        utenteId: input.nuovoUtenteId,
        tipoPossesso: input.tipoPossesso,
        dataInizio: input.dataSubentro,
        condominioId: input.condominioId,
      });
    },

    // =========================================================================
    // TABELLE E QUOTE MILLESIMALI
    // =========================================================================

    async creaTabellaMillesimale(input: {
      condominioId: string;
      nome: string;
      palazzoId?: string | null;
      scalaColonnaId?: string | null;
      totale?: number;
    }): Promise<TabellaMillesimaleRaw> {
      const payload: TablesInsert<'tabelle_millesimali'> = {
        condominio_id: input.condominioId,
        nome: input.nome.trim(),
        palazzo_id: input.palazzoId || null,
        scala_colonna_id: input.scalaColonnaId || null,
        totale: input.totale ?? 1000,
      };
      return unwrap(await db.from('tabelle_millesimali').insert(payload).select('*').single()) as TabellaMillesimaleRaw;
    },

    /**
     * Salva massivamente le quote millesimali per una tabella (UC-09).
     * Rimuove le quote precedenti della tabella e inserisce le nuove quote.
     */
    async salvaQuoteMillesimali(tabellaId: string, quote: QuotaMillesimaleInput[]): Promise<void> {
      // 1. Elimina quote esistenti per questa tabella
      assertOk(await db.from('quote_millesimali').delete().eq('tabella_id', tabellaId));

      if (quote.length === 0) return;

      // 2. Inserisci le nuove quote
      const payload = quote.map((q) => ({
        tabella_id: tabellaId,
        unita_id: q.unitaId,
        valore_millesimale: q.valoreMillesimale,
      }));

      assertOk(await db.from('quote_millesimali').insert(payload));
    },
  };
}

export type StrutturaAdminService = ReturnType<typeof createStrutturaService>;
