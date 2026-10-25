"use client";

import { TabBar } from "@/components/ui/TabBar";
import { OpsView } from "./OpsView";

export default function OpsPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink md:h-dvh">
      <TabBar />
      <OpsView />
    </div>
  );
}
