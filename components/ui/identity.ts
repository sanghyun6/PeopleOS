import { useSyncExternalStore } from "react";

// Demo-level identity: remembered in localStorage, not real auth.
const KEY = "peopleos.identity";

export type Identity = { kind: "ops" } | { kind: "staff"; id: string };

export const OPS_PASSCODE = process.env.NEXT_PUBLIC_OPS_PASSCODE ?? "calhacks";

export const identityPath = (i: Identity) => (i.kind === "ops" ? "/ops" : `/staff/${i.id}`);

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return ""; // storage blocked: behave as signed out
  }
}

function parse(raw: string): Identity | null {
  if (raw === "ops") return { kind: "ops" };
  if (raw.startsWith("staff:")) return { kind: "staff", id: raw.slice(6) };
  return null;
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

/** Saved identity: undefined on the server / first render, then the stored value or null. */
export function useSavedIdentity(): Identity | null | undefined {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  return raw === undefined ? undefined : parse(raw);
}

export function saveIdentity(i: Identity): void {
  try {
    window.localStorage.setItem(KEY, i.kind === "ops" ? "ops" : `staff:${i.id}`);
  } catch {
    // storage blocked: the choice just will not be remembered
  }
}

export function clearIdentity(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
