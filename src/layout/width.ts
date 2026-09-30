import { WIDTH_CLASSES } from '../const';
import type { WidthClass } from '../types';

export const WIDTH_CLASS_NAMES: readonly WidthClass[] = WIDTH_CLASSES.map((entry) => entry.name);

/** The width class a card of this width belongs to. */
export function widthClassFor(width: number): WidthClass {
  let current: WidthClass = WIDTH_CLASSES[0].name;
  for (const entry of WIDTH_CLASSES) {
    if (width >= entry.min) current = entry.name;
  }
  return current;
}
