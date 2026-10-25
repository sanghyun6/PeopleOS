// Voice-agent files for a Venue Pack: system prompt, venue guide, Cartesia tool bodies,
// Moss documents. Reuses the same builders as agent/export.ts (Cal Hacks) with the
// pack's venue instead of the built-in one.
import { floorName, type CompiledVenue, type Level } from "../convex/lib/venuePack";
import type { KbEntry } from "./venue-search";
import { buildSystemPrompt, type PromptVenue } from "./prompt";
import { buildTools, toCartesiaWebhookTool, type CartesiaWebhookTool } from "./tools";
import { buildVenueGuide, type GuideVenue } from "./venue-guide";
import { buildVocabulary } from "./vocabulary";

const MAX_GUIDE_FACTS = 40;

const quote = (labels: string[]) => labels.map((l) => `"${l}"`).join(", ");

export function packAgentFiles(venue: CompiledVenue, siteUrl: string, secret = "<CARTESIA_TOOL_SECRET>") {
  const { meta, locations } = venue;
  const floor = (level: Level) => floorName(meta.floors, level).toLowerCase();
  const places = locations.filter((l) => l.kind !== "zone");
  const named = places.length ? places : locations;
  // One example per kind reads more natural than three tables.
  const examples = named.filter((l, i) => named.findIndex((o) => o.kind === l.kind) === i).slice(0, 3);
  const first = examples[0] ?? locations[0];
  const desk = meta.helpDeskKey ? locations.find((l) => l.key === meta.helpDeskKey) : undefined;
  const deskPhrase = desk ? `the ${desk.label.replace(/^the /i, "")}` : `the nearest ${meta.eventName} staff member`;
  const target = desk ?? named.find((l) => l.key !== first.key) ?? first;
  const twoFloors = meta.floors.length > 1;
  const hasTables = locations.some((l) => l.kind === "table");

  const promptVenue: PromptVenue = {
    identity: `for ${meta.eventName} at ${meta.venueName}${meta.city ? ` in ${meta.city}` : ""}. Callers are attendees and staff reporting a problem somewhere in the venue.`,
    confirmExample: `${first.label} on the ${floor(first.level)}`,
    floorRule: twoFloors ? `Always say which floor: "on the ${floor("main")}" or "on the ${floor("mezz")}".` : "",
    labelExamples: quote(examples.map((l) => l.label)),
    directionsExample: `"how do I get to ${target === desk ? deskPhrase : target.label} from ${first.label}?"`,
    eventTopics: meta.knowledge.length
      ? meta.knowledge.slice(0, 10).map((k) => k.title.toLowerCase()).join(", ")
      : "schedule, food, and any other question about the event",
    infoDesk: deskPhrase,
    infoDeskShort: deskPhrase,
    staffTitle: `${meta.eventName} staff member`,
    helpDesk: deskPhrase,
    staffDesk: deskPhrase,
    whereIsExamples: "restrooms, food, a room, a booth",
    tables: hasTables ? { noun: "Tables", lowerFloor: `the ${floor("main")}`, upperFloor: `the ${floor("mezz")}` } : undefined,
    boothNoun: "Booths",
  };

  const guideVenue: GuideVenue = { zones: venue.zones, edges: venue.edges, locations, levelName: floor };
  const facts = meta.knowledge
    .slice(0, MAX_GUIDE_FACTS)
    .map((k) => `${k.title}: ${k.text}`)
    .join("\n");
  const guide = buildVenueGuide(
    facts || "(none yet)",
    guideVenue,
    "Not in this guide, so call venue_search instead of guessing: the schedule, food, and any other event question. Anything about places that are not named above: say you are not sure.",
  );
  const systemPrompt = buildSystemPrompt(buildVocabulary(locations), guide, promptVenue);
  const tools: CartesiaWebhookTool[] = buildTools(promptVenue.labelExamples).map((t) => toCartesiaWebhookTool(t, siteUrl, secret));
  const knowledge: KbEntry[] = meta.knowledge;

  return {
    guide,
    systemPrompt,
    tools,
    knowledge,
    initialMessage: `Hi, this is the ${meta.eventName} venue help line. What's the problem?`,
    keyterms: meta.keyterms.length ? meta.keyterms : [meta.eventName, meta.venueName],
  };
}
