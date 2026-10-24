"use client";

import { useEffect, useRef, useState } from "react";
import { StaffView } from "@/components/staff/StaffView";
import { useStaffList } from "@/components/ui/hooks";
import { OpsView } from "@/app/ops/OpsView";

const PHONE_W = 390;
const PHONE_H = 800;

/** A phone-shaped frame scaled to fit its cell, so the same layout works at any screen size. */
function Phone({ name, children }: { name: string; children: React.ReactNode }) {
  const cell = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = cell.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / PHONE_W, el.clientHeight / PHONE_H, 1));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{name}</div>
      <div ref={cell} className="relative min-h-0 w-full flex-1">
        <div
          className="absolute left-1/2 top-0 overflow-hidden rounded-[44px] border-[10px] border-neutral-700 bg-neutral-950 shadow-2xl"
          style={{ width: PHONE_W, height: PHONE_H, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
        >
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
          <div className="h-full pt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** One screen, whole flow: ops dashboard on the left, two staff phones on the right. */
export default function DemoPage() {
  const staff = useStaffList();
  const phones = ["Priya", "Jordan"].map((first) => staff?.find((s) => s.name.startsWith(first)));

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <section className="min-w-0 basis-[65%] border-r border-neutral-800">
        <OpsView embedded />
      </section>
      <section className="flex min-w-0 basis-[35%] gap-3 p-3">
        {staff === undefined ? (
          <p className="m-auto text-neutral-500">Loading…</p>
        ) : (
          phones.map((s, i) =>
            s ? (
              <Phone key={s._id} name={s.name}>
                <StaffView staffId={s._id} embedded />
              </Phone>
            ) : (
              <p key={i} className="m-auto text-sm text-neutral-500">Seed staff missing.</p>
            )
          )
        )}
      </section>
    </div>
  );
}
