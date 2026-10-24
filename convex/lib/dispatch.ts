// Pure dispatch logic: role match -> availability -> current workload -> path distance.
// convex/dispatch.ts wraps these with database reads/writes.
import type { Doc, Id } from "../_generated/dataModel";
import { reverseRoute, routesFrom, type Graph, type Route } from "./graph";
import { CATEGORY_ROLE } from "./validators";

export type Candidate = {
  staff: Doc<"staff">;
  route: Route; // staff zone -> incident zone
  workload: number; // open (offered + accepted) assignments
};

/** Best first: fewer open assignments, then shorter walk. Ties go to the earlier-seeded staff. */
export function compareCandidates(a: Candidate, b: Candidate): number {
  return a.workload - b.workload || a.route.distance - b.route.distance || a.staff._creationTime - b.staff._creationTime;
}

/**
 * Eligible staff for an incident, best first. Filters: role matches CATEGORY_ROLE,
 * status "available", reachable in the (blockage-aware) graph, not already declined.
 * Sort: workload asc, then route distance asc.
 */
export function rankCandidates(args: {
  incident: Doc<"incidents">;
  staff: Doc<"staff">[];
  workloads: Map<Id<"staff">, number>;
  declinedBy: Set<Id<"staff">>;
  graph: Graph;
}): Candidate[] {
  const { incident, staff, workloads, declinedBy, graph } = args;
  const role = CATEGORY_ROLE[incident.category];
  // Undirected graph: one Dijkstra from the incident covers every staff member.
  const routes = routesFrom(graph, incident.zoneId);
  const out: Candidate[] = [];
  for (const s of staff) {
    if (s.role !== role || s.status !== "available" || declinedBy.has(s._id)) continue;
    const route = routes.get(s.zoneId);
    if (!route) continue;
    out.push({ staff: s, route: reverseRoute(route), workload: workloads.get(s._id) ?? 0 });
  }
  return out.sort(compareCandidates);
}

export type OpenAssignment = {
  assignment: Doc<"assignments">; // status "offered" or "accepted"
  incident: Doc<"incidents">;
};

export type RerouteDecision =
  /** Same assignee; `route` is recomputed on the new graph (may differ from the stored one). */
  | { kind: "keep"; assignmentId: Id<"assignments">; incidentId: Id<"incidents">; route: Route; routeChanged: boolean }
  /** Supersede the old assignment and offer the incident to `to`. */
  | { kind: "reassign"; assignmentId: Id<"assignments">; incidentId: Id<"incidents">; from: Id<"staff">; to: Candidate }
  /** Nobody eligible can reach the incident any more: escalate to a human. */
  | { kind: "unreachable"; assignmentId: Id<"assignments">; incidentId: Id<"incidents"> };

const sameRoute = (a: Route, b: Route) =>
  a.edgeIds.length === b.edgeIds.length && a.edgeIds.every((id, i) => id === b.edgeIds[i]);

/**
 * After the graph changes (blockage confirmed/cleared): re-rank every open assignment
 * on the new graph and reassign when another eligible staff member is now strictly better.
 *
 * The current assignee competes with their workload minus this task, so an unchanged
 * graph never reassigns. They stay eligible while busy (they are working on it) but not
 * once off duty. Workloads are updated as decisions are made, so two incidents in one
 * pass do not both land on the same newly-free person without it being counted.
 */
export function planReroute(args: {
  open: OpenAssignment[];
  staff: Doc<"staff">[];
  workloads: Map<Id<"staff">, number>;
  declinedBy: Map<Id<"incidents">, Set<Id<"staff">>>;
  graph: Graph;
}): RerouteDecision[] {
  const { open, staff, declinedBy, graph } = args;
  const workloads = new Map(args.workloads);
  const decisions: RerouteDecision[] = [];

  for (const { assignment, incident } of open) {
    const currentId = assignment.staffId;
    const ownLoad = Math.max(0, (workloads.get(currentId) ?? 0) - 1);
    const pool = staff.map((s) =>
      s._id === currentId && s.status === "busy" ? { ...s, status: "available" as const } : s,
    );
    const ranked = rankCandidates({
      incident,
      staff: pool,
      workloads: new Map(workloads).set(currentId, ownLoad),
      declinedBy: declinedBy.get(incident._id) ?? new Set(),
      graph,
    });
    const best = ranked[0];
    const base = { assignmentId: assignment._id, incidentId: incident._id };

    if (!best) {
      workloads.set(currentId, ownLoad);
      decisions.push({ kind: "unreachable", ...base });
    } else if (best.staff._id === currentId) {
      decisions.push({ kind: "keep", ...base, route: best.route, routeChanged: !sameRoute(best.route, assignment.route) });
    } else {
      workloads.set(currentId, ownLoad);
      workloads.set(best.staff._id, best.workload + 1);
      decisions.push({ kind: "reassign", ...base, from: currentId, to: best });
    }
  }
  return decisions;
}
