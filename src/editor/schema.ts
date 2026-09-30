/**
 * ha-form schemas. Labels are English like the other cards of this author;
 * the buttons Home Assistant has words for (copy, cut, move, delete, code
 * editor) use its own translations instead, see editor.ts.
 */

export const LABELS: Record<string, string> = {
  title: 'Title',
  columns: 'Columns',
  gap: 'Gap',
  packing: 'Arrangement',
  stretch_last_row: 'Stretch the last row',
  default_span: 'Default width',
  span: 'Width',
  responsive: 'Different widths per card size',
  narrow: 'Narrow (below 400 px)',
  medium: 'Medium (400-799 px)',
  wide: 'Wide (800 px and more)',
};

export const HELPERS: Record<string, string> = {
  packing:
    'Fill gaps moves later cards up into rows they fit; strict order keeps the YAML order exactly.',
  stretch_last_row: 'Widens the cards of the last row so that it reaches the full width.',
  default_span: 'In columns, for cards without a width of their own.',
  span: 'In columns. Empty: the default width.',
  responsive: 'Measured on this card, not on the screen.',
};

const PACKING_OPTIONS = [
  { value: 'fill', label: 'Fill gaps (default)' },
  { value: 'dense', label: 'Move up where it fits' },
  { value: 'row', label: 'Strict order' },
];

export function cardSchema(columns: number): unknown[] {
  return [
    { name: 'title', selector: { text: {} } },
    {
      type: 'grid',
      name: '',
      schema: [
        { name: 'columns', selector: { number: { min: 1, mode: 'box' } } },
        {
          name: 'gap',
          selector: { number: { min: 0, max: 64, mode: 'box', unit_of_measurement: 'px' } },
        },
      ],
    },
    { name: 'packing', selector: { select: { mode: 'dropdown', options: PACKING_OPTIONS } } },
    {
      type: 'grid',
      name: '',
      schema: [
        { name: 'default_span', selector: { number: { min: 1, max: columns, mode: 'box' } } },
        { name: 'stretch_last_row', selector: { boolean: {} } },
      ],
    },
  ];
}

export function spanSchema(columns: number, responsive: boolean): unknown[] {
  const number = { number: { min: 1, max: columns, mode: 'box' } };
  if (!responsive) {
    return [
      { name: 'span', selector: number },
      { name: 'responsive', selector: { boolean: {} } },
    ];
  }
  return [
    { name: 'responsive', selector: { boolean: {} } },
    {
      type: 'grid',
      name: '',
      schema: [
        { name: 'narrow', selector: number },
        { name: 'medium', selector: number },
        { name: 'wide', selector: number },
      ],
    },
  ];
}
