import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  calcolaStatisticheComunicazioni,
  filtraComunicazioni,
  formattaDataItaliana,
  troncaTesto,
  validaComunicazione,
  type CommentoPostAdminView,
  type ComunicazioneAdminView,
  type OpzionePalazzoComunicazione,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  Icon,
  IconButton,
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
  { value: 'con_commenti', label: 'Con commenti' },
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
          subtitle="Pubblica comunicazioni ufficiali, gestisci gli avvisi in evidenza e modera i commenti dei residenti."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminComunicazioniContenuto />;
}

function AdminComunicazioniContenuto() {
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

  // Modale Moderazione Commenti
  const [modaleCommentiAperta, setModaleCommentiAperta] = useState(false);
  const [postSelezionato, setPostSelezionato] = useState<ComunicazioneAdminView | null>(null);
  const [commenti, setCommenti] = useState<CommentoPostAdminView[]>([]);
  const [caricamentoCommenti, setCaricamentoCommenti] = useState(false);
  const [commentoDaEliminare, setCommentoDaEliminare] = useState<CommentoPostAdminView | null>(null);
  const [eliminazioneCommentoInCorso, setEliminazioneCommentoInCorso] = useState(false);

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

  // Statistiche e KPI riepilogativi
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
      { value: '', label: 'Intero condominio (Tutti i palazzi)' },
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
        await services.comunicazioniAdmin.update(comunicazioneInModifica.id, {
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

  // Apertura modale moderazione commenti
  const apriModaleCommenti = async (post: ComunicazioneAdminView) => {
    setPostSelezionato(post);
    setModaleCommentiAperta(true);
    setCaricamentoCommenti(true);
    try {
      const lista = await services.comunicazioniAdmin.listCommenti(post.id);
      setCommenti(lista);
    } catch (err) {
      console.error('Errore caricamento commenti:', err);
      toast.show({
        tone: 'error',
        message: 'Impossibile caricare i commenti per questa comunicazione.',
      });
    } finally {
      setCaricamentoCommenti(false);
    }
  };

  // Eliminazione singolo commento
  const confermaEliminaCommento = async () => {
    if (!commentoDaEliminare || !postSelezionato) return;
    setEliminazioneCommentoInCorso(true);
    try {
      await services.comunicazioniAdmin.deleteCommento(commentoDaEliminare.id);
      toast.show({
        tone: 'success',
        message: 'Commento eliminato.',
      });
      setCommenti((prev) => prev.filter((c) => c.id !== commentoDaEliminare.id));
      setComunicazioni((prev) =>
        prev.map((p) =>
          p.id === postSelezionato.id
            ? {
                ...p,
                conteggioCommenti: Math.max(0, p.conteggioCommenti - 1),
                etichettaCommenti: `${Math.max(0, p.conteggioCommenti - 1)} commenti`,
              }
            : p,
        ),
      );
      setCommentoDaEliminare(null);
    } catch (err) {
      console.error('Errore eliminazione commento:', err);
      toast.show({
        tone: 'error',
        message: 'Impossibile eliminare il commento. Riprova.',
      });
    } finally {
      setEliminazioneCommentoInCorso(false);
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
        minWidth: 260,
        mobile: 'title',
        cell: (r) => (
          <View style={styles.cellaAvviso}>
            <View style={styles.rigaIntestazioneAvviso}>
              {r.isPinned ? (
                <View style={styles.badgeInEvidenza} accessible accessibilityLabel="Avviso in evidenza">
                  <Icon name="pin" size="indicator" color={colors.brand.navy} />
                  <Text style={styles.testoInEvidenza}>In evidenza</Text>
                </View>
              ) : null}
              <Text style={styles.titoloAvviso} numberOfLines={2}>
                {r.titolo}
              </Text>
            </View>
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
              name={r.palazzoNome ? 'building' : 'users'}
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
        key: 'commenti',
        header: 'Commenti',
        weight: 1,
        minWidth: 120,
        mobileLabel: 'Interazioni',
        cell: (r) => (
          <Badge
            label={r.etichettaCommenti}
            status={r.conteggioCommenti > 0 ? 'info' : 'neutral'}
          />
        ),
      },
      {
        key: 'azioni',
        header: 'Azioni',
        weight: 2,
        minWidth: 280,
        align: 'right',
        mobile: 'actions',
        cell: (r) => (
          <View style={styles.rigaAzioni}>
            <Button
              variant={r.isPinned ? 'secondary' : 'text'}
              label={r.isPinned ? 'Fissato' : 'Fissa'}
              icon="pin"
              onPress={() => eseguiTogglePin(r)}
              loading={idInPinning === r.id}
            />
            <Button
              variant="text"
              label="Modifica"
              icon="pencil"
              onPress={() => apriModaleModifica(r)}
            />
            <Button
              variant="text"
              label="Commenti"
              icon="message-square"
              onPress={() => apriModaleCommenti(r)}
            />
            <Button
              variant="destructive"
              label="Elimina"
              icon="trash-2"
              onPress={() => setComunicazioneDaEliminare(r)}
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
        subtitle="Pubblica comunicazioni ufficiali, gestisci gli avvisi in evidenza e modera i commenti dei residenti."
        breadcrumbs={[
          { label: 'Home', href: '/admin/dashboard' },
          { label: 'Comunicazioni' },
        ]}
        action={{
          label: 'Pubblica comunicazione',
          icon: 'plus',
          onPress: apriModaleNuovaComunicazione,
        }}
      />

      {/* 3 StatCard Ufficiali (Sez. 8 Design System) */}
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
        <View style={styles.scheda}>
          <StatCard
            icon="messages-square"
            tile="teal"
            title="Commenti dei residenti"
            value={caricamento ? '' : String(statistiche.totaleCommenti)}
            description="Interazioni ricevute sui post"
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
      </View>

      {/* Tabella o Card Mobile con Barra di controllo integrata */}
      <ResponsiveDataView
        label="Elenco comunicazioni e avvisi del condominio"
        columns={colonne}
        rows={comunicazioniFiltrate}
        getRowKey={(r) => r.id}
        getRowLabel={(r) => r.titolo}
        loading={caricamento}
        error={erroreScheda}
        filters={
          <View style={styles.barraFiltri}>
            <View style={styles.rigaChips}>
              <FilterChips
                label="Filtra per stato avviso"
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
            <View style={styles.rigaRicerca}>
              <SearchBar
                value={filtroRicerca}
                onChangeText={setFiltroRicerca}
                placeholder="Cerca per titolo o contenuto dell’avviso…"
                label="Cerca avvisi"
              />
            </View>
          </View>
        }
        empty={{
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
                variant: 'secondary',
              }
            : {
                label: 'Pubblica comunicazione',
                onPress: apriModaleNuovaComunicazione,
                variant: 'primary',
              },
        }}
      />

      {/* Modale Scrittura / Modifica Comunicazione */}
      <Modal
        visible={modaleScritturaAperta}
        onClose={chiudiModaleScrittura}
        title={comunicazioneInModifica ? 'Modifica comunicazione' : 'Pubblica nuova comunicazione'}
        subtitle={
          comunicazioneInModifica
            ? 'Aggiorna i dettagli o l’ambito di destinazione dell’avviso.'
            : 'Scrivi un avviso ufficiale visibile a tutti i condòmini o limitato a un palazzo.'
        }
        size="lg"
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
            ref={titoloInputRef}
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
            editable={!salvataggioInCorso}
          />

          {/* Selettore Destinatari */}
          <Select
            label="Destinatari / Ambito di visibilità"
            placeholder="Seleziona destinatari"
            options={opzioniSelectDestinatari}
            value={palazzoInput}
            onChange={(val) => setPalazzoInput(val)}
            helperText="Seleziona l'intero condominio o limita la visibilità ai soli residenti del palazzo selezionato."
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
            rows={5}
            editable={!salvataggioInCorso}
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

      {/* Modale Moderazione Commenti */}
      <Modal
        visible={modaleCommentiAperta}
        onClose={() => setModaleCommentiAperta(false)}
        title="Moderazione commenti residenti"
        subtitle={
          postSelezionato
            ? `Post: "${troncaTesto(postSelezionato.titolo, 60)}"`
            : 'Commenti associati all’avviso'
        }
        size="md"
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Chiudi"
              onPress={() => setModaleCommentiAperta(false)}
            />
          </ModalActions>
        }
      >
        <View style={styles.corpoModaleCommenti}>
          {caricamentoCommenti ? (
            <Text style={styles.testoCaricamento}>Caricamento commenti in corso…</Text>
          ) : commenti.length === 0 ? (
            <EmptyState
              title="Nessun commento presente"
              description="Nessun residente ha ancora lasciato commenti sotto questo avviso."
              icon="message-square"
            />
          ) : (
            <View style={styles.listaCommenti}>
              {commenti.map((c) => (
                <View key={c.id} style={styles.schedaCommento}>
                  <View style={styles.rigaIntestazioneCommento}>
                    <View style={styles.bloccoAutoreCommento}>
                      <Icon name="user" size="indicator" color={colors.text.muted} />
                      <Text style={styles.nomeAutoreCommento}>{c.autoreNome}</Text>
                      <Text style={styles.dataCommento}>{c.createdAtFormatted}</Text>
                    </View>
                    <IconButton
                      icon="trash-2"
                      accessibilityLabel={`Elimina commento di ${c.autoreNome}`}
                      variant="ghost"
                      onPress={() => setCommentoDaEliminare(c)}
                    />
                  </View>
                  <Text style={styles.testoCommento}>{c.commento}</Text>
                  {commentoDaEliminare?.id === c.id ? (
                    <View style={styles.confermaInlineCommento}>
                      <Text style={styles.testoConfermaInline}>
                        Eliminare definitivamente questo commento?
                      </Text>
                      <View style={styles.rigaAzioniConfermaInline}>
                        <Button
                          variant="secondary"
                          label="Annulla"
                          onPress={() => setCommentoDaEliminare(null)}
                          disabled={eliminazioneCommentoInCorso}
                        />
                        <Button
                          variant="destructive"
                          label={eliminazioneCommentoInCorso ? 'Eliminazione…' : 'Elimina commento'}
                          loading={eliminazioneCommentoInCorso}
                          onPress={confermaEliminaCommento}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </Modal>

      {/* Dialog Conferma Eliminazione Post */}
      <ConfirmDialog
        visible={Boolean(comunicazioneDaEliminare)}
        title="Eliminare questa comunicazione?"
        description={
          comunicazioneDaEliminare
            ? `L'avviso "${comunicazioneDaEliminare.titolo}" verrà eliminato definitivamente dalla bacheca insieme a tutti i commenti associati.`
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
    minWidth: 240,
  },
  barraFiltri: {
    gap: space[3],
  },
  rigaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    alignItems: 'center',
  },
  rigaRicerca: {
    maxWidth: 420,
    width: '100%',
  },
  cellaAvviso: {
    gap: space[1],
    paddingVertical: space[1],
  },
  rigaIntestazioneAvviso: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space[2],
  },
  formModale: {
    gap: space[4],
    paddingBottom: space[4],
  },
  corpoModaleCommenti: {
    gap: space[4],
    minHeight: 180,
  },
  testoCaricamento: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: space[8],
  },
  listaCommenti: {
    gap: space[3],
  },
  schedaCommento: {
    padding: space[3],
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidths.thin,
    borderRadius: radii.card,
    gap: space[2],
  },
  rigaIntestazioneCommento: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[3],
  },
  bloccoAutoreCommento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexWrap: 'wrap',
  },
  nomeAutoreCommento: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  dataCommento: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.muted,
  },
  testoCommento: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  confermaInlineCommento: {
    marginTop: space[2],
    padding: space[3],
    backgroundColor: colors.semantic.error.background,
    borderColor: colors.semantic.error.foreground,
    borderWidth: borderWidths.thin,
    borderRadius: radii.card,
    gap: space[2],
  },
  testoConfermaInline: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.semantic.error.foreground,
    fontWeight: '600',
  },
  rigaAzioniConfermaInline: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space[2],
    flexWrap: 'wrap',
  },
});
