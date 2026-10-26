import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export interface XLButtonProps {
  title: string;
  subtitle?: string;
  icon?: string;
  variant?: 'primary' | 'amber' | 'green' | 'outline' | 'phone';
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

/**
 * Componente XL Senior-Friendly (WCAG AAA):
 * - Altezza minima >= 62px (specifica >= 58px)
 * - Angoli arrotondati 14px
 * - Usa esclusivamente primitive native (Pressable, View, Text)
 * - Contrasto elevatissimo per lettura senza occhiali
 */
export function XLButton({
  title,
  subtitle,
  icon,
  variant = 'primary',
  onPress,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
}: XLButtonProps) {
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const palette = VARIANT_STYLES[variant];

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.buttonBase,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.6 : pressed ? 0.86 : 1,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {icon ? <Text style={styles.iconText}>{icon}</Text> : null}
        <View style={styles.textColumn}>
          <Text style={[styles.titleText, { color: palette.text }, textStyle]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitleText, { color: palette.subtext }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const VARIANT_STYLES: Record<
  NonNullable<XLButtonProps['variant']>,
  { bg: string; border: string; text: string; subtext: string }
> = {
  primary: {
    bg: '#0F172A',
    border: '#0F172A',
    text: '#FFFFFF',
    subtext: '#E2E8F0',
  },
  amber: {
    bg: '#B45309',
    border: '#78350F',
    text: '#FFFFFF',
    subtext: '#FEF3C7',
  },
  green: {
    bg: '#047857',
    border: '#064E3B',
    text: '#FFFFFF',
    subtext: '#D1FAE5',
  },
  outline: {
    bg: '#FFFFFF',
    border: '#0F172A',
    text: '#0F172A',
    subtext: '#334155',
  },
  phone: {
    bg: '#1D4ED8',
    border: '#1E3A8A',
    text: '#FFFFFF',
    subtext: '#DBEAFE',
  },
};

const styles = StyleSheet.create({
  buttonBase: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 2.5,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconText: {
    fontSize: 28,
  },
  textColumn: {
    flexShrink: 1,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
});
