/**
 * Advanced Grid Card
 * A grid card for Home Assistant where every card sets its own width, and the
 * rows are packed so that as little room as possible stays empty.
 *
 *   config/        normalisation and validation of the YAML
 *   layout/        the layout engine: pure functions, no DOM
 *   children/      the child cards, through Home Assistant's hui-card
 *   card/          the card element and its stylesheet
 *   editor/        the visual editor, built from Home Assistant's own parts
 */
import { AdvancedGridCard } from './card/card';
import { CARD_TAG, CARD_VERSION, EDITOR_TAG, REPO_URL } from './const';
import { defineOnce } from './define';
import { AdvancedGridCardEditor } from './editor/editor';

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
  defineOnce(CARD_TAG, AdvancedGridCard, true);
  defineOnce(EDITOR_TAG, AdvancedGridCardEditor);

  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === CARD_TAG)) {
    window.customCards.push({
      type: CARD_TAG,
      name: 'Advanced Grid Card',
      description: 'A grid where every card sets its own width, packed without gaps.',
      preview: true,
      documentationURL: REPO_URL,
    });
  }

  console.info(
    `%c ${CARD_TAG} %c v${CARD_VERSION} `,
    'color:#fff;background:#4a9eff;font-weight:700;border-radius:3px 0 0 3px;padding:2px 6px',
    'color:#4a9eff;background:#2b2b2b;border-radius:0 3px 3px 0;padding:2px 6px',
  );
}

export { CARD_VERSION, CARD_TAG, REPO_URL, AdvancedGridCard, AdvancedGridCardEditor };
export { normalizeConfig, GRID_KEYS } from './config/normalize';
export { resolveSpan } from './config/span';
export { computeLayout, STRATEGIES } from './layout/engine';
export { widthClassFor } from './layout/width';
export {
  applyCardForm,
  applySpanForm,
  cardFormData,
  spanFormData,
  tabLabel,
  withGridKeys,
  withoutGridKeys,
  moveCard,
  removeCard,
} from './editor/transform';
