import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { navigazioneMobile } from '@iocondo/data';
import { colors, layout, space, useBreakpoint } from '@iocondo/ui';
import { useProfilo } from '@/context/ProfiloContext';
import { Header } from './Header';
import { MobileNavigation } from './MobileNavigation';
import { Sidebar } from './Sidebar';

/**
 * Cornice dell'app (sez. 5 e 16). Desktop: sidebar navy fissa e header. Tablet: sidebar compressa
 * (si può aprire) e header semplificato. Smartphone: header compatto, contenuto a colonna singola e
 * barra in basso. Il menu ha sempre le stesse voci nello stesso ordine.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isDesktop, isTablet, isMobile } = useBreakpoint();
  const { voci, vista } = useProfilo();
  const [espansa, setEspansa] = useState(false);

  return (
    <View style={[styles.root, !isMobile && styles.riga]}>
      {isMobile ? null : (
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
          contentContainerStyle={[styles.contenuto, { padding: isDesktop ? space[8] : isTablet ? space[6] : space[4] }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pagina}>{children}</View>
        </ScrollView>
        {isMobile && vista ? <MobileNavigation navigazione={navigazioneMobile(voci, vista)} tutte={voci} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  riga: { flexDirection: 'row' },
  colonna: { flex: 1, minWidth: 0 },
  scorri: { flex: 1 },
  contenuto: { flexGrow: 1, alignItems: 'center' },
  pagina: { width: '100%', maxWidth: layout.contentMaxWidth, gap: space[6] },
});
