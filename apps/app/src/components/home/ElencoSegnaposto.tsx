import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton, dataSizes, radii, space } from '@iocondo/ui';

/** Segnaposto di un elenco di righe (stessa altezza di `ListRow`): la scheda non salta quando arrivano i dati. */
export function ElencoSegnaposto({ righe = 3, etichetta }: { righe?: number; etichetta: string }) {
  return (
    <View role="status" aria-busy aria-label={etichetta} style={styles.elenco}>
      {Array.from({ length: righe }, (_, indice) => (
        <View key={indice} style={styles.riga}>
          <Skeleton shape="block" width={dataSizes.listTile} height={dataSizes.listTile} />
          <View style={styles.testi}>
            <Skeleton width="55%" />
            <Skeleton width="80%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  elenco: { alignSelf: 'stretch' },
  riga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderRadius: radii.control,
  },
  testi: { flex: 1, gap: space[2] },
});
