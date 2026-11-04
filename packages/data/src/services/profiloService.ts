import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import type { INotifica } from '@iocondo/shared-types';
import {
  risolviAssegnazioni,
  type CondominioBreve,
  type ProfiloUtente,
  type RigaRuolo,
} from '../profilo/profiloLogic.ts';

function unwrap<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error('Nessun dato restituito');
  return res.data as NonNullable<T>;
}

function unwrapMaybe<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> | null {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T> | null;
}

function assertOk(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

/**
 * Profilo dell'utente che ha fatto l'accesso: nome, flag super amministratore, ruoli e condomini.
 * Legge solo righe che la RLS già consente (proprie, o dei propri condomini): nessun filtro qui
 * sostituisce le policy.
 */
export function createProfiloService(db: TypedSupabaseClient) {
  return {
    async carica(userId: string, emailSessione: string | null): Promise<ProfiloUtente> {
      const utente = unwrapMaybe(await db.from('utenti').select('*').eq('id', userId).maybeSingle());
      const ruoli = unwrap(await db.from('ruoli_piattaforma').select('*'));
      const righe = unwrap(await db.from('utente_entita_ruolo').select('*').eq('utente_id', userId));

      const codiceDi = new Map(ruoli.map((r) => [r.id, r.codice]));
      const righeRuolo: RigaRuolo[] = righe.flatMap((r) => {
        const ruolo = codiceDi.get(r.ruolo_id);
        return ruolo ? [{ ruolo, condominioId: r.condominio_id, unitaId: r.unita_id }] : [];
      });

      // Ruoli legati solo a un'unità: il condominio si ricava da unità e palazzo.
      const condominioDiUnita: Record<string, string> = {};
      const unitaIds = [...new Set(righeRuolo.filter((r) => !r.condominioId && r.unitaId).map((r) => r.unitaId as string))];
      if (unitaIds.length > 0) {
        const unita = unwrap(await db.from('unita_immobiliari').select('id, palazzo_id').in('id', unitaIds));
        const palazzoIds = [...new Set(unita.map((u) => u.palazzo_id))];
        const palazzi = palazzoIds.length
          ? unwrap(await db.from('palazzi').select('id, condominio_id').in('id', palazzoIds))
          : [];
        const condominioDiPalazzo = new Map(palazzi.map((p) => [p.id, p.condominio_id]));
        for (const u of unita) {
          const condominio = condominioDiPalazzo.get(u.palazzo_id);
          if (condominio) condominioDiUnita[u.id] = condominio;
        }
      }

      // Condomini amministrati direttamente (admin_id): sono amministratore anche senza riga di ruolo.
      const amministrati = unwrap(await db.from('condomini').select('id').eq('admin_id', userId)).map((c) => c.id);
      const assegnazioni = risolviAssegnazioni(righeRuolo, condominioDiUnita, amministrati);

      const condominioIds = [...new Set(assegnazioni.map((a) => a.condominioId))];
      const condomini: CondominioBreve[] = condominioIds.length
        ? unwrap(
            await db.from('condomini').select('id, nome, indirizzo, citta').in('id', condominioIds).order('nome'),
          )
        : [];

      return {
        id: userId,
        email: utente?.email ?? emailSessione,
        nome: utente?.nome_cognome ?? null,
        telefono: utente?.telefono ?? null,
        avatarUrl: utente?.avatar_url ?? null,
        isSuperAdmin: utente?.is_superadmin ?? false,
        condomini,
        assegnazioni,
      };
    },

    /**
     * Notifiche dell'utente. Il filtro su `utente_id` è voluto: la policy lascia al super amministratore
     * la lettura di tutte le righe, ma qui servono solo le sue.
     */
    async listMieNotifiche(userId: string, limite = 30): Promise<INotifica[]> {
      return unwrap(
        await db
          .from('notifiche')
          .select('*')
          .eq('utente_id', userId)
          .order('created_at', { ascending: false })
          .limit(limite),
      );
    },

    async segnaMieNotificheLette(userId: string): Promise<void> {
      assertOk(await db.from('notifiche').update({ letta: true }).eq('utente_id', userId).eq('letta', false));
    },

    async segnaNotificaLetta(userId: string, id: string): Promise<void> {
      assertOk(await db.from('notifiche').update({ letta: true }).eq('utente_id', userId).eq('id', id));
    },

    /**
     * Aggiorna l'anagrafica personale dell'utente (nome_cognome, telefono).
     * Rispetta la RLS: l'utente aggiorna solo il proprio profilo.
     */
    async aggiornaAnagrafica(
      userId: string,
      dati: { nome_cognome: string; telefono: string | null },
    ): Promise<void> {
      assertOk(
        await db
          .from('utenti')
          .update({
            nome_cognome: dati.nome_cognome.trim(),
            telefono: dati.telefono?.trim() ? dati.telefono.trim() : null,
          })
          .eq('id', userId),
      );
    },

    /**
     * Aggiorna la password dell'utente tramite il client Auth.
     */
    async cambiaPassword(password: string): Promise<void> {
      const res = await db.auth.updateUser({ password });
      if (res.error) throw res.error;
    },
  };
}
export type ProfiloService = ReturnType<typeof createProfiloService>;
