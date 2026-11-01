import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { voceAttiva } from '@iocondo/data';
import type { INavVoce } from '@iocondo/shared-types';
import {
  Icon,
  borderWidths,
  colors,
  focusRingSize,
  layout,
  radii,
  resolveFontFamily,
  space,
  textStyle,
  touchTarget,
  useBreakpoint,
  type PressState,
} from '@iocondo/ui';
import { BrandMark } from '@/components/Brand';
import { NavLink } from './NavLink';
import { iconaDi } from './navigation';

interface SidebarProps {
  voci: readonly INavVoce[];
  /** Solo icone, con il nome accessibile (tablet). */
  compressa: boolean;
  /** Mostra il pulsante per aprire o chiudere il menu (tablet). */
  comprimibile: boolean;
  onToggle: () => void;
}

/**
 * Menu laterale navy (sez. 5.1): logo, voci con icona, "Assistenza" in fondo. Voce attiva con sfondo Action,
 * indicatore laterale blu brillante, testo più marcato e `aria-current`: si riconosce anche senza colore.
 * Su sfondo navy il focus è bianco: il blu #0284C7 sul navy non raggiunge 3:1.
 */
export function Sidebar({ voci, compressa, comprimibile, onToggle }: SidebarProps) {
  const percorso = usePathname();
  const { breakpoint } = useBreakpoint();
  const attiva = voceAttiva(voci, percorso);
  const principali = voci.filter((v) => v.id !== 'assistenza');
  const assistenza = voci.find((v) => v.id === 'assistenza');

  return (
    <View
      role="navigation"
      aria-label="Menu principale"
      accessibilityLabel="Menu principale"
      style={[styles.root, { width: compressa ? layout.sidebarCollapsedWidth : layout.sidebarWidth }]}
    >
      <View style={[styles.brand, compressa && styles.brandCompressa]}>
        <BrandMark compact={compressa} noTagline={false} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
        {principali.map((voce) => (
          <Voce key={voce.id} voce={voce} attiva={attiva?.id === voce.id} compressa={compressa} />
        ))}
      </ScrollView>
      <View style={styles.fondo}>
        {assistenza ? <Voce voce={assistenza} attiva={attiva?.id === assistenza.id} compressa={compressa} /> : null}
        {comprimibile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={compressa ? 'Espandi il menu' : 'Comprimi il menu'}
            accessibilityState={{ expanded: !compressa }}
            aria-expanded={!compressa}
            onPress={onToggle}
            style={({ hovered, pressed, focused }: PressState) => [
              styles.voce,
              compressa && styles.voceCompressa,
              hovered || pressed ? { backgroundColor: colors.sidebar.hover } : null,
              focused ? focusBianco : null,
              Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
            ]}
          >
            <Icon name={compressa ? 'panel-left-open' : 'panel-left-close'} size="menu" color={colors.text.inverse} />
            {compressa ? null : (
              <Text style={[textStyle('body', breakpoint), styles.testo]}>Comprimi il menu</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Voce({ voce, attiva, compressa }: { voce: INavVoce; attiva: boolean; compressa: boolean }) {
  const { breakpoint } = useBreakpoint();
  return (
    <NavLink
      href={voce.route}
      label={voce.label}
      active={attiva}
      style={[styles.voce, compressa && styles.voceCompressa]}
      activeStyle={styles.voceAttiva}
      hoverStyle={styles.voceHover}
      focusStyle={focusBianco}
    >
      {attiva ? <View aria-hidden style={styles.indicatore} /> : null}
      <Icon name={iconaDi(voce)} size="menu" color={colors.text.inverse} />
      {compressa ? null : (
        <Text
          numberOfLines={1}
          style={[
            textStyle('body', breakpoint),
            styles.testo,
            attiva ? { fontFamily: resolveFontFamily('semibold') } : null,
          ]}
        >
          {voce.label}
        </Text>
      )}
    </NavLink>
  );
}

// Anello di focus bianco dentro la voce: la lista scorre e ritaglia ciò che esce dal bordo.
const focusBianco: ViewStyle =
  Platform.OS === 'web'
    ? ({
        outlineColor: colors.text.inverse,
        outlineWidth: focusRingSize.width,
        outlineOffset: -focusRingSize.width,
        outlineStyle: 'solid',
      } as ViewStyle)
    : { borderColor: colors.text.inverse };

const styles = StyleSheet.create({
  root: { backgroundColor: colors.sidebar.background, paddingVertical: space[4] },
  brand: { paddingHorizontal: space[4], paddingBottom: space[4] },
  brandCompressa: { alignItems: 'center', paddingHorizontal: space[2] },
  scroll: { flex: 1 },
  lista: { paddingHorizontal: space[3], gap: space[1] },
  fondo: { paddingHorizontal: space[3], paddingTop: space[3], gap: space[1] },
  voce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: touchTarget.comfortable,
    paddingHorizontal: space[3],
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  voceCompressa: { justifyContent: 'center', paddingHorizontal: 0 },
  voceAttiva: { backgroundColor: colors.action.default },
  voceHover: { backgroundColor: colors.sidebar.hover },
  indicatore: {
    // Sul bordo della sidebar, sul navy: il blu brillante vi ha contrasto >= 3:1.
    position: 'absolute',
    left: -space[3],
    top: space[2],
    bottom: space[2],
    width: layout.navIndicator,
    borderRadius: radii.full,
    backgroundColor: colors.brand.blue,
  },
  testo: { color: colors.text.inverse, flexShrink: 1 },
});
