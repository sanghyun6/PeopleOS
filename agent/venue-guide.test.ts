import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { buildSystemPrompt } from "./prompt";
import { buildVenueGuide } from "./venue-guide";
import { buildVocabulary } from "./vocabulary";

const vocab = buildVocabulary();
const eventFacts = readFileSync(join(__dirname, "event-facts.md"), "utf8");
const guide = buildVenueGuide(eventFacts);
const committed = readFileSync(join(__dirname, "venue-guide.md"), "utf8");

const labels = new Set([...vocab.booths, ...vocab.areas]);
const isTable = (s: string) => {
  const n = Number(/^Table (\d+)$/.exec(s)?.[1]);
  return n >= vocab.tableRange.min && n <= vocab.tableRange.max;
};

describe("venue guide", () => {
  test("every place in the generated 'where things are' lines is in the location vocabulary", () => {
    const lines = guide.split("\n").filter((l) => l.includes(" | ") && l.includes("next to "));
    expect(lines.length).toBeGreaterThan(10);
    const unknown: string[] = [];
    for (const line of lines) {
      const [area, ...rest] = line.split(" | ");
      const mentioned = [area.replace(/ \((main floor|mezzanine)\)$/, "")];
      for (const part of rest) {
        if (part.startsWith("has ")) mentioned.push(...part.slice(4).split("; "));
        if (part.startsWith("next to ")) mentioned.push(...part.slice(8).split("; ").map((s) => s.replace(/ \(by stairs\)$/, "")));
        if (part.startsWith("Tables ")) {
          for (const range of part.slice(7).split(", ")) {
            const [a, b = a] = range.split("-").map(Number);
            for (const n of [a, b]) if (!isTable(`Table ${n}`)) unknown.push(`Table ${n}`);
          }
        }
      }
      unknown.push(...mentioned.filter((m) => !labels.has(m)));
    }
    expect(unknown).toEqual([]);
  });

  test("booths and tables named anywhere in the text (event facts too) exist", () => {
    // Every "booth" must end a vocabulary label ("... the Annapurna booth" -> "Annapurna booth").
    const unknownBooths = [...guide.matchAll(/\bbooth\b(?: \([^)]*\))?/g)]
      .map((m) => guide.slice(Math.max(0, m.index! - 40), m.index! + m[0].length))
      .filter((context) => !vocab.booths.some((b) => context.endsWith(b)));
    expect(unknownBooths).toEqual([]);
    const tables = [...guide.matchAll(/\bTable (\d+)\b/g)].map((m) => `Table ${m[1]}`);
    expect(tables.filter((t) => !isTable(t))).toEqual([]);
  });

  test("covers every booth, and stays short enough for a prompt", () => {
    for (const booth of vocab.booths) expect(guide).toContain(booth);
    expect(guide.split(/\s+/).length).toBeLessThan(1500);
  });

  test("starts the event facts with the Sleeping Area", () => {
    expect(eventFacts.trim()).toMatch(/^Sleeping Area: open overnight in the area where the food was/);
    expect(eventFacts).toContain("Annapurna booth");
  });

  test("system prompt carries the guide, and the committed files are up to date", () => {
    const prompt = buildSystemPrompt(vocab, guide);
    expect(prompt).toContain("# Venue guide");
    expect(prompt).toContain(guide.trim());
    expect(committed).toBe(guide);
    expect(readFileSync(join(__dirname, "system-prompt.md"), "utf8")).toBe(prompt);
  });
});
