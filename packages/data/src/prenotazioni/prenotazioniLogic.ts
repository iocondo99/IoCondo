import type { IPrenotazioneSpazio, IRisorsaPrenotabile } from '@iocondo/shared-types';

export interface InputRisorsaPrenotabile {
  nome: string;
  tariffa_oraria: string | number;
  max_ore?: string | number | null;
}

export interface ErroriFormRisorsa {
  nome?: string;
  tariffa_oraria?: string;
  max_ore?: string;
}

export interface RisorsaValidata {
  nome: string;
  tariffa_oraria: number;
  max_ore: number | null;
}

export type EsitoValidazioneRisorsa =
  | { ok: true; dati: RisorsaValidata }
  | { ok: false; errori: ErroriFormRisorsa };

export interface InputPrenotazioneSpazio {
  risorsa_id: string;
  data_inizio: Date | string;
  data_fine: Date | string;
}

export interface ErroriFormPrenotazione {
  risorsa_id?: string;
  data_inizio?: string;
  data_fine?: string;
  generale?: string;
}

export interface PrenotazioneValidata {
  risorsa_id: string;
  data_inizio: Date;
  data_fine: Date;
  costo_addebitato: number;
}

export type EsitoValidazionePrenotazione =
  | { ok: true; dati: PrenotazioneValidata }
  | { ok: false; errori: ErroriFormPrenotazione };

export interface PrenotazioneConDettagli extends IPrenotazioneSpazio {
  risorsa_nome: string;
  tariffa_oraria: number;
  utente_nome: string | null;
  utente_email: string | null;
}

export type StatoSlotOrario = 'libero' | 'occupato' | 'mio' | 'passato';

export interface SlotOrario {
  oraInizio: number;
  oraFine: number;
  etichetta: string;
  dataInizio: Date;
  dataFine: Date;
  stato: StatoSlotOrario;
  prenotazioneId?: string;
}

export type FiltroStatoPrenotazione = 'tutte' | 'in-programma' | 'passate';

export interface FiltriPrenotazioni {
  risorsaId?: string;
  stato?: FiltroStatoPrenotazione;
  ricerca?: string;
  soloUtenteId?: string;
}

export interface StatistichePrenotazioni {
  totaleSpazi: number;
  prenotazioniAttive: number;
  spaziAPagamento: number;
  spaziGratuiti: number;
}

function parseNumero(valore: string | number): number {
  if (typeof valore === 'number') return valore;
  const normalizzato = valore.trim().replace(',', '.');
  if (!normalizzato) return Number.NaN;
  return Number(normalizzato);
}

function parseData(valore: Date | string): Date | null {
  const d = valore instanceof Date ? new Date(valore.getTime()) : new Date(valore);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Valida i campi di creazione/modifica di una risorsa prenotabile (lato Amministratore).
 */
export function validaRisorsaPrenotabile(input: InputRisorsaPrenotabile): EsitoValidazioneRisorsa {
  const errori: ErroriFormRisorsa = {};

  const nome = input.nome.trim();
  if (!nome) {
    errori.nome = 'Inserisci il nome dello spazio comune.';
  } else if (nome.length > 120) {
    errori.nome = 'Il nome dello spazio non può superare i 120 caratteri.';
  }

  const tariffaRaw =
    typeof input.tariffa_oraria === 'string' && input.tariffa_oraria.trim() === ''
      ? 0
      : parseNumero(input.tariffa_oraria);
  if (!Number.isFinite(tariffaRaw) || tariffaRaw < 0) {
    errori.tariffa_oraria = 'La tariffa oraria deve essere un numero maggiore o uguale a 0.';
  }

  let maxOre: number | null = null;
  const maxOreRaw = input.max_ore;
  if (maxOreRaw !== undefined && maxOreRaw !== null && String(maxOreRaw).trim() !== '') {
    const parsedMax = parseNumero(maxOreRaw);
    if (!Number.isInteger(parsedMax) || parsedMax <= 0) {
      errori.max_ore = 'La durata massima deve essere un numero intero positivo di ore.';
    } else {
      maxOre = parsedMax;
    }
  }

  if (Object.keys(errori).length > 0) {
    return { ok: false, errori };
  }

  return {
    ok: true,
    dati: {
      nome,
      tariffa_oraria: Math.round(tariffaRaw * 100) / 100,
      max_ore: maxOre,
    },
  };
}

/**
 * Verifica la sovrapposizione tra due intervalli semi-aperti [inizio, fine),
 * coerente con `tstzrange(data_inizio, data_fine)` di PostgreSQL.
 */
export function intervalliSiSovrappongono(
  inizioA: Date | string,
  fineA: Date | string,
  inizioB: Date | string,
  fineB: Date | string,
): boolean {
  const aStart = parseData(inizioA);
  const aEnd = parseData(fineA);
  const bStart = parseData(inizioB);
  const bEnd = parseData(fineB);
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  if (aEnd <= aStart || bEnd <= bStart) return false;
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/**
 * Calcola il costo stimato della prenotazione arrotondato al centesimo.
 */
export function calcolaCostoPrenotazione(
  tariffaOraria: number,
  dataInizio: Date | string,
  dataFine: Date | string,
): number {
  if (!Number.isFinite(tariffaOraria) || tariffaOraria <= 0) return 0;
  const inizio = parseData(dataInizio);
  const fine = parseData(dataFine);
  if (!inizio || !fine || fine.getTime() <= inizio.getTime()) return 0;
  const ore = (fine.getTime() - inizio.getTime()) / 3_600_000;
  return Math.round(ore * tariffaOraria * 100) / 100;
}

/**
 * Formatta un importo in euro secondo la convenzione italiana (es. `15,00 €` oppure `Gratuito`).
 */
export function formattaCostoPrenotazione(importo: number): string {
  if (!Number.isFinite(importo) || importo <= 0) return 'Gratuito';
  return `${importo.toFixed(2).replace('.', ',')} €`;
}

/**
 * Formatta la tariffa oraria di uno spazio comune (es. `10,00 €/ora` oppure `Gratuito`).
 */
export function formattaTariffaOraria(tariffa: number): string {
  if (!Number.isFinite(tariffa) || tariffa <= 0) return 'Gratuito';
  return `${tariffa.toFixed(2).replace('.', ',')} €/ora`;
}

/**
 * Valida una nuova prenotazione lato client prima dell'invio a Supabase:
 * - risorsa esistente;
 * - date valide con `data_fine > data_inizio`;
 * - divieto di prenotare nel passato rispetto a `now`;
 * - rispetto di `max_ore` della risorsa;
 * - assenza di sovrapposizioni con prenotazioni esistenti sullo stesso spazio.
 */
export function validaPrenotazione(
  input: InputPrenotazioneSpazio,
  risorsa: IRisorsaPrenotabile | null | undefined,
  prenotazioniEsistenti: readonly IPrenotazioneSpazio[],
  now: Date = new Date(),
): EsitoValidazionePrenotazione {
  const errori: ErroriFormPrenotazione = {};

  if (!input.risorsa_id.trim() || !risorsa) {
    errori.risorsa_id = 'Seleziona uno spazio comune da prenotare.';
  }

  const inizio = parseData(input.data_inizio);
  const fine = parseData(input.data_fine);

  if (!inizio) {
    errori.data_inizio = 'Specifica una data e ora di inizio valide.';
  } else if (inizio.getTime() < now.getTime()) {
    errori.data_inizio = 'Non puoi prenotare una fascia oraria già iniziata o nel passato.';
  }

  if (!fine) {
    errori.data_fine = 'Specifica una data e ora di fine valide.';
  } else if (inizio && fine.getTime() <= inizio.getTime()) {
    errori.data_fine = 'L’orario di fine deve essere successivo all’orario di inizio.';
  }

  if (risorsa && inizio && fine && fine.getTime() > inizio.getTime()) {
    const durataOre = (fine.getTime() - inizio.getTime()) / 3_600_000;
    if (risorsa.max_ore !== null && durataOre > risorsa.max_ore) {
      errori.data_fine = `La durata massima consentita per questo spazio è di ${risorsa.max_ore} ${
        risorsa.max_ore === 1 ? 'ora' : 'ore'
      }.`;
    }

    const conflitto = prenotazioniEsistenti.some(
      (p) =>
        p.risorsa_id === risorsa.id &&
        intervalliSiSovrappongono(inizio, fine, p.data_inizio, p.data_fine),
    );
    if (conflitto) {
      errori.generale = 'Questo spazio risulta già prenotato nella fascia oraria scelta.';
    }
  }

  if (Object.keys(errori).length > 0 || !risorsa || !inizio || !fine) {
    return { ok: false, errori };
  }

  return {
    ok: true,
    dati: {
      risorsa_id: risorsa.id,
      data_inizio: inizio,
      data_fine: fine,
      costo_addebitato: calcolaCostoPrenotazione(risorsa.tariffa_oraria, inizio, fine),
    },
  };
}

/**
 * Traduce gli errori Postgres (in particolare `23P01` da `exclude using gist`)
 * in messaggi comprensibili in italiano.
 */
export function traduciErrorePrenotazione(
  err: unknown,
  fallback = 'Operazione sulla prenotazione non riuscita.',
): string {
  if (err && typeof err === 'object') {
    const code = 'code' in err ? String(err.code) : '';
    const message = 'message' in err && typeof err.message === 'string' ? err.message : '';
    if (
      code === '23P01' ||
      message.includes('23P01') ||
      message.toLowerCase().includes('exclusion') ||
      message.includes('prenotazioni_spazi_risorsa_id_tstzrange_excl')
    ) {
      return 'Questo spazio risulta già prenotato nella fascia oraria scelta.';
    }
    if (message) return message;
  }
  if (err instanceof Error && err.message) {
    if (err.message.includes('23P01')) {
      return 'Questo spazio risulta già prenotato nella fascia oraria scelta.';
    }
    return err.message;
  }
  return fallback;
}

/**
 * Genera gli slot orari di una giornata per uno spazio comune, mascherando
 * le prenotazioni di altri condòmini come `"occupato"` per tutela della privacy.
 */
export function generaSlotGiorno(
  data: Date,
  risorsaId: string,
  prenotazioni: readonly IPrenotazioneSpazio[],
  utenteCorrenteId: string,
  opzioni: { oraInizio?: number; oraFine?: number; now?: Date } = {},
): SlotOrario[] {
  const oraInizio = opzioni.oraInizio ?? 8;
  const oraFine = opzioni.oraFine ?? 22;
  const now = opzioni.now ?? new Date();
  const prenotazioniRisorsa = prenotazioni.filter((p) => p.risorsa_id === risorsaId);
  const slots: SlotOrario[] = [];

  for (let ora = oraInizio; ora < oraFine; ora++) {
    const start = new Date(data.getFullYear(), data.getMonth(), data.getDate(), ora, 0, 0, 0);
    const end = new Date(data.getFullYear(), data.getMonth(), data.getDate(), ora + 1, 0, 0, 0);
    const etichetta = `${String(ora).padStart(2, '0')}:00 - ${String(ora + 1).padStart(2, '0')}:00`;

    const trovata = prenotazioniRisorsa.find((p) =>
      intervalliSiSovrappongono(start, end, p.data_inizio, p.data_fine),
    );

    if (trovata) {
      if (trovata.utente_id === utenteCorrenteId) {
        slots.push({
          oraInizio: ora,
          oraFine: ora + 1,
          etichetta,
          dataInizio: start,
          dataFine: end,
          stato: 'mio',
          prenotazioneId: trovata.id,
        });
      } else {
        slots.push({
          oraInizio: ora,
          oraFine: ora + 1,
          etichetta,
          dataInizio: start,
          dataFine: end,
          stato: 'occupato',
        });
      }
    } else if (start.getTime() < now.getTime()) {
      slots.push({
        oraInizio: ora,
        oraFine: ora + 1,
        etichetta,
        dataInizio: start,
        dataFine: end,
        stato: 'passato',
      });
    } else {
      slots.push({
        oraInizio: ora,
        oraFine: ora + 1,
        etichetta,
        dataInizio: start,
        dataFine: end,
        stato: 'libero',
      });
    }
  }

  return slots;
}

export function statoPrenotazione(
  prenotazione: Pick<IPrenotazioneSpazio, 'data_fine'>,
  now: Date = new Date(),
): 'in-programma' | 'passata' {
  const fine = parseData(prenotazione.data_fine);
  if (!fine) return 'passata';
  return fine.getTime() > now.getTime() ? 'in-programma' : 'passata';
}

export function ordinaPrenotazioni<T extends Pick<IPrenotazioneSpazio, 'data_inizio' | 'data_fine'>>(
  lista: readonly T[],
  now: Date = new Date(),
): T[] {
  return [...lista].sort((a, b) => {
    const aAttiva = statoPrenotazione(a, now) === 'in-programma';
    const bAttiva = statoPrenotazione(b, now) === 'in-programma';
    if (aAttiva !== bAttiva) return aAttiva ? -1 : 1;
    const tA = new Date(a.data_inizio).getTime();
    const tB = new Date(b.data_inizio).getTime();
    return aAttiva ? tA - tB : tB - tA;
  });
}

export function filtraPrenotazioni<T extends PrenotazioneConDettagli>(
  lista: readonly T[],
  filtri: FiltriPrenotazioni,
  now: Date = new Date(),
): T[] {
  const q = filtri.ricerca?.trim().toLowerCase() ?? '';
  return lista.filter((item) => {
    if (filtri.soloUtenteId && item.utente_id !== filtri.soloUtenteId) return false;
    if (filtri.risorsaId && item.risorsa_id !== filtri.risorsaId) return false;
    if (filtri.stato && filtri.stato !== 'tutte') {
      const s = statoPrenotazione(item, now);
      if (s !== filtri.stato) return false;
    }
    if (q) {
      const campi = [item.risorsa_nome, item.utente_nome ?? '', item.utente_email ?? '']
        .join(' ')
        .toLowerCase();
      if (!campi.includes(q)) return false;
    }
    return true;
  });
}

export function statistichePrenotazioni(
  risorse: readonly IRisorsaPrenotabile[],
  prenotazioni: readonly IPrenotazioneSpazio[],
  now: Date = new Date(),
): StatistichePrenotazioni {
  const prenotazioniAttive = prenotazioni.filter((p) => statoPrenotazione(p, now) === 'in-programma').length;
  const spaziAPagamento = risorse.filter((r) => Number(r.tariffa_oraria) > 0).length;
  return {
    totaleSpazi: risorse.length,
    prenotazioniAttive,
    spaziAPagamento,
    spaziGratuiti: risorse.length - spaziAPagamento,
  };
}

export function formattaIntervalloPrenotazione(dataInizio: string, dataFine: string): string {
  const inizio = parseData(dataInizio);
  const fine = parseData(dataFine);
  if (!inizio || !fine) return '—';
  const giorno = inizio.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const oraInizio = inizio.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const oraFine = fine.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${giorno} · ${oraInizio} - ${oraFine}`;
}
