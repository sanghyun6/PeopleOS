// Text normalization for matching what a caller said against location labels.

// "Gate 3/4", "Gate #3/#4", "gates 3 and 4" all name the same pair of gates, which share one
// zone. Collapse them to "gate 3" (an alias of that zone) so every spelling resolves the same
// way, including "hallway near Gate 3/4" -> the Gate #3/#4 hallway.
const GATE_PAIR = /\bgates?\s*#?3\s*(?:\/|&|and|-|,)\s*#?4\b/g;

export const normalizeLocationText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(GATE_PAIR, "gate 3")
    .replace(/\b(the|near|by|at|next to|in front of)\b/g, " ")
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
