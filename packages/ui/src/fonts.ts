import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
// Import per singolo peso: dal pacchetto principale entrerebbero nel bundle tutti i 18 file di Inter.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import * as SplashScreen from 'expo-splash-screen';
import { typography } from './tokens';

// Le chiavi sono i nomi di famiglia definiti nei token: un solo punto di verità.
const interFonts = {
  [typography.fontFamily.regular]: Inter_400Regular,
  [typography.fontFamily.medium]: Inter_500Medium,
  [typography.fontFamily.semibold]: Inter_600SemiBold,
  [typography.fontFamily.bold]: Inter_700Bold,
};

/**
 * Da chiamare una volta, a livello di modulo, nel layout radice:
 * la splash nativa resta visibile finché Inter non è pronto.
 */
export function keepSplashScreenVisible(): void {
  // Può rifiutare se la splash è già nascosta (es. fast refresh): non è un errore.
  SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

/**
 * Carica Inter. `ready` diventa true a font caricati o in caso di errore
 * (si usa allora il font di sistema, senza bloccare l'app).
 * Su web non esiste una splash: `ready` è subito true e il testo appare con il
 * fallback di sistema, poi passa a Inter.
 */
export function useAppFonts(): { ready: boolean; error: Error | null } {
  const [loaded, error] = useFonts(interFonts);
  const finished = loaded || error !== null;

  useEffect(() => {
    if (finished) SplashScreen.hideAsync().catch(() => undefined);
  }, [finished]);

  return { ready: Platform.OS === 'web' || finished, error };
}
