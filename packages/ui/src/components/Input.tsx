import React, { useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Icon } from '../Icon';
import { borderWidths, colors, radii, space, touchTarget } from '../tokens';
import { IconButton } from './IconButton';
import { focusElement, focusStyle, useColorTransition, useTextStyle } from './internal';

export interface FieldProps
  extends Pick<
    TextInputProps,
    | 'value'
    | 'onChangeText'
    | 'onBlur'
    | 'placeholder'
    | 'keyboardType'
    | 'autoCapitalize'
    | 'autoComplete'
    | 'autoCorrect'
    | 'returnKeyType'
    | 'onSubmitEditing'
    | 'maxLength'
  > {
  /** Sempre visibile: il placeholder non sostituisce mai l'etichetta. */
  label: string;
  helperText?: string;
  /** Messaggio di errore: mostra bordo, icona e testo. */
  error?: string;
  /** Messaggio di conferma (stato successo). */
  success?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface InputProps extends FieldProps {
  /** `password` aggiunge il pulsante "Mostra password". */
  variant?: 'text' | 'password';
}

interface BaseFieldProps extends FieldProps {
  multiline?: boolean;
  minHeight?: number;
  secureTextEntry?: boolean;
  trailing?: React.ReactNode;
}

export function BaseField({
  label,
  helperText,
  error,
  success,
  required,
  disabled = false,
  multiline = false,
  minHeight = touchTarget.comfortable,
  secureTextEntry,
  trailing,
  onBlur,
  ...inputProps
}: BaseFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const transition = useColorTransition();
  const labelStyle = useTextStyle('label');
  const inputStyle = useTextStyle('body');
  const supportStyle = useTextStyle('secondary');

  const message = error ?? success ?? helperText;
  const borderColor = error
    ? colors.semantic.error.foreground
    : focused
      ? colors.focus
      : success
        ? colors.semantic.success.foreground
        : colors.borderStrong;

  const containerStyle: ViewStyle[] = [
    styles.container,
    {
      minHeight,
      borderColor,
      backgroundColor: disabled ? colors.background : colors.surface,
      alignItems: multiline ? 'flex-start' : 'center',
    },
  ];
  if (transition) containerStyle.push(transition);
  const ring = focusStyle(focused);
  if (ring && Platform.OS === 'web') containerStyle.push(ring);

  // Su web TextInput ha il proprio outline: il contorno lo disegna il contenitore.
  const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : undefined) as
    | TextStyle
    | undefined;

  return (
    <View style={styles.field}>
      <Text style={[labelStyle, styles.label]} onPress={() => focusElement(inputRef.current)}>
        {label}
        {required ? <Text style={styles.required}> (obbligatorio)</Text> : null}
      </Text>
      <View style={containerStyle}>
        <TextInput
          {...inputProps}
          ref={inputRef}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityLabel={label}
          accessibilityHint={message}
          accessibilityState={{ disabled }}
          aria-disabled={disabled}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          placeholderTextColor={colors.text.muted}
          style={[
            inputStyle,
            styles.input,
            noOutline,
            { color: disabled ? colors.text.muted : colors.text.primary },
            multiline ? styles.multiline : null,
          ]}
        />
        {trailing}
      </View>
      {message ? (
        <View
          style={styles.message}
          role={error ? 'alert' : undefined}
          accessibilityLiveRegion={error || success ? 'polite' : 'none'}
        >
          {error ? (
            <Icon name="circle-alert" size="indicator" color={colors.semantic.error.foreground} />
          ) : success ? (
            <Icon name="circle-check" size="indicator" color={colors.semantic.success.foreground} />
          ) : null}
          <Text
            style={[
              supportStyle,
              styles.messageText,
              {
                color: error
                  ? colors.semantic.error.foreground
                  : success
                    ? colors.semantic.success.foreground
                    : colors.text.secondary,
              },
            ]}
          >
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function Input({ variant = 'text', ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  if (variant === 'password') {
    return (
      <BaseField
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        secureTextEntry={!visible}
        trailing={
          <IconButton
            icon={visible ? 'eye-off' : 'eye'}
            accessibilityLabel={visible ? 'Nascondi password' : 'Mostra password'}
            selected={visible}
            disabled={props.disabled}
            onPress={() => setVisible((value) => !value)}
          />
        }
      />
    );
  }
  return <BaseField {...props} />;
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch', gap: space[2] },
  label: { color: colors.text.primary },
  required: { color: colors.text.secondary },
  container: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderWidth: borderWidths.thin,
    borderRadius: radii.control,
    paddingLeft: space[3],
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: space[3],
    paddingRight: space[3],
  },
  multiline: { textAlignVertical: 'top' },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  messageText: { flex: 1 },
});
