import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  ErrorState,
  FilterChips,
  IconButton,
  Input,
  LoadingState,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  Pagination,
  RadioGroup,
  SearchBar,
  Select,
  Skeleton,
  SkeletonText,
  StatCard,
  Tabs,
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
  const [tab, setTab] = useState('da-pagare');
  const [page, setPage] = useState(2);
  const [pageLong, setPageLong] = useState(5);
  const [search, setSearch] = useState('');
  const [searchFilled, setSearchFilled] = useState('Bilancio 2025');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [multiFilter, setMultiFilter] = useState<string[]>(['scaduti']);
  const [lastAction, setLastAction] = useState('Nessuna azione scelta.');
  const demoCrumbs = (go: (name: string) => void) => [
    { label: 'Home', onPress: () => go('Home') },
    { label: 'Documenti', onPress: () => go('Documenti') },
    { label: 'Bilanci', onPress: () => go('Bilanci') },
    { label: 'Bilancio 2025' },
  ];
  const menuItems = [
    { key: 'edit', label: 'Modifica documento', icon: 'pencil' as const, onPress: () => setLastAction('Scelto: Modifica documento') },
    { key: 'open', label: 'Apri documento', icon: 'file-text' as const, onPress: () => setLastAction('Scelto: Apri documento') },
    { key: 'busy', label: 'Condividi (non disponibile)', disabled: true, onPress: () => undefined },
    { key: 'del', label: 'Elimina documento', destructive: true, onPress: () => setConfirmOpen(true) },
  ];
  const longMenuItems = Array.from({ length: 14 }, (_, index) => ({
    key: `v${index}`,
    label: `Voce di prova ${index + 1}`,
    onPress: () => setLastAction(`Scelto: Voce di prova ${index + 1}`),
  }));
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
          <Dropdown
            label="Azioni nella finestra"
            items={menuItems.map((item) =>
              item.destructive
                ? { ...item, onPress: () => void toast.show({ tone: 'info', message: 'Prova: nessun documento eliminato.' }) }
                : item,
            )}
          />
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

      <Section title="Tabs">
        <Tabs
          label="Sezioni dei pagamenti"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'da-pagare', label: 'Da pagare', content: <Text style={[textStyle('body', breakpoint), styles.lead]}>Elenco delle rate da pagare.</Text> },
            { key: 'pagati', label: 'Pagati', icon: 'circle-check', content: <Text style={[textStyle('body', breakpoint), styles.lead]}>Elenco delle rate già pagate.</Text> },
            { key: 'scaduti', label: 'Scaduti', content: <Text style={[textStyle('body', breakpoint), styles.lead]}>Elenco delle rate scadute.</Text> },
            { key: 'archivio', label: 'Archivio (non disponibile)', disabled: true, content: null },
            { key: 'altro', label: 'Altre voci con un nome molto lungo', content: <Text style={[textStyle('body', breakpoint), styles.lead]}>Contenuto dell’ultima scheda.</Text> },
          ]}
        />
      </Section>

      <Section title="Pagination">
        <Demo caption="Pagina 2 di 8">
          <Pagination page={page} pageCount={8} onChange={setPage} />
        </Demo>
        <Demo caption="Molte pagine">
          <Pagination page={pageLong} pageCount={24} onChange={setPageLong} />
        </Demo>
        <Demo caption="Una sola pagina: non compare nulla">
          <Pagination page={1} pageCount={1} onChange={() => undefined} />
        </Demo>
      </Section>

      <Section title="Breadcrumbs">
        <Demo caption="Percorso completo (su smartphone si accorcia)">
          <Breadcrumbs items={demoCrumbs((name) => setLastAction(`Aperto: ${name}`))} />
        </Demo>
        <Demo caption="Percorso breve">
          <Breadcrumbs items={[{ label: 'Home', onPress: () => undefined }, { label: 'Documenti' }]} />
        </Demo>
        <Text style={[textStyle('secondary', breakpoint), styles.lead]}>{lastAction}</Text>
      </Section>

      <Section title="Dropdown">
        <Row>
          <Dropdown label="Azioni" items={menuItems} />
          <Dropdown label="Altre azioni" iconOnly items={menuItems} align="end" />
          <Dropdown label="Menu lungo" items={longMenuItems} variant="primary" />
          <Dropdown label="Non disponibile" items={menuItems} disabled />
        </Row>
        <Text style={[textStyle('secondary', breakpoint), styles.lead]}>{lastAction}</Text>
      </Section>

      <Section title="PageHeader">
        <Demo caption="Completo: percorso, titolo, sottotitolo e azione">
          <PageHeader
            breadcrumbs={demoCrumbs(() => undefined)}
            title="Bilancio 2025"
            subtitle="Documento approvato dall’assemblea del 12 maggio."
            action={{ label: 'Carica documento', icon: 'file-text', onPress: () => undefined }}
          />
        </Demo>
        <Demo caption="Con pulsante Indietro">
          <PageHeader title="Dettaglio segnalazione" subtitle="Aperta il 3 maggio." onBack={() => setLastAction('Premuto: Indietro')} />
        </Demo>
        <Demo caption="Solo titolo">
          <PageHeader title="Documenti" />
        </Demo>
      </Section>

      <Section title="SearchBar">
        <View style={styles.fields}>
          <SearchBar value={search} onChangeText={setSearch} onSubmit={(text) => toast.show({ tone: 'info', message: `Ricerca inviata: “${text}”.` })} />
          <SearchBar value={searchFilled} onChangeText={setSearchFilled} showLabel label="Cerca nei documenti" />
          <SearchBar value={search} onChangeText={setSearch} compact placeholder="Cerca…" />
          <SearchBar value="" onChangeText={() => undefined} disabled />
        </View>
      </Section>

      <Section title="FilterChips">
        <View style={styles.fields}>
          <FilterChips
            label="Filtra per stato"
            options={[{ value: 'da-pagare', label: 'Da pagare' }, { value: 'pagati', label: 'Pagati' }, { value: 'scaduti', label: 'Scaduti' }]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <FilterChips
            label="Filtra per stato (più scelte)"
            multiple
            options={[{ value: 'da-pagare', label: 'Da pagare' }, { value: 'pagati', label: 'Pagati' }, { value: 'scaduti', label: 'Scaduti' }]}
            value={multiFilter}
            onChange={setMultiFilter}
          />
        </View>
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
