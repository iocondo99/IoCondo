import type { ElementRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  type Text,
  type TextStyle,
  type View,
  type ViewStyle,
} from 'react-native';
import { focusRing, useAnimationDurations } from '../accessibility';
import { textStyle } from '../styles';
import { colors, dataSizes, focusRingSize, type TextVariant } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';

/** Tipi dei riferimenti a View e Text (in React Native 0.88 `View` come tipo non basta). */
export type ViewRef = ElementRef<typeof View>;
export type TextRef = ElementRef<typeof Text>;

/** Focus visibile: outline su web, colore del bordo su nativo (i controlli hanno sempre un bordo). */
export function focusStyle(focused: boolean): ViewStyle | undefined {
  if (!focused) return undefined;
  return Platform.OS === 'web' ? focusRing : { borderColor: colors.focus };
}

/**
 * Focus visibile per elementi dentro un contenitore che ritaglia (overflow nascosto):
 * l'anello sta dentro il bordo dell'elemento invece di uscirne.
 */
export function insetFocusStyle(focused: boolean): ViewStyle | undefined {
  if (!focused) return undefined;
  if (Platform.OS !== 'web') return { borderColor: colors.focus };
  return { ...focusRing, outlineOffset: -focusRingSize.width } as ViewStyle;
}

/** Transizione breve dei colori (sez. 18). Solo web; 0 ms con "riduci animazioni". */
export function useColorTransition(): ViewStyle | undefined {
  const { fast } = useAnimationDurations();
  if (Platform.OS !== 'web') return undefined;
  return {
    transitionProperty: 'background-color, border-color, opacity',
    transitionDuration: `${fast}ms`,
  } as ViewStyle;
}

/** Stile di testo del design system per la variante data, con dimensioni compatte su smartphone. */
export function useTextStyle(variant: TextVariant): TextStyle {
  const { breakpoint } = useBreakpoint();
  return textStyle(variant, breakpoint);
}

/** Cursore del puntatore (solo web). */
export function cursorStyle(disabled: boolean): ViewStyle | undefined {
  if (Platform.OS !== 'web') return undefined;
  return { cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle;
}

/** Evento tastiera minimo, come lo emette react-native-web. */
export interface KeyEventLike {
  nativeEvent?: { key?: string };
  key?: string;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export function keyOf(event: KeyEventLike): string | undefined {
  return event.nativeEvent?.key ?? event.key;
}

/** Props di tastiera accettate solo da react-native-web: su nativo vengono ignorate. */
export function keyboardProps(onKeyDown: (event: KeyEventLike) => void): object {
  return { onKeyDown };
}

/** Sposta il focus su un elemento (solo dove esiste `focus`, cioè su web). */
export function focusElement(element: unknown): void {
  (element as { focus?: () => void } | null)?.focus?.();
}

/** Porta il focus su un elemento: tastiera su web, cursore dello screen reader su nativo. */
export function moveFocusTo(element: unknown): void {
  if (!element) return;
  if (Platform.OS === 'web') {
    focusElement(element);
    return;
  }
  const tag = findNodeHandle(element as Parameters<typeof findNodeHandle>[0]);
  if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
}

/** Stato di interazione di Pressable (react-native-web aggiunge hovered e focused). */
export interface PressState {
  hovered?: boolean;
  focused?: boolean;
  pressed: boolean;
}

/** Testo letto dagli screen reader ma non visibile (annunci di stato, nomi di colonne senza intestazione). */
export const visuallyHidden: ViewStyle = {
  position: 'absolute',
  width: dataSizes.visuallyHidden,
  height: dataSizes.visuallyHidden,
  overflow: 'hidden',
  opacity: 0,
};

/**
 * Su web un clic o Invio su un controllo dentro una riga selezionabile (es. il menu "Altre azioni")
 * risale fino alla riga: la riga deve ignorarlo. Su nativo ogni Pressable è già isolato.
 */
export function isFromNestedControl(event: unknown): boolean {
  const { target, currentTarget } = (event ?? {}) as { target?: unknown; currentTarget?: unknown };
  if (!target || !currentTarget || target === currentTarget) return false;
  const node = target as { closest?: (selector: string) => unknown };
  const control = node.closest?.('[role="button"], [role="menuitem"], a, button, input');
  return Boolean(control) && control !== currentTarget;
}
