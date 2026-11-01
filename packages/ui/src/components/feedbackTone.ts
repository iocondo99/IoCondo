import type { IconName } from '../Icon';
import { colors } from '../tokens';

export type FeedbackTone = 'success' | 'warning' | 'error' | 'info';

interface ToneSpec {
  icon: IconName;
  /** Nome letto dallo screen reader al posto dell'icona: il colore non è l'unico indicatore. */
  label: string;
  colors: { foreground: string; background: string };
  /** Errori e avvisi interrompono; successo e informazioni aspettano (sez. 14 e 17). */
  live: 'polite' | 'assertive';
  role: 'alert' | 'status';
}

/** Un solo posto definisce icona, nome e colore di ogni messaggio (Alert e Toast). */
export const feedbackTones: Record<FeedbackTone, ToneSpec> = {
  success: {
    icon: 'circle-check',
    label: 'Operazione riuscita',
    colors: colors.semantic.success,
    live: 'polite',
    role: 'status',
  },
  warning: {
    icon: 'triangle-alert',
    label: 'Attenzione',
    colors: colors.semantic.warning,
    live: 'assertive',
    role: 'alert',
  },
  error: {
    icon: 'circle-x',
    label: 'Errore',
    colors: colors.semantic.error,
    live: 'assertive',
    role: 'alert',
  },
  info: {
    icon: 'info',
    label: 'Informazione',
    colors: colors.semantic.info,
    live: 'polite',
    role: 'status',
  },
};
