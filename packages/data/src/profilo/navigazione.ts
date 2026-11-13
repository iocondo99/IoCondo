/**
 * Voci di navigazione per vista (sez. 5, 15 e 16 del design system), nello stesso ordine sempre.
 * Le voci legate a un modulo spariscono se il modulo è disattivato (UC-05, `configurazioni_condominio`).
 * File puro: si testa con `node --test`.
 */
import type { RuoloCodice, INavVoce } from '@iocondo/shared-types';
import type { Vista } from './profiloLogic';
import type { ModuliAttivi } from './moduli.ts';

export type { ModuliAttivi } from './moduli.ts';

export interface ContestoNavigazione {
  vista: Vista;
  ruoli: ReadonlySet<RuoloCodice>;
  moduli: ModuliAttivi;
}

/** Id con una etichetta più breve nella barra in basso dello smartphone. */
const ETICHETTA_BARRA: Record<string, string> = { comunicazioni: 'Messaggi' };

const voce = (id: string, label: string, icon: string, route: string): INavVoce => ({ id, label, icon, route });

const SUPER_ADMIN: readonly INavVoce[] = [
  voce('amministratori', 'Amministratori', 'user-cog', '/superadmin/amministratori'),
  voce('piani-abbonamenti', 'Piani e abbonamenti', 'layers', '/superadmin/piani-abbonamenti'),
  voce('fatture', 'Fatture', 'receipt', '/superadmin/fatture'),
  voce('impostazioni', 'Impostazioni', 'settings', '/superadmin/impostazioni'),
];

const ADMIN: readonly INavVoce[] = [
  voce('dashboard', 'Dashboard', 'layout-dashboard', '/admin/dashboard'),
  voce('struttura', 'Struttura', 'building-2', '/admin/struttura'),
  voce('inviti', 'Inviti', 'mail', '/admin/inviti'),
  voce('contabilita', 'Contabilità', 'calculator', '/admin/contabilita'),
  voce('manutenzione', 'Manutenzione', 'wrench', '/admin/manutenzione'),
  voce('comunicazioni', 'Comunicazioni', 'message-circle', '/admin/comunicazioni'),
  voce('documenti', 'Documenti', 'file-text', '/admin/documenti'),
  voce('assemblee', 'Assemblee', 'users', '/admin/assemblee'),
  voce('prenotazioni', 'Spazi comuni', 'calendar-plus', '/admin/prenotazioni'),
  voce('raccolta-differenziata', 'Raccolta differenziata', 'calendar-days', '/admin/raccolta-differenziata'),
  voce('moduli', 'Moduli e funzionalità', 'sliders-horizontal', '/admin/moduli'),
  voce('impostazioni', 'Impostazioni', 'settings', '/admin/impostazioni'),
  voce('assistenza', 'Assistenza', 'circle-help', '/admin/assistenza'),
];

/**
 * Condòmino e portiere nella stessa navigazione. Spese e Pagamenti solo a chi è condòmino (un portiere non
 * ha accesso contabile); Registro pacchi solo al portiere; Segnalazioni a entrambi; Fornitori mai.
 */
function residente({ ruoli, moduli }: ContestoNavigazione): INavVoce[] {
  const condomino = ruoli.has('CONDOMINO');
  const portiere = ruoli.has('PORTIERE');
  const voci: Array<INavVoce | false> = [
    voce('home', 'Home', 'home', '/home'),
    condomino && moduli.abilita_spese !== false && voce('spese', 'Spese', 'coins', '/spese'),
    condomino && moduli.abilita_pagamenti !== false && voce('pagamenti', 'Pagamenti', 'credit-card', '/pagamenti'),
    moduli.abilita_documenti !== false && voce('documenti', 'Documenti', 'file-text', '/documenti'),
    (moduli.abilita_bacheca || moduli.abilita_chat) && voce('comunicazioni', 'Comunicazioni', 'message-circle', '/comunicazioni'),
    moduli.abilita_assemblee !== false && voce('assemblee', 'Assemblee', 'users', '/assemblee'),
    (condomino || portiere) && moduli.abilita_prenotazioni && voce('prenotazioni', 'Spazi comuni', 'calendar-plus', '/prenotazioni'),
    moduli.abilita_raccolta_differenziata !== false && voce('raccolta-differenziata', 'Raccolta differenziata', 'calendar-days', '/raccolta-differenziata'),
    (condomino || portiere) && moduli.abilita_ticket && voce('segnalazioni', 'Segnalazioni', 'wrench', '/segnalazioni'),
    portiere && moduli.abilita_pacchi && voce('pacchi', 'Registro pacchi', 'package', '/pacchi'),
    voce('impostazioni', 'Impostazioni', 'settings', '/impostazioni'),
    voce('assistenza', 'Assistenza', 'circle-help', '/assistenza'),
  ];
  return voci.filter((v): v is INavVoce => v !== false);
}

export function vociDi(contesto: ContestoNavigazione): INavVoce[] {
  if (contesto.vista === 'SUPER_ADMIN') return [...SUPER_ADMIN];
  if (contesto.vista === 'ADMIN') return [...ADMIN];
  return residente(contesto);
}

/** Voci preferite per la barra in basso, in ordine: se una manca si passa alla successiva. */
const PRIORITA_BARRA: Record<Vista, readonly string[]> = {
  SUPER_ADMIN: [],
  ADMIN: ['dashboard', 'contabilita', 'documenti', 'comunicazioni', 'manutenzione'],
  RESIDENTE: ['home', 'spese', 'documenti', 'comunicazioni', 'pacchi', 'segnalazioni'],
};

export const VOCI_IN_BARRA = 4;

export interface NavigazioneMobile {
  /** Le voci della barra (al massimo 4: la quinta è "Altro"). */
  barra: INavVoce[];
  /** Le altre voci, raccolte in "Altro". Vuoto se le voci stanno tutte nella barra. */
  altre: INavVoce[];
}

/** Barra in basso: Home, Spese, Documenti, Messaggi e "Altro" con il resto. Con 4 voci o meno "Altro" non serve. */
export function navigazioneMobile(voci: readonly INavVoce[], vista: Vista): NavigazioneMobile {
  if (voci.length <= VOCI_IN_BARRA) return { barra: voci.map(etichettaBreve), altre: [] };
  const scelte: INavVoce[] = [];
  for (const id of PRIORITA_BARRA[vista]) {
    const trovata = voci.find((v) => v.id === id);
    if (trovata && scelte.length < VOCI_IN_BARRA) scelte.push(trovata);
  }
  for (const v of voci) if (scelte.length < VOCI_IN_BARRA && !scelte.includes(v)) scelte.push(v);
  const ordinate = voci.filter((v) => scelte.includes(v));
  return { barra: ordinate.map(etichettaBreve), altre: voci.filter((v) => !scelte.includes(v)) };
}

function etichettaBreve(v: INavVoce): INavVoce {
  const breve = ETICHETTA_BARRA[v.id];
  return breve ? { ...v, label: breve } : v;
}

/** La voce attiva è quella il cui percorso coincide con la pagina, o la contiene (pagine di dettaglio). */
export function voceAttiva(voci: readonly INavVoce[], percorso: string): INavVoce | undefined {
  const pulito = percorso.split('?')[0] ?? percorso;
  return [...voci]
    .sort((a, b) => b.route.length - a.route.length)
    .find((v) => pulito === v.route || pulito.startsWith(`${v.route}/`));
}
