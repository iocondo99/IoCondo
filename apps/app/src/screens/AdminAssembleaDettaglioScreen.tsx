import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  Badge,
  Breadcrumbs,
  Button,
  Card,
  ConfirmDialog,
  FileUpload,
  Icon,
  Input,
  LoadingState,
  Modal,
  ModalActions,
  NonAutorizzato,
  PageHeader,
  Select,
  Textarea,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  useBreakpoint,
  useToast,
  type BreadcrumbItem,
  type FileUploadItem,
  type PickedFile,
  type SelectOption,
} from '@iocondo/ui';
import {
  badgeStatoAssembleaAdmin,
  calcolaQuorumCostitutivo,
  calcolaQuorumDeliberativo,
  esportaTestoVerbalePunto,
  generaTabellaNominalePunto,
  verificaCumuloDeleghe,
  type ConvocazioneAttiva,
  type DettaglioAssembleaAdminResult,
  type ModalitaPresenzaAdmin,
  type PresenzaUnitaView,
  type PuntoOdgAdminView,
  type SalvaPresenzaInput,
  type TipoDelibera,
  type VotoSceltaAdmin,
} from '@iocondo/data';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function AdminAssembleaDettaglioScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const assembleaId = typeof params.id === 'string' ? params.id : '';

  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Dettaglio Assemblea"
          subtitle="Conduzione seduta, appello presenze, votazioni e verbale."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminAssembleaDettaglioContenuto assembleaId={assembleaId} />;
}

function AdminAssembleaDettaglioContenuto({ assembleaId }: { assembleaId: string }) {
  const router = useRouter();
  const { condominio } = useProfilo();
  const toast = useToast();
  const { isMobile } = useBreakpoint();

  const [dettaglio, setDettaglio] = useState<DettaglioAssembleaAdminResult | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  // Convocazione attiva per il calcolo del Quorum Costitutivo (1ª o 2ª conv)
  const [convocazioneAttiva, setConvocazioneAttiva] = useState<ConvocazioneAttiva>('SECONDA');

  // Mappa presenze locale modificabile
  const [presenzeLocali, setPresenzeLocali] = useState<Record<string, PresenzaUnitaView>>({});
  const [salvataggioPresenzeInCorso, setSalvataggioPresenzeInCorso] = useState(false);
  const [tabellaPresenzeAperta, setTabellaPresenzeAperta] = useState(true);

  // Tendine tabelle nominali ODG (UC-10) aperte per punto
  const [tabelleNominaliEspansi, setTabelleNominaliEspansi] = useState<Record<string, boolean>>({});

  const toggleTabellaNominale = (puntoId: string) => {
    setTabelleNominaliEspansi((prev) => ({
      ...prev,
      [puntoId]: !prev[puntoId],
    }));
  };

  // Mappa tipo delibera per ciascun punto ODG (Ordinaria / Straordinaria)
  const [tipiDeliberaPunti, setTipiDeliberaPunti] = useState<Record<string, TipoDelibera>>({});

  // Modale Aggiungi Punto ODG
  const [modaleNuovoPuntoAperta, setModaleNuovoPuntoAperta] = useState(false);
  const [titoloNuovoPunto, setTitoloNuovoPunto] = useState('');
  const [propostaNuovoPunto, setPropostaNuovoPunto] = useState('');
  const [salvataggioPuntoInCorso, setSalvataggioPuntoInCorso] = useState(false);

  // ConfirmDialog Concludi Assemblea
  const [dialogConcludiAperto, setDialogConcludiAperto] = useState(false);
  const [conclusioneInCorso, setConclusioneInCorso] = useState(false);

  // Area Caricamento Verbale
  const [fileVerbale, setFileVerbale] = useState<FileUploadItem[]>([]);
  const [fileOriginaleVerbale, setFileOriginaleVerbale] = useState<PickedFile | null>(null);
  const [caricamentoVerbaleInCorso, setCaricamentoVerbaleInCorso] = useState(false);

  // Notifica residenti
  const [invioNotificaInCorso, setInvioNotificaInCorso] = useState(false);

  // Caricamento dati
  const caricaDati = useCallback(async () => {
    if (!assembleaId) return;
    setCaricamento(true);
    setErrore(false);

    try {
      const data = await services.assembleeAdmin.getDettaglioAssembleaAdmin(assembleaId);
      if (!data) {
        setErrore(true);
        return;
      }
      setDettaglio(data);
      setPresenzeLocali(data.presenzeMap);

      // Inizializza tipo delibera per ciascun punto ODG
      const mapTipi: Record<string, TipoDelibera> = {};
      for (const p of data.puntiOdg) {
        mapTipi[p.id] = p.tipoDelibera || (data.assemblea.tipo === 'STRAORDINARIA' ? 'STRAORDINARIA' : 'ORDINARIA');
      }
      setTipiDeliberaPunti(mapTipi);
    } catch {
      setErrore(true);
      toast.show({ tone: 'error', message: 'Errore durante il caricamento dell’assemblea.' });
    } finally {
      setCaricamento(false);
    }
  }, [assembleaId, toast]);

  useEffect(() => {
    void caricaDati();
  }, [caricaDati]);

  // Voci breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const dataFmt = dettaglio
      ? new Date(dettaglio.assemblea.data).toLocaleDateString('it-IT', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '...';

    return [
      { label: 'Home', href: '/admin/dashboard' },
      { label: 'Assemblee', href: '/admin/assemblee' },
      { label: `Assemblea del ${dataFmt}` },
    ];
  }, [dettaglio]);

  // Calcolo Quorum Costitutivo
  const quorumCostitutivo = useMemo(() => {
    if (!dettaglio) return null;

    let millesimiPresenti = 0;
    let testePresenti = 0;

    for (const u of dettaglio.unitaList) {
      const p = presenzeLocali[u.id];
      if (p && p.modalita !== 'ASSENTE') {
        testePresenti += 1;
        millesimiPresenti += u.valoreMillesimale || 0;
      }
    }

    return calcolaQuorumCostitutivo({
      convocazione: convocazioneAttiva,
      testePresenti,
      testeTotali: dettaglio.unitaList.length,
      millesimiPresenti,
      totaleMillesimi: 1000,
    });
  }, [dettaglio, presenzeLocali, convocazioneAttiva]);

  // Verifica deleghe art. 67
  const verificaDeleghe = useMemo(() => {
    if (!dettaglio) return null;
    return verificaCumuloDeleghe(dettaglio.unitaList, presenzeLocali, 1000);
  }, [dettaglio, presenzeLocali]);

  // Opzioni condòmini delegabili
  const opzioniDelegati: SelectOption[] = useMemo(() => {
    if (!dettaglio) return [];
    const presenti: SelectOption[] = [];

    for (const u of dettaglio.unitaList) {
      if (u.proprietarioId && u.proprietarioNome) {
        if (!presenti.some((opt) => opt.value === u.proprietarioId)) {
          presenti.push({
            value: u.proprietarioId,
            label: `${u.proprietarioNome} (Int. ${u.interno})`,
          });
        }
      }
    }
    return presenti;
  }, [dettaglio]);

  // Modifica presenza unità
  const cambiaPresenza = (
    unitaId: string,
    modalita: ModalitaPresenzaAdmin,
    delegatoId?: string | null,
    delegatoNome?: string | null,
  ) => {
    setPresenzeLocali((prev) => {
      const next = { ...prev };
      if (modalita === 'ASSENTE') {
        next[unitaId] = { unitaId, modalita: 'ASSENTE' };
      } else if (modalita === 'DELEGA') {
        next[unitaId] = {
          unitaId,
          modalita: 'DELEGA',
          delegatoUtenteId: delegatoId || prev[unitaId]?.delegatoUtenteId || opzioniDelegati[0]?.value || null,
          delegatoNome: delegatoNome || prev[unitaId]?.delegatoNome || opzioniDelegati[0]?.label || null,
        };
      } else {
        next[unitaId] = {
          unitaId,
          modalita,
          delegatoUtenteId: null,
          delegatoNome: null,
        };
      }
      return next;
    });
  };

  // Salva presenze su DB
  const handleSalvaPresenze = async () => {
    if (!dettaglio) return;
    setSalvataggioPresenzeInCorso(true);

    try {
      const lista: SalvaPresenzaInput[] = Object.values(presenzeLocali).map((p) => ({
        unitaId: p.unitaId,
        modalita: p.modalita,
        delegatoUtenteId: p.delegatoUtenteId,
        delegatoNome: p.delegatoNome,
      }));

      const res = await services.assembleeAdmin.salvaPresenze(assembleaId, lista);
      if (!res.ok) throw new Error(res.errore);

      toast.show({ tone: 'success', message: 'Presenze e deleghe registrate con successo!' });
      setTabellaPresenzeAperta(false);
      void caricaDati();
    } catch (err: any) {
      toast.show({ tone: 'error', message: err.message || 'Errore nel salvataggio presenze.' });
    } finally {
      setSalvataggioPresenzeInCorso(false);
    }
  };

  // Transizione stato assemblea (Avvia seduta)
  const handleAvviaAssemblea = async () => {
    try {
      const res = await services.assembleeAdmin.aggiornaStatoAssemblea(assembleaId, 'IN_CORSO');
      if (!res.ok) throw new Error(res.errore);
      toast.show({ tone: 'success', message: 'Seduta assembleare avviata (stato In corso).' });
      void caricaDati();
    } catch (err: any) {
      toast.show({ tone: 'error', message: err.message || 'Errore durante l’avvio.' });
    }
  };

  // Concludi assemblea
  const handleConcludiAssemblea = async () => {
    setConclusioneInCorso(true);
    try {
      const res = await services.assembleeAdmin.aggiornaStatoAssemblea(assembleaId, 'CONCLUSA');
      if (!res.ok) throw new Error(res.errore);
      toast.show({ tone: 'success', message: 'Assemblea formalmente conclusa.' });
      setDialogConcludiAperto(false);
      void caricaDati();
    } catch (err: any) {
      toast.show({ tone: 'error', message: err.message || 'Errore conclusione assemblea.' });
    } finally {
      setConclusioneInCorso(false);
    }
  };

  // Condividi convocazione
  const handleCondividiConvocazione = () => {
    if (!dettaglio) return;
    const { assemblea, puntiOdg } = dettaglio;
    const d = new Date(assemblea.data);
    const dataFormatted = d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const elencoPunti = puntiOdg.map((p) => `${p.ordine}. ${p.titoloPunto}`).join('\n');
    const meetInfo = assemblea.linkMeet ? `\nCollegamento video Google Meet: ${assemblea.linkMeet}` : '';

    const testo = [
      `CONVOCAZIONE ASSEMBLEA CONDOMINIALE - ${condominio?.nome || 'Condominio'}`,
      `Tipologia: Assemblea ${assemblea.tipo === 'STRAORDINARIA' ? 'Straordinaria' : 'Ordinaria'}`,
      `Data e ora: ${dataFormatted}`,
      `Luogo: ${assemblea.luogo || 'Sede stabilita'}${meetInfo}`,
      '',
      'ORDINE DEL GIORNO:',
      elencoPunti,
    ].join('\n');

    if (typeof globalThis !== 'undefined' && (globalThis as any).navigator?.clipboard?.writeText) {
      (globalThis as any).navigator.clipboard.writeText(testo);
      toast.show({ tone: 'success', message: 'Testo di convocazione copiato negli appunti!' });
    } else {
      toast.show({ tone: 'info', message: 'Testo di convocazione generato.' });
    }
  };

  // Controllo Votazione Punto ODG (Apri / Chiudi)
  const handleToggleVotazionePunto = async (punto: PuntoOdgAdminView) => {
    try {
      if (punto.votazioneAperta) {
        const res = await services.assembleeAdmin.chiudiVotazionePunto(punto.id);
        if (!res.ok) throw new Error(res.errore);
        toast.show({ tone: 'info', message: `Votazione punto n. ${punto.ordine} chiusa.` });
      } else {
        const res = await services.assembleeAdmin.apriVotazionePunto(punto.id, assembleaId);
        if (!res.ok) throw new Error(res.errore);
        toast.show({
          tone: 'success',
          message: `Votazione punto n. ${punto.ordine} aperta! I condomini possono votare.`,
        });
      }
      void caricaDati();
    } catch (err: any) {
      toast.show({ tone: 'error', message: err.message || 'Errore aggiornamento votazione.' });
    }
  };

  // Copia report verbale per singolo punto ODG
  const handleCopiaVerbalePunto = (punto: PuntoOdgAdminView) => {
    if (!dettaglio) return;
    const tipoDelibera = tipiDeliberaPunti[punto.id] || 'ORDINARIA';
    const votiMapPunto = dettaglio.votiPerPunto[punto.id] || {};

    const esito = calcolaQuorumDeliberativo({
      tipoAssemblea: dettaglio.assemblea.tipo,
      convocazione: convocazioneAttiva,
      tipoDelibera,
      unitaList: dettaglio.unitaList,
      presenzeMap: presenzeLocali,
      votiMap: votiMapPunto,
    });

    const righeNominali = generaTabellaNominalePunto(dettaglio.unitaList, presenzeLocali, votiMapPunto);
    const testo = esportaTestoVerbalePunto(
      `Assemblea del ${new Date(dettaglio.assemblea.data).toLocaleDateString('it-IT')}`,
      punto,
      esito,
      righeNominali,
    );

    if (typeof globalThis !== 'undefined' && (globalThis as any).navigator?.clipboard?.writeText) {
      (globalThis as any).navigator.clipboard.writeText(testo);
      toast.show({ tone: 'success', message: 'Delibera e tabella nominale copiate negli appunti!' });
    } else {
      toast.show({ tone: 'info', message: 'Report generato.' });
    }
  };

  // Aggiungi Punto all'ODG
  const handleAggiungiPunto = async () => {
    if (!titoloNuovoPunto.trim()) {
      toast.show({ tone: 'error', message: 'Inserisci il titolo del punto ODG.' });
      return;
    }
    setSalvataggioPuntoInCorso(true);
    try {
      const res = await services.assembleeAdmin.creaPuntoOdg({
        assembleaId,
        titoloPunto: titoloNuovoPunto.trim(),
        descrizione: propostaNuovoPunto.trim() || null,
      });
      if (!res.ok) throw new Error(res.errore);

      toast.show({ tone: 'success', message: 'Nuovo punto ODG inserito.' });
      setModaleNuovoPuntoAperta(false);
      setTitoloNuovoPunto('');
      setPropostaNuovoPunto('');
      void caricaDati();
    } catch (err: any) {
      toast.show({ tone: 'error', message: err.message || 'Errore creazione punto ODG.' });
    } finally {
      setSalvataggioPuntoInCorso(false);
    }
  };

  // Caricamento Verbale PDF definitivo
  const handleCaricaVerbale = async () => {
    if (!fileOriginaleVerbale || !condominio?.id) {
      toast.show({ tone: 'error', message: 'Seleziona un file PDF valido da caricare.' });
      return;
    }
    setCaricamentoVerbaleInCorso(true);
    try {
      const filePayload = (fileOriginaleVerbale as any).file || fileOriginaleVerbale;
      const res = await services.assembleeAdmin.caricaVerbalePdf(
        assembleaId,
        condominio.id,
        filePayload,
      );

      if (!res.ok) throw new Error(res.errore);

      toast.show({ tone: 'success', message: 'Verbale definitivo archiviato e assemblea conclusa!' });
      setFileVerbale([]);
      setFileOriginaleVerbale(null);
      void caricaDati();
    } catch (err: any) {
      toast.show({ tone: 'error', message: err.message || 'Errore caricamento verbale.' });
    } finally {
      setCaricamentoVerbaleInCorso(false);
    }
  };

  // Scarica Verbale PDF tramite link temporaneo
  const handleScaricaVerbale = async () => {
    if (!dettaglio?.assemblea.verbaleUrl) return;
    try {
      const res = await services.assembleeAdmin.creaLinkFirmatoVerbale(
        dettaglio.assemblea.verbaleUrl,
      );
      if (res.ok && res.signedUrl) {
        await Linking.openURL(res.signedUrl);
      } else {
        throw new Error(res.errore);
      }
    } catch {
      toast.show({ tone: 'error', message: 'Impossibile scaricare il verbale.' });
    }
  };

  // Notifica chiusura e verbale ai residenti
  const handleNotificaResidenti = async () => {
    if (!condominio?.id || !dettaglio) return;
    setInvioNotificaInCorso(true);
    try {
      const res = await services.assembleeAdmin.notificaChiusuraAssemblea(
        condominio.id,
        assembleaId,
        `Assemblea del ${new Date(dettaglio.assemblea.data).toLocaleDateString('it-IT')}`,
      );
      if (!res.ok) throw new Error(res.errore);
      toast.show({
        tone: 'success',
        message: `Notifica inviata a ${res.inviate} residenti del condominio.`,
      });
    } catch (err: any) {
      toast.show({ tone: 'error', message: err.message || 'Errore invio notifica.' });
    } finally {
      setInvioNotificaInCorso(false);
    }
  };

  if (caricamento) {
    return <LoadingState message="Caricamento sessione assembleare..." />;
  }

  if (errore || !dettaglio) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Assemblea non trovata" />
        <Card style={styles.cardErrore}>
          <Text style={styles.testoErrore}>
            L’assemblea richiesta non esiste o non appartiene al condominio attivo.
          </Text>
          <Button
            variant="secondary"
            label="Torna alle assemblee"
            icon="arrow-left"
            onPress={() => router.push('/admin/assemblee' as Href)}
          />
        </Card>
      </View>
    );
  }

  const { assemblea, puntiOdg, unitaList, votiPerPunto } = dettaglio;
  const statoBadge = badgeStatoAssembleaAdmin(assemblea.stato);
  const dataAssemblea = new Date(assemblea.data);
  const dataFmt = isNaN(dataAssemblea.getTime())
    ? assemblea.data
    : dataAssemblea.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <View style={styles.pagina}>
      {/* 1. Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} />

      {/* 2. Testata Assemblea */}
      <Card style={styles.cardTestata}>
        <View style={styles.rigaTestataSuperiore}>
          <View style={styles.bloccoTitolo}>
            <View style={styles.rigaTitoloBadge}>
              <Text style={styles.titoloAssemblea}>
                Assemblea {assemblea.tipo === 'STRAORDINARIA' ? 'Straordinaria' : 'Ordinaria'}
              </Text>
              <Badge status={statoBadge.status} label={statoBadge.label} />
            </View>
            <Text style={styles.sottotitoloData}>{dataFmt}</Text>
          </View>

          {/* Azioni di stato rapido */}
          <View style={styles.azioniTestata}>
            <Button
              variant="secondary"
              label="Condividi convocazione"
              icon="share-2"
              onPress={handleCondividiConvocazione}
            />

            {assemblea.stato === 'CONVOCATA' && (
              <Button
                variant="primary"
                label="Avvia seduta"
                icon="play"
                onPress={handleAvviaAssemblea}
              />
            )}

            {assemblea.stato === 'IN_CORSO' && (
              <Button
                variant="primary"
                label="Concludi assemblea"
                icon="check-circle-2"
                onPress={() => setDialogConcludiAperto(true)}
              />
            )}
          </View>
        </View>

        {/* Metadati di sessione: Luogo, Tabella */}
        <View style={styles.grigliaDettagliTestata}>
          <View style={styles.voceDettaglio}>
            <Icon name="map-pin" size="indicator" color={colors.text.secondary} />
            <Text style={styles.testoDettaglio}>{assemblea.luogo || 'Sede in presenza'}</Text>
          </View>

          <View style={styles.voceDettaglio}>
            <Icon name="table" size="indicator" color={colors.text.secondary} />
            <Text style={styles.testoDettaglio}>
              Tabella: {assemblea.tabellaMillesimaleNome || 'Generale (1000 ‰)'}
            </Text>
          </View>
        </View>
      </Card>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SEZIONE 1: Quorum Costitutivo, Appello Presenze e Deleghe           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Card style={styles.sezioneCard}>
        <View style={styles.sezioneHeader}>
          <View style={styles.sezioneTitoloBlocco}>
            <Text style={styles.sezioneTitolo}>
              1. Appello, Presenze e Deleghe (Quorum Costitutivo)
            </Text>
            <Text style={styles.sezioneDesc}>
              Rilevazione presenze delle singole unità per il calcolo legale del quorum ex art. 1136 c.c.
            </Text>
          </View>

          {/* Selettore 1ª o 2ª Convocazione */}
          <View style={styles.selettoreConvocazione}>
            <Pressable
              role="button"
              onPress={() => setConvocazioneAttiva('PRIMA')}
              style={[
                styles.btnConv,
                convocazioneAttiva === 'PRIMA' && styles.btnConvAttivo,
              ]}
            >
              <Text
                style={[
                  styles.testoBtnConv,
                  convocazioneAttiva === 'PRIMA' && styles.testoBtnConvAttivo,
                ]}
              >
                1ª Convocazione
              </Text>
            </Pressable>

            <Pressable
              role="button"
              onPress={() => setConvocazioneAttiva('SECONDA')}
              style={[
                styles.btnConv,
                convocazioneAttiva === 'SECONDA' && styles.btnConvAttivo,
              ]}
            >
              <Text
                style={[
                  styles.testoBtnConv,
                  convocazioneAttiva === 'SECONDA' && styles.testoBtnConvAttivo,
                ]}
              >
                2ª Convocazione
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Box Esito Quorum Costitutivo */}
        {quorumCostitutivo && (
          <View
            style={[
              styles.boxQuorum,
              quorumCostitutivo.valido ? styles.boxQuorumOk : styles.boxQuorumErr,
            ]}
          >
            <View style={styles.rigaQuorumHeader}>
              <View style={styles.rigaBadgeQuorum}>
                <Badge
                  status={quorumCostitutivo.badgeStatus}
                  label={quorumCostitutivo.badgeLabel}
                />
                <Text style={styles.testoConvBadge}>
                  ({convocazioneAttiva === 'PRIMA' ? '1ª Convocazione' : '2ª Convocazione'})
                </Text>
              </View>

              <Text style={styles.messaggioQuorum}>{quorumCostitutivo.messaggio}</Text>
            </View>

            <View style={styles.metricheQuorum}>
              <View style={styles.metricaItem}>
                <Text style={styles.metricaValore}>
                  {quorumCostitutivo.millesimiPresenti.toFixed(2)} /{' '}
                  {quorumCostitutivo.millesimiTotali.toFixed(2)} ‰
                </Text>
                <Text style={styles.metricaEtichetta}>
                  Millesimi presenti ({quorumCostitutivo.percentualeMillesimi}%) — Min. richiesto:{' '}
                  {quorumCostitutivo.millesimiRichiesti.toFixed(2)} ‰
                </Text>
              </View>

              <View style={styles.metricaItem}>
                <Text style={styles.metricaValore}>
                  {quorumCostitutivo.testePresenti} / {quorumCostitutivo.testeTotali}
                </Text>
                <Text style={styles.metricaEtichetta}>
                  Teste partecipanti ({quorumCostitutivo.percentualeTeste}%) — Min. richieste:{' '}
                  {quorumCostitutivo.testeRichieste}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Allerta limite deleghe art. 67 */}
        {verificaDeleghe?.haViolazioni && (
          <View style={styles.boxAllertaDeleghe}>
            <Icon name="triangle-alert" size="indicator" color={colors.semantic.error.foreground} />
            <Text style={styles.testoAllertaDeleghe}>{verificaDeleghe.messaggio}</Text>
          </View>
        )}

        {/* Intestazione Tendina Appello / Rilevazione Unità */}
        <Pressable
          role="button"
          aria-expanded={tabellaPresenzeAperta}
          onPress={() => setTabellaPresenzeAperta((prev) => !prev)}
          style={styles.togglePresenzeHeader}
        >
          <View style={styles.rigaToggleTitolo}>
            <Icon name="users" size="indicator" color={colors.action.default} />
            <Text style={styles.titoloTogglePresenze}>
              Rilevazione presenze e deleghe ({unitaList.length} unità)
            </Text>
          </View>
          <View style={styles.rigaToggleAzione}>
            <Text style={styles.testoToggleAzione}>
              {tabellaPresenzeAperta ? 'Comprimi appello' : 'Espandi e modifica presenze'}
            </Text>
            <Icon
              name={tabellaPresenzeAperta ? 'chevron-up' : 'chevron-down'}
              size="indicator"
              color={colors.text.secondary}
            />
          </View>
        </Pressable>

        {tabellaPresenzeAperta && (
          <>
            {/* Tabella Rilevazione Unità / Presenze */}
            <View style={styles.tabellaPresenze}>
          <View style={styles.intestazioneTabella}>
            <Text style={[styles.testoTh, { width: 80 }]}>Interno</Text>
            <Text style={[styles.testoTh, { flex: 2, minWidth: 160 }]}>Condòmino Titolare</Text>
            <Text style={[styles.testoTh, { width: 110 }]}>Millesimi</Text>
            <Text style={[styles.testoTh, { flex: 3, minWidth: 260 }]}>Stato Presenza</Text>
          </View>

          {unitaList.map((u) => {
            const p = presenzeLocali[u.id];
            const modalita = p?.modalita || 'ASSENTE';

            return (
              <View key={u.id} style={styles.rigaPresenza}>
                <View style={{ width: 80 }}>
                  <Text style={styles.testoInterno}>Int. {u.interno}</Text>
                  {u.palazzoNome && (
                    <Text style={styles.testoPalazzo}>{u.palazzoNome}</Text>
                  )}
                </View>

                <View style={{ flex: 2, minWidth: 160, justifyContent: 'center' }}>
                  <Text style={styles.testoProprietario}>
                    {u.proprietarioNome || 'Proprietario non registrato'}
                  </Text>
                </View>

                <View style={{ width: 110, justifyContent: 'center' }}>
                  <Text style={styles.testoMillesimi}>
                    {(u.valoreMillesimale || 0).toFixed(2)} ‰
                  </Text>
                </View>

                <View style={{ flex: 3, minWidth: 260, gap: space[2] }}>
                  {/* Selettore stato presenza: Presente, Delega, Assente */}
                  <View style={styles.gruppoBottoniPresenza}>
                    {(['PRESENZA', 'DELEGA', 'ASSENTE'] as ModalitaPresenzaAdmin[]).map(
                      (m) => {
                        const selezionato = modalita === m || (m === 'PRESENZA' && modalita === 'ONLINE');
                        let etichetta = 'Presente';
                        if (m === 'DELEGA') etichetta = 'Delega';
                        if (m === 'ASSENTE') etichetta = 'Assente';

                        return (
                          <Pressable
                            key={m}
                            role="button"
                            aria-pressed={selezionato}
                            onPress={() => cambiaPresenza(u.id, m)}
                            style={[
                              styles.btnPresenza,
                              selezionato && styles.btnPresenzaAttivo,
                            ]}
                          >
                            <Text
                              style={[
                                styles.testoBtnPresenza,
                                selezionato && styles.testoBtnPresenzaAttivo,
                              ]}
                            >
                              {etichetta}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </View>

                  {/* Se Delegato: Selettore del delegato */}
                  {modalita === 'DELEGA' && (
                    <View style={styles.boxSelettoreDelega}>
                      <Select
                        label="Condòmino che esercita la delega:"
                        options={opzioniDelegati}
                        value={p?.delegatoUtenteId || ''}
                        onChange={(delId) => {
                          const opt = opzioniDelegati.find((o) => o.value === delId);
                          cambiaPresenza(u.id, 'DELEGA', delId, opt?.label);
                        }}
                      />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Pulsante di salvataggio presenze */}
        <View style={styles.footerPresenze}>
          <Button
            variant="primary"
            label="Salva appello e presenze"
            icon="check"
            onPress={handleSalvaPresenze}
            loading={salvataggioPresenzeInCorso}
          />
        </View>
      </>
    )}
  </Card>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SEZIONE 2: Ordine del Giorno e Votazioni in Tempo Reale             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Card style={styles.sezioneCard}>
        <View style={styles.sezioneHeader}>
          <View style={styles.sezioneTitoloBlocco}>
            <Text style={styles.sezioneTitolo}>
              2. Ordine del Giorno e Votazioni in Tempo Reale
            </Text>
            <Text style={styles.sezioneDesc}>
              Apertura/chiusura votazioni, tabellone voti nominali per unità e calcolo esito ex art. 1136 c.c.
            </Text>
          </View>

          {assemblea.stato !== 'CONCLUSA' && (
            <Button
              variant="secondary"
              label="Aggiungi punto all'ODG"
              icon="plus"
              onPress={() => setModaleNuovoPuntoAperta(true)}
            />
          )}
        </View>

        {puntiOdg.length === 0 ? (
          <View style={styles.statoVuoto}>
            <Text style={styles.testoMuted}>Nessun punto all’ordine del giorno configurato.</Text>
            <Button
              variant="primary"
              label="Aggiungi primo punto"
              icon="plus"
              onPress={() => setModaleNuovoPuntoAperta(true)}
            />
          </View>
        ) : (
          <View style={styles.listaPuntiOdg}>
            {puntiOdg.map((punto) => {
              const tipoDelibera = tipiDeliberaPunti[punto.id] || 'ORDINARIA';
              const votiMapPunto = votiPerPunto[punto.id] || {};

              // Calcolo Quorum Deliberativo per questo punto ODG
              const esito = calcolaQuorumDeliberativo({
                tipoAssemblea: assemblea.tipo,
                convocazione: convocazioneAttiva,
                tipoDelibera,
                unitaList,
                presenzeMap: presenzeLocali,
                votiMap: votiMapPunto,
              });

              const righeNominali = generaTabellaNominalePunto(
                unitaList,
                presenzeLocali,
                votiMapPunto,
              );

              return (
                <Card key={punto.id} style={styles.cardPuntoOdg}>
                  {/* Testata punto ODG */}
                  <View style={styles.headerPuntoOdg}>
                    <View style={styles.bloccoTitoloPunto}>
                      <View style={styles.rigaTitoloPunto}>
                        <Text style={styles.numeroPunto}>Punto {punto.ordine}</Text>
                        <Badge
                          status={punto.votazioneAperta ? 'warning' : 'neutral'}
                          label={punto.votazioneAperta ? 'Votazione aperta' : 'Votazione chiusa'}
                        />
                      </View>
                      <Text style={styles.titoloPunto}>{punto.titoloPunto}</Text>
                      {punto.descrizione && (
                        <Text style={styles.descPunto}>{punto.descrizione}</Text>
                      )}
                    </View>

                    {/* Controlli apertura/chiusura votazione */}
                    <View style={styles.azioniPunto}>
                      <Button
                        variant={punto.votazioneAperta ? 'secondary' : 'primary'}
                        label={punto.votazioneAperta ? 'Chiudi votazione' : 'Apri votazione'}
                        icon={punto.votazioneAperta ? 'square' : 'play'}
                        onPress={() => handleToggleVotazionePunto(punto)}
                      />
                      <Button
                        variant="secondary"
                        label="Copia verbale"
                        icon="copy"
                        onPress={() => handleCopiaVerbalePunto(punto)}
                      />
                    </View>
                  </View>

                  {/* Selettore tipo quorum per il punto */}
                  <View style={styles.rigaTipoQuorum}>
                    <Text style={styles.etichettaQuorum}>Quorum deliberativo applicato:</Text>
                    <View style={styles.chipsQuorum}>
                      <Pressable
                        role="button"
                        aria-pressed={tipoDelibera === 'ORDINARIA'}
                        onPress={() =>
                          setTipiDeliberaPunti((prev) => ({ ...prev, [punto.id]: 'ORDINARIA' }))
                        }
                        style={[
                          styles.chipTipo,
                          tipoDelibera === 'ORDINARIA' && styles.chipTipoAttivo,
                        ]}
                      >
                        <Text
                          style={[
                            styles.testoChipTipo,
                            tipoDelibera === 'ORDINARIA' && styles.testoChipTipoAttivo,
                          ]}
                        >
                          Ordinaria (≥ 333,33 ‰ in 2ª conv.)
                        </Text>
                      </Pressable>

                      <Pressable
                        role="button"
                        aria-pressed={tipoDelibera === 'STRAORDINARIA'}
                        onPress={() =>
                          setTipiDeliberaPunti((prev) => ({
                            ...prev,
                            [punto.id]: 'STRAORDINARIA',
                          }))
                        }
                        style={[
                          styles.chipTipo,
                          tipoDelibera === 'STRAORDINARIA' && styles.chipTipoAttivo,
                        ]}
                      >
                        <Text
                          style={[
                            styles.testoChipTipo,
                            tipoDelibera === 'STRAORDINARIA' && styles.testoChipTipoAttivo,
                          ]}
                        >
                          Straordinaria (≥ 500,00 ‰)
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Box Esito Delibera in tempo reale */}
                  <View
                    style={[
                      styles.boxEsitoDelibera,
                      esito.approvata ? styles.boxEsitoApprovata : styles.boxEsitoRespinta,
                    ]}
                  >
                    <View style={styles.rigaEsitoBadge}>
                      <Badge status={esito.badgeStatus} label={esito.badgeLabel} />
                      <Text style={styles.testoMotivazioneEsito}>{esito.motivazione}</Text>
                    </View>

                    <View style={styles.conteggiEsito}>
                      <View style={styles.colEsito}>
                        <Text style={styles.valoreColEsito}>
                          {esito.testeFavorevoli} / {esito.testeIntervenute}
                        </Text>
                        <Text style={styles.etichettaColEsito}>
                          Maggioranza teste ({esito.percentualeTesteFavorevoli}%)
                        </Text>
                      </View>

                      <View style={styles.colEsito}>
                        <Text style={styles.valoreColEsito}>
                          {esito.millesimiFavorevoli.toFixed(2)} ‰
                        </Text>
                        <Text style={styles.etichettaColEsito}>
                          Millesimi favorevoli (Min. {esito.millesimiRichiesti.toFixed(2)} ‰)
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Monitor Stato Partecipazione al Voto per Unità Presenti */}
                  <View style={styles.bloccoStatoPartecipazione}>
                    <View style={styles.headerStatoPartecipazione}>
                      <Text style={styles.titoloStatoPartecipazione}>
                        Partecipazione al voto delle unità presenti:
                      </Text>
                      <Text style={styles.sottotitoloStatoPartecipazione}>
                        Rilevazione delle preferenze espresse dai condòmini connessi e delegati.
                      </Text>
                    </View>

                    <View style={styles.grigliaStatoPartecipazione}>
                      {unitaList.map((u) => {
                        const pres = presenzeLocali[u.id];
                        const presente = pres && pres.modalita !== 'ASSENTE';
                        const votoAttuale = votiMapPunto[u.id];

                        if (!presente) {
                          return null;
                        }

                        const haVotato = Boolean(votoAttuale);

                        return (
                          <View key={u.id} style={styles.cardStatoUnita}>
                            <View style={styles.infoStatoUnita}>
                              <Text style={styles.internoVoto}>Int. {u.interno}</Text>
                              <Text style={styles.millesimiVoto}>
                                {(u.valoreMillesimale || 0).toFixed(2)} ‰
                              </Text>
                              <Text style={styles.titolareVoto} numberOfLines={1}>
                                {pres.modalita === 'DELEGA'
                                  ? `${u.proprietarioNome || 'Proprietario'} (In delega a: ${pres.delegatoNome || 'Delegato'})`
                                  : u.proprietarioNome || 'Proprietario'}
                              </Text>
                            </View>

                            <Badge
                              status={haVotato ? 'success' : 'neutral'}
                              label={haVotato ? 'Votato' : 'Non votato'}
                            />
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Tabella Analitica Nominale per Verbale (UC-10) — Tendina richiudibile */}
                  <View style={styles.bloccoVerbaleNominale}>
                    <Pressable
                      role="button"
                      aria-expanded={Boolean(tabelleNominaliEspansi[punto.id])}
                      onPress={() => toggleTabellaNominale(punto.id)}
                      style={styles.toggleVerbaleNominale}
                    >
                      <View style={styles.rigaToggleTitolo}>
                        <Icon name="file-text" size="indicator" color={colors.action.default} />
                        <Text style={styles.titoloVerbaleNominale}>
                          Tabella nominale per redazione verbale (UC-10)
                        </Text>
                      </View>
                      <View style={styles.rigaToggleAzione}>
                        <Text style={styles.testoToggleAzione}>
                          {tabelleNominaliEspansi[punto.id] ? 'Nascondi tabella' : 'Mostra tabella'}
                        </Text>
                        <Icon
                          name={tabelleNominaliEspansi[punto.id] ? 'chevron-up' : 'chevron-down'}
                          size="indicator"
                          color={colors.text.secondary}
                        />
                      </View>
                    </Pressable>

                    {Boolean(tabelleNominaliEspansi[punto.id]) && (
                      <View style={styles.contenutoVerbaleNominale}>
                        <View style={styles.rigaCopiaVerbale}>
                          <Text style={styles.descVerbaleNominale}>
                            Dettaglio nominativo dei voti espressi per unità e delega, conforme ad art. 1136 e 1137 c.c.
                          </Text>
                          <Button
                            variant="secondary"
                            label="Copia testo per verbale"
                            icon="file-text"
                            onPress={() => {
                              const testo = esportaTestoVerbalePunto(
                                assemblea.tipo === 'STRAORDINARIA' ? 'Assemblea Straordinaria' : 'Assemblea Ordinaria',
                                punto,
                                esito,
                                righeNominali,
                              );
                              const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
                              if (nav?.clipboard?.writeText) {
                                nav.clipboard.writeText(testo);
                                toast.show({ tone: 'success', message: 'Testo del punto copiato negli appunti!' });
                              } else {
                                toast.show({ tone: 'info', message: 'Testo del verbale generato.' });
                              }
                            }}
                          />
                        </View>

                        <View style={styles.tabellaNominaleContenitore}>
                          <View style={styles.intestazioneTabella}>
                            <Text style={[styles.testoTh, { width: 70 }]}>Unità</Text>
                            <Text style={[styles.testoTh, { flex: 2, minWidth: 140 }]}>Condòmino</Text>
                            <Text style={[styles.testoTh, { flex: 2, minWidth: 140 }]}>Delegato</Text>
                            <Text style={[styles.testoTh, { width: 90 }]}>Quota ‰</Text>
                            <Text style={[styles.testoTh, { width: 150, minWidth: 150 }]}>Voto Espresso</Text>
                          </View>

                          {righeNominali.map((r) => {
                            let badgeVotoStatus: 'success' | 'error' | 'neutral' = 'neutral';
                            let etichettaVoto = 'Non espresso';

                            if (r.votoEspresso === 'FAVOREVOLE') {
                              badgeVotoStatus = 'success';
                              etichettaVoto = 'Favorevole';
                            } else if (r.votoEspresso === 'CONTRARIO') {
                              badgeVotoStatus = 'error';
                              etichettaVoto = 'Contrario';
                            } else if (r.votoEspresso === 'ASTENUTO') {
                              badgeVotoStatus = 'neutral';
                              etichettaVoto = 'Astenuto';
                            } else if (r.votoEspresso === 'ASSENTE') {
                              badgeVotoStatus = 'neutral';
                              etichettaVoto = 'Assente';
                            } else {
                              badgeVotoStatus = 'neutral';
                              etichettaVoto = 'Non espresso';
                            }

                            return (
                              <View key={r.unitaId} style={styles.rigaNominale}>
                                <Text style={[styles.testoTd, { width: 70, fontWeight: '600' }]}>
                                  Int. {r.interno}
                                </Text>
                                <Text style={[styles.testoTd, { flex: 2, minWidth: 140 }]}>
                                  {r.proprietario}
                                </Text>
                                <Text style={[styles.testoTd, { flex: 2, minWidth: 140, color: colors.text.secondary }]}>
                                  {r.delegato || '-'}
                                </Text>
                                <Text style={[styles.testoTd, { width: 90 }]}>
                                  {r.valoreMillesimale.toFixed(2)} ‰
                                </Text>
                                <View style={{ width: 150, minWidth: 150, alignItems: 'flex-start' }}>
                                  <Badge status={badgeVotoStatus} label={etichettaVoto} />
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </Card>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SEZIONE 3: Verbale e Documenti dell'Assemblea                      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Card style={styles.sezioneCard}>
        <View style={styles.sezioneHeader}>
          <View style={styles.sezioneTitoloBlocco}>
            <Text style={styles.sezioneTitolo}>3. Verbale Ufficiale e Documenti Firmati</Text>
            <Text style={styles.sezioneDesc}>
              Archiviazione sicura del PDF firmato nel bucket privato (link temporaneo 600s) e notifica ai residenti.
            </Text>
          </View>
        </View>

        {assemblea.verbaleUrl ? (
          <View style={styles.boxVerbaleArchiviato}>
            <View style={styles.infoVerbaleFile}>
              <Icon name="file-text" size="card" color={colors.action.default} />
              <View style={{ gap: 2 }}>
                <Text style={styles.titoloVerbaleEsistente}>Verbale di seduta approvato</Text>
                <Text style={styles.percorsoVerbale} numberOfLines={1}>
                  {assemblea.verbaleUrl}
                </Text>
              </View>
            </View>

            <View style={styles.azioniVerbale}>
              <Button
                variant="primary"
                label="Scarica verbale PDF"
                icon="download"
                onPress={handleScaricaVerbale}
              />
              <Button
                variant="secondary"
                label="Notifica residenti"
                icon="bell"
                onPress={handleNotificaResidenti}
                loading={invioNotificaInCorso}
              />
            </View>
          </View>
        ) : (
          <View style={styles.boxCaricamentoVerbale}>
            <Text style={styles.istruzioniUploadVerbale}>
              Carica il file PDF definitivo firmato per concludere la seduta e renderlo accessibile ai condòmini.
            </Text>

            <FileUpload
              label="Verbale PDF firmato"
              accept={['application/pdf']}
              files={fileVerbale}
              onFilesSelected={(files) => {
                const primo = files[0];
                if (!primo) return;
                setFileOriginaleVerbale(primo);
                setFileVerbale([
                  {
                    id: primo.id || primo.name,
                    name: primo.name,
                    size: primo.size,
                    type: primo.type,
                    status: 'pronto',
                  },
                ]);
              }}
              onRemove={() => {
                setFileOriginaleVerbale(null);
                setFileVerbale([]);
              }}
              helperText="Formato ammesso: solo PDF fino a 20 MB."
            />

            {fileOriginaleVerbale && (
              <Button
                variant="primary"
                label="Carica verbale e concludi assemblea"
                icon="upload"
                onPress={handleCaricaVerbale}
                loading={caricamentoVerbaleInCorso}
              />
            )}
          </View>
        )}
      </Card>

      {/* Azione di Conclusione Assemblea in fondo a destra dopo Sezione 3 */}
      {assemblea.stato !== 'CONCLUSA' && (
        <View style={styles.footerFinePagina}>
          <Button
            variant="primary"
            label="Concludi assemblea"
            icon="check-circle-2"
            onPress={() => setDialogConcludiAperto(true)}
          />
        </View>
      )}

      {/* Modale Nuovo Punto ODG */}
      <Modal
        visible={modaleNuovoPuntoAperta}
        onClose={() => setModaleNuovoPuntoAperta(false)}
        title="Aggiungi punto all'Ordine del Giorno"
      >
        <View style={styles.formModale}>
          <Input
            label="Titolo del punto ODG"
            value={titoloNuovoPunto}
            onChangeText={setTitoloNuovoPunto}
            placeholder="Es. Lavori straordinari grondaie e pluviali..."
          />

          <Textarea
            label="Proposta di delibera e descrizione"
            value={propostaNuovoPunto}
            onChangeText={setPropostaNuovoPunto}
            placeholder="Dettagli sulla proposta di delibera sottoposta all'approvazione..."
          />

          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              onPress={() => setModaleNuovoPuntoAperta(false)}
              disabled={salvataggioPuntoInCorso}
            />
            <Button
              variant="primary"
              label="Inserisci punto"
              icon="plus"
              onPress={handleAggiungiPunto}
              loading={salvataggioPuntoInCorso}
            />
          </ModalActions>
        </View>
      </Modal>

      {/* ConfirmDialog Concludi Assemblea */}
      <ConfirmDialog
        visible={dialogConcludiAperto}
        onCancel={() => setDialogConcludiAperto(false)}
        onConfirm={handleConcludiAssemblea}
        title="Concludere formalmente l'assemblea?"
        description="Lo stato dell'assemblea passerà a CONCLUSA e tutte le votazioni ancora aperte verranno chiuse. Potrai comunque caricare il verbale PDF in seguito."
        confirmLabel="Concludi assemblea"
        cancelLabel="Annulla"
        destructive={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    gap: space[6],
    width: '100%',
  },
  cardErrore: {
    padding: space[6],
    gap: space[4],
    alignItems: 'center',
  },
  testoErrore: {
    ...textStyle('body'),
    color: colors.semantic.error.foreground,
    textAlign: 'center',
  },
  cardTestata: {
    padding: space[6],
    gap: space[4],
  },
  rigaTestataSuperiore: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space[4],
  },
  bloccoTitolo: {
    gap: space[1],
    flex: 1,
    minWidth: 260,
  },
  rigaTitoloBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flexWrap: 'wrap',
  },
  titoloAssemblea: {
    ...textStyle('h2'),
    color: colors.text.primary,
  },
  sottotitoloData: {
    ...textStyle('body'),
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  azioniTestata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flexWrap: 'wrap',
  },
  grigliaDettagliTestata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[4],
    paddingTop: space[3],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  voceDettaglio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoDettaglio: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  linkMeetPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[1],
    paddingHorizontal: space[2],
    borderRadius: radii.badge,
  },
  testoLinkMeet: {
    ...textStyle('secondary'),
    color: colors.action.default,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  sezioneCard: {
    padding: space[6],
    gap: space[6],
  },
  sezioneHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space[4],
  },
  sezioneTitoloBlocco: {
    gap: space[1],
    flex: 1,
    minWidth: 260,
  },
  sezioneTitolo: {
    ...textStyle('h3'),
    color: colors.brand.navy,
  },
  sezioneDesc: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  selettoreConvocazione: {
    flexDirection: 'row',
    borderRadius: radii.control,
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    padding: 2,
    gap: 2,
  },
  btnConv: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radii.badge,
  },
  btnConvAttivo: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  testoBtnConv: {
    ...textStyle('secondary'),
    fontWeight: '500',
    color: colors.text.secondary,
  },
  testoBtnConvAttivo: {
    color: colors.action.default,
    fontWeight: '700',
  },
  boxQuorum: {
    padding: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    gap: space[3],
  },
  boxQuorumOk: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  boxQuorumErr: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  rigaQuorumHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
  },
  rigaBadgeQuorum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoConvBadge: {
    ...textStyle('secondary'),
    color: colors.text.muted,
  },
  messaggioQuorum: {
    ...textStyle('secondary'),
    fontWeight: '600',
    color: colors.text.primary,
  },
  metricheQuorum: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
    borderTopWidth: borderWidths.thin,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: space[3],
  },
  metricaItem: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  metricaValore: {
    ...textStyle('h3'),
    color: colors.text.primary,
  },
  metricaEtichetta: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  boxAllertaDeleghe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    backgroundColor: '#FEF2F2',
    borderRadius: radii.badge,
    borderWidth: borderWidths.thin,
    borderColor: colors.semantic.error.foreground,
  },
  testoAllertaDeleghe: {
    ...textStyle('secondary'),
    fontWeight: '600',
    color: colors.semantic.error.foreground,
    flex: 1,
  },
  togglePresenzeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[3],
  },
  titoloTogglePresenze: {
    ...textStyle('secondary'),
    fontWeight: '700',
    color: colors.text.primary,
  },
  rigaToggleTitolo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flex: 1,
  },
  rigaToggleAzione: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  testoToggleAzione: {
    ...textStyle('secondary'),
    color: colors.action.default,
    fontWeight: '600',
  },
  tabellaPresenze: {
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  intestazioneTabella: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
    gap: space[3],
    alignItems: 'center',
  },
  testoTh: {
    ...textStyle('secondary'),
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  rigaPresenza: {
    flexDirection: 'row',
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
    gap: space[3],
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  testoInterno: {
    ...textStyle('body'),
    fontWeight: '700',
    color: colors.text.primary,
  },
  testoPalazzo: {
    ...textStyle('secondary'),
    color: colors.text.muted,
  },
  testoProprietario: {
    ...textStyle('body'),
    color: colors.text.primary,
  },
  testoMillesimi: {
    ...textStyle('body'),
    fontWeight: '600',
    color: colors.action.default,
  },
  gruppoBottoniPresenza: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1],
  },
  btnPresenza: {
    paddingVertical: space[1],
    paddingHorizontal: space[2],
    borderRadius: radii.badge,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnPresenzaAttivo: {
    backgroundColor: colors.action.default,
    borderColor: colors.action.default,
  },
  testoBtnPresenza: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
    fontWeight: '500',
  },
  testoBtnPresenzaAttivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  boxSelettoreDelega: {
    marginTop: space[2],
  },
  footerPresenze: {
    alignItems: 'flex-end',
  },
  listaPuntiOdg: {
    gap: space[6],
  },
  cardPuntoOdg: {
    padding: space[6],
    gap: space[5],
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  headerPuntoOdg: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space[4],
  },
  bloccoTitoloPunto: {
    gap: space[2],
    flex: 1,
    minWidth: 260,
  },
  rigaTitoloPunto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  numeroPunto: {
    ...textStyle('secondary'),
    fontWeight: '700',
    color: colors.action.default,
    textTransform: 'uppercase',
  },
  titoloPunto: {
    ...textStyle('h3'),
    color: colors.text.primary,
  },
  descPunto: {
    ...textStyle('body'),
    color: colors.text.secondary,
  },
  azioniPunto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexWrap: 'wrap',
  },
  rigaTipoQuorum: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  etichettaQuorum: {
    ...textStyle('secondary'),
    fontWeight: '600',
    color: colors.text.secondary,
  },
  chipsQuorum: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chipTipo: {
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipTipoAttivo: {
    backgroundColor: '#E0F2FE',
    borderColor: colors.action.default,
  },
  testoChipTipo: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  testoChipTipoAttivo: {
    color: colors.action.default,
    fontWeight: '700',
  },
  boxEsitoDelibera: {
    padding: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    gap: space[3],
  },
  boxEsitoApprovata: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  boxEsitoRespinta: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  rigaEsitoBadge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[3],
  },
  testoMotivazioneEsito: {
    ...textStyle('body'),
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  conteggiEsito: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[6],
    borderTopWidth: borderWidths.thin,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: space[3],
  },
  colEsito: {
    gap: 2,
  },
  valoreColEsito: {
    ...textStyle('h3'),
    color: colors.text.primary,
  },
  etichettaColEsito: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  bloccoStatoPartecipazione: {
    gap: space[3],
    backgroundColor: colors.background,
    padding: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
  },
  headerStatoPartecipazione: {
    gap: 2,
  },
  titoloStatoPartecipazione: {
    ...textStyle('secondary'),
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  sottotitoloStatoPartecipazione: {
    ...textStyle('secondary'),
    color: colors.text.muted,
  },
  grigliaStatoPartecipazione: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  cardStatoUnita: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[3],
  },
  infoStatoUnita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flex: 1,
  },
  internoVoto: {
    ...textStyle('body'),
    fontWeight: '700',
    color: colors.text.primary,
  },
  millesimiVoto: {
    ...textStyle('secondary'),
    fontWeight: '600',
    color: colors.action.default,
  },
  titolareVoto: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
    flex: 1,
    minWidth: 140,
  },
  bloccoVerbaleNominale: {
    gap: space[3],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
    paddingTop: space[4],
  },
  toggleVerbaleNominale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[3],
  },
  contenutoVerbaleNominale: {
    gap: space[3],
    marginTop: space[1],
  },
  rigaCopiaVerbale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[3],
  },
  descVerbaleNominale: {
    ...textStyle('secondary'),
    color: colors.text.muted,
    flex: 1,
    minWidth: 240,
  },
  titoloVerbaleNominale: {
    ...textStyle('secondary'),
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  tabellaNominaleContenitore: {
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  rigaNominale: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
    gap: space[3],
  },
  testoTd: {
    ...textStyle('secondary'),
    color: colors.text.primary,
  },
  boxVerbaleArchiviato: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    gap: space[4],
  },
  infoVerbaleFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  titoloVerbaleEsistente: {
    ...textStyle('body'),
    fontWeight: '700',
    color: colors.text.primary,
  },
  percorsoVerbale: {
    ...textStyle('secondary'),
    color: colors.text.muted,
  },
  azioniVerbale: {
    flexDirection: 'row',
    gap: space[3],
    flexWrap: 'wrap',
  },
  boxCaricamentoVerbale: {
    gap: space[4],
    maxWidth: 600,
  },
  istruzioniUploadVerbale: {
    ...textStyle('body'),
    color: colors.text.secondary,
  },
  statoVuoto: {
    padding: space[6],
    alignItems: 'center',
    gap: space[4],
  },
  testoMuted: {
    ...textStyle('body'),
    color: colors.text.muted,
  },
  footerFinePagina: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: space[2],
    paddingBottom: space[6],
  },
  formModale: {
    gap: space[4],
    paddingBottom: space[2],
  },
});
