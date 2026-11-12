import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, type TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { IRaccoltaDifferenziata } from '@iocondo/shared-types';
import {
  GIORNI_SETTIMANA,
  badgeGiornoRelativo,
  contestoGiorniRaccolta,
  filtraTurniRaccolta,
  metadatiTipoRifiuto,
  nomeGiornoSettimana,
  ordinaTurniRaccolta,
  statisticheRaccolta,
  validaTurnoRaccolta,
  type ErroriFormRaccolta,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterChips,
  Icon,
  LoadingState,
  Input,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  ResponsiveDataView,
  SearchBar,
  Select,
  StatCard,
  Textarea,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  useBreakpoint,
  useToast,
  type DataColumn,
  type FilterOption,
  type SelectOption,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const OPZIONI_FILTRO_GIORNI: readonly FilterOption[] = GIORNI_SETTIMANA.map((g) => ({
  value: String(g.numero),
  label: g.breve,
}));

const OPZIONI_SELECT_GIORNI: readonly SelectOption[] = GIORNI_SETTIMANA.map((g) => ({
  value: String(g.numero),
  label: g.nome,
}));

/**
 * Schermata Amministratore per la gestione CRUD della Raccolta Differenziata
 * (`/admin/raccolta-differenziata`), protetta da guardia ADMIN.
 */
export function AdminRaccoltaDifferenziataScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Raccolta differenziata"
          subtitle="Gestisci i turni settimanali di esposizione dei rifiuti."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminRaccoltaDifferenziataContenuto />;
}

function AdminRaccoltaDifferenziataContenuto() {
  const router = useRouter();
  const { condominio } = useProfilo();
  const { breakpoint, isMobile } = useBreakpoint();
  const toast = useToast();

  const condominioId = condominio?.id ?? '';
  const condominioNome = condominio?.nome ?? '';

  const [turni, setTurni] = useState<IRaccoltaDifferenziata[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  // Filtri
  const [giornoFiltro, setGiornoFiltro] = useState<string[]>([]);
  const [ricerca, setRicerca] = useState('');

  // Modale creazione / modifica
  const [modaleAperta, setModaleAperta] = useState(false);
  const [turnoInModifica, setTurnoInModifica] = useState<IRaccoltaDifferenziata | null>(null);
  const [tipoInput, setTipoInput] = useState('');
  const [giornoInput, setGiornoInput] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [erroriForm, setErroriForm] = useState<ErroriFormRaccolta>({});
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
  const tipoInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Eliminazione con ConfirmDialog
  const [turnoDaEliminare, setTurnoDaEliminare] = useState<IRaccoltaDifferenziata | null>(null);

  // Modale Dettaglio Turno (riga cliccabile standard)
  const [turnoDettaglio, setTurnoDettaglio] = useState<IRaccoltaDifferenziata | null>(null);
  const [modaleDettaglioAperta, setModaleDettaglioAperta] = useState(false);

  const caricaTurni = useCallback(async () => {
    setCaricamento(true);
    setErrore(false);
    try {
      const lista = await services.raccoltaDifferenziata.elenco(condominioId);
      setTurni(lista);
    } catch (err) {
      console.error('Errore caricamento raccolta differenziata:', err);
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominioId]);

  useEffect(() => {
    setGiornoFiltro([]);
    setRicerca('');
    void caricaTurni();
  }, [caricaTurni]);

  const adesso = useMemo(() => new Date(), []);
  const contesto = useMemo(() => contestoGiorniRaccolta(adesso), [adesso]);
  const stats = useMemo(() => statisticheRaccolta(turni, adesso), [turni, adesso]);

  const turniFiltrati = useMemo(() => {
    const giornoNum = giornoFiltro[0] ? Number(giornoFiltro[0]) : null;
    return filtraTurniRaccolta(turni, { giorno: giornoNum, ricerca });
  }, [turni, giornoFiltro, ricerca]);

  const apriNuovoTurno = useCallback(() => {
    setTurnoInModifica(null);
    setTipoInput('');
    setGiornoInput('1');
    setNoteInput('');
    setErroriForm({});
    setErroreSalvataggio(null);
    setModaleAperta(true);
  }, []);

  const apriModificaTurno = useCallback((turno: IRaccoltaDifferenziata) => {
    setTurnoInModifica(turno);
    setTipoInput(turno.tipo_rifiuto);
    setGiornoInput(String(turno.giorno_settimana));
    setNoteInput(turno.note ?? '');
    setErroriForm({});
    setErroreSalvataggio(null);
    setModaleAperta(true);
  }, []);

  const apriDettaglioTurno = useCallback((turno: IRaccoltaDifferenziata) => {
    setTurnoDettaglio(turno);
    setModaleDettaglioAperta(true);
  }, []);

  const chiudiDettaglio = useCallback(() => {
    setModaleDettaglioAperta(false);
  }, []);

  const apriModificaDaDettaglio = useCallback(() => {
    if (!turnoDettaglio) return;
    const t = turnoDettaglio;
    setModaleDettaglioAperta(false);
    apriModificaTurno(t);
  }, [apriModificaTurno, turnoDettaglio]);

  const chiediEliminazioneDaDettaglio = useCallback(() => {
    if (!turnoDettaglio) return;
    const t = turnoDettaglio;
    setModaleDettaglioAperta(false);
    setTurnoDaEliminare(t);
  }, [turnoDettaglio]);

  const chiudiModale = useCallback(() => {
    if (salvataggioInCorso) return;
    setModaleAperta(false);
  }, [salvataggioInCorso]);

  const salvaTurno = useCallback(async () => {
    const giornoNumero = giornoInput ? Number(giornoInput) : null;
    const validazione = validaTurnoRaccolta({
      tipo_rifiuto: tipoInput,
      giorno_settimana: giornoNumero,
      note: noteInput,
    });

    if (!validazione.ok) {
      setErroriForm(validazione.errori);
      return;
    }

    setErroriForm({});
    setErroreSalvataggio(null);
    setSalvataggioInCorso(true);

    try {
      if (turnoInModifica) {
        const aggiornato = await services.raccoltaDifferenziata.aggiorna(
          turnoInModifica.id,
          condominioId,
          validazione.dati,
        );
        setTurni((prev) =>
          ordinaTurniRaccolta(prev.map((t) => (t.id === aggiornato.id ? aggiornato : t))),
        );
        setTurnoDettaglio((prev) => (prev?.id === aggiornato.id ? aggiornato : prev));
        setModaleAperta(false);
        toast.show({
          tone: 'success',
          title: 'Turno aggiornato',
          message: `${aggiornato.tipo_rifiuto} (${nomeGiornoSettimana(aggiornato.giorno_settimana)}) salvato.`,
        });
      } else {
        const creato = await services.raccoltaDifferenziata.crea(condominioId, validazione.dati);
        setTurni((prev) => ordinaTurniRaccolta([...prev, creato]));
        setModaleAperta(false);
        toast.show({
          tone: 'success',
          title: 'Turno inserito',
          message: `${creato.tipo_rifiuto} (${nomeGiornoSettimana(creato.giorno_settimana)}) aggiunto al calendario.`,
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Non è stato possibile salvare il turno di raccolta.';
      setErroreSalvataggio(msg);
    } finally {
      setSalvataggioInCorso(false);
    }
  }, [condominioId, giornoInput, noteInput, tipoInput, toast, turnoInModifica]);

  const confermaEliminazione = useCallback(async () => {
    if (!turnoDaEliminare) return;
    const target = turnoDaEliminare;
    await services.raccoltaDifferenziata.elimina(target.id, condominioId);
    setTurni((prev) => prev.filter((t) => t.id !== target.id));
    if (turnoDettaglio?.id === target.id) {
      setTurnoDettaglio(null);
    }
    setTurnoDaEliminare(null);
    toast.show({
      tone: 'success',
      title: 'Turno eliminato',
      message: `${target.tipo_rifiuto} (${nomeGiornoSettimana(target.giorno_settimana)}) rimosso dal calendario.`,
    });
  }, [condominioId, toast, turnoDaEliminare]);

  const colonne: readonly DataColumn<IRaccoltaDifferenziata>[] = useMemo(
    () => [
      {
        key: 'giorno',
        header: 'Giorno',
        weight: 1.6,
        minWidth: 210,
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
        minWidth: 190,
        mobile: 'status',
        cell: (r) => {
          const meta = metadatiTipoRifiuto(r.tipo_rifiuto);
          return <Badge status={meta.tono} label={r.tipo_rifiuto} icon={meta.icona} />;
        },
      },
      {
        key: 'note',
        header: 'Note e orari di esposizione',
        weight: 2,
        minWidth: 200,
        cell: (r) => (
          <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
            {r.note?.trim() ? r.note : 'Nessuna nota aggiuntiva'}
          </Text>
        ),
      },
      {
        key: 'azioni',
        header: 'Azioni',
        weight: 1.4,
        minWidth: 210,
        cell: (r) => (
          <View style={styles.azioniRiga}>
            <Button
              label="Modifica"
              variant="secondary"
              icon="pencil"
              onPress={() => apriModificaTurno(r)}
              accessibilityHint={`Modifica il turno ${r.tipo_rifiuto} di ${nomeGiornoSettimana(r.giorno_settimana)}`}
            />
            <Button
              label="Elimina"
              variant="destructive"
              icon="trash-2"
              onPress={() => setTurnoDaEliminare(r)}
              accessibilityHint={`Elimina il turno ${r.tipo_rifiuto} di ${nomeGiornoSettimana(r.giorno_settimana)}`}
            />
          </View>
        ),
      },
    ],
    [adesso, apriModificaTurno, breakpoint],
  );

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Raccolta differenziata"
        subtitle={`Gestisci i giorni e gli orari di esposizione dei rifiuti — ${condominioNome}`}
        breadcrumbs={[
          { label: 'Home', onPress: () => router.push('/admin/dashboard') },
          { label: 'Amministrazione' },
          { label: 'Raccolta differenziata' },
        ]}
        action={{
          label: 'Nuovo turno',
          icon: 'calendar-plus',
          onPress: apriNuovoTurno,
        }}
      />

      {/* Riepilogo StatCard */}
      <View style={[styles.grigliaStat, isMobile && styles.grigliaStatMobile]}>
        <View style={styles.statWrap}>
          <StatCard
            tile="blue"
            icon="calendar-days"
            title="Turni configurati"
            value={String(stats.totaleTurni)}
            description="Ritiri settimanali attivi"
            loading={caricamento}
          />
        </View>
        <View style={styles.statWrap}>
          <StatCard
            tile="navy"
            icon="check-square"
            title="Giorni coperti"
            value={`${stats.giorniCoperti} / 7`}
            description="Giorni con almeno un ritiro"
            loading={caricamento}
          />
        </View>
        <View style={styles.statWrap}>
          <StatCard
            tile="teal"
            icon="clock"
            title="Ritiri di oggi"
            value={String(stats.turniOggi)}
            description={contesto.nomeOggi}
            loading={caricamento}
          />
        </View>
      </View>

      {caricamento ? (
        <LoadingState message="Caricamento dei turni di raccolta…" />
      ) : null}

      {!caricamento && errore ? <ErrorState onRetry={caricaTurni} /> : null}

      {!caricamento && !errore && turni.length === 0 ? (
        <EmptyState
          icon="calendar-days"
          title="Nessun turno configurato"
          description="Inserisci il primo turno settimanale di raccolta differenziata per renderlo visibile ai residenti."
          action={{
            label: 'Nuovo turno',
            icon: 'calendar-plus',
            onPress: apriNuovoTurno,
          }}
        />
      ) : null}

      {!caricamento && !errore && turni.length > 0 ? (
        <Card title="Calendario settimanale dei ritiri">
          <View style={styles.controlli}>
            <SearchBar
              value={ricerca}
              onChangeText={setRicerca}
              label="Cerca nei turni di raccolta"
              placeholder="Cerca per tipologia di rifiuto o note…"
            />
            <FilterChips
              label="Filtra per giorno della settimana"
              options={OPZIONI_FILTRO_GIORNI}
              value={giornoFiltro}
              onChange={setGiornoFiltro}
            />
          </View>

          <View style={styles.tabellaWrap}>
            <ResponsiveDataView
              label="Gestione turni raccolta differenziata"
              rows={turniFiltrati}
              columns={colonne}
              getRowKey={(r) => r.id}
              getRowLabel={(r) => `${nomeGiornoSettimana(r.giorno_settimana)} — ${r.tipo_rifiuto}`}
              onRowPress={apriDettaglioTurno}
              empty={{
                title: 'Nessun turno trovato',
                description: 'Prova a cambiare il giorno selezionato o i termini di ricerca.',
                icon: 'calendar-days',
              }}
            />
          </View>
        </Card>
      ) : null}

      {/* Modale Creazione / Modifica turno */}
      <Modal
        visible={modaleAperta}
        onClose={chiudiModale}
        dismissible={!salvataggioInCorso}
        initialFocusRef={tipoInputRef}
        title={turnoInModifica ? 'Modifica turno di raccolta' : 'Nuovo turno di raccolta'}
        description="Imposta la tipologia di rifiuto, il giorno settimanale di ritiro e le eventuali indicazioni per i residenti."
        actions={
          <ModalActions>
            <Button
              label="Annulla"
              variant="secondary"
              disabled={salvataggioInCorso}
              onPress={chiudiModale}
            />
            <Button
              label={turnoInModifica ? 'Salva modifiche' : 'Salva turno'}
              loading={salvataggioInCorso}
              loadingLabel="Salvataggio…"
              icon="check"
              onPress={salvaTurno}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreSalvataggio ? (
            <Alert tone="error" title="Salvataggio non riuscito" message={erroreSalvataggio} />
          ) : null}

          <Input
            inputRef={tipoInputRef}
            label="Tipo di rifiuto"
            required
            value={tipoInput}
            onChangeText={(val) => {
              setTipoInput(val);
              if (erroriForm.tipo_rifiuto) {
                setErroriForm((prev) => ({ ...prev, tipo_rifiuto: undefined }));
              }
            }}
            placeholder="Es. Carta e cartone, Umido / Organico, Plastica e metalli"
            error={erroriForm.tipo_rifiuto}
            disabled={salvataggioInCorso}
          />

          <Select
            label="Giorno della settimana"
            required
            options={OPZIONI_SELECT_GIORNI}
            value={giornoInput}
            onChange={(val) => {
              setGiornoInput(val);
              if (erroriForm.giorno_settimana) {
                setErroriForm((prev) => ({ ...prev, giorno_settimana: undefined }));
              }
            }}
            placeholder="Seleziona il giorno"
            error={erroriForm.giorno_settimana}
            disabled={salvataggioInCorso}
          />

          <Textarea
            label="Note e orari di esposizione"
            value={noteInput}
            onChangeText={(val) => {
              setNoteInput(val);
              if (erroriForm.note) {
                setErroriForm((prev) => ({ ...prev, note: undefined }));
              }
            }}
            placeholder="Es. Esporre entro le 7:00 nel cortile interno"
            helperText="Facoltativo. Massimo 300 caratteri."
            error={erroriForm.note}
            disabled={salvataggioInCorso}
          />
        </View>
      </Modal>

      {/* Modale Visualizzazione Dettaglio Turno (aperta al click sulla riga) */}
      <Modal
        visible={modaleDettaglioAperta}
        onClose={chiudiDettaglio}
        title="Dettaglio turno di raccolta"
        description="Visualizza le informazioni complete del turno di raccolta programmato."
        actions={
          <ModalActions>
            <Button
              label="Chiudi"
              variant="secondary"
              onPress={chiudiDettaglio}
            />
            <Button
              label="Modifica"
              variant="primary"
              icon="pencil"
              onPress={apriModificaDaDettaglio}
            />
            <Button
              label="Elimina"
              variant="destructive"
              icon="trash-2"
              onPress={chiediEliminazioneDaDettaglio}
            />
          </ModalActions>
        }
      >
        {turnoDettaglio ? (
          <View style={styles.corpoDettaglio}>
            <View style={styles.sezioneDettaglio}>
              <Text style={[textStyle('label', breakpoint), styles.etichettaDettaglio]}>
                Tipologia di rifiuto
              </Text>
              <View style={styles.valoreDettaglioRiga}>
                {(() => {
                  const meta = metadatiTipoRifiuto(turnoDettaglio.tipo_rifiuto);
                  return (
                    <Badge
                      status={meta.tono}
                      label={turnoDettaglio.tipo_rifiuto}
                      icon={meta.icona}
                    />
                  );
                })()}
              </View>
            </View>

            <View style={styles.sezioneDettaglio}>
              <Text style={[textStyle('label', breakpoint), styles.etichettaDettaglio]}>
                Giorno della settimana
              </Text>
              <View style={styles.valoreDettaglioRiga}>
                <Icon name="calendar-days" size="action" color={colors.text.secondary} />
                <Text style={[textStyle('h3', breakpoint), styles.testoPrimario]}>
                  {nomeGiornoSettimana(turnoDettaglio.giorno_settimana)}
                </Text>
                {badgeGiornoRelativo(turnoDettaglio.giorno_settimana, adesso) === 'oggi' ? (
                  <Badge status="in-corso" label="Oggi" />
                ) : null}
                {badgeGiornoRelativo(turnoDettaglio.giorno_settimana, adesso) === 'domani' ? (
                  <Badge status="info" label="Domani" />
                ) : null}
              </View>
            </View>

            <View style={styles.sezioneDettaglio}>
              <Text style={[textStyle('label', breakpoint), styles.etichettaDettaglio]}>
                Note e orari di esposizione
              </Text>
              <View style={styles.boxNoteDettaglio}>
                <Icon name="clock" size="indicator" color={colors.text.secondary} />
                <Text style={[textStyle('body', breakpoint), styles.testoSecondario]}>
                  {turnoDettaglio.note?.trim()
                    ? turnoDettaglio.note
                    : 'Nessuna indicazione particolare per i residenti.'}
                </Text>
              </View>
            </View>

            <View style={styles.sezioneDettaglio}>
              <Text style={[textStyle('label', breakpoint), styles.etichettaDettaglio]}>
                Condominio
              </Text>
              <View style={styles.valoreDettaglioRiga}>
                <Icon name="building-2" size="indicator" color={colors.text.secondary} />
                <Text style={[textStyle('body', breakpoint), styles.testoSecondario]}>
                  {condominioNome}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* ConfirmDialog eliminazione sicura */}
      <ConfirmDialog
        visible={Boolean(turnoDaEliminare)}
        title="Eliminare il turno di raccolta?"
        description={
          turnoDaEliminare
            ? `Il turno "${turnoDaEliminare.tipo_rifiuto}" (${nomeGiornoSettimana(turnoDaEliminare.giorno_settimana)}) sarà rimosso dal calendario per tutti i residenti.`
            : ''
        }
        confirmLabel="Elimina turno"
        confirmLoadingLabel="Eliminazione…"
        onConfirm={confermaEliminazione}
        onCancel={() => setTurnoDaEliminare(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    gap: space[6],
  },
  grigliaStat: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  grigliaStatMobile: {
    flexDirection: 'column',
  },
  statWrap: {
    flex: 1,
    minWidth: 220,
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
    flexWrap: 'nowrap',
    gap: space[2],
  },
  azioniRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  corpoDettaglio: {
    gap: space[4],
  },
  sezioneDettaglio: {
    gap: space[2],
  },
  etichettaDettaglio: {
    color: colors.text.muted,
  },
  valoreDettaglioRiga: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  boxNoteDettaglio: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[3],
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  formModale: {
    gap: space[4],
  },
  testoPrimario: {
    color: colors.text.primary,
  },
  testoSecondario: {
    color: colors.text.secondary,
    flexShrink: 1,
  },
});
