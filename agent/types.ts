// Contract between the Cartesia voice agent and our Convex HTTP actions.
import type { IncidentCategory, Priority } from "../convex/lib/validators";

export type ToolName = "create_incident" | "report_blockage" | "escalate_to_human";

export type CreateIncidentArgs = {
  location: string; // must come from the fixed vocabulary, confirmed once with the caller
  category: IncidentCategory;
  description: string;
  priority: Priority;
};

export type ReportBlockageArgs = {
  location: string;
  description: string; // "hallway blocked by a cart"
};

export type EscalateToHumanArgs = {
  reason: string; // emergency keyword, caller request, or agent unsure
  location?: string;
  description?: string;
};

export type ToolArgs = {
  create_incident: CreateIncidentArgs;
  report_blockage: ReportBlockageArgs;
  escalate_to_human: EscalateToHumanArgs;
};

/** Normalized tool call after parsing Cartesia's webhook body. */
export type ToolCall<N extends ToolName = ToolName> = {
  tool: N;
  args: ToolArgs[N];
  callId?: string;
  transcript?: string;
};

/** What our webhook returns; `message` is what the agent says next. */
export type ToolResult = {
  ok: boolean;
  message: string;
  incidentId?: string;
};
