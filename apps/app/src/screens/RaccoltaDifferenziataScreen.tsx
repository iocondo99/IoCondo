import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { IRaccoltaDifferenziata } from '@iocondo/shared-types';
import {
  GIORNI_SETTIMANA,
  badgeGiornoRelativo,
  contestoGiorniRaccolta,
  filtraTurniRaccolta,
  nomeGiornoSettimana,
  turniDelGiorno,
} from '@iocondo/data';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  Icon,
  LoadingState,
  NonAutorizzato,
  PageHeader,
  ResponsiveDataView,
  SearchBar,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  useBreakpoint,
  type DataColumn,
  type FilterOption,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

const OPZIONI_GIORNI: readonly FilterOption[] = GIORNI_SETTIMANA.map((g) => ({
  value: String(g.numero),
  label: g.breve,
}));

/**
 * Pagina "Raccolta differenziata" per Condòmino e Portiere (`/raccolta-differenziata`):
 * consultazione in sola lettura con evidenza immediata di "Oggi" e "Domani"
 * e calendario settimanale filtrabile per giorno e testo.
 */
export function RaccoltaDifferenziataScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('CONDOMINO') && !ruoli.has('PORTIERE')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Raccolta differenziata"
          subtitle="Calendario settimanale dei ritiri condominiali."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <RaccoltaDifferenziataContenuto />;
}

function RaccoltaDifferenziataContenuto() {
  const { profilo, condominio } = useProfilo();
  const { breakpoint, isMobile } = useBreakpoint();

  const utenteId = profilo!.id;
  const condominioId = condominio!.id;
  const chiave = `${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(
    () => services.raccoltaDifferenziata.elenco(condominioId),
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

  const [giornoFiltro, setGiornoFiltro] = useState<string[]>([]);
  const [ricerca, setRicerca] = useState('');

  // Reset filtri al cambio condominio per evitare stati vuoti fuorvianti
  useEffect(() => {
    setGiornoFiltro([]);
    setRicerca('');
  }, [condominioId]);

  const turni: readonly IRaccoltaDifferenziata[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati : []),
    [blocco],
  );

  const adesso = useMemo(() => new Date(), []);
  const contesto = useMemo(() => contestoGiorniRaccolta(adesso), [adesso]);

  const turniOggi = useMemo(
    () => turniDelGiorno(turni, contesto.oggi),
    [turni, contesto.oggi],
  );
  const turniDomani = useMemo(
    () => turniDelGiorno(turni, contesto.domani),
    [turni, contesto.domani],
  );

  const turniFiltrati = useMemo(() => {
    const giornoNum = giornoFiltro[0] ? Number(giornoFiltro[0]) : null;
    return filtraTurniRaccolta(turni, { giorno: giornoNum, ricerca });
  }, [turni, giornoFiltro, ricerca]);

  const colonne: readonly DataColumn<IRaccoltaDifferenziata>[] = useMemo(
    () => [
      {
        key: 'giorno',
        header: 'Giorno',
        weight: 1.4,
        minWidth: 160,
        mobile: 'title',
        cell: (r) => {
          const relativo = badgeGiornoRelativo(r.giorno_settimana, adesso);
          return (
            <View style={styles.cellaGiorno}>
              <Text style={[textStyle('h4', breakpoint), styles.testoPrimario]}>
                {nomeGiornoSettimana(r.giorno_settimana)}
              </Text>
              {relativo === 'oggi' ? <Badge status="in-corso" label="Oggi" /> : null}
              {relativo === 'domani' ? <Badge status="info" label="Domani" /> : null}
            </View>
          );
        },
      },
      {
        key: 'tipo',
        header: 'Tipologia rifiuto',
        weight: 1.6,
        minWidth: 180,
        mobile: 'badge',
        cell: (r) => <Badge status="success" label={r.tipo_rifiuto} />,
      },
      {
        key: 'note',
        header: 'Note e orari di esposizione',
        weight: 2.2,
        minWidth: 220,
        mobile: 'subtitle',
        cell: (r) => (
          <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
            {r.note?.trim() ? r.note : 'Nessuna nota aggiuntiva'}
          </Text>
        ),
      },
    ],
    [adesso, breakpoint],
  );

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Raccolta differenziata"
        subtitle={`Calendario settimanale dei ritiri — ${condominio!.nome}`}
      />

      {blocco.stato === 'caricamento' ? (
        <LoadingState message="Caricamento del calendario di raccolta…" />
      ) : null}

      {blocco.stato === 'errore' ? <ErrorState onRetry={ricarica} /> : null}

      {blocco.stato === 'pronto' && turni.length === 0 ? (
        <EmptyState
          icon="calendar-days"
          title="Nessun turno configurato"
          description="L'amministratore non ha ancora inserito il calendario della raccolta differenziata per questo condominio."
        />
      ) : null}

      {blocco.stato === 'pronto' && turni.length > 0 ? (
        <View style={styles.contenuto}>
          {/* Evidenza immediata "Oggi e Domani" */}
          <View style={[styles.grigliaEvidenza, isMobile && styles.grigliaEvidenzaMobile]}>
            <RiquadroGiorno
              etichetta={`Oggi — ${contesto.nomeOggi}`}
              badge="Oggi"
              badgeStatus="in-corso"
              turni={turniOggi}
              messaggioVuoto="Nessun ritiro previsto per oggi."
              breakpoint={breakpoint}
            />
            <RiquadroGiorno
              etichetta={`Domani — ${contesto.nomeDomani}`}
              badge="Domani"
              badgeStatus="info"
              turni={turniDomani}
              messaggioVuoto="Nessun ritiro previsto per domani."
              breakpoint={breakpoint}
            />
          </View>

          {/* Calendario settimanale completo con ricerca e filtro per giorno */}
          <Card title="Calendario settimanale" subtitle="Filtra per giorno o cerca un rifiuto">
            <View style={styles.controlli}>
              <SearchBar
                value={ricerca}
                onChangeText={setRicerca}
                label="Cerca nei turni di raccolta"
                placeholder="Cerca per tipologia di rifiuto o note (es. plastica, vetro, 7:00)…"
              />
              <FilterChips
                label="Filtra per giorno della settimana"
                options={OPZIONI_GIORNI}
                value={giornoFiltro}
                onChange={setGiornoFiltro}
              />
            </View>

            <View style={styles.tabellaWrap}>
              <ResponsiveDataView
                data={turniFiltrati}
                columns={colonne}
                keyExtractor={(r) => r.id}
                emptyTitle="Nessun turno trovato"
                emptyDescription="Prova a cambiare il giorno selezionato o i termini di ricerca."
                emptyIcon="calendar-days"
              />
            </View>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

interface RiquadroGiornoProps {
  etichetta: string;
  badge: string;
  badgeStatus: 'in-corso' | 'info';
  turni: readonly IRaccoltaDifferenziata[];
  messaggioVuoto: string;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

function RiquadroGiorno({
  etichetta,
  badge,
  badgeStatus,
  turni,
  messaggioVuoto,
  breakpoint,
}: RiquadroGiornoProps) {
  return (
    <View style={styles.riquadroWrapper}>
      <Card>
        <View style={styles.riquadroHeader}>
          <View style={styles.riquadroTitoloWrap}>
            <View
              style={[
                styles.riquadroIcona,
                badgeStatus === 'in-corso' ? styles.riquadroIconaOggi : styles.riquadroIconaDomani,
              ]}
            >
              <Icon
                name="calendar-days"
                size="action"
                color={
                  badgeStatus === 'in-corso'
                    ? colors.tile.teal.foreground
                    : colors.tile.blue.foreground
                }
              />
            </View>
            <Text style={[textStyle('h3', breakpoint), styles.testoPrimario]}>
              {etichetta}
            </Text>
          </View>
          <Badge status={badgeStatus} label={badge} />
        </View>

        {turni.length === 0 ? (
          <Text style={[textStyle('secondary', breakpoint), styles.testoMuted]}>
            {messaggioVuoto}
          </Text>
        ) : (
          <View style={styles.listaEvidenza}>
            {turni.map((t) => (
              <View key={t.id} style={styles.elementoEvidenza}>
                <View style={styles.elementoEvidenzaRiga}>
                  <Badge status="success" label={t.tipo_rifiuto} />
                </View>
                {t.note?.trim() ? (
                  <View style={styles.notaRiga}>
                    <Icon name="clock" size="indicator" color={colors.text.secondary} />
                    <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                      {t.note}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    gap: space[6],
  },
  contenuto: {
    gap: space[6],
  },
  grigliaEvidenza: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  grigliaEvidenzaMobile: {
    flexDirection: 'column',
  },
  riquadroWrapper: {
    flex: 1,
    minWidth: 280,
  },
  riquadroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space[2],
    marginBottom: space[3],
  },
  riquadroTitoloWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flexShrink: 1,
  },
  riquadroIcona: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riquadroIconaOggi: {
    backgroundColor: colors.tile.teal.background,
  },
  riquadroIconaDomani: {
    backgroundColor: colors.tile.blue.background,
  },
  listaEvidenza: {
    gap: space[3],
  },
  elementoEvidenza: {
    padding: space[3],
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[2],
  },
  elementoEvidenzaRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  notaRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  controlli: {
    gap: space[4],
    marginBottom: space[4],
  },
  tabellaWrap: {
    marginTop: space[2],
  },
  cellaGiorno: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  testoPrimario: {
    color: colors.text.primary,
  },
  testoSecondario: {
    color: colors.text.secondary,
    flexShrink: 1,
  },
  testoMuted: {
    color: colors.text.muted,
  },
});
