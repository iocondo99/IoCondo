import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ModuloChiave } from '@iocondo/data';
import { EmptyState, space } from '@iocondo/ui';
import { useProfilo } from '@/context/ProfiloContext';

export interface GuardiaModuloProps {
  /** Una chiave singola o più chiavi in OR (es. bacheca o chat per comunicazioni). */
  modulo: ModuloChiave | readonly ModuloChiave[];
  /** Titolo opzionale per l'avviso di disattivazione. */
  titolo?: string;
  /** Messaggio descrittivo opzionale. */
  messaggio?: string;
  children: React.ReactNode;
}

/**
 * Protegge una schermata lato Condòmino / Portiere (vista "RESIDENTE"):
 * se il modulo è disattivato dall'amministratore, i componenti figli NON vengono montati
 * (evitando qualsiasi query Supabase a vuoto) e viene mostrato uno stato chiaro con pulsante
 * per tornare alla Home.
 * Per gli amministratori (vista "ADMIN"), l'accesso alla gestione non viene mai bloccato.
 */
export function GuardiaModulo({ modulo, titolo, messaggio, children }: GuardiaModuloProps) {
  const { vista, moduli, stato } = useProfilo();
  const router = useRouter();

  // Finché il profilo e i moduli non sono caricati, non montare i children per evitare fetch premature
  if (stato === 'caricamento' || !vista) {
    return null;
  }

  // Gli amministratori mantengono sempre l'accesso alla schermata
  if (vista !== 'RESIDENTE') {
    return <>{children}</>;
  }

  const chiavi: readonly ModuloChiave[] = Array.isArray(modulo) ? modulo : [modulo];
  const abilitato = chiavi.some((k) => moduli[k] !== false);

  if (!abilitato) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="shield-alert"
          title={titolo ?? 'Funzionalità non attiva'}
          description={
            messaggio ??
            "Questa funzionalità è stata disattivata dall'amministratore per questo condominio."
          }
          action={{
            label: 'Torna alla Home',
            icon: 'home',
            onPress: () => router.replace('/home'),
          }}
        />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: space[8],
  },
});
