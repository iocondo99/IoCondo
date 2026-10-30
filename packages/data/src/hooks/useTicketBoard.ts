import { useState } from 'react';
import type { Services } from '../services';

type StatoTicket = Parameters<Services['ticket']['cambiaStato']>[1];

export function useTicketBoard(services: Services) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cambiaStato = async (ticketId: string, stato: StatoTicket) => {
    setBusyId(ticketId);
    setError(null);
    try {
      await services.ticket.cambiaStato(ticketId, stato);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  return { busyId, error, cambiaStato };
}
