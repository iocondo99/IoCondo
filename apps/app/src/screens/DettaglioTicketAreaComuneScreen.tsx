import React from 'react';
import { DettaglioSegnalazione } from '@/components/segnalazioni/DettaglioSegnalazione';

/** Dettaglio ticket su area comune del portiere (`/ticket-aree-comuni/[id]`). */
export function DettaglioTicketAreaComuneScreen() {
  return (
    <DettaglioSegnalazione modalita="portiere" rottaElenco="/ticket-aree-comuni" nomeElenco="Ticket aree comuni" />
  );
}

