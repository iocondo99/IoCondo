import { assertOk, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  filtroNulloOppureIn,
  oggiIso,
  type AssembleaHome,
  type ComunicazioneHome,
  type RataHome,
} from '../home/homeLogic';

/** Quante notifiche non lette si controllano per contare le comunicazioni da leggere. */
const MAX_NON_LETTE = 100;

/**
 * Letture della Home del condòmino. Passano dalla chiave pubblica e dalle RLS, ma le RLS lasciano a un
 * amministratore (o super amministratore) più righe di quelle di un residente: per questo ogni query
 * restringe comunque a utente, unità e condominio scelti. Nessun filtro qui sostituisce le policy.
 */
export function createHomeService(db: TypedSupabaseClient) {
  /** Unità del residente: anagrafica attiva o ruolo legato all'unità. */
  async function unitaDi(userId: string): Promise<string[]> {
    const [anagrafiche, ruoli] = await Promise.all([
      db
        .from('anagrafiche_unita')
        .select('unita_id')
        .eq('utente_id', userId)
        .or(`data_fine.is.null,data_fine.gte.${oggiIso()}`),
      db.from('utente_entita_ruolo').select('unita_id').eq('utente_id', userId).not('unita_id', 'is', null),
    ]);
    const ids = new Set<string>();
    for (const r of unwrap(anagrafiche)) ids.add(r.unita_id);
    for (const r of unwrap(ruoli)) if (r.unita_id) ids.add(r.unita_id);
    return [...ids];
  }

  return {
    /**
     * Rate pubblicate del condominio di cui l'utente è debitore (`utente_id`), più quelle senza debitore
     * su una sua unità. Un amministratore che apre la Home da residente NON vede le rate degli altri.
     */
    async rateDelResidente(userId: string, condominioId: string): Promise<RataHome[]> {
      const esercizi = unwrap(await db.from('esercizi_contabili').select('id').eq('condominio_id', condominioId));
      if (esercizi.length === 0) return [];
      const testate = unwrap(
        await db
          .from('rate_testata')
          .select('id, descrizione, data_scadenza')
          .in('esercizio_id', esercizi.map((e) => e.id))
          .eq('pubblicata', true),
      );
      if (testate.length === 0) return [];

      const unita = await unitaDi(userId);
      const mie =
        unita.length > 0
          ? `utente_id.eq.${userId},and(utente_id.is.null,unita_id.in.(${unita.join(',')}))`
          : `utente_id.eq.${userId}`;
      const rate = unwrap(
        await db
          .from('rate_dettaglio')
          .select('id, rata_testata_id, importo_dovuto, importo_pagato, stato')
          .in('rata_testata_id', testate.map((t) => t.id))
          .or(mie),
      );

      const testataDi = new Map(testate.map((t) => [t.id, t]));
      return rate.flatMap((r) => {
        const testata = testataDi.get(r.rata_testata_id);
        if (!testata) return [];
        return [
          {
            id: r.id,
            descrizione: testata.descrizione,
            dataScadenza: testata.data_scadenza,
            importoDovuto: Number(r.importo_dovuto),
            importoPagato: Number(r.importo_pagato),
            stato: r.stato,
          },
        ];
      });
    },

    /**
     * Ultime comunicazioni della bacheca (di tutto il condominio o dei palazzi dell'utente) e quante sono
     * da leggere. Non esiste una tabella "letture": lo stato viene dalle notifiche dell'utente collegate al
     * post (`riferimento_tabella = 'bacheca_post'`, `letta = false`). Senza notifica la comunicazione non
     * porta alcun badge: non si inventa un "letto".
     */
    async ultimeComunicazioni(
      userId: string,
      condominioId: string,
      limite = 3,
    ): Promise<{ righe: ComunicazioneHome[]; nonLette: number }> {
      const unita = await unitaDi(userId);
      const palazzi =
        unita.length > 0
          ? [
              ...new Set(
                unwrap(await db.from('unita_immobiliari').select('palazzo_id').in('id', unita)).map((u) => u.palazzo_id),
              ),
            ]
          : [];
      const visibili = filtroNulloOppureIn('palazzo_id', palazzi);

      const nonLette = unwrap(
        await db
          .from('notifiche')
          .select('riferimento_id')
          .eq('utente_id', userId)
          .eq('condominio_id', condominioId)
          .eq('riferimento_tabella', 'bacheca_post')
          .eq('letta', false)
          .order('created_at', { ascending: false })
          .limit(MAX_NON_LETTE),
      );
      const idNonLette = [...new Set(nonLette.flatMap((n) => (n.riferimento_id ? [n.riferimento_id] : [])))];

      const [recenti, daLeggere] = await Promise.all([
        db
          .from('bacheca_post')
          .select('id, titolo, corpo, data_pubblicazione')
          .eq('condominio_id', condominioId)
          .or(visibili)
          .order('data_pubblicazione', { ascending: false })
          .limit(limite),
        // Conta solo i post che esistono ancora e che l'utente può vedere (la notifica può restare orfana).
        idNonLette.length > 0
          ? db.from('bacheca_post').select('id').eq('condominio_id', condominioId).or(visibili).in('id', idNonLette)
          : Promise.resolve({ data: [] as { id: string }[], error: null }),
      ]);
      const righe = unwrap(recenti);
      const nonLetti = new Set(unwrap(daLeggere).map((p) => p.id));
      return {
        righe: righe.map((p) => ({
          id: p.id,
          titolo: p.titolo,
          corpo: p.corpo,
          dataPubblicazione: p.data_pubblicazione,
          nonLetta: nonLetti.has(p.id),
        })),
        nonLette: nonLetti.size,
      };
    },

    /** Documenti che il residente può aprire: del condominio, senza unità o su una sua unità. */
    async contaDocumenti(userId: string, condominioId: string): Promise<number> {
      const cartelle = unwrap(await db.from('cartelle_documenti').select('id').eq('condominio_id', condominioId));
      if (cartelle.length === 0) return 0;
      const unita = await unitaDi(userId);
      const risposta = await db
        .from('documenti_metadata')
        .select('id', { count: 'exact', head: true })
        .in('cartella_id', cartelle.map((c) => c.id))
        .or(filtroNulloOppureIn('unita_id', unita));
      assertOk(risposta);
      return risposta.count ?? 0;
    },

    /** Prossima assemblea convocata (le bozze non si vedono, le concluse e le annullate neppure). */
    async prossimaAssemblea(condominioId: string): Promise<AssembleaHome | null> {
      const righe = unwrap(
        await db
          .from('assemblee_testata')
          .select('id, data, tipo, luogo')
          .eq('condominio_id', condominioId)
          .in('stato', ['CONVOCATA', 'IN_CORSO'])
          .gte('data', new Date().toISOString())
          .order('data', { ascending: true })
          .limit(1),
      );
      const prima = righe[0];
      return prima ? { id: prima.id, data: prima.data, tipo: prima.tipo, luogo: prima.luogo } : null;
    },
  };
}
export type HomeService = ReturnType<typeof createHomeService>;
