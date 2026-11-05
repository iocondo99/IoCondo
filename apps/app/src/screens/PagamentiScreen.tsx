import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  OPZIONI_STATO,
  PER_PAGINA_DEFAULT,
  colonnaDaOrdine,
  descrizioneProssima,
  filtriAttivi,
  oggiIso,
  ordineDaColonna,
  paginaPagamenti,
  preparaRate,
  riepilogoPagamenti,
  sottotitoloPagamenti,
  type FiltriPagamenti,
  type OrdinePagamenti,
  type RataVista,
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
  formatEuro,
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

const FILTRI_INIZIALI: FiltriPagamenti = { stato: 'da-pagare', ricerca: '' };
const ERRORE_RIEPILOGO = 'Non è stato possibile caricare le rate.';

/** Pagina "Pagamenti" del condòmino: le sue rate, con ricerca, filtri, ordine e dettaglio. Il pagamento online è Fase 2. */
export function PagamentiScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;
  if (!ruoli.has('CONDOMINO')) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Pagamenti" subtitle="Le rate del condominio." />
        <NonAutorizzato />
      </View>
    );
  }
  return <PagamentiContenuto />;
}

function PagamentiContenuto() {
  const { profilo, condominio } = useProfilo();
  const router = useRouter();

  const utenteId = profilo!.id;
  const condominioId = condominio!.id;
  const chiave = `${utenteId}|${condominioId}`;
  const oggi = useMemo(() => oggiIso(), []);

  const { blocco, ricarica } = useBlocco(() => services.pagamenti.listMie(utenteId, condominioId), chiave);

  // REQ-C02: la pagina si aggiorna quando torna in primo piano (cambio scheda o app), non in tempo reale.
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

  const [filtri, setFiltri] = useState<FiltriPagamenti>(FILTRI_INIZIALI);
  const [ordine, setOrdine] = useState<OrdinePagamenti>('predefinito');
  const [pagina, setPagina] = useState(1);

  // Altro condominio o altro utente: si riparte da capo (la pagina non si ricarica, ma i filtri non valgono più).
  useEffect(() => {
    setFiltri(FILTRI_INIZIALI);
    setOrdine('predefinito');
    setPagina(1);
  }, [chiave]);

  const pronto = blocco.stato === 'pronto';
  const caricamento = blocco.stato === 'caricamento';
  const errore = blocco.stato === 'errore';

  const rate: readonly RataVista[] = useMemo(() => (blocco.stato === 'pronto' ? preparaRate(blocco.dati, oggi) : []), [blocco, oggi]);
  const risultato = useMemo(() => paginaPagamenti(rate, filtri, ordine, pagina), [rate, filtri, ordine, pagina]);
  const riepilogo = useMemo(() => riepilogoPagamenti(rate, oggi), [rate, oggi]);
  const sort = useMemo(() => colonnaDaOrdine(ordine), [ordine]);

  const cambiaFiltri = useCallback((parziale: Partial<FiltriPagamenti>) => {
    setFiltri((f) => ({ ...f, ...parziale }));
    setPagina(1);
  }, []);
  const cambiaOrdine = useCallback((s: SortState | null) => {
    setOrdine(ordineDaColonna(s));
    setPagina(1);
  }, []);
  const apriDettaglio = useCallback((r: RataVista) => router.push(`/pagamenti/${r.id}` as Href), [router]);

  const colonne: readonly DataColumn<RataVista>[] = useMemo(
    () => [
      { key: 'descrizione', header: 'Descrizione', cell: (r) => r.descrizione, mobile: 'title', weight: 3, minWidth: 180 },
      {
        key: 'scadenza',
        header: 'Scadenza',
        cell: (r) => formatDate(r.dataScadenza),
        sortable: true,
        minWidth: 110,
        mobileLabel: 'Scadenza',
      },
      {
        key: 'dovuto',
        header: 'Importo dovuto',
        cell: (r) => formatEuro(r.importoDovuto),
        align: 'end',
        sortable: true,
        minWidth: 130,
        mobileLabel: 'Importo dovuto',
      },
      {
        key: 'versato',
        header: 'Importo versato',
        cell: (r) => (r.importoPagato > 0 ? formatEuro(r.importoPagato) : '—'),
        align: 'end',
        minWidth: 130,
        mobileLabel: 'Importo versato',
      },
      { key: 'stato', header: 'Stato', cell: (r) => <Badge status={r.statoCalcolato} />, mobile: 'status', minWidth: 120 },
    ],
    [],
  );

  const erroreScheda = errore ? { message: ERRORE_RIEPILOGO, onRetry: ricarica } : undefined;
  const nessunaRata = pronto && rate.length === 0;
  const conFiltri = filtriAttivi(filtri) > 0;

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Pagamenti"
        subtitle={sottotitoloPagamenti(condominio?.nome)}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      <View style={styles.schede}>
        <View style={styles.scheda}>
          <StatCard
            icon="credit-card"
            title="Totale da pagare"
            value={pronto ? formatEuro(riepilogo.totaleDaPagare) : ''}
            description={pronto ? (riepilogo.totaleDaPagare > 0 ? 'Quanto resta da versare' : 'Non ci sono rate da pagare') : undefined}
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="circle-alert"
            tile="navy"
            title="Di cui scaduto"
            value={pronto ? formatEuro(riepilogo.totaleScaduto) : ''}
            description={pronto ? (riepilogo.totaleScaduto > 0 ? 'Rate con la scadenza passata' : 'Nessun importo scaduto') : undefined}
            status={pronto && riepilogo.totaleScaduto > 0 ? 'scaduto' : undefined}
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="calendar-days"
            tile="teal"
            title="Prossima scadenza"
            value={pronto ? (riepilogo.prossima ? formatDate(riepilogo.prossima) : '—') : ''}
            description={pronto ? descrizioneProssima(oggi, riepilogo.prossima) : undefined}
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
      </View>

      <Card>
        <ResponsiveDataView
          label="Rate del condominio"
          columns={colonne}
          rows={risultato.rate as RataVista[]}
          getRowKey={(r) => r.id}
          getRowLabel={(r) => `${r.descrizione}, scadenza ${formatDate(r.dataScadenza)}`}
          onRowPress={apriDettaglio}
          sort={sort}
          onSortChange={cambiaOrdine}
          loading={caricamento}
          error={errore ? { title: 'Non è stato possibile caricare le rate', description: 'Controlla la connessione e riprova.' } : false}
          onRetry={ricarica}
          empty={{
            icon: 'credit-card',
            title: 'Non ci sono rate da mostrare.',
            description: conFiltri
              ? 'Nessuna rata corrisponde alla ricerca o ai filtri. Cancella la ricerca o premi "Azzera filtri".'
              : 'Quando l’amministratore pubblicherà le rate le troverai qui.',
          }}
          filters={
            nessunaRata ? null : (
              <View style={styles.filtri}>
                <SearchBar
                  value={filtri.ricerca}
                  onChangeText={(ricerca) => cambiaFiltri({ ricerca })}
                  label="Cerca per descrizione"
                  placeholder="Cerca una rata…"
                  showLabel
                />
                <FilterChips
                  label="Filtra per stato"
                  options={OPZIONI_STATO}
                  value={filtri.stato === 'tutti' ? [] : [filtri.stato]}
                  onChange={(valori) => cambiaFiltri({ stato: (valori[0] as FiltriPagamenti['stato'] | undefined) ?? 'tutti' })}
                />
                {pronto ? <Conteggio mostrate={risultato.rate.length} totale={risultato.totaleFiltrati} tutte={rate.length} /> : null}
              </View>
            )
          }
          pagination={
            risultato.numeroPagine > 1 ? (
              <Pagination
                page={risultato.pagina}
                pageCount={risultato.numeroPagine}
                onChange={setPagina}
                label="Pagine delle rate"
              />
            ) : null
          }
        />
      </Card>
    </View>
  );
}

/** Frase letta dagli screen reader a ogni cambio di filtro: quante rate si vedono su quante. */
function Conteggio({ mostrate, totale, tutte }: { mostrate: number; totale: number; tutte: number }) {
  const { breakpoint } = useBreakpoint();
  const testo =
    totale === tutte
      ? tutte === 1
        ? 'C’è una rata.'
        : `Ci sono ${tutte} rate.`
      : `${totale === 1 ? 'Una rata' : `${totale} rate`} su ${tutte}.`;
  return (
    <View role="status" aria-live="polite" aria-atomic>
      <Text style={[textStyle('secondary', breakpoint), styles.conteggio]}>
        {testo}
        {mostrate < totale ? ` Qui ne vedi ${mostrate}.` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  schede: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  scheda: { flex: 1, minWidth: 200 },
  filtri: { gap: space[3] },
  conteggio: { color: colors.text.secondary },
});
