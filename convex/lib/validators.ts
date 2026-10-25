// Shared enums for the schema, function args, and the agent tool contract.
import { v, type Infer } from "convex/values";

export const level = v.union(v.literal("main"), v.literal("mezz"));
export type Level = Infer<typeof level>;

export const point = v.object({ x: v.number(), z: v.number() });
export type Point = Infer<typeof point>;

export const staffRole = v.union(
  v.literal("network"), // wired / wifi
  v.literal("facilities"), // power / tables / lights
  v.literal("supplies"), // water / food / cups
  v.literal("guest_services"), // lost & found, bags
  v.literal("ops_lead"), // escalations
);
export type StaffRole = Infer<typeof staffRole>;

export const staffStatus = v.union(
  v.literal("available"),
  v.literal("busy"),
  v.literal("off_duty"),
);
export type StaffStatus = Infer<typeof staffStatus>;

export const incidentCategory = v.union(
  v.literal("power"),
  v.literal("network"),
  v.literal("lighting"),
  v.literal("furniture"),
  v.literal("supplies"),
  v.literal("cleaning"),
  v.literal("lost_found"),
  v.literal("blockage"),
  v.literal("medical"),
  v.literal("safety"),
  v.literal("other"),
);
export type IncidentCategory = Infer<typeof incidentCategory>;

export const priority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);
export type Priority = Infer<typeof priority>;

export const incidentStatus = v.union(
  v.literal("open"), // created, no assignee yet
  v.literal("assigned"), // offered to a staff member
  v.literal("acknowledged"), // staff accepted
  v.literal("resolved"),
  v.literal("escalated"), // emergency or no eligible staff: human operator owns it
  v.literal("pending_review"), // blockage report awaiting operator confirmation
  v.literal("cancelled"),
);
export type IncidentStatus = Infer<typeof incidentStatus>;

export const incidentSource = v.union(
  v.literal("voice"),
  v.literal("sms"),
  v.literal("web"),
  v.literal("manual"),
);
export type IncidentSource = Infer<typeof incidentSource>;

export const assignmentStatus = v.union(
  v.literal("offered"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("completed"),
  v.literal("superseded"), // replaced by a reassignment (e.g. after a blockage)
  v.literal("cancelled"),
);
export type AssignmentStatus = Infer<typeof assignmentStatus>;

export const locationKind = v.union(
  v.literal("table"),
  v.literal("booth"),
  v.literal("amenity"),
  v.literal("room"),
  v.literal("area"),
  v.literal("entrance"),
  v.literal("zone"),
);
export type LocationKind = Infer<typeof locationKind>;

export const edgeKind = v.union(v.literal("walk"), v.literal("stairs"));
export type EdgeKind = Infer<typeof edgeKind>;

/** Which staff role handles which incident category. Emergencies go to a human. */
export const CATEGORY_ROLE: Record<IncidentCategory, StaffRole> = {
  power: "facilities",
  network: "network",
  lighting: "facilities",
  furniture: "facilities",
  supplies: "supplies",
  cleaning: "facilities",
  lost_found: "guest_services",
  blockage: "ops_lead",
  medical: "ops_lead",
  safety: "ops_lead",
  other: "ops_lead",
};

/** venueMeta row: a loaded Venue Pack's metadata (lib/venuePack.ts VenueMeta). Absent = built-in Cal Hacks venue. */
export const venueMetaFields = {
  eventName: v.string(),
  venueName: v.string(),
  city: v.optional(v.string()),
  timezone: v.string(),
  helpDeskKey: v.optional(v.string()),
  keyterms: v.array(v.string()),
  floors: v.array(v.object({ level, id: v.string(), name: v.string(), elevation: v.number() })),
  outline: v.array(point),
  zoneShapes: v.array(
    v.object({ key: v.string(), level, polygon: v.array(point), height: v.number(), kind: v.string() }),
  ),
  knowledge: v.array(
    v.object({ id: v.string(), title: v.string(), text: v.string(), asOf: v.optional(v.string()), source: v.optional(v.string()) }),
  ),
  escalation: v.array(v.object({ role: v.optional(staffRole), name: v.optional(v.string()), phone: v.optional(v.string()) })),
  operatorPasscode: v.optional(v.string()),
  detailedGeometry: v.optional(v.string()),
};
