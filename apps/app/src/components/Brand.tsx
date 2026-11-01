import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, colors, radii, space, textStyle, useBreakpoint } from '@iocondo/ui';

/** Nome e logo sono segnaposto: il logo definitivo arriverà dopo. */
export const BRAND_NAME = 'Tu';
const TAGLINE = 'La tua casa, più semplice';

interface BrandMarkProps {
  /** `dark`: su sfondo navy (tessera bianca, testo bianco). `light`: su sfondo chiaro (tessera navy, testo navy). */
  tone?: 'dark' | 'light';
  large?: boolean;
  /** Solo la tessera con l'icona (sidebar compressa). */
  compact?: boolean;
  /** Senza slogan sotto il nome. */
  noTagline?: boolean;
}

export function BrandMark({ tone = 'dark', large = false, compact = false, noTagline = false }: BrandMarkProps) {
  const { breakpoint } = useBreakpoint();
  const dark = tone === 'dark';
  return (
    <View accessible role="img" aria-label={`${BRAND_NAME}, ${TAGLINE.toLowerCase()}`} style={styles.brand}>
      <View style={[styles.mark, { backgroundColor: dark ? colors.surface : colors.brand.navy }]}>
        <Icon name="building-2" size="card" color={dark ? colors.brand.navy : colors.text.inverse} />
      </View>
      {compact ? null : (
        <View style={styles.text}>
          <Text style={[textStyle(large ? 'h2' : 'h3', breakpoint), { color: dark ? colors.text.inverse : colors.brand.navy }]}>
            {BRAND_NAME}
          </Text>
          {noTagline ? null : (
            <Text style={[textStyle('secondary', breakpoint), { color: dark ? colors.tile.navy.background : colors.text.secondary }]}>
              {TAGLINE}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  mark: {
    width: space[10],
    height: space[10],
    flexShrink: 0,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flexShrink: 1 },
});
