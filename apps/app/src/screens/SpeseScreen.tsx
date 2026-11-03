import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  etichettaStatoEsercizio,
  riepilogoEserciziSpese,
  sottotitoloSpese,
  statoBadgeEsercizio,
  type EsercizioSpese,
} from '@iocondo/data';
import {
  Badge,
  Card,
  NonAutorizzato,
  PageHeader,
  ResponsiveDataView,
  StatCard,
  colors,
  formatDate,
  formatEuro,
  space,
  tabularNumbers,
  textStyle,
  useBreakpoint,
  type DataColumn,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

const ERRORE_RIEPILOGO = 'Non è stato possibile caricare le spese.';

/**
 * Pagina "Spese" del condòmino (`/spese`):
 * riepilogo con 3 StatCard reali ed elenco degli esercizi contabili
 * (consuntivi, preventivi e chiusi) del condominio selezionato, in sola lettura.
 * Il pagamento delle rate resta nella sezione Pagamenti.
 */
export function SpeseScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;
  if (!ruoli.has('CONDOMINO')) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Spese" subtitle="Consuntivi e preventivi del condominio." />
        <NonAutorizzato />
      </View>
    );
  }
  return <SpeseContenuto />;
}

function SpeseContenuto() {
  const { profilo, condominio } = useProfilo();
  const router = useRouter();
  const { breakpoint } = useBreakpoint();

  const utenteId = profilo!.id;
  const condominioId = condominio!.id;
  const chiave = `${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.spese.eserciziDelCondominio(condominioId),
    chiave,
  );

  // Ricarica quando la pagina torna in primo piano (cambio scheda o ritorno all'app).
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

  const pronto = blocco.stato === 'pronto';
  const caricamento = blocco.stato === 'caricamento';
  const errore = blocco.stato === 'errore';

  const esercizi: readonly EsercizioSpese[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati : []),
    [blocco],
  );

  const riepilogo = useMemo(() => riepilogoEserciziSpese(esercizi), [esercizi]);

  const apriDettaglio = useCallback(
    (esercizio: EsercizioSpese) => router.push(`/spese/${esercizio.id}` as Href),
    [router],
  );

  const stileImporto = useMemo(
    () => [textStyle('body', breakpoint), tabularNumbers, styles.importoDestra],
    [breakpoint],
  );

  const colonne: readonly DataColumn<EsercizioSpese>[] = useMemo(
    () => [
      {
        key: 'anno',
        header: 'Anno',
        cell: (r) => `Esercizio ${r.anno}`,
        mobile: 'title',
        weight: 2,
        minWidth: 150,
      },
      {
        key: 'periodo',
        header: 'Periodo',
        cell: (r) => `${formatDate(r.dataInizio)} – ${formatDate(r.dataFine)}`,
        weight: 2,
        minWidth: 190,
        mobileLabel: 'Periodo',
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (r) => <Badge status={statoBadgeEsercizio(r.stato)} />,
        mobile: 'status',
        minWidth: 140,
      },
      {
        key: 'totale',
        header: 'Totale',
        cell: (r) => <Text style={stileImporto}>{formatEuro(r.totaleSpese)}</Text>,
        align: 'end',
        minWidth: 140,
        mobileLabel: 'Totale',
      },
    ],
    [stileImporto],
  );

  const erroreScheda = errore ? { message: ERRORE_RIEPILOGO, onRetry: ricarica } : undefined;

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Spese"
        subtitle={sottotitoloSpese(condominio?.nome)}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      <View style={styles.schede}>
        <View style={styles.scheda}>
          <StatCard
            icon="coins"
            title="Spese esercizio in corso"
            value={
              pronto
                ? riepilogo.esercizioInCorso
                  ? formatEuro(riepilogo.esercizioInCorso.totaleSpese)
                  : '—'
                : ''
            }
            description={
              pronto
                ? riepilogo.esercizioInCorso
                  ? `Esercizio ${riepilogo.esercizioInCorso.anno} (${etichettaStatoEsercizio(riepilogo.esercizioInCorso.stato).toLowerCase()})`
                  : 'Nessun esercizio in corso'
                : undefined
            }
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="circle-check"
            tile="navy"
            title="Ultimo consuntivo approvato"
            value={
              pronto
                ? riepilogo.ultimoConsuntivo
                  ? formatEuro(riepilogo.ultimoConsuntivo.totaleSpese)
                  : '—'
                : ''
            }
            description={
              pronto
                ? riepilogo.ultimoConsuntivo
                  ? `Anno ${riepilogo.ultimoConsuntivo.anno}`
                  : 'Nessun consuntivo approvato'
                : undefined
            }
            status={pronto && riepilogo.ultimoConsuntivo ? 'consuntivo' : undefined}
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="calendar-days"
            tile="teal"
            title="Preventivo in corso"
            value={
              pronto
                ? riepilogo.preventivoInCorso
                  ? formatEuro(riepilogo.preventivoInCorso.totaleSpese)
                  : '—'
                : ''
            }
            description={
              pronto
                ? riepilogo.preventivoInCorso
                  ? `Anno ${riepilogo.preventivoInCorso.anno}`
                  : 'Nessun preventivo in corso'
                : undefined
            }
            status={pronto && riepilogo.preventivoInCorso ? 'preventivo' : undefined}
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
      </View>

      <Card>
        <ResponsiveDataView<EsercizioSpese>
          label="Esercizi contabili del condominio"
          columns={colonne}
          rows={esercizi as EsercizioSpese[]}
          getRowKey={(r) => r.id}
          getRowLabel={(r) =>
            `Esercizio ${r.anno}, periodo dal ${formatDate(r.dataInizio)} al ${formatDate(r.dataFine)}, stato ${etichettaStatoEsercizio(r.stato)}, totale ${formatEuro(r.totaleSpese)}`
          }
          onRowPress={apriDettaglio}
          loading={caricamento}
          error={
            errore
              ? {
                  title: 'Non è stato possibile caricare le spese',
                  description: 'Controlla la connessione e riprova.',
                }
              : false
          }
          onRetry={ricarica}
          empty={{
            icon: 'receipt',
            title: 'Non ci sono spese da mostrare.',
            description:
              'Quando l’amministratore pubblicherà un preventivo o un consuntivo per questo condominio lo troverai qui.',
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  schede: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  scheda: { flex: 1, minWidth: 200 },
  importoDestra: { color: colors.text.primary, textAlign: 'right' },
});
