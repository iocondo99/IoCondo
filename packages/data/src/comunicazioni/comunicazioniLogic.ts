/**
 * Logica pura della pagina Comunicazioni del condòmino: stato di lettura dalle notifiche,
 * visibilità per condominio/palazzo, filtri, ordinamento (post fissati in cima, poi per data),
 * paginazione e testi per l'interfaccia.
 *
 * File volutamente puro (nessun import da react-native o Supabase): si testa con `node --test`.
 * Niente `Intl` né `localeCompare` (Hermes): stesso risultato su web, Android e iOS.
 */

import type { OrdineColonna } from '../pagamenti/pagamentiLogic.ts';

// ─── Tipi ────────────────────────────────────────────────────────────────────

/**
 * Stato di lettura di una comunicazione per l'utente corrente:
 * - `non-letta`: c'è almeno una notifica dell'utente collegata al post con `letta = false`
 * - `letta`: c'è almeno una notifica dell'utente collegata al post e tutte hanno `letta = true`
 * - `nessuna`: non esiste alcuna notifica dell'utente collegata al post (non si inventa "letto")
 */
export type StatoLetturaComunicazione = 'non-letta' | 'letta' | 'nessuna';

export type FiltroStatoComunicazioni = 'tutti' | 'non-lette' | 'lette';

export interface FiltriComunicazioni {
  stato: FiltroStatoComunicazioni;
  ricerca: string;
}

/**
 * Ordine dell'elenco:
 * - `predefinito`: i post fissati (`fissato = true`) in cima, poi dal più recente al più vecchio
 * - `data-desc`: i post fissati in cima, poi dal più recente al più vecchio
 * - `data-asc`: i post fissati in cima, poi dal più vecchio al più recente
 */
export type OrdineComunicazioni = 'predefinito' | 'data-asc' | 'data-desc';

/** Riga dell'elenco comunicazioni pronta per la UI. */
export interface ComunicazioneRiga {
  id: string;
  titolo: string;
  corpo: string | null;
  /** Data e ora ISO (`timestamptz`) o `AAAA-MM-GG`. */
  dataPubblicazione: string;
  fissato: boolean;
  autoreNome: string | null;
  statoLettura: StatoLetturaComunicazione;
}

/** Dettaglio completo di una comunicazione. */
export interface DettaglioComunicazione extends ComunicazioneRiga {
  /** Nome dell'edificio se il post riguarda un solo palazzo; `null` se riguarda tutto il condominio. */
  palazzoNome: string | null;
}

export interface PaginaComunicazioni {
  comunicazioni: readonly ComunicazioneRiga[];
  totaleFiltrati: number;
  pagina: number;
  numeroPagine: number;
}

export const PER_PAGINA_COMUNICAZIONI = 10;

/** Voci di FilterChips per lo stato di lettura (il chip "Tutti" lo aggiunge FilterChips). */
export const OPZIONI_STATO_COMUNICAZIONI: readonly {
  value: Exclude<FiltroStatoComunicazioni, 'tutti'>;
  label: string;
}[] = [
  { value: 'non-lette', label: 'Non lette' },
  { value: 'lette', label: 'Lette' },
];

// ─── Stato di lettura dalle notifiche ────────────────────────────────────────

/**
 * Ricava lo stato di lettura dalle notifiche dell'utente collegate a uno specifico post.
 * Se non ci sono notifiche collegate, restituisce `'nessuna'` senza inventare `'letta'`.
 */
export function statoLetturaDaNotifiche(notifichePost: readonly { letta: boolean }[]): StatoLetturaComunicazione {
  if (notifichePost.length === 0) return 'nessuna';
  if (notifichePost.some((n) => !n.letta)) return 'non-letta';
  return 'letta';
}

/**
 * Raggruppa le notifiche (`riferimento_tabella = 'bacheca_post'`) per `riferimento_id`
 * e restituisce la mappa `postId -> StatoLetturaComunicazione`.
 */
export function mappaStatoLettura(
  notifiche: readonly { riferimento_id: string | null; letta: boolean }[],
): ReadonlyMap<string, StatoLetturaComunicazione> {
  const gruppi = new Map<string, { letta: boolean }[]>();
  for (const n of notifiche) {
    const postId = n.riferimento_id?.trim();
    if (!postId) continue;
    const lista = gruppi.get(postId);
    if (lista) {
      lista.push({ letta: Boolean(n.letta) });
    } else {
      gruppi.set(postId, [{ letta: Boolean(n.letta) }]);
    }
  }
  const mappa = new Map<string, StatoLetturaComunicazione>();
  for (const [postId, lista] of gruppi.entries()) {
    mappa.set(postId, statoLetturaDaNotifiche(lista));
  }
  return mappa;
}

// ─── Visibilità e sicurezza ──────────────────────────────────────────────────

/**
 * Verifica in difesa in profondità che un post appartenga al condominio selezionato,
 * sia destinato a tutto il condominio (`palazzo_id === null`) o a uno dei palazzi dell'utente,
 * e sia già pubblicato (`data_pubblicazione <= adesso`).
 */
export function comunicazioneVisibileA(
  post: {
    condominio_id: string;
    palazzo_id: string | null;
    data_pubblicazione: string;
  },
  condominioId: string,
  palazziUtente: readonly string[],
  adessoIso?: string,
): boolean {
  if (!condominioId || post.condominio_id !== condominioId) return false;
  if (post.palazzo_id !== null && !palazziUtente.includes(post.palazzo_id)) return false;
  if (adessoIso) {
    const tPost = Date.parse(post.data_pubblicazione);
    const tAdesso = Date.parse(adessoIso);
    if (!Number.isNaN(tPost) && !Number.isNaN(tAdesso) && tPost > tAdesso) return false;
  }
  return true;
}

// ─── Filtri ──────────────────────────────────────────────────────────────────

export function filtraComunicazioniPerStato(
  righe: readonly ComunicazioneRiga[],
  filtro: FiltroStatoComunicazioni,
): readonly ComunicazioneRiga[] {
  if (filtro === 'tutti') return righe;
  if (filtro === 'non-lette') return righe.filter((r) => r.statoLettura === 'non-letta');
  if (filtro === 'lette') return righe.filter((r) => r.statoLettura === 'letta');
  return righe;
}

export function filtraComunicazioniPerRicerca(
  righe: readonly ComunicazioneRiga[],
  testo: string,
): readonly ComunicazioneRiga[] {
  const pulito = testo.trim().toLowerCase();
  if (!pulito) return righe;
  return righe.filter((r) => r.titolo.toLowerCase().includes(pulito));
}

/** Quanti filtri sono attivi (stato diverso da `'tutti'` e ricerca non vuota). */
export function filtriComunicazioniAttivi(filtri: FiltriComunicazioni): number {
  return (filtri.stato !== 'tutti' ? 1 : 0) + (filtri.ricerca.trim() ? 1 : 0);
}

// ─── Ordinamento ─────────────────────────────────────────────────────────────

const ORDINE_DA_COLONNA: Record<string, { ascending: OrdineComunicazioni; descending: OrdineComunicazioni }> = {
  data: { ascending: 'data-asc', descending: 'data-desc' },
};

/** Da ordinamento della colonna `"data"` (o nessuno) all'ordine dell'elenco. */
export function ordineComunicazioniDaColonna(sort: OrdineColonna | null): OrdineComunicazioni {
  if (!sort) return 'predefinito';
  return ORDINE_DA_COLONNA[sort.key]?.[sort.direction] ?? 'predefinito';
}

/** Inverso di `ordineComunicazioniDaColonna` per mostrare la freccia sull'intestazione della tabella. */
export function colonnaDaOrdineComunicazioni(ordine: OrdineComunicazioni): OrdineColonna | null {
  for (const [key, versi] of Object.entries(ORDINE_DA_COLONNA)) {
    if (versi.ascending === ordine) return { key, direction: 'ascending' };
    if (versi.descending === ordine) return { key, direction: 'descending' };
  }
  return null;
}

/** Confronto di stringhe senza `Intl`: minuscole, poi ordine lessicografico. */
function confrontaTesto(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Confronta due date ISO per istante temporale (o lessicograficamente se non parsabili). */
function confrontaData(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
    return ta < tb ? -1 : 1;
  }
  return confrontaTesto(a, b);
}

const perTitoloEId = (a: ComunicazioneRiga, b: ComunicazioneRiga) =>
  confrontaTesto(a.titolo, b.titolo) || confrontaTesto(a.id, b.id);

/**
 * Ordina una copia delle comunicazioni:
 * 1. I post fissati (`fissato = true`) stanno sempre in cima.
 * 2. A parità di stato fissato, ordina per data (più recenti prima in `predefinito` e `data-desc`,
 *    più vecchi prima in `data-asc`), con spareggio stabile su titolo e id.
 */
export function ordinaComunicazioni(
  righe: readonly ComunicazioneRiga[],
  ordine: OrdineComunicazioni,
): readonly ComunicazioneRiga[] {
  const copia = [...righe];
  return copia.sort((a, b) => {
    if (a.fissato !== b.fissato) return a.fissato ? -1 : 1;
    if (ordine === 'data-asc') {
      return confrontaData(a.dataPubblicazione, b.dataPubblicazione) || perTitoloEId(a, b);
    }
    return confrontaData(b.dataPubblicazione, a.dataPubblicazione) || perTitoloEId(a, b);
  });
}

// ─── Paginazione ─────────────────────────────────────────────────────────────

export function numeroPagineComunicazioni(totale: number, perPagina = PER_PAGINA_COMUNICAZIONI): number {
  if (totale <= 0 || perPagina <= 0) return 1;
  return Math.ceil(totale / perPagina);
}

export function limitaPaginaComunicazioni(pagina: number, numeroPagine: number): number {
  const tot = Math.max(1, Math.floor(numeroPagine));
  const p = Math.floor(pagina);
  if (Number.isNaN(p) || p < 1) return 1;
  if (p > tot) return tot;
  return p;
}

/** Catena completa: filtri → ordinamento → paginazione. */
export function paginaComunicazioni(
  righe: readonly ComunicazioneRiga[],
  filtri: FiltriComunicazioni,
  ordine: OrdineComunicazioni,
  pagina: number,
  perPagina = PER_PAGINA_COMUNICAZIONI,
): PaginaComunicazioni {
  const perStato = filtraComunicazioniPerStato(righe, filtri.stato);
  const cercate = filtraComunicazioniPerRicerca(perStato, filtri.ricerca);
  const ordinate = ordinaComunicazioni(cercate, ordine);
  const nPagine = numeroPagineComunicazioni(ordinate.length, perPagina);
  const paginaValida = limitaPaginaComunicazioni(pagina, nPagine);
  const inizio = (paginaValida - 1) * perPagina;
  return {
    comunicazioni: ordinate.slice(inizio, inizio + perPagina),
    totaleFiltrati: ordinate.length,
    pagina: paginaValida,
    numeroPagine: nPagine,
  };
}

// ─── Testi per la UI ─────────────────────────────────────────────────────────

/** Sottotitolo di PageHeader nella pagina Comunicazioni. */
export function sottotitoloComunicazioni(nomeCondominio: string | null | undefined): string {
  const nome = nomeCondominio?.trim();
  return nome ? `${nome} — avvisi e comunicazioni` : 'Avvisi e comunicazioni del condominio.';
}

/** Testo della colonna Autore: il nome se disponibile, altrimenti `'—'`. */
export function etichettaAutore(autoreNome: string | null | undefined): string {
  const nome = autoreNome?.trim();
  return nome ? nome : '—';
}

/** Testo dello stato di lettura per screen reader e celle testuali. */
export function etichettaStatoLettura(stato: StatoLetturaComunicazione): string {
  if (stato === 'non-letta') return 'Non letto';
  if (stato === 'letta') return 'Letta';
  return '—';
}

/** Etichetta accessibile completa di una riga dell'elenco comunicazioni. */
export function etichettaRigaComunicazione(c: ComunicazioneRiga, dataFormattata: string): string {
  const parti = [c.titolo];
  if (c.fissato) parti.push('Fissata in alto');
  parti.push(`pubblicata il ${dataFormattata}`);
  if (c.autoreNome?.trim()) parti.push(`autore ${c.autoreNome.trim()}`);
  if (c.statoLettura === 'non-letta') parti.push('Non letto');
  else if (c.statoLettura === 'letta') parti.push('Letta');
  return parti.join(', ');
}

