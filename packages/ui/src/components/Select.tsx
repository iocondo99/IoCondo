import React, { useEffect, useRef, useState } from 'react';
import {
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { Icon } from '../Icon';
import { placeMenu, type Placement } from './layoutMath';
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
  /**
   * La lista si apre sopra il contenuto invece di spingerlo in basso: il riquadro che contiene la
   * select non cambia altezza. Pensata per i filtri.
   */
  floating?: boolean;
  /** Campo di ricerca nella lista: scrivendo si filtrano le opzioni. Attivo di default. */
  searchable?: boolean;
  /** Nasconde l'etichetta visibile (resta come nome accessibile). */
  hideLabel?: boolean;
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
  floating = false,
  searchable = true,
  hideLabel = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  // Solo per `floating`: dove disegnare la lista sopra la pagina.
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<TextInput>(null);
  const screen = useWindowDimensions();
  const triggerRef = useRef<React.ComponentRef<typeof View>>(null);
  const optionRefs = useRef<Array<React.ComponentRef<typeof View> | null>>([]);
  const focusedIndex = useRef(-1);
  // L'Escape che chiude la lista non deve chiudere anche una modale: il Modal ascolta il rilascio del tasto.
  const swallowEscapeKeyUp = useRef(false);

  // Chiusura al clic esterno su web (sez. 10 e 17)
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || floating) return;
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
  }, [open, floating]);

  // Se la finestra cambia dimensione la posizione calcolata non vale piu': la lista si chiude.
  const size = `${screen.width}x${screen.height}`;
  const lastSize = useRef(size);
  useEffect(() => {
    if (lastSize.current !== size) {
      lastSize.current = size;
      if (open && floating) setOpen(false);
    }
  }, [size, open, floating]);

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
  // Ricerca senza distinzione di maiuscole e accenti.
  const normalizza = (testo: string) =>
    testo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const cercato = normalizza(query);
  const visibili = cercato ? options.filter((o) => normalizza(o.label).includes(cercato)) : options;
  const enabled = visibili.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    setQuery('');
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
      if (searchable && at <= 0) searchRef.current?.focus();
      else focusOption(enabled[Math.max(at - 1, 0)]);
    } else if (key === 'Home') {
      event.preventDefault?.();
      focusOption(enabled[0]);
    } else if (key === 'End') {
      event.preventDefault?.();
      focusOption(enabled[enabled.length - 1]);
    }
  };

  const openList = () => {
    setQuery('');
    const start = selected ? visibili.indexOf(selected) : enabled[0];
    // Con la ricerca il focus va sul campo: si scrive subito, la freccia giu' scende alle opzioni.
    const focusIniziale = () => (searchable ? searchRef.current?.focus() : focusOption(start));
    if (!floating) {
      setOpen(true);
      setFocused(true);
      // Dopo il render porta il focus sulla scelta attuale (o sulla prima opzione).
      setTimeout(focusIniziale, 0);
      return;
    }
    const node = triggerRef.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    } | null;
    if (!node?.measureInWindow) return;
    node.measureInWindow((x, y, width, height) => {
      setPlacement(
        placeMenu({
          anchor: { x, y, width, height },
          screen: { width: screen.width, height: screen.height },
          contentHeight: Math.min(
            options.length * touchTarget.comfortable + borderWidths.thin * 2,
            controlSizes.selectListMaxHeight,
          ),
          minWidth: 0,
          margin: space[2],
          gap: space[1],
          align: 'start',
        }),
      );
      setOpen(true);
      setFocused(true);
      setTimeout(focusIniziale, 50);
    });
  };

  const isFieldActive = focused || open;
  const activeBorderColor = error
    ? colors.semantic.error.foreground
    : isFieldActive
      ? colors.focus
      : colors.borderStrong;

  return (
    <View style={styles.field} {...({ onKeyUp: onFieldKeyUp } as object)}>
      {!hideLabel ? (
        <Text
          style={[labelStyle, { color: colors.text.primary }]}
          onPress={() => focusElement(triggerRef.current)}
        >
          {label}
          {required ? <Text style={{ color: colors.text.secondary }}> (obbligatorio)</Text> : null}
        </Text>
      ) : null}

      <View style={floating ? styles.anchor : undefined}>
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

      {open && !floating ? (
        <View
          accessibilityLabel={label}
          style={[styles.list, floating ? styles.listFloating : null]}
          {...({ role: 'listbox' } as object)}
          {...keyboardProps(onListKeyDown)}
        >
          {searchable ? (
            <View style={styles.searchBox}>
              <Icon name="search" size="indicator" color={colors.text.muted} />
              <TextInput
                ref={searchRef}
                value={query}
                onChangeText={(testo) => {
                setQuery(testo);
                focusedIndex.current = -1;
              }}
              onSubmitEditing={() => {
                const primo = visibili[enabled[0] ?? -1];
                if (primo) choose(primo);
              }}
              {...keyboardProps((event: KeyEventLike) => {
                const key = keyOf(event);
                if (key === 'ArrowDown') {
                  event.preventDefault?.();
                  focusOption(enabled[0]);
                } else if (key === 'Escape') {
                  event.preventDefault?.();
                  swallowEscapeKeyUp.current = true;
                  close(true);
                }
              })}
                placeholder="Cerca…"
                placeholderTextColor={colors.text.muted}
                accessibilityLabel={`Cerca in ${label}`}
                autoCorrect={false}
                autoCapitalize="none"
                style={[bodyStyle, styles.searchInput]}
              />
            </View>
          ) : null}
          {visibili.length === 0 ? (
            <Text style={[supportStyle, styles.nessunRisultato]}>Nessun risultato</Text>
          ) : null}
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {visibili.map((option, index) => {
              const isSelected = option.value === value;
              const isFirst = index === 0;
              const isLast = index === visibili.length - 1;
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
                        } as unknown as ViewStyle);
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
      {open && floating && placement ? (
        <RNModal transparent visible animationType="none" onRequestClose={() => close(true)}>
          <View style={StyleSheet.absoluteFill}>
            <Pressable
              accessible={false}
              focusable={false}
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setOpen(false);
                setFocused(false);
                setQuery('');
              }}
            />
            <View
              style={[
                styles.floatingWrap,
                placement.horizontal,
                placement.vertical,
                { width: placement.minWidth, maxHeight: placement.maxHeight },
              ]}
            >
            <View
              accessibilityLabel={label}
              style={[styles.list, styles.listFloating, styles.listFloatingSize]}
              {...({ role: 'listbox' } as object)}
              {...keyboardProps(onListKeyDown)}
            >
              {searchable ? (
                <View style={styles.searchBox}>
                  <Icon name="search" size="indicator" color={colors.text.muted} />
                  <TextInput
                    ref={searchRef}
                    value={query}
                    onChangeText={(testo) => {
                setQuery(testo);
                focusedIndex.current = -1;
              }}
              onSubmitEditing={() => {
                const primo = visibili[enabled[0] ?? -1];
                if (primo) choose(primo);
              }}
              {...keyboardProps((event: KeyEventLike) => {
                const key = keyOf(event);
                if (key === 'ArrowDown') {
                  event.preventDefault?.();
                  focusOption(enabled[0]);
                } else if (key === 'Escape') {
                  event.preventDefault?.();
                  swallowEscapeKeyUp.current = true;
                  close(true);
                }
              })}
                    placeholder="Cerca…"
                    placeholderTextColor={colors.text.muted}
                    accessibilityLabel={`Cerca in ${label}`}
                    autoCorrect={false}
                    autoCapitalize="none"
                    style={[bodyStyle, styles.searchInput]}
                  />
                </View>
              ) : null}
              {visibili.length === 0 ? (
                <Text style={[supportStyle, styles.nessunRisultato]}>Nessun risultato</Text>
              ) : null}
              <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
                {visibili.map((option, index) => {
                  const isSelected = option.value === value;
                  const isFirst = index === 0;
                  const isLast = index === visibili.length - 1;
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
                            } as unknown as ViewStyle);
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
            </View>
          </View>
        </RNModal>
      ) : null}
      </View>

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
  searchBox: {
    flexDirection: 'row',
    minWidth: 0,
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
    minHeight: touchTarget.comfortable,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    color: colors.text.primary,
    paddingVertical: space[2],
    ...Platform.select({ web: { outlineStyle: 'none' } as unknown as ViewStyle, default: {} }),
  },
  nessunRisultato: {
    color: colors.text.secondary,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  anchor: { position: 'relative', zIndex: 20 },
  // Lista nel livello sopra la pagina: posizione assoluta rispetto alla finestra.
  floatingWrap: { position: 'absolute' },
  // La lista flottante occupa tutta la larghezza del riquadro: niente testo tagliato a sinistra.
  listFloatingSize: { width: '100%', maxHeight: '100%', alignSelf: 'stretch' },
  listFloating: {
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)' } as unknown as ViewStyle,
      default: {
        elevation: 8,
        shadowColor: '#0f172a',
        shadowOpacity: 0.16,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
  option: {
    minHeight: touchTarget.comfortable,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    ...(Platform.OS !== 'web' ? { borderWidth: borderWidths.thin, borderColor: 'transparent' } : null),
  },
  optionText: { flex: 1, flexShrink: 1, minWidth: 0 },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  messageText: { flex: 1 },
});
