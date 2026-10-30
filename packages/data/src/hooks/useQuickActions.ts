import { useState } from 'react';
import type { Services } from '../services';

type RipartizioneInput = Parameters<Services['rate']['ripartisciSpese']>[0];

export function useQuickActions(services: Services) {
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
