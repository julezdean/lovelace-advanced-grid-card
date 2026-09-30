import { test } from 'vitest';
import assert from 'node:assert/strict';
import { computeLayout, STRATEGIES } from '../src/main.ts';

const C = 12;
const rowsOf = (spans, packing, columns = C) =>
  computeLayout(spans, columns, packing).rows.map((row) => row.map((index) => spans[index]));
const load = (row, spans) => row.reduce((sum, index) => sum + spans[index], 0);

/** Smallest possible row count, by exhaustive search. Only for small inputs. */
function minimumRows(spans, columns) {
  let best = spans.length;
  const loads = [];
  (function place(i) {
    if (loads.length >= best) return;
    if (i === spans.length) {
      best = loads.length;
      return;
    }
    for (let k = 0; k < loads.length; k++) {
      if (loads[k] + spans[i] <= columns) {
        loads[k] += spans[i];
        place(i + 1);
        loads[k] -= spans[i];
      }
    }
    loads.push(spans[i]);
    place(i + 1);
    loads.pop();
  })(0);
  return best;
}

/** Deterministic pseudo-random spans, so a failure can be reproduced. */
function randomCases(count, seed = 7) {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: count }, () => {
    const n = 1 + Math.floor(next() * 12);
    return Array.from({ length: n }, () => 1 + Math.floor(next() * 12));
  });
}

/* -- invariants every strategy holds ----------------------------------------- */

for (const packing of Object.keys(STRATEGIES)) {
  test(`${packing}: every card is placed exactly once, no row overflows`, () => {
    for (const spans of randomCases(500)) {
      const { rows, placements } = computeLayout(spans, C, packing);
      const placed = rows.flat().sort((a, b) => a - b);
      assert.deepEqual(placed, spans.map((_, i) => i), `spans ${spans}`);
      for (const row of rows) assert.ok(load(row, spans) <= C, `spans ${spans} row ${row}`);
      assert.equal(placements.length, spans.length);
    }
  });

  test(`${packing}: within a row, cards keep YAML order and sit side by side`, () => {
    for (const spans of randomCases(300)) {
      const { placements } = computeLayout(spans, C, packing);
      const byRow = new Map();
      for (const p of placements) byRow.set(p.row, [...(byRow.get(p.row) || []), p]);
      for (const row of byRow.values()) {
        let column = 0;
        let previous = -1;
        for (const p of row) {
          assert.ok(p.index > previous, `order in row, spans ${spans}`);
          assert.equal(p.column, column, `no hole in row, spans ${spans}`);
          column += p.span;
          previous = p.index;
        }
      }
    }
  });

  test(`${packing}: the same input always gives the same layout`, () => {
    for (const spans of randomCases(100)) {
      assert.deepEqual(computeLayout(spans, C, packing), computeLayout(spans, C, packing));
    }
  });

  test(`${packing}: an empty grid has no rows`, () => {
    assert.deepEqual(computeLayout([], C, packing), { placements: [], rows: [] });
  });
}

/* -- the examples from the design -------------------------------------------- */

test('5,5,4,3,7: row and dense need three rows, fill packs two full ones', () => {
  const spans = [5, 5, 4, 3, 7];
  assert.deepEqual(rowsOf(spans, 'row'), [[5, 5], [4, 3], [7]]);
  assert.deepEqual(rowsOf(spans, 'dense'), [[5, 5], [4, 3], [7]]);
  assert.deepEqual(computeLayout(spans, C, 'fill').rows, [
    [0, 2, 3],
    [1, 4],
  ]);
});

test('fill leaves a layout alone that already fills every row in YAML order', () => {
  const spans = [4, 4, 4, 3, 3, 6, 5, 2, 5];
  assert.deepEqual(computeLayout(spans, C, 'fill').rows, computeLayout(spans, C, 'row').rows);
});

test('7,7,5,5,3,3,2,4: row needs four rows, fill three', () => {
  const spans = [7, 7, 5, 5, 3, 3, 2, 4];
  assert.equal(rowsOf(spans, 'row').length, 4);
  assert.deepEqual(rowsOf(spans, 'fill'), [
    [7, 5],
    [7, 5],
    [3, 3, 2, 4],
  ]);
});

test('fill: the first card is always top left, and every row starts with the oldest card waiting', () => {
  for (const spans of randomCases(500)) {
    const { rows } = computeLayout(spans, C, 'fill');
    const placedBefore = new Set();
    for (const row of rows) {
      const firstWaiting = spans.findIndex((_, i) => !placedBefore.has(i));
      assert.equal(row[0], firstWaiting, `spans ${spans}`);
      row.forEach((i) => placedBefore.add(i));
    }
  }
});

test('fill: among equally full rows, the earliest cards win', () => {
  // Row 1 can be 5+7 or 5+4+3 - both full. 5+4+3 uses the earlier cards.
  assert.deepEqual(computeLayout([5, 5, 4, 3, 7], C, 'fill').rows[0], [0, 2, 3]);
  // 6 + (3,3) or 6 + (6): cards 1 and 2 come before card 3.
  assert.deepEqual(computeLayout([6, 3, 3, 6], C, 'fill').rows[0], [0, 1, 2]);
});

test('fill: never more rows than row in these cases, and near the minimum', () => {
  let fillBest = 0;
  for (const spans of randomCases(1000)) {
    const fill = computeLayout(spans, C, 'fill').rows.length;
    const row = computeLayout(spans, C, 'row').rows.length;
    assert.ok(fill <= row, `spans ${spans}: fill ${fill} > row ${row}`);
    if (fill === minimumRows(spans, C)) fillBest++;
  }
  // The measured quality of the heuristic, as a floor: if a change makes it
  // worse, this says so. 93% was measured on spans 2-8; these are 1-12.
  assert.ok(fillBest >= 900, `fill reached the minimum in only ${fillBest} of 1000 cases`);
});

/* -- clamping ---------------------------------------------------------------- */

test('spans outside 1..columns are clamped, not dropped', () => {
  const { placements } = computeLayout([20, 0, -3, 2.6], 6, 'row');
  assert.deepEqual(
    placements.map((p) => p.span),
    [6, 1, 1, 3],
  );
});

/* -- last_row: stretch ------------------------------------------------------- */

test('stretch hands the free columns of the last row to its cards, front-heavy', () => {
  // [5 2] with 5 free: floor gives +3 and +1, the one left over goes first.
  const { placements } = computeLayout([12, 5, 2], C, 'row', 'stretch');
  assert.deepEqual(
    placements.map((p) => [p.row, p.column, p.span]),
    [
      [0, 0, 12],
      [1, 0, 9],
      [1, 9, 3],
    ],
  );
});

test('stretch touches only the last row, and always fills it', () => {
  for (const spans of randomCases(500)) {
    const plain = computeLayout(spans, C, 'fill');
    const { placements, rows } = computeLayout(spans, C, 'fill', 'stretch');
    const last = rows.length - 1;
    for (const p of placements) {
      const before = plain.placements.find((q) => q.index === p.index);
      if (p.row !== last) assert.equal(p.span, before.span, `spans ${spans}`);
      else assert.ok(p.span >= before.span, `spans ${spans}`);
    }
    const lastWidth = placements.filter((p) => p.row === last).reduce((s, p) => s + p.span, 0);
    assert.equal(lastWidth, C, `spans ${spans}`);
  }
});

test('start leaves the last row as it is', () => {
  const { placements } = computeLayout([12, 5, 2], C, 'row', 'start');
  assert.deepEqual(
    placements.map((p) => p.span),
    [12, 5, 2],
  );
});
