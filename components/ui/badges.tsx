import type { Doc } from "@/convex/_generated/dataModel";
import type { IncidentCategory, IncidentStatus, Priority } from "@/convex/lib/validators";
import { STATUS_COLOR, COLOR_HEX, ROLE_HEX } from "@/components/venue/types";
import { CATEGORY_ICON, CATEGORY_LABEL } from "./icons";
import { label } from "./format";

const PRIORITY_CLASS: Record<Priority, string> = {
  low: "text-muted ring-line-strong",
  medium: "text-fg ring-line-strong",
  high: "text-amber ring-amber/40 bg-amber/10",
  critical: "text-white ring-red bg-red/85",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium capitalize ring-1 ring-inset ${PRIORITY_CLASS[priority]}`}
    >
      {priority}
    </span>
  );
}

const STATUS_TEXT: Record<IncidentStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  acknowledged: "On it",
  resolved: "Resolved",
  escalated: "Escalated",
  pending_review: "Needs review",
  cancelled: "Cancelled",
};

/** Dot + text using the same red/amber/green buckets as the 3D markers. */
export function StatusPill({ status, size = "sm" }: { status: IncidentStatus; size?: "sm" | "lg" }) {
  const hex = COLOR_HEX[STATUS_COLOR[status]];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ${
        size === "lg" ? "h-8 px-3 text-sm" : "h-5 px-2 text-[11px]"
      }`}
      style={{ color: hex, background: `${hex}1f`, boxShadow: `inset 0 0 0 1px ${hex}40` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: hex }} />
      {STATUS_TEXT[status]}
    </span>
  );
}

/** Category icon + short label. */
export function CategoryTag({ category, className = "" }: { category: IncidentCategory; className?: string }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
      <Icon size={14} />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

/** Square icon tile for list rows, tinted by status bucket. */
export function CategoryTile({ category, status }: { category: IncidentCategory; status: IncidentStatus }) {
  const Icon = CATEGORY_ICON[category];
  const hex = COLOR_HEX[STATUS_COLOR[status]];
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-lg"
      style={{ color: hex, background: `${hex}1a`, boxShadow: `inset 0 0 0 1px ${hex}33` }}
    >
      <Icon size={16} />
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Role-colored initials avatar. */
export function Avatar({ staff, size = 32 }: { staff: Pick<Doc<"staff">, "name" | "role">; size?: number }) {
  const hex = ROLE_HEX[staff.role];
  return (
    <span
      title={staff.name}
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        color: hex,
        background: `${hex}1f`,
        boxShadow: `inset 0 0 0 1px ${hex}55`,
      }}
    >
      {initials(staff.name)}
    </span>
  );
}

/** Role chip, same hue as the avatar and the 3D staff dot. */
export function RoleChip({ role }: { role: Doc<"staff">["role"] }) {
  const hex = ROLE_HEX[role];
  return (
    <span
      className="inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium capitalize"
      style={{ color: hex, background: `${hex}14` }}
    >
      {label(role)}
    </span>
  );
}

const STAFF_STATUS: Record<Doc<"staff">["status"], { text: string; hex: string }> = {
  available: { text: "Available", hex: COLOR_HEX.green },
  busy: { text: "On a task", hex: COLOR_HEX.yellow },
  off_duty: { text: "Off duty", hex: "#667085" },
};

export function StaffStatusPill({ status }: { status: Doc<"staff">["status"] }) {
  const { text, hex } = STAFF_STATUS[status];
  return (
    <span
      className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium"
      style={{ color: hex, background: `${hex}1a`, boxShadow: `inset 0 0 0 1px ${hex}40` }}
    >
      <span className="size-2 rounded-full" style={{ background: hex }} />
      {text}
    </span>
  );
}

export const STAFF_DOT_HEX = Object.fromEntries(
  Object.entries(STAFF_STATUS).map(([k, v]) => [k, v.hex]),
) as Record<Doc<"staff">["status"], string>;
