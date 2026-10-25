import { afterEach, describe, expect, test, vi } from "vitest";
import {
  BRIEF_MAX_WORDS,
  buildStaffBrief,
  cosineSimilarity,
  createBitdeerClient,
  displayBrief,
  judgeDuplicateWithBitdeer,
  parseBrief,
  parseChatContent,
  parseEmbeddings,
  parseVerdict,
  rankBySimilarity,
  type BitdeerCall,
  type BitdeerClient,
} from "./bitdeer";

afterEach(() => vi.restoreAllMocks());

describe("cosine ranking", () => {
  test("identical vectors score 1, orthogonal 0, opposite -1", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  test("zero vectors and length mismatches score 0 instead of NaN", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  test("ranks best first and keeps input order on ties", () => {
    const ranked = rankBySimilarity(
      [1, 0],
      [
        { item: "far", vector: [0, 1] },
        { item: "near", vector: [1, 0.1] },
        { item: "tie-a", vector: [1, 1] },
        { item: "tie-b", vector: [2, 2] },
      ],
    );
    expect(ranked.map((r) => r.item)).toEqual(["near", "tie-a", "tie-b", "far"]);
  });
});

describe("parseVerdict", () => {
  test("plain JSON", () => {
    expect(parseVerdict('{"same": true, "reason": "same outlet"}')).toEqual({ same: true, reason: "same outlet" });
  });

  test("code fences and prose around the JSON", () => {
    expect(parseVerdict('```json\n{"same": false, "reason": "different table"}\n```')).toEqual({
      same: false,
      reason: "different table",
    });
    expect(parseVerdict('Sure! Here you go: {"same": true, "reason": "x"} Hope that helps.')?.same).toBe(true);
  });

  test("missing reason becomes an empty string", () => {
    expect(parseVerdict('{"same": false}')).toEqual({ same: false, reason: "" });
  });

  test("rejects non-boolean, non-JSON, and non-object output", () => {
    expect(parseVerdict('{"same": "yes"}')).toBeNull();
    expect(parseVerdict("yes, same problem")).toBeNull();
    expect(parseVerdict("[true]")).toBeNull();
    expect(parseVerdict("")).toBeNull();
    expect(parseVerdict("{not json}")).toBeNull();
  });
});

describe("response parsing", () => {
  test("embeddings come back in input order even if the server shuffles them", () => {
    const body = { data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] };
    expect(parseEmbeddings(body, 2)).toEqual([[1, 0], [0, 1]]);
  });

  test("embeddings reject wrong counts and bad vectors", () => {
    expect(() => parseEmbeddings({ data: [{ embedding: [1] }] }, 2)).toThrow();
    expect(() => parseEmbeddings({ data: [{ embedding: ["a"] }] }, 1)).toThrow();
    expect(() => parseEmbeddings({ data: [{ embedding: [] }] }, 1)).toThrow();
    expect(() => parseEmbeddings(null, 1)).toThrow();
  });

  test("chat content", () => {
    expect(parseChatContent({ choices: [{ message: { content: "hi" } }] })).toBe("hi");
    expect(() => parseChatContent({ choices: [{ message: { content: "  " } }] })).toThrow();
    expect(() => parseChatContent({ choices: [] })).toThrow();
    expect(() => parseChatContent({})).toThrow();
  });
});

describe("staff brief builder", () => {
  test("keeps a short instruction as is, stripping quotes", () => {
    expect(parseBrief('"Table 142: outlet dead, bring a power strip"')).toBe("Table 142: outlet dead, bring a power strip");
  });

  test("truncates to 12 words", () => {
    const long = "Table 142: the outlet is completely dead and the attendee has a laptop at one percent please hurry";
    const brief = parseBrief(long)!;
    expect(brief.split(" ")).toHaveLength(BRIEF_MAX_WORDS);
    expect(brief.startsWith("Table 142: the outlet")).toBe(true);
  });

  test("takes the first line, drops fences and a label prefix", () => {
    expect(parseBrief("```\nBrief: Gate 3: clear pallet from hallway\nextra commentary\n```")).toBe("Gate 3: clear pallet from hallway");
  });

  test("nothing usable -> null", () => {
    expect(parseBrief("")).toBeNull();
    expect(parseBrief("   \n ")).toBeNull();
    expect(parseBrief('""')).toBeNull();
    expect(parseBrief(null)).toBeNull();
  });

  test("buildStaffBrief returns the cleaned model output", async () => {
    const client: BitdeerClient = { embed: vi.fn(), chat: vi.fn().mockResolvedValue("Table 142: outlet dead, bring a power strip\n") };
    const brief = await buildStaffBrief(client, { locationLabel: "Table 142", category: "power", description: "outlet is broken" });
    expect(brief).toBe("Table 142: outlet dead, bring a power strip");
    const [kind, messages] = vi.mocked(client.chat).mock.calls[0];
    expect(kind).toBe("brief");
    expect(messages[1].content).toContain("Table 142");
  });

  test("falls back to null on no client, thrown errors, or unusable output", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const input = { locationLabel: "Table 142", category: "power", description: "outlet is broken" };
    expect(await buildStaffBrief(null, input)).toBeNull();
    expect(await buildStaffBrief({ embed: vi.fn(), chat: vi.fn().mockRejectedValue(new Error("boom")) }, input)).toBeNull();
    expect(await buildStaffBrief({ embed: vi.fn(), chat: vi.fn().mockResolvedValue("  ") }, input)).toBeNull();
  });

  test("displayBrief falls back to the original description", () => {
    expect(displayBrief({ description: "outlet dead", staffBrief: "Table 142: bring a power strip" })).toBe("Table 142: bring a power strip");
    expect(displayBrief({ description: "outlet dead" })).toBe("outlet dead");
    expect(displayBrief({ description: "outlet dead", staffBrief: "  " })).toBe("outlet dead");
  });
});

describe("judgeDuplicateWithBitdeer", () => {
  const report = { text: "Table 142 outlet isn't working", locationLabel: "Table 142" };
  const candidates = [
    { id: "wifi", text: "wifi is slow", locationLabel: "Table 140" },
    { id: "outlet", text: "outlet dead at table 142", locationLabel: "Table 142" },
  ];
  // report ~ outlet (cos .99), report ~ wifi (cos 0)
  const vectors = [[1, 0], [0, 1], [1, 0.1]];
  const fallback = vi.fn();

  const clientWith = (chat: BitdeerClient["chat"], embed?: BitdeerClient["embed"]): BitdeerClient => ({
    embed: embed ?? vi.fn().mockResolvedValue(vectors),
    chat,
  });
  const verdict = (same: boolean) => vi.fn().mockResolvedValue(JSON.stringify({ same, reason: "r" }));

  afterEach(() => fallback.mockReset());

  test("asks the chat model about the top-ranked candidate only", async () => {
    const chat = verdict(true);
    const result = await judgeDuplicateWithBitdeer(clientWith(chat), report, candidates, fallback);
    expect(result).toBe("outlet");
    expect(chat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(chat).mock.calls[0][1][1].content).toContain("outlet dead at table 142");
    expect(fallback).not.toHaveBeenCalled();
  });

  test("a 'not the same' verdict means no duplicate", async () => {
    expect(await judgeDuplicateWithBitdeer(clientWith(verdict(false)), report, candidates, fallback)).toBeNull();
    expect(fallback).not.toHaveBeenCalled();
  });

  test("below the similarity threshold: not a duplicate, and no chat call", async () => {
    const chat = verdict(true);
    const dissimilar = vi.fn().mockResolvedValue([[1, 0], [0, 1], [0.2, 1]]);
    expect(await judgeDuplicateWithBitdeer(clientWith(chat, dissimilar), report, candidates, fallback)).toBeNull();
    expect(chat).not.toHaveBeenCalled();
  });

  test("embeds the report and every candidate in one request", async () => {
    const embed = vi.fn().mockResolvedValue(vectors);
    await judgeDuplicateWithBitdeer(clientWith(verdict(true), embed), report, candidates, fallback);
    expect(embed).toHaveBeenCalledOnce();
    expect(embed.mock.calls[0][0]).toEqual([report.text, "wifi is slow", "outlet dead at table 142"]);
  });

  test("no candidates -> null without touching the client or fallback", async () => {
    const embed = vi.fn();
    expect(await judgeDuplicateWithBitdeer(clientWith(verdict(true), embed), report, [], fallback)).toBeNull();
    expect(embed).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  describe("falls back to the previous judge", () => {
    test("no API key", async () => {
      fallback.mockResolvedValue("wifi");
      expect(await judgeDuplicateWithBitdeer(null, report, candidates, fallback)).toBe("wifi");
    });

    test("embedding request fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      fallback.mockResolvedValue(null);
      const embed = vi.fn().mockRejectedValue(new Error("timeout"));
      expect(await judgeDuplicateWithBitdeer(clientWith(verdict(true), embed), report, candidates, fallback)).toBeNull();
      expect(fallback).toHaveBeenCalledOnce();
    });

    test("chat request fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      fallback.mockResolvedValue("outlet");
      const chat = vi.fn().mockRejectedValue(new Error("503"));
      expect(await judgeDuplicateWithBitdeer(clientWith(chat), report, candidates, fallback)).toBe("outlet");
    });

    test("verdict is not valid JSON", async () => {
      fallback.mockResolvedValue("outlet");
      const chat = vi.fn().mockResolvedValue("I think they are the same.");
      expect(await judgeDuplicateWithBitdeer(clientWith(chat), report, candidates, fallback)).toBe("outlet");
    });

    test("embedding count does not match the candidates", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      fallback.mockResolvedValue(null);
      const embed = vi.fn().mockResolvedValue([[1, 0]]);
      expect(await judgeDuplicateWithBitdeer(clientWith(verdict(true), embed), report, candidates, fallback)).toBeNull();
      expect(fallback).toHaveBeenCalledOnce();
    });
  });
});

describe("createBitdeerClient (fetch injected, no network)", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  test("sends Bearer auth and the documented request shapes, and reports each call", async () => {
    const calls: BitdeerCall[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: [{ index: 0, embedding: [1, 0] }] }))
      .mockResolvedValueOnce(ok({ choices: [{ message: { content: "hello" } }] }));
    const client = createBitdeerClient({
      apiKey: "test-key",
      deadline: Date.now() + 5_000,
      onCall: (c) => calls.push(c),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await client.embed(["a"])).toEqual([[1, 0]]);
    expect(await client.chat("brief", [{ role: "user", content: "hi" }], 50)).toBe("hello");

    const [embedUrl, embedInit] = fetchImpl.mock.calls[0];
    expect(embedUrl).toBe("https://api-inference.bitdeer.ai/v1/embeddings");
    expect(embedInit.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(embedInit.body)).toEqual({ model: "BAAI/bge-m3", input: ["a"], encoding_format: "float" });
    const [chatUrl, chatInit] = fetchImpl.mock.calls[1];
    expect(chatUrl).toBe("https://api-inference.bitdeer.ai/v1/chat/completions");
    expect(JSON.parse(chatInit.body)).toMatchObject({ model: "deepseek-ai/DeepSeek-V4.1-Flash", max_tokens: 50, temperature: 0 });
    expect(calls.map((c) => [c.kind, c.ok])).toEqual([["embedding", true], ["brief", true]]);
    expect(calls[1].model).toBe("deepseek-ai/DeepSeek-V4.1-Flash");
  });

  test("HTTP errors throw and are logged as not ok", async () => {
    const calls: BitdeerCall[] = [];
    const client = createBitdeerClient({
      apiKey: "k",
      deadline: Date.now() + 5_000,
      onCall: (c) => calls.push(c),
      fetchImpl: vi.fn().mockResolvedValue(new Response("nope", { status: 429 })) as unknown as typeof fetch,
    });
    await expect(client.chat("judge", [], 10)).rejects.toThrow("429");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: "judge", ok: false });
  });

  test("an exhausted deadline fails without sending a request", async () => {
    const fetchImpl = vi.fn();
    const calls: BitdeerCall[] = [];
    const client = createBitdeerClient({
      apiKey: "k",
      deadline: Date.now() - 1,
      onCall: (c) => calls.push(c),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.embed(["a"])).rejects.toThrow("budget");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(calls[0].ok).toBe(false);
  });
});
