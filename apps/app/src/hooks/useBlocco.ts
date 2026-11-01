import { useCallback, useEffect, useRef, useState } from 'react';

export type Blocco<T> = { stato: 'caricamento' } | { stato: 'errore' } | { stato: 'pronto'; dati: T };

export interface BloccoCaricato<T> {
  blocco: Blocco<T>;
  /** Ricarica solo questo blocco: gli altri non si muovono. */
  ricarica: () => void;
}

/**
 * Carica i dati di un blocco di pagina con i suoi tre stati (sez. 19): caricamento, errore e pronto.
 * Si ricarica quando cambia `chiave` (es. utente e condominio scelti) e scarta le risposte arrivate in
 * ritardo, di una chiave che non è più quella attuale. Con `attivo` falso non carica nulla.
 * Nessun dato dell'utente finisce nei log: in caso d'errore il blocco mostra solo il suo stato.
 */
export function useBlocco<T>(carica: () => Promise<T>, chiave: string, attivo = true): BloccoCaricato<T> {
  const [blocco, setBlocco] = useState<Blocco<T>>({ stato: 'caricamento' });
  const [tentativo, setTentativo] = useState(0);
  const caricaCorrente = useRef(carica);
  caricaCorrente.current = carica;

  useEffect(() => {
    if (!attivo) return undefined;
    let valido = true;
    setBlocco({ stato: 'caricamento' });
    caricaCorrente
      .current()
      .then((dati) => {
        if (valido) setBlocco({ stato: 'pronto', dati });
      })
      .catch(() => {
        if (valido) setBlocco({ stato: 'errore' });
      });
    return () => {
      valido = false;
    };
  }, [chiave, tentativo, attivo]);

  const ricarica = useCallback(() => setTentativo((n) => n + 1), []);
  return { blocco, ricarica };
}
