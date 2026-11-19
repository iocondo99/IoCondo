import React from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const VERSIONE_APP = '1.0.0';

// Niente dati personali nel messaggio: email, numeri lunghi (IBAN, telefoni, codici) e token vengono oscurati.
function oscura(testo: string): string {
  return testo
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi, '[iban]')
    .replace(/\d{7,}/g, '[numero]')
    .slice(0, 1000);
}

function paginaCorrente(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.pathname;
  return null;
}

let inviiRecenti = 0;
let finestra = Date.now();

/**
 * Registra un errore dell'app nella tabella log_errori (script 19). Mai bloccante e con un limite
 * di 20 errori al minuto per dispositivo, oltre a quello del database (60 l'ora per utente).
 */
export async function registraErrore(params: {
  contesto?: string;
  errore: unknown;
  codice?: string;
  livello?: 'ERROR' | 'WARNING';
  condominioId?: string | null;
}): Promise<void> {
  try {
    if (Date.now() - finestra > 60_000) {
      finestra = Date.now();
      inviiRecenti = 0;
    }
    if (inviiRecenti >= 20) return;
    inviiRecenti += 1;

    const e = params.errore;
    const messaggio = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    const stack = e instanceof Error && e.stack ? oscura(e.stack.split('\n').slice(0, 6).join('\n')) : null;

    await (supabase.rpc as any)('registra_errore_app', {
      p_contesto: params.contesto ?? paginaCorrente() ?? 'sconosciuto',
      p_messaggio: oscura(messaggio),
      p_codice: params.codice ?? null,
      p_dettagli: stack ? { stack } : null,
      p_condominio: params.condominioId ?? null,
      p_versione_app: VERSIONE_APP,
      p_piattaforma: Platform.OS,
      p_livello: params.livello ?? 'ERROR',
    });
  } catch {
    // Il log non deve mai causare altri errori.
  }
}

/** Cattura gli errori non gestiti del browser (web). */
export function avviaRaccoltaErrori(): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => undefined;
  const suErrore = (ev: ErrorEvent) => void registraErrore({ errore: ev.error ?? ev.message, codice: 'NON_GESTITO' });
  const suPromessa = (ev: PromiseRejectionEvent) =>
    void registraErrore({ errore: ev.reason, codice: 'PROMESSA_RIFIUTATA' });
  window.addEventListener('error', suErrore);
  window.addEventListener('unhandledrejection', suPromessa);
  return () => {
    window.removeEventListener('error', suErrore);
    window.removeEventListener('unhandledrejection', suPromessa);
  };
}

/** Errori durante il disegno di una pagina: li registra e mostra il componente di ripiego. */
export class ConfineErrori extends React.Component<
  { children: React.ReactNode; ripiego?: React.ReactNode },
  { errore: boolean }
> {
  state = { errore: false };

  static getDerivedStateFromError() {
    return { errore: true };
  }

  componentDidCatch(errore: unknown) {
    void registraErrore({ errore, codice: 'RENDER' });
  }

  render() {
    return this.state.errore ? (this.props.ripiego ?? null) : this.props.children;
  }
}
