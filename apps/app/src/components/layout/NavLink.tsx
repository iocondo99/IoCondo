import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Link, type Href } from 'expo-router';

interface NavLinkProps {
  href: string;
  /** Nome accessibile del link. */
  label: string;
  active: boolean;
  /** Stile sempre applicato. */
  style: StyleProp<ViewStyle>;
  /** Stile della voce attiva (sostituisce l'hover). */
  activeStyle?: StyleProp<ViewStyle>;
  /** Stile con il puntatore sopra o durante il tocco. */
  hoverStyle?: StyleProp<ViewStyle>;
  /** Stile con il focus da tastiera. */
  focusStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Link di navigazione. `Link asChild` di expo-router unisce gli stili del figlio come oggetti e scarta
 * quelli a funzione: per questo hover, tocco e focus si seguono con lo stato e lo stile resta statico.
 * Su web è un vero link (`<a>`): clic centrale e "apri in una nuova scheda" funzionano.
 */
export function NavLink({ href, label, active, style, activeStyle, hoverStyle, focusStyle, children }: NavLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Link href={href as Href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        aria-current={active ? 'page' : undefined}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Slot di expo-router non accetta array di stili: si passa un oggetto solo.
        style={StyleSheet.flatten([
          style,
          active ? activeStyle : hovered || pressed ? hoverStyle : null,
          focused ? focusStyle : null,
          Platform.OS === 'web' ? ({ cursor: 'pointer', textDecorationLine: 'none' } as ViewStyle) : null,
        ])}
      >
        {children}
      </Pressable>
    </Link>
  );
}
