"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Pick which staff phone this device is (demo convenience). */
export default function StaffIndexPage() {
  const staff = useQuery(api.staff.list);
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">Who are you?</h1>
      <ul className="space-y-2">
        {staff?.map((s) => (
          <li key={s._id}>
            <Link className="block rounded-lg border px-4 py-3" href={`/staff/${s._id}`}>
              {s.name} <span className="text-neutral-500">· {s.role}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
