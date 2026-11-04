import React from 'react';
import {
  descrizioneComunicazioni,
  descrizioneDocumenti,
  riepilogoSpese,
  type AssembleaHome,
  type ComunicazioneHome,
  type RataHome,
} from '@iocondo/data';
import { StatCard, formatDate, formatEuro, type StatCardAction } from '@iocondo/ui';
import type { Blocco } from '@/hooks/useBlocco';

/** Apre la pagina di una voce del menu; `undefined` se la voce non c'è per questo utente (niente pulsante). */
export type Apri = (voceId: string, hint: string) => Pick<StatCardAction, 'onPress' | 'accessibilityHint'> | undefined;

interface BloccoProps<T> {
  blocco: Blocco<T>;
  ricarica: () => void;
  apri: Apri;
}

/** Spazio che non va a capo: "€" e cifre restano sulla stessa riga. */
const euro = (importo: number) => formatEuro(importo).replace(' ', ' ');

const errore = (messaggio: string, ricarica: () => void) => ({ message: messaggio, onRetry: ricarica });

/** Spese condominiali: totale ancora da pagare. Il pagamento online è Fase 2: l'azione porta solo alle rate. */
export function SchedaSpese({ blocco, ricarica, apri, oggi }: BloccoProps<RataHome[]> & { oggi: string }) {
  const titolo = 'Spese e scadenze';
  if (blocco.stato !== 'pronto') {
    return (
      <StatCard
        icon="coins"
        title={titolo}
        value=""
        loading={blocco.stato === 'caricamento'}
        error={blocco.stato === 'errore' ? errore('Non siamo riusciti a leggere le spese.', ricarica) : undefined}
      />
    );
  }
  const riepilogo = riepilogoSpese(blocco.dati, oggi);
  const vediRate = riepilogo.rateDaPagare > 0 ? apri('pagamenti', 'Apre la pagina Pagamenti') : undefined;
  return (
    <StatCard
      icon="coins"
      title={titolo}
      value={formatEuro(riepilogo.totaleDaPagare)}
      description={
        riepilogo.rateDaPagare === 0
          ? 'Non ci sono rate da pagare'
          : riepilogo.totaleScaduto > 0
            ? `Totale da pagare, di cui ${euro(riepilogo.totaleScaduto)} scaduto`
            : 'Totale da pagare'
      }
      status={riepilogo.totaleScaduto > 0 ? 'scaduto' : undefined}
      action={vediRate ? { label: 'Vedi le rate', variant: 'primary', ...vediRate } : undefined}
    />
  );
}

export function SchedaComunicazioni({
  blocco,
  ricarica,
  apri,
}: BloccoProps<{ righe: ComunicazioneHome[]; nonLette: number }>) {
  const titolo = 'Comunicazioni';
  if (blocco.stato !== 'pronto') {
    return (
      <StatCard
        icon="message-circle"
        tile="teal"
        title={titolo}
        value=""
        loading={blocco.stato === 'caricamento'}
        error={blocco.stato === 'errore' ? errore('Non siamo riusciti a leggere le comunicazioni.', ricarica) : undefined}
      />
    );
  }
  const { nonLette } = blocco.dati;
  const leggi = nonLette > 0 ? apri('comunicazioni', 'Apre la pagina Comunicazioni') : undefined;
  return (
    <StatCard
      icon="message-circle"
      tile="teal"
      title={titolo}
      value={String(nonLette)}
      description={descrizioneComunicazioni(nonLette)}
      action={leggi ? { label: 'Leggi ora', variant: 'secondary', ...leggi } : undefined}
    />
  );
}

export function SchedaDocumenti({ blocco, ricarica, apri }: BloccoProps<number>) {
  const titolo = 'Documenti';
  if (blocco.stato !== 'pronto') {
    return (
      <StatCard
        icon="file-text"
        title={titolo}
        value=""
        loading={blocco.stato === 'caricamento'}
        error={blocco.stato === 'errore' ? errore('Non siamo riusciti a leggere i documenti.', ricarica) : undefined}
      />
    );
  }
  const vedi = blocco.dati > 0 ? apri('documenti', 'Apre la pagina Documenti') : undefined;
  return (
    <StatCard
      icon="file-text"
      tile="navy"
      title={titolo}
      value={String(blocco.dati)}
      description={blocco.dati === 0 ? 'Non ci sono documenti disponibili' : descrizioneDocumenti(blocco.dati)}
      action={vedi ? { label: 'Vedi i documenti', variant: 'secondary', ...vedi } : undefined}
    />
  );
}

export function SchedaAssemblea({ blocco, ricarica, apri }: BloccoProps<AssembleaHome | null>) {
  const titolo = 'Assemblea';
  if (blocco.stato !== 'pronto') {
    return (
      <StatCard
        icon="users"
        tile="violet"
        title={titolo}
        value=""
        loading={blocco.stato === 'caricamento'}
        error={blocco.stato === 'errore' ? errore('Non siamo riusciti a leggere l’assemblea.', ricarica) : undefined}
      />
    );
  }
  const assemblea = blocco.dati;
  const dettagli = assemblea ? apri('assemblee', 'Apre la pagina Assemblee') : undefined;
  return (
    <StatCard
      icon="users"
      tile="violet"
      title={titolo}
      value={assemblea ? formatDate(assemblea.data) : 'Nessuna'}
      description={
        assemblea
          ? assemblea.tipo === 'STRAORDINARIA'
            ? 'Prossima assemblea straordinaria'
            : 'Prossima assemblea'
          : 'Non ci sono assemblee in programma'
      }
      action={dettagli ? { label: 'Dettagli', variant: 'secondary', ...dettagli } : undefined}
    />
  );
}
