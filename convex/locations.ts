// Fixed location vocabulary (tables 1-304, sponsor booths, amenities, rooms, areas).
import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { locationKind } from "./lib/validators";
import { todo } from "./lib/todo";

/**
 * Resolve what the caller said ("table 142", "the Cartesia booth", "near the fountain")
 * to exactly one location. Order: exact key -> table number -> alias -> search index.
 * Returns null when ambiguous or unknown so the agent asks again.
 */
export const resolve = internalQuery({
  args: { text: v.string() },
  handler: async () => todo("locations.resolve"),
});

/** Vocabulary listing, e.g. for the agent prompt or an ops search box. */
export const list = query({
  args: { kind: v.optional(locationKind) },
  handler: async () => todo("locations.list"),
});
