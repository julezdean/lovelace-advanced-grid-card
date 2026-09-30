import type { LastRow, Packing } from '../types';
import { denseStrategy } from './strategies/dense';
import { fillStrategy } from './strategies/fill';
import { rowStrategy } from './strategies/row';
import type { Layout, Placement, Strategy } from './types';

export const STRATEGIES: Record<Packing, Strategy> = {
  fill: fillStrategy,
  dense: denseStrategy,
  row: rowStrategy,
};

/**
 * Where each card goes. Pure: no DOM, no Home Assistant, the same input always
 * gives the same layout - which is what lets the card skip the DOM entirely
 * when nothing that feeds this has changed.
 *
 * `spans` are the visible cards in YAML order. Spans outside 1..columns are
 * clamped here as well, so the engine holds its guarantees for any input, not
 * only for what normalizeConfig lets through.
 */
export function computeLayout(
  spans: readonly number[],
  columns: number,
  packing: Packing,
  lastRow: LastRow = 'start',
): Layout {
  const cols = Math.max(1, Math.floor(columns));
  const clamped = spans.map((span) => Math.max(1, Math.min(cols, Math.round(span) || 1)));
  const rows = STRATEGIES[packing](clamped, cols);

  const widths = clamped.slice();
  if (lastRow === 'stretch' && rows.length > 0) {
    stretchRow(rows[rows.length - 1], widths, cols);
  }

  const placements: Placement[] = [];
  rows.forEach((row, rowIndex) => {
    let column = 0;
    for (const index of row) {
      placements.push({ index, row: rowIndex, column, span: widths[index] });
      column += widths[index];
    }
  });

  return { placements, rows };
}

/**
 * Hands the columns a row leaves free to its cards, in proportion to their
 * spans and in whole columns. What rounding down leaves over goes one column
 * each to the earliest cards, the same front-heavy rule the multi-button card
 * uses for its rows.
 *
 *   [5 2] on 12 columns: 5 free -> +3 and +1, then +1 to the first -> [9 3]
 *
 * Opt-in only: afterwards the spans in that row are no longer what the YAML
 * says.
 */
function stretchRow(row: readonly number[], widths: number[], columns: number): void {
  const total = row.reduce((sum, index) => sum + widths[index], 0);
  const free = columns - total;
  if (free <= 0 || total <= 0) return;

  const extra = row.map((index) => Math.floor((free * widths[index]) / total));
  // Rounding down loses less than one column per card, so this never wraps.
  const left = free - extra.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < left; i++) extra[i] += 1;

  row.forEach((index, i) => {
    widths[index] += extra[i];
  });
}
