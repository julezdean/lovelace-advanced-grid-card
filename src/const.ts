/**
 * The version comes from package.json through the build, so there is one place
 * to change it. test/version.test.js checks that the built bundle carries it.
 */
declare const __CARD_VERSION__: string;

export const CARD_VERSION = __CARD_VERSION__;

/**
 * The repository is prefixed, the card tag is not: the prefix groups the repo
 * among Lovelace cards, while `type: custom:...` is typed by every user and
 * stays as short as it can be.
 */
export const CARD_TAG = 'advanced-grid-card';
export const REPO_URL = 'https://github.com/julezdean/lovelace-advanced-grid-card';

/** The raster when `columns` is left out: the one the sections view uses. */
export const DEFAULT_COLUMNS = 12;

/**
 * The native grid card's gap, through the same variable, so a theme that sets
 * `--grid-card-gap` spaces both cards alike.
 */
export const DEFAULT_GAP = 'var(--grid-card-gap, 8px)';

/**
 * Width classes of the card itself - not of the screen. A card in a narrow
 * section is narrow on a desktop monitor too, and that is the case the classes
 * exist for: a quarter of 350px is too small to tap, a quarter of 900px is not.
 *
 * Each entry is the lower bound in px. Guesses with a reason, not measurements:
 * a phone in portrait leaves a card less than 400px, one sections column is
 * about 480px wide, and 800px is where a card clearly spans several columns.
 */
export const WIDTH_CLASSES = [
  { name: 'narrow', min: 0 },
  { name: 'medium', min: 400 },
  { name: 'wide', min: 800 },
] as const;

/**
 * How long to wait for Home Assistant's `hui-card` element before giving up.
 * Inside a dashboard it is always defined already - the view renders every card
 * through it - so this only ever runs out outside Home Assistant.
 */
export const HUI_CARD_TIMEOUT_MS = 10000;
