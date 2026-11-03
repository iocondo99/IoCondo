import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  colonnaDaOrdineDocumenti,
  etichettaRigaDocumento,
  filtriDocumentiAttivi,
  opzioniFiltroCartelle,
  ordineDaColonnaDocumenti,
  paginaDocumenti,
  riepilogoDocumenti,
  sottotitoloDocumenti,
  type CartellaDocumento,
  type DocumentoCondomino,
  type FiltriDocumenti,
  type OrdineDocumenti,
} from '@iocondo/data';
import {
  Badge,
  Card,
  FilterChips,
  NonAutorizzato,
  PageHeader,
  Pagination,
  ResponsiveDataView,
  SearchBar,
  StatCard,
  colors,
  formatDate,
  space,
  textStyle,
  useBreakpoint,
  type DataColumn,
  type SortState,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

const FILTRI_INIZIALI: FiltriDocumenti = { cartellaId: 'tutte', ricerca: '' };
const ERRORE_RIEPILOGO = 'Non è stato possibile caricare i documenti.';

/**
 * Pagina "Documenti" del condòmino (`/documenti`) in sola lettura:
 * mostra i regolamenti, i verbali, i bilanci del condominio selezionato (`unita_id IS NULL`)
 * e i documenti associati alle unità immobiliari del residente.
 */
export function DocumentiScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, voci } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;

  const abilitata = voci.some((v) => v.id === 'documenti');
  if (!abilitata) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Documenti" subtitle="Regolamenti, verbali e documenti del condominio." />
        <NonAutorizzato />
      </View>
    );
  }

  return <DocumentiContenuto />;
}

function DocumentiContenuto() {
  const { profilo, condominio } = useProfilo();
  const router = useRouter();

  const utenteId = profilo!.id;
  const condominioId = condominio!.id;
  const chiave = `${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.documenti.elencoDocumentiCondomino(utenteId, condominioId),
    chiave,
  );

  // Ricarica quando la pagina torna in primo piano (ritorno dal dettaglio, cambio scheda o app).
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

  const [filtri, setFiltri] = useState<FiltriDocumenti>(FILTRI_INIZIALI);
  const [ordine, setOrdine] = useState<OrdineDocumenti>('data-desc');
  const [pagina, setPagina] = useState(1);

  // Cambio condominio o utente: azzera filtri, ordinamento e pagina senza ricaricare l'app.
  useEffect(() => {
    setFiltri(FILTRI_INIZIALI);
    setOrdine('data-desc');
    setPagina(1);
  }, [chiave]);

  const pronto = blocco.stato === 'pronto';
  const caricamento = blocco.stato === 'caricamento';
  const errore = blocco.stato === 'errore';

  const cartelle: readonly CartellaDocumento[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati.cartelle : []),
    [blocco],
  );
  const tuttiDocumenti: readonly DocumentoCondomino[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati.documenti : []),
    [blocco],
  );

  const riepilogo = useMemo(() => riepilogoDocumenti(tuttiDocumenti), [tuttiDocumenti]);
  const opzioniCartelle = useMemo(
    () =>
      opzioniFiltroCartelle(cartelle, tuttiDocumenti)
        .filter((opzione) => opzione.value !== 'tutte')
        .map((opzione) => ({ value: opzione.value, label: opzione.label })),
    [cartelle, tuttiDocumenti],
  );
  const risultato = useMemo(
    () => paginaDocumenti(tuttiDocumenti, filtri, ordine, pagina),
    [tuttiDocumenti, filtri, ordine, pagina],
  );
  const sort = useMemo(() => colonnaDaOrdineDocumenti(ordine), [ordine]);

  const cambiaFiltri = useCallback((parziale: Partial<FiltriDocumenti>) => {
    setFiltri((precedenti) => ({ ...precedenti, ...parziale }));
    setPagina(1);
  }, []);

  const azzeraFiltri = useCallback(() => {
    setFiltri(FILTRI_INIZIALI);
    setPagina(1);
  }, []);

  const cambiaOrdine = useCallback((nuovoSort: SortState | null) => {
    setOrdine(ordineDaColonnaDocumenti(nuovoSort));
    setPagina(1);
  }, []);

  const apriDettaglio = useCallback(
    (doc: DocumentoCondomino) => router.push(`/documenti/${doc.id}` as Href),
    [router],
  );

  const colonne: readonly DataColumn<DocumentoCondomino>[] = useMemo(
    () => [
      {
        key: 'nome',
        header: 'Nome documento',
        cell: (d) => <CellaNomeDocumento documento={d} />,
        mobile: 'title',
        sortable: true,
        weight: 3,
        minWidth: 220,
      },
      {
        key: 'cartella',
        header: 'Cartella',
        cell: (d) => d.cartellaNome,
        weight: 2,
        minWidth: 160,
        mobileLabel: 'Cartella',
      },
      {
        key: 'visibilita',
        header: 'Visibilità',
        cell: (d) => <Badge status={d.visibilita} label={d.etichettaVisibilita} />,
        mobile: 'status',
        minWidth: 150,
      },
      {
        key: 'data',
        header: 'Data',
        cell: (d) => formatDate(d.createdAt),
        sortable: true,
        minWidth: 120,
        mobileLabel: 'Data',
      },
    ],
    [],
  );

  const nessunDocumento = pronto && tuttiDocumenti.length === 0;
  const conFiltri = filtriDocumentiAttivi(filtri) > 0;
  const erroreScheda = errore ? { message: ERRORE_RIEPILOGO, onRetry: ricarica } : undefined;

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Documenti"
        subtitle={sottotitoloDocumenti(condominio?.nome)}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      <View style={styles.schede}>
        <View style={styles.scheda}>
          <StatCard
            icon="file-text"
            title="Documenti disponibili"
            value={pronto ? String(riepilogo.totale) : ''}
            description={
              pronto
                ? riepilogo.totale === 0
                  ? 'Nessun documento pubblicato'
                  : riepilogo.cartelle === 1
                    ? 'In 1 cartella del condominio'
                    : `In ${riepilogo.cartelle} cartelle del condominio`
                : undefined
            }
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="building-2"
            title="Condominiali"
            value={pronto ? String(riepilogo.condominiali) : ''}
            description={
              pronto
                ? riepilogo.condominiali === 1
                  ? '1 documento comune al condominio'
                  : `${riepilogo.condominiali} documenti comuni al condominio`
                : undefined
            }
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="home"
            title="Della tua unità"
            value={pronto ? String(riepilogo.personali) : ''}
            description={
              pronto
                ? riepilogo.personali === 0
                  ? 'Nessun documento specifico per la tua unità'
                  : riepilogo.personali === 1
                    ? '1 documento riservato alla tua unità'
                    : `${riepilogo.personali} documenti riservati alla tua unità`
                : undefined
            }
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
      </View>

      <Card>
        <ResponsiveDataView<DocumentoCondomino>
          label="Documenti del condominio"
          columns={colonne}
          rows={risultato.documenti}
          getRowKey={(d) => d.id}
          getRowLabel={(d) => etichettaRigaDocumento(d, formatDate(d.createdAt))}
          onRowPress={apriDettaglio}
          sort={sort}
          onSortChange={cambiaOrdine}
          loading={caricamento}
          error={
            errore
              ? {
                  title: 'Non è stato possibile caricare i documenti',
                  description: 'Controlla la connessione e riprova.',
                }
              : false
          }
          onRetry={ricarica}
          empty={{
            icon: 'file-text',
            title: 'Non ci sono documenti da mostrare.',
            description: conFiltri
              ? 'Nessun documento corrisponde alla cartella o alla ricerca selezionata. Premi "Azzera filtri" per tornare all’elenco completo.'
              : 'Quando l’amministratore caricherà regolamenti, verbali o documenti del condominio li troverai qui.',
            action: conFiltri
              ? {
                  label: 'Azzera filtri',
                  onPress: azzeraFiltri,
                }
              : undefined,
          }}
          filters={
            nessunDocumento ? null : (
              <View style={styles.filtri}>
                <SearchBar
                  value={filtri.ricerca}
                  onChangeText={(ricerca) => cambiaFiltri({ ricerca })}
                  label="Cerca per nome file"
                  placeholder="Cerca un documento o una cartella…"
                  showLabel
                />
                {opzioniCartelle.length > 0 ? (
                  <FilterChips
                    label="Filtra per cartella"
                    allLabel="Tutte"
                    options={opzioniCartelle}
                    value={filtri.cartellaId === 'tutte' ? [] : [filtri.cartellaId]}
                    onChange={(valori) =>
                      cambiaFiltri({
                        cartellaId: valori[0] || 'tutte',
                      })
                    }
                  />
                ) : null}
                {pronto ? (
                  <ConteggioDocumenti
                    mostrati={risultato.documenti.length}
                    totale={risultato.totaleFiltrati}
                    tutti={tuttiDocumenti.length}
                  />
                ) : null}
              </View>
            )
          }
          pagination={
            risultato.numeroPagine > 1 ? (
              <Pagination
                page={risultato.pagina}
                pageCount={risultato.numeroPagine}
                onChange={setPagina}
                label="Pagine dei documenti"
              />
            ) : null
          }
        />
      </Card>
    </View>
  );
}

function CellaNomeDocumento({ documento }: { documento: DocumentoCondomino }) {
  const { breakpoint, isMobile } = useBreakpoint();
  return (
    <Text
      accessibilityRole={isMobile ? 'header' : undefined}
      aria-level={isMobile ? 3 : undefined}
      style={[
        textStyle(isMobile ? 'h4' : 'body', breakpoint),
        isMobile ? styles.titoloMobile : styles.titoloTabella,
      ]}
    >
      {documento.nomeFile}
    </Text>
  );
}

function ConteggioDocumenti({
  mostrati,
  totale,
  tutti,
}: {
  mostrati: number;
  totale: number;
  tutti: number;
}) {
  const { breakpoint } = useBreakpoint();
  const testo =
    totale === tutti
      ? tutti === 1
        ? 'C’è un documento disponibile.'
        : `Ci sono ${tutti} documenti disponibili.`
      : `${totale === 1 ? 'Un documento' : `${totale} documenti`} su ${tutti}.`;

  return (
    <View role="status" aria-live="polite" aria-atomic>
      <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
        {testo}
        {mostrati < totale ? ` Qui ne vedi ${mostrati}.` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  schede: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  scheda: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 240,
  },
  filtri: { gap: space[3] },
  titoloTabella: { color: colors.text.primary },
  titoloMobile: { color: colors.brand.navy },
  testoSecondario: { color: colors.text.secondary },
});

