"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar, RoleChip } from "@/components/ui/badges";
import { Brand } from "@/components/ui/Brand";
import { ChevronIcon, LockIcon } from "@/components/ui/icons";
import { OPS_PASSCODE, clearIdentity, identityPath, isIdentityValid, useSavedIdentity, saveIdentity } from "@/components/ui/identity";

/** Single entry: pick who you are once; later visits go straight to your view. */
export default function Page() {
  return (
    <Suspense fallback={<main className="p-8 text-muted">Loading…</main>}>
      <WhoAreYouPage />
    </Suspense>
  );
}

function WhoAreYouPage() {
  const router = useRouter();
  const expired = useSearchParams().get("expired") === "1";
  const staff = useQuery(api.staff.list);
  const saved = useSavedIdentity();
  const [askPasscode, setAskPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [wrong, setWrong] = useState(false);

  // Only trust a saved identity once the staff list has loaded and still contains it.
  const stale = !!saved && staff !== undefined && !isIdentityValid(saved, staff.map((s) => s._id));
  useEffect(() => {
    if (stale) {
      clearIdentity();
      router.replace("/?expired=1");
    } else if (saved && staff !== undefined) {
      router.replace(identityPath(saved));
    }
  }, [saved, staff, stale, router]);

  if (saved !== null && !stale) return <main className="p-8 text-muted">Loading…</main>;

  const pickStaff = (id: string) => {
    saveIdentity({ kind: "staff", id });
    router.push(`/staff/${id}`);
  };

  const submitPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode !== OPS_PASSCODE) return setWrong(true);
    saveIdentity({ kind: "ops" });
    router.push("/ops");
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-16">
      <header className="mb-8 sm:mb-12">
        <Brand />
        <p className="mt-2 text-sm text-muted">Every call changes the venue.</p>
      </header>

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Who are you?</h1>
      <p className="mt-2 text-muted">Pick your name once. This device remembers it.</p>

      {expired && (
        <p role="status" className="mt-6 rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber ring-1 ring-inset ring-amber/30">
          Session expired, pick your name again.
        </p>
      )}

      <h2 className="mt-8 mb-2 text-sm font-medium text-muted">Staff</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {staff === undefined &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-[72px] animate-pulse rounded-xl bg-surface ring-1 ring-inset ring-line" />
          ))}
        {staff?.map((s) => (
          <li key={s._id}>
            <button
              className="group flex w-full items-center gap-4 rounded-xl bg-surface p-4 text-left ring-1 ring-inset ring-line transition hover:bg-raised hover:ring-line-strong"
              onClick={() => pickStaff(s._id)}
            >
              <Avatar staff={s} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.name}</span>
                <span className="mt-1 block">
                  <RoleChip role={s.role} />
                </span>
              </span>
              <ChevronIcon size={16} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-fg" />
            </button>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 mb-2 text-sm font-medium text-muted">Control room</h2>
      {askPasscode ? (
        <form onSubmit={submitPasscode} className="rounded-xl bg-surface p-4 ring-1 ring-inset ring-accent/50">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium" htmlFor="passcode">
            <LockIcon size={16} className="text-accent" />
            Operator passcode
          </label>
          <div className="flex gap-2">
            <input
              id="passcode"
              type="password"
              autoFocus
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setWrong(false);
              }}
              aria-invalid={wrong}
              className="h-11 min-w-0 flex-1 rounded-lg bg-ink px-3 ring-1 ring-inset ring-line-strong outline-none transition focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-accent px-5 font-semibold text-accent-ink transition hover:brightness-110"
            >
              Open dashboard
            </button>
          </div>
          {wrong && <p className="mt-2 text-sm text-red">Wrong passcode. Try again.</p>}
        </form>
      ) : (
        <button
          className="group flex w-full items-center gap-4 rounded-xl bg-surface p-4 text-left ring-1 ring-inset ring-line transition hover:bg-raised hover:ring-accent/50"
          onClick={() => setAskPasscode(true)}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent ring-1 ring-inset ring-accent/40">
            <LockIcon size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Operator</span>
            <span className="block text-sm text-muted">Live venue map and dispatch. Passcode required.</span>
          </span>
          <ChevronIcon size={16} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-fg" />
        </button>
      )}
    </main>
  );
}
