// One-shot Cartesia setup: webhook tools -> agent (Claude + system prompt) -> phone number.
// Usage: CARTESIA_API_KEY=... CARTESIA_TOOL_SECRET=... node agent/setup-cartesia.mjs
// Never commit the API key. It is only read from the environment.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.CARTESIA_API_KEY;
const SECRET = process.env.CARTESIA_TOOL_SECRET;
const PHONE_LABEL = process.env.PHONE_LABEL || "PeopleOS";
if (!KEY || !SECRET) {
  console.error("Set CARTESIA_API_KEY and CARTESIA_TOOL_SECRET first.");
  process.exit(1);
}

const BASE = "https://api.cartesia.ai";
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "X-API-Key": KEY,
      "Cartesia-Version": "2026-08-14",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 600)}`);
  return json;
}
const list = (x) => (Array.isArray(x) ? x : x?.data ?? x?.items ?? x?.models ?? x?.voices ?? []);

// 1. Model: prefer a Claude Sonnet, then any Anthropic model.
const models = list(await api("GET", "/v1/agents/models"));
const ids = models.map((m) => m.id ?? m.model_id ?? m.name).filter(Boolean);
console.log("models:", ids.join(", "));
const pick =
  process.env.MODEL_ID ||
  ids.find((i) => /claude.*sonnet/i.test(i)) ||
  ids.find((i) => /claude|anthropic/i.test(i));
if (!pick) throw new Error("No Claude model found. Re-run with MODEL_ID=<id from list above>.");
console.log("model ->", pick);

// 2. Voice
let voiceId = process.env.VOICE_ID;
if (!voiceId) {
  const voices = list(await api("GET", "/voices"));
  const en = voices.find((v) => (v.language ?? "en").startsWith("en")) ?? voices[0];
  voiceId = en?.id;
  console.log("voice ->", voiceId, en?.name ?? "");
}
if (!voiceId) throw new Error("No voice found. Re-run with VOICE_ID=<id>.");

// 3. Webhook tools (delete leftovers from a failed run first: OLD_TOOL_IDS=id1,id2,id3)
for (const id of (process.env.OLD_TOOL_IDS || "").split(",").filter(Boolean)) {
  try { await api("DELETE", `/v1/agents/tools/${id}`); console.log("deleted old tool", id); }
  catch (e) { console.log("could not delete", id, "-", e.message); }
}
const toolDefs = JSON.parse(readFileSync(join(dir, "cartesia-tools.json"), "utf8"));
const toolIds = [];
for (const def of toolDefs) {
  const body = JSON.parse(JSON.stringify(def).replaceAll("<CARTESIA_TOOL_SECRET>", SECRET));
  const t = await api("POST", "/v1/agents/tools", body);
  console.log("tool ->", def.name, t.id);
  toolIds.push(t.id);
}

// 4. Agent
const agent = await api("POST", "/v1/agents", {
  name: "PeopleOS",
  description: "Cal Hacks 13.0 venue help line",
  config: {
    instructions: readFileSync(join(dir, "system-prompt.md"), "utf8"),
    initial_message: "Hi, this is the Cal Hacks venue help line. What's the problem?",
    language: { primary: "en" },
    model: { id: pick, fallback_strategy: { type: "auto" }, max_output_tokens: 512 },
    audio: {
      input: { keyterms: ["mezzanine", "Broadway", "atrium", "Cal Hacks"], noise_suppression: "auto" },
      output: { voice_id: voiceId },
    },
    tools: toolIds.map((id) => ({ id })),
    system_tools: { end_call: { description: null, pre_tool_speech: "auto" } },
    timezone: "America/Los_Angeles",
  },
});
console.log("agent ->", agent.id);

// 5. Phone number: reuse an existing one, else provision.
let numbers = [];
try { numbers = list(await api("GET", "/agents/phone-numbers")); } catch (e) { console.log("list numbers failed:", e.message); }
let num = process.env.PHONE_ID ? { id: process.env.PHONE_ID } : numbers[0];
if (!num) {
  num = await api("POST", "/agents/phone-numbers/provision", { label: PHONE_LABEL });
  console.log("provisioned ->", JSON.stringify(num));
}
await api("PATCH", `/agents/phone-numbers/${num.id}`, { agent_id: agent.id });
const shown = numbers.find((n) => n.id === num.id) ?? num;
console.log("PHONE ->", shown.phone_number ?? shown.number ?? JSON.stringify(shown), "=> agent", agent.id);
console.log("DONE. Call it and say: 'Table 142's outlet isn't working.'");
