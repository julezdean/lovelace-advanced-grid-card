import type { Strategy } from '../types';

/**
 * YAML order, and a new row whenever the next card does not fit. This is what
 * CSS `grid-auto-flow: row` does, and so what the native grid card and the
 * sections view do: the order on screen is exactly the order in the YAML, at
 * the price of whatever space a card too wide for the rest of its row leaves.
 */
export const rowStrategy: Strategy = (spans, columns) => {
  const rows: number[][] = [];
  let row: number[] = [];
  let used = 0;
  spans.forEach((span, index) => {
    if (row.length > 0 && used + span > columns) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(index);
    used += span;
  });
  if (row.length > 0) rows.push(row);
  return rows;
};
