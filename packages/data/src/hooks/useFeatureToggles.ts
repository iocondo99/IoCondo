import { useState } from 'react';
import type { FeatureToggles, Services } from '../services';
import { DEFAULT_MODULI_ATTIVI } from '../profilo/moduli';

export function useFeatureToggles(services: Services, condominioId: string, palazzoId: string | null = null) {
  const [toggles, setToggles] = useState<FeatureToggles>({
    ...DEFAULT_MODULI_ATTIVI,
  });
  const [error, setError] = useState<string | null>(null);

  const toggle = async (key: keyof FeatureToggles) => {
    const previous = toggles;
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    setError(null);
    try {
      await services.condomini.setFeatureToggles(condominioId, palazzoId, next);
    } catch (e) {
      setToggles(previous);
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito');
    }
  };

  return { toggles, setToggles, error, setError, toggle };
}
