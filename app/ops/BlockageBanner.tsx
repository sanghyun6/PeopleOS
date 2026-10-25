"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LIVE } from "@/components/ui/live";
import { timeAgo } from "@/components/ui/format";
import { BlockIcon, UndoIcon } from "@/components/ui/icons";

/** Blockages that were applied automatically, each with an Undo (unblocks the edge and re-plans). */
export function BlockageBanner() {
  const applied = useQuery(api.blockages.listApplied, LIVE.blockages ? {} : "skip");
  const undo = useMutation(api.blockages.undo);
  const [pending, setPending] = useState<Id<"incidents"> | null>(null);

  if (!applied?.length) return null;
  return (
    <ul className="space-y-2 border-b border-line px-4 py-2 lg:px-6">
      {applied.map((b) => (
        <li
          key={b._id}
          className="flex items-center gap-4 rounded-xl bg-amber/10 py-2 pr-2 pl-4 text-sm ring-1 ring-inset ring-amber/30"
        >
          <BlockIcon size={16} className="shrink-0 text-amber" />
          <p className="min-w-0 flex-1 truncate">
            <span className="font-medium text-amber">Path blocked: {b.label}.</span>{" "}
            <span className="text-fg">
              {b.reroutedCount} {b.reroutedCount === 1 ? "task" : "tasks"} rerouted
            </span>
            <span className="ml-2 text-xs text-muted" suppressHydrationWarning>
              {timeAgo(b._creationTime)}
            </span>
          </p>
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
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium text-fg ring-1 ring-inset ring-line-strong transition hover:bg-raised disabled:opacity-50"
          >
            <UndoIcon size={14} />
            Undo
          </button>
        </li>
      ))}
    </ul>
  );
}
