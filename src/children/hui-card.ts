import { HUI_CARD_TIMEOUT_MS } from '../const';
import type { HomeAssistant, LovelaceCardConfig } from '../types';

/**
 * The parts of Home Assistant's `hui-card` this card uses.
 *
 * `hui-card` is internal to the frontend, but it is exactly what the native
 * stack, grid and conditional cards put their children in, and what every
 * view renders each card through (since 2024.6). Going through it gives the
 * children the same `visibility`, `disabled` and conditional-card behaviour as
 * anywhere else in Home Assistant, instead of a reimplementation that drifts.
 *
 * What it does when a child is not visible: it sets `display: none` and the
 * `hidden` attribute on itself, and fires `card-visibility-changed`.
 */
export interface HuiCardElement extends HTMLElement {
  config?: LovelaceCardConfig;
  hass?: HomeAssistant;
  preview: boolean;
  layout?: string;
  load(): void;
  getCardSize?(): number | Promise<number>;
}

const TAG = 'hui-card';

/**
 * Resolves once `hui-card` is defined. Inside a dashboard it already is -
 * this card is itself being rendered by one - so this settles immediately;
 * the timeout only matters outside Home Assistant.
 */
export function whenHuiCardDefined(): Promise<void> {
  if (customElements.get(TAG)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Home Assistant's "${TAG}" element is not available`)),
      HUI_CARD_TIMEOUT_MS,
    );
    customElements.whenDefined(TAG).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** The way hui-stack-card creates its children, step for step. */
export function createHuiCard(
  config: LovelaceCardConfig,
  hass: HomeAssistant | undefined,
  preview: boolean,
): HuiCardElement {
  const element = document.createElement(TAG) as HuiCardElement;
  element.hass = hass;
  element.preview = preview;
  element.config = config;
  element.load();
  return element;
}
