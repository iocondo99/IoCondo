import React from 'react';
import { View } from 'react-native';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  CircleHelp,
  Clock,
  Coins,
  CreditCard,
  FileText,
  Ellipsis,
  Eye,
  EyeOff,
  Hourglass,
  House,
  Inbox,
  Info,
  Lock,
  Mail,
  MessageCircle,
  Pencil,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Wrench,
  X,
  Calculator,
  Layers,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Phone,
  Shield,
  ShieldAlert,
  UserCog,
  UserPlus,
  UserCheck,
  UserX,
  Plus,
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
  check: Check,
  x: X,
  eye: Eye,
  'eye-off': EyeOff,
  'chevron-down': ChevronDown,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  clock: Clock,
  mail: Mail,
  hourglass: Hourglass,
  info: Info,
  'triangle-alert': TriangleAlert,
  'circle-x': CircleX,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  ellipsis: Ellipsis,
  pencil: Pencil,
  'trash-2': Trash2,
  'arrow-right': ArrowRight,
  lock: Lock,
  inbox: Inbox,
  'refresh-cw': RefreshCw,
  'building-2': Building2,
  'calculator': Calculator,
  'layers': Layers,
  'layout-dashboard': LayoutDashboard,
  'log-out': LogOut,
  'package': Package,
  'package-plus': PackagePlus,
  'package-check': PackageCheck,
  'panel-left-close': PanelLeftClose,
  'panel-left-open': PanelLeftOpen,
  'receipt': Receipt,
  'user-cog': UserCog,
  'user-plus': UserPlus,
  'user-check': UserCheck,
  'user-x': UserX,
  plus: Plus,
  phone: Phone,
  shield: Shield,
  'shield-alert': ShieldAlert,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'arrow-up-down': ArrowUpDown,
  upload: Upload,
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
  if (!Glyph) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[Icon] Icon "${name}" non trovata in iconMap.`);
    }
    return null;
  }
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
