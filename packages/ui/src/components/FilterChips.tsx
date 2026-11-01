import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon } from '../Icon';
import { borderWidths, colors, radii, space, touchTarget } from '../tokens';
import { Button } from './Button';
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
  type ViewRef,
} from './internal';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterChipsProps {
  /** Nome del gruppo, letto dallo screen reader (es. "Filtra per stato"). */
  label: string;
  /** Le scelte, senza "Tutti": lo aggiunge il componente. */
  options: readonly FilterOption[];
  /** Filtri attivi. Vuoto = nessun filtro (chip "Tutti" selezionato). */
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** Più filtri insieme. Per impostazione predefinita se ne sceglie uno solo. */
  multiple?: boolean;
  allLabel?: string;
}

/**
 * Chip di filtro. Il chip scelto si riconosce anche senza colore: segno di spunta,
 * bordo più spesso e testo in grassetto. Sotto i chip c'è sempre la frase dei filtri
 * attivi (annunciata dagli screen reader) e, se ce ne sono, "Azzera filtri".
 * Tastiera (web): le frecce spostano il focus tra i chip, Home e Fine vanno ai
 * capi, Invio/Spazio scelgono; Tab passa al pulsante "Azzera filtri".
 */
export function FilterChips({
  label,
  options,
  value,
  onChange,
  multiple = false,
  allLabel = 'Tutti',
}: FilterChipsProps) {
  const refs = useRef<Array<ViewRef | null>>([]);
  const summaryStyle = useTextStyle('secondary');
  const chips = [{ value: '', label: allLabel }, ...options];
  const allSelected = value.length === 0;
  const activeLabels = options.filter((option) => value.includes(option.value)).map((option) => option.label);

  // Un solo chip è raggiungibile con Tab: il primo scelto, o "Tutti".
  const firstSelected = chips.findIndex((chip) => (chip.value === '' ? allSelected : value.includes(chip.value)));
  const tabStop = firstSelected >= 0 ? firstSelected : 0;

  const toggle = (chipValue: string) => {
    if (chipValue === '') return onChange([]);
    const isOn = value.includes(chipValue);
    if (multiple) return onChange(isOn ? value.filter((v) => v !== chipValue) : [...value, chipValue]);
    return onChange(isOn ? [] : [chipValue]);
  };

  const onKeyDown = (index: number) => (event: KeyEventLike) => {
    const key = keyOf(event);
    const last = chips.length - 1;
    const to =
      key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : key === 'Home'
            ? 0
            : key === 'End'
              ? last
              : undefined;
    if (to === undefined) return;
    event.preventDefault?.();
    focusElement(refs.current[to]);
  };

  return (
    <View style={styles.root}>
      <View role="group" aria-label={label} accessibilityLabel={label} style={styles.chips}>
        {chips.map((chip, index) => {
          const selected = chip.value === '' ? allSelected : value.includes(chip.value);
          return (
            <View key={chip.value || 'tutti'} {...keyboardProps(onKeyDown(index))}>
              <Chip
                label={chip.label}
                selected={selected}
                tabIndex={index === tabStop ? 0 : -1}
                chipRef={(node) => {
                  refs.current[index] = node;
                }}
                onPress={() => toggle(chip.value)}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.summaryRow}>
        <View role="status" aria-live="polite" aria-atomic style={styles.summary}>
          <Text style={[summaryStyle, { color: colors.text.secondary }]}>
            {allSelected
              ? 'Nessun filtro attivo.'
              : `${activeLabels.length === 1 ? 'Filtro attivo' : 'Filtri attivi'}: ${activeLabels.join(', ')}.`}
          </Text>
        </View>
        {allSelected ? null : (
          <Button variant="text" label="Azzera filtri" icon="x" onPress={() => onChange([])} />
        )}
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  tabIndex,
  chipRef,
  onPress,
}: {
  label: string;
  selected: boolean;
  tabIndex: 0 | -1;
  chipRef: (node: ViewRef | null) => void;
  onPress: () => void;
}) {
  const transition = useColorTransition();
  const textStyle = useTextStyle(selected ? 'button' : 'label');
  return (
    <Pressable
      ref={chipRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-pressed={selected}
      tabIndex={tabIndex}
      onPress={onPress}
      style={({ hovered, pressed, focused }: PressState) => {
        const style: ViewStyle[] = [
          styles.chip,
          {
            // Il bordo da scelto è più spesso: il padding compensa, così il chip non cambia misura.
            paddingHorizontal: selected ? space[4] - borderWidths.thin : space[4],
            backgroundColor: selected
              ? colors.semantic.info.background
              : pressed
                ? colors.border
                : hovered
                  ? colors.background
                  : colors.surface,
            borderColor: selected ? colors.action.default : colors.borderStrong,
            borderWidth: selected ? borderWidths.thin * 2 : borderWidths.thin,
          },
        ];
        if (transition) style.push(transition);
        const cursor = cursorStyle(false);
        if (cursor) style.push(cursor);
        const ring = focusStyle(!!focused);
        if (ring) style.push(ring);
        return style;
      }}
    >
      {selected ? <Icon name="check" size="indicator" color={colors.action.default} /> : null}
      <Text style={[textStyle, { color: selected ? colors.action.default : colors.text.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: touchTarget.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderRadius: radii.full,
  },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[3] },
  summary: { flexShrink: 1 },
});
