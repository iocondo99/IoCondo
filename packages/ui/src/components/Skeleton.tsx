import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View, type DimensionValue } from 'react-native';
import { useReducedMotion } from '../accessibility';
import { colors, feedbackSizes, radii, skeletonPulseDuration, space } from '../tokens';

export interface SkeletonProps {
  /** `line` per il testo, `block` per immagini e schede, `circle` per gli avatar. */
  shape?: 'line' | 'block' | 'circle';
  width?: DimensionValue;
  height?: number;
}

/** Segnaposto grigio durante il caricamento. Con "riduci animazioni" resta fermo. */
export function Skeleton({ shape = 'line', width = '100%', height }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: skeletonPulseDuration,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: skeletonPulseDuration,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, opacity]);

  const size = height ?? (shape === 'line' ? feedbackSizes.skeletonLine : feedbackSizes.skeletonBlock);
  return (
    <Animated.View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        {
          opacity,
          width: shape === 'circle' ? size : width,
          height: size,
          borderRadius: shape === 'circle' ? radii.full : shape === 'line' ? radii.badge : radii.card,
        },
      ]}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
}

/** Più righe di testo segnaposto; l'ultima è più corta, come un paragrafo vero. */
export function SkeletonText({ lines = 3 }: SkeletonTextProps) {
  return (
    <View style={styles.text}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 && lines > 1 ? '60%' : '100%'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.border },
  text: { gap: space[2], width: '100%' },
});
