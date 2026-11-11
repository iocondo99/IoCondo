/**
 * Logica pura delle notifiche in-app: dove porta una notifica e quante se ne mostrano nel pannello.
 * File puro (nessuna dipendenza da Expo o Supabase): si testa con `node --test`.
 */
import type { Vista } from './profiloLogic.ts';

/** Quante notifiche non lette mostra al massimo il pannello della campanella. */
export const NOTIFICHE_MASSIMO_PANNELLO = 10;

/** Pagina che elenca tutte le notifiche dell'utente (uguale per ogni ruolo). */
export const PERCORSO_NOTIFICHE = '/notifiche';

/** I soli campi della riga `notifiche` che servono per decidere la destinazione. */
export interface RiferimentoNotifica {
  tipo: string | null;
  riferimento_tabella: string | null;
  riferimento_id: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idValido(id: string | null): id is string {
  return id !== null && UUID.test(id);
}

/**
 * Percorso della pagina o del dettaglio a cui porta la notifica, in base a cosa l'ha generata e alla vista di chi la legge.
 * `null` se la notifica non punta a nulla di preciso (resta solo la segnatura come letta o modale interna).
 */
export function destinazioneNotifica(notifica: RiferimentoNotifica, vista: Vista): string | null {
  const admin = vista === 'ADMIN';
  if (vista === 'SUPER_ADMIN') return null;

  const tabella = (notifica.riferimento_tabella ?? '').toLowerCase();
  const tipo = (notifica.tipo ?? '').toUpperCase();
  const id = idValido(notifica.riferimento_id) ? notifica.riferimento_id : null;

  if (tabella === 'bacheca_post' || tipo === 'BACHECA' || tipo === 'COMUNICAZIONE') {
    if (admin) return id ? `/admin/comunicazioni?dettaglioId=${id}` : '/admin/comunicazioni';
    return id ? `/comunicazioni/${id}` : '/comunicazioni';
  }
  if (tabella === 'assemblee' || tipo === 'ASSEMBLEA') {
    if (admin) return id ? `/admin/assemblee/${id}` : '/admin/assemblee';
    return id ? `/assemblee/${id}` : '/assemblee';
  }
  if (tabella === 'segnalazioni' || tipo === 'SEGNALAZIONE' || tipo === 'TICKET') {
    if (admin) return id ? `/admin/manutenzione?dettaglioId=${id}` : '/admin/manutenzione';
    return id ? `/segnalazioni/${id}` : '/segnalazioni';
  }
  if (tabella === 'documenti' || tipo === 'DOCUMENTO') {
    if (admin) return id ? `/admin/documenti?dettaglioId=${id}` : '/admin/documenti';
    return id ? `/documenti/${id}` : '/documenti';
  }
  if (tabella === 'rate_dettaglio' || tipo === 'PAGAMENTO' || tipo === 'RATA') {
    if (admin) return id ? `/admin/contabilita?tab=bollettini&dettaglioId=${id}` : '/admin/contabilita';
    return id ? `/pagamenti/${id}` : '/pagamenti';
  }
  if (tabella === 'spese' || tipo === 'SPESA') {
    if (admin) return id ? `/admin/contabilita?tab=registro&dettaglioId=${id}` : '/admin/contabilita';
    return id ? `/spese/${id}` : '/spese';
  }
  if (tipo === 'INVITO') return admin ? '/admin/inviti' : '/home';
  if (tipo === 'PORTINERIA_PACCO' || tabella === 'pacchi') return admin ? null : '/home';
  return null;
}

/** Notifiche non lette da mostrare nel pannello (al massimo `massimo`) e quante restano fuori. */
export function ripartisciPerPannello<T extends { letta: boolean }>(
  righe: readonly T[],
  massimo: number = NOTIFICHE_MASSIMO_PANNELLO,
): { visibili: T[]; nascoste: number } {
  const nonLette = righe.filter((r) => !r.letta);
  return { visibili: nonLette.slice(0, massimo), nascoste: Math.max(0, nonLette.length - massimo) };
}
