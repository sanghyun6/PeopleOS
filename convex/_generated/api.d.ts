/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignments from "../assignments.js";
import type * as bitdeer from "../bitdeer.js";
import type * as blockages from "../blockages.js";
import type * as cartesia from "../cartesia.js";
import type * as dedup from "../dedup.js";
import type * as dispatch from "../dispatch.js";
import type * as http from "../http.js";
import type * as incidents from "../incidents.js";
import type * as lib_bitdeer from "../lib/bitdeer.js";
import type * as lib_dedup from "../lib/dedup.js";
import type * as lib_directions from "../lib/directions.js";
import type * as lib_dispatch from "../lib/dispatch.js";
import type * as lib_emergency from "../lib/emergency.js";
import type * as lib_graph from "../lib/graph.js";
import type * as lib_locationText from "../lib/locationText.js";
import type * as lib_todo from "../lib/todo.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_venueData from "../lib/venueData.js";
import type * as lib_zoning from "../lib/zoning.js";
import type * as locations from "../locations.js";
import type * as moss from "../moss.js";
import type * as retrievals from "../retrievals.js";
import type * as seed from "../seed.js";
import type * as staff from "../staff.js";
import type * as zones from "../zones.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  bitdeer: typeof bitdeer;
  blockages: typeof blockages;
  cartesia: typeof cartesia;
  dedup: typeof dedup;
  dispatch: typeof dispatch;
  http: typeof http;
  incidents: typeof incidents;
  "lib/bitdeer": typeof lib_bitdeer;
  "lib/dedup": typeof lib_dedup;
  "lib/directions": typeof lib_directions;
  "lib/dispatch": typeof lib_dispatch;
  "lib/emergency": typeof lib_emergency;
  "lib/graph": typeof lib_graph;
  "lib/locationText": typeof lib_locationText;
  "lib/todo": typeof lib_todo;
  "lib/validators": typeof lib_validators;
  "lib/venueData": typeof lib_venueData;
  "lib/zoning": typeof lib_zoning;
  locations: typeof locations;
  moss: typeof moss;
  retrievals: typeof retrievals;
  seed: typeof seed;
  staff: typeof staff;
  zones: typeof zones;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
