import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  MESSAGGIO_FOTO_NON_DISPONIBILE,
  type AllegatoTicket,
  type DettaglioSegnalazione,
  type MessaggioTicket,
  type ModalitaSegnalazioni,
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
  Textarea,
  borderWidths,
  colors,
  formatDate,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

interface Props {
  modalita: ModalitaSegnalazioni;
  /** Rotta dell'elenco, es. `/segnalazioni`. */
  rottaElenco: string;
  nomeElenco: string;
}

/**
 * Dettaglio di una segnalazione: riepilogo, foto, cronologia messaggi e invio di un aggiornamento.
 * Stato `NonAutorizzato` identico per ID inesistente, altro condominio o unità altrui.
 */
export function DettaglioSegnalazione({ modalita, rottaElenco, nomeElenco }: Props) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profilo, condominio } = useProfilo();
  const router = useRouter();
  if (!profilo || !condominio) return null;
  if (!id) {
    return <NonDisponibile onTorna={() => router.replace(rottaElenco as Href)} nomeElenco={nomeElenco} />;
  }
  return (
    <Contenuto
      ticketId={id}
      utenteId={profilo.id}
      condominioId={condominio.id}
      modalita={modalita}
      rottaElenco={rottaElenco}
      nomeElenco={nomeElenco}
    />
  );
}

function NonDisponibile({ onTorna, nomeElenco }: { onTorna: () => void; nomeElenco: string }) {
  return (
    <NonAutorizzato
      title="Questa segnalazione non è disponibile"
      description={`Non puoi vedere questa segnalazione. Torna all’elenco per consultare quelle che ti riguardano.`}
      action={{ label: `Torna a ${nomeElenco}`, icon: 'wrench', onPress: onTorna }}
    />
  );
}

function Contenuto({
  ticketId,
  utenteId,
  condominioId,
  modalita,
  rottaElenco,
  nomeElenco,
}: {
  ticketId: string;
  utenteId: string;
  condominioId: string;
  modalita: ModalitaSegnalazioni;
  rottaElenco: string;
  nomeElenco: string;
}) {
  const router = useRouter();
  const chiave = `${ticketId}|${utenteId}|${condominioId}|${modalita}`;
  const { blocco, ricarica } = useBlocco(
    () => services.segnalazioni.dettaglioSegnalazione(utenteId, condominioId, ticketId, modalita),
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

  const vaiElenco = useCallback(() => router.navigate(rottaElenco as Href), [router, rottaElenco]);
  const indietro = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace(rottaElenco as Href)),
    [router, rottaElenco],
  );

  const caricamento = blocco.stato === 'caricamento';
  const dettaglio = blocco.stato === 'pronto' ? blocco.dati : null;

  if (blocco.stato === 'pronto' && !dettaglio) {
    return <NonDisponibile nomeElenco={nomeElenco} onTorna={() => router.replace(rottaElenco as Href)} />;
  }

  return (
    <View style={styles.pagina}>
      <PageHeader
        title={dettaglio?.titolo ?? 'Dettaglio segnalazione'}
        subtitle={dettaglio ? `${dettaglio.etichettaAmbito} · aperta il ${formatDate(dettaglio.createdAt)}` : undefined}
        breadcrumbs={[
          { label: 'Home', onPress: () => router.navigate('/home' as Href) },
          { label: nomeElenco, onPress: vaiElenco },
          { label: dettaglio?.titolo ?? 'Dettaglio segnalazione' },
        ]}
        onBack={indietro}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      {caricamento ? <Scheletro /> : null}

      {blocco.stato === 'errore' ? (
        <Card>
          <ErrorState
            title="Non è stato possibile caricare la segnalazione"
            description="Controlla la connessione e riprova."
            onRetry={ricarica}
          />
        </Card>
      ) : null}

      {dettaglio ? (
        <View style={styles.sezioni}>
          <Riepilogo dettaglio={dettaglio} />
          <Foto allegati={dettaglio.allegati} />
          <Cronologia
            dettaglio={dettaglio}
            utenteId={utenteId}
            condominioId={condominioId}
            modalita={modalita}
            onInviato={ricarica}
          />
        </View>
      ) : null}
    </View>
  );
}

function Riepilogo({ dettaglio }: { dettaglio: DettaglioSegnalazione }) {
  const { breakpoint } = useBreakpoint();
  return (
    <Card title="Riepilogo segnalazione">
      <View style={styles.griglia}>
        <Riga label="Stato" valore={<Badge status={dettaglio.statoBadge} />} />
        <Riga label="Priorità" valore={dettaglio.etichettaPriorita} />
        <Riga label="Categoria" valore={dettaglio.categoriaNome ?? 'Generale'} />
        <Riga label="Ambito" valore={dettaglio.etichettaAmbito} />
        <Riga label="Segnalata da" valore={dettaglio.segnalatoreNome} />
        <Riga label="Data di apertura" valore={formatDate(dettaglio.createdAt)} />
        <Riga
          label="Data di chiusura"
          valore={dettaglio.closedAt ? formatDate(dettaglio.closedAt) : 'Non ancora chiusa'}
        />
        <View style={styles.descrizione}>
          <Text style={[textStyle('label', breakpoint), styles.secondario]}>Descrizione</Text>
          <Text style={[textStyle('body', breakpoint), styles.primario]}>
            {dettaglio.descrizione?.trim() || 'Nessuna descrizione inserita.'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function Foto({ allegati }: { allegati: readonly AllegatoTicket[] }) {
  const { breakpoint } = useBreakpoint();
  const [errore, setErrore] = useState(false);
  const foto = allegati.filter((a) => a.tipoFile === 'FOTO');
  return (
    <Card title="Foto del guasto">
      <View style={styles.griglia}>
        {foto.length === 0 ? (
          <Text style={[textStyle('body', breakpoint), styles.secondario]}>
            Nessuna foto allegata a questa segnalazione.
          </Text>
        ) : (
          foto.map((a) => (
            <View key={a.id} style={styles.fotoRiga}>
              <Text style={[textStyle('body', breakpoint), styles.primario, styles.fotoNome]}>{a.nomeFile}</Text>
              {a.disponibileNelloStorage && a.signedUrl ? (
                <Button
                  label="Apri foto"
                  variant="secondary"
                  accessibilityHint={`Apre la foto ${a.nomeFile} in una nuova scheda`}
                  onPress={async () => {
                    try {
                      await Linking.openURL(a.signedUrl!);
                    } catch {
                      setErrore(true);
                    }
                  }}
                />
              ) : (
                <Alert tone="info" message={MESSAGGIO_FOTO_NON_DISPONIBILE} />
              )}
            </View>
          ))
        )}
        {errore ? <Alert tone="error" message="Non è stato possibile aprire la foto. Riprova tra poco." /> : null}
      </View>
    </Card>
  );
}

function Cronologia({
  dettaglio,
  utenteId,
  condominioId,
  modalita,
  onInviato,
}: {
  dettaglio: DettaglioSegnalazione;
  utenteId: string;
  condominioId: string;
  modalita: ModalitaSegnalazioni;
  onInviato: () => void;
}) {
  const { breakpoint } = useBreakpoint();
  const [testo, setTesto] = useState('');
  const [errore, setErrore] = useState<string | undefined>();
  const [invio, setInvio] = useState(false);

  const invia = useCallback(async () => {
    if (invio) return;
    setErrore(undefined);
    setInvio(true);
    try {
      const esito = await services.segnalazioni.aggiungiMessaggio(utenteId, condominioId, dettaglio.id, testo, modalita);
      if (!esito.ok) {
        setErrore(esito.errore);
        return;
      }
      setTesto('');
      onInviato();
    } catch {
      setErrore('Non è stato possibile inviare il messaggio. Riprova tra poco.');
    } finally {
      setInvio(false);
    }
  }, [condominioId, dettaglio.id, invio, modalita, onInviato, testo, utenteId]);

  return (
    <Card title="Aggiornamenti">
      <View style={styles.griglia}>
        {dettaglio.messaggi.length === 0 ? (
          <Text style={[textStyle('body', breakpoint), styles.secondario]}>Nessun messaggio ancora.</Text>
        ) : (
          dettaglio.messaggi.map((m) => <Messaggio key={m.id} messaggio={m} />)
        )}
        <Textarea
          label="Nuovo messaggio"
          value={testo}
          onChangeText={setTesto}
          placeholder="Scrivi un aggiornamento sulla segnalazione"
          maxLength={1000}
          error={errore}
          disabled={invio}
        />
        <View style={styles.azione}>
          <Button label="Invia messaggio" loadingLabel="Invio in corso…" loading={invio} onPress={() => void invia()} />
        </View>
      </View>
    </Card>
  );
}

function Messaggio({ messaggio }: { messaggio: MessaggioTicket }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.messaggio}>
      <Text style={[textStyle('label', breakpoint), styles.primario]}>
        {messaggio.isProprioMessaggio ? 'Tu' : messaggio.mittenteNome} · {formatDate(messaggio.timestamp)}
      </Text>
      <Text style={[textStyle('body', breakpoint), styles.primario]}>{messaggio.messaggio}</Text>
    </View>
  );
}

function Riga({ label, valore }: { label: string; valore: React.ReactNode }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.riga}>
      <Text style={[textStyle('label', breakpoint), styles.secondario]}>{label}</Text>
      {typeof valore === 'string' ? (
        <Text style={[textStyle('body', breakpoint), styles.primario, styles.valore]}>{valore}</Text>
      ) : (
        valore
      )}
    </View>
  );
}

function Scheletro() {
  return (
    <View role="status" aria-label="Caricamento della segnalazione" style={styles.sezioni}>
      <Card>
        <View style={styles.griglia}>
          <Skeleton width="45%" height={space[6]} />
          <SkeletonText lines={4} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  sezioni: { gap: space[6] },
  griglia: { gap: space[4] },
  riga: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
    paddingBottom: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  descrizione: { gap: space[2] },
  valore: { flexShrink: 1 },
  primario: { color: colors.text.primary },
  secondario: { color: colors.text.secondary },
  fotoRiga: { gap: space[2], alignItems: 'flex-start' },
  fotoNome: { flexShrink: 1 },
  messaggio: {
    gap: space[1],
    paddingBottom: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  azione: { alignItems: 'flex-start' },
});
