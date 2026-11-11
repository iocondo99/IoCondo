import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
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
  /** Livello semantico del titolo (2 per sezioni principali, 3 per sottosezioni). Predefinito: 2. */
  headingLevel?: 2 | 3 | 4;
  /** Azione nell'intestazione, a destra del titolo (es. "Vedi tutte"). */
  action?: CardAction;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ title, headingLevel = 2, action, children, style }: CardProps) {
  const { isMobile } = useBreakpoint();
  const titleStyle = useTextStyle('h3');
  const hasHeader = Boolean(title || action);

  return (
    <View style={[styles.card, { padding: isMobile ? space[4] : space[6] }, style]}>
      {hasHeader ? (
        <View style={styles.header}>
          {title ? (
            <Text accessibilityRole="header" aria-level={headingLevel} style={[titleStyle, styles.title]}>
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  /** Il titolo prende lo spazio che resta; se con l'azione non ci sta (testo ingrandito) l'azione va a capo. */
  title: { color: colors.brand.navy, flexGrow: 1, flexShrink: 1, flexBasis: '40%' },
  /** Il pulsante testuale ha un margine interno: si compensa perché il testo si allinei al bordo della scheda. */
  action: { flexShrink: 0, marginRight: -space[4] },
});
