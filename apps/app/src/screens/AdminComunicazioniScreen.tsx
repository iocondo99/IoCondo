import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  calcolaStatisticheComunicazioni,
  filtraComunicazioni,
  formattaDataItaliana,
  validaComunicazione,
  type ComunicazioneAdminView,
  type OpzionePalazzoComunicazione,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  Icon,
  Input,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  ResponsiveDataView,
  SearchBar,
  Select,
  StatCard,
  Textarea,
  borderWidths,
  colors,
  radii,
  space,
  useBreakpoint,
  useToast,
  type DataColumn,
  type FilterOption,
  type SelectOption,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const OPZIONI_STATO: readonly FilterOption[] = [
  { value: 'in_evidenza', label: 'In evidenza' },
];

export function AdminComunicazioniScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Comunicazioni e Bacheca"
          subtitle="Pubblica comunicazioni ufficiali e gestisci gli avvisi in evidenza per i condòmini."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminComunicazioniContenuto />;
}

function AdminComunicazioniContenuto() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dettaglioId?: string; id?: string }>();
  const targetId = params.dettaglioId || params.id;
  const { condominio, profilo } = useProfilo();
  const { isMobile } = useBreakpoint();
  const toast = useToast();

  const [comunicazioni, setComunicazioni] = useState<ComunicazioneAdminView[]>([]);
  const [palazzi, setPalazzi] = useState<OpzionePalazzoComunicazione[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  // Filtri e ricerca
  const [filtroStato, setFiltroStato] = useState<string>('');
  const [filtroPalazzo, setFiltroPalazzo] = useState<string>('');
  const [filtroRicerca, setFiltroRicerca] = useState<string>('');

  // Modale Dettaglio Avviso (riga cliccabile)
  const [avvisoDettaglio, setAvvisoDettaglio] = useState<ComunicazioneAdminView | null>(null);
  const [modaleDettaglioAperta, setModaleDettaglioAperta] = useState(false);

  // Modale Scrittura / Modifica
  const [modaleScritturaAperta, setModaleScritturaAperta] = useState(false);
  const [comunicazioneInModifica, setComunicazioneInModifica] = useState<ComunicazioneAdminView | null>(null);
  const [titoloInput, setTitoloInput] = useState('');
  const [palazzoInput, setPalazzoInput] = useState<string>('');
  const [corpoInput, setCorpoInput] = useState('');
  const [isPinnedInput, setIsPinnedInput] = useState(false);
  const [erroreTitolo, setErroreTitolo] = useState<string | undefined>(undefined);
  const [erroreCorpo, setErroreCorpo] = useState<string | undefined>(undefined);
  const [erroreModale, setErroreModale] = useState<string | null>(null);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
  const titoloInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Eliminazione Post (ConfirmDialog)
  const [comunicazioneDaEliminare, setComunicazioneDaEliminare] = useState<ComunicazioneAdminView | null>(null);
  const [eliminazionePostInCorso, setEliminazionePostInCorso] = useState(false);

  // Toggle Rapido Pin in corso
  const [idInPinning, setIdInPinning] = useState<string | null>(null);

  const caricaDati = useCallback(async () => {
    if (!condominio?.id) {
      setCaricamento(false);
      return;
    }
    setCaricamento(true);
    setErrore(false);
    try {
      const [listaComunicazioni, listaPalazzi] = await Promise.all([
        services.comunicazioniAdmin.list(condominio.id),
        services.comunicazioniAdmin.listPalazzi(condominio.id),
      ]);
      setComunicazioni(listaComunicazioni);
      setPalazzi(listaPalazzi);
    } catch (err) {
      console.error('Errore durante il caricamento delle comunicazioni:', err);
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id]);

  useEffect(() => {
    caricaDati();
  }, [caricaDati]);

  // Apertura automatica del dettaglio se richiesto da notifica o deep link
  useEffect(() => {
    if (!targetId || comunicazioni.length === 0) return;
    const post = comunicazioni.find((c) => c.id === targetId);
    if (post) {
      setAvvisoDettaglio(post);
      setModaleDettaglioAperta(true);
    }
  }, [targetId, comunicazioni]);

  // Statistiche e KPI riepilogativi (2 StatCard: attive e in evidenza)
  const statistiche = useMemo(() => calcolaStatisticheComunicazioni(comunicazioni), [comunicazioni]);

  // Lista filtrata
  const comunicazioniFiltrate = useMemo(() => {
    return filtraComunicazioni(comunicazioni, {
      stato: filtroStato,
      palazzoId: filtroPalazzo,
      ricerca: filtroRicerca,
    });
  }, [comunicazioni, filtroStato, filtroPalazzo, filtroRicerca]);

  // Opzioni dropdown edifici nella modale
  const opzioniSelectDestinatari = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: 'Condominio (Tutti i palazzi)' },
      ...palazzi.map((p) => ({
        value: p.id,
        label: `Solo ${p.nome}`,
      })),
    ];
  }, [palazzi]);

  // Opzioni filtri edifici
  const opzioniFiltroEdifici = useMemo<FilterOption[]>(() => {
    return palazzi.map((p) => ({
      value: p.id,
      label: p.nome,
    }));
  }, [palazzi]);

  // Apertura modale visualizzazione dettaglio (riga cliccabile standard)
  const apriDettaglioAvviso = (post: ComunicazioneAdminView) => {
    setAvvisoDettaglio(post);
    setModaleDettaglioAperta(true);
  };

  // Apertura modale nuovo avviso
  const apriModaleNuovaComunicazione = () => {
    setComunicazioneInModifica(null);
    setTitoloInput('');
    setPalazzoInput('');
    setCorpoInput('');
    setIsPinnedInput(false);
    setErroreTitolo(undefined);
    setErroreCorpo(undefined);
    setErroreModale(null);
    setModaleScritturaAperta(true);
  };

  // Apertura modale modifica avviso
  const apriModaleModifica = (post: ComunicazioneAdminView) => {
    setModaleDettaglioAperta(false);
    setComunicazioneInModifica(post);
    setTitoloInput(post.titolo);
    setPalazzoInput(post.palazzoId ?? '');
    setCorpoInput(post.corpo);
    setIsPinnedInput(post.isPinned);
    setErroreTitolo(undefined);
    setErroreCorpo(undefined);
    setErroreModale(null);
    setModaleScritturaAperta(true);
  };

  const chiudiModaleScrittura = () => {
    if (salvataggioInCorso) return;
    setModaleScritturaAperta(false);
  };

  // Salva nuovo post o aggiorna esistente
  const salvaComunicazione = async () => {
    setErroreTitolo(undefined);
    setErroreCorpo(undefined);
    setErroreModale(null);

    const validazione = validaComunicazione(titoloInput, corpoInput);
    if (!validazione.valido) {
      setErroreTitolo(validazione.errori.titolo);
      setErroreCorpo(validazione.errori.corpo);
      return;
    }

    if (!condominio?.id) return;

    setSalvataggioInCorso(true);
    try {
      if (comunicazioneInModifica) {
        // Modifica
        await services.comunicazioniAdmin.update({
          id: comunicazioneInModifica.id,
          titolo: titoloInput.trim(),
          corpo: corpoInput.trim(),
          palazzoId: palazzoInput.trim() ? palazzoInput.trim() : null,
          isPinned: isPinnedInput,
        });
        toast.show({
          tone: 'success',
          message: 'Comunicazione aggiornata con successo.',
        });
      } else {
        // Creazione con notifiche automatiche
        await services.comunicazioniAdmin.create({
          condominioId: condominio.id,
          autoreId: profilo?.id ?? null,
          titolo: titoloInput.trim(),
          corpo: corpoInput.trim(),
          palazzoId: palazzoInput.trim() ? palazzoInput.trim() : null,
          isPinned: isPinnedInput,
        });
        toast.show({
          tone: 'success',
          message: 'Comunicazione pubblicata e notifiche inviate ai residenti.',
        });
      }

      setModaleScritturaAperta(false);
      await caricaDati();
    } catch (err) {
      console.error('Errore salvataggio comunicazione:', err);
      setErroreModale('Si è verificato un errore durante il salvataggio. Riprova.');
    } finally {
      setSalvataggioInCorso(false);
    }
  };

  // Toggle rapido pin
  const eseguiTogglePin = async (post: ComunicazioneAdminView) => {
    const nuovoStato = !post.isPinned;
    setIdInPinning(post.id);

    // Aggiornamento ottimistico
    setComunicazioni((prev) =>
      prev.map((c) => (c.id === post.id ? { ...c, isPinned: nuovoStato } : c)),
    );

    try {
      await services.comunicazioniAdmin.togglePin(post.id, nuovoStato);
      toast.show({
        tone: 'info',
        message: nuovoStato
          ? 'Comunicazione fissata in cima alla bacheca.'
          : 'Comunicazione rimossa dalla prima posizione.',
      });
    } catch (err) {
      console.error('Errore toggle pin:', err);
      toast.show({
        tone: 'error',
        message: 'Impossibile aggiornare lo stato di evidenza. Ripristino in corso...',
      });
      // Rollback
      setComunicazioni((prev) =>
        prev.map((c) => (c.id === post.id ? { ...c, isPinned: post.isPinned } : c)),
      );
    } finally {
      setIdInPinning(null);
    }
  };

  // Eliminazione post
  const confermaEliminaPost = async () => {
    if (!comunicazioneDaEliminare) return;
    setEliminazionePostInCorso(true);
    try {
      await services.comunicazioniAdmin.delete(comunicazioneDaEliminare.id);
      toast.show({
        tone: 'success',
        message: 'Comunicazione eliminata definitivamente dalla bacheca.',
      });
      setComunicazioneDaEliminare(null);
      await caricaDati();
    } catch (err) {
      console.error('Errore eliminazione post:', err);
      toast.show({
        tone: 'error',
        message: 'Non è stato possibile eliminare la comunicazione. Riprova.',
      });
    } finally {
      setEliminazionePostInCorso(false);
    }
  };

  const azzeraFiltri = () => {
    setFiltroStato('');
    setFiltroPalazzo('');
    setFiltroRicerca('');
  };

  // Definizione colonne della tabella responsive
  const colonne = useMemo<DataColumn<ComunicazioneAdminView>[]>(
    () => [
      {
        key: 'avviso',
        header: 'Avviso',
        weight: 3,
        minWidth: 280,
        mobile: 'title',
        cell: (r) => (
          <View style={styles.cellaAvviso}>
            {r.isPinned ? (
              <View style={styles.badgeInEvidenza} accessible accessibilityLabel="Avviso in evidenza">
                <Icon name="pin" size="indicator" color={colors.brand.navy} />
                <Text style={styles.testoInEvidenza}>In evidenza</Text>
              </View>
            ) : null}
            <Text style={styles.titoloAvviso} numberOfLines={2}>
              {r.titolo}
            </Text>
            <Text style={styles.anteprimaCorpo} numberOfLines={2} ellipsizeMode="tail">
              {r.corpo}
            </Text>
          </View>
        ),
      },
      {
        key: 'destinatari',
        header: 'Destinatari',
        weight: 1,
        minWidth: 150,
        mobileLabel: 'Destinatari',
        cell: (r) => (
          <View style={styles.cellaDestinatari}>
            <Icon
              name={r.palazzoNome ? 'building-2' : 'users'}
              size="indicator"
              color={r.palazzoNome ? colors.action.default : colors.text.muted}
            />
            <Text style={styles.testoDestinatari} numberOfLines={1}>
              {r.destinatariEtichetta}
            </Text>
          </View>
        ),
      },
      {
        key: 'dataPubblicazione',
        header: 'Data pubblicazione',
        weight: 1,
        minWidth: 140,
        mobileLabel: 'Pubblicato',
        cell: (r) => (
          <Text style={styles.testoData}>
            {r.dataPubblicazioneFormattata}
          </Text>
        ),
      },
      {
        key: 'azioni',
        header: 'Azioni',
        weight: 1,
        minWidth: 300,
        mobile: 'hidden',
        cell: (r) => (
          <View style={styles.rigaAzioni}>
            <Button
              variant="secondary"
              label={r.isPinned ? 'Fissato' : 'Fissa'}
              icon="pin"
              onPress={() => eseguiTogglePin(r)}
              loading={idInPinning === r.id}
              accessibilityHint={r.isPinned ? 'Rimuovi evidenza dall’avviso' : 'Fissa l’avviso in cima alla bacheca'}
            />
            <Button
              variant="destructive"
              label="Elimina"
              icon="trash-2"
              onPress={() => setComunicazioneDaEliminare(r)}
              accessibilityHint={`Elimina definitivamente ${r.titolo}`}
            />
          </View>
        ),
      },
    ],
    [idInPinning],
  );

  const erroreScheda = errore ? { message: 'Errore caricamento', onRetry: caricaDati } : undefined;
  const haFiltriAttivi =
    filtroStato !== '' || filtroPalazzo !== '' || filtroRicerca.trim() !== '';

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Comunicazioni e Bacheca"
        subtitle="Pubblica comunicazioni ufficiali e gestisci gli avvisi in evidenza per i condòmini."
        breadcrumbs={[
          { label: 'Home', onPress: () => router.push('/admin/dashboard') },
          { label: 'Comunicazioni' },
        ]}
        action={{
          label: 'Pubblica comunicazione',
          icon: 'plus',
          onPress: apriModaleNuovaComunicazione,
        }}
      />

      {/* 2 StatCard Ufficiali: Comunicazioni attive e Avvisi in evidenza */}
      <View style={styles.schede}>
        <View style={styles.scheda}>
          <StatCard
            icon="message-circle"
            tile="blue"
            title="Comunicazioni attive"
            value={caricamento ? '' : String(statistiche.totaleAttive)}
            description="Avvisi pubblicati in bacheca"
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="pin"
            tile="navy"
            title="Avvisi in evidenza"
            value={caricamento ? '' : String(statistiche.inEvidenza)}
            description="Fissati in cima alla bacheca"
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
      </View>

      {/* Card contenitore standard per tabella responsive con riga cliccabile */}
      <Card>
        <ResponsiveDataView
          label="Elenco comunicazioni e avvisi del condominio"
          columns={colonne}
          rows={comunicazioniFiltrate}
          getRowKey={(r) => r.id}
          getRowLabel={(r) => r.titolo}
          onRowPress={apriDettaglioAvviso}
          loading={caricamento}
          error={errore ? { title: 'Impossibile caricare le comunicazioni' } : undefined}
          onRetry={caricaDati}
          filters={
            <View style={styles.filtri}>
              {/* Ricerca SOPRA i filtri, identica allo standard condòmino e manutenzione */}
              <SearchBar
                value={filtroRicerca}
                onChangeText={setFiltroRicerca}
                placeholder="Cerca una comunicazione…"
                label="Cerca avvisi"
                showLabel
              />

              {/* Filtri per stato e per stabile SOTTO la ricerca */}
              <View style={styles.rigaChips}>
                <FilterChips
                  label="Filtra per stato"
                  allLabel="Tutte"
                  options={OPZIONI_STATO}
                  value={filtroStato ? [filtroStato] : []}
                  onChange={(val) => setFiltroStato(val[0] || '')}
                />
                {palazzi.length > 0 ? (
                  <FilterChips
                    label="Filtra per stabile o palazzo"
                    allLabel="Tutti gli stabili"
                    options={opzioniFiltroEdifici}
                    value={filtroPalazzo ? [filtroPalazzo] : []}
                    onChange={(val) => setFiltroPalazzo(val[0] || '')}
                  />
                ) : null}
              </View>
            </View>
          }
          empty={{
            icon: 'message-circle',
            title: haFiltriAttivi
              ? 'Nessun avviso corrisponde ai criteri'
              : 'Nessuna comunicazione pubblicata',
            description: haFiltriAttivi
              ? 'Prova a modificare i filtri applicati o a cancellare il testo di ricerca.'
              : 'Non è ancora presente alcun avviso in bacheca. Clicca su "Pubblica comunicazione" per iniziare.',
            action: haFiltriAttivi
              ? {
                  label: 'Azzera filtri',
                  onPress: azzeraFiltri,
                  icon: 'refresh-cw',
                }
              : {
                  label: 'Pubblica comunicazione',
                  onPress: apriModaleNuovaComunicazione,
                  icon: 'plus',
                },
          }}
        />
      </Card>

      {/* Modale Visualizzazione Dettagli Avviso (aperta al click sulla riga) */}
      <Modal
        visible={modaleDettaglioAperta}
        onClose={() => setModaleDettaglioAperta(false)}
        title="Dettaglio comunicazione"
        description="Visualizza le informazioni complete e il testo della comunicazione."
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Chiudi"
              onPress={() => setModaleDettaglioAperta(false)}
            />
            <Button
              variant="primary"
              label="Modifica"
              icon="pencil"
              onPress={() => {
                if (!avvisoDettaglio) return;
                apriModaleModifica(avvisoDettaglio);
              }}
            />
            <Button
              variant="destructive"
              label="Elimina"
              icon="trash-2"
              onPress={() => {
                if (!avvisoDettaglio) return;
                const target = avvisoDettaglio;
                setModaleDettaglioAperta(false);
                setComunicazioneDaEliminare(target);
              }}
            />
          </ModalActions>
        }
      >
        {avvisoDettaglio ? (
          <View style={styles.corpoDettaglio}>
            {avvisoDettaglio.isPinned ? (
              <View style={styles.badgeInEvidenzaDettaglio} accessible accessibilityLabel="Avviso in evidenza">
                <Icon name="pin" size="indicator" color={colors.brand.navy} />
                <Text style={styles.testoInEvidenza}>Avviso in evidenza</Text>
              </View>
            ) : null}

            <Text style={styles.titoloDettaglio}>{avvisoDettaglio.titolo}</Text>

            <View style={styles.metadatiDettaglio}>
              <View style={styles.rigaMetadato}>
                <Icon
                  name={avvisoDettaglio.palazzoNome ? 'building-2' : 'users'}
                  size="indicator"
                  color={colors.text.muted}
                />
                <Text style={styles.testoMetadato}>
                  Destinatari: <Text style={styles.testoMetadatoForte}>{avvisoDettaglio.destinatariEtichetta}</Text>
                </Text>
              </View>
              <View style={styles.rigaMetadato}>
                <Icon name="calendar-days" size="indicator" color={colors.text.muted} />
                <Text style={styles.testoMetadato}>
                  Pubblicato il: <Text style={styles.testoMetadatoForte}>{avvisoDettaglio.dataPubblicazioneFormattata}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.bloccoTestoDettaglio}>
              <Text style={styles.testoCorpoDettaglio}>{avvisoDettaglio.corpo}</Text>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* Modale Scrittura / Modifica Comunicazione */}
      <Modal
        visible={modaleScritturaAperta}
        onClose={chiudiModaleScrittura}
        title={comunicazioneInModifica ? 'Modifica comunicazione' : 'Pubblica nuova comunicazione'}
        description={
          comunicazioneInModifica
            ? 'Aggiorna i dettagli o l’ambito di destinazione dell’avviso.'
            : 'Scrivi un avviso ufficiale visibile all’intero condominio o limitato a un palazzo.'
        }
        initialFocusRef={titoloInputRef}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={chiudiModaleScrittura}
              disabled={salvataggioInCorso}
            />
            <Button
              variant="primary"
              label={
                salvataggioInCorso
                  ? 'Salvataggio in corso…'
                  : comunicazioneInModifica
                    ? 'Salva modifiche'
                    : 'Pubblica avviso'
              }
              icon={comunicazioneInModifica ? 'check' : 'plus'}
              loading={salvataggioInCorso}
              onPress={salvaComunicazione}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          {erroreModale ? (
            <Alert tone="error" title="Errore" message={erroreModale} />
          ) : null}

          {/* Campo Titolo */}
          <Input
            inputRef={titoloInputRef}
            label="Titolo dell'avviso"
            placeholder="Es. Interventi manutenzione ascensore"
            value={titoloInput}
            onChangeText={(t) => {
              setTitoloInput(t);
              if (erroreTitolo) setErroreTitolo(undefined);
            }}
            error={erroreTitolo}
            helperText="Minimo 3 caratteri."
            required
            disabled={salvataggioInCorso}
          />

          {/* Selettore Destinatari */}
          <Select
            label="Destinatari / Ambito di visibilità"
            placeholder="Seleziona destinatari"
            options={opzioniSelectDestinatari}
            value={palazzoInput}
            onChange={(val) => setPalazzoInput(val)}
            helperText="Seleziona 'Condominio' o limita la visibilità ai soli residenti del palazzo selezionato."
            disabled={salvataggioInCorso}
          />

          {/* Campo Corpo Avviso */}
          <Textarea
            label="Testo dell'avviso"
            placeholder="Scrivi qui i dettagli della comunicazione..."
            value={corpoInput}
            onChangeText={(t) => {
              setCorpoInput(t);
              if (erroreCorpo) setErroreCorpo(undefined);
            }}
            error={erroreCorpo}
            helperText={`Minimo 10 caratteri. Conteggio: ${corpoInput.trim().length} caratteri.`}
            required
            minHeight={120}
            disabled={salvataggioInCorso}
          />

          {/* Checkbox In Evidenza */}
          <Checkbox
            label="Fissa in evidenza in cima alla bacheca"
            helperText="L'avviso comparirà sempre per primo prima degli altri post ordinari."
            checked={isPinnedInput}
            onChange={setIsPinnedInput}
            disabled={salvataggioInCorso}
          />
        </View>
      </Modal>

      {/* Dialog Conferma Eliminazione Post */}
      <ConfirmDialog
        visible={Boolean(comunicazioneDaEliminare)}
        title="Eliminare questa comunicazione?"
        description={
          comunicazioneDaEliminare
            ? `L'avviso "${comunicazioneDaEliminare.titolo}" verrà eliminato definitivamente dalla bacheca.`
            : ''
        }
        confirmLabel="Elimina avviso"
        confirmLoadingLabel="Eliminazione…"
        cancelLabel="Annulla"
        destructive
        onConfirm={confermaEliminaPost}
        onCancel={() => {
          if (!eliminazionePostInCorso) setComunicazioneDaEliminare(null);
        }}
      />
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
    flex: 1,
    minWidth: 260,
  },
  filtri: {
    gap: space[3],
  },
  rigaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    alignItems: 'center',
  },
  cellaAvviso: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: space[1],
    paddingVertical: space[1],
  },
  badgeInEvidenza: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: colors.tile.navy.background,
    borderColor: colors.brand.navy,
    borderWidth: borderWidths.thin,
    borderRadius: radii.badge,
    paddingVertical: 2,
    paddingHorizontal: space[2],
    alignSelf: 'flex-start',
  },
  testoInEvidenza: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.brand.navy,
    fontWeight: '700',
  },
  titoloAvviso: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  anteprimaCorpo: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  cellaDestinatari: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoDestinatari: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  testoData: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  rigaAzioni: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: space[2],
  },
  formModale: {
    gap: space[4],
    paddingBottom: space[4],
  },
  corpoDettaglio: {
    gap: space[4],
    paddingBottom: space[4],
  },
  badgeInEvidenzaDettaglio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: colors.tile.navy.background,
    borderColor: colors.brand.navy,
    borderWidth: borderWidths.thin,
    borderRadius: radii.badge,
    paddingVertical: 2,
    paddingHorizontal: space[2],
    alignSelf: 'flex-start',
  },
  titoloDettaglio: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text.primary,
  },
  metadatiDettaglio: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
    paddingVertical: space[2],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  rigaMetadato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoMetadato: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.muted,
  },
  testoMetadatoForte: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  bloccoTestoDettaglio: {
    paddingVertical: space[2],
  },
  testoCorpoDettaglio: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text.secondary,
  },
});
