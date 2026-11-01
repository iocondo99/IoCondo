import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  feedbackSizes,
  layout,
  radii,
  space,
  textStyle,
  useBreakpoint,
} from '@iocondo/ui';
import { BrandMark } from '@/components/Brand';

const SLOGAN = 'Semplice, moderna, per tutti.';

/**
 * Cornice della schermata di accesso (sez. 5 e 16). Da 1200 px in su: a sinistra il pannello navy con
 * logo e slogan, a destra il modulo. Sotto: barra navy col logo in alto e modulo a tutta larghezza.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { isDesktop, breakpoint } = useBreakpoint();

  return (
    <View style={[styles.root, isDesktop && styles.rootDesktop]}>
      {isDesktop ? (
        <View style={styles.panel}>
          <BrandMark large />
          <View style={styles.slogan}>
            <Text style={[textStyle('h1', breakpoint), styles.sloganText]}>{SLOGAN}</Text>
            <View aria-hidden style={styles.sloganRule} />
          </View>
        </View>
      ) : (
        <View style={styles.bar}>
          <BrandMark />
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>{children}</View>
        <View role="contentinfo" style={styles.footer}>
          {/* Le pagine non esistono ancora: restano testo, non link che finiscono nel nulla. */}
          <Text style={[textStyle('secondary', breakpoint), styles.footerText]}>Privacy (in arrivo)</Text>
          <Text style={[textStyle('secondary', breakpoint), styles.footerText]}>Assistenza (in arrivo)</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  rootDesktop: { flexDirection: 'row' },
  panel: {
    flex: 1,
    backgroundColor: colors.brand.navy,
    justifyContent: 'space-between',
    padding: space[12],
  },
  bar: {
    backgroundColor: colors.brand.navy,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  mark: {
    width: space[10],
    height: space[10],
    flexShrink: 0,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { flexShrink: 1 },
  brandName: { color: colors.text.inverse },
  brandTagline: { color: colors.tile.navy.background },
  slogan: { gap: space[4], maxWidth: layout.formMaxWidth },
  sloganText: { color: colors.text.inverse },
  sloganRule: {
    width: space[12],
    height: feedbackSizes.alertAccent,
    borderRadius: radii.full,
    backgroundColor: colors.brand.teal,
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    padding: space[4],
    paddingVertical: space[8],
  },
  form: { width: '100%', maxWidth: layout.formMaxWidth, gap: space[6] },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[6] },
  footerText: { color: colors.text.secondary },
});
