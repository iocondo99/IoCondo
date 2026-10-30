import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import {
  shadows,
  typography,
  type Breakpoint,
  type FontWeightName,
  type TextVariant,
} from './tokens';

/**
 * Nome della famiglia Inter per un peso. Su nativo il peso è parte del nome
 * (Inter_600SemiBold); su web si aggiunge il fallback di sistema, che resta
 * attivo finché il font non è stato scaricato.
 */
export function resolveFontFamily(weight: FontWeightName): string {
  const family = typography.fontFamily[weight];
  return Platform.OS === 'web' ? `${family}, ${typography.webFallbackStack}` : family;
}

/** Stile di testo di una variante tipografica. Su smartphone usa le dimensioni compatte. */
export function textStyle(variant: TextVariant, breakpoint: Breakpoint = 'desktop'): TextStyle {
  const spec = typography.variants[variant];
  const fontSize = breakpoint === 'mobile' ? spec.fontSize.compact : spec.fontSize.regular;
  return {
    fontFamily: resolveFontFamily(spec.weight),
    fontSize,
    lineHeight: Math.round(fontSize * spec.lineHeightRatio),
  };
}

/** Ombra leggera: proprietà iOS, `elevation` su Android; react-native-web le converte in box-shadow. */
export function shadowStyle(name: keyof typeof shadows): ViewStyle {
  const spec = shadows[name];
  return {
    shadowColor: spec.color,
    shadowOffset: { width: 0, height: spec.offsetY },
    shadowOpacity: spec.opacity,
    shadowRadius: spec.blur,
    elevation: spec.elevation,
  };
}
