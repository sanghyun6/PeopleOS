"use client";

import { useEffect, useRef, useState } from "react";
import { StaffView } from "@/components/staff/StaffView";
import type { Doc } from "@/convex/_generated/dataModel";
import { Avatar, RoleChip } from "@/components/ui/badges";
import { useStaffList } from "@/components/ui/hooks";
import { PhoneIcon } from "@/components/ui/icons";
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
      <div className="flex items-center gap-2" style={{ height: CAPTION_H }}>
        <Avatar staff={staff} size={24} />
        <span className="text-sm font-medium">{staff.name}</span>
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

/** One screen, whole flow: ops dashboard on the left, two staff phones on the right. */
export default function DemoPage() {
  const staff = useStaffList();
  // Cal Hacks demo script: Priya and Jordan. Other venues (Venue Pack): the first two facilities staff.
  const scripted = ["Priya", "Jordan"].map((first) => staff?.find((s) => s.name.startsWith(first)));
  const facilities = staff?.filter((s) => s.role === "facilities") ?? [];
  const phones = scripted.every(Boolean) ? scripted : [0, 1].map((i) => facilities[i] ?? staff?.[i]);

  return (
    <div className="flex h-dvh overflow-hidden bg-ink text-fg">
      <section className="min-w-0 basis-[64%] border-r border-line">
        <OpsView embedded />
      </section>
      <section className="flex min-w-0 basis-[36%] flex-col bg-surface/40">
        <header className="flex items-center gap-2 border-b border-line px-6 py-4">
          <PhoneIcon size={16} className="text-accent" />
          <h2 className="text-sm font-medium">Staff phones</h2>
          <span className="text-xs text-faint">Live, same data as the dashboard</span>
        </header>
        <div className="flex min-h-0 flex-1 gap-4 p-6">
          {staff === undefined ? (
            <p className="m-auto text-muted">Loading…</p>
          ) : (
            phones.map((s, i) =>
              s ? (
                <Phone key={s._id} staff={s}>
                  <StaffView staffId={s._id} embedded />
                </Phone>
              ) : (
                <p key={i} className="m-auto text-sm text-muted">Seed staff missing.</p>
              )
            )
          )}
        </div>
      </section>
    </div>
  );
}
