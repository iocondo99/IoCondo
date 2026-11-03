import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { oggiIso } from '../home/homeLogic.ts';
import {
  BUCKET_DOCUMENTI_CONDOMINIO,
  CARTELLA_PREDEFINITA,
  documentoVisibileAResidente,
  DURATA_LINK_DOCUMENTO_SECONDI,
  etichettaVisibilitaDocumento,
  filtroDocumentiPostgrest,
  MESSAGGIO_FILE_NON_DISPONIBILE,
  ordinaDocumenti,
  scomponiPercorsoStorage,
  validaPercorsoDocumentoStorage,
  visibilitaDocumento,
  type CartellaDocumento,
  type DettaglioDocumentoCondomino,
  type DocumentoCondomino,
} from './documentiLogic.ts';

export type RisultatoLinkFirmatoDocumento =
  | { disponibile: true; signedUrl: string }
  | { disponibile: false; messaggio: string };

interface RisultatoQuery<T> {
  data: T;
  error: { message: string; code?: string; details?: string } | null;
}

function estraiDati<T>(risultato: RisultatoQuery<T>): NonNullable<T> {
  if (risultato.error) {
    const err = new Error(risultato.error.message) as Error & {
      code: string | null;
      details: string | null;
    };
    err.name = 'ServiceError';
    err.code = risultato.error.code ?? null;
    err.details = risultato.error.details ?? null;
    throw err;
  }
  if (risultato.data === null || risultato.data === undefined) {
    throw new Error('Nessun dato restituito');
  }
  return risultato.data as NonNullable<T>;
}

function estraiForse<T>(risultato: RisultatoQuery<T>): NonNullable<T> | null {
  if (risultato.error) {
    const err = new Error(risultato.error.message) as Error & {
      code: string | null;
      details: string | null;
    };
    err.name = 'ServiceError';
    err.code = risultato.error.code ?? null;
    err.details = risultato.error.details ?? null;
    throw err;
  }
  return (risultato.data ?? null) as NonNullable<T> | null;
}

/**
 * Servizio in sola lettura per le pagine `/documenti` e `/documenti/[id]` del condòmino.
 * Usa esclusivamente la chiave pubblica e le policy RLS, ma restringe sempre lato query e
 * lato client ai documenti del condominio selezionato senza unità (`unita_id IS NULL`)
 * oppure associati a un'unità del residente (`anagrafiche_unita` attiva o `utente_entita_ruolo`),
 * esattamente coerente con `homeService.contaDocumenti`.
 * In questo modo anche un amministratore o superadmin che apre la vista condòmino vede solo
 * i documenti che competono al residente.
 */
export function createDocumentiService(db: TypedSupabaseClient) {
  /**
   * Unità immobiliari del residente: anagrafica attiva (`data_fine IS NULL` o `>= oggi`)
   * oppure ruolo legato all'unità (`utente_entita_ruolo`), coerente con `homeService.contaDocumenti`.
   */
  async function unitaDiResidente(userId: string): Promise<string[]> {
    const [anagrafiche, ruoli] = await Promise.all([
      db
        .from('anagrafiche_unita')
        .select('unita_id')
        .eq('utente_id', userId)
        .or(`data_fine.is.null,data_fine.gte.${oggiIso()}`),
      db
        .from('utente_entita_ruolo')
        .select('unita_id')
        .eq('utente_id', userId)
        .not('unita_id', 'is', null),
    ]);

    const ids = new Set<string>();
    for (const r of estraiDati(anagrafiche)) {
      if (r.unita_id) ids.add(r.unita_id);
    }
    for (const r of estraiDati(ruoli)) {
      if (r.unita_id) ids.add(r.unita_id);
    }
    return [...ids];
  }

  /**
   * Verifica che il file esista davvero nel bucket privato `documenti-condominio`
   * prima di generare un link firmato o abilitare lo scaricamento.
   */
  async function esisteNelloStorage(percorsoValidato: string | null): Promise<boolean> {
    const scomposto = scomponiPercorsoStorage(percorsoValidato);
    if (!scomposto) return false;

    const { data, error } = await db.storage
      .from(BUCKET_DOCUMENTI_CONDOMINIO)
      .list(scomposto.cartella, { limit: 100, search: scomposto.nomeFile });

    if (error || !data) return false;
    return data.some((voce) => voce.name === scomposto.nomeFile);
  }

  /** Carica la mappa `unita_id -> interno` per le unità indicate. */
  async function mappaInterniUnita(unitaIds: readonly string[]): Promise<Map<string, string>> {
    const mappa = new Map<string, string>();
    const unici = [...new Set(unitaIds.filter(Boolean))];
    if (unici.length === 0) return mappa;

    const righe = estraiDati(
      await db.from('unita_immobiliari').select('id, interno').in('id', unici),
    );
    for (const u of righe) {
      mappa.set(u.id, u.interno);
    }
    return mappa;
  }

  return {
    /**
     * Elenco delle cartelle e dei documenti visibili al residente nel condominio selezionato.
     * Include solo documenti con `unita_id IS NULL` oppure associati a un'unità del residente.
     */
    async elencoDocumentiCondomino(
      userId: string,
      condominioId: string,
    ): Promise<{ cartelle: CartellaDocumento[]; documenti: DocumentoCondomino[] }> {
      if (!userId || !condominioId) {
        return { cartelle: [], documenti: [] };
      }

      const righeCartelle = estraiDati(
        await db
          .from('cartelle_documenti')
          .select('id, condominio_id, parent_id, nome_cartella')
          .eq('condominio_id', condominioId)
          .order('nome_cartella', { ascending: true }),
      );

      const cartelleDelCondominio: CartellaDocumento[] = righeCartelle
        .filter((c) => c.condominio_id === condominioId)
        .map((c) => ({
          id: c.id,
          condominioId: c.condominio_id,
          parentId: c.parent_id,
          nomeCartella: c.nome_cartella.trim() || CARTELLA_PREDEFINITA,
        }));

      if (cartelleDelCondominio.length === 0) {
        return { cartelle: [], documenti: [] };
      }

      const mappaCartelle = new Map(cartelleDelCondominio.map((c) => [c.id, c]));
      const unitaResidenteIds = await unitaDiResidente(userId);

      const righeDocumenti = estraiDati(
        await db
          .from('documenti_metadata')
          .select('id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, created_at')
          .in(
            'cartella_id',
            cartelleDelCondominio.map((c) => c.id),
          )
          .or(filtroDocumentiPostgrest(unitaResidenteIds))
          .order('created_at', { ascending: false }),
      );

      // Difesa in profondità lato client: anche se le RLS lasciano leggere tutto il condominio
      // (es. utente con ruolo ADMIN o superadmin in vista condòmino), filtriamo rigorosamente
      // ai soli documenti del condominio senza unità o associati alle unità del residente.
      const righeVisibili = righeDocumenti.filter((doc) => {
        const cartella = mappaCartelle.get(doc.cartella_id);
        if (!cartella) return false;
        return documentoVisibileAResidente(
          { condominioId: cartella.condominioId, unitaId: doc.unita_id },
          condominioId,
          unitaResidenteIds,
        );
      });

      const unitaDaRisolvere = righeVisibili.flatMap((d) => (d.unita_id ? [d.unita_id] : []));
      const mappaInterni = await mappaInterniUnita(unitaDaRisolvere);

      const documenti: DocumentoCondomino[] = righeVisibili.flatMap((doc) => {
        const cartella = mappaCartelle.get(doc.cartella_id);
        if (!cartella) return [];
        const unitaInterno = doc.unita_id ? (mappaInterni.get(doc.unita_id) ?? null) : null;
        return [
          {
            id: doc.id,
            condominioId: cartella.condominioId,
            cartellaId: cartella.id,
            cartellaNome: cartella.nomeCartella,
            unitaId: doc.unita_id,
            unitaInterno,
            visibilita: visibilitaDocumento(doc.unita_id),
            etichettaVisibilita: etichettaVisibilitaDocumento(doc.unita_id, unitaInterno),
            nomeFile: doc.nome_file,
            tipoMime: doc.tipo_mime,
            urlStorage: doc.url_storage,
            createdAt: doc.created_at,
          },
        ];
      });

      return {
        cartelle: cartelleDelCondominio,
        documenti: ordinaDocumenti(documenti, 'data-desc'),
      };
    },

    /**
     * Dettaglio di un singolo documento per `/documenti/[id]`.
     * Restituisce `null` (senza enumerazione) se il documento non esiste, appartiene a un altro
     * condominio o è associato a un'unità non appartenente al residente.
     * Verifica inoltre se il file esiste realmente nel bucket privato `documenti-condominio`
     * senza generare in anticipo il link firmato.
     */
    async dettaglioDocumentoCondomino(
      userId: string,
      condominioId: string,
      documentoId: string,
    ): Promise<DettaglioDocumentoCondomino | null> {
      if (!userId || !condominioId || !documentoId) return null;

      const rigaDoc = estraiForse(
        await db
          .from('documenti_metadata')
          .select('id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, created_at')
          .eq('id', documentoId)
          .maybeSingle(),
      );
      if (!rigaDoc) return null;

      const rigaCartella = estraiForse(
        await db
          .from('cartelle_documenti')
          .select('id, condominio_id, parent_id, nome_cartella')
          .eq('id', rigaDoc.cartella_id)
          .maybeSingle(),
      );
      if (!rigaCartella || rigaCartella.condominio_id !== condominioId) {
        return null;
      }

      const unitaResidenteIds = await unitaDiResidente(userId);
      if (
        !documentoVisibileAResidente(
          { condominioId: rigaCartella.condominio_id, unitaId: rigaDoc.unita_id },
          condominioId,
          unitaResidenteIds,
        )
      ) {
        return null;
      }

      const mappaInterni = rigaDoc.unita_id ? await mappaInterniUnita([rigaDoc.unita_id]) : new Map<string, string>();
      const unitaInterno = rigaDoc.unita_id ? (mappaInterni.get(rigaDoc.unita_id) ?? null) : null;
      const percorsoStorage = validaPercorsoDocumentoStorage(rigaDoc.url_storage, condominioId);
      const disponibileNelloStorage = await esisteNelloStorage(percorsoStorage);

      return {
        id: rigaDoc.id,
        condominioId: rigaCartella.condominio_id,
        cartellaId: rigaCartella.id,
        cartellaNome: rigaCartella.nome_cartella.trim() || CARTELLA_PREDEFINITA,
        unitaId: rigaDoc.unita_id,
        unitaInterno,
        visibilita: visibilitaDocumento(rigaDoc.unita_id),
        etichettaVisibilita: etichettaVisibilitaDocumento(rigaDoc.unita_id, unitaInterno),
        nomeFile: rigaDoc.nome_file,
        tipoMime: rigaDoc.tipo_mime,
        urlStorage: rigaDoc.url_storage,
        createdAt: rigaDoc.created_at,
        percorsoStorage,
        disponibileNelloStorage,
      };
    },

    /**
     * Genera su richiesta (solo al clic dell'utente) un link firmato temporaneo (`createSignedUrl`,
     * 600 secondi, mai `getPublicUrl`) per un documento nel bucket privato `documenti-condominio`.
     * - Rifiuta percorsi con path traversal (`..`) o appartenenti a un altro condominio.
     * - Verifica prima che l'oggetto esista nello Storage; se non è presente (es. metadati di prova),
     *   restituisce `{ disponibile: false, messaggio: 'File non ancora disponibile nello spazio di archiviazione' }`
     *   senza lanciare errori non gestiti.
     */
    async creaLinkFirmatoDocumento(
      percorsoStorage: string,
      condominioId: string,
    ): Promise<RisultatoLinkFirmatoDocumento> {
      const percorsoValidato = validaPercorsoDocumentoStorage(percorsoStorage, condominioId);
      if (!percorsoValidato) {
        throw new Error('Percorso del documento non valido nello spazio di archiviazione.');
      }

      const presente = await esisteNelloStorage(percorsoValidato);
      if (!presente) {
        return {
          disponibile: false,
          messaggio: MESSAGGIO_FILE_NON_DISPONIBILE,
        };
      }

      const { data, error } = await db.storage
        .from(BUCKET_DOCUMENTI_CONDOMINIO)
        .createSignedUrl(percorsoValidato, DURATA_LINK_DOCUMENTO_SECONDI);

      if (error || !data?.signedUrl) {
        return {
          disponibile: false,
          messaggio: MESSAGGIO_FILE_NON_DISPONIBILE,
        };
      }

      return {
        disponibile: true,
        signedUrl: data.signedUrl,
      };
    },
  };
}

export type DocumentiService = ReturnType<typeof createDocumentiService>;

