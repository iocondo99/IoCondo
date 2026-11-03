import React from 'react';
import { DettaglioSegnalazione } from '@/components/segnalazioni/DettaglioSegnalazione';

/** Dettaglio segnalazione del cond�mino (`/segnalazioni/[id]`, REQ-C04). */
export function DettaglioSegnalazioneScreen() {
  return <DettaglioSegnalazione modalita="condomino" rottaElenco="/segnalazioni" nomeElenco="Segnalazioni" />;
}

