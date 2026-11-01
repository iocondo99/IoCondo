/**
 * Logica della Home del condòmino: saluto, stato e totali delle rate, scadenze da mostrare.
 * File puro (solo tipi importati, nessuna dipendenza): si testa con `node --test`.
 */

/** Rata di un residente, già unita alla sua testata (descrizione e scadenza). */
export interface RataHome {
  id: string;
  descrizione: string;
  /** AAAA-MM-GG. */
  dataScadenza: string;
  importoDovuto: number;
  importoPagato: number;
  stato: 'DA_PAGARE' | 'PAGATO' | 'RITARDO';
}

/** Gli stessi nomi dei Badge di stato del design system. */
export type StatoRataHome = 'pagato' | 'scaduto' | 'in-corso' | 'da-pagare';

export interface ComunicazioneHome {
  id: string;
  titolo: string;
  corpo: string | null;
  dataPubblicazione: string;
  /** true solo se c'è una notifica non letta di questo utente collegata alla comunicazione. */
  nonLetta: boolean;
}

export interface AssembleaHome {
  id: string;
  /** Data e ora ISO. */
  data: string;
  tipo: 'ORDINARIA' | 'STRAORDINARIA';
  luogo: string | null;
}

/** Data locale AAAA-MM-GG (non UTC: a mezzanotte il giorno cambia per chi la guarda). */
export function oggiIso(data: Date = new Date()): string {
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mese}-${giorno}`;
}

/** Buongiorno fino alle 12:59, Buon pomeriggio fino alle 17:59, poi Buonasera (e di notte, fino alle 4:59). */
export function saluto(data: Date = new Date()): string {
  const ora = data.getHours();
  if (ora >= 5 && ora < 13) return 'Buongiorno';
  if (ora >= 13 && ora < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/** Primo nome dal nome completo del profilo ("Maria Rossi" → "Maria"); nessun nome → null. */
export function primoNome(nomeCompleto: string | null | undefined): string | null {
  const nome = nomeCompleto?.trim().split(/\s+/)[0];
  return nome ? nome : null;
}

/** "Buongiorno, Maria!" oppure, se il profilo non ha un nome, solo "Buongiorno!". */
export function titoloSaluto(nomeCompleto: string | null | undefined, data: Date = new Date()): string {
  const nome = primoNome(nomeCompleto);
  return nome ? `${saluto(data)}, ${nome}!` : `${saluto(data)}!`;
}

const arrotonda = (valore: number) => Math.round(valore * 100) / 100;

/** Quanto resta da pagare di una rata (0 se è pagata). */
export function residuo(rata: RataHome): number {
  if (rata.stato === 'PAGATO') return 0;
  return Math.max(0, arrotonda(rata.importoDovuto - rata.importoPagato));
}

/**
 * Stato da mostrare. "Scaduto": stato RITARDO oppure scadenza passata e non pagata. "In corso": non scaduta ma
 * già pagata in parte. Il pagamento online non esiste ancora (Fase 2): non ci sono stati "in attesa".
 */
export function statoRata(rata: RataHome, oggi: string): StatoRataHome {
  if (rata.stato === 'PAGATO') return 'pagato';
  if (rata.stato === 'RITARDO' || rata.dataScadenza < oggi) return 'scaduto';
  if (rata.importoPagato > 0) return 'in-corso';
  return 'da-pagare';
}

export interface RiepilogoSpese {
  totaleDaPagare: number;
  totaleScaduto: number;
  /** Quante rate hanno ancora qualcosa da pagare. */
  rateDaPagare: number;
  rateScadute: number;
}

export function riepilogoSpese(rate: readonly RataHome[], oggi: string): RiepilogoSpese {
  let totaleDaPagare = 0;
  let totaleScaduto = 0;
  let rateDaPagare = 0;
  let rateScadute = 0;
  for (const rata of rate) {
    const resto = residuo(rata);
    if (resto <= 0) continue;
    rateDaPagare += 1;
    totaleDaPagare += resto;
    if (statoRata(rata, oggi) === 'scaduto') {
      rateScadute += 1;
      totaleScaduto += resto;
    }
  }
  return {
    totaleDaPagare: arrotonda(totaleDaPagare),
    totaleScaduto: arrotonda(totaleScaduto),
    rateDaPagare,
    rateScadute,
  };
}

export interface ScadenzeHome {
  /** Non pagate e già scadute: le più vecchie prima. */
  scadute: RataHome[];
  /** Non pagate con scadenza futura, e già pagate con scadenza futura: per data. */
  prossime: RataHome[];
  /** Quante rate da mostrare non entrano nel limite (le trovi nella pagina Pagamenti). */
  nascoste: number;
}

const perData = (a: RataHome, b: RataHome) =>
  a.dataScadenza.localeCompare(b.dataScadenza) || a.descrizione.localeCompare(b.descrizione);

/**
 * Cosa mostrare in "Prossime scadenze": prima le scadute (distinte dalle future), poi le prossime, in tutto
 * al massimo `massimo` righe. Le rate pagate con scadenza già passata non servono più e restano fuori.
 */
export function scadenzeHome(rate: readonly RataHome[], oggi: string, massimo = 5): ScadenzeHome {
  const scadute = rate.filter((r) => statoRata(r, oggi) === 'scaduto').sort(perData);
  const prossime = rate
    .filter((r) => {
      const stato = statoRata(r, oggi);
      return stato !== 'scaduto' && (stato !== 'pagato' || r.dataScadenza >= oggi);
    })
    .sort(perData);
  const totale = scadute.length + prossime.length;
  const scaduteViste = scadute.slice(0, massimo);
  const prossimeViste = prossime.slice(0, Math.max(0, massimo - scaduteViste.length));
  return {
    scadute: scaduteViste,
    prossime: prossimeViste,
    nascoste: totale - scaduteViste.length - prossimeViste.length,
  };
}

/** Anteprima di una comunicazione: una riga di testo, senza a capo, tagliata in modo pulito. */
export function estrattoCorpo(corpo: string | null | undefined, massimo = 110): string {
  const pulito = (corpo ?? '').replace(/\s+/g, ' ').trim();
  if (pulito.length <= massimo) return pulito;
  const taglio = pulito.slice(0, massimo).replace(/\s+\S*$/, '').trimEnd();
  return `${taglio || pulito.slice(0, massimo)}…`;
}

/** La descrizione sotto il numero dei documenti. */
export function descrizioneDocumenti(quanti: number): string {
  return quanti === 1 ? 'Documento disponibile' : 'Documenti disponibili';
}

export function descrizioneComunicazioni(nonLette: number): string {
  if (nonLette === 0) return 'Non hai nuove comunicazioni';
  return nonLette === 1 ? 'Nuova comunicazione' : 'Nuove comunicazioni';
}

/** Filtro PostgREST (`.or(...)`): solo i campi nulli oppure i valori indicati. Gli id vengono dal database. */
export function filtroNulloOppureIn(campo: string, valori: readonly string[]): string {
  const sicuri = valori.filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  return sicuri.length > 0 ? `${campo}.is.null,${campo}.in.(${sicuri.join(',')})` : `${campo}.is.null`;
}
