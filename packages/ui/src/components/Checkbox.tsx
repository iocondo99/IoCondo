import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon } from '../Icon';
import { borderWidths, colors, controlSizes, radii, space, touchTarget } from '../tokens';
import { cursorStyle, focusStyle, useColorTransition, useTextStyle, type PressState } from './internal';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  helperText?: string;
  disabled?: boolean;
  error?: string;
}

/** Casella grafica condivisa da Checkbox e Radio. */
export interface ChoiceMarkProps {
  checked: boolean;
  disabled: boolean;
  invalid: boolean;
  focused: boolean;
  hovered: boolean;
  shape: 'square' | 'circle';
}

export function ChoiceMark({ checked, disabled, invalid, focused, hovered, shape }: ChoiceMarkProps) {
  const transition = useColorTransition();
  const active = checked && !disabled;
  const style: ViewStyle[] = [
    styles.mark,
    { borderRadius: shape === 'circle' ? radii.full : radii.badge },
    {
      backgroundColor: disabled
        ? colors.border
        : shape === 'square' && checked
          ? colors.action.default
          : colors.surface,
      borderColor: disabled
        ? colors.borderStrong
        : invalid
          ? colors.semantic.error.foreground
          : checked
            ? colors.action.default
            : hovered
              ? colors.action.default
              : colors.text.muted,
    },
  ];
  if (transition) style.push(transition);
  const ring = focusStyle(focused);
  if (ring) style.push(ring);

  return (
    <View style={style}>
      {shape === 'square' && checked ? (
        <Icon name="check" size="indicator" color={disabled ? colors.text.muted : colors.text.inverse} />
      ) : null}
      {shape === 'circle' && active ? <View style={styles.dot} /> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, label, helperText, disabled = false, error }: CheckboxProps) {
  const labelStyle = useTextStyle('body');
  const supportStyle = useTextStyle('secondary');
  const message = error ?? helperText;

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityHint={message}
        accessibilityState={{ checked, disabled }}
        aria-checked={checked}
        aria-disabled={disabled}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        style={[styles.row, cursorStyle(disabled)]}
      >
        {({ focused, hovered }: PressState) => (
          <>
            <ChoiceMark
              checked={checked}
              disabled={disabled}
              invalid={!!error}
              focused={!!focused}
              hovered={!!hovered}
              shape="square"
            />
            <Text style={[labelStyle, styles.label, { color: disabled ? colors.text.muted : colors.text.primary }]}>
              {label}
            </Text>
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
  wrapper: { alignSelf: 'stretch' },
  row: {
    minHeight: touchTarget.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  mark: {
    width: controlSizes.choice,
    height: controlSizes.choice,
    borderWidth: borderWidths.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: controlSizes.choice / 2,
    height: controlSizes.choice / 2,
    borderRadius: radii.full,
    backgroundColor: colors.action.default,
  },
  label: { flex: 1 },
  message: { paddingLeft: controlSizes.choice + space[3] },
});
