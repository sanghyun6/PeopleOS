// Demo staff for the Cal Hacks seed (fake names). Shared by convex/seed.ts and the
// Venue Pack export (agent/calhacks-pack.ts).
import type { StaffRole, StaffStatus } from "./validators";

// Positions are chosen for the demo script in CLAUDE.md:
// Table 142 -> Priya (Broadway #2) wins via Broadway #1; once Broadway #1 is
// blocked, Jordan (mezzanine, via the bleacher stairs) becomes closer.
// Sam is off duty to show the availability filter.
export const SEED_STAFF: { name: string; role: StaffRole; zone: string; status?: StaffStatus }[] = [
  { name: "Maya Chen", role: "network", zone: "atrium-east" },
  { name: "Diego Ramirez", role: "network", zone: "mezz-tables" },
  { name: "Priya Patel", role: "facilities", zone: "broadway-2" },
  { name: "Jordan Kim", role: "facilities", zone: "mezz-north" },
  { name: "Sam Okafor", role: "facilities", zone: "pavilion-north", status: "off_duty" },
  { name: "Lena Novak", role: "supplies", zone: "north-hall" },
  { name: "Theo Park", role: "guest_services", zone: "east-lobby" },
  { name: "Alex Morgan", role: "ops_lead", zone: "public-entrance" },
];
