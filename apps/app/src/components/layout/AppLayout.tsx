import React, { createContext, useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { navigazioneMobile } from '@iocondo/data';
import { colors, layout, space, useBreakpoint } from '@iocondo/ui';
import { useProfilo } from '@/context/ProfiloContext';
import { Header } from './Header';
import { MobileNavigation } from './MobileNavigation';
import { Sidebar } from './Sidebar';

/**
 * Pagina "a schermo pieno" (es. il registro di contabilità espanso): niente sidebar, niente
 * larghezza massima del contenuto e margini ridotti, per usare tutta l'ampiezza della finestra.
 */
const PaginaPienaContext = createContext<(attiva: boolean) => void>(() => undefined);

/** Da chiamare nella schermata: finché `attiva` è true il layout passa a schermo pieno. */
export function usePaginaPiena(attiva: boolean): void {
  const imposta = useContext(PaginaPienaContext);
  useEffect(() => {
    imposta(attiva);
    return () => imposta(false);
  }, [attiva, imposta]);
}

/**
 * Cornice dell'app (sez. 5 e 16). Desktop: sidebar navy fissa e header. Tablet: sidebar compressa
 * (si può aprire) e header semplificato. Smartphone: header compatto, contenuto a colonna singola e
 * barra in basso. Il menu ha sempre le stesse voci nello stesso ordine.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isDesktop, isTablet, isMobile } = useBreakpoint();
  const { voci, vista } = useProfilo();
  const [espansa, setEspansa] = useState(false);
  const [piena, setPiena] = useState(false);

  const padding = piena
    ? isMobile
      ? space[3]
      : space[5]
    : isDesktop
      ? space[8]
      : isTablet
        ? space[6]
        : space[4];

  return (
    <PaginaPienaContext.Provider value={setPiena}>
      <View style={[styles.root, !isMobile && styles.riga]}>
        {isMobile || piena ? null : (
          <Sidebar
            voci={voci}
            compressa={isTablet && !espansa}
            comprimibile={isTablet}
            onToggle={() => setEspansa((corrente) => !corrente)}
          />
        )}
        <View style={styles.colonna}>
          <Header />
          <ScrollView
            role="main"
            style={styles.scorri}
            contentContainerStyle={[styles.contenuto, { padding }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.pagina, piena && styles.paginaPiena]}>{children}</View>
          </ScrollView>
          {isMobile && vista ? <MobileNavigation navigazione={navigazioneMobile(voci, vista)} tutte={voci} /> : null}
        </View>
      </View>
    </PaginaPienaContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  riga: { flexDirection: 'row' },
  colonna: { flex: 1, minWidth: 0 },
  scorri: { flex: 1 },
  contenuto: { flexGrow: 1, alignItems: 'center' },
  pagina: { width: '100%', maxWidth: layout.contentMaxWidth, gap: space[6] },
  paginaPiena: { maxWidth: '100%', gap: space[4] },
});
