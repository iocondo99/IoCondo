import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borderWidths, colors, radii, space, textStyle, useBreakpoint } from '@iocondo/ui';

/** Elementi di impaginazione della pagina di collaudo: riquadro di sezione, didascalia e riga di prove. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[textStyle('h3', breakpoint), styles.sectionTitle]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Demo({ caption, children }: { caption: string; children: React.ReactNode }) {
  const { breakpoint } = useBreakpoint();
  return (
    <View style={styles.demo}>
      <Text style={[textStyle('label', breakpoint), styles.caption]}>{caption}</Text>
      {children}
    </View>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}


const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: space[4],
    gap: space[5],
  },
  sectionTitle: { color: colors.brand.navy },
  demo: { gap: space[2] },
  caption: { color: colors.text.secondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
});
