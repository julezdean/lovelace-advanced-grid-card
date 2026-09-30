import {
  mdiArrowLeft,
  mdiArrowRight,
  mdiCodeBraces,
  mdiContentCopy,
  mdiContentCut,
  mdiContentPaste,
  mdiDelete,
  mdiListBoxOutline,
  mdiPlus,
} from '@mdi/js';
import type { HomeAssistant, LovelaceCardConfig } from '../types';
import { fireEvent, isDict } from '../utils';
import { readClipboard, writeClipboard } from './clipboard';
import {
  CARD_EDITOR_TAG,
  CARD_PICKER_TAG,
  ensureEditorElements,
  FORM_TAG,
  ICON_BUTTON_TAG,
} from './loaders';
import { cardSchema, HELPERS, LABELS, spanSchema } from './schema';
import { EDITOR_STYLES } from './styles';
import {
  addCard,
  applyCardForm,
  applySpanForm,
  cardFormData,
  columnsOf,
  moveCard,
  removeCard,
  replaceCard,
  spanFormData,
  tabLabel,
  withGridKeys,
  withoutGridKeys,
  type CardFormData,
  type GridEditorConfig,
  type SpanFormData,
} from './transform';

const BaseElement = (
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
) as typeof HTMLElement;

interface FormElement extends HTMLElement {
  hass?: HomeAssistant;
  data?: unknown;
  schema?: unknown;
  computeLabel?: (schema: { name: string }) => string;
  computeHelper?: (schema: { name: string }) => string | undefined;
}

interface CardEditorElement extends HTMLElement {
  hass?: HomeAssistant;
  lovelace?: unknown;
  value?: LovelaceCardConfig;
  toggleMode?: () => void;
}

interface CardPickerElement extends HTMLElement {
  hass?: HomeAssistant;
  lovelace?: unknown;
}

interface IconButtonElement extends HTMLElement {
  path?: string;
  label?: string;
  disabled?: boolean;
}

type Localize = (key: string) => string;

/**
 * The visual editor. It follows Home Assistant's own grid card editor - the
 * card's options on top, then one tab per card with that card's own editor -
 * but is built from the parts rather than by extending Home Assistant's
 * editor class, for two reasons:
 *
 *   - Each child's editor must get its configuration *without* grid_span.
 *     Home Assistant's card editors validate against a struct that refuses
 *     unknown keys and would fall back to "visual editor not supported". The
 *     stack editor hands the configuration over in the middle of a large
 *     render(), so extending it would mean replacing that render() - and
 *     depending on its private members all the same.
 *   - The elements used here (ha-form, ha-icon-button, hui-card-element-editor,
 *     hui-card-picker) have existed for years; the tab group the stack
 *     editor uses today does not reach back to Home Assistant 2024.6.
 *
 * Forms and the child's editor are created once per tab and then only fed
 * new values, so typing into a field never loses the focus.
 */
export class AdvancedGridCardEditor extends BaseElement {
  private _hass: HomeAssistant | undefined;
  private _lovelace: unknown;
  private _config: GridEditorConfig | null = null;
  private _state: 'loading' | 'ready' | 'failed' = 'loading';
  private _loading = false;

  /** The open tab: a card's index, or cards.length for "add a card". */
  private _selected = 0;
  /**
   * Bumped whenever cards are added, moved or removed. The open tab then gets
   * a fresh editor, the way Home Assistant's stack editor re-keys it: an
   * editor that was showing card 2 must not carry its state over to whatever
   * is card 2 now.
   */
  private _epoch = 0;

  private readonly _root: ShadowRoot;
  private _cardForm: FormElement | null = null;
  private _cardData: CardFormData | null = null;
  private _cardSchemaColumns = 0;
  private _tabs: HTMLElement | null = null;
  private _tabsKey = '';
  private _panel: HTMLElement | null = null;
  private _panelKey = '';

  private _spanForm: FormElement | null = null;
  private _spanData: SpanFormData | null = null;
  private _spanSchemaKey = '';
  private _childEditor: CardEditorElement | null = null;
  private _modeButton: IconButtonElement | null = null;
  private _guiMode = true;
  private _picker: CardPickerElement | null = null;

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
  }

  /* --- Lovelace editor API ---------------------------------------------- */

  setConfig(config: unknown): void {
    if (!isDict(config) || !Array.isArray(config.cards)) {
      throw new Error('"cards" must be a list of cards');
    }
    this._config = config as GridEditorConfig;
    this._selected = Math.min(this._selected, this._config.cards.length);
    this._render();
  }

  set hass(hass: HomeAssistant | undefined) {
    this._hass = hass;
    for (const element of [this._cardForm, this._spanForm, this._childEditor, this._picker]) {
      if (element) element.hass = hass;
    }
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  set lovelace(lovelace: unknown) {
    this._lovelace = lovelace;
    if (this._childEditor) this._childEditor.lovelace = lovelace;
    if (this._picker) this._picker.lovelace = lovelace;
  }

  get lovelace(): unknown {
    return this._lovelace;
  }

  connectedCallback(): void {
    if (this._state !== 'loading' || this._loading) return;
    this._loading = true;
    ensureEditorElements().then((ok) => {
      this._loading = false;
      this._state = ok ? 'ready' : 'failed';
      this._render();
    });
  }

  /* --- Rendering -------------------------------------------------------- */

  private _render(): void {
    const config = this._config;
    if (!config || this._state === 'loading') return;
    this._buildSkeleton();
    this._renderCardForm(config);

    if (this._state === 'failed') {
      this._renderUnavailable();
      return;
    }
    this._renderTabs(config);
    this._renderPanel(config);
  }

  private _buildSkeleton(): void {
    if (this._cardForm) return;
    const style = document.createElement('style');
    style.textContent = EDITOR_STYLES;

    this._cardForm = this._createForm((value) => {
      const config = this._config;
      if (!config || !this._cardData) return;
      this._commit(applyCardForm(config, this._cardData, value as CardFormData));
    });

    const cards = document.createElement('div');
    cards.className = 'cards';
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    this._tabs = document.createElement('div');
    this._tabs.className = 'tabs';
    this._tabs.setAttribute('role', 'tablist');
    const add = this._iconButton(
      mdiPlus,
      this._t('ui.panel.lovelace.editor.edit_card.add', 'Add card'),
      () => {
        this._select(this._config?.cards.length ?? 0);
      },
    );
    toolbar.append(this._tabs, add);
    this._panel = document.createElement('div');
    this._panel.className = 'panel';
    cards.append(toolbar, this._panel);

    this._root.append(style, this._cardForm, cards);
  }

  private _renderCardForm(config: GridEditorConfig): void {
    const form = this._cardForm;
    if (!form) return;
    const columns = columnsOf(config);
    // A new schema re-renders the whole form; only when its bounds change.
    if (columns !== this._cardSchemaColumns) {
      form.schema = cardSchema(columns);
      this._cardSchemaColumns = columns;
    }
    this._cardData = cardFormData(config);
    form.data = this._cardData;
  }

  private _renderUnavailable(): void {
    if (!this._panel || this._panelKey === 'unavailable') return;
    this._panelKey = 'unavailable';
    if (this._tabs) this._tabs.parentElement!.hidden = true;
    const notice = document.createElement('p');
    notice.className = 'notice';
    notice.textContent =
      "Home Assistant's card editors could not be loaded. Edit the cards in the code editor.";
    this._panel.replaceChildren(notice);
  }

  private _renderTabs(config: GridEditorConfig): void {
    if (!this._tabs) return;
    const columns = columnsOf(config);
    const labels = config.cards.map((card, index) => tabLabel(card, index, columns));
    const key = `${this._selected}|${labels.join('\u0000')}`;
    if (key === this._tabsKey) return;
    this._tabsKey = key;

    this._tabs.replaceChildren(
      ...labels.map((label, index) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'tab';
        tab.textContent = label;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(index === this._selected));
        tab.addEventListener('click', () => this._select(index));
        return tab;
      }),
    );
  }

  private _renderPanel(config: GridEditorConfig): void {
    if (!this._panel) return;
    const adding = this._selected >= config.cards.length;
    const key = adding ? `add|${this._epoch}` : `card|${this._selected}|${this._epoch}`;

    if (key !== this._panelKey) {
      this._panelKey = key;
      this._spanForm = null;
      this._childEditor = null;
      this._picker = null;
      this._modeButton = null;
      this._spanSchemaKey = '';
      this._panel.replaceChildren(...(adding ? this._buildAddPanel() : this._buildCardPanel()));
    }

    if (!adding) this._updateCardPanel(config, config.cards[this._selected]);
  }

  private _buildCardPanel(): HTMLElement[] {
    const options = document.createElement('div');
    options.className = 'card-options';

    this._modeButton = this._iconButton(mdiCodeBraces, '', () => this._childEditor?.toggleMode?.());
    this._modeButton.classList.add('mode');
    this._updateModeButton();

    const index = this._selected;
    const count = this._config?.cards.length ?? 0;
    const previous = this._iconButton(
      mdiArrowLeft,
      this._t('ui.panel.lovelace.editor.edit_card.move_before', 'Move before'),
      () => this._move(-1),
    );
    previous.disabled = index === 0;
    const next = this._iconButton(
      mdiArrowRight,
      this._t('ui.panel.lovelace.editor.edit_card.move_after', 'Move after'),
      () => this._move(1),
    );
    next.disabled = index >= count - 1;

    options.append(
      this._modeButton,
      previous,
      next,
      this._iconButton(
        mdiContentCopy,
        this._t('ui.panel.lovelace.editor.edit_card.copy', 'Copy'),
        () => this._copy(),
      ),
      this._iconButton(
        mdiContentCut,
        this._t('ui.panel.lovelace.editor.edit_card.cut', 'Cut'),
        () => this._cut(),
      ),
      this._iconButton(
        mdiDelete,
        this._t('ui.panel.lovelace.editor.edit_card.delete', 'Delete'),
        () => this._delete(),
      ),
    );

    this._spanForm = this._createForm((value) => {
      const config = this._config;
      if (!config || !this._spanData) return;
      const card = config.cards[this._selected];
      this._commit(
        replaceCard(
          config,
          this._selected,
          applySpanForm(card, this._spanData, value as SpanFormData),
        ),
      );
    });
    this._spanForm.classList.add('span-form');

    const editor = document.createElement(CARD_EDITOR_TAG) as CardEditorElement;
    // The visibility tab, as in the sections view: hiding a card is part of
    // arranging a grid.
    editor.setAttribute('show-visibility-tab', '');
    editor.hass = this._hass;
    editor.lovelace = this._lovelace;
    editor.addEventListener('config-changed', (ev) => this._onChildChanged(ev as CustomEvent));
    editor.addEventListener('GUImode-changed', (ev) => {
      ev.stopPropagation();
      const detail = (ev as CustomEvent).detail as { guiMode: boolean; guiModeAvailable?: boolean };
      this._guiMode = detail.guiMode;
      this._updateModeButton(detail.guiModeAvailable);
    });
    this._childEditor = editor;

    return [options, this._spanForm, editor];
  }

  private _updateCardPanel(config: GridEditorConfig, card: LovelaceCardConfig): void {
    const columns = columnsOf(config);
    if (this._spanForm) {
      this._spanData = spanFormData(card, columns);
      const schemaKey = `${columns}|${this._spanData.responsive}`;
      if (schemaKey !== this._spanSchemaKey) {
        this._spanForm.schema = spanSchema(columns, this._spanData.responsive);
        this._spanSchemaKey = schemaKey;
      }
      this._spanForm.data = this._spanData;
    }
    // hui-element-editor ignores a value deep-equal to the one it has, so
    // this does not reset the child's editor on every keystroke.
    if (this._childEditor) this._childEditor.value = withoutGridKeys(card);
  }

  private _buildAddPanel(): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const clipboard = readClipboard();
    if (clipboard) {
      const paste = document.createElement('button');
      paste.type = 'button';
      paste.className = 'paste';
      paste.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${mdiContentPaste}"></path></svg>`;
      paste.append(
        document.createTextNode(
          `${this._t('ui.panel.lovelace.editor.edit_card.paste', 'Paste from clipboard')}: ${clipboard.type}`,
        ),
      );
      paste.addEventListener('click', () => this._add(clipboard));
      elements.push(paste);
    }

    const picker = document.createElement(CARD_PICKER_TAG) as CardPickerElement;
    picker.hass = this._hass;
    picker.lovelace = this._lovelace;
    picker.addEventListener('config-changed', (ev) => {
      ev.stopPropagation();
      const card = (ev as CustomEvent).detail?.config as LovelaceCardConfig | undefined;
      if (card) this._add(card);
    });
    this._picker = picker;
    elements.push(picker);
    return elements;
  }

  /* --- Actions ---------------------------------------------------------- */

  private _onChildChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const config = this._config;
    const detail = ev.detail as { config?: LovelaceCardConfig; guiModeAvailable?: boolean };
    if (!config || !detail.config) return;
    this._updateModeButton(detail.guiModeAvailable);
    const original = config.cards[this._selected];
    if (!original) return;
    this._commit(replaceCard(config, this._selected, withGridKeys(detail.config, original)));
  }

  private _select(index: number): void {
    if (index === this._selected) return;
    this._selected = index;
    this._guiMode = true;
    if (this._config) this._render();
  }

  private _move(by: number): void {
    const config = this._config;
    if (!config) return;
    const moved = moveCard(config, this._selected, by);
    if (moved === config) return;
    this._selected += by;
    this._epoch++;
    this._commit(moved);
  }

  /**
   * Copies the card as Home Assistant knows it - without grid_span, which a
   * card pasted anywhere else would only carry as an unknown key.
   */
  private _copy(): void {
    const card = this._config?.cards[this._selected];
    if (card) writeClipboard(withoutGridKeys(card));
  }

  private _cut(): void {
    this._copy();
    this._delete();
  }

  private _delete(): void {
    const config = this._config;
    if (!config) return;
    const index = this._selected;
    // The card before it, as in Home Assistant's editor.
    this._selected = Math.max(0, index - 1);
    this._epoch++;
    this._commit(removeCard(config, index));
  }

  private _add(card: LovelaceCardConfig): void {
    const config = this._config;
    if (!config) return;
    this._selected = config.cards.length;
    this._epoch++;
    this._commit(addCard(config, card));
  }

  /** Hands the new configuration to Home Assistant, unless nothing changed. */
  private _commit(next: GridEditorConfig): void {
    const changed = JSON.stringify(next) !== JSON.stringify(this._config);
    this._config = next;
    this._selected = Math.min(this._selected, next.cards.length);
    this._render();
    if (changed) fireEvent(this, 'config-changed', { config: next });
  }

  /* --- Helpers ---------------------------------------------------------- */

  private _createForm(onChange: (value: unknown) => void): FormElement {
    const form = document.createElement(FORM_TAG) as FormElement;
    form.hass = this._hass;
    form.computeLabel = (schema) => LABELS[schema.name] ?? schema.name;
    form.computeHelper = (schema) => HELPERS[schema.name];
    form.addEventListener('value-changed', (ev) => {
      ev.stopPropagation();
      onChange((ev as CustomEvent).detail?.value);
    });
    return form;
  }

  private _iconButton(path: string, label: string, onClick: () => void): IconButtonElement {
    const button = document.createElement(ICON_BUTTON_TAG) as IconButtonElement;
    button.path = path;
    button.label = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private _updateModeButton(available?: boolean): void {
    const button = this._modeButton;
    if (!button) return;
    if (available !== undefined) button.disabled = !available;
    button.path = this._guiMode ? mdiCodeBraces : mdiListBoxOutline;
    button.label = this._guiMode
      ? this._t('ui.panel.lovelace.editor.edit_card.show_code_editor', 'Show code editor')
      : this._t('ui.panel.lovelace.editor.edit_card.show_visual_editor', 'Show visual editor');
  }

  /** Home Assistant's own wording where it has one, in the user's language. */
  private _t(key: string, fallback: string): string {
    const localize = (this._hass as { localize?: Localize } | undefined)?.localize;
    const text = localize ? localize(key) : '';
    return text || fallback;
  }
}
