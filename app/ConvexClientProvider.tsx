"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <p className="p-6 text-sm">
        NEXT_PUBLIC_CONVEX_URL is not set. Run <code>npx convex dev</code> first.
      </p>
    );
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
