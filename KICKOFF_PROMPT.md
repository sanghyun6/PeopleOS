Read CLAUDE.md fully first, then data/palace-venue.json (skim structure only).

Set up the project from scratch in this folder:
1. Scaffold Next.js (TypeScript, Tailwind) + Convex, and install react-three-fiber, drei, three.
2. Write the Convex schema (zones, edges, staff, incidents, assignments) and a seed script that derives ~12-20 zones from data/palace-venue.json, builds a simple edge graph between adjacent zones with distances, maps every table/booth/amenity to a zone, and inserts ~8 fake staff.
3. Implement the HTTP action `/cartesia/create_incident` plus dispatch logic (role match -> availability -> workload -> shortest-path distance) and Dijkstra over the zone graph.
4. Build a minimal /ops page with the R3F venue (outline, rooms, tables as boxes, mezzanine raised ~5m, orbit controls) and status-colored incident markers fed by Convex live queries.
5. Build /staff/[id] with accept / decline / complete.

Stop when I can POST a fake incident with curl and see the marker appear, get assigned, and turn green after Complete. Then tell me (in Korean, short) what to wire up next in Cartesia. Do not build advanced features yet.
