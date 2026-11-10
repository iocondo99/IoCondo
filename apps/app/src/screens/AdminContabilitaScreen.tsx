import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
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
  Tabs,
  Textarea,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  useToast,
  type BadgeStatus,
  type BreadcrumbItem,
  type DataColumn,
  type FilterOption,
  type RadioOption,
  type SelectOption,
  type TabItem,
} from '@iocondo/ui';
import type {
  IBollettino,
  IBollettinoRiga,
  IConguaglioUnita,
  IEsercizioContabile,
  IPreventivo,
  IRataDettaglio,
  IRataTestata,
  IScadenziarioRecuperoCredito,
  ITabellaMillesimale,
  IVoceSpesaCatalogo,
} from '@iocondo/shared-types';
import {
  euroToCents,
  formattaCentsItaliano,
  formattaDataItaliana,
  validaCompletezzaRendiconto,
  VOCI_SPESA_CATALOGO_DEFAULT,
  type AnalisiMorositaCondominioOutput,
  type CriterioChiPaga,
  type FondoConSaldoEMovimentiView,
  type FornitoreAdminView,
  type MetodoPagamentoIncasso,
  type OpzioneUnitaManutenzione,
  type RiepilogoMorositaSoggetto,
  type RigaRegistroContabileView,
  type TagSpesa,
  type VoceScadenziarioRecuperoValutata,
} from '@iocondo/data';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

type TabKey = 'registro' | 'preventivi' | 'bollettini' | 'morosita' | 'rendiconto';

type ModaleAttiva =
  | null
  | 'registra-spesa'
  | 'storna-movimento'
  | 'nuovo-preventivo'
  | 'approva-preventivo'
  | 'emetti-rate'
  | 'registra-incasso'
  | 'dettaglio-bollettino'
  | 'dettaglio-generico';

interface VoceScadenziarioRecuperoRow {
  record: IScadenziarioRecuperoCredito;
  valutazione: VoceScadenziarioRecuperoValutata;
}

/** Riga selezionata in una tabella: il dettaglio si apre in una modale, senza pulsanti "Azione" in tabella. */
type DettaglioSelezionato =
  | { tipo: 'movimento'; riga: RigaRegistroContabileView }
  | { tipo: 'preventivo'; preventivo: IPreventivo }
  | { tipo: 'rata'; rata: IRataTestata }
  | { tipo: 'recupero'; voce: VoceScadenziarioRecuperoRow }
  | { tipo: 'debitore'; debitore: RiepilogoMorositaSoggetto }
  | { tipo: 'conguaglio'; conguaglio: IConguaglioUnita };

const OPZIONI_FILTRO_REGISTRO: readonly FilterOption[] = [
  { value: 'TUTTI', label: 'Tutti i movimenti' },
  { value: 'USCITE', label: 'Spese (-)' },
  { value: 'ENTRATE', label: 'Entrate (+)' },
  { value: 'STRAORDINARIA', label: 'Straordinarie' },
  { value: 'INCOMPLETI', label: 'Giustificativo incompleto' },
];

const OPZIONI_TAG_SPESA_RADIO: readonly RadioOption[] = [
  {
    value: 'ORDINARIA',
    label: 'Spesa Ordinaria',
    helperText: 'Manutenzione corrente, utenze, servizi continuativi del condominio.',
  },
  {
    value: 'STRAORDINARIA',
    label: 'Spesa Straordinaria',
    helperText: 'Opere straordinarie, innovazioni o interventi di notevole entità.',
  },
];

const OPZIONI_CHI_PAGA_SELECT: readonly SelectOption[] = [
  { value: 'TUTTI', label: 'Tutti i condòmini per millesimi (Tabella A / Proprietà)' },
  { value: 'TABELLA_SPECIFICA', label: 'Tabella millesimale specifica (es. Scale / Ascensore)' },
  { value: 'PALAZZO_SCALA', label: 'Solo condòmini di specifico Palazzo / Scala' },
  { value: 'PERSONALIZZATO', label: 'Deroga personalizzata / Addebito specifico' },
];

const OPZIONI_ORDINE_IMPUTAZIONE: readonly SelectOption[] = [
  { value: 'FIFO', label: 'Automatico dal debito più vecchio (FIFO ex art. 1193 c.c.)' },
  { value: 'LIFO', label: 'Dal debito più recente (LIFO)' },
];

const OPZIONI_METODO_INCASSO: readonly SelectOption[] = [
  { value: 'BONIFICO', label: 'Bonifico bancario su c/c condominiale' },
  { value: 'SDD', label: 'Addebito diretto SEPA (SDD)' },
  { value: 'CARTA', label: 'Carta di pagamento elettronico' },
  { value: 'PAY_BY_BANK', label: 'Pay by Bank / Open Banking' },
];

function oggiIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function badgeStatoBollettino(stato: string): { status: BadgeStatus; label: string } {
  switch (stato) {
    case 'PAGATO':
      return { status: 'pagato', label: 'Pagato' };
    case 'PARZIALMENTE_PAGATO':
      return { status: 'in-corso', label: 'Parz. pagato' };
    case 'EMESSO':
      return { status: 'da-pagare', label: 'Emesso' };
    case 'VERIFICATO':
      return { status: 'info', label: 'Verificato' };
    case 'RETTIFICATO':
      return { status: 'warning', label: 'Rettificato' };
    case 'ANNULLATO':
      return { status: 'annullata', label: 'Annullato' };
    default:
      return { status: 'neutral', label: 'Bozza' };
  }
}

function badgeStatoPreventivo(stato: string): { status: BadgeStatus; label: string } {
  switch (stato) {
    case 'APPROVATO':
      return { status: 'completato', label: 'Approvato' };
    case 'SUPERATO':
      return { status: 'chiuso', label: 'Superato' };
    default:
      return { status: 'in-attesa', label: 'Bozza' };
  }
}

function badgeStatoRecupero(stato: string): { status: BadgeStatus; label: string } {
  switch (stato) {
    case 'AVVIATO':
      return { status: 'in-lavorazione', label: 'Azione avviata' };
    case 'DISPENSATO':
      return { status: 'info', label: 'Dispensa assembleare' };
    case 'CHIUSO':
      return { status: 'completato', label: 'Chiuso' };
    default:
      return { status: 'warning', label: 'Da avviare' };
  }
}

export function AdminContabilitaScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Contabilità e Bilanci"
          subtitle="Gestione registro cronologico, preventivi, bollettini, recupero morosità e rendiconto."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminContabilitaContenuto />;
}

function AdminContabilitaContenuto() {
  const router = useRouter();
  const { profilo, condominio } = useProfilo();
  const toast = useToast();
  const params = useLocalSearchParams<{ tab?: string; dettaglioId?: string; id?: string }>();
  const targetId = params.dettaglioId || params.id;
  const targetTab = params.tab;

  // Stato caricamento e selezione esercizio
  const [caricamento, setCaricamento] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [esercizi, setEsercizi] = useState<IEsercizioContabile[]>([]);
  const [esercizioSelezionatoId, setEsercizioSelezionatoId] = useState<string>('');
  const [schedaAttiva, setSchedaAttiva] = useState<TabKey>('registro');

  // Dati contabili caricati dal dominio @iocondo/data
  const [vociCatalogo, setVociCatalogo] = useState<IVoceSpesaCatalogo[]>([]);
  const [tabelleMillesimali, setTabelleMillesimali] = useState<ITabellaMillesimale[]>([]);
  const [unitaCondominio, setUnitaCondominio] = useState<OpzioneUnitaManutenzione[]>([]);
  const [fornitori, setFornitori] = useState<FornitoreAdminView[]>([]);
  const [registro, setRegistro] = useState<RigaRegistroContabileView[]>([]);
  const [preventivi, setPreventivi] = useState<IPreventivo[]>([]);
  const [rateTestate, setRateTestate] = useState<IRataTestata[]>([]);
  const [rateDettagli, setRateDettagli] = useState<IRataDettaglio[]>([]);
  const [bollettini, setBollettini] = useState<IBollettino[]>([]);
  const [analisiMorosita, setAnalisiMorosita] = useState<AnalisiMorositaCondominioOutput | null>(
    null,
  );
  const [scadenziarioRecupero, setScadenziarioRecupero] = useState<VoceScadenziarioRecuperoRow[]>(
    [],
  );
  const [fondi, setFondi] = useState<FondoConSaldoEMovimentiView[]>([]);
  const [conguagli, setConguagli] = useState<IConguaglioUnita[]>([]);

  // Filtri scheda Registro & Spese
  const [ricercaRegistro, setRicercaRegistro] = useState('');
  const [filtroChipRegistro, setFiltroChipRegistro] = useState<readonly string[]>(['TUTTI']);
  const [filtroDataDa, setFiltroDataDa] = useState('');
  const [filtroDataA, setFiltroDataA] = useState('');

  // Filtri scheda Bollettini
  const [ricercaBollettini, setRicercaBollettini] = useState('');

  // Modale attiva (una sola modale aperta alla volta come da Sez. 13 Design System)
  const [modaleAttiva, setModaleAttiva] = useState<ModaleAttiva>(null);
  const [operazioneInCorso, setOperazioneInCorso] = useState(false);
  const [dettaglio, setDettaglio] = useState<DettaglioSelezionato | null>(null);

  // Stato Form Modale 1: "Registra spesa"
  const [spesaVoceCodice, setSpesaVoceCodice] = useState<string>(
    VOCI_SPESA_CATALOGO_DEFAULT[0]?.codice ?? 'PULIZIA_SCALE',
  );
  const [spesaDescrizione, setSpesaDescrizione] = useState('');
  const [spesaImportoEuro, setSpesaImportoEuro] = useState('');
  const [spesaDataPagamento, setSpesaDataPagamento] = useState(oggiIso());
  const [spesaTag, setSpesaTag] = useState<TagSpesa>('ORDINARIA');
  const [spesaChiPaga, setSpesaChiPaga] = useState<CriterioChiPaga>('TUTTI');
  const [spesaTabellaId, setSpesaTabellaId] = useState<string>('');
  const [spesaFornitoreId, setSpesaFornitoreId] = useState<string>('');
  const [spesaNumeroFattura, setSpesaNumeroFattura] = useState('');
  const [spesaDeliberaRif, setSpesaDeliberaRif] = useState('');
  const [spesaErroreForm, setSpesaErroreForm] = useState<string | null>(null);

  // Stato Form Modale "Storna movimento"
  const [movimentoDaStornare, setMovimentoDaStornare] = useState<RigaRegistroContabileView | null>(
    null,
  );
  const [motivoStornoInput, setMotivoStornoInput] = useState('');
  const [erroreStornoInput, setErroreStornoInput] = useState<string | undefined>(undefined);

  // Stato Form Modale 2: "Nuovo preventivo"
  const [prevImportoOrdinarioEuro, setPrevImportoOrdinarioEuro] = useState('');
  const [prevImportoPuliziaEuro, setPrevImportoPuliziaEuro] = useState('');
  const [prevImportoUtenzeEuro, setPrevImportoUtenzeEuro] = useState('');
  const [prevNoteInput, setPrevNoteInput] = useState('');
  const [prevErroreForm, setPrevErroreForm] = useState<string | null>(null);

  // Stato Form Modale "Approva preventivo"
  const [preventivoDaApprovare, setPreventivoDaApprovare] = useState<IPreventivo | null>(null);
  const [dataAssembleaPrevInput, setDataAssembleaPrevInput] = useState(oggiIso());
  const [deliberaPrevInput, setDeliberaPrevInput] = useState('');
  const [erroreApprovaPrev, setErroreApprovaPrev] = useState<string | null>(null);

  // Stato Form Modale "Emetti rate"
  const [ratePreventivoId, setRatePreventivoId] = useState<string>('');
  const [rateNumeroScadenze, setRateNumeroScadenze] = useState<string>('4');
  const [ratePrimaScadenza, setRatePrimaScadenza] = useState<string>(oggiIso());
  const [ratePubblicaSubito, setRatePubblicaSubito] = useState<boolean>(true);
  const [rateOverrideBozza, setRateOverrideBozza] = useState<boolean>(false);
  const [rateMotivoOverride, setRateMotivoOverride] = useState<string>('');
  const [rateErroreForm, setRateErroreForm] = useState<string | null>(null);

  // Stato Form Modale 3: "Registra incasso"
  const [incassoUnitaId, setIncassoUnitaId] = useState<string>('');
  const [incassoPagatoreNome, setIncassoPagatoreNome] = useState<string>('');
  const [incassoImportoEuro, setIncassoImportoEuro] = useState<string>('');
  const [incassoDataValuta, setIncassoDataValuta] = useState<string>(oggiIso());
  const [incassoMetodo, setIncassoMetodo] = useState<MetodoPagamentoIncasso>('BONIFICO');
  const [incassoCro, setIncassoCro] = useState<string>('');
  const [incassoCausale, setIncassoCausale] = useState<string>('');
  const [incassoOrdine, setIncassoOrdine] = useState<'FIFO' | 'LIFO'>('FIFO');
  const [incassoDaTerzo, setIncassoDaTerzo] = useState<boolean>(false);
  const [incassoErroreForm, setIncassoErroreForm] = useState<string | null>(null);

  // Stato Form Modale 4: "Dettaglio bollettino/rettifica"
  const [bollettinoSelezionato, setBollettinoSelezionato] = useState<IBollettino | null>(null);
  const [righeBollettinoSelezionato, setRigheBollettinoSelezionato] = useState<IBollettinoRiga[]>(
    [],
  );
  const [rettificaNuovoTotaleEuro, setRettificaNuovoTotaleEuro] = useState<string>('');
  const [rettificaMotivo, setRettificaMotivo] = useState<string>('');
  const [rettificaErrore, setRettificaErrore] = useState<string | null>(null);

  // Stato Nota sintetica esplicativa in scheda Rendiconto
  const [notaSinteticaInput, setNotaSinteticaInput] = useState<string>('');

  const esercizioAttivo = useMemo(
    () => esercizi.find((e) => e.id === esercizioSelezionatoId) ?? esercizi[0] ?? null,
    [esercizi, esercizioSelezionatoId],
  );

  const mappaUnitaLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of unitaCondominio) {
      map.set(u.id, u.label);
    }
    return map;
  }, [unitaCondominio]);

  // Caricamento completo dei dati contabili
  const caricaDati = useCallback(
    async (targetEsercizioId?: string) => {
      if (!condominio?.id) {
        setCaricamento(false);
        return;
      }
      setCaricamento(true);
      setErroreCaricamento(null);

      try {
        const [listaEsercizi, catalogo, tabelle, unitaList, fornitoriList, fondiList] =
          await Promise.all([
            services.rate.listEsercizi(condominio.id),
            services.contabilita.listVociCatalogo(condominio.id, true),
            services.rate.listTabelleMillesimali(condominio.id),
            services.manutenzione.listUnita(condominio.id),
            services.manutenzione.listFornitori(),
            services.contabilita.listFondi(condominio.id),
          ]);

        setEsercizi(listaEsercizi);
        setVociCatalogo(catalogo);
        setTabelleMillesimali(tabelle);
        setUnitaCondominio(unitaList);
        setFornitori(fornitoriList);
        setFondi(fondiList);

        if (tabelle.length > 0 && !spesaTabellaId) {
          setSpesaTabellaId(tabelle[0]?.id ?? '');
        }
        if (unitaList.length > 0 && !incassoUnitaId) {
          setIncassoUnitaId(unitaList[0]?.id ?? '');
        }

        const esCorrente =
          listaEsercizi.find((e) => e.id === (targetEsercizioId || esercizioSelezionatoId)) ??
          listaEsercizi.find((e) => e.stato_modello === 'APERTO' || e.stato !== 'CHIUSO') ??
          listaEsercizi[0] ??
          null;

        if (!esCorrente) {
          setRegistro([]);
          setPreventivi([]);
          setRateTestate([]);
          setRateDettagli([]);
          setBollettini([]);
          setAnalisiMorosita(null);
          setScadenziarioRecupero([]);
          setConguagli([]);
          setCaricamento(false);
          return;
        }

        if (esCorrente.id !== esercizioSelezionatoId) {
          setEsercizioSelezionatoId(esCorrente.id);
        }
        setNotaSinteticaInput(esCorrente.nota_sintetica_esplicativa ?? '');

        const [
          righeReg,
          prevList,
          testateList,
          bollList,
          morositaRes,
          scadenziarioList,
          conguagliList,
        ] = await Promise.all([
          services.contabilita.listRegistroContabile(condominio.id, {
            esercizioId: esCorrente.id,
          }),
          services.contabilita.listPreventivi(condominio.id, {
            esercizioId: esCorrente.id,
          }),
          services.rate.listTestate(esCorrente.id),
          services.contabilita.listBollettini(condominio.id, {
            esercizioId: esCorrente.id,
          }),
          services.contabilita.analizzaMorositaCondominio({
            condominioId: condominio.id,
            esercizioId: esCorrente.id,
          }),
          services.contabilita.listScadenziarioRecuperoCrediti(condominio.id, {
            esercizioId: esCorrente.id,
          }),
          services.contabilita.listConguagliEsercizio(condominio.id, esCorrente.id),
        ]);

        // Carica dettagli rate per calcolo riscossione
        const dettagliArrays = await Promise.all(
          testateList.map((t) => services.rate.listDettaglio(t.id)),
        );
        const tuttiDettagli = dettagliArrays.flat();

        setRegistro(righeReg);
        setPreventivi(prevList);
        setRateTestate(testateList);
        setRateDettagli(tuttiDettagli);
        setBollettini(bollList);
        setAnalisiMorosita(morositaRes);
        setScadenziarioRecupero(scadenziarioList);
        setConguagli(conguagliList);

        if (prevList.length > 0 && !ratePreventivoId) {
          setRatePreventivoId(prevList[0]?.id ?? '');
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Impossibile caricare i dati contabili del condominio.';
        setErroreCaricamento(msg);
        toast.show({
          tone: 'error',
          message: 'Errore nel caricamento dei dati contabili.',
        });
      } finally {
        setCaricamento(false);
      }
    },
    [condominio?.id, esercizioSelezionatoId, incassoUnitaId, ratePreventivoId, spesaTabellaId, toast],
  );

  useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  // Seleziona la scheda richiesta se presente nei query params
  useEffect(() => {
    if (targetTab && ['registro', 'preventivi', 'bollettini', 'morosita', 'rendiconto'].includes(targetTab)) {
      setSchedaAttiva(targetTab as TabKey);
    }
  }, [targetTab]);

  // Breadcrumb istituzionali richiesti: Home / Amministrazione / Contabilità
  const breadcrumbs: readonly BreadcrumbItem[] = useMemo(
    () => [
      { label: 'Home', onPress: () => router.push('/admin/dashboard') },
      { label: 'Amministrazione', onPress: () => router.push('/admin/dashboard') },
      { label: 'Contabilità' },
    ],
    [router],
  );

  // Calcolo KPI per le 4 StatCard ufficiali
  const kpiContabili = useMemo(() => {
    const saldoInizialeCent =
      (esercizioAttivo?.saldo_iniziale_conto_centesimi ?? 0) +
      (esercizioAttivo?.saldo_iniziale_cassa_centesimi ?? 0);

    let totaleEntrateCent = 0;
    let totaleUsciteCent = 0;
    for (const r of registro) {
      const m = r.movimento;
      if ((m.stato_spesa ?? 'REGISTRATA') === 'BOZZA') continue;
      const cent = m.importo_centesimi ?? Math.round(Number(m.importo ?? 0) * 100);
      if (m.segno === '+') {
        totaleEntrateCent += cent;
      } else {
        totaleUsciteCent += cent;
      }
    }
    const saldoCassaCent = saldoInizialeCent + totaleEntrateCent - totaleUsciteCent;

    // Riscossione rate esercizio
    let totaleDovutoRateCent = 0;
    let totaleIncassatoRateCent = 0;
    for (const d of rateDettagli) {
      const dovuto = d.importo_dovuto_centesimi ?? Math.round(Number(d.importo_dovuto ?? 0) * 100);
      const pagato = d.importo_pagato_centesimi ?? Math.round(Number(d.importo_pagato ?? 0) * 100);
      totaleDovutoRateCent += dovuto;
      totaleIncassatoRateCent += pagato;
    }
    const percRiscossione =
      totaleDovutoRateCent > 0
        ? Math.min(100, Math.round((totaleIncassatoRateCent / totaleDovutoRateCent) * 100))
        : 0;

    // Morosità scadute e alert 6 mesi (art. 1129 c. 9 c.c.)
    const morositaScadutaCent = analisiMorosita?.totaleMorositaEsigibileCent ?? 0;
    const numeroMorosi = (analisiMorosita?.perSoggetto ?? []).filter(
      (s) => s.totaleEsigibileCent > 0,
    ).length;
    const alertCritici180gg = scadenziarioRecupero.filter(
      (s) => s.valutazione.isTermineScaduto || s.valutazione.alertScattati.length > 0,
    ).length;

    // Fondi speciali e ordinari accantonati
    const fondiAttivi = fondi.filter((f) => f.fondo.stato !== 'CHIUSO');
    const totaleFondiCent = fondiAttivi.reduce(
      (acc, f) => acc + (f.fondo.saldo_attuale_centesimi ?? 0),
      0,
    );

    return {
      saldoCassaCent,
      totaleEntrateCent,
      totaleUsciteCent,
      percRiscossione,
      totaleDovutoRateCent,
      totaleIncassatoRateCent,
      morositaScadutaCent,
      numeroMorosi,
      alertCritici180gg,
      totaleFondiCent,
      numeroFondiAttivi: fondiAttivi.length,
    };
  }, [analisiMorosita, esercizioAttivo, fondi, rateDettagli, registro, scadenziarioRecupero]);

  // Filtro righe del Registro Contabile
  const righeRegistroFiltrate = useMemo(() => {
    const chip = filtroChipRegistro[0] ?? 'TUTTI';
    const query = ricercaRegistro.trim().toLowerCase();

    return registro.filter((item) => {
      const m = item.movimento;
      if (filtroDataDa && m.data < filtroDataDa) return false;
      if (filtroDataA && m.data > filtroDataA) return false;

      if (chip === 'USCITE' && m.segno !== '-') return false;
      if (chip === 'ENTRATE' && m.segno !== '+') return false;
      if (chip === 'STRAORDINARIA' && m.tag_spesa !== 'STRAORDINARIA') return false;
      if (chip === 'INCOMPLETI' && item.giustificativo.statoCompletezza !== 'INCOMPLETA') {
        return false;
      }

      if (query) {
        const testo = [
          m.descrizione ?? '',
          m.segno === '+' ? 'entrata' : 'spesa uscita',
          m.numero_fattura ?? '',
          m.delibera_riferimento ?? '',
          String(m.numero_progressivo ?? ''),
        ]
          .join(' ')
          .toLowerCase();
        if (!testo.includes(query)) return false;
      }
      return true;
    });
  }, [filtroChipRegistro, filtroDataA, filtroDataDa, registro, ricercaRegistro]);

  // Filtro Bollettini
  const bollettiniFiltrati = useMemo(() => {
    const q = ricercaBollettini.trim().toLowerCase();
    if (!q) return bollettini;
    return bollettini.filter((b) =>
      [
        b.intestazione_destinatario,
        b.causale_versamento ?? '',
        b.stato,
        String(b.numero_progressivo),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [bollettini, ricercaBollettini]);

  // Valutazione completezza dei 3 documenti del Rendiconto (Sez. 8: RC-K1..K5)
  const statoDocumentiRendiconto = useMemo(() => {
    const riepilogoJson = (esercizioAttivo?.riepilogo_finanziario_json ?? null) as {
      quadra?: boolean;
      differenzaContoCent?: number;
      differenzaCassaCent?: number;
    } | null;

    const tuttiGiustificativiCompleti =
      registro.length > 0 &&
      registro
        .filter((r) => r.movimento.segno === '-' && !r.movimento.storno_di_id)
        .every((r) => r.giustificativo.spesaCompleta);

    const registroCompleto =
      esercizioAttivo?.registro_contabilita_completo ?? tuttiGiustificativiCompleti;

    const completezza = validaCompletezzaRendiconto({
      registroContabilitaCompleto: registroCompleto,
      riepilogoFinanziario: riepilogoJson ? { quadra: riepilogoJson.quadra === true } : null,
      notaSintetica:
        notaSinteticaInput.trim().length > 0
          ? notaSinteticaInput
          : (esercizioAttivo?.nota_sintetica_esplicativa ?? null),
    });

    return {
      registroCompleto,
      riepilogoQuadrato: riepilogoJson?.quadra === true,
      notaPresente:
        (notaSinteticaInput.trim() || esercizioAttivo?.nota_sintetica_esplicativa?.trim() || '')
          .length > 0,
      completezza,
    };
  }, [esercizioAttivo, notaSinteticaInput, registro]);

  // Opzioni Select Voci di Spesa
  const opzioniVociSpesa: readonly SelectOption[] = useMemo(() => {
    if (vociCatalogo.length > 0) {
      return vociCatalogo.map((v) => ({
        value: v.codice,
        label: `${v.nome} (${v.tag_default === 'STRAORDINARIA' ? 'Straordinaria' : 'Ordinaria'})`,
      }));
    }
    return VOCI_SPESA_CATALOGO_DEFAULT.map((v) => ({
      value: v.codice,
      label: `${v.nome} (${v.tagDefault === 'STRAORDINARIA' ? 'Straordinaria' : 'Ordinaria'})`,
    }));
  }, [vociCatalogo]);

  const opzioniEsercizi: readonly SelectOption[] = useMemo(
    () =>
      esercizi.map((e) => ({
        value: e.id,
        label: `Esercizio ${e.anno} (${formattaDataItaliana(e.data_inizio)} - ${formattaDataItaliana(e.data_fine)}) — ${e.stato_modello ?? e.stato}`,
      })),
    [esercizi],
  );

  const opzioniUnitaSelect: readonly SelectOption[] = useMemo(
    () =>
      unitaCondominio.map((u) => ({
        value: u.id,
        label: u.label,
      })),
    [unitaCondominio],
  );

  const opzioniFornitoriSelect: readonly SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Nessun fornitore associato' },
      ...fornitori.map((f) => ({
        value: f.id,
        label: f.p_iva ? `${f.ragione_sociale} (P.IVA ${f.p_iva})` : f.ragione_sociale,
      })),
    ],
    [fornitori],
  );

  const opzioniTabelleSelect: readonly SelectOption[] = useMemo(
    () =>
      tabelleMillesimali.map((t) => ({
        value: t.id,
        label: `${t.nome} (v.${t.versione ?? 1})`,
      })),
    [tabelleMillesimali],
  );

  const opzioniPreventiviSelect: readonly SelectOption[] = useMemo(
    () =>
      preventivi.map((p) => ({
        value: p.id,
        label: `Preventivo v.${p.versione} (${p.stato}) — ${formattaCentsItaliano(p.totale_previsto_centesimi, true)}`,
      })),
    [preventivi],
  );

  // ============================================================================
  // HANDLER AZIONI CONTABILI
  // ============================================================================

  const apriModaleRegistraSpesa = () => {
    setSpesaDescrizione('');
    setSpesaImportoEuro('');
    setSpesaDataPagamento(oggiIso());
    setSpesaTag('ORDINARIA');
    setSpesaChiPaga('TUTTI');
    setSpesaNumeroFattura('');
    setSpesaDeliberaRif('');
    setSpesaErroreForm(null);
    setModaleAttiva('registra-spesa');
  };

  const handleConfermaRegistraSpesa = async () => {
    if (!condominio?.id || !esercizioAttivo?.id) return;
    if (!spesaDescrizione.trim()) {
      setSpesaErroreForm('Inserisci una descrizione chiara della spesa.');
      return;
    }
    let importoCent = 0;
    try {
      importoCent = euroToCents(spesaImportoEuro);
    } catch {
      setSpesaErroreForm('Inserisci un importo valido in Euro (es. 1.250,50).');
      return;
    }
    if (importoCent <= 0) {
      setSpesaErroreForm('L’importo della spesa deve essere maggiore di zero.');
      return;
    }

    setOperazioneInCorso(true);
    setSpesaErroreForm(null);
    try {
      const voceScelta = vociCatalogo.find((v) => v.codice === spesaVoceCodice);
      const esito = await services.contabilita.registraSpesaConRiparto({
        condominioId: condominio.id,
        esercizioId: esercizioAttivo.id,
        dataMovimento: spesaDataPagamento,
        competenzaDa: esercizioAttivo.data_inizio,
        competenzaA: esercizioAttivo.data_fine,
        importoCent,
        voceSpesaId: voceScelta?.id ?? null,
        descrizione: spesaDescrizione.trim(),
        tagSpesa: spesaTag,
        chiPaga: spesaChiPaga,
        tabellaMillesimaleId: spesaTabellaId || null,
        fornitoreId: spesaFornitoreId || null,
        numeroFattura: spesaNumeroFattura.trim() || null,
        deliberaRiferimento: spesaDeliberaRif.trim() || null,
        autoreId: profilo?.id ?? null,
      });

      setModaleAttiva(null);
      toast.show({
        tone: 'success',
        message:
          esito.avvisi.length > 0
            ? `Spesa registrata (${esito.avvisi[0]}).`
            : 'Spesa registrata e ripartita con successo.',
      });
      await caricaDati(esercizioAttivo.id);
    } catch (err) {
      setSpesaErroreForm(
        err instanceof Error ? err.message : 'Errore durante la registrazione della spesa.',
      );
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const apriModaleStorno = (riga: RigaRegistroContabileView) => {
    setMovimentoDaStornare(riga);
    setMotivoStornoInput('');
    setErroreStornoInput(undefined);
    setModaleAttiva('storna-movimento');
  };

  const handleConfermaStorno = async () => {
    if (!condominio?.id || !movimentoDaStornare) return;
    if (!motivoStornoInput.trim()) {
      setErroreStornoInput('Il motivo dello storno è obbligatorio per la traccia di revisione.');
      return;
    }

    setOperazioneInCorso(true);
    setErroreStornoInput(undefined);
    try {
      await services.contabilita.stornaMovimento({
        movimentoId: movimentoDaStornare.movimento.id,
        condominioId: condominio.id,
        motivoStorno: motivoStornoInput.trim(),
        dataStorno: oggiIso(),
        autoreId: profilo?.id ?? null,
      });
      setModaleAttiva(null);
      setMovimentoDaStornare(null);
      toast.show({
        tone: 'success',
        message: 'Movimento stornato con scrittura inversa nel registro cronologico.',
      });
      await caricaDati(esercizioAttivo?.id);
    } catch (err) {
      setErroreStornoInput(
        err instanceof Error ? err.message : 'Impossibile stornare il movimento selezionato.',
      );
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const apriModaleNuovoPreventivo = () => {
    setPrevImportoOrdinarioEuro('4.800,00');
    setPrevImportoPuliziaEuro('3.200,00');
    setPrevImportoUtenzeEuro('2.000,00');
    setPrevNoteInput('');
    setPrevErroreForm(null);
    setModaleAttiva('nuovo-preventivo');
  };

  const handleConfermaNuovoPreventivo = async () => {
    if (!condominio?.id || !esercizioAttivo?.id) return;
    setPrevErroreForm(null);

    try {
      const c1 = prevImportoOrdinarioEuro.trim() ? euroToCents(prevImportoOrdinarioEuro) : 0;
      const c2 = prevImportoPuliziaEuro.trim() ? euroToCents(prevImportoPuliziaEuro) : 0;
      const c3 = prevImportoUtenzeEuro.trim() ? euroToCents(prevImportoUtenzeEuro) : 0;

      const vociInput = [
        c1 > 0
          ? {
              codiceVoce: 'MANUT_ORDINARIA',
              categoria: 'Manutenzione ordinaria parti comuni',
              descrizione: 'Manutenzione ordinaria e compenso gestione',
              importoPrevistoCent: c1,
              criterioChiPaga: 'TUTTI' as CriterioChiPaga,
              tabellaMillesimaleId: spesaTabellaId || null,
            }
          : null,
        c2 > 0
          ? {
              codiceVoce: 'PULIZIA_SCALE',
              categoria: 'Pulizia e igiene parti comuni',
              descrizione: 'Servizio pulizia periodica scale e atrio',
              importoPrevistoCent: c2,
              criterioChiPaga: 'TUTTI' as CriterioChiPaga,
              tabellaMillesimaleId: spesaTabellaId || null,
            }
          : null,
        c3 > 0
          ? {
              codiceVoce: 'LUCE_COMUNE',
              categoria: 'Energia elettrica parti comuni',
              descrizione: 'Fornitura elettrica e servizi comuni',
              importoPrevistoCent: c3,
              criterioChiPaga: 'TUTTI' as CriterioChiPaga,
              tabellaMillesimaleId: spesaTabellaId || null,
            }
          : null,
      ].filter((v): v is NonNullable<typeof v> => v !== null);

      if (vociInput.length === 0) {
        setPrevErroreForm('Inserisci almeno una voce di spesa con importo maggiore di zero.');
        return;
      }

      setOperazioneInCorso(true);
      const creato = await services.contabilita.creaPreventivo({
        condominioId: condominio.id,
        esercizioId: esercizioAttivo.id,
        note: prevNoteInput.trim() || null,
        voci: vociInput,
        autoreId: profilo?.id ?? null,
      });

      setRatePreventivoId(creato.preventivo.id);
      setModaleAttiva(null);
      toast.show({
        tone: 'success',
        message: `Preventivo v.${creato.preventivo.versione} creato in stato Bozza.`,
      });
      await caricaDati(esercizioAttivo.id);
    } catch (err) {
      setPrevErroreForm(
        err instanceof Error ? err.message : 'Errore nella creazione del preventivo.',
      );
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const apriModaleApprovaPreventivo = (prev: IPreventivo) => {
    setPreventivoDaApprovare(prev);
    setDataAssembleaPrevInput(oggiIso());
    setDeliberaPrevInput('');
    setErroreApprovaPrev(null);
    setModaleAttiva('approva-preventivo');
  };

  const handleConfermaApprovaPreventivo = async () => {
    if (!condominio?.id || !preventivoDaApprovare) return;
    if (!deliberaPrevInput.trim()) {
      setErroreApprovaPrev('Inserisci gli estremi della delibera assembleare di approvazione.');
      return;
    }

    setOperazioneInCorso(true);
    setErroreApprovaPrev(null);
    try {
      await services.contabilita.approvaPreventivo({
        preventivoId: preventivoDaApprovare.id,
        condominioId: condominio.id,
        dataAssemblea: dataAssembleaPrevInput,
        deliberaRiferimento: deliberaPrevInput.trim(),
        autoreId: profilo?.id ?? null,
      });
      setModaleAttiva(null);
      setPreventivoDaApprovare(null);
      toast.show({
        tone: 'success',
        message: 'Preventivo approvato e registrato nel registro di audit.',
      });
      await caricaDati(esercizioAttivo?.id);
    } catch (err) {
      setErroreApprovaPrev(
        err instanceof Error ? err.message : 'Errore durante l’approvazione del preventivo.',
      );
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const apriModaleEmettiRate = () => {
    if (preventivi.length > 0 && !ratePreventivoId) {
      setRatePreventivoId(preventivi[0]?.id ?? '');
    }
    setRateErroreForm(null);
    setModaleAttiva('emetti-rate');
  };

  const handleConfermaEmettiRate = async () => {
    if (!condominio?.id || !esercizioAttivo?.id) return;
    const prevId = ratePreventivoId || preventivi[0]?.id;
    if (!prevId) {
      setRateErroreForm('Crea almeno un preventivo prima di generare il piano rate.');
      return;
    }

    const numRate = Math.max(1, Math.min(12, parseInt(rateNumeroScadenze, 10) || 4));
    const dataBase = new Date(`${ratePrimaScadenza}T12:00:00Z`);
    if (isNaN(dataBase.getTime())) {
      setRateErroreForm('Inserisci una data di prima scadenza valida (AAAA-MM-GG).');
      return;
    }

    const scadenzeRate = Array.from({ length: numRate }, (_, idx) => {
      const d = new Date(dataBase);
      d.setUTCMonth(d.getUTCMonth() + idx * Math.max(1, Math.floor(12 / numRate)));
      const iso = d.toISOString().slice(0, 10);
      return {
        numeroRata: idx + 1,
        descrizione: `Rata ${idx + 1}/${numRate} Esercizio ${esercizioAttivo.anno}`,
        dataScadenza: iso,
      };
    });

    setOperazioneInCorso(true);
    setRateErroreForm(null);
    try {
      const esito = await services.contabilita.generaPianoRateEBozzeBollettini({
        condominioId: condominio.id,
        esercizioId: esercizioAttivo.id,
        preventivoId: prevId,
        tabellaMillesimaleId: spesaTabellaId || null,
        scadenzeRate,
        emessaConOverride: rateOverrideBozza,
        motivoOverride: rateOverrideBozza ? rateMotivoOverride.trim() : null,
        pubblicaSubitoRate: ratePubblicaSubito,
        autoreId: profilo?.id ?? null,
      });

      setModaleAttiva(null);
      toast.show({
        tone: 'success',
        message: `Generate ${esito.rateTestata.length} rate e ${esito.bollettiniBozza.length} bollettini in bozza.`,
      });
      await caricaDati(esercizioAttivo.id);
    } catch (err) {
      setRateErroreForm(
        err instanceof Error ? err.message : 'Errore nella generazione del piano rate.',
      );
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const apriModaleRegistraIncasso = () => {
    setIncassoImportoEuro('');
    setIncassoDataValuta(oggiIso());
    setIncassoCro('');
    setIncassoCausale('');
    setIncassoDaTerzo(false);
    setIncassoErroreForm(null);
    setModaleAttiva('registra-incasso');
  };

  const handleConfermaRegistraIncasso = async () => {
    if (!condominio?.id) return;
    if (!incassoPagatoreNome.trim()) {
      setIncassoErroreForm('Indica il nominativo del soggetto pagatore.');
      return;
    }
    let importoIncassoCent = 0;
    try {
      importoIncassoCent = euroToCents(incassoImportoEuro);
    } catch {
      setIncassoErroreForm('Inserisci un importo valido in Euro (es. 350,00).');
      return;
    }
    if (importoIncassoCent <= 0) {
      setIncassoErroreForm('L’importo incassato deve essere maggiore di zero.');
      return;
    }

    setOperazioneInCorso(true);
    setIncassoErroreForm(null);
    try {
      const esito = await services.contabilita.registraEImputaIncasso({
        condominioId: condominio.id,
        dataValuta: incassoDataValuta,
        importoIncassoCent,
        metodo: incassoMetodo,
        riferimentoCro: incassoCro.trim() || null,
        causale: incassoCausale.trim() || null,
        unitaId: incassoUnitaId || null,
        pagatoreNome: incassoPagatoreNome.trim(),
        isPagamentoDaTerzo: incassoDaTerzo,
        pagatoreRelazione: incassoDaTerzo ? 'TERZO' : 'PROPRIETARIO',
        ordineImputazione: incassoOrdine,
        autoreId: profilo?.id ?? null,
      });

      setModaleAttiva(null);
      toast.show({
        tone: 'success',
        message: `Incasso registrato: imputati ${formattaCentsItaliano(esito.esitoImputazione.totaleImputatoCent, true)}.`,
      });
      await caricaDati(esercizioAttivo?.id);
    } catch (err) {
      setIncassoErroreForm(
        err instanceof Error ? err.message : 'Errore nella registrazione dell’incasso.',
      );
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const apriDettaglioBollettino = async (boll: IBollettino) => {
    if (!condominio?.id) return;
    setBollettinoSelezionato(boll);
    setRettificaNuovoTotaleEuro(
      (boll.totale_centesimi / 100).toFixed(2).replace('.', ','),
    );
    setRettificaMotivo('');
    setRettificaErrore(null);
    setModaleAttiva('dettaglio-bollettino');

    try {
      const dett = await services.contabilita.getBollettinoConRighe(boll.id, condominio.id);
      setRigheBollettinoSelezionato(dett ? dett.righe : []);
    } catch {
      setRigheBollettinoSelezionato([]);
    }
  };

  // Apertura automatica dettaglio se richiesto da notifica
  useEffect(() => {
    if (!targetId) return;
    const b = bollettini.find((item) => item.id === targetId);
    if (b) {
      setSchedaAttiva('bollettini');
      void apriDettaglioBollettino(b);
      return;
    }
    const m = registro.find((item) => item.movimento.id === targetId);
    if (m) {
      setSchedaAttiva('registro');
      setDettaglio({ tipo: 'movimento', riga: m });
      setModaleAttiva('dettaglio-generico');
      return;
    }
    const p = preventivi.find((item) => item.id === targetId);
    if (p) {
      setSchedaAttiva('preventivi');
      setDettaglio({ tipo: 'preventivo', preventivo: p });
      setModaleAttiva('dettaglio-generico');
      return;
    }
    const r = rateTestate.find((item) => item.id === targetId);
    if (r) {
      setSchedaAttiva('preventivi');
      setDettaglio({ tipo: 'rata', rata: r });
      setModaleAttiva('dettaglio-generico');
    }
  }, [targetId, bollettini, registro, preventivi, rateTestate]);

  const handleVerificaEEmettiBollettino = async () => {
    if (!condominio?.id || !bollettinoSelezionato || !profilo?.id) return;
    setOperazioneInCorso(true);
    setRettificaErrore(null);
    try {
      if (bollettinoSelezionato.stato === 'BOZZA') {
        await services.contabilita.verificaBollettino({
          bollettinoId: bollettinoSelezionato.id,
          condominioId: condominio.id,
        });
      }
      await services.contabilita.emettiBollettino({
        bollettinoId: bollettinoSelezionato.id,
        condominioId: condominio.id,
        confermaEsplicitaAdmin: true,
        confermatoDa: profilo.id,
      });
      setModaleAttiva(null);
      toast.show({
        tone: 'success',
        message: `Bollettino n. ${bollettinoSelezionato.numero_progressivo}/${bollettinoSelezionato.anno} verificato ed emesso.`,
      });
      await caricaDati(esercizioAttivo?.id);
    } catch (err) {
      setRettificaErrore(
        err instanceof Error ? err.message : 'Impossibile emettere il bollettino.',
      );
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const handleRettificaBollettino = async () => {
    if (!condominio?.id || !bollettinoSelezionato) return;
    if (!rettificaMotivo.trim()) {
      setRettificaErrore('Specifica il motivo della rettifica del bollettino emesso.');
      return;
    }
    let nuovoTotaleCent = 0;
    try {
      nuovoTotaleCent = euroToCents(rettificaNuovoTotaleEuro);
    } catch {
      setRettificaErrore('Inserisci un nuovo importo totale valido.');
      return;
    }

    setOperazioneInCorso(true);
    setRettificaErrore(null);
    try {
      await services.contabilita.rettificaBollettinoEmesso({
        bollettinoOriginaleId: bollettinoSelezionato.id,
        condominioId: condominio.id,
        nuovoTotaleCent,
        motivoRettifica: rettificaMotivo.trim(),
        autoreId: profilo?.id ?? null,
      });
      setModaleAttiva(null);
      toast.show({
        tone: 'success',
        message: 'Bollettino rettificato con emissione di nuovo avviso sostitutivo.',
      });
      await caricaDati(esercizioAttivo?.id);
    } catch (err) {
      setRettificaErrore(
        err instanceof Error ? err.message : 'Errore nella rettifica del bollettino.',
      );
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const handleAggiornaStatoRecupero = async (
    voce: VoceScadenziarioRecuperoRow,
    nuovoStato: 'AVVIATO' | 'CHIUSO',
  ) => {
    if (!condominio?.id) return;
    setOperazioneInCorso(true);
    try {
      await services.contabilita.aggiornaStatoScadenziarioRecuperoCredito({
        scadenziarioId: voce.record.id,
        condominioId: condominio.id,
        nuovoStato,
        dataAvvioAzione: nuovoStato === 'AVVIATO' ? oggiIso() : voce.record.data_avvio_azione,
        dataChiusura: nuovoStato === 'CHIUSO' ? oggiIso() : null,
        autoreId: profilo?.id ?? null,
      });
      toast.show({
        tone: 'success',
        message:
          nuovoStato === 'AVVIATO'
            ? 'Avvio azione di recupero crediti ex art. 1129 c. 9 c.c. registrato.'
            : 'Posizione nello scadenziario recupero crediti chiusa.',
      });
      await caricaDati(esercizioAttivo?.id);
    } catch (err) {
      toast.show({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Errore aggiornamento scadenziario.',
      });
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const handleRedigiRendicontoEConguagli = async () => {
    if (!condominio?.id || !esercizioAttivo?.id) return;
    setOperazioneInCorso(true);
    try {
      const redazione = await services.contabilita.redigiRendiconto({
        condominioId: condominio.id,
        esercizioId: esercizioAttivo.id,
        notaSintetica: notaSinteticaInput.trim() || undefined,
        autoreId: profilo?.id ?? null,
      });
      await services.contabilita.calcolaConguagliEsercizio({
        condominioId: condominio.id,
        esercizioId: esercizioAttivo.id,
        autoreId: profilo?.id ?? null,
      });
      if (!notaSinteticaInput.trim() && redazione.notaPrecompilata) {
        setNotaSinteticaInput(redazione.notaPrecompilata);
      }
      toast.show({
        tone: 'success',
        message: 'Rendiconto tripartito e prospetto conguagli per unità ricalcolati.',
      });
      await caricaDati(esercizioAttivo.id);
    } catch (err) {
      toast.show({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Errore nella redazione del rendiconto.',
      });
    } finally {
      setOperazioneInCorso(false);
    }
  };

  // ============================================================================
  // DEFINIZIONE COLONNE PER RESPONSIVEDATAVIEW (5 SCHEDE)
  // ============================================================================

  // 1. Colonne Registro Cronologico & Spese
  const colonneRegistro: readonly DataColumn<RigaRegistroContabileView>[] = useMemo(
    () => [
      {
        key: 'numero',
        header: '#',
        cell: (r) => (
          <Text style={styles.testoEvidenza} numberOfLines={1}>
            #{r.movimento.numero_progressivo ?? '—'}
          </Text>
        ),
        mobile: 'title',
        minWidth: 70,
        weight: 1,
      },
      {
        key: 'data',
        header: 'Data',
        cell: (r) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoPrimario} numberOfLines={1}>
              {formattaDataItaliana(r.movimento.data)}
            </Text>
            {r.ritardoRegistrazione.inRitardo ? (
              <Badge
                status="warning"
                label={`${r.ritardoRegistrazione.giorniRitardo}gg`}
              />
            ) : null}
          </View>
        ),
        minWidth: 120,
        weight: 1,
      },
      {
        key: 'descrizione',
        header: 'Descrizione e Causale',
        cell: (r) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoPrimario}>{r.movimento.descrizione ?? '—'}</Text>
            <Text style={styles.testoSecondario}>
              {r.movimento.numero_fattura
                ? `Fatt. ${r.movimento.numero_fattura}`
                : r.movimento.segno === '+'
                  ? 'Entrata contabile'
                  : 'Spesa condominiale'}
            </Text>
          </View>
        ),
        minWidth: 220,
        weight: 3,
      },
      {
        key: 'natura',
        header: 'Natura',
        cell: (r) =>
          r.movimento.storno_di_id ? (
            <Badge status="info" label="Storno" />
          ) : r.movimento.tag_spesa === 'STRAORDINARIA' ? (
            <Badge status="warning" label="Straordinaria" />
          ) : (
            <Badge status="neutral" label="Ordinaria" />
          ),
        minWidth: 130,
        weight: 2,
      },
      {
        key: 'giustificativo',
        header: 'Giustificativo',
        cell: (r) => (
          <View style={styles.cellaImpilata}>
            <Badge
              status={r.giustificativo.spesaCompleta ? 'completato' : 'warning'}
              label={r.giustificativo.spesaCompleta ? 'Completo' : 'Incompleto'}
            />
            {r.inElencoControlloFuoriConto ? (
              <Text style={styles.testoSecondario}>Fuori c/c (cassa)</Text>
            ) : null}
          </View>
        ),
        mobile: 'status',
        minWidth: 140,
        weight: 2,
      },
      {
        key: 'importo',
        header: 'Importo',
        align: 'end',
        cell: (r) => {
          const cent =
            r.movimento.importo_centesimi ?? Math.round(Number(r.movimento.importo ?? 0) * 100);
          const prefisso = r.movimento.segno === '+' ? '+ ' : '- ';
          return `${prefisso}${formattaCentsItaliano(cent, true)}`;
        },
        minWidth: 130,
        weight: 2,
      },
    ],
    [],
  );

  // 2. Colonne Preventivi & Piano Rate
  const colonnePreventivi: readonly DataColumn<IPreventivo>[] = useMemo(
    () => [
      {
        key: 'versione',
        header: 'Versione',
        cell: (p) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoEvidenza}>Preventivo v.{p.versione}</Text>
            <Text style={styles.testoSecondario}>
              Creato il {formattaDataItaliana(p.created_at.slice(0, 10))}
            </Text>
          </View>
        ),
        mobile: 'title',
        minWidth: 150,
        weight: 2,
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (p) => {
          const st = badgeStatoPreventivo(p.stato);
          return <Badge status={st.status} label={st.label} />;
        },
        mobile: 'status',
        minWidth: 130,
        weight: 2,
      },
      {
        key: 'delibera',
        header: 'Delibera Assembleare',
        cell: (p) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoPrimario}>
              {p.delibera_approvazione ?? 'In attesa di approvazione assembleare'}
            </Text>
            {p.data_approvazione ? (
              <Text style={styles.testoSecondario}>
                Approvato il {formattaDataItaliana(p.data_approvazione)}
              </Text>
            ) : null}
          </View>
        ),
        minWidth: 220,
        weight: 3,
      },
      {
        key: 'totale',
        header: 'Totale Previsto',
        align: 'end',
        cell: (p) => formattaCentsItaliano(p.totale_previsto_centesimi, true),
        minWidth: 140,
        weight: 2,
      },
    ],
    [],
  );

  const colonneRateTestata: readonly DataColumn<IRataTestata>[] = useMemo(
    () => [
      {
        key: 'rata',
        header: 'Rata e Descrizione',
        cell: (t) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoEvidenza}>
              {t.numero_rata ? `Rata #${t.numero_rata} — ` : ''}
              {t.descrizione}
            </Text>
            {t.emessa_con_override ? (
              <Badge status="warning" label="Emessa in acconto provvisorio" />
            ) : null}
          </View>
        ),
        mobile: 'title',
        minWidth: 220,
        weight: 3,
      },
      {
        key: 'scadenza',
        header: 'Scadenza',
        cell: (t) => formattaDataItaliana(t.data_scadenza),
        minWidth: 130,
        weight: 2,
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (t) => (
          <Badge
            status={t.pubblicata ? 'completato' : 'in-attesa'}
            label={t.pubblicata ? 'Pubblicata' : 'In bozza'}
          />
        ),
        mobile: 'status',
        minWidth: 130,
        weight: 2,
      },
      {
        key: 'importo',
        header: 'Importo Rata',
        align: 'end',
        cell: (t) => {
          const cent = rateDettagli
            .filter((d) => d.rata_testata_id === t.id)
            .reduce(
              (acc, d) =>
                acc + (d.importo_dovuto_centesimi ?? Math.round(Number(d.importo_dovuto ?? 0) * 100)),
              0,
            );
          return formattaCentsItaliano(cent, true);
        },
        minWidth: 140,
        weight: 2,
      },
    ],
    [rateDettagli],
  );

  // 3. Colonne Bollettini & Incassi
  const colonneBollettini: readonly DataColumn<IBollettino>[] = useMemo(
    () => [
      {
        key: 'progressivo',
        header: 'Avviso / Anno',
        cell: (b) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoEvidenza}>
              Avviso #{b.numero_progressivo}/{b.anno}
            </Text>
            <Text style={styles.testoSecondario}>
              Scad. {formattaDataItaliana(b.data_scadenza)}
            </Text>
          </View>
        ),
        mobile: 'title',
        minWidth: 150,
        weight: 2,
      },
      {
        key: 'destinatario',
        header: 'Destinatario e Causale',
        cell: (b) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoPrimario}>{b.intestazione_destinatario}</Text>
            <Text style={styles.testoSecondario}>
              {b.causale_versamento ?? 'Quota condominiale ordinaria'}
            </Text>
          </View>
        ),
        minWidth: 230,
        weight: 3,
      },
      {
        key: 'stato',
        header: 'Stato Bollettino',
        cell: (b) => {
          const st = badgeStatoBollettino(b.stato);
          return <Badge status={st.status} label={st.label} />;
        },
        mobile: 'status',
        minWidth: 140,
        weight: 2,
      },
      {
        key: 'totale',
        header: 'Importo Totale',
        align: 'end',
        cell: (b) => formattaCentsItaliano(b.totale_centesimi, true),
        minWidth: 140,
        weight: 2,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [condominio?.id],
  );

  // 4. Colonne Morosità & Recupero (Scadenziario art. 1129 + Debitori art. 63 disp. att. c.c.)
  const colonneScadenziario: readonly DataColumn<VoceScadenziarioRecuperoRow>[] = useMemo(
    () => [
      {
        key: 'unita',
        header: 'Unità / Esigibilità',
        cell: (s) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoEvidenza}>
              {mappaUnitaLabel.get(s.record.unita_id) ?? `Unità ${s.record.unita_id.slice(0, 8)}`}
            </Text>
            <Text style={styles.testoSecondario}>
              Esigibile dal {formattaDataItaliana(s.record.data_esigibilita)}
            </Text>
          </View>
        ),
        mobile: 'title',
        minWidth: 180,
        weight: 2,
      },
      {
        key: 'scadenza180',
        header: 'Termine 6 Mesi (Art. 1129)',
        cell: (s) => {
          const ggResidui = s.valutazione.giorniMancantiAlLimite ?? 0;
          return (
            <View style={styles.cellaImpilata}>
              <Text style={styles.testoPrimario}>
                {formattaDataItaliana(s.valutazione.data_limite_azione)}
              </Text>
              <Badge
                status={
                  s.valutazione.isTermineScaduto
                    ? 'scaduto'
                    : s.valutazione.alertScattati.length > 0
                      ? 'warning'
                      : 'info'
                }
                label={
                  ggResidui < 0
                    ? `Scaduto da ${Math.abs(ggResidui)}gg`
                    : `${ggResidui}gg residui`
                }
              />
            </View>
          );
        },
        minWidth: 180,
        weight: 2,
      },
      {
        key: 'stato',
        header: 'Stato Procedura',
        cell: (s) => {
          const st = badgeStatoRecupero(s.record.stato);
          return <Badge status={st.status} label={st.label} />;
        },
        mobile: 'status',
        minWidth: 150,
        weight: 2,
      },
      {
        key: 'importo',
        header: 'Credito Esigibile',
        align: 'end',
        cell: (s) => formattaCentsItaliano(s.record.importo_esigibile_centesimi, true),
        minWidth: 140,
        weight: 2,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mappaUnitaLabel],
  );

  const colonneDebitori: readonly DataColumn<RiepilogoMorositaSoggetto>[] = useMemo(
    () => [
      {
        key: 'debitore',
        header: 'Debitore e Unità',
        cell: (d) => {
          const primaUnita = d.unitaIds[0];
          const labelUnita = primaUnita ? mappaUnitaLabel.get(primaUnita) : null;
          return (
            <View style={styles.cellaImpilata}>
              <Text style={styles.testoEvidenza}>{d.nomeSoggetto}</Text>
              <Text style={styles.testoSecondario}>
                {labelUnita ?? `${d.unitaIds.length} unità associate`}
              </Text>
            </View>
          );
        },
        mobile: 'title',
        minWidth: 200,
        weight: 3,
      },
      {
        key: 'solidarieta',
        header: 'Solidarietà Subentro (Art. 63 c. 4)',
        cell: (d) => {
          const posInSolido = (analisiMorosita?.posizioniDettaglio ?? []).find(
            (p) =>
              (p.soggettoId === d.soggettoId || p.utenteId === d.utenteId) &&
              Boolean(p.obbligatoInSolidoUtenteId || p.nomeObbligatoInSolido),
          );
          return posInSolido ? (
            <View style={styles.cellaImpilata}>
              <Badge status="warning" label="Solidarietà biennale attiva" />
              <Text style={styles.testoSecondario}>
                In solido: {posInSolido.nomeObbligatoInSolido ?? 'Cedente / Subentrante'}
              </Text>
            </View>
          ) : (
            <Badge status="neutral" label="Debitore esclusivo" />
          );
        },
        mobile: 'status',
        minWidth: 200,
        weight: 3,
      },
      {
        key: 'anzianita',
        header: 'Anzianità Max',
        cell: (d) => `${d.anzianitaMassimaGiorni} giorni`,
        minWidth: 130,
        weight: 2,
      },
      {
        key: 'creditiAperti',
        header: 'Posizioni',
        align: 'end',
        cell: (d) => `${d.numeroCreditiAperti} rate`,
        minWidth: 110,
        weight: 1,
      },
      {
        key: 'scaduto',
        header: 'Morosità Esigibile',
        align: 'end',
        cell: (d) => formattaCentsItaliano(d.totaleEsigibileCent, true),
        minWidth: 150,
        weight: 2,
      },
    ],
    [analisiMorosita?.posizioniDettaglio, mappaUnitaLabel],
  );

  // 5. Colonne Rendiconto & Conguagli Unità
  const colonneConguagli: readonly DataColumn<IConguaglioUnita>[] = useMemo(
    () => [
      {
        key: 'unita',
        header: 'Unità e Periodo Titolarità',
        cell: (c) => (
          <View style={styles.cellaImpilata}>
            <Text style={styles.testoEvidenza}>
              {mappaUnitaLabel.get(c.unita_id) ?? `Unità ${c.unita_id.slice(0, 8)}`}
            </Text>
            <Text style={styles.testoSecondario}>
              {formattaDataItaliana(c.periodo_da)} — {formattaDataItaliana(c.periodo_a)}
            </Text>
          </View>
        ),
        mobile: 'title',
        minWidth: 200,
        weight: 3,
      },
      {
        key: 'consuntivo',
        header: 'Quota Consuntivo',
        align: 'end',
        cell: (c) => formattaCentsItaliano(c.quota_consuntivo_centesimi, true),
        minWidth: 140,
        weight: 2,
      },
      {
        key: 'versato',
        header: 'Rate Versate',
        align: 'end',
        cell: (c) => formattaCentsItaliano(c.rate_versate_centesimi, true),
        minWidth: 140,
        weight: 2,
      },
      {
        key: 'saldo',
        header: 'Saldo Conguaglio',
        align: 'end',
        cell: (c) => {
          const cent = c.saldo_conguaglio_centesimi;
          return cent > 0
            ? `Debito ${formattaCentsItaliano(cent, true)}`
            : cent < 0
              ? `Credito ${formattaCentsItaliano(Math.abs(cent), true)}`
              : formattaCentsItaliano(0, true);
        },
        minWidth: 160,
        weight: 2,
      },
      {
        key: 'stato',
        header: 'Regolazione',
        cell: (c) => (
          <Badge
            status={
              c.modalita_regolazione && c.modalita_regolazione !== 'DA_REGOLARE'
                ? 'completato'
                : c.saldo_conguaglio_centesimi === 0
                  ? 'neutral'
                  : 'da-pagare'
            }
            label={
              c.modalita_regolazione === 'COMPENSATO_RATA'
                ? 'Compensato su 1ª rata'
                : c.modalita_regolazione === 'RIMBORSATO'
                  ? 'Rimborsato'
                  : c.modalita_regolazione === 'RIPORTATO_NUOVO_ESERCIZIO'
                    ? 'Riportato nuovo es.'
                    : c.saldo_conguaglio_centesimi === 0
                      ? 'In pareggio'
                      : 'Da regolare'
            }
          />
        ),
        mobile: 'status',
        minWidth: 150,
        weight: 2,
      },
    ],
    [mappaUnitaLabel],
  );

  // ============================================================================
  // DEFINIZIONE DELLE 5 SCHEDE (TABS)
  // ============================================================================

  const schedeContabilita: readonly TabItem[] = useMemo(
    () => [
      {
        key: 'registro',
        label: 'Registro',
        icon: 'file-text',
        content: (
          <Card title="Registro Cronologico di Contabilità (Art. 1130 n. 7 c.c.)">
            <View style={styles.barraFiltri}>
              <SearchBar
                label="Cerca nel registro contabile"
                placeholder="Cerca per descrizione, fattura, delibera o progressivo..."
                value={ricercaRegistro}
                onChangeText={setRicercaRegistro}
              />
              <View style={styles.rigaDateFiltro}>
                <View style={styles.colFiltroData}>
                  <Input
                    label="Dal giorno (ISO)"
                    placeholder="AAAA-MM-GG"
                    value={filtroDataDa}
                    onChangeText={setFiltroDataDa}
                  />
                </View>
                <View style={styles.colFiltroData}>
                  <Input
                    label="Al giorno (ISO)"
                    placeholder="AAAA-MM-GG"
                    value={filtroDataA}
                    onChangeText={setFiltroDataA}
                  />
                </View>
              </View>
              <FilterChips
                label="Filtra movimenti per tipologia"
                options={OPZIONI_FILTRO_REGISTRO}
                value={filtroChipRegistro}
                onChange={(val) => setFiltroChipRegistro(val.length > 0 ? val : ['TUTTI'])}
              />
            </View>

            <ResponsiveDataView<RigaRegistroContabileView>
              label="Movimenti del registro cronologico di contabilità"
              columns={colonneRegistro}
              rows={righeRegistroFiltrate}
              getRowKey={(r) => r.movimento.id}
              onRowPress={(r) => {
                setDettaglio({ tipo: 'movimento', riga: r });
                setModaleAttiva('dettaglio-generico');
              }}
              getRowLabel={(r) =>
                `Movimento #${r.movimento.numero_progressivo ?? ''} ${r.movimento.descrizione}`
              }
              empty={{
                title: 'Nessun movimento registrato',
                description:
                  'Non ci sono scritture contabili per i filtri selezionati. Usa il pulsante "Nuova spesa" per registrare un movimento.',
                action: {
                  label: 'Nuova spesa',
                  onPress: apriModaleRegistraSpesa,
                },
              }}
            />
          </Card>
        ),
      },
      {
        key: 'preventivi',
        label: 'Preventivi',
        icon: 'calculator',
        content: (
          <View style={styles.sezioneImpilata}>
            <Card
              title="Preventivi di Spesa e Versioni"
              action={{
                label: 'Nuovo preventivo',
                icon: 'plus',
                onPress: apriModaleNuovoPreventivo,
              }}
            >
              <ResponsiveDataView<IPreventivo>
                label="Elenco preventivi dell'esercizio"
                columns={colonnePreventivi}
                rows={preventivi}
                getRowKey={(p) => p.id}
                onRowPress={(p) => {
                  setDettaglio({ tipo: 'preventivo', preventivo: p });
                  setModaleAttiva('dettaglio-generico');
                }}
                getRowLabel={(p) => `Preventivo versione ${p.versione}`}
                empty={{
                  title: 'Nessun preventivo presente',
                  description:
                    'Redigi il preventivo annuale per ripartire le quote tra le unità e pianificare le rate.',
                  action: {
                    label: 'Nuovo preventivo',
                    onPress: apriModaleNuovoPreventivo,
                  },
                }}
              />
            </Card>

            <Card
              title="Piano Rate e Scadenze"
              action={{
                label: 'Emetti rate',
                icon: 'calendar-plus',
                onPress: apriModaleEmettiRate,
              }}
            >
              <ResponsiveDataView<IRataTestata>
                label="Piano rate e scadenze dell'esercizio"
                columns={colonneRateTestata}
                rows={rateTestate}
                getRowKey={(t) => t.id}
                onRowPress={(t) => {
                  setDettaglio({ tipo: 'rata', rata: t });
                  setModaleAttiva('dettaglio-generico');
                }}
                getRowLabel={(t) => t.descrizione}
                empty={{
                  title: 'Nessuna rata emessa',
                  description:
                    'Genera il piano rateale a partire dal preventivo approvato o in acconto provvisorio.',
                  action: {
                    label: 'Emetti rate',
                    onPress: apriModaleEmettiRate,
                  },
                }}
              />
            </Card>
          </View>
        ),
      },
      {
        key: 'bollettini',
        label: 'Bollettini',
        icon: 'receipt',
        content: (
          <Card
            title="Bollettini di Pagamento e Riconciliazione Incassi"
            action={{
              label: 'Registra incasso',
              icon: 'plus',
              onPress: apriModaleRegistraIncasso,
            }}
          >
            <View style={styles.barraFiltri}>
              <SearchBar
                label="Cerca bollettino"
                placeholder="Cerca per destinatario, numero avviso o causale..."
                value={ricercaBollettini}
                onChangeText={setRicercaBollettini}
              />
            </View>

            <ResponsiveDataView<IBollettino>
              label="Elenco bollettini emessi e in bozza"
              columns={colonneBollettini}
              rows={bollettiniFiltrati}
              getRowKey={(b) => b.id}
              getRowLabel={(b) =>
                `Bollettino ${b.numero_progressivo}/${b.anno} - ${b.intestazione_destinatario}`
              }
              onRowPress={(b) => void apriDettaglioBollettino(b)}
              empty={{
                title: 'Nessun bollettino disponibile',
                description:
                  'I bollettini vengono generati automaticamente con l’emissione del piano rate oppure registrati manualmente.',
                action: {
                  label: 'Registra incasso manuale',
                  onPress: apriModaleRegistraIncasso,
                },
              }}
            />
          </Card>
        ),
      },
      {
        key: 'morosita',
        label: 'Morosità',
        icon: 'alert-triangle',
        content: (
          <View style={styles.sezioneImpilata}>
            {kpiContabili.alertCritici180gg > 0 ? (
              <Alert
                tone="warning"
                persistent
                title="Scadenza recupero forzoso ex art. 1129 c. 9 c.c."
                message={`Sono presenti ${kpiContabili.alertCritici180gg} posizioni prossime o oltre il termine di 6 mesi (180 giorni) dall'esigibilità senza dispensa assembleare.`}
              />
            ) : (
              <Alert
                tone="info"
                title="Monitoraggio Art. 1129 c. 9 c.c. e Solidarietà Subentro Art. 63 disp. att. c.c."
                message="L'amministratore è tenuto ad agire per la riscossione forzosa entro 6 mesi dalla chiusura dell'esercizio o dall'esigibilità della rata, salvo espressa dispensa assembleare."
              />
            )}

            <Card title="Scadenziario Recupero Crediti (Termine 180 giorni)">
              <ResponsiveDataView<VoceScadenziarioRecuperoRow>
                label="Scadenziario recupero crediti ex art. 1129 c. 9 c.c."
                columns={colonneScadenziario}
                rows={scadenziarioRecupero}
                getRowKey={(s) => s.record.id}
                onRowPress={(s) => {
                  setDettaglio({ tipo: 'recupero', voce: s });
                  setModaleAttiva('dettaglio-generico');
                }}
                getRowLabel={(s) =>
                  `Recupero credito unità ${mappaUnitaLabel.get(s.record.unita_id) ?? s.record.unita_id}`
                }
                empty={{
                  title: 'Nessuna posizione nello scadenziario',
                  description:
                    'Non risultano pratiche di recupero forzoso aperte o in scadenza per questo esercizio.',
                }}
              />
            </Card>

            <Card title="Prospetto Debitori e Solidarietà nel Subentro (Art. 63 c. 4 disp. att. c.c.)">
              <ResponsiveDataView<RiepilogoMorositaSoggetto>
                label="Prospetto debitori morosi con solidarietà subentro"
                columns={colonneDebitori}
                rows={(analisiMorosita?.perSoggetto ?? []).filter((s) => s.totaleEsigibileCent > 0)}
                getRowKey={(d) => d.soggettoKey}
                onRowPress={(d) => {
                  setDettaglio({ tipo: 'debitore', debitore: d });
                  setModaleAttiva('dettaglio-generico');
                }}
                getRowLabel={(d) =>
                  `${d.nomeSoggetto} - ${formattaCentsItaliano(d.totaleEsigibileCent, true)}`
                }
                empty={{
                  title: 'Nessuna morosità scaduta rilevata',
                  description:
                    'Tutti i condòmini risultano in regola con le quote scadute dell’esercizio selezionato.',
                }}
              />
            </Card>
          </View>
        ),
      },
      {
        key: 'rendiconto',
        label: 'Rendiconto',
        icon: 'check-square',
        content: (
          <View style={styles.sezioneImpilata}>
            <Card
              title="Fascicolo del Rendiconto Condominiale (Art. 1130-bis c.c.)"
              action={{
                label: 'Ricalcola rendiconto e conguagli',
                icon: 'refresh-cw',
                onPress: () => void handleRedigiRendicontoEConguagli(),
              }}
            >
              <View style={styles.grigliaDocumentiRendiconto}>
                <View style={styles.boxDocRendiconto}>
                  <View style={styles.rigaIntestazioneDoc}>
                    <Text style={styles.testoEvidenza}>1. Registro di Contabilità</Text>
                    <Badge
                      status={statoDocumentiRendiconto.registroCompleto ? 'completato' : 'warning'}
                      label={statoDocumentiRendiconto.registroCompleto ? 'Completo' : 'Da completare'}
                    />
                  </View>
                  <Text style={styles.testoSecondario}>
                    Entrate: {formattaCentsItaliano(kpiContabili.totaleEntrateCent, true)} · Uscite:{' '}
                    {formattaCentsItaliano(kpiContabili.totaleUsciteCent, true)}
                  </Text>
                </View>

                <View style={styles.boxDocRendiconto}>
                  <View style={styles.rigaIntestazioneDoc}>
                    <Text style={styles.testoEvidenza}>2. Riepilogo Finanziario</Text>
                    <Badge
                      status={statoDocumentiRendiconto.riepilogoQuadrato ? 'completato' : 'warning'}
                      label={statoDocumentiRendiconto.riepilogoQuadrato ? 'Quadrato' : 'In verifica'}
                    />
                  </View>
                  <Text style={styles.testoSecondario}>
                    Saldo finale cassa/c.c.: {formattaCentsItaliano(kpiContabili.saldoCassaCent, true)}
                  </Text>
                </View>

                <View style={styles.boxDocRendiconto}>
                  <View style={styles.rigaIntestazioneDoc}>
                    <Text style={styles.testoEvidenza}>3. Nota Sintetica Esplicativa</Text>
                    <Badge
                      status={statoDocumentiRendiconto.notaPresente ? 'completato' : 'warning'}
                      label={statoDocumentiRendiconto.notaPresente ? 'Redatta' : 'Mancante'}
                    />
                  </View>
                  <Text style={styles.testoSecondario}>
                    Stato fascicolo:{' '}
                    {statoDocumentiRendiconto.completezza.completo
                      ? 'Pronto per approvazione assembleare'
                      : 'In preparazione (3 documenti inscindibili)'}
                  </Text>
                </View>
              </View>

              <Textarea
                label="Nota sintetica esplicativa della gestione (Art. 1130-bis c.c.)"
                placeholder="Descrivi l'andamento della gestione, i rapporti in corso, le questioni pendenti e le variazioni rispetto al preventivo..."
                value={notaSinteticaInput}
                onChangeText={setNotaSinteticaInput}
              />
            </Card>

            <Card title="Prospetto Conguagli per Unità Immobiliare">
              <ResponsiveDataView<IConguaglioUnita>
                label="Prospetto conguagli per unità immobiliare"
                columns={colonneConguagli}
                rows={conguagli}
                getRowKey={(c) => c.id}
                onRowPress={(c) => {
                  setDettaglio({ tipo: 'conguaglio', conguaglio: c });
                  setModaleAttiva('dettaglio-generico');
                }}
                getRowLabel={(c) =>
                  `Conguaglio ${mappaUnitaLabel.get(c.unita_id) ?? c.unita_id}: ${formattaCentsItaliano(c.saldo_conguaglio_centesimi, true)}`
                }
                empty={{
                  title: 'Conguagli non ancora elaborati',
                  description:
                    'Premi "Ricalcola rendiconto e conguagli" per determinare la differenza tra quota a consuntivo e rate versate per ogni unità.',
                  action: {
                    label: 'Calcola conguagli ora',
                    onPress: () => void handleRedigiRendicontoEConguagli(),
                  },
                }}
              />
            </Card>
          </View>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      analisiMorosita?.perSoggetto,
      bollettiniFiltrati,
      colonneBollettini,
      colonneConguagli,
      colonneDebitori,
      colonnePreventivi,
      colonneRateTestata,
      colonneRegistro,
      colonneScadenziario,
      conguagli,
      filtroChipRegistro,
      filtroDataA,
      filtroDataDa,
      kpiContabili,
      mappaUnitaLabel,
      notaSinteticaInput,
      preventivi,
      rateTestate,
      ricercaBollettini,
      ricercaRegistro,
      righeRegistroFiltrate,
      scadenziarioRecupero,
      statoDocumentiRendiconto,
    ],
  );

  // Contenuto della modale "Dettaglio" aperta dal tocco su una riga di qualsiasi tabella
  const contenutoDettaglio = ((): {
    titolo: string;
    descrizione: string;
    campi: { etichetta: string; valore: string }[];
    azioni: { label: string; icon: 'rotate-ccw' | 'check' | 'shield-alert'; onPress: () => void }[];
  } => {
    const vuoto = { titolo: 'Dettaglio', descrizione: '', campi: [], azioni: [] };
    if (!dettaglio) return vuoto;
    const chiudiEEsegui = (fn: () => void) => () => {
      setModaleAttiva(null);
      fn();
    };
    switch (dettaglio.tipo) {
      case 'movimento': {
        const { movimento: m, giustificativo } = dettaglio.riga;
        const cent = m.importo_centesimi ?? Math.round(Number(m.importo ?? 0) * 100);
        return {
          titolo: `Movimento #${m.numero_progressivo ?? '—'}`,
          descrizione: m.descrizione ?? 'Scrittura del registro cronologico di contabilità.',
          campi: [
            { etichetta: 'Numero', valore: `#${m.numero_progressivo ?? '—'}` },
            { etichetta: 'Data', valore: formattaDataItaliana(m.data) },
            {
              etichetta: 'Natura',
              valore: m.storno_di_id
                ? 'Storno'
                : m.tag_spesa === 'STRAORDINARIA'
                  ? 'Straordinaria'
                  : 'Ordinaria',
            },
            {
              etichetta: 'Importo',
              valore: `${m.segno === '+' ? '+ ' : '- '}${formattaCentsItaliano(cent, true)}`,
            },
            { etichetta: 'Fattura', valore: m.numero_fattura ?? '—' },
            { etichetta: 'Giustificativo', valore: giustificativo.spesaCompleta ? 'Completo' : 'Incompleto' },
          ],
          azioni: m.storno_di_id
            ? []
            : [
                {
                  label: 'Storna movimento',
                  icon: 'rotate-ccw',
                  onPress: () => apriModaleStorno(dettaglio.riga),
                },
              ],
        };
      }
      case 'preventivo': {
        const p = dettaglio.preventivo;
        return {
          titolo: `Preventivo v.${p.versione}`,
          descrizione: 'Dettaglio del preventivo di spesa.',
          campi: [
            { etichetta: 'Stato', valore: badgeStatoPreventivo(p.stato).label },
            { etichetta: 'Totale previsto', valore: formattaCentsItaliano(p.totale_previsto_centesimi, true) },
            { etichetta: 'Delibera', valore: p.delibera_approvazione ?? 'In attesa di approvazione assembleare' },
            {
              etichetta: 'Data approvazione',
              valore: p.data_approvazione ? formattaDataItaliana(p.data_approvazione) : '—',
            },
            { etichetta: 'Creato il', valore: formattaDataItaliana(p.created_at.slice(0, 10)) },
          ],
          azioni:
            p.stato === 'BOZZA'
              ? [
                  {
                    label: 'Approva preventivo',
                    icon: 'check',
                    onPress: () => apriModaleApprovaPreventivo(p),
                  },
                ]
              : [],
        };
      }
      case 'rata': {
        const t = dettaglio.rata;
        const cent = rateDettagli
          .filter((d) => d.rata_testata_id === t.id)
          .reduce(
            (acc, d) =>
              acc + (d.importo_dovuto_centesimi ?? Math.round(Number(d.importo_dovuto ?? 0) * 100)),
            0,
          );
        return {
          titolo: t.numero_rata ? `Rata #${t.numero_rata}` : 'Rata',
          descrizione: t.descrizione,
          campi: [
            { etichetta: 'Scadenza', valore: formattaDataItaliana(t.data_scadenza) },
            { etichetta: 'Stato', valore: t.pubblicata ? 'Pubblicata' : 'In bozza' },
            { etichetta: 'Importo rata', valore: formattaCentsItaliano(cent, true) },
            {
              etichetta: 'Emissione',
              valore: t.emessa_con_override ? 'In acconto provvisorio' : 'Ordinaria',
            },
          ],
          azioni: [],
        };
      }
      case 'recupero': {
        const s = dettaglio.voce;
        const gg = s.valutazione.giorniMancantiAlLimite ?? 0;
        const azioni: {
          label: string;
          icon: 'rotate-ccw' | 'check' | 'shield-alert';
          onPress: () => void;
        }[] = [];
        if (s.record.stato === 'DA_AVVIARE') {
          azioni.push({
            label: 'Avvia recupero',
            icon: 'shield-alert',
            onPress: chiudiEEsegui(() => void handleAggiornaStatoRecupero(s, 'AVVIATO')),
          });
        } else if (s.record.stato !== 'CHIUSO') {
          azioni.push({
            label: 'Chiudi pratica',
            icon: 'check',
            onPress: chiudiEEsegui(() => void handleAggiornaStatoRecupero(s, 'CHIUSO')),
          });
        }
        return {
          titolo: 'Recupero crediti',
          descrizione:
            mappaUnitaLabel.get(s.record.unita_id) ?? `Unità ${s.record.unita_id.slice(0, 8)}`,
          campi: [
            { etichetta: 'Esigibile dal', valore: formattaDataItaliana(s.record.data_esigibilita) },
            {
              etichetta: 'Termine 6 mesi',
              valore: `${formattaDataItaliana(s.valutazione.data_limite_azione)} (${
                gg < 0 ? `scaduto da ${Math.abs(gg)}gg` : `${gg}gg residui`
              })`,
            },
            { etichetta: 'Stato procedura', valore: badgeStatoRecupero(s.record.stato).label },
            {
              etichetta: 'Credito esigibile',
              valore: formattaCentsItaliano(s.record.importo_esigibile_centesimi, true),
            },
          ],
          azioni,
        };
      }
      case 'debitore': {
        const d = dettaglio.debitore;
        const unita = d.unitaIds.map((id) => mappaUnitaLabel.get(id) ?? id.slice(0, 8)).join(', ');
        return {
          titolo: d.nomeSoggetto,
          descrizione: 'Posizione debitoria del soggetto.',
          campi: [
            { etichetta: 'Unità', valore: unita || '—' },
            { etichetta: 'Anzianità massima', valore: `${d.anzianitaMassimaGiorni} giorni` },
            { etichetta: 'Posizioni aperte', valore: `${d.numeroCreditiAperti} rate` },
            { etichetta: 'Morosità esigibile', valore: formattaCentsItaliano(d.totaleEsigibileCent, true) },
          ],
          azioni: [],
        };
      }
      case 'conguaglio': {
        const c = dettaglio.conguaglio;
        return {
          titolo: 'Conguaglio unità',
          descrizione:
            mappaUnitaLabel.get(c.unita_id) ?? `Unità ${c.unita_id.slice(0, 8)}`,
          campi: [
            {
              etichetta: 'Periodo titolarità',
              valore: `${formattaDataItaliana(c.periodo_da)} — ${formattaDataItaliana(c.periodo_a)}`,
            },
            { etichetta: 'Quota consuntivo', valore: formattaCentsItaliano(c.quota_consuntivo_centesimi, true) },
            { etichetta: 'Rate versate', valore: formattaCentsItaliano(c.rate_versate_centesimi, true) },
            {
              etichetta: 'Saldo conguaglio',
              valore:
                c.saldo_conguaglio_centesimi > 0
                  ? `Debito ${formattaCentsItaliano(c.saldo_conguaglio_centesimi, true)}`
                  : c.saldo_conguaglio_centesimi < 0
                    ? `Credito ${formattaCentsItaliano(Math.abs(c.saldo_conguaglio_centesimi), true)}`
                    : formattaCentsItaliano(0, true),
            },
          ],
          azioni: [],
        };
      }
    }
  })();

  return (
    <View style={styles.pagina}>
      {/* 1. PageHeader istituzionale */}
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Contabilità e Bilanci"
        subtitle={
          condominio
            ? `Gestione patrimoniale, registro cronologico, bollettini e rendiconto per ${condominio.nome}.`
            : 'Gestione patrimoniale, registro cronologico, bollettini e rendiconto.'
        }
        secondaryAction={{
          label: 'Emetti rate',
          icon: 'calculator',
          onPress: apriModaleEmettiRate,
        }}
        action={{
          label: 'Nuova spesa',
          icon: 'plus',
          onPress: apriModaleRegistraSpesa,
        }}
      />

      {/* Selettore esercizio contabile attivo */}
      {opzioniEsercizi.length > 0 ? (
        <Card style={styles.cardSelettoreEsercizio}>
          <View style={styles.rigaEsercizio}>
            <View style={styles.badgeIconaTitolo}>
              <Icon name="calculator" size="card" color={colors.brand.navy} />
              <View style={styles.testoEsercizioBox}>
                <Text style={styles.testoEvidenza}>
                  Esercizio Contabile {esercizioAttivo?.anno ?? ''}
                </Text>
                <Text style={styles.testoSecondario}>
                  Periodo:{' '}
                  {esercizioAttivo
                    ? `${formattaDataItaliana(esercizioAttivo.data_inizio)} — ${formattaDataItaliana(esercizioAttivo.data_fine)}`
                    : 'Non configurato'}
                </Text>
              </View>
            </View>
            <View style={styles.selettoreEsercizioInput}>
              <Select
                label="Esercizio di riferimento"
                options={opzioniEsercizi}
                value={esercizioAttivo?.id ?? ''}
                onChange={(val) => {
                  setEsercizioSelezionatoId(val);
                  void caricaDati(val);
                }}
              />
            </View>
          </View>
        </Card>
      ) : null}

      {/* 2. Quattro StatCard ufficiali conformi a palette e contrasto WCAG AA */}
      <View style={styles.grigliaStat}>
        <View style={styles.statCol}>
          <StatCard
            tile="navy"
            icon="wallet"
            title="Saldo di Cassa Attuale"
            value={formattaCentsItaliano(kpiContabili.saldoCassaCent, true)}
            description={`Entrate ${formattaCentsItaliano(kpiContabili.totaleEntrateCent, true)} · Uscite ${formattaCentsItaliano(kpiContabili.totaleUsciteCent, true)}`}
            loading={caricamento}
          />
        </View>

        <View style={styles.statCol}>
          <StatCard
            tile="teal"
            icon="badge-percent"
            title="Riscossione Rate Esercizio"
            value={`${kpiContabili.percRiscossione}%`}
            description={`Incassati ${formattaCentsItaliano(kpiContabili.totaleIncassatoRateCent, true)} su ${formattaCentsItaliano(kpiContabili.totaleDovutoRateCent, true)}`}
            loading={caricamento}
          />
        </View>

        <View style={styles.statCol}>
          <StatCard
            tile="navy"
            icon="alert-triangle"
            title="Morosità Scadute"
            value={formattaCentsItaliano(kpiContabili.morositaScadutaCent, true)}
            description={
              kpiContabili.numeroMorosi > 0
                ? `${kpiContabili.numeroMorosi} posizioni aperte (${kpiContabili.alertCritici180gg} alert art. 1129)`
                : 'Nessuna morosità scaduta oltre termine'
            }
            status={kpiContabili.morositaScadutaCent > 0 ? 'scaduto' : 'pagato'}
            loading={caricamento}
          />
        </View>

        <View style={styles.statCol}>
          <StatCard
            tile="violet"
            icon="piggy-bank"
            title="Fondi Speciali Accantonati"
            value={formattaCentsItaliano(kpiContabili.totaleFondiCent, true)}
            description={`${kpiContabili.numeroFondiAttivi} fondi attivi ex art. 1135 c.c.`}
            loading={caricamento}
          />
        </View>
      </View>

      {/* 3. Barra di navigazione a Schede (Tabs) e contenuto */}
      {caricamento ? (
        <LoadingState message="Caricamento registro contabile, bollettini e bilanci in corso..." />
      ) : erroreCaricamento ? (
        <Alert
          tone="error"
          persistent
          title="Errore di caricamento contabilità"
          message={erroreCaricamento}
          action={{
            label: 'Riprova',
            onPress: () => void caricaDati(esercizioAttivo?.id),
          }}
        />
      ) : (
        <Tabs
          label="Sezioni di Contabilità e Bilanci"
          tabs={schedeContabilita}
          value={schedaAttiva}
          onChange={(k) => setSchedaAttiva(k as TabKey)}
        />
      )}

      {/* ====================================================================
       * MODALE 1: "Registra spesa" (Nessun ScrollView annidato!)
       * ==================================================================== */}
      <Modal
        visible={modaleAttiva === 'registra-spesa'}
        onClose={() => setModaleAttiva(null)}
        title="Registra spesa"
        description="Inserisci il movimento nel registro cronologico e calcola il riparto millesimale automatico."
        dismissible={!operazioneInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleAttiva(null)}
              disabled={operazioneInCorso}
            />
            <Button
              variant="primary"
              label="Registra e ripartisci"
              icon="check"
              onPress={() => void handleConfermaRegistraSpesa()}
              loading={operazioneInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {spesaErroreForm ? <Alert tone="error" message={spesaErroreForm} /> : null}

          <Select
            label="Voce del catalogo spese"
            options={opzioniVociSpesa}
            value={spesaVoceCodice}
            onChange={setSpesaVoceCodice}
          />

          <Input
            label="Descrizione analitica della spesa *"
            placeholder="Es. Fattura n. 42/2026 pulizia scale mese di ottobre"
            value={spesaDescrizione}
            onChangeText={setSpesaDescrizione}
          />

          <View style={styles.rigaDoppia}>
            <View style={styles.colInput}>
              <Input
                label="Importo in Euro *"
                placeholder="Es. 1.250,50"
                value={spesaImportoEuro}
                onChangeText={setSpesaImportoEuro}
              />
            </View>
            <View style={styles.colInput}>
              <Input
                label="Data di pagamento (ISO) *"
                placeholder="AAAA-MM-GG"
                value={spesaDataPagamento}
                onChangeText={setSpesaDataPagamento}
              />
            </View>
          </View>

          <RadioGroup
            label="Natura contabile della spesa"
            options={OPZIONI_TAG_SPESA_RADIO}
            value={spesaTag}
            onChange={(val) => setSpesaTag(val as TagSpesa)}
          />

          <Select
            label="Criterio di riparto (Chi paga)"
            options={OPZIONI_CHI_PAGA_SELECT}
            value={spesaChiPaga}
            onChange={(val) => setSpesaChiPaga(val as CriterioChiPaga)}
          />

          {opzioniTabelleSelect.length > 0 ? (
            <Select
              label="Tabella millesimale applicata"
              options={opzioniTabelleSelect}
              value={spesaTabellaId}
              onChange={setSpesaTabellaId}
            />
          ) : null}

          <Select
            label="Fornitore (opzionale)"
            options={opzioniFornitoriSelect}
            value={spesaFornitoreId}
            onChange={setSpesaFornitoreId}
          />

          <View style={styles.rigaDoppia}>
            <View style={styles.colInput}>
              <Input
                label="Numero fattura / ricevuta"
                placeholder="Es. FT-2026-104"
                value={spesaNumeroFattura}
                onChangeText={setSpesaNumeroFattura}
              />
            </View>
            <View style={styles.colInput}>
              <Input
                label="Delibera di riferimento (opzionale)"
                placeholder="Es. Delibera Assemblea 15/09/2026"
                value={spesaDeliberaRif}
                onChangeText={setSpesaDeliberaRif}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ====================================================================
       * MODALE SUPPORTO: "Storna movimento" (Immutabilità post-consolidamento)
       * ==================================================================== */}
      <Modal
        visible={modaleAttiva === 'storna-movimento'}
        onClose={() => setModaleAttiva(null)}
        title="Storna movimento contabile"
        description="I movimenti consolidati non vengono eliminati: verrà generata una scrittura uguale e contraria collegata."
        dismissible={!operazioneInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleAttiva(null)}
              disabled={operazioneInCorso}
            />
            <Button
              variant="destructive"
              label="Conferma storno"
              icon="rotate-ccw"
              onPress={() => void handleConfermaStorno()}
              loading={operazioneInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {movimentoDaStornare ? (
            <Alert
              tone="info"
              message={`Stai stornando il movimento #${movimentoDaStornare.movimento.numero_progressivo ?? ''} "${movimentoDaStornare.movimento.descrizione}" di ${formattaCentsItaliano(movimentoDaStornare.movimento.importo_centesimi ?? Math.round(Number(movimentoDaStornare.movimento.importo ?? 0) * 100), true)}.`}
            />
          ) : null}

          <Input
            label="Motivazione dello storno *"
            placeholder="Es. Errata imputazione fattura o doppio addebito bancario"
            value={motivoStornoInput}
            onChangeText={setMotivoStornoInput}
            error={erroreStornoInput}
          />
        </View>
      </Modal>

      {/* ====================================================================
       * MODALE 2: "Nuovo preventivo"
       * ==================================================================== */}
      <Modal
        visible={modaleAttiva === 'nuovo-preventivo'}
        onClose={() => setModaleAttiva(null)}
        title="Nuovo preventivo"
        description="Definisci gli stanziamenti previsionali per le macro-categorie dell'esercizio."
        dismissible={!operazioneInCorso}
        maxWidth={640}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleAttiva(null)}
              disabled={operazioneInCorso}
            />
            <Button
              variant="primary"
              label="Salva preventivo in bozza"
              icon="check"
              onPress={() => void handleConfermaNuovoPreventivo()}
              loading={operazioneInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {prevErroreForm ? <Alert tone="error" message={prevErroreForm} /> : null}

          <Input
            label="Manutenzione ordinaria e gestione (€)"
            placeholder="4.800,00"
            value={prevImportoOrdinarioEuro}
            onChangeText={setPrevImportoOrdinarioEuro}
          />

          <Input
            label="Pulizia e igiene parti comuni (€)"
            placeholder="3.200,00"
            value={prevImportoPuliziaEuro}
            onChangeText={setPrevImportoPuliziaEuro}
          />

          <Input
            label="Utenze ed energia elettrica (€)"
            placeholder="2.000,00"
            value={prevImportoUtenzeEuro}
            onChangeText={setPrevImportoUtenzeEuro}
          />

          <Textarea
            label="Note esplicative al preventivo"
            placeholder="Criteri di stima adottati o variazioni rispetto all'esercizio precedente..."
            value={prevNoteInput}
            onChangeText={setPrevNoteInput}
          />
        </View>
      </Modal>

      {/* ====================================================================
       * MODALE SUPPORTO: "Approva preventivo"
       * ==================================================================== */}
      <Modal
        visible={modaleAttiva === 'approva-preventivo'}
        onClose={() => setModaleAttiva(null)}
        title="Approva preventivo in assemblea"
        description="Registra la data dell'assemblea e gli estremi della delibera di approvazione."
        dismissible={!operazioneInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleAttiva(null)}
              disabled={operazioneInCorso}
            />
            <Button
              variant="primary"
              label="Conferma approvazione"
              icon="check"
              onPress={() => void handleConfermaApprovaPreventivo()}
              loading={operazioneInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreApprovaPrev ? <Alert tone="error" message={erroreApprovaPrev} /> : null}

          <View style={styles.rigaDoppia}>
            <View style={styles.colInput}>
              <Input
                label="Data assemblea (ISO) *"
                placeholder="AAAA-MM-GG"
                value={dataAssembleaPrevInput}
                onChangeText={setDataAssembleaPrevInput}
              />
            </View>
            <View style={styles.colInput}>
              <Input
                label="Estremi delibera *"
                placeholder="Es. Punto 2 ODG Verbale del 10/11/2026"
                value={deliberaPrevInput}
                onChangeText={setDeliberaPrevInput}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ====================================================================
       * MODALE SUPPORTO: "Emetti rate"
       * ==================================================================== */}
      <Modal
        visible={modaleAttiva === 'emetti-rate'}
        onClose={() => setModaleAttiva(null)}
        title="Emetti piano rate e bollettini"
        description="Ripartisci il preventivo in scadenze periodiche con quadratura al centesimo e genera i bollettini."
        dismissible={!operazioneInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleAttiva(null)}
              disabled={operazioneInCorso}
            />
            <Button
              variant="primary"
              label="Genera piano rate"
              icon="calculator"
              onPress={() => void handleConfermaEmettiRate()}
              loading={operazioneInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {rateErroreForm ? <Alert tone="error" message={rateErroreForm} /> : null}

          {opzioniPreventiviSelect.length > 0 ? (
            <Select
              label="Preventivo di riferimento"
              options={opzioniPreventiviSelect}
              value={ratePreventivoId}
              onChange={setRatePreventivoId}
            />
          ) : (
            <Alert
              tone="warning"
              message="Non ci sono ancora preventivi per questo esercizio. Crea prima un preventivo."
            />
          )}

          <View style={styles.rigaDoppia}>
            <View style={styles.colInput}>
              <Input
                label="Numero di rate dell'esercizio"
                placeholder="4"
                value={rateNumeroScadenze}
                onChangeText={setRateNumeroScadenze}
              />
            </View>
            <View style={styles.colInput}>
              <Input
                label="Data scadenza 1ª rata (ISO)"
                placeholder="AAAA-MM-GG"
                value={ratePrimaScadenza}
                onChangeText={setRatePrimaScadenza}
              />
            </View>
          </View>

          <Checkbox
            checked={ratePubblicaSubito}
            onChange={setRatePubblicaSubito}
            label="Pubblica subito le rate ai condòmini"
            helperText="Rende immediatamente visibili le scadenze nell'area personale delle unità."
          />

          <Checkbox
            checked={rateOverrideBozza}
            onChange={setRateOverrideBozza}
            label="Emissione in acconto provvisorio (da preventivo non ancora approvato)"
            helperText="Richiede motivazione tracciata nel registro di audit (RC-D4)."
          />

          {rateOverrideBozza ? (
            <Input
              label="Motivazione emissione in acconto provvisorio *"
              placeholder="Es. Continuità erogazione servizi essenziali in attesa di assemblea"
              value={rateMotivoOverride}
              onChangeText={setRateMotivoOverride}
            />
          ) : null}
        </View>
      </Modal>

      {/* ====================================================================
       * MODALE 3: "Registra incasso"
       * ==================================================================== */}
      <Modal
        visible={modaleAttiva === 'registra-incasso'}
        onClose={() => setModaleAttiva(null)}
        title="Registra incasso"
        description="Registra un versamento sul conto corrente condominiale e imputalo alle rate aperte."
        dismissible={!operazioneInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleAttiva(null)}
              disabled={operazioneInCorso}
            />
            <Button
              variant="primary"
              label="Registra e imputa"
              icon="check"
              onPress={() => void handleConfermaRegistraIncasso()}
              loading={operazioneInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {incassoErroreForm ? <Alert tone="error" message={incassoErroreForm} /> : null}

          {opzioniUnitaSelect.length > 0 ? (
            <Select
              label="Unità immobiliare di riferimento"
              options={opzioniUnitaSelect}
              value={incassoUnitaId}
              onChange={setIncassoUnitaId}
            />
          ) : null}

          <Input
            label="Nominativo soggetto pagatore *"
            placeholder="Es. Mario Rossi"
            value={incassoPagatoreNome}
            onChangeText={setIncassoPagatoreNome}
          />

          <View style={styles.rigaDoppia}>
            <View style={styles.colInput}>
              <Input
                label="Importo incassato (€) *"
                placeholder="Es. 350,00"
                value={incassoImportoEuro}
                onChangeText={setIncassoImportoEuro}
              />
            </View>
            <View style={styles.colInput}>
              <Input
                label="Data valuta (ISO) *"
                placeholder="AAAA-MM-GG"
                value={incassoDataValuta}
                onChangeText={setIncassoDataValuta}
              />
            </View>
          </View>

          <View style={styles.rigaDoppia}>
            <View style={styles.colInput}>
              <Select
                label="Metodo di pagamento"
                options={OPZIONI_METODO_INCASSO}
                value={incassoMetodo}
                onChange={(val) => setIncassoMetodo(val as MetodoPagamentoIncasso)}
              />
            </View>
            <View style={styles.colInput}>
              <Input
                label="Riferimento CRO / TRN"
                placeholder="Es. CRO1122334455"
                value={incassoCro}
                onChangeText={setIncassoCro}
              />
            </View>
          </View>

          <Select
            label="Criterio di imputazione alle rate"
            options={OPZIONI_ORDINE_IMPUTAZIONE}
            value={incassoOrdine}
            onChange={(val) => setIncassoOrdine(val as 'FIFO' | 'LIFO')}
          />

          <Input
            label="Causale versamento"
            placeholder="Es. Saldo Rata 1 Esercizio 2026 Int. 4"
            value={incassoCausale}
            onChangeText={setIncassoCausale}
          />

          <Checkbox
            checked={incassoDaTerzo}
            onChange={setIncassoDaTerzo}
            label="Pagamento effettuato da soggetto terzo (Art. 1180 c.c.)"
            helperText="Distingue nella quietanza il soggetto pagatore dal condomino debitore."
          />
        </View>
      </Modal>

      {/* ====================================================================
       * MODALE 4: "Dettaglio bollettino/rettifica"
       * ==================================================================== */}
      <Modal
        visible={modaleAttiva === 'dettaglio-bollettino'}
        onClose={() => setModaleAttiva(null)}
        title="Dettaglio bollettino e rettifica"
        description={
          bollettinoSelezionato
            ? `Avviso #${bollettinoSelezionato.numero_progressivo}/${bollettinoSelezionato.anno} — ${bollettinoSelezionato.intestazione_destinatario}`
            : 'Dettaglio e gestione stato del bollettino.'
        }
        dismissible={!operazioneInCorso}
        maxWidth={620}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Chiudi"
              onPress={() => setModaleAttiva(null)}
              disabled={operazioneInCorso}
            />
            {bollettinoSelezionato &&
            (bollettinoSelezionato.stato === 'BOZZA' ||
              bollettinoSelezionato.stato === 'VERIFICATO') ? (
              <Button
                variant="primary"
                label="Verifica ed emetti"
                icon="check"
                onPress={() => void handleVerificaEEmettiBollettino()}
                loading={operazioneInCorso}
              />
            ) : (
              <Button
                variant="primary"
                label="Emetti rettifica"
                icon="refresh-cw"
                onPress={() => void handleRettificaBollettino()}
                loading={operazioneInCorso}
              />
            )}
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {rettificaErrore ? <Alert tone="error" message={rettificaErrore} /> : null}

          {bollettinoSelezionato ? (
            <View style={styles.riepilogoBollettinoBox}>
              <View style={styles.rigaIntestazioneDoc}>
                <Text style={styles.testoEvidenza}>
                  Importo totale:{' '}
                  {formattaCentsItaliano(bollettinoSelezionato.totale_centesimi, true)}
                </Text>
                <Badge
                  status={badgeStatoBollettino(bollettinoSelezionato.stato).status}
                  label={badgeStatoBollettino(bollettinoSelezionato.stato).label}
                />
              </View>
              <Text style={styles.testoSecondario}>
                Scadenza: {formattaDataItaliana(bollettinoSelezionato.data_scadenza)} · IBAN:{' '}
                {bollettinoSelezionato.iban_accredito ?? 'Conto condominiale'}
              </Text>
              <Text style={styles.testoSecondario}>
                Causale: {bollettinoSelezionato.causale_versamento ?? 'Quota condominiale'}
              </Text>

              {righeBollettinoSelezionato.length > 0 ? (
                <View style={styles.listaRigheBollettino}>
                  {righeBollettinoSelezionato.map((riga) => (
                    <View key={riga.id} style={styles.rigaVoceBollettino}>
                      <Text style={styles.nomeVoceBollettino}>{riga.descrizione}</Text>
                      <Text style={styles.prezzoVoceBollettino}>
                        {formattaCentsItaliano(riga.importo_centesimi, true)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {bollettinoSelezionato &&
          bollettinoSelezionato.stato !== 'BOZZA' &&
          bollettinoSelezionato.stato !== 'VERIFICATO' ? (
            <View style={styles.sezioneRettifica}>
              <Input
                label="Nuovo importo rettificato\u00A0(€)"
                placeholder="Es. 320,00"
                value={rettificaNuovoTotaleEuro}
                onChangeText={setRettificaNuovoTotaleEuro}
                required
              />
              <Input
                label="Motivo della rettifica (Audit)"
                placeholder="Es. Ricalcolo quota per subentro o sgravio deliberato"
                value={rettificaMotivo}
                onChangeText={setRettificaMotivo}
                required
              />
            </View>
          ) : null}
        </View>
      </Modal>

      {/* ====================================================================
       * MODALE DETTAGLIO: aperta dal tocco su una riga di qualsiasi tabella
       * ==================================================================== */}
      <Modal
        visible={modaleAttiva === 'dettaglio-generico'}
        onClose={() => setModaleAttiva(null)}
        title={contenutoDettaglio.titolo}
        description={contenutoDettaglio.descrizione}
        maxWidth={620}
        actions={
          contenutoDettaglio.azioni[0] ? (
            <ModalActions>
              <Button variant="secondary" label="Chiudi" onPress={() => setModaleAttiva(null)} />
              <Button
                variant="primary"
                label={contenutoDettaglio.azioni[0].label}
                icon={contenutoDettaglio.azioni[0].icon}
                onPress={contenutoDettaglio.azioni[0].onPress}
              />
            </ModalActions>
          ) : (
            <ModalActions>
              <Button variant="secondary" label="Chiudi" onPress={() => setModaleAttiva(null)} />
            </ModalActions>
          )
        }
      >
        <View style={styles.riepilogoBollettinoBox}>
          {contenutoDettaglio.campi.map((campo) => (
            <View key={campo.etichetta} style={styles.rigaDettaglioGenerico}>
              <Text style={styles.etichettaDettaglio}>{campo.etichetta}</Text>
              <Text style={styles.valoreDettaglio}>{campo.valore}</Text>
            </View>
          ))}
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
  cardSelettoreEsercizio: {
    padding: space[4],
  },
  rigaEsercizio: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
  },
  badgeIconaTitolo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
    minWidth: 240,
  },
  testoEsercizioBox: {
    flex: 1,
    gap: space[1],
  },
  selettoreEsercizioInput: {
    minWidth: 280,
    flex: 1,
  },
  grigliaStat: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  statCol: {
    flex: 1,
    minWidth: 240,
  },
  sezioneImpilata: {
    gap: space[5],
  },
  barraFiltri: {
    gap: space[3],
  },
  rigaDateFiltro: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  colFiltroData: {
    flex: 1,
    minWidth: 160,
  },
  cellaImpilata: {
    gap: space[1],
  },
  testoEvidenza: {
    ...textStyle('body'),
    fontWeight: '600',
    color: colors.text.primary,
  },
  testoPrimario: {
    ...textStyle('body'),
    color: colors.text.primary,
  },
  testoSecondario: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  grigliaDocumentiRendiconto: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  boxDocRendiconto: {
    flex: 1,
    minWidth: 240,
    padding: space[4],
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[2],
  },
  rigaIntestazioneDoc: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  formModale: {
    gap: space[3],
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
  riepilogoBollettinoBox: {
    padding: space[4],
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[2],
  },
  listaRigheBollettino: {
    marginTop: space[2],
    paddingTop: space[2],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
    gap: space[2],
  },
  rigaVoceBollettino: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[1],
  },
  nomeVoceBollettino: {
    ...textStyle('body'),
    color: colors.text.primary,
    flex: 1,
    flexShrink: 1,
  },
  prezzoVoceBollettino: {
    ...textStyle('body'),
    color: colors.text.primary,
    fontWeight: '700',
    flexShrink: 0,
    minWidth: 140,
    textAlign: 'right',
  },
  rigaDettaglioGenerico: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[1],
  },
  etichettaDettaglio: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
    width: 150,
    flexShrink: 0,
  },
  valoreDettaglio: {
    ...textStyle('body'),
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  sezioneRettifica: {
    gap: space[3],
  },
});
