import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { colors, feedbackSizes, layout, radii, space } from '../tokens';
import { Button } from './Button';
import { useTextStyle } from './internal';

export interface StateAction {
  label: string;
  onPress: () => void | Promise<unknown>;
  icon?: IconName;
}

interface StateBlockProps {
  icon: IconName;
  title: string;
  description: string;
  action?: StateAction;
  /** Colori del cerchio dell'icona. */
  tone?: { foreground: string; background: string };
  role?: 'alert' | 'status';
}

/** Struttura comune degli stati di pagina (sez. 19): icona, titolo, spiegazione e azione successiva. */
function StateBlock({ icon, title, description, action, tone, role }: StateBlockProps) {
  const titleStyle = useTextStyle('h3');
  const descriptionStyle = useTextStyle('body');
  const palette = tone ?? colors.tile.blue;
  return (
    <View role={role} style={styles.block}>
      <View style={[styles.circle, { backgroundColor: palette.background }]}>
        <Icon name={icon} size="card" color={palette.foreground} />
      </View>
      <Text accessibilityRole="header" aria-level={3} style={[titleStyle, styles.title]}>
        {title}
      </Text>
      <Text style={[descriptionStyle, styles.description]}>{description}</Text>
      {action ? (
        <Button label={action.label} icon={action.icon} onPress={action.onPress} />
      ) : null}
    </View>
  );
}

export interface LoadingStateProps {
  /** Testo sotto l'indicatore. */
  message?: string;
}

/** Caricamento di una pagina o di una sezione: mai una schermata vuota senza spiegazione. */
export function LoadingState({ message = 'Caricamento in corso…' }: LoadingStateProps) {
  const messageStyle = useTextStyle('body');
  return (
    <View role="status" aria-live="polite" aria-busy style={styles.block}>
      <ActivityIndicator size="large" color={colors.action.default} />
      <Text style={[messageStyle, styles.description]}>{message}</Text>
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  /** Spiega la situazione (es. "Non ci sono ancora documenti disponibili."). */
  description: string;
  icon?: IconName;
  /** L'azione successiva, solo se l'utente può davvero eseguirla. */
  action?: StateAction;
}

export function EmptyState({ title, description, icon = 'inbox', action }: EmptyStateProps) {
  return <StateBlock icon={icon} title={title} description={description} action={action} />;
}

export interface ErrorStateProps {
  title?: string;
  /** Messaggio semplice, senza codici tecnici. */
  description?: string;
  /** Se manca non compare il pulsante "Riprova". */
  onRetry?: () => void | Promise<unknown>;
}

export function ErrorState({
  title = 'Qualcosa non ha funzionato',
  description = 'Non è stato possibile caricare i dati. Controlla la connessione e riprova.',
  onRetry,
}: ErrorStateProps) {
  return (
    <StateBlock
      role="alert"
      icon="circle-alert"
      tone={colors.semantic.error}
      title={title}
      description={description}
      action={onRetry ? { label: 'Riprova', icon: 'refresh-cw', onPress: onRetry } : undefined}
    />
  );
}

export interface NonAutorizzatoProps {
  title?: string;
  description?: string;
  /** Via d'uscita (es. "Torna alla Home"). */
  action?: StateAction;
}

/** Funzione non disponibile per il ruolo corrente: non dice quale ruolo serve né cosa c'è dietro. */
export function NonAutorizzato({
  title = 'Questa funzione non è disponibile per te',
  description = 'Il tuo profilo non può usare questa parte del servizio. Se pensi sia un errore, contatta l’amministratore del condominio.',
  action,
}: NonAutorizzatoProps) {
  return (
    <StateBlock
      icon="lock"
      tone={colors.tile.navy}
      title={title}
      description={description}
      action={action}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: space[3],
    width: '100%',
    maxWidth: layout.formMaxWidth,
    paddingVertical: space[8],
    paddingHorizontal: space[4],
  },
  circle: {
    width: feedbackSizes.stateIcon,
    height: feedbackSizes.stateIcon,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.brand.navy, textAlign: 'center' },
  description: { color: colors.text.secondary, textAlign: 'center' },
});
