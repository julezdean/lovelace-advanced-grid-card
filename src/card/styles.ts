/**
 * The card draws no surface of its own - no <ha-card>, no background - just
 * like the native grid and stack cards: it is a container, and each child
 * brings its own card. The header and the panel rule are the stack card's.
 */
export const STYLES = `
:host {
  display: flex;
  flex-direction: column;
  height: 100%;
}
/* The UA rule for [hidden] loses against display: flex above. */
:host([hidden]) {
  display: none;
}

.card-header {
  color: var(--ha-card-header-color, var(--primary-text-color));
  text-align: var(--ha-stack-title-text-align, start);
  font-family: var(--ha-card-header-font-family, inherit);
  font-size: var(--ha-card-header-font-size, var(--ha-font-size-2xl, 24px));
  font-weight: var(--ha-font-weight-normal, 400);
  margin-block-start: 0;
  margin-block-end: 0;
  letter-spacing: -0.012em;
  line-height: var(--ha-line-height-condensed, 1.2);
  display: block;
  padding: 24px 16px 16px;
}
.card-header[hidden] {
  display: none;
}

/* Every card is placed explicitly (grid-row, grid-column) by the layout
   engine, so the auto-placement algorithm never decides anything here.
   minmax(0, 1fr) rather than 1fr so that wide content cannot push one track
   past its share and throw the raster off. */
#root {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--agc-columns, 12), minmax(0, 1fr));
  gap: var(--agc-gap, var(--grid-card-gap, 8px));
}
#root > * {
  min-width: 0;
}

:host([ispanel]) #root {
  --ha-card-border-radius: var(--restore-card-border-radius);
  --ha-card-border-width: var(--restore-card-border-width);
  --ha-card-box-shadow: var(--restore-card-box-shadow);
}

.notice {
  color: var(--secondary-text-color);
  border: 1px dashed var(--divider-color, rgba(127, 127, 127, 0.4));
  border-radius: var(--ha-card-border-radius, 12px);
  padding: 16px;
  font-size: 14px;
}
.notice.error {
  color: var(--error-color, #db4437);
  border-color: currentColor;
}
.notice[hidden] {
  display: none;
}
`;
