// This app is RTL — "forward" moves visually right→left (see EntryPage.jsx's
// month navigator: "next" sits on the left with a left-pointing chevron),
// the opposite of a typical LTR carousel. Flip this ONE constant if the
// slide-in/out side feels backwards after a visual check in the browser.
export const RTL_DIRECTION_SIGN = 1;

// Which side the incoming/outgoing panel's variant offset comes from, given
// the raw array-index delta (newIndex - oldIndex). Purely a rendering choice —
// does not affect which tab a drag lands on (see dragToIndexDelta below).
export function slideDirectionForIndexDelta(indexDelta) {
  return Math.sign(indexDelta) * RTL_DIRECTION_SIGN;
}

const SWIPE_CONFIDENCE_THRESHOLD = 10000;

// Standard "swipe power" pagination formula (Math.abs(offset) * velocity).
// Intentionally NOT RTL-corrected: dragging a panel out of the way to reveal
// the next one in sequence is a physical "conveyor belt" gesture, orientation-
// agnostic regardless of text direction — only the *visual* slide direction
// (above) needs the RTL flip.
export function dragToIndexDelta(offsetX, velocityX) {
  const power = Math.abs(offsetX) * velocityX;
  if (power < -SWIPE_CONFIDENCE_THRESHOLD) return 1;
  if (power > SWIPE_CONFIDENCE_THRESHOLD) return -1;
  return 0;
}
