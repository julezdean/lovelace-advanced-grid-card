import { DEFAULT_COLUMNS } from '../const';
import { GRID_KEYS } from '../config/normalize';
import { WIDTH_CLASS_NAMES } from '../layout/width';
import type { Dict, LovelaceCardConfig, WidthClass } from '../types';
import { isDict } from '../utils';

/**
 * Everything the editor does to the configuration, as pure functions: the
 * element only wires them to Home Assistant's form and card editors.
 *
 * Two rules run through all of them:
 *
 *   1. Only what the user changed is written. A form hands back all its
 *      fields at once; applying them all would, for example, drop a
 *      `gap: 0.5rem` the number field cannot show, the moment someone edits
 *      the title.
 *   2. A value equal to its default is removed rather than written, so using
 *      the editor does not fill the YAML with every option.
 */

export interface GridEditorConfig extends Dict {
  type: string;
  cards: LovelaceCardConfig[];
}

/* --- Card options -------------------------------------------------------- */

/** The default gap in px, as the form shows it. */
const DEFAULT_GAP_PX = 8;

export interface CardFormData {
  title?: string;
  columns: number;
  gap?: number;
  packing: string;
  stretch_last_row: boolean;
  default_span: number;
}

export function cardFormData(config: GridEditorConfig): CardFormData {
  const gap = config.gap === undefined ? DEFAULT_GAP_PX : pixels(config.gap);
  return {
    title: typeof config.title === 'string' ? config.title : undefined,
    columns: columnsOf(config),
    gap,
    packing: typeof config.packing === 'string' ? config.packing : 'fill',
    stretch_last_row: config.last_row === 'stretch',
    default_span: typeof config.default_span === 'number' ? config.default_span : 1,
  };
}

/**
 * Applies the fields that differ between `before` and `after` - the form's
 * data as it was handed out and as it came back.
 */
export function applyCardForm(
  config: GridEditorConfig,
  before: CardFormData,
  after: CardFormData,
): GridEditorConfig {
  const next: GridEditorConfig = { ...config };
  const changed = (key: keyof CardFormData) => before[key] !== after[key];

  if (changed('title')) setOrDelete(next, 'title', after.title || undefined);
  if (changed('columns')) {
    setOrDelete(next, 'columns', after.columns === DEFAULT_COLUMNS ? undefined : after.columns);
  }
  if (changed('gap')) {
    setOrDelete(
      next,
      'gap',
      after.gap === undefined || after.gap === DEFAULT_GAP_PX ? undefined : after.gap,
    );
  }
  if (changed('packing')) {
    setOrDelete(next, 'packing', after.packing === 'fill' ? undefined : after.packing);
  }
  if (changed('stretch_last_row')) {
    setOrDelete(next, 'last_row', after.stretch_last_row ? 'stretch' : undefined);
  }
  if (changed('default_span')) {
    setOrDelete(
      next,
      'default_span',
      after.default_span === undefined || after.default_span === 1 ? undefined : after.default_span,
    );
  }
  return next;
}

/* --- The child's own configuration --------------------------------------- */

/**
 * What a child's editor gets to see: its configuration without the grid's
 * keys. Home Assistant's card editors validate against a struct that refuses
 * unknown keys, so a `grid_span` left in would switch the child's visual
 * editor off.
 */
export function withoutGridKeys(card: LovelaceCardConfig): LovelaceCardConfig {
  const copy = { ...card };
  for (const key of GRID_KEYS) delete copy[key];
  return copy;
}

/** The child's edited configuration with the grid's keys put back. */
export function withGridKeys(
  edited: LovelaceCardConfig,
  original: LovelaceCardConfig,
): LovelaceCardConfig {
  const next: LovelaceCardConfig = { ...edited };
  for (const key of GRID_KEYS) {
    if (original[key] !== undefined) next[key] = original[key];
  }
  return next;
}

/* --- The span of one child ----------------------------------------------- */

export interface SpanFormData {
  span?: number;
  responsive: boolean;
  narrow?: number;
  medium?: number;
  wide?: number;
}

export function spanFormData(card: LovelaceCardConfig, columns: number): SpanFormData {
  const value = card.grid_span;
  if (isDict(value)) {
    const data: SpanFormData = { responsive: true };
    for (const name of WIDTH_CLASS_NAMES) {
      const span = spanNumber(value[name], columns);
      if (span !== undefined) data[name] = span;
    }
    return data;
  }
  return { responsive: false, span: spanNumber(value, columns) };
}

/**
 * The child with its span as the form now says.
 *
 * Switching to per-size widths starts all three sizes at the current span;
 * switching back keeps the widest one's. An existing `full` stays `full`
 * while the number shown for it is not changed: it keeps meaning the whole
 * width if `columns` changes later.
 */
export function applySpanForm(
  card: LovelaceCardConfig,
  before: SpanFormData,
  after: SpanFormData,
): LovelaceCardConfig {
  const next: LovelaceCardConfig = { ...card };

  if (after.responsive && !before.responsive) {
    const start = before.span;
    if (start === undefined) return next; // nothing to spread yet: stay as is
    next.grid_span = { narrow: start, medium: start, wide: start };
    return next;
  }

  if (!after.responsive && before.responsive) {
    const keep = before.wide ?? before.medium ?? before.narrow;
    setOrDelete(next, 'grid_span', keep);
    return next;
  }

  if (after.responsive) {
    const map: Partial<Record<WidthClass, number>> = {};
    for (const name of WIDTH_CLASS_NAMES) {
      if (after[name] !== undefined) map[name] = after[name];
    }
    setOrDelete(next, 'grid_span', Object.keys(map).length > 0 ? map : undefined);
    return next;
  }

  if (before.span !== after.span) setOrDelete(next, 'grid_span', after.span);
  return next;
}

/* --- The list of children ------------------------------------------------ */

export function moveCard(config: GridEditorConfig, index: number, by: number): GridEditorConfig {
  const target = index + by;
  if (target < 0 || target >= config.cards.length) return config;
  const cards = [...config.cards];
  const [card] = cards.splice(index, 1);
  cards.splice(target, 0, card);
  return { ...config, cards };
}

export function removeCard(config: GridEditorConfig, index: number): GridEditorConfig {
  const cards = [...config.cards];
  cards.splice(index, 1);
  return { ...config, cards };
}

export function addCard(config: GridEditorConfig, card: LovelaceCardConfig): GridEditorConfig {
  return { ...config, cards: [...config.cards, card] };
}

export function replaceCard(
  config: GridEditorConfig,
  index: number,
  card: LovelaceCardConfig,
): GridEditorConfig {
  const cards = [...config.cards];
  cards[index] = card;
  return { ...config, cards };
}

/**
 * A tab's label: its position, and the span, since with `fill` the order on
 * screen is not the order of the tabs - the width is what finds a card again
 * in the preview. `1 · 3`, `2 · 12/6/3` for one span per size, `3` without one.
 */
export function tabLabel(card: LovelaceCardConfig, index: number, columns: number): string {
  const value = card.grid_span;
  let span = '';
  if (isDict(value)) {
    const parts = WIDTH_CLASS_NAMES.map((name) => spanNumber(value[name], columns));
    span = parts.map((part) => (part === undefined ? '–' : String(part))).join('/');
  } else if (value !== undefined) {
    span = String(spanNumber(value, columns) ?? value);
  }
  return span ? `${index + 1} · ${span}` : String(index + 1);
}

/* --- Helpers ------------------------------------------------------------- */

export function columnsOf(config: Dict): number {
  const columns = Number(config.columns);
  return Number.isInteger(columns) && columns > 0 ? columns : DEFAULT_COLUMNS;
}

function spanNumber(value: unknown, columns: number): number | undefined {
  if (value === 'full') return columns;
  const number = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isFinite(number)
    ? number
    : undefined;
}

/** A gap the number field can show, or undefined for one it cannot (`0.5rem`). */
function pixels(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/.exec(String(value));
  return match ? Number(match[1]) : undefined;
}

function setOrDelete(target: Dict, key: string, value: unknown): void {
  if (value === undefined) delete target[key];
  else target[key] = value;
}
