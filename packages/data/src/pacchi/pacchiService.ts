import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { oggiIso } from '../home/homeLogic.ts';
import {
  formattaEtichettaUnitaPacco,
  validaNuovoPacco,
  validaRegistrazioneRitiro,
  type Pacco,
  type StatoPacco,
  type UnitaCondominioOpzione,
} from './pacchiLogic.ts';

interface RigaPaccoDb {
  id: string;
  condominio_id: string;
  unita_destinazione_id: string;
  registrato_da: string | null;
  mittente_esterno: string | null;
  stato: StatoPacco;
  data_arrivo: string;
  data_ritiro: string | null;
  firma_ritiro: string | null;
  unita_immobiliari?: {
    id: string;
    interno: string;
    piano: number | null;
    palazzi?: {
      id: string;
      nome_identificativo: string;
    } | null;
  } | null;
  utenti?: {
    id: string;
    nome_cognome: string | null;
  } | null;
}

export interface OpzioniElencoPacchi {
  ruoli?: ReadonlySet<string> | readonly string[];
  isPortiereOAdmin?: boolean;
}

export interface InputRegistraPacco {
  condominioId: string;
  unitaId: string;
  mittenteEsterno?: string | null;
}

export type RisultatoRegistraPacco =
  | { ok: true; paccoId: string }
  | { ok: false; errori: Record<string, string> };

export type RisultatoRitiroPacco =
  | { ok: true }
  | { ok: false; errore: string };

/**
 * Servizio per il "Registro pacchi" (`/pacchi`, UC-07):
 * - Elenco pacchi del condominio con visibilità protetta:
 *   - Portiere o Amministratore: vedono tutti i pacchi del condominio;
 *   - Condòmino: vede esclusivamente i pacchi destinati alle proprie unità immobiliari attive;
 * - Registrazione arrivo nuovo pacco (solo portiere/admin);
 * - Registrazione ritiro pacco con firma/nome del ritirante (solo portiere/admin);
 * - Elenco delle unità del condominio per il modulo del portiere.
 */
export function createPacchiService(db: TypedSupabaseClient) {
  /**
   * Ricava gli ID delle unità attive del residente nel condominio selezionato.
   */
  async function unitaIdsDiResidente(userId: string, condominioId: string): Promise<string[]> {
    const [anagrafiche, ruoli, palazzi] = await Promise.all([
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
      db
        .from('palazzi')
        .select('id')
        .eq('condominio_id', condominioId),
    ]);

    const rawIds = new Set<string>();
    const anagraficheData = (anagrafiche.data ?? []) as Array<{ unita_id: string | null }>;
    const ruoliData = (ruoli.data ?? []) as Array<{ unita_id: string | null }>;
    for (const r of anagraficheData) if (r.unita_id) rawIds.add(r.unita_id);
    for (const r of ruoliData) if (r.unita_id) rawIds.add(r.unita_id);

    if (rawIds.size === 0) return [];

    const palazziData = (palazzi.data ?? []) as Array<{ id: string }>;
    const palazziCondominio = new Set(palazziData.map((p) => p.id));

    const unita = await db
      .from('unita_immobiliari')
      .select('id, palazzo_id')
      .in('id', [...rawIds]);

    const unitaData = (unita.data ?? []) as Array<{ id: string; palazzo_id: string }>;
    return unitaData
      .filter((u) => palazziCondominio.has(u.palazzo_id))
      .map((u) => u.id);
  }

  /**
   * Verifica se l'utente ha privilegi di gestione (PORTIERE o ADMIN) nel condominio.
   */
  async function verificaSePortiereOAdmin(
    userId: string,
    condominioId: string,
    opzioni?: OpzioniElencoPacchi,
  ): Promise<boolean> {
    if (opzioni?.isPortiereOAdmin !== undefined) {
      return opzioni.isPortiereOAdmin;
    }

    if (opzioni?.ruoli) {
      const setRoles = new Set(opzioni.ruoli);
      if (setRoles.has('PORTIERE') || setRoles.has('ADMIN')) {
        return true;
      }
    }

    const [ruoliRes, ruoliPiattaformaRes, condRes] = await Promise.all([
      db
        .from('utente_entita_ruolo')
        .select('ruolo_id, condominio_id')
        .eq('utente_id', userId),
      db
        .from('ruoli_piattaforma')
        .select('id, codice'),
      db
        .from('condomini')
        .select('admin_id')
        .eq('id', condominioId)
        .maybeSingle(),
    ]);

    const adminId = (condRes.data as { admin_id?: string } | null)?.admin_id;
    if (adminId && adminId === userId) {
      return true;
    }

    const mappaCodici = new Map<string, string>();
    for (const rp of (ruoliPiattaformaRes.data ?? []) as Array<{ id: string; codice: string }>) {
      mappaCodici.set(rp.id, rp.codice);
    }

    const ruoliRows = (ruoliRes.data ?? []) as Array<{
      ruolo_id: string;
      condominio_id: string | null;
    }>;

    return ruoliRows.some((r) => {
      const cid = r.condominio_id;
      const cod = mappaCodici.get(r.ruolo_id);
      const matchCondo = cid === condominioId || !cid;
      return matchCondo && (cod === 'PORTIERE' || cod === 'ADMIN');
    });
  }

  /**
   * Elenco pacchi del condominio:
   * - Portiere / Admin: visualizza tutti i pacchi del condominio.
   * - Condòmino: visualizza solo i pacchi destinati alle proprie unità immobiliari attive.
   */
  async function elencoPacchi(
    condominioId: string,
    userId: string,
    opzioni?: OpzioniElencoPacchi,
  ): Promise<Pacco[]> {
    const isPortiereOAdmin = await verificaSePortiereOAdmin(userId, condominioId, opzioni);

    let unitaFiltro: string[] | null = null;
    if (!isPortiereOAdmin) {
      unitaFiltro = await unitaIdsDiResidente(userId, condominioId);
      if (unitaFiltro.length === 0) {
        return [];
      }
    }

    let query = db
      .from('registro_pacchi')
      .select(`
        id,
        condominio_id,
        unita_destinazione_id,
        registrato_da,
        mittente_esterno,
        stato,
        data_arrivo,
        data_ritiro,
        firma_ritiro,
        unita_immobiliari (
          id,
          interno,
          piano,
          palazzi (
            id,
            nome_identificativo
          )
        ),
        utenti!registrato_da (
          id,
          nome_cognome
        )
      `)
      .eq('condominio_id', condominioId)
      .order('data_arrivo', { ascending: false });

    if (unitaFiltro !== null) {
      query = query.in('unita_destinazione_id', unitaFiltro);
    }

    const { data, error } = await query;
    if (error) {
      // Se la join annidata fallisce per RLS o alias, esegui la query semplice e arricchisci
      let queryFallback = db
        .from('registro_pacchi')
        .select('id, condominio_id, unita_destinazione_id, registrato_da, mittente_esterno, stato, data_arrivo, data_ritiro, firma_ritiro')
        .eq('condominio_id', condominioId)
        .order('data_arrivo', { ascending: false });

      if (unitaFiltro !== null) {
        queryFallback = queryFallback.in('unita_destinazione_id', unitaFiltro);
      }

      const fallbackRes = await queryFallback;
      if (fallbackRes.error) throw fallbackRes.error;
      const righeFallback = (fallbackRes.data ?? []) as unknown as RigaPaccoDb[];

      return arricchisciRighePacchi(righeFallback, condominioId);
    }

    const righe = (data ?? []) as unknown as RigaPaccoDb[];
    return arricchisciRighePacchi(righe, condominioId);
  }

  /**
   * Arricchisce le righe con nomi unità e nomi dei registratori.
   */
  async function arricchisciRighePacchi(
    righe: readonly RigaPaccoDb[],
    condominioId: string,
  ): Promise<Pacco[]> {
    if (righe.length === 0) return [];

    // Raccoglie gli ID di unità e registratori che non hanno i dettagli già presenti
    const unitaMancanti = new Set<string>();
    const registratoriMancanti = new Set<string>();

    for (const r of righe) {
      if (!r.unita_immobiliari?.interno) {
        unitaMancanti.add(r.unita_destinazione_id);
      }
      if (r.registrato_da && !r.utenti?.nome_cognome) {
        registratoriMancanti.add(r.registrato_da);
      }
    }

    const mappaUnita = new Map<string, { interno: string; palazzoNome: string }>();
    const mappaRegistratori = new Map<string, string>();

    const promises: Promise<unknown>[] = [];

    if (unitaMancanti.size > 0) {
      promises.push(
        (async () => {
          const [unitaRes, palazziRes] = await Promise.all([
            db
              .from('unita_immobiliari')
              .select('id, interno, palazzo_id')
              .in('id', [...unitaMancanti]),
            db
              .from('palazzi')
              .select('id, nome_identificativo')
              .eq('condominio_id', condominioId),
          ]);

          const palazziMap = new Map<string, string>();
          for (const p of (palazziRes.data ?? []) as Array<{ id: string; nome_identificativo: string }>) {
            palazziMap.set(p.id, p.nome_identificativo);
          }

          for (const u of (unitaRes.data ?? []) as Array<{ id: string; interno: string; palazzo_id: string }>) {
            mappaUnita.set(u.id, {
              interno: u.interno,
              palazzoNome: palazziMap.get(u.palazzo_id) || '',
            });
          }
        })(),
      );
    }

    if (registratoriMancanti.size > 0) {
      promises.push(
        (async () => {
          const profiliRes = await db
            .from('profili_pubblici')
            .select('id, nome_cognome')
            .in('id', [...registratoriMancanti]);

          for (const p of (profiliRes.data ?? []) as Array<{ id: string; nome_cognome: string | null }>) {
            if (p.nome_cognome) mappaRegistratori.set(p.id, p.nome_cognome);
          }
        })(),
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return righe.map((r): Pacco => {
      let etichettaUnita: string;
      if (r.unita_immobiliari?.interno) {
        etichettaUnita = formattaEtichettaUnitaPacco({
          palazzoNome: r.unita_immobiliari.palazzi?.nome_identificativo,
          interno: r.unita_immobiliari.interno,
        });
      } else {
        const info = mappaUnita.get(r.unita_destinazione_id);
        if (info) {
          etichettaUnita = formattaEtichettaUnitaPacco({
            palazzoNome: info.palazzoNome,
            interno: info.interno,
          });
        } else {
          etichettaUnita = 'Unità sconosciuta';
        }
      }

      const registratoreNome =
        r.utenti?.nome_cognome ||
        (r.registrato_da ? mappaRegistratori.get(r.registrato_da) ?? null : null);

      return {
        id: r.id,
        condominioId: r.condominio_id,
        unitaDestinazioneId: r.unita_destinazione_id,
        etichettaUnita,
        mittenteEsterno: r.mittente_esterno,
        stato: r.stato,
        dataArrivo: r.data_arrivo,
        dataRitiro: r.data_ritiro,
        firmaRitiro: r.firma_ritiro,
        registratoDa: r.registrato_da,
        registratoDaNome: registratoreNome,
      };
    });
  }

  /**
   * Registra l'arrivo di un nuovo pacco in portineria.
   * Crea la riga in stato 'GIACENZA' con `data_arrivo = now()` e `registrato_da = auth.uid()`.
   */
  async function registraNuovoPacco(
    input: InputRegistraPacco,
  ): Promise<RisultatoRegistraPacco> {
    const validazione = validaNuovoPacco({
      unitaId: input.unitaId,
      mittenteEsterno: input.mittenteEsterno,
    });

    if (!validazione.valido) {
      return { ok: false, errori: validazione.errori as Record<string, string> };
    }

    const { data: authData } = await db.auth.getUser();
    const registratoDa = authData?.user?.id ?? null;
    if (!registratoDa) {
      return { ok: false, errori: { form: 'Utente non autenticato.' } };
    }

    const { data, error } = await db
      .from('registro_pacchi')
      .insert({
        condominio_id: input.condominioId,
        unita_destinazione_id: input.unitaId,
        mittente_esterno: input.mittenteEsterno?.trim() || null,
        stato: 'GIACENZA',
        data_arrivo: new Date().toISOString(),
        data_ritiro: null,
        firma_ritiro: null,
        registrato_da: registratoDa,
      })
      .select('id')
      .single();

    if (error) {
      return { ok: false, errori: { form: error.message } };
    }

    return { ok: true, paccoId: (data as { id: string }).id };
  }

  /**
   * Segna un pacco come ritirato registrando la firma/nome e la data di ritiro.
   */
  async function segnaComeRitirato(
    paccoId: string,
    firma: string,
  ): Promise<RisultatoRitiroPacco> {
    const validazione = validaRegistrazioneRitiro(firma);
    if (!validazione.valido) {
      return { ok: false, errore: validazione.errore || 'Firma non valida.' };
    }

    const { error } = await db
      .from('registro_pacchi')
      .update({
        stato: 'RITIRATO',
        data_ritiro: new Date().toISOString(),
        firma_ritiro: firma.trim(),
      })
      .eq('id', paccoId);

    if (error) {
      return { ok: false, errore: error.message };
    }

    return { ok: true };
  }

  /**
   * Elenco delle unità del condominio (palazzo + interno) ordinate per il menu a tendina.
   */
  async function elencoUnitaCondominio(
    condominioId: string,
  ): Promise<UnitaCondominioOpzione[]> {
    const palazziRes = await db
      .from('palazzi')
      .select('id, nome_identificativo')
      .eq('condominio_id', condominioId)
      .order('nome_identificativo', { ascending: true });

    const palazzi = (palazziRes.data ?? []) as Array<{ id: string; nome_identificativo: string }>;
    if (palazzi.length === 0) return [];

    const palazziMap = new Map<string, string>();
    for (const p of palazzi) {
      palazziMap.set(p.id, p.nome_identificativo);
    }

    const unitaRes = await db
      .from('unita_immobiliari')
      .select('id, palazzo_id, interno, piano')
      .in('palazzo_id', palazzi.map((p) => p.id))
      .order('interno', { ascending: true });

    const unita = (unitaRes.data ?? []) as Array<{
      id: string;
      palazzo_id: string;
      interno: string;
      piano: number | null;
    }>;

    const opzioni: UnitaCondominioOpzione[] = unita.map((u) => {
      const palazzoNome = palazziMap.get(u.palazzo_id) || 'Palazzo';
      return {
        id: u.id,
        palazzoId: u.palazzo_id,
        palazzoNome,
        interno: u.interno,
        piano: u.piano,
        scala: null,
        etichetta: formattaEtichettaUnitaPacco({
          palazzoNome,
          interno: u.interno,
        }),
      };
    });

    // Ordinamento naturale per palazzo asc, poi interno numerico se possibile
    opzioni.sort((a, b) => {
      if (a.palazzoNome !== b.palazzoNome) {
        return a.palazzoNome < b.palazzoNome ? -1 : 1;
      }
      const numA = parseInt(a.interno, 10);
      const numB = parseInt(b.interno, 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
      }
      return a.interno < b.interno ? -1 : a.interno > b.interno ? 1 : 0;
    });

    return opzioni;
  }

  return {
    elencoPacchi,
    registraNuovoPacco,
    segnaComeRitirato,
    elencoUnitaCondominio,
  };
}

export type PacchiService = ReturnType<typeof createPacchiService>;
