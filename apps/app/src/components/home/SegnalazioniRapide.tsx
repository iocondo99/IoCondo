import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, colors, space, textStyle, useBreakpoint } from '@iocondo/ui';
import type { Apri } from './SchedeRiepilogo';

/**
 * Accessi rapidi alle segnalazioni. Per ora entrambi portano alla pagina Segnalazioni (che spiega che è in
 * arrivo): non esistono ancora una schermata "nuova segnalazione" e un elenco delle richieste.
 */
export function SegnalazioniRapide({ apri }: { apri: Apri }) {
  const { breakpoint, isMobile } = useBreakpoint();
  const segnala = apri('segnalazioni', 'Apre la pagina Segnalazioni');
  const consulta = apri('segnalazioni', 'Apre la pagina Segnalazioni');
  if (!segnala || !consulta) return null;

  return (
    <Card title="Segnalazioni rapide">
      <Text style={[textStyle('body', breakpoint), styles.testo]}>
        C’è un guasto o un problema in condominio? Segnalalo, oppure guarda le richieste già inviate.
      </Text>
      <View style={[styles.azioni, isMobile && styles.colonna]}>
        <View style={styles.azione}>
          <Button fullWidth variant="secondary" icon="wrench" label="Segnala un problema" {...segnala} />
        </View>
        <View style={styles.azione}>
          <Button fullWidth variant="secondary" icon="inbox" label="Consulta le richieste" {...consulta} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  testo: { color: colors.text.secondary },
  azioni: { flexDirection: 'row', gap: space[3] },
  colonna: { flexDirection: 'column' },
  azione: { flex: 1 },
});
