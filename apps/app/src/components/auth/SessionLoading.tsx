import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LoadingState, colors } from '@iocondo/ui';

/** Mentre si legge la sessione: mai una pagina bianca, mai un lampo della pagina protetta o del modulo. */
export function SessionLoading({ message = 'Un momento, stiamo controllando l’accesso…' }: { message?: string }) {
  return (
    <View style={styles.root}>
      <LoadingState message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
