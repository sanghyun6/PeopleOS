"use client";

import dynamic from "next/dynamic";
import { TabBar } from "@/components/ui/TabBar";

// Client-only: the draft lives in localStorage.
const Wizard = dynamic(() => import("@/components/onboard/Wizard").then((m) => m.Wizard), { ssr: false });

export default function OnboardPage() {
  return (
    <>
      <TabBar />
      <Wizard />
    </>
  );
}
