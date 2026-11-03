/**
 * Logica pura della pagina Spese del condòmino (/spese e /spese/[id]):
 * visibilità degli esercizi, riepilogo con i 3 indicatori, totali per esercizio
 * e per macro-categoria, filtri per sottoconto/macro-categoria, ricerca,
 * ordinamento per data e importo, paginazione e validazione del percorso Storage.
 * Nessuna dipendenza da React o Supabase: eseguibile con `node --test`.
 */

export const STATI_ESERCIZIO_VISIBILI = ['PREVENTIVO', 'CONSUNTIVO', 'CHIUSO'] as const;

export type StatoEsercizioContabile = (typeof STATI_ESERCIZIO_VISIBILI)[number];

/** Stati corrispondenti del componente Badge di `@iocondo/ui`. */
export type StatoBadgeEsercizio = 'preventivo' | 'consuntivo' | 'chiuso';

export interface EsercizioSpese {
  id: string;
  condominioId: string;
  anno: number;
  /** Data inizio esercizio in formato AAAA-MM-GG. */
  dataInizio: string;
  /** Data fine esercizio in formato AAAA-MM-GG. */
  dataFine: string;
  stato: StatoEsercizioContabile;
  /** Totale delle spese (movimenti con segno '-') dell'esercizio, in euro. */
  totaleSpese: number;
  /** Numero di movimenti di spesa dell'esercizio. */
  numeroMovimenti: number;
}

export interface DocumentoAllegatoSpese {
  id: string;
  nomeFile: string;
  tipoMime: string;
  /** Percorso relativo verificato nel bucket privato `documenti-condominio`. */
  percorsoStorage: string;
}

export interface MovimentoSpesa {
  id: string;
  esercizioId: string;
  /** Data movimento in formato AAAA-MM-GG. */
  data: string;
  descrizione: string;
  importo: number;
  segno: '-' | '+';
  sottocontoId: string | null;
  sottocontoDescrizione: string;
  macroId: string | null;
  macroCodice: string | null;
  macroDescrizione: string;
  /** Valorizzato solo se doc_allegato_id esiste in documenti_metadata ed è presente nello Storage. */
  documentoAllegato: DocumentoAllegatoSpese | null;
}

export interface TotaleMacroCategoria {
  chiave: string;
  codice: string | null;
  descrizione: string;
  totale: number;
  numeroMovimenti: number;
  /** Quota percentuale (0-100) sul totale delle spese dell'esercizio. */
  percentuale: number;
}

export interface DettaglioEsercizioSpese {
  esercizio: EsercizioSpese;
  movimenti: MovimentoSpesa[];
  totaliMacro: TotaleMacroCategoria[];
  documentiAllegati: DocumentoAllegatoSpese[];
}

export interface RiepilogoEserciziSpese {
  /** Esercizio dell'anno in corso (o l'ultimo esercizio aperto disponibile). */
  esercizioInCorso: EsercizioSpese | null;
  /** Ultimo esercizio con stato CONSUNTIVO (o CHIUSO se non c'è un CONSUNTIVO aperto). */
  ultimoConsuntivo: EsercizioSpese | null;
  /** Esercizio con stato PREVENTIVO più recente, se presente. */
  preventivoInCorso: EsercizioSpese | null;
}

export type OrdineMovimentiSpese = 'data-desc' | 'data-asc' | 'importo-desc' | 'importo-asc';

/** Stesso formato di `SortState` di `@iocondo/ui`. */
export interface OrdineColonnaSpese {
  key: string;
  direction: 'ascending' | 'descending';
}

export interface OpzioneFiltroSpese {
  value: string;
  label: string;
  count: number;
}

export interface PaginaMovimentiSpese {
  righe: MovimentoSpesa[];
  pagina: number;
  pagineTotali: number;
  totaleRighe: number;
}

export const PER_PAGINA_SPESE = 10;

export const SOTTOCONTO_PREDEFINITO = 'Non classificato';
export const MACRO_CATEGORIA_PREDEFINITA = 'Altre spese';

const BUCKET_DOCUMENTI = 'documenti-condominio';

const ORDINE_DA_COLONNA_SPESE: Record<
  string,
  { ascending: OrdineMovimentiSpese; descending: OrdineMovimentiSpese }
> = {
  data: { ascending: 'data-asc', descending: 'data-desc' },
  importo: { ascending: 'importo-asc', descending: 'importo-desc' },
};

const arrotondaEuro = (valore: number): number => Math.round(valore * 100) / 100;

/** Confronto lessicografico ASCII sicuro su Hermes (senza `Intl` né `localeCompare`). */
function confrontaTesto(a: string, b: string): number {
  const sinistro = a.toLowerCase();
  const destro = b.toLowerCase();
  if (sinistro < destro) return -1;
  if (sinistro > destro) return 1;
  return 0;
}

/** Sottotitolo della pagina Spese in base al condominio selezionato. */
export function sottotitoloSpese(condominioNome: string | null | undefined): string {
  return condominioNome
    ? `${condominioNome} — consuntivi e preventivi del condominio`
    : 'Consuntivi e preventivi del condominio';
}

/** Da stato di ordinamento colonna (`SortState`) a `OrdineMovimentiSpese`. */
export function ordineDaColonnaSpese(sort: OrdineColonnaSpese | null): OrdineMovimentiSpese {
  if (!sort) return 'data-desc';
  return ORDINE_DA_COLONNA_SPESE[sort.key]?.[sort.direction] ?? 'data-desc';
}

/** Da `OrdineMovimentiSpese` a stato di ordinamento colonna (`SortState`) per `ResponsiveDataView`. */
export function colonnaDaOrdineSpese(ordine: OrdineMovimentiSpese): OrdineColonnaSpese {
  for (const [key, versi] of Object.entries(ORDINE_DA_COLONNA_SPESE)) {
    if (versi.ascending === ordine) return { key, direction: 'ascending' };
    if (versi.descending === ordine) return { key, direction: 'descending' };
  }
  return { key: 'data', direction: 'descending' };
}

/**
 * Verifica che lo stato dell'esercizio sia tra quelli pubblicati e visibili al condòmino
 * (`PREVENTIVO`, `CONSUNTIVO`, `CHIUSO`). Esclude eventuali stati `BOZZA` o sconosciuti.
 */
export function statoEsercizioVisibile(stato: string | null | undefined): stato is StatoEsercizioContabile {
  return stato === 'PREVENTIVO' || stato === 'CONSUNTIVO' || stato === 'CHIUSO';
}

/**
 * Un esercizio è visibile al condòmino solo se appartiene al condominio selezionato
 * e ha uno stato pubblicato (`PREVENTIVO`, `CONSUNTIVO`, `CHIUSO`).
 */
export function esercizioVisibileA(
  esercizio: { condominioId: string; stato: string } | null | undefined,
  condominioId: string,
): boolean {
  if (!esercizio || !condominioId) return false;
  if (esercizio.condominioId !== condominioId) return false;
  return statoEsercizioVisibile(esercizio.stato);
}

/** Mappa lo stato contabile dell'esercizio allo stato del `Badge` del design system. */
export function statoBadgeEsercizio(stato: StatoEsercizioContabile): StatoBadgeEsercizio {
  switch (stato) {
    case 'PREVENTIVO':
      return 'preventivo';
    case 'CONSUNTIVO':
      return 'consuntivo';
    case 'CHIUSO':
      return 'chiuso';
  }
}

/** Etichetta leggibile in italiano per lo stato dell'esercizio. */
export function etichettaStatoEsercizio(stato: StatoEsercizioContabile): string {
  switch (stato) {
    case 'PREVENTIVO':
      return 'Preventivo';
    case 'CONSUNTIVO':
      return 'Consuntivo';
    case 'CHIUSO':
      return 'Chiuso';
  }
}

/** Etichetta leggibile per il segno del movimento contabile. */
export function etichettaSegnoMovimento(segno: '-' | '+'): string {
  return segno === '-' ? 'Spesa (−)' : 'Rettifica (+)';
}

/**
 * Calcola il totale delle spese da un elenco di movimenti contabili.
 * Somma gli importi positivi dei movimenti di spesa (`segno === '-'`).
 */
export function calcolaTotaleSpese(
  movimenti: readonly Pick<MovimentoSpesa, 'importo' | 'segno'>[],
): number {
  let somma = 0;
  for (const m of movimenti) {
    if (m.segno === '-' && Number.isFinite(m.importo) && m.importo > 0) {
      somma += m.importo;
    }
  }
  return arrotondaEuro(somma);
}

/**
 * Ordina gli esercizi per anno decrescente e, a parità di anno, per data di inizio decrescente.
 */
export function ordinaEserciziSpese(esercizi: readonly EsercizioSpese[]): EsercizioSpese[] {
  return [...esercizi].sort((a, b) => {
    if (a.anno !== b.anno) return b.anno - a.anno;
    if (a.dataInizio !== b.dataInizio) return a.dataInizio < b.dataInizio ? 1 : -1;
    return confrontaTesto(a.id, b.id);
  });
}

/**
 * Calcola i 3 indicatori di riepilogo in cima alla pagina `/spese`:
 * 1. Totale spese dell'esercizio in corso (anno corrente oppure ultimo esercizio non chiuso, o il più recente).
 * 2. Ultimo consuntivo approvato (esercizio più recente con stato `CONSUNTIVO`, o `CHIUSO` se non c'è un `CONSUNTIVO`).
 * 3. Preventivo in corso (esercizio più recente con stato `PREVENTIVO`, se presente).
 */
export function riepilogoEserciziSpese(
  esercizi: readonly EsercizioSpese[],
  annoCorrente: number = new Date().getFullYear(),
): RiepilogoEserciziSpese {
  const ordinati = ordinaEserciziSpese(esercizi);
  if (ordinati.length === 0) {
    return {
      esercizioInCorso: null,
      ultimoConsuntivo: null,
      preventivoInCorso: null,
    };
  }

  const esercizioInCorso =
    ordinati.find((e) => e.anno === annoCorrente) ??
    ordinati.find((e) => e.stato !== 'CHIUSO') ??
    ordinati[0] ??
    null;

  const ultimoConsuntivo =
    ordinati.find((e) => e.stato === 'CONSUNTIVO') ??
    ordinati.find((e) => e.stato === 'CHIUSO') ??
    null;

  const preventivoInCorso = ordinati.find((e) => e.stato === 'PREVENTIVO') ?? null;

  return {
    esercizioInCorso,
    ultimoConsuntivo,
    preventivoInCorso,
  };
}

/**
 * Calcola i totali per macro-categoria del piano dei conti a partire dai movimenti di spesa.
 * Restituisce le categorie ordinate per importo totale decrescente e poi per descrizione.
 */
export function totaliPerMacroCategoria(movimenti: readonly MovimentoSpesa[]): TotaleMacroCategoria[] {
  const spese = movimenti.filter((m) => m.segno === '-' && Number.isFinite(m.importo) && m.importo > 0);
  if (spese.length === 0) return [];

  const totaleGenerale = calcolaTotaleSpese(spese);
  const gruppi = new Map<
    string,
    { chiave: string; codice: string | null; descrizione: string; totale: number; numeroMovimenti: number }
  >();

  for (const m of spese) {
    const descrizione = m.macroDescrizione.trim() || MACRO_CATEGORIA_PREDEFINITA;
    const chiave = m.macroId ?? `macro:${descrizione.toLowerCase()}`;
    const esistente = gruppi.get(chiave);
    if (esistente) {
      esistente.totale += m.importo;
      esistente.numeroMovimenti += 1;
    } else {
      gruppi.set(chiave, {
        chiave,
        codice: m.macroCodice,
        descrizione,
        totale: m.importo,
        numeroMovimenti: 1,
      });
    }
  }

  return [...gruppi.values()]
    .map((g) => {
      const totale = arrotondaEuro(g.totale);
      const percentuale = totaleGenerale > 0 ? Math.round((totale / totaleGenerale) * 100) : 0;
      return {
        chiave: g.chiave,
        codice: g.codice,
        descrizione: g.descrizione,
        totale,
        numeroMovimenti: g.numeroMovimenti,
        percentuale,
      };
    })
    .sort((a, b) => {
      if (b.totale !== a.totale) return b.totale - a.totale;
      return confrontaTesto(a.descrizione, b.descrizione);
    });
}

/**
 * Costruisce le opzioni per i `FilterChips` del dettaglio esercizio.
 * Se i movimenti hanno sottoconti distinti, crea i filtri per sottoconto;
 * altrimenti usa le macro-categorie quando disponibili.
 */
export function opzioniFiltroMovimenti(movimenti: readonly MovimentoSpesa[]): OpzioneFiltroSpese[] {
  const opzioni: OpzioneFiltroSpese[] = [{ value: 'tutti', label: 'Tutte', count: movimenti.length }];
  if (movimenti.length === 0) return opzioni;

  const perSottoconto = new Map<string, { label: string; count: number }>();
  for (const m of movimenti) {
    const label = m.sottocontoDescrizione.trim() || SOTTOCONTO_PREDEFINITO;
    const chiave = m.sottocontoId ? `sottoconto:${m.sottocontoId}` : `sottoconto:${label.toLowerCase()}`;
    const corrente = perSottoconto.get(chiave);
    if (corrente) {
      corrente.count += 1;
    } else {
      perSottoconto.set(chiave, { label, count: 1 });
    }
  }

  const vociOrdinate = [...perSottoconto.entries()].sort((a, b) => confrontaTesto(a[1].label, b[1].label));
  for (const [value, info] of vociOrdinate) {
    opzioni.push({ value, label: info.label, count: info.count });
  }
  return opzioni;
}

/** Verifica se un movimento corrisponde al filtro categoria/sottoconto selezionato. */
function corrispondeCategoria(movimento: MovimentoSpesa, filtro: string): boolean {
  if (!filtro || filtro === 'tutti') return true;
  const labelSottoconto = movimento.sottocontoDescrizione.trim() || SOTTOCONTO_PREDEFINITO;
  const chiaveSottoconto = movimento.sottocontoId
    ? `sottoconto:${movimento.sottocontoId}`
    : `sottoconto:${labelSottoconto.toLowerCase()}`;
  if (filtro === chiaveSottoconto || filtro === movimento.sottocontoId || filtro === labelSottoconto) {
    return true;
  }
  const labelMacro = movimento.macroDescrizione.trim() || MACRO_CATEGORIA_PREDEFINITA;
  const chiaveMacro = movimento.macroId ? `macro:${movimento.macroId}` : `macro:${labelMacro.toLowerCase()}`;
  return filtro === chiaveMacro || filtro === movimento.macroId || filtro === labelMacro;
}

/**
 * Filtra i movimenti per sottoconto/macro-categoria e per ricerca testuale
 * sulla descrizione (oltre che su sottoconto e macro-categoria).
 */
export function filtraMovimentiSpese(
  movimenti: readonly MovimentoSpesa[],
  filtroCategoria: string,
  ricercaDescrizione: string,
): MovimentoSpesa[] {
  const termine = ricercaDescrizione.trim().toLowerCase();
  return movimenti.filter((m) => {
    if (!corrispondeCategoria(m, filtroCategoria)) return false;
    if (!termine) return true;
    return (
      m.descrizione.toLowerCase().includes(termine) ||
      m.sottocontoDescrizione.toLowerCase().includes(termine) ||
      m.macroDescrizione.toLowerCase().includes(termine)
    );
  });
}

/**
 * Ordina i movimenti per data (`data-desc` / `data-asc`) o per importo (`importo-desc` / `importo-asc`).
 * A parità di criterio primario mantiene un ordine deterministico per data, descrizione e id.
 */
export function ordinaMovimentiSpese(
  movimenti: readonly MovimentoSpesa[],
  ordine: OrdineMovimentiSpese = 'data-desc',
): MovimentoSpesa[] {
  return [...movimenti].sort((a, b) => {
    if (ordine === 'data-desc' && a.data !== b.data) {
      return a.data < b.data ? 1 : -1;
    }
    if (ordine === 'data-asc' && a.data !== b.data) {
      return a.data < b.data ? -1 : 1;
    }
    if (ordine === 'importo-desc' && a.importo !== b.importo) {
      return b.importo - a.importo;
    }
    if (ordine === 'importo-asc' && a.importo !== b.importo) {
      return a.importo - b.importo;
    }
    if (a.data !== b.data) {
      return a.data < b.data ? 1 : -1;
    }
    const perDescrizione = confrontaTesto(a.descrizione, b.descrizione);
    if (perDescrizione !== 0) return perDescrizione;
    return confrontaTesto(a.id, b.id);
  });
}

/** Pagina l'elenco dei movimenti già filtrati e ordinati. */
export function paginaMovimentiSpese(
  movimenti: readonly MovimentoSpesa[],
  paginaRichiesta: number,
  perPagina: number = PER_PAGINA_SPESE,
): PaginaMovimentiSpese {
  const dimensione = Math.max(1, Math.floor(perPagina));
  const totaleRighe = movimenti.length;
  const pagineTotali = Math.max(1, Math.ceil(totaleRighe / dimensione));
  const pagina = Math.min(Math.max(1, Math.floor(paginaRichiesta)), pagineTotali);
  const inizio = (pagina - 1) * dimensione;
  return {
    righe: movimenti.slice(inizio, inizio + dimensione),
    pagina,
    pagineTotali,
    totaleRighe,
  };
}

/**
 * Estrae l'elenco dei documenti allegati unici e verificati associati ai movimenti dell'esercizio.
 */
export function raccogliDocumentiAllegati(movimenti: readonly MovimentoSpesa[]): DocumentoAllegatoSpese[] {
  const visti = new Map<string, DocumentoAllegatoSpese>();
  for (const m of movimenti) {
    if (m.documentoAllegato && !visti.has(m.documentoAllegato.id)) {
      visti.set(m.documentoAllegato.id, m.documentoAllegato);
    }
  }
  return [...visti.values()];
}

/**
 * Valida e normalizza il percorso del documento allegato nel bucket privato `documenti-condominio`.
 * Rifiuta URL assoluti, path traversal (`..`) e percorsi vuoti o fuori dal condominio selezionato.
 */
export function percorsoDocumentoAllegato(
  urlStorage: string | null | undefined,
  condominioId?: string,
): string | null {
  if (!urlStorage) return null;
  const pulito = urlStorage.trim();
  if (!pulito || pulito.includes('..') || pulito.startsWith('/') || /^[a-z]+:\/\//i.test(pulito)) {
    return null;
  }
  const senzaPrefisso = pulito.startsWith(`${BUCKET_DOCUMENTI}/`)
    ? pulito.slice(BUCKET_DOCUMENTI.length + 1)
    : pulito;
  if (!senzaPrefisso || senzaPrefisso.startsWith('/')) return null;
  const segmenti = senzaPrefisso.split('/');
  if (segmenti.length < 2 || segmenti.some((s) => !s || s === '.' || s === '..')) {
    return null;
  }
  if (condominioId && segmenti[0] !== condominioId) {
    return null;
  }
  return senzaPrefisso;
}
