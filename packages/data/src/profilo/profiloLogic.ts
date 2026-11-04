/**
 * Ruoli, condomini e viste di un utente: logica pura, senza Supabase né React (si testa con `node --test`).
 *
 * Scelta di semplicità per chi ha più ruoli (UC-07): le voci del condòmino e del portiere stanno nella
 * stessa navigazione (vista RESIDENTE); amministratore e condòmino restano viste separate, scelte con un
 * selettore nell'header. Il super amministratore (flag `utenti.is_superadmin`) è una vista a sé.
 */
import type { RuoloCodice } from '@iocondo/shared-types';

export type Vista = 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENTE';

export interface CondominioBreve {
  id: string;
  nome: string;
  indirizzo: string | null;
  citta: string | null;
}

export interface Assegnazione {
  ruolo: RuoloCodice;
  condominioId: string;
}

export interface ProfiloUtente {
  id: string;
  email: string | null;
  nome: string | null;
  telefono: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  condomini: CondominioBreve[];
  assegnazioni: Assegnazione[];
}

/** Una riga di `utente_entita_ruolo` già unita al codice del ruolo. */
export interface RigaRuolo {
  ruolo: RuoloCodice;
  condominioId: string | null;
  unitaId: string | null;
}

/**
 * Da righe di ruolo ad assegnazioni "ruolo in condominio". Un ruolo legato solo a un'unità prende il
 * condominio dell'unità; chi è `admin_id` di un condominio ne è amministratore anche senza riga di ruolo.
 * Righe senza condominio risolvibile vengono scartate; i doppioni no.
 */
export function risolviAssegnazioni(
  righe: readonly RigaRuolo[],
  condominioDiUnita: Readonly<Record<string, string>>,
  condominiAmministrati: readonly string[],
): Assegnazione[] {
  const visti = new Set<string>();
  const risultato: Assegnazione[] = [];
  const aggiungi = (ruolo: RuoloCodice, condominioId: string | null | undefined) => {
    if (!condominioId) return;
    const chiave = `${ruolo}:${condominioId}`;
    if (visti.has(chiave)) return;
    visti.add(chiave);
    risultato.push({ ruolo, condominioId });
  };
  for (const riga of righe) {
    aggiungi(riga.ruolo, riga.condominioId ?? (riga.unitaId ? condominioDiUnita[riga.unitaId] : null));
  }
  for (const id of condominiAmministrati) aggiungi('ADMIN', id);
  return risultato;
}

export function ruoliIn(profilo: ProfiloUtente, condominioId: string | null): Set<RuoloCodice> {
  const ruoli = new Set<RuoloCodice>();
  if (!condominioId) return ruoli;
  for (const a of profilo.assegnazioni) if (a.condominioId === condominioId) ruoli.add(a.ruolo);
  return ruoli;
}

/** Nessun accesso: non è super amministratore e non ha alcun condominio. */
export function senzaRuoli(profilo: ProfiloUtente): boolean {
  return !profilo.isSuperAdmin && profilo.condomini.length === 0;
}

/** Viste disponibili nel condominio scelto, nell'ordine in cui si propongono. */
export function vistePossibili(profilo: ProfiloUtente, condominioId: string | null): Vista[] {
  const ruoli = ruoliIn(profilo, condominioId);
  const viste: Vista[] = [];
  if (ruoli.has('ADMIN')) viste.push('ADMIN');
  if (ruoli.has('CONDOMINO') || ruoli.has('PORTIERE')) viste.push('RESIDENTE');
  if (profilo.isSuperAdmin) viste.push('SUPER_ADMIN');
  return viste;
}

/** Condominio da usare: quello preferito se l'utente lo vede ancora, altrimenti il primo per nome. */
export function scegliCondominio(profilo: ProfiloUtente, preferito?: string | null): string | null {
  if (preferito && profilo.condomini.some((c) => c.id === preferito)) return preferito;
  return profilo.condomini[0]?.id ?? null;
}

/** Vista da usare: la preferita se è ancora disponibile, altrimenti la prima della lista. */
export function scegliVista(
  profilo: ProfiloUtente,
  condominioId: string | null,
  preferita?: Vista | null,
): Vista | null {
  const disponibili = vistePossibili(profilo, condominioId);
  if (preferita && disponibili.includes(preferita)) return preferita;
  return disponibili[0] ?? null;
}

/** Nome della vista, come lo vede l'utente (anche sotto il suo nome nell'header). */
export function etichettaVista(vista: Vista, ruoli: ReadonlySet<RuoloCodice>): string {
  if (vista === 'SUPER_ADMIN') return 'Super amministratore';
  if (vista === 'ADMIN') return 'Amministratore';
  const condomino = ruoli.has('CONDOMINO');
  const portiere = ruoli.has('PORTIERE');
  if (condomino && portiere) return 'Condòmino e portiere';
  return portiere ? 'Portiere' : 'Condòmino';
}

/** Pagina iniziale di ogni vista: `/` porta qui. */
export function homeDi(vista: Vista): string {
  if (vista === 'SUPER_ADMIN') return '/superadmin/amministratori';
  if (vista === 'ADMIN') return '/admin/dashboard';
  return '/home';
}

/** Iniziali per l'avatar quando manca la foto: dal nome, altrimenti dall'email. */
export function nomeVisibile(profilo: Pick<ProfiloUtente, 'nome' | 'email'>): string {
  return profilo.nome?.trim() || profilo.email || 'Utente';
}
