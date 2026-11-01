import React, { useEffect, useRef, useState } from 'react';
import {
  Modal as RNModal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  checkDateText,
  clampDate,
  isOutOfRange,
  isSameDay,
  longDateLabel,
  maskDateInput,
  monthGrid,
  monthTitle,
  startOfDay,
  weekdayIndex,
  type DateRange,
} from '../calendar';
import { formatDateNumeric, parseDateNumeric } from '../format';
import { resolveFontFamily, shadowStyle } from '../styles';
import {
  borderWidths,
  colors,
  dataSizes,
  overlay,
  radii,
  space,
} from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { BaseField } from './Input';
import { placeMenu, type Placement } from './layoutMath';
import {
  cursorStyle,
  focusStyle,
  keyboardProps,
  keyOf,
  moveFocusTo,
  useColorTransition,
  useTextStyle,
  type KeyEventLike,
  type PressState,
  type ViewRef,
} from './internal';

export interface DatePickerProps {
  /** Sempre visibile sopra il campo. */
  label: string;
  /** Data scelta, o `null` se il campo è vuoto o la data non è valida. */
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Prima e ultima data consentite (estremi inclusi). */
  min?: Date;
  max?: Date;
  helperText?: string;
  /** Errore dal chiamante: ha la precedenza su quello del campo. */
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

const CALENDAR_WIDTH = dataSizes.calendarWidth + space[4] * 2;
const CALENDAR_HEIGHT = dataSizes.calendarDay * 6 + dataSizes.headerMinHeight * 3;
const DATE_LENGTH = 'gg/mm/aaaa'.length;

/**
 * Campo data in formato italiano (gg/mm/aaaa) con calendario a comparsa. Si può scrivere da tastiera
 * (le barre si aggiungono da sole) o scegliere dal calendario. L'errore compare quando si esce dal campo,
 * o subito se la data è completa ma fuori intervallo. Il calendario parte da lunedì ed è in italiano.
 * Tastiera nel calendario: frecce per i giorni, Pag su/giù per i mesi (con Maiusc gli anni),
 * Inizio/Fine per la settimana, Invio o Spazio scelgono, Esc chiude.
 */
export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  helperText = 'Scrivi la data come gg/mm/aaaa o aprila dal calendario.',
  error,
  required,
  disabled = false,
}: DatePickerProps) {
  const range: DateRange = { min, max };
  const [text, setText] = useState(() => formatDateNumeric(value));
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<ViewRef>(null);
  const { isMobile } = useBreakpoint();
  const screen = useWindowDimensions();

  // Se la data cambia dall'esterno (o dal calendario) il testo la segue; mentre si scrive non viene toccato.
  useEffect(() => {
    const typed = parseDateNumeric(text);
    const same = value ? typed !== null && isSameDay(typed, value) : typed === null;
    if (!same) {
      setText(formatDateNumeric(value));
      setFieldError(undefined);
    }
    // Solo quando cambia `value`: `text` cambia ad ogni tasto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleText = (input: string) => {
    const masked = maskDateInput(input);
    setText(masked);
    if (masked === '') {
      setFieldError(undefined);
      return onChange(null);
    }
    if (masked.length < DATE_LENGTH) {
      // Data incompleta: nessun errore finché si scrive, ma il valore non è più valido.
      setFieldError(undefined);
      return onChange(null);
    }
    const check = checkDateText(masked, range);
    setFieldError(check.error);
    onChange(check.date);
  };

  const handleBlur = () => {
    if (text === '') return;
    setFieldError(checkDateText(text, range).error);
  };

  const openCalendar = () => {
    if (isMobile) return setOpen(true);
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setPlacement(
        placeMenu({
          anchor: { x, y, width, height },
          screen: { width: screen.width, height: screen.height },
          contentHeight: CALENDAR_HEIGHT,
          minWidth: CALENDAR_WIDTH,
          margin: space[2],
          gap: space[1],
          // Allineato al bordo destro del pulsante; se a sinistra non c'è posto, al bordo sinistro.
          align: x + width - CALENDAR_WIDTH >= space[2] ? 'end' : 'start',
        }),
      );
      setOpen(true);
    });
  };

  const close = () => {
    setOpen(false);
    // Su nativo il focus dello screen reader torna al pulsante; su web lo fa già il Modal.
    setTimeout(() => moveFocusTo(triggerRef.current), 0);
  };

  const choose = (date: Date) => {
    setOpen(false);
    setText(formatDateNumeric(date));
    setFieldError(undefined);
    onChange(date);
    setTimeout(() => moveFocusTo(triggerRef.current), 0);
  };

  // Se la finestra cambia dimensione la posizione calcolata non vale più: il calendario si chiude.
  const size = `${screen.width}x${screen.height}`;
  const lastSize = useRef(size);
  useEffect(() => {
    if (lastSize.current !== size) {
      lastSize.current = size;
      if (open) setOpen(false);
    }
  }, [size, open]);

  return (
    <>
      <BaseField
        label={label}
        value={text}
        onChangeText={handleText}
        onBlur={handleBlur}
        placeholder="gg/mm/aaaa"
        keyboardType="number-pad"
        autoComplete="off"
        autoCorrect={false}
        maxLength={DATE_LENGTH}
        helperText={helperText}
        error={error ?? fieldError}
        required={required}
        disabled={disabled}
        trailing={
          <IconButton
            buttonRef={triggerRef}
            icon="calendar-days"
            accessibilityLabel={`Apri il calendario: ${label}`}
            popup="dialog"
            expanded={open}
            disabled={disabled}
            onPress={openCalendar}
          />
        }
      />
      {open && (isMobile || placement) ? (
        <RNModal transparent visible animationType="none" onRequestClose={close}>
          <View style={[styles.root, isMobile && styles.rootCentered]}>
            <Pressable
              accessible={false}
              focusable={false}
              style={[StyleSheet.absoluteFill, isMobile && styles.scrim]}
              onPress={close}
            />
            <Calendar
              label={label}
              selected={value}
              range={range}
              onSelect={choose}
              onClose={close}
              style={isMobile ? styles.cardCentered : [styles.cardPopover, placement?.horizontal, placement?.vertical]}
            />
          </View>
        </RNModal>
      ) : null}
    </>
  );
}

function Calendar({
  label,
  selected,
  range,
  onSelect,
  onClose,
  style,
}: {
  label: string;
  selected: Date | null;
  range: DateRange;
  onSelect: (date: Date) => void;
  onClose: () => void;
  style: ViewStyle | Array<ViewStyle | undefined>;
}) {
  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState(() => clampDate(selected ?? today, range));
  const cardRef = useRef<ViewRef>(null);
  const cellRefs = useRef<Record<number, ViewRef | null>>({});
  const focusAfterRender = useRef(false);
  const titleStyle = useTextStyle('h4');
  const weekdayStyle = useTextStyle('label');

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = monthGrid(year, month);
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const canGoBack = !range.min || startOfDay(firstOfMonth).getTime() > startOfDay(range.min).getTime();
  const canGoForward = !range.max || startOfDay(lastOfMonth).getTime() < startOfDay(range.max).getTime();
  const todayAllowed = !isOutOfRange(today, range);

  // All'apertura il focus va al giorno scelto (o a oggi); dopo i tasti freccia segue il cursore.
  useEffect(() => {
    const timer = setTimeout(() => moveFocusTo(cellRefs.current[cursor.getDate()] ?? cardRef.current), 50);
    return () => clearTimeout(timer);
    // Solo all'apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusAfterRender.current) return;
    focusAfterRender.current = false;
    moveFocusTo(cellRefs.current[cursor.getDate()]);
  }, [cursor]);

  const moveCursor = (next: Date) => {
    focusAfterRender.current = true;
    setCursor(clampDate(next, range));
  };

  const changeMonth = (months: number) => {
    // I pulsanti dei mesi non portano il focus al giorno: restano dove sono, per poter premere di nuovo.
    setCursor(clampDate(addMonths(cursor, months), range));
  };

  const onKeyDown = (event: KeyEventLike) => {
    const key = keyOf(event);
    const shift = Boolean((event as { shiftKey?: boolean }).shiftKey ?? (event.nativeEvent as { shiftKey?: boolean } | undefined)?.shiftKey);
    const step: Record<string, Date | undefined> = {
      ArrowLeft: addDays(cursor, -1),
      ArrowRight: addDays(cursor, 1),
      ArrowUp: addDays(cursor, -7),
      ArrowDown: addDays(cursor, 7),
      Home: addDays(cursor, -weekdayIndex(cursor)),
      End: addDays(cursor, 6 - weekdayIndex(cursor)),
      PageUp: addMonths(cursor, shift ? -12 : -1),
      PageDown: addMonths(cursor, shift ? 12 : 1),
    };
    const target = key ? step[key] : undefined;
    if (target) {
      event.preventDefault?.();
      return moveCursor(target);
    }
    // Invio lo gestisce già il pulsante del giorno; lo Spazio no.
    if (key === ' ') {
      event.preventDefault?.();
      onSelect(cursor);
    }
  };

  return (
    <View
      ref={cardRef}
      role="dialog"
      aria-label={`Scegli la data: ${label}`}
      accessibilityLabel={`Scegli la data: ${label}`}
      accessibilityViewIsModal
      tabIndex={-1}
      style={[styles.card, noOutline, style]}
    >
      <View style={styles.monthRow}>
        <IconButton
          icon="chevron-left"
          accessibilityLabel="Mese precedente"
          disabled={!canGoBack}
          onPress={() => changeMonth(-1)}
        />
        <Text
          role="heading"
          aria-level={2}
          aria-live="polite"
          style={[titleStyle, styles.monthTitle]}
        >
          {monthTitle(year, month)}
        </Text>
        <IconButton
          icon="chevron-right"
          accessibilityLabel="Mese successivo"
          disabled={!canGoForward}
          onPress={() => changeMonth(1)}
        />
      </View>

      <View role="grid" aria-label={monthTitle(year, month)} {...keyboardProps(onKeyDown)}>
        <View role="row" style={styles.week}>
          {WEEKDAY_SHORT.map((short, index) => (
            <View key={short} role="columnheader" aria-label={WEEKDAY_LONG[index]} style={styles.weekday}>
              <Text aria-hidden style={[weekdayStyle, styles.weekdayText]}>
                {short}
              </Text>
            </View>
          ))}
        </View>
        {grid.map((week, weekIndex) => (
          <View key={weekIndex} role="row" style={styles.week}>
            {week.map((day, dayIndex) =>
              day ? (
                <DayCell
                  key={day.getDate()}
                  day={day}
                  isToday={isSameDay(day, today)}
                  isSelected={selected !== null && isSameDay(day, selected)}
                  isCursor={isSameDay(day, cursor)}
                  disabled={isOutOfRange(day, range)}
                  cellRef={(node) => {
                    cellRefs.current[day.getDate()] = node;
                  }}
                  onPress={() => onSelect(day)}
                />
              ) : (
                <View key={`vuoto-${dayIndex}`} aria-hidden style={styles.day} />
              ),
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Button variant="text" label="Oggi" disabled={!todayAllowed} onPress={() => onSelect(today)} />
        <Button variant="text" label="Chiudi" onPress={onClose} />
      </View>
    </View>
  );
}

function DayCell({
  day,
  isToday,
  isSelected,
  isCursor,
  disabled,
  cellRef,
  onPress,
}: {
  day: Date;
  isToday: boolean;
  isSelected: boolean;
  isCursor: boolean;
  disabled: boolean;
  cellRef: (node: ViewRef | null) => void;
  onPress: () => void;
}) {
  const transition = useColorTransition();
  const textStyle = useTextStyle('body');
  const color = isSelected ? colors.text.inverse : disabled ? colors.text.muted : colors.text.primary;

  return (
    <View {...({ role: 'gridcell' } as object)} aria-selected={isSelected} style={styles.day}>
      <Pressable
        ref={cellRef}
        role="button"
        accessibilityLabel={`${longDateLabel(day)}${isToday ? ', oggi' : ''}`}
        accessibilityState={{ selected: isSelected, disabled }}
        aria-pressed={isSelected}
        aria-current={isToday ? 'date' : undefined}
        aria-disabled={disabled}
        disabled={disabled}
        // Una sola tappa nella tabulazione: il giorno corrente del cursore (le frecce fanno il resto).
        tabIndex={isCursor ? 0 : -1}
        onPress={onPress}
        style={({ hovered, pressed, focused }: PressState) => {
          const style: ViewStyle[] = [
            styles.dayButton,
            {
              backgroundColor: isSelected
                ? colors.action.default
                : pressed
                  ? colors.border
                  : hovered && !disabled
                    ? colors.background
                    : 'transparent',
              // Oggi: bordo pieno anche senza colore; i giorni non consentiti sono sbarrati dal testo attenuato.
              borderColor: isToday ? colors.brand.navy : 'transparent',
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
        <Text
          style={[
            textStyle,
            { color, fontFamily: resolveFontFamily(isSelected || isToday ? 'semibold' : 'regular') },
          ]}
        >
          {day.getDate()}
        </Text>
      </Pressable>
    </View>
  );
}

// L'elemento che riceve il focus da programma non mostra l'anello: i controlli interni sì.
const noOutline: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : undefined;

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootCentered: { alignItems: 'center', justifyContent: 'center', padding: space[4] },
  scrim: { backgroundColor: overlay.color, opacity: overlay.opacity },
  card: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.borderStrong,
    borderRadius: radii.card,
    padding: space[4],
    gap: space[2],
    ...shadowStyle('menu'),
  },
  cardPopover: { position: 'absolute', width: CALENDAR_WIDTH },
  cardCentered: { width: '100%', maxWidth: CALENDAR_WIDTH },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  monthTitle: { flex: 1, textAlign: 'center', color: colors.brand.navy, textTransform: 'capitalize' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: space[2] },
  weekdayText: { color: colors.text.secondary, textTransform: 'uppercase' },
  day: { flex: 1, minWidth: 0, height: dataSizes.calendarDay, alignItems: 'center', justifyContent: 'center' },
  dayButton: {
    width: '100%',
    maxWidth: dataSizes.calendarDay,
    height: dataSizes.calendarDay,
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
});
