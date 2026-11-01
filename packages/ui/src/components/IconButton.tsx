import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { borderWidths, colors, radii, touchTarget } from '../tokens';
import { cursorStyle, focusStyle, useColorTransition, type PressState, type ViewRef } from './internal';

export type IconButtonVariant = 'ghost' | 'secondary';

export interface IconButtonProps {
  icon: IconName;
  /** Obbligatorio: un pulsante di sola icona senza nome non è utilizzabile con lo screen reader. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  disabled?: boolean;
  /** Per i pulsanti che si accendono e si spengono. */
  selected?: boolean;
  /** 44 px invece di 48: per barre compatte, come la ricerca nell'header. */
  compact?: boolean;
  /** Riferimento al pulsante, per riportare il focus (es. dopo la chiusura di un menu). */
  buttonRef?: React.Ref<ViewRef>;
  /** Il pulsante apre un menu: segnala `aria-haspopup` e `aria-expanded`. */
  popup?: 'menu';
  expanded?: boolean;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'ghost',
  disabled = false,
  selected,
  compact = false,
  buttonRef,
  popup,
  expanded = false,
}: IconButtonProps) {
  const transition = useColorTransition();
  return (
    <Pressable
      ref={buttonRef}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      aria-disabled={disabled}
      aria-pressed={selected}
      aria-haspopup={popup}
      aria-expanded={popup ? expanded : undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed, focused }: PressState) => {
        const style: ViewStyle[] = [
          styles.base,
          ...(compact ? [styles.compact] : []),
          {
            backgroundColor: pressed
              ? colors.border
              : hovered
                ? colors.background
                : variant === 'secondary'
                  ? colors.surface
                  : 'transparent',
            borderColor: variant === 'secondary' ? colors.borderStrong : 'transparent',
          },
        ];
        if (transition) style.push(transition);
        const cursor = cursorStyle(disabled);
        if (cursor) style.push(cursor);
        const ring = focusStyle(!!focused);
        if (ring) style.push(ring);
        return style;
      }}
    >
      <Icon name={icon} size="action" color={disabled ? colors.text.muted : colors.brand.navy} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: { width: touchTarget.control, height: touchTarget.control },
  base: {
    width: touchTarget.comfortable,
    height: touchTarget.comfortable,
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
