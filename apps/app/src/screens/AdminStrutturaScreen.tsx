import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  formatEuro,
  formatDate,
  type StrutturaAdminData,
  type UnitaDettaglioView,
  type TabellaMillesimaleDettaglioView,
  type PalazzoGruppoView,
  type ScalaGruppoView,
  type RisultatoValidazioneCSV,
  validaImportMillesimiCSV,
  generaTemplateCSVMillesimi,
  parseValoreMillesimale,
  arrotonda3,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  Icon,
  Input,
  LoadingState,
  Modal,
  ModalActions,
  PageHeader,
  SearchBar,
  Select,
  StatCard,
  Tabs,
  Textarea,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  useBreakpoint,
  useToast,
  type BreadcrumbItem,
  type FilterOption,
  type SelectOption,
  type TabItem,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function AdminStrutturaScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  return <AdminStrutturaContenuto />;
}

function AdminStrutturaContenuto() {
  const router = useRouter();
  const { condominio } = useProfilo();
  const { breakpoint, isDesktop, isMobile } = useBreakpoint();
  const toast = useToast();

  const [dati, setDati] = useState<StrutturaAdminData | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);
  const [tabAttivo, setTabAttivo] = useState<'edifici' | 'millesimi'>('edifici');

  // Filtri tab edifici
  const [filtroRicerca, setFiltroRicerca] = useState('');
  const [filtroPalazzo, setFiltroPalazzo] = useState<string>('tutti');

  // Modali
  const [modalePalazzoAperta, setModalePalazzoAperta] = useState(false);
  const [nomeNuovoPalazzo, setNomeNuovoPalazzo] = useState('');
  const [indirizzoNuovoPalazzo, setIndirizzoNuovoPalazzo] = useState('');
  const [salvataggioPalazzoInCorso, setSalvataggioPalazzoInCorso] = useState(false);

  const [modaleUnitaAperta, setModaleUnitaAperta] = useState(false);
  const [unitaInModifica, setUnitaInModifica] = useState<UnitaDettaglioView | null>(null);
  const [palazzoSelezionatoId, setPalazzoSelezionatoId] = useState('');
  const [scalaSelezionataId, setScalaSelezionataId] = useState<string>('');
  const [tipologiaSelezionataId, setTipologiaSelezionataId] = useState('');
  const [internoInput, setInternoInput] = useState('');
  const [pianoInput, setPianoInput] = useState('');
  const [mqInput, setMqInput] = useState('');
  const [foglioInput, setFoglioInput] = useState('');
  const [particellaInput, setParticellaInput] = useState('');
  const [subalternoInput, setSubalternoInput] = useState('');
  const [salvataggioUnitaInCorso, setSalvataggioUnitaInCorso] = useState(false);
  const [erroreFormUnita, setErroreFormUnita] = useState<string | null>(null);

  const [unitaDettaglio, setUnitaDettaglio] = useState<UnitaDettaglioView | null>(null);

  // Modale Import Millesimi CSV (UC-09)
  const [modaleCSVAperta, setModaleCSVAperta] = useState(false);
  const [tabellaCSVSelezionataId, setTabellaCSVSelezionataId] = useState<string>('');
  const [testoCSV, setTestoCSV] = useState('');
  const [esitoValidazioneCSV, setEsitoValidazioneCSV] = useState<RisultatoValidazioneCSV | null>(null);
  const [importazioneInCorso, setImportazioneInCorso] = useState(false);
  const [erroreImportCSV, setErroreImportCSV] = useState<string | null>(null);

  const caricaDati = useCallback(async () => {
    if (!condominio?.id) {
      setCaricamento(false);
      return;
    }
    setCaricamento(true);
    setErrore(false);
    try {
      const res = await services.struttura.caricaStrutturaCompleta(condominio.id);
      setDati(res);
      if (res.tabelle.length > 0 && !tabellaCSVSelezionataId) {
        setTabellaCSVSelezionataId(res.tabelle[0].id);
      }
    } catch {
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id, tabellaCSVSelezionataId]);

  useEffect(() => {
    caricaDati();
  }, [caricaDati]);

  // Validazione CSV in tempo reale al cambio del testo o tabella selezionata
  useEffect(() => {
    if (!modaleCSVAperta || !testoCSV.trim() || !dati) {
      setEsitoValidazioneCSV(null);
      return;
    }
    const tab = dati.tabelle.find((t) => t.id === tabellaCSVSelezionataId);
    const previsto = tab ? tab.totalePrevisto : 1000;
    const res = validaImportMillesimiCSV(testoCSV, dati.tutteUnita, previsto);
    setEsitoValidazioneCSV(res);
  }, [testoCSV, tabellaCSVSelezionataId, modaleCSVAperta, dati]);

  const breadcrumbs: BreadcrumbItem[] = useMemo(
    () => [
      {
        label: 'Home',
        onPress: () => router.push('/admin/dashboard' as Href),
      },
      { label: 'Struttura' },
    ],
    [router]
  );

  // Opzioni per filtri e select
  const opzioniFiltroPalazzi: FilterOption[] = useMemo(() => {
    if (!dati) return [];
    return dati.palazzi.map((p) => ({ value: p.id, label: p.nome }));
  }, [dati]);

  const opzioniPalazziSelect: SelectOption[] = useMemo(() => {
    if (!dati) return [];
    return dati.palazzi.map((p) => ({ value: p.id, label: p.nome }));
  }, [dati]);

  const opzioniScaleSelect: SelectOption[] = useMemo(() => {
    if (!dati || !palazzoSelezionatoId) return [{ value: '', label: 'Nessuna scala / Generale' }];
    const pal = dati.palazzi.find((p) => p.id === palazzoSelezionatoId);
    if (!pal) return [{ value: '', label: 'Nessuna scala / Generale' }];

    const opts: SelectOption[] = [{ value: '', label: 'Nessuna scala / Generale' }];
    for (const sc of pal.scale) {
      if (sc.id) {
        opts.push({ value: sc.id, label: sc.nome });
      }
    }
    return opts;
  }, [dati, palazzoSelezionatoId]);

  const opzioniTipologieSelect: SelectOption[] = useMemo(() => {
    if (!dati) return [];
    return dati.tipologie.map((t) => ({ value: t.id, label: t.descrizione }));
  }, [dati]);

  const opzioniTabelleCSVSelect: SelectOption[] = useMemo(() => {
    if (!dati) return [];
    return dati.tabelle.map((t) => ({
      value: t.id,
      label: `${t.nome} (tot. ${t.totalePrevisto} ‰)`,
    }));
  }, [dati]);

  // Gestione creazione Palazzo
  const apriModalePalazzo = () => {
    setNomeNuovoPalazzo('');
    setIndirizzoNuovoPalazzo('');
    setModalePalazzoAperta(true);
  };

  const salvaNuovoPalazzo = async () => {
    if (!condominio?.id || !nomeNuovoPalazzo.trim()) return;
    setSalvataggioPalazzoInCorso(true);
    try {
      await services.struttura.creaPalazzo({
        condominioId: condominio.id,
        nomeIdentificativo: nomeNuovoPalazzo.trim(),
        indirizzo: indirizzoNuovoPalazzo.trim() || null,
      });
      toast.show({
        message: `Palazzo "${nomeNuovoPalazzo.trim()}" creato con successo.`,
        type: 'success',
      });
      setModalePalazzoAperta(false);
      caricaDati();
    } catch {
      toast.show({
        message: 'Errore durante la creazione del palazzo.',
        type: 'error',
      });
    } finally {
      setSalvataggioPalazzoInCorso(false);
    }
  };

  // Gestione creazione/modifica Unità
  const apriModaleNuovaUnita = (prefillPalazzoId?: string) => {
    setUnitaInModifica(null);
    setPalazzoSelezionatoId(prefillPalazzoId || (dati?.palazzi[0]?.id ?? ''));
    setScalaSelezionataId('');
    setTipologiaSelezionataId(dati?.tipologie[0]?.id ?? '');
    setInternoInput('');
    setPianoInput('');
    setMqInput('');
    setFoglioInput('');
    setParticellaInput('');
    setSubalternoInput('');
    setErroreFormUnita(null);
    setModaleUnitaAperta(true);
  };

  const apriModaleModificaUnita = (unita: UnitaDettaglioView) => {
    setUnitaInModifica(unita);
    setPalazzoSelezionatoId(unita.palazzoId);
    setScalaSelezionataId(unita.scalaId || '');
    setTipologiaSelezionataId(unita.tipologiaId);
    setInternoInput(unita.interno);
    setPianoInput(unita.piano !== null ? String(unita.piano) : '');
    setMqInput(unita.mq !== null ? String(unita.mq) : '');
    setFoglioInput(unita.foglioCatastale || '');
    setParticellaInput(unita.particella || '');
    setSubalternoInput(unita.subalterno || '');
    setErroreFormUnita(null);
    setModaleUnitaAperta(true);
  };

  const salvaUnita = async () => {
    if (!palazzoSelezionatoId || !tipologiaSelezionataId || !internoInput.trim()) {
      setErroreFormUnita('Palazzo, Tipologia e Interno sono campi obbligatori.');
      return;
    }

    const pianoNum = pianoInput.trim() ? parseInt(pianoInput.trim(), 10) : null;
    const mqNum = mqInput.trim() ? parseFloat(mqInput.trim().replace(',', '.')) : null;

    if (pianoInput.trim() && isNaN(pianoNum as number)) {
      setErroreFormUnita('Il piano deve essere un numero intero (es. 1 o -1).');
      return;
    }
    if (mqInput.trim() && (isNaN(mqNum as number) || (mqNum as number) <= 0)) {
      setErroreFormUnita('La superficie deve essere un numero positivo in mq.');
      return;
    }

    setSalvataggioUnitaInCorso(true);
    setErroreFormUnita(null);

    try {
      if (unitaInModifica) {
        await services.struttura.modificaUnita({
          id: unitaInModifica.id,
          palazzoId: palazzoSelezionatoId,
          scalaColonnaId: scalaSelezionataId || null,
          tipologiaId: tipologiaSelezionataId,
          interno: internoInput.trim(),
          piano: pianoNum,
          mq: mqNum,
          foglioCatastale: foglioInput.trim() || null,
          particella: particellaInput.trim() || null,
          subalterno: subalternoInput.trim() || null,
        });
        toast.show({
          message: `Unità ${internoInput.trim()} aggiornata con successo.`,
          type: 'success',
        });
      } else {
        await services.struttura.creaUnita({
          palazzoId: palazzoSelezionatoId,
          scalaColonnaId: scalaSelezionataId || null,
          tipologiaId: tipologiaSelezionataId,
          interno: internoInput.trim(),
          piano: pianoNum,
          mq: mqNum,
          foglioCatastale: foglioInput.trim() || null,
          particella: particellaInput.trim() || null,
          subalterno: subalternoInput.trim() || null,
        });
        toast.show({
          message: `Unità ${internoInput.trim()} creata con successo.`,
          type: 'success',
        });
      }
      setModaleUnitaAperta(false);
      caricaDati();
    } catch {
      setErroreFormUnita('Errore durante il salvataggio dell’unità immobiliare.');
    } finally {
      setSalvataggioUnitaInCorso(false);
    }
  };

  // Gestione Import Millesimi CSV (UC-09)
  const apriModaleCSV = (tabellaId?: string) => {
    if (tabellaId) {
      setTabellaCSVSelezionataId(tabellaId);
    } else if (dati?.tabelle[0]) {
      setTabellaCSVSelezionataId(dati.tabelle[0].id);
    }
    setTestoCSV('');
    setEsitoValidazioneCSV(null);
    setErroreImportCSV(null);
    setModaleCSVAperta(true);
  };

  const scaricaTemplateCSV = () => {
    if (!dati) return;
    const template = generaTemplateCSVMillesimi(dati.tutteUnita);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'template_millesimi.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.show({ message: 'Template CSV scaricato sul tuo dispositivo.', type: 'info' });
        return;
      } catch {
        // Fallback: copia testo nell'input
      }
    }

    setTestoCSV(template);
    toast.show({
      message: 'Template CSV di esempio inserito nell’area di import.',
      type: 'info',
    });
  };

  const caricaFileCSVWeb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setTestoCSV(content);
      }
    };
    reader.readAsText(file);
  };

  const applicaImportCSV = async () => {
    if (!esitoValidazioneCSV || !esitoValidazioneCSV.puoSalvare || !tabellaCSVSelezionataId) return;

    setImportazioneInCorso(true);
    setErroreImportCSV(null);

    try {
      const quoteValide = esitoValidazioneCSV.righe
        .filter((r) => r.valido && r.unitaId)
        .map((r) => ({
          unitaId: r.unitaId as string,
          valoreMillesimale: r.valoreMillesimale,
        }));

      await services.struttura.salvaQuoteMillesimali(tabellaCSVSelezionataId, quoteValide);

      const tab = dati?.tabelle.find((t) => t.id === tabellaCSVSelezionataId);
      toast.show({
        message: `Quote millesimali aggiornate con successo per "${tab?.nome || 'tabella'}".`,
        type: 'success',
      });
      setModaleCSVAperta(false);
      caricaDati();
    } catch {
      setErroreImportCSV('Si è verificato un errore durante il salvataggio delle quote millesimali.');
    } finally {
      setImportazioneInCorso(false);
    }
  };

  // Filtraggio unità ed edifici per visualizzazione
  const palazziFiltrati = useMemo(() => {
    if (!dati) return [];
    let list = dati.palazzi;
    if (filtroPalazzo !== 'tutti') {
      list = list.filter((p) => p.id === filtroPalazzo);
    }
    if (!filtroRicerca.trim()) return list;

    const q = filtroRicerca.toLowerCase().trim();
    return list
      .map((p) => {
        const scaleFiltrate = p.scale
          .map((sc) => {
            const unitaFiltrate = sc.unita.filter(
              (u) =>
                u.interno.toLowerCase().includes(q) ||
                (u.residenteAttivo?.nomeCognome.toLowerCase().includes(q) ?? false) ||
                u.tipologiaDescrizione.toLowerCase().includes(q)
            );
            return {
              ...sc,
              totaleUnita: unitaFiltrate.length,
              unita: unitaFiltrate,
            };
          })
          .filter((sc) => sc.unita.length > 0);

        const totUnita = scaleFiltrate.reduce((acc, sc) => acc + sc.totaleUnita, 0);
        return {
          ...p,
          totaleUnita: totUnita,
          scale: scaleFiltrate,
        };
      })
      .filter((p) => p.totaleUnita > 0);
  }, [dati, filtroPalazzo, filtroRicerca]);

  if (caricamento) {
    return (
      <View style={styles.pagina}>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader
          title="Struttura del Condominio"
          subtitle="Caricamento edifici, scale e tabelle millesimali..."
        />
        <LoadingState label="Caricamento struttura condominiale in corso..." />
      </View>
    );
  }

  if (errore || !dati) {
    return (
      <View style={styles.pagina}>
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader
          title="Struttura del Condominio"
          subtitle="Gestione edifici, unità e ripartizione millesimale."
        />
        <ErrorState
          title="Errore di caricamento della struttura"
          description="Impossibile recuperare i dati del condominio. Verifica la connessione e riprova."
          action={{ label: 'Riprova', onPress: caricaDati }}
        />
      </View>
    );
  }

  // Schede Tab
  const tabs: TabItem[] = [
    {
      key: 'edifici',
      label: 'Edifici e Unità',
      icon: 'building-2',
      content: (
        <View style={styles.contenutoTab}>
          {/* Barra di ricerca e filtri */}
          <Card>
            <View style={styles.barraStrumenti}>
              <View style={styles.filtroSearchBar}>
                <SearchBar
                  label="Cerca unità"
                  placeholder="Cerca per interno, residente o tipologia..."
                  value={filtroRicerca}
                  onChangeText={setFiltroRicerca}
                />
              </View>

              <View style={styles.filtroChipsContenitore}>
                <FilterChips
                  label="Filtra edificio"
                  allLabel="Tutti i palazzi"
                  options={opzioniFiltroPalazzi}
                  value={filtroPalazzo !== 'tutti' && filtroPalazzo ? [filtroPalazzo] : []}
                  onChange={(val) => setFiltroPalazzo(val[0] || 'tutti')}
                />
              </View>
            </View>
          </Card>

          {/* Elenco Palazzi */}
          {palazziFiltrati.length === 0 ? (
            <Card>
              <EmptyState
                icon="building-2"
                title="Nessun edificio o unità corrispondente"
                description={
                  filtroRicerca || filtroPalazzo !== 'tutti'
                    ? 'Nessun elemento corrisponde ai filtri impostati. Prova a modificare i criteri di ricerca.'
                    : 'Nessun edificio configurato in questo condominio. Inizia aggiungendo il primo edificio.'
                }
                action={{
                  label: 'Aggiungi edificio',
                  onPress: apriModalePalazzo,
                }}
              />
            </Card>
          ) : (
            palazziFiltrati.map((palazzo) => (
              <Card
                key={palazzo.id}
                title={palazzo.nome}
                description={palazzo.indirizzo || 'Nessun indirizzo specificato'}
                action={{
                  label: '+ Nuova unità',
                  onPress: () => apriModaleNuovaUnita(palazzo.id),
                  accessibilityHint: `Aggiungi una nuova unità immobiliare nel ${palazzo.nome}`,
                }}
              >
                <View style={styles.palazzoCorpo}>
                  {/* Badge riepilogo edificio */}
                  <View style={styles.rigaRiepilogoEdificio}>
                    <Badge
                      status="info"
                      label={`${palazzo.totaleUnita} ${palazzo.totaleUnita === 1 ? 'Unità' : 'Unità'}`}
                    />
                    <Badge
                      status="neutral"
                      label={`${palazzo.totaleMq} mq complessivi`}
                    />
                  </View>

                  {/* Elenco Scale/Colonne */}
                  {palazzo.scale.map((scala, idx) => (
                    <View key={scala.id || `gen-${idx}`} style={styles.sezioneScala}>
                      <View style={styles.intestazioneScala}>
                        <View style={styles.iconaScala}>
                          <Icon name="layers" size="icon" color={colors.brand.navy} />
                        </View>
                        <Text style={[textStyle('h4', breakpoint), styles.titoloScala]}>
                          {scala.nome}
                        </Text>
                        <Text style={[textStyle('secondary', breakpoint), styles.conteggioScala]}>
                          ({scala.totaleUnita} {scala.totaleUnita === 1 ? 'unità' : 'unità'})
                        </Text>
                      </View>

                      {/* Lista Unità della scala */}
                      <View style={styles.tabellaUnita}>
                        {scala.unita.map((unita) => {
                          const badgeStato = unita.residenteAttivo
                            ? unita.residenteAttivo.tipoPossesso === 'PROPRIETARIO'
                              ? 'success'
                              : 'info'
                            : 'neutral';

                          const labelPossesso = unita.residenteAttivo
                            ? `${unita.residenteAttivo.tipoPossesso === 'PROPRIETARIO' ? 'Proprietario' : 'Inquilino'}: ${unita.residenteAttivo.nomeCognome}`
                            : 'Non assegnata';

                          return (
                            <View key={unita.id} style={styles.rigaUnita}>
                              {/* Dati identificativi */}
                              <View style={styles.infoPrincipaleUnita}>
                                <View style={styles.rigaIdentificativo}>
                                  <View style={styles.badgeInterno}>
                                    <Text style={[textStyle('label', breakpoint), styles.testoBadgeInterno]}>
                                      Int. {unita.interno}
                                    </Text>
                                  </View>
                                  <Text style={[textStyle('body', breakpoint), styles.tipologiaUnita]}>
                                    {unita.tipologiaDescrizione}
                                  </Text>
                                </View>

                                <View style={styles.dettagliSpaziali}>
                                  <Text style={[textStyle('secondary', breakpoint), styles.testoSpaziale]}>
                                    {unita.piano !== null ? `Piano ${unita.piano}` : 'Piano non spec.'}
                                    {unita.mq !== null ? ` · ${unita.mq} mq` : ''}
                                  </Text>
                                  <View style={styles.badgeResidente}>
                                    <Badge status={badgeStato} label={labelPossesso} />
                                  </View>
                                </View>
                              </View>

                              {/* Azioni riga */}
                              <View style={styles.azioniUnita}>
                                <Button
                                  variant="secondary"
                                  label="Dettagli"
                                  onPress={() => setUnitaDettaglio(unita)}
                                  accessibilityHint={`Visualizza dettagli completi dell’interno ${unita.interno}`}
                                />
                                <Button
                                  variant="text"
                                  label="Modifica"
                                  icon="pencil"
                                  onPress={() => apriModaleModificaUnita(unita)}
                                  accessibilityHint={`Modifica unità immobiliare interno ${unita.interno}`}
                                />
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            ))
          )}
        </View>
      ),
    },
    {
      key: 'millesimi',
      label: 'Tabelle Millesimali',
      icon: 'calculator',
      content: (
        <View style={styles.contenutoTab}>
          {dati.tabelle.length === 0 ? (
            <Card>
              <EmptyState
                icon="calculator"
                title="Nessuna tabella millesimale presente"
                description="Crea la prima tabella millesimale per impostare la ripartizione dei costi e delle spese del condominio."
                action={{
                  label: 'Importa millesimi CSV',
                  onPress: () => apriModaleCSV(),
                }}
              />
            </Card>
          ) : (
            dati.tabelle.map((tabella) => {
              const statoBadge = tabella.isQuadrata ? 'success' : 'error';
              const labelQuadratura = tabella.isQuadrata
                ? `Quadrata a ${tabella.totalePrevisto} ‰`
                : `Disavanzo da correggere: ${tabella.disavanzo > 0 ? '+' : ''}${tabella.disavanzo.toFixed(3)} ‰`;

              return (
                <Card
                  key={tabella.id}
                  title={tabella.nome}
                  description={`Ripartizione spese condominiali · Totale previsto: ${tabella.totalePrevisto} ‰`}
                  action={{
                    label: 'Importa CSV quote',
                    icon: 'upload',
                    onPress: () => apriModaleCSV(tabella.id),
                    accessibilityHint: `Importa o sovrascrivi quote da CSV per ${tabella.nome}`,
                  }}
                >
                  <View style={styles.corpoTabellaMillesimi}>
                    {/* Barra di stato quadratura */}
                    <View style={styles.barraStatoQuadratura}>
                      <View style={styles.infoSommaMillesimi}>
                        <Text style={[textStyle('secondary', breakpoint), styles.etichettaSomma]}>
                          Somma calcolata quote:
                        </Text>
                        <Text style={[textStyle('h3', breakpoint), styles.valoreSomma]}>
                          {tabella.totaleEffettivo.toFixed(3)} ‰
                        </Text>
                      </View>
                      <Badge status={statoBadge} label={labelQuadratura} />
                    </View>

                    {/* Elenco quote per unità */}
                    <View style={styles.listaQuote}>
                      <View style={styles.testataTabellaQuote}>
                        <Text style={[textStyle('label', breakpoint), styles.colQuoteUnita]}>
                          Unità / Immobile
                        </Text>
                        <Text style={[textStyle('label', breakpoint), styles.colQuoteEdificio]}>
                          Edificio & Scala
                        </Text>
                        <Text style={[textStyle('label', breakpoint), styles.colQuoteValore]}>
                          Quota (‰)
                        </Text>
                        <Text style={[textStyle('label', breakpoint), styles.colQuotePercentuale]}>
                          Quota (%)
                        </Text>
                      </View>

                      {tabella.quote.length === 0 ? (
                        <View style={styles.rigaVuotaQuote}>
                          <Text style={[textStyle('secondary', breakpoint), styles.testoRigaVuota]}>
                            Nessuna quota millesimale associata a questa tabella. Carica il file CSV per compilarla.
                          </Text>
                        </View>
                      ) : (
                        tabella.quote.map((q) => (
                          <View key={q.unitaId} style={styles.rigaQuota}>
                            <View style={styles.colQuoteUnita}>
                              <Text style={[textStyle('body', breakpoint), styles.testoUnitaQuota]}>
                                Int. {q.interno}
                              </Text>
                              <Text style={[textStyle('secondary', breakpoint), styles.testoTipologiaQuota]}>
                                {q.tipologiaDescrizione}
                              </Text>
                            </View>

                            <View style={styles.colQuoteEdificio}>
                              <Text style={[textStyle('body', breakpoint)]}>
                                {q.palazzoNome}
                              </Text>
                              <Text style={[textStyle('secondary', breakpoint), styles.testoSubEdificio]}>
                                {q.scalaNome || 'Senza scala'}
                              </Text>
                            </View>

                            <View style={styles.colQuoteValore}>
                              <Text style={[textStyle('h4', breakpoint), styles.testoMillesimi]}>
                                {q.valoreMillesimale.toFixed(3)} ‰
                              </Text>
                            </View>

                            <View style={styles.colQuotePercentuale}>
                              <Text style={[textStyle('secondary', breakpoint), styles.testoPercentuale]}>
                                {q.percentuale.toFixed(2)} %
                              </Text>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      ),
    },
  ];

  return (
    <View style={styles.pagina}>
      {/* 1. Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} />

      {/* 2. PageHeader */}
      <PageHeader
        title="Struttura del Condominio"
        subtitle={`Gestione edifici, scale, unità immobiliari e ripartizione tabelle millesimali per ${condominio.nome}.`}
        action={{
          label: 'Importa millesimi CSV',
          icon: 'upload',
          onPress: () => apriModaleCSV(),
        }}
      />

      {/* Pulsanti azioni rapide di testata */}
      <View style={styles.barraAzioniPrimarie}>
        <Button
          variant="secondary"
          icon="building-2"
          label="Aggiungi edificio"
          onPress={apriModalePalazzo}
          accessibilityHint="Apre il modulo per inserire un nuovo palazzo"
        />
        <Button
          variant="secondary"
          label="Nuova unità"
          onPress={() => apriModaleNuovaUnita()}
          accessibilityHint="Apre il modulo per inserire una nuova unità immobiliare"
        />
      </View>

      {/* 3. 3 StatCard obbligatorie */}
      <View style={styles.grigliaStatCard}>
        <View style={styles.colonnaStatCard}>
          <StatCard
            icon="building-2"
            tile="blue"
            title="Edifici e Palazzi"
            value={`${dati.statistiche.totalePalazzi} ${dati.statistiche.totalePalazzi === 1 ? 'Palazzo' : 'Palazzi'}`}
            description="Edifici nel condominio"
          />
        </View>

        <View style={styles.colonnaStatCard}>
          <StatCard
            icon="home"
            tile="navy"
            title="Totale unità immobiliari"
            value={`${dati.statistiche.totaleUnita} Unità`}
            description={`${dati.statistiche.totaleMq} mq complessivi`}
          />
        </View>

        <View style={styles.colonnaStatCard}>
          <StatCard
            icon="users"
            tile="teal"
            title="Residenti associati"
            value={`${dati.statistiche.residentiAssociati} Assegnate`}
            description={`${
              dati.statistiche.totaleUnita > 0
                ? Math.round((dati.statistiche.residentiAssociati / dati.statistiche.totaleUnita) * 100)
                : 0
            }% unità con residente attivo`}
          />
        </View>
      </View>

      {/* 4. Navigazione a Schede (Tabs) */}
      <Tabs
        label="Sezioni della struttura del condominio"
        tabs={tabs}
        value={tabAttivo}
        onChange={(val) => setTabAttivo(val as 'edifici' | 'millesimi')}
      />

      {/* ==================================================================== */}
      {/* MODALE IMPORT MILLESIMI CSV (UC-09) */}
      {/* ==================================================================== */}
      <Modal
        visible={modaleCSVAperta}
        onClose={() => setModaleCSVAperta(false)}
        title="Importa millesimi da file CSV"
        description="Carica il file CSV con le colonne obbligatorie (Scala, Interno, Millesimi). La somma deve quadrare esattamente a 1000,000 ‰."
        dismissible={!importazioneInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleCSVAperta(false)}
              disabled={importazioneInCorso}
            />
            <Button
              variant="primary"
              label="Applica e salva quote"
              icon="check"
              onPress={applicaImportCSV}
              disabled={!esitoValidazioneCSV || !esitoValidazioneCSV.puoSalvare || importazioneInCorso}
              loading={importazioneInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.corpoModaleCSV}>
            {erroreImportCSV ? <Alert tone="error" message={erroreImportCSV} /> : null}

            {/* Selezione tabella di destinazione */}
            <Select
              label="Tabella millesimale di destinazione *"
              options={opzioniTabelleCSVSelect}
              value={tabellaCSVSelezionataId}
              onChange={setTabellaCSVSelezionataId}
              disabled={importazioneInCorso}
            />

            {/* Azioni template e upload */}
            <View style={styles.bloccoAzioniTemplate}>
              <Button
                variant="secondary"
                label="Scarica template CSV"
                icon="file-text"
                onPress={scaricaTemplateCSV}
                accessibilityHint="Scarica il file CSV di esempio con le unità attuali precompilate"
              />

              {Platform.OS === 'web' ? (
                <View style={styles.contenitoreInputFileWeb}>
                  <label
                    htmlFor="csv-file-input"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.action.default,
                      color: colors.text.inverse,
                      padding: '8px 16px',
                      borderRadius: radii.button,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: '600',
                    }}
                  >
                    Sfoglia file CSV (.csv)
                  </label>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    style={{ display: 'none' }}
                    onChange={caricaFileCSVWeb}
                  />
                </View>
              ) : null}
            </View>

            {/* Area inserimento / visualizzazione testo CSV */}
            <Textarea
              label="Dati CSV (separati da virgola o punto e virgola) *"
              helperText="Incolla o modifica qui il contenuto CSV oppure carica il file dal pulsante sopra"
              value={testoCSV}
              onChangeText={setTestoCSV}
              placeholder={'Scala;Interno;Millesimi\nScala A;1;250,000\nScala A;2;250,000\n...'}
              minHeight={120}
              disabled={importazioneInCorso}
            />

            {/* Anteprima e validazione in tempo reale */}
            {esitoValidazioneCSV ? (
              <View style={styles.bloccoAnteprimaValidazione}>
                <View style={styles.riepilogoQuadraturaCSV}>
                  <View style={styles.rigaQuadratura}>
                    <Text style={[textStyle('secondary', breakpoint)]}>Totale millesimi importati:</Text>
                    <Text
                      style={[
                        textStyle('h3', breakpoint),
                        esitoValidazioneCSV.isQuadrata ? styles.sommaValida : styles.sommaInvalida,
                      ]}
                    >
                      {esitoValidazioneCSV.sommaMillesimi.toFixed(3)} ‰
                    </Text>
                  </View>

                  <Badge
                    status={esitoValidazioneCSV.isQuadrata ? 'success' : 'error'}
                    label={
                      esitoValidazioneCSV.isQuadrata
                        ? 'Quadrata a 1000 ‰'
                        : `Disavanzo: ${esitoValidazioneCSV.disavanzo > 0 ? '+' : ''}${esitoValidazioneCSV.disavanzo.toFixed(3)} ‰`
                    }
                  />
                </View>

                {esitoValidazioneCSV.erroriGlobali.length > 0 ? (
                  <Alert
                    tone={esitoValidazioneCSV.isQuadrata ? 'warning' : 'error'}
                    title="Avvisi di validazione"
                    message={esitoValidazioneCSV.erroriGlobali.join('\n')}
                  />
                ) : null}

                {/* Tabella anteprima righe */}
                <Text style={[textStyle('h4', breakpoint), styles.titoloAnteprima]}>
                  Anteprima righe ({esitoValidazioneCSV.righeValide} valide su {esitoValidazioneCSV.totaleRighe})
                </Text>

                <View style={styles.tabellaRigheCSV}>
                  <View style={styles.testataRigheCSV}>
                    <Text style={[textStyle('label', breakpoint), styles.colRigaNum]}>Riga</Text>
                    <Text style={[textStyle('label', breakpoint), styles.colRigaScala]}>Scala</Text>
                    <Text style={[textStyle('label', breakpoint), styles.colRigaInterno]}>Interno</Text>
                    <Text style={[textStyle('label', breakpoint), styles.colRigaQuota]}>Quota (‰)</Text>
                    <Text style={[textStyle('label', breakpoint), styles.colRigaEsito]}>Esito</Text>
                  </View>

                  {esitoValidazioneCSV.righe.map((riga) => (
                    <View
                      key={riga.rigaNumero}
                      style={[styles.rigaAnteprimaCSV, !riga.valido && styles.rigaAnteprimaErrore]}
                    >
                      <Text style={[textStyle('body', breakpoint), styles.colRigaNum]}>
                        #{riga.rigaNumero}
                      </Text>
                      <Text style={[textStyle('body', breakpoint), styles.colRigaScala]}>
                        {riga.scala || '—'}
                      </Text>
                      <Text style={[textStyle('body', breakpoint), styles.colRigaInterno]}>
                        {riga.interno || '—'}
                      </Text>
                      <Text style={[textStyle('h4', breakpoint), styles.colRigaQuota]}>
                        {riga.valoreMillesimale.toFixed(3)} ‰
                      </Text>
                      <View style={styles.colRigaEsito}>
                        {riga.valido ? (
                          <Badge status="success" label="Valida" />
                        ) : (
                          <View style={styles.bloccoErroreRiga}>
                            <Badge status="error" label="Errore" />
                            <Text style={[textStyle('secondary', breakpoint), styles.messaggioErroreRiga]}>
                              {riga.errori.join(', ')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
      </Modal>

      {/* ==================================================================== */}
      {/* MODALE AGGIUNGI EDIFICIO */}
      {/* ==================================================================== */}
      <Modal
        visible={modalePalazzoAperta}
        onClose={() => setModalePalazzoAperta(false)}
        title="Aggiungi nuovo edificio o palazzo"
        description="Inserisci il nome identificativo e l'indirizzo dell'edificio."
        dismissible={!salvataggioPalazzoInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModalePalazzoAperta(false)}
              disabled={salvataggioPalazzoInCorso}
            />
            <Button
              variant="primary"
              label="Crea edificio"
              icon="check"
              onPress={salvaNuovoPalazzo}
              disabled={!nomeNuovoPalazzo.trim() || salvataggioPalazzoInCorso}
              loading={salvataggioPalazzoInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          <Input
            label="Nome identificativo *"
            placeholder="Es. Palazzo C, Edificio Centrale..."
            value={nomeNuovoPalazzo}
            onChangeText={setNomeNuovoPalazzo}
            disabled={salvataggioPalazzoInCorso}
          />
          <Input
            label="Indirizzo (opzionale)"
            placeholder="Es. Via Roma 12 / Scala interna"
            value={indirizzoNuovoPalazzo}
            onChangeText={setIndirizzoNuovoPalazzo}
            disabled={salvataggioPalazzoInCorso}
          />
        </View>
      </Modal>

      {/* ==================================================================== */}
      {/* MODALE CREA / MODIFICA UNITA' */}
      {/* ==================================================================== */}
      <Modal
        visible={modaleUnitaAperta}
        onClose={() => setModaleUnitaAperta(false)}
        title={unitaInModifica ? `Modifica Unità Int. ${unitaInModifica.interno}` : 'Nuova unità immobiliare'}
        description="Definisci i parametri dell'unità immobiliare, piano, superficie e destinazione d'uso."
        dismissible={!salvataggioUnitaInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleUnitaAperta(false)}
              disabled={salvataggioUnitaInCorso}
            />
            <Button
              variant="primary"
              label={unitaInModifica ? 'Salva modifiche' : 'Crea unità'}
              icon="check"
              onPress={salvaUnita}
              disabled={salvataggioUnitaInCorso}
              loading={salvataggioUnitaInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
            {erroreFormUnita ? <Alert tone="error" message={erroreFormUnita} /> : null}

            <Select
              label="Edificio / Palazzo *"
              options={opzioniPalazziSelect}
              value={palazzoSelezionatoId}
              onChange={setPalazzoSelezionatoId}
              disabled={salvataggioUnitaInCorso}
            />

            <Select
              label="Scala o Colonna"
              options={opzioniScaleSelect}
              value={scalaSelezionataId}
              onChange={setScalaSelezionataId}
              disabled={salvataggioUnitaInCorso}
            />

            <Select
              label="Destinazione d'uso / Tipologia *"
              options={opzioniTipologieSelect}
              value={tipologiaSelezionataId}
              onChange={setTipologiaSelezionataId}
              disabled={salvataggioUnitaInCorso}
            />

            <View style={styles.rigaCampiDoppia}>
              <View style={styles.campoMezzo}>
                <Input
                  label="Numero Interno *"
                  placeholder="Es. 1, 2, B1..."
                  value={internoInput}
                  onChangeText={setInternoInput}
                  disabled={salvataggioUnitaInCorso}
                />
              </View>
              <View style={styles.campoMezzo}>
                <Input
                  label="Piano"
                  placeholder="Es. 1, 2, -1..."
                  value={pianoInput}
                  onChangeText={setPianoInput}
                  disabled={salvataggioUnitaInCorso}
                />
              </View>
            </View>

            <Input
              label="Superficie calpestabile (mq)"
              placeholder="Es. 85,50"
              value={mqInput}
              onChangeText={setMqInput}
              disabled={salvataggioUnitaInCorso}
            />

            <Text style={[textStyle('label', breakpoint), styles.sezioneCatastaleTitolo]}>
              Identificativi catastali (opzionali):
            </Text>

            <View style={styles.rigaCampiTripla}>
              <View style={styles.campoTerzo}>
                <Input
                  label="Foglio"
                  placeholder="Es. 42"
                  value={foglioInput}
                  onChangeText={setFoglioInput}
                  disabled={salvataggioUnitaInCorso}
                />
              </View>
              <View style={styles.campoTerzo}>
                <Input
                  label="Particella"
                  placeholder="Es. 120"
                  value={particellaInput}
                  onChangeText={setParticellaInput}
                  disabled={salvataggioUnitaInCorso}
                />
              </View>
              <View style={styles.campoTerzo}>
                <Input
                  label="Subalterno"
                  placeholder="Es. 4"
                  value={subalternoInput}
                  onChangeText={setSubalternoInput}
                  disabled={salvataggioUnitaInCorso}
                />
              </View>
            </View>
          </View>
      </Modal>

      {/* ==================================================================== */}
      {/* MODALE DETTAGLIO UNITA' */}
      {/* ==================================================================== */}
      <Modal
        visible={unitaDettaglio !== null}
        onClose={() => setUnitaDettaglio(null)}
        title={unitaDettaglio ? `Dettaglio Unità Int. ${unitaDettaglio.interno}` : 'Dettaglio unità'}
        description="Informazioni catastali, anagrafiche e residenti attivi."
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Chiudi"
              onPress={() => setUnitaDettaglio(null)}
            />
            {unitaDettaglio ? (
              <Button
                variant="primary"
                label="Modifica dati"
                icon="pencil"
                onPress={() => {
                  const target = unitaDettaglio;
                  setUnitaDettaglio(null);
                  apriModaleModificaUnita(target);
                }}
              />
            ) : null}
          </ModalActions>
        }
      >
        {unitaDettaglio ? (
          <View style={styles.dettaglioUnitaCorpo}>
            <View style={styles.schedaDettaglio}>
              <View style={styles.rigaDettaglio}>
                <Text style={styles.etichettaDettaglio}>Edificio:</Text>
                <Text style={styles.valoreDettaglio}>{unitaDettaglio.palazzoNome}</Text>
              </View>
              <View style={styles.rigaDettaglio}>
                <Text style={styles.etichettaDettaglio}>Scala / Colonna:</Text>
                <Text style={styles.valoreDettaglio}>{unitaDettaglio.scalaNome || 'Generale'}</Text>
              </View>
              <View style={styles.rigaDettaglio}>
                <Text style={styles.etichettaDettaglio}>Tipologia:</Text>
                <Text style={styles.valoreDettaglio}>{unitaDettaglio.tipologiaDescrizione}</Text>
              </View>
              <View style={styles.rigaDettaglio}>
                <Text style={styles.etichettaDettaglio}>Piano:</Text>
                <Text style={styles.valoreDettaglio}>
                  {unitaDettaglio.piano !== null ? unitaDettaglio.piano : 'Non specificato'}
                </Text>
              </View>
              <View style={styles.rigaDettaglio}>
                <Text style={styles.etichettaDettaglio}>Superficie:</Text>
                <Text style={styles.valoreDettaglio}>
                  {unitaDettaglio.mq !== null ? `${unitaDettaglio.mq} mq` : 'Non specificata'}
                </Text>
              </View>
              <View style={styles.rigaDettaglio}>
                <Text style={styles.etichettaDettaglio}>Dati catastali:</Text>
                <Text style={styles.valoreDettaglio}>
                  {unitaDettaglio.foglioCatastale
                    ? `Foglio ${unitaDettaglio.foglioCatastale}, Part. ${unitaDettaglio.particella || '—'}, Sub. ${unitaDettaglio.subalterno || '—'}`
                    : 'Non inseriti'}
                </Text>
              </View>
            </View>

            <View style={styles.schedaDettaglioResidente}>
              <Text style={[textStyle('h4', breakpoint), styles.titoloDettaglioResidente]}>
                Anagrafica residente attivo
              </Text>
              {unitaDettaglio.residenteAttivo ? (
                <View style={styles.infoResidenteAttivo}>
                  <View style={styles.rigaDettaglio}>
                    <Text style={styles.etichettaDettaglio}>Nominativo:</Text>
                    <Text style={styles.valoreDettaglio}>
                      {unitaDettaglio.residenteAttivo.nomeCognome}
                    </Text>
                  </View>
                  <View style={styles.rigaDettaglio}>
                    <Text style={styles.etichettaDettaglio}>Tipo possesso:</Text>
                    <Badge
                      status={unitaDettaglio.residenteAttivo.tipoPossesso === 'PROPRIETARIO' ? 'success' : 'info'}
                      label={unitaDettaglio.residenteAttivo.tipoPossesso === 'PROPRIETARIO' ? 'Proprietario' : 'Inquilino'}
                    />
                  </View>
                  {unitaDettaglio.residenteAttivo.telefono ? (
                    <View style={styles.rigaDettaglio}>
                      <Text style={styles.etichettaDettaglio}>Telefono:</Text>
                      <Text style={styles.valoreDettaglio}>
                        {unitaDettaglio.residenteAttivo.telefono}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.rigaDettaglio}>
                    <Text style={styles.etichettaDettaglio}>Quota possesso:</Text>
                    <Text style={styles.valoreDettaglio}>
                      {unitaDettaglio.residenteAttivo.quotaPossesso}%
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[textStyle('secondary', breakpoint), styles.nessunResidente]}>
                  Nessun condomino o residente attivo registrato per questa unità immobiliare.
                </Text>
              )}
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    width: '100%',
    padding: space[4],
    gap: space[5],
  },
  barraAzioniPrimarie: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    alignItems: 'center',
  },
  grigliaStatCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
    width: '100%',
  },
  colonnaStatCard: {
    flex: 1,
    minWidth: 260,
  },
  contenutoTab: {
    gap: space[5],
    paddingTop: space[2],
  },
  barraStrumenti: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtroSearchBar: {
    flex: 1,
    minWidth: 260,
  },
  filtroChipsContenitore: {
    flexShrink: 0,
  },
  palazzoCorpo: {
    gap: space[5],
  },
  rigaRiepilogoEdificio: {
    flexDirection: 'row',
    gap: space[2],
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sezioneScala: {
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
    paddingTop: space[4],
    gap: space[3],
  },
  intestazioneScala: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  iconaScala: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.tile.navy.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titoloScala: {
    color: colors.brand.navy,
  },
  conteggioScala: {
    color: colors.text.muted,
  },
  tabellaUnita: {
    gap: space[2],
  },
  rigaUnita: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: space[3],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[3],
  },
  infoPrincipaleUnita: {
    flex: 1,
    minWidth: 260,
    gap: space[1],
  },
  rigaIdentificativo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  badgeInterno: {
    backgroundColor: colors.tile.blue.background,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.sm,
  },
  testoBadgeInterno: {
    color: colors.tile.blue.foreground,
    fontWeight: '700',
  },
  tipologiaUnita: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  dettagliSpaziali: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
  },
  testoSpaziale: {
    color: colors.text.secondary,
  },
  badgeResidente: {
    flexShrink: 0,
  },
  azioniUnita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  corpoTabellaMillesimi: {
    gap: space[4],
  },
  barraStatoQuadratura: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: space[3],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[2],
  },
  infoSommaMillesimi: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  etichettaSomma: {
    color: colors.text.secondary,
  },
  valoreSomma: {
    color: colors.brand.navy,
  },
  listaQuote: {
    gap: space[1],
  },
  testataTabellaQuote: {
    flexDirection: 'row',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  colQuoteUnita: {
    flex: 1.2,
    minWidth: 100,
  },
  colQuoteEdificio: {
    flex: 1.2,
    minWidth: 100,
  },
  colQuoteValore: {
    flex: 1,
    minWidth: 90,
    textAlign: 'right',
  },
  colQuotePercentuale: {
    flex: 0.8,
    minWidth: 70,
    textAlign: 'right',
  },
  rigaQuota: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  testoUnitaQuota: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  testoTipologiaQuota: {
    fontSize: 12,
    color: colors.text.muted,
  },
  testoSubEdificio: {
    color: colors.text.muted,
  },
  testoMillesimi: {
    color: colors.action.default,
    textAlign: 'right',
  },
  testoPercentuale: {
    color: colors.text.secondary,
    textAlign: 'right',
  },
  rigaVuotaQuote: {
    padding: space[4],
    alignItems: 'center',
  },
  testoRigaVuota: {
    color: colors.text.muted,
  },
  corpoModaleCSV: {
    gap: space[4],
    paddingBottom: space[2],
  },
  bloccoAzioniTemplate: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    alignItems: 'center',
  },
  contenitoreInputFileWeb: {
    flexShrink: 0,
  },
  bloccoAnteprimaValidazione: {
    gap: space[3],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
    paddingTop: space[4],
  },
  riepilogoQuadraturaCSV: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: space[3],
    borderRadius: radii.card,
    gap: space[2],
  },
  rigaQuadratura: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
  },
  sommaValida: {
    color: colors.semantic.success.foreground,
  },
  sommaInvalida: {
    color: colors.semantic.error.foreground,
  },
  titoloAnteprima: {
    color: colors.text.primary,
  },
  tabellaRigheCSV: {
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  testataRigheCSV: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: space[2],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  colRigaNum: {
    width: 50,
  },
  colRigaScala: {
    flex: 1,
    minWidth: 70,
  },
  colRigaInterno: {
    flex: 1,
    minWidth: 70,
  },
  colRigaQuota: {
    flex: 1.2,
    minWidth: 90,
  },
  colRigaEsito: {
    flex: 1.5,
    minWidth: 100,
  },
  rigaAnteprimaCSV: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[2],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  rigaAnteprimaErrore: {
    backgroundColor: colors.semantic.error.background,
  },
  bloccoErroreRiga: {
    gap: space[1],
  },
  messaggioErroreRiga: {
    color: colors.semantic.error.foreground,
    fontSize: 11,
  },
  formModale: {
    gap: space[3],
    paddingBottom: space[2],
  },
  rigaCampiDoppia: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  campoMezzo: {
    flex: 1,
    minWidth: 140,
  },
  rigaCampiTripla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  campoTerzo: {
    flex: 1,
    minWidth: 90,
  },
  sezioneCatastaleTitolo: {
    color: colors.text.secondary,
    marginTop: space[2],
  },
  dettaglioUnitaCorpo: {
    gap: space[4],
    paddingVertical: space[2],
  },
  schedaDettaglio: {
    backgroundColor: colors.background,
    padding: space[4],
    borderRadius: radii.card,
    gap: space[2],
  },
  rigaDettaglio: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
  },
  etichettaDettaglio: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  valoreDettaglio: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  schedaDettaglioResidente: {
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
    paddingTop: space[3],
    gap: space[3],
  },
  titoloDettaglioResidente: {
    color: colors.brand.navy,
  },
  infoResidenteAttivo: {
    gap: space[2],
    backgroundColor: colors.background,
    padding: space[3],
    borderRadius: radii.card,
  },
  nessunResidente: {
    color: colors.text.muted,
  },
});
