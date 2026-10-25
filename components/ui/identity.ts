import { useSyncExternalStore } from "react";

// Demo-level identity: remembered in localStorage, not real auth.
const KEY = "peopleos.identity";

export type Identity = { kind: "ops" } | { kind: "staff"; id: string };

export const OPS_PASSCODE = process.env.NEXT_PUBLIC_OPS_PASSCODE ?? "calhacks";

export const identityPath = (i: Identity) => (i.kind === "ops" ? "/ops" : `/staff/${i.id}`);

/**
 * Whether a saved identity still points at something real. Staff ids change on reseed,
 * so a staff identity is valid only if its id is in the current staff list. The operator
 * identity is passcode-gated, not id-based, so it never goes stale.
 */
export function isIdentityValid(identity: Identity, staffIds: readonly string[]): boolean {
  return identity.kind === "ops" || staffIds.includes(identity.id);
}

/** Where to send someone whose saved identity went stale; the entry screen shows a note. */
export const EXPIRED_PATH = "/?expired=1";

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
