// Guards for the last-resort full-text location match (locations.ts resolveLocation).

const words = (s: string) => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];

/**
 * True when the query and the indexed text share a word of 3+ letters (prefixes count:
 * "restroom" ~ "restrooms"). Numbers alone never count, so "Gate 3" does not match "table 3".
 */
export function sharesWord(query: string, searchText: string): boolean {
  const indexed = words(searchText);
  return words(query).some((q) => indexed.some((w) => w.startsWith(q) || q.startsWith(w)));
}
