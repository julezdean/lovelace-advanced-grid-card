import { DEFAULT_COLUMNS, DEFAULT_GAP } from '../const';
import type { GridConfig, LastRow, LovelaceCardConfig, Packing } from '../types';
import { cssLength, isDict } from '../utils';
import { isUniform, resolveSpan } from './span';

const PACKINGS: readonly Packing[] = ['fill', 'dense', 'row'];
const LAST_ROWS: readonly LastRow[] = ['start', 'stretch'];

/**
 * Keys on a child card that belong to this grid. They are removed before the
 * child sees its configuration: some cards validate strictly and refuse keys
 * they do not know, and a key the grid reads must not change what the child
 * does either.
 *
 * Every such key carries the `grid_` prefix, so it cannot collide with a key
 * a card has of its own - the native grid card's `square` is why that matters.
 */
export const GRID_KEYS = ['grid_span'] as const;

/**
 * Turn whatever the user wrote into a fully resolved configuration.
 * Everything downstream may assume defaults are applied and values are valid.
 *
 * Mistakes throw, with the field named: Home Assistant shows the message in
 * place of the card, which beats a layout that is silently not what was asked.
 */
export function normalizeConfig(raw: unknown): GridConfig {
  if (!isDict(raw)) throw new Error('Invalid configuration');
  if (!Array.isArray(raw.cards)) throw new Error('"cards" must be a list of cards');

  const columns = raw.columns === undefined ? DEFAULT_COLUMNS : Number(raw.columns);
  if (!Number.isInteger(columns) || columns < 1) {
    throw new Error('"columns" must be a whole number of at least 1');
  }

  const packing = (raw.packing ?? 'fill') as Packing;
  if (!PACKINGS.includes(packing)) {
    throw new Error(`"packing" must be one of ${PACKINGS.join(', ')}`);
  }

  const lastRow = (raw.last_row ?? 'start') as LastRow;
  if (!LAST_ROWS.includes(lastRow)) {
    throw new Error(`"last_row" must be one of ${LAST_ROWS.join(', ')}`);
  }

  // One column each unless told otherwise - the native grid card's behaviour,
  // so a `type: grid` switched to this card first looks exactly as before.
  const defaultSpan = raw.default_span ?? 1;
  resolveSpan(defaultSpan, columns, 'default_span');

  const cards = raw.cards.map((entry, index) => {
    const where = `cards[${index}]`;
    if (!isDict(entry) || typeof entry.type !== 'string') {
      throw new Error(`${where}: every card needs a "type"`);
    }
    const card: LovelaceCardConfig = { ...entry, type: entry.type };
    for (const key of GRID_KEYS) delete card[key];
    return {
      card,
      span: resolveSpan(entry.grid_span ?? defaultSpan, columns, `${where}.grid_span`),
    };
  });

  return {
    title: typeof raw.title === 'string' && raw.title !== '' ? raw.title : null,
    columns,
    gap: cssLength(raw.gap, DEFAULT_GAP),
    packing,
    last_row: lastRow,
    cards,
    responsive: cards.some((child) => !isUniform(child.span)),
  };
}
