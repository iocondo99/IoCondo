import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, touchTarget } from '../tokens';
import { ChoiceMark } from './Checkbox';
import {
  cursorStyle,
  focusElement,
  keyboardProps,
  keyOf,
  useTextStyle,
  type KeyEventLike,
  type PressState,
} from './internal';

export interface RadioOption {
  value: string;
  label: string;
  helperText?: string;
  disabled?: boolean;
}

export interface RadioProps {
  label: string;
  helperText?: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Con `-1` il radio esce dall'ordine di Tab (si raggiunge con le frecce del gruppo). */
  tabIndex?: 0 | -1;
}

export const Radio = React.forwardRef<React.ComponentRef<typeof View>, RadioProps>(function Radio(
  { label, helperText, checked, onSelect, disabled = false, invalid = false, tabIndex },
  ref,
) {
  const labelStyle = useTextStyle('body');
  const supportStyle = useTextStyle('secondary');
  return (
    <Pressable
      ref={ref}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={helperText}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={tabIndex}
      disabled={disabled}
      onPress={onSelect}
      style={[styles.row, cursorStyle(disabled)]}
    >
      {({ focused, hovered }: PressState) => (
        <>
          <ChoiceMark
            checked={checked}
            disabled={disabled}
            invalid={invalid}
            focused={!!focused}
            hovered={!!hovered}
            shape="circle"
          />
          <View style={styles.text}>
            <Text style={[labelStyle, { color: disabled ? colors.text.muted : colors.text.primary }]}>
              {label}
            </Text>
            {helperText ? (
              <Text style={[supportStyle, { color: colors.text.secondary }]}>{helperText}</Text>
            ) : null}
          </View>
        </>
      )}
    </Pressable>
  );
});

export interface RadioGroupProps {
  /** Domanda o titolo del gruppo, letto dallo screen reader. */
  label: string;
  options: readonly RadioOption[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function RadioGroup({ label, options, value, onChange, error, disabled = false }: RadioGroupProps) {
  const labelStyle = useTextStyle('label');
  const supportStyle = useTextStyle('secondary');
  const refs = useRef<Array<React.ComponentRef<typeof View> | null>>([]);

  const enabledIndexes = options
    .map((option, index) => (option.disabled || disabled ? -1 : index))
    .filter((index) => index >= 0);
  const selectedIndex = options.findIndex((option) => option.value === value);
  // Solo un radio è raggiungibile con Tab: quello scelto, o il primo attivo.
  const tabStop =
    selectedIndex >= 0 && enabledIndexes.includes(selectedIndex) ? selectedIndex : enabledIndexes[0];

  const move = (from: number, step: 1 | -1) => {
    if (enabledIndexes.length === 0) return;
    const position = enabledIndexes.indexOf(from);
    const next = enabledIndexes[(position + step + enabledIndexes.length) % enabledIndexes.length];
    const target = next === undefined ? undefined : options[next];
    if (next === undefined || !target) return;
    onChange(target.value);
    focusElement(refs.current[next]);
  };

  const onKeyDown = (index: number) => (event: KeyEventLike) => {
    const key = keyOf(event);
    if (key === 'ArrowDown' || key === 'ArrowRight') {
      event.preventDefault?.();
      move(index, 1);
    } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
      event.preventDefault?.();
      move(index, -1);
    }
  };

  return (
    <View role="radiogroup" accessibilityLabel={label} style={styles.group}>
      <Text style={[labelStyle, { color: colors.text.primary }]}>{label}</Text>
      {options.map((option, index) => (
        <View key={option.value} {...keyboardProps(onKeyDown(index))}>
          <Radio
            ref={(node) => {
              refs.current[index] = node;
            }}
            label={option.label}
            helperText={option.helperText}
            checked={option.value === value}
            disabled={disabled || option.disabled}
            invalid={!!error}
            tabIndex={index === tabStop ? 0 : -1}
            onSelect={() => onChange(option.value)}
          />
        </View>
      ))}
      {error ? (
        <Text role="alert" style={[supportStyle, { color: colors.semantic.error.foreground }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignSelf: 'stretch', gap: space[1] },
  row: {
    minHeight: touchTarget.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  text: { flex: 1, gap: space[1] },
});
