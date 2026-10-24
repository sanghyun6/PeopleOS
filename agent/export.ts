// Writes the files to paste into Cartesia:
//   agent/event-facts.md     -> hand-edited event facts (input)
//   agent/venue-guide.md     -> generated guide (also appended to the system prompt)
//   agent/system-prompt.md   -> agent instructions (Playground "Instructions" or config.instructions)
//   agent/cartesia-tools.json -> bodies for POST /v1/agents/tools, one per tool
// Run: npx tsx agent/export.ts [convexSiteUrl]
// The bearer secret stays a placeholder; put the real CARTESIA_TOOL_SECRET in when registering.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSystemPrompt } from "./prompt";
import { TOOLS, toCartesiaWebhookTool } from "./tools";
import { buildVenueGuide } from "./venue-guide";
import { buildVocabulary } from "./vocabulary";

const siteUrl = process.argv[2] ?? "https://resolute-horse-290.convex.site";
const dir = join(process.cwd(), "agent");

const guide = buildVenueGuide(readFileSync(join(dir, "event-facts.md"), "utf8"));
writeFileSync(join(dir, "venue-guide.md"), guide);
writeFileSync(join(dir, "system-prompt.md"), buildSystemPrompt(buildVocabulary(), guide));
writeFileSync(
  join(dir, "cartesia-tools.json"),
  JSON.stringify(TOOLS.map((t) => toCartesiaWebhookTool(t, siteUrl, "<CARTESIA_TOOL_SECRET>")), null, 2) + "\n",
);
console.log(`wrote agent/system-prompt.md and agent/cartesia-tools.json for ${siteUrl}`);
