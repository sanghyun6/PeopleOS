// Bitdeer AI Model Studio: OpenAI-compatible REST client plus the pure helpers for
// duplicate judgment (bge-m3 cosine ranking + chat verdict) and staff task briefs.
// Docs: https://developers.bitdeer.ai/docs (base URL, Bearer auth, /chat/completions, /embeddings).
// No Convex imports, so every function here is unit-testable with an injected fetch.

export const BITDEER_BASE_URL = "https://api-inference.bitdeer.ai/v1";
export const EMBEDDING_MODEL = "BAAI/bge-m3";
export const DEFAULT_CHAT_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash";

/** Voice callers are waiting: embedding + verdict must finish inside this budget. */
export const DEDUP_BUDGET_MS = 3_000;
/** Hard cap on the whole duplicate judgment, Bitdeer calls included. */
export const DEDUP_TOTAL_MS = 4_000;
/** bge-m3 cosine below this means "clearly a different problem": no chat call is made. */
export const SIMILARITY_THRESHOLD = 0.55;
export const BRIEF_MAX_WORDS = 12;
const BRIEF_TIMEOUT_MS = 10_000; // scheduled action, nobody is waiting on it
/** DeepSeek spends 180-350 tokens reasoning before the ~15-word answer; 200 left the answer empty. */
export const BRIEF_MAX_TOKENS = 1_000;

export type BitdeerCallKind = "embedding" | "judge" | "brief";
export type BitdeerCall = { kind: BitdeerCallKind; model: string; latencyMs: number; ok: boolean };

type ChatMessage = { role: "system" | "user"; content: string };

export type BitdeerClient = {
  embed(texts: string[]): Promise<number[][]>;
  chat(kind: "judge" | "brief", messages: ChatMessage[], maxTokens: number): Promise<string>;
};

type ClientOptions = {
  apiKey: string;
  chatModel?: string;
  /** Epoch ms after which every request fails. */
  deadline: number;
  onCall: (call: BitdeerCall) => void;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

/** Client whose every request shares one deadline and is reported through `onCall`. */
export function createBitdeerClient(options: ClientOptions): BitdeerClient {
  const { apiKey, deadline, onCall } = options;
  const chatModel = options.chatModel || DEFAULT_CHAT_MODEL;
  const doFetch = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  async function post(path: string, body: unknown): Promise<unknown> {
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error("Bitdeer budget exhausted");
    const response = await doFetch(`${BITDEER_BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(remaining),
    });
    if (!response.ok) throw new Error(`Bitdeer ${path} answered ${response.status}`);
    return response.json();
  }

  async function timed<T>(kind: BitdeerCallKind, model: string, run: () => Promise<T>): Promise<T> {
    const started = now();
    let ok = false;
    try {
      const result = await run();
      ok = true;
      return result;
    } finally {
      onCall({ kind, model, latencyMs: now() - started, ok });
    }
  }

  return {
    embed: (texts) =>
      timed("embedding", EMBEDDING_MODEL, async () =>
        parseEmbeddings(await post("/embeddings", { model: EMBEDDING_MODEL, input: texts, encoding_format: "float" }), texts.length),
      ),
    chat: (kind, messages, maxTokens) =>
      timed(kind, chatModel, async () =>
        parseChatContent(await post("/chat/completions", { model: chatModel, messages, max_tokens: maxTokens, temperature: 0 })),
      ),
  };
}

export const briefDeadline = (now = Date.now()) => now + BRIEF_TIMEOUT_MS;
export const dedupDeadline = (now = Date.now()) => now + DEDUP_BUDGET_MS;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** `{ data: [{ index, embedding: number[] }] }` -> vectors in input order. Throws on anything else. */
export function parseEmbeddings(body: unknown, expected: number): number[][] {
  const data = isRecord(body) ? body.data : undefined;
  if (!Array.isArray(data) || data.length !== expected) throw new Error("embeddings: unexpected response shape");
  const rows = data.map((row, position) => {
    const vector = isRecord(row) ? row.embedding : undefined;
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every((n) => typeof n === "number" && Number.isFinite(n))) {
      throw new Error("embeddings: bad vector");
    }
    const index = isRecord(row) && typeof row.index === "number" ? row.index : position;
    return { index, vector: vector as number[] };
  });
  return rows.sort((a, b) => a.index - b.index).map((r) => r.vector);
}

/** `choices[0].message.content` as a non-empty string. Throws otherwise. */
export function parseChatContent(body: unknown): string {
  const choices = isRecord(body) ? body.choices : undefined;
  const message = Array.isArray(choices) && isRecord(choices[0]) ? choices[0].message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== "string" || content.trim() === "") throw new Error("chat: empty or malformed completion");
  return content;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

/** Items sorted by cosine similarity to `query`, best first. Ties keep input order. */
export function rankBySimilarity<T>(query: number[], items: { item: T; vector: number[] }[]): { item: T; score: number }[] {
  return items
    .map(({ item, vector }, order) => ({ item, score: cosineSimilarity(query, vector), order }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ item, score }) => ({ item, score }));
}

export type Verdict = { same: boolean; reason: string };

/** Model output -> verdict. Tolerates code fences and prose around the JSON; null when unusable. */
export function parseVerdict(text: string): Verdict | null {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const candidates = [stripped, ...(start >= 0 && end > start ? [stripped.slice(start, end + 1)] : [])];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed) && typeof parsed.same === "boolean") {
        return { same: parsed.same, reason: typeof parsed.reason === "string" ? parsed.reason.trim() : "" };
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export type DuplicateCandidate<Id extends string> = { id: Id; text: string; locationLabel: string };
export type DuplicateReport = { text: string; locationLabel?: string };

export function verdictMessages(report: DuplicateReport, candidate: { text: string; locationLabel: string }): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You deduplicate problem reports phoned in at a hackathon venue. Decide whether the NEW report describes the same underlying problem as the EARLIER report: same physical thing broken or needed, at the same spot, so staff should not be sent twice. Independent problems at different tables or booths are different problems. " +
        'Reply with ONLY a JSON object: {"same": true or false, "reason": "<one short sentence>"}.',
    },
    {
      role: "user",
      content: `NEW report${report.locationLabel ? ` [${report.locationLabel}]` : ""}: ${report.text}\nEARLIER report [${candidate.locationLabel}]: ${candidate.text}`,
    },
  ];
}

/** Cheap judge used when Bitdeer is unavailable: the same table/booth in the same zone is the same problem. */
export function sameLocationDuplicate<Id extends string>(
  candidates: { id: Id; sameLocation: boolean }[],
): Id | null {
  return candidates.find((c) => c.sameLocation)?.id ?? null;
}

/** Resolves with `work`, or with `onTimeout()` once `ms` have passed. Never rejects on a late `work`. */
export async function withTotalTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * bge-m3 ranks the candidates; only the top one at or above `threshold` goes to the chat
 * model. Returns that candidate's id when the model says "same", else null.
 * Any failure (network, timeout, bad JSON) -> `fallback()`, so a Bitdeer outage never
 * changes dedup behaviour and never blocks incident creation.
 * `client` null (no API key) also falls back.
 */
export async function judgeDuplicateWithBitdeer<Id extends string>(
  client: BitdeerClient | null,
  report: DuplicateReport,
  candidates: DuplicateCandidate<Id>[],
  fallback: () => Promise<Id | null>,
  threshold = SIMILARITY_THRESHOLD,
): Promise<Id | null> {
  if (candidates.length === 0) return null;
  if (!client) return fallback();
  try {
    const [reportVector, ...candidateVectors] = await client.embed([report.text, ...candidates.map((c) => c.text)]);
    const [top] = rankBySimilarity(
      reportVector,
      candidates.map((item, i) => ({ item, vector: candidateVectors[i] })),
    );
    if (top.score < threshold) return null;
    const verdict = parseVerdict(await client.chat("judge", verdictMessages(report, top.item), 400));
    if (!verdict) return fallback();
    return verdict.same ? top.item.id : null;
  } catch (error) {
    console.error("[bitdeer] duplicate judgment failed, using the same-location heuristic:", error instanceof Error ? error.message : error);
    return fallback();
  }
}

export type BriefInput = { locationLabel: string; category: string; description: string };

export function briefMessages(input: BriefInput): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        `You write task cards for venue staff at a hackathon. Turn the caller's report into ONE instruction of at most ${BRIEF_MAX_WORDS} words that starts with the location and says what is wrong and what to bring or do. ` +
        'Example: "Table 142: outlet dead, bring a power strip". Reply with only the instruction: no quotes, no extra text.',
    },
    { role: "user", content: `Location: ${input.locationLabel}\nCategory: ${input.category}\nCaller said: ${input.description}` },
  ];
}

/** Model output -> a one-line brief of at most 12 words, or null when nothing usable came back. */
export function parseBrief(text: string | null | undefined): string | null {
  if (!text) return null;
  const line = text
    .replace(/```[a-z]*/gi, "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l !== "");
  if (!line) return null;
  const cleaned = line
    .replace(/^(?:brief|instruction|task)\s*:\s*/i, "")
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words.slice(0, BRIEF_MAX_WORDS).join(" ");
}

/** One chat call -> brief. Null (caller keeps the original description) on no client or any failure. */
export async function buildStaffBrief(client: BitdeerClient | null, input: BriefInput): Promise<string | null> {
  if (!client) return null;
  try {
    return parseBrief(await client.chat("brief", briefMessages(input), BRIEF_MAX_TOKENS));
  } catch (error) {
    console.error("[bitdeer] staff brief failed, keeping the original description:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** What the staff card and ops detail show: the brief, or the caller's description. */
export const displayBrief = (incident: { staffBrief?: string; description: string }) =>
  incident.staffBrief?.trim() ? incident.staffBrief : incident.description;
