import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  DataTable,
  DatePicker,
  FileUpload,
  FilterChips,
  MobileDataList,
  NotificationPanel,
  Pagination,
  ResponsiveDataView,
  SearchBar,
  colors,
  feedbackSizes,
  formatDate,
  formatEuro,
  formatFileSize,
  layout,
  sortRows,
  space,
  tabularNumbers,
  textStyle,
  useBreakpoint,
  useToast,
  type BadgeStatus,
  type DataColumn,
  type FileUploadItem,
  type NotificationItem,
  type PickedFile,
  type SortState,
} from '@iocondo/ui';
import { Demo, Row, Section } from './parts';

/** Tutti i dati di questa pagina sono finti: servono solo a provare i componenti. */
interface Rata {
  id: string;
  descrizione: string;
  scadenza: string;
  importo: number;
  stato: Extract<BadgeStatus, 'pagato' | 'da-pagare' | 'scaduto'>;
}

const RATE: readonly Rata[] = [
  { id: 'r1', descrizione: 'Rata 1 · Spese ordinarie', scadenza: '2025-01-31', importo: 2480, stato: 'pagato' },
  { id: 'r2', descrizione: 'Rata 2 · Spese ordinarie', scadenza: '2025-02-28', importo: 2480, stato: 'pagato' },
  { id: 'r3', descrizione: 'Rata 3 · Spese ordinarie', scadenza: '2025-03-31', importo: 2480, stato: 'pagato' },
  { id: 'r4', descrizione: 'Rata 4 · Spese ordinarie', scadenza: '2025-04-28', importo: 2480, stato: 'scaduto' },
  { id: 'r5', descrizione: 'Rata 5 · Spese ordinarie', scadenza: '2025-05-30', importo: 2480, stato: 'da-pagare' },
  { id: 'r6', descrizione: 'Rata straordinaria · Facciata', scadenza: '2025-06-15', importo: 12350.5, stato: 'da-pagare' },
  { id: 'r7', descrizione: 'Rata 6 · Spese ordinarie', scadenza: '2025-06-30', importo: 2480, stato: 'da-pagare' },
  { id: 'r8', descrizione: 'Conguaglio riscaldamento', scadenza: '2025-03-10', importo: 186.4, stato: 'scaduto' },
  { id: 'r9', descrizione: 'Rata 7 · Spese ordinarie', scadenza: '2025-07-31', importo: 2480, stato: 'da-pagare' },
  { id: 'r10', descrizione: 'Fondo cassa', scadenza: '2025-02-15', importo: 95, stato: 'pagato' },
];

const STATI = [
  { value: 'da-pagare', label: 'Da pagare' },
  { value: 'pagato', label: 'Pagati' },
  { value: 'scaduto', label: 'Scaduti' },
];
const PAGE_SIZE = 4;

const sortValue = (row: Rata, key: string) => {
  if (key === 'importo') return row.importo;
  if (key === 'scadenza') return row.scadenza;
  if (key === 'stato') return row.stato;
  return row.descrizione;
};

const rateEmpty = {
  title: 'Non ci sono rate',
  description: 'Non ci sono ancora rate da mostrare. Appariranno qui appena saranno emesse.',
  icon: 'coins' as const,
};

export function DataDemoSections() {
  return (
    <>
      <FormattingDemo />
      <TablesDemo />
      <NotificationsDemo />
      <DatePickerDemo />
      <FileUploadDemo />
    </>
  );
}

function FormattingDemo() {
  const { breakpoint } = useBreakpoint();
  const lead = [textStyle('body', breakpoint), styles.lead];
  const amounts = [2480, 12350.5, 186.4, 95, 0];
  return (
    <Section title="Formattazione (importi, date, file)">
      <Demo caption="Importi in euro con cifre tabellari: le virgole stanno in colonna">
        <View style={styles.amounts}>
          {amounts.map((value) => (
            <Text key={value} style={[textStyle('body', breakpoint), styles.amount, tabularNumbers]}>
              {formatEuro(value)}
            </Text>
          ))}
        </View>
      </Demo>
      <Demo caption="Date, pesi dei file e valori mancanti">
        <Text style={lead}>{`${formatDate('2025-04-28')} · ${formatDate(new Date(2025, 11, 5))} · ${formatDate(null)}`}</Text>
        <Text style={lead}>{`${formatFileSize(850_000)} · ${formatFileSize(1_234_567)} · ${formatEuro(null)}`}</Text>
      </Demo>
    </Section>
  );
}

function TablesDemo() {
  const toast = useToast();
  const { breakpoint } = useBreakpoint();
  const lead = [textStyle('secondary', breakpoint), styles.lead];
  const [sort, setSort] = useState<SortState | null>({ key: 'scadenza', direction: 'ascending' });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState('Nessuna rata aperta.');

  const columns: DataColumn<Rata>[] = [
    { key: 'descrizione', header: 'Rata', cell: (r) => r.descrizione, sortable: true, minWidth: 220, weight: 2 },
    { key: 'scadenza', header: 'Scadenza', cell: (r) => formatDate(r.scadenza), sortable: true, minWidth: 130 },
    { key: 'importo', header: 'Importo', cell: (r) => formatEuro(r.importo), align: 'end', sortable: true, minWidth: 130 },
    { key: 'stato', header: 'Stato', cell: (r) => <Badge status={r.stato} />, sortable: true, minWidth: 150, mobile: 'status' },
  ];

  const filtered = RATE.filter(
    (rata) =>
      (statusFilter.length === 0 || statusFilter.includes(rata.stato)) &&
      rata.descrizione.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const sorted = sortRows(filtered, sort, sortValue);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const shared = {
    columns,
    getRowKey: (r: Rata) => r.id,
    getRowLabel: (r: Rata) => r.descrizione,
    empty: rateEmpty,
  };
  const actions = (r: Rata) => [
    { key: 'open', label: 'Vedi dettaglio', icon: 'file-text' as const, onPress: () => setOpened(`Dettaglio: ${r.descrizione}`) },
    { key: 'pay', label: 'Paga la rata', icon: 'credit-card' as const, disabled: r.stato === 'pagato', onPress: () => setOpened(`Pagamento: ${r.descrizione}`) },
  ];
  const openRow = (r: Rata) => {
    setOpened(`Aperta: ${r.descrizione}`);
    toast.show({ tone: 'info', message: `Aperta “${r.descrizione}”.` });
  };

  return (
    <>
      <Section title="ResponsiveDataView">
        <Text style={lead}>
          Una sola definizione di colonne: tabella da tablet in su, schede su smartphone. Filtri, ricerca e paginazione sono del chiamante.
        </Text>
        <ResponsiveDataView
          {...shared}
          label="Rate del condominio"
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPage(1);
          }}
          onRowPress={openRow}
          rowActions={actions}
          filters={
            <View style={styles.filters}>
              <SearchBar
                showLabel
                label="Cerca una rata"
                placeholder="Per esempio “Rata 3”"
                value={search}
                onChangeText={(text) => {
                  setSearch(text);
                  setPage(1);
                }}
              />
              <FilterChips
                label="Filtra per stato"
                multiple
                options={STATI}
                value={statusFilter}
                onChange={(next) => {
                  setStatusFilter(next);
                  setPage(1);
                }}
              />
            </View>
          }
          rows={visible}
          empty={{ ...rateEmpty, title: 'Nessuna rata trovata', description: 'Prova a cambiare la ricerca o ad azzerare i filtri.' }}
          pagination={<Pagination page={current} pageCount={pageCount} onChange={setPage} />}
        />
        <Text style={lead}>{`${sorted.length} rate trovate. ${opened}`}</Text>
      </Section>

      <Section title="DataTable">
        <Demo caption="Normale: ordinabile, righe selezionabili, azioni nell’ultima colonna">
          <DataTable
            {...shared}
            label="Rate (tabella)"
            rows={RATE.slice(0, 5)}
            sort={sort}
            onSortChange={setSort}
            onRowPress={openRow}
            rowActions={actions}
          />
        </Demo>
        <Demo caption="Solo lettura, senza ordinamento né azioni">
          <DataTable {...shared} label="Rate (sola lettura)" rows={RATE.slice(0, 3)} />
        </Demo>
        <Demo caption="Riquadro stretto: la tabella scorre in orizzontale solo dentro il suo riquadro">
          <View style={styles.narrow}>
            <DataTable {...shared} label="Rate (riquadro stretto)" rows={RATE.slice(0, 4)} rowActions={actions} />
          </View>
        </Demo>
        <Demo caption="Caricamento">
          <DataTable {...shared} label="Rate (caricamento)" rows={[]} loading />
        </Demo>
        <Demo caption="Vuoto">
          <DataTable {...shared} label="Rate (vuoto)" rows={[]} />
        </Demo>
        <Demo caption="Errore, con “Riprova”">
          <DataTable
            {...shared}
            label="Rate (errore)"
            rows={[]}
            error
            onRetry={() => {
              toast.show({ tone: 'info', message: 'Nuovo tentativo avviato.' });
            }}
          />
        </Demo>
      </Section>

      <Section title="MobileDataList">
        <Demo caption="Normale: tutta la scheda è selezionabile, il menu ha le azioni">
          <MobileDataList {...shared} label="Rate (schede)" rows={RATE.slice(0, 3)} onRowPress={openRow} rowActions={actions} />
        </Demo>
        <Demo caption="Senza dettaglio né azioni">
          <MobileDataList {...shared} label="Rate (schede, sola lettura)" rows={RATE.slice(0, 2)} />
        </Demo>
        <Demo caption="Caricamento">
          <MobileDataList {...shared} label="Rate (caricamento)" rows={[]} loading loadingRows={2} />
        </Demo>
        <Demo caption="Vuoto">
          <MobileDataList {...shared} label="Rate (vuoto)" rows={[]} />
        </Demo>
        <Demo caption="Errore, con “Riprova”">
          <MobileDataList
            {...shared}
            label="Rate (errore)"
            rows={[]}
            error={{ title: 'Non riusciamo a mostrare le rate', description: 'Controlla la connessione e riprova.' }}
            onRetry={() => {
              toast.show({ tone: 'info', message: 'Nuovo tentativo avviato.' });
            }}
          />
        </Demo>
      </Section>
    </>
  );
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', title: 'Rata in scadenza', text: 'La rata 5 scade il 30 maggio. Puoi pagarla dalla sezione Spese.', date: '2025-05-27', read: false },
  { id: 'n2', title: 'Nuovo documento', text: 'È disponibile il verbale dell’assemblea del 12 maggio.', date: '2025-05-13', read: false },
  { id: 'n3', title: 'Intervento programmato', text: 'Giovedì dalle 9 alle 12 verrà controllato l’ascensore.', date: '2025-05-08', read: true },
  { id: 'n4', title: 'Segnalazione risolta', text: 'La luce rotta al piano 2 è stata riparata.', date: '2025-04-30', read: true },
];

function NotificationsDemo() {
  const { breakpoint } = useBreakpoint();
  const lead = [textStyle('secondary', breakpoint), styles.lead];
  const [items, setItems] = useState(INITIAL_NOTIFICATIONS);
  const [selected, setSelected] = useState('Nessuna notifica aperta.');
  return (
    <Section title="NotificationPanel">
      <Demo caption="Con notifiche (2 non lette): “Segna tutte come lette” aggiorna contatore ed elenco">
        <Row>
          <NotificationPanel
            notifications={items}
            onMarkAllRead={() => setItems((current) => current.map((item) => ({ ...item, read: true })))}
            onSelect={(item) => setSelected(`Aperta: ${item.title}`)}
          />
          <Button variant="secondary" label="Ripristina le non lette" onPress={() => setItems(INITIAL_NOTIFICATIONS)} />
        </Row>
        <Text style={lead}>{selected}</Text>
      </Demo>
      <Demo caption="Senza notifiche">
        <NotificationPanel notifications={[]} onMarkAllRead={() => undefined} label="Notifiche (vuoto)" />
      </Demo>
      <Demo caption="Caricamento">
        <NotificationPanel notifications={[]} onMarkAllRead={() => undefined} loading label="Notifiche (caricamento)" />
      </Demo>
    </Section>
  );
}

function DatePickerDemo() {
  const [empty, setEmpty] = useState<Date | null>(null);
  const [filled, setFilled] = useState<Date | null>(new Date(2025, 3, 28));
  const [ranged, setRanged] = useState<Date | null>(null);
  const [forced, setForced] = useState<Date | null>(null);
  return (
    <Section title="DatePicker">
      <View style={styles.fields}>
        <DatePicker label="Data di scadenza" value={empty} onChange={setEmpty} />
        <DatePicker label="Data dell’assemblea" value={filled} onChange={setFilled} required />
        <DatePicker
          label="Data del pagamento (solo 2025)"
          value={ranged}
          onChange={setRanged}
          min={new Date(2025, 0, 1)}
          max={new Date(2025, 11, 31)}
          helperText="Puoi scegliere una data tra il 01/01/2025 e il 31/12/2025."
        />
        <DatePicker
          label="Data con errore del modulo"
          value={forced}
          onChange={setForced}
          error="Scegli la data di scadenza per continuare."
        />
        <DatePicker label="Data non modificabile" value={new Date(2025, 5, 15)} onChange={() => undefined} disabled />
      </View>
    </Section>
  );
}

const CERTIFICATE_FILES: FileUploadItem[] = [
  { id: 'f1', name: 'verbale-assemblea.pdf', size: 850_000, status: 'completato' },
  { id: 'f2', name: 'preventivo-facciata.pdf', size: 2_300_000, status: 'in-caricamento', progress: 0.45 },
  { id: 'f3', name: 'foto-guasto.jpg', size: 4_100_000, status: 'pronto' },
  { id: 'f4', name: 'contratto-ascensore.pdf', size: 1_200_000, status: 'errore', error: 'Non è stato possibile caricare il file. Controlla la connessione e riprova.' },
];

function FileUploadDemo() {
  const { breakpoint } = useBreakpoint();
  const lead = [textStyle('secondary', breakpoint), styles.lead];
  const [single, setSingle] = useState<FileUploadItem[]>([]);
  const [multi, setMulti] = useState<FileUploadItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    const running = timers.current;
    return () => Object.values(running).forEach(clearInterval);
  }, []);

  // Solo per la prova: avanzamento simulato. Un file con "errore" nel nome fallisce, e riprovando riesce.
  const simulate = (id: string, fails: boolean) => {
    let progress = 0;
    const update = (patch: Partial<FileUploadItem>) =>
      setMulti((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    update({ status: 'in-caricamento', progress: 0, error: undefined });
    timers.current[id] = setInterval(() => {
      progress += 0.25;
      if (fails && progress >= 0.5) {
        clearInterval(timers.current[id]);
        return update({ status: 'errore', progress: undefined, error: 'Non è stato possibile caricare il file. Controlla la connessione e riprova.' });
      }
      if (progress >= 1) {
        clearInterval(timers.current[id]);
        return update({ status: 'completato', progress: undefined });
      }
      update({ progress });
    }, 500);
  };

  const addMulti = (picked: PickedFile[]) => {
    setMulti((list) => [...list, ...picked.map((file) => ({ id: file.id, name: file.name, size: file.size, type: file.type, status: 'pronto' as const }))]);
    picked.forEach((file) => simulate(file.id, file.name.toLowerCase().includes('errore')));
  };

  return (
    <Section title="FileUpload">
      <Text style={lead}>
        Il componente non carica nulla: espone solo i callback. L’avanzamento qui sotto è simulato nella pagina di prova (un file con “errore” nel nome fallisce).
      </Text>
      <View style={styles.fields}>
        <Demo caption="Un solo file: PDF, massimo 5 MB">
          <FileUpload
            label="Verbale firmato"
            required
            accept={['application/pdf']}
            maxSizeBytes={5_000_000}
            files={single}
            onFilesSelected={(picked) =>
              setSingle(picked.map((file) => ({ id: file.id, name: file.name, size: file.size, type: file.type, status: 'pronto' })))
            }
            onRemove={(file) => setSingle((list) => list.filter((item) => item.id !== file.id))}
          />
        </Demo>
        <Demo caption="Più file: PDF e immagini, massimo 5 MB, fino a 4 file">
          <FileUpload
            label="Allegati della segnalazione"
            multiple
            accept={['application/pdf', 'image/*']}
            maxSizeBytes={5_000_000}
            maxFiles={4}
            files={multi}
            onFilesSelected={addMulti}
            onRemove={(file) => {
              clearInterval(timers.current[file.id]);
              setMulti((list) => list.filter((item) => item.id !== file.id));
            }}
            onRetry={(file) => simulate(file.id, false)}
          />
        </Demo>
        <Demo caption="Tutti gli stati: caricato, in corso, pronto, errore">
          <FileUpload
            label="Documenti dell’assemblea"
            multiple
            files={CERTIFICATE_FILES}
            onFilesSelected={() => undefined}
            onRemove={() => undefined}
            onRetry={() => undefined}
          />
        </Demo>
        <Demo caption="Con errore del modulo">
          <FileUpload
            label="Documento d’identità"
            files={[]}
            error="Allega il documento per continuare."
            onFilesSelected={() => undefined}
            onRemove={() => undefined}
          />
        </Demo>
        <Demo caption="Non modificabile">
          <FileUpload label="Allegati bloccati" files={[]} disabled onFilesSelected={() => undefined} onRemove={() => undefined} />
        </Demo>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.text.secondary },
  amounts: { alignSelf: 'flex-start', gap: space[1], alignItems: 'flex-end' },
  amount: { color: colors.text.primary },
  filters: { gap: space[4] },
  narrow: { maxWidth: feedbackSizes.modalMaxWidth, alignSelf: 'stretch' },
  fields: { gap: space[5], maxWidth: layout.formMaxWidth, width: '100%' },
});
