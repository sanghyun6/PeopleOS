// POST /api/onboard/extract { text } -> { facts, model, latencyMs, chars }
// Turns pasted event guidelines into Venue Pack knowledge facts with a
// Bitdeer AI Model Studio chat model. BITDEER_API_KEY is read here, on the server only.
// Failures come back as { error } with the real reason; there is no sample fallback.
import { NextResponse } from "next/server";
import { BITDEER_BASE_URL, DEFAULT_CHAT_MODEL, parseChatContent } from "@/convex/lib/bitdeer";
import { parseFactsReply } from "@/components/onboard/draft";

export const runtime = "nodejs";

const MAX_INPUT_CHARS = 12_000;
// DeepSeek reasons before answering; a long fact list needs room after that.
const CHAT_TIMEOUT_MS = 90_000;
const MAX_TOKENS = 6_000;

const SYSTEM = `You turn event guidelines into facts for a venue phone help line.
Return ONLY a JSON array, no prose: [{"title": "2-5 word topic", "text": "1-2 plain sentences"}].
Cover what attendees ask: schedule, meals, wifi, rules, where amenities are, parking, lost and found, contacts.
Use only facts stated in the input. Never invent times, places or names. At most 25 items.`;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Send JSON: { text }.");
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return fail(400, "Paste the event info first.");
  const input = text.slice(0, MAX_INPUT_CHARS);

  const apiKey = process.env.BITDEER_API_KEY;
  if (!apiKey) {
    return fail(500, "BITDEER_API_KEY is not set yet (see the setup list in the last step). Add facts by hand for now, or set the key and restart the dev server.");
  }
  const model = process.env.BITDEER_CHAT_MODEL || DEFAULT_CHAT_MODEL;

  const started = Date.now();
  let reply: string;
  try {
    const res = await fetch(`${BITDEER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: input },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
    if (!res.ok) return fail(502, `Bitdeer answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    reply = parseChatContent(await res.json());
  } catch (error) {
    return fail(502, `Bitdeer request failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const facts = parseFactsReply(reply);
    if (facts.length === 0) return fail(422, "Bitdeer found no facts in that text.");
    return NextResponse.json({ facts, model, latencyMs: Date.now() - started, chars: input.length, truncated: text.length > input.length });
  } catch (error) {
    return fail(502, `${error instanceof Error ? error.message : String(error)} (model: ${model})`);
  }
}
