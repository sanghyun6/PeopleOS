"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LIVE } from "@/components/ui/live";
import { timeAgo } from "@/components/ui/format";

/** Blockages that were applied automatically, each with an Undo (unblocks the edge and re-plans). */
export function BlockageBanner() {
  const applied = useQuery(api.blockages.listApplied, LIVE.blockages ? {} : "skip");
  const undo = useMutation(api.blockages.undo);
  const [pending, setPending] = useState<Id<"incidents"> | null>(null);

  if (!applied?.length) return null;
  return (
    <ul className="space-y-1 border-b border-yellow-900 bg-yellow-950/60 px-4 py-2 text-sm">
      {applied.map((b) => (
        <li key={b._id} className="flex items-center justify-between gap-3">
          <span className="text-yellow-100">
            <strong className="font-semibold">Blockage applied:</strong> {b.label}, {b.reroutedCount}{" "}
            {b.reroutedCount === 1 ? "task" : "tasks"} rerouted
            <span className="ml-2 text-xs text-yellow-300/70" suppressHydrationWarning>
              {timeAgo(b._creationTime)}
            </span>
          </span>
          <button
            disabled={pending === b._id}
            onClick={async () => {
              setPending(b._id);
              try {
                await undo({ blockageId: b._id });
              } finally {
                setPending(null);
              }
            }}
            className="shrink-0 rounded-md border border-yellow-600 px-3 py-1 text-xs font-semibold text-yellow-100 hover:bg-yellow-900 disabled:opacity-50"
          >
            Undo
          </button>
        </li>
      ))}
    </ul>
  );
}
