import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { oggiIso, titoloSaluto } from '@iocondo/data';
import { Card, ListRow, PageHeader, layout, space, useBreakpoint } from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { GrigliaSchede } from '@/components/home/GrigliaSchede';
import { ProssimeScadenze } from '@/components/home/ProssimeScadenze';
import {
  SchedaAssemblea,
  SchedaComunicazioni,
  SchedaDocumenti,
  SchedaSpese,
  type Apri,
} from '@/components/home/SchedeRiepilogo';
import { SegnalazioniRapide } from '@/components/home/SegnalazioniRapide';
import { UltimeComunicazioni } from '@/components/home/UltimeComunicazioni';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

/**
 * Home del condòmino (vista "Condòmino e portiere"), con dati reali di Supabase. Ogni blocco ha il suo
 * caricamento, il suo errore con "Riprova" e il suo stato vuoto: un blocco che fallisce non rompe gli altri.
 * Cambiando condominio dal selettore i blocchi si ricaricano da soli, senza ricaricare la pagina.
 * Il pagamento online è Fase 2: qui non c'è alcun "Paga ora", solo "Vedi le rate".
 */
export function HomeScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;
  return <HomeContenuto />;
}

function HomeContenuto() {
  const { profilo, condominio, ruoli, voci } = useProfilo();
  const router = useRouter();
  const { isDesktop, isMobile } = useBreakpoint();

  // Garantiti da HomeScreen: la Home non si disegna senza profilo e condominio.
  const utenteId = profilo?.id ?? '';
  const condominioId = condominio?.id ?? '';
  const chiave = `${utenteId}|${condominioId}`;
  const ora = new Date();
  const oggi = oggiIso(ora);

  // Un portiere "puro" non ha accesso contabile (PRD, ruoli): niente spese né scadenze, e niente query.
  const vedeSpese = ruoli.has('CONDOMINO');
  const vedeComunicazioni = voci.some((v) => v.id === 'comunicazioni');

  const spese = useBlocco(() => services.home.rateDelResidente(utenteId, condominioId), chiave, vedeSpese);
  const comunicazioni = useBlocco(
    () => services.home.ultimeComunicazioni(utenteId, condominioId),
    chiave,
    vedeComunicazioni,
  );
  const documenti = useBlocco(() => services.home.contaDocumenti(utenteId, condominioId), chiave);
  const assemblea = useBlocco(() => services.home.prossimaAssemblea(condominioId), chiave);

  const apri = useCallback<Apri>(
    (voceId, hint) => {
      const voce = voci.find((v) => v.id === voceId);
      if (!voce) return undefined;
      return { onPress: () => router.push(voce.route as Href), accessibilityHint: hint };
    },
    [voci, router],
  );

  const indirizzo = [condominio?.indirizzo, condominio?.citta].filter(Boolean).join(', ');
  const scadenze = vedeSpese ? (
    <ProssimeScadenze blocco={spese.blocco} ricarica={spese.ricarica} apri={apri} oggi={oggi} />
  ) : null;
  const ultime = vedeComunicazioni ? (
    <UltimeComunicazioni blocco={comunicazioni.blocco} ricarica={comunicazioni.ricarica} apri={apri} />
  ) : null;

  return (
    <View style={styles.pagina}>
      <View style={[styles.intestazione, isMobile && styles.colonna]}>
        <View style={styles.saluto}>
          <PageHeader
            title={titoloSaluto(profilo?.nome, ora)}
            subtitle="Ecco un riepilogo della situazione condominiale."
          />
        </View>
        <View style={isMobile ? undefined : styles.condominio}>
          <Card>
            <ListRow icon="building-2" tile="navy" title={condominio?.nome ?? ''} description={indirizzo || undefined} />
          </Card>
        </View>
      </View>

      <GrigliaSchede>
        {vedeSpese ? (
          <SchedaSpese blocco={spese.blocco} ricarica={spese.ricarica} apri={apri} oggi={oggi} />
        ) : null}
        {vedeComunicazioni ? (
          <SchedaComunicazioni blocco={comunicazioni.blocco} ricarica={comunicazioni.ricarica} apri={apri} />
        ) : null}
        <SchedaDocumenti blocco={documenti.blocco} ricarica={documenti.ricarica} apri={apri} />
        <SchedaAssemblea blocco={assemblea.blocco} ricarica={assemblea.ricarica} apri={apri} />
      </GrigliaSchede>

      {isDesktop ? (
        <View style={styles.coppia}>
          {ultime ? <View style={styles.meta}>{ultime}</View> : null}
          {scadenze ? <View style={styles.meta}>{scadenze}</View> : null}
        </View>
      ) : (
        <>
          {/* Su tablet e smartphone prima ciò che richiede un'azione (sez. 6.3): scadenze, poi comunicazioni. */}
          {scadenze}
          {ultime}
        </>
      )}

      <SegnalazioniRapide apri={apri} />
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { alignSelf: 'stretch', gap: space[6] },
  intestazione: { flexDirection: 'row', alignItems: 'flex-start', gap: space[4] },
  colonna: { flexDirection: 'column', alignItems: 'stretch' },
  saluto: { flex: 1, minWidth: 0 },
  condominio: { flexBasis: '36%', flexShrink: 0, maxWidth: layout.formMaxWidth },
  coppia: { flexDirection: 'row', alignItems: 'flex-start', gap: space[6] },
  meta: { flex: 1, minWidth: 0 },
});
