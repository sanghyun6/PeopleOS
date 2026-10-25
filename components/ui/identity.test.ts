import { describe, expect, it } from "vitest";
import { isIdentityValid } from "./identity";

describe("isIdentityValid", () => {
  const ids = ["s1", "s2"];

  it("accepts a staff id that is in the list", () => {
    expect(isIdentityValid({ kind: "staff", id: "s2" }, ids)).toBe(true);
  });

  it("rejects a staff id from before a reseed", () => {
    expect(isIdentityValid({ kind: "staff", id: "old" }, ids)).toBe(false);
    expect(isIdentityValid({ kind: "staff", id: "s1" }, [])).toBe(false);
  });

  it("never expires the operator identity", () => {
    expect(isIdentityValid({ kind: "ops" }, [])).toBe(true);
  });
});
