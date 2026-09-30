import { test } from 'vitest';
import assert from 'node:assert/strict';
import { normalizeConfig, resolveSpan, widthClassFor } from '../src/main.ts';

const cfg = (overrides = {}) =>
  normalizeConfig({ type: 'custom:advanced-grid-card', cards: [{ type: 'tile' }], ...overrides });
const all = (n) => ({ narrow: n, medium: n, wide: n });

/* -- defaults ---------------------------------------------------------------- */

test('defaults: 12 columns, fill, last row as it is, the grid card gap, one column per card', () => {
  const config = cfg();
  assert.equal(config.columns, 12);
  assert.equal(config.packing, 'fill');
  assert.equal(config.last_row, 'start');
  assert.equal(config.gap, 'var(--grid-card-gap, 8px)');
  assert.deepEqual(config.cards[0].span, all(1));
  assert.equal(config.title, null);
  assert.equal(config.responsive, false);
});

test('gap accepts a number as px and passes CSS lengths through', () => {
  assert.equal(cfg({ gap: 8 }).gap, '8px');
  assert.equal(cfg({ gap: '12' }).gap, '12px');
  assert.equal(cfg({ gap: '0.5rem' }).gap, '0.5rem');
});

test('an empty card list is valid - the card picker starts with one', () => {
  assert.deepEqual(cfg({ cards: [] }).cards, []);
});

/* -- the child's configuration ------------------------------------------------ */

test('grid_span is removed before the child sees its configuration', () => {
  const config = cfg({ cards: [{ type: 'tile', entity: 'light.flur', grid_span: 4 }] });
  assert.deepEqual(config.cards[0].card, { type: 'tile', entity: 'light.flur' });
  assert.deepEqual(config.cards[0].span, all(4));
});

test("the user's configuration is not modified", () => {
  const raw = { cards: [{ type: 'tile', grid_span: 4 }] };
  normalizeConfig(raw);
  assert.equal(raw.cards[0].grid_span, 4);
});

test('keys of the child that are not the grid\'s pass through - square included', () => {
  const nested = { type: 'grid', square: false, columns: 3, cards: [] };
  assert.deepEqual(cfg({ cards: [{ ...nested, grid_span: 6 }] }).cards[0].card, nested);
});

/* -- grid_span --------------------------------------------------------------- */

test('grid_span: full is the column count, too wide is clamped, fractions round', () => {
  const config = cfg({
    columns: 6,
    cards: [
      { type: 'a', grid_span: 'full' },
      { type: 'b', grid_span: 12 },
      { type: 'c', grid_span: 2.4 },
      { type: 'd', grid_span: '3' },
    ],
  });
  assert.deepEqual(
    config.cards.map((c) => c.span.medium),
    [6, 6, 2, 3],
  );
});

test('default_span applies to cards without grid_span', () => {
  const config = cfg({ default_span: 3, cards: [{ type: 'a' }, { type: 'b', grid_span: 6 }] });
  assert.deepEqual(
    config.cards.map((c) => c.span.medium),
    [3, 6],
  );
});

test('a missing width class takes the nearest smaller one, else the nearest larger', () => {
  assert.deepEqual(resolveSpan({ narrow: 12, wide: 3 }, 12, 'x'), {
    narrow: 12,
    medium: 12,
    wide: 3,
  });
  assert.deepEqual(resolveSpan({ wide: 3 }, 12, 'x'), all(3));
  assert.deepEqual(resolveSpan({ medium: 6 }, 12, 'x'), all(6));
  assert.deepEqual(resolveSpan({ narrow: 'full', medium: 6 }, 12, 'x'), {
    narrow: 12,
    medium: 6,
    wide: 6,
  });
});

test('a span that differs between widths makes the configuration responsive', () => {
  assert.equal(cfg({ cards: [{ type: 'a', grid_span: { narrow: 12, wide: 3 } }] }).responsive, true);
  // Written as a mapping, but the same everywhere: nothing to watch.
  assert.equal(cfg({ cards: [{ type: 'a', grid_span: { wide: 3 } }] }).responsive, false);
});

/* -- mistakes are reported, with the field named ---------------------------- */

test('mistakes throw with the field named', () => {
  const throws = (overrides, pattern) => assert.throws(() => cfg(overrides), pattern);
  throws({ cards: 'nope' }, /"cards" must be a list/);
  throws({ columns: 0 }, /"columns" must be a whole number/);
  throws({ columns: 2.5 }, /"columns" must be a whole number/);
  throws({ packing: 'masonry' }, /"packing" must be one of fill, dense, row/);
  throws({ last_row: 'center' }, /"last_row" must be one of start, stretch/);
  throws({ cards: [{ entity: 'light.x' }] }, /cards\[0\]: every card needs a "type"/);
  throws({ cards: [{ type: 'a', grid_span: 0 }] }, /cards\[0\]\.grid_span: expected a whole number/);
  throws({ cards: [{ type: 'a', grid_span: 'half' }] }, /cards\[0\]\.grid_span/);
  throws(
    { cards: [{ type: 'a' }, { type: 'b', grid_span: { mobile: 12 } }] },
    /cards\[1\]\.grid_span: unknown width "mobile" - use narrow, medium, wide/,
  );
  throws({ cards: [{ type: 'a', grid_span: {} }] }, /give a span for at least one/);
  throws({ default_span: -1 }, /default_span/);
});

/* -- width classes ------------------------------------------------------------ */

test('width classes: below 400 narrow, below 800 medium, from 800 wide', () => {
  assert.equal(widthClassFor(0), 'narrow');
  assert.equal(widthClassFor(399), 'narrow');
  assert.equal(widthClassFor(400), 'medium');
  assert.equal(widthClassFor(799.5), 'medium');
  assert.equal(widthClassFor(800), 'wide');
  assert.equal(widthClassFor(2400), 'wide');
});
