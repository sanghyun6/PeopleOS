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
      className={`rounded-md text-xs text-faint transition-colors hover:text-fg ${className}`}
    >
      Switch user
    </button>
  );
}
