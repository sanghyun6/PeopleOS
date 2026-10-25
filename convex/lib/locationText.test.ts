import { describe, expect, it } from "vitest";
import { normalizeLocationText } from "./locationText";

describe("normalizeLocationText", () => {
  it("hears Broadway in common speech-recognition mistakes", () => {
    for (const heard of ["gateway 2", "Gateway 2", "gate way 2", "broad way 2", "the Broadway 2"]) {
      expect(normalizeLocationText(heard)).toBe("broadway 2");
    }
  });

  it("leaves real gates alone", () => {
    expect(normalizeLocationText("Gate #3")).toBe("gate #3");
    expect(normalizeLocationText("Gate 4")).toBe("gate 4");
  });

  it("strips filler words and punctuation", () => {
    expect(normalizeLocationText("near the Cartesia booth!")).toBe("cartesia booth");
  });
});
