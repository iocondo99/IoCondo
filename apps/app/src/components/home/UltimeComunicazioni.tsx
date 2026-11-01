import React from 'react';
import { estrattoCorpo, type ComunicazioneHome } from '@iocondo/data';
import { Card, EmptyState, ErrorState, ListRow, ListRows, formatDate } from '@iocondo/ui';
import type { Blocco } from '@/hooks/useBlocco';
import { ElencoSegnaposto } from './ElencoSegnaposto';
import type { Apri } from './SchedeRiepilogo';

interface Props {
  blocco: Blocco<{ righe: ComunicazioneHome[]; nonLette: number }>;
  ricarica: () => void;
  apri: Apri;
}

const TITOLO = 'Ultime comunicazioni';

/** Ultime comunicazioni della bacheca. "Non letto" compare solo dove il database lo sa (vedi homeService). */
export function UltimeComunicazioni({ blocco, ricarica, apri }: Props) {
  const tutte = apri('comunicazioni', 'Apre la pagina Comunicazioni');
  const apertura = tutte ? { onPress: tutte.onPress, accessibilityHint: tutte.accessibilityHint } : undefined;

  return (
    <Card title={TITOLO} action={tutte ? { label: 'Vedi tutte', ...tutte } : undefined}>
      {blocco.stato === 'caricamento' ? <ElencoSegnaposto etichetta="Caricamento delle comunicazioni" /> : null}
      {blocco.stato === 'errore' ? (
        <ErrorState
          title="Non riusciamo a caricare le comunicazioni"
          description="Controlla la connessione e riprova."
          onRetry={ricarica}
        />
      ) : null}
      {blocco.stato === 'pronto' && blocco.dati.righe.length === 0 ? (
        <EmptyState icon="message-circle" title="Nessuna comunicazione" description="Non ci sono ancora comunicazioni." />
      ) : null}
      {blocco.stato === 'pronto' && blocco.dati.righe.length > 0 ? (
        <ListRows label={TITOLO}>
          {blocco.dati.righe.map((c) => {
            const data = formatDate(c.dataPubblicazione);
            return (
              <ListRow
                key={c.id}
                icon="message-circle"
                title={c.titolo}
                description={estrattoCorpo(c.corpo) || undefined}
                meta={data}
                badge={c.nonLetta ? 'non-letto' : undefined}
                onPress={apertura?.onPress}
                accessibilityLabel={`${c.titolo}, ${data}${c.nonLetta ? ', non letta' : ''}`}
                accessibilityHint={apertura?.accessibilityHint}
              />
            );
          })}
        </ListRows>
      ) : null}
    </Card>
  );
}
