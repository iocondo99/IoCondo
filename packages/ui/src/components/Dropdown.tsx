import React, { useEffect, useRef, useState } from 'react';
import {
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { Icon, type IconName } from '../Icon';
import { shadowStyle } from '../styles';
import { borderWidths, colors, controlSizes, radii, space, touchTarget } from '../tokens';
import { Button, type ButtonVariant } from './Button';
import { IconButton } from './IconButton';
import { placeMenu, type Placement } from './layoutMath';
import {
  cursorStyle,
  insetFocusStyle,
  keyboardProps,
  keyOf,
  moveFocusTo,
  useColorTransition,
  useTextStyle,
  type KeyEventLike,
  type PressState,
  type ViewRef,
} from './internal';

export interface DropdownItem {
  key: string;
  /** Testo esplicito: dice cosa succede (es. "Elimina documento", mai solo "Elimina"). */
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  /** Azione distruttiva: va in fondo, separata, in rosso e con icona. */
  destructive?: boolean;
}

export interface DropdownProps {
  /** Testo del pulsante. Con `iconOnly` diventa il nome accessibile (es. "Altre azioni"). */
  label: string;
  items: readonly DropdownItem[];
  /** Icona del pulsante. Con `iconOnly` il predefinito è "ellipsis". */
  icon?: IconName;
  iconOnly?: boolean;
  variant?: ButtonVariant;
  /** Da che lato del pulsante si allinea il menu. */
  align?: 'start' | 'end';
  disabled?: boolean;
}

/**
 * Menu a comparsa senza librerie. Il menu vive in un Modal trasparente di React
 * Native (come Modal): fluttua sopra i contenuti e non è ritagliato da contenitori
 * con overflow. Su web il Modal intrappola il focus, lo riporta al pulsante alla
 * chiusura e risponde a Escape solo se è il più in alto: se il menu sta dentro
 * un'altra modale, Escape chiude il menu e non la modale.
 * Tastiera: Invio/Spazio apre; frecce su/giù si spostano (in cerchio), Home/Fine,
 * Invio sceglie, Tab e Escape chiudono. Clic fuori chiude.
 */
export function Dropdown({
  label,
  items,
  icon,
  iconOnly = false,
  variant = 'secondary',
  align = 'start',
  disabled = false,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<ViewRef>(null);
  const itemRefs = useRef<Array<ViewRef | null>>([]);
  const focusedIndex = useRef(-1);
  const screen = useWindowDimensions();

  const enabled = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);

  const close = () => {
    setOpen(false);
    // Su nativo il focus dello screen reader torna al pulsante; su web lo fa già il Modal.
    setTimeout(() => moveFocusTo(triggerRef.current), 0);
  };

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setPlacement(
        placeMenu({
          anchor: { x, y, width, height },
          screen: { width: screen.width, height: screen.height },
          contentHeight: items.length * touchTarget.comfortable + borderWidths.thin * 2,
          minWidth: controlSizes.menuMinWidth,
          margin: space[2],
          gap: space[1],
          align,
        }),
      );
      setOpen(true);
    });
  };

  // Se la finestra cambia dimensione la posizione calcolata non vale più: il menu si chiude.
  const size = `${screen.width}x${screen.height}`;
  const lastSize = useRef(size);
  useEffect(() => {
    if (lastSize.current !== size) {
      lastSize.current = size;
      if (open) setOpen(false);
    }
  }, [size, open]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => moveFocusTo(itemRefs.current[enabled[0] ?? -1]), 50);
    return () => clearTimeout(timer);
    // Solo all'apertura: l'elenco delle voci può cambiare ad ogni render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const focusItem = (index: number | undefined) =>
    moveFocusTo(index === undefined ? null : itemRefs.current[index]);

  const onKeyDown = (event: KeyEventLike) => {
    const key = keyOf(event);
    const at = enabled.indexOf(focusedIndex.current);
    if (key === 'ArrowDown') {
      event.preventDefault?.();
      focusItem(enabled[(at + 1) % enabled.length]);
    } else if (key === 'ArrowUp') {
      event.preventDefault?.();
      focusItem(enabled[(at - 1 + enabled.length) % enabled.length]);
    } else if (key === 'Home') {
      event.preventDefault?.();
      focusItem(enabled[0]);
    } else if (key === 'End') {
      event.preventDefault?.();
      focusItem(enabled[enabled.length - 1]);
    } else if (key === 'Tab') {
      event.preventDefault?.();
      close();
    }
  };

  const choose = (item: DropdownItem) => {
    setOpen(false);
    item.onPress();
  };

  return (
    <>
      {iconOnly ? (
        <IconButton
          buttonRef={triggerRef}
          icon={icon ?? 'ellipsis'}
          accessibilityLabel={label}
          variant="secondary"
          disabled={disabled}
          onPress={openMenu}
          popup="menu"
          expanded={open}
        />
      ) : (
        <Button
          buttonRef={triggerRef}
          variant={variant}
          label={label}
          icon={icon ?? 'chevron-down'}
          iconPosition={icon ? 'start' : 'end'}
          disabled={disabled}
          popup="menu"
          expanded={open}
          onPress={openMenu}
        />
      )}
      {open && placement ? (
        <RNModal transparent visible animationType="none" onRequestClose={close}>
          <View style={styles.root}>
            <Pressable
              accessible={false}
              focusable={false}
              style={StyleSheet.absoluteFill}
              onPress={close}
            />
            <View
              role="menu"
              aria-label={label}
              accessibilityLabel={label}
              accessibilityViewIsModal
              {...keyboardProps(onKeyDown)}
              style={[
                styles.menu,
                placement.horizontal,
                placement.vertical,
                {
                  minWidth: placement.minWidth,
                  maxWidth: placement.maxWidth,
                  maxHeight: placement.maxHeight,
                },
              ]}
            >
              <View style={styles.clip}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  {items.map((item, index) => (
                    <MenuItem
                      key={item.key}
                      item={item}
                      separated={Boolean(item.destructive) && index > 0 && !items[index - 1]?.destructive}
                      itemRef={(node) => {
                        itemRefs.current[index] = node;
                      }}
                      onFocus={() => {
                        focusedIndex.current = index;
                      }}
                      onPress={() => choose(item)}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </RNModal>
      ) : null}
    </>
  );
}

function MenuItem({
  item,
  separated,
  itemRef,
  onFocus,
  onPress,
}: {
  item: DropdownItem;
  separated: boolean;
  itemRef: (node: ViewRef | null) => void;
  onFocus: () => void;
  onPress: () => void;
}) {
  const transition = useColorTransition();
  const textStyle = useTextStyle('body');
  const destructive = Boolean(item.destructive);
  const disabled = Boolean(item.disabled);
  const color = disabled
    ? colors.text.muted
    : destructive
      ? colors.semantic.error.foreground
      : colors.text.primary;
  // Le azioni distruttive hanno sempre un'icona: il rosso non è l'unico segnale.
  const icon: IconName | undefined = item.icon ?? (destructive ? 'trash-2' : undefined);

  return (
    <>
      {separated ? <View aria-hidden style={styles.divider} /> : null}
      <Pressable
        ref={itemRef}
        accessibilityRole="menuitem"
        accessibilityLabel={item.label}
        accessibilityState={{ disabled }}
        aria-disabled={disabled}
        disabled={disabled}
        onFocus={onFocus}
        onPress={onPress}
        style={({ hovered, pressed, focused }: PressState) => {
          const style: ViewStyle[] = [
            styles.item,
            {
              backgroundColor: pressed
                ? colors.border
                : hovered
                  ? destructive
                    ? colors.semantic.error.background
                    : colors.background
                  : colors.surface,
            },
          ];
          if (transition) style.push(transition);
          const cursor = cursorStyle(disabled);
          if (cursor) style.push(cursor);
          // Il menu ritaglia ciò che esce dal bordo: l'anello sta dentro la voce.
          const ring = insetFocusStyle(!!focused);
          if (ring) style.push(ring);
          return style;
        }}
      >
        {icon ? <Icon name={icon} size="action" color={color} /> : null}
        <Text style={[textStyle, styles.itemText, { color }]}>{item.label}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  menu: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.borderStrong,
    borderRadius: radii.control,
    ...shadowStyle('menu'),
  },
  clip: { overflow: 'hidden', borderRadius: radii.control, flexShrink: 1 },
  item: {
    minHeight: touchTarget.comfortable,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  itemText: { flex: 1 },
  divider: { height: borderWidths.thin, backgroundColor: colors.border },
});
