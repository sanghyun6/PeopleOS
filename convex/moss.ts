// Moss retrieval for venue_search. Moss's in-process embedding model cannot load
// inside Convex actions and Moss has no server-side query API, so the query runs on
// scripts/moss-server.ts (reached via MOSS_SEARCH_URL). The caller (cartesia.ts)
// enforces the overall 2 s limit and falls back to keyword search on any failure.
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { MOSS_TIMEOUT_MS, type Fact } from "../agent/venue-search";

const factValidator = v.object({
  id: v.string(),
  title: v.string(),
  text: v.string(),
  asOf: v.optional(v.string()),
  score: v.number(),
});

/** Hybrid search over the calhacks-venue index. Throws if the search server is unreachable. */
export const search = internalAction({
  args: { query: v.string() },
  returns: v.object({ facts: v.array(factValidator), queryMs: v.number() }),
  handler: async (_ctx, { query }) => {
    const url = process.env.MOSS_SEARCH_URL;
    if (!url) throw new Error("MOSS_SEARCH_URL not set");
    const token = process.env.MOSS_SEARCH_TOKEN;
    const response = await fetch(`${url.replace(/\/$/, "")}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(MOSS_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`search server answered ${response.status}`);
    const body = (await response.json()) as { facts: Fact[]; queryMs: number };
    return { facts: body.facts, queryMs: body.queryMs };
  },
});
