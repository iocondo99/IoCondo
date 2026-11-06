import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FileUpload,
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
  useBreakpoint,
  useToast,
  type BreadcrumbItem,
  type DataColumn,
  type FileUploadItem,
  type FilterOption,
  type PickedFile,
  type RadioOption,
  type SelectOption,
} from '@iocondo/ui';
import {
  calcolaStatisticheDocumentiAdmin,
  filtraDocumentiAdmin,
  formattaDataDocumento,
  formattaDimensioneFile,
  validaCaricamentoDocumento,
  validaNuovaCartella,
  type CartellaAdminView,
  type DocumentoAdminView,
  type FiltroRiservatezzaAdmin,
  type OpzioneUnitaAdmin,
} from '@iocondo/data';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const OPZIONI_RISERVATEZZA_CHIPS: readonly FilterOption[] = [
  { value: 'pubblici', label: 'Condominio' },
  { value: 'riservati', label: 'Riservati per unità' },
];

const OPZIONI_AMBITO_RADIO: readonly RadioOption[] = [
  {
    value: 'PUBBLICO',
    label: 'Visibile a tutti i condòmini',
    helperText: 'Il documento sarà accessibile a tutti i residenti del condominio.',
  },
  {
    value: 'RISERVATO',
    label: 'Riservato a una specifica unità immobiliare',
    helperText: 'Solo i condòmini associati a questa unità potranno visualizzare e scaricare il documento.',
  },
];

export function AdminDocumentiScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Documenti e Drive Condominiale"
          subtitle="Archivia, organizza e condividi i documenti condominiali in sicurezza con permessi dedicati."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminDocumentiContenuto />;
}

function AdminDocumentiContenuto() {
  const router = useRouter();
  const { condominio } = useProfilo();
  const toast = useToast();
  const { isMobile } = useBreakpoint();

  const [cartelle, setCartelle] = useState<CartellaAdminView[]>([]);
  const [documenti, setDocumenti] = useState<DocumentoAdminView[]>([]);
  const [unitaDisponibili, setUnitaDisponibili] = useState<OpzioneUnitaAdmin[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  // Filtri attivi
  const [cartellaSelezionataId, setCartellaSelezionataId] = useState<string>('tutte');
  const [filtroRicerca, setFiltroRicerca] = useState<string>('');
  const [filtroRiservatezza, setFiltroRiservatezza] = useState<FiltroRiservatezzaAdmin>('tutti');
  const [focusedCartellaId, setFocusedCartellaId] = useState<string | null>(null);

  // Stato apertura link firmato in corso
  const [idInDownload, setIdInDownload] = useState<string | null>(null);

  // Modale Dettagli Documento (riga cliccabile)
  const [documentoDettaglio, setDocumentoDettaglio] = useState<DocumentoAdminView | null>(null);
  const [modaleDettaglioAperta, setModaleDettaglioAperta] = useState(false);

  const apriDettaglioDocumento = (doc: DocumentoAdminView) => {
    setDocumentoDettaglio(doc);
    setModaleDettaglioAperta(true);
  };

  // Modale Nuova Cartella
  const [modaleNuovaCartellaAperta, setModaleNuovaCartellaAperta] = useState(false);
  const [nomeCartellaInput, setNomeCartellaInput] = useState('');
  const [erroreNomeCartella, setErroreNomeCartella] = useState<string | undefined>(undefined);
  const [creazioneCartellaInCorso, setCreazioneCartellaInCorso] = useState(false);
  const nomeCartellaInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Modale Carica Documento
  const [modaleCaricaAperta, setModaleCaricaAperta] = useState(false);
  const [cartellaDestinazioneId, setCartellaDestinazioneId] = useState<string>('');
  const [fileCaricati, setFileCaricati] = useState<FileUploadItem[]>([]);
  const [fileOriginale, setFileOriginale] = useState<PickedFile | null>(null);
  const [ambitoScelto, setAmbitoScelto] = useState<'PUBBLICO' | 'RISERVATO'>('PUBBLICO');
  const [unitaDestinazioneId, setUnitaDestinazioneId] = useState<string>('');
  const [erroreUploadModale, setErroreUploadModale] = useState<string | null>(null);
  const [uploadInCorso, setUploadInCorso] = useState(false);

  // ConfirmDialog Eliminazione Documento
  const [documentoDaEliminare, setDocumentoDaEliminare] = useState<DocumentoAdminView | null>(null);

  // ConfirmDialog Eliminazione Cartella
  const [cartellaDaEliminare, setCartellaDaEliminare] = useState<CartellaAdminView | null>(null);

  // Caricamento dati iniziali
  const caricaDati = useCallback(async () => {
    if (!condominio?.id) {
      setCaricamento(false);
      return;
    }
    setCaricamento(true);
    setErrore(false);
    try {
      const [listaCartelle, listaDoc, listaUnita] = await Promise.all([
        services.documentiAdmin.listCartelle(condominio.id),
        services.documentiAdmin.listDocumenti(condominio.id),
        services.documentiAdmin.listUnita(condominio.id),
      ]);
      setCartelle(listaCartelle);
      setDocumenti(listaDoc);
      setUnitaDisponibili(listaUnita);

      if (listaCartelle.length > 0 && !cartellaDestinazioneId) {
        setCartellaDestinazioneId(listaCartelle[0]?.id || '');
      }
    } catch (err) {
      console.error('Errore caricamento documenti admin:', err);
      setErrore(true);
      toast.show({
        tone: 'error',
        message: 'Non è stato possibile caricare i documenti. Riprova.',
      });
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id, cartellaDestinazioneId, toast]);

  useEffect(() => {
    caricaDati();
  }, [caricaDati]);

  // Calcolo statistiche per le 3 StatCards
  const statistiche = useMemo(
    () => calcolaStatisticheDocumentiAdmin(documenti, cartelle),
    [documenti, cartelle],
  );

  // Documenti filtrati
  const documentiFiltrati = useMemo(
    () =>
      filtraDocumentiAdmin(documenti, {
        cartellaId: cartellaSelezionataId,
        ricerca: filtroRicerca,
        filtroRiservatezza,
      }),
    [documenti, cartellaSelezionataId, filtroRicerca, filtroRiservatezza],
  );

  // Informazioni cartella attiva
  const cartellaAttiva = useMemo(
    () =>
      cartellaSelezionataId === 'tutte'
        ? null
        : cartelle.find((c) => c.id === cartellaSelezionataId) || null,
    [cartellaSelezionataId, cartelle],
  );

  // Breadcrumbs dinamici
  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const base: BreadcrumbItem[] = [
      { label: 'Home', onPress: () => router.push('/admin/dashboard') },
    ];
    if (!cartellaAttiva) {
      base.push({ label: 'Documenti' });
    } else {
      base.push({
        label: 'Documenti',
        onPress: () => setCartellaSelezionataId('tutte'),
      });
      base.push({ label: cartellaAttiva.nomeCartella });
    }
    return base;
  }, [cartellaAttiva, router]);

  // Gestione Nuova Cartella
  const apriModaleNuovaCartella = () => {
    setNomeCartellaInput('');
    setErroreNomeCartella(undefined);
    setModaleNuovaCartellaAperta(true);
  };

  const confermaCreaCartella = async () => {
    if (!condominio?.id) return;
    const validazione = validaNuovaCartella(nomeCartellaInput);
    if (!validazione.valido) {
      setErroreNomeCartella(validazione.errore);
      return;
    }

    setCreazioneCartellaInCorso(true);
    setErroreNomeCartella(undefined);
    try {
      const creata = await services.documentiAdmin.creaCartella(
        condominio.id,
        nomeCartellaInput.trim(),
      );
      toast.show({
        tone: 'success',
        message: `Cartella "${creata.nomeCartella}" creata con successo.`,
      });
      setModaleNuovaCartellaAperta(false);
      setNomeCartellaInput('');
      await caricaDati();
      setCartellaSelezionataId(creata.id);
    } catch (err: any) {
      console.error('Errore creazione cartella:', err);
      setErroreNomeCartella(err?.message || 'Errore durante la creazione della cartella.');
    } finally {
      setCreazioneCartellaInCorso(false);
    }
  };

  // Gestione Eliminazione Cartella
  const confermaEliminaCartella = async () => {
    if (!cartellaDaEliminare) return;
    try {
      const res = await services.documentiAdmin.eliminaCartella(cartellaDaEliminare.id);
      if (!res.ok) {
        toast.show({
          tone: 'error',
          message: res.errore || 'Non è stato possibile eliminare la cartella.',
        });
        return;
      }
      toast.show({
        tone: 'success',
        message: `Cartella "${cartellaDaEliminare.nomeCartella}" eliminata.`,
      });
      if (cartellaSelezionataId === cartellaDaEliminare.id) {
        setCartellaSelezionataId('tutte');
      }
      setCartellaDaEliminare(null);
      await caricaDati();
    } catch (err: any) {
      toast.show({
        tone: 'error',
        message: err?.message || 'Errore durante l’eliminazione della cartella.',
      });
    }
  };

  // Gestione Caricamento Documento (REQ-A04)
  const apriModaleCaricaDocumento = () => {
    setFileCaricati([]);
    setFileOriginale(null);
    setAmbitoScelto('PUBBLICO');
    setUnitaDestinazioneId('');
    setErroreUploadModale(null);
    if (cartellaSelezionataId !== 'tutte') {
      setCartellaDestinazioneId(cartellaSelezionataId);
    } else if (cartelle.length > 0 && cartelle[0]) {
      setCartellaDestinazioneId(cartelle[0].id);
    }
    setModaleCaricaAperta(true);
  };

  const handleFilesSelected = (files: PickedFile[]) => {
    if (!files || files.length === 0) return;
    const picked = files[0];
    if (!picked) return;
    setFileOriginale(picked);
    setFileCaricati([
      {
        id: picked.id,
        name: picked.name,
        size: picked.size,
        type: picked.type,
        status: 'pronto',
      },
    ]);
    setErroreUploadModale(null);
  };

  const handleRemoveFile = () => {
    setFileCaricati([]);
    setFileOriginale(null);
  };

  const confermaCaricaDocumento = async () => {
    if (!condominio?.id) return;

    if (!fileOriginale || !fileOriginale.file) {
      setErroreUploadModale('Seleziona un file dal tuo dispositivo per procedere.');
      return;
    }

    const validazione = validaCaricamentoDocumento({
      cartellaId: cartellaDestinazioneId,
      nomeFile: fileOriginale.name,
      filePresente: Boolean(fileOriginale.file),
      isRiservato: ambitoScelto === 'RISERVATO',
      unitaId: unitaDestinazioneId,
    });

    if (!validazione.valido) {
      setErroreUploadModale(validazione.errore || 'Dati non validi.');
      return;
    }

    setUploadInCorso(true);
    setErroreUploadModale(null);

    setFileCaricati((prev) =>
      prev.map((f) => ({ ...f, status: 'in-caricamento' })),
    );

    try {
      const res = await services.documentiAdmin.caricaDocumento({
        condominioId: condominio.id,
        cartellaId: cartellaDestinazioneId,
        file: fileOriginale.file,
        nomeFile: fileOriginale.name,
        tipoMime: fileOriginale.type || null,
        dimensioneBytes: fileOriginale.size || null,
        unitaId: ambitoScelto === 'RISERVATO' ? unitaDestinazioneId : null,
      });

      if (!res.ok) {
        setErroreUploadModale(res.errore || 'Caricamento fallito.');
        setFileCaricati((prev) =>
          prev.map((f) => ({ ...f, status: 'errore', error: res.errore })),
        );
        return;
      }

      toast.show({
        tone: 'success',
        message: `Documento "${fileOriginale.name}" archiviato con successo.`,
      });
      setModaleCaricaAperta(false);
      await caricaDati();
    } catch (err: any) {
      console.error('Errore upload documento:', err);
      setErroreUploadModale(err?.message || 'Errore imprevisto durante il caricamento.');
      setFileCaricati((prev) =>
        prev.map((f) => ({ ...f, status: 'errore', error: err?.message })),
      );
    } finally {
      setUploadInCorso(false);
    }
  };

  // Gestione Download / Apertura sicura con Link Firmato (600s)
  const apriDocumentoSicuro = async (doc: DocumentoAdminView) => {
    setIdInDownload(doc.id);
    try {
      const res = await services.documentiAdmin.creaLinkFirmato(doc.urlStorage);
      if (!res.ok || !res.signedUrl) {
        toast.show({
          tone: 'warning',
          message:
            res.errore ||
            'File non ancora caricato nello spazio di archiviazione o collegamento non disponibile.',
        });
        return;
      }

      await Linking.openURL(res.signedUrl);
    } catch (err: any) {
      console.error('Errore link firmato:', err);
      toast.show({
        tone: 'error',
        message: 'Impossibile generare il collegamento sicuro per il file.',
      });
    } finally {
      setIdInDownload(null);
    }
  };

  // Gestione Eliminazione Documento
  const confermaEliminaDocumento = async () => {
    if (!documentoDaEliminare) return;
    try {
      const res = await services.documentiAdmin.eliminaDocumento(
        documentoDaEliminare.id,
        documentoDaEliminare.urlStorage,
      );
      if (!res.ok) {
        toast.show({
          tone: 'error',
          message: res.errore || 'Non è stato possibile eliminare il documento.',
        });
        return;
      }

      toast.show({
        tone: 'success',
        message: `Documento "${documentoDaEliminare.nomeFile}" eliminato.`,
      });
      setDocumentoDaEliminare(null);
      await caricaDati();
    } catch (err: any) {
      toast.show({
        tone: 'error',
        message: err?.message || 'Errore durante l’eliminazione del documento.',
      });
    }
  };

  // Opzioni per menù a tendina Select Cartelle
  const opzioniCartelleSelect: SelectOption[] = useMemo(
    () =>
      cartelle.map((c) => ({
        value: c.id,
        label: c.nomeCartella,
      })),
    [cartelle],
  );

  // Opzioni per menù a tendina Select Unità
  const opzioniUnitaSelect: SelectOption[] = useMemo(
    () =>
      unitaDisponibili.map((u) => ({
        value: u.id,
        label: u.label,
      })),
    [unitaDisponibili],
  );

  // Definizione colonne della tabella ResponsiveDataView
  const colonne = useMemo<DataColumn<DocumentoAdminView>[]>(
    () => [
      {
        key: 'tipo',
        header: 'Tipo',
        weight: 1,
        minWidth: 100,
        mobileLabel: 'Tipo',
        cell: (r) => (
          <View
            style={[
              styles.badgeTipoFile,
              { backgroundColor: r.specificaTipo.bgColor, borderColor: r.specificaTipo.color },
            ]}
            accessible
            accessibilityLabel={`File ${r.specificaTipo.label}`}
          >
            <Icon
              name={r.specificaTipo.icon as any}
              size="indicator"
              color={r.specificaTipo.color}
            />
            <Text style={[styles.testoTipoFile, { color: r.specificaTipo.color }]}>
              {r.specificaTipo.label}
            </Text>
          </View>
        ),
      },
      {
        key: 'nomeFile',
        header: 'Nome file',
        weight: 3,
        minWidth: 220,
        mobile: 'title',
        cell: (r) => (
          <View style={styles.cellaNomeFile}>
            <Text style={styles.titoloFile} numberOfLines={2} ellipsizeMode="middle">
              {r.nomeFile}
            </Text>
          </View>
        ),
      },
      {
        key: 'cartella',
        header: 'Cartella',
        weight: 2,
        minWidth: 150,
        mobileLabel: 'Cartella',
        cell: (r) => (
          <View style={styles.cellaCartellaTabella}>
            <Icon name="folder" size="indicator" color={colors.text.secondary} />
            <Text style={styles.testoCartellaTabella} numberOfLines={1}>
              {r.cartellaNome}
            </Text>
          </View>
        ),
      },
      {
        key: 'data',
        header: 'Caricato il',
        weight: 1,
        minWidth: 110,
        mobileLabel: 'Data',
        cell: (r) => (
          <Text style={styles.testoData}>
            {formattaDataDocumento(r.createdAt)}
          </Text>
        ),
      },
      {
        key: 'destinatario',
        header: 'Destinatario',
        weight: 3,
        minWidth: 200,
        mobileLabel: 'Destinatario',
        cell: (r) => (
          <Badge
            status={r.badgeRiservatezza.status}
            label={r.badgeRiservatezza.label}
          />
        ),
      },
    ],
    [],
  );

  const erroreScheda = errore ? { message: 'Errore caricamento', onRetry: caricaDati } : undefined;

  return (
    <View style={styles.pagina}>
      {/* 1. PageHeader con Breadcrumbs, Nuova Cartella e Carica Documento */}
      <PageHeader
        title="Documenti e Drive Condominiale"
        subtitle="Archivia, organizza e condividi i documenti condominiali in sicurezza con permessi dedicati."
        breadcrumbs={breadcrumbs}
        secondaryAction={{
          label: 'Nuova cartella',
          icon: 'folder-plus',
          onPress: apriModaleNuovaCartella,
        }}
        action={{
          label: 'Carica documento',
          icon: 'upload',
          onPress: apriModaleCaricaDocumento,
        }}
      />

      {/* 2. 3 StatCard Ufficiali: Documenti archiviati, Cartelle create, Documenti riservati */}
      <View style={styles.schede}>
        <View style={styles.scheda}>
          <StatCard
            icon="file-text"
            tile="blue"
            title="Documenti archiviati"
            value={caricamento ? '' : String(statistiche.totaleDocumenti)}
            description="Totale file nel condominio"
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="folder"
            tile="navy"
            title="Cartelle create"
            value={caricamento ? '' : String(statistiche.totaleCartelle)}
            description="Sezioni del drive condominiale"
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="lock"
            tile="teal"
            title="Documenti riservati"
            value={caricamento ? '' : String(statistiche.documentiRiservati)}
            description="File limitati a specifiche unità"
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
      </View>

      {/* 3. Sezione Cartelle: griglia/elenco cartelle per navigazione rapida */}
      <View style={styles.sezioneCartelle}>
        <View style={styles.intestazioneCartelle}>
          <Text
            accessibilityRole="header"
            aria-level={2}
            style={styles.titoloSezione}
          >
            Cartelle del condominio
          </Text>
          <Text style={styles.sottotitoloSezione}>
            Seleziona una cartella per filtrare i file o visualizza tutti i documenti.
          </Text>
        </View>

        <View style={styles.grigliaCartelle}>
          {/* Scheda "Tutte le cartelle" */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tutte le cartelle, ${documenti.length} documenti totali`}
            accessibilityState={{ selected: cartellaSelezionataId === 'tutte' }}
            onPress={() => setCartellaSelezionataId('tutte')}
            onFocus={() => setFocusedCartellaId('tutte')}
            onBlur={() => setFocusedCartellaId((prev) => (prev === 'tutte' ? null : prev))}
            style={({ hovered }) => [
              styles.cardCartella,
              cartellaSelezionataId === 'tutte' && styles.cardCartellaAttiva,
              hovered && styles.cardCartellaHover,
              focusedCartellaId === 'tutte' && focusRing,
            ]}
          >
            <View style={styles.iconaCartellaWrap}>
              <Icon
                name={cartellaSelezionataId === 'tutte' ? 'folder-open' : 'folder'}
                size="card"
                color={
                  cartellaSelezionataId === 'tutte' ? colors.brand.navy : colors.action.default
                }
              />
            </View>
            <View style={styles.infoCartella}>
              <Text style={styles.nomeCartella} numberOfLines={1}>
                Tutte le cartelle
              </Text>
              <Text style={styles.conteggioCartella}>
                {documenti.length} {documenti.length === 1 ? 'documento' : 'documenti'}
              </Text>
            </View>
          </Pressable>

          {/* Elenco singole cartelle del condominio */}
          {cartelle.map((c) => {
            const isAttiva = cartellaSelezionataId === c.id;
            const isFocused = focusedCartellaId === c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Cartella ${c.nomeCartella}, ${c.conteggioDocumenti} documenti`}
                accessibilityState={{ selected: isAttiva }}
                onPress={() => setCartellaSelezionataId(c.id)}
                onFocus={() => setFocusedCartellaId(c.id)}
                onBlur={() => setFocusedCartellaId((prev) => (prev === c.id ? null : prev))}
                style={({ hovered }) => [
                  styles.cardCartella,
                  isAttiva && styles.cardCartellaAttiva,
                  hovered && styles.cardCartellaHover,
                  isFocused && focusRing,
                ]}
              >
                <View style={styles.iconaCartellaWrap}>
                  <Icon
                    name={isAttiva ? 'folder-open' : 'folder'}
                    size="card"
                    color={isAttiva ? colors.brand.navy : colors.action.default}
                  />
                </View>
                <View style={styles.infoCartella}>
                  <Text style={styles.nomeCartella} numberOfLines={1}>
                    {c.nomeCartella}
                  </Text>
                  <Text style={styles.conteggioCartella}>
                    {c.conteggioDocumenti}{' '}
                    {c.conteggioDocumenti === 1 ? 'documento' : 'documenti'}
                  </Text>
                </View>

                {/* Se vuota, mostra pulsante rapido di eliminazione */}
                {c.conteggioDocumenti === 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Elimina cartella vuota ${c.nomeCartella}`}
                    onPress={(e) => {
                      e.stopPropagation();
                      setCartellaDaEliminare(c);
                    }}
                    style={styles.pulsanteEliminaCartella}
                  >
                    <Icon name="trash-2" size="indicator" color={colors.semantic.error.foreground} />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 4. Sezione File della Cartella selezionata (o Tutti i documenti) */}
      <Card
        title={
          cartellaAttiva
            ? `Documenti in: ${cartellaAttiva.nomeCartella}`
            : 'Tutti i documenti archiviati'
        }
      >
        <Text style={styles.sottotitoloCard}>
          {documentiFiltrati.length} {documentiFiltrati.length === 1 ? 'file trovato' : 'file trovati'}
        </Text>

        {/* Tabella Desktop/Tablet e Card Mobile tramite ResponsiveDataView */}
        <ResponsiveDataView<DocumentoAdminView>
          label="Elenco documenti del drive condominiale"
          columns={colonne}
          rows={documentiFiltrati}
          getRowKey={(r: DocumentoAdminView) => r.id}
          getRowLabel={(r: DocumentoAdminView) => r.nomeFile}
          onRowPress={(r: DocumentoAdminView) => apriDettaglioDocumento(r)}
          loading={caricamento}
          empty={{
            icon: 'file-text',
            title:
              filtroRicerca || filtroRiservatezza !== 'tutti' || cartellaSelezionataId !== 'tutte'
                ? 'Nessun documento corrisponde ai criteri'
                : 'Nessun documento archiviato',
            description:
              filtroRicerca || filtroRiservatezza !== 'tutti' || cartellaSelezionataId !== 'tutte'
                ? 'Prova a modificare i filtri applicati o a cancellare il testo di ricerca.'
                : 'Non è ancora presente alcun documento in questa sezione. Clicca su "Carica documento" per iniziare.',
          }}
          filters={
            <View style={styles.barraFiltri}>
              <SearchBar
                value={filtroRicerca}
                onChangeText={setFiltroRicerca}
                placeholder="Cerca per nome file..."
                label="Cerca documenti"
                showLabel
              />
              <FilterChips
                label="Filtra per riservatezza"
                allLabel="Tutti i file"
                options={OPZIONI_RISERVATEZZA_CHIPS}
                value={filtroRiservatezza === 'tutti' ? [] : [filtroRiservatezza]}
                onChange={(val) =>
                  setFiltroRiservatezza(
                    val.length === 0 ? 'tutti' : (val[0] as FiltroRiservatezzaAdmin),
                  )
                }
              />
            </View>
          }
        />
      </Card>

      {/* Modale Accessibile: Nuova Cartella */}
      <Modal
        visible={modaleNuovaCartellaAperta}
        title="Nuova cartella"
        onClose={() => setModaleNuovaCartellaAperta(false)}
        initialFocusRef={nomeCartellaInputRef}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleNuovaCartellaAperta(false)}
              disabled={creazioneCartellaInCorso}
            />
            <Button
              variant="primary"
              label="Crea cartella"
              icon="folder-plus"
              onPress={confermaCreaCartella}
              loading={creazioneCartellaInCorso}
            />
          </ModalActions>
        }
      >
        <View style={styles.corpoModale}>
          <Text style={styles.sottotitoloModale}>
            Crea una nuova cartella per organizzare i documenti del condominio.
          </Text>
          <Input
            inputRef={nomeCartellaInputRef}
            label="Nome cartella *"
            placeholder="Es. Verbali assemblee, Tabelle millesimali..."
            value={nomeCartellaInput}
            onChangeText={(t) => {
              setNomeCartellaInput(t);
              if (erroreNomeCartella) setErroreNomeCartella(undefined);
            }}
            error={erroreNomeCartella}
            disabled={creazioneCartellaInCorso}
          />
        </View>
      </Modal>

      {/* Modale Accessibile: Carica Documento (REQ-A04) */}
      <Modal
        visible={modaleCaricaAperta}
        title="Carica nuovo documento"
        onClose={() => setModaleCaricaAperta(false)}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleCaricaAperta(false)}
              disabled={uploadInCorso}
            />
            <Button
              variant="primary"
              label="Carica documento"
              icon="upload"
              onPress={confermaCaricaDocumento}
              loading={uploadInCorso}
              disabled={fileCaricati.length === 0}
            />
          </ModalActions>
        }
      >
        <View style={styles.corpoModale}>
          <Text style={styles.sottotitoloModale}>
            Archivia un file nello spazio protetto del condominio e definiscine l'ambito di visibilità (RLS).
          </Text>

          {/* Selettore Cartella di destinazione */}
          {opzioniCartelleSelect.length > 0 ? (
            <Select
              label="Cartella di destinazione *"
              value={cartellaDestinazioneId}
              options={opzioniCartelleSelect}
              onChange={setCartellaDestinazioneId}
              disabled={uploadInCorso}
            />
          ) : (
            <Text style={styles.messaggioNessunaCartella}>
              Nessuna cartella disponibile. Verrà creata una cartella predefinita o creane una da "Nuova cartella".
            </Text>
          )}

          {/* Area Drag & Drop / Selezione File */}
          <FileUpload
            label="File da caricare *"
            helperText="Formati ammessi: PDF, Word, Excel, Immagini (max 50 MB)"
            files={fileCaricati}
            onFilesSelected={handleFilesSelected}
            onRemove={handleRemoveFile}
            accept={[
              'application/pdf',
              '.pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              '.doc',
              '.docx',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              '.xls',
              '.xlsx',
              'image/jpeg',
              'image/png',
              '.jpg',
              '.jpeg',
              '.png',
            ]}
            maxSizeBytes={50 * 1024 * 1024}
            multiple={false}
            error={erroreUploadModale || undefined}
            disabled={uploadInCorso}
          />

          {/* Sezione Ambito di Visibilità e Privacy (RLS) */}
          <View style={styles.sezionePrivacy}>
            <Text style={styles.titoloPrivacy}>Ambito di Visibilità e Privacy (RLS) *</Text>
            <RadioGroup
              label="Ambito di visibilità"
              options={OPZIONI_AMBITO_RADIO}
              value={ambitoScelto}
              onChange={(v) => {
                setAmbitoScelto(v as 'PUBBLICO' | 'RISERVATO');
                if (v === 'PUBBLICO') setUnitaDestinazioneId('');
              }}
              disabled={uploadInCorso}
            />

            {/* Menù a tendina unità se riservato */}
            {ambitoScelto === 'RISERVATO' ? (
              <View style={styles.bloccoSelettoreUnita}>
                <Select
                  label="Unità immobiliare di destinazione *"
                  placeholder="Seleziona palazzo e interno..."
                  value={unitaDestinazioneId}
                  options={opzioniUnitaSelect}
                  onChange={setUnitaDestinazioneId}
                  disabled={uploadInCorso}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Modale Visualizzazione Dettagli Documento (aperta al click su qualsiasi riga) */}
      <Modal
        visible={modaleDettaglioAperta && Boolean(documentoDettaglio)}
        title="Dettagli documento"
        onClose={() => setModaleDettaglioAperta(false)}
        actions={
          <ModalActions>
            <Button
              variant="destructive"
              label="Elimina"
              icon="trash-2"
              onPress={() => {
                if (!documentoDettaglio) return;
                const target = documentoDettaglio;
                setModaleDettaglioAperta(false);
                setDocumentoDaEliminare(target);
              }}
              accessibilityHint="Apre la conferma di eliminazione del documento"
            />
            <Button
              variant="secondary"
              label="Chiudi"
              onPress={() => setModaleDettaglioAperta(false)}
            />
            <Button
              variant="primary"
              label="Scarica"
              icon="download"
              loading={idInDownload === documentoDettaglio?.id}
              onPress={() => {
                if (documentoDettaglio) apriDocumentoSicuro(documentoDettaglio);
              }}
              accessibilityHint="Genera il link firmato e apre il documento in sicurezza"
            />
          </ModalActions>
        }
      >
        {documentoDettaglio ? (
          <View style={styles.corpoDettaglio}>
            <View style={styles.rigaIntestazioneDettaglio}>
              <View
                style={[
                  styles.badgeTipoFile,
                  {
                    backgroundColor: documentoDettaglio.specificaTipo.bgColor,
                    borderColor: documentoDettaglio.specificaTipo.color,
                  },
                ]}
              >
                <Icon
                  name={documentoDettaglio.specificaTipo.icon as any}
                  size="indicator"
                  color={documentoDettaglio.specificaTipo.color}
                />
                <Text
                  style={[
                    styles.testoTipoFile,
                    { color: documentoDettaglio.specificaTipo.color },
                  ]}
                >
                  {documentoDettaglio.specificaTipo.label}
                </Text>
              </View>
              <Badge
                status={documentoDettaglio.badgeRiservatezza.status}
                label={documentoDettaglio.badgeRiservatezza.label}
              />
            </View>

            <Text style={styles.titoloFileDettaglio} selectable>
              {documentoDettaglio.nomeFile}
            </Text>

            <View style={styles.grigliaMetadatiDettaglio}>
              <View style={styles.itemMetadatoDettaglio}>
                <View style={styles.labelMetadatoDettaglio}>
                  <Icon name="folder" size="indicator" color={colors.text.secondary} />
                  <Text style={styles.testoLabelMetadato}>Cartella</Text>
                </View>
                <Text style={styles.testoValoreMetadato}>
                  {documentoDettaglio.cartellaNome}
                </Text>
              </View>

              <View style={styles.itemMetadatoDettaglio}>
                <View style={styles.labelMetadatoDettaglio}>
                  <Icon name="calendar-days" size="indicator" color={colors.text.secondary} />
                  <Text style={styles.testoLabelMetadato}>Caricato il</Text>
                </View>
                <Text style={styles.testoValoreMetadato}>
                  {formattaDataDocumento(documentoDettaglio.createdAt)}
                </Text>
              </View>

              <View style={styles.itemMetadatoDettaglio}>
                <View style={styles.labelMetadatoDettaglio}>
                  <Icon name="file" size="indicator" color={colors.text.secondary} />
                  <Text style={styles.testoLabelMetadato}>Dimensione</Text>
                </View>
                <Text style={styles.testoValoreMetadato}>
                  {formattaDimensioneFile(documentoDettaglio.dimensioneBytes)}
                </Text>
              </View>

              <View style={styles.itemMetadatoDettaglio}>
                <View style={styles.labelMetadatoDettaglio}>
                  <Icon name="users" size="indicator" color={colors.text.secondary} />
                  <Text style={styles.testoLabelMetadato}>Destinatario</Text>
                </View>
                <Text style={styles.testoValoreMetadato}>
                  {documentoDettaglio.badgeRiservatezza.label}
                </Text>
              </View>
            </View>

            <View style={styles.boxSicurezzaDettaglio}>
              <Icon name="lock" size="indicator" color={colors.action.default} />
              <Text style={styles.testoSicurezzaDettaglio}>
                File archiviato nel bucket protetto <Text style={styles.testoCodiceStorage}>documenti-condominio</Text>. L'accesso avviene tramite collegamento temporaneo firmato a 600 secondi.
              </Text>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* ConfirmDialog: Eliminazione Documento */}
      <ConfirmDialog
        visible={Boolean(documentoDaEliminare)}
        title="Eliminare questo documento?"
        description={`Il file "${documentoDaEliminare?.nomeFile}" verrà rimosso definitivamente sia dallo spazio di archiviazione protetto sia dal registro condominiale.`}
        confirmLabel="Elimina documento"
        cancelLabel="Annulla"
        destructive
        onConfirm={confermaEliminaDocumento}
        onCancel={() => setDocumentoDaEliminare(null)}
      />

      {/* ConfirmDialog: Eliminazione Cartella Vuota */}
      <ConfirmDialog
        visible={Boolean(cartellaDaEliminare)}
        title="Eliminare questa cartella?"
        description={`La cartella "${cartellaDaEliminare?.nomeCartella}" è vuota e verrà rimossa definitivamente.`}
        confirmLabel="Elimina cartella"
        cancelLabel="Annulla"
        destructive
        onConfirm={confermaEliminaCartella}
        onCancel={() => setCartellaDaEliminare(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    padding: space[4],
    gap: space[5],
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  schede: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  scheda: {
    flex: 1,
    minWidth: 260,
  },
  sezioneCartelle: {
    gap: space[3],
  },
  intestazioneCartelle: {
    gap: space[1],
  },
  titoloSezione: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sottotitoloSezione: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  grigliaCartelle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  cardCartella: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    minWidth: 200,
    flexGrow: 1,
    flexBasis: 220,
    maxWidth: 360,
  },
  cardCartellaAttiva: {
    borderColor: colors.action.default,
    backgroundColor: colors.tile.blue.background,
    borderWidth: 2,
  },
  cardCartellaHover: {
    borderColor: colors.action.hover,
  },
  iconaCartellaWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCartella: {
    flex: 1,
    gap: 2,
  },
  nomeCartella: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  conteggioCartella: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  pulsanteEliminaCartella: {
    padding: space[1],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sottotitoloCard: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: space[3],
  },
  barraFiltri: {
    gap: space[3],
    marginBottom: space[3],
  },
  badgeTipoFile: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    borderWidth: borderWidths.thin,
  },
  testoTipoFile: {
    fontSize: 12,
    fontWeight: '600',
  },
  cellaNomeFile: {
    gap: 2,
  },
  titoloFile: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  cellaCartellaTabella: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  testoCartellaTabella: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  testoData: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  corpoDettaglio: {
    gap: space[4],
  },
  rigaIntestazioneDettaglio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  titoloFileDettaglio: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    lineHeight: 22,
  },
  grigliaMetadatiDettaglio: {
    backgroundColor: colors.background,
    borderRadius: radii.card,
    padding: space[4],
    gap: space[3],
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  itemMetadatoDettaglio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  labelMetadatoDettaglio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoLabelMetadato: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  testoValoreMetadato: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  boxSicurezzaDettaglio: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    backgroundColor: colors.semantic.info.background,
    borderRadius: radii.card,
    padding: space[3],
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  testoSicurezzaDettaglio: {
    flex: 1,
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  testoCodiceStorage: {
    fontWeight: '600',
    color: colors.brand.navy,
  },
  corpoModale: {
    gap: space[4],
    paddingBottom: space[2],
  },
  sottotitoloModale: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: space[2],
  },
  messaggioNessunaCartella: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  sezionePrivacy: {
    gap: space[2],
    marginTop: space[2],
    paddingTop: space[3],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  titoloPrivacy: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: space[1],
  },
  bloccoSelettoreUnita: {
    marginTop: space[2],
  },
});
