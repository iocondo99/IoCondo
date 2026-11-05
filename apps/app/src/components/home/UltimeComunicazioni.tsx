import React from 'react';
import { useRouter, type Href } from 'expo-router';
import { estrattoCorpo, type ComunicazioneHome } from '@iocondo/data';
import { Card, ListRow, ListRows, formatDate } from '@iocondo/ui';
import type { Blocco } from '@/hooks/useBlocco';
import type { Apri } from './SchedeRiepilogo';

interface Props {
  blocco: Blocco<{ righe: ComunicazioneHome[]; nonLette: number }>;
  ricarica?: () => void;
  apri: Apri;
}

const TITOLO = 'Ultime comunicazioni';

/** Ultime comunicazioni della bacheca. Mostra solo quelle non lette; se non ce ne sono, non mostra la sezione. */
export function UltimeComunicazioni({ blocco, apri }: Props) {
  const router = useRouter();
  const tutte = apri('comunicazioni', 'Apre la pagina Comunicazioni');
  const apriDettaglio = (id: string) => () => router.push(`/comunicazioni/${id}` as Href);

  if (blocco.stato !== 'pronto') {
    return null;
  }

  const nonLette = blocco.dati.righe.filter((c) => c.nonLetta);
  if (nonLette.length === 0) {
    return null;
  }

  return (
    <Card title={TITOLO} action={tutte ? { label: 'Vedi tutte', ...tutte } : undefined}>
      <ListRows label={TITOLO}>
        {nonLette.map((c) => {
          const data = formatDate(c.dataPubblicazione);
          return (
            <ListRow
              key={c.id}
              icon="message-circle"
              title={c.titolo}
              description={estrattoCorpo(c.corpo) || undefined}
              meta={data}
              badge="non-letto"
              onPress={tutte ? apriDettaglio(c.id) : undefined}
              accessibilityLabel={`${c.titolo}, ${data}, non letta`}
              accessibilityHint={tutte ? 'Apre il dettaglio di questa comunicazione' : undefined}
            />
          );
        })}
      </ListRows>
    </Card>
  );
}
