import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
  | 'ritirato'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

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
  'in-attesa': { label: 'In attesa', icon: 'hourglass', tone: 'info' },
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
  success: { label: 'Completato', icon: 'circle-check', tone: 'success' },
  warning: { label: 'Attenzione', icon: 'circle-alert', tone: 'warning' },
  error: { label: 'Errore', icon: 'circle-alert', tone: 'error' },
  info: { label: 'Info', icon: 'info', tone: 'info' },
  neutral: { label: 'Neutro', icon: 'circle-check', tone: 'neutral' },
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
  /** Icona specifica opzionale al posto di quella predefinita dello stato. */
  icon?: IconName;
  /** Mostra solo l'icona (il testo resta come nome accessibile per lo screen reader). */
  iconOnly?: boolean;
  /**
   * Tooltip al passaggio del mouse (solo web). Se non specificato ma `iconOnly` è attivo,
   * usa automaticamente il testo dello stato così l'icona resta comprensibile.
   */
  tooltip?: string;
}

export function Badge({ status, label, icon, iconOnly = false, tooltip }: BadgeProps) {
  const spec = badgeStatuses[status] ?? badgeStatuses.neutral;
  const tone = tones[spec.tone] ?? tones.neutral;
  const textStyle = useTextStyle('label');
  const text = label?.trim() || spec.label;
  const iconName = icon ?? spec.icon;
  // Tooltip esplicito, oppure automatico col testo dello stato quando si mostra solo l'icona.
  const titoloTooltip = tooltip ?? (iconOnly ? text : undefined);
  return (
    <View
      accessible
      accessibilityLabel={text}
      // Su web `title` → attributo DOM title (tooltip nativo); `dataSet` → data-tooltip per
      // il tooltip CSS definito nel layout radice (RN Web non inoltra `title` sulle View).
      {...(Platform.OS === 'web' && titoloTooltip
        ? ({ title: titoloTooltip, dataSet: { tooltip: titoloTooltip } } as object)
        : null)}
      style={[
        styles.badge,
        iconOnly && styles.badgeIconOnly,
        { backgroundColor: tone.background, borderColor: tone.foreground },
      ]}
    >
      <Icon name={iconName} size="indicator" color={tone.foreground} />
      {iconOnly ? null : (
        <Text numberOfLines={1} style={[textStyle, styles.label, { color: tone.foreground }]}>
          {text}
        </Text>
      )}
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
  // Il testo resta su una riga: la pillola non si deforma in un ovale alto su due righe.
  label: { flexShrink: 1 },
  // Solo icona: padding simmetrico per una pastiglia compatta e regolare.
  badgeIconOnly: { paddingHorizontal: space[1] },
});
