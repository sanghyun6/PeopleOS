import type { IncidentStatus, Priority } from "@/convex/lib/validators";
import { STATUS_COLOR, COLOR_HEX } from "@/components/venue/types";
import { label } from "./format";

const PRIORITY_CLASS: Record<Priority, string> = {
  low: "bg-neutral-700 text-neutral-200",
  medium: "bg-sky-900 text-sky-200",
  high: "bg-orange-900 text-orange-200",
  critical: "bg-red-700 text-white",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${PRIORITY_CLASS[priority]}`}>
      {priority}
    </span>
  );
}

/** Dot + text using the same red/yellow/green buckets as the 3D markers. */
export function StatusPill({ status }: { status: IncidentStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-300">
      <span className="size-2 rounded-full" style={{ background: COLOR_HEX[STATUS_COLOR[status]] }} />
      {label(status)}
    </span>
  );
}
