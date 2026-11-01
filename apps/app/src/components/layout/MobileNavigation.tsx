import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { voceAttiva, type NavigazioneMobile } from '@iocondo/data';
import type { INavVoce } from '@iocondo/shared-types';
import {
  Icon,
  borderWidths,
  colors,
  focusRing,
  layout,
  radii,
  resolveFontFamily,
  space,
  textStyle,
  useBreakpoint,
  type IconName,
  type PressState,
} from '@iocondo/ui';
import { NavLink } from './NavLink';
import { iconaDi } from './navigation';

/** Pagina che raccoglie le voci che non stanno nella barra, i selettori e "Esci". */
export const ROTTA_ALTRO = '/altro';

/**
 * Barra in basso dello smartphone (sez. 16.3): al massimo 4 voci più "Altro". La voce attiva ha una linea
 * sopra l'icona, il testo più marcato e `aria-current`: si riconosce anche senza colore.
 */
export function MobileNavigation({
  navigazione,
  tutte,
}: {
  navigazione: NavigazioneMobile;
  tutte: readonly INavVoce[];
}) {
  const percorso = usePathname();
  const attiva = voceAttiva(tutte, percorso);
  const inAltro = percorso === ROTTA_ALTRO || (attiva ? navigazione.altre.some((v) => v.id === attiva.id) : false);

  return (
    <View role="navigation" aria-label="Menu principale" accessibilityLabel="Menu principale" style={styles.root}>
      {navigazione.barra.map((voce) => (
        <Elemento
          key={voce.id}
          href={voce.route}
          etichetta={voce.label}
          icona={iconaDi(voce)}
          attiva={!inAltro && attiva?.id === voce.id}
        />
      ))}
      {navigazione.altre.length > 0 ? (
        <Elemento href={ROTTA_ALTRO} etichetta="Altro" icona="ellipsis" attiva={inAltro} />
      ) : null}
    </View>
  );
}

function Elemento({ href, etichetta, icona, attiva }: { href: string; etichetta: string; icona: IconName; attiva: boolean }) {
  const { breakpoint } = useBreakpoint();
  return (
    <NavLink
      href={href}
      label={etichetta}
      active={attiva}
      style={styles.elemento}
      hoverStyle={styles.elementoHover}
      focusStyle={focus}
    >
      {attiva ? <View aria-hidden style={styles.linea} /> : null}
      <Icon name={icona} size="menu" color={attiva ? colors.action.default : colors.text.secondary} />
      <Text
        numberOfLines={1}
        style={[
          textStyle('label', breakpoint),
          { color: attiva ? colors.action.default : colors.text.secondary },
          attiva ? { fontFamily: resolveFontFamily('semibold') } : null,
        ]}
      >
        {etichetta}
      </Text>
    </NavLink>
  );
}

// Anello di focus dentro l'elemento: la barra è a filo con i bordi dello schermo.
const focus: ViewStyle =
  Platform.OS === 'web' ? ({ ...focusRing, outlineOffset: -2 } as ViewStyle) : { borderColor: colors.focus };

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    minHeight: layout.bottomBarHeight,
    backgroundColor: colors.surface,
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  elemento: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    paddingVertical: space[2],
    borderRadius: radii.control,
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  elementoHover: { backgroundColor: colors.background },
  linea: {
    position: 'absolute',
    top: 0,
    left: space[3],
    right: space[3],
    height: layout.navIndicator,
    borderBottomLeftRadius: radii.full,
    borderBottomRightRadius: radii.full,
    backgroundColor: colors.action.default,
  },
});
