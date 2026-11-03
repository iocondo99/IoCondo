import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  colonnaDaOrdineSegnalazioni,
  etichettaRigaSegnalazione,
  filtriSegnalazioniAttivi,
  opzioniFiltroStatoSegnalazioni,
  ordineDaColonnaSegnalazioni,
  paginaSegnalazioni,
  riepilogoSegnalazioni,
  type FiltriSegnalazioni,
  type FiltroStatoSegnalazioni,
  type ModalitaSegnalazioni,
  type OrdineSegnalazioni,
  type SegnalazioneRiepilogo,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Card,
  FilterChips,
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
import { ModuloNuovaSegnalazione } from '@/components/segnalazioni/ModuloNuovaSegnalazione';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

const FILTRI_INIZIALI: FiltriSegnalazioni = { stato: 'tutti', ricerca: '' };

interface Props {
  modalita: ModalitaSegnalazioni;
  titolo: string;
  sottotitolo: string;
  /** Prefisso della rotta di dettaglio, es. `/segnalazioni`. */
  rotta: string;
  etichettaAzione: string;
  etichettaTabella: string;
  vuotoDescrizione: string;
}

/** Elenco con riepilogo, filtri, ordinamento, paginazione e modulo di apertura (condòmino e portiere). */
export function ElencoSegnalazioni(props: Props) {
  const { modalita, titolo, sottotitolo, rotta, etichettaAzione, etichettaTabella, vuotoDescrizione } = props;
  const { profilo, condominio } = useProfilo();
  const router = useRouter();
  const utenteId = profilo!.id;
  const condominioId = condominio!.id;
  const chiave = `${utenteId}|${condominioId}|${modalita}`;

  const { blocco, ricarica } = useBlocco(
    () =>
      modalita === 'portiere'
        ? services.segnalazioni.elencoTicketPortiere(utenteId, condominioId)
        : services.segnalazioni.elencoSegnalazioniCondomino(utenteId, condominioId),
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

  const [filtri, setFiltri] = useState<FiltriSegnalazioni>(FILTRI_INIZIALI);
  const [ordine, setOrdine] = useState<OrdineSegnalazioni>('data-desc');
  const [pagina, setPagina] = useState(1);
  const [moduloAperto, setModuloAperto] = useState(false);
  const [esito, setEsito] = useState<{ tono: 'success' | 'warning'; messaggio: string } | null>(null);

  useEffect(() => {
    setFiltri(FILTRI_INIZIALI);
    setOrdine('data-desc');
    setPagina(1);
    setEsito(null);
  }, [chiave]);

  const pronto = blocco.stato === 'pronto';
  const caricamento = blocco.stato === 'caricamento';
  const errore = blocco.stato === 'errore';

  const tutte: readonly SegnalazioneRiepilogo[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati : []),
    [blocco],
  );
  const riepilogo = useMemo(() => riepilogoSegnalazioni(tutte), [tutte]);
  const opzioniStato = useMemo(
    () =>
      opzioniFiltroStatoSegnalazioni(tutte)
        .filter((o) => o.value !== 'tutti')
        .map((o) => ({ value: o.value, label: `${o.label} (${o.count})` })),
    [tutte],
  );
  const risultato = useMemo(
    () => paginaSegnalazioni(tutte, filtri, ordine, pagina),
    [tutte, filtri, ordine, pagina],
  );
  const sort = useMemo(() => colonnaDaOrdineSegnalazioni(ordine), [ordine]);

  const cambiaFiltri = useCallback((parziale: Partial<FiltriSegnalazioni>) => {
    setFiltri((prec) => ({ ...prec, ...parziale }));
    setPagina(1);
  }, []);
  const azzeraFiltri = useCallback(() => {
    setFiltri(FILTRI_INIZIALI);
    setPagina(1);
  }, []);
  const cambiaOrdine = useCallback((nuovo: SortState | null) => {
    setOrdine(ordineDaColonnaSegnalazioni(nuovo));
    setPagina(1);
  }, []);
  const apriDettaglio = useCallback(
    (s: SegnalazioneRiepilogo) => router.push(`${rotta}/${s.id}` as Href),
    [router, rotta],
  );

  const alCreata = useCallback(
    (_ticketId: string, fotoNonCaricate: string[]) => {
      setModuloAperto(false);
      setEsito(
        fotoNonCaricate.length > 0
          ? {
              tono: 'warning',
              messaggio: `La segnalazione è stata inviata, ma alcune foto non sono state caricate: ${fotoNonCaricate.join(', ')}.`,
            }
          : { tono: 'success', messaggio: 'La segnalazione è stata inviata.' },
      );
      ricarica();
    },
    [ricarica],
  );

  const colonne: readonly DataColumn<SegnalazioneRiepilogo>[] = useMemo(
    () => [
      {
        key: 'titolo',
        header: 'Segnalazione',
        cell: (s) => <CellaTitolo segnalazione={s} />,
        mobile: 'title',
        weight: 3,
        minWidth: 220,
      },
      {
        key: 'categoria',
        header: 'Categoria',
        cell: (s) => s.categoriaNome ?? 'Generale',
        weight: 2,
        minWidth: 140,
        mobileLabel: 'Categoria',
      },
      {
        key: 'ambito',
        header: 'Ambito',
        cell: (s) => s.etichettaAmbito,
        weight: 2,
        minWidth: 140,
        mobileLabel: 'Ambito',
      },
      {
        key: 'priorita',
        header: 'Priorità',
        cell: (s) => s.etichettaPriorita,
        sortable: true,
        minWidth: 110,
        mobileLabel: 'Priorità',
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (s) => <Badge status={s.statoBadge} />,
        mobile: 'status',
        sortable: true,
        minWidth: 150,
      },
      {
        key: 'data',
        header: 'Aperta il',
        cell: (s) => formatDate(s.createdAt),
        sortable: true,
        minWidth: 120,
        mobileLabel: 'Aperta il',
      },
    ],
    [],
  );

  const nessuna = pronto && tutte.length === 0;
  const conFiltri = filtriSegnalazioniAttivi(filtri) > 0;
  const erroreScheda = errore ? { message: 'Non è stato possibile caricare le segnalazioni.', onRetry: ricarica } : undefined;
  const scheda = (icon: React.ComponentProps<typeof StatCard>['icon'], title: string, valore: number, descr: string) => (
    <View style={styles.scheda}>
      <StatCard
        icon={icon}
        title={title}
        value={pronto ? String(valore) : ''}
        description={pronto ? descr : undefined}
        loading={caricamento}
        error={erroreScheda}
      />
    </View>
  );

  return (
    <View style={styles.pagina}>
      <PageHeader
        title={titolo}
        subtitle={sottotitolo}
        action={{ label: etichettaAzione, icon: 'wrench', onPress: () => setModuloAperto(true) }}
      />

      {esito ? (
        <Alert tone={esito.tono} message={esito.messaggio} onDismiss={() => setEsito(null)} />
      ) : null}

      <View style={styles.schede}>
        {scheda('file-text', 'Totale segnalazioni', riepilogo.totale, `${riepilogo.areeComuni} su aree comuni`)}
        {scheda('circle-alert', 'Aperte', riepilogo.aperte, 'In attesa di essere prese in carico')}
        {scheda('wrench', 'In lavorazione', riepilogo.inLavorazione, 'Intervento in corso')}
        {scheda('circle-check', 'Risolte', riepilogo.risolte, 'Chiuse dall’amministratore')}
      </View>

      <Card>
        <ResponsiveDataView<SegnalazioneRiepilogo>
          label={etichettaTabella}
          columns={colonne}
          rows={risultato.segnalazioni}
          getRowKey={(s) => s.id}
          getRowLabel={(s) => etichettaRigaSegnalazione(s, formatDate(s.createdAt))}
          onRowPress={apriDettaglio}
          sort={sort}
          onSortChange={cambiaOrdine}
          loading={caricamento}
          error={
            errore
              ? { title: 'Non è stato possibile caricare le segnalazioni', description: 'Controlla la connessione e riprova.' }
              : false
          }
          onRetry={ricarica}
          empty={{
            icon: 'wrench',
            title: 'Non ci sono segnalazioni da mostrare.',
            description: conFiltri
              ? 'Nessuna segnalazione corrisponde allo stato o alla ricerca selezionati. Premi "Azzera filtri" per tornare all’elenco completo.'
              : vuotoDescrizione,
            action: conFiltri ? { label: 'Azzera filtri', onPress: azzeraFiltri } : undefined,
          }}
          filters={
            nessuna ? null : (
              <View style={styles.filtri}>
                <SearchBar
                  value={filtri.ricerca}
                  onChangeText={(ricerca) => cambiaFiltri({ ricerca })}
                  label="Cerca per titolo o categoria"
                  placeholder="Cerca una segnalazione…"
                  showLabel
                />
                <FilterChips
                  label="Filtra per stato"
                  allLabel={`Tutti (${tutte.length})`}
                  options={opzioniStato}
                  value={filtri.stato === 'tutti' ? [] : [filtri.stato]}
                  onChange={(valori) =>
                    cambiaFiltri({ stato: (valori[0] as FiltroStatoSegnalazioni | undefined) ?? 'tutti' })
                  }
                />
                {pronto ? (
                  <Conteggio mostrati={risultato.segnalazioni.length} totale={risultato.totaleFiltrati} tutti={tutte.length} />
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
                label="Pagine delle segnalazioni"
              />
            ) : null
          }
        />
      </Card>

      <ModuloNuovaSegnalazione
        visible={moduloAperto}
        onClose={() => setModuloAperto(false)}
        modalita={modalita}
        utenteId={utenteId}
        condominioId={condominioId}
        onCreata={alCreata}
      />
    </View>
  );
}

function CellaTitolo({ segnalazione }: { segnalazione: SegnalazioneRiepilogo }) {
  const { breakpoint, isMobile } = useBreakpoint();
  return (
    <Text
      accessibilityRole={isMobile ? 'header' : undefined}
      aria-level={isMobile ? 3 : undefined}
      style={[textStyle(isMobile ? 'h4' : 'body', breakpoint), isMobile ? styles.titoloMobile : styles.titoloTabella]}
    >
      {segnalazione.titolo}
    </Text>
  );
}

function Conteggio({ mostrati, totale, tutti }: { mostrati: number; totale: number; tutti: number }) {
  const { breakpoint } = useBreakpoint();
  const testo =
    totale === tutti
      ? tutti === 1
        ? 'C’è una segnalazione.'
        : `Ci sono ${tutti} segnalazioni.`
      : `${totale === 1 ? 'Una segnalazione' : `${totale} segnalazioni`} su ${tutti}.`;
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
  schede: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  scheda: { flexGrow: 1, flexBasis: 220, minWidth: 200 },
  filtri: { gap: space[3] },
  titoloTabella: { color: colors.text.primary },
  titoloMobile: { color: colors.brand.navy },
  testoSecondario: { color: colors.text.secondary },
});
