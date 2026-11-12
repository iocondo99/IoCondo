import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { IRisorsaPrenotabile } from '@iocondo/shared-types';
import {
  calcolaCostoPrenotazione,
  filtraPrenotazioni,
  formattaCostoPrenotazione,
  formattaIntervalloPrenotazione,
  formattaTariffaOraria,
  generaSlotGiorno,
  statoPrenotazione,
  traduciErrorePrenotazione,
  validaPrenotazione,
  type ErroriFormPrenotazione,
  type FiltroStatoPrenotazione,
  type PrenotazioneConDettagli,
  type SlotOrario,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  ErrorState,
  FilterChips,
  Icon,
  LoadingState,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  ResponsiveDataView,
  Select,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  touchTarget,
  useBreakpoint,
  useToast,
  type DataColumn,
  type FilterOption,
  type SelectOption,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

const OPZIONI_STATO: readonly FilterOption[] = [
  { value: 'in-programma', label: 'In programma' },
  { value: 'passate', label: 'Passate' },
];

const ORE_INIZIO: readonly SelectOption[] = Array.from({ length: 14 }, (_, i) => {
  const ora = i + 8;
  return { value: String(ora), label: `${String(ora).padStart(2, '0')}:00` };
});

const ORE_FINE: readonly SelectOption[] = Array.from({ length: 14 }, (_, i) => {
  const ora = i + 9;
  return { value: String(ora), label: `${String(ora).padStart(2, '0')}:00` };
});

function inizioGiorno(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function prossimoGiornoUtile(now: Date): Date {
  if (now.getHours() >= 21) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  }
  return inizioGiorno(now);
}

/**
 * Schermata Condòmino / Portiere per la consultazione degli spazi comuni,
 * verifica disponibilità giornaliera (nel rispetto della privacy tra vicini)
 * e gestione delle proprie prenotazioni (`/prenotazioni`).
 */
export function PrenotazioniScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('CONDOMINO') && !ruoli.has('PORTIERE')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Prenotazione spazi comuni"
          subtitle="Consulta la disponibilità e prenota gli spazi condominiali."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <PrenotazioniContenuto />;
}

function PrenotazioniContenuto() {
  const { profilo, condominio } = useProfilo();
  const { breakpoint, isMobile } = useBreakpoint();
  const toast = useToast();

  const utenteId = profilo?.id ?? '';
  const condominioId = condominio?.id ?? '';
  const condominioNome = condominio?.nome ?? '';
  const chiave = `${utenteId}|${condominioId}`;

  const { blocco, ricarica } = useBlocco(async () => {
    const [risorse, prenotazioni] = await Promise.all([
      services.prenotazioni.elencoRisorse(condominioId),
      services.prenotazioni.elencoPrenotazioniCondominio(condominioId),
    ]);
    return { risorse, prenotazioni };
  }, chiave);

  useFocusEffect(
    useCallback(() => {
      ricarica();
    }, [ricarica]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (stato: AppStateStatus) => {
      if (stato === 'active') ricarica();
    });
    return () => sub.remove();
  }, [ricarica]);

  // Filtri elenco personale
  const [statoFiltro, setStatoFiltro] = useState<string[]>([]);
  const [spazioFiltro, setSpazioFiltro] = useState<string[]>([]);

  useEffect(() => {
    setStatoFiltro([]);
    setSpazioFiltro([]);
  }, [condominioId]);

  // Modale "Prenota spazio comune"
  const [modaleAperta, setModaleAperta] = useState(false);
  const [risorsaSelezionataId, setRisorsaSelezionataId] = useState<string | null>(null);
  const [dataSelezionata, setDataSelezionata] = useState<Date | null>(() => prossimoGiornoUtile(new Date()));
  const [oraInizio, setOraInizio] = useState<string>('10');
  const [oraFine, setOraFine] = useState<string>('11');
  const [erroriForm, setErroriForm] = useState<ErroriFormPrenotazione>({});
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  // ConfirmDialog annullamento
  const [prenotazioneDaAnnullare, setPrenotazioneDaAnnullare] = useState<PrenotazioneConDettagli | null>(null);

  const risorse: readonly IRisorsaPrenotabile[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati.risorse : []),
    [blocco],
  );
  const prenotazioni: readonly PrenotazioneConDettagli[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati.prenotazioni : []),
    [blocco],
  );

  const adesso = useMemo(() => new Date(), []);
  const oggiMinimo = useMemo(() => inizioGiorno(new Date()), []);

  const opzioniSpaziFiltro: readonly FilterOption[] = useMemo(
    () => risorse.map((r) => ({ value: r.id, label: r.nome })),
    [risorse],
  );

  const opzioniSpaziSelect: readonly SelectOption[] = useMemo(
    () =>
      risorse.map((r) => ({
        value: r.id,
        label: `${r.nome} · ${formattaTariffaOraria(r.tariffa_oraria)}${
          r.max_ore !== null ? ` · Max ${r.max_ore} ${r.max_ore === 1 ? 'ora' : 'ore'}` : ''
        }`,
      })),
    [risorse],
  );

  const miePrenotazioniFiltrate = useMemo(() => {
    const stato: FiltroStatoPrenotazione =
      statoFiltro[0] === 'in-programma' || statoFiltro[0] === 'passate' ? statoFiltro[0] : 'tutte';
    return filtraPrenotazioni(
      prenotazioni,
      {
        soloUtenteId: utenteId,
        stato,
        risorsaId: spazioFiltro[0],
      },
      adesso,
    );
  }, [adesso, prenotazioni, spazioFiltro, statoFiltro, utenteId]);

  const risorsaScelta = useMemo(
    () => risorse.find((r) => r.id === risorsaSelezionataId) ?? null,
    [risorsaSelezionataId, risorse],
  );

  const { dataInizioScelta, dataFineScelta } = useMemo(() => {
    if (!dataSelezionata) return { dataInizioScelta: null, dataFineScelta: null };
    const hInizio = Number(oraInizio);
    const hFine = Number(oraFine);
    if (!Number.isInteger(hInizio) || !Number.isInteger(hFine)) {
      return { dataInizioScelta: null, dataFineScelta: null };
    }
    const start = new Date(
      dataSelezionata.getFullYear(),
      dataSelezionata.getMonth(),
      dataSelezionata.getDate(),
      hInizio,
      0,
      0,
      0,
    );
    const end = new Date(
      dataSelezionata.getFullYear(),
      dataSelezionata.getMonth(),
      dataSelezionata.getDate(),
      hFine,
      0,
      0,
      0,
    );
    return { dataInizioScelta: start, dataFineScelta: end };
  }, [dataSelezionata, oraFine, oraInizio]);

  const slotGiorno: readonly SlotOrario[] = useMemo(() => {
    if (!dataSelezionata || !risorsaScelta) return [];
    return generaSlotGiorno(dataSelezionata, risorsaScelta.id, prenotazioni, utenteId, {
      oraInizio: 8,
      oraFine: 22,
      now: new Date(),
    });
  }, [dataSelezionata, prenotazioni, risorsaScelta, utenteId]);

  const costoStimato = useMemo(() => {
    if (!risorsaScelta || !dataInizioScelta || !dataFineScelta) return 0;
    return calcolaCostoPrenotazione(risorsaScelta.tariffa_oraria, dataInizioScelta, dataFineScelta);
  }, [dataFineScelta, dataInizioScelta, risorsaScelta]);

  const durataOre = useMemo(() => {
    const diff = Number(oraFine) - Number(oraInizio);
    return diff > 0 ? diff : 0;
  }, [oraFine, oraInizio]);

  const apriModalePrenotazione = useCallback(
    (risorsaPreselezionata?: IRisorsaPrenotabile) => {
      const target = risorsaPreselezionata ?? risorse[0] ?? null;
      setRisorsaSelezionataId(target?.id ?? null);
      const adessoCorrente = new Date();
      const giornoDefault = prossimoGiornoUtile(adessoCorrente);
      setDataSelezionata(giornoDefault);
      const primaOraLibera =
        giornoDefault.getDate() === adessoCorrente.getDate() &&
        giornoDefault.getMonth() === adessoCorrente.getMonth()
          ? Math.max(8, Math.min(21, adessoCorrente.getHours() + 1))
          : 10;
      setOraInizio(String(primaOraLibera));
      setOraFine(String(primaOraLibera + 1));
      setErroriForm({});
      setErroreSalvataggio(null);
      setModaleAperta(true);
    },
    [risorse],
  );

  const chiudiModale = useCallback(() => {
    if (salvataggioInCorso) return;
    setModaleAperta(false);
  }, [salvataggioInCorso]);

  const selezionaSlotRapido = useCallback((slot: SlotOrario) => {
    if (slot.stato !== 'libero') return;
    setOraInizio(String(slot.oraInizio));
    setOraFine(String(slot.oraFine));
    setErroriForm({});
    setErroreSalvataggio(null);
  }, []);

  const inviaPrenotazione = useCallback(async () => {
    setErroreSalvataggio(null);
    if (!dataInizioScelta || !dataFineScelta || !risorsaScelta) {
      setErroriForm({
        risorsa_id: !risorsaScelta ? 'Seleziona uno spazio comune da prenotare.' : undefined,
        data_inizio: !dataInizioScelta ? 'Seleziona una data valida.' : undefined,
      });
      return;
    }

    const validazione = validaPrenotazione(
      {
        risorsa_id: risorsaScelta.id,
        data_inizio: dataInizioScelta,
        data_fine: dataFineScelta,
      },
      risorsaScelta,
      prenotazioni,
      new Date(),
    );

    if (!validazione.ok) {
      setErroriForm(validazione.errori);
      return;
    }

    setErroriForm({});
    setSalvataggioInCorso(true);
    try {
      await services.prenotazioni.creaPrenotazione(risorsaScelta.id, utenteId, {
        data_inizio: validazione.dati.data_inizio,
        data_fine: validazione.dati.data_fine,
      });
      setModaleAperta(false);
      ricarica();
      toast.show({
        tone: 'success',
        title: 'Prenotazione confermata',
        message: `${risorsaScelta.nome} prenotato per ${formattaIntervalloPrenotazione(
          validazione.dati.data_inizio.toISOString(),
          validazione.dati.data_fine.toISOString(),
        )}.`,
      });
    } catch (err) {
      setErroreSalvataggio(traduciErrorePrenotazione(err));
    } finally {
      setSalvataggioInCorso(false);
    }
  }, [dataFineScelta, dataInizioScelta, prenotazioni, ricarica, risorsaScelta, toast, utenteId]);

  const confermaAnnullamento = useCallback(async () => {
    if (!prenotazioneDaAnnullare) return;
    const target = prenotazioneDaAnnullare;
    await services.prenotazioni.annullaPrenotazione(target.id, utenteId);
    setPrenotazioneDaAnnullare(null);
    ricarica();
    toast.show({
      tone: 'success',
      title: 'Prenotazione annullata',
      message: `La prenotazione per ${target.risorsa_nome} è stata annullata.`,
    });
  }, [prenotazioneDaAnnullare, ricarica, toast, utenteId]);

  const colonnePrenotazioni: readonly DataColumn<PrenotazioneConDettagli>[] = useMemo(
    () => [
      {
        key: 'spazio',
        header: 'Spazio comune',
        weight: 1.4,
        minWidth: 160,
        mobile: 'title',
        cell: (p) => (
          <Text style={[textStyle('h4', breakpoint), styles.testoPrimario]}>{p.risorsa_nome}</Text>
        ),
      },
      {
        key: 'orario',
        header: 'Data e fascia oraria',
        weight: 1.8,
        minWidth: 200,
        cell: (p) => (
          <Text style={[textStyle('body', breakpoint), styles.testoPrimario]}>
            {formattaIntervalloPrenotazione(p.data_inizio, p.data_fine)}
          </Text>
        ),
      },
      {
        key: 'costo',
        header: 'Costo stimato',
        weight: 1,
        minWidth: 110,
        cell: (p) => (
          <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
            {formattaCostoPrenotazione(p.costo_addebitato)}
          </Text>
        ),
      },
      {
        key: 'stato',
        header: 'Stato',
        weight: 1,
        minWidth: 130,
        mobile: 'status',
        cell: (p) => {
          const attiva = statoPrenotazione(p, adesso) === 'in-programma';
          return (
            <Badge
              status={attiva ? 'in-corso' : 'neutral'}
              label={attiva ? 'In programma' : 'Passata'}
            />
          );
        },
      },
      {
        key: 'azioni',
        header: 'Azioni',
        weight: 1,
        minWidth: 130,
        cell: (p) => {
          const attiva = statoPrenotazione(p, adesso) === 'in-programma';
          if (!attiva) {
            return (
              <Text style={[textStyle('secondary', breakpoint), styles.testoMuted]}>—</Text>
            );
          }
          return (
            <Button
              label="Annulla"
              variant="destructive"
              icon="trash-2"
              onPress={() => setPrenotazioneDaAnnullare(p)}
              accessibilityHint={`Annulla la prenotazione di ${p.risorsa_nome}`}
            />
          );
        },
      },
    ],
    [adesso, breakpoint],
  );

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Prenotazione spazi comuni"
        subtitle={`Spazi prenotabili e le tue prenotazioni — ${condominioNome}`}
        action={
          risorse.length > 0
            ? {
                label: 'Nuova prenotazione',
                icon: 'calendar-plus',
                onPress: () => apriModalePrenotazione(),
              }
            : undefined
        }
      />

      {blocco.stato === 'caricamento' ? (
        <LoadingState message="Caricamento degli spazi comuni…" />
      ) : null}

      {blocco.stato === 'errore' ? <ErrorState onRetry={ricarica} /> : null}

      {blocco.stato === 'pronto' && risorse.length === 0 ? (
        <EmptyState
          icon="calendar-days"
          title="Nessuno spazio prenotabile configurato"
          description="L'amministratore non ha ancora configurato spazi comuni prenotabili per questo condominio."
        />
      ) : null}

      {blocco.stato === 'pronto' && risorse.length > 0 ? (
        <View style={styles.contenuto}>
          {/* Elenco spazi comuni prenotabili */}
          <View style={styles.sezione}>
            <Text style={[textStyle('h2', breakpoint), styles.testoPrimario]}>
              Spazi disponibili
            </Text>
            <View style={[styles.grigliaSpazi, isMobile && styles.grigliaSpaziMobile]}>
              {risorse.map((risorsa) => (
                <View key={risorsa.id} style={[styles.cardSpazioWrap, isMobile && styles.cardSpazioWrapMobile]}>
                  <Card title={risorsa.nome}>
                    <View style={styles.dettagliSpazio}>
                      <View style={styles.rigaMeta}>
                        <Badge
                          status={risorsa.tariffa_oraria > 0 ? 'info' : 'success'}
                          label={formattaTariffaOraria(risorsa.tariffa_oraria)}
                        />
                        <Badge
                          status="neutral"
                          label={
                            risorsa.max_ore !== null
                              ? `Max ${risorsa.max_ore} ${risorsa.max_ore === 1 ? 'ora' : 'ore'}`
                              : 'Nessun limite ore'
                          }
                        />
                      </View>
                      <Button
                        label="Prenota spazio"
                        variant="secondary"
                        icon="calendar-plus"
                        onPress={() => apriModalePrenotazione(risorsa)}
                        accessibilityHint={`Apri la prenotazione per ${risorsa.nome}`}
                      />
                    </View>
                  </Card>
                </View>
              ))}
            </View>
          </View>

          {/* Le mie prenotazioni */}
          <Card title="Le mie prenotazioni">
            <View style={styles.controlli}>
              <FilterChips
                label="Filtra per stato prenotazione"
                options={OPZIONI_STATO}
                value={statoFiltro}
                onChange={setStatoFiltro}
                allLabel="Tutte"
              />
              {opzioniSpaziFiltro.length > 1 ? (
                <FilterChips
                  label="Filtra per spazio comune"
                  options={opzioniSpaziFiltro}
                  value={spazioFiltro}
                  onChange={setSpazioFiltro}
                  allLabel="Tutti gli spazi"
                />
              ) : null}
            </View>

            <ResponsiveDataView
              label="Le mie prenotazioni"
              rows={miePrenotazioniFiltrate}
              columns={colonnePrenotazioni}
              getRowKey={(p) => p.id}
              getRowLabel={(p) => `${p.risorsa_nome} · ${formattaIntervalloPrenotazione(p.data_inizio, p.data_fine)}`}
              empty={{
                icon: 'calendar-days',
                title: 'Nessuna prenotazione trovata',
                description: 'Non hai ancora prenotazioni corrispondenti ai filtri selezionati.',
              }}
            />
          </Card>
        </View>
      ) : null}

      {/* Modale accessibile: Prenota spazio comune (senza ScrollView annidata) */}
      <Modal
        visible={modaleAperta}
        onClose={chiudiModale}
        title="Prenota spazio comune"
        description="Seleziona lo spazio, la data e la fascia oraria desiderata."
        maxWidth={620}
        dismissible={!salvataggioInCorso}
        actions={
          <ModalActions>
            <Button
              label="Annulla"
              variant="secondary"
              onPress={chiudiModale}
              disabled={salvataggioInCorso}
            />
            <Button
              label={salvataggioInCorso ? 'Prenotazione in corso…' : 'Conferma prenotazione'}
              variant="primary"
              icon="check"
              onPress={inviaPrenotazione}
              loading={salvataggioInCorso}
              disabled={salvataggioInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreSalvataggio ? (
            <Alert tone="error" title="Prenotazione non completata" message={erroreSalvataggio} />
          ) : null}

          {erroriForm.generale ? (
            <Alert tone="error" title="Fascia oraria non disponibile" message={erroriForm.generale} />
          ) : null}

          <Select
            label="Spazio da prenotare"
            required
            options={opzioniSpaziSelect}
            value={risorsaSelezionataId}
            onChange={(val) => {
              setRisorsaSelezionataId(val);
              setErroriForm({});
              setErroreSalvataggio(null);
            }}
            error={erroriForm.risorsa_id}
            disabled={salvataggioInCorso}
          />

          <DatePicker
            label="Data prenotazione"
            required
            value={dataSelezionata}
            onChange={(d) => {
              setDataSelezionata(d);
              setErroriForm({});
              setErroreSalvataggio(null);
            }}
            min={oggiMinimo}
            error={erroriForm.data_inizio}
            disabled={salvataggioInCorso}
          />

          <View style={[styles.rigaOre, isMobile && styles.rigaOreMobile]}>
            <View style={styles.campoOra}>
              <Select
                label="Ora inizio"
                required
                options={ORE_INIZIO}
                value={oraInizio}
                onChange={(val) => {
                  setOraInizio(val);
                  if (Number(oraFine) <= Number(val)) {
                    setOraFine(String(Math.min(22, Number(val) + 1)));
                  }
                  setErroriForm({});
                  setErroreSalvataggio(null);
                }}
                disabled={salvataggioInCorso}
              />
            </View>
            <View style={styles.campoOra}>
              <Select
                label="Ora fine"
                required
                options={ORE_FINE}
                value={oraFine}
                onChange={(val) => {
                  setOraFine(val);
                  setErroriForm({});
                  setErroreSalvataggio(null);
                }}
                error={erroriForm.data_fine}
                disabled={salvataggioInCorso}
              />
            </View>
          </View>

          {/* Anteprima disponibilità giornaliera (privacy: solo "Occupato" per altri condòmini) */}
          {risorsaScelta && dataSelezionata ? (
            <View style={styles.boxDisponibilita}>
              <Text style={[textStyle('label', breakpoint), styles.testoPrimario]}>
                Disponibilità del giorno — {risorsaScelta.nome}
              </Text>
              <View style={styles.grigliaSlot}>
                {slotGiorno.map((slot) => {
                  const libero = slot.stato === 'libero';
                  const etichettaStato =
                    slot.stato === 'libero'
                      ? 'Libero'
                      : slot.stato === 'mio'
                        ? 'Tua'
                        : slot.stato === 'occupato'
                          ? 'Occupato'
                          : 'Passato';
                  return (
                    <Pressable
                      key={slot.oraInizio}
                      disabled={!libero || salvataggioInCorso}
                      onPress={() => selezionaSlotRapido(slot)}
                      accessibilityRole={libero ? 'button' : 'text'}
                      accessibilityLabel={`Fascia ${slot.etichetta}: ${etichettaStato}`}
                      style={({ pressed }) => [
                        styles.slotChip,
                        slot.stato === 'libero' && styles.slotLibero,
                        slot.stato === 'mio' && styles.slotMio,
                        slot.stato === 'occupato' && styles.slotOccupato,
                        slot.stato === 'passato' && styles.slotPassato,
                        pressed && libero && styles.slotPremuto,
                      ]}
                    >
                      <Text style={[textStyle('label', breakpoint), styles.testoPrimario]}>
                        {`${String(slot.oraInizio).padStart(2, '0')}:00`}
                      </Text>
                      <Text
                        style={[
                          textStyle('secondary', breakpoint),
                          slot.stato === 'libero' && styles.testoSuccesso,
                          slot.stato === 'mio' && styles.testoInfo,
                          slot.stato === 'occupato' && styles.testoErrore,
                          slot.stato === 'passato' && styles.testoMuted,
                        ]}
                      >
                        {etichettaStato}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Riepilogo durata e costo stimato */}
          {risorsaScelta ? (
            <View style={styles.boxRiepilogo}>
              <View style={styles.rigaRiepilogo}>
                <Icon name="clock" size="indicator" color={colors.semantic.info.foreground} />
                <Text style={[textStyle('secondary', breakpoint), styles.testoPrimario]}>
                  {durataOre > 0
                    ? `Durata selezionata: ${durataOre} ${durataOre === 1 ? 'ora' : 'ore'}`
                    : 'Seleziona una fascia oraria valida'}
                </Text>
              </View>
              <View style={styles.rigaRiepilogo}>
                <Icon name="coins" size="indicator" color={colors.semantic.info.foreground} />
                <Text style={[textStyle('h4', breakpoint), styles.testoPrimario]}>
                  Totale stimato: {formattaCostoPrenotazione(costoStimato)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <ConfirmDialog
        visible={prenotazioneDaAnnullare !== null}
        title="Annullare la prenotazione?"
        description={
          prenotazioneDaAnnullare
            ? `La prenotazione per ${prenotazioneDaAnnullare.risorsa_nome} (${formattaIntervalloPrenotazione(
                prenotazioneDaAnnullare.data_inizio,
                prenotazioneDaAnnullare.data_fine,
              )}) sarà cancellata e la fascia oraria tornerà disponibile.`
            : ''
        }
        confirmLabel="Annulla prenotazione"
        confirmLoadingLabel="Annullamento…"
        destructive
        onConfirm={confermaAnnullamento}
        onCancel={() => setPrenotazioneDaAnnullare(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    gap: space[5],
  },
  contenuto: {
    gap: space[5],
  },
  sezione: {
    gap: space[3],
  },
  grigliaSpazi: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  grigliaSpaziMobile: {
    flexDirection: 'column',
  },
  cardSpazioWrap: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 260,
  },
  cardSpazioWrapMobile: {
    flexBasis: 'auto',
    minWidth: 0,
    width: '100%',
  },
  dettagliSpazio: {
    gap: space[3],
  },
  rigaMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  controlli: {
    gap: space[3],
    marginBottom: space[4],
  },
  formModale: {
    gap: space[4],
  },
  rigaOre: {
    flexDirection: 'row',
    gap: space[3],
  },
  rigaOreMobile: {
    flexDirection: 'column',
  },
  campoOra: {
    flex: 1,
  },
  boxDisponibilita: {
    gap: space[2],
    padding: space[3],
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  grigliaSlot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  slotChip: {
    minWidth: 88,
    minHeight: touchTarget.control,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotLibero: {
    backgroundColor: colors.semantic.success.background,
    borderColor: colors.semantic.success.foreground,
  },
  slotMio: {
    backgroundColor: colors.semantic.info.background,
    borderColor: colors.semantic.info.foreground,
  },
  slotOccupato: {
    backgroundColor: colors.semantic.error.background,
    borderColor: colors.border,
  },
  slotPassato: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    opacity: 0.7,
  },
  slotPremuto: {
    opacity: 0.85,
  },
  boxRiepilogo: {
    gap: space[2],
    padding: space[3],
    backgroundColor: colors.semantic.info.background,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  rigaRiepilogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoPrimario: {
    color: colors.text.primary,
  },
  testoSecondario: {
    color: colors.text.secondary,
  },
  testoMuted: {
    color: colors.text.muted,
  },
  testoSuccesso: {
    color: colors.semantic.success.foreground,
  },
  testoInfo: {
    color: colors.semantic.info.foreground,
  },
  testoErrore: {
    color: colors.semantic.error.foreground,
  },
});
