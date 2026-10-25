// Loads a Venue Pack into a SEPARATE Convex deployment, in one run:
//   (a) validate + compile, then replace zones/edges/locations/staff (and incidents) via venuePack:load
//   (b) generate the agent's system prompt, venue guide and tool bodies (agent/pack-agent.ts)
//   (c) register a NEW Cartesia agent with agent/setup-cartesia.mjs (SKIP_PHONE=1: no number is
//       provisioned or re-pointed; connecting a number stays a manual step)
//   (d) create a NEW Moss index with scripts/moss-index.ts (never calhacks-venue)
// Usage: npm run venue:load -- <pack.json> [--site-url URL] [--skip-cartesia] [--skip-moss] [--dry-run]
// Target deployment: CONVEX_DEPLOYMENT / NEXT_PUBLIC_CONVEX_URL from .env.local. The live
// Cal Hacks deployment is refused outright. Never prints key values.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileVenuePack, parseVenuePack, slugify, unreachableZones } from "../convex/lib/venuePack";
import { packAgentFiles } from "../agent/pack-agent";
import { MOSS_INDEX_NAME } from "../agent/venue-search";

/** Deployments this script must never write to (the live Cal Hacks demo). */
const PROTECTED_DEPLOYMENTS = ["resolute-horse-290"];
const CAL_HACKS_AGENT_NAME = "PeopleOS";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const option = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const packPath = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--site-url");
const fail = (message: string): never => {
  console.error(`\n✖ ${message}`);
  process.exit(1);
};
const step = (title: string) => console.log(`\n▸ ${title}`);

if (!packPath) fail("Usage: npm run venue:load -- <pack.json> [--site-url URL] [--skip-cartesia] [--skip-moss] [--dry-run]");

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine when the variables are already in the environment.
}

// --- Validate ---------------------------------------------------------------
step(`Validate ${packPath}`);
let json: unknown;
try {
  json = JSON.parse(readFileSync(resolve(packPath!), "utf8"));
} catch (error) {
  fail(`Could not read the pack as JSON: ${error instanceof Error ? error.message : error}`);
}
const parsed = parseVenuePack(json);
if (!parsed.ok) fail(`The pack is not valid:\n  ${parsed.errors.join("\n  ")}`);
const pack = parsed.ok ? parsed.pack : (undefined as never);
const unreachable = unreachableZones(pack);
if (unreachable.length) fail(`These zones have no walking path to the rest: ${unreachable.join(", ")}. Add edges.`);
const venue = compileVenuePack(pack);
console.log(
  `  ${pack.event.name} @ ${pack.event.venueName}: ${venue.zones.length} zones, ${venue.edges.length} edges, ` +
    `${venue.locations.length} locations, ${venue.staff.length} staff, ${venue.meta.knowledge.length} facts, ` +
    `${venue.meta.floors.length} floor(s)`,
);

// --- Target deployment guard ------------------------------------------------
const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
const siteUrl = option("site-url") ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
step("Target deployment");
console.log(`  CONVEX_DEPLOYMENT=${deployment || "(unset)"}  url=${convexUrl || "(unset)"}`);
if (!deployment && !process.env.CONVEX_SELF_HOSTED_URL) fail("No Convex deployment configured in .env.local.");
if (PROTECTED_DEPLOYMENTS.some((d) => `${deployment} ${convexUrl} ${siteUrl}`.includes(d))) {
  fail("Refusing to load: this is the live Cal Hacks deployment. Point .env.local at a separate deployment first.");
}
if (deployment.startsWith("prod:")) fail("Refusing to load into a production deployment.");

const slug = slugify(pack.event.name);
const outDir = join(process.cwd(), ".venue-packs", slug);
mkdirSync(outDir, { recursive: true });

const run = (cmd: string, args: string[], env: Record<string, string> = {}) => {
  const result = spawnSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env }, encoding: "utf8" });
  return { ok: result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
};

// --- (b) agent files (written first so a dry run shows them) ------------------
step("(b) Generate system prompt, venue guide and tool bodies");
const files = packAgentFiles(venue, siteUrl || "<CONVEX_SITE_URL>");
const promptFile = join(outDir, "system-prompt.md");
const toolsFile = join(outDir, "cartesia-tools.json");
const guideFile = join(outDir, "venue-guide.md");
const kbFile = join(outDir, "knowledge.json");
writeFileSync(promptFile, files.systemPrompt);
writeFileSync(toolsFile, JSON.stringify(files.tools, null, 2) + "\n");
writeFileSync(guideFile, files.guide);
writeFileSync(kbFile, JSON.stringify(files.knowledge, null, 2) + "\n");
writeFileSync(join(outDir, "compiled.json"), JSON.stringify(venue, null, 2) + "\n");
console.log(`  wrote ${outDir}/{system-prompt.md, venue-guide.md, cartesia-tools.json, knowledge.json, compiled.json}`);

if (flag("dry-run")) {
  console.log("\n--dry-run: nothing was written to Convex, Cartesia or Moss.");
  process.exit(0);
}

// --- (a) Convex -------------------------------------------------------------
step("(a) Load zones, edges, locations and staff into Convex");
const { meta, zones, edges, locations, staff } = venue;
const loaded = run("npx", ["convex", "run", "venuePack:load", JSON.stringify({ meta, zones, edges, locations, staff })]);
if (!loaded.ok) fail(`venuePack:load failed:\n${loaded.out}`);
console.log(`  ${loaded.out.split("\n").filter((l) => l.trim()).slice(-6).join("\n  ")}`);

const summary: string[] = [`Convex: loaded into ${deployment}`];

// --- (c) Cartesia -----------------------------------------------------------
if (flag("skip-cartesia")) {
  summary.push("Cartesia: skipped (--skip-cartesia)");
} else if (!process.env.CARTESIA_API_KEY) {
  summary.push("Cartesia: skipped (CARTESIA_API_KEY not set)");
} else {
  step("(c) Register a new Cartesia agent (no phone number)");
  const agentName = `PeopleOS - ${pack.event.name}`;
  if (agentName === CAL_HACKS_AGENT_NAME) fail("Agent name would collide with the Cal Hacks agent.");
  const secret = randomBytes(16).toString("hex");
  const setSecret = run("npx", ["convex", "env", "set", "CARTESIA_TOOL_SECRET", secret]);
  if (!setSecret.ok) fail(`Could not set CARTESIA_TOOL_SECRET on ${deployment}:\n${setSecret.out.replaceAll(secret, "<secret>")}`);
  writeFileSync(toolsFile, JSON.stringify(packAgentFiles(venue, siteUrl).tools, null, 2) + "\n");
  if (/127\.0\.0\.1|localhost/.test(siteUrl)) {
    console.log(`  ! Tools point at ${siteUrl}; Cartesia's cloud cannot reach a local deployment.`);
    console.log("    Re-run with --site-url <public URL> (tunnel or cloud deployment) before taking real calls.");
  }
  const setup = run("node", ["agent/setup-cartesia.mjs"], {
    CARTESIA_TOOL_SECRET: secret,
    AGENT_NAME: agentName,
    AGENT_DESCRIPTION: `${pack.event.name} venue help line (${pack.event.venueName})`,
    INITIAL_MESSAGE: files.initialMessage,
    KEYTERMS: files.keyterms.join(","),
    PROMPT_FILE: promptFile,
    TOOLS_FILE: toolsFile,
    SKIP_PHONE: "1",
  });
  const out = setup.out.replaceAll(secret, "<secret>");
  console.log(`  ${out.split("\n").filter((l) => !l.startsWith("models:")).join("\n  ")}`);
  const agentId = /agent -> (\S+)/.exec(out)?.[1];
  summary.push(
    setup.ok && agentId
      ? `Cartesia: agent "${agentName}" (${agentId}) created; phone number NOT connected (manual step)`
      : "Cartesia: registration FAILED (see output above)",
  );
}

// --- (d) Moss ---------------------------------------------------------------
if (flag("skip-moss")) {
  summary.push("Moss: skipped (--skip-moss)");
} else if (!process.env.MOSS_PROJECT_ID || !process.env.MOSS_PROJECT_KEY) {
  summary.push("Moss: skipped (MOSS_PROJECT_ID / MOSS_PROJECT_KEY not set)");
} else {
  step("(d) Create a new Moss index");
  const indexName = `venue-${slug}`;
  if (indexName === MOSS_INDEX_NAME) fail("Index name would collide with the Cal Hacks index.");
  const moss = run("npx", ["tsx", "scripts/moss-index.ts", "--index", indexName, "--kb", kbFile, "--guide", guideFile]);
  console.log(`  ${moss.out}`);
  summary.push(
    moss.ok
      ? `Moss: index "${indexName}" ready (serve it with MOSS_INDEX=${indexName} npx tsx scripts/moss-server.ts)`
      : "Moss: indexing FAILED (see output above); venue_search falls back to keyword search over the pack's facts",
  );
}

console.log(`\n✔ Done\n  ${summary.join("\n  ")}`);
console.log("  Manual: connect a phone number to the new agent in the Cartesia dashboard (see README).");
