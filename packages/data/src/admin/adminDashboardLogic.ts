/**
 * Logica pura per la Dashboard dell'Amministratore (/admin/dashboard, Passo 1):
 * - calcolo percentuali riscossione dell'esercizio
 * - calcolo morosità scaduta da oltre 15 giorni
 * - aggregazione e ordinamento priorità ticket guasti
 * - helper formattazione e aggregazione
 *
 * File puro (nessuna dipendenza da React Native o Supabase): testabile con `node --test`.
 */

export type PrioritaTicket = 'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type StatoTicket = 'APERTO' | 'LAVORAZIONE' | 'RISOLTO';

export interface RataAdminDettaglio {
  id: string;
  rataTestataId: string;
  importoDovuto: number;
  importoPagato: number;
  stato: string;
  dataScadenza: string; // YYYY-MM-DD
  unitaId?: string | null;
  utenteId?: string | null;
}

export interface RiepilogoMorosita {
  totaleMorosita: number;
  posizioniMorose: number;
}

export interface TicketAdmin {
  id: string;
  titolo: string;
  priorita: PrioritaTicket;
  stato: StatoTicket;
  isAreaComune: boolean;
  unitaId?: string | null;
  createdAt: string;
}

export interface RiepilogoTicketAdmin {
  totaleAttivi: number;
  aperti: number;
  inLavorazione: number;
  risolti: number;
  urgenti: number;
  perPriorita: Record<PrioritaTicket, number>;
}

const PESO_PRIORITA: Record<PrioritaTicket, number> = {
  URGENTE: 4,
  ALTA: 3,
  MEDIA: 2,
  BASSA: 1,
};

const arrotonda2 = (valore: number): number => Math.round(valore * 100) / 100;

/**
 * Calcola la percentuale di riscossione arrotondata (0..100).
 * Se il totale dovuto è 0 o negativo restituisce 0.
 */
export function calcolaPercentualeRiscossione(totaleIncassato: number, totaleDovuto: number): number {
  if (!Number.isFinite(totaleDovuto) || totaleDovuto <= 0) return 0;
  if (!Number.isFinite(totaleIncassato) || totaleIncassato <= 0) return 0;
  const percentuale = Math.round((totaleIncassato / totaleDovuto) * 100);
  return Math.min(100, Math.max(0, percentuale));
}

/**
 * Differenza in giorni di calendario tra due date ISO 'YYYY-MM-DD' (data2 - data1).
 * Es: differenzaGiorni('2026-10-20', '2026-11-05') = 16.
 */
export function differenzaGiorni(daIso: string, aIso: string): number {
  const p1 = daIso.slice(0, 10).split('-');
  const p2 = aIso.slice(0, 10).split('-');
  if (p1.length < 3 || p2.length < 3) return 0;
  const d1 = Date.UTC(Number(p1[0]), Number(p1[1]) - 1, Number(p1[2]));
  const d2 = Date.UTC(Number(p2[0]), Number(p2[1]) - 1, Number(p2[2]));
  const diffMs = d2 - d1;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcola l'importo totale della morosità e il numero di posizioni scadute da più di sogliaGiorni (default: 15).
 * Conta solo le rate con residuo positivo e scadenza superata di oltre 15 giorni rispetto alla data `oggi`.
 */
export function calcolaMorositaScaduta(
  rate: readonly RataAdminDettaglio[],
  oggi: string,
  sogliaGiorni = 15,
): RiepilogoMorosita {
  let totaleMorosita = 0;
  let posizioniMorose = 0;

  for (const rata of rate) {
    if (rata.stato === 'PAGATO') continue;
    const residuo = arrotonda2(Math.max(0, rata.importoDovuto - rata.importoPagato));
    if (residuo <= 0) continue;

    const giorniTrascorsi = differenzaGiorni(rata.dataScadenza, oggi);
    if (giorniTrascorsi > sogliaGiorni) {
      totaleMorosita = arrotonda2(totaleMorosita + residuo);
      posizioniMorose += 1;
    }
  }

  return { totaleMorosita, posizioniMorose };
}

/**
 * Calcola il residuo complessivo da riscuotere tra tutte le rate dell'esercizio.
 */
export function calcolaTotaleDaRiscuotere(rate: readonly RataAdminDettaglio[]): number {
  let totale = 0;
  for (const rata of rate) {
    if (rata.stato === 'PAGATO') continue;
    const residuo = Math.max(0, rata.importoDovuto - rata.importoPagato);
    totale = arrotonda2(totale + residuo);
  }
  return totale;
}

/**
 * Aggrega conteggi di stato e priorità per i ticket.
 */
export function aggregaPrioritaTicket(tickets: readonly TicketAdmin[]): RiepilogoTicketAdmin {
  let aperti = 0;
  let inLavorazione = 0;
  let risolti = 0;
  let urgenti = 0;

  const perPriorita: Record<PrioritaTicket, number> = {
    URGENTE: 0,
    ALTA: 0,
    MEDIA: 0,
    BASSA: 0,
  };

  for (const t of tickets) {
    if (t.stato === 'RISOLTO') {
      risolti += 1;
      continue;
    }

    if (t.stato === 'APERTO') aperti += 1;
    else if (t.stato === 'LAVORAZIONE') inLavorazione += 1;

    perPriorita[t.priorita] = (perPriorita[t.priorita] ?? 0) + 1;
    if (t.priorita === 'URGENTE') urgenti += 1;
  }

  return {
    totaleAttivi: aperti + inLavorazione,
    aperti,
    inLavorazione,
    risolti,
    urgenti,
    perPriorita,
  };
}

/**
 * Filtra e ordina i ticket attivi (APERTO o LAVORAZIONE) per priorità decrescente
 * (URGENTE > ALTA > MEDIA > BASSA) e a parità di priorità per data decrescente.
 */
export function ordinaTicketUrgenti(tickets: readonly TicketAdmin[], limite = 5): TicketAdmin[] {
  return [...tickets]
    .filter((t) => t.stato !== 'RISOLTO')
    .sort((a, b) => {
      const pesoA = PESO_PRIORITA[a.priorita] ?? 0;
      const pesoB = PESO_PRIORITA[b.priorita] ?? 0;
      if (pesoA !== pesoB) return pesoB - pesoA;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, limite);
}

/**
 * Formatta lo stato dell'esercizio contabile per l'indicatore in header:
 * 'PREVENTIVO' -> 'Preventivo', 'CONSUNTIVO' -> 'Consuntivo', 'CHIUSO' -> 'Chiuso'.
 */
export function formattaStatoEsercizio(stato: string | null | undefined): string {
  if (!stato) return 'Non specificato';
  const maiuscolo = stato.toUpperCase();
  if (maiuscolo === 'PREVENTIVO') return 'Preventivo';
  if (maiuscolo === 'CONSUNTIVO') return 'Consuntivo';
  if (maiuscolo === 'CHIUSO') return 'Chiuso';
  return stato.charAt(0).toUpperCase() + stato.slice(1).toLowerCase();
}

/**
 * Formatta il tipo di assemblea: 'ORDINARIA' -> 'Ordinaria', 'STRAORDINARIA' -> 'Straordinaria'.
 */
export function formattaTipoAssemblea(tipo: string | null | undefined): string {
  if (!tipo) return 'Assemblea';
  const maiuscolo = tipo.toUpperCase();
  if (maiuscolo === 'ORDINARIA') return 'Ordinaria';
  if (maiuscolo === 'STRAORDINARIA') return 'Straordinaria';
  return tipo;
}

