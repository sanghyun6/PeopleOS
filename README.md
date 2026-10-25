# PeopleOS — "Every call changes the venue."

Attendees and staff call an AI phone number to report venue problems. A voice agent
pins down the location, creates an incident on a live 3D model of the venue, and
dispatches the best-fit staff member using walking routes (not straight lines).

Built at Cal Hacks 13.0 (Palace of Fine Arts, SF).

## How we use Convex

- Realtime: `/ops`, `/demo` and `/staff/[id]` read Convex with `useQuery`, so incidents, staff and routes update without a refresh.
- Backend: schema with indexes, queries, mutations, actions, and HTTP actions that receive the Cartesia voice tool calls.
- Extras: a full text search index for location lookup and a scheduled function for staff briefs.
- Not used: Convex components, auth, crons, file storage, vector search.
- Details and build log: [hackathon.md](hackathon.md). Repo: https://github.com/sanghyun6/PeopleOS

## Status

| Piece | State |
| --- | --- |
| Next.js + Tailwind + Convex + React Three Fiber scaffold | done |
| Convex schema (`zones`, `edges`, `locations`, `staff`, `incidents`, `assignments`) | done |
| Seed from `data/palace-venue.json`: 18 zones, 27 edges, 406 locations, 8 staff | done |
| Cartesia HTTP actions, dispatch, Dijkstra, staff actions, dedup, blockages, stats | done (curl smoke-tested end to end) |
| `/` | "Who are you?" picker (staff or operator), remembered in localStorage. Demo-level gate only: the operator passcode (`NEXT_PUBLIC_OPS_PASSCODE`, default `calhacks`, or a loaded Venue Pack's passcode checked by a public query) is not real auth. |
| `/demo` | one screen: `/ops` on the left, two staff phones (Priya, Jordan) on the right, all live |
| `/ops` 3D view | live markers, staff dots, assignment routes, incident list, metrics |
| `/staff/[id]` | accept / decline / complete, sound + vibration |
| Dedup judgment | Bitdeer first (`BITDEER_API_KEY`): bge-m3 embeddings rank the candidates, a Bitdeer chat model rules on the top one (3 s budget, 4 s cap on the whole judgment). Any failure, timeout, or missing key falls back to "same table/booth = same problem"; there is no Claude call |
| Staff brief | after an incident is created, a scheduled action asks a Bitdeer chat model for a one-line (<= 12 words) instruction, stored as `incident.staffBrief` and shown on the staff card and ops detail; falls back to the caller's description |
| Voice agent | Cartesia Managed Agent with five webhook tools (`create_incident`, `report_blockage`, `escalate_to_human`, `get_directions`, `venue_search`); see `agent/README.md` |
| Event Q&A | `venue_search` asks a Moss index (2 s limit) and falls back to keyword search over `agent/event-kb.json`; latency and fallbacks shown on `/ops` |
| Web/SMS reporting | backend only: `incidents.reportFromWeb` runs the same pipeline as voice, but no screen calls it yet |
| Other venues | Venue Pack format, loader, generic 3D renderer and `/onboard` wizard; see "Onboarding another venue" |

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
  lib/venuePack.ts Venue Pack schema (zod) + compiler to table rows (pure)
  venuePack.ts     load a pack, venue metadata for the UI and webhooks
agent/             Cartesia Managed Agent: tool schemas, types, prompt, vocabulary
  pack-agent.ts    prompt, guide and tools for a Venue Pack
scripts/venue-load.ts         npm run venue:load (Convex + prompt + Cartesia + Moss)
scripts/export-venue-pack.ts  npm run export:venue-pack (Cal Hacks as a pack)
components/onboard/           /onboard wizard (app/onboard, API in app/api/onboard)
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

## Onboarding another venue ("Bring your own venue")

Labels below: **Works** = built and verified on the sample venue; **Manual** = a person does
it once per venue; **Next step** = not built (the app shows the same badge, never a fake result).

A venue is one **Venue Pack** JSON file (`convex/lib/venuePack.ts`, zod): event info,
1-2 floors (name + height), zones (rectangle or polygon, floor, wall height, kind), walking
edges (walk/stairs, optional waypoints and distance), named locations (table, booth,
amenity, room, area, entrance), staff (name, role, start zone, available/off_duty),
knowledge facts, escalation contacts, and an optional operator passcode.

- `npm run export:venue-pack` writes the live Cal Hacks venue as
  `docs/examples/calhacks-venue-pack.json`. `agent/calhacks-pack.test.ts` proves it compiles
  back to exactly the seeded zones, edges (distances included), 406 locations and 8 staff.
  What the format cannot express for Cal Hacks: real zone polygons (Cal Hacks zones are
  graph nodes, so the export uses each zone's padded bounding box and points
  `geometry.detailed` at the built-in Palace model for tables, chairs and stairs), and the
  hand-written `agent/event-facts.md` guide text (the pack carries `event-kb.json` only).
- `docs/examples/sample-venue-pack.json`: a fictional second venue (Harborview Convention
  Center, 7 zones, two full floors at 0 m and 6 m, 4 staff, 5 facts, its own passcode).

### Steps

1. **Works** Make the pack: `/onboard` (link at the bottom of `/`), or write the JSON.
   Four steps: (1) event and venue name, plus an optional map file (a Venue Pack .json,
   which brings areas, places and the 3D view; without one the venue is a single area and
   staff are picked by role and workload, not walking distance); (2) staff: a name and a
   role picked from five buttons; (3) policy and guideline files (.txt, .md, .html, or
   pasted text) turned into facts by a Bitdeer chat model on the server; (4) passcode,
   download, and a collapsed "Developer setup" checklist (Convex deployment, which keys the
   server sees as yes/no, the load command, the phone number). Keys are never typed into
   the page. The draft is kept in this browser's localStorage.
2. **Manual** Point `.env.local` at a separate Convex deployment, never the Cal Hacks one.
   Quickest: remove `CONVEX_DEPLOYMENT`/`NEXT_PUBLIC_CONVEX_*` from `.env.local`, then
   `CONVEX_AGENT_MODE=anonymous npx convex dev` (local backend on 127.0.0.1:3210/3211).
   The loader refuses `resolute-horse-290` and any `prod:` deployment.
3. **Works** `npm run venue:load -- my-pack.json --site-url https://<public url of that deployment>`
   validates the pack, then (a) replaces zones, edges, locations, staff and incidents on that
   deployment, (b) writes the agent prompt, venue guide and tool bodies to
   `.venue-packs/<event>/` (same builders as `agent/export.ts`), (c) registers a new Cartesia
   agent "PeopleOS - <event>" with `agent/setup-cartesia.mjs` and `SKIP_PHONE=1`, and
   (d) creates the Moss index `venue-<event>` with `scripts/moss-index.ts`.
   Flags: `--dry-run`, `--skip-cartesia`, `--skip-moss`.
4. **Manual** Tools need a public URL: a local deployment can be exposed with
   `ssh -R 80:localhost:3211 nokey@localhost.run` (what we tested).
5. **Manual** Phone number: the loader never provisions or re-points numbers. In the
   Cartesia dashboard, attach a number to the new agent (or test with a web call).
6. **Manual** Moss search for the new index: `MOSS_INDEX=venue-<event> npx tsx scripts/moss-server.ts`
   behind a tunnel, then set `MOSS_SEARCH_URL` on that deployment. Without it, event questions
   use keyword search over the pack's facts.
7. Run the web app against that deployment and reload the page after a load (the venue is
   read once per page load).

### What works on another venue (verified on the sample, local deployment)

- `create_incident` by curl -> location match (exact, table number, alias such as
  "the acme booth") -> auto-dispatch by role, availability, workload and walking distance ->
  marker on `/demo` and `/ops` -> accept and complete from the staff phone -> marker leaves
  the map (resolved count goes up).
- Dedup (report count 1 -> 2), blockage reroute (79 m -> 103.5 m via the other stairs),
  directions with up/down stairs from the zone levels, unknown places rejected,
  escalations without a location pinned to the pack's help desk, event answers from the
  pack's facts, the pack's operator passcode.
- A pack made without a map: one area named after the venue; any place a caller names
  resolves to it (only when the deployment has exactly one area), and dispatch picks by
  role and workload.
- Generic 3D renderer when the pack has no detailed model: zone floors, see-through walls
  at the pack's heights, zone labels, tables/booths/amenities, the pack's floor names on
  the level buttons. Markers, staff dots, routes and drag controls are the same components.

### Not built yet

- **Next step** Floor plan image -> zones automatically. The wizard takes a map file or
  treats the venue as one area; zones are only drawn by editing the pack JSON.
- **Next step** Indoor positioning. Staff positions are zones (start zone, then the last
  completed task).
- **Next step** Several venues in one deployment (multi-tenant). One deployment holds one
  venue; loading a pack replaces the previous venue and its incidents.
- **Next step** Loading from the browser, reading PDF or Word policy files, more than two
  floors, custom staff roles (the five roles and the category -> role map are fixed),
  SMS to staff phones.

## Known limitations

- Zone graph is hand-drawn (in code for Cal Hacks, in `/onboard` for other venues); nothing generates zones from a floor plan yet.
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
