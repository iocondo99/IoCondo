import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  calcolaStatisticheInviti,
  filtraInviti,
  isEmailValida,
  type OpzioneUnitaInvito,
  type RigaInvitoAdminView,
  type RuoloInvitabileAdmin,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
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
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
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
  { value: 'in_attesa', label: 'In attesa' },
  { value: 'accettati', label: 'Accettati' },
  { value: 'scaduti', label: 'Scaduti' },
];

const OPZIONI_RUOLO: readonly SelectOption[] = [
  { value: 'CONDOMINO', label: 'Condòmino' },
  { value: 'PORTIERE', label: 'Portiere' },
];

export function AdminInvitiScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli } = useProfilo();

  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('ADMIN')) {
    return (
      <View style={styles.pagina}>
        <PageHeader
          title="Inviti residenti e personale"
          subtitle="Gestisci gli inviti inviati a condòmini e portieri per accedere all'app."
        />
        <NonAutorizzato />
      </View>
    );
  }

  return <AdminInvitiContenuto />;
}

function AdminInvitiContenuto() {
  const { condominio } = useProfilo();
  const { breakpoint, isMobile } = useBreakpoint();
  const toast = useToast();

  const [inviti, setInviti] = useState<RigaInvitoAdminView[]>([]);
  const [unitaDisponibili, setUnitaDisponibili] = useState<OpzioneUnitaInvito[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState(false);

  // Filtri e ricerca
  const [filtroStato, setFiltroStato] = useState<string>('tutti');
  const [filtroRicerca, setFiltroRicerca] = useState<string>('');

  // Modale "Invia nuovo invito"
  const [modaleAperta, setModaleAperta] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [ruoloInput, setRuoloInput] = useState<RuoloInvitabileAdmin>('CONDOMINO');
  const [unitaInput, setUnitaInput] = useState<string>('');
  const [flagPortiere, setFlagPortiere] = useState(false);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
  const [erroreEmail, setErroreEmail] = useState<string | undefined>(undefined);
  const [erroreUnita, setErroreUnita] = useState<string | undefined>(undefined);
  const [erroreModale, setErroreModale] = useState<string | null>(null);

  const emailInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Revoca invito (ConfirmDialog)
  const [invitoDaRevocare, setInvitoDaRevocare] = useState<RigaInvitoAdminView | null>(null);

  // Sollecito / Rinnovo in corso
  const [azioneInCorsoId, setAzioneInCorsoId] = useState<string | null>(null);

  const caricaDati = useCallback(async () => {
    if (!condominio?.id) {
      setCaricamento(false);
      return;
    }
    setCaricamento(true);
    setErrore(false);
    try {
      const [listaInviti, listaUnita] = await Promise.all([
        services.invitiAdmin.list(condominio.id),
        services.invitiAdmin.listUnita(condominio.id),
      ]);
      setInviti(listaInviti);
      setUnitaDisponibili(listaUnita);
    } catch (err) {
      console.error('Errore durante il caricamento degli inviti:', err);
      setErrore(true);
    } finally {
      setCaricamento(false);
    }
  }, [condominio?.id]);

  useEffect(() => {
    caricaDati();
  }, [caricaDati]);

  const statistiche = useMemo(() => calcolaStatisticheInviti(inviti), [inviti]);

  const invitiFiltrati = useMemo(() => {
    return filtraInviti(inviti, { stato: filtroStato, ricerca: filtroRicerca });
  }, [inviti, filtroStato, filtroRicerca]);

  const opzioniSelectUnita = useMemo<SelectOption[]>(() => {
    const lista = unitaDisponibili.map((u) => ({
      value: u.id,
      label: u.label,
    }));

    if (ruoloInput === 'PORTIERE') {
      return [
        { value: '', label: 'Nessuna unità (personale o uso comune)' },
        ...lista,
      ];
    }

    return [
      { value: '', label: 'Seleziona un’unità…' },
      ...lista,
    ];
  }, [unitaDisponibili, ruoloInput]);

  const apriModaleNuovoInvito = () => {
    setEmailInput('');
    setRuoloInput('CONDOMINO');
    setUnitaInput('');
    setFlagPortiere(false);
    setErroreEmail(undefined);
    setErroreUnita(undefined);
    setErroreModale(null);
    setModaleAperta(true);
  };

  const chiudiModale = () => {
    if (salvataggioInCorso) return;
    setModaleAperta(false);
  };

  const validaEInviaInvito = async () => {
    let valido = true;
    setErroreEmail(undefined);
    setErroreUnita(undefined);
    setErroreModale(null);

    const emailTrimmed = emailInput.trim();
    if (!emailTrimmed) {
      setErroreEmail('Inserisci l’indirizzo email del destinatario.');
      valido = false;
    } else if (!isEmailValida(emailTrimmed)) {
      setErroreEmail('Inserisci un indirizzo email valido (es. nome@dominio.it).');
      valido = false;
    }

    if (ruoloInput === 'CONDOMINO' && !unitaInput) {
      setErroreUnita('Seleziona l’unità immobiliare associata al condòmino.');
      valido = false;
    }

    if (!valido) return;

    setSalvataggioInCorso(true);
    try {
      const res = await services.invitiAdmin.invia({
        email: emailTrimmed,
        ruolo: ruoloInput,
        condominioId: condominio!.id,
        unitaId: unitaInput ? unitaInput : null,
        flagPortiere: ruoloInput === 'CONDOMINO' ? flagPortiere : false,
      });

      toast.show({
        tone: 'success',
        message: res.messaggio || 'Invito registrato.',
      });

      setModaleAperta(false);
      await caricaDati();
    } catch (err: unknown) {
      const messaggio =
        err instanceof Error ? err.message : 'Non è stato possibile registrare l’invito. Riprova.';
      setErroreModale(messaggio);
    } finally {
      setSalvataggioInCorso(false);
    }
  };

  const gestisciSollecita = async (invito: RigaInvitoAdminView) => {
    const azioneKey = `${invito.token}-sollecita`;
    setAzioneInCorsoId(azioneKey);
    try {
      await services.invitiAdmin.sollecita({
        token: invito.token,
        email: invito.email,
        ruolo: invito.ruoloCodice,
        condominioId: condominio!.id,
        unitaId: invito.unitaId,
        flagPortiere: invito.flagPortiere,
      });

      toast.show({
        tone: 'success',
        message: 'Sollecito inviato con successo. Scadenza prorogata di 7 giorni.',
      });
      await caricaDati();
    } catch (err) {
      console.error('Errore durante il sollecito:', err);
      toast.show({
        tone: 'error',
        message: 'Non è stato possibile sollecitare l’invito. Controlla la connessione e riprova.',
      });
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  const gestisciRinnova = async (invito: RigaInvitoAdminView) => {
    const azioneKey = `${invito.token}-rinnova`;
    setAzioneInCorsoId(azioneKey);
    try {
      await services.invitiAdmin.rinnova(invito.token, {
        email: invito.email,
        ruolo: invito.ruoloCodice,
        condominioId: condominio!.id,
        unitaId: invito.unitaId,
        flagPortiere: invito.flagPortiere,
      });

      toast.show({
        tone: 'success',
        message: 'Invito rinnovato con successo per altri 7 giorni.',
      });
      await caricaDati();
    } catch (err) {
      console.error('Errore durante il rinnovo:', err);
      toast.show({
        tone: 'error',
        message: 'Non è stato possibile rinnovare l’invito. Controlla la connessione e riprova.',
      });
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  const confermaRevoca = async () => {
    if (!invitoDaRevocare) return;
    try {
      await services.invitiAdmin.revoca(invitoDaRevocare.token);
      toast.show({
        tone: 'success',
        message: 'Invito revocato con successo.',
      });
      setInvitoDaRevocare(null);
      await caricaDati();
    } catch (err) {
      console.error('Errore durante la revoca:', err);
      toast.show({
        tone: 'error',
        message: 'Non è stato possibile revocare l’invito. Riprova.',
      });
      throw err;
    }
  };

  const colonne: readonly DataColumn<RigaInvitoAdminView>[] = useMemo(
    () => [
      {
        key: 'email',
        header: 'Destinatario',
        cell: (r) => <Text style={styles.testoEmail}>{r.email}</Text>,
        mobile: 'title',
        weight: 3,
        minWidth: 180,
      },
      {
        key: 'ruolo',
        header: 'Ruolo proposto',
        cell: (r) => (
          <Badge
            status={r.ruoloCodice === 'PORTIERE' ? 'neutral' : 'info'}
            label={r.ruoloEtichetta}
          />
        ),
        mobileLabel: 'Ruolo proposto',
        minWidth: 160,
      },
      {
        key: 'unita',
        header: 'Unità associata',
        cell: (r) => (
          <Text style={[styles.testoSecondario, r.unitaId ? undefined : styles.testoMuted]}>
            {r.unitaEtichetta}
          </Text>
        ),
        mobileLabel: 'Unità',
        minWidth: 160,
      },
      {
        key: 'dataInvio',
        header: 'Data invio',
        cell: (r) => <Text style={styles.testoData}>{r.dataInvioTesto}</Text>,
        mobileLabel: 'Data invio',
        minWidth: 110,
      },
      {
        key: 'scadenza',
        header: 'Scadenza / Accettazione',
        cell: (r) => <Text style={styles.testoData}>{r.scadenzaRelativa}</Text>,
        mobileLabel: 'Scadenza / Accettazione',
        minWidth: 160,
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (r) => <Badge status={r.statoBadge} />,
        mobile: 'status',
        minWidth: 120,
      },
      {
        key: 'azioni',
        header: 'Azioni',
        align: 'end',
        minWidth: 190,
        mobileLabel: 'Azioni',
        cell: (r) => (
          <View style={styles.rigaAzioni}>
            {r.stato === 'IN_ATTESA' ? (
              <>
                <Button
                  variant="secondary"
                  label="Sollecita"
                  icon="refresh-cw"
                  loading={azioneInCorsoId === `${r.token}-sollecita`}
                  disabled={!!azioneInCorsoId}
                  onPress={() => gestisciSollecita(r)}
                />
                <Button
                  variant="destructive"
                  label="Revoca"
                  icon="trash-2"
                  disabled={!!azioneInCorsoId}
                  onPress={() => setInvitoDaRevocare(r)}
                />
              </>
            ) : r.stato === 'SCADUTO' ? (
              <Button
                variant="secondary"
                label="Rinnova invito"
                icon="refresh-cw"
                loading={azioneInCorsoId === `${r.token}-rinnova`}
                disabled={!!azioneInCorsoId}
                onPress={() => gestisciRinnova(r)}
              />
            ) : (
              <Text style={styles.testoMuted}>—</Text>
            )}
          </View>
        ),
      },
    ],
    [azioneInCorsoId],
  );

  const erroreScheda = errore ? { message: 'Errore caricamento', onRetry: caricaDati } : undefined;
  const haFiltriAttivi = filtroStato !== 'tutti' || filtroRicerca.trim() !== '';

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Inviti residenti e personale"
        subtitle="Gestisci gli inviti inviati a condòmini e portieri per accedere all'app."
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Inviti' },
        ]}
        action={{
          label: 'Invia nuovo invito',
          icon: 'mail-plus',
          onPress: apriModaleNuovoInvito,
        }}
      />

      {/* 3 StatCard Ufficiali */}
      <View style={styles.schede}>
        <View style={styles.scheda}>
          <StatCard
            icon="mail"
            tile="blue"
            title="Inviti in attesa"
            value={caricamento ? '' : String(statistiche.inAttesa)}
            description="In attesa di primo accesso"
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="check-circle-2"
            tile="teal"
            title="Accettati questo mese"
            value={caricamento ? '' : String(statistiche.accettatiMese)}
            description="Convertiti con successo"
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
        <View style={styles.scheda}>
          <StatCard
            icon="clock"
            tile="navy"
            title="Inviti scaduti"
            value={caricamento ? '' : String(statistiche.scaduti)}
            description="Non confermati oltre 7 giorni"
            status={!caricamento && statistiche.scaduti > 0 ? 'scaduto' : undefined}
            loading={caricamento}
            error={erroreScheda}
          />
        </View>
      </View>

      {/* Barra di controllo e Tabella */}
      <Card>
        <ResponsiveDataView
          label="Elenco degli inviti del condominio"
          columns={colonne}
          rows={invitiFiltrati}
          getRowKey={(r) => r.token}
          getRowLabel={(r) => `${r.email}, ruolo ${r.ruoloEtichetta}, stato ${r.stato}`}
          loading={caricamento}
          error={
            errore
              ? {
                  title: 'Non è stato possibile caricare gli inviti',
                  description: 'Controlla la connessione internet e riprova.',
                }
              : false
          }
          onRetry={caricaDati}
          empty={{
            icon: 'mail',
            title: haFiltriAttivi ? 'Nessun invito trovato' : 'Nessun invito inviato',
            description: haFiltriAttivi
              ? 'Nessun invito corrisponde alla ricerca o ai filtri selezionati. Cancella la ricerca o premi "Azzera filtri".'
              : 'Non hai ancora inviato inviti per questo condominio. Premi "Invia nuovo invito" per abilitare un residente o un portiere.',
            action: haFiltriAttivi
              ? {
                  label: 'Azzera filtri',
                  onPress: () => {
                    setFiltroStato('tutti');
                    setFiltroRicerca('');
                  },
                }
              : {
                  label: 'Invia nuovo invito',
                  onPress: apriModaleNuovoInvito,
                },
          }}
          filters={
            <View style={styles.filtri}>
              <SearchBar
                value={filtroRicerca}
                onChangeText={setFiltroRicerca}
                label="Cerca invito"
                placeholder="Cerca per email, interno o palazzo…"
                showLabel
              />
              <FilterChips
                label="Filtra per stato"
                allLabel="Tutti gli inviti"
                options={OPZIONI_STATO}
                value={filtroStato === 'tutti' || !filtroStato ? [] : [filtroStato]}
                onChange={(valori) => setFiltroStato(valori[0] || 'tutti')}
              />
              {!caricamento && (
                <View role="status" aria-live="polite" aria-atomic>
                  <Text style={[textStyle('secondary', breakpoint), styles.conteggio]}>
                    {invitiFiltrati.length === inviti.length
                      ? inviti.length === 1
                        ? 'C’è 1 invito.'
                        : `Ci sono ${inviti.length} inviti.`
                      : `${invitiFiltrati.length === 1 ? '1 invito' : `${invitiFiltrati.length} inviti`} su ${inviti.length}.`}
                  </Text>
                </View>
              )}
            </View>
          }
        />
      </Card>

      {/* Modale "Invia nuovo invito" (UC-07) */}
      <Modal
        visible={modaleAperta}
        onClose={chiudiModale}
        title="Invia nuovo invito"
        description="Invita un condòmino o un addetto alla portineria ad accedere alla piattaforma."
        dismissible={!salvataggioInCorso}
        initialFocusRef={emailInputRef}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              disabled={salvataggioInCorso}
              onPress={chiudiModale}
            />
            <Button
              variant="primary"
              label="Invia invito"
              loading={salvataggioInCorso}
              loadingLabel="Invio in corso…"
              onPress={validaEInviaInvito}
            />
          </ModalActions>
        }
      >
        <View style={styles.modaleCorpo}>
          {erroreModale ? <Alert tone="error" message={erroreModale} /> : null}

          {/* Campo Email con validazione RFC */}
          <Input
            inputRef={emailInputRef}
            label="Email del destinatario"
            placeholder="es. nome@dominio.it"
            value={emailInput}
            onChangeText={(t) => {
              setEmailInput(t);
              if (erroreEmail) setErroreEmail(undefined);
            }}
            error={erroreEmail}
            required
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            disabled={salvataggioInCorso}
          />

          {/* Selezione Ruolo principale */}
          <Select
            label="Ruolo principale"
            options={OPZIONI_RUOLO}
            value={ruoloInput}
            onChange={(val) => {
              const nuovoRuolo = val as RuoloInvitabileAdmin;
              setRuoloInput(nuovoRuolo);
              if (nuovoRuolo === 'PORTIERE') {
                setFlagPortiere(false);
              }
              setErroreUnita(undefined);
            }}
            required
            disabled={salvataggioInCorso}
          />

          {/* Selezione Unità immobiliare */}
          <Select
            label="Unità immobiliare"
            options={opzioniSelectUnita}
            value={unitaInput}
            onChange={(val) => {
              setUnitaInput(val);
              if (erroreUnita) setErroreUnita(undefined);
            }}
            error={erroreUnita}
            required={ruoloInput === 'CONDOMINO'}
            helperText={
              ruoloInput === 'CONDOMINO'
                ? 'Obbligatorio per associare il residente all’immobile e al piano di riparto.'
                : 'Facoltativo: assegna un’unità solo se il portiere alloggia in un appartamento condominiale.'
            }
            disabled={salvataggioInCorso}
          />

          {/* Checkbox mansione aggiuntiva Portiere (UC-07 utente ibrido) */}
          {ruoloInput === 'CONDOMINO' && (
            <Checkbox
              checked={flagPortiere}
              onChange={setFlagPortiere}
              label="Assegna anche mansione di Portiere"
              helperText="Crea un utente ibrido con accesso a 'Le mie rate' e alla scheda 'Registro pacchi'."
              disabled={salvataggioInCorso}
            />
          )}

          {/* Sezione informativa */}
          <View style={styles.sezioneInformativa}>
            <Icon name="info" size="action" color={colors.semantic.info.foreground} />
            <Text style={styles.testoInformativo}>
              L’invito ha una validità di 7 giorni. Il destinatario riceverà un link magico sicuro via
              email per la scelta della password e l’accesso al condominio.
            </Text>
          </View>
        </View>
      </Modal>

      {/* ConfirmDialog Revoca Invito */}
      <ConfirmDialog
        visible={!!invitoDaRevocare}
        title="Revocare questo invito?"
        description={`L’invito inviato a "${invitoDaRevocare?.email}" verrà revocato immediatamente e il link di attivazione associato non sarà più utilizzabile.`}
        confirmLabel="Revoca invito"
        confirmLoadingLabel="Revoca in corso…"
        cancelLabel="Annulla"
        destructive
        onConfirm={confermaRevoca}
        onCancel={() => setInvitoDaRevocare(null)}
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
    minWidth: 200,
  },
  filtri: {
    gap: space[3],
  },
  conteggio: {
    color: colors.text.secondary,
  },
  testoEmail: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  testoSecondario: {
    color: colors.text.primary,
  },
  testoData: {
    color: colors.text.secondary,
  },
  testoMuted: {
    color: colors.text.muted,
  },
  rigaAzioni: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexWrap: 'wrap',
  },
  modaleCorpo: {
    gap: space[4],
    paddingBottom: space[4],
  },
  sezioneInformativa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    backgroundColor: colors.semantic.info.background,
    borderColor: colors.semantic.info.foreground,
    borderWidth: borderWidths.thin,
    borderRadius: radii.card,
    padding: space[4],
  },
  testoInformativo: {
    flex: 1,
    color: colors.semantic.info.foreground,
    lineHeight: 20,
    fontSize: 14,
  },
});

