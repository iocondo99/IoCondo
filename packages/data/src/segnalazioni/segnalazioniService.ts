import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { oggiIso } from '../home/homeLogic.ts';
import {
  BUCKET_FOTO_GUASTI,
  costruisciPercorsoFotoGuasto,
  DURATA_LINK_FOTO_SECONDI,
  estraiNomeFileDaPercorso,
  etichettaAmbitoTicket,
  etichettaPrioritaTicket,
  etichettaStatoTicket,
  filtraTicketVisibiliCondomino,
  filtraTicketVisibiliPortiere,
  filtroTicketCondominoPostgrest,
  filtroTicketPortierePostgrest,
  formattaEtichettaUnita,
  ordinaSegnalazioni,
  scomponiPercorsoFotoStorage,
  statoBadgeDaStatoTicket,
  ticketVisibileInModalita,
  validaInputNuovaSegnalazione,
  validaMessaggioTicket,
  validaPercorsoFotoStorage,
  type AllegatoTicket,
  type CategoriaGuasto,
  type DettaglioSegnalazione,
  type FotoAllegatoInput,
  type InputNuovaSegnalazione,
  type MessaggioTicket,
  type ModalitaSegnalazioni,
  type PrioritaTicket,
  type SegnalazioneRiepilogo,
  type StatoTicket,
  type TipoFileTicket,
  type UnitaResidenteOpzione,
} from './segnalazioniLogic.ts';

interface RisultatoQuery<T> {
  data: T;
  error: { message: string; code?: string; details?: string } | null;
}

function lanciaErrore(errore: { message: string; code?: string; details?: string }): never {
  const err = new Error(errore.message) as Error & { code: string | null; details: string | null };
  err.name = 'ServiceError';
  err.code = errore.code ?? null;
  err.details = errore.details ?? null;
  throw err;
}

function estraiDati<T>(risultato: RisultatoQuery<T>): NonNullable<T> {
  if (risultato.error) lanciaErrore(risultato.error);
  if (risultato.data === null || risultato.data === undefined) {
    throw new Error('Nessun dato restituito');
  }
  return risultato.data as NonNullable<T>;
}

function estraiForse<T>(risultato: RisultatoQuery<T>): NonNullable<T> | null {
  if (risultato.error) lanciaErrore(risultato.error);
  return (risultato.data ?? null) as NonNullable<T> | null;
}

interface RigaTicket {
  id: string;
  condominio_id: string;
  unita_id: string | null;
  segnalatore_id: string | null;
  categoria_id: string | null;
  titolo: string;
  descrizione: string | null;
  is_area_comune: boolean;
  priorita: PrioritaTicket;
  stato: StatoTicket;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

const COLONNE_TICKET =
  'id, condominio_id, unita_id, segnalatore_id, categoria_id, titolo, descrizione, is_area_comune, priorita, stato, created_at, updated_at, closed_at';

/** Foto da caricare con la segnalazione: metadati + contenuto binario. */
export interface FotoDaCaricare extends FotoAllegatoInput {
  body: Blob | ArrayBuffer | Uint8Array;
}

export interface InputCreaSegnalazione extends Omit<InputNuovaSegnalazione, 'allegati'> {
  allegati?: readonly FotoDaCaricare[];
}

export type RisultatoCreaSegnalazione =
  | { ok: true; ticketId: string; fotoNonCaricate: string[] }
  | { ok: false; errori: Record<string, string> };

export type RisultatoAggiungiMessaggio =
  | { ok: true; messaggio: MessaggioTicket }
  | { ok: false; errore: string };

/**
 * Servizio per `/segnalazioni`, `/segnalazioni/[id]` (condòmino) e `/ticket-aree-comuni` (portiere).
 * Usa solo la chiave pubblica e le policy RLS, ma restringe sempre query e risultati lato client
 * al condominio selezionato e alla modalità richiesta (anche per ADMIN o superadmin).
 * Le foto sono servite solo con link firmati (`createSignedUrl`, 600 s), mai con `getPublicUrl`.
 */
export function createSegnalazioniService(db: TypedSupabaseClient) {
  async function unitaIdsDiResidente(userId: string): Promise<string[]> {
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
    for (const r of estraiDati(anagrafiche)) if (r.unita_id) ids.add(r.unita_id);
    for (const r of estraiDati(ruoli)) if (r.unita_id) ids.add(r.unita_id);
    return [...ids];
  }

  async function unitaNelCondominio(
    userId: string,
    condominioId: string,
  ): Promise<UnitaResidenteOpzione[]> {
    const ids = await unitaIdsDiResidente(userId);
    if (ids.length === 0) return [];

    const [palazzi, unita] = await Promise.all([
      db.from('palazzi').select('id').eq('condominio_id', condominioId),
      db.from('unita_immobiliari').select('id, palazzo_id, interno, piano').in('id', ids),
    ]);
    const palazziDelCondominio = new Set(estraiDati(palazzi).map((p) => p.id));

    return estraiDati(unita)
      .filter((u) => palazziDelCondominio.has(u.palazzo_id))
      .map((u) => {
        const piano = u.piano === null || u.piano === undefined ? null : String(u.piano);
        return {
          id: u.id,
          interno: u.interno,
          scala: null,
          piano,
          etichetta: formattaEtichettaUnita({ interno: u.interno, piano }),
        };
      });
  }

  async function mappaInterni(unitaIds: readonly string[]): Promise<Map<string, string>> {
    const mappa = new Map<string, string>();
    const unici = [...new Set(unitaIds.filter(Boolean))];
    if (unici.length === 0) return mappa;
    const righe = estraiDati(await db.from('unita_immobiliari').select('id, interno').in('id', unici));
    for (const u of righe) mappa.set(u.id, u.interno);
    return mappa;
  }

  async function mappaCategorie(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const mappa = new Map<string, string>();
    const unici = [...new Set(ids.filter((i): i is string => Boolean(i)))];
    if (unici.length === 0) return mappa;
    const righe = estraiDati(await db.from('categorie_guasti').select('id, nome').in('id', unici));
    for (const c of righe) mappa.set(c.id, c.nome);
    return mappa;
  }

  async function mappaNomi(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const mappa = new Map<string, string>();
    const unici = [...new Set(ids.filter((i): i is string => Boolean(i)))];
    if (unici.length === 0) return mappa;
    const righe = estraiDati(
      await db.from('profili_pubblici').select('id, nome_cognome').in('id', unici),
    );
    for (const p of righe) {
      if (p.id && p.nome_cognome) mappa.set(p.id, p.nome_cognome);
    }
    return mappa;
  }

  function costruisciRiepilogo(
    riga: RigaTicket,
    interni: Map<string, string>,
    categorie: Map<string, string>,
  ): SegnalazioneRiepilogo {
    const unitaInterno = riga.unita_id ? (interni.get(riga.unita_id) ?? null) : null;
    return {
      id: riga.id,
      condominioId: riga.condominio_id,
      unitaId: riga.unita_id,
      unitaInterno,
      segnalatoreId: riga.segnalatore_id,
      categoriaId: riga.categoria_id,
      categoriaNome: riga.categoria_id ? (categorie.get(riga.categoria_id) ?? null) : null,
      titolo: riga.titolo,
      descrizione: riga.descrizione,
      isAreaComune: riga.is_area_comune,
      etichettaAmbito: etichettaAmbitoTicket(riga.is_area_comune, riga.unita_id, unitaInterno),
      priorita: riga.priorita,
      etichettaPriorita: etichettaPrioritaTicket(riga.priorita),
      stato: riga.stato,
      etichettaStato: etichettaStatoTicket(riga.stato),
      statoBadge: statoBadgeDaStatoTicket(riga.stato),
      createdAt: riga.created_at,
      updatedAt: riga.updated_at,
      closedAt: riga.closed_at,
    };
  }

  async function arricchisci(righe: readonly RigaTicket[]): Promise<SegnalazioneRiepilogo[]> {
    const [interni, categorie] = await Promise.all([
      mappaInterni(righe.flatMap((r) => (r.unita_id ? [r.unita_id] : []))),
      mappaCategorie(righe.map((r) => r.categoria_id)),
    ]);
    return righe.map((r) => costruisciRiepilogo(r, interni, categorie));
  }

  async function esisteNelloStorage(percorso: string | null): Promise<boolean> {
    const scomposto = scomponiPercorsoFotoStorage(percorso);
    if (!scomposto) return false;
    const { data, error } = await db.storage
      .from(BUCKET_FOTO_GUASTI)
      .list(scomposto.cartella, { limit: 100, search: scomposto.nomeFile });
    if (error || !data) return false;
    return data.some((voce) => voce.name === scomposto.nomeFile);
  }

  async function caricaAllegati(
    ticketId: string,
    condominioId: string,
  ): Promise<AllegatoTicket[]> {
    const righe = estraiDati(
      await db
        .from('ticket_allegati')
        .select('id, ticket_id, url_storage, tipo_file, caricato_da, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
    );

    return Promise.all(
      righe.map(async (a): Promise<AllegatoTicket> => {
        const percorso = validaPercorsoFotoStorage(a.url_storage, condominioId, undefined);
        const presente = await esisteNelloStorage(percorso);
        let signedUrl: string | null = null;
        if (presente && percorso) {
          const { data, error } = await db.storage
            .from(BUCKET_FOTO_GUASTI)
            .createSignedUrl(percorso, DURATA_LINK_FOTO_SECONDI);
          signedUrl = !error && data?.signedUrl ? data.signedUrl : null;
        }
        return {
          id: a.id,
          ticketId: a.ticket_id,
          urlStorage: a.url_storage,
          nomeFile: estraiNomeFileDaPercorso(a.url_storage),
          percorsoStorage: percorso,
          tipoFile: a.tipo_file as TipoFileTicket,
          caricatoDa: a.caricato_da,
          createdAt: a.created_at,
          disponibileNelloStorage: presente && signedUrl !== null,
          signedUrl,
        };
      }),
    );
  }

  async function caricaMessaggi(ticketId: string, userId: string): Promise<MessaggioTicket[]> {
    const righe = estraiDati(
      await db
        .from('ticket_messaggi')
        .select('id, ticket_id, mittente_id, messaggio, timestamp')
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: true }),
    );
    const nomi = await mappaNomi(righe.map((m) => m.mittente_id));
    return righe.map((m) => ({
      id: m.id,
      ticketId: m.ticket_id,
      mittenteId: m.mittente_id,
      mittenteNome: m.mittente_id ? (nomi.get(m.mittente_id) ?? 'Utente del condominio') : 'Utente del condominio',
      isProprioMessaggio: m.mittente_id === userId,
      messaggio: m.messaggio,
      timestamp: m.timestamp,
    }));
  }

  /** Carica il ticket solo se visibile nella modalità richiesta, altrimenti `null`. */
  async function ticketVisibile(
    userId: string,
    condominioId: string,
    ticketId: string,
    modalita: ModalitaSegnalazioni,
  ): Promise<RigaTicket | null> {
    if (!userId || !condominioId || !ticketId) return null;
    const riga = estraiForse(
      await db.from('ticket_testata').select(COLONNE_TICKET).eq('id', ticketId).maybeSingle(),
    ) as RigaTicket | null;
    if (!riga) return null;
    const unitaIds = modalita === 'condomino' ? await unitaIdsDiResidente(userId) : [];
    const visibile = ticketVisibileInModalita(
      {
        condominioId: riga.condominio_id,
        segnalatoreId: riga.segnalatore_id,
        unitaId: riga.unita_id,
        isAreaComune: riga.is_area_comune,
      },
      userId,
      condominioId,
      unitaIds,
      modalita,
    );
    return visibile ? riga : null;
  }

  return {
    /** Categorie guasti (`categorie_guasti`), ordinate per nome. */
    async elencoCategorie(): Promise<CategoriaGuasto[]> {
      const righe = estraiDati(await db.from('categorie_guasti').select('id, nome').order('nome'));
      return righe.map((c) => ({ id: c.id, nome: c.nome }));
    },

    /** Unità attive del residente nel condominio selezionato. */
    async unitaDelResidenteNelCondominio(
      userId: string,
      condominioId: string,
    ): Promise<UnitaResidenteOpzione[]> {
      if (!userId || !condominioId) return [];
      return unitaNelCondominio(userId, condominioId);
    },

    /** Segnalazioni del condòmino: proprie o delle sue unità, nel condominio selezionato. */
    async elencoSegnalazioniCondomino(
      userId: string,
      condominioId: string,
    ): Promise<SegnalazioneRiepilogo[]> {
      if (!userId || !condominioId) return [];
      const unitaIds = await unitaIdsDiResidente(userId);
      const righe = estraiDati(
        await db
          .from('ticket_testata')
          .select(COLONNE_TICKET)
          .eq('condominio_id', condominioId)
          .or(filtroTicketCondominoPostgrest(userId, unitaIds))
          .order('created_at', { ascending: false }),
      ) as RigaTicket[];

      const visibili = filtraTicketVisibiliCondomino(
        righe.map((r) => ({
          riga: r,
          condominioId: r.condominio_id,
          segnalatoreId: r.segnalatore_id,
          unitaId: r.unita_id,
          isAreaComune: r.is_area_comune,
        })),
        userId,
        condominioId,
        unitaIds,
      ).map((v) => v.riga);

      return ordinaSegnalazioni(await arricchisci(visibili), 'data-desc');
    },

    /** Ticket delle aree comuni per il portiere (più quelli aperti da lui) nel condominio selezionato. */
    async elencoTicketPortiere(
      userId: string,
      condominioId: string,
    ): Promise<SegnalazioneRiepilogo[]> {
      if (!userId || !condominioId) return [];
      const righe = estraiDati(
        await db
          .from('ticket_testata')
          .select(COLONNE_TICKET)
          .eq('condominio_id', condominioId)
          .or(filtroTicketPortierePostgrest(userId))
          .order('created_at', { ascending: false }),
      ) as RigaTicket[];

      const visibili = filtraTicketVisibiliPortiere(
        righe.map((r) => ({
          riga: r,
          condominioId: r.condominio_id,
          segnalatoreId: r.segnalatore_id,
          unitaId: r.unita_id,
          isAreaComune: r.is_area_comune,
        })),
        userId,
        condominioId,
      ).map((v) => v.riga);

      return ordinaSegnalazioni(await arricchisci(visibili), 'data-desc');
    },

    /**
     * Dettaglio di una segnalazione. `null` (senza enumerazione) se il ticket non esiste,
     * è di un altro condominio o non è visibile nella modalità richiesta.
     */
    async dettaglioSegnalazione(
      userId: string,
      condominioId: string,
      ticketId: string,
      modalita: ModalitaSegnalazioni = 'condomino',
    ): Promise<DettaglioSegnalazione | null> {
      const riga = await ticketVisibile(userId, condominioId, ticketId, modalita);
      if (!riga) return null;

      const [riepilogoLista, messaggi, allegati, nomi] = await Promise.all([
        arricchisci([riga]),
        caricaMessaggi(riga.id, userId),
        caricaAllegati(riga.id, condominioId),
        mappaNomi([riga.segnalatore_id]),
      ]);
      const riepilogo = riepilogoLista[0]!;

      return {
        ...riepilogo,
        segnalatoreNome: riga.segnalatore_id
          ? (nomi.get(riga.segnalatore_id) ?? 'Utente del condominio')
          : 'Utente del condominio',
        messaggi,
        allegati,
      };
    },

    /**
     * Crea una segnalazione e carica le foto opzionali. In modalità `portiere` forza
     * `is_area_comune = true` e `unita_id = null`. Il cambio stato resta all'amministratore.
     */
    async creaSegnalazione(
      userId: string,
      condominioId: string,
      input: InputCreaSegnalazione,
      modalita: ModalitaSegnalazioni = 'condomino',
    ): Promise<RisultatoCreaSegnalazione> {
      if (!userId || !condominioId) {
        return { ok: false, errori: { generale: 'Seleziona un condominio per continuare.' } };
      }
      const unitaIds = modalita === 'condomino' ? await unitaIdsDiResidente(userId) : [];
      const validazione = validaInputNuovaSegnalazione(input, unitaIds, modalita);
      if (!validazione.valido) {
        return { ok: false, errori: validazione.errori as Record<string, string> };
      }
      const dati = validazione.dati;
      const ticketId = crypto.randomUUID();

      const inserito = await db.from('ticket_testata').insert({
        id: ticketId,
        condominio_id: condominioId,
        unita_id: dati.unitaId,
        segnalatore_id: userId,
        categoria_id: dati.categoriaId,
        titolo: dati.titolo,
        descrizione: dati.descrizione,
        is_area_comune: dati.isAreaComune,
        priorita: dati.priorita,
      });
      if (inserito.error) lanciaErrore(inserito.error);

      const fotoNonCaricate: string[] = [];
      let indice = 0;
      for (const foto of input.allegati ?? []) {
        indice += 1;
        const percorso = costruisciPercorsoFotoGuasto(
          condominioId,
          ticketId,
          foto.name,
          `${Date.now()}${indice}`,
        );
        if (!percorso) {
          fotoNonCaricate.push(foto.name);
          continue;
        }
        const upload = await db.storage
          .from(BUCKET_FOTO_GUASTI)
          .upload(percorso, foto.body as Blob, { contentType: foto.type, upsert: false });
        if (upload.error) {
          fotoNonCaricate.push(foto.name);
          continue;
        }
        const registrato = await db.from('ticket_allegati').insert({
          ticket_id: ticketId,
          url_storage: percorso,
          tipo_file: 'FOTO',
          caricato_da: userId,
        });
        if (registrato.error) fotoNonCaricate.push(foto.name);
      }

      return { ok: true, ticketId, fotoNonCaricate };
    },

    /** Aggiunge un messaggio di aggiornamento (`mittente_id = userId`) a un ticket visibile. */
    async aggiungiMessaggio(
      userId: string,
      condominioId: string,
      ticketId: string,
      testo: string,
      modalita: ModalitaSegnalazioni = 'condomino',
    ): Promise<RisultatoAggiungiMessaggio> {
      const validazione = validaMessaggioTicket(testo);
      if (!validazione.valido) return { ok: false, errore: validazione.errore };

      const riga = await ticketVisibile(userId, condominioId, ticketId, modalita);
      if (!riga) return { ok: false, errore: 'Questa segnalazione non è disponibile.' };

      const inserito = estraiDati(
        await db
          .from('ticket_messaggi')
          .insert({ ticket_id: riga.id, mittente_id: userId, messaggio: validazione.testo })
          .select('id, ticket_id, mittente_id, messaggio, timestamp')
          .single(),
      );
      const nomi = await mappaNomi([userId]);
      return {
        ok: true,
        messaggio: {
          id: inserito.id,
          ticketId: inserito.ticket_id,
          mittenteId: inserito.mittente_id,
          mittenteNome: nomi.get(userId) ?? 'Tu',
          isProprioMessaggio: true,
          messaggio: inserito.messaggio,
          timestamp: inserito.timestamp,
        },
      };
    },
  };
}

export type SegnalazioniService = ReturnType<typeof createSegnalazioniService>;

