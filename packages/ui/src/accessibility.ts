import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, type ViewStyle } from 'react-native';
import { animationDurations, colors, focusRingSize, type Durations } from './tokens';

/**
 * Stile del focus visibile.
 * Web: outline attorno all'elemento, senza spostare il layout.
 * Nativo: React Native non ha outline, si usa un bordo dello stesso colore; i
 * componenti con bordo già presente devono sostituirlo con questo, per non
 * cambiare dimensione.
 */
export const focusRing: ViewStyle =
  Platform.OS === 'web'
    ? ({
        outlineColor: colors.focus,
        outlineWidth: focusRingSize.width,
        outlineOffset: focusRingSize.offset,
        outlineStyle: 'solid',
      } as ViewStyle)
    : { borderColor: colors.focus, borderWidth: focusRingSize.width };

interface MediaQueryLike {
  matches: boolean;
  addEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
  removeEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// matchMedia esiste solo su web: lo si legge da globalThis per non richiedere i tipi DOM.
function webReducedMotionQuery(): MediaQueryLike | null {
  const host = globalThis as unknown as { matchMedia?: (query: string) => MediaQueryLike };
  return host.matchMedia?.(REDUCED_MOTION_QUERY) ?? null;
}

/** true se l'utente ha chiesto di ridurre le animazioni (web: media query; nativo: impostazione di sistema). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () => Platform.OS === 'web' && (webReducedMotionQuery()?.matches ?? false),
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      const query = webReducedMotionQuery();
      if (!query) return undefined;
      const onChange = (event: { matches: boolean }) => setReduced(event.matches);
      setReduced(query.matches);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }

    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/** Durate delle animazioni: tutte 0 quando "riduci animazioni" è attivo. */
export function useAnimationDurations(): Durations {
  return animationDurations(useReducedMotion());
}
