// Creates or refreshes the Moss cloud index "calhacks-venue" used by the voice agent's
// venue_search tool: one document per event fact (agent/event-kb.json) and one per
// area line of agent/venue-guide.md. Re-run after editing either file.
// Run: npx tsx scripts/moss-index.ts
// Needs MOSS_PROJECT_ID and MOSS_PROJECT_KEY in .env.local (never printed).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MossClient } from "@moss-js/moss";
import { MOSS_INDEX_NAME, buildMossDocuments, type KbEntry } from "../agent/venue-search";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine when the variables are already in the environment.
}
const credentials = [process.env.MOSS_PROJECT_ID, process.env.MOSS_PROJECT_KEY] as const;
if (!credentials[0] || !credentials[1]) {
  console.error("Set MOSS_PROJECT_ID and MOSS_PROJECT_KEY in .env.local");
  process.exit(1);
}

const dir = join(process.cwd(), "agent");
const kb = JSON.parse(readFileSync(join(dir, "event-kb.json"), "utf8")) as KbEntry[];
const docs = buildMossDocuments(kb, readFileSync(join(dir, "venue-guide.md"), "utf8"));

async function main() {
  const client = new MossClient(credentials[0]!, credentials[1]!);
  try {
    const exists = (await client.listIndexes()).some((i) => i.name === MOSS_INDEX_NAME);
    if (!exists) {
      await client.createIndex(MOSS_INDEX_NAME, docs);
      console.log(`created ${MOSS_INDEX_NAME} with ${docs.length} documents`);
    } else {
      // Refresh in place so live calls keep working: upsert everything, then drop removed ids.
      await client.addDocs(MOSS_INDEX_NAME, docs, { upsert: true });
      const keep = new Set(docs.map((d) => d.id));
      const stale = (await client.getDocs(MOSS_INDEX_NAME)).map((d) => d.id).filter((id) => !keep.has(id));
      if (stale.length > 0) await client.deleteDocs(MOSS_INDEX_NAME, stale);
      console.log(`refreshed ${MOSS_INDEX_NAME}: ${docs.length} documents, ${stale.length} removed`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
