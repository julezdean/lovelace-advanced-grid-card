# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0-beta.1] - 2026-09-30

### Added

- A visual editor, laid out like Home Assistant's grid card editor: the
  card's options, then one tab per card with that card's own editor, its
  visibility tab, a width field above it and buttons to move, copy, cut and
  delete. Tabs show each card's width.
- The card picker shows a preview: the card starts from three tiles on real
  entities (two half-width, one full-width).

### Fixed

- The README's HACS instructions are back to what they were: the "Open in
  HACS" button adds the repository by itself. What made it fail before 0.1.0
  was that only a pre-release existed, not that the repository was unknown.

## [0.1.0] - 2026-09-30

The same card as 0.1.0-beta.1, now as a regular release. HACS cannot add a
repository that has only a pre-release: it then looks for the card on the
`main` branch, where the built file is not committed, and reports the
repository as not compliant.

### Fixed

- The README's HACS instructions: the repository has to be added as a custom
  repository before the "Open in HACS" button can find it.

## [0.1.0-beta.1] - 2026-09-30

The first release, as a beta: the layout is tested and measured in a browser,
but the card has not yet run inside a real Home Assistant. Requires Home
Assistant 2024.6 or later.

### Added

- The card: a grid of ordinary Lovelace cards in which every card sets its
  own width with `grid_span`, on a raster of `columns` (default 12).
- `packing: fill` (default), `dense` and `row` decide what happens to the
  room a card too wide for the rest of its row leaves behind.
- `last_row: stretch` widens the cards of the last row to the full width.
- `grid_span` can take one value per card size: `narrow`, `medium`, `wide`.
- `visibility` and conditional cards work on every child card; a hidden card
  takes no room, and the grid hides itself when all of them are hidden.
