import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  formattaStatoEsercizio,
  formattaTipoAssemblea,
  type AdminDashboardData,
} from '@iocondo/data';
import {
  Badge,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ListRow,
  ListRows,
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

  if (!consentito || !profilo || !condominio) return null;

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
        <View style={styles.colonnaSinistra}>
          {/* Ticket guasti urgenti */}
          <Card
            title="Ticket guasti urgenti"
            action={{
              label: 'Gestisci tutti',
              onPress: () => router.push('/admin/manutenzione' as Href),
              accessibilityHint: 'Visualizza e gestisci tutti i ticket di manutenzione',
            }}
          >
            {ticketUrgenti.length === 0 ? (
              <EmptyState
                icon="wrench"
                title="Nessun ticket urgente in attesa"
                description="Tutti i ticket urgenti o ad alta priorità risultano presi in carico o risolti."
              />
            ) : (
              <ListRows label="Elenco ticket guasti urgenti">
                {ticketUrgenti.map((t) => {
                  const tileTipo = t.priorita === 'URGENTE' ? 'error' : 'blue';
                  const statoBadge = t.stato === 'APERTO' ? 'aperto' : 'in-lavorazione';
                  const ambito = t.isAreaComune ? 'Area comune' : 'Unità privata';
                  const dataApertura = formatDate(t.createdAt);

                  return (
                    <View key={t.id} style={styles.rigaTicketContenitore}>
                      <View style={styles.rigaTicketCorpo}>
                        <ListRow
                          icon="wrench"
                          tile={tileTipo}
                          title={t.titolo}
                          description={`${ambito} · Priorità ${t.priorita.toLowerCase()} · Aperto il ${dataApertura}`}
                          badge={statoBadge}
                          onPress={() => router.push('/admin/manutenzione' as Href)}
                          accessibilityHint={`Gestisci ticket ${t.titolo}`}
                        />
                      </View>
                      <View style={styles.azioneRapidaTicket}>
                        <Button
                          variant="secondary"
                          label="Gestisci"
                          icon="wrench"
                          onPress={() => router.push('/admin/manutenzione' as Href)}
                          accessibilityHint={`Gestisci ticket ${t.titolo}`}
                        />
                      </View>
                    </View>
                  );
                })}
              </ListRows>
            )}
          </Card>

          {/* Ultime comunicazioni pubblicate */}
          <Card
            title="Ultime comunicazioni pubblicate"
            action={{
              label: 'Vedi tutte',
              onPress: () => router.push('/admin/comunicazioni' as Href),
              accessibilityHint: 'Vai a tutte le comunicazioni pubblicate in bacheca',
            }}
          >
            {ultimeComunicazioni.length === 0 ? (
              <EmptyState
                icon="message-circle"
                title="Nessuna comunicazione pubblicata"
                description="Non risultano avvisi o circolari recenti in bacheca."
              />
            ) : (
              <ListRows label="Elenco ultime comunicazioni">
                {ultimeComunicazioni.map((c) => {
                  const anteprima = c.corpo ? c.corpo.slice(0, 110) + (c.corpo.length > 110 ? '…' : '') : '';
                  return (
                    <ListRow
                      key={c.id}
                      icon="message-circle"
                      tile="blue"
                      title={c.titolo}
                      description={anteprima}
                      meta={formatDate(c.dataPubblicazione)}
                      badge={c.isPinned ? 'condominiale' : undefined}
                      onPress={() => router.push('/admin/comunicazioni' as Href)}
                      accessibilityHint={`Visualizza comunicazione ${c.titolo}`}
                    />
                  );
                })}
              </ListRows>
            )}
          </Card>
        </View>

        {/* Colonna Destra */}
        <View style={styles.colonnaDestra}>
          {/* Stato riscossione dell'esercizio */}
          <Card
            title="Stato riscossione dell'esercizio"
            action={{
              label: 'Dettaglio',
              onPress: () => router.push('/admin/contabilita' as Href),
              accessibilityHint: 'Vai alla gestione contabile completa delle rate',
            }}
          >
            <View style={styles.sezioneRiscossione}>
              {/* Barra avanzamento percentuale */}
              <View style={styles.bloccoAvanzamento}>
                <View style={styles.testataAvanzamento}>
                  <Text style={[textStyle('label'), styles.etichettaGrigio]}>Riscossione complessiva</Text>
                  <Text style={[textStyle('h3'), styles.percentualeValore]}>
                    {kpi.percentualeRiscossione}%
                  </Text>
                </View>
                <View
                  role="progressbar"
                  aria-valuenow={kpi.percentualeRiscossione}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Percentuale riscossione dell’esercizio: ${kpi.percentualeRiscossione}%`}
                  style={styles.tracciaProgresso}
                >
                  <View
                    style={[
                      styles.barraProgresso,
                      { width: `${Math.min(100, Math.max(0, kpi.percentualeRiscossione))}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Dettagli importi contabili */}
              <View style={styles.grigliaImporti}>
                <View style={styles.rigaImporto}>
                  <Text style={[textStyle('secondary'), styles.nomeVoce]}>Totale emesso dovuto</Text>
                  <Text style={[textStyle('h4'), styles.valoreVoce]}>
                    {formatEuro(kpi.totaleDovutoEsercizio)}
                  </Text>
                </View>

                <View style={styles.rigaImporto}>
                  <Text style={[textStyle('secondary'), styles.nomeVoce]}>Totale riscosso</Text>
                  <Text style={[textStyle('h4'), styles.valoreVoceSuccesso]}>
                    {formatEuro(kpi.totaleIncassatoEsercizio)}
                  </Text>
                </View>

                <View style={styles.rigaImporto}>
                  <Text style={[textStyle('secondary'), styles.nomeVoce]}>Residuo da riscuotere</Text>
                  <Text style={[textStyle('h4'), styles.valoreVoce]}>
                    {formatEuro(kpi.totaleDaRiscuotere)}
                  </Text>
                </View>
              </View>

              {/* Riquadro Morosità scaduta > 15 gg */}
              <View style={styles.riquadroMorosita}>
                <View style={styles.morositaHeader}>
                  <Icon name="circle-alert" size="action" color={colors.semantic.error.foreground} />
                  <Text style={[textStyle('h4'), styles.titoloMorosita]}>
                    Morosità scaduta &gt; 15 giorni
                  </Text>
                </View>
                <Text style={[textStyle('secondary'), styles.descMorosita]}>
                  {kpi.morositaScadutaOltre15gg > 0
                    ? `Importo insoluto di ${formatEuro(kpi.morositaScadutaOltre15gg)} su ${kpi.posizioniMoroseOltre15gg} ${
                        kpi.posizioniMoroseOltre15gg === 1 ? 'posizione scaduta' : 'posizioni scadute'
                      }.`
                    : 'Nessuna rata scaduta da oltre 15 giorni per l’esercizio corrente.'}
                </Text>
              </View>

              <Button
                fullWidth
                variant="secondary"
                label="Gestisci rate e solleciti"
                icon="calculator"
                onPress={() => router.push('/admin/contabilita' as Href)}
                accessibilityHint="Vai al modulo contabile per inviare solleciti o registrare incassi"
              />
            </View>
          </Card>

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
  icon: 'message-circle' | 'coins' | 'wrench';
  tile: 'blue' | 'teal' | 'navy';
  titolo: string;
  descrizione: string;
  onPress: () => void;
  accessibilityHint: string;
}

function AzioneRapidaCard({
  icon,
  tile,
  titolo,
  descrizione,
  onPress,
  accessibilityHint,
}: AzioneRapidaCardProps) {
  const palette = colors.tile[tile];
  const [focalizzato, setFocalizzato] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titolo}: ${descrizione}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onFocus={() => setFocalizzato(true)}
      onBlur={() => setFocalizzato(false)}
      style={({ hovered, pressed }) => [
        styles.pulsanteAzioneRapida,
        hovered && styles.pulsanteAzioneRapidaHover,
        pressed && styles.pulsanteAzioneRapidaPressed,
        focalizzato && Platform.OS === 'web' && focusRing,
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
  rigaTicketContenitore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    flexWrap: 'wrap',
  },
  rigaTicketCorpo: {
    flex: 1,
    minWidth: 220,
  },
  azioneRapidaTicket: {
    paddingRight: space[2],
    paddingVertical: space[2],
  },
  sezioneRiscossione: {
    gap: space[4],
  },
  bloccoAvanzamento: {
    gap: space[2],
    backgroundColor: colors.background,
    padding: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  testataAvanzamento: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  etichettaGrigio: {
    color: colors.text.secondary,
  },
  percentualeValore: {
    color: colors.brand.navy,
  },
  tracciaProgresso: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
    width: '100%',
  },
  barraProgresso: {
    height: '100%',
    backgroundColor: colors.action.default,
    borderRadius: radii.full,
  },
  grigliaImporti: {
    gap: space[3],
    paddingHorizontal: space[2],
  },
  rigaImporto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space[1],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  nomeVoce: {
    color: colors.text.secondary,
  },
  valoreVoce: {
    color: colors.brand.navy,
  },
  valoreVoceSuccesso: {
    color: colors.semantic.success.foreground,
  },
  riquadroMorosita: {
    backgroundColor: colors.semantic.error.background,
    borderColor: colors.semantic.error.foreground,
    borderWidth: borderWidths.thin,
    borderRadius: radii.card,
    padding: space[4],
    gap: space[2],
  },
  morositaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  titoloMorosita: {
    color: colors.semantic.error.foreground,
  },
  descMorosita: {
    color: colors.text.primary,
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

