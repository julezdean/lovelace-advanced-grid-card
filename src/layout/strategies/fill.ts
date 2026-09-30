import type { Strategy } from '../types';

/**
 * Anchored best fill, the default.
 *
 * Each row starts with the earliest card not yet placed - the anchor - and is
 * then filled as full as any choice among the remaining cards allows. Among
 * choices that fill it equally well, the one made of the earliest cards wins.
 *
 *   5,5,4,3,7   row:  [5 5] [4 3] [7]      three rows, 2+5+5 columns empty
 *               fill: [5 4 3] [5 7]        two rows, both full
 *
 * What this keeps from the YAML order: the first card is always top left, and
 * every row begins with the oldest card still waiting, so the order reads
 * roughly top to bottom. When the YAML order already fills every row, nothing
 * moves at all - filling the anchor's row with the cards that directly follow
 * it is the earliest choice, and it is also a perfect one.
 *
 * It is a heuristic, not an optimum: over 2000 random cases (4-12 cards, spans
 * 2-8) it reached the smallest possible row count in 93% of them, against 80%
 * for dense and 50% for row. Sorting by size (first-fit decreasing) scores
 * higher still, but makes the YAML order meaningless.
 */
export const fillStrategy: Strategy = (spans, columns) => {
  const rows: number[][] = [];
  let rest = spans.map((_, index) => index);

  while (rest.length > 0) {
    const [anchor, ...candidates] = rest;
    const row = [anchor, ...bestFill(candidates, spans, columns - spans[anchor])];
    rows.push(row);
    const placed = new Set(row);
    rest = rest.filter((index) => !placed.has(index));
  }

  return rows;
};

/**
 * The subset of `candidates` with the largest total span not above `room`,
 * and among those the earliest one.
 *
 * A 0/1 knapsack over the sums 0..room: `best[sum]` is the earliest set found
 * so far whose spans add up to exactly `sum`. Candidates arrive in ascending
 * order, so every set is an ascending list and each new one ends in the
 * candidate just added.
 *
 * Why keeping only the earliest set per sum loses nothing: two sets compared
 * here always have the same sum, so neither can be a proper prefix of the
 * other (every span is at least 1), and they differ at some position both
 * have. Appending the same candidate to both leaves that position - and so the
 * comparison - unchanged.
 *
 * Cost: candidates x room steps per row. 60 cards on 12 columns take about
 * 0.05 ms for the whole layout.
 */
function bestFill(candidates: readonly number[], spans: readonly number[], room: number): number[] {
  if (room <= 0) return [];
  const best: Array<number[] | null> = new Array(room + 1).fill(null);
  best[0] = [];

  for (const index of candidates) {
    const span = spans[index];
    // Downwards, so this candidate builds only on sets that do not contain it.
    for (let sum = room; sum >= span; sum--) {
      const base = best[sum - span];
      if (!base) continue;
      const set = [...base, index];
      const current = best[sum];
      if (!current || isEarlier(set, current)) best[sum] = set;
    }
  }

  for (let sum = room; sum > 0; sum--) {
    const set = best[sum];
    if (set) return set;
  }
  return [];
}

/** Ascending index lists: the one with the smaller index at the first difference. */
function isEarlier(a: readonly number[], b: readonly number[]): boolean {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return a.length < b.length;
}
