"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { AssignmentView } from "@/components/staff/AssignmentCard";
import { LIVE } from "./live";
import { mockAssignments, mockIncidents, mockStaff, mockStats, mockZones } from "./mock";

// Each hook reads live Convex when its flag is on, else mock data (see live.ts).

export function useStaffList(): Doc<"staff">[] | undefined {
  const live = useQuery(api.staff.list, LIVE.core ? {} : "skip");
  return LIVE.core ? live : mockStaff;
}

export function useStaff(staffId: Id<"staff">): Doc<"staff"> | null | undefined {
  const live = useQuery(api.staff.get, LIVE.core ? { staffId } : "skip");
  return LIVE.core ? live : (mockStaff.find((s) => s._id === staffId) ?? mockStaff[0]);
}

export function useActiveIncidents(): Doc<"incidents">[] | undefined {
  const live = useQuery(api.incidents.listActive, LIVE.core ? {} : "skip");
  return LIVE.core ? live : mockIncidents;
}

export function useIncident(incidentId: Id<"incidents"> | null): Doc<"incidents"> | null | undefined {
  const live = useQuery(api.incidents.get, LIVE.core && incidentId ? { incidentId } : "skip");
  if (!incidentId) return null;
  return LIVE.core ? live : (mockIncidents.find((i) => i._id === incidentId) ?? null);
}

export function useGraph(): { zones: Doc<"zones">[]; edges: Doc<"edges">[] } | undefined {
  const live = useQuery(api.zones.graph, LIVE.core ? {} : "skip");
  return LIVE.core ? live : { zones: mockZones, edges: [] };
}

export type Stats = { open: number; resolved: number; avgAckMs: number | null; avgResolveMs: number | null };

export function useStats(): Stats | undefined {
  const live = useQuery(api.incidents.stats, LIVE.stats ? {} : "skip");
  return LIVE.stats ? live : mockStats;
}

export type RetrievalStats = { count: number; avgMs: number | null; fallbacks: number };

/** Moss retrieval latency for the voice agent's venue_search tool. Mock mode shows none. */
export function useRetrievalStats(): RetrievalStats | undefined {
  const live = useQuery(api.retrievals.stats, LIVE.stats ? {} : "skip");
  return LIVE.stats ? live : { count: 0, avgMs: null, fallbacks: 0 };
}

export type BitdeerStats = { count: number; avgMs: number | null; failed: number };

/** Bitdeer AI Model Studio calls (dedup embeddings + verdicts, staff briefs). Mock mode shows none. */
export function useBitdeerStats(): BitdeerStats | undefined {
  const live = useQuery(api.bitdeer.stats, LIVE.stats ? {} : "skip");
  return LIVE.stats ? live : { count: 0, avgMs: null, failed: 0 };
}

/** Offered + accepted assignments with routes (3D route lines). Mock mode draws none. */
export function useActiveAssignments(): Doc<"assignments">[] | undefined {
  const live = useQuery(api.assignments.listActive, LIVE.assignments ? {} : "skip");
  return LIVE.assignments ? live : [];
}

export type AssignmentActions = {
  accept: (id: Id<"assignments">) => Promise<void>;
  decline: (id: Id<"assignments">) => Promise<void>;
  complete: (id: Id<"assignments">) => Promise<void>;
};

/** Offered/accepted assignments for one staff member plus the three phone actions. */
export function useStaffAssignments(staffId: Id<"staff">): {
  assignments: AssignmentView[] | undefined;
  actions: AssignmentActions;
} {
  const live = useQuery(api.assignments.forStaff, LIVE.assignments ? { staffId } : "skip") as
    | AssignmentView[]
    | undefined;
  const acceptM = useMutation(api.assignments.accept);
  const declineM = useMutation(api.assignments.decline);
  const completeM = useMutation(api.assignments.complete);

  const [mock, setMock] = useState<AssignmentView[]>(mockAssignments);
  const setStatus = useCallback(
    (id: Id<"assignments">, status: Doc<"assignments">["status"]) =>
      setMock((list) =>
        status === "accepted"
          ? list.map((a) => (a.assignment._id === id ? { ...a, assignment: { ...a.assignment, status } } : a))
          : list.filter((a) => a.assignment._id !== id),
      ),
    [],
  );

  const actions: AssignmentActions = LIVE.assignments
    ? {
        accept: async (assignmentId) => void (await acceptM({ assignmentId })),
        decline: async (assignmentId) => void (await declineM({ assignmentId })),
        complete: async (assignmentId) => void (await completeM({ assignmentId })),
      }
    : {
        accept: async (i) => setStatus(i, "accepted"),
        decline: async (i) => setStatus(i, "declined"),
        complete: async (i) => setStatus(i, "completed"),
      };

  return { assignments: LIVE.assignments ? live : mock, actions };
}
