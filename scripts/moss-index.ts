// Creates or refreshes the Moss cloud index "calhacks-venue" used by the voice agent's
// venue_search tool: one document per event fact (agent/event-kb.json) and one per
// area line of agent/venue-guide.md. Re-run after editing either file.
// Run: npx tsx scripts/moss-index.ts
// Other venues: npx tsx scripts/moss-index.ts --index <name> --kb <facts.json> --guide <guide.md>
// (scripts/venue-load.ts does this with a new index name; it never touches calhacks-venue).
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

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const dir = join(process.cwd(), "agent");
const indexName = arg("index") ?? MOSS_INDEX_NAME;
const kb = JSON.parse(readFileSync(arg("kb") ?? join(dir, "event-kb.json"), "utf8")) as KbEntry[];
const docs = buildMossDocuments(kb, readFileSync(arg("guide") ?? join(dir, "venue-guide.md"), "utf8"));

async function main() {
  const client = new MossClient(credentials[0]!, credentials[1]!);
  try {
    const exists = (await client.listIndexes()).some((i) => i.name === indexName);
    if (!exists) {
      await client.createIndex(indexName, docs);
      console.log(`created ${indexName} with ${docs.length} documents`);
    } else {
      // Refresh in place so live calls keep working: upsert everything, then drop removed ids.
      await client.addDocs(indexName, docs, { upsert: true });
      const keep = new Set(docs.map((d) => d.id));
      const stale = (await client.getDocs(indexName)).map((d) => d.id).filter((id) => !keep.has(id));
      if (stale.length > 0) await client.deleteDocs(indexName, stale);
      console.log(`refreshed ${indexName}: ${docs.length} documents, ${stale.length} removed`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
