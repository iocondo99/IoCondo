import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon } from '../Icon';
import { borderWidths, colors, controlSizes, focusRingSize, radii, space, touchTarget } from '../tokens';
import {
  cursorStyle,
  focusElement,
  focusStyle,
  keyboardProps,
  keyOf,
  useColorTransition,
  useTextStyle,
  type KeyEventLike,
  type PressState,
} from './internal';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Testo mostrato quando non c'è una scelta. */
  placeholder?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Select senza librerie: un pulsante (combobox) che apre un elenco di opzioni
 * (listbox) subito sotto, nel flusso della pagina. Niente popup flottanti:
 * funziona uguale con tastiera, touch e screen reader, senza portali né z-index.
 * Tastiera (web): Invio/Spazio apre, frecce su/giù si spostano, Home/Fine,
 * Invio sceglie, Esc chiude e riporta il focus sul pulsante.
 *
 * Per poche opzioni (fino a circa 5) usare RadioGroup; Select solo per elenchi più lunghi.
 */
export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Scegli un’opzione',
  helperText,
  error,
  required,
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const triggerRef = useRef<React.ComponentRef<typeof View>>(null);
  const optionRefs = useRef<Array<React.ComponentRef<typeof View> | null>>([]);
  const focusedIndex = useRef(-1);
  // L'Escape che chiude la lista non deve chiudere anche una modale: il Modal ascolta il rilascio del tasto.
  const swallowEscapeKeyUp = useRef(false);

  // Chiusura al clic esterno su web (sez. 10 e 17)
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const triggerNode = triggerRef.current as unknown as HTMLElement | null;
      if (triggerNode && target && !triggerNode.parentElement?.contains(target)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [open]);

  const onFieldKeyUp = (event: KeyEventLike) => {
    if (keyOf(event) === 'Escape' && swallowEscapeKeyUp.current) {
      swallowEscapeKeyUp.current = false;
      event.stopPropagation?.();
    }
  };
  const transition = useColorTransition();
  const labelStyle = useTextStyle('label');
  const bodyStyle = useTextStyle('body');
  const supportStyle = useTextStyle('secondary');

  const selected = options.find((option) => option.value === value);
  const message = error ?? helperText;
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) focusElement(triggerRef.current);
  };

  const choose = (option: SelectOption) => {
    onChange(option.value);
    close(true);
  };

  const focusOption = (index: number | undefined) =>
    focusElement(index === undefined ? null : optionRefs.current[index]);

  const onListKeyDown = (event: KeyEventLike) => {
    const key = keyOf(event);
    const at = enabled.indexOf(focusedIndex.current);
    if (key === 'Escape') {
      event.preventDefault?.();
      swallowEscapeKeyUp.current = true;
      close(true);
    } else if (key === 'ArrowDown') {
      event.preventDefault?.();
      focusOption(enabled[Math.min(at + 1, enabled.length - 1)]);
    } else if (key === 'ArrowUp') {
      event.preventDefault?.();
      focusOption(enabled[Math.max(at - 1, 0)]);
    } else if (key === 'Home') {
      event.preventDefault?.();
      focusOption(enabled[0]);
    } else if (key === 'End') {
      event.preventDefault?.();
      focusOption(enabled[enabled.length - 1]);
    }
  };

  const openList = () => {
    setOpen(true);
    setFocused(true);
    // Dopo il render porta il focus sulla scelta attuale (o sulla prima opzione).
    const start = selected ? options.indexOf(selected) : enabled[0];
    setTimeout(() => focusOption(start), 0);
  };

  const isFieldActive = focused || open;
  const activeBorderColor = error
    ? colors.semantic.error.foreground
    : isFieldActive
      ? colors.focus
      : colors.borderStrong;

  return (
    <View style={styles.field} {...({ onKeyUp: onFieldKeyUp } as object)}>
      <Text
        style={[labelStyle, { color: colors.text.primary }]}
        onPress={() => focusElement(triggerRef.current)}
      >
        {label}
        {required ? <Text style={{ color: colors.text.secondary }}> (obbligatorio)</Text> : null}
      </Text>

      <Pressable
        ref={triggerRef}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        accessibilityHint={message}
        accessibilityState={{ expanded: open, disabled }}
        aria-expanded={open}
        aria-disabled={disabled}
        aria-haspopup="listbox"
        aria-invalid={error ? true : undefined}
        aria-required={required}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPress={() => (open ? close(false) : openList())}
        style={({ hovered }: PressState) => {
          const style: ViewStyle[] = [
            styles.trigger,
            {
              borderColor: activeBorderColor,
              backgroundColor: disabled ? colors.background : hovered ? colors.background : colors.surface,
            },
          ];
          if (transition) style.push(transition);
          const cursor = cursorStyle(disabled);
          if (cursor) style.push(cursor);
          const ring = focusStyle(isFieldActive);
          if (ring) style.push(ring);
          return style;
        }}
      >
        <Text
          numberOfLines={1}
          style={[
            bodyStyle,
            styles.triggerText,
            { color: disabled || !selected ? colors.text.muted : colors.text.primary },
          ]}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size="action" color={disabled ? colors.text.muted : colors.brand.navy} />
      </Pressable>

      {open ? (
        <View
          accessibilityLabel={label}
          style={styles.list}
          {...({ role: 'listbox' } as object)}
          {...keyboardProps(onListKeyDown)}
        >
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isFirst = index === 0;
              const isLast = index === options.length - 1;
              const innerRadius = radii.control - borderWidths.thin;
              return (
                <Pressable
                  key={option.value}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  role="option"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: isSelected, disabled: option.disabled }}
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  disabled={option.disabled}
                  onFocus={() => {
                    focusedIndex.current = index;
                  }}
                  onPress={() => choose(option)}
                  style={({ hovered, pressed, focused }: PressState) => {
                    const style: ViewStyle[] = [
                      styles.option,
                      {
                        backgroundColor: pressed
                          ? colors.border
                          : hovered || isSelected
                            ? colors.semantic.info.background
                            : colors.surface,
                        borderTopLeftRadius: isFirst ? innerRadius : 0,
                        borderTopRightRadius: isFirst ? innerRadius : 0,
                        borderBottomLeftRadius: isLast ? innerRadius : 0,
                        borderBottomRightRadius: isLast ? innerRadius : 0,
                      },
                    ];
                    const cursor = cursorStyle(!!option.disabled);
                    if (cursor) style.push(cursor);

                    // Su web l'anello di focus usa boxShadow inset con i raggi di curvatura dell'opzione,
                    // per evitare che outline ritagli gli angoli arrotondati della lista.
                    if (focused) {
                      if (Platform.OS === 'web') {
                        style.push({
                          boxShadow: `inset 0 0 0 ${focusRingSize.width}px ${colors.focus}`,
                          outlineStyle: 'none',
                        } as ViewStyle);
                      } else {
                        style.push({ borderColor: colors.focus });
                      }
                    }
                    return style;
                  }}
                >
                  <Text
                    style={[
                      bodyStyle,
                      styles.optionText,
                      { color: option.disabled ? colors.text.muted : colors.text.primary },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected ? <Icon name="check" size="action" color={colors.action.default} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {message ? (
        <View style={styles.message} role={error ? 'alert' : undefined}>
          {error ? <Icon name="circle-alert" size="indicator" color={colors.semantic.error.foreground} /> : null}
          <Text
            style={[
              supportStyle,
              styles.messageText,
              { color: error ? colors.semantic.error.foreground : colors.text.secondary },
            ]}
          >
            {message}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch', gap: space[2] },
  trigger: {
    minHeight: touchTarget.comfortable,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    borderWidth: borderWidths.thin,
    borderRadius: radii.control,
  },
  triggerText: { flex: 1 },
  list: {
    borderWidth: borderWidths.thin,
    borderColor: colors.borderStrong,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  scroll: { maxHeight: controlSizes.selectListMaxHeight },
  option: {
    minHeight: touchTarget.comfortable,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    ...(Platform.OS !== 'web' ? { borderWidth: borderWidths.thin, borderColor: 'transparent' } : null),
  },
  optionText: { flex: 1 },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  messageText: { flex: 1 },
});
