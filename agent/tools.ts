// Tool definitions to register on the Cartesia Managed Agent. Each tool calls a
// Convex HTTP action at `${CONVEX_SITE_URL}/cartesia/<tool name>`.
// Cartesia webhook tools POST exactly the JSON described by `request_body_schema`
// (no envelope): model-filled params plus fields filled from dynamic variables.
// https://docs.cartesia.ai/agents/webhook-tools.md
import { incidentCategory, priority } from "../convex/lib/validators";
import type { ToolName } from "./types";

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: "string"; description: string; enum?: string[] }>;
  required: string[];
};

export type ToolDefinition = {
  name: ToolName;
  description: string;
  parameters: JsonSchema;
};

// The agent never picks these: emergencies go through escalate_to_human, blockages
// through report_blockage.
const AGENT_EXCLUDED = new Set(["blockage", "medical", "safety"]);
const CATEGORIES = incidentCategory.members.map((m) => m.value).filter((c) => !AGENT_EXCLUDED.has(c));
const PRIORITIES = priority.members.map((m) => m.value);

export const CAL_HACKS_LOCATION_EXAMPLES = '"Table 142", "Cartesia booth", "Fountain"';

/** Tool definitions; `locationExamples` are venue labels quoted in the location descriptions. */
export function buildTools(locationExamples = CAL_HACKS_LOCATION_EXAMPLES): ToolDefinition[] {
  const LOCATION_DESCRIPTION = `Exactly one location label from the location list in your instructions, e.g. ${locationExamples}.`;
  return [
  {
    name: "create_incident",
    description:
      "Log a venue problem (power, wifi, lights, furniture, supplies, cleaning, lost and found) after the caller confirmed the location once. Never use for injuries, medical issues, fire, smoke, or safety threats: use escalate_to_human. Never use for blocked paths: use report_blockage.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: LOCATION_DESCRIPTION },
        category: { type: "string", enum: CATEGORIES, description: "Problem category." },
        description: { type: "string", description: "One sentence in the caller's words." },
        priority: { type: "string", enum: PRIORITIES, description: "How urgent for the hackers affected." },
      },
      required: ["location", "category", "description", "priority"],
    },
  },
  {
    name: "report_blockage",
    description:
      "Report a blocked hallway, doorway, stairway, or path after the caller confirmed the location once. It applies immediately: staff routes change right away.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: LOCATION_DESCRIPTION },
        description: { type: "string", description: "What is blocking it, in the caller's words." },
      },
      required: ["location", "description"],
    },
  },
  {
    name: "get_directions",
    description:
      "Walking directions between two places in the venue. Only for navigation questions (how do I get from here to there). Never use it to report a problem. Returns a message to read to the caller in your own words.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: `Where the caller is now. ${LOCATION_DESCRIPTION}` },
        to: { type: "string", description: `Where the caller wants to go. ${LOCATION_DESCRIPTION}` },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "venue_search",
    description:
      "Look up event information: schedules, food and meal times, wifi rules, workshops, merch, showers, sleeping, hardware checkout, mentors, and any other question about the event that is not a location lookup or directions. Returns a message with the facts to tell the caller in your own words.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The caller's question in a short phrase, e.g. \"when is lunch\", \"where do I check out hardware\"." },
      },
      required: ["query"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Immediately hand off to a human operator. Use for any injury, medical, fire, smoke, or safety report (no location confirmation needed), when the caller asks for a person, or when the location cannot be pinned down.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: 'Why this needs a human, e.g. "someone fainted", "caller asked for a person".' },
        location: { type: "string", description: `${LOCATION_DESCRIPTION} Omit if unknown.` },
        description: { type: "string", description: "What the caller said, in their words." },
      },
      required: ["reason"],
    },
  },
  ];
}

export const TOOLS: ToolDefinition[] = buildTools();

export const toolWebhookUrl = (convexSiteUrl: string, tool: ToolName) =>
  `${convexSiteUrl.replace(/\/$/, "")}/cartesia/${tool}`;

/** Body field filled by Cartesia from `{{system__conversation_id}}`, hidden from the model. */
export const CALL_ID_FIELD = "call_id";

/** Request body for `POST https://api.cartesia.ai/v1/agents/tools` (header `Cartesia-Version`). */
export type CartesiaWebhookTool = {
  type: "webhook";
  name: ToolName;
  description: string;
  pre_tool_speech: "auto" | "force" | "off";
  execution_mode: "immediate" | "async";
  response_timeout_secs: number;
  api_schema: {
    url: string;
    method: "POST";
    request_body_schema: {
      type: "object";
      properties: Record<string, { type: "string"; description?: string; enum?: string[]; dynamic_variable?: string }>;
      required: string[];
    };
    authentication: { mode: "bearer"; token: { type: "secret"; secret_value: string } };
  };
};

/**
 * Cartesia tool body for one definition. `secret` must match CARTESIA_TOOL_SECRET
 * on the Convex deployment; Cartesia sends it as `Authorization: Bearer <secret>`.
 */
export function toCartesiaWebhookTool(def: ToolDefinition, convexSiteUrl: string, secret: string): CartesiaWebhookTool {
  return {
    type: "webhook",
    name: def.name,
    description: def.description,
    pre_tool_speech: "auto",
    // We need the result in the same turn: it tells the agent what to say next.
    execution_mode: "immediate",
    response_timeout_secs: 15,
    api_schema: {
      url: toolWebhookUrl(convexSiteUrl, def.name),
      method: "POST",
      request_body_schema: {
        type: "object",
        properties: {
          ...def.parameters.properties,
          [CALL_ID_FIELD]: { type: "string", dynamic_variable: "system__conversation_id" },
        },
        required: def.parameters.required,
      },
      authentication: { mode: "bearer", token: { type: "secret", secret_value: secret } },
    },
  };
}
