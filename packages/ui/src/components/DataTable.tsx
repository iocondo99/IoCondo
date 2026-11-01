import React, { useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Icon, type IconName } from '../Icon';
import {
  ariaSortFor,
  nextSort,
  sortAnnouncement,
  tableMinWidth,
  type SortState,
} from '../dataTableMath';
import { borderWidths, colors, dataSizes, radii, space } from '../tokens';
import { Skeleton } from './Skeleton';
import {
  CellValue,
  DataViewFeedback,
  RowActionsMenu,
  type DataColumn,
  type DataViewProps,
} from './dataViewShared';
import {
  cursorStyle,
  insetFocusStyle,
  isFromNestedControl,
  useColorTransition,
  useTextStyle,
  visuallyHidden,
  type PressState,
} from './internal';

export interface DataTableProps<T> extends DataViewProps<T> {
  /** Ordinamento attuale: colonna e direzione, o `null` se l'elenco è nell'ordine originale. */
  sort?: SortState | null;
  /** Chiamata quando si preme l'intestazione di una colonna ordinabile. Il chiamante riordina i dati. */
  onSortChange?: (sort: SortState | null) => void;
  /** Quante righe di segnaposto mostrare durante il caricamento. */
  loadingRows?: number;
}

const SKELETON_ROWS = 5;

function cellStyle<T>(column: DataColumn<T>): ViewStyle {
  const basis = column.minWidth ?? dataSizes.columnMinWidth;
  return {
    flexGrow: column.weight ?? 1,
    flexShrink: 0,
    flexBasis: basis,
    minWidth: basis,
    alignItems: column.align === 'end' ? 'flex-end' : 'flex-start',
  };
}

/**
 * Tabella (sez. 11). Intestazione chiara, righe da 56 px con bordo sottile, testi a sinistra,
 * importi a destra, azioni nell'ultima colonna. Se le colonne non stanno, scorre in orizzontale
 * SOLO dentro il suo riquadro: la pagina non si sposta.
 *
 * Web: ruoli table, row, columnheader e cell; `aria-sort` sulle colonne ordinabili e annuncio
 * a voce di ogni cambio di ordinamento. Con `onRowPress` le righe si raggiungono con Tab e si
 * aprono con Invio. Su smartphone usare MobileDataList (o ResponsiveDataView, che sceglie da solo).
 */
export function DataTable<T>({
  label,
  columns,
  rows,
  getRowKey,
  getRowLabel,
  onRowPress,
  rowActions,
  sort = null,
  onSortChange,
  loading = false,
  loadingRows = SKELETON_ROWS,
  error,
  onRetry,
  empty,
}: DataTableProps<T>) {
  const [frameWidth, setFrameWidth] = useState(0);
  const [scrollFocused, setScrollFocused] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const statusStyle = useTextStyle('secondary');

  const actionsWidth = rowActions ? dataSizes.actionsColumnWidth : 0;
  const minWidth = tableMinWidth(
    columns.map((column) => column.minWidth ?? dataSizes.columnMinWidth),
    actionsWidth,
  );
  const tableWidth = Math.max(frameWidth, minWidth);
  // Lo scorrimento serve solo se le colonne non stanno nel riquadro.
  const overflowing = frameWidth > 0 && minWidth > frameWidth;

  const feedback = (
    <DataViewFeedback error={error} onRetry={onRetry} empty={empty} rows={rows} loading={loading} />
  );
  if (!loading && (error || rows.length === 0)) {
    return <View style={styles.frame}>{feedback}</View>;
  }

  const headerOf = (key: string) => columns.find((column) => column.key === key)?.header ?? key;
  const changeSort = (key: string) => {
    const next = nextSort(sort, key);
    onSortChange?.(next);
    const message = sortAnnouncement(next, headerOf);
    setAnnouncement(message);
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(message);
  };

  // Su web l'area che scorre deve essere raggiungibile da tastiera, altrimenti chi non usa il mouse non la vede tutta.
  const scrollProps = overflowing
    ? ({ tabIndex: 0, role: 'region', 'aria-label': `${label}: scorri in orizzontale per vedere tutte le colonne` } as object)
    : {};

  return (
    <View
      style={styles.frame}
      onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={overflowing}
        keyboardShouldPersistTaps="handled"
        onFocus={(event) => setScrollFocused(event.target === event.currentTarget)}
        onBlur={() => setScrollFocused(false)}
        style={insetFocusStyle(scrollFocused)}
        {...scrollProps}
      >
        <View
          role="table"
          aria-label={label}
          accessibilityLabel={label}
          aria-rowcount={rows.length + 1}
          aria-busy={loading}
          style={{ width: tableWidth }}
        >
          <View role="row" style={[styles.row, styles.headerRow]}>
            {columns.map((column) => (
              <HeaderCell
                key={column.key}
                column={column}
                sort={sort}
                onSort={onSortChange ? () => changeSort(column.key) : undefined}
              />
            ))}
            {rowActions ? (
              <View role="columnheader" style={styles.actionsCell}>
                <View style={visuallyHidden}>
                  <Text>Azioni</Text>
                </View>
              </View>
            ) : null}
          </View>

          {loading
            ? Array.from({ length: loadingRows }, (_, index) => (
                <View
                  key={index}
                  role="row"
                  style={[styles.row, styles.bodyRow, index < loadingRows - 1 && styles.rowDivider]}
                >
                  {columns.map((column) => (
                    <View key={column.key} role="cell" style={[styles.cell, cellStyle(column)]}>
                      <Skeleton width={column.align === 'end' ? '60%' : '80%'} />
                    </View>
                  ))}
                  {rowActions ? <View role="cell" style={styles.actionsCell} /> : null}
                </View>
              ))
            : rows.map((row, index) => (
                <BodyRow
                  key={getRowKey(row)}
                  row={row}
                  columns={columns}
                  rowLabel={getRowLabel(row)}
                  last={index === rows.length - 1}
                  rowIndex={index + 2}
                  onPress={onRowPress ? () => onRowPress(row) : undefined}
                  actions={rowActions?.(row)}
                />
              ))}
        </View>
      </ScrollView>
      <View role="status" aria-live="polite" aria-atomic style={visuallyHidden}>
        <Text style={statusStyle}>{loading ? 'Caricamento in corso…' : announcement}</Text>
      </View>
    </View>
  );
}

function HeaderCell<T>({
  column,
  sort,
  onSort,
}: {
  column: DataColumn<T>;
  sort: SortState | null;
  onSort?: () => void;
}) {
  const transition = useColorTransition();
  const labelStyle = useTextStyle('label');
  const sortable = Boolean(column.sortable && onSort);
  const direction = ariaSortFor(sort, column.key);
  const icon: IconName =
    direction === 'ascending' ? 'arrow-up' : direction === 'descending' ? 'arrow-down' : 'arrow-up-down';
  const end = column.align === 'end';

  const title = <Text style={[labelStyle, styles.headerText, end && styles.end]}>{column.header}</Text>;

  return (
    <View
      role="columnheader"
      aria-sort={column.sortable ? direction : undefined}
      style={[styles.headerCell, cellStyle(column)]}
    >
      {sortable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={column.header}
          accessibilityHint={
            direction === 'ascending'
              ? 'Ordinata in modo crescente. Premi per ordinare in modo decrescente.'
              : direction === 'descending'
                ? 'Ordinata in modo decrescente. Premi per togliere l’ordinamento.'
                : 'Premi per ordinare in modo crescente.'
          }
          accessibilityState={{ selected: direction !== 'none' }}
          onPress={onSort}
          style={({ hovered, pressed, focused }: PressState) => {
            const style: ViewStyle[] = [
              styles.sortButton,
              ...(end ? [styles.sortButtonEnd] : []),
              { backgroundColor: pressed ? colors.border : hovered ? colors.surface : 'transparent' },
            ];
            if (transition) style.push(transition);
            const cursor = cursorStyle(false);
            if (cursor) style.push(cursor);
            // La tabella ritaglia ciò che esce dal riquadro: l'anello sta dentro il pulsante.
            const ring = insetFocusStyle(!!focused);
            if (ring) style.push(ring);
            return style;
          }}
        >
          {end ? null : title}
          <Icon
            name={icon}
            size="indicator"
            color={direction === 'none' ? colors.text.muted : colors.brand.navy}
          />
          {end ? title : null}
        </Pressable>
      ) : (
        <View style={styles.plainHeader}>{title}</View>
      )}
    </View>
  );
}

function BodyRow<T>({
  row,
  columns,
  rowLabel,
  last,
  rowIndex,
  onPress,
  actions,
}: {
  row: T;
  columns: readonly DataColumn<T>[];
  rowLabel: string;
  last: boolean;
  rowIndex: number;
  onPress?: () => void;
  actions?: ReturnType<NonNullable<DataViewProps<T>['rowActions']>>;
}) {
  const transition = useColorTransition();
  const cells = (
    <>
      {columns.map((column) => (
        <View key={column.key} role="cell" style={[styles.cell, cellStyle(column)]}>
          <CellValue content={column.cell(row)} align={column.align} />
        </View>
      ))}
      {actions ? (
        <View role="cell" style={styles.actionsCell}>
          <RowActionsMenu label={rowLabel} items={actions} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View role="row" aria-rowindex={rowIndex} style={[styles.row, styles.bodyRow, !last && styles.rowDivider]}>
        {cells}
      </View>
    );
  }

  return (
    <Pressable
      role="row"
      aria-rowindex={rowIndex}
      accessibilityLabel={Platform.OS === 'web' ? undefined : rowLabel}
      accessibilityHint="Apre il dettaglio"
      onPress={(event) => {
        if (!isFromNestedControl(event)) onPress();
      }}
      style={({ hovered, pressed, focused }: PressState) => {
        const style: ViewStyle[] = [
          styles.row,
          styles.bodyRow,
          ...(last ? [] : [styles.rowDivider]),
          { backgroundColor: pressed ? colors.border : hovered ? colors.background : colors.surface },
        ];
        if (transition) style.push(transition);
        const cursor = cursorStyle(false);
        if (cursor) style.push(cursor);
        const ring = insetFocusStyle(!!focused);
        if (ring) style.push(ring);
        return style;
      }}
    >
      {cells}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  headerRow: {
    minHeight: dataSizes.headerMinHeight,
    backgroundColor: colors.background,
    // Stessi bordi laterali delle righe (trasparenti): le colonne restano allineate all'intestazione.
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
    borderBottomColor: colors.borderStrong,
  },
  bodyRow: {
    minHeight: dataSizes.rowMinHeight,
    // Il bordo trasparente tiene il posto dell'anello di focus su nativo: le righe non cambiano altezza.
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  rowDivider: { borderBottomColor: colors.border },
  headerCell: { justifyContent: 'center' },
  headerText: { color: colors.text.primary },
  end: { textAlign: 'right' },
  plainHeader: { paddingHorizontal: space[4], paddingVertical: space[3] },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: dataSizes.headerMinHeight,
    paddingHorizontal: space[4],
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  sortButtonEnd: { justifyContent: 'flex-end' },
  cell: { justifyContent: 'center', paddingHorizontal: space[4], paddingVertical: space[3] },
  actionsCell: {
    width: dataSizes.actionsColumnWidth,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
