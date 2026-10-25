"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/onboard", label: "Onboard" },
  { href: "/demo", label: "Live demo" },
  { href: "/ops", label: "Ops" },
] as const;

/** Thin top tab bar shared by /onboard, /demo and /ops. `dense` is a 36px version for /demo. */
export function TabBar({ dense = false }: { dense?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className={`flex shrink-0 items-stretch gap-1 border-b border-line bg-surface px-3 ${dense ? "h-9" : "h-10"}`}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center border-b-2 px-3 text-sm font-medium transition ${
              active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
