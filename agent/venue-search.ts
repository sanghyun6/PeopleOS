// Pure helpers for the venue_search tool: the documents we index in Moss, the keyword
// fallback used when Moss is slow or down, and the spoken-friendly message builder.
// No I/O here so scripts/moss-index.ts, convex/moss.ts, convex/cartesia.ts and the
// tests can share it.

export type KbEntry = {
  id: string;
  title: string;
  text: string;
  asOf?: string; // ISO timestamp the fact was last confirmed
  source?: string;
};

/** A retrieved fact, from Moss or the keyword fallback. Higher score = better. */
export type Fact = { id: string; title: string; text: string; asOf?: string; score: number };

/** What we send to Moss. `metadata` values must be strings. */
export type MossDoc = { id: string; text: string; metadata: Record<string, string> };

export const MOSS_INDEX_NAME = "calhacks-venue";
export const MOSS_TIMEOUT_MS = 2000;

export const NO_MATCH_MESSAGE =
  "No relevant event information found. Tell the caller you are not sure, and suggest the Info Desk at the Box Office check-in.";

/** Facts that go stale quickly: the spoken answer says when we last confirmed them. */
const TIME_SENSITIVE_IDS = new Set([
  "workshops-sat",
  "meals",
  "midnight-snack",
  "merch",
  "souvenir-shop",
  "showers",
  "mentors",
  "scrabblebot",
  "activities",
  "catering",
  "hardware-checkout",
  "poker",
  "sleeping-area",
]);

export const isTimeSensitive = (id: string) => TIME_SENSITIVE_IDS.has(id);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * One document per "Where things are" line of venue-guide.md:
 * `Area (level) | what is in it | Tables ... | next to ...`.
 */
export function areaDocuments(guide: string): KbEntry[] {
  const entries: KbEntry[] = [];
  for (const line of guide.split("\n")) {
    if (line.startsWith("Where things are.")) continue; // header line describing the format
    const parts = line.split(" | ").map((p) => p.trim());
    // "Area (floor name)"; Cal Hacks floors are "main floor" / "mezzanine", packs name their own.
    const head = /^(.+) \(([^()]+)\)$/.exec(parts[0] ?? "");
    if (!head || parts.length < 2) continue;
    const [, name, level] = head;
    const details = parts.slice(1).join(". ");
    entries.push({
      id: `area-${slug(name)}`,
      title: name,
      text: `${name} is on the ${level}. ${details}.`,
    });
  }
  return entries;
}

/** All documents for the Moss index: event facts plus one per venue area. */
export function buildMossDocuments(kb: KbEntry[], guide: string): MossDoc[] {
  const docs: MossDoc[] = kb.map((e) => ({
    id: e.id,
    text: `${e.title}. ${e.text}`,
    metadata: { kind: "event", title: e.title, body: e.text, ...(e.asOf ? { asOf: e.asOf } : {}), ...(e.source ? { source: e.source } : {}) },
  }));
  for (const a of areaDocuments(guide)) {
    docs.push({ id: a.id, text: `${a.title}. ${a.text}`, metadata: { kind: "area", title: a.title, body: a.text } });
  }
  return docs;
}

/** Moss result -> Fact. Falls back to the indexed text when metadata is missing. */
export function toFact(doc: { id: string; text: string; score: number; metadata?: Record<string, string> }): Fact {
  const m = doc.metadata ?? {};
  return { id: doc.id, title: m.title ?? doc.id, text: m.body ?? doc.text, asOf: m.asOf, score: doc.score };
}

/**
 * Moss returns topK hits even for nonsense ("fly to mars" scores 0.00); keep only hits
 * with real vector similarity, best first. Empty means "not in the event info".
 */
export const MIN_SCORE = 0.2;
export const relevantFacts = (facts: Fact[]): Fact[] =>
  facts.filter((f) => f.score >= MIN_SCORE).sort((a, b) => b.score - a.score);

const STOPWORDS = new Set(
  "a an and are as at be can do does for from get got how i in is it me my of on or the there to us we what when where which who will with you your any have has about tell need want know".split(" "),
);

function tokens(text: string): string[] {
  // "Wi-Fi" in the KB, "wifi" or "wi fi" on the phone.
  return (text.toLowerCase().replace(/wi[- ]?fi/g, "wifi").match(/[a-z0-9]+/g) ?? [])
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

const tokenMatches = (q: string, d: string) =>
  q === d || (q.length >= 4 && d.length >= 4 && (d.startsWith(q) || q.startsWith(d)));

/** Simple keyword match over the event KB: title hits weigh 3x, prefix matches count ("sleep" ~ "sleeping"). */
export function keywordSearch(kb: KbEntry[], query: string, topK = 3): Fact[] {
  const q = [...new Set(tokens(query))];
  if (q.length === 0) return [];
  return kb
    .map((e) => {
      const title = tokens(e.title);
      const body = tokens(e.text);
      let score = 0;
      for (const t of q) {
        if (title.some((d) => tokenMatches(t, d))) score += 3;
        else if (body.some((d) => tokenMatches(t, d))) score += 1;
      }
      return { id: e.id, title: e.title, text: e.text, asOf: e.asOf, score };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);

/** "7:08 PM Saturday" in venue time (Pacific). */
export function formatAsOf(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts = { timeZone: "America/Los_Angeles" } as const;
  const time = d.toLocaleTimeString("en-US", { ...opts, hour: "numeric", minute: "2-digit" });
  const day = d.toLocaleDateString("en-US", { ...opts, weekday: "long" });
  return `${time} ${day}`;
}

const MAX_SENTENCES = 3;
const RELATED_RATIO = 0.6; // a lower-ranked fact is only added when it scores close to the best one

/**
 * Spoken-friendly answer: at most three short sentences from the best facts, plus
 * when we last confirmed it if any used fact is time-sensitive. Facts are ordered best first.
 */
export function buildMessage(facts: Fact[], noMatchMessage = NO_MATCH_MESSAGE): string {
  if (facts.length === 0) return noMatchMessage;
  const best = facts[0].score;
  const used: Fact[] = [];
  const spoken: string[] = [];
  for (const [i, fact] of facts.entries()) {
    if (spoken.length >= MAX_SENTENCES) break;
    if (i > 0 && fact.score < best * RELATED_RATIO) continue;
    // The best fact may use the whole budget; related ones add just their first sentence.
    const take = i === 0 ? MAX_SENTENCES : 1;
    spoken.push(...sentences(fact.text).slice(0, Math.min(take, MAX_SENTENCES - spoken.length)));
    used.push(fact);
  }
  const stamps = used.filter((f) => isTimeSensitive(f.id) && f.asOf).map((f) => formatAsOf(f.asOf!));
  const asOf = stamps.find((s): s is string => s !== null);
  return asOf ? `${spoken.join(" ")} (Information as of ${asOf}.)` : spoken.join(" ");
}

/** Body of POST /search on scripts/moss-server.ts: `{ query }`, trimmed. Null when invalid. */
export function parseSearchRequest(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const query = (body as Record<string, unknown>).query;
  if (typeof query !== "string") return null;
  const trimmed = query.trim();
  return trimmed === "" || trimmed.length > 500 ? null : trimmed;
}

/** `Authorization: Bearer <token>` check; with no token configured every request passes. */
export const isBearerAuthorized = (header: string | null | undefined, token: string | undefined) =>
  !token || header === `Bearer ${token}`;
