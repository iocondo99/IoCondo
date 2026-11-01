import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationItem } from '@iocondo/ui';
import { services } from '@/services';

/**
 * Notifiche in-app dell'utente dalla tabella `notifiche` (solo le sue righe). Nessuna notifica finta:
 * se la tabella è vuota il pannello mostra lo stato vuoto, se la lettura fallisce mostra l'errore.
 */
export function useNotifiche(userId: string | null) {
  const [elenco, setElenco] = useState<NotificationItem[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);
  const attuale = useRef(0);

  const carica = useCallback(async () => {
    if (!userId) return;
    const questa = ++attuale.current;
    setErrore(false);
    try {
      const righe = await services.profilo.listMieNotifiche(userId);
      if (questa !== attuale.current) return;
      setElenco(
        righe.map((n) => ({ id: n.id, title: n.titolo, text: n.corpo ?? undefined, date: n.created_at, read: n.letta })),
      );
    } catch {
      if (questa === attuale.current) setErrore(true);
    } finally {
      if (questa === attuale.current) setCaricamento(false);
    }
  }, [userId]);

  useEffect(() => {
    void carica();
  }, [carica]);

  /** Aggiorna l'elenco solo dopo la conferma del server: niente "lette" che il database non ha registrato. */
  const segnaTutteLette = useCallback(async () => {
    if (!userId) return;
    await services.profilo.segnaMieNotificheLette(userId);
    setElenco((corrente) => corrente.map((n) => ({ ...n, read: true })));
  }, [userId]);

  return useMemo(
    () => ({ elenco, caricamento, errore, ricarica: carica, segnaTutteLette }),
    [elenco, caricamento, errore, carica, segnaTutteLette],
  );
}
