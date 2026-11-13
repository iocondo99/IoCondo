import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ModalitaSegnalazioni } from '@iocondo/data';
import { NonAutorizzato, PageHeader, space } from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { DettaglioSegnalazione } from '@/components/segnalazioni/DettaglioSegnalazione';
import { useProfilo } from '@/context/ProfiloContext';

/** Dettaglio segnalazione unificato per Condòmino e Portiere (`/segnalazioni/[id]`, REQ-C04). */
export function DettaglioSegnalazioneScreen() {
  const consentito = useAccessoConsentito();
  const { ruoli } = useProfilo();
  if (!consentito) return null;
  if (!ruoli.has('CONDOMINO') && !ruoli.has('PORTIERE')) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Segnalazioni" subtitle="Guasti e richieste di intervento." />
        <NonAutorizzato />
      </View>
    );
  }
  const modalita: ModalitaSegnalazioni = ruoli.has('PORTIERE') ? 'portiere' : 'condomino';
  return <DettaglioSegnalazione modalita={modalita} rottaElenco="/segnalazioni" nomeElenco="Segnalazioni" />;
}

const styles = StyleSheet.create({ pagina: { alignSelf: 'stretch', gap: space[6] } });
