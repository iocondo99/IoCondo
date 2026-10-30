'use client';

import { useEffect, useState } from 'react';
import { services, type FornitoreMagicLinkInfo } from '@/services';

export function useFornitoreMagicLink(token: string) {
  const [info, setInfo] = useState<FornitoreMagicLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    services.fornitori
      .getMagicLinkInfo(token)
      .then(setInfo)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Link non valido'))
      .finally(() => setLoading(false));
  }, [token]);

  const chiudiIntervento = async (input: {
    importo_consuntivo: number;
    note_fornitore: string;
    foto_lavoro_url: string;
    fattura_url: string;
  }) => {
    setSubmitting(true);
    setError(null);
    try {
      await services.fornitori.chiudiInterventoMagicLink({ token, ...input });
      setCompleted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
    } finally {
      setSubmitting(false);
    }
  };

  return { info, loading, submitting, completed, error, chiudiIntervento };
}
