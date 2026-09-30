import { CARD_TAG } from '../const';

/** Home Assistant's elements this editor is built from. */
export const CARD_EDITOR_TAG = 'hui-card-element-editor';
export const CARD_PICKER_TAG = 'hui-card-picker';
export const FORM_TAG = 'ha-form';
export const ICON_BUTTON_TAG = 'ha-icon-button';

const TAGS = [CARD_EDITOR_TAG, CARD_PICKER_TAG, FORM_TAG, ICON_BUTTON_TAG];
const TIMEOUT_MS = 10000;

interface CardHelpers {
  createCardElement?: (config: unknown) => Promise<HTMLElement> | HTMLElement;
}

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<CardHelpers>;
  }
}

let ready: Promise<boolean> | null = null;

/**
 * Home Assistant defines its card editor and card picker lazily: they reach
 * the element registry only once an editor that uses them has been loaded.
 * The vertical stack card's editor uses all of them, so asking for it once
 * pulls them in - the same probe the multi-button card uses for the
 * conditions editor, through `loadCardHelpers`.
 *
 * Resolves to false rather than rejecting: the editor then still offers the
 * card options and points to the code editor for the cards.
 */
export function ensureEditorElements(): Promise<boolean> {
  if (TAGS.every((tag) => customElements.get(tag))) return Promise.resolve(true);
  if (!ready) {
    ready = (async () => {
      try {
        if (typeof window === 'undefined' || !window.loadCardHelpers) return false;
        const helpers = await window.loadCardHelpers();
        if (!helpers?.createCardElement) return false;
        const probe = await helpers.createCardElement({ type: 'vertical-stack', cards: [] });
        const ctor = probe?.constructor as { getConfigElement?: () => Promise<unknown> };
        if (typeof ctor?.getConfigElement === 'function') await ctor.getConfigElement();
        await withTimeout(Promise.all(TAGS.map((tag) => customElements.whenDefined(tag))));
        return true;
      } catch (err) {
        console.warn(
          `${CARD_TAG}: the card editors could not be loaded; edit the cards in YAML.`,
          err,
        );
        ready = null; // let a later editor try again
        return false;
      }
    })();
  }
  return ready;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
