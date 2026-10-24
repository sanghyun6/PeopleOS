import { describe, expect, test } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { DEDUP_WINDOW_MS, filterDedupCandidates } from "./dedup";
import { incidentAt, zoneId } from "./demoVenue.fixture";

const NOW = 1_000_000_000;
const MIN = 60 * 1000;

const incident = (id: string, overrides: Partial<Doc<"incidents">> = {}): Doc<"incidents"> => ({
  ...incidentAt("table:142", { id, category: "power", lastReportedAt: NOW - 5 * MIN }),
  ...overrides,
});

const report = { zoneId: zoneId("atrium-west"), category: "power" as const, now: NOW };
const ids = (list: Doc<"incidents">[]) => list.map((i) => i._id);

describe("filterDedupCandidates", () => {
  test("same zone + same category within 15 minutes is a candidate", () => {
    expect(ids(filterDedupCandidates([incident("outlet")], report))).toEqual(["outlet"]);
  });

  test("different category or zone is not", () => {
    const list = [incident("wifi", { category: "network" }), incident("elsewhere", { zoneId: zoneId("broadway-2") })];
    expect(filterDedupCandidates(list, report)).toEqual([]);
  });

  test("window edge: exactly 15 minutes counts, a millisecond more does not", () => {
    const list = [incident("edge", { lastReportedAt: NOW - DEDUP_WINDOW_MS }), incident("stale", { lastReportedAt: NOW - DEDUP_WINDOW_MS - 1 })];
    expect(ids(filterDedupCandidates(list, report))).toEqual(["edge"]);
  });

  test("resolved and cancelled incidents never absorb new reports", () => {
    const list = (["open", "assigned", "acknowledged", "escalated", "pending_review", "resolved", "cancelled"] as const).map((status) =>
      incident(status, { status }),
    );
    expect(ids(filterDedupCandidates(list, report))).toEqual(["open", "assigned", "acknowledged", "escalated", "pending_review"]);
  });

  test("most recently reported first", () => {
    const list = [incident("older", { lastReportedAt: NOW - 10 * MIN }), incident("newer", { lastReportedAt: NOW - MIN })];
    expect(ids(filterDedupCandidates(list, report))).toEqual(["newer", "older"]);
  });
});
