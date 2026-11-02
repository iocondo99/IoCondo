import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  OPZIONI_STATO_COMUNICAZIONI,
  colonnaDaOrdineComunicazioni,
  etichettaAutore,
  etichettaRigaComunicazione,
  filtriComunicazioniAttivi,
  ordineComunicazioniDaColonna,
  paginaComunicazioni,
  sottotitoloComunicazioni,
  type ComunicazioneRiga,
  type FiltriComunicazioni,
  type OrdineComunicazioni,
} from '@iocondo/data';
import {
  Badge,
  Card,
  FilterChips,
  Icon,
  NonAutorizzato,
  PageHeader,
  Pagination,
  ResponsiveDataView,
  SearchBar,
  borderWidths,
  colors,
  formatDate,
  radii,
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

const FILTRI_INIZIALI: FiltriComunicazioni = { stato: 'tutti', ricerca: '' };

/** Pagina "Comunicazioni" del condòmino: sola lettura degli avvisi del condominio selezionato. */
export function ComunicazioniScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, voci } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;

  const abilitata = voci.some((v) => v.id === 'comunicazioni');
  if (!abilitata) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Comunicazioni" subtitle="Avvisi e comunicazioni del condominio." />
        <NonAutorizzato />
      </View>
    );
  }
  return <ComunicazioniContenuto />;
}

function ComunicazioniContenuto() {
  const { profilo, condominio } = useProfilo();
  const router = useRouter();

  const utenteId = profilo!.id;
  const condominioId = condominio!.id;
  const chiave = `${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.comunicazioni.listMie(utenteId, condominioId),
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

  const [filtri, setFiltri] = useState<FiltriComunicazioni>(FILTRI_INIZIALI);
  const [ordine, setOrdine] = useState<OrdineComunicazioni>('predefinito');
  const [pagina, setPagina] = useState(1);

  // Cambio condominio o utente: azzera filtri, ordinamento e pagina senza ricaricare l'app.
  useEffect(() => {
    setFiltri(FILTRI_INIZIALI);
    setOrdine('predefinito');
    setPagina(1);
  }, [chiave]);

  const pronto = blocco.stato === 'pronto';
  const caricamento = blocco.stato === 'caricamento';
  const errore = blocco.stato === 'errore';

  const tutte: readonly ComunicazioneRiga[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati : []),
    [blocco],
  );
  const risultato = useMemo(
    () => paginaComunicazioni(tutte, filtri, ordine, pagina),
    [tutte, filtri, ordine, pagina],
  );
  const sort = useMemo(() => colonnaDaOrdineComunicazioni(ordine), [ordine]);

  const cambiaFiltri = useCallback((parziale: Partial<FiltriComunicazioni>) => {
    setFiltri((f) => ({ ...f, ...parziale }));
    setPagina(1);
  }, []);
  const cambiaOrdine = useCallback((s: SortState | null) => {
    setOrdine(ordineComunicazioniDaColonna(s));
    setPagina(1);
  }, []);
  const apriDettaglio = useCallback(
    (c: ComunicazioneRiga) => router.push(`/comunicazioni/${c.id}` as Href),
    [router],
  );

  const colonne: readonly DataColumn<ComunicazioneRiga>[] = useMemo(
    () => [
      {
        key: 'titolo',
        header: 'Titolo',
        cell: (c) => <CellaTitolo comunicazione={c} />,
        mobile: 'title',
        weight: 3,
        minWidth: 220,
      },
      {
        key: 'data',
        header: 'Data',
        cell: (c) => formatDate(c.dataPubblicazione),
        sortable: true,
        minWidth: 120,
        mobileLabel: 'Data',
      },
      {
        key: 'autore',
        header: 'Autore',
        cell: (c) => etichettaAutore(c.autoreNome),
        minWidth: 150,
        mobileLabel: 'Autore',
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (c) => <CellaStatoLettura stato={c.statoLettura} />,
        mobile: 'status',
        minWidth: 130,
      },
    ],
    [],
  );

  const nessunaComunicazione = pronto && tutte.length === 0;
  const conFiltri = filtriComunicazioniAttivi(filtri) > 0;

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Comunicazioni"
        subtitle={sottotitoloComunicazioni(condominio?.nome)}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      <Card>
        <ResponsiveDataView
          label="Comunicazioni del condominio"
          columns={colonne}
          rows={risultato.comunicazioni as ComunicazioneRiga[]}
          getRowKey={(c) => c.id}
          getRowLabel={(c) => etichettaRigaComunicazione(c, formatDate(c.dataPubblicazione))}
          onRowPress={apriDettaglio}
          sort={sort}
          onSortChange={cambiaOrdine}
          loading={caricamento}
          error={
            errore
              ? {
                  title: 'Non è stato possibile caricare le comunicazioni',
                  description: 'Controlla la connessione e riprova.',
                }
              : false
          }
          onRetry={ricarica}
          empty={{
            icon: 'message-circle',
            title: 'Non ci sono comunicazioni da mostrare.',
            description: conFiltri
              ? 'Nessuna comunicazione corrisponde alla ricerca o ai filtri. Cancella la ricerca o premi "Azzera filtri".'
              : 'Quando l’amministratore pubblicherà un avviso lo troverai qui.',
          }}
          filters={
            nessunaComunicazione ? null : (
              <View style={styles.filtri}>
                <SearchBar
                  value={filtri.ricerca}
                  onChangeText={(ricerca) => cambiaFiltri({ ricerca })}
                  label="Cerca per titolo"
                  placeholder="Cerca una comunicazione…"
                  showLabel
                />
                <FilterChips
                  label="Filtra per stato"
                  options={OPZIONI_STATO_COMUNICAZIONI}
                  value={filtri.stato === 'tutti' ? [] : [filtri.stato]}
                  onChange={(valori) =>
                    cambiaFiltri({
                      stato: (valori[0] as FiltriComunicazioni['stato'] | undefined) ?? 'tutti',
                    })
                  }
                />
                {pronto ? (
                  <Conteggio
                    mostrate={risultato.comunicazioni.length}
                    totale={risultato.totaleFiltrati}
                    tutte={tutte.length}
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
                label="Pagine delle comunicazioni"
              />
            ) : null
          }
        />
      </Card>
    </View>
  );
}

/** Titolo della comunicazione con etichetta testuale esplicita se il post è fissato in cima. */
function CellaTitolo({ comunicazione }: { comunicazione: ComunicazioneRiga }) {
  const { breakpoint, isMobile } = useBreakpoint();
  return (
    <View style={styles.cellaTitolo}>
      {comunicazione.fissato ? (
        <View style={styles.fissataTag}>
          <Icon name="info" size="indicator" color={colors.brand.teal} />
          <Text style={[textStyle('label', breakpoint), styles.fissataTesto]}>Fissata in alto</Text>
        </View>
      ) : null}
      <Text
        accessibilityRole={isMobile ? 'header' : undefined}
        aria-level={isMobile ? 3 : undefined}
        style={[
          textStyle(isMobile || comunicazione.statoLettura === 'non-letta' ? 'h4' : 'body', breakpoint),
          isMobile ? styles.titoloMobile : styles.titoloTabella,
        ]}
      >
        {comunicazione.titolo}
      </Text>
    </View>
  );
}

/** Stato di lettura: Badge "Non letto" (testo + icona), testo "Letta" oppure "—" se senza notifica. */
function CellaStatoLettura({ stato }: { stato: ComunicazioneRiga['statoLettura'] }) {
  const { breakpoint } = useBreakpoint();
  if (stato === 'non-letta') return <Badge status="non-letto" />;
  if (stato === 'letta') {
    return <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>Letta</Text>;
  }
  return <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>—</Text>;
}

/** Frase letta dagli screen reader a ogni cambio di filtro. */
function Conteggio({ mostrate, totale, tutte }: { mostrate: number; totale: number; tutte: number }) {
  const { breakpoint } = useBreakpoint();
  const testo =
    totale === tutte
      ? tutte === 1
        ? 'C’è una comunicazione.'
        : `Ci sono ${tutte} comunicazioni.`
      : `${totale === 1 ? 'Una comunicazione' : `${totale} comunicazioni`} su ${tutte}.`;
  return (
    <View role="status" aria-live="polite" aria-atomic>
      <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
        {testo}
        {mostrate < totale ? ` Qui ne vedi ${mostrate}.` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  filtri: { gap: space[3] },
  cellaTitolo: { alignItems: 'flex-start', gap: space[1] },
  fissataTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    borderWidth: borderWidths.thin,
    borderColor: colors.brand.teal,
    backgroundColor: colors.background,
  },
  fissataTesto: { color: colors.brand.navy },
  titoloTabella: { color: colors.text.primary },
  titoloMobile: { color: colors.brand.navy },
  testoSecondario: { color: colors.text.secondary },
});
