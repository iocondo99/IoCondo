/**
 * Logica pura per la gestione Documenti e Drive Condominiale lato Amministratore (/admin/documenti).
 * - Tipologie file e icone (PDF = rosso, Immagini = teal, Fogli di calcolo = verde, Word = blu, Generico = grigio).
 * - Badge riservatezza ('PUBBLICO' vs 'RISERVATO').
 * - Filtri per cartella attiva, ricerca per nome file, filtro per riservatezza.
 * - Formattazione dimensioni file (B, KB, MB) e date.
 * - Calcolo statistiche per le 3 StatCard ufficiali.
 * - Validazione creazione cartella e caricamento documento.
 *
 * File puro (nessuna dipendenza da React Native né Supabase): eseguibile con `node --test`.
 */

import type { BadgeStatus } from '@iocondo/ui';

export type TipoFileDocumento = 'pdf' | 'immagine' | 'foglio_calcolo' | 'testo_word' | 'generico';
export type AmbitoRiservatezza = 'PUBBLICO' | 'RISERVATO';
export type FiltroRiservatezzaAdmin = 'tutti' | 'pubblici' | 'riservati';

export interface SpecificaTipoFile {
  tipo: TipoFileDocumento;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  badgeStatus: BadgeStatus;
}

export interface CartellaAdminView {
  id: string;
  condominioId: string;
  parentId: string | null;
  nomeCartella: string;
  conteggioDocumenti: number;
  createdAt: string;
}

export interface DocumentoAdminView {
  id: string;
  cartellaId: string;
  cartellaNome: string;
  unitaId: string | null;
  unitaInterno: string | null;
  palazzoNome: string | null;
  scalaNome: string | null;
  urlStorage: string;
  nomeFile: string;
  tipoMime: string | null;
  dimensioneBytes: number | null;
  caricatoDa: string | null;
  createdAt: string;
  tipoFile: TipoFileDocumento;
  specificaTipo: SpecificaTipoFile;
  riservatezza: AmbitoRiservatezza;
  badgeRiservatezza: {
    label: string;
    status: BadgeStatus;
    isRiservato: boolean;
  };
}

export interface FiltriDocumentiAdmin {
  cartellaId?: string | null;
  ricerca?: string;
  filtroRiservatezza?: FiltroRiservatezzaAdmin;
}

export interface StatisticheDocumentiAdmin {
  totaleDocumenti: number;
  totaleCartelle: number;
  documentiRiservati: number;
}

export interface OpzioneUnitaAdmin {
  id: string;
  interno: string;
  piano: number | null;
  palazzoNome: string;
  scalaNome?: string | null;
  label: string;
}

/**
 * Determina la tipologia file partendo dall'estensione del nome o dal MIME type.
 */
export function determinaTipoFile(nomeFile: string, tipoMime?: string | null): TipoFileDocumento {
  const mime = (tipoMime || '').toLowerCase();
  const nome = (nomeFile || '').toLowerCase();
  const estensione = nome.includes('.') ? nome.split('.').pop() || '' : '';

  if (mime === 'application/pdf' || estensione === 'pdf') {
    return 'pdf';
  }

  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'heic', 'tiff'].includes(estensione)
  ) {
    return 'immagine';
  }

  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(estensione)
  ) {
    return 'foglio_calcolo';
  }

  if (
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessingml') ||
    mime.includes('text/plain') ||
    ['doc', 'docx', 'txt', 'rtf', 'odt'].includes(estensione)
  ) {
    return 'testo_word';
  }

  return 'generico';
}

/**
 * Restituisce le specifiche visive per ogni tipologia file:
 * - PDF = rosso (#B91C1C su #FEF2F2, icona file-text)
 * - Immagini = teal (#0F766E su #CCFBF1, icona image)
 * - Fogli calcolo / Excel = verde (#15803D su #F0FDF4, icona table)
 * - Word / Testo = blu (#0369A1 su #F0F9FF, icona file-text)
 * - Generico = grigio (#475569 su #F8FAFC, icona file)
 */
export function configurazioneTipoFile(tipo: TipoFileDocumento): SpecificaTipoFile {
  switch (tipo) {
    case 'pdf':
      return {
        tipo: 'pdf',
        label: 'PDF',
        icon: 'file-text',
        color: '#B91C1C',
        bgColor: '#FEF2F2',
        badgeStatus: 'error',
      };
    case 'immagine':
      return {
        tipo: 'immagine',
        label: 'Immagine',
        icon: 'image',
        color: '#0F766E',
        bgColor: '#CCFBF1',
        badgeStatus: 'info',
      };
    case 'foglio_calcolo':
      return {
        tipo: 'foglio_calcolo',
        label: 'Foglio di calcolo',
        icon: 'table',
        color: '#15803D',
        bgColor: '#F0FDF4',
        badgeStatus: 'success',
      };
    case 'testo_word':
      return {
        tipo: 'testo_word',
        label: 'Documento Word',
        icon: 'file-text',
        color: '#0369A1',
        bgColor: '#F0F9FF',
        badgeStatus: 'info',
      };
    case 'generico':
    default:
      return {
        tipo: 'generico',
        label: 'File',
        icon: 'file',
        color: '#475569',
        bgColor: '#F8FAFC',
        badgeStatus: 'neutral',
      };
  }
}

/**
 * Determina l'ambito di riservatezza (PUBBLICO se unitaId è null, RISERVATO altrimenti).
 */
export function determinaRiservatezza(unitaId: string | null | undefined): AmbitoRiservatezza {
  return unitaId && unitaId.trim() !== '' ? 'RISERVATO' : 'PUBBLICO';
}

/**
 * Restituisce configurazione badge di riservatezza:
 * - 'PUBBLICO': "Pubblico condominio", status 'condominiale' (o 'info'/'success').
 * - 'RISERVATO': "Riservato: Int. 1" (o descrizione unità), status 'personale'.
 */
export function mappaBadgeRiservatezza(
  unitaId: string | null | undefined,
  unitaInterno?: string | null,
  palazzoNome?: string | null,
): { label: string; status: BadgeStatus; isRiservato: boolean } {
  const isRiservato = determinaRiservatezza(unitaId) === 'RISERVATO';
  if (!isRiservato) {
    return {
      label: 'Condominio',
      status: 'condominiale',
      isRiservato: false,
    };
  }

  const dettaglio = [
    palazzoNome ? palazzoNome : null,
    unitaInterno ? `Int. ${unitaInterno}` : null,
  ]
    .filter(Boolean)
    .join(' - ');

  return {
    label: dettaglio || 'Unità specifica',
    status: 'personale',
    isRiservato: true,
  };
}

/**
 * Formatta la dimensione in byte nel formato umano B, KB o MB.
 */
export function formattaDimensioneFile(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
    return 'N/D';
  }
  if (bytes === 0) return '0 B';

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb.toFixed(1).replace('.', ',')} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

/**
 * Formatta una data ISO in formato italiano (GG/MM/AAAA).
 */
export function formattaDataDocumento(dataIso: string | null | undefined): string {
  if (!dataIso) return 'N/D';
  const data = new Date(dataIso);
  if (isNaN(data.getTime())) return 'N/D';
  const g = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const a = data.getFullYear();
  return `${g}/${m}/${a}`;
}

/**
 * Filtra l'elenco dei documenti per:
 * - cartella selezionata (se diversa da 'tutte' e non null/empty)
 * - ricerca testuale per nome file (case-insensitive)
 * - riservatezza ('tutti', 'pubblici', 'riservati')
 */
export function filtraDocumentiAdmin(
  documenti: readonly DocumentoAdminView[],
  filtri: FiltriDocumentiAdmin,
): DocumentoAdminView[] {
  let ris = [...documenti];

  // Filtro cartella
  if (filtri.cartellaId && filtri.cartellaId !== 'tutte') {
    ris = ris.filter((d) => d.cartellaId === filtri.cartellaId);
  }

  // Filtro ricerca testuale
  if (filtri.ricerca && filtri.ricerca.trim() !== '') {
    const q = filtri.ricerca.trim().toLowerCase();
    ris = ris.filter((d) => d.nomeFile.toLowerCase().includes(q));
  }

  // Filtro riservatezza
  if (filtri.filtroRiservatezza && filtri.filtroRiservatezza !== 'tutti') {
    if (filtri.filtroRiservatezza === 'pubblici') {
      ris = ris.filter((d) => d.riservatezza === 'PUBBLICO');
    } else if (filtri.filtroRiservatezza === 'riservati') {
      ris = ris.filter((d) => d.riservatezza === 'RISERVATO');
    }
  }

  return ris;
}

/**
 * Calcola le 3 statistiche per le StatCard ufficiali:
 * 1. Documenti archiviati (totale documenti nel condominio)
 * 2. Cartelle create (totale cartelle del condominio)
 * 3. Documenti riservati (totale documenti con unita_id valorizzato)
 */
export function calcolaStatisticheDocumentiAdmin(
  documenti: readonly DocumentoAdminView[],
  cartelle: readonly CartellaAdminView[],
): StatisticheDocumentiAdmin {
  const totaleDocumenti = documenti.length;
  const totaleCartelle = cartelle.length;
  const documentiRiservati = documenti.filter((d) => d.riservatezza === 'RISERVATO').length;

  return {
    totaleDocumenti,
    totaleCartelle,
    documentiRiservati,
  };
}

/**
 * Valida il nome di una nuova cartella.
 * Requisito: non vuoto, almeno 2 caratteri al netto degli spazi.
 */
export function validaNuovaCartella(nome: string): { valido: boolean; errore?: string } {
  const pulito = (nome || '').trim();
  if (pulito.length === 0) {
    return { valido: false, errore: 'Inserisci il nome della cartella.' };
  }
  if (pulito.length < 2) {
    return { valido: false, errore: 'Il nome della cartella deve contenere almeno 2 caratteri.' };
  }
  if (pulito.length > 80) {
    return { valido: false, errore: 'Il nome della cartella non può superare 80 caratteri.' };
  }
  return { valido: true };
}

/**
 * Valida il caricamento di un nuovo documento.
 */
export function validaCaricamentoDocumento(params: {
  cartellaId: string;
  nomeFile: string;
  filePresente: boolean;
  isRiservato: boolean;
  unitaId?: string | null;
}): { valido: boolean; errore?: string } {
  if (!params.filePresente) {
    return { valido: false, errore: 'Seleziona un file da caricare.' };
  }
  if (!params.cartellaId || params.cartellaId.trim() === '') {
    return { valido: false, errore: 'Seleziona la cartella di destinazione.' };
  }
  if (!params.nomeFile || params.nomeFile.trim() === '') {
    return { valido: false, errore: 'Nome file mancante o non valido.' };
  }
  if (params.isRiservato && (!params.unitaId || params.unitaId.trim() === '')) {
    return { valido: false, errore: 'Seleziona l’unità immobiliare a cui riservare il documento.' };
  }
  return { valido: true };
}
