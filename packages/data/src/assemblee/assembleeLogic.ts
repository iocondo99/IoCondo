/**
 * Logica pura della sezione Assemblee del condòmino (`/assemblee` e `/assemblee/[id]`, UC-10):
 * - isolamento lato client e visibilità del residente: esclusione delle assemblee in stato `BOZZA`
 *   (visibili solo `CONVOCATA`, `IN_CORSO`, `CONCLUSA`, `ANNULLATA` del condominio selezionato);
 * - etichette e badge di stato (`Convocata`, `In corso`, `Conclusa`, `Annullata`), tipo (`Ordinaria`, `Straordinaria`)
 *   e modalità (`In presenza`, `Online`, `Ibrida`);
 * - riepilogo per le 3 StatCard (Prossima assemblea convocata, Assemblee dell'anno, Votazioni aperte in corso);
 * - filtri per stato (`Tutte`, `Convocate`, `In corso`, `Concluse`), ricerca per tipo/luogo/ordine del giorno,
 *   ordinamento cronologico e paginazione;
 * - formattazione aggregata dei risultati di voto (percentuale teste e millesimi da `risultati_voto`),
 *   verifica se il punto ODG è votabile (`votazione_aperta = true` e assemblea `IN_CORSO`),
 *   validazione sicura del link video-call (solo schema `https:`) e del percorso Storage del verbale PDF.
 *
 * File puro (nessuna dipendenza da React Native o Supabase): eseguibile con `node --test`.
 * Nessun uso di `Intl` o `localeCompare` (compatibilità Hermes).
 */

import type { BadgeStatus } from '@iocondo/ui';
import { BUCKET_DOCUMENTI_CONDOMINIO } from '../documenti/documentiLogic.ts';

export const DURATA_LINK_VERBALE_SECONDI = 600;
export const PER_PAGINA_ASSEMBLEE = 10;
export const MESSAGGIO_VERBALE_NON_DISPONIBILE =
  'Verbale non ancora disponibile nello spazio di archiviazione';

export type StatoAssemblea = 'BOZZA' | 'CONVOCATA' | 'IN_CORSO' | 'CONCLUSA' | 'ANNULLATA';
export type StatoAssembleaVisibile = 'CONVOCATA' | 'IN_CORSO' | 'CONCLUSA' | 'ANNULLATA';
export type TipoAssemblea = 'ORDINARIA' | 'STRAORDINARIA';
export type ModalitaAssemblea = 'PRESENZA' | 'ONLINE' | 'IBRIDA';
export type VotoScelta = 'FAVOREVOLE' | 'CONTRARIO' | 'ASTENUTO';

export const STATI_ASSEMBLEA_VISIBILI: readonly StatoAssembleaVisibile[] = [
  'CONVOCATA',
  'IN_CORSO',
  'CONCLUSA',
  'ANNULLATA',
] as const;

export interface PuntoOdgSintesi {
  id: string;
  ordine: number;
  titoloPunto: string;
  descrizione?: string | null;
  votazioneAperta: boolean;
}

export interface AssembleaCondomino {
  id: string;
  condominioId: string;
  tabellaMillesimaleId: string | null;
  data: string;
  luogo: string | null;
  linkMeet: string | null;
  verbaleUrl: string | null;
  stato: StatoAssemblea;
  tipo: TipoAssemblea;
  modalita: ModalitaAssemblea;
  createdAt: string;
  updatedAt: string;
  /** Sintesi punti all'ordine del giorno per ricerca e conteggio votazioni aperte. */
  puntiOdg?: PuntoOdgSintesi[];
  totalePuntiOdg?: number;
  votazioniAperte?: number;
}

export interface RisultatoVotoRpc {
  voto: string;
  n_voti: number;
  millesimi: number;
  percentuale_teste: number;
  percentuale_millesimi: number;
}

export interface RisultatoOpzioneVoto {
  voto: VotoScelta;
  etichetta: string;
  nVoti: number;
  millesimi: number;
  percentualeTeste: number;
  percentualeMillesimi: number;
}

export interface RisultatiVotoFormattati {
  opzioni: RisultatoOpzioneVoto[];
  totaleVoti: number;
  totaleMillesimi: number;
  haVoti: boolean;
}

export interface PuntoOdgDettaglio {
  id: string;
  assembleaId: string;
  ordine: number;
  titoloPunto: string;
  descrizione: string | null;
  votazioneAperta: boolean;
  /** Il punto è votabile solo se `votazioneAperta = true` e l'assemblea è `IN_CORSO`. */
  votabile: boolean;
  /** Voto espresso dal residente per la sua unità (se presente). */
  mioVoto: VotoScelta | null;
  unitaIdVoto: string | null;
  /** Risultati aggregati da RPC `risultati_voto` (zero voti nominali). */
  risultati: RisultatiVotoFormattati;
}

export interface UnitaVotante {
  id: string;
  interno: string;
}

export interface DettaglioAssembleaCondomino {
  id: string;
  condominioId: string;
  tabellaMillesimaleId: string | null;
  data: string;
  luogo: string | null;
  linkMeetValido: string | null;
  verbaleUrl: string | null;
  percorsoVerbaleStorage: string | null;
  verbaleDisponibile: boolean;
  verbaleUrlFirmato: string | null;
  stato: StatoAssembleaVisibile;
  tipo: TipoAssemblea;
  modalita: ModalitaAssemblea;
  createdAt: string;
  updatedAt: string;
  puntiOdg: PuntoOdgDettaglio[];
  /** Unità del residente nel condominio ammesse al voto. */
  unitaDisponibili: UnitaVotante[];
}

export interface RiepilogoAssemblee {
  prossimaAssemblea: AssembleaCondomino | null;
  totaleAnno: number;
  votazioniAperte: number;
  totaleVisibili: number;
}

export type FiltroStatoAssemblea = 'tutte' | 'convocate' | 'in_corso' | 'concluse';

export interface FiltriAssemblee {
  stato: FiltroStatoAssemblea;
  ricerca: string;
}

export type OrdineAssemblee = 'data-desc' | 'data-asc';

export interface OpzioneFiltroStatoAssemblee {
  value: FiltroStatoAssemblea;
  label: string;
  count: number;
}

export interface PaginaAssemblee {
  assemblee: AssembleaCondomino[];
  totaleFiltrati: number;
  pagina: number;
  numeroPagine: number;
}

/** Confronto lessicografico ASCII senza `Intl` né `localeCompare` (compatibilità Hermes). */
function confrontaTesto(a: string, b: string): number {
  const sa = a.toLowerCase();
  const sb = b.toLowerCase();
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Confronto date ISO sicuro su Hermes. */
function confrontaDataIso(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
    return ta < tb ? -1 : 1;
  }
  return confrontaTesto(a, b);
}

// ─── 1. Isolamento e visibilità condòmino ───────────────────────────────────

/** Verifica se lo stato dell'assemblea è visibile al condòmino (mai 'BOZZA'). */
export function isStatoVisibileCondomino(stato: string | null | undefined): boolean {
  if (!stato) return false;
  return (STATI_ASSEMBLEA_VISIBILI as readonly string[]).includes(stato);
}

/**
 * Verifica se l'assemblea è visibile al condòmino:
 * - appartiene al condominio selezionato;
 * - non è in stato 'BOZZA' (riservata all'amministratore).
 */
export function assembleaVisibileCondomino(
  assemblea: { stato?: string | null; condominioId?: string | null; condominio_id?: string | null },
  condominioIdSelezionato: string,
): boolean {
  if (!assemblea || !condominioIdSelezionato) return false;
  const condId = assemblea.condominioId ?? assemblea.condominio_id;
  if (!condId || condId !== condominioIdSelezionato) return false;
  return isStatoVisibileCondomino(assemblea.stato);
}

/** Filtra un elenco di assemblee escludendo le bozze e i record di altri condomini. */
export function filtraAssembleeVisibili<
  T extends { stato?: string | null; condominioId?: string | null; condominio_id?: string | null },
>(assemblee: readonly T[], condominioIdSelezionato: string): T[] {
  return assemblee.filter((a) => assembleaVisibileCondomino(a, condominioIdSelezionato));
}

// ─── 2. Etichette e badge di stato, tipo e modalità ─────────────────────────

export function etichettaStatoAssemblea(stato: string | null | undefined): string {
  switch (stato) {
    case 'CONVOCATA':
      return 'Convocata';
    case 'IN_CORSO':
      return 'In corso';
    case 'CONCLUSA':
      return 'Conclusa';
    case 'ANNULLATA':
      return 'Annullata';
    case 'BOZZA':
      return 'Bozza';
    default:
      return stato ? stato.trim() : 'Sconosciuto';
  }
}

export function badgeStatoAssemblea(stato: string | null | undefined): BadgeStatus {
  switch (stato) {
    case 'CONVOCATA':
      return 'convocata';
    case 'IN_CORSO':
      return 'in-corso';
    case 'CONCLUSA':
      return 'conclusa';
    case 'ANNULLATA':
      return 'annullata';
    default:
      return 'in-attesa';
  }
}

export function etichettaTipoAssemblea(tipo: string | null | undefined): string {
  switch (tipo) {
    case 'ORDINARIA':
      return 'Ordinaria';
    case 'STRAORDINARIA':
      return 'Straordinaria';
    default:
      return tipo ? tipo.trim() : 'Ordinaria';
  }
}

export function etichettaModalitaAssemblea(modalita: string | null | undefined): string {
  switch (modalita) {
    case 'PRESENZA':
      return 'In presenza';
    case 'ONLINE':
      return 'Online';
    case 'IBRIDA':
      return 'Ibrida';
    default:
      return modalita ? modalita.trim() : 'In presenza';
  }
}

export function etichettaSceltaVoto(voto: VotoScelta | string | null | undefined): string {
  switch (voto) {
    case 'FAVOREVOLE':
      return 'Favorevole';
    case 'CONTRARIO':
      return 'Contrario';
    case 'ASTENUTO':
      return 'Astenuto';
    default:
      return voto ? String(voto) : 'Non espresso';
  }
}

// ─── 3. Riepilogo StatCard ──────────────────────────────────────────────────

/**
 * Calcola il riepilogo per le 3 StatCard della pagina Assemblee:
 * - Prossima assemblea convocata (stato CONVOCATA o IN_CORSO con data >= adesso, prima in ordine cronologico);
 * - Assemblee dell'anno solare corrente;
 * - Votazioni aperte in corso.
 */
export function riepilogoAssemblee(
  assemblee: readonly AssembleaCondomino[],
  adesso: Date | string = new Date(),
): RiepilogoAssemblee {
  const dataRif = typeof adesso === 'string' ? new Date(adesso) : adesso;
  const isoRif = Number.isNaN(dataRif.getTime()) ? new Date().toISOString() : dataRif.toISOString();
  const annoCorrente = dataRif.getFullYear();

  // Assemblee visibili (escludiamo ulteriormente bozze per robustezza)
  const visibili = assemblee.filter((a) => isStatoVisibileCondomino(a.stato));

  // Prossima assemblea futura (o oggi) convocata o in corso
  const prossime = visibili
    .filter((a) => (a.stato === 'CONVOCATA' || a.stato === 'IN_CORSO') && a.data >= isoRif)
    .sort((a, b) => confrontaDataIso(a.data, b.data));

  const prossimaAssemblea = prossime[0] ?? null;

  // Assemblee dell'anno solare
  let totaleAnno = 0;
  for (const a of visibili) {
    const d = new Date(a.data);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() === annoCorrente) {
      totaleAnno += 1;
    }
  }

  // Votazioni aperte in corso:
  // Somma dei punti ODG con votazione aperta nelle assemblee in corso,
  // oppure se non specificati i singoli punti conta le assemblee con votazioni aperte/in corso
  let votazioniAperte = 0;
  for (const a of visibili) {
    if (a.stato === 'IN_CORSO') {
      if (typeof a.votazioniAperte === 'number') {
        votazioniAperte += a.votazioniAperte;
      } else if (a.puntiOdg && a.puntiOdg.length > 0) {
        votazioniAperte += a.puntiOdg.filter((p) => p.votazioneAperta).length;
      } else {
        votazioniAperte += 1;
      }
    }
  }

  return {
    prossimaAssemblea,
    totaleAnno,
    votazioniAperte,
    totaleVisibili: visibili.length,
  };
}

// ─── 4. Filtri, ricerca, ordinamento e paginazione ──────────────────────────

export function opzioniFiltroStatoAssemblee(
  assemblee: readonly AssembleaCondomino[],
): OpzioneFiltroStatoAssemblee[] {
  const visibili = assemblee.filter((a) => isStatoVisibileCondomino(a.stato));
  const convocate = visibili.filter((a) => a.stato === 'CONVOCATA').length;
  const inCorso = visibili.filter((a) => a.stato === 'IN_CORSO').length;
  const concluse = visibili.filter((a) => a.stato === 'CONCLUSA' || a.stato === 'ANNULLATA').length;

  return [
    { value: 'tutte', label: 'Tutte', count: visibili.length },
    { value: 'convocate', label: 'Convocate', count: convocate },
    { value: 'in_corso', label: 'In corso', count: inCorso },
    { value: 'concluse', label: 'Concluse', count: concluse },
  ];
}

export function filtriAssembleeAttivi(filtri: FiltriAssemblee): boolean {
  return filtri.stato !== 'tutte' || filtri.ricerca.trim().length > 0;
}

export function filtraEOrdinaAssemblee(
  assemblee: readonly AssembleaCondomino[],
  filtri: FiltriAssemblee,
  ordine: OrdineAssemblee = 'data-desc',
): AssembleaCondomino[] {
  // 1. Visibilità condòmino
  let risultato = assemblee.filter((a) => isStatoVisibileCondomino(a.stato));

  // 2. Filtro per stato
  if (filtri.stato === 'convocate') {
    risultato = risultato.filter((a) => a.stato === 'CONVOCATA');
  } else if (filtri.stato === 'in_corso') {
    risultato = risultato.filter((a) => a.stato === 'IN_CORSO');
  } else if (filtri.stato === 'concluse') {
    risultato = risultato.filter((a) => a.stato === 'CONCLUSA' || a.stato === 'ANNULLATA');
  }

  // 3. Ricerca per tipo, luogo, data, punti ODG
  const termine = filtri.ricerca.trim().toLowerCase();
  if (termine) {
    risultato = risultato.filter((a) => {
      if (a.luogo && a.luogo.toLowerCase().includes(termine)) return true;
      if (etichettaTipoAssemblea(a.tipo).toLowerCase().includes(termine)) return true;
      if (etichettaStatoAssemblea(a.stato).toLowerCase().includes(termine)) return true;
      if (etichettaModalitaAssemblea(a.modalita).toLowerCase().includes(termine)) return true;
      if (a.data.includes(termine)) return true;
      if (a.puntiOdg && a.puntiOdg.length > 0) {
        return a.puntiOdg.some(
          (p) =>
            p.titoloPunto.toLowerCase().includes(termine) ||
            (p.descrizione && p.descrizione.toLowerCase().includes(termine)),
        );
      }
      return false;
    });
  }

  // 4. Ordinamento cronologico
  risultato.sort((a, b) => {
    const cmp = confrontaDataIso(a.data, b.data);
    return ordine === 'data-asc' ? cmp : -cmp;
  });

  return risultato;
}

export function paginaAssemblee(
  assembleeFiltrate: readonly AssembleaCondomino[],
  paginaRichiesta: number,
  perPagina: number = PER_PAGINA_ASSEMBLEE,
): PaginaAssemblee {
  const totaleFiltrati = assembleeFiltrate.length;
  const numeroPagine = Math.max(1, Math.ceil(totaleFiltrati / perPagina));
  const pagina = Math.min(Math.max(1, Math.floor(paginaRichiesta) || 1), numeroPagine);
  const inizio = (pagina - 1) * perPagina;
  const fine = inizio + perPagina;
  const paginaElementi = assembleeFiltrate.slice(inizio, fine);

  return {
    assemblee: paginaElementi,
    totaleFiltrati,
    pagina,
    numeroPagine,
  };
}

// ─── 5. Formattazione dei risultati di voto ─────────────────────────────────

const SCELTE_VOTO_ORDINATE: readonly VotoScelta[] = [
  'FAVOREVOLE',
  'CONTRARIO',
  'ASTENUTO',
] as const;

/**
 * Formatta i risultati della RPC `risultati_voto` garantendo che tutte e tre le opzioni
 * (`FAVOREVOLE`, `CONTRARIO`, `ASTENUTO`) siano presenti con percentuali arrotondate,
 * senza mai esporre i voti nominali dei vicini.
 */
export function formattaRisultatiVoto(
  risultatiRpc: readonly RisultatoVotoRpc[] | null | undefined,
): RisultatiVotoFormattati {
  const mappa = new Map<string, RisultatoVotoRpc>();
  if (risultatiRpc && Array.isArray(risultatiRpc)) {
    for (const r of risultatiRpc) {
      if (r && r.voto) {
        mappa.set(r.voto.toUpperCase(), r);
      }
    }
  }

  let totaleVoti = 0;
  let totaleMillesimi = 0;

  const opzioni: RisultatoOpzioneVoto[] = SCELTE_VOTO_ORDINATE.map((scelta) => {
    const row = mappa.get(scelta);
    const nVoti = Number(row?.n_voti ?? 0);
    const millesimi = Number(row?.millesimi ?? 0);
    const percentualeTeste = Number(row?.percentuale_teste ?? 0);
    const percentualeMillesimi = Number(row?.percentuale_millesimi ?? 0);

    totaleVoti += nVoti;
    totaleMillesimi += millesimi;

    return {
      voto: scelta,
      etichetta: etichettaSceltaVoto(scelta),
      nVoti,
      millesimi: Math.round(millesimi * 1000) / 1000,
      percentualeTeste: Math.round(percentualeTeste * 10) / 10,
      percentualeMillesimi: Math.round(percentualeMillesimi * 10) / 10,
    };
  });

  return {
    opzioni,
    totaleVoti,
    totaleMillesimi: Math.round(totaleMillesimi * 1000) / 1000,
    haVoti: totaleVoti > 0,
  };
}

// ─── 6. Verifica se il punto ODG è votabile ─────────────────────────────────

/**
 * Un punto all'ordine del giorno è votabile dal condòmino solo se:
 * - la sua proprietà `votazione_aperta` è `true`;
 * - l'assemblea è attualmente `IN_CORSO`.
 */
export function isPuntoVotabile(
  punto: { votazione_aperta?: boolean | null; votazioneAperta?: boolean | null },
  statoAssemblea: string | null | undefined,
): boolean {
  if (!punto || statoAssemblea !== 'IN_CORSO') return false;
  return Boolean(punto.votazioneAperta ?? punto.votazione_aperta);
}

// ─── 7. Validazione sicura del link video-call ──────────────────────────────

/**
 * Valida un link a video-call (es. Google Meet, Zoom, Teams, Jitsi):
 * - accetta esclusivamente lo schema `https:`;
 * - rifiuta categoricamente schemi insicuri o vulnerabili (`javascript:`, `data:`, `file:`, `http:`, ecc.);
 * - restituisce l'URL ripulito oppure `null` se non valido.
 */
export function validaLinkVideoCall(link: string | null | undefined): string | null {
  if (!link) return null;
  const pulito = link.trim();
  if (!pulito) return null;

  // Schema deve essere https:// (case insensitive)
  if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(pulito)) {
    return null;
  }

  // Rifiuta caratteri di controllo o delimitatori non ammessi
  if (/[\r\n\t<>"']/.test(pulito)) {
    return null;
  }

  return pulito;
}

// ─── 8. Validazione del percorso Storage del verbale PDF ────────────────────

/**
 * Valida il percorso `verbale_url` nel bucket `documenti-condominio`:
 * - non nullo, non vuoto;
 * - nessun path traversal (`..`), barre inverse (`\`), o barra iniziale;
 * - nessun protocollo (`https:`, `http:`, `file:`, ecc.);
 * - deve iniziare con `<condominio_id>/` oppure con il prefisso di test `seed-dev/`.
 */
export function validaPercorsoVerbaleStorage(
  verbaleUrl: string | null | undefined,
  condominioId: string,
): string | null {
  const condId = condominioId?.trim();
  if (!verbaleUrl || !condId) return null;

  const pulito = verbaleUrl.trim();
  if (
    !pulito ||
    pulito.includes('..') ||
    pulito.includes('\\') ||
    pulito.startsWith('/') ||
    /^[a-z][a-z0-9+.-]*:/i.test(pulito)
  ) {
    return null;
  }

  // Rimuove l'eventuale prefisso esplicito del bucket "documenti-condominio/"
  const senzaBucket = pulito.startsWith(`${BUCKET_DOCUMENTI_CONDOMINIO}/`)
    ? pulito.slice(BUCKET_DOCUMENTI_CONDOMINIO.length + 1)
    : pulito;

  if (
    !senzaBucket ||
    senzaBucket.includes('..') ||
    senzaBucket.includes('\\') ||
    senzaBucket.startsWith('/')
  ) {
    return null;
  }

  // Verifica appartenenza al condominio o cartella dati di prova seed-dev/
  const prefissoCondominio = `${condId}/`;
  const prefissoSeed = 'seed-dev/';
  if (!senzaBucket.startsWith(prefissoCondominio) && !senzaBucket.startsWith(prefissoSeed)) {
    return null;
  }

  return senzaBucket;
}

/** Scompone il percorso del verbale in cartella e nome file. */
export function scomponiPercorsoVerbale(
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
