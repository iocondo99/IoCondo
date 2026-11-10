import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import {
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
  useBreakpoint,
  useToast,
  type BadgeStatus,
  type DataColumn,
  type FilterOption,
  type SelectOption,
  type TabItem,
} from '@iocondo/ui';
import {
  calcolaStatisticheManutenzione,
  filtraFornitori,
  filtraTicket,
  validaNuovoFornitore,
  validaNuovoTicket,
  type FornitoreAdminView,
  type InputModificaTicketAdmin,
  type OpzioneCategoriaGuasto,
  type OpzioneUnitaManutenzione,
  type PrioritaTicket,
  type StatoTicket,
  type TicketAdminView,
} from '@iocondo/data';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const OPZIONI_PRIORITA: readonly SelectOption[] = [
  { value: 'URGENTE', label: 'Urgente' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'BASSA', label: 'Bassa' },
];

const OPZIONI_STATO_SELECT: readonly SelectOption[] = [
  { value: 'APERTO', label: 'Aperto' },
  { value: 'LAVORAZIONE', label: 'In lavorazione' },
  { value: 'RISOLTO', label: 'Risolto' },
];

const OPZIONI_CATEGORIA_FORNITORE: readonly SelectOption[] = [
  { value: 'Idraulico', label: 'Idraulico / Termoidraulica' },
  { value: 'Elettrico', label: 'Elettrico / Citofoni' },
  { value: 'Edile', label: 'Edile / Muratura' },
  { value: 'Ascensori', label: 'Ascensori e Montacarichi' },
  { value: 'Pulizie', label: 'Impresa di Pulizie' },
  { value: 'Giardinaggio', label: 'Giardinaggio e Aree Verdi' },
  { value: 'Fabbro', label: 'Fabbro / Serramenti' },
  { value: 'Altro', label: 'Altro settore' },
];

export function AdminManutenzioneScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Manutenzione e Ticket"
          subtitle="Gestisci le segnalazioni di guasto, assegna i lavori con Magic Link e consulta la rubrica fornitori."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminManutenzioneContenuto />;
}

function CellaTitolo({ titolo }: { titolo: string }) {
  const { breakpoint, isMobile } = useBreakpoint();
  return (
    <Text
      accessibilityRole={isMobile ? 'header' : undefined}
      aria-level={isMobile ? 3 : undefined}
      style={[
        textStyle(isMobile ? 'h4' : 'body', breakpoint),
        isMobile ? styles.titoloMobile : styles.titoloTabella,
      ]}
      numberOfLines={1}
    >
      {titolo}
    </Text>
  );
}

function AdminManutenzioneContenuto() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dettaglioId?: string; id?: string }>();
  const targetId = params.dettaglioId || params.id;
  const { condominio, profilo } = useProfilo();
  const toast = useToast();

  const [tabAttivo, setTabAttivo] = useState<'ticket' | 'fornitori'>('ticket');
  const [tickets, setTickets] = useState<TicketAdminView[]>([]);
  const [fornitori, setFornitori] = useState<FornitoreAdminView[]>([]);
  const [categorie, setCategorie] = useState<OpzioneCategoriaGuasto[]>([]);
  const [unitaDisponibili, setUnitaDisponibili] = useState<OpzioneUnitaManutenzione[]>([]);

  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  // Filtri Ticket
  const [filtroChip, setFiltroChip] = useState<string>('tutti');
  const [filtroRicercaTicket, setFiltroRicercaTicket] = useState('');

  // Filtri Fornitori
  const [filtroRicercaFornitori, setFiltroRicercaFornitori] = useState('');

  // Modale: Nuova Segnalazione (Ticket Amministratore)
  const [modaleNuovoTicketAperta, setModaleNuovoTicketAperta] = useState(false);
  const [titoloTicketInput, setTitoloTicketInput] = useState('');
  const [categoriaTicketInput, setCategoriaTicketInput] = useState<string>('');
  const [prioritaTicketInput, setPrioritaTicketInput] = useState<PrioritaTicket>('MEDIA');
  const [isAreaComuneInput, setIsAreaComuneInput] = useState(true);
  const [unitaTicketInput, setUnitaTicketInput] = useState<string>('');
  const [descrizioneTicketInput, setDescrizioneTicketInput] = useState('');
  const [erroriNuovoTicket, setErroriNuovoTicket] = useState<Record<string, string>>({});
  const [salvataggioTicketInCorso, setSalvataggioTicketInCorso] = useState(false);
  const inputTitoloRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Modale: Nuovo Fornitore Convenzionato
  const [modaleNuovoFornitoreAperta, setModaleNuovoFornitoreAperta] = useState(false);
  const [ragioneSocialeInput, setRagioneSocialeInput] = useState('');
  const [categoriaFornitoreInput, setCategoriaFornitoreInput] = useState<string>('Idraulico');
  const [pIvaInput, setPIvaInput] = useState('');
  const [telefonoInput, setTelefonoInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [ibanInput, setIbanInput] = useState('');
  const [erroriNuovoFornitore, setErroriNuovoFornitore] = useState<Record<string, string>>({});
  const [salvataggioFornitoreInCorso, setSalvataggioFornitoreInCorso] = useState(false);
  const inputRagioneSocialeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Modale: Dettagli Ticket
  const [modaleDettagliAperta, setModaleDettagliAperta] = useState(false);
  const [ticketDettaglio, setTicketDettaglio] = useState<TicketAdminView | null>(null);
  const [nuovoMessaggioInput, setNuovoMessaggioInput] = useState('');
  const [invioMessaggioInCorso, setInvioMessaggioInCorso] = useState(false);

  // Modale: Modifica Ticket (Dati, Fornitore / Magic Link, Consuntivo)
  const [modaleModificaAperta, setModaleModificaAperta] = useState(false);
  const [ticketDaModificare, setTicketDaModificare] = useState<TicketAdminView | null>(null);
  const [titoloModificaInput, setTitoloModificaInput] = useState('');
  const [categoriaModificaInput, setCategoriaModificaInput] = useState<string>('');
  const [prioritaModificaInput, setPrioritaModificaInput] = useState<PrioritaTicket>('MEDIA');
  const [statoModificaInput, setStatoModificaInput] = useState<StatoTicket>('APERTO');
  const [isAreaComuneModificaInput, setIsAreaComuneModificaInput] = useState(true);
  const [unitaModificaInput, setUnitaModificaInput] = useState<string>('');
  const [descrizioneModificaInput, setDescrizioneModificaInput] = useState('');
  const [fornitoreModificaId, setFornitoreModificaId] = useState<string>('');
  const [dataPrevistaModificaInput, setDataPrevistaModificaInput] = useState('');
  const [noteFornitoreModificaInput, setNoteFornitoreModificaInput] = useState('');
  const [magicLinkModifica, setMagicLinkModifica] = useState<string | null>(null);
  const [consuntivoModificaInput, setConsuntivoModificaInput] = useState('');
  const [linkCopiato, setLinkCopiato] = useState(false);
  const [salvataggioModificaInCorso, setSalvataggioModificaInCorso] = useState(false);
  const [erroriModifica, setErroriModifica] = useState<Record<string, string>>({});

  const caricaDati = useCallback(async () => {
    if (!condominio?.id) return;
    setCaricamento(true);
    setErrore(false);

    try {
      const [tktList, fornList, catList, unitaList] = await Promise.all([
        services.manutenzione.listTickets(condominio.id),
        services.manutenzione.listFornitori(profilo?.id),
        services.manutenzione.listCategorie(),
        services.manutenzione.listUnita(condominio.id),
      ]);

      setTickets(tktList);
      setFornitori(fornList);
      setCategorie(catList);
      setUnitaDisponibili(unitaList);

      if (catList.length > 0 && !categoriaTicketInput) {
        setCategoriaTicketInput(catList[0]!.id);
      }
      if (unitaList.length > 0 && !unitaTicketInput) {
        setUnitaTicketInput(unitaList[0]!.id);
      }
    } catch {
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id, profilo?.id, categoriaTicketInput, unitaTicketInput]);

  React.useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  // Apertura automatica del dettaglio ticket se richiesto da notifica o deep link
  useEffect(() => {
    if (!targetId || tickets.length === 0) return;
    const tkt = tickets.find((t) => t.id === targetId);
    if (tkt) {
      setTicketDettaglio(tkt);
      setNuovoMessaggioInput('');
      setModaleDettagliAperta(true);
    }
  }, [targetId, tickets]);

  const statistiche = useMemo(() => {
    return calcolaStatisticheManutenzione(tickets, fornitori);
  }, [tickets, fornitori]);

  const ticketsFiltrati = useMemo(() => {
    return filtraTicket(tickets, {
      stato: filtroChip,
      ricerca: filtroRicercaTicket,
    });
  }, [tickets, filtroChip, filtroRicercaTicket]);

  const fornitoriFiltrati = useMemo(() => {
    return filtraFornitori(fornitori, filtroRicercaFornitori);
  }, [fornitori, filtroRicercaFornitori]);

  // Opzioni filtro stato con conteggi reali (uguale al lato condòmino)
  const opzioniFiltroStato: readonly FilterOption[] = useMemo(() => {
    const aperti = tickets.filter((t) => t.stato === 'APERTO').length;
    const lavorazione = tickets.filter((t) => t.stato === 'LAVORAZIONE').length;
    const risolti = tickets.filter((t) => t.stato === 'RISOLTO').length;
    const urgenti = tickets.filter((t) => t.priorita === 'URGENTE').length;
    const areeComuni = tickets.filter((t) => t.is_area_comune).length;
    return [
      { value: 'aperti', label: `Aperti (${aperti})` },
      { value: 'in_lavorazione', label: `In lavorazione (${lavorazione})` },
      { value: 'risolti', label: `Risolti (${risolti})` },
      { value: 'urgenti', label: `Urgenti (${urgenti})` },
      { value: 'aree_comuni', label: `Aree comuni (${areeComuni})` },
    ];
  }, [tickets]);

  const opzioniCategorieSelect: SelectOption[] = useMemo(() => {
    return categorie.map((c) => ({ value: c.id, label: c.nome }));
  }, [categorie]);

  const opzioniUnitaSelect: SelectOption[] = useMemo(() => {
    return unitaDisponibili.map((u) => ({ value: u.id, label: u.label }));
  }, [unitaDisponibili]);

  const opzioniFornitoriSelect: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: 'Nessun fornitore assegnato' },
      ...fornitori.map((f) => ({
        value: f.id,
        label: `${f.ragione_sociale}${f.categoria ? ` (${f.categoria})` : ''}`,
      })),
    ];
  }, [fornitori]);

  // Copia Magic Link negli appunti
  const copiaMagicLinkNegliAppunti = async (link: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setLinkCopiato(true);
      toast.show({ message: 'Magic Link copiato negli appunti!', tone: 'success' });
      setTimeout(() => setLinkCopiato(false), 3000);
    } catch {
      toast.show({
        message: 'Link selezionato: premi Ctrl+C per copiarlo.',
        tone: 'info',
      });
    }
  };

  // Apertura Modale Nuova Segnalazione
  const apriNuovoTicket = () => {
    setTitoloTicketInput('');
    setDescrizioneTicketInput('');
    setPrioritaTicketInput('MEDIA');
    setIsAreaComuneInput(true);
    setErroriNuovoTicket({});
    setModaleNuovoTicketAperta(true);
    setTimeout(() => inputTitoloRef.current?.focus(), 150);
  };

  // Apertura Modale Nuovo Fornitore
  const apriNuovoFornitore = () => {
    setRagioneSocialeInput('');
    setCategoriaFornitoreInput('Idraulico');
    setPIvaInput('');
    setTelefonoInput('');
    setEmailInput('');
    setIbanInput('');
    setErroriNuovoFornitore({});
    setModaleNuovoFornitoreAperta(true);
    setTimeout(() => inputRagioneSocialeRef.current?.focus(), 150);
  };

  // Apertura Modale Dettagli Ticket
  const apriDettagliTicket = (tkt: TicketAdminView) => {
    setTicketDettaglio(tkt);
    setNuovoMessaggioInput('');
    setModaleDettagliAperta(true);
  };

  // Apertura Modale Modifica Ticket
  const apriModaleModifica = (tkt: TicketAdminView) => {
    setTicketDaModificare(tkt);
    setTitoloModificaInput(tkt.titolo);
    setDescrizioneModificaInput(tkt.descrizione || '');
    setCategoriaModificaInput(tkt.categoria_id || (categorie[0]?.id ?? ''));
    setPrioritaModificaInput(tkt.priorita);
    setStatoModificaInput(tkt.stato);
    setIsAreaComuneModificaInput(tkt.is_area_comune);
    setUnitaModificaInput(tkt.unita_id || (unitaDisponibili[0]?.id ?? ''));
    setFornitoreModificaId(tkt.fornitore_assegnato_id || '');
    setDataPrevistaModificaInput(tkt.data_intervento_prevista || '');
    setNoteFornitoreModificaInput(tkt.ultimo_intervento?.note_fornitore || '');
    setMagicLinkModifica(tkt.ultimo_intervento?.url_magico || null);
    setConsuntivoModificaInput(
      tkt.ultimo_intervento?.importo_consuntivo
        ? String(tkt.ultimo_intervento.importo_consuntivo)
        : '',
    );
    setLinkCopiato(false);
    setErroriModifica({});
    setModaleModificaAperta(true);
  };

  // Salvataggio Nuovo Ticket
  const salvaNuovoTicket = async () => {
    const validazione = validaNuovoTicket({
      titolo: titoloTicketInput,
      isAreaComune: isAreaComuneInput,
      unitaId: unitaTicketInput,
      priorita: prioritaTicketInput,
    });

    if (!validazione.valido) {
      setErroriNuovoTicket(validazione.errori);
      return;
    }

    setSalvataggioTicketInCorso(true);
    try {
      await services.manutenzione.createTicket({
        condominioId: condominio!.id,
        titolo: titoloTicketInput.trim(),
        descrizione: descrizioneTicketInput.trim() || null,
        categoriaId: categoriaTicketInput || null,
        priorita: prioritaTicketInput,
        isAreaComune: isAreaComuneInput,
        unitaId: isAreaComuneInput ? null : unitaTicketInput,
        segnalatoreId: profilo?.id ?? null,
      });

      toast.show({
        message: 'Segnalazione guasto registrata con successo.',
        tone: 'success',
      });
      setModaleNuovoTicketAperta(false);
      await caricaDati();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la creazione del ticket.';
      setErroriNuovoTicket({ generale: msg });
    } finally {
      setSalvataggioTicketInCorso(false);
    }
  };

  // Salvataggio Nuovo Fornitore
  const salvaNuovoFornitore = async () => {
    const validazione = validaNuovoFornitore({
      ragioneSociale: ragioneSocialeInput,
      pIva: pIvaInput,
      email: emailInput,
      telefono: telefonoInput,
      categoria: categoriaFornitoreInput,
    });

    if (!validazione.valido) {
      setErroriNuovoFornitore(validazione.errori);
      return;
    }

    setSalvataggioFornitoreInCorso(true);
    try {
      await services.manutenzione.createFornitore({
        adminId: profilo!.id,
        ragioneSociale: ragioneSocialeInput.trim(),
        pIva: pIvaInput.trim() || null,
        iban: ibanInput.trim() || null,
        email: emailInput.trim() || null,
        telefono: telefonoInput.trim() || null,
        categoria: categoriaFornitoreInput,
      });

      toast.show({
        message: `Fornitore "${ragioneSocialeInput.trim()}" aggiunto in rubrica.`,
        tone: 'success',
      });
      setModaleNuovoFornitoreAperta(false);
      await caricaDati();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la creazione del fornitore.';
      setErroriNuovoFornitore({ generale: msg });
    } finally {
      setSalvataggioFornitoreInCorso(false);
    }
  };

  // Salvataggio Modifiche Ticket
  const salvaModificheTicket = async () => {
    if (!ticketDaModificare) return;

    if (!titoloModificaInput.trim()) {
      setErroriModifica({ titolo: 'Inserisci il titolo del ticket.' });
      return;
    }

    let importoNum: number | null = null;
    if (consuntivoModificaInput.trim()) {
      const pulito = consuntivoModificaInput.replace(',', '.').trim();
      const n = Number(pulito);
      if (Number.isNaN(n) || n < 0) {
        setErroriModifica({ consuntivo: 'Inserisci un importo valido in euro.' });
        return;
      }
      importoNum = Math.round(n * 100) / 100;
    }

    setSalvataggioModificaInCorso(true);
    try {
      const payload: InputModificaTicketAdmin = {
        ticketId: ticketDaModificare.id,
        titolo: titoloModificaInput.trim(),
        descrizione: descrizioneModificaInput.trim() || null,
        categoriaId: categoriaModificaInput || null,
        priorita: prioritaModificaInput,
        stato: statoModificaInput,
        isAreaComune: isAreaComuneModificaInput,
        unitaId: isAreaComuneModificaInput ? null : unitaModificaInput,
        fornitoreId: fornitoreModificaId || null,
        dataPrevista: dataPrevistaModificaInput.trim() || null,
        noteFornitore: noteFornitoreModificaInput.trim() || null,
        baseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        importoConsuntivo: importoNum,
      };

      const res = await services.manutenzione.updateTicket(payload);
      if (res?.urlMagico) {
        setMagicLinkModifica(res.urlMagico);
      }

      toast.show({
        message: 'Modifiche salvate con successo.',
        tone: 'success',
      });
      setModaleModificaAperta(false);
      await caricaDati();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il salvataggio.';
      setErroriModifica({ generale: msg });
    } finally {
      setSalvataggioModificaInCorso(false);
    }
  };

  // Invia messaggio nel dettaglio ticket
  const inviaMessaggioDettaglio = async () => {
    if (!ticketDettaglio || !nuovoMessaggioInput.trim()) return;

    setInvioMessaggioInCorso(true);
    try {
      await services.manutenzione.addMessaggio(
        ticketDettaglio.id,
        nuovoMessaggioInput.trim(),
        profilo?.id,
      );
      setNuovoMessaggioInput('');
      toast.show({ message: 'Messaggio inviato.', tone: 'info' });
      const aggiornati = await services.manutenzione.listTickets(condominio!.id);
      setTickets(aggiornati);
      const sel = aggiornati.find((t) => t.id === ticketDettaglio.id);
      if (sel) setTicketDettaglio(sel);
    } catch {
      toast.show({ message: 'Errore nell’invio del messaggio.', tone: 'error' });
    } finally {
      setInvioMessaggioInCorso(false);
    }
  };

  // Colonne Tabella Ticket con lo stesso aspetto grafico e priorità del lato condòmino
  const colonneTicket: DataColumn<TicketAdminView>[] = useMemo(
    () => [
      {
        key: 'priorita',
        header: 'Priorità',
        minWidth: 100,
        weight: 1,
        cell: (row) => {
          const statusBadge: BadgeStatus =
            row.priorita === 'URGENTE'
              ? 'error'
              : row.priorita === 'ALTA'
                ? 'warning'
                : row.priorita === 'MEDIA'
                  ? 'info'
                  : 'neutral';
          const labelBadge =
            row.priorita === 'URGENTE'
              ? 'Urgente'
              : row.priorita === 'ALTA'
                ? 'Alta'
                : row.priorita === 'MEDIA'
                  ? 'Media'
                  : 'Bassa';
          return <Badge status={statusBadge} label={labelBadge} />;
        },
      },
      {
        key: 'titolo',
        header: 'Segnalazione',
        minWidth: 200,
        weight: 3,
        mobile: 'title',
        cell: (row) => <CellaTitolo titolo={row.titolo} />,
      },
      {
        key: 'apertura',
        header: 'Aperta il',
        minWidth: 100,
        weight: 1,
        cell: (row) => (
          <Text style={styles.testoSecondario}>
            {row.created_at_formattata}
          </Text>
        ),
      },
      {
        key: 'stato',
        header: 'Stato',
        minWidth: 150,
        weight: 1,
        cell: (row) => (
          <View style={styles.cellaStato}>
            <Badge
              status={
                row.stato === 'APERTO'
                  ? 'aperto'
                  : row.stato === 'LAVORAZIONE'
                    ? 'in_lavorazione'
                    : 'risolto'
              }
            />
          </View>
        ),
      },
      {
        key: 'azioni',
        header: 'Azioni',
        minWidth: 170,
        weight: 1,
        cell: (row) => (
          <View style={styles.rigaAzioni}>
            <Button
              variant="secondary"
              label="Modifica"
              icon="pencil"
              onPress={() => apriModaleModifica(row)}
              accessibilityHint={`Modifica o assegna fornitore per ${row.titolo}`}
            />
          </View>
        ),
      },
    ],
    [],
  );

  // Colonne Tabella Fornitori
  const colonneFornitori: DataColumn<FornitoreAdminView>[] = useMemo(
    () => [
      {
        key: 'ragione_sociale',
        header: 'Ragione sociale',
        minWidth: 200,
        weight: 3,
        mobile: 'title',
        cell: (row) => (
          <View style={styles.colonnaTesto}>
            <Text style={styles.testoTitolo}>{row.ragione_sociale}</Text>
            {row.iban ? (
              <Text style={styles.testoMicro} numberOfLines={1}>
                IBAN: {row.iban}
              </Text>
            ) : null}
          </View>
        ),
      },
      {
        key: 'categoria',
        header: 'Categoria',
        minWidth: 130,
        weight: 2,
        cell: (row) => (
          <Badge status="info" label={row.categoria || 'Generale'} />
        ),
      },
      {
        key: 'telefono',
        header: 'Telefono',
        minWidth: 130,
        weight: 2,
        cell: (row) => (
          row.telefono ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Chiama ${row.telefono}`}
              style={styles.linkBottone}
            >
              <Icon name="phone" size="indicator" color={colors.action.default} />
              <Text style={styles.testoLink} numberOfLines={1}>
                {row.telefono}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.testoMuted}>—</Text>
          )
        ),
      },
      {
        key: 'email',
        header: 'Email',
        minWidth: 170,
        weight: 2,
        cell: (row) => (
          row.email ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Invia email a ${row.email}`}
              style={styles.linkBottone}
            >
              <Icon name="mail" size="indicator" color={colors.action.default} />
              <Text style={styles.testoLink} numberOfLines={1}>
                {row.email}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.testoMuted}>—</Text>
          )
        ),
      },
      {
        key: 'p_iva',
        header: 'P.IVA / CF',
        minWidth: 140,
        weight: 2,
        cell: (row) => (
          <Text style={styles.testoSecondario}>
            {row.p_iva || '—'}
          </Text>
        ),
      },
    ],
    [],
  );

  // Schede Tab
  const schedeTab: TabItem[] = [
    {
      key: 'ticket',
      label: 'Ticket Guasti',
      icon: 'wrench',
      content: (
        <View style={styles.contenutoTab}>
          {/* Card contenitore identica al lato condòmino */}
          <Card>
            <ResponsiveDataView
              label="Elenco ticket di guasto e manutenzione"
              columns={colonneTicket}
              rows={ticketsFiltrati}
              getRowKey={(item) => item.id}
              getRowLabel={(item) => item.titolo}
              onRowPress={apriDettagliTicket}
              loading={caricamento}
              filters={
                <View style={styles.filtri}>
                  {/* Ricerca SOPRA i filtri, identica a ElencoSegnalazioni condòmino */}
                  <SearchBar
                    value={filtroRicercaTicket}
                    onChangeText={setFiltroRicercaTicket}
                    label="Cerca nei ticket"
                    placeholder="Cerca una segnalazione…"
                    showLabel
                  />
                  {/* Filtri per stato SOTTO la ricerca */}
                  <FilterChips
                    label="Filtra per stato"
                    allLabel={`Tutti (${tickets.length})`}
                    options={opzioniFiltroStato}
                    value={filtroChip === 'tutti' ? [] : [filtroChip]}
                    onChange={(valori) => setFiltroChip(valori[0] || 'tutti')}
                  />
                </View>
              }
              empty={{
                icon: 'wrench',
                title: 'Non ci sono segnalazioni da mostrare.',
                description:
                  filtroRicercaTicket || filtroChip !== 'tutti'
                    ? 'Nessuna segnalazione corrisponde allo stato o alla ricerca selezionati. Premi "Azzera filtri" per tornare all’elenco completo.'
                    : 'Nessun ticket registrato per questo condominio.',
                action:
                  filtroRicercaTicket || filtroChip !== 'tutti'
                    ? {
                        label: 'Azzera filtri',
                        onPress: () => {
                          setFiltroChip('tutti');
                          setFiltroRicercaTicket('');
                        },
                      }
                    : {
                        label: 'Nuova segnalazione',
                        onPress: apriNuovoTicket,
                      },
              }}
            />
          </Card>
        </View>
      ),
    },
    {
      key: 'fornitori',
      label: 'Rubrica Fornitori',
      icon: 'truck',
      content: (
        <View style={styles.contenutoTab}>
          <Card>
            <ResponsiveDataView
              label="Elenco fornitori convenzionati"
              columns={colonneFornitori}
              rows={fornitoriFiltrati}
              getRowKey={(item) => item.id}
              getRowLabel={(item) => item.ragione_sociale}
              loading={caricamento}
              filters={
                <View style={styles.filtri}>
                  <SearchBar
                    value={filtroRicercaFornitori}
                    onChangeText={setFiltroRicercaFornitori}
                    label="Cerca fornitori"
                    placeholder="Cerca per ragione sociale, categoria, email o telefono…"
                    showLabel
                  />
                  <View style={styles.rigaAzioneFornitore}>
                    <Button
                      variant="primary"
                      label="Nuovo fornitore convenzionato"
                      icon="plus"
                      onPress={apriNuovoFornitore}
                      accessibilityHint="Aggiungi una nuova ditta convenzionata in rubrica"
                    />
                  </View>
                </View>
              }
              empty={{
                title: 'Nessun fornitore registrato',
                description: filtroRicercaFornitori
                  ? 'Nessun fornitore corrisponde alla ricerca. Modifica il testo cercato.'
                  : 'Nessuna ditta convenzionata presente nella rubrica. Aggiungi il primo fornitore.',
                action: {
                  label: 'Nuovo fornitore convenzionato',
                  onPress: apriNuovoFornitore,
                },
              }}
            />
          </Card>
        </View>
      ),
    },
  ];

  return (
    <View style={styles.pagina}>
      {/* 1. PageHeader ufficiale con Breadcrumbs integrati e icona "wrench" lato condòmino */}
      <PageHeader
        title="Manutenzione e Ticket"
        subtitle="Gestisci le segnalazioni di guasto, assegna i lavori con Magic Link e consulta la rubrica fornitori."
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Manutenzione' },
        ]}
        action={{
          label: 'Nuova segnalazione',
          icon: 'wrench',
          onPress: apriNuovoTicket,
        }}
      />

      {/* 2. 3 StatCard ufficiali */}
      <View style={styles.schedes}>
        <View style={styles.scheda}>
          <StatCard
            icon="wrench"
            tile="blue"
            title="Ticket guasti aperti"
            value={caricamento ? '' : String(statistiche.ticketAperti)}
            description="Guasti in attesa di assegnazione"
            loading={caricamento}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="hard-hat"
            tile="navy"
            title="Interventi in lavorazione"
            value={caricamento ? '' : String(statistiche.interventiInLavorazione)}
            description="Lavori affidati ai manutentori"
            loading={caricamento}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="truck"
            tile="teal"
            title="Fornitori convenzionati"
            value={caricamento ? '' : String(statistiche.fornitoriConvenzionati)}
            description="Ditte registrate in rubrica"
            loading={caricamento}
          />
        </View>
      </View>

      {/* 3. Navigazione a Schede */}
      <Tabs
        label="Sezioni della manutenzione condominiale"
        tabs={schedeTab}
        value={tabAttivo}
        onChange={(val) => setTabAttivo(val as 'ticket' | 'fornitori')}
      />

      {/* ========================================================================= */}
      {/* MODALE 1: Nuova Segnalazione (Ticket Amministratore)                      */}
      {/* ========================================================================= */}
      <Modal
        visible={modaleNuovoTicketAperta}
        onClose={() => setModaleNuovoTicketAperta(false)}
        title="Nuova segnalazione"
      >
        <View style={styles.corpoModale}>
          <Input
            inputRef={inputTitoloRef}
            label="Titolo del guasto"
            placeholder="Es. Perdita acqua locale autoclave"
            value={titoloTicketInput}
            onChangeText={setTitoloTicketInput}
            error={erroriNuovoTicket.titolo}
          />

          <Select
            label="Categoria guasto"
            options={opzioniCategorieSelect}
            value={categoriaTicketInput}
            onChange={setCategoriaTicketInput}
          />

          <Select
            label="Priorità intervento"
            options={OPZIONI_PRIORITA}
            value={prioritaTicketInput}
            onChange={(val) => setPrioritaTicketInput(val as PrioritaTicket)}
          />

          <Checkbox
            label="Segnalazione per area comune del condominio"
            checked={isAreaComuneInput}
            onChange={(checked) => setIsAreaComuneInput(checked)}
          />

          {!isAreaComuneInput ? (
            <Select
              label="Unità immobiliare interessata"
              options={opzioniUnitaSelect}
              value={unitaTicketInput}
              onChange={setUnitaTicketInput}
              error={erroriNuovoTicket.unitaId}
            />
          ) : null}

          <Textarea
            label="Descrizione dettagliata"
            placeholder="Fornisci indicazioni precise sull'anomalia o rottura riscontrata..."
            value={descrizioneTicketInput}
            onChangeText={setDescrizioneTicketInput}
          />

          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleNuovoTicketAperta(false)}
              disabled={salvataggioTicketInCorso}
            />
            <Button
              variant="primary"
              label="Crea ticket"
              icon="check"
              onPress={salvaNuovoTicket}
              loading={salvataggioTicketInCorso}
            />
          </ModalActions>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALE 2: Nuovo Fornitore Convenzionato                                   */}
      {/* ========================================================================= */}
      <Modal
        visible={modaleNuovoFornitoreAperta}
        onClose={() => setModaleNuovoFornitoreAperta(false)}
        title="Nuovo fornitore convenzionato"
      >
        <View style={styles.corpoModale}>
          <Input
            inputRef={inputRagioneSocialeRef}
            label="Ragione sociale / Denominazione ditta"
            placeholder="Es. Termoidraulica Rossi S.r.l."
            value={ragioneSocialeInput}
            onChangeText={setRagioneSocialeInput}
            error={erroriNuovoFornitore.ragioneSociale}
          />

          <Select
            label="Categoria merceologica ditta"
            options={OPZIONI_CATEGORIA_FORNITORE}
            value={categoriaFornitoreInput}
            onChange={setCategoriaFornitoreInput}
          />

          <Input
            label="Partita IVA o Codice Fiscale"
            placeholder="Es. 01234567890"
            value={pIvaInput}
            onChangeText={setPIvaInput}
            error={erroriNuovoFornitore.pIva}
          />

          <Input
            label="Recapito telefonico"
            placeholder="Es. +39 06 1234567"
            value={telefonoInput}
            onChangeText={setTelefonoInput}
            keyboardType="phone-pad"
            error={erroriNuovoFornitore.telefono}
          />

          <Input
            label="Indirizzo Email"
            placeholder="Es. info@ditta.it"
            value={emailInput}
            onChangeText={setEmailInput}
            keyboardType="email-address"
            autoCapitalize="none"
            error={erroriNuovoFornitore.email}
          />

          <Input
            label="Codice IBAN (per bonifici e consuntivi)"
            placeholder="Es. IT00X0000000000000000000000"
            value={ibanInput}
            onChangeText={setIbanInput}
            autoCapitalize="characters"
            error={erroriNuovoFornitore.iban}
          />

          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleNuovoFornitoreAperta(false)}
              disabled={salvataggioFornitoreInCorso}
            />
            <Button
              variant="primary"
              label="Salva fornitore"
              icon="check"
              onPress={salvaNuovoFornitore}
              loading={salvataggioFornitoreInCorso}
            />
          </ModalActions>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALE 3: Modifica Ticket (Dati, Assegnazione & Magic Link, Consuntivo)   */}
      {/* ========================================================================= */}
      <Modal
        visible={modaleModificaAperta}
        onClose={() => setModaleModificaAperta(false)}
        title={ticketDaModificare ? `Modifica Ticket: ${ticketDaModificare.titolo}` : 'Modifica Ticket'}
      >
        <View style={styles.corpoModale}>
          <Input
            label="Titolo del guasto"
            placeholder="Es. Perdita acqua locale autoclave"
            value={titoloModificaInput}
            onChangeText={setTitoloModificaInput}
            error={erroriModifica.titolo}
          />

          <View style={styles.rigaDoppia}>
            <View style={styles.colonnaMeta}>
              <Select
                label="Priorità"
                options={OPZIONI_PRIORITA}
                value={prioritaModificaInput}
                onChange={(val) => setPrioritaModificaInput(val as PrioritaTicket)}
              />
            </View>
            <View style={styles.colonnaMeta}>
              <Select
                label="Stato ticket"
                options={OPZIONI_STATO_SELECT}
                value={statoModificaInput}
                onChange={(val) => setStatoModificaInput(val as StatoTicket)}
              />
            </View>
          </View>

          <Select
            label="Categoria guasto"
            options={opzioniCategorieSelect}
            value={categoriaModificaInput}
            onChange={setCategoriaModificaInput}
          />

          <Checkbox
            label="Segnalazione per area comune del condominio"
            checked={isAreaComuneModificaInput}
            onChange={(checked) => setIsAreaComuneModificaInput(checked)}
          />

          {!isAreaComuneModificaInput ? (
            <Select
              label="Unità immobiliare interessata"
              options={opzioniUnitaSelect}
              value={unitaModificaInput}
              onChange={setUnitaModificaInput}
            />
          ) : null}

          <Textarea
            label="Descrizione del guasto"
            placeholder="Dettagli sulle cause e sintomi riscontrati..."
            value={descrizioneModificaInput}
            onChangeText={setDescrizioneModificaInput}
          />

          {/* Sezione Fornitore & Magic Link */}
          <View style={styles.sezioneIntervento}>
            <Text style={styles.titoloSezioneModale}>Fornitore incaricato e Magic Link</Text>
            <Select
              label="Fornitore convenzionato"
              options={opzioniFornitoriSelect}
              value={fornitoreModificaId}
              onChange={setFornitoreModificaId}
            />

            {fornitoreModificaId ? (
              <>
                <Input
                  label="Data prevista intervento (GG/MM/AAAA o AAAA-MM-GG)"
                  placeholder="Es. 2026-11-10"
                  value={dataPrevistaModificaInput}
                  onChangeText={setDataPrevistaModificaInput}
                />

                <Textarea
                  label="Istruzioni per il manutentore"
                  placeholder="Note operative da comunicare al fornitore..."
                  value={noteFornitoreModificaInput}
                  onChangeText={setNoteFornitoreModificaInput}
                />

                {magicLinkModifica ? (
                  <View style={styles.boxMagicLink}>
                    <Text style={styles.titoloMagicLink}>
                      Magic Link Manutentore (Senza Login)
                    </Text>
                    <Text style={styles.descrizioneMagicLink}>
                      Il link protetto (scadenza 14 giorni) permette al fornitore di visualizzare il guasto, allegare foto e inserire il consuntivo.
                    </Text>
                    <Text style={styles.testoUrlMagicLink} selectable numberOfLines={1}>
                      {magicLinkModifica}
                    </Text>
                    <Button
                      variant="primary"
                      label={linkCopiato ? 'Copiato!' : 'Copia Magic Link'}
                      icon={linkCopiato ? 'check' : 'copy'}
                      onPress={() => copiaMagicLinkNegliAppunti(magicLinkModifica)}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>

          {/* Sezione Chiusura / Consuntivo (se stato è RISOLTO) */}
          {statoModificaInput === 'RISOLTO' ? (
            <View style={styles.sezioneIntervento}>
              <Text style={styles.titoloSezioneModale}>Consuntivo di spesa finale</Text>
              <Input
                label="Importo consuntivo spesa (€)"
                placeholder="Es. 240.00"
                value={consuntivoModificaInput}
                onChangeText={setConsuntivoModificaInput}
                keyboardType="decimal-pad"
                error={erroriModifica.consuntivo}
              />
            </View>
          ) : null}

          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleModificaAperta(false)}
              disabled={salvataggioModificaInCorso}
            />
            <Button
              variant="primary"
              label="Salva modifiche"
              icon="check"
              onPress={salvaModificheTicket}
              loading={salvataggioModificaInCorso}
            />
          </ModalActions>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODALE 4: Dettagli Guasto e Segnalazione                                  */}
      {/* ========================================================================= */}
      <Modal
        visible={modaleDettagliAperta}
        onClose={() => setModaleDettagliAperta(false)}
        title={ticketDettaglio ? `Dettagli Ticket: ${ticketDettaglio.titolo}` : 'Dettagli Ticket'}
      >
        <View style={styles.corpoModale}>
          {ticketDettaglio ? (
            <>
              {/* Badges */}
              <View style={styles.rigaBadgesDettaglio}>
                <Badge
                  status={
                    ticketDettaglio.stato === 'APERTO'
                      ? 'aperto'
                      : ticketDettaglio.stato === 'LAVORAZIONE'
                        ? 'in_lavorazione'
                        : 'risolto'
                  }
                />
                <Badge status="info" label={ticketDettaglio.categoria_nome} />
              </View>

              {/* Informazioni sintetiche */}
              <View style={styles.bloccoInfoDettaglio}>
                <Text style={styles.voceInfoDettaglio}>
                  <Text style={styles.etichettaForte}>Priorità: </Text>
                  {ticketDettaglio.priorita === 'URGENTE'
                    ? 'Urgente'
                    : ticketDettaglio.priorita === 'ALTA'
                      ? 'Alta'
                      : ticketDettaglio.priorita === 'MEDIA'
                        ? 'Media'
                        : 'Bassa'}
                </Text>
                <Text style={styles.voceInfoDettaglio}>
                  <Text style={styles.etichettaForte}>Ubicazione: </Text>
                  {ticketDettaglio.ubicazione_label}
                </Text>
                <Text style={styles.voceInfoDettaglio}>
                  <Text style={styles.etichettaForte}>Segnalato il: </Text>
                  {ticketDettaglio.created_at_formattata}
                  {ticketDettaglio.segnalatore_nome ? ` da ${ticketDettaglio.segnalatore_nome}` : ''}
                </Text>
                <Text style={styles.voceInfoDettaglio}>
                  <Text style={styles.etichettaForte}>Fornitore incaricato: </Text>
                  {ticketDettaglio.fornitore_assegnato_nome}
                </Text>
                {ticketDettaglio.data_intervento_formattata && ticketDettaglio.data_intervento_formattata !== '—' ? (
                  <Text style={styles.voceInfoDettaglio}>
                    <Text style={styles.etichettaForte}>Intervento previsto: </Text>
                    {ticketDettaglio.data_intervento_formattata}
                  </Text>
                ) : null}
                {ticketDettaglio.closed_at_formattato && ticketDettaglio.closed_at_formattato !== '—' ? (
                  <Text style={styles.voceInfoDettaglio}>
                    <Text style={styles.etichettaForte}>Risolto il: </Text>
                    {ticketDettaglio.closed_at_formattato}
                  </Text>
                ) : null}
              </View>

              {/* Descrizione guasto */}
              <View style={styles.sezioneDettaglio}>
                <Text style={styles.titoloSezioneDettaglio}>Descrizione del guasto</Text>
                <Text style={styles.testoDescrizioneEstesa}>
                  {ticketDettaglio.descrizione || 'Nessuna descrizione testuale fornita.'}
                </Text>
              </View>

              {/* Foto e allegati */}
              <View style={styles.sezioneDettaglio}>
                <Text style={styles.titoloSezioneDettaglio}>Foto e Allegati</Text>
                {ticketDettaglio.allegati.length === 0 ? (
                  <Text style={styles.testoMuted}>Nessun allegato presente per questo guasto.</Text>
                ) : (
                  <View style={styles.elencoAllegati}>
                    {ticketDettaglio.allegati.map((all, i) => (
                      <View key={all.id || i} style={styles.itemAllegato}>
                        <Icon name="file-text" size="action" color={colors.brand.navy} />
                        <Text style={styles.testoLink} numberOfLines={1}>
                          {all.url_storage}
                        </Text>
                        <Badge status="neutral" label={all.tipo_file} />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Cronologia messaggi */}
              <View style={styles.sezioneDettaglio}>
                <Text style={styles.titoloSezioneDettaglio}>Messaggi e Note di lavoro</Text>
                {ticketDettaglio.messaggi.length === 0 ? (
                  <Text style={styles.testoMuted}>Nessun messaggio registrato finora.</Text>
                ) : (
                  <View style={styles.elencoMessaggi}>
                    {ticketDettaglio.messaggi.map((msg, i) => (
                      <View key={msg.id || i} style={styles.itemMessaggio}>
                        <View style={styles.testataMessaggio}>
                          <Text style={styles.autoreMessaggio}>{msg.mittente_nome}</Text>
                          <Text style={styles.dataMessaggio}>{msg.timestamp_formattato}</Text>
                        </View>
                        <Text style={styles.corpoMessaggio}>{msg.messaggio}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.bloccoScriviMessaggio}>
                  <Input
                    label="Aggiungi una nota o messaggio"
                    placeholder="Scrivi un aggiornamento sul ticket..."
                    value={nuovoMessaggioInput}
                    onChangeText={setNuovoMessaggioInput}
                  />
                  <Button
                    variant="secondary"
                    label="Invia nota"
                    icon="plus"
                    onPress={inviaMessaggioDettaglio}
                    loading={invioMessaggioInCorso}
                    disabled={!nuovoMessaggioInput.trim()}
                  />
                </View>
              </View>
            </>
          ) : null}

          <ModalActions>
            <Button
              variant="secondary"
              label="Chiudi"
              onPress={() => setModaleDettagliAperta(false)}
            />
          </ModalActions>
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
  schedes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
  },
  scheda: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
  },
  contenutoTab: {
    gap: space[4],
    marginTop: space[3],
  },
  filtri: {
    gap: space[3],
  },
  rigaAzioneFornitore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[1],
  },
  titoloTabella: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  titoloMobile: {
    color: colors.brand.navy,
    fontWeight: '600',
  },
  testoTabella: {
    fontSize: 14,
    color: colors.text.primary,
  },
  testoSecondario: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  testoMuted: {
    fontSize: 13,
    color: colors.text.muted,
  },
  testoMicro: {
    fontSize: 12,
    color: colors.text.muted,
  },
  cellaStato: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 150,
  },
  colonnaTesto: {
    gap: space[1],
  },
  testoTitolo: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  rigaAzioni: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkBottone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoLink: {
    fontSize: 13,
    color: colors.action.default,
    fontWeight: '500',
  },
  corpoModale: {
    gap: space[4],
    paddingBottom: space[2],
  },
  rigaDoppia: {
    flexDirection: 'row',
    gap: space[3],
  },
  colonnaMeta: {
    flex: 1,
  },
  sezioneIntervento: {
    backgroundColor: colors.background,
    padding: space[3],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[3],
    marginTop: space[1],
  },
  titoloSezioneModale: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand.navy,
  },
  boxMagicLink: {
    backgroundColor: colors.tile.teal.background,
    padding: space[3],
    borderRadius: radii.control,
    gap: space[2],
  },
  titoloMagicLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand.navy,
  },
  descrizioneMagicLink: {
    fontSize: 12,
    color: colors.text.primary,
    lineHeight: 16,
  },
  testoUrlMagicLink: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    color: colors.brand.navy,
    fontWeight: '600',
  },
  rigaBadgesDettaglio: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  bloccoInfoDettaglio: {
    backgroundColor: colors.background,
    padding: space[3],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[2],
  },
  voceInfoDettaglio: {
    fontSize: 14,
    color: colors.text.primary,
  },
  etichettaForte: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  sezioneDettaglio: {
    gap: space[2],
  },
  titoloSezioneDettaglio: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand.navy,
  },
  testoDescrizioneEstesa: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    backgroundColor: colors.background,
    padding: space[3],
    borderRadius: radii.control,
  },
  elencoAllegati: {
    gap: space[2],
  },
  itemAllegato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[2],
    backgroundColor: colors.background,
    borderRadius: radii.control,
  },
  elencoMessaggi: {
    gap: space[2],
  },
  itemMessaggio: {
    padding: space[3],
    backgroundColor: colors.background,
    borderRadius: radii.control,
    borderLeftWidth: 3,
    borderLeftColor: colors.action.default,
    gap: space[1],
  },
  testataMessaggio: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoreMessaggio: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  dataMessaggio: {
    fontSize: 12,
    color: colors.text.muted,
  },
  corpoMessaggio: {
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
  bloccoScriviMessaggio: {
    gap: space[2],
    marginTop: space[2],
  },
});
