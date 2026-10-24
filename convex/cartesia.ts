// HTTP actions called by Cartesia agent tools. Routed in http.ts.
// Cartesia webhook tools POST the JSON described by each tool's request_body_schema
// (agent/tools.ts): the model-filled params plus `call_id` from
// {{system__conversation_id}}. There is no envelope and no transcript.
// The response body (text) is handed to the LLM as the tool result, so every
// business outcome is a 200 with a `message` the agent can say.
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ToolArgs, ToolCall, ToolName, ToolResult } from "../agent/types";
import { CALL_ID_FIELD } from "../agent/tools";
import {
  incidentCategory,
  priority,
  type IncidentCategory,
  type Priority,
} from "./lib/validators";
import type { ReportOutcome } from "./incidents";

const json = (status: number, body: ToolResult) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const CATEGORIES = new Set<string>(incidentCategory.members.map((m) => m.value));
const PRIORITIES = new Set<string>(priority.members.map((m) => m.value));

/** Where an escalation lands on the map when the caller could not say where they are. */
const ESCALATION_FALLBACK_LOCATION = "zone:box-office";

export class ToolCallError extends Error {}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new ToolCallError(`"${field}" must be a string`);
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = optionalString(body, field);
  if (value === undefined) throw new ToolCallError(`"${field}" is required`);
  return value;
}

// LLMs sometimes send "Lost & Found" or "HIGH"; fall back instead of failing the call.
const normalizeEnum = (value: string | undefined) => value?.toLowerCase().replace(/[^a-z]+/g, "_");

function category(body: Record<string, unknown>): IncidentCategory {
  const value = normalizeEnum(optionalString(body, "category"));
  return value && CATEGORIES.has(value) ? (value as IncidentCategory) : "other";
}

function priorityOf(body: Record<string, unknown>): Priority {
  const value = normalizeEnum(optionalString(body, "priority"));
  return value && PRIORITIES.has(value) ? (value as Priority) : "medium";
}

/**
 * Validate the webhook body and normalize it to a ToolCall.
 * Throws ToolCallError (-> HTTP 400) when a required field is missing.
 */
export function parseToolCall<N extends ToolName>(tool: N, body: unknown): ToolCall<N> {
  if (!isRecord(body)) throw new ToolCallError("body must be a JSON object");
  const parsers: { [K in ToolName]: () => ToolArgs[K] } = {
    create_incident: () => ({
      location: requiredString(body, "location"),
      category: category(body),
      description: requiredString(body, "description"),
      priority: priorityOf(body),
    }),
    report_blockage: () => ({
      location: requiredString(body, "location"),
      description: requiredString(body, "description"),
    }),
    get_directions: () => ({
      from: requiredString(body, "from"),
      to: requiredString(body, "to"),
    }),
    escalate_to_human: () => ({
      reason: requiredString(body, "reason"),
      location: optionalString(body, "location"),
      description: optionalString(body, "description"),
    }),
  };
  return { tool, args: parsers[tool](), callId: optionalString(body, CALL_ID_FIELD) };
}

/**
 * Reject requests without our shared secret. Cartesia sends it as
 * `Authorization: Bearer <secret>` (tool `api_schema.authentication`).
 * If CARTESIA_TOOL_SECRET is not set on the deployment, every request is allowed.
 */
export function isAuthorized(request: Request): boolean {
  const secret = process.env.CARTESIA_TOOL_SECRET;
  if (!secret) return true;
  return request.headers.get("Authorization") === `Bearer ${secret}`;
}

/** Shared envelope: auth, JSON parse, validation, logging, and failure responses. */
function toolHandler<N extends ToolName>(tool: N, run: (ctx: ActionCtx, call: ToolCall<N>) => Promise<ToolResult>) {
  return httpAction(async (ctx, request) => {
    if (!isAuthorized(request)) return json(401, { ok: false, message: "unauthorized" });

    let call: ToolCall<N>;
    try {
      call = parseToolCall(tool, await request.json());
    } catch (error) {
      const reason = error instanceof ToolCallError ? error.message : "body must be valid JSON";
      return json(400, { ok: false, message: `Invalid ${tool} call: ${reason}. Fix the arguments and call again.` });
    }

    console.log(`[cartesia] ${tool}`, JSON.stringify(call));
    try {
      return json(200, await run(ctx, call));
    } catch (error) {
      console.error(`[cartesia] ${tool} failed`, error);
      return json(500, {
        ok: false,
        message:
          "The report could not be logged. Tell the caller to find the nearest Cal Hacks staff member or the check-in desk at the Box Office.",
      });
    }
  });
}

const fromOutcome = (outcome: ReportOutcome): ToolResult => ({
  ok: outcome.outcome !== "unknown_location",
  outcome: outcome.outcome,
  message: outcome.message,
  incidentId: outcome.incidentId ?? undefined,
});

/** create_incident -> incidents.createFromReport (emergency rule, dedup, dispatch). */
export const createIncident = toolHandler("create_incident", async (ctx, { args, callId }): Promise<ToolResult> => {
  const outcome: ReportOutcome = await ctx.runAction(internal.incidents.createFromReport, {
    ...args,
    source: "voice",
    callId,
  });
  return fromOutcome(outcome);
});

/** report_blockage -> edges closed and open tasks rerouted right away. */
export const reportBlockage = toolHandler("report_blockage", async (ctx, { args, callId }): Promise<ToolResult> => {
  const outcome: ReportOutcome = await ctx.runAction(internal.incidents.createFromReport, {
    location: args.location,
    category: "blockage",
    description: args.description,
    priority: "high",
    source: "voice",
    callId,
  });
  return fromOutcome(outcome);
});

const MEDICAL = /hurt|injur|bleed|faint|unconscious|breath|chest|seizure|allerg|sick|medical|ambulance/i;
const SAFETY = /fire|smoke|burn|spark|shock|gas|fight|weapon|gun|knife|threat|harass|unsafe|danger/i;

function escalationCategory(text: string): IncidentCategory {
  if (MEDICAL.test(text)) return "medical";
  if (SAFETY.test(text)) return "safety";
  return "other"; // caller asked for a person, location never pinned down, ...
}

/** escalate_to_human -> escalated incident for the ops lead; no auto-dispatch. */
export const escalateToHuman = toolHandler("escalate_to_human", async (ctx, { args, callId }): Promise<ToolResult> => {
  const report = {
    category: escalationCategory(`${args.reason} ${args.description ?? ""}`),
    description: args.description ?? args.reason,
    priority: "critical" as const,
    source: "voice" as const,
    callId,
  };

  let outcome: ReportOutcome = await ctx.runAction(internal.incidents.createFromReport, {
    ...report,
    location: args.location ?? ESCALATION_FALLBACK_LOCATION,
  });
  // Never drop an escalation because the location did not resolve.
  if (outcome.outcome === "unknown_location") {
    outcome = await ctx.runAction(internal.incidents.createFromReport, {
      ...report,
      location: ESCALATION_FALLBACK_LOCATION,
      description: `[location unclear: "${args.location}"] ${report.description}`,
    });
  }
  if (outcome.incidentId && outcome.outcome !== "escalated") {
    await ctx.runMutation(internal.incidents.escalate, { incidentId: outcome.incidentId, reason: args.reason });
  }
  return {
    ok: true,
    outcome: "escalated",
    incidentId: outcome.incidentId ?? undefined,
    message:
      "A human operator has been alerted. Tell the caller help is coming, and to call 911 now if anyone's life is in danger.",
  };
});

/** get_directions -> locations.directions (read-only; no incident is created). */
export const getDirections = toolHandler("get_directions", async (ctx, { args }): Promise<ToolResult> => {
  const result = await ctx.runQuery(internal.locations.directions, args);
  return { ok: result.outcome !== "unknown_location", outcome: result.outcome, message: result.message };
});
