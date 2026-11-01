import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, EmptyState, ErrorState, colors, space } from '@iocondo/ui';
import { BrandMark } from '@/components/Brand';
import { SessionLoading } from '@/components/auth/SessionLoading';
import { useAuth } from '@/context/AuthContext';
import { useProfilo } from '@/context/ProfiloContext';
import { AppLayout } from './AppLayout';

/**
 * Prima del layout: caricamento del profilo, errore con "Riprova" e account senza ruoli.
 * In questi tre casi non si mostra il menu: non si sa ancora (o non c'è) cosa l'utente possa vedere.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const profilo = useProfilo();
  const { signOut } = useAuth();

  const errore = profilo.stato === 'errore';
  const caricamento = profilo.stato === 'caricamento';
  const pronto = profilo.stato === 'pronto' && !profilo.senzaRuoli;

  // Le pagine (children) restano SEMPRE montate nella stessa posizione, anche mentre si carica il
  // profilo: se il router non trovasse la rotta richiesta al primo disegno, dopo l'accesso tornerebbe a "/".
  // Caricamento, errore e "nessun ruolo" si mostrano al loro posto e il layout resta nascosto.
  return (
    <>
      {caricamento ? <SessionLoading message="Carichiamo il tuo profilo…" /> : null}
      {!caricamento && !pronto ? (
        <View style={styles.root}>
          <BrandMark tone="light" />
          <View style={styles.blocco}>
            {errore ? (
              <ErrorState
                title="Non riusciamo a caricare il tuo profilo"
                description="Controlla la connessione e riprova."
                onRetry={profilo.riprova}
              />
            ) : (
              <EmptyState
                icon="lock"
                title="Account non ancora attivo"
                description="Il tuo account non è ancora associato a nessun condominio. Contatta il tuo amministratore."
              />
            )}
            <Button
              variant="secondary"
              label="Esci"
              icon="log-out"
              onPress={async () => {
                await signOut();
              }}
            />
          </View>
        </View>
      ) : null}
      <View aria-hidden={!pronto} style={pronto ? styles.layout : styles.nascosto}>
        <AppLayout>{children}</AppLayout>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[6],
    padding: space[4],
  },
  blocco: { alignItems: 'center', gap: space[4], width: '100%' },
  layout: { flex: 1 },
  nascosto: { display: 'none' },
});
