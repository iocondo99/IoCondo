import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import {
  badgeStatoAssemblea,
  etichettaModalitaAssemblea,
  etichettaStatoAssemblea,
  etichettaTipoAssemblea,
  filtraEOrdinaAssemblee,
  filtriAssembleeAttivi,
  opzioniFiltroStatoAssemblee,
  paginaAssemblee,
  riepilogoAssemblee,
  type AssembleaCondomino,
  type FiltriAssemblee,
  type FiltroStatoAssemblea,
  type OrdineAssemblee,
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

const FILTRI_INIZIALI: FiltriAssemblee = { stato: 'convocate', ricerca: '' };
const ERRORE_RIEPILOGO = 'Non è stato possibile caricare le assemblee.';

/**
 * Pagina "Assemblee" del condòmino (`/assemblee`, UC-10):
 * mostra l'elenco delle assemblee del condominio selezionato (escluse le bozze),
 * con StatCard reali (prossima assemblea, assemblee dell'anno, votazioni aperte),
 * filtri per stato, ricerca per titolo/ordine del giorno, ordinamento cronologico e paginazione.
 */
export function AssembleeScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, voci } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  const abilitata = voci.some((v) => v.id === 'assemblee');
  if (!abilitata) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Assemblee" subtitle="Assemblee ordinarie e straordinarie del condominio." />
        <NonAutorizzato />
      </View>
    );
  }

  return <AssembleeContenuto />;
}

function AssembleeContenuto() {
  const { profilo, condominio } = useProfilo();
  const router = useRouter();

  const utenteId = profilo!.id;
  const condominioId = condominio!.id;
  const chiave = `${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.assemblee.elencoAssembleeCondomino(utenteId, condominioId),
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

  const [filtri, setFiltri] = useState<FiltriAssemblee>(FILTRI_INIZIALI);
  const [ordine, setOrdine] = useState<OrdineAssemblee>('data-desc');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    setFiltri(FILTRI_INIZIALI);
    setOrdine('data-desc');
    setPagina(1);
  }, [chiave]);

  const pronto = blocco.stato === 'pronto';
  const caricamento = blocco.stato === 'caricamento';
  const errore = blocco.stato === 'errore';

  const tutteAssemblee: readonly AssembleaCondomino[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati : []),
    [blocco],
  );

  const riepilogo = useMemo(() => riepilogoAssemblee(tutteAssemblee), [tutteAssemblee]);

  const opzioniChip = useMemo(
    () =>
      opzioniFiltroStatoAssemblee(tutteAssemblee)
        .filter((o) => o.value !== 'tutte')
        .map((o) => ({ value: o.value, label: `${o.label} (${o.count})` })),
    [tutteAssemblee],
  );

  const assembleeFiltrate = useMemo(
    () => filtraEOrdinaAssemblee(tutteAssemblee, filtri, ordine),
    [tutteAssemblee, filtri, ordine],
  );

  const risultato = useMemo(
    () => paginaAssemblee(assembleeFiltrate, pagina),
    [assembleeFiltrate, pagina],
  );

  const sortState: SortState | null = useMemo(
    () => ({
      key: 'data',
      direction: ordine === 'data-asc' ? 'ascending' : 'descending',
    }),
    [ordine],
  );

  const cambiaFiltri = useCallback((parziale: Partial<FiltriAssemblee>) => {
    setFiltri((prev) => ({ ...prev, ...parziale }));
    setPagina(1);
  }, []);

  const azzeraFiltri = useCallback(() => {
    setFiltri(FILTRI_INIZIALI);
    setPagina(1);
  }, []);

  const cambiaOrdine = useCallback((nuovoSort: SortState | null) => {
    if (nuovoSort && nuovoSort.key === 'data') {
      setOrdine(nuovoSort.direction === 'ascending' ? 'data-asc' : 'data-desc');
    } else {
      setOrdine('data-desc');
    }
    setPagina(1);
  }, []);

  const apriDettaglio = useCallback(
    (a: AssembleaCondomino) => {
      router.push(`/assemblee/${a.id}` as Href);
    },
    [router],
  );

  const colonne: readonly DataColumn<AssembleaCondomino>[] = useMemo(
    () => [
      {
        key: 'data',
        header: 'Data assemblea',
        cell: (a) => <CellaDataAssemblea assemblea={a} />,
        mobile: 'title',
        sortable: true,
        weight: 3,
        minWidth: 220,
      },
      {
        key: 'luogo',
        header: 'Luogo / Modalità',
        cell: (a) => a.luogo?.trim() || etichettaModalitaAssemblea(a.modalita),
        weight: 2,
        minWidth: 160,
        mobileLabel: 'Luogo',
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (a) => (
          <Badge status={badgeStatoAssemblea(a.stato)} label={etichettaStatoAssemblea(a.stato)} />
        ),
        mobile: 'status',
        minWidth: 140,
      },
      {
        key: 'odg',
        header: 'Ordine del giorno',
        cell: (a) => <CellaOdg assemblea={a} />,
        minWidth: 160,
        mobileLabel: 'ODG',
      },
    ],
    [],
  );

  const nessunRecord = pronto && tutteAssemblee.length === 0;
  const filtriAttivi = filtriAssembleeAttivi(filtri);
  const erroreScheda = errore ? { message: ERRORE_RIEPILOGO, onRetry: ricarica } : undefined;

  const subtitolo = condominio?.nome
    ? `Assemblee ordinarie e straordinarie del condominio ${condominio.nome}.`
    : 'Assemblee ordinarie e straordinarie del condominio.';

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Assemblee"
        subtitle={subtitolo}
        action={{ label: 'Aggiorna', icon: 'refresh-cw', onPress: ricarica, loading: caricamento }}
      />

      {/* 3 StatCard reali */}
      <View style={styles.schede}>
        <View style={styles.scheda}>
          <StatCard
            icon="users"
            tile="violet"
            title="Prossima assemblea"
            value={
              pronto
                ? riepilogo.prossimaAssemblea
                  ? formatDate(riepilogo.prossimaAssemblea.data)
                  : 'Nessuna'
                : ''
            }
            description={
              pronto
                ? riepilogo.prossimaAssemblea
                  ? `${etichettaTipoAssemblea(riepilogo.prossimaAssemblea.tipo)} • ${
                      riepilogo.prossimaAssemblea.luogo?.trim() ||
                      etichettaModalitaAssemblea(riepilogo.prossimaAssemblea.modalita)
                    }`
                  : 'Non ci sono assemblee in programma'
                : undefined
            }
            action={
              riepilogo.prossimaAssemblea
                ? {
                    label: 'Dettagli',
                    variant: 'secondary',
                    onPress: () => router.push(`/assemblee/${riepilogo.prossimaAssemblea!.id}` as Href),
                    accessibilityHint: 'Apre il dettaglio della prossima assemblea convocata',
                  }
                : undefined
            }
            loading={caricamento}
            error={erroreScheda}
          />
        </View>

        <View style={styles.scheda}>
          <StatCard
            icon="calendar-days"
            tile="blue"
            title="Assemblee dell’anno"
            value={pronto ? String(riepilogo.totaleAnno) : ''}
            description={
              pronto
                ? riepilogo.totaleAnno === 0
                  ? 'Nessuna assemblea nell’anno corrente'
                  : riepilogo.totaleAnno === 1
                    ? '1 assemblea nell’anno corrente'
                    : `${riepilogo.totaleAnno} assemblee nell’anno corrente`
                : undefined
            }
            loading={caricamento}
            error={erroreScheda}
          />
        </View>

        <View style={styles.scheda}>
          <StatCard
            icon="clock"
            tile="teal"
            title="Votazioni aperte"
            value={pronto ? String(riepilogo.votazioniAperte) : ''}
            description={
              pronto
                ? riepilogo.votazioniAperte === 0
                  ? 'Nessuna votazione attiva al momento'
                  : riepilogo.votazioniAperte === 1
                    ? '1 punto all’ordine del giorno votabile'
                    : `${riepilogo.votazioniAperte} punti all’ordine del giorno votabili`
                : undefined
            }
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
      </View>

      {/* Scheda dati responsive con filtri e paginazione */}
      <Card>
        <ResponsiveDataView<AssembleaCondomino>
          label="Assemblee del condominio"
          columns={colonne}
          rows={risultato.assemblee}
          getRowKey={(a) => a.id}
          getRowLabel={(a) => `${formatDate(a.data)} - ${etichettaTipoAssemblea(a.tipo)}`}
          onRowPress={apriDettaglio}
          sort={sortState}
          onSortChange={cambiaOrdine}
          loading={caricamento}
          error={
            errore
              ? {
                  title: 'Non è stato possibile caricare le assemblee',
                  description: 'Controlla la connessione e riprova.',
                }
              : false
          }
          onRetry={ricarica}
          empty={{
            icon: 'users',
            title: 'Nessuna assemblea da mostrare.',
            description: filtriAttivi
              ? 'Nessuna assemblea corrisponde ai filtri impostati. Premi "Azzera filtri" per tornare all’elenco completo.'
              : 'Quando l’amministratore convocherà un’assemblea per questo condominio la troverai qui.',
            action: filtriAttivi
              ? {
                  label: 'Azzera filtri',
                  onPress: azzeraFiltri,
                }
              : undefined,
          }}
          filters={
            nessunRecord ? null : (
              <View style={styles.filtri}>
                <SearchBar
                  value={filtri.ricerca}
                  onChangeText={(ricerca) => cambiaFiltri({ ricerca })}
                  label="Cerca assemblee"
                  placeholder="Cerca ordine del giorno, tipo o luogo…"
                  showLabel
                />
                {opzioniChip.length > 0 ? (
                  <FilterChips
                    label="Filtra per stato"
                    allLabel="Tutte"
                    options={opzioniChip}
                    value={filtri.stato === 'tutte' ? [] : [filtri.stato]}
                    onChange={(valori) =>
                      cambiaFiltri({
                        stato: (valori[0] as FiltroStatoAssemblea) || 'tutte',
                      })
                    }
                  />
                ) : null}
                {pronto ? (
                  <ConteggioAssemblee
                    mostrati={risultato.assemblee.length}
                    totale={risultato.totaleFiltrati}
                    tutti={tutteAssemblee.length}
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
                label="Pagine delle assemblee"
              />
            ) : null
          }
        />
      </Card>
    </View>
  );
}

function CellaDataAssemblea({ assemblea }: { assemblea: AssembleaCondomino }) {
  const { breakpoint, isMobile } = useBreakpoint();
  return (
    <View style={styles.cellaData}>
      <Text
        accessibilityRole={isMobile ? 'header' : undefined}
        aria-level={isMobile ? 3 : undefined}
        style={[
          textStyle(isMobile ? 'h4' : 'body', breakpoint),
          isMobile ? styles.titoloMobile : styles.titoloTabella,
        ]}
      >
        {formatDate(assemblea.data)}
      </Text>
      <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
        {etichettaTipoAssemblea(assemblea.tipo)} • {etichettaModalitaAssemblea(assemblea.modalita)}
      </Text>
    </View>
  );
}

function CellaOdg({ assemblea }: { assemblea: AssembleaCondomino }) {
  const { breakpoint } = useBreakpoint();
  if (assemblea.stato === 'IN_CORSO' && (assemblea.votazioniAperte ?? 0) > 0) {
    return (
      <Badge
        status="votazione-aperta"
        label={
          assemblea.votazioniAperte === 1 ? '1 votazione aperta' : `${assemblea.votazioniAperte} votazioni aperte`
        }
      />
    );
  }
  const numPunti = assemblea.totalePuntiOdg ?? assemblea.puntiOdg?.length ?? 0;
  return (
    <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
      {numPunti === 0
        ? 'Nessun punto'
        : numPunti === 1
          ? '1 punto ODG'
          : `${numPunti} punti ODG`}
    </Text>
  );
}

function ConteggioAssemblee({
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
        ? 'C’è un’assemblea registrata.'
        : `Ci sono ${tutti} assemblee registrate.`
      : `${totale === 1 ? 'Un’assemblea' : `${totale} assemblee`} su ${tutti}.`;

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
  pagina: {
    alignSelf: 'stretch',
    gap: space[6],
  },
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
  filtri: {
    gap: space[3],
  },
  cellaData: {
    gap: space[1],
  },
  titoloTabella: {
    color: colors.text.primary,
  },
  titoloMobile: {
    color: colors.brand.navy,
  },
  testoSecondario: {
    color: colors.text.secondary,
  },
});
