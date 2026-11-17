import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ICodaEmail } from '@iocondo/shared-types';
import {
  calcolaRiepilogoCoda,
  etichettaStatoCodaEmail,
  etichettaTipoEventoEmail,
  filtraCodaEmail,
  formattaDataItaliana,
  type AnteprimaMittenteAdmin,
  type TipoEventoEmail,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FilterChips,
  IconButton,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  ResponsiveDataView,
  SearchBar,
  StatCard,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  useBreakpoint,
  useToast,
  type BadgeStatus,
  type DataColumn,
  type FilterOption,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

type FiltroStato = 'TUTTI' | 'IN_ATTESA' | 'SENT' | 'FAILED';
type FiltroTipo = 'TUTTI' | TipoEventoEmail;

const OPZIONI_STATO: readonly FilterOption[] = [
  { value: 'IN_ATTESA', label: 'In attesa' },
  { value: 'SENT', label: 'Inviate' },
  { value: 'FAILED', label: 'Fallite' },
];

const OPZIONI_TIPO: readonly FilterOption[] = [
  { value: 'BOLLETTINO_EMESSO', label: 'Bollettini' },
  { value: 'CONVOCAZIONE_ASSEMBLEA', label: 'Assemblee' },
  { value: 'COMUNICAZIONE_IMPORTANTE', label: 'Comunicazioni' },
];

function badgeStatoEmail(stato: ICodaEmail['stato']): { status: BadgeStatus; label: string } {
  switch (stato) {
    case 'SENT':
      return { status: 'completato', label: etichettaStatoCodaEmail(stato) };
    case 'FAILED':
      return { status: 'scaduto', label: etichettaStatoCodaEmail(stato) };
    case 'PROCESSING':
      return { status: 'in-corso', label: etichettaStatoCodaEmail(stato) };
    case 'CANCELLED':
      return { status: 'annullata', label: etichettaStatoCodaEmail(stato) };
    default:
      return { status: 'in-attesa', label: etichettaStatoCodaEmail(stato) };
  }
}

export function AdminCodaEmailScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Log & Coda Email"
          subtitle="Monitoraggio degli invii automatici tramite Gmail e configurazione mittente del condominio."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminCodaEmailContenuto condominioId={condominio.id} profiloId={profilo.id} />;
}

function AdminCodaEmailContenuto({
  condominioId,
  profiloId,
}: {
  condominioId: string;
  profiloId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { isMobile } = useBreakpoint();

  const [righe, setRighe] = useState<ICodaEmail[]>([]);
  const [anteprima, setAnteprima] = useState<AnteprimaMittenteAdmin | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [azioneInCorso, setAzioneInCorso] = useState<'elabora' | 'riprova' | null>(null);

  const [filtroStato, setFiltroStato] = useState<FiltroStato>('TUTTI');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('TUTTI');
  const [ricerca, setRicerca] = useState('');
  const [dettaglioRiga, setDettaglioRiga] = useState<ICodaEmail | null>(null);
  // Email da annullare (popup di conferma)
  const [emailDaAnnullare, setEmailDaAnnullare] = useState<ICodaEmail | null>(null);

  const caricaDati = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const [lista, mittenteData] = await Promise.all([
        services.codaEmail.listCodaEmail(condominioId, 150),
        services.codaEmail.getAnteprimaMittente(condominioId, profiloId),
      ]);
      setRighe(lista);
      setAnteprima(mittenteData);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore caricamento coda email.');
    } finally {
      setCaricamento(false);
    }
  }, [condominioId, profiloId]);

  useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  const riepilogo = useMemo(() => calcolaRiepilogoCoda(righe), [righe]);

  const righeFiltrate = useMemo(
    () =>
      filtraCodaEmail(righe, {
        stato: filtroStato,
        tipoEvento: filtroTipo,
        search: ricerca,
      }),
    [righe, filtroStato, filtroTipo, ricerca],
  );

  const handleElaboraOra = async () => {
    if (azioneInCorso) return;
    setAzioneInCorso('elabora');
    try {
      const res = await services.codaEmail.elaboraCodaOra(condominioId);
      toast.show({
        tone: res.failed > 0 ? 'warning' : 'success',
        message: `Elaborate ${res.claimed} email: ${res.sent} inviate, ${res.retried} riprogrammate, ${res.failed} fallite.`,
      });
      await caricaDati();
    } catch (err) {
      toast.show({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Impossibile elaborare la coda email.',
      });
    } finally {
      setAzioneInCorso(null);
    }
  };

  const handleRiprovaFallite = async () => {
    if (azioneInCorso) return;
    setAzioneInCorso('riprova');
    try {
      const res = await services.codaEmail.riprovaFallite(condominioId);
      toast.show({
        tone: res.failed > 0 ? 'warning' : 'success',
        message: `Nuovo tentativo completato: ${res.sent} inviate, ${res.retried} in attesa, ${res.failed} fallite.`,
      });
      await caricaDati();
    } catch (err) {
      toast.show({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Impossibile riprovare le email fallite.',
      });
    } finally {
      setAzioneInCorso(null);
    }
  };

  // Si possono annullare solo le email non ancora partite e non in invio in questo momento.
  const annullabile = (r: ICodaEmail) => r.stato === 'PENDING' || r.stato === 'FAILED';

  const confermaAnnullamento = async () => {
    if (!emailDaAnnullare) return;
    const annullata = await services.codaEmail.annullaEmail(emailDaAnnullare.id);
    toast.show(
      annullata
        ? { tone: 'success', message: `Email per ${emailDaAnnullare.destinatario_email} rimossa dalla coda.` }
        : { tone: 'warning', message: 'L’email non è più annullabile: è già stata inviata o è in invio.' },
    );
    setEmailDaAnnullare(null);
    await caricaDati();
  };

  const columns: DataColumn<ICodaEmail>[] = useMemo(
    () => [
      {
        key: 'destinatario',
        header: 'Destinatario',
        minWidth: 260,
        weight: 3,
        mobile: 'title',
        cell: (r) => (
          <View style={styles.cellaTesto}>
            <Text style={[styles.titoloRiga, styles.testoSpezzabile]}>
              {r.destinatario_nome || r.destinatario_email}
            </Text>
            {r.destinatario_nome ? (
              <Text style={[styles.sottotitoloRiga, styles.testoSpezzabile]}>
                {r.destinatario_email}
              </Text>
            ) : null}
          </View>
        ),
      },
      {
        key: 'tipo',
        header: 'Flusso',
        minWidth: 120,
        weight: 1,
        cell: (r) => (
          <Text style={styles.testoNormale} numberOfLines={1}>
            {etichettaTipoEventoEmail(r.tipo_evento)}
          </Text>
        ),
      },
      {
        key: 'oggetto',
        header: 'Oggetto',
        minWidth: 220,
        weight: 3,
        cell: (r) => (
          <Text style={styles.testoNormale} numberOfLines={1}>
            {r.oggetto}
          </Text>
        ),
      },
      {
        key: 'stato',
        header: 'Stato',
        minWidth: 130,
        weight: 1,
        mobile: 'status',
        cell: (r) => {
          const b = badgeStatoEmail(r.stato);
          return <Badge status={b.status} label={b.label} />;
        },
      },
      {
        key: 'tentativi',
        header: 'Tentativi',
        minWidth: 90,
        weight: 0,
        cell: (r) => (
          <Text style={styles.testoMuted}>
            {r.tentativi}/{r.max_tentativi}
          </Text>
        ),
      },
      {
        key: 'data',
        header: 'Data',
        minWidth: 110,
        weight: 0,
        cell: (r) => (
          <Text style={styles.testoMuted} numberOfLines={1}>
            {formattaDataItaliana(r.inviata_at || r.created_at)}
          </Text>
        ),
      },
      {
        key: 'azioni',
        header: 'Azioni',
        align: 'end',
        minWidth: 72,
        weight: 0,
        interactive: true,
        cell: (r) => (
          <View style={styles.rigaAzioni}>
            {annullabile(r) ? (
              <IconButton
                icon="x"
                variant="ghost"
                accessibilityLabel={`Rimuovi dalla coda l’email per ${r.destinatario_email}`}
                onPress={() => setEmailDaAnnullare(r)}
              />
            ) : null}
          </View>
        ),
      },
    ],
    [],
  );

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Log & Coda Email"
        subtitle="Stato degli invii massivi tramite Gmail e anteprima del mittente generato per il condominio attivo."
        breadcrumbs={[
          { label: 'Home', onPress: () => router.push('/admin/dashboard') },
          { label: 'Log & Coda Email' },
        ]}
        action={{
          label: 'Elabora coda ora',
          icon: 'refresh-cw',
          onPress: handleElaboraOra,
          loading: azioneInCorso === 'elabora',
          disabled: azioneInCorso !== null,
        }}
        secondaryAction={{
          label: 'Riprova fallite',
          icon: 'rotate-ccw',
          onPress: handleRiprovaFallite,
          loading: azioneInCorso === 'riprova',
          disabled: azioneInCorso !== null || riepilogo.fallite === 0,
        }}
      />

      {errore ? <Alert tone="error" message={errore} /> : null}

      {/* Anteprima sola lettura mittente amministratore */}
      <Card style={styles.cardMittente}>
        <Text style={styles.titoloSezione}>Mittente automatico del condominio (sola lettura)</Text>
        <Text style={styles.descrizioneSezione}>
          Ricavato dai dati del tuo account amministratore. Le email vengono inviate dalla casella Gmail dell'app; il tuo indirizzo resta come Reply-To, così i condòmini rispondono a te.
        </Text>
        <View style={[styles.grigliaMittente, isMobile && styles.colonnaMobile]}>
          <View style={styles.boxMittente}>
            <Text style={styles.labelMittente}>Intestazione From (esempio)</Text>
            <Text style={styles.valoreMittente} selectable>
              {anteprima?.mittente.fromEmail ?? 'Caricamento...'}
            </Text>
          </View>
          <View style={styles.boxMittente}>
            <Text style={styles.labelMittente}>Reply-To (risposte dei condòmini)</Text>
            <Text style={styles.valoreMittente} selectable>
              {anteprima?.mittente.replyToEmail ?? 'Nessuna email configurata nel profilo'}
            </Text>
          </View>
        </View>
      </Card>

      {/* 3 StatCard riepilogative */}
      <View style={[styles.rigaStat, isMobile && styles.colonnaMobile]}>
        <View style={styles.colStat}>
          <StatCard
            icon="clock"
            tile="navy"
            title="In attesa"
            value={String(riepilogo.inAttesa)}
            description="Email in coda o in elaborazione"
            loading={caricamento}
          />
        </View>
        <View style={styles.colStat}>
          <StatCard
            icon="circle-check"
            tile="teal"
            title="Inviate"
            value={String(riepilogo.inviate)}
            description="Consegnate tramite Gmail"
            loading={caricamento}
          />
        </View>
        <View style={styles.colStat}>
          <StatCard
            icon="triangle-alert"
            tile="blue"
            title="Fallite"
            value={String(riepilogo.fallite)}
            description="Richiedono verifica o nuovo invio"
            loading={caricamento}
          />
        </View>
      </View>

      {/* Tabella / Lista filtri e log */}
      <Card style={styles.cardLista}>
        <ResponsiveDataView<ICodaEmail>
          label="Log e coda invii email"
          columns={columns}
          rows={righeFiltrate}
          getRowKey={(r) => r.id}
          getRowLabel={(r) => `${r.destinatario_email} — ${r.oggetto}`}
          onRowPress={(r) => setDettaglioRiga(r)}
          loading={caricamento}
          error={errore ? { title: 'Impossibile caricare la coda email' } : undefined}
          onRetry={caricaDati}
          filters={
            <View style={styles.controlli}>
              <SearchBar
                value={ricerca}
                onChangeText={setRicerca}
                placeholder="Cerca per destinatario, email o oggetto..."
                label="Cerca nella coda email"
                showLabel
              />
              <FilterChips
                label="Filtra per stato invio"
                allLabel="Tutti"
                options={OPZIONI_STATO}
                value={filtroStato === 'TUTTI' ? [] : [filtroStato]}
                onChange={(val) => setFiltroStato((val[0] as FiltroStato) || 'TUTTI')}
              />
              <FilterChips
                label="Filtra per tipo di flusso"
                allLabel="Tutti i flussi"
                options={OPZIONI_TIPO}
                value={filtroTipo === 'TUTTI' ? [] : [filtroTipo]}
                onChange={(val) => setFiltroTipo((val[0] as FiltroTipo) || 'TUTTI')}
              />
            </View>
          }
          empty={{
            icon: 'inbox',
            title: 'Nessuna email in coda',
            description:
              'Gli invii generati da bollettini, convocazioni assembleari e comunicazioni importanti compariranno qui.',
          }}
        />
      </Card>

      {/* Modale dettaglio email */}
      <Modal
        visible={dettaglioRiga !== null}
        onClose={() => setDettaglioRiga(null)}
        title="Dettaglio invio email"
        actions={
          dettaglioRiga ? (
            <ModalActions>
              <Button variant="primary" label="Chiudi" onPress={() => setDettaglioRiga(null)} />
            </ModalActions>
          ) : undefined
        }
      >
        {dettaglioRiga ? (
          <View style={styles.modaleContenuto}>
            <View style={styles.rigaDettaglio}>
              <Text style={styles.labelDettaglio}>Destinatario</Text>
              <Text style={styles.valoreDettaglio}>
                {dettaglioRiga.destinatario_nome
                  ? `${dettaglioRiga.destinatario_nome} (${dettaglioRiga.destinatario_email})`
                  : dettaglioRiga.destinatario_email}
              </Text>
            </View>
            <View style={styles.rigaDettaglio}>
              <Text style={styles.labelDettaglio}>Mittente (From)</Text>
              <Text style={styles.valoreDettaglio}>{dettaglioRiga.from_email}</Text>
            </View>
            {dettaglioRiga.reply_to_email ? (
              <View style={styles.rigaDettaglio}>
                <Text style={styles.labelDettaglio}>Reply-To</Text>
                <Text style={styles.valoreDettaglio}>{dettaglioRiga.reply_to_email}</Text>
              </View>
            ) : null}
            <View style={styles.rigaDettaglio}>
              <Text style={styles.labelDettaglio}>Oggetto</Text>
              <Text style={styles.valoreDettaglio}>{dettaglioRiga.oggetto}</Text>
            </View>
            <View style={styles.rigaDettaglio}>
              <Text style={styles.labelDettaglio}>Stato e tentativi</Text>
              <Text style={styles.valoreDettaglio}>
                {etichettaStatoCodaEmail(dettaglioRiga.stato)} · {dettaglioRiga.tentativi}/{dettaglioRiga.max_tentativi}
              </Text>
            </View>
            {dettaglioRiga.provider_message_id ? (
              <View style={styles.rigaDettaglio}>
                <Text style={styles.labelDettaglio}>ID messaggio provider</Text>
                <Text style={styles.valoreDettaglio} selectable>
                  {dettaglioRiga.provider_message_id}
                </Text>
              </View>
            ) : null}
            {dettaglioRiga.ultimo_errore ? (
              <Alert tone="error" message={`Ultimo errore: ${dettaglioRiga.ultimo_errore}`} />
            ) : null}
          </View>
        ) : null}
      </Modal>

      <ConfirmDialog
        visible={!!emailDaAnnullare}
        title="Rimuovere l’email dalla coda?"
        description={
          emailDaAnnullare
            ? `L’email “${emailDaAnnullare.oggetto}” per ${emailDaAnnullare.destinatario_email} non verrà inviata. Resterà nel log come annullata.`
            : ''
        }
        confirmLabel="Rimuovi email"
        confirmLoadingLabel="Rimozione in corso…"
        cancelLabel="Annulla"
        destructive
        onConfirm={confermaAnnullamento}
        onCancel={() => setEmailDaAnnullare(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rigaAzioni: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    minHeight: 48,
  },
  pagina: {
    gap: space[5],
  },
  cardMittente: {
    gap: space[3],
  },
  titoloSezione: {
    ...textStyle('h3'),
    color: colors.text.primary,
  },
  descrizioneSezione: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  grigliaMittente: {
    flexDirection: 'row',
    gap: space[4],
  },
  boxMittente: {
    flex: 1,
    padding: space[3],
    backgroundColor: colors.background,
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[1],
  },
  labelMittente: {
    ...textStyle('label'),
    color: colors.text.muted,
  },
  valoreMittente: {
    ...textStyle('body'),
    color: colors.text.primary,
    fontWeight: '600',
  },
  rigaStat: {
    flexDirection: 'row',
    gap: space[4],
  },
  colStat: {
    flex: 1,
  },
  colonnaMobile: {
    flexDirection: 'column',
  },
  cardLista: {
    gap: space[4],
  },
  controlli: {
    gap: space[3],
  },
  cellaTesto: {
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: space[4],
  },
  // Email e nomi lunghi vanno a capo dentro la cella invece di finire sulla colonna accanto.
  testoSpezzabile: Platform.select({
    web: { wordBreak: 'break-word', overflowWrap: 'anywhere' } as object,
    default: {},
  }) as object,
  titoloRiga: {
    ...textStyle('body'),
    color: colors.text.primary,
    fontWeight: '600',
  },
  sottotitoloRiga: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  testoNormale: {
    ...textStyle('secondary'),
    color: colors.text.primary,
  },
  testoMuted: {
    ...textStyle('label'),
    color: colors.text.muted,
  },
  modaleContenuto: {
    gap: space[3],
  },
  rigaDettaglio: {
    gap: 2,
  },
  labelDettaglio: {
    ...textStyle('label'),
    color: colors.text.muted,
  },
  valoreDettaglio: {
    ...textStyle('body'),
    color: colors.text.primary,
  },
});
