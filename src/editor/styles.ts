/** Modelled on Home Assistant's stack card editor, which users know. */
export const EDITOR_STYLES = `
:host {
  display: block;
}
.cards {
  margin-top: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}
.toolbar[hidden] {
  display: none;
}
.tabs {
  display: flex;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tab {
  flex: 0 0 auto;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--secondary-text-color);
  font: inherit;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  padding: 12px 16px;
  cursor: pointer;
  white-space: nowrap;
}
.tab:hover {
  color: var(--primary-text-color);
}
.tab[aria-selected='true'] {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}
.panel {
  border: 1px solid var(--divider-color);
  padding: 12px;
}
@media (max-width: 450px) {
  .panel {
    margin: 0 -12px;
  }
}
.card-options {
  display: flex;
  justify-content: flex-end;
}
.card-options .mode {
  margin-inline-end: auto;
}
.span-form {
  display: block;
  margin-bottom: 16px;
}
.paste {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 12px;
  padding: 12px;
  background: none;
  border: 1px dashed var(--divider-color);
  border-radius: 8px;
  color: var(--primary-color);
  font: inherit;
  cursor: pointer;
}
.paste svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
.notice {
  color: var(--secondary-text-color);
  margin: 0;
}
`;
