import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../Icon';
import { borderWidths, colors, radii, space } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { Button } from './Button';
import { useTextStyle } from './internal';

export interface CardAction {
  /** Deve dire cosa succede (es. "Vedi tutte"). */
  label: string;
  onPress: () => void;
  icon?: IconName;
  accessibilityHint?: string;
}

export interface CardProps {
  title?: string;
  /** Azione nell'intestazione, a destra del titolo (es. "Vedi tutte"). */
  action?: CardAction;
  children?: React.ReactNode;
}

export function Card({ title, action, children }: CardProps) {
  const { isMobile } = useBreakpoint();
  const titleStyle = useTextStyle('h3');
  const hasHeader = Boolean(title || action);

  return (
    <View style={[styles.card, { padding: isMobile ? space[4] : space[6] }]}>
      {hasHeader ? (
        <View style={styles.header}>
          {title ? (
            <Text accessibilityRole="header" aria-level={3} style={[titleStyle, styles.title]}>
              {title}
            </Text>
          ) : (
            <View style={styles.title} />
          )}
          {action ? (
            <View style={styles.action}>
              <Button
                variant="text"
                label={action.label}
                icon={action.icon ?? 'arrow-right'}
                iconPosition="end"
                onPress={action.onPress}
                accessibilityHint={action.accessibilityHint}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    gap: space[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  title: { color: colors.brand.navy, flex: 1 },
  /** Il pulsante testuale ha un margine interno: si compensa perché il testo si allinei al bordo della scheda. */
  action: { flexShrink: 0, marginRight: -space[4] },
});
