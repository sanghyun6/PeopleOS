import { describe, expect, it } from "vitest";
import { compileVenuePack, parseVenuePack, unreachableZones } from "../../convex/lib/venuePack";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_DRAFT, draftToPack, htmlToText, packToDraft, parseFactsReply, parseStaffCsv, suggestEdges, zoneForPlace, type Draft } from "./draft";

const draft: Draft = {
  ...EMPTY_DRAFT,
  event: { name: "Test Expo", venueName: "Hall 9", city: "", timezone: "America/Los_Angeles", helpDesk: "p1" },
  zones: [
    { id: "hall", name: "Main Hall", floor: "ground", x: 10, z: 10, w: 20, d: 20, height: 4, kind: "hall" },
    { id: "foyer", name: "Foyer", floor: "ground", x: 25, z: 10, w: 10, d: 10, height: 3, kind: "corridor" },
    { id: "annex", name: "Annex", floor: "ground", x: 60, z: 60, w: 10, d: 10, height: 3, kind: "room" },
  ],
  places: [
    { id: "p1", name: "Info Desk", kind: "amenity", floor: "ground", x: 24, z: 9 },
    { id: "p2", name: "Table 12", kind: "table", floor: "ground", x: 5, z: 5 },
  ],
};

describe("onboard draft", () => {
  it("suggests edges only between touching zones on the same floor", () => {
    expect(suggestEdges(draft.zones, [])).toEqual([{ from: "hall", to: "foyer", kind: "walk" }]);
    expect(suggestEdges(draft.zones, [{ from: "foyer", to: "hall", kind: "walk" }])).toEqual([]);
  });

  it("puts a place in the smallest zone containing it", () => {
    expect(zoneForPlace(draft.places[0], draft.zones)?.id).toBe("foyer");
  });

  it("parses staff CSV with a header, aliases, quotes and per-line errors", () => {
    const { staff, errors } = parseStaffCsv(
      'name,role,start_zone,status\n"Lee, Ana",Guest Services,Main Hall,\nBo,ops,foyer,off duty\nCy,chef,hall\nDi,it,nowhere',
      draft.zones,
    );
    expect(staff).toEqual([
      { name: "Lee, Ana", role: "guest_services", startZone: "hall", status: "available" },
      { name: "Bo", role: "ops_lead", startZone: "foyer", status: "off_duty" },
    ]);
    expect(errors).toEqual([expect.stringMatching(/line 4: unknown role "chef"/), expect.stringMatching(/line 5: unknown start zone "nowhere"/)]);
  });

  it("reads facts from a fenced model reply and rejects non-JSON", () => {
    const facts = parseFactsReply('Here:\n```json\n[{"title":"Lunch","text":"Noon in the hall."},{"title":"","text":"x"}]\n```', "https://x.test");
    expect(facts).toEqual([{ id: "lunch", title: "Lunch", text: "Noon in the hall.", source: "https://x.test" }]);
    expect(() => parseFactsReply("no facts here")).toThrow(/JSON list/);
  });

  it("strips HTML to text", () => {
    expect(htmlToText("<html><script>x()</script><p>Hi &amp; welcome</p><p>Lunch at noon</p></html>")).toBe("Hi & welcome\nLunch at noon");
  });

  it("builds a pack the loader accepts (and flags disconnected zones)", () => {
    const pack = draftToPack({ ...draft, edges: suggestEdges(draft.zones, []) }, [{ name: "Bo", role: "facilities", startZone: "hall", status: "available" }]);
    const parsed = parseVenuePack(JSON.parse(JSON.stringify(pack)));
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    expect(parsed.pack.event.helpDesk).toBe("amenity:info-desk");
    expect(parsed.pack.locations.map((l) => l.id)).toEqual(["amenity:info-desk", "table:12"]);
    expect(unreachableZones(parsed.pack)).toEqual(["annex"]);
    expect(compileVenuePack(parsed.pack).locations).toHaveLength(5);
  });

  it("round-trips the sample pack through the editor draft", () => {
    const raw = JSON.parse(readFileSync(join(__dirname, "../../docs/examples/sample-venue-pack.json"), "utf8"));
    const original = parseVenuePack(raw);
    if (!original.ok) throw new Error(original.errors.join("\n"));
    const { draft: d, staffCsv } = packToDraft(original.pack);
    const { staff, errors } = parseStaffCsv(staffCsv, d.zones);
    expect(errors).toEqual([]);
    const again = parseVenuePack(JSON.parse(JSON.stringify(draftToPack(d, staff))));
    if (!again.ok) throw new Error(again.errors.join("\n"));
    const a = compileVenuePack(original.pack);
    const b = compileVenuePack(again.pack);
    expect(b.locations.map((l) => [l.key, l.zoneKey, l.level])).toEqual(a.locations.map((l) => [l.key, l.zoneKey, l.level]));
    expect(b.edges.map((e) => [e.a, e.b, e.kind])).toEqual(a.edges.map((e) => [e.a, e.b, e.kind]));
    expect(b.staff).toEqual(a.staff);
    expect(again.pack.event.helpDesk).toBe("amenity:registration-desk");
  });
});
