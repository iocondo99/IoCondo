import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { borderWidths, colors, radii, space, touchTarget } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { Button } from './Button';
import { pageWindow } from './layoutMath';
import {
  cursorStyle,
  focusStyle,
  useColorTransition,
  useTextStyle,
  type PressState,
} from './internal';

export interface PaginationProps {
  /** Pagina corrente, da 1. */
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Nome del gruppo, letto dallo screen reader. */
  label?: string;
}

/**
 * Su smartphone: "Precedente", "Pagina 2 di 8", "Successiva". Da tablet in su si
 * aggiungono i numeri di pagina. La pagina corrente è annunciata dagli screen reader
 * (regione live) e segnata con `aria-current`.
 */
export function Pagination({ page, pageCount, onChange, label = 'Paginazione' }: PaginationProps) {
  const { isMobile, isDesktop } = useBreakpoint();
  const statusStyle = useTextStyle('label');
  const total = Math.max(1, Math.floor(pageCount));
  const current = Math.min(Math.max(1, Math.floor(page)), total);

  if (total === 1) return null;

  // Sempre sotto la riga dei controlli: così su smartphone i due pulsanti stanno affiancati.
  const status = (
    <View role="status" aria-live="polite" aria-atomic style={styles.status}>
      <Text style={[statusStyle, { color: colors.text.primary }]}>{`Pagina ${current} di ${total}`}</Text>
    </View>
  );

  const go = (next: number) => {
    if (next >= 1 && next <= total && next !== current) onChange(next);
  };

  // Su smartphone i due pulsanti dividono la larghezza a metà; da tablet restano della loro misura.
  const slot = (child: React.ReactElement) => (isMobile ? <View style={styles.half}>{child}</View> : child);

  return (
    <View role="navigation" aria-label={label} accessibilityLabel={label} style={styles.root}>
      <View style={[styles.controls, isMobile && styles.controlsMobile]}>
        {slot(
          <Button
            variant="secondary"
            label="Precedente"
            icon="chevron-left"
            fullWidth={isMobile}
            disabled={current === 1}
            onPress={() => go(current - 1)}
            accessibilityHint={current > 1 ? `Vai alla pagina ${current - 1}` : undefined}
          />,
        )}
        {isMobile ? null : (
          <View style={styles.numbers}>
            {pageWindow(current, total, isDesktop ? 1 : 0).map((item) =>
              typeof item === 'number' ? (
                <PageNumber key={item} number={item} current={item === current} onPress={() => go(item)} />
              ) : (
                <View key={item} aria-hidden style={styles.ellipsis}>
                  <Text style={[statusStyle, { color: colors.text.secondary }]}>…</Text>
                </View>
              ),
            )}
          </View>
        )}
        {slot(
          <Button
            variant="secondary"
            label="Successiva"
            icon="chevron-right"
            iconPosition="end"
            fullWidth={isMobile}
            disabled={current === total}
            onPress={() => go(current + 1)}
            accessibilityHint={current < total ? `Vai alla pagina ${current + 1}` : undefined}
          />,
        )}
      </View>
      {status}
    </View>
  );
}

function PageNumber({
  number,
  current,
  onPress,
}: {
  number: number;
  current: boolean;
  onPress: () => void;
}) {
  const transition = useColorTransition();
  const textStyle = useTextStyle('button');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pagina ${number}`}
      accessibilityState={{ selected: current }}
      aria-current={current ? 'page' : undefined}
      onPress={onPress}
      style={({ hovered, pressed, focused }: PressState) => {
        const style: ViewStyle[] = [
          styles.number,
          {
            backgroundColor: current
              ? colors.action.default
              : pressed
                ? colors.border
                : hovered
                  ? colors.background
                  : colors.surface,
            borderColor: current ? colors.action.default : colors.borderStrong,
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
      <Text style={[textStyle, { color: current ? colors.text.inverse : colors.brand.navy }]}>{number}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', alignItems: 'center', gap: space[2] },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
  },
  controlsMobile: { flexWrap: 'nowrap', alignSelf: 'stretch' },
  half: { flex: 1, minWidth: 0 },
  numbers: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  number: {
    minWidth: touchTarget.comfortable,
    minHeight: touchTarget.comfortable,
    paddingHorizontal: space[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidths.thin,
    borderRadius: radii.control,
  },
  ellipsis: { minWidth: touchTarget.control, alignItems: 'center' },
  status: { paddingHorizontal: space[2] },
});
