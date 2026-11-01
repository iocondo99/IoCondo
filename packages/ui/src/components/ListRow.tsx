import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { tabularNumbers } from '../styles';
import { borderWidths, colors, dataSizes, radii, space } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { Badge, type BadgeStatus } from './Badge';
import type { StatTile } from './StatCard';
import {
  cursorStyle,
  insetFocusStyle,
  useColorTransition,
  useTextStyle,
  type PressState,
} from './internal';

export interface ListRowProps {
  icon: IconName;
  /** Colore della tessera dell'icona; `error` per ciò che richiede attenzione (es. una scadenza superata). */
  tile?: StatTile | 'error';
  title: string;
  description?: string;
  /** Dato a destra (data o importo), già formattato. */
  meta?: string;
  /** Stato: su smartphone sta sotto la descrizione, altrove sotto il dato a destra. */
  badge?: BadgeStatus;
  /** Se presente tutta la riga è un pulsante: clic, tocco o Invio. */
  onPress?: () => void;
  /** Frase completa per lo screen reader (titolo, data, stato). Se manca vale il titolo. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * Riga di un elenco breve dentro una scheda (es. "Ultime comunicazioni", "Prossime scadenze"):
 * tessera con icona, titolo, descrizione, dato a destra e stato. Le righe si raggruppano in `ListRows`.
 */
export function ListRow({
  icon,
  tile = 'blue',
  title,
  description,
  meta,
  badge,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: ListRowProps) {
  const { isMobile } = useBreakpoint();
  const transition = useColorTransition();
  const titleStyle = useTextStyle('h4');
  const descriptionStyle = useTextStyle('secondary');
  const metaStyle = useTextStyle('label');
  const palette = tile === 'error' ? colors.semantic.error : colors.tile[tile];
  const badgeSotto = Boolean(badge) && isMobile;
  const badgeADestra = Boolean(badge) && !isMobile;

  const content = (
    <>
      <View aria-hidden style={[styles.tile, { backgroundColor: palette.background }]}>
        <Icon name={icon} size="action" color={palette.foreground} />
      </View>
      <View style={styles.body}>
        <Text style={[titleStyle, styles.title]}>{title}</Text>
        {description ? (
          <Text numberOfLines={2} style={[descriptionStyle, styles.description]}>
            {description}
          </Text>
        ) : null}
        {badgeSotto && badge ? <Badge status={badge} /> : null}
      </View>
      {meta || badgeADestra ? (
        <View style={styles.side}>
          {meta ? <Text style={[metaStyle, tabularNumbers, styles.meta]}>{meta}</Text> : null}
          {badgeADestra && badge ? <Badge status={badge} /> : null}
        </View>
      ) : null}
      {onPress ? (
        <View aria-hidden style={styles.chevron}>
          <Icon name="chevron-right" size="action" color={colors.text.muted} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={Platform.OS === 'web' ? accessibilityLabel : (accessibilityLabel ?? title)}
      aria-label={Platform.OS === 'web' ? accessibilityLabel : undefined}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ hovered, pressed, focused }: PressState) => {
        const style: ViewStyle[] = [
          styles.row,
          { backgroundColor: pressed ? colors.border : hovered ? colors.background : colors.surface },
        ];
        if (transition) style.push(transition);
        const cursor = cursorStyle(false);
        if (cursor) style.push(cursor);
        const ring = insetFocusStyle(!!focused);
        if (ring) style.push(ring);
        return style;
      }}
    >
      {content}
    </Pressable>
  );
}

export interface ListRowsProps {
  /** Nome dell'elenco, letto dagli screen reader (es. "Ultime comunicazioni"). */
  label: string;
  children: React.ReactNode;
}

/** Gruppo di `ListRow` separate da un bordo sottile, come elenco per gli screen reader. */
export function ListRows({ label, children }: ListRowsProps) {
  const items = React.Children.toArray(children);
  return (
    <View role="list" aria-label={label} style={styles.group}>
      {items.map((item, index) => (
        <View key={index} role="listitem" style={index > 0 ? styles.separated : undefined}>
          {item}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignSelf: 'stretch' },
  separated: { borderTopWidth: borderWidths.thin, borderTopColor: colors.border },
  // Il bordo trasparente tiene il posto dell'anello di focus su nativo.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  tile: {
    width: dataSizes.listTile,
    height: dataSizes.listTile,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: space[1] },
  title: { color: colors.text.primary },
  description: { color: colors.text.secondary },
  side: { alignItems: 'flex-end', gap: space[1], flexShrink: 0 },
  meta: { color: colors.text.primary },
  chevron: { flexShrink: 0 },
});
