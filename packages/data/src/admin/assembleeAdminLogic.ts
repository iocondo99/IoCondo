/**
 * Logica pura per la gestione Assemblee dell'Amministratore (`/admin/assemblee` e `/admin/assemblee/[id]`, UC-10):
 * - Quorum Costitutivo ex art. 1136 c.c. (1ª e 2ª convocazione);
 * - Gestione deleghe e verifica limite legale ex art. 67 disp. att. c.c. (> 20 condòmini: max 1/5 partecipanti e 1/5 valore);
 * - Quorum Deliberativo ex art. 1136 c.c. (doppia maggioranza teste e millesimi minimi);
 * - Tabella analitica nominale per verbale con esportazione testuale;
 * - StatCard riepilogative e filtri amministratore.
 *
 * File puro (nessuna dipendenza da React Native, Expo o Supabase): testabile con `node --test`.
 */

import type { BadgeStatus } from '@iocondo/ui';

export const DURATA_LINK_FIRMATO_VERBALE_SECONDI = 600;
export const SOGLIA_CONDOMINI_ART67 = 20;

export type StatoAssembleaAdmin = 'BOZZA' | 'CONVOCATA' | 'IN_CORSO' | 'CONCLUSA' | 'ANNULLATA';
export type TipoAssembleaAdmin = 'ORDINARIA' | 'STRAORDINARIA';
export type ModalitaAssembleaAdmin = 'PRESENZA' | 'ONLINE' | 'IBRIDA';
export type ModalitaPresenzaAdmin = 'PRESENZA' | 'ONLINE' | 'DELEGA' | 'ASSENTE';
export type VotoSceltaAdmin = 'FAVOREVOLE' | 'CONTRARIO' | 'ASTENUTO';
export type ConvocazioneAttiva = 'PRIMA' | 'SECONDA';
export type TipoDelibera = 'ORDINARIA' | 'STRAORDINARIA';

export interface UnitaAssembleaView {
  id: string;
  interno: string;
  palazzoNome?: string | null;
  scala?: string | null;
  piano?: number | null;
  valoreMillesimale: number;
  proprietarioId?: string | null;
  proprietarioNome?: string | null;
}

export interface PresenzaUnitaView {
  unitaId: string;
  modalita: ModalitaPresenzaAdmin;
  delegatoUtenteId?: string | null;
  delegatoNome?: string | null;
}

export interface VotoUnitaView {
  unitaId: string;
  voto: VotoSceltaAdmin;
  utenteId?: string | null;
}

export interface PuntoOdgAdminView {
  id: string;
  assembleaId: string;
  ordine: number;
  titoloPunto: string;
  descrizione?: string | null;
  votazioneAperta: boolean;
  tipoDelibera?: TipoDelibera;
  voti?: Record<string, VotoSceltaAdmin>; // unitaId -> voto
}

export interface AssembleaAdminView {
  id: string;
  condominioId: string;
  tabellaMillesimaleId: string | null;
  tabellaMillesimaleNome?: string | null;
  data: string; // ISO
  dataPrimaConvocazione?: string | null;
  dataSecondaConvocazione?: string | null;
  luogo: string | null;
  linkMeet: string | null;
  verbaleUrl: string | null;
  stato: StatoAssembleaAdmin;
  tipo: TipoAssembleaAdmin;
  modalita: ModalitaAssembleaAdmin;
  createdAt: string;
  updatedAt: string;
  puntiOdg?: PuntoOdgAdminView[];
  totalePuntiOdg: number;
  votazioniAperte: number;
  totalePresenze?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Quorum Costitutivo ex art. 1136 c.c.
// ─────────────────────────────────────────────────────────────────────────────

export interface QuorumCostitutivoInput {
  convocazione: ConvocazioneAttiva;
  testePresenti: number;
  testeTotali: number;
  millesimiPresenti: number;
  totaleMillesimi?: number;
}

export interface QuorumCostitutivoResult {
  valido: boolean;
  convocazione: ConvocazioneAttiva;
  testePresenti: number;
  testeTotali: number;
  testeRichieste: number;
  testeSoddisfatte: boolean;
  millesimiPresenti: number;
  millesimiTotali: number;
  millesimiRichiesti: number;
  millesimiSoddisfatti: boolean;
  percentualeTeste: number;
  percentualeMillesimi: number;
  messaggio: string;
  badgeStatus: BadgeStatus;
  badgeLabel: string;
}

/**
 * Calcola la validità della costituzione dell'assemblea ex art. 1136 c.c.:
 * - 1ª Convocazione: maggioranza dei partecipanti (testePresenti > testeTotali / 2) e almeno 2/3 del valore (>= 666.67 ‰);
 * - 2ª Convocazione: almeno 1/3 dei partecipanti (testePresenti >= ceil(testeTotali / 3)) e almeno 1/3 del valore (>= 333.33 ‰).
 */
export function calcolaQuorumCostitutivo(input: QuorumCostitutivoInput): QuorumCostitutivoResult {
  const { convocazione, testePresenti, testeTotali, millesimiPresenti } = input;
  const millesimiTotali = input.totaleMillesimi && input.totaleMillesimi > 0 ? input.totaleMillesimi : 1000;

  if (testeTotali <= 0) {
    return {
      valido: false,
      convocazione,
      testePresenti,
      testeTotali: 0,
      testeRichieste: 0,
      testeSoddisfatte: false,
      millesimiPresenti,
      millesimiTotali,
      millesimiRichiesti: 0,
      millesimiSoddisfatti: false,
      percentualeTeste: 0,
      percentualeMillesimi: 0,
      messaggio: 'Nessuna unità configurata per il calcolo del quorum.',
      badgeStatus: 'error',
      badgeLabel: 'Dati insufficienti',
    };
  }

  let testeRichieste = 0;
  let millesimiRichiesti = 0;

  if (convocazione === 'PRIMA') {
    // 1ª Convocazione: maggioranza dei partecipanti e 2/3 del valore
    testeRichieste = Math.floor(testeTotali / 2) + 1;
    // 2/3 di millesimiTotali arrotondato a due decimali (es. 666.67 su 1000)
    millesimiRichiesti = Math.round(((millesimiTotali * 2) / 3) * 100) / 100;
  } else {
    // 2ª Convocazione: 1/3 dei partecipanti e 1/3 del valore
    testeRichieste = Math.ceil(testeTotali / 3);
    millesimiRichiesti = Math.round((millesimiTotali / 3) * 100) / 100;
  }

  const testeSoddisfatte = testePresenti >= testeRichieste;
  // Tolleranza standard 0.01 per arrotondamenti di virgola mobile
  const millesimiSoddisfatti = millesimiPresenti >= millesimiRichiesti - 0.01;
  const valido = testeSoddisfatte && millesimiSoddisfatti;

  const pctTeste = testeTotali > 0 ? Math.round((testePresenti / testeTotali) * 1000) / 10 : 0;
  const pctMillesimi = millesimiTotali > 0 ? Math.round((millesimiPresenti / millesimiTotali) * 1000) / 10 : 0;

  let messaggio = '';
  let badgeLabel = '';
  let badgeStatus: BadgeStatus = 'neutral';

  if (valido) {
    messaggio = `Assemblea validamente costituita in ${convocazione === 'PRIMA' ? '1ª' : '2ª'} convocazione (${testePresenti}/${testeTotali} teste, ${millesimiPresenti.toFixed(2)}/${millesimiTotali} ‰).`;
    badgeLabel = 'Assemblea validamente costituita';
    badgeStatus = 'success';
  } else if (testePresenti === 0) {
    messaggio = `Seduta deserta: nessuna presenza registrata (${convocazione === 'PRIMA' ? '1ª' : '2ª'} convocazione).`;
    badgeLabel = 'Seduta deserta';
    badgeStatus = 'error';
  } else {
    const motivi: string[] = [];
    if (!testeSoddisfatte) motivi.push(`teste insufficienti (${testePresenti}/${testeRichieste} min.)`);
    if (!millesimiSoddisfatti) motivi.push(`millesimi insufficienti (${millesimiPresenti.toFixed(2)}/${millesimiRichiesti.toFixed(2)} min.)`);
    messaggio = `Quorum costitutivo non raggiunto: ${motivi.join(', ')}.`;
    badgeLabel = 'Quorum non raggiunto';
    badgeStatus = 'error';
  }

  return {
    valido,
    convocazione,
    testePresenti,
    testeTotali,
    testeRichieste,
    testeSoddisfatte,
    millesimiPresenti,
    millesimiTotali,
    millesimiRichiesti,
    millesimiSoddisfatti,
    percentualeTeste: pctTeste,
    percentualeMillesimi: pctMillesimi,
    messaggio,
    badgeStatus,
    badgeLabel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Controllo Deleghe ex art. 67 disp. att. c.c.
// ─────────────────────────────────────────────────────────────────────────────

export interface DelegatoCumulo {
  delegatoUtenteId: string;
  delegatoNome: string;
  unitaDelegateIds: string[];
  millesimiDelegati: number;
  quotaPropriaMillesimi: number;
  millesimiTotaliRappresentati: number;
  numeroDeleghe: number;
  superaLimite: boolean;
  motivoViolazione?: string;
}

export interface VerificaDelegheResult {
  limiteApplicabile: boolean;
  totaleCondomini: number;
  maxDelegheConsentite: number;
  maxMillesimiConsentiti: number;
  delegati: DelegatoCumulo[];
  haViolazioni: boolean;
  messaggio: string;
}

/**
 * Verifica il cumulo deleghe e il limite di legge ex art. 67 disp. att. c.c.:
 * "Se i condòmini sono più di venti, il delegato non può rappresentare più di un quinto
 * dei condòmini e del valore proporzionale."
 */
export function verificaCumuloDeleghe(
  unitaList: readonly UnitaAssembleaView[],
  presenzeMap: Readonly<Record<string, PresenzaUnitaView>>,
  totaleMillesimi = 1000,
): VerificaDelegheResult {
  // Calcolo partecipanti unici (condòmini)
  const proprietariUnici = new Set<string>();
  for (const u of unitaList) {
    if (u.proprietarioId) {
      proprietariUnici.add(u.proprietarioId);
    } else {
      proprietariUnici.add(`unita_${u.id}`);
    }
  }

  const totaleCondomini = Math.max(proprietariUnici.size, unitaList.length);
  const limiteApplicabile = totaleCondomini > SOGLIA_CONDOMINI_ART67;
  const maxDelegheConsentite = limiteApplicabile ? Math.floor(totaleCondomini / 5) : Infinity;
  const maxMillesimiConsentiti = limiteApplicabile ? Math.round((totaleMillesimi / 5) * 100) / 100 : Infinity;

  // Raccogli le deleghe per ciascun delegato
  const mappaDelegati = new Map<
    string,
    {
      nome: string;
      unitaIds: string[];
      millesimiDelegati: number;
    }
  >();

  for (const u of unitaList) {
    const p = presenzeMap[u.id];
    if (p && p.modalita === 'DELEGA' && p.delegatoUtenteId) {
      const cur = mappaDelegati.get(p.delegatoUtenteId) ?? {
        nome: p.delegatoNome || 'Condòmino Delegato',
        unitaIds: [],
        millesimiDelegati: 0,
      };
      cur.unitaIds.push(u.id);
      cur.millesimiDelegati += u.valoreMillesimale || 0;
      if (p.delegatoNome) cur.nome = p.delegatoNome;
      mappaDelegati.set(p.delegatoUtenteId, cur);
    }
  }

  // Calcola quota propria di ciascun delegato (se il delegato è proprietario di unità)
  const delegati: DelegatoCumulo[] = [];
  let haViolazioni = false;

  for (const [delegatoId, info] of mappaDelegati.entries()) {
    let quotaPropria = 0;
    for (const u of unitaList) {
      if (u.proprietarioId === delegatoId) {
        quotaPropria += u.valoreMillesimale || 0;
      }
    }

    const millesimiTotaliRappresentati = info.millesimiDelegati + quotaPropria;
    const numeroDeleghe = info.unitaIds.length;

    let supera = false;
    const motivi: string[] = [];

    if (limiteApplicabile) {
      if (numeroDeleghe > maxDelegheConsentite) {
        supera = true;
        motivi.push(`troppe deleghe (${numeroDeleghe} su max ${maxDelegheConsentite})`);
      }
      if (millesimiTotaliRappresentati > maxMillesimiConsentiti + 0.01) {
        supera = true;
        motivi.push(`valore eccessivo (${millesimiTotaliRappresentati.toFixed(2)} ‰ su max ${maxMillesimiConsentiti.toFixed(2)} ‰)`);
      }
    }

    if (supera) {
      haViolazioni = true;
    }

    delegati.push({
      delegatoUtenteId: delegatoId,
      delegatoNome: info.nome,
      unitaDelegateIds: info.unitaIds,
      millesimiDelegati: Math.round(info.millesimiDelegati * 1000) / 1000,
      quotaPropriaMillesimi: Math.round(quotaPropria * 1000) / 1000,
      millesimiTotaliRappresentati: Math.round(millesimiTotaliRappresentati * 1000) / 1000,
      numeroDeleghe,
      superaLimite: supera,
      motivoViolazione: motivi.length > 0 ? motivi.join(', ') : undefined,
    });
  }

  let messaggio = 'Deleghe conformi alla normativa.';
  if (haViolazioni) {
    messaggio = `Attenzione: superato il limite di legge ex art. 67 disp. att. c.c. (> 20 condòmini: max 1/5 partecipanti [${maxDelegheConsentite}] e 1/5 valore [${maxMillesimiConsentiti.toFixed(0)} ‰]).`;
  } else if (!limiteApplicabile) {
    messaggio = `Condominio con ${totaleCondomini} condòmini (≤ 20): limite ex lege di 1/5 non vincolante ex art. 67 disp. att. c.c.`;
  }

  return {
    limiteApplicabile,
    totaleCondomini,
    maxDelegheConsentite,
    maxMillesimiConsentiti,
    delegati,
    haViolazioni,
    messaggio,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Quorum Deliberativo ex art. 1136 c.c.
// ─────────────────────────────────────────────────────────────────────────────

export interface QuorumDeliberativoInput {
  tipoAssemblea: TipoAssembleaAdmin;
  convocazione: ConvocazioneAttiva;
  tipoDelibera?: TipoDelibera; // Se specificato, prevale sul default
  totaleMillesimiEdificio?: number;
  unitaList: readonly UnitaAssembleaView[];
  presenzeMap: Readonly<Record<string, PresenzaUnitaView>>;
  votiMap: Readonly<Record<string, VotoSceltaAdmin>>; // unitaId -> 'FAVOREVOLE' | 'CONTRARIO' | 'ASTENUTO'
}

export interface QuorumDeliberativoResult {
  approvata: boolean;
  esito: 'APPROVATA' | 'RESPINTA';
  badgeStatus: BadgeStatus;
  badgeLabel: string;
  testeFavorevoli: number;
  testeContrarie: number;
  testeAstenute: number;
  testeIntervenute: number;
  millesimiFavorevoli: number;
  millesimiContrari: number;
  millesimiAstenuti: number;
  millesimiIntervenuti: number;
  millesimiRichiesti: number;
  testeSoddisfatte: boolean;
  millesimiSoddisfatti: boolean;
  percentualeTesteFavorevoli: number;
  percentualeMillesimiFavorevoli: number;
  tipoDeliberaApplicata: TipoDelibera;
  motivazione: string;
}

/**
 * Calcola l'esito della votazione su un punto all'ordine del giorno (art. 1136 c.c.):
 * - Richiede la doppia maggioranza:
 *   1) Maggioranza degli intervenuti (teste favorevoli > maggioranza delle teste presenti/votanti);
 *   2) Quorum millesimale:
 *      * Delibera ordinaria in 2ª convocazione: almeno 1/3 del valore (>= 333.33 ‰);
 *      * Delibera straordinaria o in 1ª convocazione: almeno 1/2 del valore (>= 500.00 ‰).
 */
export function calcolaQuorumDeliberativo(input: QuorumDeliberativoInput): QuorumDeliberativoResult {
  const { tipoAssemblea, convocazione, unitaList, presenzeMap, votiMap } = input;
  const totaleMillesimiEdificio = input.totaleMillesimiEdificio || 1000;

  const tipoDeliberaApplicata: TipoDelibera =
    input.tipoDelibera || (tipoAssemblea === 'STRAORDINARIA' ? 'STRAORDINARIA' : 'ORDINARIA');

  let millesimiRichiesti = 333.33;
  if (convocazione === 'PRIMA' || tipoDeliberaApplicata === 'STRAORDINARIA') {
    millesimiRichiesti = 500.0;
  }

  // Mappa quote millesimali per unita
  const millesimiMap = new Map<string, number>();
  for (const u of unitaList) {
    millesimiMap.set(u.id, u.valoreMillesimale || 0);
  }

  let testeFavorevoli = 0;
  let testeContrarie = 0;
  let testeAstenute = 0;
  let millesimiFavorevoli = 0;
  let millesimiContrari = 0;
  let millesimiAstenuti = 0;

  for (const [unitaId, voto] of Object.entries(votiMap)) {
    // Il voto è valido solo se l'unità è presente (in sala, online o per delega)
    const pres = presenzeMap[unitaId];
    if (!pres || pres.modalita === 'ASSENTE') {
      continue;
    }
    const mm = millesimiMap.get(unitaId) || 0;

    if (voto === 'FAVOREVOLE') {
      testeFavorevoli += 1;
      millesimiFavorevoli += mm;
    } else if (voto === 'CONTRARIO') {
      testeContrarie += 1;
      millesimiContrari += mm;
    } else if (voto === 'ASTENUTO') {
      testeAstenute += 1;
      millesimiAstenuti += mm;
    }
  }

  const testeIntervenute = testeFavorevoli + testeContrarie + testeAstenute;
  const millesimiIntervenuti = millesimiFavorevoli + millesimiContrari + millesimiAstenuti;

  // Verifica maggioranza degli intervenuti (teste)
  const testeSoddisfatte = testeIntervenute > 0 && testeFavorevoli > testeIntervenute / 2;
  // Verifica quorum millesimi
  const millesimiSoddisfatti = millesimiFavorevoli >= millesimiRichiesti - 0.01;

  const approvata = testeSoddisfatte && millesimiSoddisfatti;

  const pctTeste = testeIntervenute > 0 ? Math.round((testeFavorevoli / testeIntervenute) * 1000) / 10 : 0;
  const pctMillesimi = totaleMillesimiEdificio > 0 ? Math.round((millesimiFavorevoli / totaleMillesimiEdificio) * 1000) / 10 : 0;

  let motivazione = '';
  if (approvata) {
    motivazione = `Delibera APPROVATA: maggioranza delle teste (${testeFavorevoli}/${testeIntervenute}) e ${millesimiFavorevoli.toFixed(2)} ‰ (richiesti almeno ${millesimiRichiesti.toFixed(2)} ‰).`;
  } else if (testeIntervenute === 0) {
    motivazione = 'Nessun voto registrato.';
  } else {
    const motivi: string[] = [];
    if (!testeSoddisfatte) motivi.push(`teste favorevoli insufficienti (${testeFavorevoli}/${testeIntervenute})`);
    if (!millesimiSoddisfatti) motivi.push(`millesimi favorevoli insufficienti (${millesimiFavorevoli.toFixed(2)} su ${millesimiRichiesti.toFixed(2)} ‰)`);
    motivazione = `Delibera RESPINTA: ${motivi.join(', ')}.`;
  }

  return {
    approvata,
    esito: approvata ? 'APPROVATA' : 'RESPINTA',
    badgeStatus: approvata ? 'success' : 'error',
    badgeLabel: approvata ? 'APPROVATA' : 'RESPINTA',
    testeFavorevoli,
    testeContrarie,
    testeAstenute,
    testeIntervenute,
    millesimiFavorevoli: Math.round(millesimiFavorevoli * 1000) / 1000,
    millesimiContrari: Math.round(millesimiContrari * 1000) / 1000,
    millesimiAstenuti: Math.round(millesimiAstenuti * 1000) / 1000,
    millesimiIntervenuti: Math.round(millesimiIntervenuti * 1000) / 1000,
    millesimiRichiesti,
    testeSoddisfatte,
    millesimiSoddisfatti,
    percentualeTesteFavorevoli: pctTeste,
    percentualeMillesimiFavorevoli: pctMillesimi,
    tipoDeliberaApplicata,
    motivazione,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Tabella Analitica Nominale per Verbale (UC-10)
// ─────────────────────────────────────────────────────────────────────────────

export interface RigaNominaleVerbale {
  unitaId: string;
  interno: string;
  palazzo: string;
  proprietario: string;
  statoPresenza: ModalitaPresenzaAdmin;
  delegato?: string | null;
  valoreMillesimale: number;
  votoEspresso: VotoSceltaAdmin | 'NON_ESPRESSO' | 'ASSENTE';
}

/**
 * Compone le righe analitiche nominali per la stesura del verbale di un punto ODG.
 */
export function generaTabellaNominalePunto(
  unitaList: readonly UnitaAssembleaView[],
  presenzeMap: Readonly<Record<string, PresenzaUnitaView>>,
  votiMap: Readonly<Record<string, VotoSceltaAdmin>>,
): RigaNominaleVerbale[] {
  return unitaList.map((u) => {
    const pres = presenzeMap[u.id];
    const presente = pres && pres.modalita !== 'ASSENTE';
    const voto = votiMap[u.id];

    let votoEspresso: RigaNominaleVerbale['votoEspresso'] = 'ASSENTE';
    if (presente) {
      votoEspresso = voto || 'NON_ESPRESSO';
    }

    return {
      unitaId: u.id,
      interno: u.interno,
      palazzo: u.palazzoNome || '-',
      proprietario: u.proprietarioNome || 'Proprietario non registrato',
      statoPresenza: pres?.modalita || 'ASSENTE',
      delegato: pres?.modalita === 'DELEGA' ? pres.delegatoNome || 'Delegato' : null,
      valoreMillesimale: u.valoreMillesimale,
      votoEspresso,
    };
  });
}

/**
 * Genera il report testuale formattato del punto ODG da inserire nel verbale assembleare.
 */
export function esportaTestoVerbalePunto(
  titoloAssemblea: string,
  punto: PuntoOdgAdminView,
  esito: QuorumDeliberativoResult,
  righeNominali: readonly RigaNominaleVerbale[],
): string {
  const dataTesto = new Date().toLocaleDateString('it-IT');
  const righeTesto = righeNominali.map((r) => {
    const delegatoInfo = r.delegato ? ` (per delega a ${r.delegato})` : '';
    return `- Int. ${r.interno} (${r.proprietario}${delegatoInfo}) - ${r.valoreMillesimale.toFixed(2)} ‰: ${r.votoEspresso}`;
  });

  return [
    `VERBALE DELIBERAZIONE - PUNTO N. ${punto.ordine}`,
    `Assemblea: ${titoloAssemblea}`,
    `Oggetto: ${punto.titoloPunto}`,
    punto.descrizione ? `Proposta di delibera: ${punto.descrizione}` : '',
    '',
    `ESITO VOTAZIONE: ${esito.esito}`,
    `Dettaglio teste: Favorevoli ${esito.testeFavorevoli}, Contrari ${esito.testeContrarie}, Astenuti ${esito.testeAstenute} (Totale intervenuti: ${esito.testeIntervenute})`,
    `Dettaglio millesimi: Favorevoli ${esito.millesimiFavorevoli.toFixed(2)} ‰, Contrari ${esito.millesimiContrari.toFixed(2)} ‰, Astenuti ${esito.millesimiAstenuti.toFixed(2)} ‰ (Quorum richiesto: ${esito.millesimiRichiesti.toFixed(2)} ‰)`,
    `Motivazione: ${esito.motivazione}`,
    '',
    'TABELLA NOMINALE DEI VOTI ESPRESSI:',
    ...righeTesto,
    '',
    `Data registrazione: ${dataTesto}`,
  ]
    .filter((linea) => linea !== undefined)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. StatCard e Filtri Elenco Assemblee Amministratore
// ─────────────────────────────────────────────────────────────────────────────

export interface RiepilogoAssembleeAdmin {
  prossimaAssemblea: AssembleaAdminView | null;
  totaleAnno: number;
  votazioniAperte: number;
  totaleBozze: number;
  totaleConcluse: number;
}

export interface FiltriAssembleeAdmin {
  stato: 'tutte' | 'convocate' | 'in_corso' | 'concluse' | 'bozze';
  ricerca: string;
}

/**
 * Calcola il riepilogo per le 3 StatCard dell'Amministratore:
 * - "Prossima assemblea": data convocazione, tipo, icona `calendar`, tessera blu;
 * - "Assemblee dell'anno": totale assemblee svolte o convocate nell'anno solare, icona `users`, tessera navy;
 * - "Votazioni aperte": conteggio punti ODG attualmente in votazione attiva, icona `vote` (o `check-square`), tessera teal.
 */
export function riepilogoAssembleeAdmin(
  assemblee: readonly AssembleaAdminView[],
  annoRiferimento = new Date().getFullYear(),
): RiepilogoAssembleeAdmin {
  let prossima: AssembleaAdminView | null = null;
  let minDataProssima = Infinity;
  const adessoIso = new Date().toISOString();

  let totaleAnno = 0;
  let votazioniAperte = 0;
  let totaleBozze = 0;
  let totaleConcluse = 0;

  for (const a of assemblee) {
    const dataObj = new Date(a.data);
    const anno = isNaN(dataObj.getFullYear()) ? 0 : dataObj.getFullYear();

    if (anno === annoRiferimento) {
      totaleAnno += 1;
    }

    if (a.stato === 'BOZZA') {
      totaleBozze += 1;
    } else if (a.stato === 'CONCLUSA') {
      totaleConcluse += 1;
    }

    // Punti con votazione aperta
    if (a.puntiOdg) {
      for (const p of a.puntiOdg) {
        if (p.votazioneAperta) {
          votazioniAperte += 1;
        }
      }
    } else if (a.votazioniAperte) {
      votazioniAperte += a.votazioniAperte;
    }

    // Prossima assemblea convocata futura
    if (a.stato === 'CONVOCATA' || a.stato === 'IN_CORSO') {
      const ms = dataObj.getTime();
      if (!isNaN(ms) && ms >= new Date(adessoIso).getTime() - 24 * 3600 * 1000) {
        if (ms < minDataProssima) {
          minDataProssima = ms;
          prossima = a;
        }
      }
    }
  }

  // Fallback se nessuna assemblea futura: prendi la prima CONVOCATA o IN_CORSO più recente
  if (!prossima) {
    prossima = assemblee.find((a) => a.stato === 'IN_CORSO' || a.stato === 'CONVOCATA') ?? null;
  }

  return {
    prossimaAssemblea: prossima,
    totaleAnno,
    votazioniAperte,
    totaleBozze,
    totaleConcluse,
  };
}

/**
 * Filtra e ordina le assemblee per la schermata amministratore.
 */
export function filtraAssembleeAdmin(
  assemblee: readonly AssembleaAdminView[],
  filtri: FiltriAssembleeAdmin,
): AssembleaAdminView[] {
  const query = filtri.ricerca.trim().toLowerCase();

  return assemblee.filter((a) => {
    // Filtro stato
    if (filtri.stato === 'convocate' && a.stato !== 'CONVOCATA') return false;
    if (filtri.stato === 'in_corso' && a.stato !== 'IN_CORSO') return false;
    if (filtri.stato === 'concluse' && a.stato !== 'CONCLUSA') return false;
    if (filtri.stato === 'bozze' && a.stato !== 'BOZZA') return false;

    // Filtro ricerca
    if (query) {
      const matchTipo = a.tipo.toLowerCase().includes(query);
      const matchLuogo = a.luogo ? a.luogo.toLowerCase().includes(query) : false;
      const matchStato = a.stato.toLowerCase().includes(query);
      const matchPunti = a.puntiOdg
        ? a.puntiOdg.some((p) => p.titoloPunto.toLowerCase().includes(query))
        : false;

      if (!matchTipo && !matchLuogo && !matchStato && !matchPunti) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Valida i dati di una nuova assemblea o convocazione.
 */
export function validaNuovaAssemblea(input: {
  tipo?: string;
  dataPrimaConvocazione?: string;
  dataSecondaConvocazione?: string;
  modalita?: string;
  luogo?: string;
  linkMeet?: string;
  tabellaMillesimaleId?: string;
}): { valido: boolean; errori: Record<string, string> } {
  const errori: Record<string, string> = {};

  if (!input.tipo || (input.tipo !== 'ORDINARIA' && input.tipo !== 'STRAORDINARIA')) {
    errori.tipo = 'Seleziona il tipo di assemblea (Ordinaria o Straordinaria).';
  }

  if (!input.dataPrimaConvocazione || input.dataPrimaConvocazione.trim().length === 0) {
    errori.dataPrimaConvocazione = 'Inserisci la data e l’ora della 1ª convocazione.';
  }

  if (!input.dataSecondaConvocazione || input.dataSecondaConvocazione.trim().length === 0) {
    errori.dataSecondaConvocazione = 'Inserisci la data e l’ora della 2ª convocazione.';
  } else if (input.dataPrimaConvocazione && input.dataPrimaConvocazione.trim().length > 0) {
    const t1 = new Date(input.dataPrimaConvocazione).getTime();
    const t2 = new Date(input.dataSecondaConvocazione).getTime();
    if (!Number.isNaN(t1) && !Number.isNaN(t2) && t2 <= t1) {
      errori.dataSecondaConvocazione = 'La 2ª convocazione deve essere successiva alla 1ª convocazione.';
    }
  }

  if (input.modalita === 'ONLINE' || input.modalita === 'IBRIDA') {
    if (!input.linkMeet || !input.linkMeet.startsWith('https://')) {
      errori.linkMeet = 'Inserisci un link video valido (es. https://meet.google.com/...).';
    }
  }

  if (input.modalita === 'PRESENZA' || input.modalita === 'IBRIDA') {
    if (!input.luogo || input.luogo.trim().length < 3) {
      errori.luogo = 'Inserisci il luogo di svolgimento della riunione.';
    }
  }

  return {
    valido: Object.keys(errori).length === 0,
    errori,
  };
}

/**
 * Helper per etichette e badge di stato assemblea.
 */
export function badgeStatoAssembleaAdmin(stato: StatoAssembleaAdmin): {
  label: string;
  status: BadgeStatus;
} {
  switch (stato) {
    case 'BOZZA':
      return { label: 'Bozza', status: 'neutral' };
    case 'CONVOCATA':
      return { label: 'Convocata', status: 'info' };
    case 'IN_CORSO':
      return { label: 'In corso', status: 'warning' };
    case 'CONCLUSA':
      return { label: 'Conclusa', status: 'success' };
    case 'ANNULLATA':
      return { label: 'Annullata', status: 'error' };
    default:
      return { label: stato, status: 'neutral' };
  }
}
