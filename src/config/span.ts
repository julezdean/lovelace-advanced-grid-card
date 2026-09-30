import { WIDTH_CLASS_NAMES } from '../layout/width';
import type { ResolvedSpan, WidthClass } from '../types';
import { isDict } from '../utils';

/**
 * Turns what `grid_span` may say into one span per width class:
 *
 *   3                           3 everywhere
 *   full                        the column count everywhere
 *   { narrow: 12, wide: 3 }     12 up to medium, 3 from wide on
 *
 * A width class the mapping leaves out takes the nearest smaller one given,
 * and failing that the nearest larger: `{ narrow: 12, wide: 3 }` means 12 at
 * medium, because a card that is full width on a phone should not suddenly
 * drop to a quarter on a tablet.
 *
 * Spans wider than the grid are clamped rather than refused: `grid_span: 12`
 * in a 6-column grid means "the whole width", which is what anyone writing it
 * wanted.
 *
 * @param where Names the field in error messages, e.g. `cards[2].grid_span`.
 */
export function resolveSpan(value: unknown, columns: number, where: string): ResolvedSpan {
  if (isDict(value)) {
    const unknown = Object.keys(value).filter(
      (key) => !WIDTH_CLASS_NAMES.includes(key as WidthClass),
    );
    if (unknown.length > 0) {
      throw new Error(
        `${where}: unknown width "${unknown[0]}" - use ${WIDTH_CLASS_NAMES.join(', ')}`,
      );
    }
    const given = new Map<WidthClass, number>();
    for (const name of WIDTH_CLASS_NAMES) {
      if (value[name] !== undefined)
        given.set(name, parseSpan(value[name], columns, `${where}.${name}`));
    }
    if (given.size === 0) {
      throw new Error(`${where}: give a span for at least one of ${WIDTH_CLASS_NAMES.join(', ')}`);
    }
    const resolved = {} as ResolvedSpan;
    WIDTH_CLASS_NAMES.forEach((name, position) => {
      resolved[name] = nearestGiven(given, position);
    });
    return resolved;
  }

  const span = parseSpan(value, columns, where);
  const resolved = {} as ResolvedSpan;
  for (const name of WIDTH_CLASS_NAMES) resolved[name] = span;
  return resolved;
}

function nearestGiven(given: Map<WidthClass, number>, position: number): number {
  for (let i = position; i >= 0; i--) {
    const span = given.get(WIDTH_CLASS_NAMES[i]);
    if (span !== undefined) return span;
  }
  for (let i = position + 1; i < WIDTH_CLASS_NAMES.length; i++) {
    const span = given.get(WIDTH_CLASS_NAMES[i]);
    if (span !== undefined) return span;
  }
  // Unreachable: resolveSpan refuses an empty mapping.
  throw new Error('no span given');
}

function parseSpan(value: unknown, columns: number, where: string): number {
  if (value === 'full') return columns;
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 1) {
    throw new Error(`${where}: expected a whole number from 1 to ${columns}, or "full"`);
  }
  return Math.min(columns, Math.round(number));
}

export function isUniform(span: ResolvedSpan): boolean {
  const values = Object.values(span);
  return values.every((value) => value === values[0]);
}
