import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileVenuePack, parseVenuePack, unreachableZones } from "../convex/lib/venuePack";
import { packAgentFiles } from "./pack-agent";
import { areaDocuments } from "./venue-search";

const raw = JSON.parse(readFileSync(join(__dirname, "../docs/examples/sample-venue-pack.json"), "utf8"));

describe("sample Venue Pack", () => {
  const parsed = parseVenuePack(raw);
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  const venue = compileVenuePack(parsed.pack);
  const files = packAgentFiles(venue, "https://example.convex.site");

  it("validates, is connected, and maps two floors to main/mezz by elevation", () => {
    expect(unreachableZones(parsed.pack)).toEqual([]);
    expect(venue.meta.floors.map((f) => [f.id, f.level])).toEqual([["ground", "main"], ["upper", "mezz"]]);
    expect(venue.zones.find((z) => z.key === "workshop-a")?.level).toBe("mezz");
    expect(venue.meta.detailedGeometry).toBeUndefined();
  });

  it("builds a prompt for this venue with no Cal Hacks wording", () => {
    expect(files.systemPrompt).toContain("Harbor Builders Summit at Harborview Convention Center");
    expect(files.systemPrompt).not.toMatch(/Cal Hacks|Box Office|mezzanine|Palace/);
    expect(files.systemPrompt).toContain('"Table 1" to "Table 24"');
    expect(files.tools.map((t) => t.api_schema.url)).toContain("https://example.convex.site/cartesia/create_incident");
  });

  it("names its floors in the guide, so Moss gets one area document per zone", () => {
    expect(areaDocuments(files.guide).map((d) => d.title)).toHaveLength(venue.zones.length);
    expect(files.guide).toContain("Workshop Room A (upper level)");
  });

  it("reports readable errors for a broken pack", () => {
    const broken = { ...raw, staff: [{ name: "X", role: "chef", startZone: "nowhere" }] };
    const result = parseVenuePack(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/staff\.0\.role/);
  });
});
