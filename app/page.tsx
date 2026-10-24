"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { label } from "@/components/ui/format";
import { OPS_PASSCODE, identityPath, useSavedIdentity, saveIdentity } from "@/components/ui/identity";

/** Single entry: pick who you are once; later visits go straight to your view. */
export default function WhoAreYouPage() {
  const router = useRouter();
  const staff = useQuery(api.staff.list);
  const saved = useSavedIdentity();
  const [askPasscode, setAskPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (saved) router.replace(identityPath(saved));
  }, [saved, router]);

  if (saved !== null) return <main className="p-8 text-neutral-500">Loading…</main>;

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
    <main className="mx-auto w-full max-w-md flex-1 p-6">
      <h1 className="text-3xl font-semibold">Who are you?</h1>
      <p className="mb-5 text-neutral-500">PeopleOS · Every call changes the venue.</p>
      <ul className="space-y-2">
        {staff === undefined && <li className="text-neutral-500">Loading staff…</li>}
        {staff?.map((s) => (
          <li key={s._id}>
            <button className="block w-full rounded-lg border px-4 py-3 text-left" onClick={() => pickStaff(s._id)}>
              {s.name} <span className="text-neutral-500">· {label(s.role)}</span>
            </button>
          </li>
        ))}
        <li>
          {askPasscode ? (
            <form onSubmit={submitPasscode} className="space-y-2 rounded-lg border border-foreground px-4 py-3">
              <label className="block text-sm font-medium" htmlFor="passcode">
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
                  className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2"
                />
                <button type="submit" className="rounded-md bg-foreground px-4 py-2 text-background">
                  Enter
                </button>
              </div>
              {wrong && <p className="text-sm text-red-500">Wrong passcode.</p>}
            </form>
          ) : (
            <button
              className="block w-full rounded-lg bg-foreground px-4 py-3 text-left text-background"
              onClick={() => setAskPasscode(true)}
            >
              Operator <span className="opacity-60">· ops dashboard</span>
            </button>
          )}
        </li>
      </ul>
    </main>
  );
}
