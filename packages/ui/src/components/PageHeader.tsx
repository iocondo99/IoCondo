import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../Icon';
import { borderWidths, colors, space } from '../tokens';
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
  /** Azione secondaria opzionale (es. "Nuova cartella"), affiancata alla primaria. */
  secondaryAction?: PageHeaderAction;
  breadcrumbs?: readonly BreadcrumbItem[];
  /** Se presente compare il pulsante "Indietro" sopra il titolo. */
  onBack?: () => void;
}

/**
 * Intestazione di pagina (sez. 5.3): titolo, sottotitolo e azioni principali. Da tablet
 * in su l'azione sta a destra del titolo; su smartphone va sotto, a tutta larghezza.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  secondaryAction,
  breadcrumbs,
  onBack,
}: PageHeaderProps) {
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
        {action || secondaryAction ? (
          <View style={[styles.actionsGroup, isMobile && styles.actionsGroupMobile]}>
            {secondaryAction ? (
              <Button
                variant="secondary"
                fullWidth={isMobile}
                label={secondaryAction.label}
                icon={secondaryAction.icon}
                loading={secondaryAction.loading}
                disabled={secondaryAction.disabled}
                onPress={secondaryAction.onPress}
              />
            ) : null}
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
  /** Il pulsante testuale ha padding e bordo: si compensano perché l'icona si allinei al titolo. */
  back: { alignSelf: 'flex-start', marginLeft: -(space[5] + borderWidths.thin) },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  text: { flex: 1, gap: space[1] },
  title: { color: colors.text.primary },
  subtitle: { color: colors.text.secondary },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flexWrap: 'wrap',
  },
  actionsGroupMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: space[2],
  },
});
