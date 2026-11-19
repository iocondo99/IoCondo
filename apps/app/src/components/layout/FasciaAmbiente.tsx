import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { space } from '@iocondo/ui';

/** Ambiente della build: EXPO_PUBLIC_APP_ENV = production | preview | development (default production). */
export const AMBIENTE_APP = (process.env.EXPO_PUBLIC_APP_ENV ?? 'production').toLowerCase();

const ETICHETTE: Record<string, string> = {
  preview: 'Ambiente di preview · dati di test',
  development: 'Ambiente di sviluppo · dati di test',
};

/** Fascia in cima alle pagine pubbliche, solo fuori dalla produzione. */
export function FasciaAmbiente() {
  if (AMBIENTE_APP === 'production') return null;
  const testo = ETICHETTE[AMBIENTE_APP] ?? `Ambiente: ${AMBIENTE_APP}`;
  return (
    <View style={styles.fascia} accessibilityRole="alert" accessibilityLabel={testo}>
      <Text style={styles.testo}>{testo.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fascia: { backgroundColor: '#C2410C', paddingVertical: space[2], paddingHorizontal: space[4], alignItems: 'center' },
  testo: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, letterSpacing: 0.5, textAlign: 'center' },
});
