import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { IRaccoltaDifferenziata } from '@iocondo/shared-types';
import {
  GIORNI_SETTIMANA,
  badgeGiornoRelativo,
  contestoGiorniRaccolta,
  metadatiTipoRifiuto,
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
  SearchBar,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  useBreakpoint,
  type FilterOption,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { Bidone, SettimanaRaccolta } from '@/components/raccolta/SettimanaRaccolta';
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

  const utenteId = profilo?.id ?? '';
  const condominioId = condominio?.id ?? '';
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

  const giorniDaMostrare = useMemo(() => {
    const giornoNum = giornoFiltro[0] ? Number(giornoFiltro[0]) : null;
    const listaGiorni =
      giornoNum !== null
        ? GIORNI_SETTIMANA.filter((g) => g.numero === giornoNum)
        : GIORNI_SETTIMANA;

    const ricercaNorm = ricerca.trim().toLowerCase();

    return listaGiorni
      .map((g) => {
        const turniGiorno = turniDelGiorno(turni, g.numero);
        const turniFiltrati = ricercaNorm
          ? turniGiorno.filter((t) => {
              const tipo = t.tipo_rifiuto.toLowerCase();
              const note = (t.note ?? '').toLowerCase();
              return tipo.includes(ricercaNorm) || note.includes(ricercaNorm);
            })
          : turniGiorno;

        return {
          giorno: g.numero,
          nome: g.nome,
          breve: g.breve,
          turni: turniFiltrati,
          totaleGiorno: turniGiorno.length,
        };
      })
      .filter((g) => {
        if (ricercaNorm) {
          return g.turni.length > 0;
        }
        return true;
      });
  }, [turni, giornoFiltro, ricerca]);

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Raccolta differenziata"
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
          {/* Oggi e domani, in grande: è la domanda per cui si apre la pagina */}
          <View style={[styles.oggiDomani, isMobile && styles.oggiDomaniMobile]}>
            {[
              { titolo: `Oggi, ${contesto.nomeOggi.toLowerCase()}`, lista: turniOggi },
              { titolo: `Domani, ${contesto.nomeDomani.toLowerCase()}`, lista: turniDomani },
            ].map((d) => (
              <View key={d.titolo} style={[styles.oggiDomaniColonna, isMobile && styles.oggiDomaniColonnaMobile]}>
                <Text accessibilityRole="header" aria-level={2} style={[textStyle('h3', breakpoint), styles.testoPrimario]}>
                  {d.titolo}
                </Text>
                {d.lista.length === 0 ? (
                  <Text style={[textStyle('body', breakpoint), styles.testoMuted]}>Nessun ritiro.</Text>
                ) : (
                  d.lista.map((t) => <Bidone key={t.id} turno={t} grande />)
                )}
              </View>
            ))}
          </View>

          <View style={styles.settimanaSezione}>
            <Text accessibilityRole="header" aria-level={2} style={[textStyle('h3', breakpoint), styles.testoPrimario]}>
              La settimana
            </Text>
            <SettimanaRaccolta turni={turni} oggi={contesto.oggi} daLunedi />
          </View>
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
            {turni.map((t) => {
              const meta = metadatiTipoRifiuto(t.tipo_rifiuto);
              return (
                <View key={t.id} style={styles.elementoEvidenza}>
                  <View style={styles.elementoEvidenzaRiga}>
                    <Badge status={meta.tono} label={t.tipo_rifiuto} icon={meta.icona} />
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
              );
            })}
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  oggiDomani: { flexDirection: 'row', gap: space[8], alignItems: 'flex-start' },
  oggiDomaniMobile: { flexDirection: 'column', gap: space[6] },
  oggiDomaniColonna: { flex: 1, minWidth: 0, gap: space[3], maxWidth: 480 },
  // In colonna flex: 1 divide l'altezza e i blocchi si sovrappongono: qui l'altezza è quella del contenuto.
  oggiDomaniColonnaMobile: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', maxWidth: '100%', alignSelf: 'stretch' },
  settimanaSezione: { gap: space[4] },
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
  listaGiorni: {
    gap: space[4],
  },
  schedaGiorno: {
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    padding: space[4],
    gap: space[3],
  },
  schedaGiornoOggi: {
    borderLeftWidth: 4,
    borderLeftColor: colors.tile.teal.foreground,
  },
  schedaGiornoDomani: {
    borderLeftWidth: 4,
    borderLeftColor: colors.tile.blue.foreground,
  },
  schedaGiornoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space[2],
  },
  schedaGiornoTitoloWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  schedaGiornoCorpo: {
    gap: space[2],
  },
  elementoRitiro: {
    padding: space[3],
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[2],
  },
  elementoRitiroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  rigaVuotaGiorno: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
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
