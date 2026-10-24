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
| Claude dedup judgment | needs `ANTHROPIC_API_KEY` on the Convex deployment; without it, same table/booth = same problem |

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
Cartesia tools send), `ANTHROPIC_API_KEY` (dedup judgment).

Env vars live in `.env.local` (never committed): `CONVEX_DEPLOYMENT`,
`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and later
`CARTESIA_API_KEY`, `ANTHROPIC_API_KEY`.

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
  dedup.ts         same zone + category within 15 min -> Claude judges
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
`/cartesia/report_blockage`, `/cartesia/escalate_to_human` on the Convex site URL.

## Credits

Venue geometry extracted from the Cal Hacks organizers' map,
[palace-interior.vercel.app](https://palace-interior.vercel.app)
(also embedded at hive.hackberkeley.org/venue-map).
