import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { etichettaAutore, type DettaglioComunicazione, type StatoLetturaComunicazione } from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  NonAutorizzato,
  PageHeader,
  Skeleton,
  SkeletonText,
  borderWidths,
  colors,
  formatDate,
  radii,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

/**
 * Dettaglio di una comunicazione del condòmino (/comunicazioni/[id]).
 * Il condòmino legge soltanto. L'apertura segna come letta la notifica collegata dell'utente corrente,
 * e il pulsante "Segna come letta" offre l'azione esplicita in pagina.
 * Se non esiste una notifica collegata per l'utente (`statoLettura === 'nessuna'`), non si inventa "Letta".
 */
export function DettaglioComunicazioneScreen() {
  const consentito = useAccessoConsentito();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profilo, condominio, voci } = useProfilo();
  const router = useRouter();

  if (!consentito || !profilo || !condominio) return null;
  const abilitata = voci.some((v) => v.id === 'comunicazioni');
  if (!abilitata || !id) {
    return <ComunicazioneNonDisponibile onTorna={() => router.replace('/comunicazioni' as Href)} />;
  }
  return <DettaglioContenuto postId={id} utenteId={profilo.id} condominioId={condominio.id} />;
}

/** Stesso messaggio per id inesistente, post di un altro condominio, altro palazzo o non pubblicato. */
function ComunicazioneNonDisponibile({ onTorna }: { onTorna: () => void }) {
  return (
    <NonAutorizzato
      title="Questa comunicazione non è disponibile"
      description="Non puoi vedere questa comunicazione. Torna all’elenco per leggere gli avvisi del tuo condominio."
      action={{ label: 'Torna alle comunicazioni', icon: 'message-circle', onPress: onTorna }}
    />
  );
}

function DettaglioContenuto({
  postId,
  utenteId,
  condominioId,
}: {
  postId: string;
  utenteId: string;
  condominioId: string;
}) {
  const router = useRouter();
  const chiave = `${postId}|${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.comunicazioni.getDettaglio(postId, utenteId, condominioId),
    chiave,
  );

  // Ricarica quando la pagina torna in primo piano (cambio scheda o app).
  const primoFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primoFocus.current) {
        primoFocus.current = false;
        return;
      }
      ricarica();
    }, [ricarica]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (stato: AppStateStatus) => {
      if (stato === 'active') ricarica();
    });
    return () => sub.remove();
  }, [ricarica]);

  const vaiAComunicazioni = useCallback(() => router.navigate('/comunicazioni' as Href), [router]);
  const indietro = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/comunicazioni' as Href)),
    [router],
  );
  const caricamento = blocco.stato === 'caricamento';
  const comunicazione = blocco.stato === 'pronto' ? blocco.dati : null;

  if (blocco.stato === 'pronto' && !comunicazione) {
    return <ComunicazioneNonDisponibile onTorna={() => router.replace('/comunicazioni' as Href)} />;
  }

  const breadcrumbs = [
    { label: 'Home', onPress: () => router.navigate('/home' as Href) },
    { label: 'Comunicazioni', onPress: vaiAComunicazioni },
    { label: comunicazione?.titolo ?? 'Dettaglio comunicazione' },
  ];

  return (
    <View style={styles.pagina}>
      <PageHeader
        title={comunicazione?.titolo ?? 'Dettaglio comunicazione'}
        breadcrumbs={breadcrumbs}
        onBack={indietro}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      {caricamento ? <Scheletro /> : null}

      {blocco.stato === 'errore' ? (
        <Card>
          <ErrorState
            title="Non è stato possibile caricare la comunicazione"
            description="Controlla la connessione e riprova."
            onRetry={ricarica}
          />
        </Card>
      ) : null}

      {comunicazione ? <Dati comunicazione={comunicazione} utenteId={utenteId} /> : null}
    </View>
  );
}

function Dati({
  comunicazione,
  utenteId,
}: {
  comunicazione: DettaglioComunicazione;
  utenteId: string;
}) {
  const { breakpoint } = useBreakpoint();
  const [segnataManualmente, setSegnataManualmente] = useState(false);
  const [inSegnatura, setInSegnatura] = useState(false);
  const [erroreSegnatura, setErroreSegnatura] = useState(false);

  // Al cambio di comunicazione si azzera lo stato locale del pulsante.
  useEffect(() => {
    setSegnataManualmente(false);
    setInSegnatura(false);
    setErroreSegnatura(false);
  }, [comunicazione.id, utenteId]);

  // L'apertura del dettaglio segna come letta la notifica collegata SOLO per l'utente corrente.
  useEffect(() => {
    if (comunicazione.statoLettura !== 'non-letta') return;
    services.comunicazioni.segnaComeLetta(comunicazione.id, utenteId).catch(() => {
      // Se la chiamata automatica fallisce, il pulsante esplicito "Segna come letta" resta disponibile.
    });
  }, [comunicazione.id, comunicazione.statoLettura, utenteId]);

  const statoEffettivo: StatoLetturaComunicazione =
    comunicazione.statoLettura === 'non-letta' && segnataManualmente
      ? 'letta'
      : comunicazione.statoLettura;

  const segnaEsplicitamente = useCallback(async () => {
    if (inSegnatura || statoEffettivo !== 'non-letta') return;
    setInSegnatura(true);
    setErroreSegnatura(false);
    try {
      await services.comunicazioni.segnaComeLetta(comunicazione.id, utenteId);
      setSegnataManualmente(true);
    } catch {
      setErroreSegnatura(true);
    } finally {
      setInSegnatura(false);
    }
  }, [comunicazione.id, inSegnatura, statoEffettivo, utenteId]);

  const testoCorpo = comunicazione.corpo?.trim() || 'Nessun testo aggiuntivo.';

  return (
    <>
      <Card title="Riepilogo">
        <View style={styles.griglia}>
          {comunicazione.fissato ? (
            <Riga
              label="In evidenza"
              valore={
                <View style={styles.fissataTag}>
                  <Icon name="info" size="indicator" color={colors.brand.teal} />
                  <Text style={[textStyle('label', breakpoint), styles.fissataTesto]}>
                    Fissata in alto
                  </Text>
                </View>
              }
            />
          ) : null}
          <Riga label="Data di pubblicazione" valore={formatDate(comunicazione.dataPubblicazione)} />
          <Riga label="Autore" valore={etichettaAutore(comunicazione.autoreNome)} />
          <Riga
            label="Destinatari"
            valore={comunicazione.palazzoNome ? comunicazione.palazzoNome : 'Tutto il condominio'}
          />
          {statoEffettivo !== 'nessuna' ? (
            <Riga
              label="Stato"
              valore={statoEffettivo === 'non-letta' ? <Badge status="non-letto" /> : 'Letta'}
            />
          ) : null}

          {statoEffettivo === 'non-letta' ? (
            <View style={styles.azioneLettura}>
              <Button
                label="Segna come letta"
                loadingLabel="Aggiornamento in corso…"
                icon="check"
                variant="secondary"
                loading={inSegnatura}
                onPress={segnaEsplicitamente}
                accessibilityHint="Segna questa comunicazione come letta per il tuo profilo"
              />
            </View>
          ) : null}

          {erroreSegnatura ? (
            <Alert
              tone="error"
              message="Non è stato possibile aggiornare lo stato di lettura. Riprova tra poco."
            />
          ) : null}
        </View>
      </Card>

      <Card title="Testo della comunicazione">
        <Text style={[textStyle('body', breakpoint), styles.corpo]}>{testoCorpo}</Text>
      </Card>
    </>
  );
}

/** Segnaposto di caricamento con la forma della pagina: due schede di righe. */
function Scheletro() {
  return (
    <View role="status" aria-busy accessibilityLabel="Caricamento della comunicazione" style={styles.pagina}>
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

function Riga({ label, valore }: { label: string; valore: React.ReactNode }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.riga}>
      <Text style={[textStyle('secondary', breakpoint), styles.etichetta]}>{label}</Text>
      {typeof valore === 'string' ? (
        <Text style={[textStyle('body', breakpoint), styles.valore]}>{valore}</Text>
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
  valore: { flex: 1, minWidth: 140, textAlign: 'right', color: colors.text.primary },
  valoreNodo: { flex: 1, minWidth: 140, alignItems: 'flex-end' },
  fissataTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    borderWidth: borderWidths.thin,
    borderColor: colors.brand.teal,
    backgroundColor: colors.background,
  },
  fissataTesto: { color: colors.brand.navy },
  azioneLettura: { alignSelf: 'flex-start', paddingTop: space[1] },
  corpo: { color: colors.text.primary },
});

