import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import {
  formattaDataItaliana,
  formattaEuroSaas,
  type FatturaSaasView,
} from '@iocondo/data';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  ResponsiveDataView,
  SearchBar,
  StatCard,
  colors,
  space,
  textStyle,
  useToast,
  type DataColumn,
} from '@iocondo/ui';
import { GrigliaSchede } from '@/components/home/GrigliaSchede';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function SuperAdminFattureScreen() {
  const consentito = useAccessoConsentito();
  const { profilo } = useProfilo();
  if (!consentito || !profilo) return null;
  return <SuperAdminFattureContenuto />;
}

function SuperAdminFattureContenuto() {
  const toast = useToast();
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatture, setFatture] = useState<FatturaSaasView[]>([]);
  const [ricerca, setRicerca] = useState('');

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const lista = await services.superadmin.elencoFattureSaaS();
      setFatture(lista);
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : 'Errore nel caricamento delle fatture SaaS.');
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const filtrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return fatture;
    return fatture.filter(
      (f) =>
        f.adminNome.toLowerCase().includes(q) ||
        (f.adminEmail ?? '').toLowerCase().includes(q),
    );
  }, [fatture, ricerca]);

  const totaleFatturato = useMemo(
    () => fatture.reduce((acc, f) => acc + f.importo, 0),
    [fatture],
  );

  const apriPdf = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.show({ tone: 'error', message: 'Impossibile aprire il documento PDF.' });
    }
  };

  const columns: DataColumn<FatturaSaasView>[] = [
    {
      key: 'data',
      header: 'Data emissione',
      minWidth: 140,
      weight: 1,
      cell: (row) => (
        <Text style={[textStyle('body'), styles.primaryText]}>
          {formattaDataItaliana(row.dataEmissione)}
        </Text>
      ),
    },
    {
      key: 'amministratore',
      header: 'Amministratore',
      minWidth: 220,
      weight: 1.6,
      cell: (row) => (
        <View style={styles.adminBox}>
          <Text style={[textStyle('label'), styles.primaryText]}>{row.adminNome}</Text>
          {row.adminEmail ? (
            <Text style={[textStyle('secondary'), styles.secondaryText]}>
              {row.adminEmail}
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'importo',
      header: 'Importo',
      align: 'end',
      minWidth: 120,
      weight: 0.9,
      cell: (row) => formattaEuroSaas(row.importo),
    },
    {
      key: 'stato',
      header: 'Documento',
      minWidth: 180,
      weight: 1.1,
      cell: (row) => (
        <View style={styles.docBox}>
          <Badge status="info" label="Emessa" />
          {row.urlPdf ? (
            <Button
              variant="text"
              label="Scarica PDF"
              icon="download"
              onPress={() => void apriPdf(row.urlPdf!)}
            />
          ) : (
            <Text style={[textStyle('secondary'), styles.mutedText]}>Nessun allegato</Text>
          )}
        </View>
      ),
    },
  ];

  return (
    <View style={styles.root}>
      <PageHeader
        title="Fatture SaaS Piattaforma"
        subtitle="Storico delle fatture emesse verso gli amministratori per le licenze della piattaforma."
      />

      <GrigliaSchede>
        <StatCard
          icon="receipt"
          tile="navy"
          title="Fatture emesse"
          value={String(fatture.length)}
          description="Totale documenti contabili registrati"
          loading={caricamento}
        />
        <StatCard
          icon="wallet"
          tile="teal"
          title="Totale fatturato"
          value={formattaEuroSaas(totaleFatturato)}
          description="Somma degli importi emessi"
          loading={caricamento}
        />
      </GrigliaSchede>

      <Card>
        <SearchBar
          label="Cerca fatture per amministratore"
          value={ricerca}
          onChangeText={setRicerca}
          placeholder="Cerca per nome o email amministratore…"
        />
      </Card>

      <ResponsiveDataView
        label="Elenco fatture SaaS"
        columns={columns}
        rows={filtrate}
        getRowKey={(row) => row.id}
        getRowLabel={(row) => `${row.adminNome} · ${formattaEuroSaas(row.importo)}`}
        loading={caricamento}
        error={errore ? { title: 'Impossibile caricare le fatture', description: errore } : false}
        onRetry={carica}
        empty={{
          icon: 'receipt',
          title: 'Nessuna fattura trovata',
          description: ricerca
            ? 'Nessuna fattura corrisponde alla ricerca.'
            : 'Non sono ancora state emesse fatture SaaS.',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[6] },
  adminBox: { gap: space[1] },
  primaryText: { color: colors.text.primary },
  secondaryText: { color: colors.text.secondary },
  mutedText: { color: colors.text.muted },
  docBox: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
});
