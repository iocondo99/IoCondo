'use client';

import { useState } from 'react';
import { services } from '@/services';
import type { FeatureToggles } from '@/services';

export function useFeatureToggles(condominioId: string) {
  const [toggles, setToggles] = useState<FeatureToggles>({
    abilita_social: true,
    abilita_chat: true,
    abilita_bacheca: true,
    abilita_ticket: true,
    abilita_prenotazioni: true,
    abilita_pacchi: true,
  });
  const [error, setError] = useState<string | null>(null);

  const toggle = async (key: keyof FeatureToggles) => {
    const previous = toggles;
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    setError(null);
    try {
      await services.condomini.setFeatureToggles(condominioId, null, next);
    } catch (e) {
      setToggles(previous);
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito');
    }
  };

  return { toggles, error, toggle };
}
