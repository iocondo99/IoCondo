'use client';

import { useEffect, useState } from 'react';
import { services } from '@/services';

type SubentroInput = Parameters<typeof services.struttura.subentro>[0];

export function useStabili(condominioId: string) {
  const [palazziCount, setPalazziCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    services.struttura
      .listPalazzi(condominioId)
      .then((res) => setPalazziCount(res.length))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Caricamento non riuscito'));
  }, [condominioId]);

  const registraSubentro = async (input: SubentroInput) => {
    setError(null);
    try {
      await services.struttura.subentro(input);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Subentro non riuscito');
      return false;
    }
  };

  return { palazziCount, error, registraSubentro };
}

/** Controllo UC-09: la somma dei millesimi deve essere 1000. */
export function isSommaMillesimiValida(totale: number): boolean {
  return Math.abs(totale - 1000) <= 0.001;
}
