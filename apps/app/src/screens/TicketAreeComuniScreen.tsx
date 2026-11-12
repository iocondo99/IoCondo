import React from 'react';
import { View, StyleSheet } from 'react-native';
import { sottotitoloTicketPortiere } from '@iocondo/data';
import { NonAutorizzato, PageHeader, space } from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { ElencoSegnalazioni } from '@/components/segnalazioni/ElencoSegnalazioni';
import { useProfilo } from '@/context/ProfiloContext';

/** Pagina "Ticket aree comuni" del portiere (`/ticket-aree-comuni`). */
export function TicketAreeComuniScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, voci } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;

  if (!voci.some((v) => v.id === 'ticket-aree-comuni')) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Ticket aree comuni" subtitle="Segnalazioni sulle aree comuni." />
        <NonAutorizzato />
      </View>
    );
  }

  return (
    <ElencoSegnalazioni
      modalita="portiere"
      titolo="Ticket aree comuni"
      sottotitolo={sottotitoloTicketPortiere(condominio.nome)}
      rotta="/ticket-aree-comuni"
      etichettaAzione="Nuovo ticket"
      etichettaTabella="Ticket delle aree comuni"
      vuotoDescrizione="Quando verrà aperto un ticket su un’area comune o una scala del condominio, oppure ne aprirai uno tu, lo troverai qui."
    />
  );
}

const styles = StyleSheet.create({ pagina: { alignSelf: 'stretch', gap: space[6] } });

