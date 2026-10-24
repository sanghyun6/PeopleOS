import { describe, expect, test } from "vitest";
import { detectEmergency } from "./emergency";

describe("detectEmergency", () => {
  test("medical and safety categories always escalate", () => {
    expect(detectEmergency({ category: "medical", description: "someone needs help" })).toEqual({ isEmergency: true, matched: ["category:medical"] });
    expect(detectEmergency({ category: "safety", description: "please send someone" }).isEmergency).toBe(true);
  });

  test.each([
    ["someone fainted near table 142", "fainted"],
    ["a guy is bleeding by the fountain", "bleeding"],
    ["there's smoke coming from the outlet", "smoke"],
    ["I think there's a FIRE in the hallway", "fire"],
    ["she can’t breathe", "can't breathe"],
    ["call 911", "911"],
    ["two people are in a fight at gate 6", "fight"],
  ])("keyword in description: %s", (description, keyword) => {
    const check = detectEmergency({ category: "power", description });
    expect(check.isEmergency).toBe(true);
    expect(check.matched).toContain(keyword);
  });

  test("keywords in the transcript count too", () => {
    const check = detectEmergency({ category: "other", description: "issue at table 12", transcript: "Caller: my friend collapsed" });
    expect(check).toEqual({ isEmergency: true, matched: ["collapsed"] });
  });

  test.each([
    "table 142's outlet isn't working",
    "the firewall is blocking my ssh",
    "wifi keeps dropping on the mezzanine",
    "are there cups at the water station",
    "hallway near gate 3/4 is blocked by boxes",
  ])("ordinary report does not escalate: %s", (description) => {
    expect(detectEmergency({ category: "other", description })).toEqual({ isEmergency: false, matched: [] });
  });
});
