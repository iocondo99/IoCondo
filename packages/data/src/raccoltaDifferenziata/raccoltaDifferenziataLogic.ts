import type { IRaccoltaDifferenziata } from '@iocondo/shared-types';

/** Giorno della settimana secondo lo schema DB (`1 = Lunedì ... 7 = Domenica`). */
export type GiornoSettimana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface InfoGiornoSettimana {
  readonly numero: GiornoSettimana;
  readonly nome: string;
  readonly breve: string;
}

export const GIORNI_SETTIMANA: readonly InfoGiornoSettimana[] = [
  { numero: 1, nome: 'Lunedì', breve: 'Lun' },
  { numero: 2, nome: 'Martedì', breve: 'Mar' },
  { numero: 3, nome: 'Mercoledì', breve: 'Mer' },
  { numero: 4, nome: 'Giovedì', breve: 'Gio' },
  { numero: 5, nome: 'Venerdì', breve: 'Ven' },
  { numero: 6, nome: 'Sabato', breve: 'Sab' },
  { numero: 7, nome: 'Domenica', breve: 'Dom' },
] as const;

export const MIN_CARATTERI_TIPO_RIFIUTO = 2;
export const MAX_CARATTERI_TIPO_RIFIUTO = 80;
export const MAX_CARATTERI_NOTE_RACCOLTA = 300;

export const SUGGERIMENTI_TIPI_RIFIUTO: readonly string[] = [
  'Umido / Organico',
  'Carta e cartone',
  'Plastica e metalli',
  'Vetro',
  'Indifferenziato',
] as const;

export interface InputTurnoRaccolta {
  tipo_rifiuto: string;
  giorno_settimana: number | null | undefined;
  note?: string | null;
}

export interface TurnoRaccoltaValidato {
  tipo_rifiuto: string;
  giorno_settimana: GiornoSettimana;
  note: string | null;
}

export interface ErroriFormRaccolta {
  tipo_rifiuto?: string;
  giorno_settimana?: string;
  note?: string;
}

export type RisultatoValidazioneRaccolta =
  | { ok: true; dati: TurnoRaccoltaValidato }
  | { ok: false; errori: ErroriFormRaccolta };

export interface ContestoGiorniRaccolta {
  oggi: GiornoSettimana;
  domani: GiornoSettimana;
  nomeOggi: string;
  nomeDomani: string;
}

export interface GruppoGiornoRaccolta {
  giorno: GiornoSettimana;
  nome: string;
  breve: string;
  turni: IRaccoltaDifferenziata[];
}

export interface StatisticheRaccolta {
  totaleTurni: number;
  giorniCoperti: number;
  turniOggi: number;
  turniDomani: number;
}

export interface FiltriRaccolta {
  giorno?: number | null;
  ricerca?: string;
}

/** Verifica che un numero sia un giorno della settimana valido (`1..7`). */
export function isGiornoSettimanaValido(giorno: number | null | undefined): giorno is GiornoSettimana {
  return typeof giorno === 'number' && Number.isInteger(giorno) && giorno >= 1 && giorno <= 7;
}

/** Restituisce il nome completo del giorno (`1 = Lunedì ... 7 = Domenica`). */
export function nomeGiornoSettimana(giorno: number): string {
  const trovato = GIORNI_SETTIMANA.find((g) => g.numero === giorno);
  return trovato ? trovato.nome : 'Giorno non valido';
}

/** Restituisce l'abbreviazione a 3 lettere del giorno (`Lun ... Dom`). */
export function nomeBreveGiornoSettimana(giorno: number): string {
  const trovato = GIORNI_SETTIMANA.find((g) => g.numero === giorno);
  return trovato ? trovato.breve : '—';
}

/**
 * Converte un oggetto `Date` nel giorno della settimana `1..7`
 * (`1 = Lunedì ... 7 = Domenica`, gestendo `getDay() === 0` come `7`).
 */
export function giornoSettimanaDaDate(data: Date = new Date()): GiornoSettimana {
  const jsDay = data.getDay();
  return (jsDay === 0 ? 7 : jsDay) as GiornoSettimana;
}

/** Restituisce il giorno successivo nella settimana (`7 -> 1`). */
export function giornoSuccessivo(giorno: GiornoSettimana): GiornoSettimana {
  return ((giorno % 7) + 1) as GiornoSettimana;
}

/** Calcola in modo deterministico i riferimenti "Oggi" e "Domani" rispetto a `data`. */
export function contestoGiorniRaccolta(data: Date = new Date()): ContestoGiorniRaccolta {
  const oggi = giornoSettimanaDaDate(data);
  const domani = giornoSuccessivo(oggi);
  return {
    oggi,
    domani,
    nomeOggi: nomeGiornoSettimana(oggi),
    nomeDomani: nomeGiornoSettimana(domani),
  };
}

/** Indica se il giorno di un turno coincide con oggi o domani rispetto a `data`. */
export function badgeGiornoRelativo(giorno: number, data: Date = new Date()): 'oggi' | 'domani' | null {
  const { oggi, domani } = contestoGiorniRaccolta(data);
  if (giorno === oggi) return 'oggi';
  if (giorno === domani) return 'domani';
  return null;
}

/** Ordina i turni da Lunedì (1) a Domenica (7) e alfabeticamente per `tipo_rifiuto`. */
export function ordinaTurniRaccolta<
  T extends Pick<IRaccoltaDifferenziata, 'giorno_settimana' | 'tipo_rifiuto'>,
>(turni: readonly T[]): T[] {
  return [...turni].sort((a, b) => {
    if (a.giorno_settimana !== b.giorno_settimana) {
      return a.giorno_settimana - b.giorno_settimana;
    }
    return a.tipo_rifiuto.localeCompare(b.tipo_rifiuto, 'it', { sensitivity: 'base' });
  });
}

/** Raggruppa i turni ordinati per giorno della settimana (`1..7`), omettendo i giorni senza ritiri. */
export function raggruppaTurniPerGiorno(
  turni: readonly IRaccoltaDifferenziata[],
): GruppoGiornoRaccolta[] {
  const ordinati = ordinaTurniRaccolta(turni);
  const mappa = new Map<GiornoSettimana, IRaccoltaDifferenziata[]>();

  for (const turno of ordinati) {
    if (!isGiornoSettimanaValido(turno.giorno_settimana)) continue;
    const lista = mappa.get(turno.giorno_settimana) ?? [];
    lista.push(turno);
    mappa.set(turno.giorno_settimana, lista);
  }

  const gruppi: GruppoGiornoRaccolta[] = [];
  for (const g of GIORNI_SETTIMANA) {
    const lista = mappa.get(g.numero);
    if (lista && lista.length > 0) {
      gruppi.push({
        giorno: g.numero,
        nome: g.nome,
        breve: g.breve,
        turni: lista,
      });
    }
  }
  return gruppi;
}

/** Restituisce i turni di uno specifico giorno della settimana, ordinati per tipo rifiuto. */
export function turniDelGiorno(
  turni: readonly IRaccoltaDifferenziata[],
  giorno: GiornoSettimana,
): IRaccoltaDifferenziata[] {
  return ordinaTurniRaccolta(turni.filter((t) => t.giorno_settimana === giorno));
}

/** Calcola le statistiche riepilogative dei turni di raccolta. */
export function statisticheRaccolta(
  turni: readonly IRaccoltaDifferenziata[],
  data: Date = new Date(),
): StatisticheRaccolta {
  const { oggi, domani } = contestoGiorniRaccolta(data);
  const giorniUnici = new Set<number>();
  let turniOggi = 0;
  let turniDomani = 0;

  for (const turno of turni) {
    if (isGiornoSettimanaValido(turno.giorno_settimana)) {
      giorniUnici.add(turno.giorno_settimana);
    }
    if (turno.giorno_settimana === oggi) turniOggi += 1;
    if (turno.giorno_settimana === domani) turniDomani += 1;
  }

  return {
    totaleTurni: turni.length,
    giorniCoperti: giorniUnici.size,
    turniOggi,
    turniDomani,
  };
}

/** Filtra i turni per giorno della settimana e/o ricerca testuale su `tipo_rifiuto` e `note`. */
export function filtraTurniRaccolta(
  turni: readonly IRaccoltaDifferenziata[],
  filtri: FiltriRaccolta,
): IRaccoltaDifferenziata[] {
  const ricercaNorm = (filtri.ricerca ?? '').trim().toLowerCase();
  const giornoFiltro = isGiornoSettimanaValido(filtri.giorno) ? filtri.giorno : null;

  const filtrati = turni.filter((turno) => {
    if (giornoFiltro !== null && turno.giorno_settimana !== giornoFiltro) {
      return false;
    }
    if (!ricercaNorm) return true;
    const tipo = turno.tipo_rifiuto.toLowerCase();
    const note = (turno.note ?? '').toLowerCase();
    return tipo.includes(ricercaNorm) || note.includes(ricercaNorm);
  });

  return ordinaTurniRaccolta(filtrati);
}

/** Valida i dati del form di creazione o modifica di un turno di raccolta. */
export function validaTurnoRaccolta(input: InputTurnoRaccolta): RisultatoValidazioneRaccolta {
  const errori: ErroriFormRaccolta = {};

  const tipoPulito = (input.tipo_rifiuto ?? '').trim();
  if (!tipoPulito) {
    errori.tipo_rifiuto = 'Inserisci la tipologia di rifiuto.';
  } else if (tipoPulito.length < MIN_CARATTERI_TIPO_RIFIUTO) {
    errori.tipo_rifiuto = `Inserisci almeno ${MIN_CARATTERI_TIPO_RIFIUTO} caratteri.`;
  } else if (tipoPulito.length > MAX_CARATTERI_TIPO_RIFIUTO) {
    errori.tipo_rifiuto = `Massimo ${MAX_CARATTERI_TIPO_RIFIUTO} caratteri consentiti.`;
  }

  if (!isGiornoSettimanaValido(input.giorno_settimana)) {
    errori.giorno_settimana = 'Seleziona un giorno della settimana (da Lunedì a Domenica).';
  }

  const notePulite = (input.note ?? '').trim();
  if (notePulite.length > MAX_CARATTERI_NOTE_RACCOLTA) {
    errori.note = `Le note possono contenere al massimo ${MAX_CARATTERI_NOTE_RACCOLTA} caratteri.`;
  }

  if (Object.keys(errori).length > 0 || !isGiornoSettimanaValido(input.giorno_settimana)) {
    return { ok: false, errori };
  }

  return {
    ok: true,
    dati: {
      tipo_rifiuto: tipoPulito,
      giorno_settimana: input.giorno_settimana,
      note: notePulite.length > 0 ? notePulite : null,
    },
  };
}
