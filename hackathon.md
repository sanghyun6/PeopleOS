# Hackathon log

- **Project:** PeopleOS
- **Event:** Cal Hacks 13.0
- **What it does:** Voice calls to an AI agent become located incidents on a live 3D venue map, auto-dispatched to the nearest eligible staff member.
- **Live app:** not deployed
- **Repo:** https://github.com/sanghyun6/PeopleOS
- **Frontend:** not deployed
- **Convex deployment:** https://resolute-horse-290.convex.cloud
- **Components:** none
- **Convex features:** schema, indexes, full text search, queries, mutations, actions, HTTP actions, scheduled functions, realtime useQuery
- **Auth:** none
- **AI models:** BAAI/bge-m3, deepseek-ai/DeepSeek-V4.1-Flash
- **Started:** 2026-10-24T10:23:06Z
- **Last updated:** 2026-10-25T16:55:00Z

## How we use Convex

- Live ops map: incident markers, staff dots and routes come from `useQuery` on `incidents.listActive`, `assignments.listActive`, `zones.graph` (`components/ui/hooks.ts`). `/ops`, `/demo` and `/staff/[id]` update without a refresh.
- Voice to incident: Cartesia tool calls hit HTTP actions such as `/cartesia/create_incident` (`convex/http.ts`, `convex/cartesia.ts`).
- Staff phone: accept/decline/complete are mutations that every open screen sees at once (`convex/assignments.ts`).
- Duplicate check and staff brief: an action judges duplicates, and `ctx.scheduler.runAfter` queues the brief (`convex/incidents.ts`, `convex/dedup.ts`).
- Location lookup: full text `search_text` index on `locations` (`convex/schema.ts`, `convex/locations.ts`).
- Blockages: applied edges and undo are live in the ops banner (`convex/blockages.ts`).

## Log

- 10-24 `09b6626` Scaffold Next.js, Convex schema, venue seed (`convex/schema.ts`)
- 10-24 `dba9130` Pure dispatch logic + tests (`convex/lib/`)
- 10-24 `7db8f3b` Cartesia webhook tools (`convex/cartesia.ts`, `agent/`)
- 10-24 `240a154` R3F venue scene (`components/venue/`)
- 10-24 `b9fcef3` Report pipeline, dispatch, staff actions, blockages (`convex/incidents.ts`, `assignments.ts`, `blockages.ts`)
- 10-24 `f15a8f0` get_directions tool (`convex/lib/directions.ts`)
- 10-24 `c514426` Entry screen, auto blockages, /demo (`app/demo/`)
- 10-24 `0014c1a` venue_search endpoint, retrievals table (`convex/moss.ts`, `schema.ts`)
- 10-24 `ee6dd7a` Bitdeer dedup judgment + staff brief via scheduler (`convex/bitdeer.ts`, `dedup.ts`)
- 10-25 `332fc4c` Ops dashboard restyle (`app/ops/`)
- 10-25 `635b7e8` Venue Pack schema (`convex/lib/venuePack.ts`, `seed.ts`)
- 10-25 `fbea06b` /onboard wizard (`components/onboard/`)
- 10-25 `8762aba` Onboard / Demo / Ops tab bar (`components/ui/TabBar.tsx`)
- 10-25 `7cf05ea` Pick staff phones on /demo (`app/demo/page.tsx`)
