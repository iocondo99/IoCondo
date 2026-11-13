import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  sottotitoloSegnalazioni,
  sottotitoloTicketPortiere,
  type ModalitaSegnalazioni,
} from '@iocondo/data';
import { NonAutorizzato, PageHeader, space } from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { ElencoSegnalazioni } from '@/components/segnalazioni/ElencoSegnalazioni';
import { useProfilo } from '@/context/ProfiloContext';

/** Pagina "Segnalazioni" unificata per Condòmino e Portiere (`/segnalazioni`, REQ-C03). */
export function SegnalazioniScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio, ruoli, voci } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;

  const autorizzato = (ruoli.has('CONDOMINO') || ruoli.has('PORTIERE')) && voci.some((v) => v.id === 'segnalazioni');
  if (!autorizzato) {
    return (
      <View style={styles.pagina}>
        <PageHeader title="Segnalazioni" subtitle="Guasti e richieste di intervento." />
        <NonAutorizzato />
      </View>
    );
  }

  const modalita: ModalitaSegnalazioni = ruoli.has('PORTIERE') ? 'portiere' : 'condomino';

  return (
    <ElencoSegnalazioni
      modalita={modalita}
      titolo="Segnalazioni"
      sottotitolo={
        modalita === 'portiere'
          ? sottotitoloTicketPortiere(condominio.nome)
          : sottotitoloSegnalazioni(condominio.nome)
      }
      rotta="/segnalazioni"
      etichettaAzione="Nuova segnalazione"
      etichettaTabella="Segnalazioni del condominio"
      vuotoDescrizione={
        modalita === 'portiere'
          ? 'Quando verrà aperta una segnalazione su un’area comune o una scala del condominio, oppure ne aprirai una tu, la troverai qui.'
          : 'Quando verrà aperta una segnalazione su parti comuni del condominio o della tua scala, la troverai qui.'
      }
    />
  );
}

const styles = StyleSheet.create({ pagina: { alignSelf: 'stretch', gap: space[6] } });

