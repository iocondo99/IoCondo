/**
 * Catalogo moduli e feature toggles del condominio (UC-05).
 * I moduli nativi sono già presenti su Supabase reale in configurazioni_condominio.
 * I moduli estesi richiedono la migrazione 11 (supabase/da-applicare/11_moduli_condominio_estesi.sql).
 * File puro: si testa con `node --test`.
 */

export type ModuloChiave =
  | 'abilita_social'
  | 'abilita_chat'
  | 'abilita_bacheca'
  | 'abilita_ticket'
  | 'abilita_prenotazioni'
  | 'abilita_pacchi'
  | 'abilita_spese'
  | 'abilita_pagamenti'
  | 'abilita_documenti'
  | 'abilita_assemblee'
  | 'abilita_raccolta_differenziata';

export type RuoloDestinatario = 'CONDOMINO' | 'PORTIERE';

export interface ModuloInfo {
  chiave: ModuloChiave;
  titolo: string;
  descrizione: string;
  destinatari: readonly RuoloDestinatario[];
  rottaResidente: string;
  richiedeMigrazione11: boolean;
  critico?: boolean;
}

export interface ModuliAttivi {
  abilita_social: boolean;
  abilita_chat: boolean;
  abilita_bacheca: boolean;
  abilita_ticket: boolean;
  abilita_prenotazioni: boolean;
  abilita_pacchi: boolean;
  abilita_spese: boolean;
  abilita_pagamenti: boolean;
  abilita_documenti: boolean;
  abilita_assemblee: boolean;
  abilita_raccolta_differenziata: boolean;
}

export const DEFAULT_MODULI_ATTIVI: ModuliAttivi = {
  abilita_social: true,
  abilita_chat: true,
  abilita_bacheca: true,
  abilita_ticket: true,
  abilita_prenotazioni: true,
  abilita_pacchi: true,
  abilita_spese: true,
  abilita_pagamenti: true,
  abilita_documenti: true,
  abilita_assemblee: true,
  abilita_raccolta_differenziata: true,
};

export const CATALOGO_MODULI: readonly ModuloInfo[] = [
  {
    chiave: 'abilita_bacheca',
    titolo: 'Bacheca condominiale',
    descrizione: 'Consente ai residenti di leggere comunicazioni ufficiali e avvisi dell’amministratore.',
    destinatari: ['CONDOMINO', 'PORTIERE'],
    rottaResidente: '/comunicazioni',
    richiedeMigrazione11: false,
    critico: true,
  },
  {
    chiave: 'abilita_chat',
    titolo: 'Chat e messaggi',
    descrizione: 'Abilita lo scambio di messaggi e le comunicazioni bidirezionali con i residenti.',
    destinatari: ['CONDOMINO', 'PORTIERE'],
    rottaResidente: '/comunicazioni',
    richiedeMigrazione11: false,
  },
  {
    chiave: 'abilita_ticket',
    titolo: 'Segnalazioni e ticket guasti',
    descrizione: 'Consente ai condòmini di aprire segnalazioni e al portiere di gestire i ticket aree comuni.',
    destinatari: ['CONDOMINO', 'PORTIERE'],
    rottaResidente: '/segnalazioni',
    richiedeMigrazione11: false,
    critico: true,
  },
  {
    chiave: 'abilita_prenotazioni',
    titolo: 'Prenotazione spazi comuni',
    descrizione: 'Permette a condòmini e portiere di consultare e prenotare aree comuni, lavanderie e sale.',
    destinatari: ['CONDOMINO', 'PORTIERE'],
    rottaResidente: '/prenotazioni',
    richiedeMigrazione11: false,
  },
  {
    chiave: 'abilita_pacchi',
    titolo: 'Registro pacchi in portineria',
    descrizione: 'Permette al portiere di registrare le consegne e ai residenti di verificare le giacenze.',
    destinatari: ['PORTIERE'],
    rottaResidente: '/pacchi',
    richiedeMigrazione11: false,
  },
  {
    chiave: 'abilita_social',
    titolo: 'Funzionalità social e sondaggi',
    descrizione: 'Abilita la partecipazione a sondaggi consultivi e discussioni tra vicini.',
    destinatari: ['CONDOMINO'],
    rottaResidente: '/comunicazioni',
    richiedeMigrazione11: false,
  },
  {
    chiave: 'abilita_spese',
    titolo: 'Spese ed esercizi',
    descrizione: 'Permette ai condòmini di consultare preventivi, consuntivi approvati e movimenti di spesa.',
    destinatari: ['CONDOMINO'],
    rottaResidente: '/spese',
    richiedeMigrazione11: true,
    critico: true,
  },
  {
    chiave: 'abilita_pagamenti',
    titolo: 'Pagamenti e rate',
    descrizione: 'Mostra ai condòmini lo stato delle rate, le scadenze e i bollettini di pagamento.',
    destinatari: ['CONDOMINO'],
    rottaResidente: '/pagamenti',
    richiedeMigrazione11: true,
    critico: true,
  },
  {
    chiave: 'abilita_documenti',
    titolo: 'Documenti e archivio',
    descrizione: 'Consente ai residenti di accedere a verbali di assemblea, contratti, polizze e regolamento.',
    destinatari: ['CONDOMINO', 'PORTIERE'],
    rottaResidente: '/documenti',
    richiedeMigrazione11: true,
  },
  {
    chiave: 'abilita_assemblee',
    titolo: 'Assemblee condominiali',
    descrizione: 'Permette ai condòmini di visionare convocazioni, ordini del giorno ed esprimere il voto.',
    destinatari: ['CONDOMINO'],
    rottaResidente: '/assemblee',
    richiedeMigrazione11: true,
  },
  {
    chiave: 'abilita_raccolta_differenziata',
    titolo: 'Raccolta differenziata',
    descrizione: 'Mostra a condòmini e portiere il calendario ecologico e i giorni di esposizione dei rifiuti.',
    destinatari: ['CONDOMINO', 'PORTIERE'],
    rottaResidente: '/raccolta-differenziata',
    richiedeMigrazione11: true,
  },
];

export const CHIAVI_NATIVE_DB: ReadonlySet<ModuloChiave> = new Set([
  'abilita_social',
  'abilita_chat',
  'abilita_bacheca',
  'abilita_ticket',
  'abilita_prenotazioni',
  'abilita_pacchi',
]);

export function isModuloNativo(chiave: ModuloChiave): boolean {
  return CHIAVI_NATIVE_DB.has(chiave);
}

export function infoModulo(chiave: ModuloChiave): ModuloInfo | undefined {
  return CATALOGO_MODULI.find((m) => m.chiave === chiave);
}

export function moduloDiRotta(rotta: string): ModuloInfo | undefined {
  const pulita = rotta.split('?')[0] ?? rotta;
  return CATALOGO_MODULI.find(
    (m) => pulita === m.rottaResidente || pulita.startsWith(`${m.rottaResidente}/`),
  );
}

export function moduloAbilitato(moduli: ModuliAttivi, chiave: ModuloChiave): boolean {
  return moduli[chiave] !== false;
}
