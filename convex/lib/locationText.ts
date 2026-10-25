// Text normalization for matching what a caller said against location labels.

// Phone speech recognition often hears "Broadway" as "gateway" / "gate way" / "broad way".
// The venue has no Gate #1 or #2 (gates are #3, #4, #6), so "gateway N" is Broadway N.
const BROADWAY_MISHEARINGS = /\b(?:gate\s?way|broad\s?way|brother\s?way)\b/g;

export const normalizeLocationText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(BROADWAY_MISHEARINGS, "broadway")
    .replace(/\b(the|near|by|at|next to|in front of)\b/g, " ")
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
