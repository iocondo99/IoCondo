export interface DettagliUnitaUtente {
  unitaId: string;
  palazzo: string;
  scala?: string | null;
  interno: string;
  piano?: number | null;
  mq?: number | null;
  tipoPossesso?: string | null;
  quotaPossesso?: number | null;
  millesimi?: number | null;
}

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

    /**
     * Non lette dell'utente (le più recenti, al massimo `limite`) con il totale reale: il contatore della
     * campanella non si ferma al numero di righe caricate.
     */
    async listMieNonLette(userId: string, limite: number): Promise<{ righe: INotifica[]; totale: number }> {
      const res = await db
        .from('notifiche')
        .select('*', { count: 'exact' })
        .eq('utente_id', userId)
        .eq('letta', false)
        .order('created_at', { ascending: false })
        .limit(limite);
      if (res.error) throw new Error(res.error.message);
      const righe = (res.data ?? []) as INotifica[];
      return { righe, totale: res.count ?? righe.length };
    },

    /** Una pagina dell'archivio notifiche (pagina notifiche): tutte oppure solo le non lette. */
    async listMieNotifichePagina(
      userId: string,
      opzioni: { soloNonLette: boolean; da: number; limite: number },
    ): Promise<{ righe: INotifica[]; totale: number }> {
      let query = db
        .from('notifiche')
        .select('*', { count: 'exact' })
        .eq('utente_id', userId)
        .order('created_at', { ascending: false })
        .range(opzioni.da, opzioni.da + opzioni.limite - 1);
      if (opzioni.soloNonLette) query = query.eq('letta', false);
      const res = await query;
      if (res.error) throw new Error(res.error.message);
      const righe = (res.data ?? []) as INotifica[];
      return { righe, totale: res.count ?? righe.length };
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
        /**
     * Dati delle unità immobiliari dell'utente nel condominio selezionato (palazzina, interno, piano, millesimi).
     */
    async caricaUnitaCondominio(userId: string, condominioId: string): Promise<DettagliUnitaUtente[]> {
      const oggi = new Date().toISOString().slice(0, 10);
      try {
        const [anagraficheRes, ruoliRes, palazziRes] = await Promise.all([
          db
            .from('anagrafiche_unita')
            .select('unita_id, tipo_possesso, quota_possesso')
            .eq('utente_id', userId)
            .or(`data_fine.is.null,data_fine.gte.${oggi}`),
          db
            .from('utente_entita_ruolo')
            .select('unita_id')
            .eq('utente_id', userId)
            .eq('condominio_id', condominioId)
            .not('unita_id', 'is', null),
          db.from('palazzi').select('id, nome_identificativo').eq('condominio_id', condominioId),
        ]);

        const anagrafiche = unwrapMaybe(anagraficheRes) ?? [];
        const ruoli = unwrapMaybe(ruoliRes) ?? [];
        const palazzi = unwrapMaybe(palazziRes) ?? [];
        const palazziMap = new Map(palazzi.map((p) => [p.id, p.nome_identificativo]));

        const candidateIds = new Set<string>();
        for (const a of anagrafiche) candidateIds.add(a.unita_id);
        for (const r of ruoli) if (r.unita_id) candidateIds.add(r.unita_id);

        if (candidateIds.size === 0 || palazzi.length === 0) return [];

        const unitaRes = await db
          .from('unita_immobiliari')
          .select('id, palazzo_id, scala_colonna_id, interno, piano, mq')
          .in('id', [...candidateIds])
          .in('palazzo_id', [...palazziMap.keys()]);

        const unitaList = unwrapMaybe(unitaRes) ?? [];
        if (unitaList.length === 0) return [];

        const unitaIds = unitaList.map((u) => u.id);

        const [scaleRes, quoteRes] = await Promise.all([
          db.from('scale_colonne').select('id, nome').in('palazzo_id', [...palazziMap.keys()]),
          db.from('quote_millesimali').select('unita_id, valore_millesimale').in('unita_id', unitaIds),
        ]);

        const scaleMap = new Map((unwrapMaybe(scaleRes) ?? []).map((s) => [s.id, s.nome]));
        const quoteMap = new Map<string, number>();
        for (const q of unwrapMaybe(quoteRes) ?? []) {
          const val = Number(q.valore_millesimale) || 0;
          if (!quoteMap.has(q.unita_id) || val > (quoteMap.get(q.unita_id) ?? 0)) {
            quoteMap.set(q.unita_id, val);
          }
        }

        const anagraficaMap = new Map(anagrafiche.map((a) => [a.unita_id, a]));

        return unitaList.map((u) => {
          const anag = anagraficaMap.get(u.id);
          return {
            unitaId: u.id,
            palazzo: palazziMap.get(u.palazzo_id) || 'Palazzina',
            scala: u.scala_colonna_id ? scaleMap.get(u.scala_colonna_id) ?? null : null,
            interno: u.interno,
            piano: u.piano,
            mq: u.mq ? Number(u.mq) : null,
            tipoPossesso: anag?.tipo_possesso ?? 'PROPRIETARIO',
            quotaPossesso: anag?.quota_possesso ? Number(anag.quota_possesso) : 100,
            millesimi: quoteMap.get(u.id) ?? null,
          };
        });
      } catch {
        return [];
      }
    },

    async cambiaPassword(password: string): Promise<void> {
      const res = await db.auth.updateUser({ password });
      if (res.error) throw res.error;
    },
  };
}
export type ProfiloService = ReturnType<typeof createProfiloService>;
