import React from 'react';
import { View, StyleSheet } from 'react-native';
import { sottotitoloSegnalazioni } from '@iocondo/data';
import { NonAutorizzato, PageHeader, space } from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { ElencoSegnalazioni } from '@/components/segnalazioni/ElencoSegnalazioni';
import { useProfilo } from '@/context/ProfiloContext';

/** Pagina "Segnalazioni" del condòmino (`/segnalazioni`, REQ-C03). */
export function SegnalazioniScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli, voci } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;

  if (!ruoli.has('CONDOMINO') || !voci.some((v) => v.id === 'segnalazioni')) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Segnalazioni" subtitle="Guasti e richieste di intervento." />
        <NonAutorizzato />
      </View>
    );
  }

  return (
    <ElencoSegnalazioni
      modalita="condomino"
      titolo="Segnalazioni"
      sottotitolo={sottotitoloSegnalazioni(condominio.nome)}
      rotta="/segnalazioni"
      etichettaAzione="Nuova segnalazione"
      etichettaTabella="Segnalazioni del condominio"
      vuotoDescrizione="Quando aprirai una segnalazione, o ne verrà aperta una per la tua unità, la troverai qui."
    />
  );
}

const styles = StyleSheet.create({ pagina: { alignSelf: 'stretch', gap: space[6] } });

