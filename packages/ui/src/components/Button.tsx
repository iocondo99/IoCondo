import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../Icon';
import {
  borderWidths,
  colors,
  iconSizes,
  radii,
  space,
  touchTarget,
} from '../tokens';
import { cursorStyle, focusStyle, useColorTransition, useTextStyle, type PressState, type ViewRef } from './internal';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';

export interface ButtonProps {
  /** Testo del pulsante: deve dire cosa succede (es. "Salva modifiche"). */
  label: string;
  onPress?: () => void | Promise<unknown>;
  variant?: ButtonVariant;
  /** Mostra l'indicatore e blocca altri invii. */
  loading?: boolean;
  /** Testo durante il caricamento (es. "Invio in corso…"). Se manca resta `label`. */
  loadingLabel?: string;
  disabled?: boolean;
  icon?: IconName;
  /** Da che parte del testo sta l'icona (es. "Vedi tutte →" usa `end`). */
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  accessibilityHint?: string;
  /** Riferimento al pulsante, per spostare il focus (es. in una finestra di conferma). */
  buttonRef?: React.Ref<ViewRef>;
  /** Il pulsante apre un menu: segnala `aria-haspopup` e `aria-expanded` agli screen reader. */
  popup?: 'menu';
  expanded?: boolean;
}

interface Palette {
  background: string;
  border: string;
  text: string;
}

function paletteFor(
  variant: ButtonVariant,
  state: { hovered: boolean; pressed: boolean; disabled: boolean },
): Palette {
  const { hovered, pressed, disabled } = state;
  if (disabled) {
    if (variant === 'text') {
      return { background: 'transparent', border: 'transparent', text: colors.text.muted };
    }
    return {
      background: variant === 'secondary' ? colors.surface : colors.border,
      border: colors.border,
      text: colors.text.muted,
    };
  }
  switch (variant) {
    case 'primary': {
      const bg = pressed
        ? colors.action.pressed
        : hovered
          ? colors.action.hover
          : colors.action.default;
      return { background: bg, border: bg, text: colors.text.inverse };
    }
    case 'secondary':
      return {
        background: pressed ? colors.border : hovered ? colors.background : colors.surface,
        border: colors.borderStrong,
        text: colors.brand.navy,
      };
    case 'text':
      return {
        background: pressed
          ? colors.border
          : hovered
            ? colors.semantic.info.background
            : 'transparent',
        border: 'transparent',
        text: pressed ? colors.action.pressed : colors.action.default,
      };
    case 'destructive': {
      const bg = pressed
        ? colors.destructive.pressed
        : hovered
          ? colors.destructive.hover
          : colors.destructive.default;
      return { background: bg, border: bg, text: colors.text.inverse };
    }
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  loadingLabel,
  disabled = false,
  icon,
  iconPosition = 'start',
  fullWidth = false,
  accessibilityHint,
  buttonRef,
  popup,
  expanded = false,
}: ButtonProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [pending, setPending] = useState(false);
  // Il lock sul ref impedisce il doppio invio anche prima del re-render.
  const locked = useRef(false);
  const transition = useColorTransition();
  const textStyle = useTextStyle('button');

  const busy = loading || pending;
  const shownLabel = busy && loadingLabel ? loadingLabel : label;

  const handlePress = () => {
    if (disabled || busy || locked.current || !onPress) return;
    locked.current = true;
    let result: void | Promise<unknown>;
    try {
      result = onPress();
    } catch (error) {
      locked.current = false;
      throw error;
    }
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setPending(true);
      const release = () => {
        locked.current = false;
        setPending(false);
      };
      (result as Promise<unknown>).then(release, release);
    } else {
      locked.current = false;
    }
  };

  return (
    <Pressable
      ref={buttonRef}
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || busy, busy }}
      aria-disabled={disabled || busy}
      aria-busy={busy}
      aria-haspopup={popup}
      aria-expanded={popup ? expanded : undefined}
      disabled={disabled}
      onPress={handlePress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ hovered, pressed, focused }: PressState) => {
        const p = paletteFor(variant, { hovered: !!hovered, pressed, disabled });
        const style: ViewStyle[] = [
          styles.base,
          fullWidth ? styles.fullWidth : styles.auto,
          { backgroundColor: p.background, borderColor: p.border },
        ];
        if (transition) style.push(transition);
        const cursor = cursorStyle(disabled);
        if (cursor) style.push(cursor);
        const ring = focusStyle(isFocused || !!focused);
        if (ring) style.push(ring);
        return style;
      }}
    >
      {({ hovered, pressed }: PressState) => {
        const p = paletteFor(variant, { hovered: !!hovered, pressed, disabled });
        return (
          <View style={styles.content}>
            {busy ? (
              <View aria-hidden>
                <ActivityIndicator size="small" color={p.text} />
              </View>
            ) : icon && iconPosition === 'start' ? (
              <Icon name={icon} size="action" color={p.text} />
            ) : null}
            <Text style={[textStyle, styles.label, { color: p.text }]}>{shownLabel}</Text>
            {!busy && icon && iconPosition === 'end' ? (
              <Icon name={icon} size="action" color={p.text} />
            ) : null}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.comfortable,
    minWidth: touchTarget.comfortable,
    paddingHorizontal: space[5],
    paddingVertical: space[2],
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auto: { alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: iconSizes.action,
  },
  label: { textAlign: 'center', flexShrink: 1 },
});
