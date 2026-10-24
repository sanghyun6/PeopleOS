// Tool definitions to register on the Cartesia Managed Agent. Each tool calls a
// Convex HTTP action at `${CONVEX_SITE_URL}/cartesia/<tool name>`.
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

const CATEGORIES = incidentCategory.members.map((m) => m.value);
const PRIORITIES = priority.members.map((m) => m.value);

export const TOOLS: ToolDefinition[] = [
  {
    name: "create_incident",
    description:
      "Create a venue incident after the caller confirmed the location once. Do not use for injuries, medical issues, fire, or safety threats: use escalate_to_human.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: 'One location from the vocabulary, e.g. "Table 142" or "Cartesia booth".' },
        category: { type: "string", enum: CATEGORIES, description: "Problem category." },
        description: { type: "string", description: "One sentence in the caller's words." },
        priority: { type: "string", enum: PRIORITIES, description: "How urgent for the hackers affected." },
      },
      required: ["location", "category", "description", "priority"],
    },
  },
  {
    name: "report_blockage",
    description: "Report a blocked hallway or path. An operator confirms it before routes change.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "Where the blockage is, from the vocabulary." },
        description: { type: "string", description: "What is blocking it." },
      },
      required: ["location", "description"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Immediately hand off to a human operator. Use for any injury, medical, fire, or safety report, or when the caller asks for a person.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why this needs a human." },
        location: { type: "string", description: "Location if known." },
        description: { type: "string", description: "What the caller said." },
      },
      required: ["reason"],
    },
  },
];

export const toolWebhookUrl = (convexSiteUrl: string, tool: ToolName) =>
  `${convexSiteUrl.replace(/\/$/, "")}/cartesia/${tool}`;
