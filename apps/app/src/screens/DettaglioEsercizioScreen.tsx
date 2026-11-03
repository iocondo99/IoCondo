import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  colonnaDaOrdineSpese,
  etichettaSegnoMovimento,
  filtraMovimentiSpese,
  opzioniFiltroMovimenti,
  ordinaMovimentiSpese,
  ordineDaColonnaSpese,
  paginaMovimentiSpese,
  PER_PAGINA_SPESE,
  statoBadgeEsercizio,
  type DettaglioEsercizioSpese,
  type DocumentoAllegatoSpese,
  type MovimentoSpesa,
  type OrdineMovimentiSpese,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  FilterChips,
  NonAutorizzato,
  PageHeader,
  Pagination,
  ResponsiveDataView,
  SearchBar,
  Skeleton,
  SkeletonText,
  borderWidths,
  colors,
  formatDate,
  formatEuro,
  radii,
  space,
  tabularNumbers,
  textStyle,
  useBreakpoint,
  type DataColumn,
  type SortState,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

/**
 * Dettaglio di un esercizio contabile (`/spese/[id]`), in sola lettura:
 * riepilogo dell'esercizio, totali per macro-categoria, documento allegato
 * (mostrato SOLO se esiste in `doc_allegato_id` e nello Storage, con link firmato a tempo),
 * ed elenco dei movimenti di spesa con filtri, ricerca, ordinamento e paginazione.
 */
export function DettaglioEsercizioScreen() {
  const consentito = useAccessoConsentito();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profilo, condominio, ruoli } = useProfilo();
  const router = useRouter();

  const esercizioId = (Array.isArray(id) ? id[0] : id)?.trim() ?? '';

  if (!consentito || !profilo || !condominio) return null;
  if (!ruoli.has('CONDOMINO') || !esercizioId) {
    return <EsercizioNonDisponibile onTorna={() => router.replace('/spese' as Href)} />;
  }
  return <DettaglioEsercizioContenuto esercizioId={esercizioId} condominioId={condominio.id} />;
}

/** Stesso identico messaggio per id inesistente, esercizio non pubblicato o di un altro condominio. */
function EsercizioNonDisponibile({ onTorna }: { onTorna: () => void }) {
  return (
    <NonAutorizzato
      title="Questo esercizio non è disponibile"
      description="Non puoi vedere questo esercizio contabile. Torna all’elenco per consultare le spese del condominio."
      action={{ label: 'Torna alle spese', icon: 'coins', onPress: onTorna }}
    />
  );
}

function DettaglioEsercizioContenuto({
  esercizioId,
  condominioId,
}: {
  esercizioId: string;
  condominioId: string;
}) {
  const router = useRouter();
  const { breakpoint } = useBreakpoint();
  const chiave = `${esercizioId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.spese.dettaglioEsercizio(esercizioId, condominioId),
    chiave,
  );

  // Ricarica al ritorno in primo piano.
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

  const [filtroCategoria, setFiltroCategoria] = useState<string>('tutti');
  const [ricerca, setRicerca] = useState('');
  const [ordine, setOrdine] = useState<OrdineMovimentiSpese>('data-desc');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    setFiltroCategoria('tutti');
    setRicerca('');
    setOrdine('data-desc');
    setPagina(1);
  }, [chiave]);

  const vaiASpese = useCallback(() => router.navigate('/spese' as Href), [router]);
  const indietro = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/spese' as Href)),
    [router],
  );

  const caricamento = blocco.stato === 'caricamento';
  const errore = blocco.stato === 'errore';
  const dettaglio: DettaglioEsercizioSpese | null = blocco.stato === 'pronto' ? blocco.dati : null;

  const breadcrumbs = [
    { label: 'Home', onPress: () => router.navigate('/home' as Href) },
    { label: 'Spese', onPress: vaiASpese },
    { label: dettaglio ? `Esercizio ${dettaglio.esercizio.anno}` : 'Dettaglio esercizio' },
  ];

  const opzioniFiltro = useMemo(() => {
    if (!dettaglio) return [];
    return opzioniFiltroMovimenti(dettaglio.movimenti)
      .filter((o) => o.value !== 'tutti')
      .map((o) => ({ value: o.value, label: `${o.label} (${o.count})` }));
  }, [dettaglio]);

  const movimentiFiltrati = useMemo(() => {
    if (!dettaglio) return [];
    const filtrati = filtraMovimentiSpese(dettaglio.movimenti, filtroCategoria, ricerca);
    return ordinaMovimentiSpese(filtrati, ordine);
  }, [dettaglio, filtroCategoria, ricerca, ordine]);

  const paginata = useMemo(
    () => paginaMovimentiSpese(movimentiFiltrati, pagina, PER_PAGINA_SPESE),
    [movimentiFiltrati, pagina],
  );

  const sort = useMemo<SortState>(() => colonnaDaOrdineSpese(ordine), [ordine]);

  const cambiaOrdine = useCallback((nuovo: SortState | null) => {
    setOrdine(ordineDaColonnaSpese(nuovo));
    setPagina(1);
  }, []);

  const cambiaRicerca = useCallback((testo: string) => {
    setRicerca(testo);
    setPagina(1);
  }, []);

  const cambiaCategoria = useCallback((valori: string[]) => {
    setFiltroCategoria(valori[0] ?? 'tutti');
    setPagina(1);
  }, []);

  const stileImporto = useMemo(
    () => [textStyle('body', breakpoint), tabularNumbers, styles.importoDestra],
    [breakpoint],
  );

  const colonneMovimenti: readonly DataColumn<MovimentoSpesa>[] = useMemo(
    () => [
      {
        key: 'data',
        header: 'Data',
        cell: (r) => formatDate(r.data),
        sortable: true,
        minWidth: 115,
        mobileLabel: 'Data',
      },
      {
        key: 'descrizione',
        header: 'Descrizione',
        cell: (r) => r.descrizione,
        mobile: 'title',
        weight: 3,
        minWidth: 200,
      },
      {
        key: 'sottoconto',
        header: 'Sottoconto',
        cell: (r) => `${r.sottocontoDescrizione} (${r.macroDescrizione})`,
        weight: 2,
        minWidth: 190,
        mobileLabel: 'Sottoconto',
      },
      {
        key: 'segno',
        header: 'Segno',
        cell: (r) => etichettaSegnoMovimento(r.segno),
        minWidth: 110,
        mobileLabel: 'Segno',
      },
      {
        key: 'importo',
        header: 'Importo',
        cell: (r) => <Text style={stileImporto}>{formatEuro(r.importo)}</Text>,
        align: 'end',
        sortable: true,
        minWidth: 130,
        mobileLabel: 'Importo',
      },
    ],
    [stileImporto],
  );

  const conFiltri = filtroCategoria !== 'tutti' || ricerca.trim().length > 0;
  const nessunMovimento = dettaglio !== null && dettaglio.movimenti.length === 0;

  if (blocco.stato === 'pronto' && !dettaglio) {
    return <EsercizioNonDisponibile onTorna={() => router.replace('/spese' as Href)} />;
  }

  return (
    <View style={styles.pagina}>
      <PageHeader
        title={dettaglio ? `Esercizio ${dettaglio.esercizio.anno}` : 'Dettaglio esercizio'}
        subtitle={
          dettaglio
            ? `Periodo dal ${formatDate(dettaglio.esercizio.dataInizio)} al ${formatDate(dettaglio.esercizio.dataFine)}`
            : undefined
        }
        breadcrumbs={breadcrumbs}
        onBack={indietro}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      {caricamento ? <ScheletroDettaglio /> : null}

      {errore ? (
        <Card>
          <ErrorState
            title="Non è stato possibile caricare l’esercizio"
            description="Controlla la connessione e riprova."
            onRetry={ricarica}
          />
        </Card>
      ) : null}

      {dettaglio ? (
        <>
          <Card title="Riepilogo esercizio">
            <View style={styles.griglia}>
              <Riga
                label="Stato"
                valore={<Badge status={statoBadgeEsercizio(dettaglio.esercizio.stato)} />}
              />
              <Riga
                label="Periodo"
                valore={`${formatDate(dettaglio.esercizio.dataInizio)} – ${formatDate(dettaglio.esercizio.dataFine)}`}
              />
              <Riga
                label="Movimenti di spesa"
                valore={
                  dettaglio.esercizio.numeroMovimenti === 1
                    ? '1 movimento'
                    : `${dettaglio.esercizio.numeroMovimenti} movimenti`
                }
              />
              <Riga
                label="Totale spese esercizio"
                valore={formatEuro(dettaglio.esercizio.totaleSpese)}
                evidenzia
              />
            </View>
          </Card>

          {dettaglio.totaliMacro.length > 0 ? (
            <Card title="Totali per macro-categoria">
              <View style={styles.griglia}>
                <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                  Ripartizione delle spese dell’esercizio per categoria del piano dei conti
                </Text>
                {dettaglio.totaliMacro.map((macro) => (
                  <View key={macro.chiave} style={styles.rigaMacro}>
                    <View style={styles.testoMacro}>
                      <Text style={[textStyle('body', breakpoint), styles.testoPrimario]}>
                        {macro.codice ? `${macro.codice} · ${macro.descrizione}` : macro.descrizione}
                      </Text>
                      <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                        {`${macro.numeroMovimenti === 1 ? '1 movimento' : `${macro.numeroMovimenti} movimenti`} · ${macro.percentuale}% del totale`}
                      </Text>
                    </View>
                    <Text style={[textStyle('h4', breakpoint), tabularNumbers, styles.importoDestra]}>
                      {formatEuro(macro.totale)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {dettaglio.documentiAllegati.length > 0 ? (
            <DocumentiAllegatiCard
              allegati={dettaglio.documentiAllegati}
              condominioId={condominioId}
            />
          ) : null}

          <Card title="Movimenti di spesa">
            <ResponsiveDataView<MovimentoSpesa>
              label="Movimenti di spesa dell’esercizio"
              columns={colonneMovimenti}
              rows={paginata.righe}
              getRowKey={(r) => r.id}
              getRowLabel={(r) =>
                `${formatDate(r.data)}, ${r.descrizione}, ${r.sottocontoDescrizione}, ${etichettaSegnoMovimento(r.segno)}, ${formatEuro(r.importo)}`
              }
              sort={sort}
              onSortChange={cambiaOrdine}
              loading={false}
              error={false}
              empty={{
                icon: 'receipt',
                title: 'Non ci sono spese da mostrare.',
                description: conFiltri
                  ? 'Nessun movimento corrisponde alla ricerca o al sottoconto selezionato.'
                  : 'Non sono ancora stati registrati movimenti di spesa per questo esercizio.',
              }}
              filters={
                nessunMovimento ? null : (
                  <View style={styles.filtri}>
                    <SearchBar
                      value={ricerca}
                      onChangeText={cambiaRicerca}
                      label="Cerca per descrizione"
                      placeholder="Cerca un movimento di spesa…"
                      showLabel
                    />
                    {opzioniFiltro.length > 0 ? (
                      <FilterChips
                        label="Filtra per sottoconto"
                        options={opzioniFiltro}
                        value={filtroCategoria === 'tutti' ? [] : [filtroCategoria]}
                        onChange={cambiaCategoria}
                      />
                    ) : null}
                    <ConteggioMovimenti
                      mostrate={paginata.righe.length}
                      totale={paginata.totaleRighe}
                      tutte={dettaglio.movimenti.length}
                    />
                  </View>
                )
              }
              pagination={
                paginata.pagineTotali > 1 ? (
                  <Pagination
                    page={paginata.pagina}
                    pageCount={paginata.pagineTotali}
                    onChange={setPagina}
                    label="Pagine dei movimenti"
                  />
                ) : null
              }
            />
          </Card>
        </>
      ) : null}
    </View>
  );
}

/**
 * Sezione documento allegato (fattura o verbale): compare SOLO quando il documento esiste
 * davvero in `doc_allegato_id` (`documenti_metadata`) e nello Storage privato.
 */
function DocumentiAllegatiCard({
  allegati,
  condominioId,
}: {
  allegati: readonly DocumentoAllegatoSpese[];
  condominioId: string;
}) {
  const { breakpoint } = useBreakpoint();
  const [inCorsoId, setInCorsoId] = useState<string | null>(null);
  const [errore, setErrore] = useState(false);

  const apriDocumento = useCallback(
    async (doc: DocumentoAllegatoSpese) => {
      if (inCorsoId) return;
      setInCorsoId(doc.id);
      setErrore(false);
      try {
        const url = await services.spese.urlDocumentoAllegato(doc.percorsoStorage, condominioId);
        await Linking.openURL(url);
      } catch {
        setErrore(true);
      } finally {
        setInCorsoId(null);
      }
    },
    [condominioId, inCorsoId],
  );

  return (
    <Card title="Documento allegato">
      <View style={styles.griglia}>
        <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
          Fatture o verbali collegati ai movimenti di questo esercizio. Il link è firmato e vale 10 minuti.
        </Text>
        {allegati.map((doc) => (
          <View key={doc.id} style={styles.rigaAllegato}>
            <Text style={[textStyle('body', breakpoint), styles.testoPrimario, styles.nomeAllegato]}>
              {doc.nomeFile}
            </Text>
            <Button
              label="Scarica allegato"
              loadingLabel="Preparazione del documento…"
              icon="file-text"
              variant="secondary"
              loading={inCorsoId === doc.id}
              onPress={() => void apriDocumento(doc)}
              accessibilityHint="Apre il documento allegato con un link firmato temporaneo"
            />
          </View>
        ))}
        {errore ? (
          <Alert
            tone="error"
            message="Non è stato possibile aprire il documento allegato. Riprova tra poco."
          />
        ) : null}
      </View>
    </Card>
  );
}

function ScheletroDettaglio() {
  return (
    <View
      role="status"
      aria-busy
      accessibilityLabel="Caricamento del dettaglio esercizio"
      style={styles.pagina}
    >
      {[0, 1].map((n) => (
        <Card key={n}>
          <View style={styles.griglia}>
            <Skeleton width="35%" />
            <SkeletonText lines={3} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function ConteggioMovimenti({
  mostrate,
  totale,
  tutte,
}: {
  mostrate: number;
  totale: number;
  tutte: number;
}) {
  const { breakpoint } = useBreakpoint();
  const testo =
    totale === tutte
      ? tutte === 1
        ? 'C’è 1 movimento di spesa.'
        : `Ci sono ${tutte} movimenti di spesa.`
      : `${totale === 1 ? '1 movimento' : `${totale} movimenti`} su ${tutte}.`;
  return (
    <View role="status" aria-live="polite" aria-atomic>
      <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
        {testo}
        {mostrate < totale ? ` Qui ne vedi ${mostrate}.` : ''}
      </Text>
    </View>
  );
}

function Riga({
  label,
  valore,
  evidenzia,
}: {
  label: string;
  valore: React.ReactNode;
  evidenzia?: boolean;
}) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.riga}>
      <Text style={[textStyle('secondary', breakpoint), styles.etichetta]}>{label}</Text>
      {typeof valore === 'string' ? (
        <Text
          style={[
            textStyle(evidenzia ? 'h4' : 'body', breakpoint),
            tabularNumbers,
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
  filtri: { gap: space[3] },
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
  rigaMacro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  testoMacro: {
    flex: 1,
    gap: space[1],
    minWidth: 0,
  },
  rigaAllegato: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space[3],
  },
  nomeAllegato: {
    flex: 1,
    minWidth: 180,
  },
  testoPrimario: { color: colors.text.primary },
  testoSecondario: { color: colors.text.secondary },
  importoDestra: { color: colors.text.primary, textAlign: 'right' },
});
