import type { BadgeStatus } from '@iocondo/ui';

export type PrioritaTicket = 'BASSA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type StatoTicket = 'APERTO' | 'LAVORAZIONE' | 'RISOLTO';

export interface FornitoreAdminView {
  id: string;
  admin_id: string;
  ragione_sociale: string;
  p_iva: string | null;
  iban: string | null;
  email: string | null;
  telefono: string | null;
  categoria: string | null;
  created_at: string;
}

export interface TicketAllegatoAdminView {
  id: string;
  ticket_id: string;
  url_storage: string;
  tipo_file: 'FOTO' | 'FATTURA' | 'ALTRO' | string;
  caricato_da?: string | null;
  created_at: string;
}

export interface TicketMessaggioAdminView {
  id: string;
  ticket_id: string;
  mittente_id: string | null;
  mittente_nome: string;
  messaggio: string;
  timestamp: string;
  timestamp_formattato: string;
}

export interface TicketInterventoAdminView {
  id: string;
  ticket_id: string;
  fornitore_id: string;
  fornitore_ragione_sociale: string;
  data_prevista: string | null;
  data_prevista_formattata: string | null;
  importo_consuntivo: number | null;
  importo_consuntivo_formattato: string | null;
  note_fornitore: string | null;
  fattura_url?: string | null;
  foto_lavoro_url?: string | null;
  created_at: string;
  magic_token: string | null;
  url_magico: string | null;
  data_scadenza_token: string | null;
}

export interface TicketAdminRaw {
  id: string;
  condominio_id: string;
  unita_id: string | null;
  segnalatore_id: string | null;
  categoria_id: string | null;
  titolo: string;
  descrizione: string | null;
  is_area_comune: boolean;
  priorita: PrioritaTicket;
  stato: StatoTicket;
  created_at: string;
  updated_at?: string;
  closed_at: string | null;
  categorie_guasti?: {
    id: string;
    nome: string;
  } | null;
  unita_immobiliari?: {
    id: string;
    interno: string | null;
    piano: number | null;
    palazzi?: {
      id: string;
      nome_identificativo: string;
    } | null;
  } | null;
  utenti?: {
    id: string;
    nome_cognome: string | null;
    email: string | null;
  } | null;
  ticket_interventi?: Array<{
    id: string;
    ticket_id: string;
    fornitore_id: string;
    data_prevista: string | null;
    importo_consuntivo: number | null;
    note_fornitore: string | null;
    fattura_url: string | null;
    foto_lavoro_url: string | null;
    created_at: string;
    fornitori?: {
      id: string;
      ragione_sociale: string;
    } | null;
    fornitori_tokens?: Array<{
      token: string;
      url_magico: string | null;
      data_scadenza: string;
      used_at: string | null;
    }> | null;
  }> | null;
  ticket_allegati?: Array<{
    id: string;
    ticket_id: string;
    url_storage: string;
    tipo_file: string;
    caricato_da: string | null;
    created_at: string;
  }> | null;
  ticket_messaggi?: Array<{
    id: string;
    ticket_id: string;
    mittente_id: string | null;
    messaggio: string;
    timestamp: string;
    utenti?: {
      nome_cognome: string | null;
    } | null;
  }> | null;
}

export interface TicketAdminView {
  id: string;
  condominio_id: string;
  unita_id: string | null;
  unita_descrizione: string | null;
  segnalatore_id: string | null;
  segnalatore_nome: string | null;
  categoria_id: string | null;
  categoria_nome: string;
  titolo: string;
  descrizione: string | null;
  is_area_comune: boolean;
  ubicazione_label: string;
  priorita: PrioritaTicket;
  stato: StatoTicket;
  created_at: string;
  created_at_formattata: string;
  closed_at: string | null;
  closed_at_formattato: string | null;
  fornitore_assegnato_id: string | null;
  fornitore_assegnato_nome: string;
  data_intervento_prevista: string | null;
  data_intervento_formattata: string | null;
  ultimo_intervento: TicketInterventoAdminView | null;
  interventi: TicketInterventoAdminView[];
  allegati: TicketAllegatoAdminView[];
  messaggi: TicketMessaggioAdminView[];
}

export interface FiltriManutenzioneAdmin {
  stato?: 'tutti' | 'aperti' | 'in_lavorazione' | 'risolti' | 'urgenti' | 'aree_comuni' | string;
  categoria?: string;
  priorita?: string;
  ricerca?: string;
}

export interface StatisticheManutenzioneAdmin {
  ticketAperti: number;
  interventiInLavorazione: number;
  fornitoriConvenzionati: number;
}

const MESI_BREVI = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
];

/**
 * Formatta una data ISO in formato leggibile italiano (es. "5 nov 2026").
 */
export function formattaDataItaliana(isoString?: string | null): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  const giorno = d.getDate();
  const mese = MESI_BREVI[d.getMonth()];
  const anno = d.getFullYear();
  return `${giorno} ${mese} ${anno}`;
}

/**
 * Formatta un importo in euro (es. "€ 240,00").
 */
export function formattaEuro(valore?: number | null): string {
  if (valore === null || valore === undefined || Number.isNaN(valore)) return '—';
  return `€ ${valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Mappatura colori e badge per la priorità del ticket:
 * - URGENTE: rosso / errore
 * - ALTA: arancio / warning
 * - MEDIA: azzurro / info
 * - BASSA: neutro
 */
export function mappaBadgePriorita(priorita: PrioritaTicket): { label: string; status: BadgeStatus } {
  switch (priorita) {
    case 'URGENTE':
      return { label: 'Urgente', status: 'error' };
    case 'ALTA':
      return { label: 'Alta', status: 'warning' };
    case 'MEDIA':
      return { label: 'Media', status: 'info' };
    case 'BASSA':
    default:
      return { label: 'Bassa', status: 'neutral' };
  }
}

/**
 * Mappatura colori e badge per lo stato del ticket:
 * - APERTO: azzurro / info (o warning)
 * - LAVORAZIONE: in-lavorazione / attenzione
 * - RISOLTO: verde / successo
 */
export function mappaBadgeStato(stato: StatoTicket): { label: string; status: BadgeStatus } {
  switch (stato) {
    case 'APERTO':
      return { label: 'Aperto', status: 'aperto' };
    case 'LAVORAZIONE':
      return { label: 'In lavorazione', status: 'in-lavorazione' };
    case 'RISOLTO':
      return { label: 'Risolto', status: 'risolto' };
    default:
      return { label: stato, status: 'neutral' };
  }
}

/**
 * Genera l'URL del Magic Link per il fornitore (/fornitore/[token]).
 */
export function generaUrlMagicLink(token: string, baseUrl?: string): string {
  if (!token) return '';
  const pulitoToken = encodeURIComponent(token.trim());
  if (baseUrl && baseUrl.startsWith('http')) {
    return `${baseUrl.replace(/\/$/, '')}/fornitore/${pulitoToken}`;
  }
  return `/fornitore/${pulitoToken}`;
}

/**
 * Calcola i tre indicatori chiave di manutenzione.
 */
export function calcolaStatisticheManutenzione(
  tickets: TicketAdminView[],
  fornitori: FornitoreAdminView[],
): StatisticheManutenzioneAdmin {
  let ticketAperti = 0;
  let interventiInLavorazione = 0;

  for (const t of tickets) {
    if (t.stato === 'APERTO') {
      ticketAperti++;
    } else if (t.stato === 'LAVORAZIONE') {
      interventiInLavorazione++;
    }
  }

  return {
    ticketAperti,
    interventiInLavorazione,
    fornitoriConvenzionati: fornitori.length,
  };
}

/**
 * Trasforma il record grezzo di ticket_testata con le sue relazioni in vista per la UI.
 */
export function trasformaTicketRawInView(raw: TicketAdminRaw): TicketAdminView {
  // Ubicazione
  let ubicazione_label = 'Area comune';
  let unita_descrizione: string | null = null;
  if (!raw.is_area_comune && raw.unita_immobiliari) {
    const pNome = raw.unita_immobiliari.palazzi?.nome_identificativo;
    const interno = raw.unita_immobiliari.interno;
    const piano = raw.unita_immobiliari.piano;
    const pezzi = [pNome, interno ? `Int. ${interno}` : null, piano !== null && piano !== undefined ? `P. ${piano}` : null].filter(Boolean);
    unita_descrizione = pezzi.join(' - ');
    ubicazione_label = unita_descrizione || 'Unità privata';
  } else if (raw.is_area_comune) {
    ubicazione_label = 'Area comune';
  }

  // Interventi
  const interventiView: TicketInterventoAdminView[] = (raw.ticket_interventi ?? []).map((int) => {
    const fornToken = int.fornitori_tokens?.[0];
    return {
      id: int.id,
      ticket_id: int.ticket_id,
      fornitore_id: int.fornitore_id,
      fornitore_ragione_sociale: int.fornitori?.ragione_sociale ?? 'Fornitore incaricato',
      data_prevista: int.data_prevista,
      data_prevista_formattata: formattaDataItaliana(int.data_prevista),
      importo_consuntivo: int.importo_consuntivo,
      importo_consuntivo_formattato: formattaEuro(int.importo_consuntivo),
      note_fornitore: int.note_fornitore,
      fattura_url: int.fattura_url,
      foto_lavoro_url: int.foto_lavoro_url,
      created_at: int.created_at,
      magic_token: fornToken?.token ?? null,
      url_magico: fornToken?.url_magico ?? (fornToken?.token ? generaUrlMagicLink(fornToken.token) : null),
      data_scadenza_token: fornToken?.data_scadenza ?? null,
    };
  });

  const ultimoIntervento = interventiView[0] ?? null;

  // Allegati
  const allegatiView: TicketAllegatoAdminView[] = (raw.ticket_allegati ?? []).map((all) => ({
    id: all.id,
    ticket_id: all.ticket_id,
    url_storage: all.url_storage,
    tipo_file: all.tipo_file,
    caricato_da: all.caricato_da,
    created_at: all.created_at,
  }));

  // Messaggi
  const messaggiView: TicketMessaggioAdminView[] = (raw.ticket_messaggi ?? []).map((msg) => ({
    id: msg.id,
    ticket_id: msg.ticket_id,
    mittente_id: msg.mittente_id,
    mittente_nome: msg.utenti?.nome_cognome ?? 'Condòmino',
    messaggio: msg.messaggio,
    timestamp: msg.timestamp,
    timestamp_formattato: formattaDataItaliana(msg.timestamp),
  }));

  return {
    id: raw.id,
    condominio_id: raw.condominio_id,
    unita_id: raw.unita_id,
    unita_descrizione,
    segnalatore_id: raw.segnalatore_id,
    segnalatore_nome: raw.utenti?.nome_cognome ?? null,
    categoria_id: raw.categoria_id,
    categoria_nome: raw.categorie_guasti?.nome ?? 'Generale',
    titolo: raw.titolo,
    descrizione: raw.descrizione,
    is_area_comune: Boolean(raw.is_area_comune),
    ubicazione_label,
    priorita: raw.priorita,
    stato: raw.stato,
    created_at: raw.created_at,
    created_at_formattata: formattaDataItaliana(raw.created_at),
    closed_at: raw.closed_at,
    closed_at_formattato: formattaDataItaliana(raw.closed_at),
    fornitore_assegnato_id: ultimoIntervento?.fornitore_id ?? null,
    fornitore_assegnato_nome: ultimoIntervento?.fornitore_ragione_sociale ?? 'Non assegnato',
    data_intervento_prevista: ultimoIntervento?.data_prevista ?? null,
    data_intervento_formattata: ultimoIntervento?.data_prevista_formattata ?? null,
    ultimo_intervento: ultimoIntervento,
    interventi: interventiView,
    allegati: allegatiView,
    messaggi: messaggiView,
  };
}

/**
 * Filtra i ticket secondo chip di stato/priorità, categoria e stringa di ricerca.
 */
export function filtraTicket(
  tickets: TicketAdminView[],
  filtri: FiltriManutenzioneAdmin,
): TicketAdminView[] {
  const stato = filtri.stato || 'tutti';
  const query = (filtri.ricerca || '').trim().toLowerCase();
  const categoria = (filtri.categoria || '').trim().toLowerCase();
  const priorita = (filtri.priorita || '').trim().toUpperCase();

  return tickets.filter((ticket) => {
    // 1. Filtro rapido chip
    if (stato === 'aperti' && ticket.stato !== 'APERTO') return false;
    if (stato === 'in_lavorazione' && ticket.stato !== 'LAVORAZIONE') return false;
    if (stato === 'risolti' && ticket.stato !== 'RISOLTO') return false;
    if (stato === 'urgenti' && ticket.priorita !== 'URGENTE') return false;
    if (stato === 'aree_comuni' && !ticket.is_area_comune) return false;

    // 2. Filtro categoria opzionale
    if (categoria && categoria !== 'tutte' && ticket.categoria_nome.toLowerCase() !== categoria) {
      return false;
    }

    // 3. Filtro priorità esplicito opzionale
    if (priorita && priorita !== 'TUTTE' && ticket.priorita !== priorita) {
      return false;
    }

    // 4. Ricerca testuale real-time
    if (query) {
      const matchTitolo = ticket.titolo.toLowerCase().includes(query);
      const matchDesc = ticket.descrizione?.toLowerCase().includes(query) ?? false;
      const matchFornitore = ticket.fornitore_assegnato_nome.toLowerCase().includes(query);
      const matchUbicazione = ticket.ubicazione_label.toLowerCase().includes(query);
      const matchCategoria = ticket.categoria_nome.toLowerCase().includes(query);

      if (!matchTitolo && !matchDesc && !matchFornitore && !matchUbicazione && !matchCategoria) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filtra l'elenco fornitori in base alla stringa di ricerca.
 */
export function filtraFornitori(
  fornitori: FornitoreAdminView[],
  ricerca?: string,
): FornitoreAdminView[] {
  const query = (ricerca || '').trim().toLowerCase();
  if (!query) return fornitori;

  return fornitori.filter((f) => {
    const matchRagione = f.ragione_sociale.toLowerCase().includes(query);
    const matchCat = f.categoria?.toLowerCase().includes(query) ?? false;
    const matchEmail = f.email?.toLowerCase().includes(query) ?? false;
    const matchTel = f.telefono?.toLowerCase().includes(query) ?? false;
    const matchPiva = f.p_iva?.toLowerCase().includes(query) ?? false;
    return matchRagione || matchCat || matchEmail || matchTel || matchPiva;
  });
}

/**
 * Validazione creazione nuovo ticket da parte dell'amministratore.
 */
export function validaNuovoTicket(input: {
  titolo?: string | null;
  categoriaId?: string | null;
  isAreaComune?: boolean;
  unitaId?: string | null;
  priorita?: string | null;
}): { valido: boolean; errori: Record<string, string> } {
  const errori: Record<string, string> = {};
  const titolo = (input.titolo || '').trim();

  if (!titolo) {
    errori.titolo = 'Inserisci il titolo del ticket.';
  } else if (titolo.length < 3) {
    errori.titolo = 'Il titolo deve contenere almeno 3 caratteri.';
  }

  if (!input.isAreaComune && !input.unitaId) {
    errori.unitaId = 'Seleziona l’unità immobiliare interessata o contrassegna come area comune.';
  }

  return {
    valido: Object.keys(errori).length === 0,
    errori,
  };
}

/**
 * Validazione dati nuovo fornitore convenzionato.
 */
export function validaNuovoFornitore(input: {
  ragioneSociale?: string | null;
  pIva?: string | null;
  email?: string | null;
  telefono?: string | null;
  categoria?: string | null;
}): { valido: boolean; errori: Record<string, string> } {
  const errori: Record<string, string> = {};
  const ragioneSociale = (input.ragioneSociale || '').trim();
  const email = (input.email || '').trim();

  if (!ragioneSociale) {
    errori.ragioneSociale = 'Inserisci la ragione sociale del fornitore.';
  } else if (ragioneSociale.length < 2) {
    errori.ragioneSociale = 'La ragione sociale deve contenere almeno 2 caratteri.';
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errori.email = 'Inserisci un indirizzo email valido (es. info@ditta.it).';
  }

  return {
    valido: Object.keys(errori).length === 0,
    errori,
  };
}

/**
 * Validazione assegnazione fornitore e generazione Magic Link.
 */
export function validaAssegnazioneFornitore(input: {
  fornitoreId?: string | null;
  dataPrevista?: string | null;
}): { valido: boolean; errori: Record<string, string> } {
  const errori: Record<string, string> = {};

  if (!input.fornitoreId || !input.fornitoreId.trim()) {
    errori.fornitoreId = 'Seleziona il fornitore a cui affidare l’intervento.';
  }

  return {
    valido: Object.keys(errori).length === 0,
    errori,
  };
}

/**
 * Validazione chiusura ticket e consuntivo spesa.
 */
export function validaChiusuraTicket(input: {
  importoConsuntivo?: string | number | null;
}): { valido: boolean; errori: Record<string, string>; importoNumerico: number | null } {
  const errori: Record<string, string> = {};
  let importoNumerico: number | null = null;

  if (input.importoConsuntivo !== undefined && input.importoConsuntivo !== null && input.importoConsuntivo !== '') {
    const rawStr = String(input.importoConsuntivo).replace(',', '.').trim();
    const val = parseFloat(rawStr);
    if (Number.isNaN(val) || val < 0) {
      errori.importoConsuntivo = 'Inserisci un importo valido positivo (es. 150.00).';
    } else {
      importoNumerico = Math.round(val * 100) / 100;
    }
  }

  return {
    valido: Object.keys(errori).length === 0,
    errori,
    importoNumerico,
  };
}

