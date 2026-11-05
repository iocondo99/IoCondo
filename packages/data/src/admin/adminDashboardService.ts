import { unwrap, type TypedSupabaseClient } from '@iocondo/supabase-client';
import {
  aggregaPrioritaTicket,
  calcolaMorositaScaduta,
  calcolaPercentualeRiscossione,
  calcolaTotaleDaRiscuotere,
  ordinaTicketUrgenti,
  type PrioritaTicket,
  type RataAdminDettaglio,
  type StatoTicket,
  type TicketAdmin,
} from './adminDashboardLogic';

export interface AdminEsercizioCorrente {
  id: string;
  anno: number;
  stato: string;
  dataInizio: string;
  dataFine: string;
}

export interface AdminProssimaAssemblea {
  id: string;
  data: string;
  tipo: string;
  stato: string;
  luogo: string | null;
  linkMeet: string | null;
}

export interface AdminComunicazioneRecente {
  id: string;
  titolo: string;
  corpo: string | null;
  dataPubblicazione: string;
  isPinned: boolean;
}

export interface AdminDashboardKpi {
  saldoCassa: number;
  totaleDaRiscuotere: number;
  totaleDovutoEsercizio: number;
  totaleIncassatoEsercizio: number;
  percentualeRiscossione: number;
  morositaScadutaOltre15gg: number;
  posizioniMoroseOltre15gg: number;
  ticketAperti: number;
  ticketInLavorazione: number;
  ticketTotaliAttivi: number;
  ticketUrgentiTotale: number;
  prossimaAssemblea: AdminProssimaAssemblea | null;
}

export interface AdminDashboardData {
  condominio: {
    id: string;
    nome: string;
    indirizzo: string | null;
    citta: string | null;
  } | null;
  esercizioCorrente: AdminEsercizioCorrente | null;
  kpi: AdminDashboardKpi;
  ticketUrgenti: TicketAdmin[];
  ultimeComunicazioni: AdminComunicazioneRecente[];
}

const arrotonda = (n: number) => Math.round(n * 100) / 100;

export function createAdminDashboardService(db: TypedSupabaseClient) {
  return {
    async caricaDatiDashboard(condominioId: string, dataOggi?: string): Promise<AdminDashboardData> {
      if (!condominioId) {
        return {
          condominio: null,
          esercizioCorrente: null,
          kpi: {
            saldoCassa: 0,
            totaleDaRiscuotere: 0,
            totaleDovutoEsercizio: 0,
            totaleIncassatoEsercizio: 0,
            percentualeRiscossione: 0,
            morositaScadutaOltre15gg: 0,
            posizioniMoroseOltre15gg: 0,
            ticketAperti: 0,
            ticketInLavorazione: 0,
            ticketTotaliAttivi: 0,
            ticketUrgentiTotale: 0,
            prossimaAssemblea: null,
          },
          ticketUrgenti: [],
          ultimeComunicazioni: [],
        };
      }

      const oggi = dataOggi ?? new Date().toISOString().slice(0, 10);

      // 1. Carica info condominio, esercizi, ticket, assemblea e comunicazioni in parallelo
      const [
        condominioRes,
        eserciziRes,
        ticketRes,
        assembleaRes,
        comunicazioniRes,
      ] = await Promise.all([
        db
          .from('condomini')
          .select('id, nome, indirizzo, citta')
          .eq('id', condominioId)
          .maybeSingle(),
        db
          .from('esercizi_contabili')
          .select('id, anno, data_inizio, data_fine, stato')
          .eq('condominio_id', condominioId)
          .order('anno', { ascending: false }),
        db
          .from('ticket_testata')
          .select('id, titolo, priorita, stato, is_area_comune, unita_id, created_at')
          .eq('condominio_id', condominioId)
          .in('stato', ['APERTO', 'LAVORAZIONE']),
        db
          .from('assemblee_testata')
          .select('id, data, tipo, stato, luogo, link_meet')
          .eq('condominio_id', condominioId)
          .in('stato', ['CONVOCATA', 'IN_CORSO'])
          .order('data', { ascending: true })
          .limit(1),
        db
          .from('bacheca_post')
          .select('id, titolo, corpo, data_pubblicazione, is_pinned')
          .eq('condominio_id', condominioId)
          .order('data_pubblicazione', { ascending: false })
          .limit(3),
      ]);

      const condominio = unwrap(condominioRes);
      const esercizi = unwrap(eserciziRes);
      const ticketRighe = unwrap(ticketRes);
      const assemblee = unwrap(assembleaRes);
      const comunicazioniRighe = unwrap(comunicazioniRes);

      // Esercizio corrente: il più recente in stato PREVENTIVO o CONSUNTIVO, oppure il primo
      const esercizioCorrenteGrezzo =
        esercizi.find((e) => e.stato === 'PREVENTIVO' || e.stato === 'CONSUNTIVO') ?? esercizi[0] ?? null;

      const esercizioCorrente: AdminEsercizioCorrente | null = esercizioCorrenteGrezzo
        ? {
            id: esercizioCorrenteGrezzo.id,
            anno: esercizioCorrenteGrezzo.anno,
            stato: esercizioCorrenteGrezzo.stato,
            dataInizio: esercizioCorrenteGrezzo.data_inizio,
            dataFine: esercizioCorrenteGrezzo.data_fine,
          }
        : null;

      // 2. Calcolo saldo cassa e contabilità rate
      const tuttiEserciziIds = esercizi.map((e) => e.id);
      let saldoCassa = 0;

      if (tuttiEserciziIds.length > 0) {
        const movimentiRes = await db
          .from('movimenti_contabili')
          .select('importo, segno')
          .in('esercizio_id', tuttiEserciziIds);
        const movimenti = unwrap(movimentiRes);
        for (const m of movimenti) {
          const val = Number(m.importo) || 0;
          if (m.segno === '+') saldoCassa += val;
          else if (m.segno === '-') saldoCassa -= val;
        }
        saldoCassa = arrotonda(saldoCassa);
      }

      // Rate dell'esercizio corrente
      let totaleDovutoEsercizio = 0;
      let totaleIncassatoEsercizio = 0;
      let totaleDaRiscuotere = 0;
      let percentualeRiscossione = 0;
      let morositaScadutaOltre15gg = 0;
      let posizioniMoroseOltre15gg = 0;

      if (esercizioCorrente) {
        const testateRes = await db
          .from('rate_testata')
          .select('id, data_scadenza, pubblicata')
          .eq('esercizio_id', esercizioCorrente.id)
          .eq('pubblicata', true);
        const testate = unwrap(testateRes);

        if (testate.length > 0) {
          const testateMap = new Map(testate.map((t) => [t.id, t.data_scadenza]));
          const dettagliRes = await db
            .from('rate_dettaglio')
            .select('id, rata_testata_id, importo_dovuto, importo_pagato, stato, unita_id, utente_id')
            .in('rata_testata_id', testate.map((t) => t.id));
          const dettagli = unwrap(dettagliRes);

          const rateAdmin: RataAdminDettaglio[] = dettagli.map((d) => ({
            id: d.id,
            rataTestataId: d.rata_testata_id,
            importoDovuto: Number(d.importo_dovuto) || 0,
            importoPagato: Number(d.importo_pagato) || 0,
            stato: d.stato,
            dataScadenza: testateMap.get(d.rata_testata_id) ?? oggi,
            unitaId: d.unita_id,
            utenteId: d.utente_id,
          }));

          for (const r of rateAdmin) {
            totaleDovutoEsercizio = arrotonda(totaleDovutoEsercizio + r.importoDovuto);
            totaleIncassatoEsercizio = arrotonda(totaleIncassatoEsercizio + r.importoPagato);
          }

          totaleDaRiscuotere = calcolaTotaleDaRiscuotere(rateAdmin);
          percentualeRiscossione = calcolaPercentualeRiscossione(totaleIncassatoEsercizio, totaleDovutoEsercizio);

          const riepilogoMorosita = calcolaMorositaScaduta(rateAdmin, oggi, 15);
          morositaScadutaOltre15gg = riepilogoMorosita.totaleMorosita;
          posizioniMoroseOltre15gg = riepilogoMorosita.posizioniMorose;
        }
      }

      // Ticket
      const tickets: TicketAdmin[] = ticketRighe.map((t) => ({
        id: t.id,
        titolo: t.titolo,
        priorita: t.priorita as PrioritaTicket,
        stato: t.stato as StatoTicket,
        isAreaComune: t.is_area_comune,
        unitaId: t.unita_id,
        createdAt: t.created_at,
      }));

      const riepilogoTicket = aggregaPrioritaTicket(tickets);
      const ticketUrgenti = ordinaTicketUrgenti(tickets, 5);

      // Prossima assemblea
      const assembleaGrezza = assemblee[0] ?? null;
      const prossimaAssemblea: AdminProssimaAssemblea | null = assembleaGrezza
        ? {
            id: assembleaGrezza.id,
            data: assembleaGrezza.data,
            tipo: assembleaGrezza.tipo,
            stato: assembleaGrezza.stato,
            luogo: assembleaGrezza.luogo,
            linkMeet: assembleaGrezza.link_meet,
          }
        : null;

      // Ultime comunicazioni
      const ultimeComunicazioni: AdminComunicazioneRecente[] = comunicazioniRighe.map((c) => ({
        id: c.id,
        titolo: c.titolo,
        corpo: c.corpo,
        dataPubblicazione: c.data_pubblicazione,
        isPinned: c.is_pinned,
      }));

      return {
        condominio: condominio
          ? {
              id: condominio.id,
              nome: condominio.nome,
              indirizzo: condominio.indirizzo,
              citta: condominio.citta,
            }
          : null,
        esercizioCorrente,
        kpi: {
          saldoCassa,
          totaleDaRiscuotere,
          totaleDovutoEsercizio,
          totaleIncassatoEsercizio,
          percentualeRiscossione,
          morositaScadutaOltre15gg,
          posizioniMoroseOltre15gg,
          ticketAperti: riepilogoTicket.aperti,
          ticketInLavorazione: riepilogoTicket.inLavorazione,
          ticketTotaliAttivi: riepilogoTicket.totaleAttivi,
          ticketUrgentiTotale: riepilogoTicket.urgenti,
          prossimaAssemblea,
        },
        ticketUrgenti,
        ultimeComunicazioni,
      };
    },
  };
}

