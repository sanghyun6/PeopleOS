// Writes the built-in Cal Hacks venue as a Venue Pack (docs/examples/calhacks-venue-pack.json).
// Run: npm run export:venue-pack
// Validates the result with the same schema the loader uses, so the example never drifts.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildCalHacksPack } from "../agent/calhacks-pack";
import { compileVenuePack, parseVenuePack, unreachableZones } from "../convex/lib/venuePack";

const out = join(process.cwd(), process.argv[2] ?? "docs/examples/calhacks-venue-pack.json");
const pack = buildCalHacksPack();
const parsed = parseVenuePack(JSON.parse(JSON.stringify(pack)));
if (!parsed.ok) {
  console.error(`Cal Hacks pack does not validate:\n  ${parsed.errors.join("\n  ")}`);
  process.exit(1);
}
const compiled = compileVenuePack(parsed.pack);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(pack, null, 2) + "\n");
console.log(
  `wrote ${out}: ${compiled.zones.length} zones, ${compiled.edges.length} edges, ` +
    `${compiled.locations.length} locations (incl. zones), ${compiled.staff.length} staff, ` +
    `${compiled.meta.knowledge.length} facts; unreachable zones: ${unreachableZones(parsed.pack).length}`,
);
