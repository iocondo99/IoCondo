import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  CATALOGO_MODULI,
  DEFAULT_MODULI_ATTIVI,
  type ModuloChiave,
  type ModuloInfo,
  type ModuliAttivi,
} from '@iocondo/data';
import type { IPalazzo } from '@iocondo/shared-types';
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  type FilterOption,
  Icon,
  LoadingState,
  PageHeader,
  SearchBar,
  Select,
  type SelectOption,
  StatCard,
  Switch,
  colors,
  space,
  textStyle,
  useBreakpoint,
  useToast,
} from '@iocondo/ui';
import { GrigliaSchede } from '@/components/home/GrigliaSchede';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function AdminModuliScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  return <AdminModuliContenuto />;
}

function AdminModuliContenuto() {
  const router = useRouter();
  const toast = useToast();
  const { condominio, aggiornaModuli } = useProfilo();
  const { isMobile, breakpoint } = useBreakpoint();

  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  // Dati di struttura e configurazioni dal DB
  const [palazzi, setPalazzi] = useState<IPalazzo[]>([]);
  const [overridePalazzoIds, setOverridePalazzoIds] = useState<Set<string>>(new Set());

  // Ambito selezionato: '' = tutto il condominio, string = id palazzo
  const [ambito, setAmbito] = useState<string>('');

  // Stato corrente dei moduli per l'ambito selezionato
  const [moduli, setModuli] = useState<ModuliAttivi>({ ...DEFAULT_MODULI_ATTIVI });

  // Modulo in fase di salvataggio
  const [salvandoChiave, setSalvandoChiave] = useState<ModuloChiave | null>(null);

  // Dialogo conferma disattivazione modulo critico
  const [moduloDaDisattivare, setModuloDaDisattivare] = useState<ModuloInfo | null>(null);

  // Dialogo conferma ripristino override palazzo
  const [confermaRipristinoAperta, setConfermaRipristinoAperta] = useState(false);

  // Ricerca e filtri
  const [ricerca, setRicerca] = useState('');
  const [filtri, setFiltri] = useState<string[]>([]);

  const condominioId = condominio?.id ?? '';

  const caricaDati = useCallback(async () => {
    if (!condominioId) return;
    setCaricamento(true);
    setErrore(null);
    try {
      const [elencoPalazzi, configurazioni, togglesCorrenti] = await Promise.all([
        services.struttura.listPalazzi(condominioId),
        services.condomini.listConfigurazioni(condominioId),
        services.condomini.getFeatureToggles(condominioId, ambito || null),
      ]);

      setPalazzi(elencoPalazzi);
      const overrides = new Set(
        configurazioni.map((c) => c.palazzo_id).filter((id): id is string => typeof id === 'string'),
      );
      setOverridePalazzoIds(overrides);
      setModuli(togglesCorrenti);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Impossibile caricare i moduli del condominio.');
    } finally {
      setCaricamento(false);
    }
  }, [condominioId, ambito]);

  useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  // Opzioni per la select degli ambiti (condominio vs palazzi)
  const opzioniAmbito: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [{ value: '', label: 'Tutto il condominio (predefinito)' }];
    for (const p of palazzi) {
      const haOverride = overridePalazzoIds.has(p.id);
      list.push({
        value: p.id,
        label: `Edificio: ${p.nome_identificativo}${haOverride ? ' (override attivo)' : ''}`,
      });
    }
    return list;
  }, [palazzi, overridePalazzoIds]);

  const palazzoSelezionato = useMemo(
    () => palazzi.find((p) => p.id === ambito),
    [palazzi, ambito],
  );

  const haOverrideAttivo = ambito !== '' && overridePalazzoIds.has(ambito);

  // Statistiche
  const totaleModuli = CATALOGO_MODULI.length;
  const attiviCount = useMemo(
    () => CATALOGO_MODULI.filter((m) => moduli[m.chiave] !== false).length,
    [moduli],
  );
  const disattivatiCount = totaleModuli - attiviCount;

  // Filtraggio moduli
  const moduliFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    const filtroAttivo = filtri[0];
    return CATALOGO_MODULI.filter((m) => {
      if (q) {
        const matchTesto =
          m.titolo.toLowerCase().includes(q) || m.descrizione.toLowerCase().includes(q);
        if (!matchTesto) return false;
      }
      const attivo = moduli[m.chiave] !== false;
      if (filtroAttivo === 'attivi') return attivo;
      if (filtroAttivo === 'disattivati') return !attivo;
      if (filtroAttivo === 'condomino') return m.destinatari.includes('CONDOMINO');
      if (filtroAttivo === 'portiere') return m.destinatari.includes('PORTIERE');
      return true;
    });
  }, [ricerca, filtri, moduli]);

  // Esecuzione salvataggio toggle
  const eseguiSalvataggio = async (chiave: ModuloChiave, prossimoValore: boolean) => {
    if (!condominioId) return;
    const prevModuli = { ...moduli };
    const nextModuli = { ...moduli, [chiave]: prossimoValore };

    setModuli(nextModuli);
    setSalvandoChiave(chiave);
    setErrore(null);

    // Se stiamo modificando il default del condominio, aggiorna ProfiloContext per reattività istantanea
    if (!ambito) {
      aggiornaModuli(nextModuli);
    }

    try {
      await services.condomini.setFeatureToggles(condominioId, ambito || null, {
        [chiave]: prossimoValore,
      });

      if (ambito) {
        setOverridePalazzoIds((prev) => new Set([...prev, ambito]));
      }

      toast.show({
        message: `Modulo "${CATALOGO_MODULI.find((m) => m.chiave === chiave)?.titolo}" ${prossimoValore ? 'attivato' : 'disattivato'}.`,
        tone: 'success',
      });
    } catch (err: unknown) {
      // Rollback
      setModuli(prevModuli);
      if (!ambito) {
        aggiornaModuli(prevModuli);
      }
      const msg = err instanceof Error ? err.message : 'Errore durante il salvataggio.';
      setErrore(msg);
      toast.show({
        message: msg,
        tone: 'error',
      });
    } finally {
      setSalvandoChiave(null);
    }
  };

  const handleToggle = (moduloInfo: ModuloInfo) => {
    const valoreAttuale = moduli[moduloInfo.chiave] !== false;
    const prossimoValore = !valoreAttuale;

    // Se si sta disattivando un modulo contrassegnato come critico, chiedi conferma
    if (valoreAttuale && moduloInfo.critico) {
      setModuloDaDisattivare(moduloInfo);
      return;
    }

    void eseguiSalvataggio(moduloInfo.chiave, prossimoValore);
  };

  const handleRipristinaOverride = async () => {
    if (!condominioId || !ambito) return;
    setCaricamento(true);
    setErrore(null);
    try {
      await services.condomini.resetPalazzoOverride(condominioId, ambito);
      setConfermaRipristinoAperta(false);
      toast.show({
        message: `Override per l'edificio ripristinato ai valori predefiniti del condominio.`,
        tone: 'success',
      });
      await caricaDati();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore nel ripristino dei valori predefiniti.';
      setErrore(msg);
      toast.show({ message: msg, tone: 'error' });
    } finally {
      setCaricamento(false);
    }
  };

  const chipsFiltro: FilterOption[] = [
    { value: 'attivi', label: `Attivi (${attiviCount})` },
    { value: 'disattivati', label: `Disattivati (${disattivatiCount})` },
    { value: 'condomino', label: 'Condòmino' },
    { value: 'portiere', label: 'Portiere' },
  ];

  return (
    <View style={styles.container}>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', onPress: () => router.push('/admin/dashboard' as Href) },
          { label: 'Moduli e funzionalità' },
        ]}
      />

      <PageHeader
        title="Moduli e funzionalità"
        subtitle="Configura quali schermate e servizi sono attivi per i residenti di questo condominio o per singolo edificio."
      />

      {/* Schede riassuntive */}
      <GrigliaSchede>
        <StatCard
          icon="check-circle-2"
          tile="teal"
          title="Funzionalità attive"
          value={`${attiviCount} su ${totaleModuli}`}
          description="Moduli abilitati per i residenti"
        />
        <StatCard
          icon="shield-alert"
          tile="navy"
          title="Funzionalità disattivate"
          value={`${disattivatiCount}`}
          description="Schermate bloccate e nascoste"
        />
        <StatCard
          icon="sliders-horizontal"
          tile="blue"
          title="Ambito di configurazione"
          value={palazzoSelezionato ? palazzoSelezionato.nome_identificativo : 'Tutto il condominio'}
          description={
            palazzoSelezionato
              ? haOverrideAttivo
                ? 'Override dedicato edificio'
                : 'Eredita dal condominio'
              : 'Valori predefiniti'
          }
        />
      </GrigliaSchede>

      {/* Selettore ambito e gestione override per palazzi */}
      {palazzi.length > 0 ? (
        <Card>
          <View style={styles.sezioneAmbito}>
            <View style={styles.rigaAmbito}>
              <View style={styles.selectWrapper}>
                <Select
                  label="Configura per"
                  options={opzioniAmbito}
                  value={ambito}
                  onChange={(val) => setAmbito(val)}
                />
              </View>

              {haOverrideAttivo ? (
                <View style={styles.azioneRipristino}>
                  <Button
                    variant="secondary"
                    icon="rotate-ccw"
                    label="Ripristina predefiniti"
                    onPress={() => setConfermaRipristinoAperta(true)}
                    accessibilityHint="Rimuove l'override e riprende i moduli predefiniti del condominio"
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.infoAmbito}>
              <Icon name="info" size="indicator" color={colors.text.muted} />
              <Text style={[textStyle('secondary', breakpoint), styles.testoInfoAmbito]}>
                {ambito === ''
                  ? 'I moduli impostati qui si applicano a tutto il condominio e costituiscono la base per tutti gli edifici.'
                  : haOverrideAttivo
                    ? 'Questo edificio dispone di una configurazione personalizzata che sovrascrive i predefiniti del condominio.'
                    : 'Questo edificio sta ereditando le impostazioni predefinite del condominio. Modificando un toggle verrà creato un override dedicato.'}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Avviso errore eventuale */}
      {errore ? <Alert tone="error" message={errore} /> : null}

      {/* Barra di ricerca e filtri */}
      <View style={styles.barratoolbar}>
        <View style={styles.cercaWrapper}>
          <SearchBar
            value={ricerca}
            onChangeText={setRicerca}
            placeholder="Cerca modulo o funzionalità..."
          />
        </View>
        <FilterChips
          label="Filtra per stato o destinatario"
          options={chipsFiltro}
          value={filtri}
          onChange={setFiltri}
        />
      </View>

      {/* Elenco dei moduli configurabili */}
      {caricamento ? (
        <LoadingState message="Caricamento configurazioni moduli..." />
      ) : moduliFiltrati.length === 0 ? (
        <EmptyState
          icon="sliders-horizontal"
          title="Nessun modulo trovato"
          description="Nessuna funzionalità corrisponde ai filtri o alla ricerca impostata."
          action={{
            label: 'Reimposta filtri',
            icon: 'rotate-ccw',
            onPress: () => {
              setRicerca('');
              setFiltri([]);
            },
          }}
        />
      ) : (
        <View style={styles.elencoModuli}>
          {moduliFiltrati.map((m) => {
            const attivo = moduli[m.chiave] !== false;
            const inSalvataggio = salvandoChiave === m.chiave;

            return (
              <Card key={m.chiave}>
                <View style={[styles.rigaModulo, isMobile && styles.rigaModuloMobile]}>
                  <View style={styles.colonnaDettagliModulo}>
                    <View style={styles.intestazioneModulo}>
                      <Text style={[textStyle('h4', breakpoint), styles.titoloModulo]}>
                        {m.titolo}
                      </Text>
                      <View style={styles.badgeGroup}>
                        <Badge
                          label={attivo ? 'Attivo' : 'Disattivato'}
                          status={attivo ? 'success' : 'neutral'}
                        />
                        {m.destinatari.map((dest) => (
                          <Badge
                            key={dest}
                            label={dest === 'CONDOMINO' ? 'Condòmino' : 'Portiere'}
                            status="info"
                          />
                        ))}
                        {m.richiedeMigrazione11 ? (
                          <Badge
                            label="Migrazione 11"
                            status="neutral"
                          />
                        ) : null}
                      </View>
                    </View>

                    <Text style={[textStyle('secondary', breakpoint), styles.descrizioneModulo]}>
                      {m.descrizione}
                    </Text>

                    <Text style={[textStyle('support', breakpoint), styles.rottaModulo]}>
                      Schermata collegata: {m.rottaResidente}
                    </Text>
                  </View>

                  <View style={styles.colonnaAzioneModulo}>
                    <Switch
                      checked={attivo}
                      onChange={() => handleToggle(m)}
                      disabled={inSalvataggio}
                      accessibilityLabel={`Attiva o disattiva il modulo ${m.titolo}`}
                      accessibilityHint={`Attualmente ${attivo ? 'attivo' : 'disattivato'}. Commuta per cambiare lo stato.`}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {/* Conferma disattivazione modulo critico */}
      <ConfirmDialog
        visible={!!moduloDaDisattivare}
        title={`Disattivare ${moduloDaDisattivare?.titolo ?? ''}?`}
        description={`Disattivando questo modulo, i residenti (${moduloDaDisattivare?.destinatari.map((d) => (d === 'CONDOMINO' ? 'Condòmini' : 'Portieri')).join(', ')}) non potranno più visualizzare la sezione, accedere alla schermata ${moduloDaDisattivare?.rottaResidente ?? ''} né consultare i relativi dati.`}
        confirmLabel="Disattiva modulo"
        confirmLoadingLabel="Disattivazione..."
        cancelLabel="Annulla"
        destructive
        onConfirm={async () => {
          if (!moduloDaDisattivare) return;
          const chiave = moduloDaDisattivare.chiave;
          setModuloDaDisattivare(null);
          await eseguiSalvataggio(chiave, false);
        }}
        onCancel={() => setModuloDaDisattivare(null)}
      />

      {/* Conferma ripristino override palazzo */}
      <ConfirmDialog
        visible={confermaRipristinoAperta}
        title="Ripristinare i moduli predefiniti?"
        description={`L'edificio "${palazzoSelezionato?.nome_identificativo ?? ''}" perderà la configurazione dedicata e tornerà a utilizzare i moduli predefiniti impostati per tutto il condominio.`}
        confirmLabel="Ripristina predefiniti"
        confirmLoadingLabel="Ripristino..."
        cancelLabel="Annulla"
        destructive={false}
        onConfirm={handleRipristinaOverride}
        onCancel={() => setConfermaRipristinoAperta(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: space[6],
  },
  sezioneAmbito: {
    gap: space[3],
  },
  rigaAmbito: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space[4],
  },
  selectWrapper: {
    flex: 1,
    minWidth: 260,
  },
  azioneRipristino: {
    paddingBottom: space[1],
  },
  infoAmbito: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoInfoAmbito: {
    color: colors.text.secondary,
    flex: 1,
  },
  barratoolbar: {
    gap: space[4],
  },
  cercaWrapper: {
    maxWidth: 420,
  },
  elencoModuli: {
    gap: space[4],
  },
  rigaModulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
  },
  rigaModuloMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  colonnaDettagliModulo: {
    flex: 1,
    gap: space[2],
  },
  intestazioneModulo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  titoloModulo: {
    color: colors.text.primary,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  descrizioneModulo: {
    color: colors.text.secondary,
  },
  rottaModulo: {
    color: colors.text.muted,
  },
  colonnaAzioneModulo: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
