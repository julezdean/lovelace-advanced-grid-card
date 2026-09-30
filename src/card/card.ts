import { createHuiCard, whenHuiCardDefined, type HuiCardElement } from '../children/hui-card';
import { normalizeConfig } from '../config/normalize';
import { EDITOR_TAG } from '../const';
import { computeLayout } from '../layout/engine';
import { widthClassFor } from '../layout/width';
import type { GridConfig, HomeAssistant, WidthClass } from '../types';
import { fireEvent } from '../utils';
import { STYLES } from './styles';

/** Importable outside a browser (for tests) without dragging in a DOM shim. */
const BaseElement = (
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
) as typeof HTMLElement;

/**
 * The width class assumed before the card has been measured. Only responsive
 * configurations look at it, and the first ResizeObserver callback arrives
 * before the first paint, so it is not normally seen.
 */
const UNMEASURED: WidthClass = 'medium';

export class AdvancedGridCard extends BaseElement {
  static async getConfigElement(): Promise<HTMLElement> {
    return document.createElement(EDITOR_TAG);
  }

  /**
   * What the card picker previews and a new card starts from: three tiles on
   * real entities where there are any, so the preview shows what the card is
   * for - two half-width cards and a full-width one.
   */
  static getStubConfig(_hass: unknown, entities: string[] = []): Record<string, unknown> {
    const preferred = ['light.', 'switch.', 'fan.', 'cover.'];
    const picked = [
      ...entities.filter((id) => preferred.some((domain) => id.startsWith(domain))),
      ...entities,
    ].filter((id, index, all) => all.indexOf(id) === index);
    const spans = [6, 6, 12];
    const cards =
      picked.length >= spans.length
        ? spans.map((span, i) => ({ type: 'tile', entity: picked[i], grid_span: span }))
        : spans.map((span, i) => ({
            type: 'markdown',
            content: `Card ${i + 1} - grid_span ${span}`,
            grid_span: span,
          }));
    return { columns: 12, cards };
  }

  /**
   * Home Assistant keeps a hidden card attached when it sets this. The card
   * hides itself when every child is hidden, and has to stay attached for a
   * child to become visible again and bring it back.
   */
  connectedWhileHidden = true;

  private _config: GridConfig | null = null;
  private _hass: HomeAssistant | undefined;
  private _preview = false;
  private _children: HuiCardElement[] = [];
  /** Child indices per row, as last laid out. */
  private _rows: number[][] = [];

  private readonly _root: ShadowRoot;
  private readonly _header: HTMLElement;
  private readonly _grid: HTMLElement;
  private readonly _notice: HTMLElement;

  private _widthClass: WidthClass = UNMEASURED;
  private _observer: ResizeObserver | null = null;
  /** What the last layout was computed from; equal input means no DOM writes. */
  private _layoutKey = '';
  private _layoutQueued = false;

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._header = document.createElement('h1');
    this._header.className = 'card-header';
    this._header.hidden = true;
    this._grid = document.createElement('div');
    this._grid.id = 'root';
    this._notice = document.createElement('div');
    this._notice.className = 'notice';
    this._notice.hidden = true;
    this._root.append(style, this._header, this._grid, this._notice);
  }

  /* --- Lovelace API ----------------------------------------------------- */

  setConfig(raw: unknown): void {
    // Throws on a mistake; Home Assistant shows the message instead of the card.
    const config = normalizeConfig(raw);
    this._config = config;

    this._header.textContent = config.title ?? '';
    this._header.hidden = !config.title;
    this._grid.style.setProperty('--agc-columns', String(config.columns));
    this._grid.style.setProperty('--agc-gap', config.gap);
    this._grid.dir = this._direction();
    this._watchWidth();

    // Synchronously when possible: an asynchronous gap would render the card
    // empty for a frame on every configuration change in the editor.
    if (customElements.get('hui-card')) {
      this._syncChildren();
    } else {
      whenHuiCardDefined()
        .then(() => {
          if (this._config === config) this._syncChildren();
        })
        .catch((err: Error) => this._showNotice(err.message, true));
    }
  }

  set hass(hass: HomeAssistant | undefined) {
    this._hass = hass;
    this._grid.dir = this._direction();
    this._children.forEach((child) => {
      child.hass = hass;
    });
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  /** Edit mode: hui-card then shows every child, hidden or not. */
  set preview(preview: boolean) {
    this._preview = !!preview;
    this._children.forEach((child) => {
      child.preview = this._preview;
    });
    this._scheduleLayout();
  }

  get preview(): boolean {
    return this._preview;
  }

  /** Same rule as the stack card: in a panel view the children keep their corners. */
  set layout(layout: string | undefined) {
    this.toggleAttribute('ispanel', layout === 'panel');
  }

  /**
   * Height in Lovelace's 50px units, for the masonry view: per row the
   * tallest child, as that is how high a grid row becomes.
   */
  async getCardSize(): Promise<number> {
    if (!this._config) return 1;
    const title = this._config.title ? 1 : 0;
    const sizes = await Promise.all(
      this._children.map(async (child) => {
        try {
          return (await child.getCardSize?.()) ?? 1;
        } catch {
          return 1;
        }
      }),
    );
    const rows = this._rows.reduce(
      (sum, row) => sum + Math.max(0, ...row.map((index) => sizes[index] ?? 1)),
      0,
    );
    return Math.max(1, title + rows);
  }

  /**
   * Sections view: the whole width of the section, and as high as the
   * children turn out to be - the layout decides the row count, so no fixed
   * number of section rows can be right.
   */
  getGridOptions(): { columns: number; rows: 'auto' } {
    return { columns: 12, rows: 'auto' };
  }

  /** The same for Home Assistant before 2024.11, whose sections had 4 columns. */
  getLayoutOptions(): { grid_columns: number; grid_rows: 'auto' } {
    return { grid_columns: 4, grid_rows: 'auto' };
  }

  /* --- Lifecycle -------------------------------------------------------- */

  connectedCallback(): void {
    this._watchWidth();
  }

  disconnectedCallback(): void {
    this._observer?.disconnect();
    this._observer = null;
  }

  /* --- Children --------------------------------------------------------- */

  /**
   * One hui-card per configured card, reused by position. Reusing matters in
   * the editor, where every keystroke is a new configuration: hui-card then
   * updates its card in place instead of the whole grid being torn down.
   * Nodes are only ever appended or removed, never moved - moving a card
   * disconnects and reconnects it, and cards with subscriptions rebuild on
   * that.
   */
  private _syncChildren(): void {
    const config = this._config;
    if (!config) return;

    config.cards.forEach((child, index) => {
      const existing = this._children[index];
      if (existing) {
        existing.config = child.card;
        return;
      }
      const element = createHuiCard(child.card, this._hass, this._preview);
      element.addEventListener('card-visibility-changed', this._onChildVisibility);
      this._children.push(element);
      this._grid.appendChild(element);
    });

    this._children.splice(config.cards.length).forEach((element) => {
      element.removeEventListener('card-visibility-changed', this._onChildVisibility);
      element.remove();
    });

    this._layoutKey = '';
    this._applyLayout();
  }

  private readonly _onChildVisibility = (): void => this._scheduleLayout();

  /* --- Layout ----------------------------------------------------------- */

  /**
   * Several children changing visibility in one update would otherwise lay
   * the grid out once each. A microtask still runs before the next paint.
   */
  private _scheduleLayout(): void {
    if (this._layoutQueued) return;
    this._layoutQueued = true;
    queueMicrotask(() => {
      this._layoutQueued = false;
      this._applyLayout();
    });
  }

  private _applyLayout(): void {
    const config = this._config;
    if (!config) return;

    // hui-card hides itself (display: none + [hidden]) for a card that is not
    // visible, so its attribute is the one source of truth - it covers
    // `visibility`, `disabled` and a conditional card alike.
    const visible = this._children
      .map((_, index) => index)
      .filter((index) => !this._children[index].hidden);

    const widthClass = config.responsive ? this._widthClass : UNMEASURED;
    const key = `${widthClass}|${visible.join(',')}`;
    if (key === this._layoutKey) return;
    this._layoutKey = key;

    const spans = visible.map((index) => config.cards[index].span[widthClass]);
    const layout = computeLayout(spans, config.columns, config.packing, config.last_row);

    for (const placement of layout.placements) {
      const child = this._children[visible[placement.index]];
      child.style.gridRow = String(placement.row + 1);
      child.style.gridColumn = `${placement.column + 1} / span ${placement.span}`;
    }
    this._rows = layout.rows.map((row) => row.map((index) => visible[index]));

    this._updateEmpty(visible.length === 0);
  }

  /**
   * No child visible: the card hides itself, the way a conditional card does,
   * rather than leaving an empty gap in the dashboard. In the editor an empty
   * list says so instead, since there is nothing else to click on.
   */
  private _updateEmpty(empty: boolean): void {
    const hide = empty && !this._preview;
    if (this.hidden !== hide) {
      this.hidden = hide;
      fireEvent(this, 'card-visibility-changed', { value: !hide });
    }
    if (empty && this._preview && this._children.length === 0) {
      this._showNotice('No cards yet - add them under "cards:"', false);
    } else if (!this._notice.classList.contains('error')) {
      this._notice.hidden = true;
    }
  }

  private _showNotice(text: string, error: boolean): void {
    this._notice.textContent = text;
    this._notice.classList.toggle('error', error);
    this._notice.hidden = false;
  }

  /* --- Width ------------------------------------------------------------ */

  /**
   * Only a configuration whose spans differ between width classes needs to
   * know how wide the card is. Everything else is plain CSS: the tracks are
   * fractions, and which card sits in which row does not depend on the width.
   *
   * Width only, never height: the height is the layout's result, and watching
   * it would feed the layout back into itself.
   */
  private _watchWidth(): void {
    const wanted = !!this._config?.responsive && this.isConnected;
    if (!wanted) {
      this._observer?.disconnect();
      this._observer = null;
      return;
    }
    if (this._observer || typeof ResizeObserver === 'undefined') return;

    this._observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      this._onWidth(width);
    });
    this._observer.observe(this);
    this._onWidth(this.clientWidth);
  }

  private _onWidth(width: number): void {
    // Zero while hidden or not yet laid out - no information, keep the last class.
    if (width <= 0) return;
    const widthClass = widthClassFor(width);
    if (widthClass === this._widthClass) return;
    this._widthClass = widthClass;
    this._applyLayout();
  }

  /**
   * Right-to-left languages mirror the grid: explicit column numbers count
   * from the start edge, so setting `dir` is all it takes. The same lookup as
   * the frontend's computeRTLDirection, which the stack card uses.
   */
  private _direction(): string {
    const hass = this._hass as
      | {
          language?: string;
          translationMetadata?: { translations?: Record<string, { isRTL?: boolean }> };
        }
      | undefined;
    const language = hass?.language ?? 'en';
    return hass?.translationMetadata?.translations?.[language]?.isRTL ? 'rtl' : 'ltr';
  }
}
