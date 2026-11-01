import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { SortState } from '../dataTableMath';
import { space } from '../tokens';
import { useBreakpoint } from '../useBreakpoint';
import { DataTable } from './DataTable';
import { MobileDataList } from './MobileDataList';
import { Select, type SelectOption } from './Select';
import type { DataViewProps } from './dataViewShared';

export interface ResponsiveDataViewProps<T> extends DataViewProps<T> {
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Filtri e ricerca (FilterChips, SearchBar): li gestisce il chiamante, qui si mostrano sopra l'elenco. */
  filters?: React.ReactNode;
  /** Paginazione (Pagination): la gestisce il chiamante, qui si mostra sotto l'elenco. */
  pagination?: React.ReactNode;
}

const NO_SORT = '';

/**
 * Una sola definizione di dati e colonne; da tablet in su si vede la tabella, su smartphone
 * l'elenco a schede (sez. 11.4 e 16). Il componente non conosce il modulo: tutto arriva da props.
 * Su smartphone, dove non ci sono intestazioni da premere, l'ordinamento si sceglie dal campo "Ordina per".
 */
export function ResponsiveDataView<T>({
  sort = null,
  onSortChange,
  filters,
  pagination,
  ...view
}: ResponsiveDataViewProps<T>) {
  const { isMobile } = useBreakpoint();

  const sortable = view.columns.filter((column) => column.sortable);
  const sortOptions: SelectOption[] = [
    { value: NO_SORT, label: 'Ordine originale' },
    ...sortable.flatMap((column) => [
      { value: `${column.key}:ascending`, label: `${column.header} (crescente)` },
      { value: `${column.key}:descending`, label: `${column.header} (decrescente)` },
    ]),
  ];

  const chooseSort = (value: string) => {
    if (value === NO_SORT) return onSortChange?.(null);
    const [key, direction] = value.split(':') as [string, SortState['direction']];
    onSortChange?.({ key, direction });
  };

  return (
    <View style={styles.root}>
      {filters}
      {isMobile && onSortChange && sortable.length > 0 ? (
        <Select
          label="Ordina per"
          options={sortOptions}
          value={sort ? `${sort.key}:${sort.direction}` : NO_SORT}
          onChange={chooseSort}
        />
      ) : null}
      {isMobile ? (
        <MobileDataList {...view} />
      ) : (
        <DataTable {...view} sort={sort} onSortChange={onSortChange} />
      )}
      {pagination}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: space[4] },
});
