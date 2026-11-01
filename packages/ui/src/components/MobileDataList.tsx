import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Icon } from '../Icon';
import { splitMobileColumns } from '../dataTableMath';
import { borderWidths, colors, radii, space, touchTarget } from '../tokens';
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
  focusStyle,
  useColorTransition,
  useTextStyle,
  visuallyHidden,
  type PressState,
} from './internal';

export interface MobileDataListProps<T> extends DataViewProps<T> {
  /** Quante schede di segnaposto mostrare durante il caricamento. */
  loadingRows?: number;
}

const SKELETON_CARDS = 4;

/**
 * La stessa informazione della tabella, come elenco di schede (sez. 11.4): titolo, 2-3 dati
 * essenziali, badge di stato e, se c'è un dettaglio, tutta la scheda è un pulsante.
 * Le colonne sono quelle di DataTable; il ruolo di ciascuna si sceglie con `mobile`.
 */
export function MobileDataList<T>({
  label,
  columns,
  rows,
  getRowKey,
  getRowLabel,
  onRowPress,
  rowActions,
  loading = false,
  loadingRows = SKELETON_CARDS,
  error,
  onRetry,
  empty,
}: MobileDataListProps<T>) {
  const { title, status, details } = splitMobileColumns(columns);

  if (loading) {
    return (
      <View role="list" aria-label={label} aria-busy style={styles.list}>
        <View role="status" aria-live="polite" style={visuallyHidden}>
          <Text>Caricamento in corso…</Text>
        </View>
        {Array.from({ length: loadingRows }, (_, index) => (
          <View key={index} role="listitem" aria-hidden style={[styles.card, styles.skeletonCard]}>
            <Skeleton width="60%" />
            {details.map((column) => (
              <Skeleton key={column.key} />
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (error || rows.length === 0) {
    return (
      <View style={styles.feedback}>
        <DataViewFeedback error={error} onRetry={onRetry} empty={empty} rows={rows} loading={loading} />
      </View>
    );
  }

  return (
    <View role="list" aria-label={label} accessibilityLabel={label} style={styles.list}>
      {rows.map((row) => (
        <Card
          key={getRowKey(row)}
          row={row}
          title={title}
          status={status}
          details={details}
          rowLabel={getRowLabel(row)}
          onPress={onRowPress ? () => onRowPress(row) : undefined}
          actions={rowActions?.(row)}
        />
      ))}
    </View>
  );
}

function Card<T>({
  row,
  title,
  status,
  details,
  rowLabel,
  onPress,
  actions,
}: {
  row: T;
  title: DataColumn<T> | undefined;
  status: DataColumn<T> | undefined;
  details: DataColumn<T>[];
  rowLabel: string;
  onPress?: () => void;
  actions?: ReturnType<NonNullable<DataViewProps<T>['rowActions']>>;
}) {
  const transition = useColorTransition();
  const titleStyle = useTextStyle('h4');
  const labelStyle = useTextStyle('secondary');
  const titleContent = title?.cell(row);

  const body = (
    <>
      <View style={[styles.titleRow, actions ? styles.titleRowWithActions : null]}>
        <View style={styles.title}>
          {typeof titleContent === 'string' || typeof titleContent === 'number' ? (
            <Text accessibilityRole="header" aria-level={3} style={[titleStyle, styles.titleText]}>
              {titleContent}
            </Text>
          ) : (
            titleContent
          )}
        </View>
      </View>
      {status ? <View style={styles.status}>{status.cell(row)}</View> : null}
      {details.map((column) => (
        <View key={column.key} style={styles.detail}>
          <Text style={[labelStyle, styles.detailLabel]}>{column.mobileLabel ?? column.header}</Text>
          <View style={styles.detailValue}>
            <CellValue content={column.cell(row)} align="end" />
          </View>
        </View>
      ))}
    </>
  );

  return (
    <View role="listitem" style={styles.card}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={Platform.OS === 'web' ? undefined : rowLabel}
          accessibilityHint="Apre il dettaglio"
          onPress={onPress}
          style={({ hovered, pressed, focused }: PressState) => {
            const style: ViewStyle[] = [
              styles.press,
              { backgroundColor: pressed ? colors.border : hovered ? colors.background : colors.surface },
            ];
            if (transition) style.push(transition);
            const cursor = cursorStyle(false);
            if (cursor) style.push(cursor);
            const ring = focusStyle(!!focused);
            if (ring) style.push(ring);
            return style;
          }}
        >
          <View style={styles.content}>{body}</View>
          <View aria-hidden style={styles.chevron}>
            <Icon name="chevron-right" size="action" color={colors.text.muted} />
          </View>
        </Pressable>
      ) : (
        <View style={[styles.press, styles.content]}>{body}</View>
      )}
      {actions ? (
        <View style={styles.actions}>
          <RowActionsMenu label={rowLabel} items={actions} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', gap: space[3] },
  feedback: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
  },
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
  },
  skeletonCard: { flexDirection: 'column', padding: space[4], gap: space[3] },
  // Il bordo trasparente tiene il posto dell'anello di focus su nativo.
  press: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[2],
    padding: space[4],
    borderRadius: radii.card,
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  content: { flex: 1, gap: space[2], minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  // Il menu delle azioni sta in alto a destra sopra la scheda: il titolo gli lascia lo spazio.
  titleRowWithActions: { minHeight: touchTarget.comfortable, paddingRight: touchTarget.comfortable },
  title: { flex: 1, minWidth: 0 },
  status: { alignSelf: 'flex-start' },
  titleText: { color: colors.brand.navy },
  detail: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3] },
  detailLabel: { color: colors.text.secondary },
  detailValue: { flexShrink: 1, alignItems: 'flex-end' },
  chevron: { alignSelf: 'flex-end' },
  actions: { position: 'absolute', top: space[1], right: space[1] },
});
