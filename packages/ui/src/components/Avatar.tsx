import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { resolveFontFamily } from '../styles';
import { colors, controlSizes, radii } from '../tokens';

export type AvatarSize = keyof typeof controlSizes.avatar;

export interface AvatarProps {
  /** Nome della persona: serve per le iniziali. */
  name: string;
  /** Foto; se manca o non si carica si mostrano le iniziali. */
  imageUri?: string | null;
  size?: AvatarSize;
  /** Da impostare solo se l'avatar non è accanto al nome; altrimenti è decorativo. */
  accessibilityLabel?: string;
}

/** Prima lettera del primo e dell'ultimo nome, in maiuscolo. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function Avatar({ name, imageUri, size = 'md', accessibilityLabel }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = controlSizes.avatar[size];
  const showImage = !!imageUri && !failed;
  const initialsStyle: TextStyle = {
    fontFamily: resolveFontFamily('semibold'),
    fontSize: Math.round(dimension * 0.4),
    color: colors.text.inverse,
  };
  const labelProps = accessibilityLabel
    ? ({ accessible: true, role: 'img', 'aria-label': accessibilityLabel } as const)
    : ({ 'aria-hidden': true } as const);

  return (
    <View
      {...labelProps}
      style={[styles.circle, { width: dimension, height: dimension }]}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUri }}
          onError={() => setFailed(true)}
          style={{ width: dimension, height: dimension }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={initialsStyle} allowFontScaling={false}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radii.full,
    backgroundColor: colors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
