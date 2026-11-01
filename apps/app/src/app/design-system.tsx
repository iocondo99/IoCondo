import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingState,
  Modal,
  ModalActions,
  NonAutorizzato,
  RadioGroup,
  Select,
  Skeleton,
  SkeletonText,
  StatCard,
  Textarea,
  useToast,
  badgeStatuses,
  borderWidths,
  colors,
  layout,
  radii,
  space,
  textStyle,
  useBreakpoint,
  type BadgeStatus,
} from '@iocondo/ui';

/** Pagina di collaudo del design system: esiste solo in sviluppo. Tutti i dati qui sono finti. */
export default function DesignSystemRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DesignSystemPage />;
}

const DEMO_OPTIONS = [
  { value: 'a', label: 'Scala A' },
  { value: 'b', label: 'Scala B' },
  { value: 'c', label: 'Scala C' },
  { value: 'd', label: 'Scala D (non disponibile)', disabled: true },
];

const DEMO_RADIOS = [
  { value: 'email', label: 'Email', helperText: 'Ricevi un messaggio all’indirizzo indicato.' },
  { value: 'sms', label: 'SMS' },
  { value: 'posta', label: 'Lettera', disabled: true },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[textStyle('h3', breakpoint), styles.sectionTitle]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Demo({ caption, children }: { caption: string; children: React.ReactNode }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.demo}>
      <Text style={[textStyle('label', breakpoint), styles.caption]}>{caption}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function DesignSystemPage() {
  const { breakpoint, isMobile, isTablet } = useBreakpoint();
  // Colonne della griglia a schede (sez. 16): 1 su smartphone, 2 su tablet, 4 su desktop.
  const cell = [styles.cell, { flexBasis: isMobile ? '100%' : isTablet ? '47%' : '23%' }] as const;
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(true);
  const [agreeOff, setAgreeOff] = useState(false);
  const [contact, setContact] = useState<string | null>('email');
  const [stair, setStair] = useState<string | null>(null);
  const [stairSet, setStairSet] = useState<string | null>('b');
  const [email, setEmail] = useState('maria@esempio');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmFailOpen, setConfirmFailOpen] = useState(false);
  const [confirmFieldsOpen, setConfirmFieldsOpen] = useState(false);
  const [expenseType, setExpenseType] = useState<string | null>(null);
  const [modalNote, setModalNote] = useState('');
  const [modalCheck, setModalCheck] = useState(false);
  const [modalRadio, setModalRadio] = useState<string | null>(null);
  const [modalSelect, setModalSelect] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [confirmCheck, setConfirmCheck] = useState(false);

  const send = () =>
    new Promise<void>((resolve) => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        resolve();
      }, 1800);
    });

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[textStyle('h1', breakpoint), styles.title]}>
        Design system
      </Text>
      <Text style={[textStyle('body', breakpoint), styles.lead]}>
        Pagina di collaudo, visibile solo in sviluppo. I dati sono finti.
      </Text>

      <Section title="Pulsanti">
        <Demo caption="Primario">
          <Row>
            <Button label="Salva modifiche" />
            <Button label="Paga una rata" icon="credit-card" />
            <Button label="Non disponibile" disabled />
            <Button label="Invio in corso…" loading />
          </Row>
        </Demo>
        <Demo caption="Primario con caricamento reale (clicca: il doppio invio è bloccato)">
          <Button label="Invia segnalazione" loadingLabel="Invio in corso…" loading={loading} onPress={send} />
        </Demo>
        <Demo caption="Secondario">
          <Row>
            <Button variant="secondary" label="Annulla" />
            <Button variant="secondary" label="Visualizza dettagli" />
            <Button variant="secondary" label="Torna indietro" disabled />
          </Row>
        </Demo>
        <Demo caption="Testuale">
          <Row>
            <Button variant="text" label="Vedi tutti" />
            <Button variant="text" label="Leggi comunicazione" />
            <Button variant="text" label="Non disponibile" disabled />
          </Row>
        </Demo>
        <Demo caption="Distruttivo">
          <Row>
            <Button variant="destructive" label="Elimina documento" icon="x" />
            <Button variant="destructive" label="Elimina documento" disabled />
          </Row>
        </Demo>
        <Demo caption="Solo icona (con nome accessibile)">
          <Row>
            <IconButton icon="bell" accessibilityLabel="Apri le notifiche" />
            <IconButton icon="search" accessibilityLabel="Cerca" variant="secondary" />
            <IconButton icon="settings" accessibilityLabel="Apri le impostazioni" disabled />
          </Row>
        </Demo>
      </Section>

      <Section title="Campi di testo">
        <View style={styles.fields}>
          <Input label="Nome e cognome" placeholder="Es. Maria Rossi" helperText="Come compare nelle comunicazioni." />
          <Input
            label="Email"
            required
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            error="L’indirizzo email non è valido. Controlla il formato e riprova."
          />
          <Input label="Codice fiscale" value="Campo confermato" success="Il codice è stato verificato." />
          <Input label="Condominio" value="Condominio Primavera" disabled helperText="Non modificabile." />
          <Input
            variant="password"
            label="Password"
            required
            value={password}
            onChangeText={setPassword}
            helperText="Almeno 8 caratteri."
          />
          <Textarea label="Descrizione del problema" value={note} onChangeText={setNote} helperText="Descrivi cosa succede, con parole semplici." />
          <Textarea label="Note dell’amministratore" value="Testo di esempio non modificabile." disabled />
        </View>
      </Section>

      <Section title="Scelte">
        <View style={styles.fields}>
          <Checkbox label="Accetto il trattamento dei dati" checked={agree} onChange={setAgree} />
          <Checkbox
            label="Ricevi avvisi via email"
            helperText="Puoi cambiare idea in ogni momento."
            checked={agreeOff}
            onChange={setAgreeOff}
          />
          <Checkbox label="Opzione bloccata" checked={false} onChange={() => undefined} disabled />
          <Checkbox label="Accetto le condizioni" checked={false} onChange={() => undefined} error="Per continuare devi accettare le condizioni." />
          <RadioGroup label="Come vuoi essere avvisato?" options={DEMO_RADIOS} value={contact} onChange={setContact} />
          <RadioGroup
            label="Scegli il tipo di spesa"
            options={[{ value: 'o', label: 'Ordinaria' }, { value: 'x', label: 'Straordinaria' }]}
            value={expenseType}
            onChange={setExpenseType}
            error={expenseType ? undefined : 'Scegli un’opzione per continuare.'}
          />
        </View>
      </Section>

      <Section title="Select">
        <View style={styles.fields}>
          <Select label="Scala" options={DEMO_OPTIONS} value={stair} onChange={setStair} helperText="Scegli la tua scala." />
          <Select label="Scala (con scelta)" options={DEMO_OPTIONS} value={stairSet} onChange={setStairSet} required />
          <Select label="Scala (errore)" options={DEMO_OPTIONS} value={null} onChange={() => undefined} error="Scegli una scala." />
          <Select label="Scala (bloccata)" options={DEMO_OPTIONS} value="a" onChange={() => undefined} disabled />
        </View>
      </Section>

      <Section title="Badge">
        <Row>
          {(Object.keys(badgeStatuses) as BadgeStatus[]).map((status) => (
            <Badge key={status} status={status} />
          ))}
        </Row>
      </Section>

      <Section title="Card">
        <View style={styles.grid}>
          <View style={cell}>
            <Card
              title="Ultime comunicazioni"
              action={{
                label: 'Vedi tutte',
                onPress: () => toast.show({ tone: 'info', message: 'Aperta la lista delle comunicazioni.' }),
              }}
            >
              <Text style={[textStyle('body', breakpoint), styles.lead]}>
                Contenuto della scheda con titolo e azione.
              </Text>
            </Card>
          </View>
          <View style={cell}>
            <Card>
              <Text style={[textStyle('body', breakpoint), styles.lead]}>Scheda senza titolo né azione.</Text>
            </Card>
          </View>
        </View>
      </Section>

      <Section title="StatCard">
        <View style={styles.grid}>
          <View style={cell}>
            <StatCard
              icon="coins"
              tile="blue"
              title="Spese condominiali"
              value="€ 2.480,00"
              description="Totale da pagare"
              action={{
                label: 'Paga ora',
                onPress: () => toast.show({ tone: 'info', message: 'Prova: nessun pagamento è stato avviato.' }),
              }}
            />
          </View>
          <View style={cell}>
            <StatCard
              icon="message-circle"
              tile="teal"
              title="Comunicazioni"
              value="3"
              description="Nuovi messaggi"
              status="non-letto"
              action={{ label: 'Vai ai messaggi', variant: 'secondary', onPress: () => undefined }}
            />
          </View>
          <View style={cell}>
            <StatCard
              icon="file-text"
              tile="navy"
              title="Documenti"
              value="5"
              description="Documenti disponibili (senza azione)"
            />
          </View>
          <View style={cell}>
            <StatCard
              icon="users"
              tile="violet"
              title="Assemblea"
              value="12 mag 2025"
              description="Prossima assemblea"
              action={{ label: 'Dettagli', variant: 'secondary', onPress: () => undefined }}
            />
          </View>
        </View>
      </Section>

      <Section title="Alert">
        <View style={styles.fields}>
          <Alert tone="success" message="Documento caricato correttamente." />
          <Alert tone="warning" title="Scadenza vicina" message="La scadenza è prevista per domani." />
          <Alert
            tone="error"
            message="Non è stato possibile salvare le modifiche. Riprova."
            onDismiss={() => undefined}
          />
          <Alert tone="info" message="Sono disponibili nuovi documenti." onDismiss={() => undefined} />
          <Alert
            tone="error"
            persistent
            title="Pagamento non completato"
            message="Il pagamento della rata di maggio non è andato a buon fine. Riprova per evitare ritardi."
            action={{ label: 'Riprova il pagamento', onPress: () => undefined }}
          />
          <Alert tone="warning" persistent message="La sessione sta per scadere. Salva il lavoro." />
        </View>
      </Section>

      <Section title="Toast">
        <Row>
          <Button
            variant="secondary"
            label="Mostra successo"
            onPress={() => void toast.show({ tone: 'success', message: 'Segnalazione inviata correttamente.' })}
          />
          <Button
            variant="secondary"
            label="Mostra errore"
            onPress={() => void toast.show({ tone: 'error', message: 'Non è stato possibile salvare. Riprova.' })}
          />
          <Button
            variant="secondary"
            label="Mostra con azione"
            onPress={() =>
              void toast.show({
                tone: 'info',
                title: 'Documento archiviato',
                message: 'Puoi ripristinarlo entro 30 giorni.',
                action: { label: 'Annulla', onPress: () => undefined },
              })
            }
          />
          <Button
            variant="secondary"
            label="Tre messaggi in fila"
            onPress={() => {
              toast.show({ tone: 'info', message: 'Primo messaggio.' });
              toast.show({ tone: 'warning', message: 'Secondo messaggio: aspetta in coda.' });
              toast.show({ tone: 'success', message: 'Terzo messaggio.' });
            }}
          />
        </Row>
      </Section>

      <Section title="Modal e ConfirmDialog">
        <Row>
          <Button label="Apri una finestra" onPress={() => setModalOpen(true)} />
          <Button variant="destructive" label="Elimina documento" onPress={() => setConfirmOpen(true)} />
          <Button variant="destructive" label="Elimina (con errore)" onPress={() => setConfirmFailOpen(true)} />
          <Button variant="secondary" label="Conferma con campi" onPress={() => setConfirmFieldsOpen(true)} />
        </Row>
        <ConfirmDialog
          visible={confirmFieldsOpen}
          title="Archiviare la pratica?"
          description="La pratica sarà archiviata e non comparirà più tra quelle aperte."
          confirmLabel="Archivia pratica"
          destructive={false}
          onCancel={() => setConfirmFieldsOpen(false)}
          onConfirm={() => setConfirmFieldsOpen(false)}
        >
          <Input label="Motivo" placeholder="Es. lavori terminati" value={confirmText} onChangeText={setConfirmText} />
          <Textarea label="Note" />
          <Checkbox label="Ho capito le conseguenze" checked={confirmCheck} onChange={setConfirmCheck} />
          <RadioGroup label="Avvisare i condomini?" options={DEMO_RADIOS} value={modalRadio} onChange={setModalRadio} />
          <Select label="Scala" options={DEMO_OPTIONS} value={modalSelect} onChange={setModalSelect} />
        </ConfirmDialog>
        <Modal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Modifica il recapito"
          description="Inserisci un numero a cui possiamo contattarti."
          actions={
            <ModalActions>
              <Button variant="secondary" label="Annulla" onPress={() => setModalOpen(false)} />
              <Button
                label="Salva recapito"
                onPress={() => {
                  setModalOpen(false);
                  toast.show({ tone: 'success', message: 'Recapito salvato.' });
                }}
              />
            </ModalActions>
          }
        >
          <Input label="Telefono" placeholder="Es. 333 1234567" />
          <Textarea label="Note" value={modalNote} onChangeText={setModalNote} />
          <Checkbox label="Voglio ricevere avvisi" checked={modalCheck} onChange={setModalCheck} />
          <RadioGroup label="Come vuoi essere avvisato?" options={DEMO_RADIOS} value={modalRadio} onChange={setModalRadio} />
          <Select label="Scala" options={DEMO_OPTIONS} value={modalSelect} onChange={setModalSelect} />
          <Text style={[textStyle('body', breakpoint), styles.lead]}>
            Il contenuto della finestra scorre se è più alto dello schermo. {'Testo di riempimento. '.repeat(10)}
          </Text>
        </Modal>
        <ConfirmDialog
          visible={confirmOpen}
          title="Eliminare il documento?"
          description="Il documento “Bilancio 2025” sarà eliminato per tutti i condomini e non potrà essere recuperato."
          confirmLabel="Elimina documento"
          confirmLoadingLabel="Eliminazione in corso…"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setConfirmOpen(false);
            toast.show({ tone: 'success', message: 'Documento eliminato.' });
          }}
        />
        <ConfirmDialog
          visible={confirmFailOpen}
          title="Eliminare il documento?"
          description="Questa prova fallisce di proposito, per mostrare il messaggio d’errore."
          confirmLabel="Elimina documento"
          confirmLoadingLabel="Eliminazione in corso…"
          onCancel={() => setConfirmFailOpen(false)}
          onConfirm={async () => {
            await new Promise((resolve) => setTimeout(resolve, 800));
            throw new Error('prova');
          }}
        />
      </Section>

      <Section title="Stati di pagina">
        <Demo caption="Skeleton">
          <View style={styles.fields}>
            <Row>
              <Skeleton shape="circle" height={56} />
              <View style={styles.grow}>
                <SkeletonText lines={2} />
              </View>
            </Row>
            <Skeleton shape="block" />
          </View>
        </Demo>
        <Demo caption="LoadingState">
          <LoadingState />
        </Demo>
        <Demo caption="EmptyState">
          <EmptyState
            icon="file-text"
            title="Nessun documento"
            description="Non ci sono ancora documenti disponibili."
            action={{ label: 'Carica documento', onPress: () => undefined }}
          />
        </Demo>
        <Demo caption="ErrorState (Riprova attende un secondo)">
          <ErrorState onRetry={() => new Promise((resolve) => setTimeout(resolve, 1000))} />
        </Demo>
        <Demo caption="NonAutorizzato">
          <NonAutorizzato action={{ label: 'Torna alla Home', onPress: () => undefined }} />
        </Demo>
      </Section>

      <Section title="Avatar">
        <Row>
          <Avatar name="Maria Rossi" size="sm" />
          <Avatar name="Maria Rossi" size="md" />
          <Avatar name="Maria Rossi" size="lg" accessibilityLabel="Foto profilo di Maria Rossi" />
          <Avatar name="Luca" size="lg" />
          <Avatar name="Anna Maria De Luca" imageUri="https://immagine-inesistente.invalid/foto.png" size="lg" />
        </Row>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: space[4],
    paddingBottom: space[12],
    gap: space[6],
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  title: { color: colors.text.primary },
  lead: { color: colors.text.secondary },
  section: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: space[4],
    gap: space[5],
  },
  sectionTitle: { color: colors.brand.navy },
  demo: { gap: space[2] },
  caption: { color: colors.text.secondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: space[3] },
  cell: { flexGrow: 1, minWidth: 0 },
  grow: { flex: 1 },
  fields: { gap: space[5], maxWidth: layout.formMaxWidth, width: '100%' },
});
