// Auto dispatch: role match -> availability -> current workload -> path distance.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { Graph, Route } from "./lib/graph";
import { todo } from "./lib/todo";

export type Candidate = {
  staff: Doc<"staff">;
  route: Route; // staff zone -> incident zone
  workload: number; // open (offered + accepted) assignments
};

/**
 * Eligible staff for an incident, best first. Filters: role matches CATEGORY_ROLE,
 * status "available", reachable in the (blockage-aware) graph, not already declined.
 * Sort: workload asc, then route distance asc.
 */
export function rankCandidates(_args: {
  incident: Doc<"incidents">;
  staff: Doc<"staff">[];
  workloads: Map<Id<"staff">, number>;
  declinedBy: Set<Id<"staff">>;
  graph: Graph;
}): Candidate[] {
  return todo("rankCandidates");
}

/** Offer the incident to the best candidate. Escalates when nobody is eligible. */
export const dispatchIncident = internalMutation({
  args: { incidentId: v.id("incidents"), reason: v.optional(v.string()) },
  returns: v.union(v.id("assignments"), v.null()),
  handler: async (): Promise<Id<"assignments"> | null> => todo("dispatchIncident"),
});

/**
 * After the graph changes (blockage confirmed/cleared): recompute routes for every
 * open assignment and reassign when another eligible staff member is now closer.
 * Returns how many incidents changed assignee.
 */
export const rerouteOpenAssignments = internalMutation({
  args: { reason: v.string() },
  returns: v.number(),
  handler: async (): Promise<number> => todo("rerouteOpenAssignments"),
});
