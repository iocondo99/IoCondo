import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { residuo, scadenzeHome, statoRata, type RataHome } from '@iocondo/data';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ListRow,
  ListRows,
  badgeStatuses,
  colors,
  formatDate,
  formatEuro,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { useRouter, type Href } from 'expo-router';
import type { Blocco } from '@/hooks/useBlocco';
import { ElencoSegnaposto } from './ElencoSegnaposto';
import type { Apri } from './SchedeRiepilogo';

interface Props {
  blocco: Blocco<RataHome[]>;
  ricarica: () => void;
  apri: Apri;
  oggi: string;
}

const TITOLO = 'Prossime scadenze';

/** Scadenze delle rate del residente. Le scadute stanno in un gruppo a parte, con icona e testo oltre al colore. */
export function ProssimeScadenze({ blocco, ricarica, apri, oggi }: Props) {
  const router = useRouter();
  const rate = apri('pagamenti', 'Apre la pagina Pagamenti');
  const scadenze = blocco.stato === 'pronto' ? scadenzeHome(blocco.dati, oggi) : null;
  const vuota = scadenze !== null && scadenze.scadute.length + scadenze.prossime.length === 0;

  const apriDettaglio = (id: string) => () => router.push(`/pagamenti/${id}` as Href);

  return (
    <Card title={TITOLO} action={rate ? { label: 'Vedi tutte', ...rate } : undefined}>
      {blocco.stato === 'caricamento' ? <ElencoSegnaposto etichetta="Caricamento delle scadenze" /> : null}
      {blocco.stato === 'errore' ? (
        <ErrorState
          title="Non riusciamo a caricare le scadenze"
          description="Controlla la connessione e riprova."
          onRetry={ricarica}
        />
      ) : null}
      {vuota ? (
        <EmptyState icon="calendar-days" title="Nessuna scadenza" description="Non ci sono rate da pagare." />
      ) : null}
      {scadenze && !vuota ? (
        <View style={styles.gruppi}>
          {scadenze.scadute.length > 0 ? (
            <Gruppo etichetta="Scadute" scadute>
              <Elenco rate={scadenze.scadute} oggi={oggi} apriDettaglio={apriDettaglio} etichetta="Rate scadute" />
            </Gruppo>
          ) : null}
          {scadenze.prossime.length > 0 ? (
            <Gruppo etichetta={scadenze.scadute.length > 0 ? 'In arrivo' : undefined}>
              <Elenco rate={scadenze.prossime} oggi={oggi} apriDettaglio={apriDettaglio} etichetta="Rate in arrivo" />
            </Gruppo>
          ) : null}
          {scadenze.nascoste > 0 ? <AltreRate quante={scadenze.nascoste} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

function Gruppo({ etichetta, scadute, children }: { etichetta?: string; scadute?: boolean; children: React.ReactNode }) {
  const { breakpoint } = useBreakpoint();
  const colore = scadute ? colors.semantic.error.foreground : colors.text.secondary;
  return (
    <View style={styles.gruppo}>
      {etichetta ? (
        <View style={styles.intestazione}>
          {scadute ? <Icon name="circle-alert" size="indicator" color={colore} /> : null}
          <Text accessibilityRole="header" aria-level={4} style={[textStyle('label', breakpoint), { color: colore }]}>
            {etichetta}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Elenco({
  rate,
  oggi,
  apriDettaglio,
  etichetta,
}: {
  rate: RataHome[];
  oggi: string;
  apriDettaglio: (id: string) => () => void;
  etichetta: string;
}) {
  return (
    <ListRows label={etichetta}>
      {rate.map((rata) => {
        const stato = statoRata(rata, oggi);
        const data = formatDate(rata.dataScadenza);
        const importo = formatEuro(stato === 'pagato' ? rata.importoDovuto : residuo(rata));
        const descrizione =
          stato === 'scaduto'
            ? `Scaduta il ${data}`
            : stato === 'pagato'
              ? `Pagata, scadenza ${data}`
              : stato === 'in-corso'
                ? `Scadenza ${data}, già versati ${formatEuro(rata.importoPagato)}`
                : `Scadenza ${data}`;
        return (
          <ListRow
            key={rata.id}
            icon="calendar-days"
            tile={stato === 'scaduto' ? 'error' : 'blue'}
            title={rata.descrizione}
            description={descrizione}
            meta={importo}
            badge={stato}
            onPress={apriDettaglio(rata.id)}
            accessibilityLabel={`${rata.descrizione}, ${descrizione}, ${importo}, ${badgeStatuses[stato].label}`}
            accessibilityHint="Apre il dettaglio di questa rata"
          />
        );
      })}
    </ListRows>
  );
}

function AltreRate({ quante }: { quante: number }) {
  const { breakpoint } = useBreakpoint();
  return (
    <Text style={[textStyle('secondary', breakpoint), styles.altre]}>
      {quante === 1 ? 'Un’altra rata nella pagina Pagamenti.' : `Altre ${quante} rate nella pagina Pagamenti.`}
    </Text>
  );
}

const styles = StyleSheet.create({
  gruppi: { alignSelf: 'stretch', gap: space[4] },
  gruppo: { gap: space[1] },
  intestazione: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[2] },
  altre: { color: colors.text.secondary, paddingHorizontal: space[2] },
});
