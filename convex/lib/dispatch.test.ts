import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { buildGraph, type Route } from "./graph";
import { countRerouted, planReroute, rankCandidates } from "./dispatch";
import { blockZone, incidentAt, seededEdges, seededStaff, staffId, zoneId } from "./demoVenue.fixture";

const openGraph = () => buildGraph(seededEdges());
const blockedGraph = () => buildGraph(seededEdges(blockZone("broadway-1")));
const noDeclines = new Set<Id<"staff">>();

function rank(incident: Doc<"incidents">, opts: { staff?: Doc<"staff">[]; workloads?: Map<Id<"staff">, number>; declinedBy?: Set<Id<"staff">>; blocked?: boolean } = {}) {
  return rankCandidates({
    incident,
    staff: opts.staff ?? seededStaff(),
    workloads: opts.workloads ?? new Map(),
    declinedBy: opts.declinedBy ?? noDeclines,
    graph: opts.blocked ? blockedGraph() : openGraph(),
  });
}

function assignmentFor(incident: Doc<"incidents">, staff: Id<"staff">, route: Route, status: "offered" | "accepted" = "accepted"): Doc<"assignments"> {
  return {
    _id: `assignment:${incident._id}` as Id<"assignments">,
    _creationTime: 0,
    incidentId: incident._id,
    staffId: staff,
    status,
    route,
  };
}

describe("demo scenario: Table 142 outlet, then Broadway #1 blocked", () => {
  const table142 = incidentAt("table:142", { category: "power" });

  test("Table 142 maps to Atrium West", () => {
    expect(table142.zoneId).toBe(zoneId("atrium-west"));
  });

  test("Priya (facilities, Broadway #2) is assigned at 83.5 m via Broadway #1", () => {
    const [best] = rank(table142);
    expect(best.staff.name).toBe("Priya Patel");
    expect(best.route.distance).toBe(83.5);
    expect(best.route.zoneIds).toEqual(["broadway-2", "broadway-1", "atrium-east", "atrium-west"].map(zoneId));
  });

  test("blocking Broadway #1 reassigns to Jordan at 88.3 m on a different route", () => {
    const [before] = rank(table142);
    const assignment = assignmentFor(table142, before.staff._id, before.route);

    const [decision] = planReroute({
      open: [{ assignment, incident: table142 }],
      staff: seededStaff(),
      workloads: new Map([[before.staff._id, 1]]),
      declinedBy: new Map(),
      graph: blockedGraph(),
    });

    expect(decision.kind).toBe("reassign");
    if (decision.kind !== "reassign") return;
    expect(decision.from).toBe(staffId("priya"));
    expect(decision.to.staff.name).toBe("Jordan Kim");
    expect(decision.to.route.distance).toBe(88.3);
    expect(decision.to.route.zoneIds).toEqual(["mezz-north", "atrium-east", "atrium-west"].map(zoneId));
    expect(decision.to.route.zoneIds).not.toContain(zoneId("broadway-1"));
    expect(decision.to.route.edgeIds).not.toEqual(before.route.edgeIds);
  });

  test("off-duty Sam is never a candidate despite the facilities role", () => {
    for (const blocked of [false, true]) {
      const names = rank(table142, { blocked }).map((c) => c.staff.name);
      expect(names).toEqual(blocked ? ["Jordan Kim", "Priya Patel"] : ["Priya Patel", "Jordan Kim"]);
      expect(names).not.toContain("Sam Okafor");
    }
  });
});

describe("rankCandidates", () => {
  const table142 = incidentAt("table:142", { category: "power" });

  test("only staff whose role matches the category", () => {
    const wifi = incidentAt("table:142", { category: "network" });
    expect(rank(wifi).map((c) => c.staff.role)).toEqual(["network", "network"]);
    expect(rank(wifi)[0].staff.name).toBe("Maya Chen"); // Atrium East is next door
  });

  test("busy staff are filtered out", () => {
    const staff = seededStaff().map((s) => (s._id === staffId("priya") ? { ...s, status: "busy" as const } : s));
    expect(rank(table142, { staff }).map((c) => c.staff.name)).toEqual(["Jordan Kim"]);
  });

  test("workload outranks distance", () => {
    const ranked = rank(table142, { workloads: new Map([[staffId("priya"), 1]]) });
    expect(ranked.map((c) => [c.staff.name, c.workload])).toEqual([["Jordan Kim", 0], ["Priya Patel", 1]]);
  });

  test("staff who already declined this incident are skipped", () => {
    expect(rank(table142, { declinedBy: new Set([staffId("priya")]) }).map((c) => c.staff.name)).toEqual(["Jordan Kim"]);
  });

  test("unreachable staff are skipped", () => {
    const staff = seededStaff();
    const jordanCutOff = buildGraph(seededEdges(blockZone("mezz-north")));
    expect(rankCandidates({ incident: table142, staff, workloads: new Map(), declinedBy: noDeclines, graph: jordanCutOff }).map((c) => c.staff.name)).toEqual(["Priya Patel"]);
    const incidentCutOff = buildGraph(seededEdges(blockZone("atrium-west")));
    expect(rankCandidates({ incident: table142, staff, workloads: new Map(), declinedBy: noDeclines, graph: incidentCutOff })).toEqual([]);
  });

  test("route runs from the staff member to the incident", () => {
    const [best] = rank(table142);
    expect(best.route.zoneIds[0]).toBe(best.staff.zoneId);
    expect(best.route.zoneIds.at(-1)).toBe(table142.zoneId);
  });
});

describe("planReroute", () => {
  const table142 = incidentAt("table:142", { category: "power" });
  const priyaRoute = () => rank(table142)[0].route;

  test("unchanged graph keeps the current assignee and route", () => {
    const [decision] = planReroute({
      open: [{ assignment: assignmentFor(table142, staffId("priya"), priyaRoute()), incident: table142 }],
      staff: seededStaff(),
      workloads: new Map([[staffId("priya"), 1]]),
      declinedBy: new Map(),
      graph: openGraph(),
    });
    expect(decision).toMatchObject({ kind: "keep", routeChanged: false });
  });

  test("keeps the assignee but reports a new route when they are still the best", () => {
    // Jordan already has two tasks, so Priya stays even though her walk got longer.
    const [decision] = planReroute({
      open: [{ assignment: assignmentFor(table142, staffId("priya"), priyaRoute()), incident: table142 }],
      staff: seededStaff(),
      workloads: new Map([[staffId("priya"), 1], [staffId("jordan"), 2]]),
      declinedBy: new Map(),
      graph: blockedGraph(),
    });
    expect(decision.kind).toBe("keep");
    if (decision.kind !== "keep") return;
    expect(decision.routeChanged).toBe(true);
    expect(decision.route.distance).toBe(96.9);
    expect(decision.route.zoneIds).not.toContain(zoneId("broadway-1"));
  });

  test("a busy current assignee still competes for their own task", () => {
    const staff = seededStaff().map((s) => (s._id === staffId("priya") ? { ...s, status: "busy" as const } : s));
    const [decision] = planReroute({
      open: [{ assignment: assignmentFor(table142, staffId("priya"), priyaRoute()), incident: table142 }],
      staff,
      workloads: new Map([[staffId("priya"), 1]]),
      declinedBy: new Map(),
      graph: openGraph(),
    });
    expect(decision.kind).toBe("keep");
  });

  test("an assignee who went off duty is replaced", () => {
    const staff = seededStaff().map((s) => (s._id === staffId("priya") ? { ...s, status: "off_duty" as const } : s));
    const [decision] = planReroute({
      open: [{ assignment: assignmentFor(table142, staffId("priya"), priyaRoute()), incident: table142 }],
      staff,
      workloads: new Map([[staffId("priya"), 1]]),
      declinedBy: new Map(),
      graph: openGraph(),
    });
    expect(decision).toMatchObject({ kind: "reassign", to: { staff: { _id: staffId("jordan") } } });
  });

  test("unreachable when no eligible staff can get there", () => {
    const [decision] = planReroute({
      open: [{ assignment: assignmentFor(table142, staffId("priya"), priyaRoute()), incident: table142 }],
      staff: seededStaff(),
      workloads: new Map([[staffId("priya"), 1]]),
      declinedBy: new Map(),
      graph: buildGraph(seededEdges(blockZone("atrium-west"))),
    });
    expect(decision.kind).toBe("unreachable");
  });

  test("reassignments in one pass count toward the new assignee's workload", () => {
    // Two outlets near Atrium West, both on Priya. After the blockage the first moves to
    // Jordan; the second must then see Jordan at workload 1 and stay with Priya.
    const a = incidentAt("table:142", { category: "power", id: "incident:a" });
    const b = incidentAt("table:142", { category: "lighting", id: "incident:b" });
    const decisions = planReroute({
      open: [
        { assignment: { ...assignmentFor(a, staffId("priya"), priyaRoute()), _id: "assignment:a" as Id<"assignments"> }, incident: a },
        { assignment: { ...assignmentFor(b, staffId("priya"), priyaRoute()), _id: "assignment:b" as Id<"assignments"> }, incident: b },
      ],
      staff: seededStaff(),
      workloads: new Map([[staffId("priya"), 2]]),
      declinedBy: new Map(),
      graph: blockedGraph(),
    });
    expect(decisions.map((d) => d.kind)).toEqual(["reassign", "keep"]);
  });
});

describe("countRerouted (blockage applied automatically)", () => {
  const table142 = incidentAt("table:142", { category: "power" });
  const priyaRoute = () => rank(table142)[0].route;
  const open = () => [{ assignment: assignmentFor(table142, staffId("priya"), priyaRoute()), incident: table142 }];
  const plan = (graph: ReturnType<typeof openGraph>, workloads = new Map([[staffId("priya"), 1]])) =>
    planReroute({ open: open(), staff: seededStaff(), workloads, declinedBy: new Map(), graph });

  test("blocking Broadway #1 reassigns Priya's task: 1 rerouted, 1 reassigned", () => {
    expect(countRerouted(plan(blockedGraph()))).toEqual({ rerouted: 1, reassigned: 1 });
  });

  test("a new route for the same assignee counts as rerouted, not reassigned", () => {
    const busyJordan = new Map([[staffId("priya"), 1], [staffId("jordan"), 2]]);
    expect(countRerouted(plan(blockedGraph(), busyJordan))).toEqual({ rerouted: 1, reassigned: 0 });
  });

  test("an unreachable task counts as rerouted (it was escalated)", () => {
    expect(countRerouted(plan(buildGraph(seededEdges(blockZone("atrium-west")))))).toEqual({ rerouted: 1, reassigned: 0 });
  });

  test("an unchanged graph reroutes nothing", () => {
    expect(countRerouted(plan(openGraph()))).toEqual({ rerouted: 0, reassigned: 0 });
  });

  test("undo: reopening the edges restores the original route", () => {
    const [decision] = plan(openGraph());
    expect(decision).toMatchObject({ kind: "keep", routeChanged: false });
  });
});
