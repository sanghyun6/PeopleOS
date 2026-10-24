// Mock data so screens render before the backend bodies exist. Shapes match convex/schema.ts.
import type { Doc } from "@/convex/_generated/dataModel";
import type { AssignmentView } from "@/components/staff/AssignmentCard";

const id = (s: string) => s as never;
const now = Date.now();
const min = 60_000;

export const mockZones = [
  { _id: id("z1"), key: "atrium-east", name: "Atrium East", level: "main", center: { x: 10, z: 5 }, aliases: [] },
  { _id: id("z2"), key: "broadway-1", name: "Broadway #1", level: "main", center: { x: -10, z: 8 }, aliases: [] },
  { _id: id("z3"), key: "gate-3-4", name: "Gate #3/#4", level: "main", center: { x: 0, z: -20 }, aliases: [] },
  { _id: id("z4"), key: "mezzanine", name: "Mezzanine", level: "mezz", center: { x: 5, z: 12 }, aliases: [] },
] as unknown as Doc<"zones">[];

const [atrium, broadway, gate, mezz] = mockZones.map((z) => z._id);

export const mockStaff = [
  { _id: id("s1"), name: "Dana Ortiz", role: "facilities", status: "busy", zoneId: atrium },
  { _id: id("s2"), name: "Marcus Lee", role: "facilities", status: "available", zoneId: broadway },
  { _id: id("s3"), name: "Priya Nair", role: "network", status: "available", zoneId: mezz },
  { _id: id("s4"), name: "Sam Wu", role: "supplies", status: "available", zoneId: atrium },
  { _id: id("s5"), name: "Jo Alvarez", role: "guest_services", status: "off_duty", zoneId: gate },
  { _id: id("s6"), name: "Riley Chen", role: "ops_lead", status: "available", zoneId: gate },
] as unknown as Doc<"staff">[];

const incident = (n: number, p: Partial<Doc<"incidents">>): Doc<"incidents"> =>
  ({
    _id: id(`i${n}`),
    _creationTime: now - n * 4 * min,
    category: "power",
    description: "",
    priority: "medium",
    status: "open",
    source: "voice",
    locationId: id("l1"),
    zoneId: atrium,
    level: "main",
    at: { x: 10, z: 5 },
    reportCount: 1,
    lastReportedAt: now - n * 4 * min,
    ...p,
  }) as unknown as Doc<"incidents">;

export const mockIncidents: Doc<"incidents">[] = [
  incident(1, {
    description: "Outlet at Table 142 is dead.",
    status: "acknowledged",
    reportCount: 2,
    assigneeId: id("s1"),
    acknowledgedAt: now - 3 * min,
    transcript: "Caller: Table 142's outlet isn't working.\nAgent: Table 142 on the main floor, right?\nCaller: Yes.",
  }),
  incident(2, {
    category: "blockage",
    priority: "high",
    description: "Hallway near Gate 3/4 is blocked by a pallet.",
    status: "acknowledged",
    zoneId: gate,
    at: { x: 0, z: -20 },
    transcript: "Caller: The hallway by Gate 3 and 4 is totally blocked.\nAgent: Logged. Staff are being routed around it now.",
  }),
  incident(3, { category: "supplies", description: "No cups at the water station.", status: "assigned", assigneeId: id("s4"), zoneId: broadway }),
  incident(4, { category: "medical", priority: "critical", description: "Attendee feels faint near the mezzanine stairs.", status: "escalated", zoneId: mezz, level: "mezz", escalationReason: "medical keyword — human operator required" }),
];

export const mockStats = { open: 4, resolved: 7, avgAckMs: 94_000, avgResolveMs: 11 * min };

export const mockAssignments: AssignmentView[] = [
  {
    assignment: { _id: id("a1"), _creationTime: now, incidentId: id("i2"), staffId: id("s1"), status: "offered", route: { zoneIds: [], edgeIds: [], distance: 64 }, reason: "rerouted: blockage at gate-3-4" } as unknown as Doc<"assignments">,
    incident: mockIncidents[1],
    locationLabel: "Gate #3/#4 hallway",
    routeZoneNames: ["Atrium East", "Broadway #1", "Gate #3/#4"],
  },
  {
    assignment: { _id: id("a2"), _creationTime: now - 5 * min, incidentId: id("i1"), staffId: id("s1"), status: "accepted", route: { zoneIds: [], edgeIds: [], distance: 18 }, respondedAt: now - 3 * min } as unknown as Doc<"assignments">,
    incident: mockIncidents[0],
    locationLabel: "Table 142",
    routeZoneNames: ["Atrium East"],
  },
];
