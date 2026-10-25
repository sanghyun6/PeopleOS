import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  NO_MATCH_MESSAGE,
  areaDocuments,
  buildMessage,
  buildMossDocuments,
  formatAsOf,
  isBearerAuthorized,
  parseSearchRequest,
  keywordSearch,
  relevantFacts,
  toFact,
  type Fact,
  type KbEntry,
} from "./venue-search";

const kb = JSON.parse(readFileSync(join(__dirname, "event-kb.json"), "utf8")) as KbEntry[];
const guide = readFileSync(join(__dirname, "venue-guide.md"), "utf8");

const fact = (over: Partial<Fact> & { id: string }): Fact => ({
  title: over.id,
  text: "First sentence. Second sentence. Third sentence. Fourth sentence.",
  score: 1,
  ...over,
});

describe("keywordSearch", () => {
  test.each([
    ["where can I take a shower", "showers"],
    ["is there a place to sleep", "sleeping-area"],
    ["what are the wifi rules", "wifi-policy"],
    ["when is the next workshop", "workshops-sat"],
    ["how do I borrow hardware", "hardware-checkout"],
  ])("%s -> %s", (query, id) => {
    expect(keywordSearch(kb, query)[0]?.id).toBe(id);
  });

  test("returns at most topK, best first, with positive scores", () => {
    const hits = keywordSearch(kb, "wifi", 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
    expect(hits.every((h) => h.score > 0)).toBe(true);
  });

  test("nothing relevant, or only stopwords, gives no facts", () => {
    expect(keywordSearch(kb, "quantum chromodynamics")).toEqual([]);
    expect(keywordSearch(kb, "what is the")).toEqual([]);
    expect(keywordSearch(kb, "")).toEqual([]);
  });
});

describe("buildMessage", () => {
  test("no facts -> point to the Info Desk", () => {
    expect(buildMessage([])).toBe(NO_MATCH_MESSAGE);
    expect(NO_MATCH_MESSAGE).toMatch(/Info Desk/);
  });

  test("caps at three sentences", () => {
    const msg = buildMessage([fact({ id: "badge" })]);
    expect(msg).toBe("First sentence. Second sentence. Third sentence.");
  });

  test("adds a related fact's first sentence only when it scores close to the best", () => {
    const close = buildMessage([
      fact({ id: "badge", text: "Best one. Detail.", score: 0.8 }),
      fact({ id: "luggage", text: "Related one. More.", score: 0.7 }),
    ]);
    expect(close).toBe("Best one. Detail. Related one.");
    const far = buildMessage([
      fact({ id: "badge", text: "Best one. Detail.", score: 0.8 }),
      fact({ id: "luggage", text: "Related one. More.", score: 0.2 }),
    ]);
    expect(far).toBe("Best one. Detail.");
  });

  test("time-sensitive facts carry the asOf time in venue time", () => {
    const msg = buildMessage([fact({ id: "meals", text: "Lunch is at noon.", asOf: "2026-10-24T19:08-07:00" })]);
    expect(msg).toBe("Lunch is at noon. (Information as of 7:08 PM Saturday.)");
  });

  test("static facts do not get an asOf", () => {
    const msg = buildMessage([fact({ id: "badge", text: "Wear your badge.", asOf: "2026-10-24T19:08-07:00" })]);
    expect(msg).toBe("Wear your badge.");
  });
});

describe("formatAsOf", () => {
  test("converts to Pacific time and rejects garbage", () => {
    expect(formatAsOf("2026-10-25T02:08:00Z")).toBe("7:08 PM Saturday");
    expect(formatAsOf("not a date")).toBeNull();
  });
});

describe("Moss documents", () => {
  const docs = buildMossDocuments(kb, guide);

  test("one document per KB entry and per venue area, with unique ids", () => {
    expect(docs).toHaveLength(kb.length + areaDocuments(guide).length);
    expect(areaDocuments(guide).length).toBeGreaterThanOrEqual(15);
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
  });

  test("metadata is all strings and carries title and body", () => {
    for (const d of docs) {
      expect(d.metadata.title).toBeTruthy();
      expect(d.metadata.body).toBeTruthy();
      expect(Object.values(d.metadata).every((x) => typeof x === "string")).toBe(true);
    }
  });

  test("area documents read as sentences with the level", () => {
    const area = areaDocuments(guide).find((a) => a.title === "Pavilion North");
    expect(area?.id).toBe("area-pavilion-north");
    expect(area?.text).toMatch(/^Pavilion North is on the main floor\. /);
  });
});

describe("Moss results", () => {
  test("toFact reads title/body/asOf from metadata", () => {
    expect(toFact({ id: "x", text: "T. B.", score: 0.5, metadata: { title: "T", body: "B.", asOf: "2026-10-24T19:08-07:00" } })).toEqual({
      id: "x",
      title: "T",
      text: "B.",
      asOf: "2026-10-24T19:08-07:00",
      score: 0.5,
    });
  });

  test("relevantFacts drops zero-similarity hits and orders best first", () => {
    const facts = relevantFacts([
      fact({ id: "a", score: 0.1 }),
      fact({ id: "b", score: 0.3 }),
      fact({ id: "c", score: 0.7 }),
      fact({ id: "d", score: 0 }),
    ]);
    expect(facts.map((f) => f.id)).toEqual(["c", "b"]);
  });
});

describe("search server request handling", () => {
  test("parseSearchRequest accepts a trimmed query string only", () => {
    expect(parseSearchRequest({ query: "  when is dinner " })).toBe("when is dinner");
    for (const bad of [null, "x", [], {}, { query: 3 }, { query: "   " }, { query: "x".repeat(501) }]) {
      expect(parseSearchRequest(bad)).toBeNull();
    }
  });

  test("isBearerAuthorized needs the exact token, and allows all when none is set", () => {
    expect(isBearerAuthorized("Bearer s3", "s3")).toBe(true);
    expect(isBearerAuthorized("Bearer nope", "s3")).toBe(false);
    expect(isBearerAuthorized(undefined, "s3")).toBe(false);
    expect(isBearerAuthorized(undefined, undefined)).toBe(true);
  });
});
