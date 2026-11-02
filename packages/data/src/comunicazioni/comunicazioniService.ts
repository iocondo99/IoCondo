/**
 * Servizio della pagina Comunicazioni del condòmino: elenco, dettaglio e stato di lettura.
 * Solo chiave pubblica + RLS: mai service_role.
 *
 * Il condòmino LEGGE soltanto: questo servizio non espone alcun metodo di creazione, modifica
 * o eliminazione di post della bacheca.
 *
 * Le RLS su `bacheca_post` permettono di leggere i post dei condomini a cui si ha accesso;
 * qui restringiamo ulteriormente al condominio selezionato, ai palazzi dell'utente (o `palazzo_id IS NULL`)
 * e ai post già pubblicati (`data_pubblicazione <= now()`).
 * Lo stato letto/non letto proviene solo dalle notifiche dell'utente corrente (`utente_id = userId`,
 * `riferimento_tabella = 'bacheca_post'`, `riferimento_id = post.id`): se non esiste una notifica
 * collegata per l'utente, lo stato resta `'nessuna'` senza inventare `'letta'`.
 */
import { assertOk, unwrap, unwrapMaybe, type TypedSupabaseClient } from '@iocondo/supabase-client';
import { filtroNulloOppureIn, oggiIso } from '../home/homeLogic';
import {
  comunicazioneVisibileA,
  mappaStatoLettura,
  statoLetturaDaNotifiche,
  type ComunicazioneRiga,
  type DettaglioComunicazione,
} from './comunicazioniLogic';

export function createComunicazioniService(db: TypedSupabaseClient) {
  /** Palazzi a cui appartengono le unità dell'utente nel condominio selezionato. */
  async function palazziDelCondomino(userId: string, condominioId: string): Promise<string[]> {
    const oggi = oggiIso();
    const [anagrafiche, ruoli, palazziCondominio] = await Promise.all([
      db
        .from('anagrafiche_unita')
        .select('unita_id')
        .eq('utente_id', userId)
        .or(`data_fine.is.null,data_fine.gte.${oggi}`),
      db.from('utente_entita_ruolo').select('unita_id').eq('utente_id', userId).not('unita_id', 'is', null),
      db.from('palazzi').select('id').eq('condominio_id', condominioId),
    ]);

    const unitaCandidate = new Set<string>();
    for (const r of unwrap(anagrafiche)) unitaCandidate.add(r.unita_id);
    for (const r of unwrap(ruoli)) if (r.unita_id) unitaCandidate.add(r.unita_id);
    const palazziIds = unwrap(palazziCondominio).map((p) => p.id);
    if (unitaCandidate.size === 0 || palazziIds.length === 0) return [];

    const unita = unwrap(
      await db
        .from('unita_immobiliari')
        .select('palazzo_id')
        .in('id', [...unitaCandidate])
        .in('palazzo_id', palazziIds),
    );
    return [...new Set(unita.map((u) => u.palazzo_id))];
  }

  return {
    /**
     * Comunicazioni pubblicate del condominio selezionato visibili all'utente (generali del condominio
     * o specifiche dei suoi palazzi), arricchite con il nome dell'autore e lo stato di lettura.
     */
    async listMie(userId: string, condominioId: string): Promise<ComunicazioneRiga[]> {
      const palazzi = await palazziDelCondomino(userId, condominioId);
      const visibili = filtroNulloOppureIn('palazzo_id', palazzi);
      const adesso = new Date().toISOString();

      const righePost = unwrap(
        await db
          .from('bacheca_post')
          .select('id, condominio_id, palazzo_id, autore_id, titolo, corpo, is_pinned, data_pubblicazione')
          .eq('condominio_id', condominioId)
          .or(visibili)
          .lte('data_pubblicazione', adesso)
          .order('is_pinned', { ascending: false })
          .order('data_pubblicazione', { ascending: false }),
      );

      const postVisibili = righePost.filter((p) => comunicazioneVisibileA(p, condominioId, palazzi, adesso));
      if (postVisibili.length === 0) return [];

      const postIds = postVisibili.map((p) => p.id);
      const autoreIds = [...new Set(postVisibili.flatMap((p) => (p.autore_id ? [p.autore_id] : [])))];

      const [autoriRisposta, notificheRisposta] = await Promise.all([
        autoreIds.length > 0
          ? db.from('profili_pubblici').select('id, nome_cognome').in('id', autoreIds)
          : Promise.resolve({ data: [] as { id: string | null; nome_cognome: string | null }[], error: null }),
        db
          .from('notifiche')
          .select('riferimento_id, letta')
          .eq('utente_id', userId)
          .eq('riferimento_tabella', 'bacheca_post')
          .in('riferimento_id', postIds),
      ]);

      const autori = new Map<string, string | null>();
      for (const a of unwrap(autoriRisposta)) {
        if (a.id) autori.set(a.id, a.nome_cognome ?? null);
      }
      const statiLettura = mappaStatoLettura(unwrap(notificheRisposta));

      return postVisibili.map((p) => ({
        id: p.id,
        titolo: p.titolo,
        corpo: p.corpo,
        dataPubblicazione: p.data_pubblicazione,
        fissato: Boolean(p.is_pinned),
        autoreNome: p.autore_id ? (autori.get(p.autore_id) ?? null) : null,
        statoLettura: statiLettura.get(p.id) ?? 'nessuna',
      }));
    },

    /**
     * Dettaglio di una comunicazione. Restituisce `null` in ogni caso non autorizzato
     * (id inesistente, post di un altro condominio, post di un altro palazzo, data futura):
     * la schermata mostra lo stesso stato `NonAutorizzato` senza rivelare nulla.
     */
    async getDettaglio(postId: string, userId: string, condominioId: string): Promise<DettaglioComunicazione | null> {
      const post = unwrapMaybe(
        await db
          .from('bacheca_post')
          .select('id, condominio_id, palazzo_id, autore_id, titolo, corpo, is_pinned, data_pubblicazione')
          .eq('id', postId)
          .maybeSingle(),
      );
      if (!post) return null;

      const palazzi = await palazziDelCondomino(userId, condominioId);
      const adesso = new Date().toISOString();
      if (!comunicazioneVisibileA(post, condominioId, palazzi, adesso)) {
        return null;
      }

      const [autoreRisposta, notificheRisposta, palazzoRisposta] = await Promise.all([
        post.autore_id
          ? db.from('profili_pubblici').select('id, nome_cognome').eq('id', post.autore_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        db
          .from('notifiche')
          .select('letta')
          .eq('utente_id', userId)
          .eq('riferimento_tabella', 'bacheca_post')
          .eq('riferimento_id', post.id),
        post.palazzo_id
          ? db
              .from('palazzi')
              .select('nome_identificativo')
              .eq('id', post.palazzo_id)
              .eq('condominio_id', condominioId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const autore = unwrapMaybe(autoreRisposta);
      const palazzo = unwrapMaybe(palazzoRisposta);
      const statoLettura = statoLetturaDaNotifiche(unwrap(notificheRisposta));

      return {
        id: post.id,
        titolo: post.titolo,
        corpo: post.corpo,
        dataPubblicazione: post.data_pubblicazione,
        fissato: Boolean(post.is_pinned),
        autoreNome: autore?.nome_cognome ?? null,
        statoLettura,
        palazzoNome: palazzo?.nome_identificativo ?? null,
      };
    },

    /**
     * Segna come letta la notifica collegata al post SOLO per l'utente corrente.
     * Se non esiste una notifica non letta per quel post e utente, l'UPDATE aggiorna 0 righe senza errori.
     */
    async segnaComeLetta(postId: string, userId: string): Promise<void> {
      assertOk(
        await db
          .from('notifiche')
          .update({ letta: true })
          .eq('utente_id', userId)
          .eq('riferimento_tabella', 'bacheca_post')
          .eq('riferimento_id', postId)
          .eq('letta', false),
      );
    },
  };
}

export type ComunicazioniService = ReturnType<typeof createComunicazioniService>;

