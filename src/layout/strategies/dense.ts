import type { Strategy } from '../types';

/**
 * Every card goes into the first row that still has room for it, otherwise
 * into a new one. This is what CSS `grid-auto-flow: dense` does when all rows
 * are one track high - implemented here rather than left to CSS so that every
 * strategy renders through the same explicit placement.
 *
 * It closes a gap only with a card that happens to come later and fit. It
 * never looks ahead: in 5,5,4,3,7 the first row keeps 2 columns free because
 * no later card is 2 wide, and the result is three rows where two would do.
 */
export const denseStrategy: Strategy = (spans, columns) => {
  const rows: number[][] = [];
  const used: number[] = [];
  spans.forEach((span, index) => {
    const target = used.findIndex((load) => load + span <= columns);
    if (target === -1) {
      rows.push([index]);
      used.push(span);
    } else {
      rows[target].push(index);
      used[target] += span;
    }
  });
  return rows;
};
