import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  badgeStatoPacco,
  calcolaStatistichePacchi,
  filtraPacchi,
  formattaDataOraPacco,
  formattaDataPacco,
  ordinaPacchi,
  paginaPacchi,
  validaNuovoPacco,
  validaRegistrazioneRitiro,
  type ColonnaOrdinamentoPacchi,
  type DirezioneOrdinamentoPacchi,
  type FiltroStatoPacchi,
  type Pacco,
  type UnitaCondominioOpzione,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  FilterChips,
  Input,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  Pagination,
  ResponsiveDataView,
  SearchBar,
  Select,
  StatCard,
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
  type SortState,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

const ERRORE_CARICAMENTO = 'Non è stato possibile caricare il registro pacchi.';

export function PacchiScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  const isPortiere = ruoli.has('PORTIERE');
  const isAdmin = ruoli.has('ADMIN') || Boolean(profilo.isSuperAdmin);
  const isCondomino = ruoli.has('CONDOMINO');

  // Se l'utente non ha ruoli residenti nel condominio, mostra NonAutorizzato
  if (!isPortiere && !isAdmin && !isCondomino) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Registro pacchi" subtitle="Registro dei pacchi in portineria." />
        <NonAutorizzato />
      </View>
    );
  }

  return (
    <PacchiContenuto
      isPortiereOAdmin={isPortiere || isAdmin}
    />
  );
}

interface PacchiContenutoProps {
  isPortiereOAdmin: boolean;
}

function PacchiContenuto({ isPortiereOAdmin }: PacchiContenutoProps) {
  const { profilo, condominio, ruoli } = useProfilo();
  const toast = useToast();
  const { isMobile } = useBreakpoint();

  const utenteId = profilo!.id;
  const condominioId = condominio!.id;
  const chiave = `${utenteId}|${condominioId}|${isPortiereOAdmin ? 'gestore' : 'condomino'}`;

  // Caricamento elenco pacchi
  const { blocco, ricarica } = useBlocco(
    () =>
      services.pacchi.elencoPacchi(condominioId, utenteId, {
        ruoli,
        isPortiereOAdmin,
      }),
    chiave,
  );

  // Ricarica con focus o riattivazione app
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

  // Filtri, ricerca e ordinamento
  const [filtroStato, setFiltroStato] = useState<FiltroStatoPacchi>('tutti');
  const [ricerca, setRicerca] = useState('');
  const [colonnaSort, setColonnaSort] = useState<ColonnaOrdinamentoPacchi>('data_arrivo');
  const [direzioneSort, setDirezioneSort] = useState<DirezioneOrdinamentoPacchi>('desc');
  const [pagina, setPagina] = useState(1);

  // Modale inserimento nuovo pacco (solo portiere/admin)
  const [modaleNuovoAperta, setModaleNuovoAperta] = useState(false);
  const [unitaSelezionataId, setUnitaSelezionataId] = useState('');
  const [invioNuovoInCorso, setInvioNuovoInCorso] = useState(false);
  const [erroreNuovo, setErroreNuovo] = useState<string | null>(null);

  // Elenco unità per il dropdown
  const [opzioniUnita, setOpzioniUnita] = useState<UnitaCondominioOpzione[]>([]);
  const [caricamentoUnita, setCaricamentoUnita] = useState(false);

  // Modale conferma ritiro con firma (solo portiere/admin)
  const [paccoDaRitirare, setPaccoDaRitirare] = useState<Pacco | null>(null);
  const [firmaInput, setFirmaInput] = useState('');
  const [invioRitiroInCorso, setInvioRitiroInCorso] = useState(false);
  const [erroreRitiro, setErroreRitiro] = useState<string | null>(null);

  useEffect(() => {
    setFiltroStato('tutti');
    setRicerca('');
    setColonnaSort('data_arrivo');
    setDirezioneSort('desc');
    setPagina(1);
  }, [chiave]);

  const pronto = blocco.stato === 'pronto';
  const caricamento = blocco.stato === 'caricamento';
  const errore = blocco.stato === 'errore';

  const tuttiPacchi: readonly Pacco[] = useMemo(
    () => (blocco.stato === 'pronto' ? blocco.dati : []),
    [blocco],
  );

  const statistiche = useMemo(() => calcolaStatistichePacchi(tuttiPacchi), [tuttiPacchi]);

  // Caricamento opzioni unità quando si apre la modale di inserimento
  const apriModaleNuovoPacco = useCallback(async () => {
    setErroreNuovo(null);
    setUnitaSelezionataId('');
    setModaleNuovoAperta(true);

    if (opzioniUnita.length === 0) {
      setCaricamentoUnita(true);
      try {
        const unita = await services.pacchi.elencoUnitaCondominio(condominioId);
        setOpzioniUnita(unita);
      } catch {
        setErroreNuovo('Impossibile caricare le unità del condominio.');
      } finally {
        setCaricamentoUnita(false);
      }
    }
  }, [condominioId, opzioniUnita.length]);

  const chiudiModaleNuovoPacco = useCallback(() => {
    if (invioNuovoInCorso) return;
    setModaleNuovoAperta(false);
    setErroreNuovo(null);
  }, [invioNuovoInCorso]);

  const eseguiRegistraNuovoPacco = useCallback(async () => {
    const validazione = validaNuovoPacco({
      unitaId: unitaSelezionataId,
    });

    if (!validazione.valido) {
      setErroreNuovo(validazione.errori.unitaId || 'Dati non validi.');
      return;
    }

    setInvioNuovoInCorso(true);
    setErroreNuovo(null);

    try {
      const res = await services.pacchi.registraNuovoPacco({
        condominioId,
        unitaId: unitaSelezionataId,
      });

      if (!res.ok) {
        setErroreNuovo(res.errori.unitaId || res.errori.form || 'Errore durante la registrazione.');
        return;
      }

      toast.show({
        message: 'Arrivo pacco registrato con successo.',
        tone: 'success',
      });
      setModaleNuovoAperta(false);
      ricarica();
    } catch {
      setErroreNuovo('Errore di connessione durante la registrazione del pacco.');
    } finally {
      setInvioNuovoInCorso(false);
    }
  }, [unitaSelezionataId, condominioId, toast, ricarica]);

  // Gestione modale ritiro
  const apriModaleRitiro = useCallback((pacco: Pacco) => {
    setPaccoDaRitirare(pacco);
    setFirmaInput('');
    setErroreRitiro(null);
  }, []);

  const chiudiModaleRitiro = useCallback(() => {
    if (invioRitiroInCorso) return;
    setPaccoDaRitirare(null);
    setErroreRitiro(null);
  }, [invioRitiroInCorso]);

  const eseguiConsegnaPacco = useCallback(async () => {
    if (!paccoDaRitirare) return;

    const validazione = validaRegistrazioneRitiro(firmaInput);
    if (!validazione.valido) {
      setErroreRitiro(validazione.errore || 'Inserisci una firma o nominativo valido.');
      return;
    }

    setInvioRitiroInCorso(true);
    setErroreRitiro(null);

    try {
      const res = await services.pacchi.segnaComeRitirato(paccoDaRitirare.id, firmaInput);
      if (!res.ok) {
        setErroreRitiro(res.errore || 'Errore durante la registrazione del ritiro.');
        return;
      }

      toast.show({
        message: 'Ritiro registrato con successo.',
        tone: 'success',
      });
      setPaccoDaRitirare(null);
      ricarica();
    } catch {
      setErroreRitiro('Errore di connessione durante la registrazione del ritiro.');
    } finally {
      setInvioRitiroInCorso(false);
    }
  }, [paccoDaRitirare, firmaInput, toast, ricarica]);

  // Filtro ed ordinamento
  const pacchiFiltrati = useMemo(() => {
    const filtrati = filtraPacchi(tuttiPacchi, { stato: filtroStato, ricerca });
    return ordinaPacchi(filtrati, colonnaSort, direzioneSort);
  }, [tuttiPacchi, filtroStato, ricerca, colonnaSort, direzioneSort]);

  const paginazione = useMemo(() => {
    return paginaPacchi(pacchiFiltrati, pagina);
  }, [pacchiFiltrati, pagina]);

  const filtriAttivi = filtroStato !== 'tutti' || ricerca.trim().length > 0;

  const azzeraFiltri = useCallback(() => {
    setFiltroStato('tutti');
    setRicerca('');
    setPagina(1);
  }, []);

  const sortState: SortState | null = useMemo(
    () => ({
      key: colonnaSort,
      direction: direzioneSort === 'asc' ? 'ascending' : 'descending',
    }),
    [colonnaSort, direzioneSort],
  );

  const cambiaSort = useCallback((sort: SortState | null) => {
    if (sort) {
      setColonnaSort(sort.key as ColonnaOrdinamentoPacchi);
      setDirezioneSort(sort.direction === 'ascending' ? 'asc' : 'desc');
    } else {
      setColonnaSort('data_arrivo');
      setDirezioneSort('desc');
    }
    setPagina(1);
  }, []);

  // Colonne tabella
  const colonne: readonly DataColumn<Pacco>[] = useMemo(() => {
    const cols: DataColumn<Pacco>[] = [
      {
        key: 'data_arrivo',
        header: 'Data arrivo',
        cell: (p) => formattaDataOraPacco(p.dataArrivo),
        mobile: 'detail',
        sortable: true,
        weight: 2,
        minWidth: 160,
      },
      {
        key: 'unita',
        header: 'Destinazione',
        cell: (p) => p.etichettaUnita,
        mobile: 'title',
        sortable: true,
        weight: 3,
        minWidth: 180,
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (p) => {
          const b = badgeStatoPacco(p.stato);
          return (
            <View style={styles.badgeWrapper}>
              <Badge status={b.status} label={b.label} />
            </View>
          );
        },
        mobile: 'status',
        sortable: true,
        weight: 2,
        minWidth: 160,
      },
      {
        key: 'ritiro',
        header: 'Ritiro / Firma',
        cell: (p) => {
          if (p.stato === 'RITIRATO') {
            const dataStr = formattaDataPacco(p.dataRitiro);
            const firma = p.firmaRitiro ? ` (${p.firmaRitiro})` : '';
            return `${dataStr}${firma}`;
          }
          return '—';
        },
        minWidth: 180,
        mobileLabel: 'Ritiro',
      },
    ];

    if (isPortiereOAdmin) {
      cols.push({
        key: 'azione',
        header: 'Azione',
        cell: (p) => {
          if (p.stato === 'GIACENZA') {
            return (
              <Button
                variant="secondary"
                label="Consegna"
                icon="package-check"
                onPress={() => apriModaleRitiro(p)}
              />
            );
          }
          return <Text style={styles.cellaRitirato}>Consegnato</Text>;
        },
        minWidth: 140,
        mobileLabel: 'Azione',
      });
    }

    return cols;
  }, [isPortiereOAdmin, apriModaleRitiro]);

  const opzioniSelectUnita: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: caricamentoUnita ? 'Caricamento unità…' : 'Seleziona unità di destinazione…' },
      ...opzioniUnita.map((u) => ({
        value: u.id,
        label: u.etichetta,
      })),
    ];
  }, [opzioniUnita, caricamentoUnita]);

  const sottotitolo = isPortiereOAdmin
    ? `Registro e gestione delle consegne in portineria per ${condominio?.nome || 'il condominio'}.`
    : `Pacchi e corrispondenza destinati alla tua unità presso la portineria di ${condominio?.nome || 'il condominio'}.`;

  const opzioniChip: FilterOption[] = useMemo(
    () => [
      { value: 'GIACENZA', label: `In giacenza (${statistiche.inGiacenza})` },
      { value: 'RITIRATO', label: `Ritirati (${statistiche.totale - statistiche.inGiacenza})` },
    ],
    [statistiche.inGiacenza, statistiche.totale],
  );

  const chipsValue = useMemo(() => {
    return filtroStato === 'tutti' ? [] : [filtroStato];
  }, [filtroStato]);

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Registro pacchi"
        subtitle={sottotitolo}
        action={
          isPortiereOAdmin
            ? {
                label: 'Registra arrivo pacco',
                icon: 'package-plus',
                onPress: apriModaleNuovoPacco,
              }
            : undefined
        }
      />

      {/* 3 StatCard reali */}
      <View style={styles.schede}>
        <View style={styles.scheda}>
          <StatCard
            icon="package"
            tile="teal"
            title="Pacchi in giacenza"
            value={pronto ? String(statistiche.inGiacenza) : '—'}
            description="In attesa di ritiro"
            loading={caricamento}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="package-check"
            tile="blue"
            title="Ritirati di recente"
            value={pronto ? String(statistiche.ritiratiRecenti) : '—'}
            description="Ultimi 30 giorni"
            loading={caricamento}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="building-2"
            tile="navy"
            title="Totale pacchi"
            value={pronto ? String(statistiche.totale) : '—'}
            description="Nel registro condominiale"
            loading={caricamento}
          />
        </View>
      </View>

      {/* Tabella / Elenco responsive */}
      <Card>
        <ResponsiveDataView
          label="Registro pacchi del condominio"
          columns={colonne}
          rows={paginazione.elementi}
          getRowKey={(p) => p.id}
          getRowLabel={(p) => `Pacco per ${p.etichettaUnita}`}
          loading={caricamento}
          error={errore ? { description: ERRORE_CARICAMENTO } : undefined}
          onRetry={ricarica}
          sort={sortState}
          onSortChange={cambiaSort}
          filters={
            <View style={styles.filtri}>
              <FilterChips
                label="Filtra per stato"
                options={opzioniChip}
                value={chipsValue}
                onChange={(valori) => {
                  const primoValore = valori[0] as FiltroStatoPacchi | undefined;
                  setFiltroStato(primoValore || 'tutti');
                  setPagina(1);
                }}
              />
              <SearchBar
                label="Cerca pacco"
                placeholder="Cerca per unità o interno (es. Int. 1)..."
                value={ricerca}
                onChangeText={(q: string) => {
                  setRicerca(q);
                  setPagina(1);
                }}
              />
            </View>
          }
          pagination={
            paginazione.totalePagine > 1 ? (
              <Pagination
                page={paginazione.paginaCorrente}
                pageCount={paginazione.totalePagine}
                onChange={setPagina}
              />
            ) : null
          }
          empty={{
            icon: 'package',
            title: filtriAttivi ? 'Nessun pacco trovato' : 'Nessun pacco nel registro',
            description: filtriAttivi
              ? 'Nessun pacco corrisponde ai filtri o alla ricerca impostata.'
              : isPortiereOAdmin
                ? 'Non ci sono pacchi registrati. Quando arriva un pacco in portineria, usa il pulsante in alto per registrarlo.'
                : 'Al momento non risultano pacchi in giacenza o ritirati per la tua unità.',
            action: filtriAttivi
              ? {
                  label: 'Azzera filtri',
                  icon: 'refresh-cw',
                  onPress: azzeraFiltri,
                }
              : undefined,
          }}
        />
      </Card>

      {/* Modale Registra arrivo pacco */}
      <Modal
        visible={modaleNuovoAperta}
        onClose={chiudiModaleNuovoPacco}
        title="Registra arrivo pacco"
        description="Registra un nuovo pacco ricevuto in portineria per un’unità del condominio."
        dismissible={!invioNuovoInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={chiudiModaleNuovoPacco}
              disabled={invioNuovoInCorso}
            />
            <Button
              variant="primary"
              label="Registra"
              icon="package-plus"
              onPress={eseguiRegistraNuovoPacco}
              loading={invioNuovoInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreNuovo ? <Alert tone="error" message={erroreNuovo} /> : null}

          <Select
            label="Unità immobiliare di destinazione *"
            options={opzioniSelectUnita}
            value={unitaSelezionataId}
            onChange={setUnitaSelezionataId}
            disabled={invioNuovoInCorso || caricamentoUnita}
          />
        </View>
      </Modal>

      {/* Modale Consegna / Segna ritirato con firma */}
      <Modal
        visible={paccoDaRitirare !== null}
        onClose={chiudiModaleRitiro}
        title="Registra consegna pacco"
        description="Conferma la consegna del pacco e registra il nome o la firma di chi ritira."
        dismissible={!invioRitiroInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={chiudiModaleRitiro}
              disabled={invioRitiroInCorso}
            />
            <Button
              variant="primary"
              label="Conferma consegna"
              icon="package-check"
              onPress={eseguiConsegnaPacco}
              loading={invioRitiroInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreRitiro ? <Alert tone="error" message={erroreRitiro} /> : null}

          {paccoDaRitirare ? (
            <View style={styles.schedaRiepilogoPacco}>
              <View style={styles.rigaRiepilogo}>
                <Text style={styles.etichettaRiepilogo}>Destinazione:</Text>
                <Text style={styles.valoreRiepilogo}>{paccoDaRitirare.etichettaUnita}</Text>
              </View>
              <View style={styles.rigaRiepilogo}>
                <Text style={styles.etichettaRiepilogo}>Arrivo in portineria:</Text>
                <Text style={styles.valoreRiepilogo}>
                  {formattaDataOraPacco(paccoDaRitirare.dataArrivo)}
                </Text>
              </View>
            </View>
          ) : null}

          <Input
            label="Firma o nominativo del ritirante *"
            placeholder="Es. Mario Rossi (residente) oppure Maria (delegata)"
            value={firmaInput}
            onChangeText={setFirmaInput}
            disabled={invioRitiroInCorso}
            maxLength={100}
            helperText="Nome e cognome o indicazione di chi ritira fisicamente il pacco (obbligatorio)."
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    alignSelf: 'stretch',
    gap: space[6],
  },
  schede: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  scheda: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 240,
  },
  filtri: {
    gap: space[4],
  },
  badgeWrapper: {
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  cellaRitirato: {
    ...textStyle('support'),
    color: colors.text.muted,
  },
  formModale: {
    gap: space[4],
    paddingVertical: space[2],
  },
  schedaRiepilogoPacco: {
    gap: space[2],
    backgroundColor: colors.background,
    padding: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  rigaRiepilogo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
  },
  etichettaRiepilogo: {
    ...textStyle('label'),
    color: colors.text.secondary,
  },
  valoreRiepilogo: {
    ...textStyle('body'),
    color: colors.text.primary,
    fontWeight: '600',
  },
});
