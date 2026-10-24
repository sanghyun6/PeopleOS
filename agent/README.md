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
2. Register the four webhook tools (Playground "Tools", or the API with
   `Authorization: Bearer $CARTESIA_API_KEY` and a `Cartesia-Version` header),
   replacing `<CARTESIA_TOOL_SECRET>` with the secret. Attach their ids in `config.tools`.
3. Paste `system-prompt.md` into the agent's instructions. Model: a Claude model from
   `GET /v1/agents/models`.
4. Enable the `end_call` system tool.

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
