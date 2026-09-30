/**
 * A strategy decides which cards share a row, and nothing else. Its input is
 * the spans in YAML order, already clamped to 1..columns; its output is the
 * rows, each an ascending list of positions into that input.
 *
 * Where in its row a card ends up is not the strategy's business: the engine
 * lays every row out left to right in YAML order, so all strategies render
 * through one path.
 */
export type Strategy = (spans: readonly number[], columns: number) => number[][];

export interface Placement {
  /** Position in the input spans. */
  index: number;
  /** Zero-based. */
  row: number;
  /** Zero-based first column. */
  column: number;
  /** Columns the card covers; differs from the input only in a stretched last row. */
  span: number;
}

export interface Layout {
  placements: Placement[];
  rows: number[][];
}
