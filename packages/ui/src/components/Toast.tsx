import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnimationDurations } from '../accessibility';
import { Icon } from '../Icon';
import { shadowStyle } from '../styles';
import {
  borderWidths,
  colors,
  feedbackSizes,
  radii,
  space,
  toastDurationFor,
  toastTiming,
  zIndices,
} from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { Button } from './Button';
import { feedbackTones, type FeedbackTone } from './feedbackTone';
import { IconButton } from './IconButton';
import { useTextStyle, type PressState } from './internal';

export interface ToastOptions {
  /** Predefinito: `success`. Per problemi che richiedono un intervento usa invece un `Alert` persistente. */
  tone?: FeedbackTone;
  message: string;
  title?: string;
  /** In ms. Mai meno di 5 secondi; i messaggi lunghi restano più a lungo. */
  duration?: number;
  action?: { label: string; onPress: () => void };
}

export interface ToastApi {
  /** Mette in coda un messaggio e ne restituisce l'identificativo. */
  show: (options: ToastOptions) => string;
  /** Chiude un messaggio, o quello visibile se non si indica l'identificativo. */
  dismiss: (id?: string) => void;
}

interface ToastItem extends ToastOptions {
  id: string;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast va usato dentro un ToastProvider.');
  return api;
}

let nextToastId = 1;

/** Mostra un solo messaggio alla volta: gli altri aspettano in coda, così non si sovrappongono. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const { isMobile } = useBreakpoint();

  const show = useCallback((options: ToastOptions) => {
    const id = `toast-${nextToastId++}`;
    setQueue((current) => {
      const [visible, ...waiting] = current;
      const kept = waiting.slice(-(toastTiming.maxQueued - 1));
      return visible ? [visible, ...kept, { ...options, id }] : [{ ...options, id }];
    });
    return id;
  }, []);

  const dismiss = useCallback((id?: string) => {
    setQueue((current) =>
      id ? current.filter((item) => item.id !== id) : current.slice(1),
    );
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);
  const visible = queue[0];

  return (
    <ToastContext.Provider value={api}>
      <View style={styles.root}>
        {children}
        {/* L'area è sempre presente: gli screen reader annunciano ciò che ci compare dentro. */}
        <View
          pointerEvents="box-none"
          aria-live="polite"
          style={[styles.viewport, { alignItems: isMobile ? 'stretch' : 'flex-end' }]}
        >
          {visible ? <ToastView key={visible.id} item={visible} onDismiss={() => dismiss(visible.id)} /> : null}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone = feedbackTones[item.tone ?? 'success'];
  const titleStyle = useTextStyle('h4');
  const messageStyle = useTextStyle('secondary');
  const { fast } = useAnimationDurations();
  const opacity = useRef(new Animated.Value(fast === 0 ? 1 : 0)).current;

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const remaining = useRef(toastDurationFor(item.message, item.duration));

  // Il conto alla rovescia si ferma con il mouse sopra o il focus dentro, e riprende dal punto in cui era.
  useEffect(() => {
    if (paused) return undefined;
    const startedAt = Date.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, onDismiss]);

  useEffect(() => {
    if (fast === 0) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: fast,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [fast, opacity]);

  // Su iOS la regione "live" non basta: si annuncia il testo a voce.
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(`${tone.label}. ${item.title ? `${item.title}. ` : ''}${item.message}`);
    }
  }, [item.message, item.title, tone.label]);

  return (
    <Animated.View style={[styles.toastWrap, { opacity }]}>
      <Pressable
        accessible={false}
        focusable={false}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={(_state: PressState) => [
          styles.toast,
          { backgroundColor: tone.colors.background, borderColor: tone.colors.foreground },
        ]}
      >
        <View role={tone.role} aria-live={tone.live} style={styles.content}>
          <View style={styles.icon}>
            <Icon name={tone.icon} size="action" color={tone.colors.foreground} accessibilityLabel={tone.label} />
          </View>
          <View style={styles.text}>
            {item.title ? <Text style={[titleStyle, styles.ink]}>{item.title}</Text> : null}
            <Text style={[messageStyle, styles.ink]}>{item.message}</Text>
            {item.action ? (
              <Button
                variant="text"
                label={item.action.label}
                onPress={() => {
                  item.action?.onPress();
                  onDismiss();
                }}
              />
            ) : null}
          </View>
        </View>
        <IconButton icon="x" accessibilityLabel="Chiudi la notifica" onPress={onDismiss} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewport: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space[4],
    zIndex: zIndices.toast,
  },
  toastWrap: { width: '100%', maxWidth: feedbackSizes.toastMaxWidth },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    paddingVertical: space[3],
    paddingLeft: space[4],
    paddingRight: space[2],
    borderWidth: borderWidths.thin,
    borderRadius: radii.card,
    ...shadowStyle('menu'),
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  icon: { paddingTop: space[1] },
  text: { flex: 1, gap: space[1], paddingTop: space[1] },
  ink: { color: colors.text.primary },
});
