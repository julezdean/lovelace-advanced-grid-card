#!/usr/bin/env bash
#
# Regenerates docs/images/*.png from the demo harness.
#
#   npm run screenshots        (builds first)
#
# The harness in tools/demo/ imports the built dist/advanced-grid-card.js, so
# the images always show the current code rather than a copy of it. It stands
# in for Home Assistant's hui-card with a fake of the same interface; what the
# images show is this card's layout, not any real card's look.
#
# The window sizes below are not arbitrary: each is the scene's measured body
# size at that width, so the image has the same 24px margin all round. If a
# scene changes, re-measure and update the size here - a cropped screenshot is
# a wrong screenshot. To measure, open the scene in a wide window and read:
#
#   [document.body.scrollWidth, Math.ceil(document.body.getBoundingClientRect().height)]
#
# Requires: Google Chrome, python3.

set -euo pipefail

cd "$(dirname "$0")/.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8199
OUT=docs/images
SCALE=2   # retina-quality PNGs

[ -x "$CHROME" ] || { echo "Google Chrome not found at $CHROME" >&2; exit 1; }
[ -f dist/advanced-grid-card.js ] || { echo "No bundle in dist/ - run: npm run screenshots" >&2; exit 1; }

mkdir -p "$OUT"

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

# Wait for the server rather than sleeping a guessed amount.
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$PORT/tools/demo/index.html" >/dev/null && break
  sleep 0.1
done

shoot() {
  local scene=$1 size=$2 name=$3 scale=${4:-$SCALE}
  "$CHROME" \
    --headless \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=$scale \
    --window-size="$size" \
    --screenshot="$OUT/$name.png" \
    --virtual-time-budget=1500 \
    "http://127.0.0.1:$PORT/tools/demo/index.html?scene=$scene" >/dev/null 2>&1
  echo "  $OUT/$name.png  (${size}, scene=$scene)"
}

echo "Rendering screenshots:"
shoot overview   "568,301"   overview
shoot packing    "1304,255"    packing
shoot responsive "1884,255" responsive 1
shoot visibility "876,255" visibility
shoot last-row   "1036,191"   last-row
echo "Done."
