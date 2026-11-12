import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, type TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { IRisorsaPrenotabile } from '@iocondo/shared-types';
import {
  filtraPrenotazioni,
  formattaCostoPrenotazione,
  formattaIntervalloPrenotazione,
  formattaTariffaOraria,
  statistichePrenotazioni,
  statoPrenotazione,
  traduciErrorePrenotazione,
  validaRisorsaPrenotabile,
  type ErroriFormRisorsa,
  type FiltroStatoPrenotazione,
  type PrenotazioneConDettagli,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  FilterChips,
  Input,
  LoadingState,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  ResponsiveDataView,
  SearchBar,
  StatCard,
  Tabs,
  colors,
  space,
  textStyle,
  useBreakpoint,
  useToast,
  type DataColumn,
  type FilterOption,
  type TabItem,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const OPZIONI_STATO: readonly FilterOption[] = [
  { value: 'in-programma', label: 'In programma' },
  { value: 'passate', label: 'Passate' },
];

/**
 * Schermata Amministratore per configurare gli spazi comuni prenotabili
 * e supervisionare/annullare le prenotazioni (`/admin/prenotazioni`),
 * protetta da guardia ADMIN.
 */
export function AdminPrenotazioniScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Spazi comuni e Prenotazioni"
          subtitle="Configura le risorse prenotabili e gestisci il calendario del condominio."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminPrenotazioniContenuto />;
}

function AdminPrenotazioniContenuto() {
  const router = useRouter();
  const { condominio } = useProfilo();
  const { breakpoint, isMobile } = useBreakpoint();
  const toast = useToast();

  const condominioId = condominio?.id ?? '';
  const condominioNome = condominio?.nome ?? '';

  const [risorse, setRisorse] = useState<IRisorsaPrenotabile[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneConDettagli[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  const [schedaAttiva, setSchedaAttiva] = useState<'spazi' | 'calendario'>('spazi');

  // Filtri tab Spazi
  const [ricercaSpazi, setRicercaSpazi] = useState('');

  // Filtri tab Calendario
  const [ricercaPrenotazioni, setRicercaPrenotazioni] = useState('');
  const [statoFiltro, setStatoFiltro] = useState<string[]>([]);
  const [spazioFiltro, setSpazioFiltro] = useState<string[]>([]);

  // Modale creazione / modifica spazio
  const [modaleSpazioAperta, setModaleSpazioAperta] = useState(false);
  const [spazioInModifica, setSpazioInModifica] = useState<IRisorsaPrenotabile | null>(null);
  const [nomeInput, setNomeInput] = useState('');
  const [tariffaInput, setTariffaInput] = useState('0');
  const [maxOreInput, setMaxOreInput] = useState('');
  const [erroriForm, setErroriForm] = useState<ErroriFormRisorsa>({});
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
  const nomeInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // ConfirmDialog eliminazione spazio / annullamento prenotazione
  const [spazioDaEliminare, setSpazioDaEliminare] = useState<IRisorsaPrenotabile | null>(null);
  const [prenotazioneDaAnnullare, setPrenotazioneDaAnnullare] = useState<PrenotazioneConDettagli | null>(null);

  const caricaDati = useCallback(async () => {
    setCaricamento(true);
    setErrore(false);
    try {
      const [listaRisorse, listaPrenotazioni] = await Promise.all([
        services.prenotazioni.elencoRisorse(condominioId),
        services.prenotazioni.elencoPrenotazioniCondominio(condominioId),
      ]);
      setRisorse(listaRisorse);
      setPrenotazioni(listaPrenotazioni);
    } catch {
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominioId]);

  useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  useEffect(() => {
    setRicercaSpazi('');
    setRicercaPrenotazioni('');
    setStatoFiltro([]);
    setSpazioFiltro([]);
  }, [condominioId]);

  const adesso = useMemo(() => new Date(), []);
  const stats = useMemo(
    () => statistichePrenotazioni(risorse, prenotazioni, adesso),
    [adesso, prenotazioni, risorse],
  );

  const spaziFiltrati = useMemo(() => {
    const q = ricercaSpazi.trim().toLowerCase();
    if (!q) return risorse;
    return risorse.filter((r) => r.nome.toLowerCase().includes(q));
  }, [ricercaSpazi, risorse]);

  const opzioniSpaziFiltro: readonly FilterOption[] = useMemo(
    () => risorse.map((r) => ({ value: r.id, label: r.nome })),
    [risorse],
  );

  const prenotazioniFiltrate = useMemo(() => {
    const stato: FiltroStatoPrenotazione =
      statoFiltro[0] === 'in-programma' || statoFiltro[0] === 'passate' ? statoFiltro[0] : 'tutte';
    return filtraPrenotazioni(
      prenotazioni,
      {
        risorsaId: spazioFiltro[0],
        stato,
        ricerca: ricercaPrenotazioni,
      },
      adesso,
    );
  }, [adesso, prenotazioni, ricercaPrenotazioni, spazioFiltro, statoFiltro]);

  const apriNuovoSpazio = useCallback(() => {
    setSpazioInModifica(null);
    setNomeInput('');
    setTariffaInput('0');
    setMaxOreInput('');
    setErroriForm({});
    setErroreSalvataggio(null);
    setModaleSpazioAperta(true);
  }, []);

  const apriModificaSpazio = useCallback((risorsa: IRisorsaPrenotabile) => {
    setSpazioInModifica(risorsa);
    setNomeInput(risorsa.nome);
    setTariffaInput(String(risorsa.tariffa_oraria));
    setMaxOreInput(risorsa.max_ore !== null ? String(risorsa.max_ore) : '');
    setErroriForm({});
    setErroreSalvataggio(null);
    setModaleSpazioAperta(true);
  }, []);

  const chiudiModaleSpazio = useCallback(() => {
    if (salvataggioInCorso) return;
    setModaleSpazioAperta(false);
  }, [salvataggioInCorso]);

  const salvaSpazio = useCallback(async () => {
    setErroreSalvataggio(null);
    const validazione = validaRisorsaPrenotabile({
      nome: nomeInput,
      tariffa_oraria: tariffaInput,
      max_ore: maxOreInput,
    });
    if (!validazione.ok) {
      setErroriForm(validazione.errori);
      return;
    }

    setErroriForm({});
    setSalvataggioInCorso(true);
    try {
      if (spazioInModifica) {
        const aggiornata = await services.prenotazioni.aggiornaRisorsa(
          spazioInModifica.id,
          condominioId,
          validazione.dati,
        );
        setRisorse((prev) =>
          prev
            .map((r) => (r.id === aggiornata.id ? aggiornata : r))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
        );
        toast.show({
          tone: 'success',
          title: 'Spazio aggiornato',
          message: `${aggiornata.nome} aggiornato con successo.`,
        });
      } else {
        const creata = await services.prenotazioni.creaRisorsa(condominioId, validazione.dati);
        setRisorse((prev) => [...prev, creata].sort((a, b) => a.nome.localeCompare(b.nome, 'it')));
        toast.show({
          tone: 'success',
          title: 'Spazio creato',
          message: `${creata.nome} aggiunto agli spazi prenotabili.`,
        });
      }
      setModaleSpazioAperta(false);
    } catch (err) {
      setErroreSalvataggio(traduciErrorePrenotazione(err, 'Errore durante il salvataggio dello spazio.'));
    } finally {
      setSalvataggioInCorso(false);
    }
  }, [condominioId, maxOreInput, nomeInput, spazioInModifica, tariffaInput, toast]);

  const confermaEliminazioneSpazio = useCallback(async () => {
    if (!spazioDaEliminare) return;
    const target = spazioDaEliminare;
    await services.prenotazioni.eliminaRisorsa(target.id, condominioId);
    setRisorse((prev) => prev.filter((r) => r.id !== target.id));
    setPrenotazioni((prev) => prev.filter((p) => p.risorsa_id !== target.id));
    setSpazioDaEliminare(null);
    toast.show({
      tone: 'success',
      title: 'Spazio eliminato',
      message: `${target.nome} e le relative prenotazioni sono stati rimossi.`,
    });
  }, [condominioId, spazioDaEliminare, toast]);

  const confermaAnnullamentoPrenotazione = useCallback(async () => {
    if (!prenotazioneDaAnnullare) return;
    const target = prenotazioneDaAnnullare;
    await services.prenotazioni.annullaPrenotazione(target.id);
    setPrenotazioni((prev) => prev.filter((p) => p.id !== target.id));
    setPrenotazioneDaAnnullare(null);
    toast.show({
      tone: 'success',
      title: 'Prenotazione annullata',
      message: `La prenotazione di ${target.utente_nome ?? 'un condòmino'} per ${target.risorsa_nome} è stata annullata.`,
    });
  }, [prenotazioneDaAnnullare, toast]);

  const colonneSpazi: readonly DataColumn<IRisorsaPrenotabile>[] = useMemo(
    () => [
      {
        key: 'nome',
        header: 'Nome spazio',
        weight: 1.8,
        minWidth: 180,
        mobile: 'title',
        cell: (r) => (
          <Text style={[textStyle('h4', breakpoint), styles.testoPrimario]}>{r.nome}</Text>
        ),
      },
      {
        key: 'tariffa',
        header: 'Tariffa oraria',
        weight: 1.2,
        minWidth: 130,
        mobile: 'status',
        cell: (r) => (
          <Badge
            status={r.tariffa_oraria > 0 ? 'info' : 'success'}
            label={formattaTariffaOraria(r.tariffa_oraria)}
          />
        ),
      },
      {
        key: 'max_ore',
        header: 'Durata massima',
        weight: 1.2,
        minWidth: 130,
        cell: (r) => (
          <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
            {r.max_ore !== null
              ? `${r.max_ore} ${r.max_ore === 1 ? 'ora' : 'ore'}`
              : 'Nessun limite'}
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
              onPress={() => apriModificaSpazio(r)}
              accessibilityHint={`Modifica lo spazio ${r.nome}`}
            />
            <Button
              label="Elimina"
              variant="destructive"
              icon="trash-2"
              onPress={() => setSpazioDaEliminare(r)}
              accessibilityHint={`Elimina lo spazio ${r.nome}`}
            />
          </View>
        ),
      },
    ],
    [apriModificaSpazio, breakpoint],
  );

  const colonneCalendario: readonly DataColumn<PrenotazioneConDettagli>[] = useMemo(
    () => [
      {
        key: 'spazio',
        header: 'Spazio',
        weight: 1.3,
        minWidth: 150,
        mobile: 'title',
        cell: (p) => (
          <Text style={[textStyle('h4', breakpoint), styles.testoPrimario]}>{p.risorsa_nome}</Text>
        ),
      },
      {
        key: 'utente',
        header: 'Condòmino / Utente',
        weight: 1.4,
        minWidth: 160,
        cell: (p) => (
          <Text style={[textStyle('secondary', breakpoint), styles.testoPrimario]}>
            {p.utente_nome ?? p.utente_email ?? 'Residente'}
          </Text>
        ),
      },
      {
        key: 'orario',
        header: 'Data e orario',
        weight: 1.7,
        minWidth: 190,
        cell: (p) => (
          <Text style={[textStyle('secondary', breakpoint), styles.testoSecondario]}>
            {formattaIntervalloPrenotazione(p.data_inizio, p.data_fine)}
          </Text>
        ),
      },
      {
        key: 'costo',
        header: 'Costo addebitato',
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
        cell: (p) => (
          <Button
            label="Annulla"
            variant="destructive"
            icon="trash-2"
            onPress={() => setPrenotazioneDaAnnullare(p)}
            accessibilityHint={`Annulla la prenotazione di ${p.risorsa_nome}`}
          />
        ),
      },
    ],
    [adesso, breakpoint],
  );

  const tabs: readonly TabItem[] = useMemo(
    () => [
      {
        key: 'spazi',
        label: 'Spazi configurati',
        icon: 'building-2',
        content: (
          <Card>
            <View style={styles.controlli}>
              <SearchBar
                value={ricercaSpazi}
                onChangeText={setRicercaSpazi}
                label="Cerca spazio comune"
                placeholder="Cerca per nome spazio (es. tennis, piscina, sala)…"
              />
            </View>
            <ResponsiveDataView
              label="Spazi comuni configurati"
              rows={spaziFiltrati}
              columns={colonneSpazi}
              getRowKey={(r) => r.id}
              getRowLabel={(r) => r.nome}
              empty={{
                icon: 'building-2',
                title: 'Nessuno spazio configurato',
                description: "Aggiungi il primo spazio comune prenotabile con il pulsante 'Nuovo spazio'.",
              }}
            />
          </Card>
        ),
      },
      {
        key: 'calendario',
        label: 'Calendario prenotazioni',
        icon: 'calendar-days',
        content: (
          <Card>
            <View style={styles.controlli}>
              <SearchBar
                value={ricercaPrenotazioni}
                onChangeText={setRicercaPrenotazioni}
                label="Cerca nelle prenotazioni"
                placeholder="Cerca per spazio o nominativo condòmino…"
              />
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
              label="Calendario prenotazioni del condominio"
              rows={prenotazioniFiltrate}
              columns={colonneCalendario}
              getRowKey={(p) => p.id}
              getRowLabel={(p) => `${p.risorsa_nome} · ${p.utente_nome ?? p.utente_email ?? 'Residente'}`}
              empty={{
                icon: 'calendar-days',
                title: 'Nessuna prenotazione trovata',
                description: 'Non risultano prenotazioni per i filtri selezionati.',
              }}
            />
          </Card>
        ),
      },
    ],
    [
      colonneCalendario,
      colonneSpazi,
      opzioniSpaziFiltro,
      prenotazioniFiltrate,
      ricercaPrenotazioni,
      ricercaSpazi,
      spaziFiltrati,
      spazioFiltro,
      statoFiltro,
    ],
  );

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Spazi comuni e Prenotazioni"
        subtitle={`Configurazione spazi prenotabili e supervisione prenotazioni — ${condominioNome}`}
        breadcrumbs={[
          { label: 'Home', onPress: () => router.push('/admin/dashboard') },
          { label: 'Amministrazione' },
          { label: 'Spazi comuni' },
        ]}
        action={{
          label: 'Nuovo spazio',
          icon: 'calendar-plus',
          onPress: apriNuovoSpazio,
        }}
      />

      {caricamento ? <LoadingState message="Caricamento spazi e prenotazioni…" /> : null}

      {errore ? <ErrorState onRetry={caricaDati} /> : null}

      {!caricamento && !errore ? (
        <View style={styles.contenuto}>
          {/* 3 StatCard ufficiali */}
          <View style={[styles.grigliaStat, isMobile && styles.grigliaStatMobile]}>
            <View style={styles.cellaStat}>
              <StatCard
                icon="building-2"
                tile="blue"
                title="Spazi configurati"
                value={String(stats.totaleSpazi)}
                description="Risorse prenotabili nel condominio"
              />
            </View>
            <View style={styles.cellaStat}>
              <StatCard
                icon="calendar-days"
                tile="teal"
                title="Prenotazioni attive"
                value={String(stats.prenotazioniAttive)}
                description="Prenotazioni in programma"
              />
            </View>
            <View style={styles.cellaStat}>
              <StatCard
                icon="coins"
                tile="navy"
                title="A pagamento / gratuiti"
                value={`${stats.spaziAPagamento} / ${stats.spaziGratuiti}`}
                description="Distribuzione tariffe orarie"
              />
            </View>
          </View>

          <Tabs
            label="Sezioni gestione spazi comuni"
            tabs={tabs}
            value={schedaAttiva}
            onChange={(k) => setSchedaAttiva(k === 'calendario' ? 'calendario' : 'spazi')}
          />
        </View>
      ) : null}

      {/* Modale accessibile: Nuovo / Modifica spazio comune */}
      <Modal
        visible={modaleSpazioAperta}
        onClose={chiudiModaleSpazio}
        title={spazioInModifica ? 'Modifica spazio comune' : 'Nuovo spazio comune'}
        description="Imposta nome, tariffa oraria (0 per gratuito) ed eventuale durata massima."
        initialFocusRef={nomeInputRef}
        dismissible={!salvataggioInCorso}
        actions={
          <ModalActions>
            <Button
              label="Annulla"
              variant="secondary"
              onPress={chiudiModaleSpazio}
              disabled={salvataggioInCorso}
            />
            <Button
              label={
                salvataggioInCorso
                  ? 'Salvataggio…'
                  : spazioInModifica
                    ? 'Salva modifiche'
                    : 'Crea spazio'
              }
              variant="primary"
              icon="check"
              onPress={salvaSpazio}
              loading={salvataggioInCorso}
              disabled={salvataggioInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreSalvataggio ? (
            <Alert tone="error" title="Salvataggio non riuscito" message={erroreSalvataggio} />
          ) : null}

          <Input
            inputRef={nomeInputRef}
            label="Nome spazio"
            required
            placeholder="Es. Campo da tennis, Piscina, Parcheggio ospiti"
            value={nomeInput}
            onChangeText={(t) => {
              setNomeInput(t);
              setErroriForm((prev) => ({ ...prev, nome: undefined }));
            }}
            error={erroriForm.nome}
            disabled={salvataggioInCorso}
          />

          <Input
            label="Tariffa oraria (€)"
            required
            placeholder="0 (gratuito) oppure es. 12,50"
            helperText="Inserisci 0 per rendere lo spazio gratuito."
            keyboardType="decimal-pad"
            value={tariffaInput}
            onChangeText={(t) => {
              setTariffaInput(t);
              setErroriForm((prev) => ({ ...prev, tariffa_oraria: undefined }));
            }}
            error={erroriForm.tariffa_oraria}
            disabled={salvataggioInCorso}
          />

          <Input
            label="Durata massima (ore)"
            placeholder="Lascia vuoto se senza limite"
            helperText="Numero intero di ore consentite per singola prenotazione."
            keyboardType="number-pad"
            value={maxOreInput}
            onChangeText={(t) => {
              setMaxOreInput(t);
              setErroriForm((prev) => ({ ...prev, max_ore: undefined }));
            }}
            error={erroriForm.max_ore}
            disabled={salvataggioInCorso}
          />
        </View>
      </Modal>

      <ConfirmDialog
        visible={spazioDaEliminare !== null}
        title="Eliminare lo spazio comune?"
        description={
          spazioDaEliminare
            ? `Eliminando "${spazioDaEliminare.nome}" verranno eliminate automaticamente anche tutte le prenotazioni collegate a questo spazio. L'operazione non è reversibile.`
            : ''
        }
        confirmLabel="Elimina spazio"
        confirmLoadingLabel="Eliminazione…"
        destructive
        onConfirm={confermaEliminazioneSpazio}
        onCancel={() => setSpazioDaEliminare(null)}
      />

      <ConfirmDialog
        visible={prenotazioneDaAnnullare !== null}
        title="Annullare la prenotazione?"
        description={
          prenotazioneDaAnnullare
            ? `Stai per annullare la prenotazione di ${
                prenotazioneDaAnnullare.utente_nome ?? 'un condòmino'
              } per ${prenotazioneDaAnnullare.risorsa_nome} (${formattaIntervalloPrenotazione(
                prenotazioneDaAnnullare.data_inizio,
                prenotazioneDaAnnullare.data_fine,
              )}).`
            : ''
        }
        confirmLabel="Annulla prenotazione"
        confirmLoadingLabel="Annullamento…"
        destructive
        onConfirm={confermaAnnullamentoPrenotazione}
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
  grigliaStat: {
    flexDirection: 'row',
    gap: space[4],
  },
  grigliaStatMobile: {
    flexDirection: 'column',
  },
  cellaStat: {
    flex: 1,
  },
  controlli: {
    gap: space[3],
    marginBottom: space[4],
  },
  azioniRiga: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  formModale: {
    gap: space[4],
  },
  testoPrimario: {
    color: colors.text.primary,
  },
  testoSecondario: {
    color: colors.text.secondary,
  },
});
