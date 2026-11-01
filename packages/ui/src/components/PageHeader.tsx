import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../Icon';
import { colors, space } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import { Button } from './Button';
import { useTextStyle } from './internal';

export interface PageHeaderAction {
  /** Deve dire cosa succede (es. "Carica documento"). */
  label: string;
  onPress: () => void | Promise<unknown>;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
}

export interface PageHeaderProps {
  /** Titolo della pagina (H1): descrive chiaramente il contenuto. */
  title: string;
  subtitle?: string;
  /** Azione principale della pagina: una sola, allineata al titolo. */
  action?: PageHeaderAction;
  breadcrumbs?: readonly BreadcrumbItem[];
  /** Se presente compare il pulsante "Indietro" sopra il titolo. */
  onBack?: () => void;
}

/**
 * Intestazione di pagina (sez. 5.3): titolo, sottotitolo e azione principale. Da tablet
 * in su l'azione sta a destra del titolo; su smartphone va sotto, a tutta larghezza.
 */
export function PageHeader({ title, subtitle, action, breadcrumbs, onBack }: PageHeaderProps) {
  const { isMobile } = useBreakpoint();
  const titleStyle = useTextStyle('h1');
  const subtitleStyle = useTextStyle('body');

  return (
    <View style={styles.root}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      {onBack ? (
        <View style={styles.back}>
          <Button variant="text" label="Indietro" icon="chevron-left" onPress={onBack} />
        </View>
      ) : null}
      <View style={[styles.row, isMobile && styles.column]}>
        <View style={styles.text}>
          <Text accessibilityRole="header" aria-level={1} style={[titleStyle, styles.title]}>
            {title}
          </Text>
          {subtitle ? <Text style={[subtitleStyle, styles.subtitle]}>{subtitle}</Text> : null}
        </View>
        {action ? (
          <Button
            fullWidth={isMobile}
            label={action.label}
            icon={action.icon}
            loading={action.loading}
            disabled={action.disabled}
            onPress={action.onPress}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: space[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[4],
  },
  /** Il pulsante testuale ha un margine interno: si compensa perché il testo si allinei al titolo. */
  back: { alignSelf: 'flex-start', marginLeft: -space[4] },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  text: { flex: 1, gap: space[1] },
  title: { color: colors.text.primary },
  subtitle: { color: colors.text.secondary },
});
