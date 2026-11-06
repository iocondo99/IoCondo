import { unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import { BUCKET_DOCUMENTI_CONDOMINIO } from '../documenti/documentiLogic.ts';
import {
  configurazioneTipoFile,
  determinaRiservatezza,
  determinaTipoFile,
  mappaBadgeRiservatezza,
  validaNuovaCartella,
  type CartellaAdminView,
  type DocumentoAdminView,
  type OpzioneUnitaAdmin,
} from './documentiAdminLogic.ts';

export const DURATA_LINK_FIRMATO_SECONDI = 600;

export interface CaricaDocumentoInput {
  condominioId: string;
  cartellaId: string;
  file: unknown;
  nomeFile: string;
  tipoMime?: string | null;
  dimensioneBytes?: number | null;
  unitaId?: string | null;
}

export function createDocumentiAdminService(db: TypedSupabaseClient) {
  return {
    /**
     * Elenco delle cartelle del condominio con conteggio documenti contenuti.
     */
    async listCartelle(condominioId: string): Promise<CartellaAdminView[]> {
      const righeCartelle = unwrap(
        await db
          .from('cartelle_documenti')
          .select('id, condominio_id, parent_id, nome_cartella, created_at')
          .eq('condominio_id', condominioId)
          .order('nome_cartella', { ascending: true }),
      );

      if (!righeCartelle || righeCartelle.length === 0) {
        return [];
      }

      const cartelleIds = righeCartelle.map((c) => c.id);

      // Conteggio file contenuti in ciascuna cartella
      const righeDoc = unwrap(
        await db
          .from('documenti_metadata')
          .select('cartella_id')
          .in('cartella_id', cartelleIds),
      );

      const conteggi = new Map<string, number>();
      for (const d of righeDoc || []) {
        const cId = d.cartella_id;
        conteggi.set(cId, (conteggi.get(cId) || 0) + 1);
      }

      return righeCartelle.map((c) => ({
        id: c.id,
        condominioId: c.condominio_id,
        parentId: c.parent_id,
        nomeCartella: c.nome_cartella,
        conteggioDocumenti: conteggi.get(c.id) || 0,
        createdAt: c.created_at,
      }));
    },

    /**
     * Crea una nuova cartella nel condominio attivo.
     */
    async creaCartella(condominioId: string, nomeCartella: string): Promise<CartellaAdminView> {
      const validazione = validaNuovaCartella(nomeCartella);
      if (!validazione.valido) {
        throw new Error(validazione.errore || 'Nome cartella non valido.');
      }

      const riga = unwrap(
        await db
          .from('cartelle_documenti')
          .insert({
            condominio_id: condominioId,
            nome_cartella: nomeCartella.trim(),
          })
          .select('id, condominio_id, parent_id, nome_cartella, created_at')
          .single(),
      );

      return {
        id: riga.id,
        condominioId: riga.condominio_id,
        parentId: riga.parent_id,
        nomeCartella: riga.nome_cartella,
        conteggioDocumenti: 0,
        createdAt: riga.created_at,
      };
    },

    /**
     * Elimina una cartella vuota. Se contiene documenti, rifiuta l'operazione.
     */
    async eliminaCartella(cartellaId: string): Promise<{ ok: boolean; errore?: string }> {
      // Verifica se ci sono documenti all'interno
      const { count, error: countError } = await db
        .from('documenti_metadata')
        .select('id', { count: 'exact', head: true })
        .eq('cartella_id', cartellaId);

      if (countError) {
        return { ok: false, errore: countError.message };
      }

      if (count && count > 0) {
        return {
          ok: false,
          errore: 'Impossibile eliminare una cartella che contiene documenti. Svuota prima i file.',
        };
      }

      const { error: delError } = await db
        .from('cartelle_documenti')
        .delete()
        .eq('id', cartellaId);

      if (delError) {
        return { ok: false, errore: delError.message };
      }

      return { ok: true };
    },

    /**
     * Elenco completo di tutti i documenti del condominio attivo, con join su cartelle e unità.
     */
    async listDocumenti(condominioId: string): Promise<DocumentoAdminView[]> {
      // 1. Recupera le cartelle del condominio
      const cartelle = unwrap(
        await db
          .from('cartelle_documenti')
          .select('id, nome_cartella')
          .eq('condominio_id', condominioId),
      );

      if (!cartelle || cartelle.length === 0) {
        return [];
      }

      const mappaCartelle = new Map(cartelle.map((c) => [c.id, c.nome_cartella]));
      const cartelleIds = cartelle.map((c) => c.id);

      // 2. Recupera tutti i metadati dei documenti per queste cartelle
      const docs = unwrap(
        await db
          .from('documenti_metadata')
          .select('id, cartella_id, unita_id, url_storage, nome_file, tipo_mime, caricato_da, created_at')
          .in('cartella_id', cartelleIds)
          .order('created_at', { ascending: false }),
      );

      if (!docs || docs.length === 0) {
        return [];
      }

      // 3. Risoluzione unità immobiliari (per documenti riservati)
      const unitaIds = Array.from(new Set(docs.map((d) => d.unita_id).filter(Boolean))) as string[];
      const mappaUnita = new Map<
        string,
        { interno: string; palazzoNome: string; scalaNome: string | null }
      >();

      if (unitaIds.length > 0) {
        const unitaRighe = unwrap(
          await db
            .from('unita_immobiliari')
            .select(`
              id,
              interno,
              palazzi (
                nome_identificativo
              ),
              scale_colonne (
                nome
              )
            `)
            .in('id', unitaIds),
        );

        for (const u of unitaRighe as any[]) {
          const palazzoNome = u.palazzi?.nome_identificativo || '';
          const scalaNome = u.scale_colonne?.nome || null;
          mappaUnita.set(u.id, {
            interno: u.interno,
            palazzoNome,
            scalaNome,
          });
        }
      }

      // 4. Mappatura in vista Admin
      return docs.map((d) => {
        const cartellaNome = mappaCartelle.get(d.cartella_id) || 'Senza cartella';
        const infoUnita = d.unita_id ? mappaUnita.get(d.unita_id) : undefined;
        const tipoFile = determinaTipoFile(d.nome_file, d.tipo_mime);
        const specificaTipo = configurazioneTipoFile(tipoFile);
        const riservatezza = determinaRiservatezza(d.unita_id);
        const badgeRiservatezza = mappaBadgeRiservatezza(
          d.unita_id,
          infoUnita?.interno,
          infoUnita?.palazzoNome,
        );

        return {
          id: d.id,
          cartellaId: d.cartella_id,
          cartellaNome,
          unitaId: d.unita_id,
          unitaInterno: infoUnita?.interno || null,
          palazzoNome: infoUnita?.palazzoNome || null,
          scalaNome: infoUnita?.scalaNome || null,
          urlStorage: d.url_storage,
          nomeFile: d.nome_file,
          tipoMime: d.tipo_mime,
          dimensioneBytes: null, // Non tracciato in tabella metadati, gestito dinamicamente
          caricatoDa: d.caricato_da,
          createdAt: d.created_at,
          tipoFile,
          specificaTipo,
          riservatezza,
          badgeRiservatezza,
        };
      });
    },

    /**
     * Elenco delle unità del condominio per il selettore nel modale di caricamento.
     */
    async listUnita(condominioId: string): Promise<OpzioneUnitaAdmin[]> {
      const res = unwrap(
        await db
          .from('unita_immobiliari')
          .select(`
            id,
            interno,
            piano,
            palazzi!inner (
              id,
              nome_identificativo,
              condominio_id
            ),
            scale_colonne (
              id,
              nome
            )
          `)
          .eq('palazzi.condominio_id', condominioId)
          .order('interno', { ascending: true }),
      );

      if (!res || res.length === 0) return [];

      return (res as any[]).map((u) => {
        const palazzo = u.palazzi?.nome_identificativo || 'Palazzo';
        const scala = u.scale_colonne?.nome ? ` - Scala ${u.scale_colonne.nome}` : '';
        const piano = u.piano !== null && u.piano !== undefined ? ` (P. ${u.piano})` : '';
        const label = `${palazzo}${scala} - Int. ${u.interno}${piano}`;

        return {
          id: u.id,
          interno: u.interno,
          piano: u.piano,
          palazzoNome: palazzo,
          scalaNome: u.scale_colonne?.nome || null,
          label,
        };
      });
    },

    /**
     * Genera un link firmato a scadenza (600s) per scaricare/aprire il documento in sicurezza.
     */
    async creaLinkFirmato(urlStorage: string): Promise<{ ok: boolean; signedUrl?: string; errore?: string }> {
      if (!urlStorage || urlStorage.includes('..')) {
        return { ok: false, errore: 'Percorso del documento non valido.' };
      }

      const { data, error } = await db.storage
        .from(BUCKET_DOCUMENTI_CONDOMINIO)
        .createSignedUrl(urlStorage, DURATA_LINK_FIRMATO_SECONDI);

      if (error || !data?.signedUrl) {
        return {
          ok: false,
          errore: error?.message || 'File non ancora presente nello spazio di archiviazione o scaduto.',
        };
      }

      return {
        ok: true,
        signedUrl: data.signedUrl,
      };
    },

    /**
     * Carica un nuovo documento nel bucket privato `documenti-condominio`
     * e registra i metadati in `documenti_metadata`.
     */
    async caricaDocumento(
      params: CaricaDocumentoInput,
    ): Promise<{ ok: boolean; documentoId?: string; errore?: string }> {
      try {
        const sanitizedNome = params.nomeFile.replace(/[^a-zA-Z0-9._-]/g, '_');
        // Path sicuro nello storage: {condominioId}/{cartellaId}/{timestamp}_{nomeFile}
        const storagePath = `${params.condominioId}/${params.cartellaId}/${Date.now()}_${sanitizedNome}`;

        // 1. Upload file nello storage
        const { error: uploadError } = await db.storage
          .from(BUCKET_DOCUMENTI_CONDOMINIO)
          .upload(storagePath, params.file as any, {
            contentType: params.tipoMime || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          return { ok: false, errore: `Errore durante il caricamento del file: ${uploadError.message}` };
        }

        // 2. Inserimento record metadati
        const rigaDoc = unwrap(
          await db
            .from('documenti_metadata')
            .insert({
              cartella_id: params.cartellaId,
              unita_id: params.unitaId || null,
              url_storage: storagePath,
              nome_file: params.nomeFile,
              tipo_mime: params.tipoMime || null,
            })
            .select('id')
            .single(),
        );

        return { ok: true, documentoId: rigaDoc.id };
      } catch (err: any) {
        return { ok: false, errore: err?.message || 'Errore imprevisto durante il salvataggio del documento.' };
      }
    },

    /**
     * Elimina un documento dallo storage e dal database.
     */
    async eliminaDocumento(
      documentoId: string,
      urlStorage: string,
    ): Promise<{ ok: boolean; errore?: string }> {
      try {
        // 1. Rimuove il file fisico dallo storage (se presente)
        if (urlStorage && !urlStorage.startsWith('seed-dev/')) {
          await db.storage.from(BUCKET_DOCUMENTI_CONDOMINIO).remove([urlStorage]);
        }

        // 2. Elimina la riga da documenti_metadata
        const { error: delError } = await db
          .from('documenti_metadata')
          .delete()
          .eq('id', documentoId);

        if (delError) {
          return { ok: false, errore: delError.message };
        }

        return { ok: true };
      } catch (err: any) {
        return { ok: false, errore: err?.message || 'Errore durante l’eliminazione del documento.' };
      }
    },
  };
}

export type DocumentiAdminService = ReturnType<typeof createDocumentiAdminService>;
