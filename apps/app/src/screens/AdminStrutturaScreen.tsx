import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  type StrutturaAdminData,
  type UnitaDettaglioView,
  type TabellaMillesimaleDettaglioView,
  type PalazzoGruppoView,
  type ScalaGruppoView,
  type RisultatoValidazioneCSV,
  type CondominoDisponibile,
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
  ConfirmDialog,
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
  const params = useLocalSearchParams<{ tab?: string }>();
  const { condominio } = useProfilo();
  const { breakpoint, isDesktop, isMobile } = useBreakpoint();
  const toast = useToast();

  const [dati, setDati] = useState<StrutturaAdminData | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);
  const [tabAttivo, setTabAttivo] = useState<'edifici' | 'millesimi'>(
    params.tab === 'millesimi' ? 'millesimi' : 'edifici'
  );

  useEffect(() => {
    if (params.tab === 'millesimi') {
      setTabAttivo('millesimi');
    } else if (params.tab === 'edifici') {
      setTabAttivo('edifici');
    }
  }, [params.tab]);

  // Filtri tab edifici
  const [filtroRicerca, setFiltroRicerca] = useState('');
  const [filtroPalazzo, setFiltroPalazzo] = useState<string>('tutti');

  // Modali
  const [modalePalazzoAperta, setModalePalazzoAperta] = useState(false);
  const [nomeNuovoPalazzo, setNomeNuovoPalazzo] = useState('');
  const [indirizzoNuovoPalazzo, setIndirizzoNuovoPalazzo] = useState('');
  const [salvataggioPalazzoInCorso, setSalvataggioPalazzoInCorso] = useState(false);
  const [erroreFormPalazzo, setErroreFormPalazzo] = useState<string | null>(null);

  // Modale Scala / Colonna
  const [modaleScalaAperta, setModaleScalaAperta] = useState(false);
  const [palazzoScalaId, setPalazzoScalaId] = useState('');
  const [tipoScala, setTipoScala] = useState<'SCALA' | 'COLONNA'>('SCALA');
  const [nomeNuovaScala, setNomeNuovaScala] = useState('');
  const [salvataggioScalaInCorso, setSalvataggioScalaInCorso] = useState(false);
  const [erroreFormScala, setErroreFormScala] = useState<string | null>(null);

  // Modale Unità
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
  const [condominoUnitaId, setCondominoUnitaId] = useState('');
  const [tipoPossessoUnita, setTipoPossessoUnita] = useState<'PROPRIETARIO' | 'INQUILINO' | 'USUFRUTTUARIO'>('PROPRIETARIO');
  const [quotaPossessoUnita, setQuotaPossessoUnita] = useState('100');
  const [dataInizioUnita, setDataInizioUnita] = useState('');
  const [salvataggioUnitaInCorso, setSalvataggioUnitaInCorso] = useState(false);
  const [erroreFormUnita, setErroreFormUnita] = useState<string | null>(null);

  // Modale Residente / Condomino
  const [modaleResidenteAperta, setModaleResidenteAperta] = useState(false);
  const [unitaResidenteTarget, setUnitaResidenteTarget] = useState<UnitaDettaglioView | null>(null);
  const [condominiDisponibili, setCondominiDisponibili] = useState<CondominoDisponibile[]>([]);
  const [caricamentoCondomini, setCaricamentoCondomini] = useState(false);
  const [utenteSelezionatoId, setUtenteSelezionatoId] = useState('');
  const [tipoPossessoSelezionato, setTipoPossessoSelezionato] = useState<'PROPRIETARIO' | 'INQUILINO' | 'USUFRUTTUARIO'>('PROPRIETARIO');
  const [quotaPossessoInput, setQuotaPossessoInput] = useState('100');
  const [dataInizioInput, setDataInizioInput] = useState('');
  const [salvataggioResidenteInCorso, setSalvataggioResidenteInCorso] = useState(false);
  const [erroreFormResidente, setErroreFormResidente] = useState<string | null>(null);

  const [unitaDettaglio, setUnitaDettaglio] = useState<UnitaDettaglioView | null>(null);

  // Modale Import Millesimi CSV (UC-09)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modaleCSVAperta, setModaleCSVAperta] = useState(false);
  const [tabellaCSVSelezionataId, setTabellaCSVSelezionataId] = useState<string>('');
  const [testoCSV, setTestoCSV] = useState('');
  const [esitoValidazioneCSV, setEsitoValidazioneCSV] = useState<RisultatoValidazioneCSV | null>(null);
  const [importazioneInCorso, setImportazioneInCorso] = useState(false);
  const [erroreImportCSV, setErroreImportCSV] = useState<string | null>(null);

  const [tabellaDaEliminare, setTabellaDaEliminare] = useState<TabellaMillesimaleDettaglioView | null>(null);

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
        setTabellaCSVSelezionataId(res.tabelle[0]!.id);
      }
      try {
        const condomini = await services.struttura.listCondominiDisponibili(condominio.id);
        setCondominiDisponibili(condomini);
      } catch {
        // Fallback lista condomini
      }
    } catch {
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id, tabellaCSVSelezionataId, services.struttura]);

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

  const opzioniTipoScala: SelectOption[] = useMemo(
    () => [
      { value: 'SCALA', label: 'Scala' },
      { value: 'COLONNA', label: 'Colonna' },
    ],
    []
  );

  const opzioniTipoPossesso: SelectOption[] = useMemo(
    () => [
      { value: 'PROPRIETARIO', label: 'Proprietario' },
      { value: 'INQUILINO', label: 'Inquilino / Affittuario' },
      { value: 'USUFRUTTUARIO', label: 'Usufruttuario' },
    ],
    []
  );

  const opzioniCondominiSelect: SelectOption[] = useMemo(() => {
    if (condominiDisponibili.length === 0) {
      return [
        {
          value: '',
          label: caricamentoCondomini ? 'Caricamento residenti...' : 'Nessun condòmino registrato',
        },
      ];
    }
    return condominiDisponibili.map((c) => ({
      value: c.id,
      label: `${c.nomeCognome}${c.email ? ` (${c.email})` : ''}`,
    }));
  }, [condominiDisponibili, caricamentoCondomini]);

  const opzioniCondominiPerUnitaSelect: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      {
        value: '',
        label: 'Nessun condòmino (assegna in seguito)',
      },
    ];
    for (const c of condominiDisponibili) {
      list.push({
        value: c.id,
        label: `${c.nomeCognome}${c.email ? ` (${c.email})` : ''}`,
      });
    }
    return list;
  }, [condominiDisponibili]);

  // Gestione creazione Palazzo
  const apriModalePalazzo = () => {
    setNomeNuovoPalazzo('');
    setIndirizzoNuovoPalazzo('');
    setErroreFormPalazzo(null);
    setModalePalazzoAperta(true);
  };

  const salvaNuovoPalazzo = async () => {
    if (!condominio?.id || !nomeNuovoPalazzo.trim()) {
      setErroreFormPalazzo('Il nome identificativo dell’edificio è obbligatorio.');
      return;
    }
    setSalvataggioPalazzoInCorso(true);
    setErroreFormPalazzo(null);
    try {
      await services.struttura.creaPalazzo({
        condominioId: condominio.id,
        nomeIdentificativo: nomeNuovoPalazzo.trim(),
        indirizzo: indirizzoNuovoPalazzo.trim() || null,
      });
      toast.show({
        message: `Palazzo "${nomeNuovoPalazzo.trim()}" creato con successo.`,
        tone: 'success',
      });
      setModalePalazzoAperta(false);
      caricaDati();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la creazione del palazzo.';
      setErroreFormPalazzo(msg);
    } finally {
      setSalvataggioPalazzoInCorso(false);
    }
  };

  // Gestione creazione Scala / Colonna
  const apriModaleNuovaScala = (prefillPalazzoId?: string) => {
    setPalazzoScalaId(prefillPalazzoId || (dati?.palazzi[0]?.id ?? ''));
    setTipoScala('SCALA');
    setNomeNuovaScala('');
    setErroreFormScala(null);
    setModaleScalaAperta(true);
  };

  const salvaNuovaScala = async () => {
    if (!palazzoScalaId || !nomeNuovaScala.trim()) {
      setErroreFormScala('Edificio e nome identificativo della scala o colonna sono obbligatori.');
      return;
    }
    setSalvataggioScalaInCorso(true);
    setErroreFormScala(null);
    try {
      await services.struttura.creaScalaColonna({
        palazzoId: palazzoScalaId,
        nome: nomeNuovaScala.trim(),
        tipo: tipoScala,
      });
      toast.show({
        message: `${tipoScala === 'SCALA' ? 'Scala' : 'Colonna'} "${nomeNuovaScala.trim()}" creata con successo.`,
        tone: 'success',
      });
      setModaleScalaAperta(false);
      caricaDati();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la creazione della scala/colonna.';
      setErroreFormScala(msg);
    } finally {
      setSalvataggioScalaInCorso(false);
    }
  };

  // Gestione associazione Residente / Condòmino
  const apriModaleAssociaResidente = async (unita: UnitaDettaglioView) => {
    setUnitaResidenteTarget(unita);
    setUtenteSelezionatoId(unita.residenteAttivo?.utenteId || '');
    setTipoPossessoSelezionato(unita.residenteAttivo?.tipoPossesso || 'PROPRIETARIO');
    setQuotaPossessoInput('100');
    setDataInizioInput(new Date().toISOString().slice(0, 10));
    setErroreFormResidente(null);
    setModaleResidenteAperta(true);

    if (condominio?.id) {
      setCaricamentoCondomini(true);
      try {
        const lista = await services.struttura.listCondominiDisponibili(condominio.id);
        setCondominiDisponibili(lista);
        if (!unita.residenteAttivo && lista.length > 0) {
          setUtenteSelezionatoId(lista[0]!.id);
        }
      } catch {
        // Fallback lista vuota
      } finally {
        setCaricamentoCondomini(false);
      }
    }
  };

  const salvaAssociazioneResidente = async () => {
    if (!unitaResidenteTarget || !utenteSelezionatoId) {
      setErroreFormResidente('Seleziona un condòmino da associare.');
      return;
    }

    const quotaNum = parseFloat(quotaPossessoInput.replace(',', '.'));
    if (isNaN(quotaNum) || quotaNum <= 0 || quotaNum > 100) {
      setErroreFormResidente('La quota di possesso deve essere una percentuale compresa tra 1 e 100.');
      return;
    }

    setSalvataggioResidenteInCorso(true);
    setErroreFormResidente(null);

    try {
      await services.struttura.associaResidente({
        unitaId: unitaResidenteTarget.id,
        utenteId: utenteSelezionatoId,
        tipoPossesso: tipoPossessoSelezionato === 'PROPRIETARIO' ? 'PROPRIETARIO' : 'INQUILINO',
        quotaPossesso: quotaNum,
        dataInizio: dataInizioInput.trim() || undefined,
        condominioId: condominio?.id,
      });

      const utente = condominiDisponibili.find((u) => u.id === utenteSelezionatoId);
      toast.show({
        message: `Condòmino ${utente?.nomeCognome || ''} associato con successo all'Int. ${unitaResidenteTarget.interno}.`,
        tone: 'success',
      });
      setModaleResidenteAperta(false);
      if (unitaDettaglio?.id === unitaResidenteTarget.id) {
        setUnitaDettaglio(null);
      }
      caricaDati();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante l’associazione del residente.';
      setErroreFormResidente(msg);
    } finally {
      setSalvataggioResidenteInCorso(false);
    }
  };

  const terminaAssegnazioneResidente = async () => {
    if (!unitaResidenteTarget?.residenteAttivo?.id) return;
    setSalvataggioResidenteInCorso(true);
    setErroreFormResidente(null);

    try {
      await services.struttura.rimuoviResidente(unitaResidenteTarget.residenteAttivo.id);
      toast.show({
        message: `Assegnazione per Int. ${unitaResidenteTarget.interno} terminata con successo.`,
        tone: 'success',
      });
      setModaleResidenteAperta(false);
      if (unitaDettaglio?.id === unitaResidenteTarget.id) {
        setUnitaDettaglio(null);
      }
      caricaDati();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la chiusura dell’assegnazione.';
      setErroreFormResidente(msg);
    } finally {
      setSalvataggioResidenteInCorso(false);
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
    setCondominoUnitaId('');
    setTipoPossessoUnita('PROPRIETARIO');
    setQuotaPossessoUnita('100');
    setDataInizioUnita(new Date().toISOString().slice(0, 10));
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
    if (unita.residenteAttivo) {
      setCondominoUnitaId(unita.residenteAttivo.utenteId);
      setTipoPossessoUnita(unita.residenteAttivo.tipoPossesso);
      setQuotaPossessoUnita(String(unita.residenteAttivo.quotaPossesso ?? 100));
      setDataInizioUnita(new Date().toISOString().slice(0, 10));
    } else {
      setCondominoUnitaId('');
      setTipoPossessoUnita('PROPRIETARIO');
      setQuotaPossessoUnita('100');
      setDataInizioUnita(new Date().toISOString().slice(0, 10));
    }
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

    let infoResidente: {
      utenteId: string;
      tipoPossesso: 'PROPRIETARIO' | 'INQUILINO';
      quotaPossesso: number;
      dataInizio?: string;
    } | null = null;

    if (condominoUnitaId) {
      const quotaNum = parseFloat(quotaPossessoUnita.replace(',', '.'));
      if (isNaN(quotaNum) || quotaNum <= 0 || quotaNum > 100) {
        setErroreFormUnita('La quota di possesso del condòmino deve essere una percentuale compresa tra 1 e 100.');
        return;
      }
      infoResidente = {
        utenteId: condominoUnitaId,
        tipoPossesso: tipoPossessoUnita === 'PROPRIETARIO' ? 'PROPRIETARIO' : 'INQUILINO',
        quotaPossesso: quotaNum,
        dataInizio: dataInizioUnita.trim() || undefined,
      };
    }

    setSalvataggioUnitaInCorso(true);
    setErroreFormUnita(null);

    try {
      if (unitaInModifica) {
        await services.struttura.modificaUnita(unitaInModifica.id, {
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
          condominioId: condominio?.id,
          residente: infoResidente,
        });
        toast.show({
          message: `Unità ${internoInput.trim()} aggiornata con successo.`,
          tone: 'success',
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
          condominioId: condominio?.id,
          residente: infoResidente,
        });
        toast.show({
          message: `Unità ${internoInput.trim()} creata con successo.`,
          tone: 'success',
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
        toast.show({ message: 'Template CSV scaricato sul tuo dispositivo.', tone: 'info' });
        return;
      } catch {
        // Fallback: copia testo nell'input
      }
    }

    setTestoCSV(template);
    toast.show({
      message: 'Template CSV di esempio inserito nell’area di import.',
      tone: 'info',
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
        tone: 'success',
      });
      setModaleCSVAperta(false);
      caricaDati();
    } catch {
      setErroreImportCSV('Si è verificato un errore durante il salvataggio delle quote millesimali.');
    } finally {
      setImportazioneInCorso(false);
    }
  };

  const confermaEliminaTabella = async () => {
    if (!tabellaDaEliminare) return;
    const nomeEliminata = tabellaDaEliminare.nome;
    await services.struttura.eliminaTabellaMillesimale(tabellaDaEliminare.id);
    toast.show({
      message: `Tabella "${nomeEliminata}" eliminata.`,
      tone: 'success',
    });
    setTabellaDaEliminare(null);
    caricaDati();
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
        <LoadingState message="Caricamento struttura condominiale in corso..." />
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
          onRetry={caricaDati}
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
                action={{
                  label: '+ Nuova unità',
                  onPress: () => apriModaleNuovaUnita(palazzo.id),
                  accessibilityHint: `Aggiungi una nuova unità immobiliare nel ${palazzo.nome}`,
                }}
              >
                <View style={styles.palazzoCorpo}>
                  {/* Badge riepilogo edificio e azioni rapide */}
                  <View style={styles.rigaRiepilogoEdificio}>
                    <View style={styles.badgeEdificioGruppo}>
                      <Badge
                        status="info"
                        label={`${palazzo.totaleUnita} ${palazzo.totaleUnita === 1 ? 'Unità' : 'Unità'}`}
                      />
                      <Badge
                        status="neutral"
                        label={`${palazzo.totaleMq} mq complessivi`}
                      />
                    </View>
                    <View style={styles.azioniRapidePalazzo}>
                      <Button
                        variant="secondary"
                        icon="layers"
                        label="+ Nuova scala"
                        onPress={() => apriModaleNuovaScala(palazzo.id)}
                        accessibilityHint={`Aggiungi una nuova scala o colonna nel ${palazzo.nome}`}
                      />
                      <Button
                        variant="secondary"
                        icon="home"
                        label="+ Nuova unità"
                        onPress={() => apriModaleNuovaUnita(palazzo.id)}
                        accessibilityHint={`Aggiungi una nuova unità immobiliare nel ${palazzo.nome}`}
                      />
                    </View>
                  </View>

                  {/* Elenco Scale/Colonne */}
                  {palazzo.scale.map((scala, idx) => (
                    <View key={scala.id || `gen-${idx}`} style={styles.sezioneScala}>
                      <View style={styles.intestazioneScala}>
                        <View style={styles.iconaScala}>
                          <Icon name="layers" size="action" color={colors.brand.navy} />
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
                                  variant="secondary"
                                  icon={unita.residenteAttivo ? 'user-check' : 'user-plus'}
                                  label={unita.residenteAttivo ? 'Residente' : 'Associa'}
                                  onPress={() => apriModaleAssociaResidente(unita)}
                                  accessibilityHint={`${unita.residenteAttivo ? 'Gestisci o modifica residente' : 'Associa condòmino'} per interno ${unita.interno}`}
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
          <View style={styles.barraAzioniMillesimi}>
            <Button
              variant="primary"
              icon="plus"
              label="Nuova tabella millesimale"
              onPress={() => router.push('/admin/struttura/tabelle-millesimali/nuova' as Href)}
              accessibilityHint="Apre la pagina dedicata per creare una nuova tabella millesimale e compilare le quote"
            />
            <Button
              variant="secondary"
              icon="upload"
              label="Importa millesimi CSV"
              onPress={() => apriModaleCSV()}
              accessibilityHint="Importa le quote millesimali da un file CSV"
            />
          </View>

          {dati.tabelle.length === 0 ? (
            <Card>
              <EmptyState
                icon="calculator"
                title="Nessuna tabella millesimale presente"
                description="Crea la prima tabella millesimale per impostare la ripartizione dei costi e delle spese del condominio."
                action={{
                  label: 'Nuova tabella millesimale',
                  onPress: () => router.push('/admin/struttura/tabelle-millesimali/nuova' as Href),
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
                  action={{
                    label: 'Importa CSV quote',
                    icon: 'upload',
                    onPress: () => apriModaleCSV(tabella.id),
                    accessibilityHint: `Importa o sovrascrivi quote da CSV per ${tabella.nome}`,
                  }}
                >
                  <View style={styles.corpoTabellaMillesimi}>
                    {/* Azioni gestione tabella */}
                    <View style={styles.azioniTabellaMillesimi}>
                      <Button
                        variant="secondary"
                        icon="pencil"
                        label="Modifica"
                        onPress={() => router.push(('/admin/struttura/tabelle-millesimali/' + tabella.id) as Href)}
                        accessibilityHint={`Modifica impostazioni e quote di ${tabella.nome}`}
                      />
                      <Button
                        variant="destructive"
                        icon="trash-2"
                        label="Elimina tabella"
                        onPress={() => setTabellaDaEliminare(tabella)}
                        accessibilityHint={`Elimina la tabella millesimale ${tabella.nome}`}
                      />
                    </View>

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
        subtitle={`Gestione edifici, scale, unità immobiliari e ripartizione tabelle millesimali per ${condominio?.nome ?? ''}.`}
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
          icon="layers"
          label="Nuova scala"
          onPress={() => apriModaleNuovaScala()}
          accessibilityHint="Apre il modulo per inserire una nuova scala o colonna"
        />
        <Button
          variant="secondary"
          icon="home"
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    style={{ display: 'none' }}
                    onChange={caricaFileCSVWeb}
                  />
                  <Button
                    variant="secondary"
                    label="Sfoglia file CSV"
                    icon="upload"
                    onPress={() => fileInputRef.current?.click()}
                    accessibilityHint="Sfoglia e carica un file CSV dal tuo dispositivo"
                    disabled={importazioneInCorso}
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
          {erroreFormPalazzo ? <Alert tone="error" message={erroreFormPalazzo} /> : null}
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
      {/* MODALE AGGIUNGI SCALA / COLONNA */}
      {/* ==================================================================== */}
      <Modal
        visible={modaleScalaAperta}
        onClose={() => setModaleScalaAperta(false)}
        title="Aggiungi scala o colonna"
        description="Definisci una nuova scala o colonna per raggruppare le unità immobiliari dell'edificio."
        dismissible={!salvataggioScalaInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleScalaAperta(false)}
              disabled={salvataggioScalaInCorso}
            />
            <Button
              variant="primary"
              label="Crea scala"
              icon="check"
              onPress={salvaNuovaScala}
              disabled={!nomeNuovaScala.trim() || !palazzoScalaId || salvataggioScalaInCorso}
              loading={salvataggioScalaInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreFormScala ? <Alert tone="error" message={erroreFormScala} /> : null}
          <Select
            label="Edificio / Palazzo *"
            options={opzioniPalazziSelect}
            value={palazzoScalaId}
            onChange={setPalazzoScalaId}
            disabled={salvataggioScalaInCorso}
          />
          <Select
            label="Tipo *"
            options={opzioniTipoScala}
            value={tipoScala}
            onChange={(val) => setTipoScala(val as 'SCALA' | 'COLONNA')}
            disabled={salvataggioScalaInCorso}
          />
          <Input
            label="Nome identificativo *"
            placeholder="Es. Scala A, Scala B, Colonna Nord..."
            value={nomeNuovaScala}
            onChangeText={setNomeNuovaScala}
            disabled={salvataggioScalaInCorso}
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

            {/* Assegnazione condòmino (opzionale) */}
            <Text style={[textStyle('label', breakpoint), styles.sezioneCatastaleTitolo]}>
              Condòmino assegnato (opzionale):
            </Text>

            <Select
              label="Condòmino / Intestatario"
              options={opzioniCondominiPerUnitaSelect}
              value={condominoUnitaId}
              onChange={setCondominoUnitaId}
              disabled={salvataggioUnitaInCorso}
            />

            {condominoUnitaId ? (
              <View style={styles.rigaCampiDoppia}>
                <View style={styles.campoMezzo}>
                  <Select
                    label="Titolo di possesso *"
                    options={opzioniTipoPossesso}
                    value={tipoPossessoUnita}
                    onChange={(val) => setTipoPossessoUnita(val as 'PROPRIETARIO' | 'INQUILINO' | 'USUFRUTTUARIO')}
                    disabled={salvataggioUnitaInCorso}
                  />
                </View>
                <View style={styles.campoMezzo}>
                  <Input
                    label="Quota di possesso (%) *"
                    placeholder="100"
                    value={quotaPossessoUnita}
                    onChangeText={setQuotaPossessoUnita}
                    disabled={salvataggioUnitaInCorso}
                  />
                </View>
              </View>
            ) : null}
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
            {[
              <Button
                key="close"
                variant="secondary"
                label="Chiudi"
                onPress={() => setUnitaDettaglio(null)}
              />,
              ...(unitaDettaglio
                ? [
                    <Button
                      key="edit"
                      variant="primary"
                      label="Modifica dati"
                      icon="pencil"
                      onPress={() => {
                        const target = unitaDettaglio;
                        setUnitaDettaglio(null);
                        apriModaleModificaUnita(target);
                      }}
                    />,
                  ]
                : []),
            ]}
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
                  <View style={{ marginTop: space[2] }}>
                    <Button
                      variant="secondary"
                      icon="users"
                      label="Modifica / Subentro residente"
                      onPress={() => {
                        const target = unitaDettaglio;
                        setUnitaDettaglio(null);
                        apriModaleAssociaResidente(target);
                      }}
                      accessibilityHint="Apre il modulo per gestire o cambiare il residente attivo"
                    />
                  </View>
                </View>
              ) : (
                <View style={{ gap: space[3], alignItems: 'flex-start' }}>
                  <Text style={[textStyle('secondary', breakpoint), styles.nessunResidente]}>
                    Nessun condòmino o residente attivo registrato per questa unità immobiliare.
                  </Text>
                  <Button
                    variant="secondary"
                    icon="user-plus"
                    label="Assegna condòmino"
                    onPress={() => {
                      const target = unitaDettaglio;
                      setUnitaDettaglio(null);
                      apriModaleAssociaResidente(target);
                    }}
                    accessibilityHint="Apre il modulo per associare un condòmino a questa unità"
                  />
                </View>
              )}
            </View>
          </View>
        ) : null}
      </Modal>

      {/* ==================================================================== */}
      {/* MODALE ASSOCIA RESIDENTE / SUBENTRO (UC-11) */}
      {/* ==================================================================== */}
      <Modal
        visible={modaleResidenteAperta}
        onClose={() => setModaleResidenteAperta(false)}
        title={
          unitaResidenteTarget?.residenteAttivo
            ? `Gestione residente · Int. ${unitaResidenteTarget.interno}`
            : `Associa condòmino · Int. ${unitaResidenteTarget?.interno ?? ''}`
        }
        description="Seleziona il condòmino da associare all'unità e specifica il tipo di possesso e la data di decorrenza."
        dismissible={!salvataggioResidenteInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleResidenteAperta(false)}
              disabled={salvataggioResidenteInCorso}
            />
            <Button
              variant="primary"
              label="Salva associazione"
              icon="check"
              onPress={salvaAssociazioneResidente}
              disabled={!utenteSelezionatoId || salvataggioResidenteInCorso}
              loading={salvataggioResidenteInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreFormResidente ? <Alert tone="error" message={erroreFormResidente} /> : null}

          {unitaResidenteTarget ? (
            <View style={styles.riassuntoUnitaBox}>
              <Text style={[textStyle('body', breakpoint), styles.testoRiassuntoUnita]}>
                {unitaResidenteTarget.palazzoNome} · {unitaResidenteTarget.scalaNome || 'Generale'} · Interno {unitaResidenteTarget.interno} ({unitaResidenteTarget.tipologiaDescrizione})
              </Text>
            </View>
          ) : null}

          {unitaResidenteTarget?.residenteAttivo ? (
            <View style={styles.bloccoResidenteAttuale}>
              <Text style={[textStyle('label', breakpoint), { color: colors.text.secondary }]}>
                Residente attualmente assegnato:
              </Text>
              <View style={styles.rigaResidenteAttuale}>
                <Badge
                  status={unitaResidenteTarget.residenteAttivo.tipoPossesso === 'PROPRIETARIO' ? 'success' : 'info'}
                  label={unitaResidenteTarget.residenteAttivo.tipoPossesso === 'PROPRIETARIO' ? 'Proprietario' : 'Inquilino'}
                />
                <Text style={[textStyle('body', breakpoint), { fontWeight: '600', color: colors.text.primary }]}>
                  {unitaResidenteTarget.residenteAttivo.nomeCognome}
                </Text>
              </View>
              <Button
                variant="secondary"
                icon="user-x"
                label="Termina assegnazione attuale"
                onPress={terminaAssegnazioneResidente}
                disabled={salvataggioResidenteInCorso}
                accessibilityHint="Termina l'assegnazione attuale impostando la data di fine a oggi"
              />
              <Text style={[textStyle('secondary', breakpoint), { marginTop: space[2] }]}>
                Oppure seleziona un nuovo condòmino per registrare un subentro:
              </Text>
            </View>
          ) : null}

          <Select
            label="Condòmino da associare *"
            options={opzioniCondominiSelect}
            value={utenteSelezionatoId}
            onChange={setUtenteSelezionatoId}
            disabled={salvataggioResidenteInCorso || caricamentoCondomini}
          />

          <Select
            label="Tipo di possesso *"
            options={opzioniTipoPossesso}
            value={tipoPossessoSelezionato}
            onChange={(val) => setTipoPossessoSelezionato(val as 'PROPRIETARIO' | 'INQUILINO' | 'USUFRUTTUARIO')}
            disabled={salvataggioResidenteInCorso}
          />

          <View style={styles.rigaCampiDoppia}>
            <View style={styles.campoMezzo}>
              <Input
                label="Quota di possesso (%)"
                placeholder="Es. 100"
                value={quotaPossessoInput}
                onChangeText={setQuotaPossessoInput}
                disabled={salvataggioResidenteInCorso}
              />
            </View>
            <View style={styles.campoMezzo}>
              <Input
                label="Data decorrenza (inizio)"
                placeholder="AAAA-MM-GG"
                value={dataInizioInput}
                onChangeText={setDataInizioInput}
                disabled={salvataggioResidenteInCorso}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================================================================== */}
      {/* DIALOGO CONFERMA ELIMINAZIONE TABELLA MILLESIMALE */}
      {/* ==================================================================== */}
      <ConfirmDialog
        visible={tabellaDaEliminare !== null}
        title="Eliminare la tabella millesimale?"
        description={
          tabellaDaEliminare
            ? `La tabella "${tabellaDaEliminare.nome}" e tutte le relative quote millesimali saranno eliminate definitivamente.`
            : ''
        }
        confirmLabel="Elimina tabella"
        confirmLoadingLabel="Eliminazione in corso..."
        destructive
        onConfirm={confermaEliminaTabella}
        onCancel={() => setTabellaDaEliminare(null)}
      />
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
    justifyContent: 'space-between',
  },
  badgeEdificioGruppo: {
    flexDirection: 'row',
    gap: space[2],
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  azioniRapidePalazzo: {
    flexDirection: 'row',
    gap: space[2],
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  riassuntoUnitaBox: {
    padding: space[3],
    backgroundColor: colors.background,
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  testoRiassuntoUnita: {
    color: colors.brand.navy,
    fontWeight: '600',
  },
  bloccoResidenteAttuale: {
    gap: space[2],
    padding: space[3],
    backgroundColor: colors.background,
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  rigaResidenteAttuale: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
    flexWrap: 'wrap',
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
    borderRadius: radii.badge,
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
    borderRadius: radii.badge,
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
  barraAzioniMillesimi: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    alignItems: 'center',
  },
  azioniTabellaMillesimi: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    alignItems: 'center',
  },
  sezioneModaleTabella: {
    gap: space[3],
    paddingTop: space[2],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  titoloSezioneModale: {
    color: colors.brand.navy,
  },
  campoNomeTabella: {
    flex: 2,
    minWidth: 200,
  },
  campoTotaleTabella: {
    flex: 1,
    minWidth: 140,
  },
  boxSelezionePersonalizzata: {
    gap: space[2],
    padding: space[3],
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  testataSelezionePersonalizzata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  azioniRapidePersonalizzata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  listaCheckboxUnita: {
    gap: space[1],
  },
  intestazioneQuoteManuali: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  titoloQuoteManualiGroup: {
    flex: 1,
    minWidth: 180,
    gap: space[1],
  },
  sottotitoloQuoteManuali: {
    color: colors.text.secondary,
  },
  listaInputQuote: {
    gap: space[2],
  },
  rigaInputQuota: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    padding: space[3],
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  infoUnitaInputQuota: {
    flex: 1,
    minWidth: 160,
    gap: space[1],
  },
  campoValoreQuota: {
    width: 150,
    maxWidth: '100%',
  },
  boxQuadraturaRealTime: {
    gap: space[3],
    padding: space[4],
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.borderStrong,
  },
  rigaQuadraturaRealTime: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  testoSommaRealTime: {
    color: colors.brand.navy,
    fontWeight: '600',
  },
});
