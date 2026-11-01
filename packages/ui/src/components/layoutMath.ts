/**
 * Calcoli puri di Pagination e Dropdown. File volutamente senza import da
 * react-native, così si testa con `node --test`.
 */

export type PageItem = number | 'start-ellipsis' | 'end-ellipsis';

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
}

/**
 * Numeri di pagina da mostrare: sempre la prima e l'ultima, la corrente con
 * `siblings` vicine per lato, e "…" al posto del resto. Il numero di voci non
 * cambia da una pagina all'altra, così i pulsanti non si spostano.
 */
export function pageWindow(current: number, count: number, siblings = 1): PageItem[] {
  const slots = siblings * 2 + 5;
  if (count <= slots) return range(1, count);

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, count);
  const showStart = left > 2;
  const showEnd = right < count - 1;
  const edge = 3 + siblings * 2;

  if (!showStart && showEnd) return [...range(1, edge), 'end-ellipsis', count];
  if (showStart && !showEnd) return [1, 'start-ellipsis', ...range(count - edge + 1, count)];
  return [1, 'start-ellipsis', ...range(left, right), 'end-ellipsis', count];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacementInput {
  /** Posizione del pulsante nella finestra. */
  anchor: Rect;
  screen: { width: number; height: number };
  /** Altezza che il menu avrebbe senza limiti. */
  contentHeight: number;
  minWidth: number;
  /** Distanza minima dai bordi della finestra. */
  margin: number;
  /** Distanza tra pulsante e menu. */
  gap: number;
  align: 'start' | 'end';
}

export interface Placement {
  horizontal: { left: number } | { right: number };
  vertical: { top: number } | { bottom: number };
  maxHeight: number;
  minWidth: number;
  maxWidth: number;
  upward: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Dove mettere il menu: sotto il pulsante, o sopra se sotto non c'è posto e sopra ce n'è di più. */
export function placeMenu(input: PlacementInput): Placement {
  const { anchor, screen, contentHeight, margin, gap, align } = input;
  const below = screen.height - (anchor.y + anchor.height) - gap - margin;
  const above = anchor.y - gap - margin;
  const upward = contentHeight > below && above > below;

  const maxWidth = Math.max(0, screen.width - margin * 2);
  const minWidth = Math.min(Math.max(anchor.width, input.minWidth), maxWidth);
  const farthest = screen.width - margin - minWidth;

  const horizontal =
    align === 'end'
      ? { right: clamp(screen.width - (anchor.x + anchor.width), margin, farthest) }
      : { left: clamp(anchor.x, margin, farthest) };
  const vertical = upward
    ? { bottom: screen.height - anchor.y + gap }
    : { top: anchor.y + anchor.height + gap };

  return {
    horizontal,
    vertical,
    maxHeight: Math.max(upward ? above : below, 0),
    minWidth,
    maxWidth,
    upward,
  };
}
