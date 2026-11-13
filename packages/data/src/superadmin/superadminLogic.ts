/**
 * Logica pura per il modulo Super Amministratore (`SUPER_ADMIN`).
 * Nessuna dipendenza da Supabase o React: testabile con `node --test`.
 */

export type StatoLicenzaSaas = 'ATTIVA' | 'SCADUTA' | 'ASSENTE';

export type FiltroAmministratori = 'tutti' | 'attivi' | 'sospesi';

export interface CondominioSuperAdmin {
  id: string;
  adminId: string;
  nome: string;
  indirizzo: string | null;
  citta: string | null;
  attivo: boolean;
  numeroPalazzi: number;
  numeroUnita: number;
}

export interface LicenzaSuperAdmin {
  id: string;
  pianoId: string;
  pianoNome: string;
  isActive: boolean;
  dataScadenza: string | null;
  stato: StatoLicenzaSaas;
}

export interface AmministratoreConCondomini {
  id: string;
  email: string | null;
  nomeCognome: string | null;
  telefono: string | null;
  createdAt: string;
  licenza: LicenzaSuperAdmin | null;
  condomini: CondominioSuperAdmin[];
}

export interface KpiPiattaforma {
  totaleCondomini: number;
  condominiAttivi: number;
  condominiSospesi: number;
  totaleAmministratori: number;
  amministratoriLicenzaAttiva: number;
  amministratoriLicenzaScaduta: number;
  totaleUnita: number;
}

export interface PianoUnicoView {
  id: string;
  nome: string;
  prezzoMensile: number;
  limiteUnita: number | null;
  note: string;
  featureAttive: string[];
  updatedAt: string;
}

export interface FatturaSaasView {
  id: string;
  adminId: string;
  adminNome: string;
  adminEmail: string | null;
  importo: number;
  urlPdf: string | null;
  dataEmissione: string;
}

export const NOME_PIANO_UNICO_DEFAULT = 'Piano Unico Piattaforma';

export const FEATURE_PIANO_UNICO: ReadonlyArray<{ key: string; label: string; descrizione: string }> = [
  { key: 'contabilita', label: 'Contabilità e Bilanci', descrizione: 'Preventivi, rate, incassi, morosità e rendiconto' },
  { key: 'assemblee', label: 'Assemblee e Votazioni', descrizione: 'Convocazioni, presenze, deleghe e verbali' },
  { key: 'ticket', label: 'Manutenzione e Ticket', descrizione: 'Segnalazioni guasti, fornitori e Magic Link' },
  { key: 'bacheca', label: 'Comunicazioni e Bacheca', descrizione: 'Avvisi condominiali con notifiche mirate' },
  { key: 'spazi_comuni', label: 'Spazi Comuni', descrizione: 'Prenotazione sale e aree condivise' },
  { key: 'differenziata', label: 'Raccolta Differenziata', descrizione: 'Calendario conferimenti per condòmini e portieri' },
  { key: 'documenti', label: 'Drive Documentale', descrizione: 'Archivio sicuro con permessi e link firmati' },
  { key: 'pacchi', label: 'Registro Pacchi', descrizione: 'Gestione consegne e ritiri in portineria' },
];

export function calcolaStatoLicenza(
  licenza: { is_active: boolean; data_scadenza: string | null } | null,
  oggiIso = new Date().toISOString().slice(0, 10),
): StatoLicenzaSaas {
  if (!licenza) return 'ASSENTE';
  if (!licenza.is_active) return 'SCADUTA';
  if (licenza.data_scadenza && licenza.data_scadenza < oggiIso) return 'SCADUTA';
  return 'ATTIVA';
}

export function calcolaKpiPiattaforma(
  amministratori: readonly AmministratoreConCondomini[],
  tuttiCondomini?: readonly CondominioSuperAdmin[],
): KpiPiattaforma {
  const mappaCondomini = new Map<string, CondominioSuperAdmin>();
  for (const admin of amministratori) {
    for (const c of admin.condomini) {
      mappaCondomini.set(c.id, c);
    }
  }
  if (tuttiCondomini) {
    for (const c of tuttiCondomini) {
      mappaCondomini.set(c.id, c);
    }
  }

  let condominiAttivi = 0;
  let condominiSospesi = 0;
  let totaleUnita = 0;
  for (const c of mappaCondomini.values()) {
    if (c.attivo) condominiAttivi += 1;
    else condominiSospesi += 1;
    totaleUnita += c.numeroUnita;
  }

  let amministratoriLicenzaAttiva = 0;
  let amministratoriLicenzaScaduta = 0;
  for (const a of amministratori) {
    if (a.licenza?.stato === 'ATTIVA') amministratoriLicenzaAttiva += 1;
    else amministratoriLicenzaScaduta += 1;
  }

  return {
    totaleCondomini: mappaCondomini.size,
    condominiAttivi,
    condominiSospesi,
    totaleAmministratori: amministratori.length,
    amministratoriLicenzaAttiva,
    amministratoriLicenzaScaduta,
    totaleUnita,
  };
}

export function filtraAmministratori(
  lista: readonly AmministratoreConCondomini[],
  query: string,
  filtro: FiltroAmministratori,
): AmministratoreConCondomini[] {
  const q = query.trim().toLowerCase();
  return lista.filter((admin) => {
    if (filtro === 'attivi') {
      const haAttivi = admin.condomini.some((c) => c.attivo);
      if (!haAttivi && admin.licenza?.stato !== 'ATTIVA') return false;
    } else if (filtro === 'sospesi') {
      const haSospesi = admin.condomini.some((c) => !c.attivo);
      if (!haSospesi) return false;
    }

    if (!q) return true;
    const matchAdmin =
      (admin.nomeCognome ?? '').toLowerCase().includes(q) ||
      (admin.email ?? '').toLowerCase().includes(q);
    const matchCondominio = admin.condomini.some(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.indirizzo ?? '').toLowerCase().includes(q) ||
        (c.citta ?? '').toLowerCase().includes(q),
    );
    return matchAdmin || matchCondominio;
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validaInvitoAmministratore(
  email: string,
  nomeCognome: string,
): { email?: string; nomeCognome?: string } | null {
  const errori: { email?: string; nomeCognome?: string } = {};
  const emailPulita = email.trim().toLowerCase();
  const nomePulito = nomeCognome.trim();

  if (!emailPulita) {
    errori.email = "Inserisci l'indirizzo email dell'amministratore.";
  } else if (!EMAIL_RE.test(emailPulita)) {
    errori.email = 'Inserisci un indirizzo email valido.';
  }

  if (nomePulito.length < 2) {
    errori.nomeCognome = 'Inserisci nome e cognome (almeno 2 caratteri).';
  }

  return Object.keys(errori).length > 0 ? errori : null;
}

export function validaPianoUnico(
  prezzoMensile: string | number,
  nome: string,
): { prezzoMensile?: string; nome?: string } | null {
  const errori: { prezzoMensile?: string; nome?: string } = {};
  const num =
    typeof prezzoMensile === 'number'
      ? prezzoMensile
      : Number(String(prezzoMensile).replace(',', '.').trim());

  if (!Number.isFinite(num) || num < 0) {
    errori.prezzoMensile = 'Inserisci un canone mensile valido (>= 0 €).';
  }
  if (nome.trim().length < 3) {
    errori.nome = 'Il nome del piano deve contenere almeno 3 caratteri.';
  }
  return Object.keys(errori).length > 0 ? errori : null;
}

export function calcolaNuovaScadenzaLicenza(
  dataAttuale: string | null,
  mesi: number,
  oggi = new Date(),
): string {
  const baseStr =
    dataAttuale && dataAttuale >= oggi.toISOString().slice(0, 10)
      ? dataAttuale
      : oggi.toISOString().slice(0, 10);
  const [y, m, d] = baseStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y || oggi.getUTCFullYear(), (m || 1) - 1 + mesi, d || 1));
  return dt.toISOString().slice(0, 10);
}

export function formattaEuroSaas(importo: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(importo);
}
