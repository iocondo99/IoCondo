import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  calcolaKpiPiattaforma,
  filtraAmministratori,
  formattaDataItaliana,
  validaInvitoAmministratore,
  type AmministratoreConCondomini,
  type CondominioSuperAdmin,
  type FiltroAmministratori,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  FilterChips,
  Input,
  Modal,
  ModalActions,
  PageHeader,
  ResponsiveDataView,
  SearchBar,
  StatCard,
  Switch,
  colors,
  radii,
  space,
  textStyle,
  useToast,
  type DataColumn,
  type FilterOption,
} from '@iocondo/ui';
import { GrigliaSchede } from '@/components/home/GrigliaSchede';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const FILTRI: readonly FilterOption[] = [
  { value: 'attivi', label: 'Solo attivi' },
  { value: 'sospesi', label: 'Con condomini sospesi' },
];

export function SuperAdminAmministratoriScreen() {
  const consentito = useAccessoConsentito();
  const { profilo } = useProfilo();
  if (!consentito || !profilo) return null;
  return <SuperAdminAmministratoriContenuto />;
}

function SuperAdminAmministratoriContenuto() {
  const toast = useToast();
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [amministratori, setAmministratori] = useState<AmministratoreConCondomini[]>([]);
  const [ricerca, setRicerca] = useState('');
  const [filtriAttivi, setFiltriAttivi] = useState<string[]>([]);
  const [inSalvataggioId, setInSalvataggioId] = useState<string | null>(null);
  const [rinnovoAdminId, setRinnovoAdminId] = useState<string | null>(null);

  // Conferma sospensione condominio
  const [daSospendere, setDaSospendere] = useState<CondominioSuperAdmin | null>(null);

  // Modale nuovo amministratore
  const [modaleInvitoAperta, setModaleInvitoAperta] = useState(false);
  const [emailInvito, setEmailInvito] = useState('');
  const [nomeInvito, setNomeInvito] = useState('');
  const [erroriInvito, setErroriInvito] = useState<{ email?: string; nomeCognome?: string }>({});
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [erroreInvitoServer, setErroreInvitoServer] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const lista = await services.superadmin.elencoAmministratoriConCondomini();
      setAmministratori(lista);
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Errore durante il caricamento degli amministratori.');
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const filtro: FiltroAmministratori =
    filtriAttivi[0] === 'attivi' ? 'attivi' : filtriAttivi[0] === 'sospesi' ? 'sospesi' : 'tutti';

  const kpi = useMemo(() => calcolaKpiPiattaforma(amministratori), [amministratori]);
  const filtrati = useMemo(
    () => filtraAmministratori(amministratori, ricerca, filtro),
    [amministratori, ricerca, filtro],
  );

  const applicaStatoCondominio = useCallback(
    async (condominio: CondominioSuperAdmin, attivo: boolean) => {
      setInSalvataggioId(condominio.id);
      try {
        await services.superadmin.setCondominioAttivo(condominio.id, attivo);
        setAmministratori((prev) =>
          prev.map((admin) => ({
            ...admin,
            condomini: admin.condomini.map((c) => (c.id === condominio.id ? { ...c, attivo } : c)),
          })),
        );
        toast.show({
          tone: 'success',
          message: attivo
            ? `Condominio "${condominio.nome}" riattivato.`
            : `Condominio "${condominio.nome}" sospeso.`,
        });
      } catch (e: unknown) {
        toast.show({
          tone: 'error',
          message: e instanceof Error ? e.message : 'Impossibile aggiornare lo stato del condominio.',
        });
      } finally {
        setInSalvataggioId(null);
      }
    },
    [toast],
  );

  const gestisciToggleCondominio = useCallback(
    (condominio: CondominioSuperAdmin, prossimoAttivo: boolean) => {
      if (!prossimoAttivo) {
        setDaSospendere(condominio);
        return;
      }
      void applicaStatoCondominio(condominio, true);
    },
    [applicaStatoCondominio],
  );

  const gestisciRinnovoLicenza = useCallback(
    async (admin: AmministratoreConCondomini) => {
      setRinnovoAdminId(admin.id);
      try {
        const aggiornata = await services.superadmin.rinnovaLicenzaAmministratore(admin.id, 12);
        setAmministratori((prev) =>
          prev.map((a) => (a.id === admin.id ? { ...a, licenza: aggiornata } : a)),
        );
        toast.show({
          tone: 'success',
          message: `Licenza di ${admin.nomeCognome ?? admin.email ?? 'amministratore'} rinnovata per 12 mesi.`,
        });
      } catch (e: unknown) {
        toast.show({
          tone: 'error',
          message: e instanceof Error ? e.message : 'Impossibile rinnovare la licenza.',
        });
      } finally {
        setRinnovoAdminId(null);
      }
    },
    [toast],
  );

  const apriModaleInvito = () => {
    setEmailInvito('');
    setNomeInvito('');
    setErroriInvito({});
    setErroreInvitoServer(null);
    setModaleInvitoAperta(true);
  };

  const inviaInvitoAdmin = async () => {
    const errori = validaInvitoAmministratore(emailInvito, nomeInvito);
    if (errori) {
      setErroriInvito(errori);
      return;
    }
    setErroriInvito({});
    setErroreInvitoServer(null);
    setInvioInCorso(true);
    try {
      const res = await services.superadmin.invitaAmministratore(emailInvito, nomeInvito);
      setModaleInvitoAperta(false);
      toast.show({ tone: 'success', message: res.messaggio });
      await carica();
    } catch (e: unknown) {
      setErroreInvitoServer(
        e instanceof Error ? e.message : 'Non è stato possibile completare l’invito.',
      );
    } finally {
      setInvioInCorso(false);
    }
  };

  const columns: DataColumn<AmministratoreConCondomini>[] = [
    {
      key: 'amministratore',
      header: 'Amministratore',
      minWidth: 210,
      weight: 1.2,
      cell: (row) => (
        <View style={styles.cellaAdmin}>
          <Text style={[textStyle('h4'), styles.nomeAdmin]}>
            {row.nomeCognome || 'Amministratore senza nome'}
          </Text>
          <Text style={[textStyle('secondary'), styles.emailAdmin]}>
            {row.email ?? 'Email non disponibile'}
          </Text>
        </View>
      ),
    },
    {
      key: 'licenza',
      header: 'Licenza SaaS',
      minWidth: 190,
      weight: 1,
      cell: (row) => {
        const stato = row.licenza?.stato ?? 'ASSENTE';
        const status = stato === 'ATTIVA' ? 'success' : stato === 'SCADUTA' ? 'error' : 'warning';
        const label = stato === 'ATTIVA' ? 'Attiva' : stato === 'SCADUTA' ? 'Scaduta' : 'Non assegnata';
        return (
          <View style={styles.cellaLicenza}>
            <Badge status={status} label={label} />
            {row.licenza?.dataScadenza ? (
              <Text style={[textStyle('label'), styles.metaText]}>
                Scade: {formattaDataItaliana(row.licenza.dataScadenza)}
              </Text>
            ) : null}
            <Button
              variant="text"
              label={stato === 'ATTIVA' ? 'Estendi 12 mesi' : 'Attiva 12 mesi'}
              loading={rinnovoAdminId === row.id}
              onPress={() => void gestisciRinnovoLicenza(row)}
            />
          </View>
        );
      },
    },
    {
      key: 'condomini',
      header: 'Condomini gestiti & Kill-Switch',
      minWidth: 340,
      weight: 2.2,
      cell: (row) => {
        if (row.condomini.length === 0) {
          return (
            <Text style={[textStyle('secondary'), styles.metaText]}>
              Nessun condominio ancora associato
            </Text>
          );
        }
        return (
          <View style={styles.listaCondomini}>
            {row.condomini.map((c) => {
              const salvando = inSalvataggioId === c.id;
              return (
                <View
                  key={c.id}
                  style={[styles.rigaCondominio, !c.attivo && styles.rigaCondominioSospeso]}
                >
                  <View style={styles.infoCondominio}>
                    <View style={styles.titoloCondRow}>
                      <Text style={[textStyle('label'), styles.nomeCondominio]}>
                        {c.nome}
                      </Text>
                      <Badge
                        status={c.attivo ? 'success' : 'error'}
                        label={c.attivo ? 'Attivo' : 'Sospeso'}
                      />
                    </View>
                    <Text style={[textStyle('secondary'), styles.metaText]}>
                      {[c.indirizzo, c.citta].filter(Boolean).join(' · ') || 'Indirizzo non indicato'}
                      {` · ${c.numeroPalazzi} palazzi · ${c.numeroUnita} unità`}
                    </Text>
                  </View>
                  <View style={styles.switchBox}>
                    <Switch
                      checked={c.attivo}
                      disabled={salvando}
                      accessibilityLabel={`Abilita o sospendi condominio ${c.nome}`}
                      onChange={(prossimo) => gestisciToggleCondominio(c, prossimo)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        );
      },
    },
  ];

  return (
    <View style={styles.root}>
      <PageHeader
        title="Amministratori e Condomini"
        subtitle="Gestisci gli amministratori accreditati, le licenze SaaS e lo stato di attivazione dei condomini."
        action={{
          label: 'Nuovo amministratore',
          icon: 'user-plus',
          onPress: apriModaleInvito,
        }}
      />

      <GrigliaSchede>
        <StatCard
          icon="building-2"
          tile="navy"
          title="Condomini sulla piattaforma"
          value={`${kpi.condominiAttivi} attivi · ${kpi.condominiSospesi} ${kpi.condominiSospesi === 1 ? 'sospeso' : 'sospesi'}`}
          description={`${kpi.totaleCondomini} condomini totali registrati`}
          loading={caricamento}
        />
        <StatCard
          icon="user-cog"
          tile="teal"
          title="Amministratori accreditati"
          value={`${kpi.amministratoriLicenzaAttiva} attivi`}
          description={`${kpi.totaleAmministratori} totali · ${kpi.amministratoriLicenzaScaduta} senza licenza attiva`}
          loading={caricamento}
        />
        <StatCard
          icon="home"
          tile="blue"
          title="Unità immobiliari gestite"
          value={`${kpi.totaleUnita} unità`}
          description="Totale unità censite sulla piattaforma"
          loading={caricamento}
        />
      </GrigliaSchede>

      <Card>
        <View style={styles.controlli}>
          <SearchBar
            label="Cerca amministratore o condominio"
            value={ricerca}
            onChangeText={setRicerca}
            placeholder="Cerca per amministratore, email o condominio…"
          />
          <FilterChips
            label="Filtra amministratori per stato condomini"
            options={FILTRI}
            value={filtriAttivi}
            onChange={setFiltriAttivi}
          />
        </View>
      </Card>

      <ResponsiveDataView
        label="Elenco amministratori e condomini"
        columns={columns}
        rows={filtrati}
        getRowKey={(row) => row.id}
        getRowLabel={(row) => row.nomeCognome ?? row.email ?? row.id}
        loading={caricamento}
        error={errore ? { title: 'Impossibile caricare gli amministratori', description: errore } : false}
        onRetry={carica}
        empty={{
          icon: 'user-cog',
          title: 'Nessun amministratore trovato',
          description:
            ricerca || filtro !== 'tutti'
              ? 'Prova a modificare i filtri di ricerca.'
              : 'Invita il primo amministratore per iniziare.',
        }}
      />

      <ConfirmDialog
        visible={Boolean(daSospendere)}
        title={daSospendere ? `Sospendere il condominio ${daSospendere.nome}?` : 'Sospendere il condominio?'}
        description="Nessun residente né l'amministratore potrà più accedere alla piattaforma finché non verrà riattivato."
        confirmLabel="Sospendi condominio"
        confirmLoadingLabel="Sospensione…"
        destructive
        onCancel={() => setDaSospendere(null)}
        onConfirm={async () => {
          if (!daSospendere) return;
          const target = daSospendere;
          setDaSospendere(null);
          await applicaStatoCondominio(target, false);
        }}
      />

      <Modal
        visible={modaleInvitoAperta}
        onClose={() => !invioInCorso && setModaleInvitoAperta(false)}
        title="Nuovo amministratore"
        description="Invita un amministratore associando automaticamente la licenza al Piano Unico Piattaforma."
        dismissible={!invioInCorso}
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Annulla"
              disabled={invioInCorso}
              onPress={() => setModaleInvitoAperta(false)}
            />
            <Button
              variant="primary"
              label="Invita amministratore"
              icon="mail"
              loading={invioInCorso}
              loadingLabel="Invio in corso…"
              onPress={() => void inviaInvitoAdmin()}
            />
          </ModalActions>
        }
      >
        <View style={styles.formModale}>
          <Alert
            tone="info"
            message="All'amministratore verrà associata automaticamente una licenza sul Piano Unico Piattaforma."
          />
          <Input
            label="Nome e cognome"
            value={nomeInvito}
            onChangeText={setNomeInvito}
            placeholder="Es. Studio Rossi / Mario Rossi"
            required
            error={erroriInvito.nomeCognome}
          />
          <Input
            label="Indirizzo email"
            value={emailInvito}
            onChangeText={setEmailInvito}
            placeholder="amministratore@studio.it"
            keyboardType="email-address"
            autoCapitalize="none"
            required
            error={erroriInvito.email}
          />
          {erroreInvitoServer ? <Alert tone="error" message={erroreInvitoServer} /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[6] },
  controlli: { gap: space[3] },
  cellaAdmin: { gap: space[1] },
  nomeAdmin: { color: colors.text.primary },
  emailAdmin: { color: colors.text.secondary },
  cellaLicenza: { gap: space[1], alignItems: 'flex-start' },
  metaText: { color: colors.text.muted },
  listaCondomini: { gap: space[2] },
  rigaCondominio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    padding: space[3],
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rigaCondominioSospeso: {
    borderColor: colors.semantic.error.foreground,
    backgroundColor: colors.semantic.error.background,
  },
  infoCondominio: { flex: 1, minWidth: 0, gap: space[1] },
  titoloCondRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
  nomeCondominio: { color: colors.text.primary },
  switchBox: { alignItems: 'flex-end', justifyContent: 'center' },
  formModale: { gap: space[4] },
});
