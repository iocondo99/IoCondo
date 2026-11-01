import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { borderWidths, colors, feedbackSizes, radii, space } from '../tokens';
import { Button } from './Button';
import { feedbackTones, type FeedbackTone } from './feedbackTone';
import { IconButton } from './IconButton';
import { useTextStyle } from './internal';

export type AlertTone = FeedbackTone;

export interface AlertProps {
  tone: AlertTone;
  /** Testo del messaggio: breve, in italiano semplice, senza codici tecnici. */
  message: string;
  title?: string;
  /**
   * Messaggio persistente: per problemi che richiedono un intervento. Non si può
   * chiudere, ha un bordo laterale ben visibile e può avere un'azione.
   */
  persistent?: boolean;
  /** Azione per risolvere il problema (es. "Riprova"). */
  action?: { label: string; onPress: () => void | Promise<unknown> };
  /** Chiusura del messaggio: ignorata se `persistent`. */
  onDismiss?: () => void;
}

export function Alert({ tone, message, title, persistent = false, action, onDismiss }: AlertProps) {
  const spec = feedbackTones[tone];
  const titleStyle = useTextStyle('h4');
  const messageStyle = useTextStyle('secondary');
  const dismissible = !persistent && Boolean(onDismiss);

  return (
    <View
      role={spec.role}
      aria-live={spec.live}
      style={[
        styles.alert,
        {
          backgroundColor: spec.colors.background,
          borderColor: spec.colors.foreground,
        },
        persistent && { borderLeftWidth: feedbackSizes.alertAccent },
      ]}
    >
      <View style={styles.icon}>
        <Icon name={spec.icon} size="action" color={spec.colors.foreground} accessibilityLabel={spec.label} />
      </View>
      <View style={styles.text}>
        {title ? <Text style={[titleStyle, { color: colors.text.primary }]}>{title}</Text> : null}
        <Text style={[messageStyle, { color: colors.text.primary }]}>{message}</Text>
        {action ? (
          <Button variant="secondary" label={action.label} onPress={action.onPress} />
        ) : null}
      </View>
      {dismissible ? (
        <IconButton icon="x" accessibilityLabel="Chiudi il messaggio" onPress={onDismiss} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[4],
    borderWidth: borderWidths.thin,
    borderRadius: radii.card,
  },
  icon: { paddingTop: space[1] },
  text: { flex: 1, gap: space[2] },
});
