import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  FilterChips,
  Icon,
  Input,
  LoadingState,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  RadioGroup,
  ResponsiveDataView,
  SearchBar,
  Select,
  StatCard,
  borderWidths,
  colors,
  focusRing,
  radii,
  space,
  textStyle,
  useBreakpoint,
  useToast,
  type DataColumn,
  type FilterOption,
  type RadioOption,
  type SelectOption,
} from '@iocondo/ui';
import {
  badgeStatoAssembleaAdmin,
  filtraAssembleeAdmin,
  riepilogoAssembleeAdmin,
  validaNuovaAssemblea,
  type AssembleaAdminView,
  type FiltriAssembleeAdmin,
  type ModalitaAssembleaAdmin,
  type StatoAssembleaAdmin,
  type TipoAssembleaAdmin,
} from '@iocondo/data';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const FILTRI_STATO_OPTIONS: readonly FilterOption[] = [
  { value: 'convocate', label: 'Convocate' },
  { value: 'in_corso', label: 'In corso' },
  { value: 'concluse', label: 'Concluse' },
  { value: 'bozze', label: 'Bozze' },
];

const OPZIONI_TIPO_RADIO: readonly RadioOption[] = [
  {
    value: 'ORDINARIA',
    label: 'Assemblea Ordinaria',
    helperText: 'Approvazione bilancio consuntivo, preventivo e nomina amministratore.',
  },
  {
    value: 'STRAORDINARIA',
    label: 'Assemblea Straordinaria',
    helperText: 'Lavori straordinari, innovazioni, delibere urgenti.',
  },
];

export function AdminAssembleeScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Assemblee del Condominio"
          subtitle="Convocazione, gestione presenze, votazioni nominali e verbali approvati."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminAssembleeContenuto />;
}

function AdminAssembleeContenuto() {
  const router = useRouter();
  const { condominio } = useProfilo();
  const toast = useToast();
  const { isMobile } = useBreakpoint();

  const [assemblee, setAssemblee] = useState<AssembleaAdminView[]>([]);
  const [tabelleMillesimali, setTabelleMillesimali] = useState<{ id: string; nome: string }[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  // Filtri barra di controllo
  const [filtriStatoVal, setFiltriStatoVal] = useState<readonly string[]>([]);
  const filtroStato = (filtriStatoVal[0] as FiltriAssembleeAdmin['stato']) || 'tutte';
  const [filtroRicerca, setFiltroRicerca] = useState('');

  // Modale Nuova Assemblea
  const [modaleNuovaAperta, setModaleNuovaAperta] = useState(false);
  const [tipoScelto, setTipoScelto] = useState<TipoAssembleaAdmin>('ORDINARIA');
  const [modalitaScelta, setModalitaScelta] = useState<ModalitaAssembleaAdmin>('IBRIDA');
  const [dataPrimaConv, setDataPrimaConv] = useState('');
  const [dataSecondaConv, setDataSecondaConv] = useState('');
  const [luogoInput, setLuogoInput] = useState('Sala Condominiale');
  const [linkMeetInput, setLinkMeetInput] = useState('https://meet.google.com/');
  const [tabellaSelezionataId, setTabellaSelezionataId] = useState('');
  const [salvaComeBozza, setSalvaComeBozza] = useState(false);
  const [erroriForm, setErroriForm] = useState<Record<string, string>>({});
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  // Focus ring refs
  const primaConvInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Caricamento dati
  const caricaDati = useCallback(async () => {
    if (!condominio?.id) return;
    setCaricamento(true);
    setErrore(false);

    try {
      const [lista, tabRes] = await Promise.all([
        services.assembleeAdmin.listAssembleeAdmin(condominio.id),
        services.assembleeAdmin.listTabelleMillesimali(condominio.id),
      ]);
      setAssemblee(lista);
      setTabelleMillesimali(
        (tabRes || []).map((t: { id: string; nome: string }) => ({ id: t.id, nome: t.nome })),
      );
      if (tabRes && tabRes.length > 0 && !tabellaSelezionataId) {
        setTabellaSelezionataId(tabRes[0]?.id || '');
      }
    } catch {
      setErrore(true);
      toast.show({ tone: 'error', message: 'Errore durante il caricamento delle assemblee.' });
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id, tabellaSelezionataId, toast]);

  useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  // StatCard riepilogative
  const stats = useMemo(() => riepilogoAssembleeAdmin(assemblee), [assemblee]);

  // Assemblee filtrate
  const assembleeFiltrate = useMemo(
    () =>
      filtraAssembleeAdmin(assemblee, {
        stato: filtroStato,
        ricerca: filtroRicerca,
      }),
    [assemblee, filtroStato, filtroRicerca],
  );

  // Opzioni tabelle per Select
  const opzioniTabelle: SelectOption[] = useMemo(
    () =>
      tabelleMillesimali.map((t) => ({
        value: t.id,
        label: t.nome,
      })),
    [tabelleMillesimali],
  );

  // Reset e apertura modale
  const apriModaleNuova = () => {
    setTipoScelto('ORDINARIA');
    setModalitaScelta('PRESENZA');

    // Preimposta date di default (domani ore 08:00 prima conv, dopodomani ore 18:30 seconda conv)
    const d1 = new Date(Date.now() + 24 * 3600 * 1000);
    const d2 = new Date(Date.now() + 48 * 3600 * 1000);
    const d1Str = `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, '0')}-${String(d1.getDate()).padStart(2, '0')}T08:00`;
    const d2Str = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}T18:30`;

    setDataPrimaConv(d1Str);
    setDataSecondaConv(d2Str);
    setLuogoInput(condominio ? `Sala riunioni c/o ${condominio.nome}` : 'Sala Condominiale');
    setLinkMeetInput('');
    setSalvaComeBozza(false);
    setErroriForm({});
    setModaleNuovaAperta(true);
  };

  // Creazione assemblea
  const handleCreaAssemblea = async () => {
    const validazione = validaNuovaAssemblea({
      tipo: tipoScelto,
      dataPrimaConvocazione: dataPrimaConv,
      dataSecondaConvocazione: dataSecondaConv,
      modalita: 'PRESENZA',
      luogo: luogoInput,
    });

    if (!validazione.valido) {
      setErroriForm(validazione.errori);
      return;
    }

    if (!condominio?.id) return;
    setSalvataggioInCorso(true);

    try {
      // Formatta la nota del luogo con gli orari di 1ª e 2ª convocazione
      const d1Formatted = dataPrimaConv.replace('T', ' ore ');
      const d2Formatted = dataSecondaConv.replace('T', ' ore ');
      const luogoDettagliato = `1ª conv.: ${d1Formatted} - 2ª conv.: ${d2Formatted}. Luogo: ${luogoInput.trim()}`;

      // La data principale dell'assemblea corrisponde alla seconda convocazione (data effettiva della seduta)
      const dataIso = new Date(dataSecondaConv).toISOString();

      const res = await services.assembleeAdmin.creaAssemblea({
        condominioId: condominio.id,
        tipo: tipoScelto,
        modalita: 'PRESENZA',
        data: dataIso,
        dataPrimaConvocazione: dataPrimaConv,
        dataSecondaConvocazione: dataSecondaConv,
        luogo: luogoDettagliato,
        linkMeet: null,
        tabellaMillesimaleId: tabellaSelezionataId || null,
        stato: salvaComeBozza ? 'BOZZA' : 'CONVOCATA',
      });

      if (!res.ok || !res.id) {
        throw new Error(res.errore || 'Errore durante la creazione.');
      }

      toast.show({
        tone: 'success',
        message: salvaComeBozza ? 'Bozza assemblea salvata.' : 'Assemblea convocata con successo!',
      });
      setModaleNuovaAperta(false);
      void caricaDati();

      // Naviga direttamente alla schermata di dettaglio e conduzione
      router.push(`/admin/assemblee/${res.id}` as Href);
    } catch (err: any) {
      toast.show({
        tone: 'error',
        message: err.message || 'Errore nella creazione dell’assemblea.',
      });
    } finally {
      setSalvataggioInCorso(false);
    }
  };

  // Navigazione a dettaglio assemblea
  const vaiADettaglio = (id: string) => {
    router.push(`/admin/assemblee/${id}` as Href);
  };

  // Colonne per ResponsiveDataView
  const colonne: readonly DataColumn<AssembleaAdminView>[] = useMemo(
    () => [
      {
        key: 'data',
        header: 'Data Convocazione',
        cell: (a) => {
          const d = new Date(a.data);
          const dataFmt = isNaN(d.getTime())
            ? a.data
            : d.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

          return (
            <View style={styles.cellaData}>
              <Text style={styles.testoData}>{dataFmt}</Text>
            </View>
          );
        },
        mobile: 'title',
        weight: 3,
        minWidth: 180,
      },
      {
        key: 'tipo',
        header: 'Tipo',
        cell: (a) => (
          <Text style={styles.testoNormale}>
            {a.tipo === 'STRAORDINARIA' ? 'Straordinaria' : 'Ordinaria'}
          </Text>
        ),
        weight: 2,
        minWidth: 120,
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (a) => {
          const st = badgeStatoAssembleaAdmin(a.stato);
          return <Badge status={st.status} label={st.label} />;
        },
        mobile: 'status',
        weight: 2,
        minWidth: 120,
      },
      {
        key: 'puntiOdg',
        header: 'Punti ODG',
        cell: (a) => {
          const numPunti = a.totalePuntiOdg || 0;
          const aperte = a.votazioniAperte || 0;
          return (
            <View style={styles.cellaOdg}>
              <Text style={styles.testoNormale}>
                {numPunti === 1 ? '1 punto ODG' : `${numPunti} punti ODG`}
              </Text>
              {aperte > 0 && (
                <Badge
                  status="warning"
                  label={`${aperte} ${aperte === 1 ? 'voto aperto' : 'voti aperti'}`}
                />
              )}
            </View>
          );
        },
        weight: 2,
        minWidth: 150,
      },
    ],
    [],
  );

  return (
    <View style={styles.pagina}>
      {/* 1. PageHeader ufficiale con pulsante primario "Convoca nuova assemblea" */}
      <PageHeader
        title="Assemblee del Condominio"
        subtitle={
          condominio
            ? `Convocazione, gestione presenze, votazioni nominali e verbali approvati per ${condominio.nome}.`
            : 'Convocazione, gestione presenze, votazioni nominali e verbali approvati.'
        }
        action={{
          label: 'Convoca nuova assemblea',
          icon: 'calendar-plus',
          onPress: apriModaleNuova,
        }}
      />

      {/* 2. Tre StatCard ufficiali (Sez. 8 Design System) */}
      <View style={styles.grigliaStat}>
        <View style={styles.statCol}>
          <StatCard
            tile="blue"
            icon="calendar-days"
            title="Prossima assemblea"
            value={
              stats.prossimaAssemblea
                ? new Date(stats.prossimaAssemblea.data).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                  })
                : 'Nessuna'
            }
            description={
              stats.prossimaAssemblea
                ? `${stats.prossimaAssemblea.tipo === 'STRAORDINARIA' ? 'Straordinaria' : 'Ordinaria'} (in presenza)`
                : 'Nessuna riunione programmata'
            }
          />
        </View>

        <View style={styles.statCol}>
          <StatCard
            tile="navy"
            icon="users"
            title="Assemblee dell'anno"
            value={String(stats.totaleAnno)}
            description={`${stats.totaleConcluse} concluse, ${stats.totaleBozze} in bozza`}
          />
        </View>

        <View style={styles.statCol}>
          <StatCard
            tile="teal"
            icon="check-square"
            title="Votazioni aperte"
            value={String(stats.votazioniAperte)}
            description={
              stats.votazioniAperte > 0
                ? 'Punti ODG in fase di voto attivo'
                : 'Nessuna votazione attiva ora'
            }
          />
        </View>
      </View>

      {/* 3. Barra di controllo e Visualizzazione dati */}
      <Card style={styles.cardTabella}>
        <View style={styles.barraControllo}>
          <SearchBar
            value={filtroRicerca}
            onChangeText={setFiltroRicerca}
            placeholder="Cerca per tipo, luogo, ordine del giorno..."
            label="Cerca tra le assemblee"
          />

          <FilterChips
            options={FILTRI_STATO_OPTIONS}
            value={filtriStatoVal}
            onChange={setFiltriStatoVal}
            label="Filtra per stato"
          />
        </View>

        {caricamento ? (
          <LoadingState message="Caricamento registro assemblee in corso..." />
        ) : errore ? (
          <View style={styles.statoVuoto}>
            <Text style={styles.testoErrore}>
              Si è verificato un errore durante il caricamento delle assemblee.
            </Text>
            <Button variant="secondary" label="Riprova" icon="refresh-cw" onPress={caricaDati} />
          </View>
        ) : (
          <ResponsiveDataView<AssembleaAdminView>
            label="Elenco delle assemblee del condominio"
            columns={colonne}
            rows={assembleeFiltrate}
            getRowKey={(a) => a.id}
            getRowLabel={(a) =>
              `${a.tipo === 'STRAORDINARIA' ? 'Assemblea Straordinaria' : 'Assemblea Ordinaria'} del ${a.data}`
            }
            onRowPress={(a) => vaiADettaglio(a.id)}
            empty={{
              title: 'Nessuna assemblea trovata',
              description:
                filtroRicerca || filtroStato !== 'tutte'
                  ? 'Nessun risultato corrisponde ai filtri selezionati.'
                  : 'Non ci sono ancora assemblee registrate in questo condominio. Usa il pulsante in alto per convocare la prima seduta.',
            }}
          />
        )}
      </Card>

      {/* 4. Modale Accessibile "Nuova Assemblea" */}
      <Modal
        visible={modaleNuovaAperta}
        onClose={() => setModaleNuovaAperta(false)}
        title="Convoca nuova assemblea"
      >
        <View style={styles.formModale}>
          <RadioGroup
            label="Tipologia assemblea"
            options={OPZIONI_TIPO_RADIO}
            value={tipoScelto}
            onChange={(val) => setTipoScelto(val as TipoAssembleaAdmin)}
          />

          <View style={styles.rigaDoppia}>
            <View style={styles.colInput}>
              <Input
                inputRef={primaConvInputRef}
                label="Data e ora 1ª Convocazione"
                value={dataPrimaConv}
                onChangeText={setDataPrimaConv}
                placeholder="AAAA-MM-GGTHH:mm"
                helperText="Es. 2026-11-20T08:00 (spesso deserta)"
                error={erroriForm.dataPrimaConvocazione}
              />
            </View>

            <View style={styles.colInput}>
              <Input
                label="Data e ora 2ª Convocazione"
                value={dataSecondaConv}
                onChangeText={setDataSecondaConv}
                placeholder="AAAA-MM-GGTHH:mm"
                helperText="Es. 2026-11-21T18:30 (seduta effettiva)"
                error={erroriForm.dataSecondaConvocazione}
              />
            </View>
          </View>

          <Input
            label="Luogo di svolgimento (in presenza) *"
            value={luogoInput}
            onChangeText={setLuogoInput}
            placeholder="Es. Sala Condominiale, Studio Amministratore..."
            error={erroriForm.luogo}
          />

          {opzioniTabelle.length > 0 && (
            <Select
              label="Tabella millesimale di riferimento"
              options={opzioniTabelle}
              value={tabellaSelezionataId}
              onChange={setTabellaSelezionataId}
              helperText="Utilizzata per il calcolo automatico del quorum costitutivo e deliberativo."
            />
          )}

          <Pressable
            role="checkbox"
            aria-checked={salvaComeBozza}
            onPress={() => setSalvaComeBozza(!salvaComeBozza)}
            style={({ pressed }) => [
              styles.checkboxRiga,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={[styles.checkboxBox, salvaComeBozza && styles.checkboxAttivo]}>
              {salvaComeBozza && <Icon name="check" size="indicator" color="#FFFFFF" />}
            </View>
            <View style={styles.checkboxTestoContainer}>
              <Text style={styles.checkboxLabel}>Salva come bozza</Text>
              <Text style={styles.checkboxDesc}>
                La convocazione non sarà visibile ai residenti finché non verrà pubblicata.
              </Text>
            </View>
          </Pressable>

          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleNuovaAperta(false)}
              disabled={salvataggioInCorso}
            />
            <Button
              variant="primary"
              label={salvaComeBozza ? 'Salva bozza' : 'Conferma e convoca'}
              icon={salvaComeBozza ? 'file-text' : 'calendar-plus'}
              onPress={handleCreaAssemblea}
              loading={salvataggioInCorso}
            />
          </ModalActions>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    gap: space[6],
    width: '100%',
  },
  grigliaStat: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  statCol: {
    flex: 1,
    minWidth: 260,
  },
  cardTabella: {
    gap: space[4],
    padding: space[4],
  },
  barraControllo: {
    gap: space[4],
  },
  cellaData: {
    gap: 2,
  },
  testoData: {
    ...textStyle('body'),
    fontWeight: '600',
    color: colors.text.primary,
  },
  testoLuogoBreve: {
    ...textStyle('secondary'),
    color: colors.text.muted,
  },
  testoNormale: {
    ...textStyle('body'),
    color: colors.text.primary,
  },
  badgeModalita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  testoModalita: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
    fontWeight: '500',
  },
  cellaOdg: {
    gap: space[1],
  },
  statoVuoto: {
    padding: space[8],
    alignItems: 'center',
    gap: space[4],
  },
  testoErrore: {
    ...textStyle('body'),
    color: colors.semantic.error.foreground,
    textAlign: 'center',
  },
  formModale: {
    gap: space[4],
    paddingBottom: space[2],
  },
  rigaDoppia: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  colInput: {
    flex: 1,
    minWidth: 220,
  },
  checkboxRiga: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingVertical: space[2],
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: radii.badge,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxAttivo: {
    backgroundColor: colors.action.default,
    borderColor: colors.action.default,
  },
  checkboxTestoContainer: {
    flex: 1,
    gap: 2,
  },
  checkboxLabel: {
    ...textStyle('body'),
    fontWeight: '600',
    color: colors.text.primary,
  },
  checkboxDesc: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
});
