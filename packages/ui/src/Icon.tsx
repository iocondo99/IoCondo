import React from 'react';
import { View } from 'react-native';
import {
  Bell,
  CalendarDays,
  CircleHelp,
  Coins,
  CreditCard,
  FileText,
  House,
  MessageCircle,
  Search,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, iconSizes, iconStrokeWidth, type IconSizeName } from './tokens';

/** Icone previste dalla sezione 9. Unica libreria ammessa: Lucide. */
export const iconMap = {
  home: House,
  coins: Coins,
  'credit-card': CreditCard,
  'file-text': FileText,
  'message-circle': MessageCircle,
  users: Users,
  'calendar-days': CalendarDays,
  wrench: Wrench,
  settings: Settings,
  'circle-help': CircleHelp,
  bell: Bell,
  search: Search,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;

export interface IconProps {
  name: IconName;
  /** indicator 16, action 20, menu 22, card 24 (vedi `iconSizes`). */
  size?: IconSizeName;
  color?: string;
  /** Senza etichetta l'icona è decorativa e nascosta agli screen reader. */
  accessibilityLabel?: string;
}

export function Icon({
  name,
  size = 'action',
  color = colors.text.primary,
  accessibilityLabel,
}: IconProps) {
  const Glyph = iconMap[name];
  const glyph = <Glyph size={iconSizes[size]} color={color} strokeWidth={iconStrokeWidth} />;

  if (accessibilityLabel) {
    return (
      <View accessible role="img" aria-label={accessibilityLabel}>
        {glyph}
      </View>
    );
  }
  return <View aria-hidden>{glyph}</View>;
}
