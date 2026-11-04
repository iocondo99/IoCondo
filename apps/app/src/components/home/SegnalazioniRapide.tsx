import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, colors, space, textStyle, useBreakpoint } from '@iocondo/ui';

interface Props {
  onSegnala: () => void;
  onConsulta: () => void;
}

/**
 * Accessi rapidi alle segnalazioni:
 * - "Segnala un problema" apre direttamente il popup per inserire una nuova segnalazione.
 * - "Consulta le richieste" apre la pagina con l'elenco delle segnalazioni.
 */
export function SegnalazioniRapide({ onSegnala, onConsulta }: Props) {
  const { breakpoint, isMobile } = useBreakpoint();

  return (
    <Card title="Segnalazioni rapide">
      <Text style={[textStyle('body', breakpoint), styles.testo]}>
        C’è un guasto o un problema in condominio? Segnalalo, oppure guarda le richieste già inviate.
      </Text>
      <View style={[styles.azioni, isMobile && styles.colonna]}>
        <View style={styles.azione}>
          <Button
            fullWidth
            variant="secondary"
            icon="wrench"
            label="Segnala un problema"
            accessibilityHint="Apri il modulo per inviare una nuova segnalazione"
            onPress={onSegnala}
          />
        </View>
        <View style={styles.azione}>
          <Button
            fullWidth
            variant="secondary"
            icon="inbox"
            label="Consulta le richieste"
            accessibilityHint="Apri l'elenco delle segnalazioni"
            onPress={onConsulta}
          />
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
