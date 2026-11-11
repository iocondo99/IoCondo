import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../accessibility';
import { shadowStyle } from '../styles';
import { colors, feedbackSizes, focusRingInset, overlay, radii, space } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { IconButton } from './IconButton';
import { moveFocusTo, useTextStyle, type TextRef, type ViewRef } from './internal';

export interface ModalProps {
  visible: boolean;
  /** Chiamata da pulsante di chiusura, Escape (web), tasto indietro (Android) e clic sullo sfondo. */
  onClose: () => void;
  /** Titolo esplicito: dice cosa sta chiedendo la finestra. */
  title: string;
  /** Descrizione breve sotto il titolo. */
  description?: string;
  children?: React.ReactNode;
  /** Pulsanti in fondo alla finestra: usa `ModalActions` per disporli. */
  actions?: React.ReactNode;
  /** `false` blocca ogni chiusura (es. durante un invio). Il pulsante di chiusura si disattiva. */
  dismissible?: boolean;
  closeLabel?: string;
  /** Elemento che riceve il focus all'apertura. Se manca, il focus va alla finestra. */
  initialFocusRef?: React.RefObject<unknown>;
  /** Larghezza massima personalizzata della finestra (default: 560px da token). */
  maxWidth?: number;
}

// Una sola modale alla volta (sez. 13): la prima che si apre tiene il posto, le altre non vengono mostrate.
let activeModalId: string | null = null;

function useModalSlot(visible: boolean): boolean {
  const id = useId();
  const [granted, setGranted] = useState(false);

  useLayoutEffect(() => {
    if (!visible) return undefined;
    if (activeModalId !== null && activeModalId !== id) {
      if (__DEV__) console.warn('Modal: è già aperta un’altra finestra, questa non viene mostrata.');
      return undefined;
    }
    activeModalId = id;
    setGranted(true);
    return () => {
      if (activeModalId === id) activeModalId = null;
      setGranted(false);
    };
  }, [visible, id]);

  return visible && granted;
}

export function Modal({
  visible,
  onClose,
  title,
  description,
  children,
  actions,
  dismissible = true,
  closeLabel = 'Chiudi',
  initialFocusRef,
  maxWidth,
}: ModalProps) {
  const open = useModalSlot(visible);
  const { isMobile } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const titleStyle = useTextStyle('h3');
  const descriptionStyle = useTextStyle('body');
  const baseId = useId();
  const titleId = `${baseId}-titolo`;
  const descriptionId = `${baseId}-descrizione`;
  const cardRef = useRef<ViewRef>(null);
  const titleRef = useRef<TextRef>(null);

  // Focus nella finestra all'apertura. Il Modal di react-native-web lo intrappola e lo
  // riporta all'elemento di partenza alla chiusura; qui si sceglie solo il punto d'arrivo.
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      const target =
        initialFocusRef?.current ?? (Platform.OS === 'web' ? cardRef.current : titleRef.current);
      moveFocusTo(target);
    }, 50);
    return () => clearTimeout(timer);
  }, [open, initialFocusRef]);

  if (!open) return null;

  const requestClose = () => {
    if (dismissible) onClose();
  };
  // Su web il Modal inoltra queste proprietà al contenitore con ruolo "dialog".
  const dialogProps = {
    'aria-labelledby': titleId,
    'aria-describedby': description ? descriptionId : undefined,
  } as object;

  return (
    <RNModal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={requestClose}
      {...dialogProps}
    >
      <View style={styles.root}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />
        <Pressable
          accessible={false}
          focusable={false}
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
        />
        <View
          ref={cardRef}
          tabIndex={-1}
          accessibilityViewIsModal
          style={[
            styles.card,
            { padding: isMobile ? space[4] : space[6] },
            maxWidth ? { maxWidth } : null,
            noOutline,
          ]}
        >
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <Text
                ref={titleRef}
                id={titleId}
                accessibilityRole="header"
                aria-level={2}
                style={[titleStyle, styles.title]}
              >
                {title}
              </Text>
              {description ? (
                <Text id={descriptionId} style={[descriptionStyle, styles.description]}>
                  {description}
                </Text>
              ) : null}
            </View>
            <IconButton
              icon="x"
              accessibilityLabel={closeLabel}
              onPress={requestClose}
              disabled={!dismissible}
            />
          </View>
          {children ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={[
                styles.bodyContent,
                {
                  paddingRight: isMobile ? space[5] : space[6],
                  paddingBottom: isMobile ? space[4] : space[6],
                },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : null}
          {actions}
        </View>
      </View>
    </RNModal>
  );
}

export interface ModalActionsProps {
  /** Nell'ordine di lettura: l'ultimo pulsante è l'azione principale (es. Annulla, poi Conferma). */
  children: React.ReactElement<{ fullWidth?: boolean }> | React.ReactElement<{ fullWidth?: boolean }>[];
}

/**
 * Dispone i pulsanti in fondo a una finestra: in riga a destra su tablet e desktop
 * (azione principale all'estrema destra), impilati a tutta larghezza su smartphone
 * (azione principale in alto). L'ordine di tabulazione resta quello di lettura.
 */
export function ModalActions({ children }: ModalActionsProps) {
  const { isMobile } = useBreakpoint();
  const items = React.Children.toArray(children) as React.ReactElement<{ fullWidth?: boolean }>[];
  return (
    <View style={[styles.actions, isMobile ? styles.actionsStacked : styles.actionsRow]}>
      {items.map((item) => React.cloneElement(item, { fullWidth: isMobile }))}
    </View>
  );
}

// L'elemento che riceve il focus da programma non mostra l'anello: i controlli interni sì.
const noOutline: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : undefined;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
  },
  scrim: { backgroundColor: overlay.color, opacity: overlay.opacity },
  card: {
    width: '100%',
    maxWidth: feedbackSizes.modalMaxWidth,
    maxHeight: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.modal,
    gap: space[4],
    ...shadowStyle('modal'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  titleGroup: {
    flex: 1,
    gap: space[1],
  },
  title: { color: colors.brand.navy },
  description: { color: colors.text.secondary },
  // Il contenitore scorrevole ritaglia ciò che esce dal suo bordo, contorno di focus compreso:
  // il padding interno lo fa stare dentro, il margine negativo uguale lascia invariato il layout.
  body: { flexShrink: 1, minHeight: 0, margin: -focusRingInset },
  bodyContent: {
    gap: space[4],
    paddingTop: focusRingInset,
    paddingLeft: focusRingInset,
    paddingRight: space[4],
    paddingBottom: space[4],
  },
  actions: { gap: space[3] },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  actionsStacked: { flexDirection: 'column-reverse', alignItems: 'stretch' },
});
