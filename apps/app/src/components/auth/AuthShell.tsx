import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import {
  borderWidths,
  colors,
  feedbackSizes,
  focusRing,
  layout,
  radii,
  shadows,
  space,
  textStyle,
  touchTarget,
  useBreakpoint,
  Button,
  Icon,
} from '@iocondo/ui';
import { BrandMark } from '@/components/Brand';

const SLOGAN = 'Semplice, moderna, per tutti.';
const SLOGAN_SUBTITLE =
  'La piattaforma digitale che unisce condòmini, portieri e amministratori in una gestione trasparente, chiara e a norma di legge.';

const HIGHLIGHTS = [
  {
    icon: 'shield-check' as const,
    text: 'A norma di legge e privacy ex art. 1130 c.c.',
  },
  {
    icon: 'smartphone' as const,
    text: '100% Mobile-first, accessibile da qualsiasi dispositivo',
  },
  {
    icon: 'clock' as const,
    text: 'Bacheca, comunicazioni e spese disponibili h24',
  },
];

/**
 * Cornice della schermata di accesso coordinata con la nuova Landing Page.
 * - Da 1200 px in su: a sinistra il pannello navy istituzionale con logo, slogan e punti di forza;
 *   a destra lo sfondo freddo con pulsante di ritorno e form racchiuso in una card elegante.
 * - Sotto i 1200 px: barra superiore navy ordinata con logo, tasto di ritorno alla presentazione,
 *   e form centrato e ben spaziato.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isDesktop, isMobile, breakpoint } = useBreakpoint();

  return (
    <View style={[styles.root, isDesktop && styles.rootDesktop]}>
      {/* PANNELLO SINISTRO (Solo Desktop >= 1200px) */}
      {isDesktop ? (
        <View style={styles.panel}>
          <View style={styles.panelTop}>
            <BrandMark large />
          </View>

          <View style={styles.panelCenter}>
            <View style={styles.slogan}>
              <Text style={[textStyle('h1', breakpoint), styles.sloganText]}>{SLOGAN}</Text>
              <View aria-hidden style={styles.sloganRule} />
              <Text style={[textStyle('body', breakpoint), styles.sloganSubtitle]}>
                {SLOGAN_SUBTITLE}
              </Text>
            </View>

            <View style={styles.highlightsContainer}>
              {HIGHLIGHTS.map((item) => (
                <View key={item.text} style={styles.highlightPill}>
                  <View style={styles.highlightIcon}>
                    <Icon name={item.icon} size="action" color={colors.brand.teal} />
                  </View>
                  <Text style={[textStyle('secondary', breakpoint), styles.highlightText]}>
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panelBottom}>
            <Text style={[textStyle('support', breakpoint), styles.panelLegal]}>
              ioCondo · Software condominiale certificato WCAG 2.2 AA
            </Text>
          </View>
        </View>
      ) : (
        /* BARRA SUPERIORE (Tablet e Smartphone < 1200px) */
        <View style={styles.bar}>
          <BrandMark compact={isMobile} noTagline />
          <BarReturnLink isMobile={isMobile} onPress={() => router.push('/')} />
        </View>
      )}

      {/* AREA MODULO DESTRA (Desktop) O CENTRALE (Mobile/Tablet) */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          {/* Pulsante di ritorno visibile sopra la card su desktop */}
          {isDesktop && (
            <View style={styles.backRowDesktop}>
              <Button
                variant="text"
                label="Torna alla presentazione"
                icon="arrow-left"
                onPress={() => router.push('/')}
                accessibilityHint="Torna alla Landing Page di presentazione"
              />
            </View>
          )}

          {/* Card elegante bianca con bordo e angoli arrotondati */}
          <View style={[styles.card, isMobile && styles.cardMobile]}>
            {children}
          </View>

          {/* Footer istituzionale */}
          <View role="contentinfo" style={styles.footer}>
            <Text style={[textStyle('secondary', breakpoint), styles.footerText]}>
              Privacy (in arrivo)
            </Text>
            <Text style={[textStyle('secondary', breakpoint), styles.footerBullet]}>•</Text>
            <Text style={[textStyle('secondary', breakpoint), styles.footerText]}>
              Assistenza (in arrivo)
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  rootDesktop: {
    flexDirection: 'row',
  },
  panel: {
    width: 480,
    maxWidth: '40%',
    backgroundColor: colors.brand.navy,
    justifyContent: 'space-between',
    padding: space[10],
  },
  panelTop: {
    alignItems: 'flex-start',
  },
  panelCenter: {
    gap: space[8],
  },
  panelBottom: {
    paddingTop: space[4],
  },
  panelLegal: {
    color: colors.tile.navy.background,
  },
  slogan: {
    gap: space[4],
  },
  sloganText: {
    color: colors.text.inverse,
  },
  sloganRule: {
    width: space[12],
    height: feedbackSizes.alertAccent,
    borderRadius: radii.full,
    backgroundColor: colors.brand.teal,
  },
  sloganSubtitle: {
    color: colors.tile.navy.background,
    lineHeight: 22,
  },
  highlightsContainer: {
    gap: space[3],
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: borderWidths.thin,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radii.control,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  highlightIcon: {
    width: space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: {
    flex: 1,
    color: colors.text.inverse,
  },
  bar: {
    backgroundColor: colors.brand.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
    paddingVertical: space[8],
  },
  formContainer: {
    width: '100%',
    maxWidth: layout.formMaxWidth,
    gap: space[5],
  },
  backRowDesktop: {
    alignSelf: 'flex-start',
    marginLeft: -space[3],
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: space[8],
    gap: space[6],
    shadowColor: shadows.card.color,
    shadowOffset: { width: 0, height: shadows.card.offsetY },
    shadowOpacity: shadows.card.opacity,
    shadowRadius: shadows.card.blur,
    elevation: shadows.card.elevation,
  },
  cardMobile: {
    padding: space[6],
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[3],
  },
  footerText: {
    color: colors.text.muted,
  },
  footerBullet: {
    color: colors.text.muted,
  },
  barButton: {
    minHeight: touchTarget.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.control,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: borderWidths.thin,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      web: { outlineStyle: 'none' } as unknown as ViewStyle,
      default: {},
    }),
  },
  barButtonHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  barButtonText: {
    color: colors.text.inverse,
  },
  barButtonTextHovered: {
    color: colors.tile.teal.background,
  },
});

function BarReturnLink({ isMobile, onPress }: { isMobile: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { breakpoint } = useBreakpoint();

  return (
    <Pressable
      accessible
      role="link"
      accessibilityRole="link"
      aria-label="Torna alla presentazione di ioCondo"
      accessibilityLabel="Torna alla presentazione di ioCondo"
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.barButton,
        hovered && styles.barButtonHovered,
        focused && focusRing,
      ]}
    >
      <Icon
        name="arrow-left"
        size="action"
        color={hovered ? colors.tile.teal.background : colors.text.inverse}
      />
      <Text
        style={[
          textStyle('button', breakpoint),
          styles.barButtonText,
          hovered && styles.barButtonTextHovered,
        ]}
      >
        {isMobile ? 'Presentazione' : 'Torna alla presentazione'}
      </Text>
    </Pressable>
  );
}
