/**
 * Logica pura per la sezione Segnalazioni del condòmino (`/segnalazioni` e `/segnalazioni/[id]`,
 * REQ-C03 e REQ-C04) e per i Ticket aree comuni del portiere (`/ticket-aree-comuni`):
 * - isolamento lato client nella vista residente:
 *   - condòmino (`/segnalazioni`): solo ticket del condominio selezionato aperti dall'utente
 *     (`segnalatore_id = userId`) oppure associati a una sua unità attiva (`unita_id IN unitaDelResidente`),
 *     anche se l'utente ha ruolo `ADMIN` o `is_superadmin` (coerente con `homeService.ticketRecenti`);
 *   - portiere (`/ticket-aree-comuni`): solo ticket del condominio selezionato con
 *     `is_area_comune = true` (più quelli aperti dal portiere stesso nel condominio);
 * - stati del ticket (`APERTO`, `LAVORAZIONE`, `RISOLTO`), priorità (`BASSA`, `MEDIA`, `ALTA`, `URGENTE`),
 *   ambito (`Area comune` vs `Unità Int. <interno>`), conteggi per le `StatCard`;
 * - filtri per stato (`Tutti`, `Aperti`, `In lavorazione`, `Risolti`), ricerca per titolo/categoria/ambito,
 *   ordinamento per data di apertura (`created_at`), stato e priorità, paginazione;
 * - validazione del modulo di apertura segnalazione (titolo obbligatorio non vuoto con lunghezza massima,
 *   descrizione, categoria opzionale, ambito propria unità o area comune, allegati fotografici
 *   JPEG/PNG/WEBP/HEIC max 15 MB e percorso Storage `<condominio_id>/<ticket_id>/<nome_file_sanificato>`
 *   senza `..`).
 *
 * File puro (nessuna dipendenza da React Native o Supabase): eseguibile con `node --test`.
 * Nessun uso di `Intl` o `localeCompare` (compatibilità Hermes).
 */

export type PrioritaTicket = 'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type StatoTicket = 'APERTO' | 'LAVORAZIONE' | 'RISOLTO';
export type TipoFileTicket = 'FOTO' | 'FATTURA' | 'ALTRO';

export const BUCKET_FOTO_GUASTI = 'foto-guasti';
export const DURATA_LINK_FOTO_SECONDI = 600;
export const PER_PAGINA_SEGNALAZIONI = 10;

export const MAX_LUNGHEZZA_TITOLO_TICKET = 120;
export const MAX_LUNGHEZZA_DESCRIZIONE_TICKET = 2000;
export const MAX_LUNGHEZZA_MESSAGGIO_TICKET = 1000;
export const MAX_DIMENSIONE_FOTO_BYTES = 15 * 1024 * 1024; // 15 MB = 15728640 byte
export const MAX_FOTO_PER_TICKET = 5;

export const TIPI_MIME_FOTO_AMMESSI = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export const ESTENSIONI_FOTO_AMMESSE = ['.jpg', '.jpeg', '.png', '.webp', '.heic'] as const;

export const ACCEPT_FOTO_TICKET = [
  ...TIPI_MIME_FOTO_AMMESSI,
  ...ESTENSIONI_FOTO_AMMESSE,
] as const;

export const MESSAGGIO_FOTO_NON_DISPONIBILE =
  'Foto non ancora disponibile nello spazio di archiviazione';

export type ModalitaSegnalazioni = 'condomino' | 'portiere';

export type StatoBadgeTicket = 'aperto' | 'in_lavorazione' | 'risolto';

export type FiltroStatoSegnalazioni = 'tutti' | 'APERTO' | 'LAVORAZIONE' | 'RISOLTO';

export type OrdineSegnalazioni =
  | 'data-desc'
  | 'data-asc'
  | 'stato-asc'
  | 'stato-desc'
  | 'priorita-desc'
  | 'priorita-asc';

/** Stesso formato di `SortState` di `@iocondo/ui`. */
export interface OrdineColonnaSegnalazioni {
  key: string;
  direction: 'ascending' | 'descending';
}

export interface CategoriaGuasto {
  id: string;
  nome: string;
}

export interface UnitaResidenteOpzione {
  id: string;
  interno: string;
  scala: string | null;
  piano: string | null;
  etichetta: string;
}

export interface SegnalazioneRiepilogo {
  id: string;
  condominioId: string;
  unitaId: string | null;
  unitaInterno: string | null;
  segnalatoreId: string | null;
  categoriaId: string | null;
  categoriaNome: string | null;
  titolo: string;
  descrizione: string | null;
  isAreaComune: boolean;
  etichettaAmbito: string;
  priorita: PrioritaTicket;
  etichettaPriorita: string;
  stato: StatoTicket;
  etichettaStato: string;
  statoBadge: StatoBadgeTicket;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface MessaggioTicket {
  id: string;
  ticketId: string;
  mittenteId: string | null;
  mittenteNome: string;
  isProprioMessaggio: boolean;
  messaggio: string;
  timestamp: string;
}

export interface AllegatoTicket {
  id: string;
  ticketId: string;
  urlStorage: string;
  nomeFile: string;
  percorsoStorage: string | null;
  tipoFile: TipoFileTicket;
  caricatoDa: string | null;
  createdAt: string;
  disponibileNelloStorage: boolean;
  signedUrl: string | null;
}

export interface DettaglioSegnalazione extends SegnalazioneRiepilogo {
  segnalatoreNome: string;
  messaggi: MessaggioTicket[];
  allegati: AllegatoTicket[];
}

export interface RiepilogoSegnalazioni {
  totale: number;
  aperte: number;
  inLavorazione: number;
  risolte: number;
  areeComuni: number;
  unitaPropria: number;
}

export interface FiltriSegnalazioni {
  stato: FiltroStatoSegnalazioni;
  ricerca: string;
}

export interface OpzioneFiltroStato {
  value: FiltroStatoSegnalazioni;
  label: string;
  count: number;
}

export interface PaginaSegnalazioni {
  segnalazioni: SegnalazioneRiepilogo[];
  totaleFiltrati: number;
  pagina: number;
  numeroPagine: number;
}

export interface FotoAllegatoInput {
  name: string;
  size: number;
  type?: string;
}

export interface InputNuovaSegnalazione {
  titolo: string;
  descrizione?: string | null;
  categoriaId?: string | null;
  isAreaComune: boolean;
  unitaId?: string | null;
  priorita?: PrioritaTicket | null;
  allegati?: readonly FotoAllegatoInput[];
}

export interface DatiNuovaSegnalazioneValidati {
  titolo: string;
  descrizione: string | null;
  categoriaId: string | null;
  isAreaComune: boolean;
  unitaId: string | null;
  priorita: PrioritaTicket;
}

export type RisultatoValidazioneSegnalazione =
  | { valido: true; dati: DatiNuovaSegnalazioneValidati; errori: Record<string, never> }
  | { valido: false; errori: Partial<Record<'titolo' | 'descrizione' | 'ambito' | 'priorita' | 'allegati', string>> };

const ORDINE_DA_COLONNA_SEGNALAZIONI: Record<
  string,
  { ascending: OrdineSegnalazioni; descending: OrdineSegnalazioni }
> = {
  data: { ascending: 'data-asc', descending: 'data-desc' },
  stato: { ascending: 'stato-asc', descending: 'stato-desc' },
  priorita: { ascending: 'priorita-asc', descending: 'priorita-desc' },
};

const PESO_STATO_TICKET: Record<StatoTicket, number> = {
  APERTO: 1,
  LAVORAZIONE: 2,
  RISOLTO: 3,
};

const PESO_PRIORITA_TICKET: Record<PrioritaTicket, number> = {
  BASSA: 1,
  MEDIA: 2,
  ALTA: 3,
  URGENTE: 4,
};

/** Confronto lessicografico ASCII sicuro su Hermes (senza `Intl` né `localeCompare`). */
function confrontaTesto(a: string, b: string): number {
  const sinistro = a.toLowerCase();
  const destro = b.toLowerCase();
  if (sinistro < destro) return -1;
  if (sinistro > destro) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Confronta due date ISO per istante temporale (o lessicograficamente se non parsabili). */
function confrontaDataIso(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
    return ta < tb ? -1 : 1;
  }
  return confrontaTesto(a, b);
}

// ─── Isolamento lato client nella vista residente ────────────────────────────

/**
 * Filtro PostgREST (`.or(...)`) per `ticket_testata` nella vista condòmino (`/segnalazioni`):
 * ticket aperti dall'utente (`segnalatore_id = userId`) oppure associati a una sua unità attiva,
 * esattamente coerente con `homeService.ticketRecenti`.
 */
export function filtroTicketCondominoPostgrest(
  userId: string,
  unitaResidenteIds: readonly string[],
): string {
  const filtri = [`segnalatore_id.eq.${userId}`];
  if (unitaResidenteIds.length > 0) {
    filtri.push(`unita_id.in.(${unitaResidenteIds.join(',')})`);
  }
  return filtri.join(',');
}

/**
 * Filtro PostgREST (`.or(...)`) per `ticket_testata` nella vista portiere (`/ticket-aree-comuni`):
 * ticket su area comune (`is_area_comune = true`) oppure aperti dal portiere stesso (`segnalatore_id = userId`).
 */
export function filtroTicketPortierePostgrest(userId: string): string {
  return `is_area_comune.eq.true,segnalatore_id.eq.${userId}`;
}

export interface TicketIsolamentoInput {
  condominioId: string;
  segnalatoreId: string | null;
  unitaId: string | null;
  isAreaComune: boolean;
}

/**
 * Verifica in difesa in profondità se un ticket è visibile al condòmino (`/segnalazioni`):
 * 1. deve appartenere al condominio selezionato (`condominioId`);
 * 2. deve essere stato aperto dall'utente (`segnalatoreId === userId`) oppure associato a una
 *    sua unità attiva nel condominio (`unitaId !== null && unitaResidenteIds.includes(unitaId)`).
 * Anche se l'utente possiede ruolo `ADMIN` o `is_superadmin`, in vista residente vede solo questi ticket.
 */
export function ticketVisibileACondomino(
  ticket: TicketIsolamentoInput | null | undefined,
  userId: string,
  condominioId: string,
  unitaResidenteIds: readonly string[],
): boolean {
  if (!ticket || !userId || !condominioId) return false;
  if (ticket.condominioId !== condominioId) return false;
  if (ticket.segnalatoreId === userId) return true;
  if (ticket.unitaId !== null && unitaResidenteIds.includes(ticket.unitaId)) {
    return true;
  }
  return false;
}

/**
 * Verifica in difesa in profondità se un ticket è visibile al portiere (`/ticket-aree-comuni`):
 * 1. deve appartenere al condominio selezionato (`condominioId`);
 * 2. deve riguardare un'area comune (`isAreaComune === true`) oppure essere stato aperto dal portiere stesso.
 */
export function ticketVisibileAPortiere(
  ticket: TicketIsolamentoInput | null | undefined,
  userId: string,
  condominioId: string,
): boolean {
  if (!ticket || !userId || !condominioId) return false;
  if (ticket.condominioId !== condominioId) return false;
  if (ticket.isAreaComune) return true;
  if (ticket.segnalatoreId === userId) return true;
  return false;
}

/**
 * Verifica se un ticket è visibile nella modalità richiesta (`condomino` vs `portiere`).
 */
export function ticketVisibileInModalita(
  ticket: TicketIsolamentoInput | null | undefined,
  userId: string,
  condominioId: string,
  unitaResidenteIds: readonly string[],
  modalita: ModalitaSegnalazioni,
): boolean {
  if (modalita === 'portiere') {
    return ticketVisibileAPortiere(ticket, userId, condominioId);
  }
  return ticketVisibileACondomino(ticket, userId, condominioId, unitaResidenteIds);
}

/** Filtra un elenco di ticket mantenendo solo quelli visibili al condòmino nel condominio selezionato. */
export function filtraTicketVisibiliCondomino<T extends TicketIsolamentoInput>(
  tickets: readonly T[],
  userId: string,
  condominioId: string,
  unitaResidenteIds: readonly string[],
): T[] {
  return tickets.filter((t) =>
    ticketVisibileACondomino(t, userId, condominioId, unitaResidenteIds),
  );
}

/** Filtra un elenco di ticket mantenendo solo quelli visibili al portiere nel condominio selezionato. */
export function filtraTicketVisibiliPortiere<T extends TicketIsolamentoInput>(
  tickets: readonly T[],
  userId: string,
  condominioId: string,
): T[] {
  return tickets.filter((t) => ticketVisibileAPortiere(t, userId, condominioId));
}

// ─── Stati, priorità, ambito e riepilogo StatCard ────────────────────────────

export function statoBadgeDaStatoTicket(stato: StatoTicket): StatoBadgeTicket {
  switch (stato) {
    case 'APERTO':
      return 'aperto';
    case 'LAVORAZIONE':
      return 'in_lavorazione';
    case 'RISOLTO':
      return 'risolto';
  }
}

export function etichettaStatoTicket(stato: StatoTicket): string {
  switch (stato) {
    case 'APERTO':
      return 'Aperto';
    case 'LAVORAZIONE':
      return 'In lavorazione';
    case 'RISOLTO':
      return 'Risolto';
  }
}

export function etichettaPrioritaTicket(priorita: PrioritaTicket): string {
  switch (priorita) {
    case 'BASSA':
      return 'Bassa';
    case 'MEDIA':
      return 'Media';
    case 'ALTA':
      return 'Alta';
    case 'URGENTE':
      return 'Urgente';
  }
}

/**
 * Etichetta sintetica dell'ambito del ticket:
 * - `'Area comune'` se `isAreaComune` è `true` o `unitaId` è `null`;
 * - `'Unità Int. <interno>'` (o `'Unità propria'` se l'interno non è noto) se associato a un'unità.
 */
export function etichettaAmbitoTicket(
  isAreaComune: boolean,
  unitaId: string | null | undefined,
  unitaInterno?: string | null,
): string {
  if (isAreaComune || !unitaId) return 'Area comune';
  const interno = unitaInterno?.trim();
  if (!interno) return 'Unità propria';
  if (/^unit[aà](\s|$)/i.test(interno)) return interno;
  if (/^int\.?\s*/i.test(interno)) return `Unità ${interno}`;
  return `Unità Int. ${interno}`;
}

/** Costruisce l'etichetta leggibile di un'unità immobiliare per il selettore di ambito. */
export function formattaEtichettaUnita(unita: {
  interno: string;
  scala?: string | null;
  piano?: string | null;
}): string {
  const parti = [`Unità Int. ${unita.interno.trim()}`];
  if (unita.scala?.trim()) parti.push(`Scala ${unita.scala.trim()}`);
  if (unita.piano?.trim()) parti.push(`Piano ${unita.piano.trim()}`);
  return parti.join(' · ');
}

/**
 * Calcola i conteggi reali per le `StatCard` in cima a `/segnalazioni` e `/ticket-aree-comuni`:
 * totale segnalazioni, aperte (`APERTO`), in lavorazione (`LAVORAZIONE`), risolte (`RISOLTO`),
 * su area comune e su propria unità.
 */
export function riepilogoSegnalazioni(
  segnalazioni: readonly Pick<SegnalazioneRiepilogo, 'stato' | 'isAreaComune' | 'unitaId'>[],
): RiepilogoSegnalazioni {
  let aperte = 0;
  let inLavorazione = 0;
  let risolte = 0;
  let areeComuni = 0;
  let unitaPropria = 0;

  for (const s of segnalazioni) {
    if (s.stato === 'APERTO') aperte += 1;
    else if (s.stato === 'LAVORAZIONE') inLavorazione += 1;
    else if (s.stato === 'RISOLTO') risolte += 1;

    if (s.isAreaComune || s.unitaId === null) {
      areeComuni += 1;
    } else {
      unitaPropria += 1;
    }
  }

  return {
    totale: segnalazioni.length,
    aperte,
    inLavorazione,
    risolte,
    areeComuni,
    unitaPropria,
  };
}

// ─── Filtri, ricerca, ordinamento e paginazione ──────────────────────────────

/**
 * Opzioni per i `FilterChips` per stato:
 * `Tutti`, `Aperti`, `In lavorazione`, `Risolti` con i rispettivi conteggi reali.
 */
export function opzioniFiltroStatoSegnalazioni(
  segnalazioni: readonly Pick<SegnalazioneRiepilogo, 'stato'>[],
): OpzioneFiltroStato[] {
  let aperti = 0;
  let inLavorazione = 0;
  let risolti = 0;

  for (const s of segnalazioni) {
    if (s.stato === 'APERTO') aperti += 1;
    else if (s.stato === 'LAVORAZIONE') inLavorazione += 1;
    else if (s.stato === 'RISOLTO') risolti += 1;
  }

  return [
    { value: 'tutti', label: 'Tutti', count: segnalazioni.length },
    { value: 'APERTO', label: 'Aperti', count: aperti },
    { value: 'LAVORAZIONE', label: 'In lavorazione', count: inLavorazione },
    { value: 'RISOLTO', label: 'Risolti', count: risolti },
  ];
}

/** Quanti filtri sono attivi (stato specifico selezionato + ricerca testuale non vuota). */
export function filtriSegnalazioniAttivi(filtri: FiltriSegnalazioni): number {
  const haStato = Boolean(filtri.stato && filtri.stato !== 'tutti');
  const haRicerca = filtri.ricerca.trim().length > 0;
  return (haStato ? 1 : 0) + (haRicerca ? 1 : 0);
}

/**
 * Filtra le segnalazioni per stato (`'tutti'` oppure `'APERTO'` | `'LAVORAZIONE'` | `'RISOLTO'`)
 * e per ricerca testuale su titolo, categoria, ambito e descrizione.
 */
export function filtraSegnalazioni(
  segnalazioni: readonly SegnalazioneRiepilogo[],
  filtri: FiltriSegnalazioni,
): SegnalazioneRiepilogo[] {
  const statoFiltro = filtri.stato;
  const termine = filtri.ricerca.trim().toLowerCase();

  return segnalazioni.filter((s) => {
    if (statoFiltro && statoFiltro !== 'tutti' && s.stato !== statoFiltro) {
      return false;
    }
    if (!termine) return true;
    const titoloMatch = s.titolo.toLowerCase().includes(termine);
    const categoriaMatch = (s.categoriaNome ?? 'Generale').toLowerCase().includes(termine);
    const ambitoMatch = s.etichettaAmbito.toLowerCase().includes(termine);
    const descrizioneMatch = (s.descrizione ?? '').toLowerCase().includes(termine);
    return titoloMatch || categoriaMatch || ambitoMatch || descrizioneMatch;
  });
}

/** Da stato di ordinamento colonna (`SortState`) a `OrdineSegnalazioni`. */
export function ordineDaColonnaSegnalazioni(
  sort: OrdineColonnaSegnalazioni | null,
): OrdineSegnalazioni {
  if (!sort) return 'data-desc';
  return ORDINE_DA_COLONNA_SEGNALAZIONI[sort.key]?.[sort.direction] ?? 'data-desc';
}

/** Da `OrdineSegnalazioni` a stato di ordinamento colonna (`SortState`) per `ResponsiveDataView`. */
export function colonnaDaOrdineSegnalazioni(
  ordine: OrdineSegnalazioni,
): OrdineColonnaSegnalazioni {
  for (const [key, versi] of Object.entries(ORDINE_DA_COLONNA_SEGNALAZIONI)) {
    if (versi.ascending === ordine) return { key, direction: 'ascending' };
    if (versi.descending === ordine) return { key, direction: 'descending' };
  }
  return { key: 'data', direction: 'descending' };
}

/**
 * Ordina una copia delle segnalazioni per data di apertura (`data-desc` / `data-asc`),
 * stato (`stato-asc` = Aperto -> In lavorazione -> Risolto, `stato-desc` = inverso)
 * oppure priorità (`priorita-desc` = Urgente -> Bassa, `priorita-asc` = Bassa -> Urgente),
 * con spareggio deterministico per data decrescente e ID.
 */
export function ordinaSegnalazioni(
  segnalazioni: readonly SegnalazioneRiepilogo[],
  ordine: OrdineSegnalazioni = 'data-desc',
): SegnalazioneRiepilogo[] {
  return [...segnalazioni].sort((a, b) => {
    if (ordine === 'data-desc') {
      const cmp = confrontaDataIso(b.createdAt, a.createdAt);
      if (cmp !== 0) return cmp;
    } else if (ordine === 'data-asc') {
      const cmp = confrontaDataIso(a.createdAt, b.createdAt);
      if (cmp !== 0) return cmp;
    } else if (ordine === 'stato-asc') {
      const cmp = PESO_STATO_TICKET[a.stato] - PESO_STATO_TICKET[b.stato];
      if (cmp !== 0) return cmp;
    } else if (ordine === 'stato-desc') {
      const cmp = PESO_STATO_TICKET[b.stato] - PESO_STATO_TICKET[a.stato];
      if (cmp !== 0) return cmp;
    } else if (ordine === 'priorita-desc') {
      const cmp = PESO_PRIORITA_TICKET[b.priorita] - PESO_PRIORITA_TICKET[a.priorita];
      if (cmp !== 0) return cmp;
    } else if (ordine === 'priorita-asc') {
      const cmp = PESO_PRIORITA_TICKET[a.priorita] - PESO_PRIORITA_TICKET[b.priorita];
      if (cmp !== 0) return cmp;
    }

    const perData = confrontaDataIso(b.createdAt, a.createdAt);
    if (perData !== 0) return perData;
    const perTitolo = confrontaTesto(a.titolo, b.titolo);
    if (perTitolo !== 0) return perTitolo;
    return confrontaTesto(a.id, b.id);
  });
}

/**
 * Esegue la pipeline completa (filtri -> ordinamento -> paginazione) per `/segnalazioni` e `/ticket-aree-comuni`.
 */
export function paginaSegnalazioni(
  segnalazioni: readonly SegnalazioneRiepilogo[],
  filtri: FiltriSegnalazioni,
  ordine: OrdineSegnalazioni = 'data-desc',
  paginaRichiesta: number = 1,
  perPagina: number = PER_PAGINA_SEGNALAZIONI,
): PaginaSegnalazioni {
  const dimensione = Math.max(1, Math.floor(perPagina));
  const filtrati = filtraSegnalazioni(segnalazioni, filtri);
  const ordinati = ordinaSegnalazioni(filtrati, ordine);
  const totaleFiltrati = ordinati.length;
  const numeroPagine = Math.max(1, Math.ceil(totaleFiltrati / dimensione));
  const pagina = Math.min(Math.max(1, Math.floor(paginaRichiesta) || 1), numeroPagine);
  const inizio = (pagina - 1) * dimensione;

  return {
    segnalazioni: ordinati.slice(inizio, inizio + dimensione),
    totaleFiltrati,
    pagina,
    numeroPagine,
  };
}

// ─── Validazione percorsi Storage e allegati fotografici ─────────────────────

/**
 * Sanifica il nome di un file fotografico per il salvataggio nel bucket `foto-guasti`:
 * - rimuove eventuali directory (`/` o `\`) e sequenze `..`;
 * - sostituisce spazi e caratteri speciali con `_`, mantenendo solo `[a-zA-Z0-9._-]`;
 * - evita nomi vuoti o che iniziano con `.`.
 */
export function sanificaNomeFileFoto(nomeOriginale: string): string {
  const base = nomeOriginale
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop() ?? '';

  const senzaPuntiMultipli = base.replace(/\.{2,}/g, '.');
  const pulito = senzaPuntiMultipli
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+/, '')
    .slice(0, 100);

  return pulito || 'foto.jpg';
}

/**
 * Costruisce il percorso Storage conforme alle policy del bucket `foto-guasti`:
 * `<condominio_id>/<ticket_id>/<nome_file_sanificato>` (senza `..`).
 * Restituisce `null` se `condominioId` o `ticketId` contengono caratteri non sicuri.
 */
export function costruisciPercorsoFotoGuasto(
  condominioId: string,
  ticketId: string,
  nomeFile: string,
  prefissoUnivoco?: string,
): string | null {
  const condId = condominioId?.trim();
  const tktId = ticketId?.trim();
  if (!condId || !tktId) return null;
  if (
    condId.includes('/') ||
    condId.includes('\\') ||
    condId.includes('..') ||
    tktId.includes('/') ||
    tktId.includes('\\') ||
    tktId.includes('..')
  ) {
    return null;
  }

  const nomeSanificato = sanificaNomeFileFoto(nomeFile);
  const prefisso = prefissoUnivoco
    ? sanificaNomeFileFoto(prefissoUnivoco).replace(/\./g, '')
    : '';
  const nomeFinale = prefisso ? `${prefisso}_${nomeSanificato}` : nomeSanificato;

  const percorso = `${condId}/${tktId}/${nomeFinale}`;
  return validaPercorsoFotoStorage(percorso, condId, tktId);
}

/**
 * Valida e normalizza un percorso `url_storage` per il bucket `foto-guasti`:
 * - rifiuta valori nulli/vuoti, URL assoluti (`http://`, `https://`, ecc.), barre iniziali o backslash;
 * - rifiuta qualsiasi path traversal (`..`, `.`, segmenti vuoti);
 * - accetta percorsi `<condominio_id>/<ticket_id>/<file>` del condominio selezionato
 *   (oppure prefisso `seed-dev/` per i metadati di prova).
 */
export function validaPercorsoFotoStorage(
  urlStorage: string | null | undefined,
  condominioId: string,
  ticketId?: string,
): string | null {
  const condId = condominioId?.trim();
  if (!urlStorage || !condId) return null;

  const pulito = urlStorage.trim();
  if (
    !pulito ||
    pulito.includes('..') ||
    pulito.includes('\\') ||
    pulito.startsWith('/') ||
    /^[a-z][a-z0-9+.-]*:/i.test(pulito)
  ) {
    return null;
  }

  const senzaBucket = pulito.startsWith(`${BUCKET_FOTO_GUASTI}/`)
    ? pulito.slice(BUCKET_FOTO_GUASTI.length + 1)
    : pulito;

  if (!senzaBucket || senzaBucket.startsWith('/') || senzaBucket.endsWith('/')) {
    return null;
  }

  const segmenti = senzaBucket.split('/');
  if (segmenti.length < 2 || segmenti.some((s) => !s || s === '.' || s === '..')) {
    return null;
  }

  const primoSegmento = segmenti[0]!;
  if (primoSegmento !== condId && primoSegmento !== 'seed-dev') {
    return null;
  }

  if (primoSegmento === condId) {
    if (segmenti.length !== 3) return null;
    if (ticketId && segmenti[1] !== ticketId.trim()) return null;
  }

  return senzaBucket;
}

/** Scompone un percorso Storage validato in `{ cartella, nomeFile }`. */
export function scomponiPercorsoFotoStorage(
  percorsoValidato: string | null | undefined,
): { cartella: string; nomeFile: string } | null {
  if (!percorsoValidato) return null;
  const ultimoSlash = percorsoValidato.lastIndexOf('/');
  if (ultimoSlash <= 0 || ultimoSlash === percorsoValidato.length - 1) return null;
  const cartella = percorsoValidato.slice(0, ultimoSlash);
  const nomeFile = percorsoValidato.slice(ultimoSlash + 1);
  if (!cartella || !nomeFile) return null;
  return { cartella, nomeFile };
}

/** Estrae il nome del file da `url_storage`. */
export function estraiNomeFileDaPercorso(urlStorage: string): string {
  const pulito = urlStorage.trim().replace(/\\/g, '/');
  const ultimo = pulito.split('/').pop();
  return ultimo && ultimo.trim() ? ultimo.trim() : 'allegato.jpg';
}

function isTipoFotoAmmesso(file: FotoAllegatoInput): boolean {
  const mime = (file.type ?? '').trim().toLowerCase();
  if (
    mime &&
    (TIPI_MIME_FOTO_AMMESSI as readonly string[]).includes(mime)
  ) {
    return true;
  }
  const punto = file.name.lastIndexOf('.');
  const estensione = punto > 0 ? file.name.slice(punto).toLowerCase() : '';
  if (!mime && (ESTENSIONI_FOTO_AMMESSE as readonly string[]).includes(estensione)) {
    return true;
  }
  return false;
}

/**
 * Valida gli allegati fotografici per l'apertura di un ticket:
 * - formati ammessi: JPEG, PNG, WEBP, HEIC (`image/jpeg`, `image/png`, `image/webp`, `image/heic`);
 * - dimensione massima per file: 15 MB (`15728640` byte);
 * - massimo `MAX_FOTO_PER_TICKET` file per segnalazione.
 */
export function validaAllegatiFotoTicket(
  allegati: readonly FotoAllegatoInput[] | undefined,
): string | null {
  if (!allegati || allegati.length === 0) return null;
  if (allegati.length > MAX_FOTO_PER_TICKET) {
    return `Puoi allegare al massimo ${MAX_FOTO_PER_TICKET} foto per segnalazione.`;
  }

  for (const file of allegati) {
    if (!file.name || !file.name.trim()) {
      return 'Uno dei file selezionati non ha un nome valido.';
    }
    if (!isTipoFotoAmmesso(file)) {
      return `Il file "${file.name}" non è un formato fotografico consentito (ammessi: JPEG, PNG, WEBP, HEIC).`;
    }
    if (file.size <= 0) {
      return `Il file "${file.name}" è vuoto.`;
    }
    if (file.size > MAX_DIMENSIONE_FOTO_BYTES) {
      return `Il file "${file.name}" supera il limite massimo di 15 MB.`;
    }
  }

  return null;
}

const PRIORITA_VALIDE: readonly PrioritaTicket[] = ['BASSA', 'MEDIA', 'ALTA', 'URGENTE'];

/**
 * Valida l'input del modulo di apertura segnalazione:
 * - `titolo`: obbligatorio, non vuoto e lungo al massimo `MAX_LUNGHEZZA_TITOLO_TICKET` caratteri;
 * - `descrizione`: opzionale, lunga al massimo `MAX_LUNGHEZZA_DESCRIZIONE_TICKET` caratteri;
 * - `ambito`:
 *   - in modalità `'portiere'` forza sempre `isAreaComune = true` e `unitaId = null`;
 *   - in modalità `'condomino'`, se `isAreaComune = false`, richiede un `unitaId` appartenente a `unitaResidenteIds`;
 * - `priorita`: una tra `'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE'` (default `'MEDIA'`);
 * - `allegati`: validati per formato (JPEG/PNG/WEBP/HEIC) e dimensione (max 15 MB).
 */
export function validaInputNuovaSegnalazione(
  input: InputNuovaSegnalazione,
  unitaResidenteIds: readonly string[],
  modalita: ModalitaSegnalazioni = 'condomino',
): RisultatoValidazioneSegnalazione {
  const errori: Partial<
    Record<'titolo' | 'descrizione' | 'ambito' | 'priorita' | 'allegati', string>
  > = {};

  const titolo = (input.titolo ?? '').trim();
  if (!titolo) {
    errori.titolo = 'Inserisci un titolo per la segnalazione.';
  } else if (titolo.length > MAX_LUNGHEZZA_TITOLO_TICKET) {
    errori.titolo = `Il titolo non può superare ${MAX_LUNGHEZZA_TITOLO_TICKET} caratteri.`;
  }

  const descrizioneGrezza = (input.descrizione ?? '').trim();
  if (descrizioneGrezza.length > MAX_LUNGHEZZA_DESCRIZIONE_TICKET) {
    errori.descrizione = `La descrizione non può superare ${MAX_LUNGHEZZA_DESCRIZIONE_TICKET} caratteri.`;
  }

  const prioritaScelta: PrioritaTicket = input.priorita ?? 'MEDIA';
  if (!PRIORITA_VALIDE.includes(prioritaScelta)) {
    errori.priorita = 'Seleziona una priorità valida.';
  }

  let isAreaComune = Boolean(input.isAreaComune);
  let unitaId: string | null = input.unitaId?.trim() || null;

  if (modalita === 'portiere') {
    isAreaComune = true;
    unitaId = null;
  } else if (isAreaComune) {
    unitaId = null;
  } else {
    if (!unitaId) {
      errori.ambito = 'Seleziona la tua unità immobiliare oppure indica "Area comune".';
    } else if (!unitaResidenteIds.includes(unitaId)) {
      errori.ambito = "L'unità selezionata non appartiene alle tue unità attive nel condominio.";
    }
  }

  const erroreAllegati = validaAllegatiFotoTicket(input.allegati);
  if (erroreAllegati) {
    errori.allegati = erroreAllegati;
  }

  if (Object.keys(errori).length > 0) {
    return { valido: false, errori };
  }

  return {
    valido: true,
    dati: {
      titolo,
      descrizione: descrizioneGrezza || null,
      categoriaId: input.categoriaId?.trim() || null,
      isAreaComune,
      unitaId,
      priorita: prioritaScelta,
    },
    errori: {},
  };
}

/** Valida il testo di un nuovo messaggio di aggiornamento sul ticket. */
export function validaMessaggioTicket(
  messaggio: string | null | undefined,
): { valido: true; testo: string } | { valido: false; errore: string } {
  const testo = (messaggio ?? '').trim();
  if (!testo) {
    return { valido: false, errore: 'Scrivi un messaggio prima di inviare.' };
  }
  if (testo.length > MAX_LUNGHEZZA_MESSAGGIO_TICKET) {
    return {
      valido: false,
      errore: `Il messaggio non può superare ${MAX_LUNGHEZZA_MESSAGGIO_TICKET} caratteri.`,
    };
  }
  return { valido: true, testo };
}

// ─── Testi per la UI ─────────────────────────────────────────────────────────

export function sottotitoloSegnalazioni(condominioNome: string | null | undefined): string {
  const nome = condominioNome?.trim();
  return nome
    ? `${nome} — guasti, richieste di intervento e aggiornamenti`
    : 'Guasti, richieste di intervento e aggiornamenti del condominio';
}

export function sottotitoloTicketPortiere(condominioNome: string | null | undefined): string {
  const nome = condominioNome?.trim();
  return nome
    ? `${nome} — segnalazioni e manutenzioni sulle aree comuni`
    : 'Segnalazioni e manutenzioni sulle aree comuni del condominio';
}

export function etichettaRigaSegnalazione(
  s: SegnalazioneRiepilogo,
  dataFormattata: string,
): string {
  const categoria = s.categoriaNome ?? 'Generale';
  return `${s.titolo}, stato ${s.etichettaStato}, priorità ${s.etichettaPriorita}, categoria ${categoria}, ambito ${s.etichettaAmbito}, aperta il ${dataFormattata}`;
}
