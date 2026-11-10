import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationItem } from '@iocondo/ui';
import type { INotifica } from '@iocondo/shared-types';
import { NOTIFICHE_MASSIMO_PANNELLO } from '@iocondo/data';
import { services } from '@/services';

export interface NotificaItemUI extends NotificationItem {
  raw: INotifica;
}

/**
 * Notifiche in-app dell'utente: gestisce il caricamento delle non lette per il pannello,
 * il contatore reale delle non lette, la rimozione immediata quando lette o cliccate
 * e l'azione per segnarle tutte come lette.
 */
export function useNotifiche(userId: string | null) {
  const [elenco, setElenco] = useState<NotificaItemUI[]>([]);
  const [totaleNonLette, setTotaleNonLette] = useState(0);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);
  const attuale = useRef(0);

  const carica = useCallback(async () => {
    if (!userId) return;
    const questa = ++attuale.current;
    setErrore(false);
    try {
      const res = await services.profilo.listMieNonLette(userId, NOTIFICHE_MASSIMO_PANNELLO);
      if (questa !== attuale.current) return;
      setTotaleNonLette(res.totale);
      setElenco(
        res.righe.map((n) => ({
          id: n.id,
          title: n.titolo,
          text: n.corpo ?? undefined,
          date: n.created_at,
          read: n.letta,
          raw: n,
        })),
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

  /** Segna una singola notifica come letta: la rimuove dal pannello delle non lette e decrementa il contatore. */
  const segnaLetta = useCallback(
    async (id: string) => {
      if (!userId) return;
      // Aggiornamento ottimistico immediato
      setElenco((corrente) => corrente.filter((n) => n.id !== id));
      setTotaleNonLette((prev) => Math.max(0, prev - 1));
      try {
        await services.profilo.segnaNotificaLetta(userId, id);
      } catch (err) {
        // In caso di errore ripristiniamo ricaricando
        void carica();
        throw err;
      }
    },
    [userId, carica],
  );

  /** Segna tutte le notifiche non lette come lette nel server e svuota l'elenco non lette. */
  const segnaTutteLette = useCallback(async () => {
    if (!userId) return;
    setElenco([]);
    setTotaleNonLette(0);
    try {
      await services.profilo.segnaMieNotificheLette(userId);
    } catch (err) {
      void carica();
      throw err;
    }
  }, [userId, carica]);

  return useMemo(
    () => ({
      elenco,
      totaleNonLette,
      caricamento,
      errore,
      ricarica: carica,
      segnaLetta,
      segnaTutteLette,
    }),
    [elenco, totaleNonLette, caricamento, errore, carica, segnaLetta, segnaTutteLette],
  );
}
