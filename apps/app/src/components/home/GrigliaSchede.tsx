import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { space, useBreakpoint } from '@iocondo/ui';

/** Larghezza minima di una scheda: sotto questa misura le schede passano a una sola colonna. */
const LARGHEZZA_MINIMA = 160;

/**
 * Griglia di schede riepilogative (sez. 16): 4 colonne su desktop, 2 su tablet e smartphone (come nel
 * mockup), 1 sola quando lo spazio non basta (schermi stretti o testo ingrandito). Ogni cella ha la stessa
 * larghezza e le schede della stessa riga la stessa altezza. Se le schede sono meno delle colonne,
 * occupano tutta la riga.
 */
export function GrigliaSchede({ children }: { children: React.ReactNode }) {
  const { isDesktop, isMobile } = useBreakpoint();
  const [larghezza, setLarghezza] = useState(0);
  const celle = React.Children.toArray(children);
  const distanza = isMobile ? space[3] : space[4];
  const massime = Math.max(1, Math.min(isDesktop ? 4 : 2, celle.length));
  const entrano = Math.floor((larghezza + distanza) / (LARGHEZZA_MINIMA + distanza));
  const colonne = larghezza === 0 ? massime : Math.max(1, Math.min(massime, entrano));
  // Arrotondato per difetto: con misure frazionarie due celle e lo spazio possono superare di poco la riga e andare a capo.
  const cella = larghezza === 0 ? undefined : Math.floor((larghezza - distanza * (colonne - 1)) / colonne);

  return (
    <View
      onLayout={(evento: LayoutChangeEvent) => setLarghezza(evento.nativeEvent.layout.width)}
      style={[styles.griglia, { gap: distanza }]}
    >
      {celle.map((cellaFiglia, indice) => (
        <View key={indice} style={cella === undefined ? { flexBasis: `${100 / massime - 2}%`, flexGrow: 1 } : { width: cella }}>
          {cellaFiglia}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  griglia: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'stretch' },
});
