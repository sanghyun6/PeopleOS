import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  assignmentStatus,
  edgeKind,
  incidentCategory,
  incidentSource,
  incidentStatus,
  level,
  locationKind,
  point,
  priority,
  staffRole,
  staffStatus,
} from "./lib/validators";

export default defineSchema({
  // ~20 walkable areas derived from data/palace-venue.json (see lib/zoning.ts).
  zones: defineTable({
    key: v.string(), // stable slug, e.g. "atrium-east"
    name: v.string(),
    level,
    center: point, // graph node position (meters, x/z ground plane)
    aliases: v.array(v.string()),
  }).index("by_key", ["key"]),

  // Undirected walking connections between zones. Dispatch runs Dijkstra over these.
  edges: defineTable({
    from: v.id("zones"),
    to: v.id("zones"),
    kind: edgeKind,
    distance: v.number(), // meters, includes stair penalty
    path: v.array(point), // polyline from -> to for drawing routes
    blocked: v.boolean(),
    blockedByIncidentId: v.optional(v.id("incidents")),
  })
    .index("by_from", ["from"])
    .index("by_to", ["to"]),

  // Fixed location vocabulary the voice agent must resolve to:
  // every hacker table, sponsor booth, amenity, named room/area, entrance, and zone.
  locations: defineTable({
    key: v.string(), // e.g. "table:142", "booth:11", "amenity:fountain"
    label: v.string(), // e.g. "Table 142"
    kind: locationKind,
    level,
    at: point,
    zoneId: v.id("zones"),
    aliases: v.array(v.string()),
    searchText: v.string(), // label + aliases, lowercased
  })
    .index("by_key", ["key"])
    .index("by_zone", ["zoneId"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["kind"] }),

  staff: defineTable({
    name: v.string(),
    role: staffRole,
    status: staffStatus,
    zoneId: v.id("zones"), // current position (zone granularity)
    phone: v.optional(v.string()),
  })
    .index("by_role", ["role"])
    .index("by_status", ["status"]),

  incidents: defineTable({
    category: incidentCategory,
    description: v.string(),
    priority,
    status: incidentStatus,
    source: incidentSource,
    locationId: v.id("locations"),
    zoneId: v.id("zones"),
    level,
    at: point, // marker position (copied from location)
    reportCount: v.number(), // dedup: incremented instead of creating a new incident
    transcript: v.optional(v.string()),
    callId: v.optional(v.string()),
    assigneeId: v.optional(v.id("staff")),
    escalationReason: v.optional(v.string()),
    acknowledgedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    lastReportedAt: v.number(),
    reroutedCount: v.optional(v.number()), // blockages: tasks rerouted when it was applied
  })
    .index("by_status", ["status"])
    .index("by_zone_category", ["zoneId", "category"])
    .index("by_assignee", ["assigneeId"]),

  assignments: defineTable({
    incidentId: v.id("incidents"),
    staffId: v.id("staff"),
    status: assignmentStatus,
    route: v.object({
      zoneIds: v.array(v.id("zones")),
      edgeIds: v.array(v.id("edges")),
      distance: v.number(),
    }),
    score: v.optional(v.number()),
    reason: v.optional(v.string()), // e.g. "auto-dispatch", "rerouted: blockage at broadway-1"
    respondedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_incident", ["incidentId"])
    .index("by_status", ["status"])
    .index("by_staff_status", ["staffId", "status"]),

  // One row per venue_search call: how long retrieval took and which path answered.
  retrievals: defineTable({
    outcome: v.union(v.literal("found"), v.literal("no_match"), v.literal("fallback")),
    latencyMs: v.number(),
    cold: v.optional(v.boolean()), // Moss only: this call had to load the index first
    callId: v.optional(v.string()),
  }),
});
