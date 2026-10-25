import { describe, expect, it } from "vitest";
import { normalizeLocationText } from "./locationText";

describe("normalizeLocationText", () => {
  it("collapses every spelling of the gate 3/4 pair", () => {
    for (const heard of ["Gate 3/4", "Gate #3/#4", "gate 3 and 4", "Gates 3 & 4", "gate 3-4", "gate 3, 4"]) {
      expect(normalizeLocationText(heard)).toBe("gate 3");
    }
    expect(normalizeLocationText("Hallway near Gate 3/4")).toBe("hallway gate 3");
  });

  it("leaves single gates and other places alone", () => {
    expect(normalizeLocationText("Gate #3")).toBe("gate #3");
    expect(normalizeLocationText("Gate 4")).toBe("gate 4");
    expect(normalizeLocationText("gateway 2")).toBe("gateway 2");
  });

  it("strips filler words and punctuation", () => {
    expect(normalizeLocationText("near the Cartesia booth!")).toBe("cartesia booth");
  });
});
