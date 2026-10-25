"use client";

import { useEffect, useRef, useState } from "react";
import { StaffView } from "@/components/staff/StaffView";
import type { Doc } from "@/convex/_generated/dataModel";
import { Avatar, RoleChip, STAFF_DOT_HEX } from "@/components/ui/badges";
import { useActiveAssignments, useStaffList } from "@/components/ui/hooks";
import { PhoneIcon } from "@/components/ui/icons";
import { TabBar } from "@/components/ui/TabBar";
import { OpsView } from "@/app/ops/OpsView";

const PHONE_W = 390;
const PHONE_H = 800;
const CAPTION_H = 40; // name row above each phone

/** A phone-shaped frame scaled to fit its cell, so the same layout works at any screen size. */
function Phone({ staff, children }: { staff: Doc<"staff">; children: React.ReactNode }) {
  const cell = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = cell.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / PHONE_W, (el.clientHeight - CAPTION_H) / PHONE_H, 1));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={cell} className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center">
      <div className="flex max-w-full items-center gap-2 overflow-hidden" style={{ height: CAPTION_H }}>
        <Avatar staff={staff} size={24} />
        <span className="truncate text-sm font-medium">{staff.name}</span>
        <RoleChip role={staff.role} />
      </div>
      <div className="relative" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <div
          className="absolute top-0 left-0 overflow-hidden rounded-[52px] border-[10px] border-[#1c2230] bg-ink shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_64px_rgba(0,0,0,0.5)]"
          style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <div className="absolute top-2.5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          <div className="h-full pt-9">{children}</div>
        </div>
      </div>
    </div>
  );
}

const MAX_PHONES = 2; // more than two phones get too small to read on one screen

/** Names across the top: click to show or hide that person's phone (up to MAX_PHONES at once). */
function StaffPicker({
  staff,
  shown,
  onToggle,
  offered,
  working,
}: {
  staff: Doc<"staff">[];
  shown: string[];
  onToggle: (id: string) => void;
  offered: Set<string>;
  working: Set<string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2" role="group" aria-label="Staff phones to show">
      {staff.map((s) => {
        const on = shown.includes(s._id);
        const off = s.status === "off_duty";
        return (
          <button
            key={s._id}
            type="button"
            onClick={() => onToggle(s._id)}
            aria-pressed={on}
            title={off ? `${s.name} (off duty)` : s.name}
            className={`relative flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs transition ${
              on ? "bg-raised text-fg ring-1 ring-accent" : "text-muted ring-1 ring-line hover:text-fg"
            } ${off ? "opacity-50" : ""}`}
          >
            <Avatar staff={s} size={20} />
            {s.name.split(" ")[0]}
            {(offered.has(s._id) || working.has(s._id)) && (
              <span
                aria-label={offered.has(s._id) ? "new assignment" : "working"}
                className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface"
                style={{ background: offered.has(s._id) ? STAFF_DOT_HEX.busy : "var(--accent)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** One screen, whole flow: ops dashboard on the left, staff phones on the right (pick whose). */
export default function DemoPage() {
  const staff = useStaffList();
  const assignments = useActiveAssignments();
  // null = nobody chosen yet: default to the Cal Hacks script (Priya, Jordan) or the first two facilities staff.
  const [picked, setPicked] = useState<string[] | null>(null);
  const defaults = (() => {
    const scripted = ["Priya", "Jordan"].map((first) => staff?.find((s) => s.name.startsWith(first)));
    const facilities = staff?.filter((s) => s.role === "facilities") ?? [];
    const two = scripted.every(Boolean) ? scripted : [0, 1].map((i) => facilities[i] ?? staff?.[i]);
    return two.filter((s): s is Doc<"staff"> => !!s).map((s) => s._id as string);
  })();
  // Ignore picks that no longer exist (e.g. after a reseed changed the ids).
  const known = new Set(staff?.map((s) => s._id as string));
  const valid = (picked ?? []).filter((id) => known.has(id));
  const shown = picked === null || valid.length === 0 ? defaults : valid;
  const phones = shown.map((id) => staff?.find((s) => s._id === id)).filter((s): s is Doc<"staff"> => !!s);

  const toggle = (id: string) => {
    const next = shown.includes(id) ? shown.filter((x) => x !== id) : [...shown, id].slice(-MAX_PHONES);
    setPicked(next.length ? next : shown); // never leave the panel empty
  };
  const offered = new Set((assignments ?? []).filter((a) => a.status === "offered").map((a) => a.staffId as string));
  const working = new Set((assignments ?? []).filter((a) => a.status === "accepted").map((a) => a.staffId as string));

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink text-fg">
      <TabBar dense />
      <div className="flex min-h-0 flex-1">
        <section className="min-w-0 basis-[64%] border-r border-line">
          <OpsView embedded />
        </section>
        <section className="flex min-w-0 basis-[36%] flex-col bg-surface/40">
          <header className="flex items-center gap-2 border-b border-line px-6 py-3">
            <PhoneIcon size={16} className="text-accent" />
            <h2 className="text-sm font-medium">Staff phones</h2>
            <span className="text-xs text-faint">Pick who to show; the dot marks a new assignment</span>
          </header>
          {staff && <StaffPicker staff={staff} shown={shown} onToggle={toggle} offered={offered} working={working} />}
          <div className="flex min-h-0 flex-1 gap-4 p-6">
            {staff === undefined ? (
              <p className="m-auto text-muted">Loading…</p>
            ) : phones.length === 0 ? (
              <p className="m-auto text-sm text-muted">Seed staff missing.</p>
            ) : (
              phones.map((s) => (
                <Phone key={s._id} staff={s}>
                  <StaffView staffId={s._id} embedded />
                </Phone>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
