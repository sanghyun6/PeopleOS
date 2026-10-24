// Which Convex functions are live. Flip a flag to true once its body stops being todo().
// NEXT_PUBLIC_UI_MOCK=1 forces everything to mock data (works with no Convex deployment).
const forceMock = process.env.NEXT_PUBLIC_UI_MOCK === "1";

export const LIVE = {
  /** staff.list/get, incidents.listActive/get, zones.graph (already implemented). */
  core: !forceMock,
  /** assignments.forStaff/accept/decline/complete */
  assignments: false,
  /** incidents.stats */
  stats: false,
  /** blockages.confirm */
  blockages: false,
};
