import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { borderWidths, colors, feedbackSizes, radii, space, touchTarget } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { Badge, type BadgeStatus } from './Badge';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { useTextStyle } from './internal';

export type StatTile = keyof typeof colors.tile;

export interface StatCardAction {
  label: string;
  onPress: () => void;
  /** `primary` per l'azione che richiede un intervento (es. "Paga ora"), `secondary` per le altre. */
  variant?: 'primary' | 'secondary';
  accessibilityHint?: string;
}

export interface StatCardProps {
  icon: IconName;
  /** Colore della tessera dell'icona (token condivisi, sez. 2). */
  tile?: StatTile;
  title: string;
  /** Valore principale, già formattato (es. "€ 2.480,00"). */
  value: string;
  description?: string;
  status?: BadgeStatus;
  /** Se manca, nessun pulsante: non presentare azioni che l'utente non può eseguire. */
  action?: StatCardAction;
  /** Segnaposto con le stesse misure della scheda vera: caricando, le schede non saltano. */
  loading?: boolean;
  /** La scheda non ha potuto caricare il suo dato: messaggio breve e "Riprova" che ricarica solo questo blocco. */
  error?: { message: string; onRetry: () => void | Promise<unknown> };
}

export function StatCard({
  icon,
  tile = 'blue',
  title,
  value,
  description,
  status,
  action,
  loading = false,
  error,
}: StatCardProps) {
  const { isMobile } = useBreakpoint();
  const titleStyle = useTextStyle('h4');
  const valueStyle = useTextStyle(isMobile ? 'h3' : 'h2');
  const descriptionStyle = useTextStyle('secondary');
  const palette = colors.tile[tile];

  if (loading) {
    return (
      <View
        role="status"
        aria-busy
        aria-label={`${title}: caricamento in corso`}
        style={[styles.card, { padding: isMobile ? space[4] : space[5] }]}
      >
        <View style={styles.body}>
          <View style={styles.skeletonTile}>
            <Skeleton shape="block" width={feedbackSizes.tile} height={feedbackSizes.tile} />
          </View>
          <Skeleton width="70%" height={Number(titleStyle.lineHeight)} />
          <Skeleton width="50%" height={Number(valueStyle.lineHeight)} />
          <Skeleton width="60%" height={Number(descriptionStyle.lineHeight)} />
        </View>
        <Skeleton shape="block" height={touchTarget.control} />
      </View>
    );
  }

  if (error) {
    return (
      <View role="alert" style={[styles.card, { padding: isMobile ? space[4] : space[5] }]}>
        <View style={styles.body}>
          <View style={[styles.tile, { backgroundColor: colors.semantic.error.background }]}>
            <Icon name="circle-alert" size="card" color={colors.semantic.error.foreground} />
          </View>
          <Text style={[titleStyle, styles.title]}>{title}</Text>
          <Text style={[descriptionStyle, styles.description]}>{error.message}</Text>
        </View>
        <Button fullWidth variant="secondary" label="Riprova" icon="refresh-cw" onPress={error.onRetry} />
      </View>
    );
  }

  return (
    <View style={[styles.card, { padding: isMobile ? space[4] : space[5] }]}>
      <View style={styles.body}>
        <View style={[styles.tile, { backgroundColor: palette.background }]}>
          <Icon name={icon} size="card" color={palette.foreground} />
        </View>
        <Text style={[titleStyle, styles.title]}>{title}</Text>
        <Text style={[valueStyle, styles.value]}>{value}</Text>
        {description ? <Text style={[descriptionStyle, styles.description]}>{description}</Text> : null}
        {status ? <Badge status={status} /> : null}
      </View>
      {action ? (
        <Button
          fullWidth
          variant={action.variant ?? 'primary'}
          label={action.label}
          onPress={action.onPress}
          accessibilityHint={action.accessibilityHint}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    gap: space[4],
  },
  body: { gap: space[1] },
  skeletonTile: { marginBottom: space[2] },
  tile: {
    width: feedbackSizes.tile,
    height: feedbackSizes.tile,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  title: { color: colors.text.primary },
  value: { color: colors.brand.navy },
  description: { color: colors.text.secondary },
});
