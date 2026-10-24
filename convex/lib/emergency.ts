// Emergency rule: injury / medical / fire / safety reports are never auto-dispatched.
// They go straight to a human operator (ops lead) instead.
import type { IncidentCategory } from "./validators";
import { todo } from "./todo";

export type EmergencyCheck = {
  isEmergency: boolean;
  matched: string[]; // keywords or categories that triggered it, for the escalation reason
};

export function detectEmergency(_report: {
  category: IncidentCategory;
  description: string;
  transcript?: string;
}): EmergencyCheck {
  return todo("detectEmergency");
}
