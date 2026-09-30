import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  applyCardForm,
  applySpanForm,
  cardFormData,
  spanFormData,
  tabLabel,
  withGridKeys,
  withoutGridKeys,
  moveCard,
  removeCard,
  AdvancedGridCard,
} from '../src/main.ts';

const base = (overrides = {}) => ({ type: 'custom:advanced-grid-card', cards: [], ...overrides });
const edit = (config, change) => {
  const before = cardFormData(config);
  return applyCardForm(config, before, { ...before, ...change });
};
const editSpan = (card, change, columns = 12) => {
  const before = spanFormData(card, columns);
  return applySpanForm(card, before, { ...before, ...change });
};

/* -- card options ------------------------------------------------------------ */

test('the form shows the defaults for what the YAML leaves out', () => {
  assert.deepEqual(cardFormData(base()), {
    title: undefined,
    columns: 12,
    gap: 8,
    packing: 'fill',
    stretch_last_row: false,
    default_span: 1,
  });
});

test('a value equal to its default is removed, not written', () => {
  const config = base({ columns: 6, packing: 'row', last_row: 'stretch', default_span: 3, gap: 4 });
  const reset = edit(config, {
    columns: 12,
    packing: 'fill',
    stretch_last_row: false,
    default_span: 1,
    gap: 8,
  });
  assert.deepEqual(reset, base());
});

test('changed fields are written with their YAML names', () => {
  assert.deepEqual(edit(base(), { columns: 6, stretch_last_row: true, title: 'Licht' }), {
    ...base(),
    columns: 6,
    last_row: 'stretch',
    title: 'Licht',
  });
});

test('only changed fields are written: a gap the number field cannot show survives', () => {
  const config = base({ gap: '0.5rem' });
  assert.equal(cardFormData(config).gap, undefined);
  assert.equal(edit(config, { title: 'Licht' }).gap, '0.5rem');
});

test('an emptied title is removed', () => {
  assert.equal('title' in edit(base({ title: 'Licht' }), { title: '' }), false);
});

/* -- the child's configuration ----------------------------------------------- */

test("the child's editor sees no grid_span, and gets it back afterwards", () => {
  const card = { type: 'tile', entity: 'light.flur', grid_span: 4 };
  const seen = withoutGridKeys(card);
  assert.deepEqual(seen, { type: 'tile', entity: 'light.flur' });
  const edited = { ...seen, entity: 'light.bad' };
  assert.deepEqual(withGridKeys(edited, card), { type: 'tile', entity: 'light.bad', grid_span: 4 });
});

test('a card without grid_span gets none added', () => {
  const card = { type: 'tile' };
  assert.deepEqual(withGridKeys({ type: 'tile', name: 'x' }, card), { type: 'tile', name: 'x' });
});

/* -- the span of one child --------------------------------------------------- */

test('span: setting, changing and clearing a plain number', () => {
  assert.equal(editSpan({ type: 'tile' }, { span: 4 }).grid_span, 4);
  assert.equal(editSpan({ type: 'tile', grid_span: 4 }, { span: 6 }).grid_span, 6);
  assert.equal('grid_span' in editSpan({ type: 'tile', grid_span: 4 }, { span: undefined }), false);
});

test('span: full is shown as the column count and kept while that number is untouched', () => {
  const card = { type: 'tile', grid_span: 'full' };
  assert.equal(spanFormData(card, 12).span, 12);
  // Another field of the form changing must not turn "full" into 12.
  const before = spanFormData(card, 12);
  assert.equal(applySpanForm(card, before, { ...before }).grid_span, 'full');
  assert.equal(editSpan(card, { span: 6 }).grid_span, 6);
});

test('span: switching to per-size widths starts all three at the current span', () => {
  assert.deepEqual(editSpan({ type: 'tile', grid_span: 4 }, { responsive: true }).grid_span, {
    narrow: 4,
    medium: 4,
    wide: 4,
  });
});

test('span: switching back keeps the wide width', () => {
  const card = { type: 'tile', grid_span: { narrow: 12, medium: 6, wide: 3 } };
  assert.equal(editSpan(card, { responsive: false }).grid_span, 3);
});

test('span: per-size fields left empty are left out of the mapping', () => {
  const card = { type: 'tile', grid_span: { narrow: 12, medium: 6, wide: 3 } };
  assert.deepEqual(editSpan(card, { medium: undefined }).grid_span, { narrow: 12, wide: 3 });
});

/* -- list operations and tabs ------------------------------------------------ */

test('moving and removing cards', () => {
  const config = base({ cards: [{ type: 'a' }, { type: 'b' }, { type: 'c' }] });
  assert.deepEqual(
    moveCard(config, 0, 1).cards.map((c) => c.type),
    ['b', 'a', 'c'],
  );
  assert.equal(moveCard(config, 0, -1), config, 'no move past the start');
  assert.deepEqual(
    removeCard(config, 1).cards.map((c) => c.type),
    ['a', 'c'],
  );
});

test('tab labels carry the span', () => {
  assert.equal(tabLabel({ type: 'a' }, 0, 12), '1');
  assert.equal(tabLabel({ type: 'a', grid_span: 3 }, 1, 12), '2 · 3');
  assert.equal(tabLabel({ type: 'a', grid_span: 'full' }, 2, 12), '3 · 12');
  assert.equal(tabLabel({ type: 'a', grid_span: { narrow: 12, wide: 3 } }, 0, 12), '1 · 12/–/3');
});

/* -- stub configuration ------------------------------------------------------ */

test('the stub uses real entities where there are enough, preferring lights and switches', () => {
  const stub = AdvancedGridCard.getStubConfig({}, [
    'sensor.a',
    'light.wohnzimmer',
    'switch.kaffee',
    'sensor.b',
  ]);
  assert.deepEqual(
    stub.cards.map((c) => [c.type, c.entity, c.grid_span]),
    [
      ['tile', 'light.wohnzimmer', 6],
      ['tile', 'switch.kaffee', 6],
      ['tile', 'sensor.a', 12],
    ],
  );
});

test('without entities the stub falls back to markdown cards', () => {
  const stub = AdvancedGridCard.getStubConfig({}, []);
  assert.deepEqual(
    stub.cards.map((c) => c.type),
    ['markdown', 'markdown', 'markdown'],
  );
});
