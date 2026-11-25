import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  type StrutturaAdminData,
  type UnitaDettaglioView,
  type TabellaMillesimaleDettaglioView,
  type PalazzoGruppoView,
  type ScalaGruppoView,
  type CondominoDisponibile,
  arrotonda3,
} from '@iocondo/data';
import {
  DatePicker,
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
  Tabs,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  touchTarget,
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


// Il campo data lavora con oggetti Date (gg/mm/aaaa a video); lo stato resta in formato ISO.
const daIso = (testo: string): Date | null => {
  const t = (testo || '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const it = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (it) return new Date(Number(it[3]), Number(it[2]) - 1, Number(it[1]));
  return null;
};
const aIso = (data: Date | null): string =>
  data
    ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
    : '';

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

  // Stato espansione accordion tabelle millesimali
  const [tabelleEspanse, setTabelleEspanse] = useState<Record<string, boolean>>({});
  const [tabellaDaEliminare, setTabellaDaEliminare] = useState<TabellaMillesimaleDettaglioView | null>(null);

  const toggleTabellaEspansa = (tabellaId: string) => {
    setTabelleEspanse((prev) => ({ ...prev, [tabellaId]: !prev[tabellaId] }));
  };

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
  }, [condominio?.id, services.struttura]);

  useEffect(() => {
    caricaDati();
  }, [caricaDati]);

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
    setQuotaPossessoInput(String(unita.residenteAttivo?.quotaPossesso ?? 100));
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
        tipoPossesso: tipoPossessoSelezionato === 'INQUILINO' ? 'INQUILINO' : 'PROPRIETARIO',
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
    } catch (err: unknown) {
      // Mostra il motivo reale (vincolo, permessi, unità duplicata…), non un messaggio generico.
      const dettaglio =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : '';
      console.error('Salvataggio unità non riuscito:', err);
      setErroreFormUnita(
        dettaglio ? `Salvataggio non riuscito: ${dettaglio}` : 'Salvataggio non riuscito. Riprova tra poco.',
      );
    } finally {
      setSalvataggioUnitaInCorso(false);
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
              <Card key={palazzo.id}>
                <View style={styles.palazzoCorpo}>
                  <View style={[styles.palazzoTesta, isMobile && styles.palazzoTestaMobile]}>
                    <View style={styles.palazzoNomi}>
                      <Text accessibilityRole="header" aria-level={2} style={[textStyle('h3', breakpoint), styles.palazzoNome]}>
                        {palazzo.nome}
                      </Text>
                      <Text style={[textStyle('secondary', breakpoint), styles.testoTenue]}>
                        {[palazzo.indirizzo, `${palazzo.totaleUnita} unità`, `${palazzo.totaleMq.toLocaleString('it-IT')} mq`].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    <View style={styles.azioniRapidePalazzo}>
                      <Button
                        variant="secondary"
                        icon="layers"
                        label="Aggiungi scala"
                        onPress={() => apriModaleNuovaScala(palazzo.id)}
                        accessibilityHint={`Aggiungi una scala o colonna in ${palazzo.nome}`}
                      />
                      <Button
                        variant="secondary"
                        icon="home"
                        label="Aggiungi unità"
                        onPress={() => apriModaleNuovaUnita(palazzo.id)}
                        accessibilityHint={`Aggiungi un'unità immobiliare in ${palazzo.nome}`}
                      />
                    </View>
                  </View>

                  {palazzo.scale.map((scala, idx) => (
                    <View key={scala.id || `gen-${idx}`} style={styles.sezioneScala}>
                      <Text accessibilityRole="header" aria-level={3} style={[textStyle('h4', breakpoint), styles.titoloScala]}>
                        {scala.nome}
                        <Text style={[textStyle('secondary', breakpoint), styles.testoTenue]}>
                          {`  ${scala.totaleUnita} unità`}
                        </Text>
                      </Text>

                      {scala.unita.length === 0 ? (
                        <Text style={[textStyle('secondary', breakpoint), styles.testoTenue]}>
                          Nessuna unità in questa scala. Aggiungila con «Aggiungi unità».
                        </Text>
                      ) : (
                        <View style={styles.sezionePalazzo}>
                          {raggruppaPerPiano(scala.unita).map(({ chiave, etichetta, unita: unitaPiano }) => (
                            <View key={chiave} style={[styles.piano, isMobile && styles.pianoMobile]}>
                              <View style={[styles.pianoEtichetta, isMobile && styles.pianoEtichettaMobile]}>
                                <Text style={[textStyle('label', breakpoint), styles.pianoTesto]}>{etichetta}</Text>
                              </View>
                              <View style={[styles.porte, isMobile && styles.porteMobile]}>
                                {unitaPiano.map((unita) => (
                                  <Porta key={unita.id} unita={unita} onPress={() => setUnitaDettaglio(unita)} />
                                ))}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}

                  <View style={styles.legenda}>
                    <Legenda colore={colors.semantic.success.foreground} testo="Proprietario" />
                    <Legenda colore={colors.semantic.info.foreground} testo="Inquilino" />
                    <Legenda colore={colors.borderStrong} testo="Nessun residente" tratteggio />
                  </View>
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
              const isEspansa = Boolean(tabelleEspanse[tabella.id]);
              const statoBadge = tabella.isQuadrata ? 'success' : 'error';
              const labelQuadratura = tabella.isQuadrata
                ? `Quadrata a ${tabella.totalePrevisto} ‰`
                : `Disavanzo da correggere: ${tabella.disavanzo > 0 ? '+' : ''}${tabella.disavanzo.toFixed(3)} ‰`;

              return (
                <Card key={tabella.id}>
                  <Pressable
                    onPress={() => toggleTabellaEspansa(tabella.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isEspansa }}
                    accessibilityLabel={tabella.nome}
                    accessibilityHint={
                      isEspansa
                        ? `Comprimi dettagli e quote di ${tabella.nome}`
                        : `Espandi dettagli e quote di ${tabella.nome}`
                    }
                    style={styles.accordionTabellaHeader}
                  >
                    <Text style={[textStyle('h3', breakpoint), styles.titoloAccordionTabella]}>
                      {tabella.nome}
                    </Text>
                    <Icon
                      name={isEspansa ? 'chevron-up' : 'chevron-down'}
                      size="action"
                      color={colors.text.secondary}
                    />
                  </Pressable>

                  {isEspansa ? (
                    <View style={styles.corpoTabellaMillesimi}>
                      {/* Azioni gestione tabella */}
                      <View style={styles.azioniTabellaMillesimi}>
                        <Button
                          variant="secondary"
                          icon="pencil"
                          label="Modifica"
                          onPress={() =>
                            router.push(('/admin/struttura/tabelle-millesimali/' + tabella.id) as Href)
                          }
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
                              Nessuna quota millesimale associata a questa tabella. Clicca su Modifica per compilarla o importare da CSV.
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
                  ) : null}
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
        title="Struttura"
        subtitle={condominio?.nome ? `Edifici, scale, unità e millesimi di ${condominio.nome}.` : 'Edifici, scale, unità e millesimi.'}
        action={{ label: 'Aggiungi edificio', icon: 'building-2', onPress: apriModalePalazzo }}
      />

      {/* Riepilogo: tre numeri e quanto del condominio ha un residente collegato */}
      <View style={[styles.riepilogo, isMobile && styles.riepilogoMobile]}>
        <View style={styles.riepilogoNumeri}>
          <Numero valore={dati.statistiche.totalePalazzi} etichetta={dati.statistiche.totalePalazzi === 1 ? 'edificio' : 'edifici'} />
          <Numero valore={dati.statistiche.totaleUnita} etichetta="unità" />
          <Numero valore={dati.statistiche.totaleMq.toLocaleString('it-IT')} etichetta="mq" />
        </View>
        <View style={[styles.occupazione, isMobile && styles.occupazioneMobile]}>
          <Text style={[textStyle('secondary', breakpoint), styles.occupazioneTesto]}>
            {dati.statistiche.residentiAssociati} unità su {dati.statistiche.totaleUnita} hanno un residente collegato
          </Text>
          <View
            style={styles.occupazioneBarra}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: dati.statistiche.totaleUnita, now: dati.statistiche.residentiAssociati }}
          >
            <View
              style={[
                styles.occupazioneRiempimento,
                {
                  width: `${dati.statistiche.totaleUnita > 0 ? Math.round((dati.statistiche.residentiAssociati / dati.statistiche.totaleUnita) * 100) : 0}%`,
                },
              ]}
            />
          </View>
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
                      key="residente"
                      variant="secondary"
                      label={unitaDettaglio.residenteAttivo ? 'Gestisci residente' : 'Collega residente'}
                      onPress={() => {
                        const target = unitaDettaglio;
                        setUnitaDettaglio(null);
                        apriModaleAssociaResidente(target);
                      }}
                    />,
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
                  {unitaDettaglio.residenteAttivo.accountEliminato ? (
                    <View style={styles.avvisoAccountEliminato}>
                      <Icon name="info" size="indicator" color={colors.text.secondary} />
                      <Text style={[textStyle('secondary', breakpoint), styles.testoAvvisoAccountEliminato]}>
                        Questa persona ha eliminato il proprio account: il nominativo resta come storico dell’unità.
                        Per un nuovo residente usa “Gestisci residente”.
                      </Text>
                    </View>
                  ) : null}
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
              <DatePicker
                label="Data decorrenza (inizio)"
                value={daIso(dataInizioInput)}
                onChange={(data) => setDataInizioInput(aIso(data))}
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

/** Etichetta del piano come si dice a voce. */
function nomePiano(piano: number | null): string {
  if (piano === null) return 'Piano non indicato';
  if (piano === 0) return 'Piano terra';
  if (piano < 0) return `Interrato ${Math.abs(piano)}`;
  return `${piano}° piano`;
}

/** Unità di una scala raggruppate per piano, dall'alto verso il basso (come la sezione di un palazzo). */
function raggruppaPerPiano(unita: UnitaDettaglioView[]) {
  const gruppi = new Map<string, { piano: number | null; unita: UnitaDettaglioView[] }>();
  for (const u of unita) {
    const chiave = u.piano === null ? 'nd' : String(u.piano);
    const g = gruppi.get(chiave) ?? { piano: u.piano, unita: [] };
    g.unita.push(u);
    gruppi.set(chiave, g);
  }
  const confronta = (x: string, y: string) => x.localeCompare(y, 'it', { numeric: true });
  return [...gruppi.entries()]
    .sort(([, a], [, b]) => {
      if (a.piano === null) return 1;
      if (b.piano === null) return -1;
      return b.piano - a.piano;
    })
    .map(([chiave, g]) => ({
      chiave,
      etichetta: nomePiano(g.piano),
      unita: [...g.unita].sort((a, b) => confronta(a.interno, b.interno)),
    }));
}

function Numero({ valore, etichetta }: { valore: number | string; etichetta: string }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.numero}>
      <Text style={styles.numeroValore}>{valore}</Text>
      <Text style={[textStyle('secondary', breakpoint), styles.testoTenue]}>{etichetta}</Text>
    </View>
  );
}

function Legenda({ colore, testo, tratteggio }: { colore: string; testo: string; tratteggio?: boolean }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.legendaVoce}>
      <View style={[styles.legendaSegno, { borderLeftColor: colore }, tratteggio && styles.legendaSegnoTratteggio]} />
      <Text style={[textStyle('support', breakpoint), styles.testoTenue]}>{testo}</Text>
    </View>
  );
}

/** Una "porta" della sezione: interno, tipologia e chi ci abita. Il bordo sinistro dice il tipo di possesso. */
function Porta({ unita, onPress }: { unita: UnitaDettaglioView; onPress: () => void }) {
  const { breakpoint } = useBreakpoint();
  const [hover, setHover] = useState(false);
  const r = unita.residenteAttivo;
  const colore = !r || r.accountEliminato
    ? colors.borderStrong
    : r.tipoPossesso === 'PROPRIETARIO'
      ? colors.semantic.success.foreground
      : colors.semantic.info.foreground;
  const chi = r
    ? `${r.nomeCognome}${r.accountEliminato ? ' (account eliminato)' : ''}`
    : 'Nessun residente';
  const possesso = r ? (r.tipoPossesso === 'PROPRIETARIO' ? 'proprietario' : 'inquilino') : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Interno ${unita.interno}, ${unita.tipologiaDescrizione}, ${nomePiano(unita.piano)}. ${chi}${possesso ? `, ${possesso}` : ''}`}
      accessibilityHint="Apre il dettaglio dell'unità"
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={(state) => [
        styles.porta,
        { borderLeftColor: colore },
        !r && styles.portaLibera,
        hover && styles.portaHover,
        (state as PressableStateCallbackType & { focused?: boolean }).focused && styles.portaFocus,
      ]}
    >
      <View style={styles.portaRiga}>
        <Text style={[textStyle('label', breakpoint), styles.portaInterno]}>Int. {unita.interno}</Text>
        {unita.mq !== null ? (
          <Text style={[textStyle('support', breakpoint), styles.testoTenue]}>{unita.mq} mq</Text>
        ) : null}
      </View>
      <Text style={[textStyle('support', breakpoint), styles.testoTenue]} numberOfLines={1}>
        {unita.tipologiaDescrizione}
      </Text>
      <Text
        style={[textStyle('secondary', breakpoint), r ? styles.portaChi : styles.portaChiVuoto]}
        numberOfLines={1}
      >
        {chi}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  riepilogo: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[6], flexWrap: 'wrap', paddingBottom: space[2] },
  riepilogoMobile: { flexDirection: 'column', alignItems: 'stretch', gap: space[4] },
  riepilogoNumeri: { flexDirection: 'row', gap: space[8], flexWrap: 'wrap' },
  numero: { gap: 2 },
  numeroValore: { ...textStyle('h1'), fontSize: 32, lineHeight: 36, color: colors.brand.navy, fontVariant: ['tabular-nums'] },
  occupazione: { gap: space[2], flexGrow: 1, flexShrink: 1, flexBasis: 280, maxWidth: 420 },
  // In colonna flexBasis diventa un'altezza (280 px vuoti): su smartphone conta solo il contenuto.
  occupazioneMobile: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', maxWidth: '100%' },
  occupazioneTesto: { color: colors.text.secondary },
  occupazioneBarra: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  occupazioneRiempimento: { height: '100%', backgroundColor: colors.semantic.success.foreground },
  palazzoTesta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[4], flexWrap: 'wrap' },
  palazzoTestaMobile: { flexDirection: 'column', alignItems: 'stretch' },
  palazzoNomi: { gap: space[1], flexShrink: 1, minWidth: 0 },
  palazzoNome: { color: colors.brand.navy },
  testoTenue: { color: colors.text.secondary },
  sezionePalazzo: { borderLeftWidth: 2, borderLeftColor: colors.brand.navy, borderRadius: 2 },
  piano: { flexDirection: 'row', alignItems: 'flex-start', gap: space[4], paddingVertical: space[3], paddingLeft: space[3], borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border },
  pianoMobile: { flexDirection: 'column', gap: space[2] },
  pianoEtichetta: { width: 120, paddingTop: space[3] },
  pianoEtichettaMobile: { width: 'auto', paddingTop: 0 },
  pianoTesto: { color: colors.text.secondary },
  porte: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  porteMobile: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  porta: {
    width: 200,
    minWidth: 0,
    maxWidth: '100%',
    flexGrow: 0,
    gap: 2,
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radii.control,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  portaLibera: { backgroundColor: colors.background, borderStyle: 'dashed' },
  portaHover: { borderColor: colors.borderStrong },
  portaFocus: { ...(Platform.OS === 'web' ? ({ outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: 2 } as object) : { borderColor: colors.focus }) },
  portaRiga: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] },
  portaInterno: { color: colors.text.primary },
  portaChi: { color: colors.text.primary, marginTop: space[1] },
  portaChiVuoto: { color: colors.text.muted, marginTop: space[1] },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: space[5], paddingTop: space[1] },
  legendaVoce: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  legendaSegno: { width: 4, height: 16, borderLeftWidth: 4 },
  legendaSegnoTratteggio: { borderStyle: 'dashed' },
  avvisoAccountEliminato: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[3],
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  testoAvvisoAccountEliminato: { color: colors.text.secondary, flexShrink: 1 },
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
    flexDirection: 'column',
    gap: space[4],
    alignItems: 'stretch',
  },
  filtroSearchBar: {
    alignSelf: 'stretch',
    width: '100%',
  },
  filtroChipsContenitore: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
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
    maxWidth: '100%',
    flexShrink: 1,
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
    minWidth: 200,
    maxWidth: '100%',
    gap: space[1],
  },
  rigaIdentificativo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
    maxWidth: '100%',
    flexShrink: 1,
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
  accordionTabellaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: touchTarget.control,
  },
  titoloAccordionTabella: {
    color: colors.brand.navy,
    flex: 1,
  },
});
