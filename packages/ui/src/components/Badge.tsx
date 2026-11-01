import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { borderWidths, colors, radii, space } from '../tokens';
import { useTextStyle } from './internal';

export type BadgeStatus =
  | 'pagato'
  | 'da-pagare'
  | 'scaduto'
  | 'in-corso'
  | 'in-lavorazione'
  | 'completato'
  | 'non-letto'
  | 'in-attesa'
  | 'accettato';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** Un solo posto definisce testo, icona e colore di ogni stato: stesso significato ovunque. */
export const badgeStatuses: Record<BadgeStatus, { label: string; icon: IconName; tone: Tone }> = {
  pagato: { label: 'Pagato', icon: 'circle-check', tone: 'success' },
  'da-pagare': { label: 'Da pagare', icon: 'credit-card', tone: 'warning' },
  scaduto: { label: 'Scaduto', icon: 'circle-alert', tone: 'error' },
  'in-corso': { label: 'In corso', icon: 'clock', tone: 'info' },
  'in-lavorazione': { label: 'In lavorazione', icon: 'wrench', tone: 'info' },
  completato: { label: 'Completato', icon: 'check', tone: 'success' },
  'non-letto': { label: 'Non letto', icon: 'mail', tone: 'info' },
  'in-attesa': { label: 'In attesa', icon: 'hourglass', tone: 'neutral' },
  accettato: { label: 'Accettato', icon: 'circle-check', tone: 'success' },
};

const tones: Record<Tone, { foreground: string; background: string }> = {
  success: colors.semantic.success,
  warning: colors.semantic.warning,
  error: colors.semantic.error,
  info: colors.semantic.info,
  neutral: { foreground: colors.text.secondary, background: colors.background },
};

export interface BadgeProps {
  status: BadgeStatus;
}

export function Badge({ status }: BadgeProps) {
  const spec = badgeStatuses[status];
  const tone = tones[spec.tone];
  const textStyle = useTextStyle('label');
  return (
    <View
      accessible
      accessibilityLabel={spec.label}
      style={[styles.badge, { backgroundColor: tone.background, borderColor: tone.foreground }]}
    >
      <Icon name={spec.icon} size="indicator" color={tone.foreground} />
      <Text style={[textStyle, { color: tone.foreground }]}>{spec.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    borderWidth: borderWidths.thin,
  },
});
