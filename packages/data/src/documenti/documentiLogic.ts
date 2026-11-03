/**
 * Logica pura della sezione Documenti del condòmino (`/documenti` e `/documenti/[id]`):
 * - isolamento lato client del residente (`unita_id IS NULL` oppure unità propria nel condominio selezionato),
 *   anche se l'utente è ADMIN o `is_superadmin` (coerente con `homeService.contaDocumenti`);
 * - distinzione di visibilità (`Condominiale` vs `Personale / Unità Int. <interno>`);
 * - riepilogo per le 3 StatCard (totale disponibili, condominiali, della propria unità);
 * - filtro per cartella (`Tutte` + cartelle del condominio), ricerca per nome file o cartella,
 *   ordinamento per data di caricamento (`created_at`) e nome file (`nome_file`), paginazione;
 * - validazione sicura del percorso `url_storage` nel bucket privato `documenti-condominio`
 *   (nessun path traversal `..`, appartenenza al condominio selezionato o al prefisso `seed-dev/`).
 *
 * File puro (nessuna dipendenza da React Native o Supabase): eseguibile con `node --test`.
 * Nessun uso di `Intl` o `localeCompare` (compatibilità Hermes).
 */

import { filtroNulloOppureIn } from '../home/homeLogic.ts';

export const BUCKET_DOCUMENTI_CONDOMINIO = 'documenti-condominio';
export const DURATA_LINK_DOCUMENTO_SECONDI = 600;
export const PER_PAGINA_DOCUMENTI = 10;
export const CARTELLA_PREDEFINITA = 'Generale';
export const MESSAGGIO_FILE_NON_DISPONIBILE =
  'File non ancora disponibile nello spazio di archiviazione';

export type VisibilitaDocumento = 'condominiale' | 'personale';

export interface CartellaDocumento {
  id: string;
  condominioId: string;
  parentId: string | null;
  nomeCartella: string;
}

export interface DocumentoCondomino {
  id: string;
  condominioId: string;
  cartellaId: string;
  cartellaNome: string;
  unitaId: string | null;
  unitaInterno: string | null;
  visibilita: VisibilitaDocumento;
  etichettaVisibilita: string;
  nomeFile: string;
  tipoMime: string | null;
  urlStorage: string;
  createdAt: string;
}

export interface DettaglioDocumentoCondomino extends DocumentoCondomino {
  /** Percorso validato nel bucket privato `documenti-condominio`, oppure `null` se non valido. */
  percorsoStorage: string | null;
  /** `true` solo se l'oggetto esiste realmente nello Storage privato `documenti-condominio`. */
  disponibileNelloStorage: boolean;
}

export interface RiepilogoDocumenti {
  totale: number;
  condominiali: number;
  personali: number;
  cartelle: number;
}

export interface FiltriDocumenti {
  cartellaId: string;
  ricerca: string;
}

export type OrdineDocumenti = 'data-desc' | 'data-asc' | 'nome-asc' | 'nome-desc';

/** Stesso formato di `SortState` di `@iocondo/ui`. */
export interface OrdineColonnaDocumenti {
  key: string;
  direction: 'ascending' | 'descending';
}

export interface OpzioneFiltroCartella {
  value: string;
  label: string;
  count: number;
}

export interface PaginaDocumenti {
  documenti: DocumentoCondomino[];
  totaleFiltrati: number;
  pagina: number;
  numeroPagine: number;
}

const ORDINE_DA_COLONNA_DOCUMENTI: Record<
  string,
  { ascending: OrdineDocumenti; descending: OrdineDocumenti }
> = {
  data: { ascending: 'data-asc', descending: 'data-desc' },
  nome: { ascending: 'nome-asc', descending: 'nome-desc' },
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

// ─── Isolamento e visibilità del residente ───────────────────────────────────

/**
 * Filtro PostgREST (`.or(...)`) per `documenti_metadata` sulla colonna `unita_id`:
 * include i documenti condominiali (`unita_id IS NULL`) e quelli associati alle unità del residente,
 * esattamente coerente con `homeService.contaDocumenti`.
 */
export function filtroDocumentiPostgrest(unitaResidenteIds: readonly string[]): string {
  return filtroNulloOppureIn('unita_id', unitaResidenteIds);
}

/**
 * Verifica in difesa in profondità se un documento è visibile al residente nella vista condòmino:
 * 1. deve appartenere al condominio selezionato (`condominioId`);
 * 2. deve essere condominiale (`unitaId === null`) oppure associato a un'unità del residente
 *    (`unitaResidenteIds`).
 * Anche un amministratore o superadmin che usa la vista condòmino vede solo questi documenti.
 */
export function documentoVisibileAResidente(
  documento: { condominioId: string; unitaId: string | null } | null | undefined,
  condominioId: string,
  unitaResidenteIds: readonly string[],
): boolean {
  if (!documento || !condominioId) return false;
  if (documento.condominioId !== condominioId) return false;
  if (documento.unitaId === null) return true;
  return unitaResidenteIds.includes(documento.unitaId);
}

/**
 * Filtra un elenco di documenti mantenendo solo quelli visibili al residente nel condominio selezionato.
 */
export function filtraDocumentiVisibili<T extends { condominioId: string; unitaId: string | null }>(
  documenti: readonly T[],
  condominioId: string,
  unitaResidenteIds: readonly string[],
): T[] {
  return documenti.filter((d) => documentoVisibileAResidente(d, condominioId, unitaResidenteIds));
}

/** Tipo di visibilità del documento (`condominiale` se `unitaId` è nullo, `personale` se associato a un'unità). */
export function visibilitaDocumento(unitaId: string | null | undefined): VisibilitaDocumento {
  return unitaId ? 'personale' : 'condominiale';
}

/**
 * Etichetta sintetica per il `Badge` di visibilità:
 * - `'Condominiale'` se `unitaId` è nullo;
 * - `'Unità Int. <interno>'` (o `'Personale'` se manca l'interno) se associato a una propria unità.
 */
export function etichettaVisibilitaDocumento(
  unitaId: string | null | undefined,
  unitaInterno?: string | null,
): string {
  if (!unitaId) return 'Condominiale';
  const interno = unitaInterno?.trim();
  if (!interno) return 'Personale';
  if (/^unit[aà](\s|$)/i.test(interno)) return interno;
  if (/^int\.?\s*/i.test(interno)) return `Unità ${interno}`;
  return `Unità Int. ${interno}`;
}

/** Descrizione estesa della visibilità per la scheda di riepilogo nel dettaglio documento. */
export function descrizioneVisibilitaDocumento(
  unitaId: string | null | undefined,
  unitaInterno?: string | null,
): string {
  if (!unitaId) return 'Condominiale (visibile ai residenti del condominio)';
  const interno = unitaInterno?.trim();
  if (!interno) return 'Personale (associato alla tua unità immobiliare)';
  return `Personale — ${etichettaVisibilitaDocumento(unitaId, interno)}`;
}

// ─── Riepilogo per le 3 StatCard ─────────────────────────────────────────────

/**
 * Calcola i contatori reali per le `StatCard` in cima a `/documenti`:
 * totale documenti disponibili, documenti condominiali (`unitaId === null`),
 * documenti della propria unità (`unitaId !== null`) e numero di cartelle con documenti.
 */
export function riepilogoDocumenti(
  documenti: readonly Pick<DocumentoCondomino, 'unitaId' | 'cartellaId'>[],
): RiepilogoDocumenti {
  let condominiali = 0;
  let personali = 0;
  const cartelleSet = new Set<string>();

  for (const doc of documenti) {
    if (doc.cartellaId) cartelleSet.add(doc.cartellaId);
    if (doc.unitaId === null) {
      condominiali += 1;
    } else {
      personali += 1;
    }
  }

  return {
    totale: documenti.length,
    condominiali,
    personali,
    cartelle: cartelleSet.size,
  };
}

// ─── Filtri, ricerca, ordinamento e paginazione ──────────────────────────────

/**
 * Costruisce le opzioni per i `FilterChips` per cartella:
 * la prima opzione è sempre `{ value: 'tutte', label: 'Tutte', count: documenti.length }`,
 * seguita dalle cartelle del condominio ordinate alfabeticamente con il relativo conteggio.
 */
export function opzioniFiltroCartelle(
  cartelle: readonly Pick<CartellaDocumento, 'id' | 'nomeCartella'>[],
  documenti: readonly Pick<DocumentoCondomino, 'cartellaId' | 'cartellaNome'>[],
): OpzioneFiltroCartella[] {
  const opzioni: OpzioneFiltroCartella[] = [
    { value: 'tutte', label: 'Tutte', count: documenti.length },
  ];

  const mappaCartelle = new Map<string, { label: string; count: number }>();
  for (const c of cartelle) {
    const label = c.nomeCartella.trim() || CARTELLA_PREDEFINITA;
    if (!mappaCartelle.has(c.id)) {
      mappaCartelle.set(c.id, { label, count: 0 });
    }
  }

  for (const d of documenti) {
    const esistente = mappaCartelle.get(d.cartellaId);
    if (esistente) {
      esistente.count += 1;
    } else if (d.cartellaId) {
      mappaCartelle.set(d.cartellaId, {
        label: d.cartellaNome.trim() || CARTELLA_PREDEFINITA,
        count: 1,
      });
    }
  }

  const vociOrdinate = [...mappaCartelle.entries()].sort((a, b) =>
    confrontaTesto(a[1].label, b[1].label) || confrontaTesto(a[0], b[0]),
  );

  for (const [value, info] of vociOrdinate) {
    opzioni.push({ value, label: info.label, count: info.count });
  }

  return opzioni;
}

/** Quanti filtri sono attivi (cartella specifica selezionata + ricerca testuale non vuota). */
export function filtriDocumentiAttivi(filtri: FiltriDocumenti): number {
  const haCartella = Boolean(filtri.cartellaId && filtri.cartellaId !== 'tutte');
  const haRicerca = filtri.ricerca.trim().length > 0;
  return (haCartella ? 1 : 0) + (haRicerca ? 1 : 0);
}

/**
 * Filtra i documenti per cartella (`'tutte'` o `''` = tutte le cartelle)
 * e per ricerca testuale su nome file, nome cartella ed etichetta di visibilità.
 */
export function filtraDocumenti(
  documenti: readonly DocumentoCondomino[],
  filtri: FiltriDocumenti,
): DocumentoCondomino[] {
  const cartellaFiltro = filtri.cartellaId.trim();
  const termine = filtri.ricerca.trim().toLowerCase();

  return documenti.filter((d) => {
    if (cartellaFiltro && cartellaFiltro !== 'tutte' && d.cartellaId !== cartellaFiltro) {
      return false;
    }
    if (!termine) return true;
    return (
      d.nomeFile.toLowerCase().includes(termine) ||
      d.cartellaNome.toLowerCase().includes(termine) ||
      d.etichettaVisibilita.toLowerCase().includes(termine)
    );
  });
}

/** Da stato di ordinamento colonna (`SortState`) a `OrdineDocumenti`. */
export function ordineDaColonnaDocumenti(sort: OrdineColonnaDocumenti | null): OrdineDocumenti {
  if (!sort) return 'data-desc';
  return ORDINE_DA_COLONNA_DOCUMENTI[sort.key]?.[sort.direction] ?? 'data-desc';
}

/** Da `OrdineDocumenti` a stato di ordinamento colonna (`SortState`) per `ResponsiveDataView`. */
export function colonnaDaOrdineDocumenti(ordine: OrdineDocumenti): OrdineColonnaDocumenti {
  for (const [key, versi] of Object.entries(ORDINE_DA_COLONNA_DOCUMENTI)) {
    if (versi.ascending === ordine) return { key, direction: 'ascending' };
    if (versi.descending === ordine) return { key, direction: 'descending' };
  }
  return { key: 'data', direction: 'descending' };
}

/**
 * Ordina una copia dei documenti per data di caricamento (`data-desc` / `data-asc`)
 * oppure per nome file (`nome-asc` / `nome-desc`), con spareggio deterministico.
 */
export function ordinaDocumenti(
  documenti: readonly DocumentoCondomino[],
  ordine: OrdineDocumenti = 'data-desc',
): DocumentoCondomino[] {
  return [...documenti].sort((a, b) => {
    if (ordine === 'data-desc') {
      const cmp = confrontaDataIso(b.createdAt, a.createdAt);
      if (cmp !== 0) return cmp;
    } else if (ordine === 'data-asc') {
      const cmp = confrontaDataIso(a.createdAt, b.createdAt);
      if (cmp !== 0) return cmp;
    } else if (ordine === 'nome-asc') {
      const cmp = confrontaTesto(a.nomeFile, b.nomeFile);
      if (cmp !== 0) return cmp;
    } else if (ordine === 'nome-desc') {
      const cmp = confrontaTesto(b.nomeFile, a.nomeFile);
      if (cmp !== 0) return cmp;
    }

    const perNome = confrontaTesto(a.nomeFile, b.nomeFile);
    if (perNome !== 0) return perNome;
    const perData = confrontaDataIso(b.createdAt, a.createdAt);
    if (perData !== 0) return perData;
    return confrontaTesto(a.id, b.id);
  });
}

/**
 * Esegue la pipeline completa (filtri -> ordinamento -> paginazione) per la pagina `/documenti`.
 */
export function paginaDocumenti(
  documenti: readonly DocumentoCondomino[],
  filtri: FiltriDocumenti,
  ordine: OrdineDocumenti = 'data-desc',
  paginaRichiesta: number = 1,
  perPagina: number = PER_PAGINA_DOCUMENTI,
): PaginaDocumenti {
  const dimensione = Math.max(1, Math.floor(perPagina));
  const filtrati = filtraDocumenti(documenti, filtri);
  const ordinati = ordinaDocumenti(filtrati, ordine);
  const totaleFiltrati = ordinati.length;
  const numeroPagine = Math.max(1, Math.ceil(totaleFiltrati / dimensione));
  const pagina = Math.min(Math.max(1, Math.floor(paginaRichiesta) || 1), numeroPagine);
  const inizio = (pagina - 1) * dimensione;

  return {
    documenti: ordinati.slice(inizio, inizio + dimensione),
    totaleFiltrati,
    pagina,
    numeroPagine,
  };
}

// ─── Validazione sicura del percorso Storage ─────────────────────────────────

/**
 * Valida e normalizza il percorso `url_storage` per il bucket privato `documenti-condominio`:
 * - rifiuta valori nulli/vuoti, URL assoluti (`http://`, `https://`, ecc.), barre iniziali o backslash;
 * - rifiuta qualsiasi tentativo di path traversal (`..`, `.`, segmenti vuoti);
 * - accetta solo percorsi il cui primo segmento corrisponde a `condominioId` oppure al prefisso
 *   dei metadati di prova `seed-dev/`.
 */
export function validaPercorsoDocumentoStorage(
  urlStorage: string | null | undefined,
  condominioId: string,
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

  const senzaBucket = pulito.startsWith(`${BUCKET_DOCUMENTI_CONDOMINIO}/`)
    ? pulito.slice(BUCKET_DOCUMENTI_CONDOMINIO.length + 1)
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

  return senzaBucket;
}

/** Scompone un percorso Storage validato in `{ cartella, nomeFile }`. */
export function scomponiPercorsoStorage(
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

// ─── Testi e formattazione per la UI ─────────────────────────────────────────

/** Sottotitolo della pagina Documenti in base al condominio selezionato. */
export function sottotitoloDocumenti(condominioNome: string | null | undefined): string {
  const nome = condominioNome?.trim();
  return nome
    ? `${nome} — regolamenti, verbali e documenti`
    : 'Regolamenti, verbali e documenti del condominio';
}

/** Etichetta leggibile in italiano per il formato / tipo MIME del documento. */
export function etichettaFormatoDocumento(
  tipoMime: string | null | undefined,
  nomeFile?: string | null,
): string {
  const mime = tipoMime?.trim().toLowerCase() ?? '';
  if (mime === 'application/pdf') return 'Documento PDF (application/pdf)';
  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return `Documento Word (${tipoMime!.trim()})`;
  }
  if (
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return `Foglio di calcolo Excel (${tipoMime!.trim()})`;
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'Immagine JPEG (image/jpeg)';
  if (mime === 'image/png') return 'Immagine PNG (image/png)';
  if (mime) return tipoMime!.trim();

  const nome = nomeFile?.trim().toLowerCase() ?? '';
  if (nome.endsWith('.pdf')) return 'Documento PDF';
  if (nome.endsWith('.doc') || nome.endsWith('.docx')) return 'Documento Word';
  if (nome.endsWith('.xls') || nome.endsWith('.xlsx')) return 'Foglio di calcolo Excel';
  if (nome.endsWith('.jpg') || nome.endsWith('.jpeg')) return 'Immagine JPEG';
  if (nome.endsWith('.png')) return 'Immagine PNG';
  return 'Documento';
}

/** Etichetta accessibile completa per una riga dell'elenco documenti. */
export function etichettaRigaDocumento(doc: DocumentoCondomino, dataFormattata: string): string {
  return `${doc.nomeFile}, cartella ${doc.cartellaNome}, visibilità ${doc.etichettaVisibilita}, caricato il ${dataFormattata}`;
}
