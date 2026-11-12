/**
 * Logica pura per la sezione Segnalazioni del condòmino (`/segnalazioni` e `/segnalazioni/[id]`,
 * REQ-C03 e REQ-C04) e per i Ticket aree comuni del portiere (`/ticket-aree-comuni`):
 * - modello ad ambiti condivisi (nessun ticket privato 1-a-1):
 *   - 'CONDOMINIO': Area comune condominiale (visibile a tutti i condòmini del condominio);
 *   - 'PALAZZO': Area/parti comuni del palazzo (visibile solo ai residenti di quel palazzo);
 *   - 'SCALA': Area/parti comuni della scala/colonna (visibile solo ai residenti di quella scala/colonna).
 * - isolamento per ruolo e residenza attiva:
 *   - condòmino: vede solo Area comune + proprio Palazzo + propria Scala (mai altre scale o palazzi);
 *   - portiere: vede e può aprire per qualsiasi ambito del condominio;
 * - stati del ticket (`APERTO`, `LAVORAZIONE`, `RISOLTO`), priorità (`BASSA`, `MEDIA`, `ALTA`, `URGENTE`);
 * - conteggi per le `StatCard`, filtri per stato e per ambito, ricerca su titolo/categoria/ambito;
 * - validazione input nuova segnalazione senza riferimenti a unità private;
 * - allegati fotografici JPEG/PNG/WEBP/HEIC max 15 MB e percorsi Storage sicuri nel bucket `foto-guasti`.
 *
 * File puro (nessuna dipendenza da React Native o Supabase): eseguibile con `node --test`.
 * Nessun uso di `Intl` o `localeCompare` (compatibilità Hermes).
 */

export type PrioritaTicket = 'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type StatoTicket = 'APERTO' | 'LAVORAZIONE' | 'RISOLTO';
export type TipoFileTicket = 'FOTO' | 'FATTURA' | 'ALTRO';

export type TipoAmbitoTicket = 'CONDOMINIO' | 'PALAZZO' | 'SCALA';

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
export type FiltroAmbitoSegnalazioni = 'tutti' | 'CONDOMINIO' | 'PALAZZO' | 'SCALA';

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

export interface OpzioneAmbitoTicket {
  id: string;
  tipo: TipoAmbitoTicket;
  palazzoId: string | null;
  scalaColonnaId: string | null;
  etichetta: string;
  descrizione?: string;
}

/** Interfaccia storica mantenuta per retrocompatibilità. */
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
  palazzoId: string | null;
  palazzoNome: string | null;
  scalaColonnaId: string | null;
  scalaNome: string | null;
  unitaId: string | null;
  unitaInterno: string | null;
  segnalatoreId: string | null;
  categoriaId: string | null;
  categoriaNome: string | null;
  titolo: string;
  descrizione: string | null;
  isAreaComune: boolean;
  ambitoTipo: TipoAmbitoTicket;
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
  palazzo: number;
  scala: number;
  unitaPropria: number;
}

export interface FiltriSegnalazioni {
  stato: FiltroStatoSegnalazioni;
  ambito?: FiltroAmbitoSegnalazioni;
  ricerca: string;
}

export interface OpzioneFiltroStato {
  value: FiltroStatoSegnalazioni;
  label: string;
  count: number;
}

export interface OpzioneFiltroAmbito {
  value: FiltroAmbitoSegnalazioni;
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
  ambitoTipo?: TipoAmbitoTicket | null;
  palazzoId?: string | null;
  scalaColonnaId?: string | null;
  priorita?: PrioritaTicket | null;
  allegati?: readonly FotoAllegatoInput[];
  // Campi retrocompatibili:
  isAreaComune?: boolean;
  unitaId?: string | null;
}

export interface DatiNuovaSegnalazioneValidati {
  titolo: string;
  descrizione: string | null;
  categoriaId: string | null;
  ambitoTipo: TipoAmbitoTicket;
  palazzoId: string | null;
  scalaColonnaId: string | null;
  isAreaComune: boolean;
  unitaId: null;
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

// ─── Determinazione Ambito ed Etichette ──────────────────────────────────────

function formattaPrefisso(val: string, prefisso: string): string {
  const v = val.trim();
  if (v.toLowerCase().startsWith(prefisso.toLowerCase())) return v;
  return `${prefisso} ${v}`;
}

export function determinaAmbitoTipo(
  palazzoId: string | null | undefined,
  scalaColonnaId: string | null | undefined,
): TipoAmbitoTicket {
  if (scalaColonnaId) return 'SCALA';
  if (palazzoId) return 'PALAZZO';
  return 'CONDOMINIO';
}

/**
 * Costruisce l'etichetta leggibile dell'ambito condiviso:
 * - `"Palazzo <P> · Scala <S>"` se è specificata una scala;
 * - `"Palazzo <P>"` se è specificato solo il palazzo;
 * - `"Area comune"` per ambito condominiale.
 */
export function etichettaAmbitoTicket(
  palazzoNome?: string | null,
  scalaNome?: string | null,
  isAreaComune?: boolean,
  unitaInterno?: string | null,
): string {
  const p = palazzoNome?.trim();
  const s = scalaNome?.trim();
  if (s && p) {
    return `${formattaPrefisso(p, 'Palazzo')} · ${formattaPrefisso(s, 'Scala')}`;
  }
  if (s) return formattaPrefisso(s, 'Scala');
  if (p) return formattaPrefisso(p, 'Palazzo');
  if (unitaInterno && !isAreaComune) return `Unità Int. ${unitaInterno.trim()}`;
  return 'Area comune';
}

/** Helper retrocompatibile per formattazione unità. */
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

// ─── Isolamento e Visibilità lato client (Defense-in-depth) ──────────────────

export interface TicketIsolamentoInput {
  condominioId: string;
  segnalatoreId?: string | null;
  palazzoId?: string | null;
  scalaColonnaId?: string | null;
  unitaId?: string | null;
  isAreaComune?: boolean;
}

/**
 * Verifica se un ticket è visibile al condòmino:
 * - Deve appartenere al condominio selezionato;
 * - È visibile se:
 *   1. È di Area comune condominiale (`palazzoId == null && scalaColonnaId == null`);
 *   2. È del proprio Palazzo (`palazzoId` appartiene a una delle unità attive dell'utente e `scalaColonnaId == null`);
 *   3. È della propria Scala (`scalaColonnaId` appartiene a una delle unità attive dell'utente);
 *   4. (Fallback storico) È associato a un'unità attiva dell'utente.
 * NON è visibile ai condòmini di un'altra scala (es. Scala B non vede Scala A).
 */
export function ticketVisibileACondomino(
  ticket: TicketIsolamentoInput | null | undefined,
  userId: string,
  condominioId: string,
  userPalazzoIds: readonly string[],
  userScalaIds: readonly string[],
  unitaResidenteIds: readonly string[] = [],
): boolean {
  if (!ticket || !condominioId) return false;
  if (ticket.condominioId !== condominioId) return false;

  const palId = ticket.palazzoId ?? null;
  const scaId = ticket.scalaColonnaId ?? null;

  // 1. Area comune del condominio
  if (palId === null && scaId === null) {
    // Se è un ticket storico con unitaId esplicita senza palazzo/scala, verifichiamo unità
    if (ticket.unitaId && !ticket.isAreaComune) {
      return unitaResidenteIds.includes(ticket.unitaId);
    }
    return true;
  }

  // 2. Palazzo (senza scala specifica)
  if (palId !== null && scaId === null) {
    return userPalazzoIds.includes(palId);
  }

  // 3. Scala specifica
  if (scaId !== null) {
    return userScalaIds.includes(scaId);
  }

  return false;
}

/**
 * Il portiere nel condominio attivo vede tutte le segnalazioni del condominio.
 */
export function ticketVisibileAPortiere(
  ticket: TicketIsolamentoInput | null | undefined,
  userId: string,
  condominioId: string,
): boolean {
  if (!ticket || !condominioId) return false;
  return ticket.condominioId === condominioId;
}

/**
 * Verifica la visibilità del ticket nella modalità richiesta ('condomino' vs 'portiere').
 */
export function ticketVisibileInModalita(
  ticket: TicketIsolamentoInput | null | undefined,
  userId: string,
  condominioId: string,
  userPalazzoIds: readonly string[],
  userScalaIds: readonly string[],
  modalita: ModalitaSegnalazioni,
  unitaResidenteIds: readonly string[] = [],
): boolean {
  if (modalita === 'portiere') {
    return ticketVisibileAPortiere(ticket, userId, condominioId);
  }
  return ticketVisibileACondomino(
    ticket,
    userId,
    condominioId,
    userPalazzoIds,
    userScalaIds,
    unitaResidenteIds,
  );
}

/** Filtra un elenco di ticket mantenendo solo quelli visibili al condòmino. */
export function filtraTicketVisibiliCondomino<T extends TicketIsolamentoInput>(
  tickets: readonly T[],
  userId: string,
  condominioId: string,
  userPalazzoIds: readonly string[],
  userScalaIds: readonly string[],
  unitaResidenteIds: readonly string[] = [],
): T[] {
  return tickets.filter((t) =>
    ticketVisibileACondomino(t, userId, condominioId, userPalazzoIds, userScalaIds, unitaResidenteIds),
  );
}

/** Filtra un elenco di ticket mantenendo solo quelli visibili al portiere. */
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
 * Calcola i conteggi reali per le `StatCard`:
 * totale, aperte, in lavorazione, risolte, per area comune, palazzo e scala.
 */
export function riepilogoSegnalazioni(
  segnalazioni: readonly {
    stato: StatoTicket;
    ambitoTipo?: TipoAmbitoTicket;
    palazzoId?: string | null;
    scalaColonnaId?: string | null;
    isAreaComune?: boolean;
    unitaId?: string | null;
  }[],
): RiepilogoSegnalazioni {
  let aperte = 0;
  let inLavorazione = 0;
  let risolte = 0;
  let areeComuni = 0;
  let palazzo = 0;
  let scala = 0;

  for (const s of segnalazioni) {
    if (s.stato === 'APERTO') aperte += 1;
    else if (s.stato === 'LAVORAZIONE') inLavorazione += 1;
    else if (s.stato === 'RISOLTO') risolte += 1;

    const tipo = s.ambitoTipo ?? determinaAmbitoTipo(s.palazzoId, s.scalaColonnaId);
    if (tipo === 'SCALA') {
      scala += 1;
    } else if (tipo === 'PALAZZO') {
      palazzo += 1;
    } else {
      areeComuni += 1;
    }
  }

  return {
    totale: segnalazioni.length,
    aperte,
    inLavorazione,
    risolte,
    areeComuni,
    palazzo,
    scala,
    unitaPropria: 0,
  };
}

// ─── Filtri, ricerca, ordinamento e paginazione ──────────────────────────────

export function opzioniFiltroStatoSegnalazioni(
  segnalazioni: readonly { stato: StatoTicket }[],
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

export function opzioniFiltroAmbitoSegnalazioni(
  segnalazioni: readonly {
    ambitoTipo?: TipoAmbitoTicket;
    palazzoId?: string | null;
    scalaColonnaId?: string | null;
  }[],
): OpzioneFiltroAmbito[] {
  let cond = 0;
  let pal = 0;
  let sca = 0;

  for (const s of segnalazioni) {
    const tipo = s.ambitoTipo ?? determinaAmbitoTipo(s.palazzoId, s.scalaColonnaId);
    if (tipo === 'SCALA') sca += 1;
    else if (tipo === 'PALAZZO') pal += 1;
    else cond += 1;
  }

  return [
    { value: 'tutti', label: 'Tutti', count: segnalazioni.length },
    { value: 'CONDOMINIO', label: 'Area comune', count: cond },
    { value: 'PALAZZO', label: 'Palazzo', count: pal },
    { value: 'SCALA', label: 'Scala', count: sca },
  ];
}

export function filtriSegnalazioniAttivi(filtri: FiltriSegnalazioni): number {
  const haStato = Boolean(filtri.stato && filtri.stato !== 'tutti');
  const haAmbito = Boolean(filtri.ambito && filtri.ambito !== 'tutti');
  const haRicerca = filtri.ricerca.trim().length > 0;
  return (haStato ? 1 : 0) + (haAmbito ? 1 : 0) + (haRicerca ? 1 : 0);
}

export function filtraSegnalazioni(
  segnalazioni: readonly SegnalazioneRiepilogo[],
  filtri: FiltriSegnalazioni,
): SegnalazioneRiepilogo[] {
  const statoFiltro = filtri.stato;
  const ambitoFiltro = filtri.ambito;
  const termine = filtri.ricerca.trim().toLowerCase();

  return segnalazioni.filter((s) => {
    if (statoFiltro && statoFiltro !== 'tutti' && s.stato !== statoFiltro) {
      return false;
    }
    if (ambitoFiltro && ambitoFiltro !== 'tutti' && s.ambitoTipo !== ambitoFiltro) {
      return false;
    }
    if (!termine) return true;

    const titoloMatch = s.titolo.toLowerCase().includes(termine);
    const categoriaMatch = (s.categoriaNome ?? 'Generale').toLowerCase().includes(termine);
    const ambitoMatch = s.etichettaAmbito.toLowerCase().includes(termine);
    const descrizioneMatch = (s.descrizione ?? '').toLowerCase().includes(termine);
    const palazzoMatch = (s.palazzoNome ?? '').toLowerCase().includes(termine);
    const scalaMatch = (s.scalaNome ?? '').toLowerCase().includes(termine);

    return (
      titoloMatch ||
      categoriaMatch ||
      ambitoMatch ||
      descrizioneMatch ||
      palazzoMatch ||
      scalaMatch
    );
  });
}

export function ordineDaColonnaSegnalazioni(
  sort: OrdineColonnaSegnalazioni | null,
): OrdineSegnalazioni {
  if (!sort) return 'data-desc';
  return ORDINE_DA_COLONNA_SEGNALAZIONI[sort.key]?.[sort.direction] ?? 'data-desc';
}

export function colonnaDaOrdineSegnalazioni(
  ordine: OrdineSegnalazioni,
): OrdineColonnaSegnalazioni {
  for (const [key, versi] of Object.entries(ORDINE_DA_COLONNA_SEGNALAZIONI)) {
    if (versi.ascending === ordine) return { key, direction: 'ascending' };
    if (versi.descending === ordine) return { key, direction: 'descending' };
  }
  return { key: 'data', direction: 'descending' };
}

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

export function estraiNomeFileDaPercorso(urlStorage: string): string {
  const pulito = urlStorage.trim().replace(/\\/g, '/');
  const ultimo = pulito.split('/').pop();
  return ultimo && ultimo.trim() ? ultimo.trim() : 'allegato.jpg';
}

function isTipoFotoAmmesso(file: FotoAllegatoInput): boolean {
  const mime = (file.type ?? '').trim().toLowerCase();
  if (mime && (TIPI_MIME_FOTO_AMMESSI as readonly string[]).includes(mime)) {
    return true;
  }
  const punto = file.name.lastIndexOf('.');
  const estensione = punto > 0 ? file.name.slice(punto).toLowerCase() : '';
  if (!mime && (ESTENSIONI_FOTO_AMMESSE as readonly string[]).includes(estensione)) {
    return true;
  }
  return false;
}

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
 * Valida l'input del modulo di nuova segnalazione:
 * - `titolo`: obbligatorio, non vuoto, max 120 car.;
 * - `descrizione`: opzionale, max 2000 car.;
 * - `ambito`: deve essere 'CONDOMINIO', 'PALAZZO' o 'SCALA'. Per il condòmino, il palazzo/scala
 *   deve appartenere agli ambiti consentiti. Nessun riferimento a unità immobiliare privata 1-a-1.
 * - `priorita`: BASSA, MEDIA, ALTA, URGENTE.
 * - `allegati`: validati per formato e dimensione.
 */
export function validaInputNuovaSegnalazione(
  input: InputNuovaSegnalazione,
  ambitiConsentiti?:
    | readonly OpzioneAmbitoTicket[]
    | { palazzoIds: readonly string[]; scalaIds: readonly string[] }
    | readonly string[],
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

  // Risoluzione tipo di ambito:
  let ambitoTipo: TipoAmbitoTicket = input.ambitoTipo ?? 'CONDOMINIO';
  if (input.isAreaComune && !input.ambitoTipo) {
    ambitoTipo = 'CONDOMINIO';
  } else if (input.scalaColonnaId) {
    ambitoTipo = 'SCALA';
  } else if (input.palazzoId) {
    ambitoTipo = 'PALAZZO';
  }

  let palazzoId: string | null = null;
  let scalaColonnaId: string | null = null;

  if (ambitoTipo === 'CONDOMINIO') {
    palazzoId = null;
    scalaColonnaId = null;
  } else if (ambitoTipo === 'PALAZZO') {
    palazzoId = input.palazzoId?.trim() || null;
    scalaColonnaId = null;
    if (!palazzoId) {
      errori.ambito = 'Seleziona il palazzo interessato dal guasto.';
    }
  } else if (ambitoTipo === 'SCALA') {
    palazzoId = input.palazzoId?.trim() || null;
    scalaColonnaId = input.scalaColonnaId?.trim() || null;
    if (!scalaColonnaId) {
      errori.ambito = 'Seleziona la scala/colonna interessata dal guasto.';
    }
  }

  // Se siamo in modalità condòmino e sono forniti gli ambiti consentiti, verifichiamo la compatibilità
  if (modalita === 'condomino' && ambitiConsentiti && !errori.ambito) {
    if (ambitoTipo === 'PALAZZO' && palazzoId) {
      let consentito = false;
      if (Array.isArray(ambitiConsentiti)) {
        if (typeof ambitiConsentiti[0] === 'string') {
          consentito = (ambitiConsentiti as readonly string[]).includes(palazzoId);
        } else {
          consentito = (ambitiConsentiti as readonly OpzioneAmbitoTicket[]).some(
            (o) => o.tipo === 'PALAZZO' && o.palazzoId === palazzoId,
          );
        }
      } else {
        consentito = (ambitiConsentiti as { palazzoIds: readonly string[] }).palazzoIds.includes(
          palazzoId,
        );
      }
      if (!consentito) {
        errori.ambito = 'Il palazzo selezionato non rientra tra i tuoi palazzi di residenza.';
      }
    } else if (ambitoTipo === 'SCALA' && scalaColonnaId) {
      let consentito = false;
      if (Array.isArray(ambitiConsentiti)) {
        if (typeof ambitiConsentiti[0] === 'string') {
          consentito = (ambitiConsentiti as readonly string[]).includes(scalaColonnaId);
        } else {
          consentito = (ambitiConsentiti as readonly OpzioneAmbitoTicket[]).some(
            (o) => o.tipo === 'SCALA' && o.scalaColonnaId === scalaColonnaId,
          );
        }
      } else {
        consentito = (ambitiConsentiti as { scalaIds: readonly string[] }).scalaIds.includes(
          scalaColonnaId,
        );
      }
      if (!consentito) {
        errori.ambito = 'La scala selezionata non appartiene alla tua scala di residenza.';
      }
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
      ambitoTipo,
      palazzoId,
      scalaColonnaId,
      isAreaComune: true,
      unitaId: null,
      priorita: prioritaScelta,
    },
    errori: {},
  };
}

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
    ? `${nome} — guasti, parti comuni e richieste di intervento`
    : 'Guasti, parti comuni e richieste di intervento del condominio';
}

export function sottotitoloTicketPortiere(condominioNome: string | null | undefined): string {
  const nome = condominioNome?.trim();
  return nome
    ? `${nome} — segnalazioni e manutenzioni su parti comuni e stabili`
    : 'Segnalazioni e manutenzioni su parti comuni e stabili del condominio';
}

export function etichettaRigaSegnalazione(
  s: SegnalazioneRiepilogo,
  dataFormattata: string,
): string {
  const categoria = s.categoriaNome ?? 'Generale';
  return `${s.titolo}, stato ${s.etichettaStato}, priorità ${s.etichettaPriorita}, categoria ${categoria}, ambito ${s.etichettaAmbito}, aperta il ${dataFormattata}`;
}
