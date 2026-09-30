import type { WIDTH_CLASSES } from './const';

/** A loosely typed mapping, as YAML hands it over. */
export type Dict = Record<string, unknown>;

/** A Lovelace card configuration. Only `type` is known to every card. */
export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

/**
 * The card never reads `hass`, it only hands it to the children. Typing it as
 * an opaque object keeps any assumption about its shape out of this code.
 */
export type HomeAssistant = object;

export type WidthClass = (typeof WIDTH_CLASSES)[number]['name'];

export type Packing = 'fill' | 'dense' | 'row';
export type LastRow = 'start' | 'stretch';

/** A span for every width class, already clamped to the column count. */
export type ResolvedSpan = Record<WidthClass, number>;

export interface ChildConfig {
  /** What the child card receives - everything the grid owns removed. */
  card: LovelaceCardConfig;
  span: ResolvedSpan;
}

/** The configuration after normalizeConfig: every default applied. */
export interface GridConfig {
  title: string | null;
  columns: number;
  /** A CSS length. */
  gap: string;
  packing: Packing;
  last_row: LastRow;
  cards: ChildConfig[];
  /**
   * True when any card's span differs between width classes. Only then does
   * the card have to watch its own width at all.
   */
  responsive: boolean;
}
