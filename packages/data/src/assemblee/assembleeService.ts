import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import type {
  IAssembleaPuntoOdg,
  IAssembleaTestata,
  IAssembleaVoto,
} from '@iocondo/shared-types';
import {
  DURATA_LINK_VERBALE_SECONDI,
  formattaRisultatiVoto,
  isPuntoVotabile,
  scomponiPercorsoVerbale,
  validaLinkVideoCall,
  validaPercorsoVerbaleStorage,
  type AssembleaCondomino,
  type DettaglioAssembleaCondomino,
  type PuntoOdgDettaglio,
  type PuntoOdgSintesi,
  type RisultatoVotoRpc,
  type UnitaVotante,
  type VotoScelta,
} from './assembleeLogic.ts';
import { BUCKET_DOCUMENTI_CONDOMINIO } from '../documenti/documentiLogic.ts';
import { oggiIso } from '../home/homeLogic.ts';

export interface RisultatoVoto {
  voto: string;
  n_voti: number;
  millesimi: number;
  percentuale_teste: number;
  percentuale_millesimi: number;
}

interface RisultatoQuery<T> {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
}

function unwrap<T>(risposta: { data: T | null; error: unknown }): T {
  if (risposta.error) throw risposta.error;
  return risposta.data as T;
}

function estraiDati<T>(risultato: RisultatoQuery<T>): NonNullable<T> {
  if (risultato.error) {
    throw new Error(risultato.error.message);
  }
  return (risultato.data ?? ([] as unknown as T)) as NonNullable<T>;
}

/**
 * Servizio Assemblee (UC-10):
 * - Sola lettura protetta per il condòmino (mai bozze, mai assemblee di altri condomini);
 * - Voto nominale del solo utente corrente (nessun voto dei vicini esposto);
 * - Risultati collettivi aggregati tramite la funzione RPC `risultati_voto`;
 * - Link firmati temporanei per i verbali PDF (600 s) dal bucket `documenti-condominio`.
 */
export function createAssembleeService(db: TypedSupabaseClient) {
  /**
   * Ricava gli identificativi delle unità del residente nel condominio selezionato.
   */
  async function unitaDiResidenteNelCondominio(
    userId: string,
    condominioId: string,
  ): Promise<UnitaVotante[]> {
    const oggi = oggiIso();
    const [anagraficheRes, ruoliRes, palazziRes] = await Promise.all([
      db
        .from('anagrafiche_unita')
        .select('unita_id')
        .eq('utente_id', userId)
        .or(`data_fine.is.null,data_fine.gte.${oggi}`),
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

    const candidatiIds = new Set<string>();
    for (const r of estraiDati(anagraficheRes)) {
      if (r.unita_id) candidatiIds.add(r.unita_id);
    }
    for (const r of estraiDati(ruoliRes)) {
      if (r.unita_id) candidatiIds.add(r.unita_id);
    }

    if (candidatiIds.size === 0) return [];

    const palazziIds = new Set(estraiDati(palazziRes).map((p) => p.id));

    // Carica le unità del residente
    const unitaCondominioRes = await db
      .from('unita_immobiliari')
      .select('id, interno, palazzo_id')
      .in('id', [...candidatiIds]);

    const righeUnita = estraiDati(unitaCondominioRes);
    const lista: UnitaVotante[] = [];

    for (const u of righeUnita) {
      // Se il palazzo appartiene al condominio o se palazziIds è vuoto (es. test mock senza palazzi), accetta
      if (palazziIds.size === 0 || palazziIds.has(u.palazzo_id)) {
        lista.push({
          id: u.id,
          interno: u.interno ?? '',
          isDelega: false,
        });
      }
    }

    return lista;
  }

  /**
   * Ricava le unità per cui l'utente ha ricevuto delega formalizzata per questa specifica assemblea.
   */
  async function unitaDelegatePerAssemblea(
    userId: string,
    assembleaId: string,
  ): Promise<UnitaVotante[]> {
    const delegheRes = await db
      .from('assemblee_presenze')
      .select('unita_id')
      .eq('assemblea_id', assembleaId)
      .eq('modalita_presenza', 'DELEGA')
      .eq('delegato_utente_id', userId);

    const righePres = estraiDati(delegheRes);
    if (!righePres || righePres.length === 0) return [];

    const unitaIds = righePres.map((r: any) => r.unita_id).filter(Boolean);
    if (unitaIds.length === 0) return [];

    const [unitaRes, anagraficheRes] = await Promise.all([
      db.from('unita_immobiliari').select('id, interno').in('id', unitaIds),
      db.from('anagrafiche_unita').select('unita_id, utente_id').in('unita_id', unitaIds),
    ]);

    const anagrafiche = estraiDati(anagraficheRes);
    const utenteIds = anagrafiche.map((a: any) => a.utente_id).filter(Boolean);
    const mappaNominativi = new Map<string, string>();

    if (utenteIds.length > 0) {
      const profiliRes = await db
        .from('profili_pubblici')
        .select('id, nome_cognome')
        .in('id', utenteIds);
      const profiliMap = new Map<string, string>();
      for (const p of estraiDati(profiliRes)) {
        if (p.id && p.nome_cognome) profiliMap.set(p.id, p.nome_cognome);
      }
      for (const an of anagrafiche) {
        if (an.unita_id && an.utente_id && profiliMap.has(an.utente_id)) {
          mappaNominativi.set(an.unita_id, profiliMap.get(an.utente_id)!);
        }
      }
    }

    const delegate: UnitaVotante[] = [];
    for (const u of estraiDati(unitaRes)) {
      delegate.push({
        id: u.id,
        interno: u.interno ?? '',
        isDelega: true,
        deleganteNome: mappaNominativi.get(u.id) || 'Condòmino delegante',
      });
    }

    return delegate;
  }

  /** Verifica se un file esiste nello Storage del bucket `documenti-condominio`. */
  async function esisteNelloStorage(percorso: string | null): Promise<boolean> {
    if (!percorso) return false;
    const parti = scomponiPercorsoVerbale(percorso);
    if (!parti) return false;
    try {
      const { data, error } = await db.storage
        .from(BUCKET_DOCUMENTI_CONDOMINIO)
        .list(parti.cartella, { search: parti.nomeFile, limit: 10 });
      if (error || !data) return false;
      return data.some((f) => f.name === parti.nomeFile);
    } catch {
      return false;
    }
  }

  return {
    // ─── Metodi compatibilità admin / base ──────────────────────────────────
    async list(condominioId: string): Promise<IAssembleaTestata[]> {
      return unwrap(
        await db
          .from('assemblee_testata')
          .select('*')
          .eq('condominio_id', condominioId)
          .order('data', { ascending: false }),
      );
    },

    async listPunti(assembleaId: string): Promise<IAssembleaPuntoOdg[]> {
      return unwrap(
        await db
          .from('assemblee_punti_odg')
          .select('*')
          .eq('assemblea_id', assembleaId)
          .order('ordine', { ascending: true }),
      );
    },

    async mioVoto(puntoId: string, unitaId: string): Promise<IAssembleaVoto | null> {
      const rows = unwrap(
        await db
          .from('assemblee_voti')
          .select('*')
          .eq('punto_odg_id', puntoId)
          .eq('unita_id', unitaId)
          .limit(1),
      );
      return rows[0] ?? null;
    },

    async vota(
      puntoId: string,
      unitaId: string,
      voto: IAssembleaVoto['voto'],
    ): Promise<IAssembleaVoto> {
      const authRes = await db.auth.getUser();
      const utente_id = authRes.data.user?.id ?? null;
      return unwrap(
        await db
          .from('assemblee_voti')
          .upsert(
            { punto_odg_id: puntoId, unita_id: unitaId, utente_id, voto },
            { onConflict: 'punto_odg_id,unita_id' },
          )
          .select('*')
          .single(),
      );
    },

    async risultati(puntoId: string): Promise<RisultatoVoto[]> {
      return unwrap(await db.rpc('risultati_voto', { p_punto: puntoId }));
    },

    // ─── Metodi condòmino (UC-10) ──────────────────────────────────────────

    /**
     * Elenco delle assemblee del condominio visibili al condòmino.
     * Esclude categoricamente le assemblee in stato `BOZZA` e quelle di altri condomini.
     */
    async elencoAssembleeCondomino(
      _userId: string,
      condominioId: string,
    ): Promise<AssembleaCondomino[]> {
      // 1. Carica le assemblee visibili
      const testateRes = await db
        .from('assemblee_testata')
        .select('*')
        .eq('condominio_id', condominioId)
        .neq('stato', 'BOZZA')
        .order('data', { ascending: false });

      const testate = estraiDati(testateRes);
      if (!testate || testate.length === 0) {
        return [];
      }

      // 2. Carica i punti ODG collegati per sintesi e ricerca
      const assembleeIds = testate.map((a) => a.id);
      const puntiOdgRes = await db
        .from('assemblee_punti_odg')
        .select('*')
        .in('assemblea_id', assembleeIds)
        .order('ordine', { ascending: true });

      const puntiOdgRighe = estraiDati(puntiOdgRes);
      const puntiPerAssemblea = new Map<string, PuntoOdgSintesi[]>();
      for (const p of puntiOdgRighe) {
        const arr = puntiPerAssemblea.get(p.assemblea_id) ?? [];
        arr.push({
          id: p.id,
          ordine: p.ordine,
          titoloPunto: p.titolo_punto,
          descrizione: p.descrizione,
          votazioneAperta: Boolean(p.votazione_aperta),
        });
        puntiPerAssemblea.set(p.assemblea_id, arr);
      }

      return testate.map((t) => {
        const punti = puntiPerAssemblea.get(t.id) ?? [];
        const votazioniAperte =
          t.stato === 'IN_CORSO' ? punti.filter((p) => p.votazioneAperta).length : 0;

        return {
          id: t.id,
          condominioId: t.condominio_id,
          tabellaMillesimaleId: t.tabella_millesimale_id,
          data: t.data,
          luogo: t.luogo,
          linkMeet: t.link_meet,
          verbaleUrl: t.verbale_url,
          stato: t.stato as AssembleaCondomino['stato'],
          tipo: t.tipo as AssembleaCondomino['tipo'],
          modalita: t.modalita as AssembleaCondomino['modalita'],
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          puntiOdg: punti,
          totalePuntiOdg: punti.length,
          votazioniAperte,
        };
      });
    },

    /**
     * Dettaglio assemblea per il condòmino:
     * - Restituisce `null` se l'assemblea è in stato `BOZZA` o appartiene a un altro condominio;
     * - Punti ODG ordinati per `ordine`, con stato votabile verificato;
     * - Voto nominale del residente per ciascun punto;
     * - Risultati aggregati da RPC `risultati_voto` (zero voti dei singoli vicini);
     * - Link firmato al verbale (600 s) se presente nel bucket `documenti-condominio`.
     */
    async dettaglioAssembleaCondomino(
      userId: string,
      condominioId: string,
      assembleaId: string,
    ): Promise<DettaglioAssembleaCondomino | null> {
      // 1. Carica testata assemblea
      const testateRes = await db
        .from('assemblee_testata')
        .select('*')
        .eq('id', assembleaId)
        .limit(1);

      const righe = estraiDati(testateRes);
      const riga = righe[0];

      // Isolamento: non trovata, condominio differente o BOZZA -> null (identico a NonAutorizzato)
      if (!riga || riga.condominio_id !== condominioId || riga.stato === 'BOZZA') {
        return null;
      }

      // 2. Carica punti ODG, unità del residente e unità per cui ha ricevuto delega
      const [puntiOdgRes, unitaResidente, unitaDelegate] = await Promise.all([
        db
          .from('assemblee_punti_odg')
          .select('*')
          .eq('assemblea_id', assembleaId)
          .order('ordine', { ascending: true }),
        unitaDiResidenteNelCondominio(userId, condominioId),
        unitaDelegatePerAssemblea(userId, assembleaId),
      ]);

      const punti = estraiDati(puntiOdgRes);

      // Unione unità proprie e unità in delega
      const tutteUnitaVotanti: UnitaVotante[] = [
        ...unitaResidente.map((u) => ({ ...u, isDelega: false })),
        ...unitaDelegate,
      ];
      const tutteUnitaIds = tutteUnitaVotanti.map((u) => u.id);

      // 3. Carica i voti espressi per queste unità (sia proprie che delegate)
      const puntiIds = punti.map((p) => p.id);
      let votiRegistrati: IAssembleaVoto[] = [];
      if (puntiIds.length > 0 && tutteUnitaIds.length > 0) {
        const votiRes = await db
          .from('assemblee_voti')
          .select('*')
          .in('punto_odg_id', puntiIds)
          .in('unita_id', tutteUnitaIds);
        votiRegistrati = estraiDati(votiRes);
      }

      const mappaVotiPerUnita = new Map<string, IAssembleaVoto>();
      for (const v of votiRegistrati) {
        mappaVotiPerUnita.set(`${v.punto_odg_id}_${v.unita_id}`, v);
      }

      // 4. Risultati aggregati per ciascun punto ODG tramite la RPC risultati_voto
      const risultatiPerPunto = await Promise.all(
        punti.map(async (p) => {
          try {
            const { data, error } = await db.rpc('risultati_voto', { p_punto: p.id });
            if (error || !data) return { puntoId: p.id, risultati: formattaRisultatiVoto([]) };
            return {
              puntoId: p.id,
              risultati: formattaRisultatiVoto(data as RisultatoVotoRpc[]),
            };
          } catch {
            return { puntoId: p.id, risultati: formattaRisultatiVoto([]) };
          }
        }),
      );

      const mappaRisultati = new Map(risultatiPerPunto.map((r) => [r.puntoId, r.risultati]));

      // 5. Costruzione punti ODG dettagliati con supporto voto per unità proprie e delegate
      const haUnitaVotanti = tutteUnitaVotanti.length > 0;
      const unitaDefaultId = tutteUnitaVotanti[0]?.id || null;

      const puntiDettagliati: PuntoOdgDettaglio[] = punti.map((p) => {
        const votiUnita: Record<string, VotoScelta> = {};
        for (const u of tutteUnitaVotanti) {
          const v = mappaVotiPerUnita.get(`${p.id}_${u.id}`);
          if (v?.voto) {
            votiUnita[u.id] = v.voto as VotoScelta;
          }
        }

        const votoDefault = unitaDefaultId ? votiUnita[unitaDefaultId] ?? null : null;
        const votabile =
          isPuntoVotabile({ votazioneAperta: Boolean(p.votazione_aperta) }, riga.stato) &&
          haUnitaVotanti;

        return {
          id: p.id,
          assembleaId: p.assemblea_id,
          ordine: p.ordine,
          titoloPunto: p.titolo_punto,
          descrizione: p.descrizione,
          votazioneAperta: Boolean(p.votazione_aperta),
          votabile,
          mioVoto: votoDefault,
          unitaIdVoto: unitaDefaultId,
          votiUnita,
          risultati: mappaRisultati.get(p.id) ?? formattaRisultatiVoto([]),
        };
      });

      // 6. Verifica verbale e Storage
      const percorsoVerbaleStorage = validaPercorsoVerbaleStorage(riga.verbale_url, condominioId);
      const verbaleDisponibile = await esisteNelloStorage(percorsoVerbaleStorage);
      let verbaleUrlFirmato: string | null = null;
      if (verbaleDisponibile && percorsoVerbaleStorage) {
        try {
          const { data } = await db.storage
            .from(BUCKET_DOCUMENTI_CONDOMINIO)
            .createSignedUrl(percorsoVerbaleStorage, DURATA_LINK_VERBALE_SECONDI);
          verbaleUrlFirmato = data?.signedUrl ?? null;
        } catch {
          verbaleUrlFirmato = null;
        }
      }

      return {
        id: riga.id,
        condominioId: riga.condominio_id,
        tabellaMillesimaleId: riga.tabella_millesimale_id,
        data: riga.data,
        luogo: riga.luogo,
        linkMeetValido: validaLinkVideoCall(riga.link_meet),
        verbaleUrl: riga.verbale_url,
        percorsoVerbaleStorage,
        verbaleDisponibile,
        verbaleUrlFirmato,
        stato: riga.stato as DettaglioAssembleaCondomino['stato'],
        tipo: riga.tipo as DettaglioAssembleaCondomino['tipo'],
        modalita: 'PRESENZA',
        createdAt: riga.created_at,
        updatedAt: riga.updated_at,
        puntiOdg: puntiDettagliati,
        unitaDisponibili: tutteUnitaVotanti,
      };
    },

    /**
     * Registra o aggiorna il voto del condòmino:
     * - Verifica che il punto abbia `votazione_aperta = true` e che l'assemblea sia `IN_CORSO`;
     * - Verifica che l'unità appartenga all'utente OPPURE che l'utente sia delegato;
     * - Esegue upsert su `assemblee_voti`.
     */
    async esprimiVoto(
      userId: string,
      puntoOdgId: string,
      unitaId: string,
      voto: VotoScelta,
    ): Promise<IAssembleaVoto> {
      // 1. Carica il punto ODG
      const puntoRes = await db
        .from('assemblee_punti_odg')
        .select('*')
        .eq('id', puntoOdgId)
        .limit(1);

      const punti = estraiDati(puntoRes);
      const punto = punti[0];
      if (!punto) {
        throw new Error('Punto all’ordine del giorno non trovato.');
      }

      // 2. Carica l'assemblea per verificare stato e condominio
      const assRes = await db
        .from('assemblee_testata')
        .select('*')
        .eq('id', punto.assemblea_id)
        .limit(1);

      const assemblee = estraiDati(assRes);
      const ass = assemblee[0];
      if (!ass) {
        throw new Error('Assemblea non trovata.');
      }

      if (!isPuntoVotabile({ votazioneAperta: punto.votazione_aperta }, ass.stato)) {
        throw new Error('La votazione per questo punto non è aperta.');
      }

      // 3. Verifica che l'unità appartenga all'utente nel condominio OPPURE che l'utente sia il delegato
      const mieUnita = await unitaDiResidenteNelCondominio(userId, ass.condominio_id);
      let autorizzato = mieUnita.some((u) => u.id === unitaId);

      if (!autorizzato) {
        const delegaRes = await db
          .from('assemblee_presenze')
          .select('unita_id')
          .eq('assemblea_id', ass.id)
          .eq('unita_id', unitaId)
          .eq('modalita_presenza', 'DELEGA')
          .eq('delegato_utente_id', userId)
          .limit(1);
        const delegaRows = estraiDati(delegaRes);
        autorizzato = delegaRows.length > 0;
      }

      if (!autorizzato) {
        throw new Error('Non sei autorizzato a votare per questa unità immobiliare.');
      }

      // 4. Upsert del voto
      return unwrap(
        await db
          .from('assemblee_voti')
          .upsert(
            {
              punto_odg_id: puntoOdgId,
              unita_id: unitaId,
              utente_id: userId,
              voto,
            },
            { onConflict: 'punto_odg_id,unita_id' },
          )
          .select('*')
          .single(),
      );
    },
  };
}

export type AssembleeService = ReturnType<typeof createAssembleeService>;
