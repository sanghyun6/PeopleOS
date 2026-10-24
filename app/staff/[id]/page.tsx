"use client";

import { useParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { StaffView } from "@/components/staff/StaffView";

export default function StaffPage() {
  const { id } = useParams<{ id: string }>();
  return <StaffView staffId={id as Id<"staff">} />;
}
