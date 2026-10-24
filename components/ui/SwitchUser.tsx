"use client";

import { useRouter } from "next/navigation";
import { clearIdentity } from "./identity";

/** Forget the saved identity and go back to the "Who are you?" screen. */
export function SwitchUser({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        clearIdentity();
        router.push("/");
      }}
      className={`text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200 ${className}`}
    >
      Switch user
    </button>
  );
}
