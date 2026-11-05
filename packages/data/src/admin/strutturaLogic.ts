/**
 * Logica pura per la gestione della Struttura del Condominio e Tabelle Millesimali
 * (/admin/struttura, Passo 2 del modulo Amministratore).
 *
 * Include:
 * - Normalizzazione e raggruppamento dell'albero gerarchico: Condominio -> Palazzi -> Scale/Colonne -> Unità
 * - Mappatura anagrafiche residenti attivi (Proprietario / Inquilino)
 * - Calcolo statistiche della struttura (palazzi, unità, residenti, superficie)
 * - Calcolo e verifica quadratura tabelle millesimali a 1000,000 ‰ (con tolleranza centesimale)
 * - Parser e validatore CSV millesimi (UC-09) con supporto separatori virgola/punto e virgola,
 *   conversione numerica italiana, righe duplicate e verifica quadratura.
 * - Generazione template CSV di esempio per l'amministratore.
 *
 * File puro (nessuna dipendenza da React Native o Supabase): testabile al 100% con `node --test`.
 */

export type TipoScalaColonna = 'SCALA' | 'COLONNA' | 'NESSUNA';
export type TipoPossesso = 'PROPRIETARIO' | 'INQUILINO';
export type StatoQuadratura = 'QUADRATA' | 'DISAVANZO';

export interface PalazzoRaw {
  id: string;
  condominio_id: string;
  nome_identificativo: string;
  indirizzo?: string | null;
}

export interface ScalaColonnaRaw {
  id: string;
  palazzo_id: string;
  tipo: 'SCALA' | 'COLONNA';
  nome: string;
}

export interface TipologiaUnitaRaw {
  id: string;
  descrizione: string;
}

export interface UnitaImmobiliareRaw {
  id: string;
  palazzo_id: string;
  scala_colonna_id?: string | null;
  tipologia_id: string;
  interno: string;
  piano?: number | null;
  mq?: number | string | null;
  foglio_catastale?: string | null;
  particella?: string | null;
  subalterno?: string | null;
}

export interface AnagraficaUnitaRaw {
  id: string;
  unita_id: string;
  utente_id: string;
  tipo_possesso: TipoPossesso | string;
  data_inizio: string;
  data_fine?: string | null;
  quota_possesso?: number | string;
  utente?: {
    id: string;
    nome_cognome: string;
    telefono?: string | null;
  } | null;
}

export interface TabellaMillesimaleRaw {
  id: string;
  condominio_id: string;
  palazzo_id?: string | null;
  scala_colonna_id?: string | null;
  nome: string;
  totale?: number | string;
}

export interface QuotaMillesimaleRaw {
  id: string;
  tabella_id: string;
  unita_id: string;
  valore_millesimale: number | string;
}

export interface ResidenteAttivoView {
  id: string;
  utenteId: string;
  nomeCognome: string;
  telefono: string | null;
  tipoPossesso: TipoPossesso;
  quotaPossesso: number;
}

export interface UnitaDettaglioView {
  id: string;
  palazzoId: string;
  palazzoNome: string;
  scalaId: string | null;
  scalaNome: string | null;
  tipologiaId: string;
  tipologiaDescrizione: string;
  interno: string;
  piano: number | null;
  mq: number | null;
  foglioCatastale: string | null;
  particella: string | null;
  subalterno: string | null;
  residenteAttivo: ResidenteAttivoView | null;
}

export interface ScalaGruppoView {
  id: string | null;
  nome: string;
  tipo: TipoScalaColonna;
  totaleUnita: number;
  unita: UnitaDettaglioView[];
}

export interface PalazzoGruppoView {
  id: string;
  nome: string;
  indirizzo: string | null;
  totaleUnita: number;
  totaleMq: number;
  scale: ScalaGruppoView[];
}

export interface StatisticheStruttura {
  totalePalazzi: number;
  totaleUnita: number;
  residentiAssociati: number;
  totaleMq: number;
}

export interface QuotaTabellaView {
  id?: string;
  unitaId: string;
  interno: string;
  palazzoNome: string;
  scalaNome: string | null;
  tipologiaDescrizione: string;
  valoreMillesimale: number;
  percentuale: number;
}

export interface TabellaMillesimaleDettaglioView {
  id: string;
  nome: string;
  palazzoId: string | null;
  scalaColonnaId: string | null;
  totalePrevisto: number;
  totaleEffettivo: number;
  disavanzo: number;
  isQuadrata: boolean;
  statoQuadratura: StatoQuadratura;
  quote: QuotaTabellaView[];
}

export interface StrutturaCompletaView {
  palazzi: PalazzoGruppoView[];
  statistiche: StatisticheStruttura;
  tutteUnita: UnitaDettaglioView[];
  tipologie: TipologiaUnitaRaw[];
}

/** Tolleranza centesimale per quadratura millesimi (0.05 ‰). */
export const TOLLERANZA_MILLESIMI = 0.05;

/** Arrotonda un numero a 3 cifre decimali (precisione millesimale). */
export function arrotonda3(valore: number): number {
  return Math.round(valore * 1000) / 1000;
}

/** Confronto naturale per interni (es. '1', '2', '10', 'B1'). */
export function confrontaInterni(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Determina se un'anagrafica è attualmente attiva rispetto alla data odierna (ISO YYYY-MM-DD).
 */
export function isAnagraficaAttiva(anagrafica: AnagraficaUnitaRaw, dataRifOggi: string = new Date().toISOString().slice(0, 10)): boolean {
  if (anagrafica.data_inizio > dataRifOggi) return false;
  if (!anagrafica.data_fine) return true;
  return anagrafica.data_fine >= dataRifOggi;
}

/**
 * Seleziona il residente principale per un'unità immobiliare.
 * Preferisce un PROPRIETARIO attivo rispetto a un INQUILINO, e tra residenti dello stesso tipo
 * sceglie l'assegnazione con quota maggiore o data_inizio più recente.
 */
export function selezionaResidenteAttivo(
  anagraficheUnita: AnagraficaUnitaRaw[],
  dataRifOggi: string = new Date().toISOString().slice(0, 10)
): ResidenteAttivoView | null {
  const attive = anagraficheUnita.filter((a) => isAnagraficaAttiva(a, dataRifOggi));
  if (attive.length === 0) return null;

  attive.sort((a, b) => {
    // Proprietario prima di Inquilino
    if (a.tipo_possesso === 'PROPRIETARIO' && b.tipo_possesso !== 'PROPRIETARIO') return -1;
    if (b.tipo_possesso === 'PROPRIETARIO' && a.tipo_possesso !== 'PROPRIETARIO') return 1;

    // Quota possesso decrescente
    const qA = typeof a.quota_possesso === 'number' ? a.quota_possesso : Number(a.quota_possesso) || 0;
    const qB = typeof b.quota_possesso === 'number' ? b.quota_possesso : Number(b.quota_possesso) || 0;
    if (qB !== qA) return qB - qA;

    // Data inizio più recente
    return b.data_inizio.localeCompare(a.data_inizio);
  });

  const scelta = attive[0];
  const quota = typeof scelta.quota_possesso === 'number' ? scelta.quota_possesso : Number(scelta.quota_possesso) || 100;
  const tipo = (scelta.tipo_possesso === 'INQUILINO' ? 'INQUILINO' : 'PROPRIETARIO') as TipoPossesso;

  return {
    id: scelta.id,
    utenteId: scelta.utente_id,
    nomeCognome: scelta.utente?.nome_cognome || 'Residente registrato',
    telefono: scelta.utente?.telefono || null,
    tipoPossesso: tipo,
    quotaPossesso: quota,
  };
}

/**
 * Costruisce l'albero gerarchico della struttura del condominio:
 * Palazzi -> Scale/Colonne -> Unità Immobiliari.
 */
export function costruisciAlberoStruttura(params: {
  palazzi: PalazzoRaw[];
  scale: ScalaColonnaRaw[];
  tipologie: TipologiaUnitaRaw[];
  unita: UnitaImmobiliareRaw[];
  anagrafiche?: AnagraficaUnitaRaw[];
  dataRifOggi?: string;
}): StrutturaCompletaView {
  const { palazzi, scale, tipologie, unita, anagrafiche = [], dataRifOggi } = params;

  // Mappe veloci
  const tipologieMap = new Map<string, string>();
  for (const t of tipologie) {
    tipologieMap.set(t.id, t.descrizione);
  }

  const palazziMap = new Map<string, PalazzoRaw>();
  for (const p of palazzi) {
    palazziMap.set(p.id, p);
  }

  const scaleMap = new Map<string, ScalaColonnaRaw>();
  for (const s of scale) {
    scaleMap.set(s.id, s);
  }

  // Raggruppa anagrafiche per unita_id
  const anagrafichePerUnita = new Map<string, AnagraficaUnitaRaw[]>();
  for (const a of anagrafiche) {
    const list = anagrafichePerUnita.get(a.unita_id) ?? [];
    list.push(a);
    anagrafichePerUnita.set(a.unita_id, list);
  }

  // Normalizza tutte le unità
  const tutteUnita: UnitaDettaglioView[] = unita.map((u) => {
    const pal = palazziMap.get(u.palazzo_id);
    const sc = u.scala_colonna_id ? scaleMap.get(u.scala_colonna_id) : undefined;
    const anags = anagrafichePerUnita.get(u.id) ?? [];
    const residente = selezionaResidenteAttivo(anags, dataRifOggi);
    const mqNum = u.mq !== null && u.mq !== undefined ? Number(u.mq) : null;

    return {
      id: u.id,
      palazzoId: u.palazzo_id,
      palazzoNome: pal ? pal.nome_identificativo : 'Palazzo',
      scalaId: u.scala_colonna_id || null,
      scalaNome: sc ? sc.nome : null,
      tipologiaId: u.tipologia_id,
      tipologiaDescrizione: tipologieMap.get(u.tipologia_id) || 'Unità',
      interno: u.interno,
      piano: u.piano ?? null,
      mq: mqNum && !isNaN(mqNum) ? mqNum : null,
      foglioCatastale: u.foglio_catastale || null,
      particella: u.particella || null,
      subalterno: u.subalterno || null,
      residenteAttivo: residente,
    };
  });

  // Ordina tutte le unità per palazzo, scala, interno
  tutteUnita.sort((a, b) => {
    if (a.palazzoNome !== b.palazzoNome) return a.palazzoNome.localeCompare(b.palazzoNome);
    const scA = a.scalaNome || '';
    const scB = b.scalaNome || '';
    if (scA !== scB) return scA.localeCompare(scB);
    return confrontaInterni(a.interno, b.interno);
  });

  // Raggruppamento per Palazzo -> Scale
  const palazziGruppati: PalazzoGruppoView[] = palazzi
    .map((p) => {
      const scaleDelPalazzo = scale.filter((s) => s.palazzo_id === p.id);
      const unitaDelPalazzo = tutteUnita.filter((u) => u.palazzoId === p.id);

      // Scala gruppi
      const gruppiScale: ScalaGruppoView[] = [];

      // Per ogni scala definita
      for (const sc of scaleDelPalazzo) {
        const unitaDellaScala = unitaDelPalazzo.filter((u) => u.scalaId === sc.id);
        gruppiScale.push({
          id: sc.id,
          nome: sc.nome,
          tipo: sc.tipo,
          totaleUnita: unitaDellaScala.length,
          unita: unitaDellaScala,
        });
      }

      // Unità senza scala assegnata
      const unitaSenzaScala = unitaDelPalazzo.filter((u) => !u.scalaId);
      if (unitaSenzaScala.length > 0 || scaleDelPalazzo.length === 0) {
        gruppiScale.push({
          id: null,
          nome: scaleDelPalazzo.length === 0 ? 'Tutte le unità' : 'Senza scala / Generale',
          tipo: 'NESSUNA',
          totaleUnita: unitaSenzaScala.length,
          unita: unitaSenzaScala,
        });
      }

      const totaleMq = unitaDelPalazzo.reduce((acc, u) => acc + (u.mq ?? 0), 0);

      return {
        id: p.id,
        nome: p.nome_identificativo,
        indirizzo: p.indirizzo || null,
        totaleUnita: unitaDelPalazzo.length,
        totaleMq: Math.round(totaleMq * 100) / 100,
        scale: gruppiScale,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Statistiche globali
  const residentiAssociati = tutteUnita.filter((u) => u.residenteAttivo !== null).length;
  const totaleMqGlobale = tutteUnita.reduce((acc, u) => acc + (u.mq ?? 0), 0);

  const statistiche: StatisticheStruttura = {
    totalePalazzi: palazzi.length,
    totaleUnita: tutteUnita.length,
    residentiAssociati,
    totaleMq: Math.round(totaleMqGlobale * 100) / 100,
  };

  return {
    palazzi: palazziGruppati,
    statistiche,
    tutteUnita,
    tipologie,
  };
}

/**
 * Calcola la quadratura di una tabella millesimale e le quote dettagliate per ciascuna unità.
 */
export function calcolaQuadraturaTabella(
  tabella: TabellaMillesimaleRaw,
  quote: QuotaMillesimaleRaw[],
  tutteUnita: UnitaDettaglioView[]
): TabellaMillesimaleDettaglioView {
  const unitaMap = new Map<string, UnitaDettaglioView>();
  for (const u of tutteUnita) {
    unitaMap.set(u.id, u);
  }

  const totalePrevisto = Number(tabella.totale) || 1000;

  // Calcola somma effettiva quote
  let sommaEffettiva = 0;
  const quoteView: QuotaTabellaView[] = [];

  for (const q of quote) {
    const val = typeof q.valore_millesimale === 'number' ? q.valore_millesimale : Number(q.valore_millesimale) || 0;
    const u = unitaMap.get(q.unita_id);
    sommaEffettiva += val;

    const percentuale = totalePrevisto > 0 ? (val / totalePrevisto) * 100 : 0;

    quoteView.push({
      id: q.id,
      unitaId: q.unita_id,
      interno: u ? u.interno : '—',
      palazzoNome: u ? u.palazzoNome : '—',
      scalaNome: u ? u.scalaNome : null,
      tipologiaDescrizione: u ? u.tipologiaDescrizione : 'Unità',
      valoreMillesimale: arrotonda3(val),
      percentuale: Math.round(percentuale * 100) / 100,
    });
  }

  // Ordina le quote per palazzo, scala, interno
  quoteView.sort((a, b) => {
    if (a.palazzoNome !== b.palazzoNome) return a.palazzoNome.localeCompare(b.palazzoNome);
    const scA = a.scalaNome || '';
    const scB = b.scalaNome || '';
    if (scA !== scB) return scA.localeCompare(scB);
    return confrontaInterni(a.interno, b.interno);
  });

  const totEffettivo = arrotonda3(sommaEffettiva);
  const disavanzo = arrotonda3(totalePrevisto - totEffettivo);
  const isQuadrata = Math.abs(disavanzo) <= TOLLERANZA_MILLESIMI;

  return {
    id: tabella.id,
    nome: tabella.nome,
    palazzoId: tabella.palazzo_id || null,
    scalaColonnaId: tabella.scala_colonna_id || null,
    totalePrevisto,
    totaleEffettivo: totEffettivo,
    disavanzo,
    isQuadrata,
    statoQuadratura: isQuadrata ? 'QUADRATA' : 'DISAVANZO',
    quote: quoteView,
  };
}

// ============================================================================
// PARSER E VALIDATORE CSV MILLESIMI (UC-09)
// ============================================================================

export interface RigaCSVParsata {
  rigaNumero: number;
  scala: string;
  interno: string;
  valoreMillesimale: number;
  unitaId: string | null;
  valido: boolean;
  errori: string[];
}

export interface RisultatoValidazioneCSV {
  righe: RigaCSVParsata[];
  sommaMillesimi: number;
  disavanzo: number;
  isQuadrata: boolean;
  totaleRighe: number;
  righeValide: number;
  righeErrate: number;
  erroriGlobali: string[];
  puoSalvare: boolean;
}

/**
 * Parsing robusto di un testo CSV in matrice di stringhe.
 * Supporta separatori: virgola (,), punto e virgola (;), tabulazione (\t).
 * Gestisce virgolette doppie e ritorni a capo.
 */
export function parseCSVMatrice(csvText: string): string[][] {
  if (!csvText || !csvText.trim()) return [];

  // Rileva separatore guardando la prima riga
  const primaRiga = csvText.split(/\r\n|\r|\n/)[0] || '';
  let sep = ';';
  const conteggioPuntoEVirgola = (primaRiga.match(/;/g) || []).length;
  const conteggioVirgola = (primaRiga.match(/,/g) || []).length;
  const conteggioTab = (primaRiga.match(/\t/g) || []).length;

  if (conteggioTab > conteggioPuntoEVirgola && conteggioTab > conteggioVirgola) {
    sep = '\t';
  } else if (conteggioVirgola > conteggioPuntoEVirgola) {
    sep = ',';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // salta escape
        } else {
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === sep) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // salta \n in \r\n
        }
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  // Rimuovi righe completamente vuote
  return rows.filter((r) => r.some((field) => field.trim().length > 0));
}

/**
 * Converte una stringa di testo numerico (anche in formato italiano con virgola o simboli ‰ / €)
 * in un float con arrotondamento a 3 decimali.
 */
export function parseValoreMillesimale(testo: string): number | null {
  if (testo === undefined || testo === null) return null;
  const pulito = testo
    .replace(/[‰€\s]/g, '')
    .trim();

  if (!pulito) return null;

  // Se contiene sia punto che virgola (es. 1.000,50 oppure 1,000.50)
  let normalizzato = pulito;
  if (pulito.includes('.') && pulito.includes(',')) {
    if (pulito.indexOf('.') < pulito.indexOf(',')) {
      // 1.000,50 -> rimuovi punto e virgola diventa punto
      normalizzato = pulito.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,000.50 -> rimuovi virgola
      normalizzato = pulito.replace(/,/g, '');
    }
  } else if (pulito.includes(',')) {
    // 125,50 -> 125.50
    normalizzato = pulito.replace(',', '.');
  }

  const num = Number(normalizzato);
  if (isNaN(num) || num < 0) return null;

  return arrotonda3(num);
}

/**
 * Normalizza il nome di una scala o interno per il matching non sensibile al maiuscolo/spazi.
 */
function normalizzaChiave(testo: string): string {
  return testo.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Valida un file CSV millesimi (UC-09) incrociando i dati con le unità immobiliari esistenti nel condominio.
 *
 * Colonne richieste nell'intestazione:
 * - "Scala" (o "Colonna")
 * - "Interno" (o "Sub", "Unita")
 * - "Millesimi" (o "Quota", "Valore", "Valore Millesimale")
 */
export function validaImportMillesimiCSV(
  csvText: string,
  unitaEsistenti: UnitaDettaglioView[],
  totalePrevisto: number = 1000
): RisultatoValidazioneCSV {
  const matrice = parseCSVMatrice(csvText);

  if (matrice.length === 0) {
    return {
      righe: [],
      sommaMillesimi: 0,
      disavanzo: totalePrevisto,
      isQuadrata: false,
      totaleRighe: 0,
      righeValide: 0,
      righeErrate: 0,
      erroriGlobali: ['Il file CSV è vuoto.'],
      puoSalvare: false,
    };
  }

  const header = matrice[0].map((h) => h.toLowerCase().trim());

  // Rileva indici delle colonne
  const colInterno = header.findIndex((h) => h === 'interno' || h.startsWith('int') || h === 'unita' || h === 'sub');
  const colMillesimi = header.findIndex(
    (h) => h === 'millesimi' || h.startsWith('mill') || h === 'quota' || h === 'valore' || h.includes('millesim')
  );
  const colScala = header.findIndex((h) => h === 'scala' || h === 'colonna');

  const erroriGlobali: string[] = [];

  if (colInterno === -1) {
    erroriGlobali.push('Colonna "Interno" mancante nell\'intestazione del CSV.');
  }
  if (colMillesimi === -1) {
    erroriGlobali.push('Colonna "Millesimi" mancante nell\'intestazione del CSV.');
  }

  if (erroriGlobali.length > 0) {
    return {
      righe: [],
      sommaMillesimi: 0,
      disavanzo: totalePrevisto,
      isQuadrata: false,
      totaleRighe: matrice.length - 1,
      righeValide: 0,
      righeErrate: matrice.length - 1,
      erroriGlobali,
      puoSalvare: false,
    };
  }

  // Prepara lookup unità esistenti
  // Mappa combinata: "scala|interno" -> UnitaDettaglioView
  const lookupScalaInterno = new Map<string, UnitaDettaglioView>();
  // Mappa solo per interno (se non ambigua nel condominio)
  const lookupSoloInterno = new Map<string, UnitaDettaglioView[]>();

  for (const u of unitaEsistenti) {
    const kInterno = normalizzaChiave(u.interno);
    const kScala = u.scalaNome ? normalizzaChiave(u.scalaNome) : '';

    if (kScala) {
      lookupScalaInterno.set(`${kScala}|${kInterno}`, u);
      // Supporta anche solo la lettera (es. se "Scala A" fa match con "A")
      const lettera = kScala.replace(/^scala|^colonna/, '');
      if (lettera) {
        lookupScalaInterno.set(`${lettera}|${kInterno}`, u);
      }
    }
    // Chiave senza scala
    lookupScalaInterno.set(`|${kInterno}`, u);

    const lista = lookupSoloInterno.get(kInterno) ?? [];
    lista.push(u);
    lookupSoloInterno.set(kInterno, lista);
  }

  const righeParsate: RigaCSVParsata[] = [];
  const chiaviViste = new Set<string>();
  const unitaIdViste = new Set<string>();
  let sommaMillesimi = 0;
  let righeValide = 0;
  let righeErrate = 0;

  for (let r = 1; r < matrice.length; r++) {
    const rawRow = matrice[r];
    const rigaNumero = r + 1;
    const erroriRiga: string[] = [];

    const rawInterno = rawRow[colInterno] || '';
    const rawMillesimi = rawRow[colMillesimi] || '';
    const rawScala = colScala !== -1 ? rawRow[colScala] || '' : '';

    if (!rawInterno.trim()) {
      erroriRiga.push('Interno mancante');
    }

    const valore = parseValoreMillesimale(rawMillesimi);
    if (valore === null) {
      erroriRiga.push(`Valore millesimale non valido: "${rawMillesimi}"`);
    }

    // Risoluzione unità immobiliare
    let unitaTrovata: UnitaDettaglioView | null = null;
    const normInt = normalizzaChiave(rawInterno);
    const normSc = normalizzaChiave(rawScala);

    if (normSc) {
      unitaTrovata = lookupScalaInterno.get(`${normSc}|${normInt}`) ?? null;
      if (!unitaTrovata) {
        const lettera = normSc.replace(/^scala|^colonna/, '');
        if (lettera) {
          unitaTrovata = lookupScalaInterno.get(`${lettera}|${normInt}`) ?? null;
        }
      }
    }

    if (!unitaTrovata) {
      const perInterno = lookupSoloInterno.get(normInt) ?? [];
      if (perInterno.length === 1) {
        unitaTrovata = perInterno[0];
      } else if (perInterno.length > 1) {
        erroriRiga.push(
          `Interno "${rawInterno}" ambiguo presente in più scale (${perInterno.map((u) => u.scalaNome || 'Gen').join(', ')}). Specifica la Scala nel CSV.`
        );
      }
    }

    if (!unitaTrovata && erroriRiga.length === 0) {
      erroriRiga.push(`Unità immobiliare non trovata nel condominio (Int: ${rawInterno}${rawScala ? ', Scala: ' + rawScala : ''})`);
    }

    // Controllo duplicati riga
    const chiaveUnivoca = `${normSc}|${normInt}`;
    if (chiaviViste.has(chiaveUnivoca)) {
      erroriRiga.push(`Riga duplicata nel CSV per Scala "${rawScala}" / Interno "${rawInterno}"`);
    }
    chiaviViste.add(chiaveUnivoca);

    if (unitaTrovata) {
      if (unitaIdViste.has(unitaTrovata.id)) {
        erroriRiga.push(`L'unità ${unitaTrovata.interno} (${unitaTrovata.palazzoNome}) compare più volte nel CSV.`);
      }
      unitaIdViste.add(unitaTrovata.id);
    }

    const isValido = erroriRiga.length === 0 && valore !== null && unitaTrovata !== null;

    if (isValido && valore !== null) {
      sommaMillesimi += valore;
      righeValide++;
    } else {
      righeErrate++;
    }

    righeParsate.push({
      rigaNumero,
      scala: rawScala,
      interno: rawInterno,
      valoreMillesimale: valore ?? 0,
      unitaId: unitaTrovata ? unitaTrovata.id : null,
      valido: isValido,
      errori: erroriRiga,
    });
  }

  const sommaTotale = arrotonda3(sommaMillesimi);
  const disavanzo = arrotonda3(totalePrevisto - sommaTotale);
  const isQuadrata = Math.abs(disavanzo) <= TOLLERANZA_MILLESIMI;

  if (!isQuadrata) {
    if (disavanzo > 0) {
      erroriGlobali.push(`La somma dei millesimi (${sommaTotale.toFixed(3)} ‰) differisce dal totale previsto (${totalePrevisto} ‰). Mancano ${disavanzo.toFixed(3)} ‰.`);
    } else {
      erroriGlobali.push(`La somma dei millesimi (${sommaTotale.toFixed(3)} ‰) supera il totale previsto (${totalePrevisto} ‰) di ${Math.abs(disavanzo).toFixed(3)} ‰.`);
    }
  }

  const puoSalvare = isQuadrata && righeErrate === 0 && righeValide > 0;

  return {
    righe: righeParsate,
    sommaMillesimi: sommaTotale,
    disavanzo,
    isQuadrata,
    totaleRighe: righeParsate.length,
    righeValide,
    righeErrate,
    erroriGlobali,
    puoSalvare,
  };
}

/**
 * Genera il contenuto testuale di un template CSV con le unità esistenti del condominio.
 */
export function generaTemplateCSVMillesimi(unita: UnitaDettaglioView[]): string {
  const righe: string[] = ['Scala;Interno;Millesimi'];
  for (const u of unita) {
    righe.push(`${u.scalaNome || ''};${u.interno};0,000`);
  }
  return righe.join('\r\n');
}

