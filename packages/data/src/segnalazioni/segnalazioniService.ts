import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { oggiIso } from '../home/homeLogic.ts';
import {
  BUCKET_FOTO_GUASTI,
  costruisciPercorsoFotoGuasto,
  determinaAmbitoTipo,
  DURATA_LINK_FOTO_SECONDI,
  estraiNomeFileDaPercorso,
  etichettaAmbitoTicket,
  etichettaPrioritaTicket,
  etichettaStatoTicket,
  filtraTicketVisibiliCondomino,
  filtraTicketVisibiliPortiere,
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
  type OpzioneAmbitoTicket,
  type PrioritaTicket,
  type SegnalazioneRiepilogo,
  type StatoTicket,
  type TipoFileTicket,
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
  palazzo_id: string | null;
  scala_colonna_id: string | null;
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
  'id, condominio_id, unita_id, palazzo_id, scala_colonna_id, segnalatore_id, categoria_id, titolo, descrizione, is_area_comune, priorita, stato, created_at, updated_at, closed_at';

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
 * Basato sul modello ad ambiti condivisi (Condominio / Palazzo / Scala).
 * Non espone né permette la creazione di ticket privati legati alla singola unità 1-a-1.
 * Le foto sono servite solo con link firmati temporanei (`createSignedUrl`, 600 s).
 */
export function createSegnalazioniService(db: TypedSupabaseClient) {
  /** Ricava le unità attive del residente nel condominio selezionato con relativo palazzo e scala. */
  async function unitaResidenteNelCondominio(userId: string, condominioId: string) {
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

    const elencoIds = [...ids];
    if (elencoIds.length === 0) {
      return { unitaIds: [], palazzoIds: [], scalaIds: [] };
    }

    const [palazziDelCond, unitaRighe] = await Promise.all([
      db.from('palazzi').select('id').eq('condominio_id', condominioId),
      db
        .from('unita_immobiliari')
        .select('id, palazzo_id, scala_colonna_id')
        .in('id', elencoIds),
    ]);
    const palazziSet = new Set(estraiDati(palazziDelCond).map((p) => p.id));
    const unitaNelCond = estraiDati(unitaRighe).filter((u) => palazziSet.has(u.palazzo_id));

    const unitaIds: string[] = [];
    const palazzoIds = new Set<string>();
    const scalaIds = new Set<string>();

    for (const u of unitaNelCond) {
      unitaIds.push(u.id);
      if (u.palazzo_id) palazzoIds.add(u.palazzo_id);
      if (u.scala_colonna_id) scalaIds.add(u.scala_colonna_id);
    }

    return {
      unitaIds,
      palazzoIds: [...palazzoIds],
      scalaIds: [...scalaIds],
    };
  }

  async function mappaPalazzi(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const mappa = new Map<string, string>();
    const unici = [...new Set(ids.filter((i): i is string => Boolean(i)))];
    if (unici.length === 0) return mappa;
    const righe = estraiDati(
      await db.from('palazzi').select('id, nome_identificativo').in('id', unici),
    );
    for (const p of righe) mappa.set(p.id, p.nome_identificativo);
    return mappa;
  }

  async function mappaScale(
    ids: readonly (string | null)[],
  ): Promise<Map<string, { nome: string; palazzo_id: string }>> {
    const mappa = new Map<string, { nome: string; palazzo_id: string }>();
    const unici = [...new Set(ids.filter((i): i is string => Boolean(i)))];
    if (unici.length === 0) return mappa;
    const righe = estraiDati(
      await db.from('scale_colonne').select('id, nome, palazzo_id').in('id', unici),
    );
    for (const s of righe) mappa.set(s.id, { nome: s.nome, palazzo_id: s.palazzo_id });
    return mappa;
  }

  async function mappaInterni(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const mappa = new Map<string, string>();
    const unici = [...new Set(ids.filter((i): i is string => Boolean(i)))];
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
    palazzi: Map<string, string>,
    scale: Map<string, { nome: string; palazzo_id: string }>,
    interni: Map<string, string>,
    categorie: Map<string, string>,
  ): SegnalazioneRiepilogo {
    const palazzoNome = riga.palazzo_id ? (palazzi.get(riga.palazzo_id) ?? null) : null;
    const scalaInfo = riga.scala_colonna_id ? (scale.get(riga.scala_colonna_id) ?? null) : null;
    const scalaNome = scalaInfo ? scalaInfo.nome : null;
    const unitaInterno = riga.unita_id ? (interni.get(riga.unita_id) ?? null) : null;
    const ambitoTipo = determinaAmbitoTipo(riga.palazzo_id, riga.scala_colonna_id);

    return {
      id: riga.id,
      condominioId: riga.condominio_id,
      palazzoId: riga.palazzo_id,
      palazzoNome,
      scalaColonnaId: riga.scala_colonna_id,
      scalaNome,
      unitaId: riga.unita_id,
      unitaInterno,
      segnalatoreId: riga.segnalatore_id,
      categoriaId: riga.categoria_id,
      categoriaNome: riga.categoria_id ? (categorie.get(riga.categoria_id) ?? null) : null,
      titolo: riga.titolo,
      descrizione: riga.descrizione,
      isAreaComune: riga.is_area_comune,
      ambitoTipo,
      etichettaAmbito: etichettaAmbitoTicket(
        palazzoNome,
        scalaNome,
        riga.is_area_comune,
        unitaInterno,
      ),
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
    const [palazzi, scale, interni, categorie] = await Promise.all([
      mappaPalazzi(righe.map((r) => r.palazzo_id)),
      mappaScale(righe.map((r) => r.scala_colonna_id)),
      mappaInterni(righe.map((r) => r.unita_id)),
      mappaCategorie(righe.map((r) => r.categoria_id)),
    ]);
    return righe.map((r) => costruisciRiepilogo(r, palazzi, scale, interni, categorie));
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
      mittenteNome: m.mittente_id
        ? (nomi.get(m.mittente_id) ?? 'Utente del condominio')
        : 'Utente del condominio',
      isProprioMessaggio: m.mittente_id === userId,
      messaggio: m.messaggio,
      timestamp: m.timestamp,
    }));
  }

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

    let userPalazzoIds: string[] = [];
    let userScalaIds: string[] = [];
    let unitaIds: string[] = [];

    if (modalita === 'condomino') {
      const info = await unitaResidenteNelCondominio(userId, condominioId);
      userPalazzoIds = info.palazzoIds;
      userScalaIds = info.scalaIds;
      unitaIds = info.unitaIds;
    }

    const visibile = ticketVisibileInModalita(
      {
        condominioId: riga.condominio_id,
        segnalatoreId: riga.segnalatore_id,
        palazzoId: riga.palazzo_id,
        scalaColonnaId: riga.scala_colonna_id,
        unitaId: riga.unita_id,
        isAreaComune: riga.is_area_comune,
      },
      userId,
      condominioId,
      userPalazzoIds,
      userScalaIds,
      modalita,
      unitaIds,
    );
    return visibile ? riga : null;
  }

  return {
    /** Categorie guasti (`categorie_guasti`), ordinate per nome. */
    async elencoCategorie(): Promise<CategoriaGuasto[]> {
      const righe = estraiDati(await db.from('categorie_guasti').select('id, nome').order('nome'));
      return righe.map((c) => ({ id: c.id, nome: c.nome }));
    },

    /**
     * Ambiti selezionabili per l'apertura di una nuova segnalazione:
     * - 'CONDOMINIO' (Area comune per tutti);
     * - 'PALAZZO' (solo i palazzi associati al residente, o tutti per portiere/admin);
     * - 'SCALA' (solo le scale associate al residente, o tutte per portiere/admin).
     */
    async ambitiSelezionabili(
      userId: string,
      condominioId: string,
      modalita: ModalitaSegnalazioni = 'condomino',
    ): Promise<OpzioneAmbitoTicket[]> {
      const opzioni: OpzioneAmbitoTicket[] = [
        {
          id: 'condominio',
          tipo: 'CONDOMINIO',
          palazzoId: null,
          scalaColonnaId: null,
          etichetta: 'Area comune del condominio (visibile a tutti)',
          descrizione: 'Guasto visibile a tutti i condòmini',
        },
      ];

      if (modalita === 'condomino') {
        const info = await unitaResidenteNelCondominio(userId, condominioId);
        if (info.palazzoIds.length > 0) {
          const palazziRighe = estraiDati(
            await db
              .from('palazzi')
              .select('id, nome_identificativo')
              .in('id', info.palazzoIds)
              .order('nome_identificativo'),
          );
          for (const p of palazziRighe) {
            opzioni.push({
              id: `palazzo:${p.id}`,
              tipo: 'PALAZZO',
              palazzoId: p.id,
              scalaColonnaId: null,
              etichetta: `Palazzo ${p.nome_identificativo}`,
              descrizione: `Visibile ai residenti di Palazzo ${p.nome_identificativo}`,
            });
          }
        }

        if (info.scalaIds.length > 0) {
          const scaleRighe = estraiDati(
            await db
              .from('scale_colonne')
              .select('id, nome, palazzo_id, palazzi!inner(nome_identificativo)')
              .in('id', info.scalaIds)
              .order('nome'),
          );
          for (const s of scaleRighe) {
            const pNome = (s.palazzi as any)?.nome_identificativo ?? 'Palazzo';
            opzioni.push({
              id: `scala:${s.palazzo_id}:${s.id}`,
              tipo: 'SCALA',
              palazzoId: s.palazzo_id,
              scalaColonnaId: s.id,
              etichetta: `Palazzo ${pNome} · Scala ${s.nome}`,
              descrizione: `Visibile solo ai residenti di Scala ${s.nome}`,
            });
          }
        }
      } else {
        // Portiere o Admin: carica tutti i palazzi e le scale del condominio
        const palazziRighe = estraiDati(
          await db
            .from('palazzi')
            .select('id, nome_identificativo')
            .eq('condominio_id', condominioId)
            .order('nome_identificativo'),
        );
        const palazziMappa = new Map(palazziRighe.map((p) => [p.id, p.nome_identificativo]));

        for (const p of palazziRighe) {
          opzioni.push({
            id: `palazzo:${p.id}`,
            tipo: 'PALAZZO',
            palazzoId: p.id,
            scalaColonnaId: null,
            etichetta: `Palazzo ${p.nome_identificativo}`,
            descrizione: `Visibile ai residenti di Palazzo ${p.nome_identificativo}`,
          });
        }

        const palIds = palazziRighe.map((p) => p.id);
        if (palIds.length > 0) {
          const scaleRighe = estraiDati(
            await db
              .from('scale_colonne')
              .select('id, nome, palazzo_id')
              .in('palazzo_id', palIds)
              .order('nome'),
          );
          for (const s of scaleRighe) {
            const pNome = palazziMappa.get(s.palazzo_id) ?? 'Palazzo';
            opzioni.push({
              id: `scala:${s.palazzo_id}:${s.id}`,
              tipo: 'SCALA',
              palazzoId: s.palazzo_id,
              scalaColonnaId: s.id,
              etichetta: `Palazzo ${pNome} · Scala ${s.nome}`,
              descrizione: `Visibile solo ai residenti di Scala ${s.nome}`,
            });
          }
        }
      }

      return opzioni;
    },

    /** Segnalazioni visibili al condòmino nel condominio attivo (Area comune + proprio palazzo + propria scala). */
    async elencoSegnalazioniCondomino(
      userId: string,
      condominioId: string,
    ): Promise<SegnalazioneRiepilogo[]> {
      if (!userId || !condominioId) return [];
      const info = await unitaResidenteNelCondominio(userId, condominioId);

      const righe = estraiDati(
        await db
          .from('ticket_testata')
          .select(COLONNE_TICKET)
          .eq('condominio_id', condominioId)
          .order('created_at', { ascending: false }),
      ) as RigaTicket[];

      const visibili = filtraTicketVisibiliCondomino(
        righe.map((r) => ({
          riga: r,
          condominioId: r.condominio_id,
          segnalatoreId: r.segnalatore_id,
          palazzoId: r.palazzo_id,
          scalaColonnaId: r.scala_colonna_id,
          unitaId: r.unita_id,
          isAreaComune: r.is_area_comune,
        })),
        userId,
        condominioId,
        info.palazzoIds,
        info.scalaIds,
        info.unitaIds,
      ).map((v) => v.riga);

      return ordinaSegnalazioni(await arricchisci(visibili), 'data-desc');
    },

    /** Ticket visibili al portiere nel condominio attivo. */
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
          .order('created_at', { ascending: false }),
      ) as RigaTicket[];

      const visibili = filtraTicketVisibiliPortiere(
        righe.map((r) => ({
          riga: r,
          condominioId: r.condominio_id,
          segnalatoreId: r.segnalatore_id,
          palazzoId: r.palazzo_id,
          scalaColonnaId: r.scala_colonna_id,
          unitaId: r.unita_id,
          isAreaComune: r.is_area_comune,
        })),
        userId,
        condominioId,
      ).map((v) => v.riga);

      return ordinaSegnalazioni(await arricchisci(visibili), 'data-desc');
    },

    /**
     * Dettaglio di una segnalazione. Restituisce `null` se il ticket non esiste o
     * non è visibile nella modalità e condominio selezionati.
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
     * Crea una segnalazione su ambito condiviso (Condominio / Palazzo / Scala).
     * Non associa mai il ticket a una singola unità immobiliare 1-a-1 (`unita_id = null`).
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

      const ambitiDisponibili = await this.ambitiSelezionabili(userId, condominioId, modalita);
      const validazione = validaInputNuovaSegnalazione(input, ambitiDisponibili, modalita);
      if (!validazione.valido) {
        return { ok: false, errori: validazione.errori as Record<string, string> };
      }
      const dati = validazione.dati;
      const ticketId = crypto.randomUUID();

      const inserito = await db.from('ticket_testata').insert({
        id: ticketId,
        condominio_id: condominioId,
        palazzo_id: dati.palazzoId,
        scala_colonna_id: dati.scalaColonnaId,
        unita_id: null,
        segnalatore_id: userId,
        categoria_id: dati.categoriaId,
        titolo: dati.titolo,
        descrizione: dati.descrizione,
        is_area_comune: true,
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

    /** Aggiunge un messaggio di aggiornamento sul ticket visibile. */
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
