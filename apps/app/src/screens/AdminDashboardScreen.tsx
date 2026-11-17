import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  formattaStatoEsercizio,
  formattaTipoAssemblea,
  type AdminDashboardData,
} from '@iocondo/data';
import {
  Breadcrumbs,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PageHeader,
  StatCard,
  borderWidths,
  colors,
  focusRing,
  formatDate,
  formatEuro,
  radii,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { GrigliaSchede } from '@/components/home/GrigliaSchede';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function AdminDashboardScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio } = useProfilo();

  if (!consentito || !profilo) return null;
  if (!condominio) {
    return (
      <EmptyState
        icon="building-2"
        title="Nessun condominio selezionato"
        description="Non risultano condomini attivi associati a questo account amministratore."
      />
    );
  }

  return <AdminDashboardContenuto />;
}

function AdminDashboardContenuto() {
  const router = useRouter();
  const { condominio } = useProfilo();
  const { isDesktop, isMobile } = useBreakpoint();

  const [dati, setDati] = useState<AdminDashboardData | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  const caricaDati = useCallback(async () => {
    if (!condominio?.id) {
      setCaricamento(false);
      return;
    }
    setCaricamento(true);
    setErrore(false);
    try {
      const res = await services.adminDashboard.caricaDatiDashboard(condominio.id);
      setDati(res);
    } catch {
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id]);

  useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  const breadcrumbs = [
    { label: 'Dashboard' },
  ];

  if (caricamento) {
    return (
      <View style={styles.schermata}>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader
          title="Dashboard Amministratore"
          subtitle={condominio ? `${condominio.nome} · Caricamento dati…` : 'Caricamento dati…'}
        />
        <LoadingState message="Caricamento indicatori gestionali in corso…" />
      </View>
    );
  }

  if (errore || !dati) {
    return (
      <View style={styles.schermata}>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader
          title="Dashboard Amministratore"
          subtitle={condominio?.nome ?? 'Gestione Condominio'}
        />
        <ErrorState
          title="Impossibile caricare i dati della dashboard"
          description="Si è verificato un errore durante il recupero dei dati contabili e manutentivi. Controlla la connessione e riprova."
          onRetry={caricaDati}
        />
      </View>
    );
  }

  const { kpi, esercizioCorrente, ticketUrgenti, ultimeComunicazioni } = dati;

  const descEsercizio = esercizioCorrente
    ? `Esercizio ${esercizioCorrente.anno} (${formattaStatoEsercizio(esercizioCorrente.stato)})`
    : 'Nessun esercizio attivo';

  const sottotitoloHeader = `${condominio?.nome ?? 'Condominio'} · ${descEsercizio}`;

  // StatCard 1: Saldo cassa
  const descSaldo = kpi.saldoCassa >= 0 ? 'Disponibilità bancaria e cassa' : 'Saldo di cassa negativo';

  // StatCard 2: Riscossione rate
  const descRate = `Riscossi: ${kpi.percentualeRiscossione}% · Morosità > 15 gg: ${formatEuro(kpi.morositaScadutaOltre15gg)}`;

  // StatCard 3: Ticket guasti aperti
  const descTicket = `${kpi.ticketAperti} aperti · ${kpi.ticketInLavorazione} in lavorazione`;

  // StatCard 4: Prossima assemblea
  const valoreAssemblea = kpi.prossimaAssemblea ? formatDate(kpi.prossimaAssemblea.data) : 'Nessuna';
  const descAssemblea = kpi.prossimaAssemblea
    ? `${formattaTipoAssemblea(kpi.prossimaAssemblea.tipo)} · ${kpi.prossimaAssemblea.luogo ?? 'In sede'}`
    : 'Nessuna convocata';

  return (
    <View style={styles.schermata}>
      <Breadcrumbs items={breadcrumbs} />

      <PageHeader
        title="Dashboard Amministratore"
        subtitle={sottotitoloHeader}
      />

      {/* 4 StatCard ufficiali */}
      <GrigliaSchede>
        <StatCard
          icon="coins"
          tile="navy"
          title="Saldo cassa"
          value={formatEuro(kpi.saldoCassa)}
          description={descSaldo}
          action={{
            label: 'Vedi movimenti',
            onPress: () => router.push('/admin/contabilita' as Href),
            accessibilityHint: 'Vai alla sezione contabilità per vedere i movimenti',
          }}
        />

        <StatCard
          icon="credit-card"
          tile="teal"
          title="Riscossione rate"
          value={formatEuro(kpi.totaleDaRiscuotere)}
          description={descRate}
          action={{
            label: 'Piano rate',
            onPress: () => router.push('/admin/contabilita' as Href),
            accessibilityHint: 'Vai alla gestione rate e riscossione',
          }}
        />

        <StatCard
          icon="wrench"
          tile="blue"
          title="Ticket guasti aperti"
          value={`${kpi.ticketTotaliAttivi}`}
          description={descTicket}
          action={{
            label: 'Tutti i ticket',
            onPress: () => router.push('/admin/manutenzione' as Href),
            accessibilityHint: 'Vai alla gestione dei ticket di manutenzione',
          }}
        />

        <StatCard
          icon="users"
          tile="violet"
          title="Prossima assemblea"
          value={valoreAssemblea}
          description={descAssemblea}
          action={
            kpi.prossimaAssemblea
              ? {
                  label: 'Dettagli',
                  onPress: () => router.push('/admin/assemblee' as Href),
                  accessibilityHint: 'Visualizza i dettagli dell’assemblea convocata',
                }
              : undefined
          }
        />
      </GrigliaSchede>

      {/* Layout desktop a 2 colonne (collassabile verticalmente su tablet e mobile) */}
      <View style={[styles.layoutColonne, !isDesktop && styles.layoutColonneCollassate]}>
        {/* Colonna Sinistra */}
        <View style={[styles.colonnaSinistra, !isDesktop && styles.colonnaImpilata]}>
          {/* Ticket guasti urgenti */}
          <StatCard
            icon="wrench"
            tile={ticketUrgenti.length > 0 ? 'navy' : 'blue'}
            title="Ticket guasti urgenti"
            value={`${ticketUrgenti.length}`}
            description={
              ticketUrgenti.length === 0
                ? 'Nessun ticket urgente in attesa'
                : ticketUrgenti.length === 1
                  ? '1 ticket urgente da gestire'
                  : `${ticketUrgenti.length} ticket urgenti da gestire`
            }
            action={{
              label: 'Gestisci tutti',
              onPress: () => router.push('/admin/manutenzione' as Href),
              accessibilityHint: 'Visualizza e gestisci tutti i ticket di manutenzione',
            }}
          />

          {/* Ultime comunicazioni pubblicate */}
          <StatCard
            icon="message-circle"
            tile="blue"
            title="Ultime comunicazioni pubblicate"
            value={`${ultimeComunicazioni.length}`}
            description={
              ultimeComunicazioni.length === 0
                ? 'Nessuna comunicazione in bacheca'
                : 'Avvisi e circolari pubblicati in bacheca'
            }
            action={{
              label: 'Vedi tutte',
              onPress: () => router.push('/admin/comunicazioni' as Href),
              accessibilityHint: 'Vai a tutte le comunicazioni pubblicate in bacheca',
            }}
          />
        </View>

        {/* Colonna Destra */}
        <View style={[styles.colonnaDestra, !isDesktop && styles.colonnaImpilata]}>
          {/* Stato riscossione dell'esercizio */}
          <StatCard
            icon="credit-card"
            tile="teal"
            title="Stato riscossione dell'esercizio"
            value={`${kpi.percentualeRiscossione}%`}
            description={`Da riscuotere ${formatEuro(kpi.totaleDaRiscuotere)}`}
            action={{
              label: 'Dettaglio',
              onPress: () => router.push('/admin/contabilita' as Href),
              accessibilityHint: 'Vai alla gestione contabile completa delle rate',
            }}
          />

          {/* Blocco Azioni rapide */}
          <Card title="Azioni rapide">
            <View style={styles.listaAzioniRapide}>
              <AzioneRapidaCard
                icon="message-circle"
                tile="blue"
                titolo="Nuovo avviso"
                descrizione="Pubblica una comunicazione o circolare in bacheca"
                onPress={() => router.push('/admin/comunicazioni' as Href)}
                accessibilityHint="Apri la sezione comunicazioni per creare un nuovo avviso"
              />

              <AzioneRapidaCard
                icon="coins"
                tile="teal"
                titolo="Registra movimento"
                descrizione="Inserisci un incasso di quota o registra una spesa"
                onPress={() => router.push('/admin/contabilita' as Href)}
                accessibilityHint="Apri la contabilità per inserire un movimento"
              />

              <AzioneRapidaCard
                icon="wrench"
                tile="navy"
                titolo="Consegna ticket"
                descrizione="Assegna un guasto o aggiorna lo stato dell'intervento"
                onPress={() => router.push('/admin/manutenzione' as Href)}
                accessibilityHint="Apri la manutenzione per gestire i ticket dei fornitori"
              />
            </View>
          </Card>
        </View>
      </View>
    </View>
  );
}

interface AzioneRapidaCardProps {
  icon: 'message-circle' | 'coins' | 'wrench' | 'mail';
  tile: 'blue' | 'teal' | 'navy' | 'violet';
  titolo: string;
  descrizione: string;
  onPress: () => void;
  accessibilityHint: string;
  disabled?: boolean;
}

function AzioneRapidaCard({
  icon,
  tile,
  titolo,
  descrizione,
  onPress,
  accessibilityHint,
  disabled = false,
}: AzioneRapidaCardProps) {
  const palette = colors.tile[tile];
  const [focalizzato, setFocalizzato] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titolo}: ${descrizione}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocalizzato(true)}
      onBlur={() => setFocalizzato(false)}
      style={({ hovered, pressed }) => [
        styles.pulsanteAzioneRapida,
        hovered && styles.pulsanteAzioneRapidaHover,
        pressed && styles.pulsanteAzioneRapidaPressed,
        focalizzato && Platform.OS === 'web' && focusRing,
        disabled && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.iconaAzioneRapida, { backgroundColor: palette.background }]}>
        <Icon name={icon} size="action" color={palette.foreground} />
      </View>
      <View style={styles.testiAzioneRapida}>
        <Text style={[textStyle('h4'), styles.titoloAzione]}>{titolo}</Text>
        <Text style={[textStyle('secondary'), styles.descAzione]}>{descrizione}</Text>
      </View>
      <Icon name="chevron-right" size="action" color={colors.text.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  schermata: {
    width: '100%',
    gap: space[6],
  },
  layoutColonne: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[6],
    width: '100%',
  },
  layoutColonneCollassate: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  // Su tablet e smartphone le colonne sono una sotto l'altra: altezza del contenuto, niente
  // divisione dello spazio (altrimenti le schede si allungano o vengono tagliate e si sovrappongono).
  colonnaImpilata: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  colonnaSinistra: {
    flex: 1.15,
    minWidth: 0,
    width: '100%',
    gap: space[6],
  },
  colonnaDestra: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    gap: space[6],
  },
  listaAzioniRapide: {
    gap: space[3],
  },
  pulsanteAzioneRapida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  pulsanteAzioneRapidaHover: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
  },
  pulsanteAzioneRapidaPressed: {
    backgroundColor: colors.border,
  },
  iconaAzioneRapida: {
    width: 44,
    height: 44,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testiAzioneRapida: {
    flex: 1,
    gap: space[1],
  },
  titoloAzione: {
    color: colors.brand.navy,
  },
  descAzione: {
    color: colors.text.secondary,
  },
});

