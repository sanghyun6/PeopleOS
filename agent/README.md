# Voice agent (Cartesia Managed Agents)

Files to paste into Cartesia are generated from code, so the prompt, the tool
schemas, and the `locations` table never drift apart:

```bash
npx tsx agent/export.ts            # default site: https://resolute-horse-290.convex.site
```

- `system-prompt.md`: agent instructions (Playground "Instructions" / `config.instructions`).
- `event-facts.md`: hand-edited event facts (Sleeping Area, ...). Edit this, then re-run the export.
- `venue-guide.md`: generated from the venue data + event facts; appended to the system prompt as "# Venue guide".
- `cartesia-tools.json`: one `POST https://api.cartesia.ai/v1/agents/tools` body per tool.

## Setup

1. Pick a shared secret and set it on Convex: `npx convex env set CARTESIA_TOOL_SECRET <secret>`.
   If it is unset, the webhooks accept any request.
2. Register the five webhook tools (Playground "Tools", or the API with
   `Authorization: Bearer $CARTESIA_API_KEY` and a `Cartesia-Version` header),
   replacing `<CARTESIA_TOOL_SECRET>` with the secret. Attach their ids in `config.tools`.
3. Paste `system-prompt.md` into the agent's instructions. Model: a Claude model from
   `GET /v1/agents/models`.
4. Enable the `end_call` system tool.

## Event questions: `venue_search` (Moss)

Schedule/FAQ/policy facts do not fit in the prompt and change during the event, so the
agent calls `venue_search` (POST `/cartesia/venue_search`, body `{ query, call_id }`). It
queries the Moss cloud index `calhacks-venue` (top 3, hybrid search) and answers
`{ ok, outcome, message, latencyMs }`; outcome is `found`, `no_match`, or `fallback`
(Moss failed or took over 2 s, so a keyword match over `event-kb.json` answered). Every
call's latency is logged in the `retrievals` table and shown on `/ops`.

- `event-kb.json`: event facts (id, title, text, asOf). Edit it, then refresh the index.
- Index: one document per fact plus one per area line of `venue-guide.md`.

```bash
npx tsx scripts/moss-index.ts   # creates the index, or upserts in place and drops removed ids
```

### Search server (required for live Moss answers)

Moss has no server-side query API (the REST API only manages indexes and documents), and
its in-process embedding model cannot load inside Convex actions. So queries run on a small
Node server on your machine, and the Convex action calls it over HTTP. If it is down or slower
than 2 s, venue_search answers from the keyword fallback (outcome `fallback`).
Tradeoff: the demo depends on your laptop and a tunnel being up.

```bash
npx tsx scripts/moss-server.ts                    # loads the index once, serves POST /search on :8787
ssh -R 80:localhost:8787 nokey@localhost.run      # or: cloudflared tunnel --url http://localhost:8787
npx convex env set MOSS_SEARCH_URL https://<tunnel-host>   # the tunnel URL changes on every restart
```

`.env.local` needs `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY` and `MOSS_SEARCH_TOKEN` (any random
string; the server requires it as a bearer token, so set the same value on Convex with
`npx convex env set MOSS_SEARCH_TOKEN <token>`). `MOSS_PROJECT_ID`/`KEY` are also needed on
Convex only if you want to run the indexer from there; `scripts/moss-index.ts` reads `.env.local`.

## Webhook contract

Cartesia POSTs exactly the `request_body_schema` fields (no envelope) to
`/cartesia/<tool>` on the Convex site URL. `call_id` is filled from
`{{system__conversation_id}}` and hidden from the model. The response body is the
tool result the LLM reads: `{ ok, outcome, message, incidentId }`.

```bash
curl -X POST https://resolute-horse-290.convex.site/cartesia/create_incident \
  -H "Authorization: Bearer $CARTESIA_TOOL_SECRET" -H "Content-Type: application/json" \
  -d '{"location":"Table 142","category":"power","description":"Outlet is not working","priority":"medium","call_id":"test-1"}'
```

Status codes: 200 for every business outcome (including `unknown_location`), 400 for a
malformed body, 401 for a bad secret, 500 if the backend throws.
