import { assertOk, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import type { TablesInsert, TablesUpdate } from '@iocondo/shared-types';
import {
  formattaDataItaliana,
  trasformaComunicazioneRawInView,
  type CommentoPostAdminView,
  type ComunicazioneAdminRaw,
  type ComunicazioneAdminView,
  type ModificaComunicazioneAdminInput,
  type NuovaComunicazioneAdminInput,
} from './comunicazioniAdminLogic';

export interface OpzionePalazzoComunicazione {
  id: string;
  nome: string;
}

/**
 * Servizio per la gestione della Bacheca e Comunicazioni lato Amministratore (Passo 4).
 * Permette pubblicazione, modifica, toggle pin, cancellazione post e moderazione commenti.
 */
export function createComunicazioniAdminService(db: TypedSupabaseClient) {
  return {
    /**
     * Lettura comunicazioni del condominio attivo con conteggio commenti aggregati e join su palazzi.
     */
    async list(condominioId: string): Promise<ComunicazioneAdminView[]> {
      const res = unwrap(
        await db
          .from('bacheca_post')
          .select(`
            id,
            condominio_id,
            palazzo_id,
            autore_id,
            titolo,
            corpo,
            is_pinned,
            data_pubblicazione,
            updated_at,
            palazzi:palazzo_id (
              id,
              nome_identificativo
            ),
            bacheca_commenti (
              id
            )
          `)
          .eq('condominio_id', condominioId)
          .order('is_pinned', { ascending: false })
          .order('data_pubblicazione', { ascending: false }),
      );

      const righe = (res as unknown as ComunicazioneAdminRaw[]) ?? [];
      return righe.map(trasformaComunicazioneRawInView);
    },

    /**
     * Elenco palazzi del condominio per selettore destinatari e filtri.
     */
    async listPalazzi(condominioId: string): Promise<OpzionePalazzoComunicazione[]> {
      const palazzi = unwrap(
        await db
          .from('palazzi')
          .select('id, nome_identificativo')
          .eq('condominio_id', condominioId)
          .order('nome_identificativo'),
      );

      return palazzi.map((p) => ({
        id: p.id,
        nome: p.nome_identificativo,
      }));
    },

    /**
     * Creazione nuova comunicazione su `bacheca_post` e generazione automatica
     * delle notifiche per i condòmini destinatari.
     */
    async create(input: NuovaComunicazioneAdminInput): Promise<{ id: string }> {
      const payload: TablesInsert<'bacheca_post'> = {
        condominio_id: input.condominioId,
        palazzo_id: input.palazzoId || null,
        autore_id: input.autoreId || null,
        titolo: input.titolo.trim(),
        corpo: input.corpo?.trim() || null,
        is_pinned: Boolean(input.isPinned),
        data_pubblicazione: new Date().toISOString(),
      };

      const creato = unwrap(
        await db.from('bacheca_post').insert(payload).select('id').single(),
      );
      const postId = creato.id;

      // Generazione notifiche per i condòmini destinatari
      try {
        await generaNotificheDestinatari(db, {
          condominioId: input.condominioId,
          palazzoId: input.palazzoId || null,
          postId,
          titolo: input.titolo.trim(),
          autoreId: input.autoreId || null,
        });
      } catch (err) {
        console.warn('Avviso: generazione notifiche condòmini completata con eccezione non bloccante:', err);
      }

      return { id: postId };
    },

    /**
     * Modifica comunicazione esistente (titolo, corpo, palazzo_id, is_pinned).
     */
    async update(input: ModificaComunicazioneAdminInput): Promise<void> {
      const payload: TablesUpdate<'bacheca_post'> = {
        titolo: input.titolo.trim(),
        corpo: input.corpo?.trim() || null,
        palazzo_id: input.palazzoId || null,
        is_pinned: Boolean(input.isPinned),
        updated_at: new Date().toISOString(),
      };

      assertOk(await db.from('bacheca_post').update(payload).eq('id', input.id));
    },

    /**
     * Toggle rapido dello stato "In evidenza" (`is_pinned`).
     */
    async togglePin(id: string, isPinned: boolean): Promise<void> {
      assertOk(
        await db
          .from('bacheca_post')
          .update({
            is_pinned: isPinned,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id),
      );
    },

    /**
     * Eliminazione comunicazione (cancella a cascata i commenti associati via FK).
     */
    async delete(id: string): Promise<void> {
      assertOk(await db.from('bacheca_post').delete().eq('id', id));
    },

    /**
     * Lettura commenti di un post per la modale di moderazione.
     */
    async listCommenti(postId: string): Promise<CommentoPostAdminView[]> {
      const commentiRaw = unwrap(
        await db
          .from('bacheca_commenti')
          .select(`
            id,
            post_id,
            autore_id,
            commento,
            created_at
          `)
          .eq('post_id', postId)
          .order('created_at', { ascending: true }),
      );

      if (commentiRaw.length === 0) return [];

      const autoreIds = [...new Set(commentiRaw.flatMap((c) => (c.autore_id ? [c.autore_id] : [])))];
      const nomiAutori = new Map<string, string>();

      if (autoreIds.length > 0) {
        const { data: profili } = await db
          .from('profili_pubblici')
          .select('id, nome_cognome')
          .in('id', autoreIds);

        if (profili) {
          for (const p of profili) {
            if (p.id && p.nome_cognome) nomiAutori.set(p.id, p.nome_cognome);
          }
        }
      }

      return commentiRaw.map((c) => ({
        id: c.id,
        postId: c.post_id,
        autoreId: c.autore_id,
        autoreNome: (c.autore_id && nomiAutori.get(c.autore_id)) || 'Condòmino residente',
        commento: c.commento,
        createdAt: c.created_at,
        createdAtFormatted: formattaDataItaliana(c.created_at),
      }));
    },

    /**
     * Eliminazione di un singolo commento (moderazione amministrativa).
     */
    async deleteCommento(commentoId: string): Promise<void> {
      assertOk(await db.from('bacheca_commenti').delete().eq('id', commentoId));
    },
  };
}

export type ComunicazioniAdminService = ReturnType<typeof createComunicazioniAdminService>;

/**
 * Individua gli utenti destinatari e genera le righe in `notifiche`.
 */
async function generaNotificheDestinatari(
  db: TypedSupabaseClient,
  params: {
    condominioId: string;
    palazzoId: string | null;
    postId: string;
    titolo: string;
    autoreId: string | null;
  },
): Promise<void> {
  const destinatariSet = new Set<string>();

  if (params.palazzoId) {
    // Destinatari del singolo palazzo
    const { data: unita } = await db
      .from('unita_immobiliari')
      .select('id')
      .eq('palazzo_id', params.palazzoId);

    const unitaIds = (unita ?? []).map((u) => u.id);

    if (unitaIds.length > 0) {
      const [anagraficheRes, ruoliRes] = await Promise.all([
        db.from('anagrafiche_unita').select('utente_id').in('unita_id', unitaIds),
        db.from('utente_entita_ruolo').select('utente_id').in('unita_id', unitaIds),
      ]);

      for (const r of anagraficheRes.data ?? []) {
        if (r.utente_id) destinatariSet.add(r.utente_id);
      }
      for (const r of ruoliRes.data ?? []) {
        if (r.utente_id) destinatariSet.add(r.utente_id);
      }
    }
  } else {
    // Destinatari dell'intero condominio
    const [ruoliCondominioRes, palazziCondominioRes] = await Promise.all([
      db.from('utente_entita_ruolo').select('utente_id').eq('condominio_id', params.condominioId),
      db.from('palazzi').select('id').eq('condominio_id', params.condominioId),
    ]);

    for (const r of ruoliCondominioRes.data ?? []) {
      if (r.utente_id) destinatariSet.add(r.utente_id);
    }

    const palazziIds = (palazziCondominioRes.data ?? []).map((p) => p.id);
    if (palazziIds.length > 0) {
      const { data: unita } = await db
        .from('unita_immobiliari')
        .select('id')
        .in('palazzo_id', palazziIds);

      const unitaIds = (unita ?? []).map((u) => u.id);
      if (unitaIds.length > 0) {
        const { data: anagrafiche } = await db
          .from('anagrafiche_unita')
          .select('utente_id')
          .in('unita_id', unitaIds);

        for (const a of anagrafiche ?? []) {
          if (a.utente_id) destinatariSet.add(a.utente_id);
        }
      }
    }
  }

  // Escludi l'autore per non inviargli la notifica
  if (params.autoreId) {
    destinatariSet.delete(params.autoreId);
  }

  const ids = [...destinatariSet];
  if (ids.length === 0) return;

  const notificheDaInserire = ids.map((utenteId) => ({
    utente_id: utenteId,
    condominio_id: params.condominioId,
    titolo: 'Nuova comunicazione in bacheca',
    corpo: params.titolo,
    tipo: 'COMUNICAZIONE',
    riferimento_tabella: 'bacheca_post',
    riferimento_id: params.postId,
    letta: false,
  }));

  await db.from('notifiche').insert(notificheDaInserire);
}

