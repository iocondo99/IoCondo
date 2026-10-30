/**
 * Fonte unica dei valori visivi (DESIGN_SYSTEM.md, sez. 2, 3, 4, 9, 16, 17, 18, 21).
 * Nessun colore o misura va scritto a mano altrove: si importa da qui.
 *
 * File volutamente puro (nessun import da react-native): così si testa con
 * `node --test` e resta utilizzabile sia su nativo sia su web.
 */

// Valori grezzi: non esportati. Ogni valore compare una sola volta.
const palette = {
  navy: '#0D3B66',
  blue: '#0EA5E9',
  teal: '#14B8A6',
  blueFocus: '#0284C7',
  actionDefault: '#0A79AB',
  actionHover: '#096C99',
  actionPressed: '#085F86',
  white: '#FFFFFF',
  gray200: '#E5E7EB',
  slate50: '#F8FAFC',
  slate300: '#CBD5E1',
  slate500: '#64748B',
  slate600: '#475569',
  slate900: '#0F172A',
  green700: '#15803D',
  green50: '#F0FDF4',
  amber700: '#B45309',
  amber50: '#FFFBEB',
  red700: '#B91C1C',
  red50: '#FEF2F2',
  sky700: '#0369A1',
  sky50: '#F0F9FF',
} as const;

export const colors = {
  brand: {
    navy: palette.navy,
    blue: palette.blue,
    teal: palette.teal,
  },
  /**
   * Blu d'azione: sfondo dei pulsanti primari, testo dei link, voce attiva della
   * sidebar. Il brand `blue` non raggiunge 4,5:1 col bianco: resta per sfondi di
   * icone, accenti e decorazioni, mai come sfondo di testo bianco piccolo.
   */
  action: {
    default: palette.actionDefault,
    hover: palette.actionHover,
    pressed: palette.actionPressed,
  },
  background: palette.slate50,
  surface: palette.white,
  border: palette.gray200,
  borderStrong: palette.slate300,
  text: {
    primary: palette.slate900,
    secondary: palette.slate600,
    muted: palette.slate500,
    disabled: palette.slate300,
    inverse: palette.white,
  },
  focus: palette.blueFocus,
  semantic: {
    success: { foreground: palette.green700, background: palette.green50 },
    warning: { foreground: palette.amber700, background: palette.amber50 },
    error: { foreground: palette.red700, background: palette.red50 },
    info: { foreground: palette.sky700, background: palette.sky50 },
  },
} as const;

/** Scala di spaziatura a multipli di 4 px (sez. 4). */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

/** Angoli arrotondati (sez. 4). `full` serve ad avatar e pillole. */
export const radii = {
  control: 8,
  card: 12,
  modal: 16,
  badge: 6,
  full: 9999,
} as const;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';
export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'secondary'
  | 'label'
  | 'support'
  | 'button';

/**
 * Tipografia (sez. 3). Le dimensioni sono gli estremi degli intervalli della
 * tabella: `compact` (min) per smartphone, `regular` (max) da tablet in su.
 * I nomi dei font sono quelli registrati da @expo-google-fonts/inter: su
 * nativo il peso è parte del nome della famiglia.
 */
export const typography = {
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  /** Fallback di sistema, usato su web finché Inter non è caricato. */
  webFallbackStack:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  variants: {
    h1: { fontSize: { compact: 28, regular: 32 }, weight: 'bold', lineHeightRatio: 1.25 },
    h2: { fontSize: { compact: 22, regular: 24 }, weight: 'semibold', lineHeightRatio: 1.3 },
    h3: { fontSize: { compact: 18, regular: 20 }, weight: 'semibold', lineHeightRatio: 1.3 },
    h4: { fontSize: { compact: 16, regular: 18 }, weight: 'semibold', lineHeightRatio: 1.4 },
    body: { fontSize: { compact: 16, regular: 16 }, weight: 'regular', lineHeightRatio: 1.5 },
    secondary: { fontSize: { compact: 14, regular: 15 }, weight: 'regular', lineHeightRatio: 1.5 },
    label: { fontSize: { compact: 14, regular: 14 }, weight: 'medium', lineHeightRatio: 1.4 },
    support: { fontSize: { compact: 14, regular: 16 }, weight: 'regular', lineHeightRatio: 1.5 },
    button: { fontSize: { compact: 15, regular: 16 }, weight: 'semibold', lineHeightRatio: 1.25 },
  },
} as const satisfies {
  fontFamily: Record<FontWeightName, string>;
  webFallbackStack: string;
  variants: Record<
    TextVariant,
    { fontSize: { compact: number; regular: number }; weight: FontWeightName; lineHeightRatio: number }
  >;
};

/** Ombre leggere (sez. 4). Le schede usano di norma il bordo, non l'ombra. */
export const shadows = {
  card: { color: palette.slate900, offsetY: 1, blur: 2, opacity: 0.05, elevation: 1 },
  menu: { color: palette.slate900, offsetY: 4, blur: 12, opacity: 0.1, elevation: 4 },
  modal: { color: palette.slate900, offsetY: 8, blur: 24, opacity: 0.16, elevation: 8 },
} as const;

/** Aree di tocco (sez. 17): 24 minimo WCAG, 44-48 per i controlli principali. */
export const touchTarget = {
  minimum: 24,
  control: 44,
  comfortable: 48,
} as const;

/** Anello di focus (sez. 17): lo spessore e la distanza; il colore è `colors.focus`. */
export const focusRingSize = {
  width: 2,
  offset: 2,
} as const;

/** Dimensioni di layout (sez. 5 e 21.1). */
export const layout = {
  sidebarWidth: 240,
  headerHeight: 72,
} as const;

/** Icone (sez. 9): un'unica famiglia lineare, tratto uniforme. */
export const iconSizes = {
  indicator: 16,
  action: 20,
  menu: 22,
  card: 24,
} as const;
export const iconStrokeWidth = 2;

export type IconSizeName = keyof typeof iconSizes;

/** Breakpoint (sez. 16): mobile <768, tablet 768-1199, desktop >=1200. */
export const breakpoints = {
  tablet: 768,
  desktop: 1200,
} as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function breakpointFor(width: number): Breakpoint {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
}

/** Durate delle animazioni in ms (sez. 18: 120-200). */
export const durations = {
  fast: 120,
  normal: 160,
  slow: 200,
} as const;

export type Durations = { readonly [K in keyof typeof durations]: number };

/** Con "riduci animazioni" attivo tutte le durate valgono 0 (sez. 17 e 18). */
export function animationDurations(reducedMotion: boolean): Durations {
  if (!reducedMotion) return durations;
  return { fast: 0, normal: 0, slow: 0 };
}
