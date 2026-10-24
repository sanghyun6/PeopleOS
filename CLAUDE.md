# PeopleOS — "Every call changes the venue."

Cal Hacks 13.0 project (Oct 23-25, 2026, Palace of Fine Arts, SF). Goal: **win prize tracks**, so a reliable, impressive live demo matters more than breadth.
The user (Sanghyun) prefers **direct, concise replies in Korean**. Code, comments, and commit messages in English.

## What it is
Attendees/staff call an AI phone number to report venue problems. A voice agent clarifies the location, creates an incident on a **live 3D model of the real venue**, auto-dispatches the best-fit staff member (spatially aware), and tracks it to completion.

Pitch evidence (real data from the Cal Hacks Slack, last night): outlet-broken report got no reply; "are there cups at water stations" took ~3h to answer; wired ethernet outage got a reply after 76 min ("hardline team out until morning, use another table"); a lights request took 4 back-and-forth messages just to pin down location; wifi complaints were scattered across 10+ messages in several channels. Existing stadium text-line dispatch systems (GuestAssist, ISS) prove the demand; our difference is AI voice + spatial dispatch + automatic dedup. Mention this honestly in the pitch.

## Demo script (2 min, demo first)
1. Call: "Table 142's outlet isn't working" -> agent confirms location once -> marker appears on 3D venue.
2. Nearest eligible staff (facilities) is assigned; route drawn on 3D; staff phone buzzes; accepts.
3. Second call: "Hallway near Gate 3/4 is blocked" -> operator confirms -> **assignment changes to a different staff member and a new route is drawn** (THE key scene: proves 3D is not decoration).
4. Third call with same outlet issue -> no new task; report count 1 -> 2 (dedup).
5. Staff taps Complete -> marker turns green. Dashboard shows avg time-to-acknowledge.
Must have: recorded backup video + SMS/web-call fallback in case phone/wifi dies.

## MUST build (in this order)
1. **Convex backend**: tables `zones`, `edges`, `staff`, `incidents`, `assignments`; HTTP action that receives Cartesia tool calls.
2. **Voice agent**: Cartesia Managed Agents (NOT the Line SDK; it is being shut down Dec 1) + Claude as LLM if selectable. Tools: `create_incident(location, category, description, priority)`, `report_blockage`, `escalate_to_human`. Location must be one of a fixed vocabulary (table numbers 1-304, sponsor booth names, named areas); agent asks ONE confirmation question ("Table 142 on the main floor, right?").
3. **Emergency rule**: injury/medical/fire/safety keywords -> do NOT auto-dispatch; escalate to a human operator immediately. (Responsible-design points for Microsoft/Cartesia/Anthropic tracks.)
4. **Auto dispatch**: score = role match -> availability -> current workload -> path distance (graph shortest path, not straight line).
5. **3D venue (React Three Fiber)** built from `data/palace-venue.json` (see below): status-colored incident markers (red/yellow/green), staff dots, route lines, click marker -> detail panel (transcript, status, assignee).
6. **Staff mobile web page** `/staff/[id]`: accept / decline / complete, sound + vibration on new assignment.
7. **Ops dashboard** `/ops`: 3D + incident list + staff status + avg time-to-acknowledge.
8. **Blockage-aware rerouting** (demo highlight): disable an edge after operator confirmation, recompute routes, reassign if needed.
9. **Duplicate detection**: same zone + same category + last 15 min -> Claude judges "same problem?" -> increment report count.
10. Submission: README (setup, Cartesia features used, known limitations), backup demo video, Devpost.

## Cheap add-ons for extra tracks (after the core flow works end to end)
- **Moss**: resolve location aliases ("near the Bright Data booth", "past the MLH tables") -> zone id; retrieve past incidents for dedup candidates. Credits code `CALHACKS`.
- **Bitdeer AI Model Studio**: run ONE small task (category/priority classification) on a Bitdeer model.
- **GoDaddy domain** + **MLH Commit Fellowship** checkbox/form at submission.
- **Figma**: design ops dashboard + staff screen with Figma Make first; keep a stage log (which Figma product, why, <=200 words/stage); needs Figma Slides + <3 min demo video + public Figma files + edu-verified accounts.
- Optional if time: Elastic Agent Builder (operator Q&A: "open incidents on mezzanine?"), timeout-based auto-reassignment (demo with a Decline button instead), clustering.
Skip: Apify, Gemini, Vultr, Tiger Data, Fetch.ai, Factory, finance tracks (forced fits).

## Target tracks (order if submission count is limited)
Cartesia -> Moss -> Figma -> Bitdeer -> Convex -> Elastic -> Anthropic (Claude for Public Benefit: community = hackathon attendees/organizers) -> Microsoft (Built for the Real World) -> Cal Hacks Overall/Technical/Hacker's Choice.
Cartesia judging (25% each): problem/originality, use of Cartesia, execution, impact & responsibility; voice must be core; 2-min demo-first presentation.
Unconfirmed: max number of tracks per project; submission deadline (assume Sunday morning). Ask in #0-ask-directors.

## Tech stack
Next.js + TypeScript + Tailwind, React Three Fiber + drei, Convex (realtime DB, HTTP actions, scheduler), Cartesia Managed Agents (voice + phone number + tool calls), Claude API (extraction, dedup judgment), Vercel. Env vars go in `.env.local` (never commit keys): `CARTESIA_API_KEY`, `ANTHROPIC_API_KEY`, `CONVEX_*`.

## Venue data: `data/palace-venue.json`
Extracted from the organizers' map (https://palace-interior.vercel.app, same one inside hive.hackberkeley.org/venue-map). Credit it in README. Units ~meters on an x/z ground plane. Contents: `outline` (building polygon), `rooms` (22 polygons: Theater, Gate #3/#4, Restrooms, Green Rooms, Box Office...), `hackerTables` (304 tables: `n`, `level` main|mezz, `at{x,z}`, `rotY`; w=2.55,h=1.75 approx), `sponsors` (46 booths), `amenities` (Stage, Fountain, Food, Luggage, Gate #6, Claude's Corner, 3D printers, Hardware+merch), `labels` (Atrium, Pavilion, Broadway #1-3...), `entrances`, `geometry` (mezz walls/doors, service tables, check-in tables). 41 tables + Asus/MLH/Seeed booths are on the mezzanine (height is not in the data; use ~5 m).
Note: the organizers' map can be embedded via iframe (`?view=3d&embed=1`, postMessage `{type:"hive-venue-focus", focus:"142"}`) but we cannot draw markers/routes inside it. Use it only as a backup; render our own R3F scene from the JSON. We asked/should ask organizers for source; if received, fork it instead.
Derive `zones` by grouping tables/booths/rooms spatially (~12-20 zones), and `edges` between adjacent zones with distances; keep it simple.

## Staff roles (seed ~8 people, fake names)
network (wired/wifi), facilities (power/tables/lights), supplies (water/food/cups), guest services (lost & found, bags), ops lead (escalations).

## Rules for working here
- Get the **end-to-end thin slice** working first (call -> Convex row -> marker -> staff accept -> complete). Do not add features before that works.
- Never block on perfection: if a piece is risky (phone number integration), keep a browser web-call fallback.
- Keep the repo runnable at all times; small commits; README stays current.
- Feature freeze 5 hours before the deadline; bug fixes only after that.
