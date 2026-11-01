import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon } from '../Icon';
import { resolveFontFamily } from '../styles';
import { colors, space, touchTarget } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { cursorStyle, focusStyle, useTextStyle, type PressState } from './internal';

export interface BreadcrumbItem {
  label: string;
  /** Mancante per l'ultimo elemento: la pagina corrente non è un link. */
  onPress?: () => void;
}

export interface BreadcrumbsProps {
  /** Dal livello più alto alla pagina corrente (es. Home, Documenti, Bilanci, Bilancio 2025). */
  items: readonly BreadcrumbItem[];
  label?: string;
}

/** Con più di questi elementi, su smartphone il percorso si accorcia. */
const MOBILE_MAX_VISIBLE = 3;

/**
 * Percorso di navigazione (sez. 15). L'ultimo elemento è la pagina corrente e non è un
 * link. Su smartphone il centro del percorso diventa "…": è un pulsante che lo mostra
 * per intero; gli screen reader ricevono comunque l'elenco completo nel nome dell'area.
 */
export function Breadcrumbs({ items, label = 'Percorso di navigazione' }: BreadcrumbsProps) {
  const { isMobile } = useBreakpoint();
  const [expanded, setExpanded] = useState(false);
  const textStyle = useTextStyle('secondary');

  if (items.length === 0) return null;

  const collapsed = isMobile && !expanded && items.length > MOBILE_MAX_VISIBLE;
  const last = items.length - 1;
  const fullPath = items.map((item) => item.label).join(', ');

  const entries: Array<{ item?: BreadcrumbItem; index: number; ellipsis?: boolean }> = [];
  items.forEach((item, index) => {
    if (!collapsed || index === 0 || index >= last - 1) {
      entries.push({ item, index });
    } else if (index === 1) {
      entries.push({ index, ellipsis: true });
    }
  });

  return (
    <View
      role="navigation"
      aria-label={label}
      accessibilityLabel={collapsed ? `${label}: ${fullPath}` : label}
      style={styles.root}
    >
      {entries.map(({ item, index, ellipsis }) => (
        <View key={ellipsis ? 'ellipsis' : index} style={[styles.entry, index === last && styles.current]}>
          {index > 0 ? (
            <Icon name="chevron-right" size="indicator" color={colors.text.muted} />
          ) : null}
          {ellipsis ? (
            <Crumb
              label="…"
              accessibilityLabel="Mostra il percorso completo"
              onPress={() => setExpanded(true)}
            />
          ) : item && index === last ? (
            <Text
              aria-current="page"
              numberOfLines={isMobile ? 1 : undefined}
              style={[textStyle, styles.currentText]}
            >
              {item.label}
            </Text>
          ) : item ? (
            <Crumb label={item.label} onPress={item.onPress} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Crumb({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const textStyle = useTextStyle('secondary');
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : 'text'}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={!onPress}
      onPress={onPress}
      style={({ focused }: PressState) => {
        const style: ViewStyle[] = [styles.crumb];
        const cursor = cursorStyle(!onPress);
        if (cursor && onPress) style.push(cursor);
        const ring = focusStyle(!!focused);
        if (ring) style.push(ring);
        return style;
      }}
    >
      {({ hovered, pressed }: PressState) => (
        <Text
          style={[
            textStyle,
            {
              color: pressed ? colors.action.pressed : hovered ? colors.action.hover : colors.action.default,
              textDecorationLine: hovered || pressed ? 'underline' : 'none',
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[1] },
  entry: { flexDirection: 'row', alignItems: 'center', columnGap: space[1] },
  current: { flexShrink: 1 },
  crumb: {
    minHeight: touchTarget.control,
    minWidth: touchTarget.minimum,
    paddingHorizontal: space[1],
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentText: { color: colors.text.primary, fontFamily: resolveFontFamily('semibold'), flexShrink: 1 },
});
