import { useState } from 'react';
import type { Services } from '../services';

export function useRateReconciliation(services: Services) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const segnaPagata = async (rataId: string, importoPagato: number) => {
    setBusyId(rataId);
    setError(null);
    try {
      await services.rate.segnaPagata(rataId, importoPagato);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  return { busyId, error, segnaPagata };
}
