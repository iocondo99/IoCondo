import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radii, space, touchTarget } from '../tokens';
import {
  cursorStyle,
  focusStyle,
  keyboardProps,
  keyOf,
  useColorTransition,
  useTextStyle,
  type KeyEventLike,
  type PressState,
} from './internal';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  error?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  helperText,
  disabled = false,
  error,
  accessibilityLabel,
  accessibilityHint,
}: SwitchProps) {
  const labelStyle = useTextStyle('body');
  const supportStyle = useTextStyle('secondary');
  const transition = useColorTransition();
  const message = error ?? helperText;
  const a11yLabel = accessibilityLabel ?? label ?? (checked ? 'Attivo' : 'Disattivato');

  const onKeyDown = (event: KeyEventLike) => {
    const key = keyOf(event);
    if (key === ' ' || key === 'Enter') {
      event.preventDefault?.();
      if (!disabled) {
        onChange(!checked);
      }
    }
  };

  const renderControl = (focused: boolean, hovered: boolean) => {
    const ring = focusStyle(focused);
    const trackColor = disabled
      ? checked
        ? colors.borderStrong
        : colors.border
      : checked
        ? hovered
          ? colors.action.hover
          : colors.action.default
        : hovered
          ? colors.text.muted
          : colors.borderStrong;

    const trackStyle: ViewStyle[] = [
      styles.track,
      {
        backgroundColor: trackColor,
        borderColor: trackColor,
      },
    ];
    if (transition) trackStyle.push(transition);
    if (ring) trackStyle.push(ring);

    const thumbStyle: ViewStyle[] = [
      styles.thumb,
      checked ? styles.thumbChecked : styles.thumbUnchecked,
      {
        backgroundColor: disabled && !checked ? colors.text.disabled : colors.surface,
      },
    ];

    return (
      <View style={trackStyle}>
        <View style={thumbStyle} />
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={a11yLabel}
        accessibilityHint={accessibilityHint ?? message}
        accessibilityState={{ checked, disabled }}
        aria-checked={checked}
        aria-disabled={disabled}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        style={[styles.pressableRow, cursorStyle(disabled)]}
        {...keyboardProps(onKeyDown)}
      >
        {({ focused, hovered }: PressState) => (
          <>
            <View style={styles.controlTouchZone}>{renderControl(!!focused, !!hovered)}</View>
            {label ? (
              <Text
                style={[
                  labelStyle,
                  styles.label,
                  { color: disabled ? colors.text.muted : colors.text.primary },
                ]}
              >
                {label}
              </Text>
            ) : null}
          </>
        )}
      </Pressable>
      {message ? (
        <Text
          role={error ? 'alert' : undefined}
          style={[
            supportStyle,
            styles.message,
            { color: error ? colors.semantic.error.foreground : colors.text.secondary },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },
  pressableRow: {
    minHeight: touchTarget.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  controlTouchZone: {
    width: touchTarget.control,
    height: touchTarget.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: 44,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: radii.full,
    position: 'absolute',
    top: 2,
  },
  thumbUnchecked: {
    left: 2,
  },
  thumbChecked: {
    left: 22,
  },
  label: {
    flexShrink: 1,
  },
  message: {
    marginTop: space[1],
    marginLeft: touchTarget.control + space[3],
  },
});
