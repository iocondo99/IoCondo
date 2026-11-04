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
  | 'aperto'
  | 'in-lavorazione'
  | 'in_lavorazione'
  | 'risolto'
  | 'completato'
  | 'non-letto'
  | 'in-attesa'
  | 'accettato'
  | 'preventivo'
  | 'consuntivo'
  | 'chiuso'
  | 'condominiale'
  | 'personale'
  | 'convocata'
  | 'conclusa'
  | 'annullata'
  | 'votazione-aperta'
  | 'votazione-chiusa'
  | 'in-giacenza'
  | 'ritirato';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** Un solo posto definisce testo, icona e colore di ogni stato: stesso significato ovunque. */
export const badgeStatuses: Record<BadgeStatus, { label: string; icon: IconName; tone: Tone }> = {
  pagato: { label: 'Pagato', icon: 'circle-check', tone: 'success' },
  'da-pagare': { label: 'Da pagare', icon: 'credit-card', tone: 'warning' },
  scaduto: { label: 'Scaduto', icon: 'circle-alert', tone: 'error' },
  'in-corso': { label: 'In corso', icon: 'clock', tone: 'info' },
  aperto: { label: 'Aperto', icon: 'circle-alert', tone: 'warning' },
  'in-lavorazione': { label: 'In lavorazione', icon: 'wrench', tone: 'info' },
  in_lavorazione: { label: 'In lavorazione', icon: 'wrench', tone: 'info' },
  risolto: { label: 'Risolto', icon: 'circle-check', tone: 'success' },
  completato: { label: 'Completato', icon: 'check', tone: 'success' },
  'non-letto': { label: 'Non letto', icon: 'mail', tone: 'info' },
  'in-attesa': { label: 'In attesa', icon: 'hourglass', tone: 'neutral' },
  accettato: { label: 'Accettato', icon: 'circle-check', tone: 'success' },
  preventivo: { label: 'Preventivo', icon: 'calendar-days', tone: 'info' },
  consuntivo: { label: 'Consuntivo', icon: 'circle-check', tone: 'success' },
  chiuso: { label: 'Chiuso', icon: 'lock', tone: 'neutral' },
  condominiale: { label: 'Condominiale', icon: 'building-2', tone: 'info' },
  personale: { label: 'Personale', icon: 'home', tone: 'neutral' },
  convocata: { label: 'Convocata', icon: 'calendar-days', tone: 'info' },
  conclusa: { label: 'Conclusa', icon: 'circle-check', tone: 'success' },
  annullata: { label: 'Annullata', icon: 'circle-alert', tone: 'neutral' },
  'votazione-aperta': { label: 'Aperta', icon: 'clock', tone: 'warning' },
  'votazione-chiusa': { label: 'Chiusa', icon: 'lock', tone: 'neutral' },
  'in-giacenza': { label: 'In giacenza', icon: 'package', tone: 'warning' },
  ritirato: { label: 'Ritirato', icon: 'package-check', tone: 'success' },
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
  /** Etichetta specifica (es. "Unità Int. 1") al posto di quella predefinita dello stato. */
  label?: string;
}

export function Badge({ status, label }: BadgeProps) {
  const spec = badgeStatuses[status];
  const tone = tones[spec.tone];
  const textStyle = useTextStyle('label');
  const text = label?.trim() || spec.label;
  return (
    <View
      accessible
      accessibilityLabel={text}
      style={[styles.badge, { backgroundColor: tone.background, borderColor: tone.foreground }]}
    >
      <Icon name={spec.icon} size="indicator" color={tone.foreground} />
      <Text style={[textStyle, { color: tone.foreground }]}>{text}</Text>
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
