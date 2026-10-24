// HTTP actions called by Cartesia agent tools. Routed in http.ts.
import { httpAction } from "./_generated/server";
import type { ToolCall, ToolName, ToolResult } from "../agent/types";
import { todo } from "./lib/todo";

const json = (status: number, body: ToolResult) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const notImplemented = (tool: ToolName) => json(501, { ok: false, message: `${tool} is not implemented yet` });

/**
 * Validate the webhook body and normalize it to a ToolCall.
 * TODO: confirm Cartesia Managed Agents' tool-call envelope (args, call id, transcript).
 */
export function parseToolCall<N extends ToolName>(_tool: N, _body: unknown): ToolCall<N> {
  return todo("parseToolCall");
}

/** Reject requests without our shared secret (set the same header in Cartesia). */
export function isAuthorized(_request: Request): boolean {
  return todo("isAuthorized");
}

/** create_incident -> incidents.createFromReport (emergency rule, dedup, dispatch). */
export const createIncident = httpAction(async () => notImplemented("create_incident"));

/** report_blockage -> incident in pending_review until an operator confirms. */
export const reportBlockage = httpAction(async () => notImplemented("report_blockage"));

/** escalate_to_human -> escalated incident for the ops lead; no auto-dispatch. */
export const escalateToHuman = httpAction(async () => notImplemented("escalate_to_human"));
