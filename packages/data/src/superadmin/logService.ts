import type { TypedSupabaseClient } from '@iocondo/supabase-client';

export type TipoRegistro = 'audit' | 'sicurezza' | 'errori';

export interface FiltriLog {
  /** ISO, inclusivo. */
  dal?: string | null;
  /** ISO, esclusivo. */
  al?: string | null;
  condominioId?: string | null;
  /** Azione (audit), evento (sicurezza) o contesto (errori). Corrispondenza parziale. */
  azione?: string | null;
  /** audit: tabella; sicurezza: esito; errori: origine o livello. */
  categoria?: string | null;
  utenteId?: string | null;
}

export interface RigaLog {
  id: string;
  quando: string;
  registro: TipoRegistro;
  azione: string;
  categoria: string | null;
  esito: string | null;
  utenteId: string | null;
  utenteNome: string | null;
  condominioId: string | null;
  condominioNome: string | null;
  oggetto: string | null;
  messaggio: string | null;
  prima: Record<string, unknown> | null;
  dopo: Record<string, unknown> | null;
  dettagli: Record<string, unknown> | null;
  ip: string | null;
}

export interface PaginaLog {
  righe: RigaLog[];
  totale: number;
}

export interface ProblemaIntegrita {
  id: string;
  created_at: string;
  problema: string;
}

const CONFIG = {
  audit: {
    tabella: 'audit_logs',
    data: 'timestamp',
    azione: 'azione',
    categoria: 'tabella',
  },
  sicurezza: {
    tabella: 'log_sicurezza',
    data: 'created_at',
    azione: 'evento',
    categoria: 'esito',
  },
  errori: {
    tabella: 'log_errori',
    data: 'created_at',
    azione: 'contesto',
    categoria: 'origine',
  },
} as const;

/** Escape per i filtri ilike di PostgREST. */
function cercaParziale(testo: string): string {
  return `%${testo.replace(/[%_,()]/g, ' ').trim()}%`;
}

/**
 * Consultazione dei registri (solo super amministratore: lo garantisce la RLS degli script 19).
 * Filtri e paginazione sul database, nomi di utenti e condomini risolti in un secondo passaggio.
 */
export function createLogService(db: TypedSupabaseClient) {
  async function arricchisci(righe: RigaLog[]): Promise<RigaLog[]> {
    const utenti = [...new Set(righe.map((r) => r.utenteId).filter(Boolean))] as string[];
    const condomini = [...new Set(righe.map((r) => r.condominioId).filter(Boolean))] as string[];
    const [u, c] = await Promise.all([
      utenti.length
        ? (db as any).from('utenti').select('id, nome_cognome, email').in('id', utenti)
        : Promise.resolve({ data: [] }),
      condomini.length
        ? (db as any).from('condomini').select('id, nome').in('id', condomini)
        : Promise.resolve({ data: [] }),
    ]);
    const nomeUtente = new Map<string, string>(
      (u.data ?? []).map((x: any) => [x.id, x.nome_cognome || x.email || 'Utente']),
    );
    const nomeCond = new Map<string, string>((c.data ?? []).map((x: any) => [x.id, x.nome]));
    return righe.map((r) => ({
      ...r,
      utenteNome: r.utenteId ? (nomeUtente.get(r.utenteId) ?? 'Account eliminato') : null,
      condominioNome: r.condominioId ? (nomeCond.get(r.condominioId) ?? null) : null,
    }));
  }

  function mappa(registro: TipoRegistro, x: any): RigaLog {
    if (registro === 'audit') {
      return {
        id: x.id, quando: x.timestamp, registro, azione: x.azione, categoria: x.tabella ?? null,
        esito: null, utenteId: x.utente_id ?? null, utenteNome: null,
        condominioId: x.condominio_id ?? null, condominioNome: null,
        oggetto: x.tabella ? `${x.tabella}${x.record_id ? ` · ${String(x.record_id).slice(0, 8)}` : ''}` : null,
        messaggio: x.motivo ?? null, prima: x.valore_prima ?? null, dopo: x.valore_dopo ?? null,
        dettagli: x.origine ? { origine: x.origine } : null, ip: x.ip_address ?? null,
      };
    }
    if (registro === 'sicurezza') {
      return {
        id: x.id, quando: x.created_at, registro, azione: x.evento, categoria: x.esito,
        esito: x.esito, utenteId: x.utente_id ?? null, utenteNome: null,
        condominioId: x.condominio_id ?? null, condominioNome: null, oggetto: null,
        messaggio: null, prima: null, dopo: null, dettagli: x.dettagli ?? null, ip: x.ip_address ?? null,
      };
    }
    return {
      id: x.id, quando: x.created_at, registro, azione: x.contesto ?? 'sconosciuto',
      categoria: `${x.origine} · ${x.livello}`, esito: x.livello, utenteId: x.utente_id ?? null, utenteNome: null,
      condominioId: x.condominio_id ?? null, condominioNome: null,
      oggetto: x.codice ? `Codice ${x.codice}` : null, messaggio: x.messaggio, prima: null, dopo: null,
      dettagli: { ...(x.dettagli ?? {}), versione: x.versione_app, piattaforma: x.piattaforma }, ip: null,
    };
  }

  return {
    async elenca(
      registro: TipoRegistro,
      filtri: FiltriLog,
      pagina = 1,
      perPagina = 50,
    ): Promise<PaginaLog> {
      const cfg = CONFIG[registro];
      let q = (db as any).from(cfg.tabella).select('*', { count: 'exact' });
      if (filtri.dal) q = q.gte(cfg.data, filtri.dal);
      if (filtri.al) q = q.lt(cfg.data, filtri.al);
      if (filtri.condominioId) q = q.eq('condominio_id', filtri.condominioId);
      if (filtri.utenteId) q = q.eq('utente_id', filtri.utenteId);
      if (filtri.azione?.trim()) q = q.ilike(cfg.azione, cercaParziale(filtri.azione));
      if (filtri.categoria) {
        if (registro === 'errori' && (filtri.categoria === 'ERROR' || filtri.categoria === 'WARNING')) {
          q = q.eq('livello', filtri.categoria);
        } else {
          q = q.eq(cfg.categoria, filtri.categoria);
        }
      }
      const da = (Math.max(1, pagina) - 1) * perPagina;
      const { data, error, count } = await q
        .order(cfg.data, { ascending: false })
        .order('id', { ascending: false })
        .range(da, da + perPagina - 1);
      if (error) throw new Error(error.message);
      const righe = await arricchisci((data ?? []).map((x: any) => mappa(registro, x)));
      return { righe, totale: count ?? righe.length };
    },

    /** Valori distinti per i filtri a scelta (azioni, tabelle, eventi) degli ultimi 500 record. */
    async valoriFiltro(registro: TipoRegistro): Promise<{ azioni: string[]; categorie: string[] }> {
      const cfg = CONFIG[registro];
      const { data } = await (db as any)
        .from(cfg.tabella)
        .select(`${cfg.azione}, ${cfg.categoria}`)
        .order(cfg.data, { ascending: false })
        .limit(500);
      const azioni = [...new Set((data ?? []).map((x: any) => x[cfg.azione]).filter(Boolean))].sort() as string[];
      const categorie = [...new Set((data ?? []).map((x: any) => x[cfg.categoria]).filter(Boolean))].sort() as string[];
      return { azioni, categorie };
    },

    /** Condomini per il filtro. */
    async condomini(): Promise<Array<{ id: string; nome: string }>> {
      const { data } = await (db as any).from('condomini').select('id, nome').order('nome');
      return data ?? [];
    },

    /** Verifica della catena di integrita' del registro di sicurezza. */
    async verificaIntegrita(): Promise<ProblemaIntegrita[]> {
      const { data, error } = await (db as any).rpc('verifica_log_sicurezza');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  };
}

export type LogService = ReturnType<typeof createLogService>;
