import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NonAutorizzato, PageHeader, space } from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { DettaglioSegnalazione } from '@/components/segnalazioni/DettaglioSegnalazione';
import { useProfilo } from '@/context/ProfiloContext';

/** Dettaglio segnalazione del condòmino (`/segnalazioni/[id]`, REQ-C04). */
export function DettaglioSegnalazioneScreen() {
  const consentito = useAccessoConsentito();
  const { ruoli } = useProfilo();
  if (!consentito) return null;
  if (!ruoli.has('CONDOMINO')) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Segnalazioni" subtitle="Guasti e richieste di intervento." />
        <NonAutorizzato />
      </View>
    );
  }
  return <DettaglioSegnalazione modalita="condomino" rottaElenco="/segnalazioni" nomeElenco="Segnalazioni" />;
}

const styles = StyleSheet.create({ pagina: { alignSelf: 'stretch', gap: space[6] } });
