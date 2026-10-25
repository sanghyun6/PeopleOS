"use node";
// Moss retrieval for venue_search. The SDK is a native module (see convex.json
// externalPackages) that downloads the cloud index and queries it in memory.
// The loaded index is cached in module scope: the first call in a fresh container
// pays the load (several seconds), later ones take a few ms. The caller
// (cartesia.ts) enforces the 2 s timeout and falls back to keyword search.
import { v } from "convex/values";
import { MossClient } from "@moss-js/moss";
import { internalAction } from "./_generated/server";
import { MOSS_INDEX_NAME, relevantFacts, toFact } from "../agent/venue-search";

let client: MossClient | undefined;
let loading: Promise<void> | undefined;

function ensureLoaded(): { ready: Promise<void>; cold: boolean } {
  if (loading) return { ready: loading, cold: false };
  const projectId = process.env.MOSS_PROJECT_ID;
  const projectKey = process.env.MOSS_PROJECT_KEY;
  if (!projectId || !projectKey) throw new Error("MOSS_PROJECT_ID / MOSS_PROJECT_KEY not set");
  const c = (client ??= new MossClient(projectId, projectKey));
  // /tmp is the only writable path in the Convex Node runtime.
  loading = c.loadIndex(MOSS_INDEX_NAME, { cachePath: "/tmp/moss" }).then(
    () => undefined,
    (error) => {
      loading = undefined; // let the next call retry instead of caching the failure
      throw error;
    },
  );
  return { ready: loading, cold: true };
}

const factValidator = v.object({
  id: v.string(),
  title: v.string(),
  text: v.string(),
  asOf: v.optional(v.string()),
  score: v.number(),
});

/** Hybrid (semantic + keyword) search over the calhacks-venue index. Throws if Moss is unreachable. */
export const search = internalAction({
  args: { query: v.string() },
  returns: v.object({ facts: v.array(factValidator), cold: v.boolean(), queryMs: v.number() }),
  handler: async (_ctx, { query }) => {
    const { ready, cold } = ensureLoaded();
    await ready;
    const started = Date.now();
    // alpha 0.5 blends keyword and semantic so exact names ("Gate 4", "Group C") still match.
    const result = await client!.query(MOSS_INDEX_NAME, query, { topK: 3, alpha: 0.5 });
    return {
      facts: relevantFacts(result.docs.map(toFact)),
      cold,
      queryMs: Date.now() - started,
    };
  },
});
