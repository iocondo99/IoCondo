import React, { useId, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { borderWidths, colors, controlSizes, space, touchTarget } from '../tokens';
import {
  cursorStyle,
  focusElement,
  insetFocusStyle,
  keyboardProps,
  keyOf,
  useColorTransition,
  useTextStyle,
  type KeyEventLike,
  type PressState,
  type ViewRef,
} from './internal';

export interface TabItem {
  key: string;
  /** Nome breve della scheda (es. "Da pagare"). */
  label: string;
  icon?: IconName;
  disabled?: boolean;
  /** Contenuto mostrato quando la scheda è attiva. */
  content: React.ReactNode;
}

export interface TabsProps {
  /** Nome del gruppo di schede, letto dallo screen reader (es. "Sezioni dei pagamenti"). */
  label: string;
  tabs: readonly TabItem[];
  /** Chiave della scheda attiva. */
  value: string;
  onChange: (key: string) => void;
}

/**
 * Schede con attivazione automatica: spostarsi con le frecce apre subito la scheda.
 * Tastiera (web): Sinistra/Destra si spostano (in cerchio), Home e Fine vanno alla
 * prima e all'ultima. Solo la scheda attiva è raggiungibile con Tab; il pannello
 * sotto è a sua volta raggiungibile, così si può leggere con la tastiera.
 * La scheda attiva si riconosce anche senza colore: linea spessa sotto il titolo.
 */
export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  const baseId = useId();
  const refs = useRef<Array<ViewRef | null>>([]);
  const transition = useColorTransition();
  const labelStyle = useTextStyle('button');

  const enabled = tabs.map((tab, index) => (tab.disabled ? -1 : index)).filter((index) => index >= 0);
  const activeIndex = tabs.findIndex((tab) => tab.key === value);
  const tabStop = activeIndex >= 0 && enabled.includes(activeIndex) ? activeIndex : enabled[0];
  const active = tabs[activeIndex];

  const move = (to: number | undefined) => {
    const target = to === undefined ? undefined : tabs[to];
    if (to === undefined || !target) return;
    onChange(target.key);
    focusElement(refs.current[to]);
  };

  const onKeyDown = (index: number) => (event: KeyEventLike) => {
    const key = keyOf(event);
    const at = enabled.indexOf(index);
    if (key === 'ArrowRight') {
      event.preventDefault?.();
      move(enabled[(at + 1) % enabled.length]);
    } else if (key === 'ArrowLeft') {
      event.preventDefault?.();
      move(enabled[(at - 1 + enabled.length) % enabled.length]);
    } else if (key === 'Home') {
      event.preventDefault?.();
      move(enabled[0]);
    } else if (key === 'End') {
      event.preventDefault?.();
      move(enabled[enabled.length - 1]);
    }
  };

  const tabId = (key: string) => `${baseId}-scheda-${key}`;
  const panelId = (key: string) => `${baseId}-pannello-${key}`;

  return (
    <View style={styles.root}>
      <View style={styles.baseline}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View role="tablist" aria-label={label} accessibilityLabel={label} style={styles.list}>
            {tabs.map((tab, index) => {
              const selected = index === activeIndex;
              return (
                <View key={tab.key} {...keyboardProps(onKeyDown(index))}>
                  <Pressable
                    ref={(node) => {
                      refs.current[index] = node;
                    }}
                    id={tabId(tab.key)}
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected, disabled: tab.disabled }}
                    aria-selected={selected}
                    aria-disabled={tab.disabled}
                    aria-controls={selected ? panelId(tab.key) : undefined}
                    tabIndex={index === tabStop ? 0 : -1}
                    disabled={tab.disabled}
                    onPress={() => onChange(tab.key)}
                    style={({ hovered, pressed, focused }: PressState) => {
                      const style: ViewStyle[] = [
                        styles.tab,
                        {
                          borderBottomColor: selected ? colors.action.default : 'transparent',
                          backgroundColor: pressed
                            ? colors.border
                            : hovered && !selected
                              ? colors.background
                              : 'transparent',
                        },
                      ];
                      if (transition) style.push(transition);
                      const cursor = cursorStyle(!!tab.disabled);
                      if (cursor) style.push(cursor);
                      // La riga scorre in orizzontale e ritaglia: l'anello sta dentro la scheda.
                      const ring = insetFocusStyle(!!focused);
                      if (ring) style.push(ring);
                      return style;
                    }}
                  >
                    {({ hovered }: PressState) => {
                      const color = tab.disabled
                        ? colors.text.muted
                        : selected
                          ? colors.brand.navy
                          : hovered
                            ? colors.text.primary
                            : colors.text.secondary;
                      return (
                        <View style={styles.tabContent}>
                          {tab.icon ? <Icon name={tab.icon} size="action" color={color} /> : null}
                          <Text style={[labelStyle, { color }]}>{tab.label}</Text>
                        </View>
                      );
                    }}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
      {active ? (
        <View
          id={panelId(active.key)}
          role="tabpanel"
          aria-labelledby={tabId(active.key)}
          accessibilityLabel={active.label}
          tabIndex={0}
          style={styles.panel}
        >
          {active.content}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: space[4] },
  // La linea di base sta fuori dallo scorrimento: le schede non la sovrappongono, quindi nulla viene ritagliato.
  baseline: { borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border },
  scroll: { flexGrow: 0 },
  scrollContent: { flexGrow: 1 },
  list: { flexDirection: 'row', alignItems: 'flex-end' },
  tab: {
    minHeight: touchTarget.comfortable,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    justifyContent: 'center',
    borderBottomWidth: controlSizes.tabIndicator,
  },
  tabContent: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  panel: { alignSelf: 'stretch' },
});
