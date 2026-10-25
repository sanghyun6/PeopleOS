// Tiny search server for the voice agent's venue_search tool. Moss queries run in
// process (embedding model included), which does not work inside Convex actions, so
// this loads the "calhacks-venue" index once and answers POST /search over HTTP.
// Convex calls it through MOSS_SEARCH_URL. Run: npx tsx scripts/moss-server.ts
// then expose it with a tunnel (see agent/README.md).
// Env (.env.local): MOSS_PROJECT_ID, MOSS_PROJECT_KEY, optional MOSS_SEARCH_TOKEN
// (bearer secret, set the same value on Convex) and MOSS_SERVER_PORT (default 8787).
import { createServer } from "node:http";
import { MossClient } from "@moss-js/moss";
import {
  MOSS_INDEX_NAME,
  isBearerAuthorized,
  parseSearchRequest,
  relevantFacts,
  toFact,
} from "../agent/venue-search";

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
const token = process.env.MOSS_SEARCH_TOKEN;
const port = Number(process.env.MOSS_SERVER_PORT ?? 8787);

const send = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

async function main() {
  const client = new MossClient(credentials[0]!, credentials[1]!);
  await client.loadIndex(MOSS_INDEX_NAME);
  // Warm the embedding model so the first real call is fast.
  await client.query(MOSS_INDEX_NAME, "warm up", { topK: 1, alpha: 0.5 });

  createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
    if (req.method !== "POST" || req.url !== "/search") return send(res, 404, { error: "not found" });
    if (!isBearerAuthorized(req.headers.authorization, token)) return send(res, 401, { error: "unauthorized" });
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const query = parseSearchRequest(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      if (query === null) return send(res, 400, { error: 'body must be {"query": "<text>"}' });
      const started = Date.now();
      // alpha 0.5 blends keyword and semantic so exact names ("Gate 4", "Group C") still match.
      const result = await client.query(MOSS_INDEX_NAME, query, { topK: 3, alpha: 0.5 });
      send(res, 200, { facts: relevantFacts(result.docs.map(toFact)), queryMs: Date.now() - started });
    } catch (error) {
      console.error("search failed:", error instanceof Error ? error.message : error);
      send(res, 500, { error: "search failed" });
    }
  }).listen(port, () => console.log(`moss search server on :${port} (auth ${token ? "on" : "OFF"})`));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
