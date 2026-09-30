/**
 * Advanced Grid Card
 * A grid card for Home Assistant where every card sets its own width, and the
 * rows are packed so that as little room as possible stays empty.
 *
 *   config/        normalisation and validation of the YAML
 *   layout/        the layout engine: pure functions, no DOM
 *   children/      the child cards, through Home Assistant's hui-card
 *   card/          the card element and its stylesheet
 */
import { AdvancedGridCard } from './card/card';
import { CARD_TAG, CARD_VERSION, REPO_URL } from './const';

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview: boolean;
  documentationURL: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

const inBrowser = typeof window !== 'undefined' && typeof customElements !== 'undefined';

if (inBrowser) {
  if (customElements.get(CARD_TAG)) {
    // A second Lovelace resource entry for the same card loads this file
    // twice, and whichever copy came first wins. From the outside that looks
    // like "I deployed the new file and nothing changed", hence the warning.
    console.warn(
      `[${CARD_TAG}] is already registered, so this copy does nothing. You very ` +
        `likely have two Lovelace resource entries pointing at this card. Keep ` +
        `one under Settings > Dashboards > Resources and edit its ?v= instead.`,
    );
  } else {
    customElements.define(CARD_TAG, AdvancedGridCard);
  }

  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === CARD_TAG)) {
    window.customCards.push({
      type: CARD_TAG,
      name: 'Advanced Grid Card',
      description: 'A grid where every card sets its own width, packed without gaps.',
      preview: false,
      documentationURL: REPO_URL,
    });
  }

  console.info(
    `%c ${CARD_TAG} %c v${CARD_VERSION} `,
    'color:#fff;background:#4a9eff;font-weight:700;border-radius:3px 0 0 3px;padding:2px 6px',
    'color:#4a9eff;background:#2b2b2b;border-radius:0 3px 3px 0;padding:2px 6px',
  );
}

export { CARD_VERSION, CARD_TAG, REPO_URL, AdvancedGridCard };
export { normalizeConfig, GRID_KEYS } from './config/normalize';
export { resolveSpan } from './config/span';
export { computeLayout, STRATEGIES } from './layout/engine';
export { widthClassFor } from './layout/width';
