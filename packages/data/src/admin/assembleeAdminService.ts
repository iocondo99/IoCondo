import { assertOk, unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import { BUCKET_DOCUMENTI_CONDOMINIO } from '../documenti/documentiLogic';
import {
  DURATA_LINK_FIRMATO_VERBALE_SECONDI,
  type AssembleaAdminView,
  type ConvocazioneAttiva,
  type ModalitaAssembleaAdmin,
  type ModalitaPresenzaAdmin,
  type PresenzaUnitaView,
  type PuntoOdgAdminView,
  type StatoAssembleaAdmin,
  type TipoAssembleaAdmin,
  type TipoDelibera,
  type UnitaAssembleaView,
  type VotoSceltaAdmin,
} from './assembleeAdminLogic';

export interface CreaAssembleaAdminInput {
  condominioId: string;
  tipo: TipoAssembleaAdmin;
  modalita: ModalitaAssembleaAdmin;
  data: string; // ISO della data principale (2ª convocazione o seduta)
  dataPrimaConvocazione?: string | null;
  dataSecondaConvocazione?: string | null;
  luogo?: string | null;
  linkMeet?: string | null;
  tabellaMillesimaleId?: string | null;
  stato?: StatoAssembleaAdmin;
}

export interface DettaglioAssembleaAdminResult {
  assemblea: AssembleaAdminView;
  puntiOdg: PuntoOdgAdminView[];
  unitaList: UnitaAssembleaView[];
  presenzeMap: Record<string, PresenzaUnitaView>;
  votiPerPunto: Record<string, Record<string, VotoSceltaAdmin>>; // puntoId -> { unitaId: voto }
  tabelleMillesimali: { id: string; nome: string; totale: number }[];
  verbaleUrlFirmato: string | null;
  convocazioneDefault: ConvocazioneAttiva;
}

export interface SalvaPresenzaInput {
  unitaId: string;
  modalita: ModalitaPresenzaAdmin;
  delegatoUtenteId?: string | null;
  delegatoNome?: string | null;
}

export function createAssembleeAdminService(db: TypedSupabaseClient) {
  return {
    /**
     * Elenco assemblee del condominio attivo per l'amministratore:
     * - Carica tutte le assemblee (incluse BOZZA);
     * - Conta punti ODG e votazioni aperte;
     * - Include tabella millesimale e stato presenze.
     */
    async listAssembleeAdmin(condominioId: string): Promise<AssembleaAdminView[]> {
      const assemblee = unwrap(
        await db
          .from('assemblee_testata')
          .select(`
            id,
            condominio_id,
            data,
            luogo,
            link_meet,
            stato,
            tipo,
            modalita,
            tabella_millesimale_id,
            verbale_url,
            created_at,
            updated_at
          `)
          .eq('condominio_id', condominioId)
          .order('data', { ascending: false }),
      );

      if (!assemblee || assemblee.length === 0) {
        return [];
      }

      const ids = assemblee.map((a) => a.id);

      // Carica tutti i punti ODG collegati per conteggio
      const [puntiRes, tabelleRes, presenzeRes] = await Promise.all([
        db
          .from('assemblee_punti_odg')
          .select('id, assemblea_id, ordine, titolo_punto, votazione_aperta')
          .in('assemblea_id', ids)
          .order('ordine', { ascending: true }),
        db
          .from('tabelle_millesimali')
          .select('id, nome')
          .eq('condominio_id', condominioId),
        db
          .from('assemblee_presenze')
          .select('assemblea_id, unita_id')
          .in('assemblea_id', ids),
      ]);

      const punti = unwrap(puntiRes) || [];
      const tabelle = unwrap(tabelleRes) || [];
      const presenze = unwrap(presenzeRes) || [];

      const mappaTabelle = new Map(tabelle.map((t) => [t.id, t.nome]));

      const puntiPerAssemblea = new Map<string, PuntoOdgAdminView[]>();
      for (const p of punti) {
        const arr = puntiPerAssemblea.get(p.assemblea_id) ?? [];
        arr.push({
          id: p.id,
          assembleaId: p.assemblea_id,
          ordine: p.ordine,
          titoloPunto: p.titolo_punto,
          votazioneAperta: Boolean(p.votazione_aperta),
        });
        puntiPerAssemblea.set(p.assemblea_id, arr);
      }

      const presenzePerAssemblea = new Map<string, number>();
      for (const pr of presenze) {
        presenzePerAssemblea.set(
          pr.assemblea_id,
          (presenzePerAssemblea.get(pr.assemblea_id) || 0) + 1,
        );
      }

      return assemblee.map((a) => {
        const puntiAss = puntiPerAssemblea.get(a.id) ?? [];
        const votazioniAperte = a.stato === 'IN_CORSO'
          ? puntiAss.filter((p) => p.votazioneAperta).length
          : 0;
        const totPresenze = presenzePerAssemblea.get(a.id) || 0;

        return {
          id: a.id,
          condominioId: a.condominio_id,
          tabellaMillesimaleId: a.tabella_millesimale_id,
          tabellaMillesimaleNome: a.tabella_millesimale_id
            ? mappaTabelle.get(a.tabella_millesimale_id) || null
            : null,
          data: a.data,
          luogo: a.luogo,
          linkMeet: a.link_meet,
          verbaleUrl: a.verbale_url,
          stato: a.stato as StatoAssembleaAdmin,
          tipo: a.tipo as TipoAssembleaAdmin,
          modalita: a.modalita as ModalitaAssembleaAdmin,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
          puntiOdg: puntiAss,
          totalePuntiOdg: puntiAss.length,
          votazioniAperte,
          totalePresenze: totPresenze,
        };
      });
    },

    /**
     * Elenco tabelle millesimali del condominio.
     */
    async listTabelleMillesimali(condominioId: string): Promise<Array<{ id: string; nome: string }>> {
      const res = await db
        .from('tabelle_millesimali')
        .select('id, nome')
        .eq('condominio_id', condominioId)
        .order('nome', { ascending: true });
      const rows = (unwrap(res) || []) as Array<{ id: string; nome: string }>;
      return rows.map((r) => ({ id: r.id, nome: r.nome }));
    },

    /**
     * Dettaglio completo dell'assemblea per la conduzione e redazione:
     * - Anagrafica assemblea e punti ODG con proposta delibera;
     * - Tabelle millesimali disponibili e tabella selezionata;
     * - Quote millesimali e anagrafiche di tutte le unità;
     * - Presenze e deleghe registrate;
     * - Voti nominali su tutti i punti ODG;
     * - Link firmato al verbale (600s).
     */
    async getDettaglioAssembleaAdmin(
      assembleaId: string,
    ): Promise<DettaglioAssembleaAdminResult | null> {
      // 1. Carica testata assemblea
      const assRows = unwrap(
        await db
          .from('assemblee_testata')
          .select('*')
          .eq('id', assembleaId)
          .limit(1),
      );

      const ass = assRows[0];
      if (!ass) return null;

      const condominioId = ass.condominio_id;

      // 2. Carica punti ODG, tabelle millesimali e unità del condominio
      const [puntiRes, tabelleRes, palazziRes, presenzeRes] = await Promise.all([
        db
          .from('assemblee_punti_odg')
          .select('*')
          .eq('assemblea_id', assembleaId)
          .order('ordine', { ascending: true }),
        db
          .from('tabelle_millesimali')
          .select('id, nome, totale')
          .eq('condominio_id', condominioId)
          .order('nome', { ascending: true }),
        db
          .from('palazzi')
          .select('id, nome_identificativo')
          .eq('condominio_id', condominioId),
        db
          .from('assemblee_presenze')
          .select(`
            unita_id,
            modalita_presenza,
            delegato_utente_id,
            utenti!assemblee_presenze_delegato_utente_id_fkey (
              id,
              nome_cognome
            )
          `)
          .eq('assemblea_id', assembleaId),
      ]);

      const punti = unwrap(puntiRes) || [];
      const tabelle = (unwrap(tabelleRes) || []).map((t) => ({
        id: t.id,
        nome: t.nome,
        totale: Number(t.totale) || 1000,
      }));
      const palazzi = unwrap(palazziRes) || [];
      const mappaPalazzi = new Map(palazzi.map((p) => [p.id, p.nome_identificativo]));

      // Tabella millesimale attiva: o quella dell'assemblea o la prima disponibile
      const primaTabellaId = tabelle.length > 0 ? tabelle[0]?.id : null;
      const tabellaAttivaId = ass.tabella_millesimale_id || primaTabellaId || null;

      // 3. Carica tutte le unità del condominio con quote della tabella e anagrafica proprietario
      const palazziIds = palazzi.map((p) => p.id);
      let unitaRaw: any[] = [];
      let quoteRaw: any[] = [];
      let anagraficheRaw: any[] = [];

      if (palazziIds.length > 0) {
        const [unitaRes, anagraficheRes] = await Promise.all([
          db
            .from('unita_immobiliari')
            .select('id, interno, piano, palazzo_id, scala_colonna_id')
            .in('palazzo_id', palazziIds)
            .order('interno', { ascending: true }),
          db
            .from('anagrafiche_unita')
            .select(`
              unita_id,
              utente_id,
              tipo_possesso,
              utenti (
                id,
                nome_cognome
              )
            `)
            .or(`data_fine.is.null,data_fine.gte.${new Date().toISOString().slice(0, 10)}`),
        ]);

        unitaRaw = unwrap(unitaRes) || [];
        anagraficheRaw = unwrap(anagraficheRes) || [];

        if (tabellaAttivaId && unitaRaw.length > 0) {
          const quoteRes = await db
            .from('quote_millesimali')
            .select('unita_id, valore_millesimale')
            .eq('tabella_id', tabellaAttivaId);
          quoteRaw = unwrap(quoteRes) || [];
        }
      }

      const mappaQuote = new Map<string, number>();
      for (const q of quoteRaw) {
        mappaQuote.set(q.unita_id, Number(q.valore_millesimale) || 0);
      }

      const mappaProprietari = new Map<
        string,
        { id: string; nome: string }
      >();
      for (const a of anagraficheRaw) {
        if (a.unita_id && a.utenti?.nome_cognome) {
          mappaProprietari.set(a.unita_id, {
            id: a.utente_id,
            nome: a.utenti.nome_cognome,
          });
        }
      }

      const unitaList: UnitaAssembleaView[] = unitaRaw.map((u) => {
        const prop = mappaProprietari.get(u.id);
        const mm = mappaQuote.get(u.id) || 0;
        return {
          id: u.id,
          interno: u.interno,
          palazzoNome: mappaPalazzi.get(u.palazzo_id) || null,
          piano: u.piano,
          valoreMillesimale: mm,
          proprietarioId: prop?.id || null,
          proprietarioNome: prop?.nome || null,
        };
      });

      // 4. Mappatura presenze
      const presenzeRaw = unwrap(presenzeRes) || [];
      const presenzeMap: Record<string, PresenzaUnitaView> = {};
      for (const pr of presenzeRaw) {
        presenzeMap[pr.unita_id] = {
          unitaId: pr.unita_id,
          modalita: pr.modalita_presenza as ModalitaPresenzaAdmin,
          delegatoUtenteId: pr.delegato_utente_id,
          delegatoNome: (pr as any).utenti?.nome_cognome || null,
        };
      }

      // 5. Carica voti nominali per tutti i punti ODG
      const puntiIds = punti.map((p) => p.id);
      const votiPerPunto: Record<string, Record<string, VotoSceltaAdmin>> = {};

      if (puntiIds.length > 0) {
        const votiRes = unwrap(
          await db
            .from('assemblee_voti')
            .select('punto_odg_id, unita_id, voto, utente_id')
            .in('punto_odg_id', puntiIds),
        );

        for (const v of votiRes || []) {
          const map = votiPerPunto[v.punto_odg_id] ?? {};
          map[v.unita_id] = v.voto as VotoSceltaAdmin;
          votiPerPunto[v.punto_odg_id] = map;
        }
      }

      // 6. Link firmato al verbale (se presente)
      let verbaleUrlFirmato: string | null = null;
      if (ass.verbale_url) {
        try {
          const { data } = await db.storage
            .from(BUCKET_DOCUMENTI_CONDOMINIO)
            .createSignedUrl(ass.verbale_url, DURATA_LINK_FIRMATO_VERBALE_SECONDI);
          verbaleUrlFirmato = data?.signedUrl || null;
        } catch {
          verbaleUrlFirmato = null;
        }
      }

      const puntiOdgViews: PuntoOdgAdminView[] = punti.map((p) => ({
        id: p.id,
        assembleaId: p.assemblea_id,
        ordine: p.ordine,
        titoloPunto: p.titolo_punto,
        descrizione: p.descrizione,
        votazioneAperta: Boolean(p.votazione_aperta),
        tipoDelibera: (ass.tipo === 'STRAORDINARIA' ? 'STRAORDINARIA' : 'ORDINARIA') as TipoDelibera,
        voti: votiPerPunto[p.id] || {},
      }));

      const assembleaView: AssembleaAdminView = {
        id: ass.id,
        condominioId: ass.condominio_id,
        tabellaMillesimaleId: ass.tabella_millesimale_id,
        tabellaMillesimaleNome: ass.tabella_millesimale_id
          ? tabelle.find((t) => t.id === ass.tabella_millesimale_id)?.nome || null
          : null,
        data: ass.data,
        luogo: ass.luogo,
        linkMeet: ass.link_meet,
        verbaleUrl: ass.verbale_url,
        stato: ass.stato as StatoAssembleaAdmin,
        tipo: ass.tipo as TipoAssembleaAdmin,
        modalita: ass.modalita as ModalitaAssembleaAdmin,
        createdAt: ass.created_at,
        updatedAt: ass.updated_at,
        puntiOdg: puntiOdgViews,
        totalePuntiOdg: puntiOdgViews.length,
        votazioniAperte: puntiOdgViews.filter((p) => p.votazioneAperta).length,
        totalePresenze: Object.keys(presenzeMap).length,
      };

      return {
        assemblea: assembleaView,
        puntiOdg: puntiOdgViews,
        unitaList,
        presenzeMap,
        votiPerPunto,
        tabelleMillesimali: tabelle,
        verbaleUrlFirmato,
        convocazioneDefault: 'SECONDA',
      };
    },

    /**
     * Crea una nuova assemblea.
     */
    async creaAssemblea(
      input: CreaAssembleaAdminInput,
    ): Promise<{ ok: boolean; id?: string; errore?: string }> {
      try {
        const payload = {
          condominio_id: input.condominioId,
          tipo: input.tipo,
          modalita: input.modalita,
          data: input.data,
          luogo: input.luogo || null,
          link_meet: input.linkMeet || null,
          tabella_millesimale_id: input.tabellaMillesimaleId || null,
          stato: input.stato || 'CONVOCATA',
        };

        const res = unwrap(
          await db
            .from('assemblee_testata')
            .insert(payload)
            .select('id')
            .single(),
        );

        return { ok: true, id: res.id };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore nella creazione dell’assemblea' };
      }
    },

    /**
     * Aggiorna lo stato dell'assemblea (CONVOCATA -> IN_CORSO -> CONCLUSA).
     */
    async aggiornaStatoAssemblea(
      assembleaId: string,
      stato: StatoAssembleaAdmin,
    ): Promise<{ ok: boolean; errore?: string }> {
      try {
        assertOk(
          await db
            .from('assemblee_testata')
            .update({ stato, updated_at: new Date().toISOString() })
            .eq('id', assembleaId),
        );
        return { ok: true };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore aggiornamento stato assemblea' };
      }
    },

    /**
     * Salva l'appello e le presenze registrate per le unità.
     */
    async salvaPresenze(
      assembleaId: string,
      presenze: SalvaPresenzaInput[],
    ): Promise<{ ok: boolean; errore?: string }> {
      try {
        // 1. Elimina presenze correnti dell'assemblea
        const delRes = await db.from('assemblee_presenze').delete().eq('assemblea_id', assembleaId);
        assertOk(delRes);

        // 2. Filtra chi non è assente e mappa su tipo valido
        const daInserire: {
          assemblea_id: string;
          unita_id: string;
          modalita_presenza: 'PRESENZA' | 'ONLINE' | 'DELEGA';
          delegato_utente_id: string | null;
        }[] = [];

        for (const p of presenze) {
          if (p.modalita === 'PRESENZA' || p.modalita === 'ONLINE' || p.modalita === 'DELEGA') {
            daInserire.push({
              assemblea_id: assembleaId,
              unita_id: p.unitaId,
              modalita_presenza: p.modalita,
              delegato_utente_id: p.modalita === 'DELEGA' ? p.delegatoUtenteId || null : null,
            });
          }
        }

        if (daInserire.length > 0) {
          assertOk(await db.from('assemblee_presenze').insert(daInserire));
        }

        return { ok: true };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore salvataggio presenze' };
      }
    },

    /**
     * Crea un nuovo punto all'ordine del giorno.
     */
    async creaPuntoOdg(input: {
      assembleaId: string;
      titoloPunto: string;
      descrizione?: string | null;
      ordine?: number;
    }): Promise<{ ok: boolean; id?: string; errore?: string }> {
      try {
        // Se l'ordine non è passato, calcola il prossimo ordine
        let ordine = input.ordine;
        if (!ordine) {
          const esistenti = unwrap(
            await db
              .from('assemblee_punti_odg')
              .select('ordine')
              .eq('assemblea_id', input.assembleaId)
              .order('ordine', { ascending: false })
              .limit(1),
          );
          ordine = ((esistenti[0] as any)?.ordine || 0) + 1;
        }

        const res = unwrap(
          await db
            .from('assemblee_punti_odg')
            .insert({
              assemblea_id: input.assembleaId,
              titolo_punto: input.titoloPunto,
              descrizione: input.descrizione || null,
              ordine,
              votazione_aperta: false,
            })
            .select('id')
            .single(),
        );

        return { ok: true, id: res.id };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore creazione punto ODG' };
      }
    },

    /**
     * Modifica titolo o descrizione di un punto ODG.
     */
    async modificaPuntoOdg(
      puntoId: string,
      input: { titoloPunto?: string; descrizione?: string | null; ordine?: number },
    ): Promise<{ ok: boolean; errore?: string }> {
      try {
        const payload: {
          titolo_punto?: string;
          descrizione?: string | null;
          ordine?: number;
        } = {};
        if (input.titoloPunto !== undefined) payload.titolo_punto = input.titoloPunto;
        if (input.descrizione !== undefined) payload.descrizione = input.descrizione;
        if (input.ordine !== undefined) payload.ordine = input.ordine;

        assertOk(await db.from('assemblee_punti_odg').update(payload).eq('id', puntoId));
        return { ok: true };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore modifica punto ODG' };
      }
    },

    /**
     * Elimina un punto ODG.
     */
    async eliminaPuntoOdg(puntoId: string): Promise<{ ok: boolean; errore?: string }> {
      try {
        assertOk(await db.from('assemblee_punti_odg').delete().eq('id', puntoId));
        return { ok: true };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore eliminazione punto ODG' };
      }
    },

    /**
     * Apre la votazione su un punto ODG e porta l'assemblea in stato IN_CORSO.
     */
    async apriVotazionePunto(
      puntoId: string,
      assembleaId: string,
    ): Promise<{ ok: boolean; errore?: string }> {
      try {
        const [res1, res2] = await Promise.all([
          db
            .from('assemblee_punti_odg')
            .update({ votazione_aperta: true })
            .eq('id', puntoId),
          db
            .from('assemblee_testata')
            .update({ stato: 'IN_CORSO', updated_at: new Date().toISOString() })
            .eq('id', assembleaId)
            .eq('stato', 'CONVOCATA'),
        ]);
        assertOk(res1);
        assertOk(res2);

        return { ok: true };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore apertura votazione' };
      }
    },

    /**
     * Chiude la votazione su un punto ODG.
     */
    async chiudiVotazionePunto(puntoId: string): Promise<{ ok: boolean; errore?: string }> {
      try {
        assertOk(
          await db
            .from('assemblee_punti_odg')
            .update({ votazione_aperta: false })
            .eq('id', puntoId),
        );
        return { ok: true };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore chiusura votazione' };
      }
    },

    /**
     * Registra o aggiorna il voto di un'unità immobiliare per il punto ODG.
     */
    async registraVotoUnita(
      puntoId: string,
      unitaId: string,
      voto: VotoSceltaAdmin,
      utenteId?: string | null,
    ): Promise<{ ok: boolean; errore?: string }> {
      try {
        assertOk(
          await db.from('assemblee_voti').upsert(
            {
              punto_odg_id: puntoId,
              unita_id: unitaId,
              utente_id: utenteId || null,
              voto,
            },
            { onConflict: 'punto_odg_id,unita_id' },
          ),
        );
        return { ok: true };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore registrazione voto' };
      }
    },

    /**
     * Carica il verbale finale PDF dell'assemblea nello Storage privato `documenti-condominio`
     * (percorso: `<condominio_id>/verbali/verbale_assemblea_<id>.pdf`)
     * e aggiorna `verbale_url` portando lo stato a `CONCLUSA`.
     */
    async caricaVerbalePdf(
      assembleaId: string,
      condominioId: string,
      file: unknown,
    ): Promise<{ ok: boolean; storagePath?: string; signedUrl?: string; errore?: string }> {
      try {
        const storagePath = `${condominioId}/verbali/verbale_assemblea_${assembleaId}.pdf`;

        const { error: uploadError } = await db.storage
          .from(BUCKET_DOCUMENTI_CONDOMINIO)
          .upload(storagePath, file as any, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          return { ok: false, errore: uploadError.message };
        }

        // Aggiorna assemblee_testata
        assertOk(
          await db
            .from('assemblee_testata')
            .update({
              verbale_url: storagePath,
              stato: 'CONCLUSA',
              updated_at: new Date().toISOString(),
            })
            .eq('id', assembleaId),
        );

        // Genera link firmato temporaneo
        const { data: signedData } = await db.storage
          .from(BUCKET_DOCUMENTI_CONDOMINIO)
          .createSignedUrl(storagePath, DURATA_LINK_FIRMATO_VERBALE_SECONDI);

        return {
          ok: true,
          storagePath,
          signedUrl: signedData?.signedUrl,
        };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore caricamento verbale' };
      }
    },

    /**
     * Genera un link firmato temporaneo (600s) per scaricare il verbale PDF.
     */
    async creaLinkFirmatoVerbale(
      storagePath: string,
    ): Promise<{ ok: boolean; signedUrl?: string; errore?: string }> {
      try {
        const { data, error } = await db.storage
          .from(BUCKET_DOCUMENTI_CONDOMINIO)
          .createSignedUrl(storagePath, DURATA_LINK_FIRMATO_VERBALE_SECONDI);

        if (error || !data?.signedUrl) {
          return { ok: false, errore: error?.message || 'File non trovato nello storage' };
        }

        return { ok: true, signedUrl: data.signedUrl };
      } catch (err: any) {
        return { ok: false, errore: err.message || 'Errore generazione link verbale' };
      }
    },

    /**
     * Invia notifica di chiusura assemblea e disponibilità verbale ai residenti del condominio.
     */
    async notificaChiusuraAssemblea(
      condominioId: string,
      assembleaId: string,
      titoloAssemblea: string,
    ): Promise<{ ok: boolean; inviate: number; errore?: string }> {
      try {
        // Recupera utenti con accesso al condominio
        const ruoli = unwrap(
          await db
            .from('utente_entita_ruolo')
            .select('utente_id')
            .eq('condominio_id', condominioId),
        );

        const utentiUnici = Array.from(new Set((ruoli || []).map((r) => r.utente_id)));
        if (utentiUnici.length === 0) {
          return { ok: true, inviate: 0 };
        }

        const righeNotifiche = utentiUnici.map((uId) => ({
          utente_id: uId,
          condominio_id: condominioId,
          titolo: 'Verbale assemblea disponibile',
          corpo: `L'assemblea "${titoloAssemblea}" è conclusa ed è ora disponibile il verbale ufficiale in allegato.`,
          tipo: 'ASSEMBLEA',
          letta: false,
        }));

        await db.from('notifiche').insert(righeNotifiche);
        return { ok: true, inviate: utentiUnici.length };
      } catch (err: any) {
        return { ok: false, inviate: 0, errore: err.message };
      }
    },
  };
}

export type AssembleeAdminService = ReturnType<typeof createAssembleeAdminService>;
