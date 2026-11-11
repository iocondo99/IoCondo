import React, { useEffect, useRef, useState } from 'react';
import {
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../accessibility';
import { formatDate, type DateInput } from '../format';
import { Icon } from '../Icon';
import { resolveFontFamily, shadowStyle, tabularNumbers } from '../styles';
import {
  borderWidths,
  colors,
  dataSizes,
  focusRingInset,
  overlay,
  radii,
  space,
} from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { placeMenu, type Placement } from './layoutMath';
import { EmptyState, ErrorState } from './PageStates';
import { Skeleton } from './Skeleton';
import {
  cursorStyle,
  insetFocusStyle,
  moveFocusTo,
  useColorTransition,
  useTextStyle,
  visuallyHidden,
  type PressState,
  type ViewRef,
} from './internal';

export interface NotificationItem {
  id: string;
  title: string;
  /** Testo breve: una o due righe. */
  text?: string;
  date: DateInput;
  read: boolean;
}

export interface NotificationPanelProps {
  notifications: readonly NotificationItem[];
  /** Chiamata da "Segna tutte come lette". Il chiamante aggiorna i dati: il pannello non scrive nulla da solo. */
  onMarkAllRead: () => void | Promise<unknown>;
  /** Se presente ogni notifica è selezionabile (es. apre il dettaglio). */
  onSelect?: (notification: NotificationItem) => void;
  loading?: boolean;
  /** I dati non si sono caricati: il pannello mostra l'errore e "Riprova" invece di far credere che non ci siano notifiche. */
  error?: boolean;
  onRetry?: () => void | Promise<unknown>;
  /** Chiamata quando il pannello si apre (es. per aggiornare l'elenco). */
  onOpen?: () => void;
  /** Nome del pulsante e del pannello. */
  label?: string;
  /** Totale reale delle non lette, se l'elenco passato ne contiene solo una parte. Se manca si contano quelle passate. */
  unreadCount?: number;
  /** Quante non lette mostra il pannello al massimo; le altre si raggiungono con "Vedi altri". */
  maxItems?: number;
  /** Apre la pagina con tutte le notifiche. Se manca il pulsante in fondo non compare. */
  onViewAll?: () => void;
}

const COUNTER_MAX = 99;
const DEFAULT_MAX_ITEMS = 10;

/**
 * Campanella con contatore delle notifiche non lette e pannello a comparsa. Da tablet in su il
 * pannello sta sotto il pulsante; su smartphone è un foglio dal basso. Come Dropdown e Modal vive
 * in un Modal di React Native: intrappola il focus, Escape lo chiude e il focus torna alla campanella.
 * Il pannello mostra solo le non lette (una notifica letta sparisce) e al massimo `maxItems`.
 * Ogni notifica dice anche a parole se è letta o no: il colore non è l'unico segnale.
 */
export function NotificationPanel({
  notifications,
  onMarkAllRead,
  onSelect,
  loading = false,
  error = false,
  onRetry,
  onOpen,
  label = 'Notifiche',
  unreadCount,
  maxItems = DEFAULT_MAX_ITEMS,
  onViewAll,
}: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<ViewRef>(null);
  const panelRef = useRef<ViewRef>(null);
  const { isMobile } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const screen = useWindowDimensions();
  const counterStyle = useTextStyle('label');

  const unreadItems = notifications.filter((item) => !item.read);
  const shown = unreadItems.slice(0, maxItems);
  const unread = Math.max(unreadCount ?? unreadItems.length, unreadItems.length);
  const hidden = Math.max(0, unread - shown.length);
  const buttonLabel = unread > 0 ? `${label}, ${unread} non ${unread === 1 ? 'letta' : 'lette'}` : `${label}, nessuna nuova`;

  const close = () => {
    setOpen(false);
    // Su nativo il focus dello screen reader torna alla campanella; su web lo fa già il Modal.
    setTimeout(() => moveFocusTo(triggerRef.current), 0);
  };

  const openPanel = () => {
    onOpen?.();
    if (isMobile) return setOpen(true);
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setPlacement(
        placeMenu({
          anchor: { x, y, width, height },
          screen: { width: screen.width, height: screen.height },
          contentHeight: dataSizes.notificationListMaxHeight + dataSizes.headerMinHeight * 2,
          minWidth: dataSizes.notificationPanelWidth,
          margin: space[2],
          gap: space[1],
          // Allineato al bordo destro del pulsante; se a sinistra non c'è posto, al bordo sinistro.
          align: x + width - dataSizes.notificationPanelWidth >= space[2] ? 'end' : 'start',
        }),
      );
      setOpen(true);
    });
  };

  // Se la finestra cambia dimensione la posizione calcolata non vale più: il pannello si chiude.
  const size = `${screen.width}x${screen.height}`;
  const lastSize = useRef(size);
  useEffect(() => {
    if (lastSize.current !== size) {
      lastSize.current = size;
      if (open) setOpen(false);
    }
  }, [size, open]);

  // Focus nel pannello all'apertura; il Modal di react-native-web lo intrappola.
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => moveFocusTo(panelRef.current), 50);
    return () => clearTimeout(timer);
  }, [open]);

  const select = (item: NotificationItem) => {
    setOpen(false);
    onSelect?.(item);
  };

  const viewAll = onViewAll
    ? () => {
        setOpen(false);
        onViewAll();
      }
    : undefined;

  return (
    <>
      <View>
        <IconButton
          buttonRef={triggerRef}
          icon="bell"
          accessibilityLabel={buttonLabel}
          popup="dialog"
          expanded={open}
          onPress={openPanel}
        />
        {unread > 0 ? (
          <View aria-hidden pointerEvents="none" style={styles.counter}>
            <Text style={[counterStyle, styles.counterText, tabularNumbers]}>
              {unread > COUNTER_MAX ? `${COUNTER_MAX}+` : unread}
            </Text>
          </View>
        ) : null}
      </View>

      {open && (isMobile || placement) ? (
        <RNModal
          transparent
          visible
          animationType={isMobile && !reducedMotion ? 'slide' : 'none'}
          onRequestClose={close}
        >
          <View style={[styles.root, isMobile && styles.rootSheet]}>
            <Pressable
              accessible={false}
              focusable={false}
              style={[StyleSheet.absoluteFill, isMobile && styles.scrim]}
              onPress={close}
            />
            <View
              ref={panelRef}
              role="dialog"
              aria-label={label}
              accessibilityLabel={label}
              accessibilityViewIsModal
              tabIndex={-1}
              style={[
                styles.panel,
                noOutline,
                isMobile
                  ? styles.sheet
                  : [
                      placement?.horizontal,
                      placement?.vertical,
                      { width: placement?.minWidth, maxHeight: placement?.maxHeight },
                    ],
              ]}
            >
              <PanelContent
                label={label}
                notifications={shown}
                unread={unread}
                hidden={hidden}
                loading={loading}
                error={error}
                onRetry={onRetry}
                onMarkAllRead={onMarkAllRead}
                onSelect={onSelect ? select : undefined}
                onViewAll={viewAll}
                onClose={close}
              />
            </View>
          </View>
        </RNModal>
      ) : null}
    </>
  );
}

function PanelContent({
  label,
  notifications,
  unread,
  hidden,
  loading,
  error,
  onRetry,
  onMarkAllRead,
  onSelect,
  onViewAll,
  onClose,
}: {
  label: string;
  notifications: readonly NotificationItem[];
  unread: number;
  hidden: number;
  loading: boolean;
  error: boolean;
  onRetry?: () => void | Promise<unknown>;
  onMarkAllRead: () => void | Promise<unknown>;
  onSelect?: (notification: NotificationItem) => void;
  onViewAll?: () => void;
  onClose: () => void;
}) {
  const titleStyle = useTextStyle('h4');

  return (
    <>
      <View style={styles.header}>
        <Text accessibilityRole="header" aria-level={2} style={[titleStyle, styles.title]}>
          {label}
        </Text>
        <IconButton icon="x" accessibilityLabel="Chiudi notifiche" onPress={onClose} />
      </View>
      {notifications.length > 0 && !error ? (
        <View style={styles.toolbar}>
          <Button
            variant="text"
            label="Segna tutte come lette"
            icon="check"
            disabled={unread === 0}
            onPress={onMarkAllRead}
            loadingLabel="Aggiornamento…"
          />
        </View>
      ) : null}
      {loading ? (
        <View role="status" aria-live="polite" aria-busy style={styles.loading}>
          <View style={visuallyHidden}>
            <Text>Caricamento in corso…</Text>
          </View>
          {[0, 1, 2].map((key) => (
            <View key={key} aria-hidden style={styles.skeletonRow}>
              <Skeleton width="50%" />
              <Skeleton />
            </View>
          ))}
        </View>
      ) : error ? (
        <ErrorState
          title="Non riusciamo a mostrare le notifiche"
          description="Controlla la connessione e riprova."
          onRetry={onRetry}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Non hai notifiche da leggere"
          description="Quando arriva qualcosa di nuovo, lo trovi qui."
        />
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          <View role="list" aria-label={`${label}: ${unread} non ${unread === 1 ? 'letta' : 'lette'}`}>
            {notifications.map((item, index) => (
              <NotificationRow
                key={item.id}
                item={item}
                last={index === notifications.length - 1}
                onPress={onSelect ? () => onSelect(item) : undefined}
              />
            ))}
          </View>
        </ScrollView>
      )}
      {onViewAll && !loading && !error ? (
        <View style={styles.footer}>
          <Button
            variant="text"
            label={hidden > 0 ? `Vedi altri (${hidden})` : 'Tutte le notifiche'}
            icon="arrow-right"
            onPress={onViewAll}
          />
        </View>
      ) : null}
    </>
  );
}

function NotificationRow({
  item,
  last,
  onPress,
}: {
  item: NotificationItem;
  last: boolean;
  onPress?: () => void;
}) {
  const transition = useColorTransition();
  const titleStyle = useTextStyle('body');
  const textStyle = useTextStyle('secondary');
  const metaStyle = useTextStyle('label');
  const date = formatDate(item.date);

  const content = (
    <>
      <View style={styles.rowIcon}>
        <Icon
          name={item.read ? 'check' : 'mail'}
          size="action"
          color={item.read ? colors.text.muted : colors.action.default}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={[titleStyle, styles.rowTitle, item.read ? null : { fontFamily: resolveFontFamily('semibold') }]}>
          {item.title}
        </Text>
        {item.text ? (
          <Text numberOfLines={2} style={[textStyle, styles.rowBody]}>
            {item.text}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <Text style={[metaStyle, styles.rowBody, tabularNumbers]}>{date}</Text>
          <Text style={[metaStyle, { color: item.read ? colors.text.secondary : colors.action.default }]}>
            {item.read ? 'Letta' : 'Non letta'}
          </Text>
        </View>
      </View>
    </>
  );

  const nativeLabel = `${item.read ? 'Letta' : 'Non letta'}. ${item.title}.${item.text ? ` ${item.text}.` : ''} ${date}.`;

  return (
    <View role="listitem">
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={Platform.OS === 'web' ? undefined : nativeLabel}
          onPress={onPress}
          style={({ hovered, pressed, focused }: PressState) => {
            const style: ViewStyle[] = [
              styles.row,
              ...(last ? [] : [styles.rowDivider]),
              {
                backgroundColor: pressed
                  ? colors.border
                  : hovered
                    ? colors.background
                    : item.read
                      ? colors.surface
                      : colors.semantic.info.background,
              },
            ];
            if (transition) style.push(transition);
            const cursor = cursorStyle(false);
            if (cursor) style.push(cursor);
            const ring = insetFocusStyle(!!focused);
            if (ring) style.push(ring);
            return style;
          }}
        >
          {content}
        </Pressable>
      ) : (
        <View
          accessible={Platform.OS !== 'web'}
          accessibilityLabel={Platform.OS === 'web' ? undefined : nativeLabel}
          style={[
            styles.row,
            !last && styles.rowDivider,
            { backgroundColor: item.read ? colors.surface : colors.semantic.info.background },
          ]}
        >
          {content}
        </View>
      )}
    </View>
  );
}

// L'elemento che riceve il focus da programma non mostra l'anello: i controlli interni sì.
const noOutline: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : undefined;

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootSheet: { justifyContent: 'flex-end' },
  scrim: { backgroundColor: overlay.color, opacity: overlay.opacity },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.borderStrong,
    borderRadius: radii.card,
    overflow: 'hidden',
    position: 'absolute',
    ...shadowStyle('menu'),
  },
  sheet: {
    position: 'relative',
    width: '100%',
    maxHeight: '85%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    ...shadowStyle('modal'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingLeft: space[4],
    paddingRight: space[2],
    paddingVertical: space[2],
  },
  title: { flex: 1, color: colors.brand.navy },
  toolbar: {
    alignItems: 'flex-start',
    paddingHorizontal: space[2],
    paddingBottom: space[1],
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  // Il riquadro scorrevole ritaglia l'anello di focus delle righe: lo tiene dentro il margine interno.
  list: { flexShrink: 1, maxHeight: dataSizes.notificationListMaxHeight, padding: focusRingInset },
  loading: { padding: space[4], gap: space[4] },
  footer: {
    alignItems: 'flex-start',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
  },
  skeletonRow: { gap: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    minHeight: dataSizes.rowMinHeight,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  rowDivider: { borderBottomColor: colors.border },
  rowIcon: { paddingTop: space[1] },
  rowText: { flex: 1, gap: space[1], minWidth: 0 },
  rowTitle: { color: colors.text.primary },
  rowBody: { color: colors.text.secondary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  counter: {
    position: 'absolute',
    top: space[1],
    right: space[1],
    minWidth: dataSizes.counterSize,
    height: dataSizes.counterSize,
    paddingHorizontal: space[1],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructive.default,
    borderWidth: borderWidths.thin,
    borderColor: colors.surface,
  },
  counterText: { color: colors.text.inverse, textAlign: 'center' },
});
