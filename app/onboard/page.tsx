"use client";

import dynamic from "next/dynamic";

// Client-only: the draft lives in localStorage.
const Wizard = dynamic(() => import("@/components/onboard/Wizard").then((m) => m.Wizard), { ssr: false });

export default function OnboardPage() {
  return <Wizard />;
}
