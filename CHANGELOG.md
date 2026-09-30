# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The card: a grid of ordinary Lovelace cards in which every card sets its
  own width with `grid_span`, on a raster of `columns` (default 12).
- `packing: fill` (default), `dense` and `row` decide what happens to the
  room a card too wide for the rest of its row leaves behind.
- `last_row: stretch` widens the cards of the last row to the full width.
- `grid_span` can take one value per card size: `narrow`, `medium`, `wide`.
- `visibility` and conditional cards work on every child card; a hidden card
  takes no room, and the grid hides itself when all of them are hidden.
