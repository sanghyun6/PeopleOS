# PeopleOS — "Every call changes the venue."

Attendees and staff call an AI phone number to report venue problems. A voice agent
pins down the location, creates an incident on a live 3D model of the venue, and
dispatches the best-fit staff member using walking routes (not straight lines).

Built at Cal Hacks 13.0 (Palace of Fine Arts, SF).

## Status

| Piece | State |
| --- | --- |
| Next.js + Tailwind + Convex + React Three Fiber scaffold | done |
| Convex schema (`zones`, `edges`, `locations`, `staff`, `incidents`, `assignments`) | done |
| Seed from `data/palace-venue.json`: 18 zones, 27 edges, 406 locations, 8 staff | done |
| Cartesia HTTP actions, dispatch, Dijkstra, staff actions, dedup, blockages, stats | done (curl smoke-tested end to end) |
| `/` | "Who are you?" picker (staff or operator), remembered in localStorage. Demo-level gate only: the operator passcode (`NEXT_PUBLIC_OPS_PASSCODE`, default `calhacks`) ships in the client bundle, so this is not real auth. |
| `/demo` | one screen: `/ops` on the left, two staff phones (Priya, Jordan) on the right, all live |
| `/ops` 3D view | live markers, staff dots, assignment routes, incident list, metrics |
| `/staff/[id]` | accept / decline / complete, sound + vibration |
| Dedup judgment | Bitdeer first (`BITDEER_API_KEY`): bge-m3 embeddings rank the candidates, a Bitdeer chat model rules on the top one (3 s budget, 4 s cap on the whole judgment). Any failure, timeout, or missing key falls back to "same table/booth = same problem"; there is no Claude call |
| Staff brief | after an incident is created, a scheduled action asks a Bitdeer chat model for a one-line (<= 12 words) instruction, stored as `incident.staffBrief` and shown on the staff card and ops detail; falls back to the caller's description |
| Voice agent | Cartesia Managed Agent with five webhook tools (`create_incident`, `report_blockage`, `escalate_to_human`, `get_directions`, `venue_search`); see `agent/README.md` |
| Event Q&A | `venue_search` asks a Moss index (2 s limit) and falls back to keyword search over `agent/event-kb.json`; latency and fallbacks shown on `/ops` |
| Web/SMS reporting | backend only: `incidents.reportFromWeb` runs the same pipeline as voice, but no screen calls it yet |

## Setup

```bash
npm install
npx convex dev          # first run: log in and create/link a project; writes .env.local
npm run seed            # in another terminal, once
npm run dev             # http://localhost:3000/ops
```

`npm run reseed` wipes every table (including incidents) and seeds again.
`npm run typecheck` checks both the Next app and `convex/`. `npm test` runs the vitest unit tests.

Convex deployment env vars (`npx convex env set`): `CARTESIA_TOOL_SECRET` (Bearer token
Cartesia tools send), `BITDEER_API_KEY`
(dedup judgment + staff briefs; optional `BITDEER_CHAT_MODEL`, default
`deepseek-ai/DeepSeek-V4.1-Flash`; embeddings use `BAAI/bge-m3`), `MOSS_SEARCH_URL` and
`MOSS_SEARCH_TOKEN` (event Q&A search server; `scripts/demo-up.sh` sets the URL).

Env vars live in `.env.local` (never committed): `CONVEX_DEPLOYMENT`,
`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `CARTESIA_API_KEY` (agent setup
only), `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `MOSS_SEARCH_TOKEN`.

## Layout

```
convex/            backend
  schema.ts        tables + indexes
  seed.ts          seedAll: zones, edges, locations, staff
  lib/zoning.ts    zone/edge/location derivation from the venue JSON (pure)
  lib/graph.ts     Dijkstra over the zone graph
  lib/emergency.ts emergency rule (never auto-dispatch injuries/fire/safety)
  incidents.ts     report pipeline, live lists, stats
  dispatch.ts      role -> availability -> workload -> path distance
  assignments.ts   accept / decline / complete
  blockages.ts     auto-applied blockages (+ undo) -> reroute
  dedup.ts         same zone + category within 15 min -> Bitdeer judges (same-table heuristic fallback)
  bitdeer.ts       Bitdeer call log + ops stat, staff-brief action
  lib/bitdeer.ts   Bitdeer client, cosine ranking, verdict/brief parsers (pure)
  cartesia.ts      HTTP actions for agent tools (routed in http.ts)
agent/             Cartesia Managed Agent: tool schemas, types, prompt, vocabulary
components/venue/  R3F scene, floor, markers, staff dots, route lines
app/ops            ops dashboard (+ blockage banner with Undo)
app/demo           split screen: ops + two staff phones
app/staff          staff phone pages (UI in components/staff)
data/              venue map data
```

## Venue model

Zones are hand-placed graph nodes (`convex/lib/zoning.ts`); every table, booth,
amenity, room, area label, and entrance maps to the nearest zone on the same level
(rooms use explicit mapping). Edge distances are polyline lengths through door/stair
waypoints, plus 15 m for stairs. Mezzanine is rendered at 5 m.

HTTP actions: `GET /health`, `POST /cartesia/create_incident`,
`/cartesia/report_blockage`, `/cartesia/escalate_to_human`, `/cartesia/get_directions`,
`/cartesia/venue_search` on the Convex site URL.

## Cartesia features used

- Managed Agents API, driven by `agent/setup-cartesia.mjs`: webhook tools, the agent
  (Claude model, instructions, initial message), and a provisioned phone number.
- Five webhook tools (`agent/tools.ts`): immediate execution, 15 s response timeout,
  bearer auth, `call_id` filled from `{{system__conversation_id}}` and hidden from the model.
- Speech input keyterms (venue words such as "mezzanine", "Broadway") and noise suppression.
- `end_call` system tool.

## Onboarding another venue

The dispatch, routing, dedup, and emergency code has no venue names in it. A venue is data:

1. Venue geometry in the shape of `data/palace-venue.json` (tables, booths, amenities,
   rooms, labels, entrances).
2. Zones and walkable edges in `convex/lib/zoning.ts` (`ZONES`, `EDGES` with door/stair
   waypoints, `ROOMS`, `AMENITY_ALIASES`). Drawn by hand today: 18 zones and 27 edges here.
3. Staff roster in `convex/seed.ts`, then `npm run reseed`.
4. Event facts in `agent/event-kb.json` and `agent/event-facts.md`, then
   `npx tsx scripts/moss-index.ts`.
5. `npx tsx agent/export.ts` regenerates the location vocabulary, venue guide, system
   prompt, and tool definitions; `agent/setup-cartesia.mjs` registers them.

Still hard-coded for Cal Hacks: the agent's identity line (`agent/prompt.ts`), the
escalation fallback location and failure message (`convex/cartesia.ts`), the Moss index
name (`agent/venue-search.ts`), and the greeting and keyterms in `agent/setup-cartesia.mjs`.

## Known limitations

- Zone graph is hand-drawn; nothing generates zones from a floor plan yet.
- Staff location is zone-level and only updates when a task is completed. No live tracking.
- Unanswered offers stay offered: no timeout re-dispatch. Decline re-dispatches immediately.
- Escalations show red on `/ops` but do not page the ops lead.
- Blockage reports apply immediately with no operator confirmation (`/ops` has Undo).
- The voice agent cannot look up an incident's status after the call.
- No web/SMS reporting screen yet, so the phone line is the only reporting channel.
- Moss queries run on a local server behind a public tunnel; if it is down, event
  questions are answered by keyword search.
- Mutations from staff and ops pages are not authenticated; the operator passcode is a
  client-side gate.
- Staff alert sound needs one tap first (browser policy); iOS Safari does not vibrate.

## Credits

Venue geometry extracted from the Cal Hacks organizers' map,
[palace-interior.vercel.app](https://palace-interior.vercel.app)
(also embedded at hive.hackberkeley.org/venue-map).
