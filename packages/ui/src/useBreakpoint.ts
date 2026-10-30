import { useWindowDimensions } from 'react-native';
import { breakpointFor, type Breakpoint } from './tokens';

export interface BreakpointState {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

/** Breakpoint corrente; si aggiorna al ridimensionamento della finestra (anche su web). */
export function useBreakpoint(): BreakpointState {
  const { width } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  };
}
