import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FiltriLog, ProblemaIntegrita, RigaLog, TipoRegistro } from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  DatePicker,
  Modal,
  ModalActions,
  PageHeader,
  Pagination,
  ResponsiveDataView,
  SearchBar,
  Select,
  Tabs,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  useBreakpoint,
  useToast,
  type BadgeStatus,
  type DataColumn,
  type SelectOption,
  type TabItem,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const PER_PAGINA = 50;

const REGISTRI: ReadonlyArray<{ key: TipoRegistro; label: string; descrizione: string }> = [
  {
    key: 'audit',
    label: 'Operazioni',
    descrizione: 'Chi ha creato, modificato o eliminato dati del condominio. Conservato a lungo (contabilità).',
  },
  {
    key: 'sicurezza',
    label: 'Sicurezza',
    descrizione: 'Accessi dei profili amministrativi, password, inviti, ruoli, eliminazioni e accessi negati. 7 mesi.',
  },
  {
    key: 'errori',
    label: 'Errori tecnici',
    descrizione: 'Errori dell’app e delle funzioni server, per la manutenzione. 30 giorni.',
  },
];

const ETICHETTE_AZIONI: Record<string, string> = {
  INSERT: 'Creazione',
  UPDATE: 'Modifica',
  DELETE: 'Eliminazione',
  ACCESSO: 'Accesso',
  ACCESSO_NEGATO: 'Accesso negato',
  PASSWORD_CAMBIATA: 'Password cambiata',
  INVITO_INVIATO: 'Invito inviato',
  RUOLO_ASSEGNATO: 'Ruolo assegnato',
  RUOLO_RIMOSSO: 'Ruolo rimosso',
  ACCOUNT_ELIMINATO: 'Account eliminato',
  ELIMINAZIONE_ACCOUNT: 'Eliminazione account',
  EMAIL_ACCODATE_CONVOCAZIONE_ASSEMBLEA: 'Convocazione inviata',
  EMAIL_ACCODATE_BOLLETTINO_EMESSO: 'Bollettini inviati',
  EMAIL_ACCODATE_COMUNICAZIONE_IMPORTANTE: 'Comunicazione inviata',
};

const etichettaAzione = (a: string) => ETICHETTE_AZIONI[a] ?? a.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

function badgeAzione(r: RigaLog): BadgeStatus {
  if (r.registro === 'errori') return r.esito === 'WARNING' ? 'warning' : 'error';
  if (r.esito === 'NEGATO' || r.esito === 'ERRORE') return 'error';
  if (r.azione === 'DELETE' || r.azione.includes('ELIMIN') || r.azione === 'RUOLO_RIMOSSO') return 'warning';
  if (r.azione === 'INSERT') return 'success';
  return 'info';
}

const formattaQuando = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const inizioGiorno = (d: Date | null) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString() : null);
const fineGiorno = (d: Date | null) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString() : null);

function valoreLeggibile(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function SuperAdminLogScreen() {
  const consentito = useAccessoConsentito();
  const { profilo } = useProfilo();
  if (!consentito || !profilo?.isSuperAdmin) return null;
  return <SuperAdminLogContenuto />;
}

function SuperAdminLogContenuto() {
  const { isMobile } = useBreakpoint();
  const toast = useToast();

  const [registro, setRegistro] = useState<TipoRegistro>('audit');
  const [dal, setDal] = useState<Date | null>(() => new Date(Date.now() - 7 * 86_400_000));
  const [al, setAl] = useState<Date | null>(null);
  const [condominioId, setCondominioId] = useState('');
  const [azione, setAzione] = useState('');
  const [categoria, setCategoria] = useState('');
  const [testo, setTesto] = useState('');
  const [pagina, setPagina] = useState(1);

  const [righe, setRighe] = useState<RigaLog[]>([]);
  const [totale, setTotale] = useState(0);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [dettaglio, setDettaglio] = useState<RigaLog | null>(null);

  const [condomini, setCondomini] = useState<SelectOption[]>([]);
  const [valori, setValori] = useState<{ azioni: string[]; categorie: string[] }>({ azioni: [], categorie: [] });

  const [verificaInCorso, setVerificaInCorso] = useState(false);
  const [problemi, setProblemi] = useState<ProblemaIntegrita[] | null>(null);

  useEffect(() => {
    services.log
      .condomini()
      .then((lista) => setCondomini(lista.map((c) => ({ value: c.id, label: c.nome }))))
      .catch(() => setCondomini([]));
  }, []);

  useEffect(() => {
    setAzione('');
    setCategoria('');
    setPagina(1);
    setProblemi(null);
    services.log.valoriFiltro(registro).then(setValori).catch(() => setValori({ azioni: [], categorie: [] }));
  }, [registro]);

  const filtri: FiltriLog = useMemo(
    () => ({
      dal: inizioGiorno(dal),
      al: fineGiorno(al),
      condominioId: condominioId || null,
      azione: azione || testo.trim() || null,
      categoria: categoria || null,
    }),
    [dal, al, condominioId, azione, testo, categoria],
  );

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const res = await services.log.elenca(registro, filtri, pagina, PER_PAGINA);
      setRighe(res.righe);
      setTotale(res.totale);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Impossibile caricare il registro.');
    } finally {
      setCaricamento(false);
    }
  }, [registro, filtri, pagina]);

  useEffect(() => {
    void carica();
  }, [carica]);

  useEffect(() => setPagina(1), [filtri]);

  const verifica = async () => {
    setVerificaInCorso(true);
    try {
      const esito = await services.log.verificaIntegrita();
      setProblemi(esito);
    } catch (e) {
      toast.show({ tone: 'error', message: e instanceof Error ? e.message : 'Verifica non riuscita.' });
    } finally {
      setVerificaInCorso(false);
    }
  };

  const azzera = () => {
    setDal(new Date(Date.now() - 7 * 86_400_000));
    setAl(null);
    setCondominioId('');
    setAzione('');
    setCategoria('');
    setTesto('');
  };

  const esportaCsv = () => {
    if (typeof document === 'undefined') return;
    const intest = ['Quando', 'Azione', 'Categoria', 'Utente', 'Condominio', 'Oggetto', 'Messaggio', 'Prima', 'Dopo', 'Dettagli'];
    const cella = (v: unknown) => `"${valoreLeggibile(v).replace(/"/g, '""')}"`;
    const linee = [intest.join(';')].concat(
      righe.map((r) =>
        [formattaQuando(r.quando), etichettaAzione(r.azione), r.categoria, r.utenteNome, r.condominioNome, r.oggetto, r.messaggio, r.prima, r.dopo, r.dettagli]
          .map(cella)
          .join(';'),
      ),
    );
    const blob = new Blob(['\uFEFF' + linee.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log-${registro}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const opzioniAzioni: SelectOption[] = [{ value: '', label: 'Tutte' }, ...valori.azioni.map((a) => ({ value: a, label: etichettaAzione(a) }))];
  const opzioniCategoria: SelectOption[] =
    registro === 'errori'
      ? [
          { value: '', label: 'Tutti' },
          { value: 'APP', label: 'App' },
          { value: 'SERVER', label: 'Server' },
          { value: 'ERROR', label: 'Solo errori' },
          { value: 'WARNING', label: 'Solo avvisi' },
        ]
      : registro === 'sicurezza'
        ? [
            { value: '', label: 'Tutti' },
            { value: 'OK', label: 'Riusciti' },
            { value: 'NEGATO', label: 'Negati' },
            { value: 'ERRORE', label: 'Errori' },
          ]
        : [{ value: '', label: 'Tutte' }, ...valori.categorie.map((c) => ({ value: c, label: c }))];
  const etichettaCategoria = registro === 'audit' ? 'Tabella' : registro === 'sicurezza' ? 'Esito' : 'Origine';

  const colonne: DataColumn<RigaLog>[] = [
    {
      key: 'quando',
      header: 'Quando',
      minWidth: 160,
      weight: 0,
      cell: (r) => <Text style={[styles.testoMuted, styles.cella]}>{formattaQuando(r.quando)}</Text>,
    },
    {
      key: 'azione',
      header: registro === 'errori' ? 'Contesto' : 'Azione',
      minWidth: 190,
      weight: 2,
      mobile: 'title',
      cell: (r) => (registro === 'errori' ? <Text style={styles.testoForte}>{r.azione}</Text> : <Badge status={badgeAzione(r)} label={etichettaAzione(r.azione)} />),
    },
    {
      key: 'categoria',
      header: etichettaCategoria,
      minWidth: 200,
      weight: 2,
      cell: (r) => <Text style={[styles.testoNormale, styles.cella]}>{r.categoria ?? '—'}</Text>,
    },
    {
      key: 'utente',
      header: 'Utente',
      minWidth: 170,
      weight: 2,
      cell: (r) => <Text style={[styles.testoNormale, styles.cella]}>{r.utenteNome ?? (r.utenteId ? '—' : 'Sistema')}</Text>,
    },
    {
      key: 'condominio',
      header: 'Condominio',
      minWidth: 160,
      weight: 2,
      cell: (r) => <Text style={[styles.testoNormale, styles.cella]}>{r.condominioNome ?? '—'}</Text>,
    },
    {
      key: 'info',
      header: registro === 'errori' ? 'Messaggio' : 'Oggetto',
      minWidth: 220,
      weight: 3,
      cell: (r) => (
        <Text style={[styles.testoNormale, styles.cella]} numberOfLines={2}>
          {(registro === 'errori' ? r.messaggio : r.oggetto ?? r.messaggio) ?? '—'}
        </Text>
      ),
    },
  ];

  const pagine = Math.max(1, Math.ceil(totale / PER_PAGINA));
  const descrizione = REGISTRI.find((r) => r.key === registro)?.descrizione ?? '';

  const contenuto = (
    <View style={styles.contenuto}>
      <Text style={[textStyle('secondary'), styles.testoMuted]}>{descrizione}</Text>

      <Card>
        <View style={styles.filtri}>
          <SearchBar
            value={testo}
            onChangeText={setTesto}
            label={registro === 'errori' ? 'Cerca per contesto' : 'Cerca per azione o evento'}
            placeholder={registro === 'errori' ? 'Es. accoda-email, /admin/contabilita…' : 'Es. RATA, INVITO, ACCESSO…'}
            showLabel
          />
          <View style={[styles.rigaFiltri, isMobile && styles.rigaFiltriMobile]}>
            <View style={[styles.cellaFiltro, isMobile && styles.cellaFiltroMobile]}>
              <DatePicker label="Dal" value={dal} onChange={setDal} max={al ?? undefined} />
            </View>
            <View style={[styles.cellaFiltro, isMobile && styles.cellaFiltroMobile]}>
              <DatePicker label="Al" value={al} onChange={setAl} min={dal ?? undefined} />
            </View>
            <View style={[styles.cellaFiltro, isMobile && styles.cellaFiltroMobile]}>
              <Select label="Condominio" options={[{ value: '', label: 'Tutti' }, ...condomini]} value={condominioId} onChange={setCondominioId} floating />
            </View>
            {registro !== 'errori' ? (
              <View style={[styles.cellaFiltro, isMobile && styles.cellaFiltroMobile]}>
                <Select label={registro === 'audit' ? 'Azione' : 'Evento'} options={opzioniAzioni} value={azione} onChange={setAzione} floating />
              </View>
            ) : null}
            <View style={[styles.cellaFiltro, isMobile && styles.cellaFiltroMobile]}>
              <Select label={etichettaCategoria} options={opzioniCategoria} value={categoria} onChange={setCategoria} floating />
            </View>
          </View>
          <View style={[styles.azioniFiltri, isMobile && styles.azioniFiltriMobile]}>
            <Text style={[textStyle('secondary'), styles.testoMuted]}>
              {caricamento ? 'Caricamento…' : `${totale.toLocaleString('it-IT')} ${totale === 1 ? 'voce' : 'voci'}`}
            </Text>
            <View style={styles.pulsantiFiltri}>
              <Button variant="text" label="Azzera filtri" icon="x" onPress={azzera} />
              <Button variant="secondary" label="Esporta CSV" icon="download" onPress={esportaCsv} disabled={righe.length === 0} />
              {registro === 'sicurezza' ? (
                <Button variant="secondary" label="Verifica integrità" icon="shield" onPress={() => void verifica()} loading={verificaInCorso} />
              ) : null}
            </View>
          </View>
          {problemi ? (
            problemi.length === 0 ? (
              <Alert tone="success" message="Registro integro: nessuna riga alterata o mancante." />
            ) : (
              <Alert tone="error" message={`Trovate ${problemi.length} anomalie nella catena di integrità. La prima: ${formattaQuando(problemi[0]!.created_at)} — ${problemi[0]!.problema}.`} />
            )
          ) : null}
        </View>
      </Card>

      {errore ? <Alert tone="error" message={errore} /> : null}

      <ResponsiveDataView<RigaLog>
        label={`Registro ${registro}`}
        columns={colonne}
        rows={righe}
        getRowKey={(r) => r.id}
        getRowLabel={(r) => `${etichettaAzione(r.azione)} — ${formattaQuando(r.quando)}`}
        onRowPress={setDettaglio}
        loading={caricamento}
        empty={{ icon: 'file-text', title: 'Nessuna voce', description: 'Nessuna registrazione corrisponde ai filtri scelti.' }}
        pagination={pagine > 1 ? <Pagination page={pagina} pageCount={pagine} onChange={setPagina} label="Pagine del registro" /> : null}
      />
    </View>
  );

  const tabs: TabItem[] = REGISTRI.map((r) => ({ key: r.key, label: r.label, content: r.key === registro ? contenuto : null }));

  const campiModifica = dettaglio ? [...new Set([...Object.keys(dettaglio.prima ?? {}), ...Object.keys(dettaglio.dopo ?? {})])] : [];

  return (
    <View style={styles.pagina}>
      <PageHeader title="Registro attività" subtitle="Consultazione dei log della piattaforma, riservata al super amministratore." />
      <Tabs label="Registri" tabs={tabs} value={registro} onChange={(k) => setRegistro(k as TipoRegistro)} />

      <Modal
        visible={!!dettaglio}
        onClose={() => setDettaglio(null)}
        title={dettaglio ? etichettaAzione(dettaglio.azione) : 'Dettaglio'}
        description={dettaglio ? formattaQuando(dettaglio.quando) : undefined}
        maxWidth={720}
        actions={
          <ModalActions>
            <Button variant="secondary" label="Chiudi" onPress={() => setDettaglio(null)} />
          </ModalActions>
        }
      >
        {dettaglio ? (
          <ScrollView style={styles.dettaglioScroll}>
            <View style={styles.dettaglio}>
              {([
                ['Utente', dettaglio.utenteNome ?? (dettaglio.utenteId ? '—' : 'Sistema')],
                ['Condominio', dettaglio.condominioNome ?? '—'],
                [etichettaCategoria, dettaglio.categoria ?? '—'],
                ['Oggetto', dettaglio.oggetto ?? '—'],
                ['Indirizzo IP', dettaglio.ip ?? '—'],
                ['Messaggio', dettaglio.messaggio ?? '—'],
              ] as const).map(([k, v]) => (
                <View key={k} style={styles.rigaDettaglio}>
                  <Text style={styles.etichetta}>{k}</Text>
                  <Text style={styles.valore} selectable>{v}</Text>
                </View>
              ))}

              {campiModifica.length > 0 ? (
                <View style={styles.tabellaModifiche}>
                  <View style={[styles.rigaModifica, styles.intestModifica]}>
                    <Text style={[styles.colCampo, styles.testoForte]}>Campo</Text>
                    <Text style={[styles.colValore, styles.testoForte]}>Prima</Text>
                    <Text style={[styles.colValore, styles.testoForte]}>Dopo</Text>
                  </View>
                  {campiModifica.map((campo) => (
                    <View key={campo} style={styles.rigaModifica}>
                      <Text style={[styles.colCampo, styles.testoNormale]}>{campo}</Text>
                      <Text style={[styles.colValore, styles.testoMuted]} selectable>{valoreLeggibile(dettaglio.prima?.[campo])}</Text>
                      <Text style={[styles.colValore, styles.testoNormale]} selectable>{valoreLeggibile(dettaglio.dopo?.[campo])}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {dettaglio.dettagli && Object.keys(dettaglio.dettagli).length > 0 ? (
                <View style={styles.rigaDettaglio}>
                  <Text style={styles.etichetta}>Dettagli</Text>
                  <Text style={[styles.valore, styles.codice]} selectable>
                    {JSON.stringify(dettaglio.dettagli, null, 2)}
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  contenuto: { gap: space[4], marginTop: space[3] },
  filtri: { gap: space[4] },
  rigaFiltri: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  rigaFiltriMobile: { flexDirection: 'column' },
  cellaFiltro: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 200 },
  // Su smartphone i filtri sono in colonna: flexBasis diventerebbe un'altezza (spazi vuoti).
  cellaFiltroMobile: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 0, width: '100%' },
  cella: { paddingRight: space[4], flexShrink: 1, minWidth: 0, ...({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as object) },
  azioniFiltri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], flexWrap: 'wrap' },
  azioniFiltriMobile: { flexDirection: 'column', alignItems: 'stretch' },
  pulsantiFiltri: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
  testoMuted: { ...textStyle('secondary'), color: colors.text.secondary },
  testoNormale: { ...textStyle('secondary'), color: colors.text.primary },
  testoForte: { ...textStyle('secondary'), color: colors.text.primary, fontWeight: '600' },
  dettaglioScroll: { maxHeight: 520 },
  dettaglio: { gap: space[3] },
  rigaDettaglio: { gap: 2 },
  etichetta: { ...textStyle('label'), color: colors.text.secondary },
  valore: { ...textStyle('body'), color: colors.text.primary },
  codice: { fontFamily: 'monospace', fontSize: 12, backgroundColor: colors.background, padding: space[2], borderRadius: radii.control },
  tabellaModifiche: { borderWidth: borderWidths.thin, borderColor: colors.border, borderRadius: radii.card, overflow: 'hidden' },
  rigaModifica: { flexDirection: 'row', gap: space[2], paddingVertical: space[2], paddingHorizontal: space[3], borderTopWidth: borderWidths.thin, borderTopColor: colors.border },
  intestModifica: { backgroundColor: colors.background, borderTopWidth: 0 },
  colCampo: { flex: 1, minWidth: 0 },
  colValore: { flex: 2, minWidth: 0 },
});
