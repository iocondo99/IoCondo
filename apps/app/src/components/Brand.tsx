import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  colors,
  controlSizes,
  dataSizes,
  feedbackSizes,
  radii,
  space,
} from '@iocondo/ui';
import ioCondoLogo from '../images/ioCondoLogo.png';

export const BRAND_NAME = 'ioCondo';

interface BrandMarkProps {
  /** `dark`: su sfondo navy. `light`: su sfondo chiaro. */
  tone?: 'dark' | 'light';
  large?: boolean;
  /** Solo la tessera con l'icona (sidebar compressa). */
  compact?: boolean;
  /** Prop mantenuta per compatibilità con Header/Sidebar. */
  noTagline?: boolean;
}

export function BrandMark({
  large = false,
  compact = false,
  noTagline = false,
}: BrandMarkProps) {
  return (
    <View
      accessible
      role="img"
      aria-label={BRAND_NAME}
      accessibilityLabel={BRAND_NAME}
      style={styles.brand}
    >
      {compact ? (
        <View style={styles.compactContainer}>
          <Image
            source={ioCondoLogo}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            style={styles.logoCompactCrop}
          />
        </View>
      ) : (
        <View style={styles.fullContainer}>
          <Image
            source={ioCondoLogo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            style={[
              styles.logo,
              large ? styles.logoLarge : noTagline ? styles.logoHeader : styles.logoRegular,
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullContainer: {
    flexShrink: 1,
  },
  logo: {
    borderRadius: radii.control,
    backgroundColor: colors.brand.navy,
  },
  logoRegular: {
    width: controlSizes.menuMinWidth - space[8],
    height: feedbackSizes.tile,
  },
  logoHeader: {
    width: dataSizes.columnMinWidth + space[5],
    height: space[10],
  },
  logoLarge: {
    width: controlSizes.menuMinWidth,
    height: dataSizes.rowMinHeight,
  },
  compactContainer: {
    width: space[10],
    height: space[10],
    flexShrink: 0,
    borderRadius: radii.control,
    backgroundColor: colors.brand.navy,
    overflow: 'hidden',
  },
  logoCompactCrop: {
    width: dataSizes.columnMinWidth + space[5],
    height: space[10],
  },
});
