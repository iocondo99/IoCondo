import React, { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { descrizioneMillesimi, oggiIso, statoRata, type DettaglioRata } from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  NonAutorizzato,
  PageHeader,
  Skeleton,
  SkeletonText,
  colors,
  formatDate,
  formatEuro,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

/** Dettaglio di una rata e bollettino PDF (REQ-C01). Il pagamento online è Fase 2: qui non c'è "Paga ora". */
export function DettaglioRataScreen() {
  const consentito = useAccessoConsentito();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profilo, condominio, ruoli } = useProfilo();
  const router = useRouter();

  if (!consentito || !profilo || !condominio) return null;
  if (!ruoli.has('CONDOMINO') || !id) return <RataNonDisponibile onTorna={() => router.replace('/pagamenti' as Href)} />;
  return <DettaglioContenuto rataId={id} utenteId={profilo.id} condominioId={condominio.id} />;
}

/** Stesso schermo per rata inesistente, non pubblicata, di un altro condominio o di un'altra persona. */
function RataNonDisponibile({ onTorna }: { onTorna: () => void }) {
  return (
    <NonAutorizzato
      title="Questa rata non è disponibile"
      description="Non puoi vedere questa rata. Torna all’elenco per aprire le tue rate."
      action={{ label: 'Torna ai pagamenti', icon: 'credit-card', onPress: onTorna }}
    />
  );
}

function DettaglioContenuto({ rataId, utenteId, condominioId }: { rataId: string; utenteId: string; condominioId: string }) {
  const router = useRouter();
  const oggi = oggiIso();

  const { blocco, ricarica } = useBlocco(
    () => services.pagamenti.getDettaglio(rataId, utenteId, condominioId),
    `${rataId}|${utenteId}|${condominioId}`,
  );

  const vaiAPagamenti = useCallback(() => router.navigate('/pagamenti' as Href), [router]);
  const indietro = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/pagamenti' as Href)),
    [router],
  );
  const caricamento = blocco.stato === 'caricamento';
  const rata = blocco.stato === 'pronto' ? blocco.dati : null;

  if (blocco.stato === 'pronto' && !rata) return <RataNonDisponibile onTorna={() => router.replace('/pagamenti' as Href)} />;

  const breadcrumbs = [
    { label: 'Home', onPress: () => router.navigate('/home' as Href) },
    { label: 'Pagamenti', onPress: vaiAPagamenti },
    { label: rata?.descrizione ?? 'Dettaglio rata' },
  ];

  return (
    <View style={styles.pagina}>
      <PageHeader
        title={rata?.descrizione ?? 'Dettaglio rata'}
        breadcrumbs={breadcrumbs}
        onBack={indietro}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      {caricamento ? <Scheletro /> : null}

      {blocco.stato === 'errore' ? (
        <Card>
          <ErrorState
            title="Non è stato possibile caricare la rata"
            description="Controlla la connessione e riprova."
            onRetry={ricarica}
          />
        </Card>
      ) : null}

      {rata ? <Dati rata={rata} oggi={oggi} /> : null}
    </View>
  );
}

function Dati({ rata, oggi }: { rata: DettaglioRata; oggi: string }) {
  const stato = statoRata(rata, oggi);
  return (
    <>
      <Card title="Riepilogo">
        <View style={styles.griglia}>
          <Riga label="Stato" valore={<Badge status={stato} />} />
          <Riga label="Scadenza" valore={formatDate(rata.dataScadenza)} />
          {rata.esercizioAnno ? <Riga label="Esercizio" valore={String(rata.esercizioAnno)} /> : null}
          <Riga label="Unità" valore={rata.unitaDescrizione} />
        </View>
      </Card>

      <Card title="Importi">
        <View style={styles.griglia}>
          <Riga label="Importo dovuto" valore={formatEuro(rata.importoDovuto)} evidenzia />
          <Riga label="Importo versato" valore={formatEuro(rata.importoPagato)} />
          <Riga label="Residuo da pagare" valore={formatEuro(rata.residuo)} evidenzia />
          {stato === 'pagato' && rata.dataPagamento ? <Riga label="Pagata il" valore={formatDate(rata.dataPagamento)} /> : null}
        </View>
      </Card>

      {rata.ripartizione ? (
        <Card title="Ripartizione millesimale">
          <View style={styles.griglia}>
            <Riga label="Tabella" valore={rata.ripartizione.tabellaNome} />
            <Riga
              label="Millesimi della tua unità"
              valore={descrizioneMillesimi(rata.ripartizione.millesimi, rata.ripartizione.totale)}
            />
          </View>
        </Card>
      ) : null}

      <BollettinoCard percorso={rata.bollettino} />
    </>
  );
}

/** Segnaposto di caricamento con la forma della pagina: due schede di righe. */
function Scheletro() {
  return (
    <View role="status" aria-busy accessibilityLabel="Caricamento della rata" style={styles.pagina}>
      {[0, 1].map((n) => (
        <Card key={n}>
          <View style={styles.griglia}>
            <Skeleton width="30%" />
            <SkeletonText lines={3} />
          </View>
        </Card>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bollettino PDF (REQ-C01): solo se il file esiste davvero; link firmato a tempo, mai un URL pubblico.

function BollettinoCard({ percorso }: { percorso: string | null }) {
  const { breakpoint } = useBreakpoint();
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<'mancante' | 'errore' | null>(null);

  const scarica = useCallback(async () => {
    if (!percorso || inCorso) return;
    setInCorso(true);
    setEsito(null);
    try {
      const url = await services.pagamenti.urlBollettino(percorso);
      if (!url) {
        setEsito('mancante');
        return;
      }
      await Linking.openURL(url);
    } catch {
      setEsito('errore');
    } finally {
      setInCorso(false);
    }
  }, [percorso, inCorso]);

  if (!percorso) {
    return (
      <Card title="Bollettino">
        <Text style={[textStyle('body', breakpoint), styles.testoSecondario]}>Il bollettino non è ancora disponibile.</Text>
      </Card>
    );
  }

  return (
    <Card title="Bollettino">
      <View style={styles.griglia}>
        <Text style={[textStyle('body', breakpoint), styles.testoSecondario]}>Il bollettino è un file PDF. Il link vale 10 minuti.</Text>
        <View style={styles.azione}>
          <Button
            label="Scarica il bollettino"
            loadingLabel="Preparazione del bollettino…"
            icon="file-text"
            variant="secondary"
            loading={inCorso}
            onPress={scarica}
            accessibilityHint="Apre il bollettino PDF in una nuova scheda"
          />
        </View>
        {esito === 'mancante' ? (
          <Alert tone="warning" message="Il bollettino non è più disponibile. Aggiorna la pagina o chiedi all’amministratore." />
        ) : null}
        {esito === 'errore' ? <Alert tone="error" message="Non è stato possibile aprire il bollettino. Riprova tra poco." /> : null}
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────

function Riga({ label, valore, evidenzia }: { label: string; valore: React.ReactNode; evidenzia?: boolean }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.riga}>
      <Text style={[textStyle('secondary', breakpoint), styles.etichetta]}>{label}</Text>
      {typeof valore === 'string' ? (
        <Text
          style={[
            textStyle(evidenzia ? 'h4' : 'body', breakpoint),
            { color: evidenzia ? colors.text.primary : colors.text.secondary },
            styles.valore,
          ]}
        >
          {valore}
        </Text>
      ) : (
        <View style={styles.valoreNodo}>{valore}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  griglia: { gap: space[3] },
  riga: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[4],
    flexWrap: 'wrap',
  },
  etichetta: { flex: 1, minWidth: 140, color: colors.text.secondary },
  valore: { flex: 1, minWidth: 140, textAlign: 'right' },
  valoreNodo: { flex: 1, minWidth: 140, alignItems: 'flex-end' },
  azione: { alignSelf: 'flex-start' },
  testoSecondario: { color: colors.text.secondary },
});
