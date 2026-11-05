/**
 * Logica pura per la gestione delle comunicazioni e bacheca lato Amministratore (Passo 4).
 * Nessuna dipendenza da Supabase né da React Native, testabile con `node --test`.
 */

export interface ComunicazioneAdminRaw {
  id: string;
  condominio_id: string;
  palazzo_id: string | null;
  autore_id: string | null;
  titolo: string;
  corpo: string | null;
  is_pinned: boolean;
  data_pubblicazione: string;
  updated_at?: string;
  palazzi?: {
    id: string;
    nome_identificativo: string;
  } | null;
  bacheca_commenti?: Array<{ id: string }> | null;
}

export interface ComunicazioneAdminView {
  id: string;
  condominioId: string;
  palazzoId: string | null;
  palazzoNome: string | null;
  destinatariEtichetta: string;
  autoreId: string | null;
  titolo: string;
  corpo: string;
  corpoPreview: string;
  isPinned: boolean;
  dataPubblicazione: string; // ISO
  dataPubblicazioneFormattata: string;
  conteggioCommenti: number;
  etichettaCommenti: string;
}

export interface CommentoPostAdminView {
  id: string;
  postId: string;
  autoreId: string | null;
  autoreNome: string;
  commento: string;
  createdAt: string;
  createdAtFormatted: string;
}

export interface FiltriComunicazioniAdmin {
  stato: 'tutte' | 'in_evidenza' | 'con_commenti' | string;
  palazzoId?: string | 'tutti';
  ricerca?: string;
}

export interface StatisticheComunicazioniAdmin {
  totaleAttive: number;
  inEvidenza: number;
  totaleCommenti: number;
}

export interface NuovaComunicazioneAdminInput {
  titolo: string;
  corpo: string;
  palazzoId?: string | null;
  isPinned?: boolean;
  condominioId: string;
  autoreId?: string | null;
}

export interface ModificaComunicazioneAdminInput {
  id: string;
  titolo: string;
  corpo: string;
  palazzoId?: string | null;
  isPinned?: boolean;
}

export interface ValidazioneComunicazioneResult {
  valido: boolean;
  errori: {
    titolo?: string;
    corpo?: string;
  };
}

/**
 * Validazione dei campi titolo e corpo:
 * - Titolo: minimo 3 caratteri (dopo trim)
 * - Corpo: minimo 10 caratteri (dopo trim)
 */
export function validaComunicazione(titolo?: string | null, corpo?: string | null): ValidazioneComunicazioneResult {
  const errori: { titolo?: string; corpo?: string } = {};

  const t = typeof titolo === 'string' ? titolo.trim() : '';
  if (!t) {
    errori.titolo = 'Inserisci il titolo della comunicazione.';
  } else if (t.length < 3) {
    errori.titolo = 'Il titolo deve contenere almeno 3 caratteri.';
  }

  const c = typeof corpo === 'string' ? corpo.trim() : '';
  if (!c) {
    errori.corpo = 'Inserisci il testo della comunicazione.';
  } else if (c.length < 10) {
    errori.corpo = 'Il testo deve contenere almeno 10 caratteri.';
  }

  return {
    valido: Object.keys(errori).length === 0,
    errori,
  };
}

/** Formatta la data in formato italiano compatto (es. "5 nov 2026"). */
export function formattaDataItaliana(dataIsoOrDate: string | Date | null | undefined): string {
  if (!dataIsoOrDate) return '—';
  const d = typeof dataIsoOrDate === 'string' ? new Date(dataIsoOrDate) : dataIsoOrDate;
  if (isNaN(d.getTime())) return '—';

  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const giorno = d.getDate();
  const mese = MESI[d.getMonth()];
  const anno = d.getFullYear();
  return `${giorno} ${mese} ${anno}`;
}

/** Formatta l'etichetta per i destinatari dell'avviso. */
export function formattaDestinatari(palazzoNome?: string | null): string {
  const trimmed = palazzoNome?.trim();
  if (!trimmed) {
    return 'Intero condominio';
  }
  return trimmed;
}

/** Formatta l'etichetta del conteggio commenti con declinazione corretta. */
export function formattaEtichettaCommenti(conteggio: number): string {
  if (conteggio === 1) {
    return '1 commento';
  }
  return `${conteggio} commenti`;
}

/** Tronca un testo a un numero massimo di caratteri aggiungendo ellissi. */
export function troncaTesto(testo: string | null | undefined, maxLength = 120): string {
  if (!testo) return '';
  const trimmed = testo.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Trasforma una riga raw del DB in una vista UI completa e pronta.
 */
export function trasformaComunicazioneRawInView(raw: ComunicazioneAdminRaw): ComunicazioneAdminView {
  const palazzoNome = raw.palazzi?.nome_identificativo ?? null;
  const conteggioCommenti = Array.isArray(raw.bacheca_commenti) ? raw.bacheca_commenti.length : 0;
  const corpo = raw.corpo ?? '';

  return {
    id: raw.id,
    condominioId: raw.condominio_id,
    palazzoId: raw.palazzo_id,
    palazzoNome,
    destinatariEtichetta: formattaDestinatari(palazzoNome),
    autoreId: raw.autore_id,
    titolo: raw.titolo,
    corpo,
    corpoPreview: troncaTesto(corpo, 130),
    isPinned: Boolean(raw.is_pinned),
    dataPubblicazione: raw.data_pubblicazione,
    dataPubblicazioneFormattata: formattaDataItaliana(raw.data_pubblicazione),
    conteggioCommenti,
    etichettaCommenti: formattaEtichettaCommenti(conteggioCommenti),
  };
}

/**
 * Ordinamento ufficiale bacheca:
 * 1. Post in evidenza (`is_pinned = true`) sempre per primi.
 * 2. A parità di pin, ordine cronologico decrescente (`data_pubblicazione` più recente prima).
 */
export function ordinaComunicazioni<T extends { isPinned: boolean; dataPubblicazione: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    const timeA = new Date(a.dataPubblicazione).getTime();
    const timeB = new Date(b.dataPubblicazione).getTime();
    return timeB - timeA;
  });
}

/**
 * Filtra le comunicazioni per:
 * - Stato: 'tutte', 'in_evidenza', 'con_commenti'
 * - Palazzo/Edificio: 'tutti' o ID specifico
 * - Ricerca testuale: su titolo e corpo
 */
export function filtraComunicazioni<T extends ComunicazioneAdminView>(
  items: readonly T[],
  filtri: FiltriComunicazioniAdmin,
): T[] {
  const stato = filtri.stato || 'tutte';
  const palazzoId = filtri.palazzoId || 'tutti';
  const query = (filtri.ricerca || '').trim().toLowerCase();

  const filtrati = items.filter((item) => {
    // 1. Filtro stato
    if (stato === 'in_evidenza' && !item.isPinned) {
      return false;
    }
    if (stato === 'con_commenti' && item.conteggioCommenti <= 0) {
      return false;
    }

    // 2. Filtro edificio/palazzo
    if (palazzoId !== 'tutti' && palazzoId !== '') {
      if (item.palazzoId !== palazzoId) {
        return false;
      }
    }

    // 3. Ricerca testuale
    if (query) {
      const matchTitolo = item.titolo.toLowerCase().includes(query);
      const matchCorpo = item.corpo.toLowerCase().includes(query);
      if (!matchTitolo && !matchCorpo) {
        return false;
      }
    }

    return true;
  });

  return ordinaComunicazioni(filtrati);
}

/**
 * Calcola i 3 KPI riepilogativi per le StatCard ufficiali:
 * - Comunicazioni attive (totale)
 * - Avvisi in evidenza (is_pinned = true)
 * - Commenti dei residenti (somma conteggio commenti)
 */
export function calcolaStatisticheComunicazioni<T extends { isPinned: boolean; conteggioCommenti: number }>(
  items: readonly T[],
): StatisticheComunicazioniAdmin {
  let inEvidenza = 0;
  let totaleCommenti = 0;

  for (const item of items) {
    if (item.isPinned) {
      inEvidenza += 1;
    }
    totaleCommenti += item.conteggioCommenti || 0;
  }

  return {
    totaleAttive: items.length,
    inEvidenza,
    totaleCommenti,
  };
}

