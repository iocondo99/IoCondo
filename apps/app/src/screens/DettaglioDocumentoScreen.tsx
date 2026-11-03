import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  descrizioneVisibilitaDocumento,
  etichettaFormatoDocumento,
  MESSAGGIO_FILE_NON_DISPONIBILE,
  type DettaglioDocumentoCondomino,
} from '@iocondo/data';
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
 * Dettaglio di un singolo documento del condòmino (`/documenti/[id]`) in sola lettura:
 * mostra il riepilogo dei metadati e consente di aprire/scaricare il file dal bucket
 * privato `documenti-condominio` tramite un link firmato temporaneo (`createSignedUrl`, 600s)
 * generato solo al clic dell'utente, oppure segnala chiaramente se il file non è ancora
 * presente nello spazio di archiviazione.
 */
export function DettaglioDocumentoScreen() {
  const consentito = useAccessoConsentito();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profilo, condominio, voci } = useProfilo();
  const router = useRouter();

  if (!consentito || !profilo || !condominio) return null;

  const abilitata = voci.some((v) => v.id === 'documenti');
  if (!abilitata || !id) {
    return <DocumentoNonDisponibile onTorna={() => router.replace('/documenti' as Href)} />;
  }

  return (
    <DettaglioDocumentoContenuto
      documentoId={id}
      utenteId={profilo.id}
      condominioId={condominio.id}
    />
  );
}

/**
 * Stato identico per ID inesistente, documento di un altro condominio o documento
 * appartenente a un'unità non propria (nessuna enumerazione).
 */
function DocumentoNonDisponibile({ onTorna }: { onTorna: () => void }) {
  return (
    <NonAutorizzato
      title="Questo documento non è disponibile"
      description="Non puoi vedere questo documento. Torna all’elenco per consultare i documenti del tuo condominio."
      action={{ label: 'Torna ai documenti', icon: 'file-text', onPress: onTorna }}
    />
  );
}

function DettaglioDocumentoContenuto({
  documentoId,
  utenteId,
  condominioId,
}: {
  documentoId: string;
  utenteId: string;
  condominioId: string;
}) {
  const router = useRouter();
  const chiave = `${documentoId}|${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.documenti.dettaglioDocumentoCondomino(utenteId, condominioId, documentoId),
    chiave,
  );

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

  const vaiADocumenti = useCallback(() => router.navigate('/documenti' as Href), [router]);
  const indietro = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/documenti' as Href)),
    [router],
  );

  const caricamento = blocco.stato === 'caricamento';
  const documento = blocco.stato === 'pronto' ? blocco.dati : null;

  if (blocco.stato === 'pronto' && !documento) {
    return <DocumentoNonDisponibile onTorna={() => router.replace('/documenti' as Href)} />;
  }

  const breadcrumbs = [
    { label: 'Home', onPress: () => router.navigate('/home' as Href) },
    { label: 'Documenti', onPress: vaiADocumenti },
    { label: documento?.nomeFile ?? 'Dettaglio documento' },
  ];

  return (
    <View style={styles.pagina}>
      <PageHeader
        title={documento?.nomeFile ?? 'Dettaglio documento'}
        subtitle={documento ? `Cartella ${documento.cartellaNome}` : undefined}
        breadcrumbs={breadcrumbs}
        onBack={indietro}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      {caricamento ? <ScheletroDettaglio /> : null}

      {blocco.stato === 'errore' ? (
        <Card>
          <ErrorState
            title="Non è stato possibile caricare il documento"
            description="Controlla la connessione e riprova."
            onRetry={ricarica}
          />
        </Card>
      ) : null}

      {documento ? (
        <ContenutoMetadatiEScaricamento documento={documento} condominioId={condominioId} />
      ) : null}
    </View>
  );
}

function ContenutoMetadatiEScaricamento({
  documento,
  condominioId,
}: {
  documento: DettaglioDocumentoCondomino;
  condominioId: string;
}) {
  const { breakpoint } = useBreakpoint();
  const [inScaricamento, setInScaricamento] = useState(false);
  const [avvisoStorage, setAvvisoStorage] = useState<string | null>(
    documento.disponibileNelloStorage ? null : MESSAGGIO_FILE_NON_DISPONIBILE,
  );
  const [erroreScaricamento, setErroreScaricamento] = useState(false);

  useEffect(() => {
    setInScaricamento(false);
    setErroreScaricamento(false);
    setAvvisoStorage(documento.disponibileNelloStorage ? null : MESSAGGIO_FILE_NON_DISPONIBILE);
  }, [documento.id, documento.disponibileNelloStorage]);

  const scaricaDocumento = useCallback(async () => {
    if (inScaricamento || !documento.percorsoStorage) return;
    setInScaricamento(true);
    setErroreScaricamento(false);
    try {
      const esito = await services.documenti.creaLinkFirmatoDocumento(
        documento.percorsoStorage,
        condominioId,
      );
      if (!esito.disponibile) {
        setAvvisoStorage(esito.messaggio);
        return;
      }
      await Linking.openURL(esito.signedUrl);
    } catch {
      setErroreScaricamento(true);
    } finally {
      setInScaricamento(false);
    }
  }, [condominioId, documento.percorsoStorage, inScaricamento]);

  const fileDisponibile = documento.disponibileNelloStorage && !avvisoStorage;

  return (
    <View style={styles.sezioni}>
      <Card title="Riepilogo documento">
        <View style={styles.griglia}>
          <RigaMetadato label="Nome file" valore={documento.nomeFile} />
          <RigaMetadato label="Cartella" valore={documento.cartellaNome} />
          <RigaMetadato
            label="Visibilità"
            valore={
              <View style={styles.valoreVisibilita}>
                <Badge status={documento.visibilita} label={documento.etichettaVisibilita} />
                <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                  {descrizioneVisibilitaDocumento(documento.unitaId, documento.unitaInterno)}
                </Text>
              </View>
            }
          />
          <RigaMetadato
            label="Formato"
            valore={etichettaFormatoDocumento(documento.tipoMime, documento.nomeFile)}
          />
          <RigaMetadato label="Data di caricamento" valore={formatDate(documento.createdAt)} />
        </View>
      </Card>

      <Card title="Scaricamento">
        <View style={styles.griglia}>
          {fileDisponibile ? (
            <>
              <Text style={[textStyle('body', breakpoint), styles.testoPrimario]}>
                Il documento è archiviato nello spazio protetto del condominio. Al clic verrà
                generato un collegamento temporaneo valido per 10 minuti.
              </Text>
              <View style={styles.azioneScarica}>
                <Button
                  label="Scarica documento"
                  loadingLabel="Preparazione del collegamento…"
                  icon="file-text"
                  variant="primary"
                  loading={inScaricamento}
                  onPress={() => void scaricaDocumento()}
                  accessibilityHint="Genera un collegamento firmato valido 10 minuti e apre il documento"
                />
              </View>
            </>
          ) : (
            <Alert
              tone="info"
              title={avvisoStorage ?? MESSAGGIO_FILE_NON_DISPONIBILE}
              message="I metadati del documento sono registrati, ma il file non è ancora stato caricato nello spazio di archiviazione del condominio."
            />
          )}

          {erroreScaricamento ? (
            <Alert
              tone="error"
              message="Non è stato possibile generare il collegamento per il documento. Riprova tra poco."
            />
          ) : null}
        </View>
      </Card>
    </View>
  );
}

function RigaMetadato({ label, valore }: { label: string; valore: React.ReactNode }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.rigaMetadato}>
      <Text style={[textStyle('label', breakpoint), styles.etichetta]}>{label}</Text>
      {typeof valore === 'string' ? (
        <Text style={[textStyle('body', breakpoint), styles.testoPrimario, styles.valoreTesto]}>
          {valore}
        </Text>
      ) : (
        valore
      )}
    </View>
  );
}

function ScheletroDettaglio() {
  return (
    <View role="status" aria-label="Caricamento del documento" style={styles.sezioni}>
      <Card>
        <View style={styles.griglia}>
          <Skeleton width="45%" height={space[6]} />
          <SkeletonText lines={4} />
        </View>
      </Card>
      <Card>
        <View style={styles.griglia}>
          <Skeleton width="35%" height={space[6]} />
          <SkeletonText lines={2} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  sezioni: { gap: space[6] },
  griglia: { gap: space[4] },
  rigaMetadato: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
    paddingBottom: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  etichetta: { color: colors.text.secondary },
  testoPrimario: { color: colors.text.primary },
  testoSecondario: { color: colors.text.secondary },
  valoreTesto: { flexShrink: 1 },
  valoreVisibilita: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 1,
  },
  azioneScarica: {
    alignItems: 'flex-start',
  },
});

