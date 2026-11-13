import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  calcolaQuadraturaManuale,
  deduciAmbitoTabella,
  filtraUnitaPerAmbito,
  formattaMillesimiInput,
  parseValoreMillesimale,
  ripartisciEquamente,
  validaTabellaMillesimale,
  type AmbitoTabellaMillesimale,
  type StrutturaAdminData,
  type TabellaMillesimaleDettaglioView,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  NonAutorizzato,
  PageHeader,
  SearchBar,
  Select,
  borderWidths,
  colors,
  focusRingInset,
  radii,
  space,
  tabularNumbers,
  textStyle,
  useBreakpoint,
  useToast,
  type BreadcrumbItem,
  type SelectOption,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const OPZIONI_AMBITO: SelectOption[] = [
  {
    value: 'TUTTO_CONDOMINIO',
    label: 'Tutto il condominio (Tabella generale di proprietà)',
  },
  {
    value: 'PALAZZO',
    label: 'Solo un Palazzo/Edificio specifico',
  },
  {
    value: 'SCALA',
    label: 'Solo una specifica Scala o Colonna',
  },
  {
    value: 'PERSONALIZZATO',
    label: 'Selezione personalizzata di appartamenti',
  },
];

const stickyBarWebStyle: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backgroundColor: colors.background,
        paddingBottom: space[2],
      } as unknown as ViewStyle)
    : undefined;

export function AdminEditorTabellaMillesimaleScreen({
  tabellaId: propTabellaId,
}: {
  tabellaId?: string;
}) {
  const params = useLocalSearchParams<{ id?: string }>();
  const rawId = propTabellaId ?? (typeof params.id === 'string' ? params.id : undefined);
  const tabellaId = rawId && rawId !== 'nuova' ? rawId : undefined;

  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Tabelle millesimali"
          subtitle="Configurazione delle tabelle e delle quote millesimali."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminEditorTabellaMillesimaleContenuto tabellaId={tabellaId} />;
}

function AdminEditorTabellaMillesimaleContenuto({ tabellaId }: { tabellaId?: string }) {
  const router = useRouter();
  const { condominio } = useProfilo();
  const { breakpoint, isMobile } = useBreakpoint();
  const toast = useToast();

  const isModifica = Boolean(tabellaId);

  const [dati, setDati] = useState<StrutturaAdminData | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState(false);

  // Stato form
  const [inizializzato, setInizializzato] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [totaleInput, setTotaleInput] = useState('1000,000');
  const [ambito, setAmbito] = useState<AmbitoTabellaMillesimale>('TUTTO_CONDOMINIO');
  const [palazzoId, setPalazzoId] = useState('');
  const [scalaId, setScalaId] = useState('');
  const [unitaSelezionateIds, setUnitaSelezionateIds] = useState<string[]>([]);
  const [ricercaPersonalizzata, setRicercaPersonalizzata] = useState('');
  const [quoteInput, setQuoteInput] = useState<Record<string, string>>({});
  const [erroreForm, setErroreForm] = useState<string | null>(null);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  const caricaDati = useCallback(async () => {
    if (!condominio?.id) return;
    setCaricamento(true);
    setErroreCaricamento(false);
    try {
      const res = await services.struttura.caricaStrutturaCompleta(condominio.id);
      setDati(res);
    } catch {
      setErroreCaricamento(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id]);

  useEffect(() => {
    setInizializzato(false);
    caricaDati();
  }, [caricaDati, tabellaId]);

  const tabellaTarget: TabellaMillesimaleDettaglioView | null = useMemo(() => {
    if (!dati || !tabellaId) return null;
    return dati.tabelle.find((t) => t.id === tabellaId) ?? null;
  }, [dati, tabellaId]);

  // Inizializzazione form una volta caricati i dati
  useEffect(() => {
    if (!dati || inizializzato) return;

    if (tabellaId) {
      if (!tabellaTarget) {
        setInizializzato(true);
        return;
      }

      const dedotto = deduciAmbitoTabella(tabellaTarget, dati.tutteUnita);
      let palId = tabellaTarget.palazzoId ?? '';
      if (!palId && tabellaTarget.scalaColonnaId) {
        const palTrovato = dati.palazzi.find((p) =>
          p.scale.some((s) => s.id === tabellaTarget.scalaColonnaId)
        );
        palId = palTrovato?.id ?? '';
      }
      if (!palId) {
        palId = dati.palazzi[0]?.id ?? '';
      }

      const quoteInit: Record<string, string> = {};
      for (const q of tabellaTarget.quote) {
        quoteInit[q.unitaId] = formattaMillesimiInput(q.valoreMillesimale);
      }

      setNomeInput(tabellaTarget.nome);
      setTotaleInput(formattaMillesimiInput(tabellaTarget.totalePrevisto));
      setAmbito(dedotto.ambito);
      setPalazzoId(palId);
      setScalaId(tabellaTarget.scalaColonnaId ?? '');
      setUnitaSelezionateIds(dedotto.unitaSelezionateIds);
      setQuoteInput(quoteInit);
      setErroreForm(null);
      setInizializzato(true);
      return;
    }

    const primoPalazzo = dati.palazzi[0];
    const primaScala = primoPalazzo?.scale.find((s) => Boolean(s.id));
    setNomeInput('');
    setTotaleInput('1000,000');
    setAmbito('TUTTO_CONDOMINIO');
    setPalazzoId(primoPalazzo?.id ?? '');
    setScalaId(primaScala?.id ?? '');
    setUnitaSelezionateIds([]);
    setQuoteInput({});
    setErroreForm(null);
    setInizializzato(true);
  }, [dati, inizializzato, tabellaId, tabellaTarget]);

  const opzioniPalazzi: SelectOption[] = useMemo(() => {
    if (!dati) return [];
    return dati.palazzi.map((p) => ({
      value: p.id,
      label: p.nome,
    }));
  }, [dati]);

  const opzioniScale: SelectOption[] = useMemo(() => {
    if (!dati || !palazzoId) return [];
    const palazzo = dati.palazzi.find((p) => p.id === palazzoId);
    if (!palazzo) return [];
    return palazzo.scale
      .filter((s) => Boolean(s.id))
      .map((s) => ({
        value: s.id as string,
        label: s.nome,
      }));
  }, [dati, palazzoId]);

  const unitaFiltratePersonalizzate = useMemo(() => {
    if (!dati) return [];
    const q = ricercaPersonalizzata.trim().toLowerCase();
    if (!q) return dati.tutteUnita;
    return dati.tutteUnita.filter((u) => {
      const pianoTesto = u.piano !== null && u.piano !== undefined ? String(u.piano) : '';
      return (
        u.interno.toLowerCase().includes(q) ||
        pianoTesto.includes(q) ||
        u.palazzoNome.toLowerCase().includes(q) ||
        (u.scalaNome ?? '').toLowerCase().includes(q) ||
        u.tipologiaDescrizione.toLowerCase().includes(q)
      );
    });
  }, [dati, ricercaPersonalizzata]);

  const unitaPartecipanti = useMemo(() => {
    if (!dati) return [];
    return filtraUnitaPerAmbito(dati.tutteUnita, {
      ambito,
      palazzoId,
      scalaColonnaId: scalaId,
      unitaSelezionateIds,
    });
  }, [dati, ambito, palazzoId, scalaId, unitaSelezionateIds]);

  const totalePrevistoNum = useMemo(() => {
    const parsed = parseValoreMillesimale(totaleInput);
    return parsed !== null && parsed > 0 ? parsed : 1000;
  }, [totaleInput]);

  const quadratura = useMemo(() => {
    const righe = unitaPartecipanti.map((u) => ({
      unitaId: u.id,
      valoreInput: quoteInput[u.id] ?? '',
    }));
    return calcolaQuadraturaManuale(righe, totalePrevistoNum);
  }, [unitaPartecipanti, quoteInput, totalePrevistoNum]);

  const validazione = useMemo(() => {
    return validaTabellaMillesimale({
      nome: nomeInput,
      totalePrevisto: parseValoreMillesimale(totaleInput) ?? 0,
      ambito,
      palazzoId,
      scalaColonnaId: scalaId,
      unitaPartecipanti,
    });
  }, [nomeInput, totaleInput, ambito, palazzoId, scalaId, unitaPartecipanti]);

  const toggleUnitaPersonalizzata = (unitaId: string, checked: boolean) => {
    setUnitaSelezionateIds((prev) =>
      checked ? (prev.includes(unitaId) ? prev : [...prev, unitaId]) : prev.filter((id) => id !== unitaId)
    );
  };

  const selezionaTutteFiltrate = () => {
    const idsDaAggiungere = unitaFiltratePersonalizzate.map((u) => u.id);
    setUnitaSelezionateIds((prev) => Array.from(new Set([...prev, ...idsDaAggiungere])));
  };

  const deselezionaTutteFiltrate = () => {
    const idsDaRimuovere = new Set(unitaFiltratePersonalizzate.map((u) => u.id));
    setUnitaSelezionateIds((prev) => prev.filter((id) => !idsDaRimuovere.has(id)));
  };

  const applicaRipartizioneEqua = () => {
    if (unitaPartecipanti.length === 0 || totalePrevistoNum <= 0) return;
    const ripartite = ripartisciEquamente(
      unitaPartecipanti.map((u) => u.id),
      totalePrevistoNum
    );
    setQuoteInput((prev) => {
      const next = { ...prev };
      for (const [id, val] of Object.entries(ripartite)) {
        next[id] = formattaMillesimiInput(val);
      }
      return next;
    });
    setErroreForm(null);
  };

  const azzeraQuote = () => {
    if (unitaPartecipanti.length === 0) return;
    setQuoteInput((prev) => {
      const next = { ...prev };
      for (const u of unitaPartecipanti) {
        next[u.id] = '0,000';
      }
      return next;
    });
    setErroreForm(null);
  };

  const tornaAllaLista = () => {
    router.push('/admin/struttura?tab=millesimi' as Href);
  };

  const salvaTabella = async () => {
    if (!condominio?.id) return;

    if (!validazione.valido) {
      setErroreForm(validazione.errori[0] || 'Verifica i dati della tabella.');
      return;
    }

    if (quadratura.righeInvalide.length > 0) {
      setErroreForm('Alcune quote inserite contengono valori numerici non validi.');
      return;
    }

    if (!quadratura.isQuadrata) {
      const messaggioDisavanzo =
        quadratura.disavanzo > 0
          ? `La tabella non è quadrata: mancano ${quadratura.disavanzo.toFixed(3)} ‰ per raggiungere ${totalePrevistoNum.toFixed(3)} ‰.`
          : `La tabella non è quadrata: la somma supera il totale previsto di ${Math.abs(quadratura.disavanzo).toFixed(3)} ‰.`;
      setErroreForm(messaggioDisavanzo);
      return;
    }

    setSalvataggioInCorso(true);
    setErroreForm(null);

    try {
      const palazzoIdDb = ambito === 'PALAZZO' || ambito === 'SCALA' ? palazzoId || null : null;
      const scalaIdDb = ambito === 'SCALA' ? scalaId || null : null;

      await services.struttura.salvaTabellaEQuote({
        id: tabellaId,
        condominioId: condominio.id,
        nome: nomeInput.trim(),
        palazzoId: palazzoIdDb,
        scalaColonnaId: scalaIdDb,
        totale: totalePrevistoNum,
        quote: quadratura.quoteParsed,
      });

      toast.show({
        message: isModifica
          ? `Tabella "${nomeInput.trim()}" aggiornata con successo.`
          : `Tabella "${nomeInput.trim()}" creata con successo.`,
        tone: 'success',
      });
      router.replace('/admin/struttura?tab=millesimi' as Href);
    } catch {
      setErroreForm(
        'Impossibile salvare la tabella millesimale. Verifica che non esista già una tabella con lo stesso nome.'
      );
    } finally {
      setSalvataggioInCorso(false);
    }
  };

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', onPress: () => router.push('/admin/dashboard' as Href) },
    { label: 'Struttura', onPress: () => router.push('/admin/struttura' as Href) },
    { label: 'Tabelle Millesimali', onPress: tornaAllaLista },
    { label: isModifica ? `Modifica ${tabellaTarget?.nome ?? ''}`.trim() : 'Nuova tabella' },
  ];

  if (caricamento) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={isModifica ? 'Modifica tabella millesimale' : 'Nuova tabella millesimale'}
          subtitle="Caricamento delle unità immobiliari e delle quote..."
        />
        <LoadingState message="Caricamento editor tabella millesimale..." />
      </View>
    );
  }

  if (erroreCaricamento || !dati) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={isModifica ? 'Modifica tabella millesimale' : 'Nuova tabella millesimale'}
          subtitle="Gestione delle tabelle millesimali."
        />
        <ErrorState
          title="Impossibile caricare i dati del condominio"
          description="Verifica la connessione e riprova."
          onRetry={caricaDati}
        />
      </View>
    );
  }

  if (isModifica && inizializzato && !tabellaTarget) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          breadcrumbs={breadcrumbs}
          title="Tabella millesimale non trovata"
          subtitle="La tabella richiesta non è disponibile."
        />
        <ErrorState
          title="Tabella non trovata"
          description="La tabella millesimale richiesta non esiste o è stata eliminata."
          onRetry={tornaAllaLista}
        />
      </View>
    );
  }

  const statoBadgeQuadratura = quadratura.isQuadrata
    ? 'success'
    : quadratura.disavanzo > 0
      ? 'warning'
      : 'error';

  const labelBadgeQuadratura = quadratura.isQuadrata
    ? `Quadrata a ${totalePrevistoNum.toFixed(3)} ‰`
    : quadratura.disavanzo > 0
      ? `Disavanzo: +${quadratura.disavanzo.toFixed(3)} ‰`
      : `Eccedenza: ${quadratura.disavanzo.toFixed(3)} ‰`;

  return (
    <View style={styles.pagina}>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={
          isModifica
            ? `Modifica tabella millesimale: ${tabellaTarget?.nome ?? ''}`
            : 'Nuova tabella millesimale'
        }
        subtitle="Definisci l'ambito di applicazione, seleziona le unità partecipanti e compila le quote millesimali con quadratura in tempo reale."
        secondaryAction={{
          label: 'Annulla',
          icon: 'x',
          onPress: tornaAllaLista,
          disabled: salvataggioInCorso,
        }}
        action={{
          label: 'Salva tabella e quote',
          icon: 'check',
          onPress: salvaTabella,
          loading: salvataggioInCorso,
          disabled: salvataggioInCorso,
        }}
      />

      {erroreForm ? <Alert tone="error" message={erroreForm} /> : null}

      {/* Barra / Box Sticky di Quadratura in Tempo Reale */}
      <View style={stickyBarWebStyle}>
        <Card style={styles.stickyCard}>
          <View style={styles.stickyTopRow}>
            <View style={styles.stickyMetrics}>
              <View style={styles.metricItem}>
                <Text style={[textStyle('label', breakpoint), styles.metricLabel]}>
                  Somma attuale / Previsto
                </Text>
                <Text style={[textStyle('h3', breakpoint), tabularNumbers, styles.metricValue]}>
                  {quadratura.sommaMillesimi.toFixed(3)} ‰ / {totalePrevistoNum.toFixed(3)} ‰
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[textStyle('label', breakpoint), styles.metricLabel]}>
                  Unità partecipanti
                </Text>
                <Text style={[textStyle('h3', breakpoint), tabularNumbers, styles.metricValue]}>
                  {unitaPartecipanti.length}
                </Text>
              </View>
            </View>

            <View style={styles.stickyBadgeWrapper}>
              <Badge status={statoBadgeQuadratura} label={labelBadgeQuadratura} />
            </View>
          </View>

          <View style={styles.stickyActionsRow}>
            <Button
              variant="secondary"
              icon="calculator"
              label="Ripartisci equamente"
              onPress={applicaRipartizioneEqua}
              disabled={unitaPartecipanti.length === 0 || totalePrevistoNum <= 0 || salvataggioInCorso}
              accessibilityHint="Distribuisce il totale millesimi previsto in parti uguali tra le unità partecipanti"
            />
            <Button
              variant="secondary"
              icon="rotate-ccw"
              label="Azzera quote"
              onPress={azzeraQuote}
              disabled={unitaPartecipanti.length === 0 || salvataggioInCorso}
              accessibilityHint="Riporta a zero tutte le quote delle unità partecipanti"
            />
          </View>

          {!quadratura.isQuadrata && unitaPartecipanti.length > 0 ? (
            <Text style={[textStyle('secondary', breakpoint), styles.stickyAvviso]}>
              {quadratura.righeInvalide.length > 0
                ? 'Alcune righe contengono valori numerici non validi.'
                : quadratura.disavanzo > 0
                  ? `Mancano ${quadratura.disavanzo.toFixed(3)} ‰ per completare la quadratura a ${totalePrevistoNum.toFixed(3)} ‰.`
                  : `La somma supera il totale previsto di ${Math.abs(quadratura.disavanzo).toFixed(3)} ‰.`}
            </Text>
          ) : null}
        </Card>
      </View>

      {/* Sezione 1 — Configurazione e Ambito della Tabella */}
      <Card title="1. Configurazione e ambito della tabella" headingLevel={2}>
        <View style={styles.sezioneForm}>
          <View style={[styles.rigaCampi, isMobile && styles.colonnaCampi]}>
            <View style={styles.campoNome}>
              <Input
                label="Nome della tabella *"
                placeholder="Es. Tabella A - Proprietà Generale"
                value={nomeInput}
                onChangeText={(text) => {
                  setNomeInput(text);
                  if (erroreForm) setErroreForm(null);
                }}
                disabled={salvataggioInCorso}
              />
            </View>
            <View style={styles.campoTotale}>
              <Input
                label="Totale millesimi previsto"
                placeholder="1000,000"
                value={totaleInput}
                onChangeText={(text) => {
                  setTotaleInput(text);
                  if (erroreForm) setErroreForm(null);
                }}
                keyboardType="decimal-pad"
                disabled={salvataggioInCorso}
              />
            </View>
          </View>

          <Select
            label="Ambito di applicazione *"
            options={OPZIONI_AMBITO}
            value={ambito}
            onChange={(val) => {
              setAmbito(val as AmbitoTabellaMillesimale);
              if (erroreForm) setErroreForm(null);
            }}
            disabled={salvataggioInCorso}
          />

          {ambito === 'PALAZZO' || ambito === 'SCALA' ? (
            <Select
              label="Palazzo / Edificio *"
              options={opzioniPalazzi}
              value={palazzoId}
              onChange={(newPalId) => {
                setPalazzoId(newPalId);
                const pal = dati.palazzi.find((p) => p.id === newPalId);
                const primaScala = pal?.scale.find((s) => Boolean(s.id));
                setScalaId(primaScala?.id ?? '');
                if (erroreForm) setErroreForm(null);
              }}
              disabled={salvataggioInCorso}
            />
          ) : null}

          {ambito === 'SCALA' ? (
            opzioniScale.length > 0 ? (
              <Select
                label="Scala o Colonna *"
                options={opzioniScale}
                value={scalaId}
                onChange={(val) => {
                  setScalaId(val);
                  if (erroreForm) setErroreForm(null);
                }}
                disabled={salvataggioInCorso}
              />
            ) : (
              <Alert
                tone="warning"
                message="L'edificio selezionato non ha ancora scale o colonne configurate."
              />
            )
          ) : null}

          {ambito === 'PERSONALIZZATO' ? (
            <View style={styles.boxSelezionePersonalizzata}>
              <View style={styles.testataSelezionePersonalizzata}>
                <Text style={[textStyle('label', breakpoint), styles.etichettaSelezione]}>
                  Seleziona appartamenti partecipanti ({unitaSelezionateIds.length} di{' '}
                  {dati.tutteUnita.length})
                </Text>
                <View style={styles.azioniSelezioneRapida}>
                  <Button
                    variant="text"
                    label="Seleziona tutti"
                    onPress={selezionaTutteFiltrate}
                    disabled={salvataggioInCorso || unitaFiltratePersonalizzate.length === 0}
                  />
                  <Button
                    variant="text"
                    label="Deseleziona tutti"
                    onPress={deselezionaTutteFiltrate}
                    disabled={salvataggioInCorso || unitaFiltratePersonalizzate.length === 0}
                  />
                </View>
              </View>

              <SearchBar
                value={ricercaPersonalizzata}
                onChangeText={setRicercaPersonalizzata}
                placeholder="Cerca per interno, piano, palazzo o scala..."
              />

              {unitaFiltratePersonalizzate.length === 0 ? (
                <Alert
                  tone="info"
                  message="Nessuna unità corrisponde alla ricerca inserita."
                />
              ) : (
                <View style={styles.listaCheckboxUnita}>
                  {unitaFiltratePersonalizzate.map((u) => {
                    const pianoLabel =
                      u.piano !== null && u.piano !== undefined ? ` · Piano ${u.piano}` : '';
                    const scalaLabel = u.scalaNome ? ` · ${u.scalaNome}` : '';
                    return (
                      <Checkbox
                        key={u.id}
                        checked={unitaSelezionateIds.includes(u.id)}
                        onChange={(checked) => toggleUnitaPersonalizzata(u.id, checked)}
                        label={`Int. ${u.interno}${pianoLabel} · ${u.palazzoNome}${scalaLabel} (${u.tipologiaDescrizione})`}
                        disabled={salvataggioInCorso}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </Card>

      {/* Sezione 2 — Griglia Completa di Inserimento Quote Millesimali */}
      <Card title={`2. Quote millesimali per unità (${unitaPartecipanti.length})`} headingLevel={2}>
        {unitaPartecipanti.length === 0 ? (
          <EmptyState
            icon="building-2"
            title="Nessuna unità partecipante"
            description="Seleziona un ambito valido o almeno un appartamento nella sezione di configurazione."
          />
        ) : !isMobile ? (
          <View style={styles.tabellaDesktop}>
            <View style={styles.tabellaHeader}>
              <Text style={[textStyle('label', breakpoint), styles.colUnita, styles.headerText]}>
                Unità / Immobile
              </Text>
              <Text style={[textStyle('label', breakpoint), styles.colEdificio, styles.headerText]}>
                Edificio e Scala
              </Text>
              <Text style={[textStyle('label', breakpoint), styles.colCondomino, styles.headerText]}>
                Condòmino residente
              </Text>
              <Text style={[textStyle('label', breakpoint), styles.colQuotaInput, styles.headerText]}>
                Quota millesimale (‰)
              </Text>
              <Text style={[textStyle('label', breakpoint), styles.colPercentuale, styles.headerTextRight]}>
                Quota (%)
              </Text>
            </View>

            {unitaPartecipanti.map((u, idx) => {
              const isInvalida = quadratura.righeInvalide.includes(u.id);
              const valoreNum = parseValoreMillesimale(quoteInput[u.id] ?? '') ?? 0;
              const percentuale =
                totalePrevistoNum > 0 ? (valoreNum / totalePrevistoNum) * 100 : 0;
              const pianoLabel =
                u.piano !== null && u.piano !== undefined ? ` · Piano ${u.piano}` : '';

              return (
                <View
                  key={u.id}
                  style={[
                    styles.tabellaRiga,
                    idx === unitaPartecipanti.length - 1 && styles.tabellaRigaUltima,
                  ]}
                >
                  <View style={styles.colUnita}>
                    <Text style={[textStyle('body', breakpoint), styles.testoForte]}>
                      Int. {u.interno}
                    </Text>
                    <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                      {u.tipologiaDescrizione}
                      {pianoLabel}
                    </Text>
                  </View>

                  <View style={styles.colEdificio}>
                    <Text style={[textStyle('body', breakpoint), styles.testoNormale]}>
                      {u.palazzoNome}
                    </Text>
                    <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                      {u.scalaNome ?? 'Nessuna scala'}
                    </Text>
                  </View>

                  <View style={styles.colCondomino}>
                    <Text
                      style={[
                        textStyle('body', breakpoint),
                        u.residenteAttivo ? styles.testoNormale : styles.testoNonAssegnato,
                      ]}
                    >
                      {u.residenteAttivo?.nomeCognome ?? 'Non assegnato'}
                    </Text>
                  </View>

                  <View style={styles.colQuotaInput}>
                    <Input
                      label={`Quota millesimale Interno ${u.interno}`}
                      hideLabel
                      accessibilityLabel={`Quota millesimale Interno ${u.interno}`}
                      placeholder="0,000"
                      value={quoteInput[u.id] ?? ''}
                      onChangeText={(text) => {
                        setQuoteInput((prev) => ({ ...prev, [u.id]: text }));
                        if (erroreForm) setErroreForm(null);
                      }}
                      keyboardType="decimal-pad"
                      error={isInvalida ? 'Valore non valido' : undefined}
                      disabled={salvataggioInCorso}
                    />
                  </View>

                  <View style={styles.colPercentuale}>
                    <Text style={[textStyle('body', breakpoint), tabularNumbers, styles.testoPercentuale]}>
                      {percentuale.toFixed(2)} %
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.listaCardMobile}>
            {unitaPartecipanti.map((u) => {
              const isInvalida = quadratura.righeInvalide.includes(u.id);
              const valoreNum = parseValoreMillesimale(quoteInput[u.id] ?? '') ?? 0;
              const percentuale =
                totalePrevistoNum > 0 ? (valoreNum / totalePrevistoNum) * 100 : 0;
              const pianoLabel =
                u.piano !== null && u.piano !== undefined ? ` · Piano ${u.piano}` : '';

              return (
                <View key={u.id} style={styles.cardUnitaMobile}>
                  <View style={styles.cardMobileHeader}>
                    <Text style={[textStyle('h4', breakpoint), styles.testoForte]}>
                      Int. {u.interno} · {u.tipologiaDescrizione}
                    </Text>
                    <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
                      {u.palazzoNome}
                      {u.scalaNome ? ` · ${u.scalaNome}` : ''}
                      {pianoLabel}
                    </Text>
                    <Text
                      style={[
                        textStyle('secondary', breakpoint),
                        u.residenteAttivo ? styles.testoSecondario : styles.testoNonAssegnato,
                      ]}
                    >
                      Condòmino: {u.residenteAttivo?.nomeCognome ?? 'Non assegnato'}
                    </Text>
                  </View>

                  <Input
                    label={`Quota millesimale Interno ${u.interno} (‰)`}
                    accessibilityLabel={`Quota millesimale Interno ${u.interno}`}
                    placeholder="0,000"
                    value={quoteInput[u.id] ?? ''}
                    onChangeText={(text) => {
                      setQuoteInput((prev) => ({ ...prev, [u.id]: text }));
                      if (erroreForm) setErroreForm(null);
                    }}
                    keyboardType="decimal-pad"
                    error={isInvalida ? 'Valore non valido' : undefined}
                    disabled={salvataggioInCorso}
                  />

                  <View style={styles.cardMobileFooter}>
                    <Text style={[textStyle('label', breakpoint), styles.testoSecondario]}>
                      Quota percentuale
                    </Text>
                    <Text style={[textStyle('body', breakpoint), tabularNumbers, styles.testoForte]}>
                      {percentuale.toFixed(2)} %
                    </Text>
                  </View>
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
  pagina: {
    width: '100%',
    gap: space[6],
  },
  stickyCard: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    gap: space[3],
  },
  stickyTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
  },
  stickyMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[6],
  },
  metricItem: {
    gap: space[1],
  },
  metricLabel: {
    color: colors.text.secondary,
  },
  metricValue: {
    color: colors.brand.navy,
  },
  stickyBadgeWrapper: {
    flexShrink: 0,
  },
  stickyActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  stickyAvviso: {
    color: colors.semantic.warning.foreground,
  },
  sezioneForm: {
    gap: space[4],
  },
  rigaCampi: {
    flexDirection: 'row',
    gap: space[4],
    alignItems: 'flex-start',
  },
  colonnaCampi: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  campoNome: {
    flex: 2,
    minWidth: 0,
  },
  campoTotale: {
    flex: 1,
    minWidth: 160,
  },
  boxSelezionePersonalizzata: {
    gap: space[3],
    padding: space[4],
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
  },
  testataSelezionePersonalizzata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  etichettaSelezione: {
    color: colors.text.primary,
  },
  azioniSelezioneRapida: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  listaCheckboxUnita: {
    gap: space[2],
  },
  tabellaDesktop: {
    width: '100%',
  },
  tabellaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.borderStrong,
  },
  headerText: {
    color: colors.text.secondary,
  },
  headerTextRight: {
    color: colors.text.secondary,
    textAlign: 'right',
  },
  tabellaRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  tabellaRigaUltima: {
    borderBottomWidth: 0,
  },
  colUnita: {
    flex: 2,
    minWidth: 130,
    gap: space[1],
  },
  colEdificio: {
    flex: 1.8,
    minWidth: 120,
    gap: space[1],
  },
  colCondomino: {
    flex: 1.8,
    minWidth: 120,
  },
  colQuotaInput: {
    width: 156,
    minWidth: 130,
    padding: focusRingInset,
  },
  colPercentuale: {
    width: 96,
    alignItems: 'flex-end',
  },
  testoForte: {
    color: colors.text.primary,
  },
  testoNormale: {
    color: colors.text.primary,
  },
  testoSecondario: {
    color: colors.text.secondary,
  },
  testoNonAssegnato: {
    color: colors.text.muted,
  },
  testoPercentuale: {
    color: colors.text.primary,
  },
  listaCardMobile: {
    gap: space[4],
  },
  cardUnitaMobile: {
    padding: space[4],
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    gap: space[3],
  },
  cardMobileHeader: {
    gap: space[1],
  },
  cardMobileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space[2],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
});
