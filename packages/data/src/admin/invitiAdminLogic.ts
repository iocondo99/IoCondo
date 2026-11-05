/**
 * Logica pura per la gestione degli inviti residenti e portieri lato Amministratore (UC-07).
 * Nessuna dipendenza da Supabase né React, testabile direttamente con `node --test`.
 */

export type StatoInvitoAdmin = 'IN_ATTESA' | 'ACCETTATO' | 'SCADUTO';
export type RuoloInvitabileAdmin = 'CONDOMINO' | 'PORTIERE' | 'ADMIN';

export interface UnitaInfoRaw {
  id: string;
  interno: string;
  piano?: number | null;
  palazzo?: {
    id: string;
    nome_identificativo: string;
  } | null;
}

export interface InvitoPendenteRaw {
  token: string;
  email: string;
  ruolo_proposto: string;
  flag_portiere: boolean;
  condominio_id: string;
  unita_id: string | null;
  scadenza: string;
  accettato_at: string | null;
  ruoli_piattaforma?: {
    id: string;
    codice: string;
  } | null;
  unita_immobiliari?: {
    id: string;
    interno: string;
    piano: number | null;
    palazzi?: {
      id: string;
      nome_identificativo: string;
    } | null;
  } | null;
}

export interface RigaInvitoAdminView {
  token: string;
  email: string;
  ruoloCodice: RuoloInvitabileAdmin;
  flagPortiere: boolean;
  ruoloEtichetta: string;
  unitaId: string | null;
  unitaEtichetta: string;
  palazzoNome: string | null;
  interno: string | null;
  dataInvio: string; // ISO stimata o formattata
  dataInvioTesto: string; // DD/MM/YYYY
  scadenza: string; // ISO
  accettatoAt: string | null; // ISO
  stato: StatoInvitoAdmin;
  statoBadge: 'in-attesa' | 'accettato' | 'scaduto';
  scadenzaRelativa: string;
}

export interface FiltriInvitiAdmin {
  stato: string; // 'tutti' | 'IN_ATTESA' | 'ACCETTATO' | 'SCADUTO' (o minuscolo)
  ricerca: string;
}

export interface StatisticheInvitiAdmin {
  inAttesa: number;
  accettatiMese: number;
  scaduti: number;
}

/**
 * Standard RFC 5322 semplificato per la validazione di indirizzi email.
 * Verifica sintassi corretta con username, @, dominio e TLD valido.
 */
const RFC_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isEmailValida(email: string | null | undefined): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return RFC_EMAIL_REGEX.test(trimmed);
}

/**
 * Calcolo dello stato dell'invito:
 * - 'ACCETTATO' se `accettato_at` è valorizzato;
 * - 'IN_ATTESA' se `accettato_at` è nullo e `scadenza > now()`;
 * - 'SCADUTO' se `scadenza <= now()`.
 */
export function calcolaStatoInvito(
  invito: { scadenza: string; accettatoAt?: string | null },
  adesso: Date = new Date(),
): StatoInvitoAdmin {
  if (invito.accettatoAt && invito.accettatoAt.trim() !== '') {
    return 'ACCETTATO';
  }
  const scadenzaMs = new Date(invito.scadenza).getTime();
  const adessoMs = adesso.getTime();
  if (scadenzaMs > adessoMs) {
    return 'IN_ATTESA';
  }
  return 'SCADUTO';
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Formatta una data ISO in formato italiano "DD/MM/YYYY".
 */
export function formattaDataItaliana(dataIso: string | Date): string {
  const d = typeof dataIso === 'string' ? new Date(dataIso) : dataIso;
  if (isNaN(d.getTime())) return '—';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Formattazione date relative:
 * - Se accettato: "Accettato il DD/MM/YYYY"
 * - Se in attesa: "Scade oggi", "Scade domani", "Scade tra N giorni"
 * - Se scaduto: "Scaduto oggi", "Scaduto ieri", "Scaduto da N giorni"
 */
export function formattaDataRelativaInvito(
  invito: { scadenza: string; accettatoAt?: string | null },
  adesso: Date = new Date(),
): string {
  if (invito.accettatoAt && invito.accettatoAt.trim() !== '') {
    return `Accettato il ${formattaDataItaliana(invito.accettatoAt)}`;
  }

  const dScad = new Date(invito.scadenza);
  if (isNaN(dScad.getTime())) return '—';

  const diffMs = dScad.getTime() - adesso.getTime();

  if (diffMs > 0) {
    const diffGiorni = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffGiorni <= 0) return 'Scade oggi';
    if (diffGiorni === 1) return 'Scade domani';
    return `Scade tra ${diffGiorni} giorni`;
  } else {
    const diffAssolutoMs = Math.abs(diffMs);
    const diffGiorniPassati = Math.floor(diffAssolutoMs / (1000 * 60 * 60 * 24));
    if (diffGiorniPassati === 0) return 'Scaduto oggi';
    if (diffGiorniPassati === 1) return 'Scaduto ieri';
    return `Scaduto da ${diffGiorniPassati} giorni`;
  }
}

/**
 * La tabella `inviti_pendenti` non ha una colonna `created_at`.
 * Come da architettura, un invito dura 7 giorni: la data di invio (o rinnovo) è `scadenza - 7 giorni`.
 */
export function calcolaDataInvioStimata(scadenzaIso: string): { dataIso: string; dataTesto: string } {
  const d = new Date(scadenzaIso);
  if (isNaN(d.getTime())) {
    return { dataIso: '', dataTesto: '—' };
  }
  const invioDate = new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    dataIso: invioDate.toISOString(),
    dataTesto: formattaDataItaliana(invioDate),
  };
}

export function etichettaRuoloInvitoAdmin(ruoloCodice: string, flagPortiere: boolean): string {
  if (ruoloCodice === 'CONDOMINO') {
    return flagPortiere ? 'Condòmino e portiere' : 'Condòmino';
  }
  if (ruoloCodice === 'PORTIERE') {
    return 'Portiere';
  }
  if (ruoloCodice === 'ADMIN') {
    return 'Amministratore';
  }
  return ruoloCodice;
}

export function trasformaInvitoRawInView(
  raw: InvitoPendenteRaw,
  adesso: Date = new Date(),
): RigaInvitoAdminView {
  const ruoloCodice = (raw.ruoli_piattaforma?.codice ?? raw.ruolo_proposto) as RuoloInvitabileAdmin;
  const stato = calcolaStatoInvito({ scadenza: raw.scadenza, accettatoAt: raw.accettato_at }, adesso);
  const { dataIso, dataTesto } = calcolaDataInvioStimata(raw.scadenza);

  let unitaEtichetta = 'Personale condominiale';
  let palazzoNome: string | null = null;
  let interno: string | null = null;

  if (raw.unita_immobiliari) {
    interno = raw.unita_immobiliari.interno;
    palazzoNome = raw.unita_immobiliari.palazzi?.nome_identificativo ?? null;
    if (palazzoNome && interno) {
      unitaEtichetta = `${palazzoNome} • Int. ${interno}`;
    } else if (interno) {
      unitaEtichetta = `Interno ${interno}`;
    } else if (palazzoNome) {
      unitaEtichetta = palazzoNome;
    }
  }

  const statoBadge: 'in-attesa' | 'accettato' | 'scaduto' =
    stato === 'IN_ATTESA' ? 'in-attesa' : stato === 'ACCETTATO' ? 'accettato' : 'scaduto';

  return {
    token: raw.token,
    email: raw.email,
    ruoloCodice,
    flagPortiere: Boolean(raw.flag_portiere),
    ruoloEtichetta: etichettaRuoloInvitoAdmin(ruoloCodice, Boolean(raw.flag_portiere)),
    unitaId: raw.unita_id,
    unitaEtichetta,
    palazzoNome,
    interno,
    dataInvio: dataIso,
    dataInvioTesto: dataTesto,
    scadenza: raw.scadenza,
    accettatoAt: raw.accettato_at,
    stato,
    statoBadge,
    scadenzaRelativa: formattaDataRelativaInvito(
      { scadenza: raw.scadenza, accettatoAt: raw.accettato_at },
      adesso,
    ),
  };
}

/**
 * Filtro degli inviti per stato e ricerca testuale libera su email, unità, palazzo e ruolo.
 */
export function filtraInviti(
  inviti: readonly RigaInvitoAdminView[],
  filtri: FiltriInvitiAdmin,
): RigaInvitoAdminView[] {
  const statoNormalizzato = (filtri.stato || 'tutti').trim().toUpperCase();
  const query = (filtri.ricerca || '').trim().toLowerCase();

  return inviti.filter((invito) => {
    // Filtro per stato
    if (statoNormalizzato !== 'TUTTI') {
      if (statoNormalizzato === 'IN_ATTESA' || statoNormalizzato === 'IN-ATTESA') {
        if (invito.stato !== 'IN_ATTESA') return false;
      } else if (statoNormalizzato === 'ACCETTATI' || statoNormalizzato === 'ACCETTATO') {
        if (invito.stato !== 'ACCETTATO') return false;
      } else if (statoNormalizzato === 'SCADUTI' || statoNormalizzato === 'SCADUTO') {
        if (invito.stato !== 'SCADUTO') return false;
      }
    }

    // Filtro di ricerca testuale
    if (query) {
      const email = invito.email.toLowerCase();
      const unita = invito.unitaEtichetta.toLowerCase();
      const ruolo = invito.ruoloEtichetta.toLowerCase();
      const palazzo = (invito.palazzoNome || '').toLowerCase();
      const interno = (invito.interno || '').toLowerCase();

      const corrisponde =
        email.includes(query) ||
        unita.includes(query) ||
        ruolo.includes(query) ||
        palazzo.includes(query) ||
        interno.includes(query);

      if (!corrisponde) return false;
    }

    return true;
  });
}

/**
 * Calcola i conteggi per le 3 StatCard:
 * - "Inviti in attesa": conteggio inviti pendenti attivi
 * - "Accettati questo mese": conteggio inviti convertiti nel mese corrente di riferimento
 * - "Inviti scaduti": conteggio inviti scaduti
 */
export function calcolaStatisticheInviti(
  inviti: readonly RigaInvitoAdminView[],
  adesso: Date = new Date(),
): StatisticheInvitiAdmin {
  let inAttesa = 0;
  let accettatiMese = 0;
  let scaduti = 0;

  const annoCorrente = adesso.getFullYear();
  const meseCorrente = adesso.getMonth();

  for (const inv of inviti) {
    if (inv.stato === 'IN_ATTESA') {
      inAttesa++;
    } else if (inv.stato === 'SCADUTO') {
      scaduti++;
    } else if (inv.stato === 'ACCETTATO') {
      if (inv.accettatoAt) {
        const d = new Date(inv.accettatoAt);
        if (!isNaN(d.getTime()) && d.getFullYear() === annoCorrente && d.getMonth() === meseCorrente) {
          accettatiMese++;
        }
      } else {
        accettatiMese++;
      }
    }
  }

  return { inAttesa, accettatiMese, scaduti };
}

