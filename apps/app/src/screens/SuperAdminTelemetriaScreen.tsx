import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  calcolaKpiTelemetria,
  calcolaPercentualeCategoria,
  calcolaSoglieCapacita,
  orePerIntervallo,
  type DashboardTelemetriaData,
  type IntervalloTelemetria,
  type LivelloCapacita,
  type PuntoSerieOraria,
  type StatoCapacitaRisorsa,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  LoadingState,
  PageHeader,
  ResponsiveDataView,
  StatCard,
  colors,
  radii,
  space,
  textStyle,
  useBreakpoint,
  type BadgeStatus,
  type DataColumn,
  type IconName,
} from '@iocondo/ui';
import { GrigliaSchede } from '@/components/home/GrigliaSchede';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const INTERVALLI: ReadonlyArray<{ value: IntervalloTelemetria; label: string }> = [
  { value: '24h', label: 'Ultime 24 ore' },
  { value: '7g', label: 'Ultimi 7 giorni' },
  { value: '30g', label: 'Ultimi 30 giorni' },
];

function formattaOraBreve(iso: string, intervallo: IntervalloTelemetria): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (intervallo === '24h') {
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusDaLivello(livello: LivelloCapacita): BadgeStatus {
  if (livello === 'critico') return 'error';
  if (livello === 'attenzione') return 'warning';
  return 'success';
}

function coloreBarraDaLivello(livello: LivelloCapacita): string {
  if (livello === 'critico') return colors.semantic.error.foreground;
  if (livello === 'attenzione') return colors.semantic.warning.foreground;
  return colors.semantic.success.foreground;
}

function iconaDaLivello(livello: LivelloCapacita): IconName {
  if (livello === 'critico') return 'circle-x';
  if (livello === 'attenzione') return 'triangle-alert';
  return 'circle-check';
}

export function SuperAdminTelemetriaScreen() {
  const consentito = useAccessoConsentito();
  const { profilo } = useProfilo();
  if (!consentito || !profilo?.isSuperAdmin) return null;
  return <SuperAdminTelemetriaContenuto />;
}

function SuperAdminTelemetriaContenuto() {
  const { isMobile } = useBreakpoint();
  const [intervallo, setIntervallo] = useState<IntervalloTelemetria>('24h');
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [dati, setDati] = useState<DashboardTelemetriaData | null>(null);

  const carica = useCallback(async (target: IntervalloTelemetria) => {
    setCaricamento(true);
    setErrore(null);
    try {
      const res = await services.telemetria.getDashboardMetriche(orePerIntervallo(target));
      setDati(res);
    } catch (e: unknown) {
      setErrore(
        e instanceof Error
          ? e.message
          : 'Errore nel caricamento della telemetria di piattaforma.',
      );
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica(intervallo);
  }, [carica, intervallo]);

  const kpi = useMemo(() => (dati ? calcolaKpiTelemetria(dati) : null), [dati]);
  const capacita = useMemo(() => {
    if (!dati || !kpi) return null;
    return calcolaSoglieCapacita({
      dbSizeMb: dati.database.dbSizeMb,
      mau30g: dati.database.mau30g,
      piccoScrittureOra: kpi.piccoScrittureOra,
    });
  }, [dati, kpi]);

  // Mostra nella tabella/grafico le ore più recenti (max 24 righe in vista o quelle con traffico)
  const serieVisibile = useMemo(() => {
    if (!dati) return [];
    const ordinataDesc = [...dati.serieOraria].reverse();
    if (intervallo === '24h') return ordinataDesc;
    const conTraffico = ordinataDesc.filter(
      (r) => r.totaleOperazioni > 0 || r.utentiAttivi > 0 || r.erroriCount > 0,
    );
    return conTraffico.length > 0 ? conTraffico.slice(0, 48) : ordinataDesc.slice(0, 24);
  }, [dati, intervallo]);

  const maxOperazioniOra = useMemo(() => {
    let max = 1;
    for (const p of serieVisibile) {
      if (p.totaleOperazioni > max) max = p.totaleOperazioni;
    }
    return max;
  }, [serieVisibile]);

  const columns: DataColumn<PuntoSerieOraria>[] = useMemo(
    () => [
      {
        key: 'ora',
        header: 'Fascia oraria',
        minWidth: 130,
        mobile: 'title',
        cell: (r) => (
          <Text style={styles.cellaPrimaria}>{formattaOraBreve(r.oraBucket, intervallo)}</Text>
        ),
      },
      {
        key: 'utenti',
        header: 'Utenti attivi',
        minWidth: 100,
        align: 'end',
        cell: (r) => <Text style={styles.cellaNumero}>{r.utentiAttivi}</Text>,
      },
      {
        key: 'volume',
        header: 'Carico orario',
        minWidth: 170,
        cell: (r) => {
          const perc = Math.max(
            r.totaleOperazioni > 0 ? 4 : 0,
            Math.round((r.totaleOperazioni / maxOperazioniOra) * 100),
          );
          return (
            <View style={styles.barraContenitore}>
              <View style={styles.barraSfondo}>
                <View style={[styles.barraRiempimento, { width: `${perc}%` }]} />
              </View>
              <Text style={styles.cellaSecondaria}>{r.totaleOperazioni}</Text>
            </View>
          );
        },
      },
      {
        key: 'get',
        header: 'GET',
        minWidth: 70,
        align: 'end',
        cell: (r) => <Text style={styles.cellaNumero}>{r.getCount}</Text>,
      },
      {
        key: 'insert',
        header: 'INSERT',
        minWidth: 75,
        align: 'end',
        cell: (r) => <Text style={styles.cellaNumero}>{r.insertCount}</Text>,
      },
      {
        key: 'put',
        header: 'PUT/PATCH',
        minWidth: 95,
        align: 'end',
        cell: (r) => <Text style={styles.cellaNumero}>{r.putPatchCount}</Text>,
      },
      {
        key: 'edge',
        header: 'Edge Fn',
        minWidth: 80,
        align: 'end',
        cell: (r) => <Text style={styles.cellaNumero}>{r.edgeFnCount}</Text>,
      },
      {
        key: 'errori',
        header: 'Errori',
        minWidth: 80,
        align: 'end',
        cell: (r) =>
          r.erroriCount > 0 ? (
            <Badge label={String(r.erroriCount)} status="error" />
          ) : (
            <Text style={styles.cellaSecondaria}>0</Text>
          ),
      },
    ],
    [intervallo, maxOperazioniOra],
  );

  if (caricamento && !dati) {
    return <LoadingState message="Caricamento telemetria e metriche piattaforma…" />;
  }

  if (errore && !dati) {
    return (
      <ErrorState
        title="Impossibile caricare la telemetria"
        description={errore}
        onRetry={() => carica(intervallo)}
      />
    );
  }

  if (!dati || !kpi || !capacita) return null;

  const { database, notifichePeriodo, notificheStorico, codaEmail } = dati;
  const aggLabel = new Date(dati.generatoAt).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Telemetria & Prestazioni"
        subtitle={`Monitoraggio reale di utilizzo orario, notifiche e capacità Supabase / Vercel · Aggiornato alle ${aggLabel}`}
        breadcrumbs={[{ label: 'Super Admin' }, { label: 'Telemetria & Prestazioni' }]}
        action={{
          label: 'Aggiorna',
          icon: 'refresh-cw',
          loading: caricamento,
          onPress: () => carica(intervallo),
        }}
      />

      {errore ? <Alert tone="warning" title="Aggiornamento parziale" message={errore} /> : null}

      {/* Selettore intervallo temporale */}
      <View style={styles.controlliBarra} accessibilityRole="radiogroup" aria-label="Intervallo temporale">
        {INTERVALLI.map((opt) => (
          <Button
            key={opt.value}
            label={opt.label}
            variant={intervallo === opt.value ? 'primary' : 'secondary'}
            onPress={() => setIntervallo(opt.value)}
          />
        ))}
      </View>

      {/* KPI principali */}
      <GrigliaSchede>
        <StatCard
          icon="users"
          tile="navy"
          title="Utenti attivi (MAU 30g)"
          value={database.mau30g.toLocaleString('it-IT')}
          description={`Picco orario periodo: ${kpi.piccoOrarioUtenti} · Utenti totali: ${database.utentiTotali}`}
        />
        <StatCard
          icon="activity"
          tile="blue"
          title="Operazioni registrate"
          value={kpi.totaleOperazioni.toLocaleString('it-IT')}
          description={`GET ${kpi.totaleGet} · INS ${kpi.totaleInsert} · UPD ${kpi.totalePutPatch} · Rapporto L/S ${kpi.rapportoLettureScritture}`}
        />
        <StatCard
          icon="bell"
          tile="violet"
          title="Notifiche inviate (periodo)"
          value={notifichePeriodo.totale.toLocaleString('it-IT')}
          description={`Com. ${notifichePeriodo.comunicazioni} · Ass. ${notifichePeriodo.assemblee} · Boll. ${notifichePeriodo.bollettini}`}
        />
        <StatCard
          icon="database"
          tile="teal"
          title="Spazio Database & MAU"
          value={`${database.dbSizeMb.toFixed(1).replace('.', ',')} / 500 MB`}
          description={`MAU ${database.mau30g.toLocaleString('it-IT')} / 50.000 · Condomini attivi: ${database.condominiAttivi}`}
        />
      </GrigliaSchede>

      {/* Sezione 1 — Serie oraria Utenti e Operazioni */}
      <Card>
        <View style={styles.sezioneHeader}>
          <View style={styles.sezioneTitoloRow}>
            <Icon name="bar-chart-3" size="card" color={colors.brand.navy} />
            <View style={styles.sezioneTitoloTesto}>
              <Text style={styles.h2}>Andamento orario utenti e operazioni</Text>
              <Text style={styles.sottotitolo}>
                Dati raccolti in batch ogni 60 secondi dal client Supabase (esclusa la RPC di telemetria).
              </Text>
            </View>
          </View>
          {kpi.totaleErrori > 0 ? (
            <Badge label={`${kpi.totaleErrori} errori HTTP`} status="error" />
          ) : (
            <Badge label="0 errori HTTP" status="success" />
          )}
        </View>

        <ResponsiveDataView
          label="Serie oraria utenti e operazioni"
          rows={serieVisibile}
          columns={columns}
          getRowKey={(r) => r.oraBucket}
          getRowLabel={(r) => formattaOraBreve(r.oraBucket, intervallo)}
          empty={{
            title: "Nessun traffico registrato nell'intervallo",
            description:
              "I contatori appariranno non appena gli utenti autentificati interagiranno con l'app.",
          }}
        />
      </Card>

      {/* Sezione 2 — Notifiche per Categoria */}
      <Card>
        <View style={styles.sezioneHeader}>
          <View style={styles.sezioneTitoloRow}>
            <Icon name="bell" size="card" color={colors.brand.navy} />
            <View style={styles.sezioneTitoloTesto}>
              <Text style={styles.h2}>Notifiche inviate per categoria</Text>
              <Text style={styles.sottotitolo}>
                Confronto tra periodo selezionato ({notifichePeriodo.totale}) e totale storico ({notificheStorico.totale}).
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.grigliaCategorie, isMobile && styles.grigliaCategorieCompact]}>
          <CategoriaNotificaCard
            titolo="Comunicazioni"
            icona="message-circle"
            periodo={notifichePeriodo.comunicazioni}
            totalePeriodo={notifichePeriodo.totale}
            storico={notificheStorico.comunicazioni}
            colore={colors.tile.blue.foreground}
            sfondo={colors.tile.blue.background}
          />
          <CategoriaNotificaCard
            titolo="Assemblee"
            icona="users"
            periodo={notifichePeriodo.assemblee}
            totalePeriodo={notifichePeriodo.totale}
            storico={notificheStorico.assemblee}
            colore={colors.tile.violet.foreground}
            sfondo={colors.tile.violet.background}
          />
          <CategoriaNotificaCard
            titolo="Bollettini"
            icona="receipt"
            periodo={notifichePeriodo.bollettini}
            totalePeriodo={notifichePeriodo.totale}
            storico={notificheStorico.bollettini}
            colore={colors.tile.teal.foreground}
            sfondo={colors.tile.teal.background}
          />
          <CategoriaNotificaCard
            titolo="Altro"
            icona="info"
            periodo={notifichePeriodo.altro}
            totalePeriodo={notifichePeriodo.totale}
            storico={notificheStorico.altro}
            colore={colors.tile.navy.foreground}
            sfondo={colors.tile.navy.background}
          />
        </View>

        <View style={styles.separatore} />

        <View style={styles.codaEmailBox}>
          <Text style={styles.h4}>Coda Email (Resend)</Text>
          {codaEmail.disponibile ? (
            <View style={styles.codaEmailContenuto}>
              <Text style={styles.cellaSecondaria}>
                Totale email accodate: {codaEmail.totale} · Comunicazioni: {codaEmail.perCategoria.comunicazioni} · Assemblee: {codaEmail.perCategoria.assemblee} · Bollettini: {codaEmail.perCategoria.bollettini}
              </Text>
              <View style={styles.badgeRow}>
                <Badge label={`Inviate: ${codaEmail.perStato.sent}`} status="success" />
                <Badge label={`In attesa: ${codaEmail.perStato.pending}`} status="info" />
                <Badge label={`In elaborazione: ${codaEmail.perStato.processing}`} status="neutral" />
                <Badge
                  label={`Fallite: ${codaEmail.perStato.failed}`}
                  status={codaEmail.perStato.failed > 0 ? 'error' : 'neutral'}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.cellaSecondaria}>
              Non collegato / In attesa di raccolta dati (tabella coda_email non ancora migrata sul database).
            </Text>
          )}
        </View>
      </Card>

      {/* Sezione 3 — Stato Infrastruttura & Consigli Upgrade (Supabase / Vercel) */}
      <Card>
        <View style={styles.sezioneHeader}>
          <View style={styles.sezioneTitoloRow}>
            <Icon name="server" size="card" color={colors.brand.navy} />
            <View style={styles.sezioneTitoloTesto}>
              <Text style={styles.h2}>Stato Infrastruttura & Consigli Upgrade</Text>
              <Text style={styles.sottotitolo}>
                Confronto automatico delle metriche reali rispetto ai limiti del piano Free di Supabase.
              </Text>
            </View>
          </View>
          <Badge
            label={
              capacita.livelloGenerale === 'ok'
                ? 'Piano Free adeguato'
                : capacita.livelloGenerale === 'attenzione'
                  ? 'Attenzione capacità'
                  : 'Upgrade consigliato'
            }
            status={statusDaLivello(capacita.livelloGenerale)}
          />
        </View>

        <Alert
          tone={
            capacita.livelloGenerale === 'critico'
              ? 'error'
              : capacita.livelloGenerale === 'attenzione'
                ? 'warning'
                : 'success'
          }
          title="Valutazione Supabase"
          message={capacita.consiglioSupabase}
        />

        <View style={styles.listaRisorse}>
          {capacita.risorse.map((risorsa) => (
            <BarraCapacita key={risorsa.id} risorsa={risorsa} />
          ))}
        </View>

        {database.righeTabelle.length > 0 ? (
          <View style={styles.tabelleBox}>
            <Text style={styles.h4}>Volumetria principali tabelle</Text>
            <View style={styles.tabelleGriglia}>
              {database.righeTabelle.map((t) => (
                <View key={t.tabella} style={styles.tabellaPill}>
                  <Text style={styles.tabellaNome}>{t.tabella}</Text>
                  <Text style={styles.tabellaConteggio}>{t.righe.toLocaleString('it-IT')}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.vercelBox}>
          <View style={styles.vercelTitoloRow}>
            <Icon name="info" size="action" color={colors.semantic.info.foreground} />
            <Text style={styles.h4}>Metriche Vercel (Hosting & Edge)</Text>
          </View>
          <Text style={styles.cellaSecondaria}>
            Banda di rete e invocazioni esatte lato Vercel: Non collegato / In attesa di raccolta dati. Per visualizzarle direttamente qui occorre configurare un API token Vercel server-side (Edge Function dedicata). Il traffico applicativo generato dagli utenti verso Supabase è già misurato in tempo reale dal collector nella Sezione 1.
          </Text>
        </View>
      </Card>
    </View>
  );
}

function CategoriaNotificaCard({
  titolo,
  icona,
  periodo,
  totalePeriodo,
  storico,
  colore,
  sfondo,
}: {
  titolo: string;
  icona: IconName;
  periodo: number;
  totalePeriodo: number;
  storico: number;
  colore: string;
  sfondo: string;
}) {
  const perc = calcolaPercentualeCategoria(periodo, totalePeriodo);
  return (
    <View style={styles.categoriaCard}>
      <View style={styles.categoriaTop}>
        <View style={[styles.categoriaIconaBox, { backgroundColor: sfondo }]}>
          <Icon name={icona} size="action" color={colore} />
        </View>
        <Text style={styles.h4}>{titolo}</Text>
      </View>
      <Text style={styles.categoriaValore}>{periodo.toLocaleString('it-IT')}</Text>
      <Text style={styles.cellaSecondaria}>
        {perc}% nel periodo · Storico: {storico.toLocaleString('it-IT')}
      </Text>
    </View>
  );
}

function BarraCapacita({ risorsa }: { risorsa: StatoCapacitaRisorsa }) {
  return (
    <View style={styles.risorsaBox}>
      <View style={styles.risorsaTop}>
        <View style={styles.risorsaTitoloRow}>
          <Icon
            name={iconaDaLivello(risorsa.livello)}
            size="indicator"
            color={coloreBarraDaLivello(risorsa.livello)}
          />
          <Text style={styles.h4}>{risorsa.titolo}</Text>
        </View>
        <Badge
          label={`${risorsa.etichettaStato} (${risorsa.percentuale}%)`}
          status={statusDaLivello(risorsa.livello)}
        />
      </View>

      <View style={styles.capacitaBarraSfondo}>
        <View
          style={[
            styles.capacitaBarraRiempimento,
            {
              width: `${Math.max(risorsa.percentuale > 0 ? 3 : 0, risorsa.percentuale)}%`,
              backgroundColor: coloreBarraDaLivello(risorsa.livello),
            },
          ]}
        />
      </View>

      <View style={styles.risorsaMeta}>
        <Text style={styles.cellaPrimaria}>{risorsa.valoreFormattato}</Text>
        <Text style={styles.cellaSecondaria}>Soglia: {risorsa.sogliaFormattata}</Text>
      </View>
      <Text style={styles.cellaSecondaria}>{risorsa.descrizione}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    gap: space[6],
  },
  controlliBarra: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  sezioneHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    marginBottom: space[4],
  },
  sezioneTitoloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
    minWidth: 240,
  },
  sezioneTitoloTesto: {
    flex: 1,
    gap: space[1],
  },
  h2: {
    ...textStyle('h3'),
    color: colors.text.primary,
  },
  h4: {
    ...textStyle('h4'),
    color: colors.text.primary,
  },
  sottotitolo: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  cellaPrimaria: {
    ...textStyle('label'),
    color: colors.text.primary,
  },
  cellaSecondaria: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  cellaNumero: {
    ...textStyle('body'),
    color: colors.text.primary,
  },
  barraContenitore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    width: '100%',
  },
  barraSfondo: {
    flex: 1,
    height: space[2],
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  barraRiempimento: {
    height: '100%',
    backgroundColor: colors.action.default,
    borderRadius: radii.full,
  },
  grigliaCategorie: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  grigliaCategorieCompact: {
    flexDirection: 'column',
  },
  categoriaCard: {
    flex: 1,
    minWidth: 190,
    padding: space[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.background,
    gap: space[2],
  },
  categoriaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  categoriaIconaBox: {
    width: space[8],
    height: space[8],
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriaValore: {
    ...textStyle('h2'),
    color: colors.text.primary,
  },
  separatore: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space[4],
  },
  codaEmailBox: {
    gap: space[2],
  },
  codaEmailContenuto: {
    gap: space[2],
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  listaRisorse: {
    gap: space[4],
    marginTop: space[4],
  },
  risorsaBox: {
    padding: space[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.background,
    gap: space[2],
  },
  risorsaTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  risorsaTitoloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  capacitaBarraSfondo: {
    height: space[3],
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  capacitaBarraRiempimento: {
    height: '100%',
    borderRadius: radii.full,
  },
  risorsaMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space[2],
  },
  tabelleBox: {
    marginTop: space[5],
    gap: space[3],
  },
  tabelleGriglia: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  tabellaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
  },
  tabellaNome: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  tabellaConteggio: {
    ...textStyle('label'),
    color: colors.text.primary,
  },
  vercelBox: {
    marginTop: space[5],
    padding: space[4],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.semantic.info.background,
    gap: space[2],
  },
  vercelTitoloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
});
