import { describe, expect, it } from "vitest";
import { sharesWord } from "./matching";
import { directionsBetween } from "./directions";
import type { Doc, Id } from "../_generated/dataModel";

describe("sharesWord", () => {
  it("rejects number-only overlap", () => {
    expect(sharesWord("gate 3", "table 3 table number 3")).toBe(false);
  });
  it("accepts shared words and prefixes", () => {
    expect(sharesWord("restroom", "ground floor restrooms restrooms bathroom")).toBe(true);
    expect(sharesWord("acme", "acme robotics booth acme")).toBe(true);
  });
});

describe("directionsBetween stairs wording", () => {
  const z = (k: string) => k as Id<"zones">;
  const edges = [
    { _id: "e1" as Id<"edges">, _creationTime: 0, from: z("lobby"), to: z("foyer"), kind: "stairs", distance: 20, path: [], blocked: false },
  ] as Doc<"edges">[];
  const names = new Map([["lobby", "Main Lobby"], ["foyer", "Upper Foyer"]]);
  it("uses zone levels when given", () => {
    const levels = new Map<string, "main" | "mezz">([["lobby", "main"], ["foyer", "mezz"]]);
    expect(directionsBetween(z("lobby"), z("foyer"), edges, [], names, levels)?.steps[0]).toBe("Take the stairs up to Upper Foyer");
    expect(directionsBetween(z("foyer"), z("lobby"), edges, [], names, levels)?.steps[0]).toBe("Take the stairs down to Main Lobby");
  });
});
