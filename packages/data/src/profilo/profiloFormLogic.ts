/**
 * Logica pura di validazione e preferenze dell'account utente.
 * File puro (nessuna dipendenza da Expo, React o Supabase), testato con `node --test`.
 */

export interface PreferenzeNotifiche {
  email: boolean;
  bacheca: boolean;
  scadenzeRate: boolean;
}

export const PREFERENZE_NOTIFICHE_DEFAULT: PreferenzeNotifiche = {
  email: true,
  bacheca: true,
  scadenzeRate: true,
};

export const CHIAVE_PREFERENZE = 'iocondo.preferenze.v1';

export function validaNomeCognome(valore: string): string | undefined {
  const testo = valore.trim();
  if (testo === '') return 'Inserisci nome e cognome.';
  if (testo.length < 2) return 'Il nome deve contenere almeno 2 caratteri.';
  if (testo.length > 100) return 'Il nome non può superare 100 caratteri.';
  return undefined;
}

const TELEFONO_PATTERN = /^\+?[0-9\s.\-()]{6,25}$/;

export function validaTelefono(valore: string | null | undefined): string | undefined {
  if (!valore) return undefined;
  const testo = valore.trim();
  if (testo === '') return undefined;
  const cifre = testo.replace(/\D/g, '');
  if (cifre.length < 6) return 'Il numero di telefono deve contenere almeno 6 cifre.';
  if (cifre.length > 18) return 'Il numero di telefono è troppo lungo.';
  if (!TELEFONO_PATTERN.test(testo)) {
    return 'Inserisci un numero di telefono valido (es. +39 06 1234567).';
  }
  return undefined;
}

export function normalizzaPreferenzeNotifiche(raw: unknown): PreferenzeNotifiche {
  if (!raw || typeof raw !== 'object') return PREFERENZE_NOTIFICHE_DEFAULT;
  const r = raw as Record<string, unknown>;
  return {
    email: typeof r.email === 'boolean' ? r.email : PREFERENZE_NOTIFICHE_DEFAULT.email,
    bacheca: typeof r.bacheca === 'boolean' ? r.bacheca : PREFERENZE_NOTIFICHE_DEFAULT.bacheca,
    scadenzeRate: typeof r.scadenzeRate === 'boolean' ? r.scadenzeRate : PREFERENZE_NOTIFICHE_DEFAULT.scadenzeRate,
  };
}

