import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { Icon } from '../Icon';
import { borderWidths, colors, radii, space, touchTarget } from '../tokens';
import { IconButton } from './IconButton';
import { focusElement, focusStyle, useColorTransition, useTextStyle } from './internal';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Invio (tastiera fisica o tasto "Cerca" della tastiera del telefono). */
  onSubmit?: (text: string) => void;
  /** Nome accessibile del campo. */
  label?: string;
  placeholder?: string;
  /** Mostra l'etichetta sopra il campo (nell'header resta solo il nome accessibile). */
  showLabel?: boolean;
  /** Versione per l'header: più bassa (44 px). */
  compact?: boolean;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  label = 'Cerca',
  placeholder = 'Cerca documenti, spese, comunicazioni…',
  showLabel = false,
  compact = false,
  disabled = false,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const transition = useColorTransition();
  const labelStyle = useTextStyle('label');
  const inputStyle = useTextStyle('body');

  const containerStyle: ViewStyle[] = [
    styles.container,
    {
      minHeight: compact ? touchTarget.control : touchTarget.comfortable,
      borderColor: focused ? colors.focus : colors.borderStrong,
      backgroundColor: disabled ? colors.background : colors.surface,
    },
  ];
  if (transition) containerStyle.push(transition);
  const ring = focusStyle(focused);
  if (ring && Platform.OS === 'web') containerStyle.push(ring);

  // Su web il contorno lo disegna il contenitore, non il campo.
  const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : undefined) as TextStyle | undefined;

  const clear = () => {
    onChangeText('');
    focusElement(inputRef.current);
  };

  return (
    <View accessibilityRole="search" style={styles.root}>
      {showLabel ? (
        <Text style={[labelStyle, { color: colors.text.primary }]} onPress={() => focusElement(inputRef.current)}>
          {label}
        </Text>
      ) : null}
      <View style={containerStyle}>
        <Icon name="search" size="action" color={disabled ? colors.text.muted : colors.text.secondary} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={() => onSubmit?.(value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.text.muted}
          editable={!disabled}
          returnKeyType="search"
          inputMode="search"
          autoCapitalize="none"
          autoCorrect={false}
          role="searchbox"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          aria-disabled={disabled}
          style={[inputStyle, styles.input, noOutline, { color: disabled ? colors.text.muted : colors.text.primary }]}
        />
        {value.length > 0 && !disabled ? (
          <IconButton icon="x" compact accessibilityLabel="Cancella la ricerca" onPress={clear} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: space[2] },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[3],
    borderWidth: borderWidths.thin,
    borderRadius: radii.control,
  },
  input: { flex: 1, minWidth: 0, paddingVertical: space[2], paddingRight: space[3] },
});
