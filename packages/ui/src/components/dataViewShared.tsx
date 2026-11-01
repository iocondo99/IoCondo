import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MobileRole } from '../dataTableMath';
import { tabularNumbers } from '../styles';
import { colors } from '../tokens';
import { Dropdown, type DropdownItem } from './Dropdown';
import { EmptyState, ErrorState, type EmptyStateProps } from './PageStates';
import { useTextStyle } from './internal';

/** Una colonna, descritta una sola volta: la usano sia la tabella sia le schede per smartphone. */
export interface DataColumn<T> {
  key: string;
  /** Intestazione breve e comprensibile. */
  header: string;
  /**
   * Contenuto della cella. Testi e numeri sono resi con lo stile standard (cifre tabellari se
   * la colonna è a destra); un elemento (es. un Badge) è reso così com'è.
   */
  cell: (row: T) => React.ReactNode;
  /** `end` per gli importi: testo a destra, cifre tabellari. */
  align?: 'start' | 'end';
  /** Mostra il controllo di ordinamento nell'intestazione. */
  sortable?: boolean;
  /** Larghezza minima in tabella; sotto la somma delle minime la tabella scorre dentro il suo riquadro. */
  minWidth?: number;
  /** Quanto spazio extra prende rispetto alle altre colonne (predefinito 1). */
  weight?: number;
  /** Ruolo della colonna nella scheda per smartphone (predefinito: la prima è il titolo, le altre i dati). */
  mobile?: MobileRole;
  /** Etichetta del dato nella scheda, se diversa dall'intestazione. */
  mobileLabel?: string;
}

export interface DataViewError {
  title?: string;
  description?: string;
}

/** Proprietà comuni a DataTable, MobileDataList e ResponsiveDataView. */
export interface DataViewProps<T> {
  /** Nome della tabella o dell'elenco, letto dagli screen reader (es. "Rate del condominio"). */
  label: string;
  columns: readonly DataColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /** Nome breve di una riga (es. "Rata di aprile 2025"): serve al menu delle azioni e agli screen reader. */
  getRowLabel: (row: T) => string;
  /** Se presente la riga (o la scheda) è selezionabile: clic, tocco o Invio aprono il dettaglio. */
  onRowPress?: (row: T) => void;
  /** Voci del menu "Altre azioni" di ogni riga: compare come ultima colonna. */
  rowActions?: (row: T) => readonly DropdownItem[];
  loading?: boolean;
  /** `true` o i testi da mostrare: appare lo stato di errore con "Riprova". */
  error?: boolean | DataViewError;
  onRetry?: () => void | Promise<unknown>;
  /** Stato vuoto: cosa dire quando non ci sono righe (es. "Non ci sono ancora rate."). */
  empty: EmptyStateProps;
}

/** Stato di errore o vuoto al posto dell'elenco; `null` se i dati vanno mostrati. */
export function DataViewFeedback<T>({
  error,
  onRetry,
  empty,
  rows,
  loading,
}: Pick<DataViewProps<T>, 'error' | 'onRetry' | 'empty' | 'loading'> & { rows: readonly T[] }) {
  if (loading) return null;
  if (error) {
    const texts = typeof error === 'object' ? error : {};
    return <ErrorState title={texts.title} description={texts.description} onRetry={onRetry} />;
  }
  if (rows.length === 0) return <EmptyState {...empty} />;
  return null;
}

/** Testi e numeri con lo stile della tabella; qualsiasi altro elemento passa invariato. */
export function CellValue({ content, align = 'start' }: { content: React.ReactNode; align?: 'start' | 'end' }) {
  const bodyStyle = useTextStyle('body');
  if (typeof content === 'string' || typeof content === 'number') {
    return (
      <Text
        style={[
          bodyStyle,
          styles.text,
          align === 'end' ? [styles.end, tabularNumbers] : styles.start,
        ]}
      >
        {content}
      </Text>
    );
  }
  return <>{content}</>;
}

/** Menu "Altre azioni" di una riga: il nome dice su quale riga agisce. */
export function RowActionsMenu({ label, items }: { label: string; items: readonly DropdownItem[] }) {
  return <Dropdown iconOnly align="end" label={`Altre azioni: ${label}`} items={items} />;
}

const styles = StyleSheet.create({
  text: { color: colors.text.primary, flexShrink: 1 },
  start: { textAlign: 'left' },
  end: { textAlign: 'right' },
});
