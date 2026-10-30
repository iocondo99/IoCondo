'use client';

import { useState } from 'react';
import { services } from '@/services';

type RipartizioneInput = Parameters<typeof services.rate.ripartisciSpese>[0];

export function useQuickActions() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ripartisciSpese = async (input: RipartizioneInput) => {
    setSubmitting(true);
    setError(null);
    try {
      await services.rate.ripartisciSpese(input);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, error, ripartisciSpese };
}
