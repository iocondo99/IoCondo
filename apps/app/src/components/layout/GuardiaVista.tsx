import React, { createContext, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot, useRouter, type Href } from 'expo-router';
import { homeDi, type Vista } from '@iocondo/data';
import type { RuoloCodice } from '@iocondo/shared-types';
import { NonAutorizzato, space } from '@iocondo/ui';
import { useProfilo } from '@/context/ProfiloContext';

const AccessoContext = createContext(true);

/**
 * `false` dentro un gruppo di rotte a cui l'utente non ha accesso: le pagine non mostrano nulla e non
 * devono caricare dati (la guardia mostra già "non disponibile").
 */
export function useAccessoConsentito(): boolean {
  return useContext(AccessoContext);
}

interface Props {
  /** Vista in cui deve trovarsi l'utente (la scelta nel selettore dell'header). */
  vista: Vista;
  /** Basta uno di questi ruoli nel condominio scelto. Vuoto = nessun ruolo richiesto (super amministratore). */
  ruoli?: readonly RuoloCodice[];
}

/**
 * Guardia di un gruppo di rotte. Se vista o ruolo non bastano mostra "non disponibile" (mai un
 * reindirizzamento silenzioso). Lo `Slot` resta sempre montato, nascosto: se non lo fosse, expo-router non
 * troverebbe più la rotta richiesta e riporterebbe a "/". È solo cortesia dell'interfaccia: la sicurezza
 * vera è nelle RLS di Supabase.
 */
export function GuardiaVista({ vista, ruoli }: Props) {
  const profilo = useProfilo();
  const router = useRouter();
  const condominioSospeso =
    profilo.stato === 'pronto' && !profilo.profilo?.isSuperAdmin && profilo.condominio?.attivo === false;
  const consentito =
    profilo.stato === 'pronto' &&
    !condominioSospeso &&
    profilo.vista === vista &&
    (!ruoli || ruoli.length === 0 || ruoli.some((r) => profilo.ruoli.has(r)));
  const casa = profilo.vista;

  return (
    <AccessoContext.Provider value={consentito}>
      {consentito || profilo.stato !== 'pronto' ? null : (
        <NonAutorizzato
          action={
            casa
              ? { label: 'Vai alla tua Home', icon: 'home', onPress: () => router.replace(homeDi(casa) as Href) }
              : undefined
          }
        />
      )}
      <View aria-hidden={!consentito} style={consentito ? styles.pagina : styles.nascosta}>
        <Slot />
      </View>
    </AccessoContext.Provider>
  );
}

const styles = StyleSheet.create({
  pagina: { gap: space[6] },
  nascosta: { display: 'none' },
});
