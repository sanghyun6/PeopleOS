// Emergency rule: injury / medical / fire / safety reports are never auto-dispatched.
// They go straight to a human operator (ops lead) instead.
import type { IncidentCategory } from "./validators";

export type EmergencyCheck = {
  isEmergency: boolean;
  matched: string[]; // keywords or categories that triggered it, for the escalation reason
};

const EMERGENCY_CATEGORIES: ReadonlySet<IncidentCategory> = new Set<IncidentCategory>(["medical", "safety"]);

// Deliberately broad: a false alarm costs an operator a glance, a miss costs far more.
// Negations ("nobody is hurt") still escalate for the same reason.
const EMERGENCY_KEYWORDS = [
  // medical / injury
  "injury", "injured", "hurt", "hurts", "bleeding", "blood", "unconscious", "fainted", "passed out",
  "collapsed", "seizure", "not breathing", "can't breathe", "cannot breathe", "choking",
  "allergic reaction", "anaphylaxis", "epipen", "heart attack", "chest pain", "overdose",
  "ambulance", "paramedic", "medic", "medical", "911",
  // fire / electrical
  "fire", "smoke", "smoking", "burning", "flames", "sparks", "sparking", "electric shock",
  "electrocuted", "gas leak",
  // safety / security
  "emergency", "evacuate", "weapon", "gun", "knife", "fight", "assault", "threat",
  "harassment", "harassed", "stalking", "unsafe", "danger", "dangerous",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Word boundaries so "firewall" or "medicine cabinet" do not trigger "fire"/"medic".
const KEYWORD_PATTERNS = EMERGENCY_KEYWORDS.map((k) => ({
  keyword: k,
  re: new RegExp(`(^|[^a-z0-9])${escape(k)}($|[^a-z0-9])`),
}));

export function detectEmergency(report: {
  category: IncidentCategory;
  description: string;
  transcript?: string;
}): EmergencyCheck {
  const matched: string[] = [];
  if (EMERGENCY_CATEGORIES.has(report.category)) matched.push(`category:${report.category}`);
  // Normalize curly apostrophes so "can’t breathe" matches.
  const text = `${report.description}\n${report.transcript ?? ""}`.toLowerCase().replace(/[‘’]/g, "'");
  for (const { keyword, re } of KEYWORD_PATTERNS) {
    if (re.test(text)) matched.push(keyword);
  }
  return { isEmergency: matched.length > 0, matched };
}
