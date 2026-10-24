// System prompt for the Cartesia Managed Agent (Claude as the LLM if selectable).
// Rules to encode: one confirmation question for location ("Table 142 on the main
// floor, right?"), emergency keywords -> escalate_to_human, never invent locations.
import type { LocationVocabulary } from "./vocabulary";
import { todo } from "../convex/lib/todo";

export function buildSystemPrompt(_vocab: LocationVocabulary): string {
  return todo("buildSystemPrompt");
}
